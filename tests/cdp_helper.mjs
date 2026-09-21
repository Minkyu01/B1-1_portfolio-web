// 실제 Chrome을 조종하는 최소 도우미. 외부 패키지 없이 Node 내장 WebSocket/fetch만 사용한다.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const findChrome = () => {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];

  return candidates.find((path) => path && existsSync(path)) ?? null;
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
};

export const startStaticServer = async (root) => {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, "http://localhost");
    const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
    const filePath = join(root, relative === "" ? "index.html" : relative);

    if (!filePath.startsWith(root + sep) && filePath !== root) {
      response.writeHead(403).end("forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);

      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

export class Page {
  constructor(socket, targetId, debugPort) {
    this.socket = socket;
    this.targetId = targetId;
    this.debugPort = debugPort;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.consoleErrors = [];
    this.apiCalls = [];

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.id) {
        const waiter = this.pending.get(message.id);

        this.pending.delete(message.id);
        if (message.error) {
          waiter?.reject(new Error(`${waiter.method}: ${message.error.message}`));
        } else {
          waiter?.resolve(message.result);
        }
        return;
      }

      (this.listeners.get(message.method) ?? []).forEach((listener) => listener(message.params));
    };
  }

  static async open(debugPort) {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
    const target = await response.json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });

    const page = new Page(socket, target.id, debugPort);

    await Promise.all([
      page.send("Page.enable"),
      page.send("Runtime.enable"),
      page.send("Log.enable"),
    ]);
    page.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      page.consoleErrors.push(`exception: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    });
    page.on("Runtime.consoleAPICalled", ({ type, args }) => {
      if (type === "error") {
        page.consoleErrors.push(`console.error: ${args.map((arg) => arg.value ?? arg.description).join(" ")}`);
      }
    });
    page.on("Log.entryAdded", ({ entry }) => {
      if (entry.level === "error") {
        page.consoleErrors.push(`log: ${entry.text} ${entry.url ?? ""}`.trim());
      }
    });
    return page;
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      this.nextId += 1;
      this.pending.set(this.nextId, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id: this.nextId, method, params }));
    });
  }

  on(method, listener) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        this.listeners.set(method, this.listeners.get(method).filter((item) => item !== listener));
        resolve(params);
      };

      this.on(method, listener);
    });
  }

  async viewport(width, height = 900, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  }

  async emulateMedia(features) {
    await this.send("Emulation.setEmulatedMedia", { features });
  }

  async goto(url) {
    const loaded = this.once("Page.loadEventFired");

    await this.send("Page.navigate", { url });
    await loaded;
  }

  async reload() {
    const loaded = this.once("Page.loadEventFired");

    await this.send("Page.reload");
    await loaded;
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }

  async waitFor(expression, { timeout = 5000, interval = 40, message = expression } = {}) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (await this.eval(expression)) {
        return;
      }
      await sleep(interval);
    }
    throw new Error(`timed out waiting for: ${message}`);
  }

  rect(selector) {
    return this.eval(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return null;
      const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
      return { x, y, width, height, top, right, bottom, left };
    })()`);
  }

  style(selector, property) {
    return this.eval(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).getPropertyValue(${JSON.stringify(property)})`);
  }

  // 실제 사용자처럼 요소 중앙을 마우스로 클릭한다. 다른 요소에 가려져 있으면 실패시킨다.
  async click(selector) {
    const point = await this.eval(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return { error: "element not found" };
      element.scrollIntoView({ block: "center", behavior: "instant" });
      const { x, y, width, height } = element.getBoundingClientRect();
      const px = x + width / 2;
      const py = y + height / 2;
      const hit = document.elementFromPoint(px, py);
      if (!hit || !(hit === element || element.contains(hit))) {
        return { error: "click point is covered by " + (hit ? hit.tagName + "." + hit.className : "nothing") };
      }
      return { x: px, y: py };
    })()`);

    if (point.error) {
      throw new Error(`click(${selector}): ${point.error}`);
    }

    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
  }

  async hover(selector) {
    await this.eval(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: "center", behavior: "instant" })`);
    const { x, y, width, height } = await this.rect(selector);

    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + width / 2, y: y + height / 2 });
  }

  async type(selector, text) {
    await this.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await this.send("Input.insertText", { text });
  }

  async scrollTo(top) {
    await this.eval(`window.scrollTo({ top: ${top}, behavior: "instant" })`);
    await sleep(60);
  }

  async clearSiteData() {
    const origin = await this.eval("location.origin");

    await this.send("Storage.clearDataForOrigin", { origin, storageTypes: "local_storage" });
  }

  // https://api.github.com 요청을 가로채 원하는 응답을 돌려준다. handler가 null이면 빈 배열을 200으로 준다.
  async mockGitHub(handler) {
    await this.send("Fetch.enable", { patterns: [{ urlPattern: "https://api.github.com/*" }] });
    this.on("Fetch.requestPaused", async ({ requestId, request }) => {
      this.apiCalls.push(request.url);
      const plan = (await handler(request.url, this.apiCalls.length)) ?? { json: [] };

      if (plan.delay) {
        await sleep(plan.delay);
      }

      try {
        if (plan.fail) {
          await this.send("Fetch.failRequest", { requestId, errorReason: plan.fail });
          return;
        }

        await this.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: plan.status ?? 200,
          responseHeaders: [
            { name: "Content-Type", value: "application/json; charset=utf-8" },
            { name: "Access-Control-Allow-Origin", value: "*" },
            ...(plan.headers ?? []),
          ],
          body: Buffer.from(JSON.stringify(plan.json ?? [])).toString("base64"),
        });
      } catch {
        // AbortController로 이미 취소된 요청이면 응답할 대상이 없다.
      }
    });
  }

  async screenshot(path, { fullPage = false } = {}) {
    const params = { format: "png" };

    if (fullPage) {
      const { width, height } = await this.eval(`({
        width: document.documentElement.clientWidth,
        height: Math.ceil(document.documentElement.scrollHeight),
      })`);

      Object.assign(params, { captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
    }

    const { data } = await this.send("Page.captureScreenshot", params);

    writeFileSync(path, Buffer.from(data, "base64"));
  }

  async close() {
    this.socket.close();
    await fetch(`http://127.0.0.1:${this.debugPort}/json/close/${this.targetId}`).catch(() => {});
  }
}

