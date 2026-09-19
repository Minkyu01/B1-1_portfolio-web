// 실제 Chrome에서 project.md의 요구사항을 조항별로 확인하는 종단 테스트.
//   node tests/e2e_browser.mjs                 → GitHub API를 모의 응답으로 대체(네트워크 불필요)
//   node tests/e2e_browser.mjs --live          → 실제 GitHub API도 낮은 빈도로 확인
//   node tests/e2e_browser.mjs --live --screenshots → 제출용 스크린샷을 docs/screenshots/에 저장
//   node tests/e2e_browser.mjs --url=https://<계정>.github.io/<저장소>/ → 배포된 사이트를 같은 기준으로 검사
// Chrome이 없으면 건너뛴다. CHROME_PATH 환경 변수로 실행 파일을 지정할 수 있다.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as appState from "../js/portfolio_state.js";
import { findChrome, launchChrome, sleep, startStaticServer } from "./cdp_helper.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = process.argv.includes("--live");
const SCREENSHOTS = process.argv.includes("--screenshots");
const ONLY = process.argv.find((argument) => argument.startsWith("--only="))?.slice("--only=".length);
const REMOTE_URL = process.argv.find((argument) => argument.startsWith("--url="))?.slice("--url=".length);
const chromePath = findChrome();

if (typeof WebSocket === "undefined") {
  console.log("e2e browser tests: skipped (Node.js 22 or newer is required for the built-in WebSocket)");
  process.exit(0);
}

if (!chromePath) {
  console.log("e2e browser tests: skipped (Chrome not found; set CHROME_PATH)");
  process.exit(0);
}

const results = [];
const server = REMOTE_URL ? null : await startStaticServer(ROOT);
const entryUrl = REMOTE_URL ? new URL("index.html", REMOTE_URL.endsWith("/") ? REMOTE_URL : `${REMOTE_URL}/`).href : `${server.origin}/index.html`;
const siteOrigin = new URL(entryUrl).origin;
const chrome = await launchChrome(chromePath);

const check = async (id, title, run) => {
  try {
    await run();
    results.push({ id, title, ok: true });
    console.log(`  ✓ [${id}] ${title}`);
  } catch (error) {
    results.push({ id, title, ok: false });
    console.log(`  ✗ [${id}] ${title}\n      → ${String(error.message).split("\n").slice(0, 4).join(" ⏎ ")}`);
  }
};

const sampleRepos = (count = 6) => Array.from({ length: count }, (_, index) => ({
  name: `sample-repo-${index + 1}`,
  description: `샘플 저장소 ${index + 1}`,
  html_url: `https://github.com/example/sample-repo-${index + 1}`,
  stargazers_count: index,
  language: index % 2 ? "JavaScript" : "CSS",
  fork: false,
  archived: false,
}));

// 시나리오마다 새 탭과 비워진 localStorage로 시작한다.
const scenario = async (name, { width = 1440, height = 900, mobile = false, github = () => ({ json: sampleRepos() }), media } = {}, run) => {
  if (ONLY && !new RegExp(ONLY).test(name)) {
    return;
  }
  console.log(`\n■ ${name} (${width}px)`);
  const page = await chrome.openPage();

  await page.viewport(width, height, mobile);
  if (media) {
    await page.emulateMedia(media);
  }
  await page.send("Storage.clearDataForOrigin", { origin: siteOrigin, storageTypes: "local_storage" });
  if (github) {
    await page.mockGitHub(github);
  }
  await page.goto(entryUrl);
  try {
    await run(page);
  } catch (error) {
    // check() 밖(시나리오 준비 단계)에서 실패해도 나머지 시나리오는 계속 실행한다.
    results.push({ id: "setup", title: `${name}: ${String(error.message).split("\n")[0]}`, ok: false });
    console.log(`  ✗ [setup] ${name}\n      → ${String(error.message).split("\n")[0]}`);
  } finally {
    await page.close();
  }
};

const shown = (page, selector) => page.eval(`(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return false;
  const style = getComputedStyle(element);
  const { width, height } = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && width > 0 && height > 0 && Number(style.opacity) > 0.9;
})()`);

const focusable = (page, selector) => page.eval(`(() => {
  const style = getComputedStyle(document.querySelector(${JSON.stringify(selector)}));
  return style.display !== "none" && style.visibility !== "hidden";
})()`);

