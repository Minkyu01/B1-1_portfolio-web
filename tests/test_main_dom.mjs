import assert from "node:assert/strict";

import { DEFAULT_GITHUB_USERNAME, THEME_STORAGE_KEY, THRESHOLDS } from "../js/portfolio_state.js";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...tokens) {
    tokens.forEach((token) => this.values.add(token));
  }

  remove(...tokens) {
    tokens.forEach((token) => this.values.delete(token));
  }

  toggle(token, force) {
    const shouldAdd = force ?? !this.values.has(token);

    if (shouldAdd) {
      this.values.add(token);
    } else {
      this.values.delete(token);
    }

    return shouldAdd;
  }

  contains(token) {
    return this.values.has(token);
  }
}

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.children = [];
    this.classList = new FakeClassList();
    this.dataset = {};
    this.events = new Map();
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
  }

  addEventListener(type, listener) {
    const listeners = this.events.get(type) ?? [];

    listeners.push(listener);
    this.events.set(type, listeners);
  }

  append(child) {
    this.children.push(child);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  trigger(type) {
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };

    (this.events.get(type) ?? []).forEach((listener) => listener(event));
    return event;
  }
}

const createHarness = () => {
  const elements = {
    documentElement: new FakeElement(),
    header: new FakeElement(),
    themeToggle: new FakeElement(),
    themeToggleLabel: new FakeElement(),
    menuToggle: new FakeElement(),
    menuToggleLabel: new FakeElement(),
    navigation: new FakeElement(),
    scrollTop: new FakeElement(),
    githubForm: new FakeElement(),
    githubUsername: new FakeElement(),
    githubUsernameError: new FakeElement(),
    projectsStatus: new FakeElement(),
    projectsGrid: new FakeElement(),
    contactForm: new FakeElement(),
    contactSuccess: new FakeElement(),
    contactName: new FakeElement(),
    contactEmail: new FakeElement(),
    contactMessage: new FakeElement(),
    contactNameError: new FakeElement(),
    contactEmailError: new FakeElement(),
    contactMessageError: new FakeElement(),
  };
  const selectors = new Map([
    ["#site-header", elements.header],
    ["#theme-toggle", elements.themeToggle],
    [".theme-toggle-label", elements.themeToggleLabel],
    ["#menu-toggle", elements.menuToggle],
    ["#menu-toggle .sr-only", elements.menuToggleLabel],
    ["#primary-navigation", elements.navigation],
    ["#scroll-top", elements.scrollTop],
    ["#github-form", elements.githubForm],
    ["#github-username", elements.githubUsername],
    ["#github-username-error", elements.githubUsernameError],
    ["#projects-status", elements.projectsStatus],
    ["#projects-grid", elements.projectsGrid],
    ["#contact-form", elements.contactForm],
    ["#contact-success", elements.contactSuccess],
    ["#contact-name", elements.contactName],
    ["#contact-email", elements.contactEmail],
    ["#contact-message", elements.contactMessage],
    ["#contact-name-error", elements.contactNameError],
    ["#contact-email-error", elements.contactEmailError],
    ["#contact-message-error", elements.contactMessageError],
  ]);
  const document = {
    documentElement: elements.documentElement,
    createElement: () => new FakeElement(),
    querySelector: (selector) => selectors.get(selector) ?? null,
    querySelectorAll: () => [],
  };

  elements.contactForm.reset = () => {
    elements.contactName.value = "";
    elements.contactEmail.value = "";
    elements.contactMessage.value = "";
  };

  return { document, elements };
};

const flush = async () => {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
};

let caseNumber = 0;

// main.js를 가짜 DOM 위에서 새로 실행한다. 페이지를 여는 순간의 동작(자동 로드)까지 포함된다.
const launchApp = async (fetchImplementation, { storedTheme } = {}) => {
  const harness = createHarness();
  const storage = new Map(storedTheme ? [[THEME_STORAGE_KEY, storedTheme]] : []);
  const windowListeners = new Map();
  const fetchCalls = [];

  globalThis.document = harness.document;
  globalThis.window = {
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    matchMedia: () => ({ matches: false }),
    scrollTo: () => {},
    scrollY: 0,
  };
  globalThis.fetch = (url, options) => {
    fetchCalls.push(url);
    return fetchImplementation(url, options);
  };

  caseNumber += 1;
  await import(new URL(`../js/main.js?dom-case=${caseNumber}`, import.meta.url));
  await flush();

  return {
    ...harness.elements,
    storage,
    fetchCalls,
    scrollTo: (top) => {
      globalThis.window.scrollY = top;
      windowListeners.get("scroll")();
    },
  };
};

const submitGitHubUsername = async (app, username) => {
  app.githubUsername.value = username;
  const event = app.githubForm.trigger("submit");

  assert.equal(event.defaultPrevented, true);
  await flush();
};

const successfulResponse = (payload) => ({
  ok: true,
  json: async () => payload,
});

const safeRepository = {
  name: "safe-project",
  description: "safe description",
  html_url: "https://github.com/example/safe-project",
  stargazers_count: 4,
  language: "JavaScript",
  fork: false,
  archived: false,
};

