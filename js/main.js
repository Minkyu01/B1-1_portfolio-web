import {
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
} from "./portfolio_state.js";

const readStoredTheme = () => {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStoredTheme = (theme) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage가 막힌 환경에서도 화면 테마 전환은 계속 제공한다.
  }
};

const state = createInitialState(readStoredTheme());
let activeProjectController = null;

const elements = {
  documentElement: document.documentElement,
  header: document.querySelector("#site-header"),
  themeToggle: document.querySelector("#theme-toggle"),
  themeToggleLabel: document.querySelector(".theme-toggle-label"),
  menuToggle: document.querySelector("#menu-toggle"),
  menuToggleLabel: document.querySelector("#menu-toggle .sr-only"),
  navigation: document.querySelector("#primary-navigation"),
  scrollTop: document.querySelector("#scroll-top"),
  githubForm: document.querySelector("#github-form"),
  githubUsername: document.querySelector("#github-username"),
  githubUsernameError: document.querySelector("#github-username-error"),
  projectsStatus: document.querySelector("#projects-status"),
  projectsGrid: document.querySelector("#projects-grid"),
  contactForm: document.querySelector("#contact-form"),
  contactSuccess: document.querySelector("#contact-success"),
  contactFields: {
    name: document.querySelector("#contact-name"),
    email: document.querySelector("#contact-email"),
    message: document.querySelector("#contact-message"),
  },
  contactErrors: {
    name: document.querySelector("#contact-name-error"),
    email: document.querySelector("#contact-email-error"),
    message: document.querySelector("#contact-message-error"),
  },
};

elements.documentElement.classList.add("js-enabled");

const motionBehavior = () => (
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
);

const renderTheme = () => {
  const isDark = state.theme === "dark";

  elements.documentElement.dataset.theme = state.theme;
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
  elements.themeToggleLabel.textContent = isDark ? "라이트" : "다크";
};

const renderMenu = () => {
  const isOpen = state.menuOpen;

  elements.menuToggle.classList.toggle("active", isOpen);
  elements.navigation.classList.toggle("active", isOpen);
  elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
  elements.menuToggleLabel.textContent = isOpen ? "메뉴 닫기" : "메뉴 열기";
};

const renderScrollState = () => {
  const scrollPosition = window.scrollY;
  const isScrollTopVisible = scrollPosition >= THRESHOLDS.scrollTop;

  if (scrollPosition >= THRESHOLDS.navigation) {
    elements.header.classList.add("is-scrolled");
  } else {
    elements.header.classList.remove("is-scrolled");
  }

  elements.scrollTop.classList.toggle("is-visible", isScrollTopVisible);
};

const renderGitHubValidation = (message) => {
  elements.githubUsernameError.textContent = message;

  if (message) {
    elements.githubUsername.setAttribute("aria-invalid", "true");
  } else {
    elements.githubUsername.removeAttribute("aria-invalid");
  }
};

const renderProjects = () => {
  const { status, repositories, error } = state.projects;

  elements.projectsGrid.innerHTML = "";
  elements.projectsGrid.setAttribute("aria-busy", String(status === PROJECT_STATUS.loading));
  elements.projectsStatus.classList.remove("is-error", "is-success", "is-loading");

  if (status === PROJECT_STATUS.loading) {
    elements.projectsStatus.textContent = "로딩 중...";
    elements.projectsStatus.classList.add("is-loading");
    return;
  }

  if (status === PROJECT_STATUS.success) {
    elements.projectsStatus.textContent = `${repositories.length}개의 공개 저장소를 표시합니다.`;
    elements.projectsStatus.classList.add("is-success");
    elements.projectsGrid.innerHTML = buildProjectCardsMarkup(repositories);
    return;
  }

  if (status === PROJECT_STATUS.empty) {
    elements.projectsStatus.textContent = "표시할 프로젝트가 없습니다.";
    return;
  }

  if (status === PROJECT_STATUS.error) {
    const retryButton = document.createElement("button");

    elements.projectsStatus.textContent = error;
    elements.projectsStatus.classList.add("is-error");
    retryButton.className = "button button-secondary retry-button";
    retryButton.id = "retry-projects";
    retryButton.type = "button";
    retryButton.textContent = "다시 시도";
    elements.projectsStatus.append(retryButton);
    retryButton.addEventListener("click", () => loadProjects(state.projects.username));
    return;
  }

  elements.projectsStatus.textContent = "GitHub 사용자명을 입력하면 프로젝트를 보여 드립니다.";
};

