"""Static contracts for the portfolio site; no network access and no browser required."""

from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class MarkupCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.elements: list[tuple[str, dict[str, str | None]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.elements.append((tag, dict(attrs)))


def fail(message: str) -> None:
    raise AssertionError(message)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def has_element(elements: list[tuple[str, dict[str, str | None]]], tag: str, **attributes: str) -> bool:
    return any(
        element_tag == tag and all(element_attributes.get(key) == value for key, value in attributes.items())
        for element_tag, element_attributes in elements
    )


def check_files() -> None:
    required_files = [
        "index.html",
        "css/style.css",
        "js/main.js",
        "js/portfolio_state.js",
        "images/profile-placeholder.svg",
        "images/favicon.svg",
        "README.md",
        "package.json",
        "docs/design.md",
        "docs/submission.md",
        "docs/review_checklist.md",
        "docs/requirements-traceability.md",
        "tests/run_all.sh",
        "tests/test_state.mjs",
        "tests/test_main_dom.mjs",
        "tests/e2e_browser.mjs",
        "tests/cdp_helper.mjs",
    ]
    for relative_path in required_files:
        require((ROOT / relative_path).is_file(), f"missing required file: {relative_path}")

    for folder in ("css", "js", "images"):
        require((ROOT / folder).is_dir(), f"missing folder: {folder}/")


def check_markup(html: str) -> None:
    parser = MarkupCollector()
    parser.feed(html)
    elements = parser.elements
    tags = {tag for tag, _ in elements}

    for tag in {"header", "nav", "main", "section", "article", "footer"}:
        require(tag in tags, f"semantic <{tag}> is required")

    for section_id in {"hero", "about", "skills", "projects", "contact"}:
        require(has_element(elements, "section", id=section_id), f"missing #{section_id} section")

    require(has_element(elements, "link", rel="stylesheet", href="css/style.css"), "external stylesheet is not linked")
    require(has_element(elements, "link", rel="icon", href="images/favicon.svg"), "favicon is not linked")
    script_elements = [attributes for tag, attributes in elements if tag == "script"]
    require(
        any(attributes.get("src") == "js/main.js" and "defer" in attributes for attributes in script_elements),
        "deferred main JavaScript is not linked",
    )
    require(all(attributes.get("src") for attributes in script_elements), "inline <script> blocks are not used")
    require(has_element(elements, "form", id="github-form"), "GitHub form is required")
    require(has_element(elements, "form", id="contact-form"), "Contact form is required")

    navigation_hrefs = {
        attributes.get("href")
        for tag, attributes in elements
        if tag == "a" and attributes.get("href", "").startswith("#")
    }
    for href in {"#about", "#skills", "#projects", "#contact"}:
        require(href in navigation_hrefs, f"missing navigation anchor: {href}")

    images = [attributes for tag, attributes in elements if tag == "img"]
    require(images and all(attributes.get("alt", "").strip() for attributes in images), "all images need meaningful alt text")
    control_ids = {
        attributes.get("id")
        for tag, attributes in elements
        if tag in {"input", "textarea", "select"} and attributes.get("id")
    }
    labels = {attributes.get("for") for tag, attributes in elements if tag == "label"}
    require(control_ids.issubset(labels), "each form control needs a matching label")
    require(not re.search(r"\son[a-z]+\s*=", html, flags=re.IGNORECASE), "inline event handlers are forbidden")
    require(not re.search(r"\sstyle\s*=", html, flags=re.IGNORECASE), "inline style attributes are forbidden")

    require("안녕하세요" in html, "Hero needs a greeting")
    social_links = re.findall(r'<a href="(https://[^"]+)"[^>]*>', html.split("<footer", 1)[1])
    require(social_links, "footer needs social links")
    for link in social_links:
        require(re.match(r"https://[^/]+/.+", link), f"social link must point at a profile or repository: {link}")


def check_styles(css: str) -> None:
    for token in (
        ":root",
        '[data-theme="dark"]',
        "display: flex",
        "auto-fit",
        "minmax",
        "box-shadow",
        "transition",
        ":hover",
        ":focus-visible",
        ".js-enabled .primary-navigation",
        "scroll-margin-top",
    ):
        require(token in css, f"missing CSS requirement: {token}")
    for breakpoint in ("@media (min-width: 768px)", "@media (min-width: 1024px)"):
        require(breakpoint in css, f"missing responsive breakpoint: {breakpoint}")
    require("@media (max-width" not in css, "mobile-first CSS must not use max-width queries")
    require("@media (prefers-reduced-motion: reduce)" in css, "reduced-motion fallback is required")
    scroll_top_rule = re.search(r"\.scroll-top\s*\{([^}]*)\}", css)
    require(scroll_top_rule and "visibility: hidden" in scroll_top_rule.group(1), "hidden scroll-top must leave the tab order")
    for variable in ("--color-bg", "--font-body", "--space-4"):
        require(variable in css, f"missing CSS variable: {variable}")


def check_scripts(main_js: str, state_js: str, html: str, css: str) -> None:
    for forbidden in ("react", "vue", "jquery", "bootstrap", "tailwind"):
        require(forbidden not in (html + css + main_js + state_js).lower(), f"forbidden library marker: {forbidden}")
    require(not re.search(r"\bvar\b", main_js + state_js), "use const/let instead of var")
    for source_token in (
        "querySelector(",
        "querySelectorAll(",
        'addEventListener("click"',
        'addEventListener("submit"',
        'addEventListener("scroll"',
        'addEventListener("input"',
        "preventDefault()",
        "textContent",
        "innerHTML",
        "classList.add",
        "classList.remove",
        "classList.toggle",
        'classList.toggle("active"',
        "localStorage",
        "IntersectionObserver",
        "AbortController",
        "controller.signal",
        "fetch(",
        "async ",
        "await ",
        "try {",
        "catch",
        "encodeURIComponent",
        "https://api.github.com/users/",
        "startProjectRequest",
        "loadProjects(state.projects.username)",
        "로딩 중...",
        "다시 시도",
        "표시할 프로젝트가 없습니다",
        ".map(",
        ".forEach(",
    ):
        require(source_token in main_js + state_js, f"missing JavaScript behavior: {source_token}")

    require(".filter(" in state_js, "array filter is used to drop forks and archived repositories")
    require("프로젝트를 불러올 수 없습니다" in state_js, "spec error message is missing")
    for status in ("idle", "loading", "success", "empty", "error"):
        require(f'{status}: "{status}"' in state_js, f"missing projects state: {status}")
    require("scrollTop: 300" in state_js, "scroll-top threshold must be 300px")
    require("navigation: 60" in state_js, "navigation threshold must be 60px")
    require("reveal: 0.25" in state_js, "reveal threshold must be 0.25")
    require("escapeHtml" in state_js and "safeRepositoryUrl" in state_js, "API card output must be sanitized")
    require("INVALID_PROJECT_PAYLOAD" in state_js, "malformed API payload must use an error state")
    require('DEFAULT_GITHUB_USERNAME = "codyssey0"' in state_js, "default GitHub account is not configured")


def check_documents(readme: str, package: dict[str, object]) -> None:
    # 원문 4.10: README에 프로젝트 설명, 사용 기술, 배포 URL, 스크린샷이 포함되어야 한다.
    for heading in ("## 프로젝트 소개", "## 사용 기술", "## 배포", "## 스크린샷"):
        require(heading in readme, f"README section is missing: {heading}")
    require(re.search(r"https://codyssey0\.github\.io/B1-1_portfolio-web/?", readme), "README needs the GitHub Pages URL")
    require("https://github.com/codyssey0/B1-1_portfolio-web" in readme, "README needs the repository URL")
    for screenshot in ("desktop.png", "mobile.png", "dark-mode.png"):
        require(f"docs/screenshots/{screenshot}" in readme, f"README does not embed {screenshot}")
        require((ROOT / "docs" / "screenshots" / screenshot).is_file(), f"missing screenshot file: {screenshot}")

    # 원문 4.5: 기준값을 바꿨다면 README에 명시한다.
    for stated in ("300px", "60px", "0.25"):
        require(stated in readme, f"README must state the threshold {stated}")
    require("Live Server" in readme, "README should describe the Live Server workflow")

    for stale in ("BLOCKED", "Q10", "q10-portfolio-web", "solutions/ai-all-in-one", "original-questions-markdown", "DEPLOY_STATUS"):
        for relative_path in ("README.md", "docs/design.md", "docs/submission.md", "docs/review_checklist.md"):
            require(stale not in read(relative_path), f"stale marker {stale!r} in {relative_path}")

    require(package.get("type") == "module", "package must enable ES modules for unit tests")
    scripts = package.get("scripts", {})
    require(scripts.get("check") == "bash tests/run_all.sh", "package check script must run the tests")
    require(scripts.get("e2e") == "node tests/e2e_browser.mjs", "package e2e script is missing")


def main() -> None:
    check_files()
    html = read("index.html")
    css = read("css/style.css")
    main_js = read("js/main.js")
    state_js = read("js/portfolio_state.js")

    check_markup(html)
    check_styles(css)
    check_scripts(main_js, state_js, html, css)
    check_documents(read("README.md"), json.loads(read("package.json")))
    print("portfolio static contract tests: ok")


if __name__ == "__main__":
    main()