// 1) 페이지를 열면 사용자 조작 없이 기본 계정의 저장소를 요청한다.
const emptyApp = await launchApp(async () => successfulResponse([]));
assert.deepEqual(emptyApp.fetchCalls, [`https://api.github.com/users/${DEFAULT_GITHUB_USERNAME}/repos?sort=updated&per_page=12`]);
assert.equal(emptyApp.githubUsername.value, DEFAULT_GITHUB_USERNAME);
assert.equal(emptyApp.projectsStatus.textContent, "표시할 프로젝트가 없습니다.");
assert.equal(emptyApp.projectsGrid.getAttribute("aria-busy"), "false");
assert.equal(emptyApp.projectsStatus.children.length, 0, "빈 상태는 오류가 아니므로 재시도 버튼이 없다");

// 2) 로딩 → 성공. 요청 중에는 "로딩 중..."과 스피너 클래스가 있고, 끝나면 사라진다.
let resolveAutoLoad;
const loadingApp = await launchApp(() => new Promise((resolve) => {
  resolveAutoLoad = resolve;
}));
assert.equal(loadingApp.projectsStatus.textContent, "로딩 중...");
assert.equal(loadingApp.projectsStatus.classList.contains("is-loading"), true);
assert.equal(loadingApp.projectsGrid.getAttribute("aria-busy"), "true");
resolveAutoLoad(successfulResponse([safeRepository]));
await flush();
assert.equal(loadingApp.projectsStatus.classList.contains("is-loading"), false);
assert.equal(loadingApp.projectsStatus.textContent, "1개의 공개 저장소를 표시합니다.");
assert.match(loadingApp.projectsGrid.innerHTML, /safe-project/);
assert.equal(loadingApp.projectsGrid.getAttribute("aria-busy"), "false");

// 3) 에러(403 레이트 리밋) → 원문 문구 + 재시도 버튼 → 재시도하면 다시 요청한다.
const errorApp = await launchApp(async () => ({ ok: false, status: 403 }));
assert.match(errorApp.projectsStatus.textContent, /^프로젝트를 불러올 수 없습니다\./);
assert.match(errorApp.projectsStatus.textContent, /요청 한도/);
assert.equal(errorApp.projectsStatus.classList.contains("is-error"), true);
assert.equal(errorApp.projectsStatus.children.length, 1);
assert.equal(errorApp.projectsStatus.children[0].textContent, "다시 시도");
errorApp.projectsStatus.children[0].trigger("click");
await flush();
assert.equal(errorApp.fetchCalls.length, 2);

// 4) 배열이 아닌 응답은 빈 상태가 아니라 에러 상태로 다룬다.
const malformedApp = await launchApp(async () => successfulResponse({ message: "unexpected shape" }));
assert.match(malformedApp.projectsStatus.textContent, /^프로젝트를 불러올 수 없습니다\..*응답 형식/);
assert.equal(malformedApp.projectsStatus.children.length, 1);

// 5) 네트워크 실패(fetch가 reject)도 try/catch로 에러 상태가 된다.
const offlineApp = await launchApp(async () => {
  throw new TypeError("Failed to fetch");
});
assert.match(offlineApp.projectsStatus.textContent, /^프로젝트를 불러올 수 없습니다\..*네트워크/);
assert.equal(offlineApp.projectsStatus.children.length, 1);

// 6) 사용자명 폼: 올바른 값이면 그 계정으로 다시 요청하고, 잘못된 값이면 요청하지 않는다.
const formApp = await launchApp(async () => successfulResponse([safeRepository]));
await submitGitHubUsername(formApp, "octocat");
assert.match(formApp.fetchCalls.at(-1), /\/users\/octocat\/repos/);
assert.equal(formApp.fetchCalls.length, 2);
await submitGitHubUsername(formApp, "");
assert.match(formApp.githubUsernameError.textContent, /입력해 주세요/);
assert.equal(formApp.fetchCalls.length, 2);
assert.equal(formApp.projectsGrid.innerHTML, "");
formApp.githubUsername.trigger("input");
assert.equal(formApp.githubUsernameError.textContent, "", "입력을 시작하면 이전 오류가 사라진다");

// 7) 오래된 요청 경합: 진행 중인 자동 로드를 잘못된 입력이 취소하고, 늦게 온 응답은 화면을 덮지 못한다.
let resolvePendingRequest;
let requestWasAborted = false;
const raceApp = await launchApp((_, { signal }) => new Promise((resolve, reject) => {
  resolvePendingRequest = resolve;
  signal.addEventListener("abort", () => {
    requestWasAborted = true;
    const error = new Error("aborted");

    error.name = "AbortError";
    reject(error);
  });
}));
assert.equal(raceApp.projectsStatus.textContent, "로딩 중...");
await submitGitHubUsername(raceApp, "bad name");
resolvePendingRequest(successfulResponse([{ ...safeRepository, name: "old-result" }]));
await flush();
assert.equal(requestWasAborted, true);
assert.match(raceApp.githubUsernameError.textContent, /사용자명/);
assert.equal(raceApp.projectsGrid.innerHTML, "");
assert.equal(raceApp.projectsStatus.textContent, "GitHub 사용자명을 입력하면 프로젝트를 보여 드립니다.");