const renderContact = () => {
  Object.entries(state.contact.errors).forEach(([fieldName, error]) => {
    const field = elements.contactFields[fieldName];
    const errorElement = elements.contactErrors[fieldName];

    errorElement.textContent = error;

    if (error) {
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  });

  elements.contactSuccess.textContent = state.contact.success;
};

const loadProjects = async (rawUsername) => {
  const validation = validateGitHubUsername(rawUsername);
  const nextStatus = validation.isValid ? PROJECT_STATUS.loading : PROJECT_STATUS.idle;

  renderGitHubValidation(validation.error);

  if (activeProjectController) {
    activeProjectController.abort();
    activeProjectController = null;
  }

  state.projects = startProjectRequest(state.projects, {
    status: nextStatus,
    username: validation.value,
  });

  if (!validation.isValid) {
    renderProjects();
    return;
  }

  const { requestId } = state.projects;
  const controller = new AbortController();

  activeProjectController = controller;
  renderProjects();

  try {
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(validation.value)}/repos?sort=updated&per_page=12`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const error = new Error("GitHub API 요청에 실패했습니다.");

      error.status = response.status;
      throw error;
    }

    const repositories = normaliseRepositories(await response.json());

    if (requestId !== state.projects.requestId) {
      return;
    }

    state.projects = {
      ...state.projects,
      status: repositories.length ? PROJECT_STATUS.success : PROJECT_STATUS.empty,
      repositories,
    };
  } catch (error) {
    if (requestId !== state.projects.requestId || error?.name === "AbortError") {
      return;
    }

    state.projects = {
      ...state.projects,
      status: PROJECT_STATUS.error,
      error: projectErrorMessage(error),
    };
  } finally {
    if (activeProjectController === controller) {
      activeProjectController = null;
    }
  }

  renderProjects();
};

const readContactValues = () => ({
  name: elements.contactFields.name.value,
  email: elements.contactFields.email.value,
  message: elements.contactFields.message.value,
});

const setupRevealObserver = () => {
  const revealElements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window) || motionBehavior() === "auto") {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          activeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: THRESHOLDS.reveal },
  );

  revealElements.forEach((element) => observer.observe(element));
};

elements.themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  writeStoredTheme(state.theme);
  renderTheme();
});

elements.menuToggle.addEventListener("click", () => {
  state.menuOpen = !state.menuOpen;
  renderMenu();
});

document.querySelectorAll(".primary-navigation a, .hero-actions a, .brand").forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetSelector = anchor.getAttribute("href");
    const target = targetSelector ? document.querySelector(targetSelector) : null;

    if (!target) {
      return;
    }

    event.preventDefault();
    state.menuOpen = false;
    renderMenu();
    target.scrollIntoView({ behavior: motionBehavior(), block: "start" });
  });
});

elements.scrollTop.addEventListener("click", (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: motionBehavior() });
});

elements.githubUsername.addEventListener("input", () => {
  renderGitHubValidation("");
});

elements.githubForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadProjects(elements.githubUsername.value);
});

Object.entries(elements.contactFields).forEach(([fieldName, field]) => {
  field.addEventListener("input", () => {
    if (!state.contact.errors[fieldName]) {
      if (state.contact.success) {
        state.contact = {
          ...state.contact,
          success: "",
        };
        renderContact();
      }
      return;
    }

    const validation = validateContact(readContactValues());

    state.contact = {
      ...state.contact,
      errors: {
        ...state.contact.errors,
        [fieldName]: validation.errors[fieldName],
      },
      success: "",
    };
    renderContact();
  });
});

elements.contactForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const validation = validateContact(readContactValues());

  state.contact = {
    errors: validation.errors,
    success: validation.isValid ? "입력을 확인했습니다. 이 데모는 실제 메시지를 전송하지 않습니다." : "",
  };
  renderContact();

  if (validation.isValid) {
    elements.contactForm.reset();
  }
});

window.addEventListener("scroll", renderScrollState, { passive: true });

renderTheme();
renderMenu();
renderScrollState();
renderContact();
setupRevealObserver();

// 페이지를 열면 기본 계정의 저장소를 바로 불러온다(입력창에도 같은 값을 채워 둔다).
elements.githubUsername.value = state.projects.username;
loadProjects(state.projects.username);
