export const THEME_STORAGE_KEY = "portfolio-theme";

// Projects 섹션이 페이지를 열자마자 불러올 GitHub 계정. 방문자는 입력창에서 다른 계정으로 바꿔 볼 수 있다.
export const DEFAULT_GITHUB_USERNAME = "Minkyu01";

export const THRESHOLDS = Object.freeze({
  scrollTop: 300,
  navigation: 60,
  reveal: 0.25,
});

export const PROJECT_STATUS = Object.freeze({
  idle: "idle",
  loading: "loading",
  success: "success",
  empty: "empty",
  error: "error",
});

const normaliseTheme = (theme) => (theme === "dark" ? "dark" : "light");

const toText = (value) => String(value ?? "").trim();

const safeRepositoryUrl = (candidate) => {
  try {
    const url = new URL(candidate);

    return url.protocol === "https:" && url.hostname === "github.com" ? url.href : "";
  } catch {
    return "";
  }
};

export const createInitialState = (storedTheme) => ({
  theme: normaliseTheme(storedTheme),
  menuOpen: false,
  projects: {
    status: PROJECT_STATUS.idle,
    username: DEFAULT_GITHUB_USERNAME,
    repositories: [],
    error: "",
    requestId: 0,
  },
  contact: {
    errors: {
      name: "",
      email: "",
      message: "",
    },
    success: "",
  },
});

export const startProjectRequest = (projects, { status, username }) => ({
  ...projects,
  status,
  username,
  repositories: [],
  error: "",
  requestId: projects.requestId + 1,
});

export const validateGitHubUsername = (rawValue) => {
  const value = toText(rawValue);
  const isGitHubUsername = /^(?:[a-z\d]|[a-z\d](?:[a-z\d-]{0,37}[a-z\d]))$/i.test(value);

  if (!value) {
    return { isValid: false, value, error: "GitHub 사용자명을 입력해 주세요." };
  }

  if (!isGitHubUsername) {
    return {
      isValid: false,
      value,
      error: "영문, 숫자, 하이픈으로 된 1~39자 사용자명을 입력해 주세요.",
    };
  }

  return { isValid: true, value, error: "" };
};

export const validateContact = (values) => {
  const { name = "", email = "", message = "" } = values;
  const cleanValues = {
    name: toText(name),
    email: toText(email),
    message: toText(message),
  };
  const errors = {
    name: cleanValues.name ? "" : "이름을 입력해 주세요.",
    email: "",
    message: cleanValues.message ? "" : "메시지를 입력해 주세요.",
  };
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleanValues.email) {
    errors.email = "이메일을 입력해 주세요.";
  } else if (!emailPattern.test(cleanValues.email)) {
    errors.email = "이메일 형식을 확인해 주세요.";
  }

  return {
    isValid: Object.values(errors).every((error) => !error),
    values: cleanValues,
    errors,
  };
};

export const escapeHtml = (value) => {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
};

export const normaliseRepositories = (payload) => {
  if (!Array.isArray(payload)) {
    const error = new TypeError("GitHub 저장소 응답은 배열이어야 합니다.");

    error.code = "INVALID_PROJECT_PAYLOAD";
    throw error;
  }

  return payload
    .filter((repository) => repository && typeof repository === "object" && !Array.isArray(repository))
    .filter(({ fork, archived }) => !fork && !archived)
    .map((repository) => {
      const { name, description, html_url: htmlUrl, stargazers_count: stars, language } = repository;

      return {
        name: toText(name) || "이름 없는 저장소",
        description: toText(description) || "설명이 없습니다.",
        url: safeRepositoryUrl(htmlUrl),
        stars: Number.isFinite(stars) ? stars : 0,
        language: toText(language) || "기술 미표기",
      };
    })
    .filter(({ url }) => Boolean(url));
};

export const buildProjectCardsMarkup = (repositories) => repositories
  .map(({ name, description, language, stars, url }) => {
    const safeUrl = safeRepositoryUrl(url);

    return `
      <article class="project-card">
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(description)}</p>
        <div class="project-meta">
          <span>${escapeHtml(language)}</span>
          <span>★ ${escapeHtml(stars)}</span>
        </div>
        <a class="project-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">저장소 열기 <span aria-hidden="true">↗</span></a>
      </article>
    `;
  })
  .join("");

const PROJECT_ERROR_HEADLINE = "프로젝트를 불러올 수 없습니다.";

// 원인이 무엇이든 에러 상태는 같은 첫 문장으로 시작하고, 뒤에 원인별 안내를 덧붙인다.
export const projectErrorMessage = (error) => {
  if (error?.code === "INVALID_PROJECT_PAYLOAD") {
    return `${PROJECT_ERROR_HEADLINE} GitHub 응답 형식을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.`;
  }

  if (error?.status === 403 || error?.status === 429) {
    return `${PROJECT_ERROR_HEADLINE} GitHub API 요청 한도에 도달했거나 접근이 제한되었습니다. 잠시 뒤 다시 시도해 주세요.`;
  }

  if (error?.status === 404) {
    return `${PROJECT_ERROR_HEADLINE} 해당 GitHub 사용자를 찾을 수 없습니다. 사용자명을 확인해 주세요.`;
  }

  return `${PROJECT_ERROR_HEADLINE} 네트워크 상태를 확인한 뒤 다시 시도해 주세요.`;
};