// 8) fetch가 취소 신호를 무시하더라도 requestId가 달라져 늦은 응답은 버려진다.
let resolveLateResponse;
const lateApp = await launchApp(() => new Promise((resolve) => {
  resolveLateResponse = resolve;
}));
await submitGitHubUsername(lateApp, "bad name");
resolveLateResponse(successfulResponse([{ ...safeRepository, name: "late-result" }]));
await flush();
assert.equal(lateApp.projectsGrid.innerHTML, "");
assert.equal(lateApp.projectsStatus.classList.contains("is-success"), false);

// 9) 스크롤 기준값의 경계: 헤더는 60px, 맨 위 버튼은 300px "이상"에서 바뀐다.
const scrollApp = await launchApp(async () => successfulResponse([]));
assert.equal(THRESHOLDS.navigation, 60);
assert.equal(THRESHOLDS.scrollTop, 300);
scrollApp.scrollTo(THRESHOLDS.navigation - 1);
assert.equal(scrollApp.header.classList.contains("is-scrolled"), false);
scrollApp.scrollTo(THRESHOLDS.navigation);
assert.equal(scrollApp.header.classList.contains("is-scrolled"), true);
scrollApp.scrollTo(THRESHOLDS.scrollTop - 1);
assert.equal(scrollApp.scrollTop.classList.contains("is-visible"), false);
scrollApp.scrollTo(THRESHOLDS.scrollTop);
assert.equal(scrollApp.scrollTop.classList.contains("is-visible"), true);
scrollApp.scrollTo(0);
assert.equal(scrollApp.header.classList.contains("is-scrolled"), false);
assert.equal(scrollApp.scrollTop.classList.contains("is-visible"), false);

// 10) 다크 모드: 클릭하면 상태가 바뀌고 저장되며, 저장된 값은 다음 실행에서 복원된다.
const themeApp = await launchApp(async () => successfulResponse([]));
assert.equal(themeApp.documentElement.dataset.theme, "light");
themeApp.themeToggle.trigger("click");
assert.equal(themeApp.documentElement.dataset.theme, "dark");
assert.equal(themeApp.storage.get(THEME_STORAGE_KEY), "dark");
assert.equal(themeApp.themeToggle.getAttribute("aria-pressed"), "true");
themeApp.themeToggle.trigger("click");
assert.equal(themeApp.documentElement.dataset.theme, "light");
assert.equal(themeApp.storage.get(THEME_STORAGE_KEY), "light");
const restoredApp = await launchApp(async () => successfulResponse([]), { storedTheme: "dark" });
assert.equal(restoredApp.documentElement.dataset.theme, "dark");

// 11) 햄버거 메뉴: classList.toggle('active')로 열고 닫는다.
const menuApp = await launchApp(async () => successfulResponse([]));
menuApp.menuToggle.trigger("click");
assert.equal(menuApp.navigation.classList.contains("active"), true);
assert.equal(menuApp.menuToggle.getAttribute("aria-expanded"), "true");
menuApp.menuToggle.trigger("click");
assert.equal(menuApp.navigation.classList.contains("active"), false);
assert.equal(menuApp.menuToggle.getAttribute("aria-expanded"), "false");

// 12) Contact 폼: 빈 제출 → 필드별 오류, 형식 오류, 입력하면 해당 오류만 해제, 올바른 제출 → 성공.
const contactApp = await launchApp(async () => successfulResponse([]));
const emptySubmit = contactApp.contactForm.trigger("submit");
assert.equal(emptySubmit.defaultPrevented, true);
assert.equal(contactApp.contactNameError.textContent, "이름을 입력해 주세요.");
assert.equal(contactApp.contactEmailError.textContent, "이메일을 입력해 주세요.");
assert.equal(contactApp.contactMessageError.textContent, "메시지를 입력해 주세요.");
assert.equal(contactApp.contactName.getAttribute("aria-invalid"), "true");
assert.equal(contactApp.contactSuccess.textContent, "");
contactApp.contactName.value = "테스트";
contactApp.contactName.trigger("input");
assert.equal(contactApp.contactNameError.textContent, "");
assert.equal(contactApp.contactEmailError.textContent, "이메일을 입력해 주세요.");
contactApp.contactEmail.value = "wrong";
contactApp.contactMessage.value = "검증용 메시지";
contactApp.contactForm.trigger("submit");
assert.equal(contactApp.contactEmailError.textContent, "이메일 형식을 확인해 주세요.");
assert.equal(contactApp.contactSuccess.textContent, "");
contactApp.contactEmail.value = "test@example.com";
contactApp.contactForm.trigger("submit");
assert.match(contactApp.contactSuccess.textContent, /실제 메시지를 전송하지 않습니다/);
assert.equal(contactApp.contactName.value, "");
contactApp.contactName.value = "새 입력";
contactApp.contactName.trigger("input");
assert.equal(contactApp.contactSuccess.textContent, "");

console.log("portfolio DOM state tests: ok");