const text = (page, selector) => page.eval(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim() ?? null`);

const settleScroll = async (page) => {
  let stableReads = 0;
  let last = -1;

  for (let attempt = 0; attempt < 40 && stableReads < 3; attempt += 1) {
    await sleep(100);
    const current = await page.eval("window.scrollY");

    stableReads = current === last ? stableReads + 1 : 0;
    last = current;
  }
  return last;
};

const cardCount = (page) => page.eval("document.querySelectorAll('#projects-grid .project-card').length");
const noConsoleErrors = (page) => assert.deepEqual(page.consoleErrors, [], `console errors: ${page.consoleErrors.join(" | ")}`);
const source = (relativePath) => readFileSync(join(ROOT, relativePath), "utf8");

// ───────────────────────── 4.1 · 4.2 · 7 구조와 코드 스타일 ─────────────────────────
await scenario("구조 · 시맨틱 · 코드 스타일", {}, async (page) => {
  await check("4.1", "index.html · css/ · js/ · images/ 분리, 외부 CSS·JS 연결(defer)", async () => {
    const linked = await page.eval(`({
      css: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute("href")),
      scripts: [...document.querySelectorAll("script[src]")].map((script) => ({ src: script.getAttribute("src"), defer: script.hasAttribute("defer") })),
    })`);

    assert.ok(linked.css.includes("css/style.css"), "css/style.css not linked");
    assert.ok(linked.scripts.some(({ src, defer }) => src === "js/main.js" && defer), "js/main.js needs defer");
    assert.ok(await page.eval("[...document.images].every((image) => image.naturalWidth > 0)"), "an image failed to load");
  });

  await check("4.2", "시맨틱 태그 header · nav · main · section · article · footer", async () => {
    const counts = await page.eval(`Object.fromEntries(["header", "nav", "main", "section", "article", "footer"].map((tag) => [tag, document.querySelectorAll(tag).length]))`);

    Object.entries(counts).forEach(([tag, count]) => assert.ok(count >= 1, `<${tag}> is missing`));
  });

  await check("4.2", "Hero · About · Skills · Projects · Contact 섹션과 Footer", async () => {
    for (const id of ["hero", "about", "skills", "projects", "contact"]) {
      assert.equal(await page.eval(`document.querySelector("section#${id}") !== null`), true, `section#${id} missing`);
    }
    assert.equal(await page.eval(`document.querySelector("footer") !== null`), true);
  });

  await check("4.2", "Hero에 인사말과 CTA 버튼이 있다", async () => {
    assert.match(await text(page, "#hero"), /안녕하세요/, "no greeting in Hero");
    assert.ok(await page.eval(`document.querySelectorAll("#hero .hero-actions a").length >= 1`), "no CTA in Hero");
  });

  await check("4.2", "About에 자기소개 글과 프로필 이미지, Skills에 기술 목록", async () => {
    assert.ok((await text(page, "#about article")).length > 40, "About intro is too short");
    assert.ok(await page.eval(`document.querySelector("#about img") !== null`), "no profile image");
    assert.ok(await page.eval(`document.querySelectorAll("#skills li").length >= 3`), "fewer than 3 skills");
  });

  await check("4.2", "Footer에 저작권과 실제 소셜 링크(루트 도메인 아님)", async () => {
    assert.match(await text(page, "footer"), /©/);
    const links = await page.eval(`[...document.querySelectorAll("footer a[href]")].map((a) => a.href)`);

    assert.ok(links.length >= 1, "no social links");
    links.forEach((href) => {
      const { pathname, protocol } = new URL(href);

      assert.equal(protocol, "https:");
      assert.ok(pathname.length > 1, `link points at a bare domain: ${href}`);
    });
  });

  await check("4.2", "내비게이션 앵커가 각 섹션으로 연결된다", async () => {
    for (const id of ["about", "skills", "projects", "contact"]) {
      assert.equal(await page.eval(`document.querySelector('nav a[href="#${id}"]') !== null && document.getElementById("${id}") !== null`), true, `#${id}`);
    }
  });

  await check("4.2", "모든 이미지에 의미 있는 alt", async () => {
    const alts = await page.eval(`[...document.images].map((image) => image.getAttribute("alt"))`);

    assert.ok(alts.length >= 1);
    alts.forEach((alt) => assert.ok(alt && alt.trim().length >= 5, `weak alt: ${alt}`));
  });

  await check("4.2", "모든 입력 요소에 label[for]가 연결됨", async () => {
    const unlabeled = await page.eval(`[...document.querySelectorAll("input, textarea, select")].filter((control) => !document.querySelector('label[for="' + control.id + '"]')).map((control) => control.id || control.name)`);

    assert.deepEqual(unlabeled, []);
  });

  await check("7", "인라인 style·onclick 등 인라인 이벤트 속성이 없다(로드 후에도)", async () => {
    assert.equal(await page.eval(`document.querySelectorAll("[style]").length`), 0, "style attribute found");
    const inline = await page.eval(`[...document.querySelectorAll("*")].flatMap((element) => [...element.attributes].filter((attribute) => attribute.name.startsWith("on")).map((attribute) => element.tagName + "@" + attribute.name))`);

    assert.deepEqual(inline, []);
  });

  await check("4.4·7", "var 미사용, 외부 라이브러리 미사용", async () => {
    const code = source("js/main.js") + source("js/portfolio_state.js");

    assert.doesNotMatch(code, /\bvar\b/);
    assert.equal(await page.eval(`document.querySelectorAll('script[src^="http"], link[href^="http"]').length`), 0, "external asset loaded");
  });

  await check("7", "로드 중 콘솔 에러 없음", async () => noConsoleErrors(page));
});

