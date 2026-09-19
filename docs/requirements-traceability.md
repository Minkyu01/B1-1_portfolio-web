# 명세 대응표

과제 명세(`project.md`)의 조항 번호를 기준으로 **어디에 구현했고 어떻게 확인했는지**를 정리했다. 검증 열의 `[4.5-3]` 같은 표기는 `node tests/e2e_browser.mjs`가 출력하는 조항 번호다. `static`은 `tests/test_static_contract.py`, `dom`은 `tests/test_main_dom.mjs`, `state`는 `tests/test_state.mjs`를 뜻한다.

## 2. 최종 결과물

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| 모든 환경에서 최적화된 반응형 레이아웃 | `css/style.css`의 모바일 기본 규칙 + `@media (min-width: 768px / 1024px)` | e2e `[2]` 320·375·768·1024·1440px에서 가로 넘침 없음 |
| Hero · About · Skills · Projects · Contact · Footer | `index.html`의 `section#hero` 등, `footer` | e2e `[4.2]`, static |
| 다크 모드 · 햄버거 · 부드러운 스크롤 · 스크롤 애니메이션 | `main.js`의 `renderTheme`·`renderMenu`·`scrollIntoView`·`setupRevealObserver` | e2e `[4.5-1]`~`[4.5-6]` |
| 폼 유효성 검사 | `portfolio_state.js`의 `validateContact` + `main.js`의 `renderContact` | e2e `[4.6]`, dom, state |
| GitHub API로 본인 저장소를 Projects에 동적 렌더링 | `main.js`의 `loadProjects` — 페이지를 열 때 `state.projects.username`(= `DEFAULT_GITHUB_USERNAME`)으로 자동 호출 | e2e `[4.8]` 자동 로드, `--live` |
| 로딩·에러·빈 상태 UI | `renderProjects`의 `PROJECT_STATUS` 분기 | e2e `[4.8]`, dom |
| 다크 모드 `localStorage` 유지 | `writeStoredTheme`·`readStoredTheme` | e2e `[4.5-5]`, dom |
| GitHub Pages 배포 | `gh-pages` 브랜치 → <https://codyssey0.github.io/B1-1_portfolio-web/> ([제출 안내](submission.md)) | 배포 주소에서 `e2e --url` 59/59, `--live` 2/2 (2026-09-19) |

## 4.1 프로젝트 기본 구성

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| `index.html`, `css/`, `js/`, `images/` 분리 | 루트 구조 | static(파일·폴더 존재) |
| 외부 스타일시트·JS 연결 | `<link rel="stylesheet" href="css/style.css">`, `<script type="module" src="js/main.js" defer>` | e2e `[4.1]`, static |
| VS Code + Live Server | README "실행 방법", `.vscode/extensions.json`(추천 확장) | 직접 확인 — 확장 프로그램이라 자동 검증 불가 |

## 4.2 HTML 구조

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| 시맨틱 태그 6종 | `header`·`nav`·`main`·`section`·`article`·`footer` | e2e `[4.2]`, static |
| Hero: 인사말, CTA | `.hero-greeting`, `.hero-actions`의 링크 2개 | e2e `[4.2]`, static |
| About: 자기소개, 프로필 이미지 | `#about article`, `images/profile-placeholder.svg` | e2e `[4.2]` |
| Skills: 기술 스택 목록 | `ul.skill-list` | e2e `[4.2]` |
| Projects: GitHub API 카드 | `#projects-grid`에 `article.project-card` 렌더링 | e2e `[4.8]` |
| Contact: 문의 폼 | `form#contact-form` | e2e `[4.6]` |
| Footer: 저작권, 소셜 링크 | `.footer-inner`의 ©, GitHub 프로필·저장소 링크 | e2e `[4.2]`(도메인 루트가 아닌 링크), static |
| 앵커 링크 | `nav a[href="#about"]` 등 4개 | e2e `[4.2]`, static |
| 이미지 `alt` | About 이미지 | e2e `[4.2]`, static |
| label `for`-`id` | 모든 `input`·`textarea` | e2e `[4.2]`, static |

## 4.3 CSS 스타일링

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| 외부 스타일시트 `css/style.css` | — | e2e `[4.1]` |
| `:root` 변수(색·폰트·간격) | `--color-*`, `--font-body`, `--space-*` | e2e `[4.3]`, static |
| `[data-theme="dark"]` 변수 | 같은 변수의 값 재정의 | e2e `[4.3]`, static |
| 내비게이션 Flexbox, 로고 왼쪽·메뉴 오른쪽 | `.header-inner { display: flex }` | e2e `[4.3]`(좌표로 확인) |
| Projects Grid `auto-fit`·`minmax` | `.projects-grid { grid-template-columns: repeat(auto-fit, minmax(min(100%, 232px), 1fr)) }` | e2e `[4.3·4.8]`, 폭별 열 수 |
| 모바일 퍼스트, 768px·1024px | `@media (min-width: …)`만 사용 | e2e `[4.3]`, static(`max-width` 쿼리 없음) |
| 모바일에서 메뉴 숨김·햄버거 표시 | `.js-enabled .primary-navigation { display: none }`, `.js-enabled .menu-toggle` | e2e 폭별 `[4.3]` |
| 버튼·카드 hover + transition, 카드 box-shadow | `.button:hover`, `.project-card:hover`, `--shadow-card` | e2e `[4.3]`(실제 hover 후 `transform` 확인) |

