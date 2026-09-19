import assert from "node:assert/strict";

import {
  DEFAULT_GITHUB_USERNAME,
  PROJECT_STATUS,
  THEME_STORAGE_KEY,
  THRESHOLDS,
  buildProjectCardsMarkup,
  createInitialState,
  normaliseRepositories,
  projectErrorMessage,
  startProjectRequest,
  validateContact,
  validateGitHubUsername,
} from "../js/portfolio_state.js";

const initialDarkState = createInitialState("dark");
const initialFallbackState = createInitialState("unexpected");

assert.equal(initialDarkState.theme, "dark");
assert.equal(initialFallbackState.theme, "light");
assert.equal(initialDarkState.projects.status, PROJECT_STATUS.idle);
assert.equal(initialDarkState.projects.username, DEFAULT_GITHUB_USERNAME);
assert.equal(DEFAULT_GITHUB_USERNAME, "Minkyu01");
assert.equal(THEME_STORAGE_KEY, "portfolio-theme");
assert.deepEqual(THRESHOLDS, { scrollTop: 300, navigation: 60, reveal: 0.25 });

const nextProjectRequest = startProjectRequest(
  { ...initialDarkState.projects, requestId: 7, repositories: [{ name: "old" }], error: "old error" },
  { status: PROJECT_STATUS.idle, username: "" },
);

assert.equal(nextProjectRequest.requestId, 8);
assert.equal(nextProjectRequest.status, PROJECT_STATUS.idle);
assert.equal(nextProjectRequest.username, "");
assert.deepEqual(nextProjectRequest.repositories, []);
assert.equal(nextProjectRequest.error, "");

assert.deepEqual(validateGitHubUsername("octocat"), {
  isValid: true,
  value: "octocat",
  error: "",
});
assert.equal(validateGitHubUsername(" ").isValid, false);
assert.equal(validateGitHubUsername("bad name").isValid, false);
assert.equal(validateGitHubUsername("-starts-with-hyphen").isValid, false);

const invalidContact = validateContact({ name: "", email: "wrong", message: "" });
const validContact = validateContact({
  name: "  포트폴리오 작성자  ",
  email: " author@example.com ",
  message: " 반갑습니다. ",
});

assert.equal(invalidContact.isValid, false);
assert.equal(invalidContact.errors.name, "이름을 입력해 주세요.");
assert.equal(invalidContact.errors.email, "이메일 형식을 확인해 주세요.");
assert.equal(invalidContact.errors.message, "메시지를 입력해 주세요.");
assert.equal(validContact.isValid, true);
assert.deepEqual(validContact.values, {
  name: "포트폴리오 작성자",
  email: "author@example.com",
  message: "반갑습니다.",
});

const repositories = normaliseRepositories([
  {
    name: "<script>unsafe-name</script>",
    description: "<img src=x onerror=alert(1)>",
    html_url: "https://github.com/example/safe-project",
    stargazers_count: 7,
    language: "JavaScript",
    fork: false,
    archived: false,
  },
  {
    name: "forked-project",
    html_url: "https://github.com/example/forked-project",
    fork: true,
    archived: false,
  },
  {
    name: "unsafe-link",
    html_url: "javascript:alert(1)",
    fork: false,
    archived: false,
  },
  {
    name: "archived-project",
    html_url: "https://github.com/example/archived-project",
    fork: false,
    archived: true,
  },
  null,
]);
const cards = buildProjectCardsMarkup(repositories);

assert.equal(repositories.length, 1);
assert.equal(repositories[0].stars, 7);
assert.match(cards, /&lt;script&gt;unsafe-name&lt;\/script&gt;/);
assert.match(cards, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(cards, /<script>/);
assert.doesNotMatch(cards, /javascript:/i);
assert.match(cards, /rel="noopener noreferrer"/);
assert.match(cards, /https:\/\/github\.com\/example\/safe-project/);
assert.throws(
  () => normaliseRepositories({ message: "not an array" }),
  (error) => error?.code === "INVALID_PROJECT_PAYLOAD",
);

assert.match(projectErrorMessage({ code: "INVALID_PROJECT_PAYLOAD" }), /응답 형식/);
assert.match(projectErrorMessage({ status: 403 }), /요청 한도/);
assert.match(projectErrorMessage({ status: 429 }), /요청 한도/);
assert.match(projectErrorMessage({ status: 404 }), /찾을 수 없습니다/);
assert.match(projectErrorMessage(new Error("network")), /네트워크/);

// 원문 요구: 원인과 상관없이 에러 상태는 "프로젝트를 불러올 수 없습니다" 문구로 시작한다.
[{ code: "INVALID_PROJECT_PAYLOAD" }, { status: 403 }, { status: 404 }, { status: 500 }, new Error("network")].forEach((error) => {
  assert.match(projectErrorMessage(error), /^프로젝트를 불러올 수 없습니다\./);
});

console.log("portfolio state tests: ok");