// ───────────────────────── 4.3 CSS 변수 · Flex · Grid · 시각 효과 ─────────────────────────
await scenario("CSS · 레이아웃 · 시각 효과", {}, async (page) => {
  await check("4.3", ":root에 색상·폰트·간격 CSS 변수", async () => {
    for (const variable of ["--color-bg", "--color-text", "--color-primary", "--font-body", "--space-4"]) {
      assert.notEqual(await page.eval(`getComputedStyle(document.documentElement).getPropertyValue("${variable}").trim()`), "", variable);
    }
  });

  await check("4.3", '[data-theme="dark"]가 같은 변수의 값을 따로 정의', async () => {
    const light = await page.eval(`getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim()`);

    await page.eval(`document.documentElement.dataset.theme = "dark"`);
    const dark = await page.eval(`getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim()`);

    await page.eval(`document.documentElement.dataset.theme = "light"`);
    assert.notEqual(light, dark);
  });

  await check("4.3", "네비게이션은 Flexbox, 로고는 왼쪽 · 메뉴는 오른쪽", async () => {
    assert.equal(await page.style(".header-inner", "display"), "flex");
    const [brand, navigation] = await Promise.all([page.rect(".brand"), page.rect("#primary-navigation")]);

    assert.ok(brand.right < navigation.left, "logo should sit left of the menu");
    assert.ok(navigation.left > 1440 / 2, "menu should sit on the right half");
  });

  await check("4.3·4.8", "Projects 카드는 Grid(auto-fit/minmax)로 3열 이상 배치", async () => {
    await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length >= 6", { message: "cards rendered" });
    assert.equal(await page.style("#projects-grid", "display"), "grid");
    const columns = (await page.style("#projects-grid", "grid-template-columns")).split(" ").length;

    assert.ok(columns >= 3, `columns=${columns}`);
    assert.match(source("css/style.css"), /repeat\(auto-fit,\s*minmax\(/);
  });

  await check("4.3", "버튼·카드에 transition, 카드에 box-shadow", async () => {
    assert.notEqual(await page.style(".button", "transition-duration"), "0s");
    assert.notEqual(await page.style(".project-card", "transition-duration"), "0s");
    assert.notEqual(await page.style(".project-card", "box-shadow"), "none");
  });

  await check("4.3", "버튼·카드 hover 효과", async () => {
    await page.hover(".button-primary");
    await sleep(320);
    assert.notEqual(await page.style(".button-primary", "transform"), "none", "button hover");
    await page.hover(".project-card");
    await sleep(320);
    assert.notEqual(await page.style(".project-card", "transform"), "none", "card hover");
  });

  await check("4.3", "모바일 퍼스트: min-width 미디어 쿼리 768px · 1024px", async () => {
    const css = source("css/style.css");

    assert.match(css, /@media \(min-width: 768px\)/);
    assert.match(css, /@media \(min-width: 1024px\)/);
    assert.doesNotMatch(css, /@media \(max-width/, "max-width queries mean desktop-first");
  });
});

// ───────────────────────── 2 · 4.3 반응형 (폭별) ─────────────────────────
for (const width of [320, 375, 768, 1024, 1440]) {
  await scenario("반응형 레이아웃", { width, mobile: width < 768 }, async (page) => {
    await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length >= 6", { message: "cards rendered" });

    await check("2", `가로 넘침이 없다`, async () => {
      const { scrollWidth, innerWidth } = await page.eval("({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })");

      assert.ok(scrollWidth <= innerWidth, `scrollWidth ${scrollWidth} > ${innerWidth}`);
    });

    if (width < 768) {
      await check("4.3", "모바일: 네비게이션은 숨고 햄버거 버튼이 보인다", async () => {
        assert.equal(await shown(page, "#menu-toggle"), true);
        assert.equal(await shown(page, "#primary-navigation"), false);
      });
    } else {
      await check("4.3", "태블릿·데스크톱: 메뉴가 펼쳐지고 햄버거는 숨는다", async () => {
        assert.equal(await shown(page, "#menu-toggle"), false);
        assert.equal(await shown(page, "#primary-navigation"), true);
      });
    }

    await check("4.3", "카드 그리드 열 수가 폭에 맞게 바뀐다", async () => {
      const columns = (await page.style("#projects-grid", "grid-template-columns")).split(" ").length;
      const expected = { 320: [1, 1], 375: [1, 1], 768: [2, 3], 1024: [3, 5], 1440: [4, 5] }[width];

      assert.ok(columns >= expected[0] && columns <= expected[1], `columns=${columns}, expected ${expected.join("~")}`);
    });
  });
}

// ───────────────────────── 4.5 인터랙션 ─────────────────────────
await scenario("인터랙션 · 모바일 햄버거", { width: 375, mobile: true }, async (page) => {
  await check("4.5-1", "햄버거 클릭 → 메뉴 표시(classList.toggle 'active'), 다시 클릭 → 숨김", async () => {
    assert.equal(await shown(page, "#primary-navigation"), false);
    await page.click("#menu-toggle");
    await page.waitFor(`document.querySelector("#primary-navigation").classList.contains("active")`);
    assert.equal(await shown(page, "#primary-navigation"), true);
    assert.equal(await page.eval(`document.querySelector("#menu-toggle").getAttribute("aria-expanded")`), "true");
    await page.click("#menu-toggle");
    await page.waitFor(`!document.querySelector("#primary-navigation").classList.contains("active")`);
    assert.equal(await shown(page, "#primary-navigation"), false);
    assert.equal(await page.eval(`document.querySelector("#menu-toggle").getAttribute("aria-expanded")`), "false");
  });

  await check("4.5-2", "모바일 메뉴 링크 클릭 → 해당 섹션으로 이동하고 메뉴가 닫힌다", async () => {
    await page.click("#menu-toggle");
    await page.click('#primary-navigation a[href="#contact"]');
    await settleScroll(page);
    const top = (await page.rect("#contact")).top;

    assert.ok(top >= -2 && top < 200, `#contact top=${top}`);
    assert.equal(await shown(page, "#primary-navigation"), false, "menu should close after navigating");
  });
});

await scenario("인터랙션 · 스크롤 · 다크 모드 · 애니메이션", { width: 1024 }, async (page) => {
  await check("4.5-6", "스크롤 애니메이션: 화면 밖 섹션은 숨겨졌다가 보이면 나타난다(threshold ≥ 0.2)", async () => {
    assert.ok(appState.THRESHOLDS.reveal >= 0.2, `threshold ${appState.THRESHOLDS.reveal}`);
    await page.scrollTo(0);
    const hidden = await page.eval(`(() => {
      const target = document.querySelector("#contact");
      return { visible: target.classList.contains("is-visible"), opacity: getComputedStyle(target).opacity };
    })()`);

    assert.equal(hidden.visible, false, "#contact should start hidden");
    await page.waitFor(`getComputedStyle(document.querySelector("#contact")).opacity === "0"`, { timeout: 1500, message: "#contact fades to opacity 0 before it is scrolled into view" });
    await page.eval(`document.querySelector("#contact").scrollIntoView({ behavior: "instant", block: "center" })`);
    await page.waitFor(`document.querySelector("#contact").classList.contains("is-visible")`, { message: "#contact revealed" });
    await sleep(600);
    assert.equal(await page.style("#contact", "opacity"), "1");
  });

  await check("4.5-2", "메뉴 클릭 시 부드럽게(중간 위치를 거쳐) 해당 섹션으로 이동", async () => {
    await page.scrollTo(0);
    const before = await page.eval("window.scrollY");

    await page.click('#primary-navigation a[href="#projects"]');
    const samples = [];

    for (let index = 0; index < 10; index += 1) {
      await sleep(50);
      samples.push(await page.eval("window.scrollY"));
    }
    const finalY = await settleScroll(page);

    assert.ok(finalY > before, "did not scroll");
    assert.ok(samples.some((y) => y > before && y < finalY), `jumped instantly: ${samples.join(",")}`);
    const top = (await page.rect("#projects")).top;

    assert.ok(top >= -2 && top < 200, `#projects top=${top}`);
  });

  await check("4.5-3", "스크롤 탑 버튼: 기준값 미만에서는 안 보이고 Tab 순서에서도 빠진다", async () => {
    await page.scrollTo(0);
    await page.waitFor(`getComputedStyle(document.querySelector("#scroll-top")).visibility === "hidden"`, { timeout: 1500, message: "button hides after fade-out" });
    assert.equal(await shown(page, "#scroll-top"), false, "visible at top");
    assert.equal(await focusable(page, "#scroll-top"), false, "invisible button is still keyboard-focusable");
  });

  await check("4.5-3", "스크롤 탑 버튼: 기준값 이상에서 나타나고 클릭하면 맨 위로 이동", async () => {
    await page.scrollTo(appState.THRESHOLDS.scrollTop + 80);
    await page.waitFor(`Number(getComputedStyle(document.querySelector("#scroll-top")).opacity) > 0.95`, { message: "button fades in" });
    assert.equal(await shown(page, "#scroll-top"), true);
    await page.click("#scroll-top");
    await page.waitFor("window.scrollY === 0", { timeout: 4000, message: "scrolled back to top" });
  });

  await check("4.5-4", "네비게이션 스타일 변경: 기준값 이상 스크롤하면 배경이 바뀐다", async () => {
    await page.scrollTo(0);
    await sleep(300);
    const before = await page.style("#site-header", "background-color");

    assert.equal(await page.eval(`document.querySelector("#site-header").classList.contains("is-scrolled")`), false);
    await page.scrollTo(appState.THRESHOLDS.navigation + 40);
    await page.waitFor(`document.querySelector("#site-header").classList.contains("is-scrolled")`);
    await sleep(300);
    assert.notEqual(await page.style("#site-header", "background-color"), before);
  });

  await check("4.5-5", "다크 모드: 클릭하면 전환되고 localStorage에 저장, 새로고침 후에도 유지", async () => {
    await page.scrollTo(0);
    assert.equal(await page.eval("document.documentElement.dataset.theme"), "light");
    const lightBackground = await page.style("body", "background-color");

    await page.click("#theme-toggle");
    await page.waitFor(`document.documentElement.dataset.theme === "dark"`);
    await sleep(300);
    assert.notEqual(await page.style("body", "background-color"), lightBackground, "page colors did not change");
    assert.equal(await page.eval(`localStorage.getItem(${JSON.stringify(appState.THEME_STORAGE_KEY)})`), "dark");

    await page.reload();
    assert.equal(await page.eval("document.documentElement.dataset.theme"), "dark", "theme lost after reload");

    await page.click("#theme-toggle");
    await page.waitFor(`document.documentElement.dataset.theme === "light"`);
    await page.reload();
    assert.equal(await page.eval("document.documentElement.dataset.theme"), "light", "light theme lost after reload");
  });

  await check("7", "인터랙션 후에도 콘솔 에러·인라인 style 없음", async () => {
    noConsoleErrors(page);
    assert.equal(await page.eval(`document.querySelectorAll("[style]").length`), 0);
  });
});

// ───────────────────────── 4.6 폼 UX ─────────────────────────
await scenario("Contact 폼 UX", { width: 1024 }, async (page) => {
  await page.eval(`window.__marker = "same-document"`);

  await check("4.6", "빈 채로 제출 → 필드마다 에러가 입력칸 근처에 표시, 페이지는 이동하지 않는다", async () => {
    await page.click('#contact-form button[type="submit"]');
    for (const field of ["name", "email", "message"]) {
      assert.ok((await text(page, `#contact-${field}-error`)).length > 0, `${field}: no error message`);
      assert.equal(await page.eval(`document.querySelector("#contact-${field}").getAttribute("aria-invalid")`), "true");
      const [input, error] = await Promise.all([page.rect(`#contact-${field}`), page.rect(`#contact-${field}-error`)]);

      assert.ok(error.top - input.bottom >= 0 && error.top - input.bottom < 60, `${field}: error is ${error.top - input.bottom}px from the field`);
    }
    assert.equal(await text(page, "#contact-success"), "");
    assert.equal(await page.eval("window.__marker"), "same-document", "the page navigated/reloaded");
    assert.equal(await page.eval("location.search"), "");
  });

  await check("4.6", "입력하면(input 이벤트) 해당 필드의 에러가 즉시 사라진다", async () => {
    await page.type("#contact-name", "홍길동");
    await page.waitFor(`document.querySelector("#contact-name-error").textContent.trim() === ""`);
    assert.ok((await text(page, "#contact-email-error")).length > 0, "other errors should stay");
  });

  await check("4.6", "이메일 형식 검증", async () => {
    await page.type("#contact-email", "not-an-email");
    await page.type("#contact-message", "안녕하세요");
    await page.click('#contact-form button[type="submit"]');
    assert.match(await text(page, "#contact-email-error"), /이메일 형식/);
    assert.equal(await text(page, "#contact-success"), "");
  });

  await check("4.6", "올바른 입력 → 성공 메시지, 에러 없음, 폼 초기화", async () => {
    await page.eval(`(() => { const email = document.querySelector("#contact-email"); email.value = ""; })()`);
    await page.type("#contact-email", "user@example.com");
    await page.click('#contact-form button[type="submit"]');
    await page.waitFor(`document.querySelector("#contact-success").textContent.trim().length > 0`);
    for (const field of ["name", "email", "message"]) {
      assert.equal(await text(page, `#contact-${field}-error`), "");
    }
    assert.equal(await page.eval(`document.querySelector("#contact-name").value`), "");
    assert.equal(await page.eval("window.__marker"), "same-document");
  });
});

// ───────────────────────── 4.8 GitHub API 상태 ─────────────────────────
await scenario("API · 자동 로드와 성공 상태", {}, async (page) => {
  await check("4.8", "페이지를 열면 본인 계정의 저장소를 자동으로 요청한다(/users/{id}/repos)", async () => {
    assert.ok(appState.DEFAULT_GITHUB_USERNAME, "DEFAULT_GITHUB_USERNAME is not defined");
    await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length >= 6", { message: "cards rendered without any user action" });
    assert.match(page.apiCalls[0], new RegExp(`^https://api\\.github\\.com/users/${appState.DEFAULT_GITHUB_USERNAME}/repos\\b`));
  });

  await check("4.8", "성공: 카드에 이름 · 설명 · 언어 · 별 · 링크가 렌더링된다", async () => {
    const card = await page.eval(`(() => {
      const element = document.querySelector("#projects-grid .project-card");
      return { title: element.querySelector("h3")?.textContent, body: element.textContent, href: element.querySelector("a")?.href };
    })()`);

    assert.equal(card.title, "sample-repo-1");
    assert.match(card.body, /샘플 저장소 1/);
    assert.match(card.body, /★/);
    assert.match(card.href, /^https:\/\/github\.com\//);
    assert.equal(await page.eval(`document.querySelectorAll("#projects-grid article.project-card").length`), 6, "cards should be <article>");
  });
});

await scenario("API · 로딩 상태", { github: () => ({ json: sampleRepos(3), delay: 1200 }) }, async (page) => {
  await check("4.8", "로딩: 요청 중에는 '로딩 중...' 문구와 돌아가는 스피너가 보인다", async () => {
    assert.match(await text(page, "#projects-status"), /로딩 중\.\.\./);
    const spinner = await page.eval(`getComputedStyle(document.querySelector("#projects-status"), "::before").animationName`);

    assert.notEqual(spinner, "none", "spinner is not animated");
    assert.equal(await cardCount(page), 0);
  });

  await check("4.8", "로딩이 끝나면 스피너가 사라지고 카드가 나타난다", async () => {
    await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length === 3", { message: "cards after delay" });
    assert.equal(await page.eval(`document.querySelector("#projects-status").classList.contains("is-loading")`), false);
    assert.doesNotMatch(await text(page, "#projects-status"), /로딩 중/);
  });
});

await scenario("API · 빈 상태", { github: () => ({ json: [] }) }, async (page) => {
  await check("4.8", "빈 상태: '표시할 프로젝트가 없습니다'", async () => {
    await page.waitFor(`document.querySelector("#projects-status").textContent.includes("표시할 프로젝트가 없습니다")`, { message: "empty message" });
    assert.equal(await cardCount(page), 0);
    assert.equal(await page.eval(`document.querySelector("#retry-projects") === null`), true, "empty is not an error");
  });
});

{
  let mode = "server-error";

  await scenario("API · 에러 상태와 재시도", { github: () => (mode === "server-error" ? { status: 500, json: { message: "boom" } } : { json: sampleRepos(4) }) }, async (page) => {
    await check("4.8", "에러: '프로젝트를 불러올 수 없습니다' + 재시도 버튼", async () => {
      await page.waitFor(`document.querySelector("#projects-status").textContent.includes("프로젝트를 불러올 수 없습니다")`, { message: "error message" });
      assert.match(await text(page, "#retry-projects"), /다시 시도/);
      assert.equal(await cardCount(page), 0);
    });

    await check("4.8", "재시도 버튼을 누르면 다시 요청하고 성공하면 카드가 나타난다", async () => {
      const callsBefore = page.apiCalls.length;

      mode = "ok";
      await page.click("#retry-projects");
      await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length === 4", { message: "cards after retry" });
      assert.equal(page.apiCalls.length, callsBefore + 1);
      assert.equal(await page.eval(`document.querySelector("#retry-projects") === null`), true, "retry button should disappear");
    });
  });
}

await scenario("API · 레이트 리밋(403)", {
  github: () => ({ status: 403, headers: [{ name: "X-RateLimit-Remaining", value: "0" }], json: { message: "API rate limit exceeded" } }),
}, async (page) => {
  await check("4.8·7", "403 → 에러 상태 UI(원문 메시지 + 재시도 버튼)가 표시된다", async () => {
    await page.waitFor(`document.querySelector("#projects-status").textContent.includes("프로젝트를 불러올 수 없습니다")`, { message: "error UI for 403" });
    assert.match(await text(page, "#projects-status"), /요청 한도/);
    assert.ok(await page.eval(`document.querySelector("#retry-projects") !== null`), "no retry button");
  });
});

await scenario("API · 네트워크 실패 / 없는 사용자", { github: (url) => (url.includes("/users/ghost-user-404/") ? { status: 404, json: { message: "Not Found" } } : { fail: "InternetDisconnected" }) }, async (page) => {
  await check("4.8", "네트워크 실패(try/catch) → 에러 상태 UI", async () => {
    await page.waitFor(`document.querySelector("#projects-status").textContent.includes("프로젝트를 불러올 수 없습니다")`, { message: "error UI for network failure" });
    assert.ok(await page.eval(`document.querySelector("#retry-projects") !== null`));
  });

  await check("4.8", "존재하지 않는 사용자(404) → 에러 상태 UI", async () => {
    await page.eval(`document.querySelector("#github-username").value = ""`);
    await page.type("#github-username", "ghost-user-404");
    await page.click('#github-form button[type="submit"]');
    await page.waitFor(`document.querySelector("#projects-status").textContent.includes("사용자")`, { message: "404 message" });
    assert.match(await text(page, "#projects-status"), /프로젝트를 불러올 수 없습니다/);
  });
});

await scenario("API · 사용자명 폼(상태 → 렌더링)", {}, async (page) => {
  await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length >= 6", { message: "initial cards" });

  await check("4.9", "잘못된 사용자명 → 요청 없이 입력칸 근처에 오류", async () => {
    const callsBefore = page.apiCalls.length;

    await page.eval(`document.querySelector("#github-username").value = ""`);
    await page.type("#github-username", "bad name!");
    await page.click('#github-form button[type="submit"]');
    await page.waitFor(`document.querySelector("#github-username-error").textContent.trim().length > 0`);
    assert.equal(page.apiCalls.length, callsBefore);
    assert.equal(await cardCount(page), 0, "stale cards should be cleared");
  });

  await check("4.9", "올바른 사용자명 → 해당 계정의 저장소로 목록이 바뀐다", async () => {
    await page.eval(`document.querySelector("#github-username").value = ""`);
    await page.type("#github-username", "octocat");
    await page.click('#github-form button[type="submit"]');
    await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length >= 6", { message: "cards for octocat" });
    assert.match(page.apiCalls.at(-1), /\/users\/octocat\/repos/);
  });
});

// ───────────────────────── 실제 GitHub API (선택) ─────────────────────────
if (LIVE) {
  await scenario("실제 GitHub API (--live)", { github: null }, async (page) => {
    await check("4.8", "기본 계정을 실제 API로 불러와 성공 또는 빈 상태로 끝난다(에러가 아님)", async () => {
      await page.waitFor(`!document.querySelector("#projects-status").textContent.includes("로딩 중") && document.querySelector("#projects-status").textContent.trim().length > 0`, { timeout: 15000, message: "live request to finish" });
      const status = await text(page, "#projects-status");

      assert.doesNotMatch(status, /불러올 수 없습니다/, status);
    });

    await check("4.8", "octocat 조회 → 실제 저장소 카드가 렌더링된다", async () => {
      await page.eval(`document.querySelector("#github-username").value = ""`);
      await page.type("#github-username", "octocat");
      await page.click('#github-form button[type="submit"]');
      await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length >= 1", { timeout: 15000, message: "live cards" });
      assert.match(await text(page, "#projects-grid .project-card h3"), /\S/);
    });
  });
}

// ───────────────────────── 제출용 스크린샷 (선택) ─────────────────────────
if (SCREENSHOTS) {
  const outputDirectory = join(ROOT, "docs", "screenshots");

  mkdirSync(outputDirectory, { recursive: true });
  const reduceMotion = [{ name: "prefers-reduced-motion", value: "reduce" }];
  const loadLiveCards = async (page) => {
    await page.eval(`document.querySelector("#github-username").value = ""`);
    await page.type("#github-username", "octocat");
    await page.click('#github-form button[type="submit"]');
    await page.waitFor("document.querySelectorAll('#projects-grid .project-card').length >= 6", { timeout: 15000, message: "live cards" });
    await page.scrollTo(0);
    await sleep(300);
  };

  console.log("\n■ 스크린샷 → docs/screenshots/");
  await scenario("스크린샷 · 데스크톱", { width: 1440, github: null, media: reduceMotion }, async (page) => {
    await loadLiveCards(page);
    await page.screenshot(join(outputDirectory, "desktop.png"), { fullPage: true });
    await page.click("#theme-toggle");
    await page.waitFor(`document.documentElement.dataset.theme === "dark"`);
    await sleep(400);
    await page.screenshot(join(outputDirectory, "dark-mode.png"), { fullPage: true });
  });
  await scenario("스크린샷 · 모바일", { width: 375, height: 812, mobile: true, github: null, media: reduceMotion }, async (page) => {
    await loadLiveCards(page);
    await page.screenshot(join(outputDirectory, "mobile.png"), { fullPage: true });
    await page.click("#menu-toggle");
    await sleep(300);
    await page.screenshot(join(outputDirectory, "mobile-menu.png"));
  });
}

await chrome.close();
await server?.close();

const failed = results.filter(({ ok }) => !ok);

console.log(`\ne2e browser tests: ${results.length - failed.length}/${results.length} passed${LIVE ? " (live API included)" : ""}`);
if (failed.length) {
  console.log(`failed: ${failed.map(({ id, title }) => `[${id}] ${title}`).join("\n        ")}`);
  process.exit(1);
}