## 4.4 JavaScript 기초

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| `defer`로 연결 | `<script … defer>` | e2e `[4.1]`, static |
| `var` 미사용 | 전체 `const`·`let` | e2e `[4.4·7]`, static |
| `onclick` 미사용, `addEventListener` | `main.js` 하단의 이벤트 연결 | e2e `[7]`, static |
| `querySelector(All)` | `elements` 객체, 앵커 선택 | static |
| `textContent`·`innerHTML` | `renderProjects`·`renderContact` | static |
| `classList.add/remove/toggle` | `renderMenu`·`renderScrollState`·`renderProjects` | static, dom |
| `click`·`submit`·`scroll`·`input` | 테마·메뉴·폼·스크롤·입력 | static, dom |
| `event.preventDefault()` | 두 폼과 앵커 클릭 | dom(`defaultPrevented`), e2e `[4.6]` |

## 4.5 인터랙션

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| 햄버거 토글, `classList.toggle('active')` | `renderMenu` | e2e `[4.5-1]`, dom |
| 부드러운 스크롤 | `scrollIntoView({ behavior: "smooth" })` + `html { scroll-behavior: smooth }` | e2e `[4.5-2]`(중간 위치를 거치는지 표본 추출) |
| 맨 위로 버튼 — **300px**, README 명시 | `THRESHOLDS.scrollTop`, `.scroll-top.is-visible` | e2e `[4.5-3]`, dom 경계값(299 / 300), static |
| 헤더 스타일 변경 — **60px**, README 명시 | `THRESHOLDS.navigation`, `.site-header.is-scrolled` | e2e `[4.5-4]`, dom 경계값(59 / 60) |
| 다크 모드 토글·유지 | `state.theme`, `localStorage` | e2e `[4.5-5]`(새로고침 포함), dom |
| Intersection Observer threshold **0.25**(≥ 0.2), README 명시 | `THRESHOLDS.reveal` | e2e `[4.5-6]`, state |

## 4.6 폼 UX

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| 이름·이메일·메시지 | `#contact-form` | e2e `[4.6]` |
| 필수값 검증 | `validateContact` | e2e `[4.6]`, dom, state |
| 이메일 형식 검증 | `emailPattern` | e2e `[4.6]`, state |
| 에러 메시지가 입력 칸 근처 | 각 입력 바로 아래 `.field-error` | e2e `[4.6]`(입력 칸과의 거리 60px 미만) |
| `preventDefault()` + 성공 메시지 | `contactForm`의 `submit` 핸들러 | e2e `[4.6]`(페이지 이동 없음), dom |

## 4.7 ES6+ 문법 · 배열 메서드

| 요구 | 구현 |
| --- | --- |
| 화살표 함수 | 모든 함수 |
| 템플릿 리터럴로 HTML 생성 | `buildProjectCardsMarkup` |
| 구조분해 할당 | `const { status, repositories, error } = state.projects`, 저장소 필드 추출 |
| `map` | 저장소 정규화, 카드 HTML 변환 |
| `filter` | 객체가 아닌 항목·fork·archived·안전하지 않은 링크 제외 |
| `forEach` | 등장 효과 대상 순회, 폼 필드 이벤트 연결 |

검증: static(`.map(`·`.filter(`·`.forEach(` 사용 여부), state(정제 결과).

## 4.8 비동기 처리 · API 연동

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| `fetch` + `async/await`, `try/catch` | `loadProjects` | static, dom |
| 엔드포인트 `/users/{id}/repos` | `https://api.github.com/users/${encodeURIComponent(name)}/repos?sort=updated&per_page=12` | e2e `[4.8]`(요청 URL 확인), `--live` |
| 로딩: 스피너 또는 "로딩 중..." | `"로딩 중..."` 문구 + `.is-loading::before` 스피너 | e2e `[4.8]`(애니메이션 확인), dom |
| 성공: 카드 리스트 | `buildProjectCardsMarkup` | e2e `[4.8]` |
| 에러: "프로젝트를 불러올 수 없습니다" + 재시도 | `projectErrorMessage`, `#retry-projects` | e2e `[4.8]`(500·403·네트워크 실패·404), dom, state |
| 빈 상태: "표시할 프로젝트가 없습니다" | `PROJECT_STATUS.empty` | e2e `[4.8]`, dom |
| 403 레이트 리밋 → 에러 UI | `projectErrorMessage`의 403·429 분기 | e2e `[4.8·7]`, dom, state |