export const launchChrome = async (chromePath) => {
  const profileDir = mkdtempSync(join(tmpdir(), "portfolio-e2e-"));
  const child = spawn(chromePath, [
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    "--force-color-profile=srgb",
    "about:blank",
  ], { stdio: "ignore" });

  // 테스트가 오류로 끝나거나 Ctrl+C로 중단돼도 디버깅 포트가 열린 Chrome과 임시 프로필이 남지 않게 한다.
  const stopChrome = () => {
    try {
      child.kill("SIGKILL");
    } catch {
      // 이미 종료된 프로세스다.
    }
    rmSync(profileDir, { recursive: true, force: true });
  };

  process.once("exit", stopChrome);
  ["SIGINT", "SIGTERM"].forEach((signal) => process.once(signal, () => process.exit(1)));

  let debugPort = 0;

  for (let attempt = 0; attempt < 150 && !debugPort; attempt += 1) {
    try {
      debugPort = Number(readFileSync(join(profileDir, "DevToolsActivePort"), "utf8").split("\n")[0]);
    } catch {
      await sleep(100);
    }
  }

  if (!debugPort) {
    stopChrome();
    throw new Error("Chrome did not expose a DevTools port");
  }

  return {
    debugPort,
    version: () => fetch(`http://127.0.0.1:${debugPort}/json/version`).then((response) => response.json()),
    openPage: () => Page.open(debugPort),
    async close() {
      child.kill();
      await sleep(200);
      stopChrome();
    },
  };
};