## 4.9 상태 관리 패턴

`이벤트 → 상태 변경 → 화면 업데이트` 흐름은 네 가지다(요구: 3가지 이상).

| 흐름 | 이벤트 | 상태 | 렌더링 |
| --- | --- | --- | --- |
| 다크 모드 | 테마 버튼 `click` | `state.theme` | `renderTheme()` → `data-theme` → CSS 변수 교체 |
| API | 페이지 열기·폼 `submit`·재시도 `click` | `state.projects.status` | `renderProjects()` → 로딩/카드/빈/에러 |
| 폼 | `input`·`submit` | `state.contact.errors` | `renderContact()` → 오류 표시·숨김 |
| 메뉴 | 햄버거 `click` | `state.menuOpen` | `renderMenu()` → `active`, `aria-expanded` |

검증: dom(상태 전이 단위), e2e `[4.9]`.

## 4.10 배포

| 요구 | 구현 | 검증 |
| --- | --- | --- |
| GitHub Pages 배포 | `gh-pages` 브랜치 ([제출 안내](submission.md)) | 배포 주소에서 `node tests/e2e_browser.mjs --url=<배포 주소>` 59/59, `--live` 2/2 (2026-09-19) |
| README에 소개·사용 기술·배포 URL·스크린샷 | README의 `## 프로젝트 소개`·`## 사용 기술`·`## 배포`·`## 스크린샷` | static |

## 7. 제약 사항

| 요구 | 검증 |
| --- | --- |
| 외부 라이브러리 금지 | e2e `[4.4·7]`(외부 자산 없음), static |
| `var` 금지, `onclick` 금지, 인라인 `style` 금지 | e2e `[4.4·7]`·`[7]`, static |
| 최신 Chrome에서 정상 동작 | e2e(Chrome 153), 콘솔 에러 없음 `[7]` |
| 제출물: 저장소 URL·배포 URL·스크린샷 3종 | [제출 안내](submission.md), `docs/screenshots/` |
| 레이트 리밋(403) 시 에러 UI | e2e `[4.8·7]` |

## 이번 점검에서 발견하고 고친 것

수정 **전** 코드에 명세 기준 e2e를 먼저 실행했더니 47개 검사 중 24개만 통과했다. 실패의 대부분은 아래 1번(자동 로드 없음)에서 이어진 것이고, 나머지는 독립된 결함이다. 기존 테스트 3종은 모두 통과하고 있었는데, 구현을 기준으로 쓰여 명세와의 차이를 잡지 못했기 때문이다.

| # | 조항 | 발견한 문제 | 조치 |
| --- | --- | --- | --- |
| 1 | 2, 4.8 | 페이지를 열어도 저장소를 불러오지 않고 사용자명을 입력해야 함(명세: "본인의 저장소 목록을 가져와 렌더링") | 기본 계정을 자동 요청하고 입력창은 남김 |
| 2 | 4.8 | 로딩 문구가 "프로젝트를 불러오는 중…", 스피너 없음 | "로딩 중..." + CSS 스피너 |
| 3 | 4.8, 7 | 403·404·형식 오류 문구가 원문 문구("프로젝트를 불러올 수 없습니다")로 시작하지 않음 | 모든 에러가 같은 첫 문장으로 시작하고 원인을 덧붙임 |
| 4 | 4.2 | Hero에 인사말이 없음 | 인사말 추가 |
| 5 | 4.2 | Footer 소셜 링크가 GitHub·LinkedIn 첫 화면 | 실제 GitHub 프로필·저장소 링크로 교체, LinkedIn은 개인 주소가 없어 제외 |
| 6 | 4.5 | 기준값이 320px·64px로 명세 예시(300px·60px)와 달라 확인이 헷갈림 | 300px·60px로 맞추고 README에 명시 |
| 7 | 접근성 | 맨 위로 버튼이 보이지 않을 때도 Tab 순서에 남음(`hidden` 속성이 `display: inline-flex`에 덮임) — 설계 문서는 반대로 서술했음 | `visibility: hidden`으로 숨김, 페이드 유지 |
| 8 | 7 | `favicon.ico` 404가 콘솔 에러로 남음 | `images/favicon.svg` 추가 |
| 9 | 4.10 | README에 배포 URL·스크린샷이 없고 옛 이름(Q10)·존재하지 않는 경로·"BLOCKED" 표기가 남아 있음 | README·문서 전면 갱신, 스크린샷 생성 |
| 10 | — | README가 설명하는 `tests/`가 폴더에 없음 | 복원하고 명세 기준 브라우저 e2e 추가 |
