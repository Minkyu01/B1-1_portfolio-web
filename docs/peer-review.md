# 동료 평가 대비 — 설명해야 할 것

동료 평가에서 **말로 설명해야 하는 것**과 **눈으로 보여 줘야 하는 것**을 명세에서 뽑아 정리했다. 항목마다 "무엇을 말할지 · 어느 코드인지 · 어떻게 보여 줄지"를 적었다. 발표할 때 이 문서를 열어 두고 코드를 따라가면 된다.

## 출처: 어디에 나와 있나

| 출처 | 위치 | 내용 |
| --- | --- | --- |
| 과제 명세 `project.md` | §3 과제 목표 | 마친 뒤 **스스로 설명할 수 있어야 하는 6가지** → [1장](#1-과제-목표-6가지--반드시-설명할-수-있어야-한다) |
| 과제 명세 `project.md` | §4.5 인터랙션 | 기준값(300px·60px·threshold)을 바꿨다면 **README에 명시** → [3장](#3-readme에-명시한-기준값-45) |
| 과제 명세 `project.md` | §7 제약 사항 — 핵심 목표 | UI 품질보다 **"이벤트 → 상태 → 렌더링" 흐름 이해**가 우선 → [1-6](#1-6-이벤트--상태-변경--dom-업데이트) |
| 미션 페이지 원문 | 동료 평가 질문 | 4범주 **15문항** (`project.md`에는 없고 원문에만 있음) → [2장](#2-동료-평가-질문-15개) |

## 1. 과제 목표 6가지 — 반드시 설명할 수 있어야 한다

### 1-1. 시맨틱 태그를 왜 쓰고, 어떤 기준으로 구조를 설계했나

- **왜**: 태그 이름이 곧 역할이다. 화면 읽기 도구·검색 엔진이 구조를 이해하고(랜드마크로 바로 이동), 코드를 읽는 사람도 역할을 바로 안다. `div`만 쓰면 class 이름으로 역할을 흉내 내야 하고, `button`처럼 키보드 동작이 기본으로 내장된 이점도 잃는다.
- **기준**: "이 덩어리가 무엇인가"로 골랐다.

| 태그 | 이 프로젝트에서 | 고른 이유 |
| --- | --- | --- |
| `header` | 사이트 머리(`.site-header`) | 로고·테마·메뉴가 있는 페이지 머리 |
| `nav` | 주요 메뉴, Footer 소셜 링크 | 이동 링크 묶음 (`aria-label`로 구분) |
| `main` | 본문(`#main-content`) | 페이지의 핵심, 문서에 하나 |
| `section` | Hero·About·Skills·Projects·Contact | 제목이 있는 주제 덩어리 (`aria-labelledby`로 제목과 연결) |
| `article` | About 소개글, API가 만드는 저장소 카드 | 혼자 떼어 놓아도 뜻이 통하는 내용 |
| `footer` | 저작권·소셜 링크 | 페이지 맨 아래 |

  `div`는 의미 없는 레이아웃 래퍼(`.shell`)에만 썼다. 제목은 `h1` 하나(Hero), 섹션마다 `h2`, 카드마다 `h3`.
- **코드**: `index.html` **보여줄 것**: DevTools Elements 탭에서 구조 훑기.

### 1-2. Flexbox와 Grid의 차이, 언제 무엇을 고르나

- **차이**: Flexbox는 **한 축(행 또는 열)** 에서 항목을 나열·정렬하고 남는 공간을 나눈다(내용 크기에서 출발). Grid는 **행과 열 두 축**의 격자를 먼저 정의하고 항목을 배치한다(레이아웃에서 출발).
- **고르는 기준**: 한 줄·한 방향이면 Flexbox, 표처럼 행과 열을 함께 맞춰야 하면 Grid.

| 적용한 곳 | 선택 | 이유 |
| --- | --- | --- |
| 내비게이션 `.header-inner` | Flexbox (`justify-content: space-between`) | 한 줄에 로고 왼쪽 · 메뉴 오른쪽 (명세 4.3이 지정) |
| Projects 카드 `.projects-grid` | Grid (`repeat(auto-fit, minmax(min(100%, 232px), 1fr))`) | 카드를 행·열로 놓고 폭에 따라 열 수가 바뀌어야 함 |
| 카드 내부 `.project-card` | Flexbox (세로) | 세로 한 축. `margin-top: auto`로 언어·별 줄을 카드 아래로 밀어 높이가 달라도 정렬 |
| Hero·About·Contact 2단 배치 | Grid (`grid-template-columns`, 768px 이상) | 두 열 레이아웃 |

- **`auto-fit` + `minmax`**: 카드 최소 폭(232px)을 지키면서 들어갈 수 있는 만큼 열을 만들고 남는 폭을 `1fr`로 나눈다. 미디어 쿼리 없이 열 수가 **4 → 3 → 2 → 1**로 바뀐다(1440 / 1024 / 768 / 375px 실측).
- **보여줄 것**: 창 폭을 줄이며 카드 열 수 변화, DevTools에서 `display: flex` / `grid` 배지.

### 1-3. `querySelector`로 DOM을 선택하고 `addEventListener`로 연결하는 흐름

1. 페이지를 열 때 `document.querySelector("#theme-toggle")` 등으로 요소를 **한 번만** 찾아 `elements` 객체에 모아 둔다(이벤트마다 다시 찾지 않음).
2. `elements.themeToggle.addEventListener("click", 핸들러)`로 이벤트를 연결한다.
3. 이벤트가 오면 핸들러가 **상태를 바꾼다**.
4. `render*()` 함수가 **DOM을 갱신**한다.

- `querySelector`는 CSS 선택자에 맞는 **첫 요소 하나**, `querySelectorAll`은 **모든 요소(NodeList)** 다. `.reveal` 섹션 전체에 옵저버를 붙이거나 앵커 링크 전체에 클릭 핸들러를 붙일 때 `forEach`로 순회한다.
- `event.preventDefault()`는 **브라우저 기본 동작을 취소**한다. 폼 제출 때 페이지가 새로고침되는 것을 막고 JS로 처리하며, 앵커 클릭 때 즉시 점프하는 대신 부드럽게 스크롤한다.
- 다루는 이벤트: `click`(테마·메뉴·맨 위로·재시도), `submit`(두 폼), `scroll`(`{ passive: true }`), `input`(입력 즉시 검증 피드백).
- **코드**: `js/main.js` 위쪽 `elements`, 아래쪽 이벤트 연결부.

### 1-4. 화살표 함수 · 구조분해 할당 · 배열 메서드 (`map`/`filter`)

| 문법 | 왜 필요한가 | 이 프로젝트의 예 |
| --- | --- | --- |
| 화살표 함수 | 콜백(`map`·`filter`·`forEach`·이벤트 핸들러)을 짧게 쓴다. 자기만의 `this`가 없어 바깥 스코프 값을 그대로 쓴다 | `const renderTheme = () => { … }`, `.filter(({ url }) => Boolean(url))` |
| 구조분해 할당 | 객체·배열에서 필요한 값만 한 번에 꺼낸다. `obj.prop` 반복을 없애고 이름 바꾸기·기본값을 한 줄에 쓴다 | `const { status, repositories, error } = state.projects`, `const { html_url: htmlUrl, stargazers_count: stars } = repository`, `const { name = "" } = values`, `([fieldName, error]) =>` |
| `map` | 각 항목을 **변환**해 같은 길이의 새 배열을 만든다(원본 유지) | 저장소 데이터 → 정규화, 저장소 → 카드 HTML |
| `filter` | 조건을 통과한 항목만 **새 배열**로 | 객체가 아닌 항목·fork·archived·안전하지 않은 링크 제외 |
| `forEach` | 반환값 없이 **순회**하며 동작을 실행 | 옵저버 등록, 폼 필드마다 이벤트 연결 |

- for + `push`보다 "무엇을 하는지"가 드러나고, 원본을 바꾸지 않아 상태 관리에 안전하다.
- **코드**: `js/portfolio_state.js`의 `normaliseRepositories`, `buildProjectCardsMarkup`.

### 1-5. `fetch`와 `async/await`, 로딩·성공·실패 상태를 UI로 표현

`js/main.js`의 `loadProjects`가 흐름이다.

1. 요청 **전에** 상태를 `loading`으로 바꿔 렌더링한다 → "로딩 중..." + 돌아가는 스피너.
2. `try` 안에서 `await fetch(...)` → **`response.ok` 확인** → `await response.json()` → 정제.
3. 결과가 있으면 `success`(카드), 0개면 `empty`("표시할 프로젝트가 없습니다").
4. `catch`로 오면 `error` → "프로젝트를 불러올 수 없습니다." + 원인 안내 + **다시 시도** 버튼.

- **핵심 포인트**: `fetch`는 HTTP 404·403에서도 **reject하지 않는다**(네트워크 자체가 실패할 때만 reject). 그래서 `response.ok`를 직접 검사해 `throw`한다.
- `async/await`를 쓰는 이유: `.then` 체인보다 위에서 아래로 읽히고, `try/catch`로 성공과 실패를 같은 모양으로 다룬다.
- 상태는 `idle` · `loading` · `success` · `empty` · `error` 다섯 개이고 화면에는 항상 하나만 보인다. 원인별 문구는 `projectErrorMessage`(403·429 요청 한도 / 404 사용자 없음 / 형식 오류 / 네트워크).
- **보여줄 것**: DevTools Network 탭을 **Slow 3G**(로딩), **Offline**(에러), 없는 사용자명 입력(404 에러), 공개 저장소가 없는 계정(빈 상태), `octocat`(성공).

### 1-6. 이벤트 → 상태 변경 → DOM 업데이트

다크 모드로 따라간다(`js/main.js`).

1. **이벤트**: `elements.themeToggle.addEventListener("click", …)`
2. **상태 변경**: `state.theme = state.theme === "dark" ? "light" : "dark"` 그리고 `writeStoredTheme(state.theme)`
3. **DOM 업데이트**: `renderTheme()`이 **`state.theme`만 읽고** `data-theme`·`aria-pressed`·버튼 문구를 바꾼다
4. **화면**: CSS의 `[data-theme="dark"]`가 변수 값을 바꾸므로 페이지 전체 색이 한 번에 바뀐다

구현한 흐름은 네 가지다(명세: 3가지 이상).

| 흐름 | 이벤트 | 상태 | 렌더링 |
| --- | --- | --- | --- |
| 다크 모드 | 테마 버튼 `click` | `state.theme` | `renderTheme()` |
| API | 페이지 열기·폼 `submit`·재시도 `click` | `state.projects.status` | `renderProjects()` |
| 폼 | `input`·`submit` | `state.contact.errors` | `renderContact()` |
| 메뉴 | 햄버거 `click` | `state.menuOpen` | `renderMenu()` |

**React와의 연결** (미션 소개가 말하는 "다음 미션의 기초"):

| 이 프로젝트 | React |
| --- | --- |
| `state` 객체 | `useState` 상태 |
| `render*()` 함수 | 컴포넌트가 반환하는 화면(JSX) |
| `addEventListener("click", …)` | `onClick` |
| `state.projects = { ...state.projects, … }` (새 객체로 교체) | 상태를 직접 바꾸지 않고 새 값으로 교체 |
| `AbortController` + `requestId` | effect 정리(cleanup) |

## 2. 동료 평가 질문 15개

### 2-1. 기능 동작 검증 (5) — 이렇게 보여 준다

| 질문 | 시연 방법 |
| --- | --- |
| 창 폭을 줄이면 모바일 레이아웃으로 바뀌나 | DevTools 반응형 모드에서 1440 → 1024 → 768 → 375px. 767px 이하에서 메뉴가 사라지고 햄버거가 나타남, 카드 열 수 4 → 3 → 2 → 1 |
| 테마 전환과 새로고침 후 유지 | 테마 버튼 → 새로고침. Application 탭 → Local Storage → `portfolio-theme` 값이 `dark`인 것을 함께 보여 줌 |
| 햄버거·스크롤 애니메이션·맨 위로 버튼 | 375px에서 햄버거 열기/닫기. 스크롤하면 60px부터 헤더 배경이 바뀌고 300px부터 맨 위로 버튼이 나타남. 아래 섹션이 스크롤할 때 나타남 |
| API 로딩·에러·빈 상태가 구분되나 | [1-5](#1-5-fetch와-asyncawait-로딩성공실패-상태를-ui로-표현)의 시연 목록 |
| 필수값 누락·이메일 형식 오류 즉각 피드백 | 빈 채로 제출 → 필드별 오류. `abc` 입력 → 이메일 형식 오류. 입력을 시작하면 그 필드의 오류가 바로 사라짐 |

### 2-2. 코드 구조와 설계 (4)

**HTML·CSS·JS를 나눈 이유와 각 파일의 역할**

- `index.html`: 문서의 **구조와 의미**. 화면에 무엇이 있는지.
- `css/style.css`: **표현**. 색·배치·반응형·애니메이션. HTML을 건드리지 않고 모양을 바꿀 수 있다.
- `js/main.js`: **동작**. DOM 선택, 이벤트 연결, 화면 다시 그리기.
- `js/portfolio_state.js`: 화면과 무관한 **판단 로직**(검증·응답 정제·오류 문구). 브라우저 없이 테스트할 수 있어 따로 뺐다.

**시맨틱 태그를 고른 기준** → [1-1](#1-1-시맨틱-태그를-왜-쓰고-어떤-기준으로-구조를-설계했나)

**CSS 변수(`:root`)의 이점**: 색·간격을 한곳에서 관리하므로 한 줄을 고치면 전체가 바뀐다. 다크 모드는 `[data-theme="dark"]`에서 **같은 변수의 값만** 다시 정의하면 되어 컴포넌트 규칙을 다시 쓰지 않는다. 값이 코드 여기저기 복사되어 흩어지는 것도 막는다.

**`onclick` 대신 `addEventListener`를 쓴 이유**

| | `onclick="..."` 속성 | `addEventListener` |
| --- | --- | --- |
| 구조와 동작 | HTML에 JS가 섞임 | HTML은 구조, JS는 동작으로 분리 |
| 핸들러 수 | 하나(다시 지정하면 덮어씀) | 여러 개 등록 가능 |
| 옵션 | 없음 | `{ passive: true }`(스크롤 성능), `{ once: true }` 등 |
| 제거·테스트 | 어려움 | `removeEventListener`, 테스트에서 이벤트를 직접 발생 |

이 프로젝트의 스크롤 핸들러는 `{ passive: true }`를 써서 스크롤이 막히지 않게 했다(`main.js` 아래쪽).

### 2-3. 핵심 기술 원리 적용 (4)

- **이벤트 → 상태 → 화면 흐름을 코드에서 따라가기** → [1-6](#1-6-이벤트--상태-변경--dom-업데이트) (다크 모드 4단계)
- **`async/await`·`try/catch`로 성공과 실패를 나눈 흐름** → [1-5](#1-5-fetch와-asyncawait-로딩성공실패-상태를-ui로-표현)
- **`map`·`filter`로 GitHub 데이터를 카드로 바꾸는 단계** (`portfolio_state.js`)
  1. `filter`: 객체가 아닌 항목 제거
  2. `filter`: `fork`와 `archived` 제외
  3. `map`: `name`·`description`·`html_url`·`stargazers_count`·`language`만 골라 기본값과 함께 정규화(구조분해 할당)
  4. `filter`: `https://github.com` 링크가 아닌 항목 제외
  5. `map`: 각 저장소를 `<article class="project-card">…</article>` 문자열로(템플릿 리터럴, HTML 이스케이프)
  6. `join("")`한 문자열을 `innerHTML`에 넣음
- **Flexbox와 Grid를 어디에 왜 썼나** → [1-2](#1-2-flexbox와-grid의-차이-언제-무엇을-고르나)

### 2-4. 심층 인터뷰 (2)

**상태(STATE) 객체를 따로 만든 이유 — 그냥 변수로 두면 안 되나?**

변수가 여기저기 흩어져 있으면 "지금 화면이 왜 이런지"를 알려면 코드 전체를 뒤져야 한다. 상태를 한 객체에 모으면 (1) `render*` 함수가 그 객체만 읽으면 화면이 결정되고, (2) 상태를 넣어 놓고 결과 화면을 확인하는 **테스트**를 쓸 수 있고(`tests/test_main_dom.mjs`), (3) 요청 번호(`requestId`)처럼 여러 곳이 공유하는 값이 한 곳에서 관리된다. React의 `state`가 바로 이 생각을 라이브러리로 만든 것이다.

**모바일 퍼스트로 작성한 이유**

기본 CSS를 가장 단순한 한 열 레이아웃으로 쓰고, 화면이 넓어질 때만 `min-width` 쿼리(768px, 1024px)로 **추가**한다. 좁은 화면에서 덮어써서 되돌릴 규칙이 줄어 CSS가 짧아지고, 성능이 낮은 모바일이 불필요한 규칙을 처리하지 않으며, 모바일을 놓치는 실수가 줄어든다. 이 프로젝트에는 `max-width` 미디어 쿼리가 하나도 없다(`tests/test_static_contract.py`가 확인).

## 3. README에 명시한 기준값 (§4.5)

명세는 "기준값은 자유롭게 바꿔도 되지만 **README에 명시**"하라고 했다. README의 "주요 기능과 기준값" 표에 있다.

| 기능 | 값 | 설명할 것 |
| --- | ---: | --- |
| 맨 위로 버튼 노출 | 300px 이상 | 명세 예시와 같은 값. 첫 화면을 가리지 않고 충분히 내려간 뒤 나타남 |
| 헤더 배경 변경 | 60px 이상 | 명세 예시와 같은 값. 조금만 내려가도 메뉴 경계가 구분됨 |
| `IntersectionObserver` threshold | 0.25 | 권장 범위(0.2 이상) 안. 요소가 **25% 보일 때** 한 번 나타남 |

`threshold`는 "요소가 화면과 몇 퍼센트 겹칠 때 콜백을 부를지"(0~1)다. 너무 낮으면(0) 한 픽셀만 보여도 실행되어 애니메이션을 못 보고, 너무 높으면(1) 큰 섹션은 화면에 다 들어오지 못해 영영 나타나지 않을 수 있다. 한 번 나타난 요소는 `unobserve`로 관찰을 끝낸다.

## 4. 제출물 (§7)

| 항목 | 상태 |
| --- | --- |
| GitHub 저장소 URL | 완료 — <https://github.com/codyssey0/B1-1_portfolio-web> |
| 배포된 사이트 URL (GitHub Pages) | **미완** — Pages 설정을 켜야 열린다([제출 안내](submission.md)) |
| 데스크톱·모바일·다크 모드 스크린샷 | 완료 — `docs/screenshots/` |
| README의 프로젝트 설명·사용 기술·배포 URL·스크린샷 | 완료 |

## 5. 추가로 나올 수 있는 질문 (명세에는 없음)

- **왜 `innerHTML`에 넣기 전에 이스케이프하나** — GitHub 응답은 외부 입력이라 `<script>` 같은 문자열이 들어오면 그대로 실행된다. `escapeHtml`로 화면용 문자로 바꾸고, 링크는 `https://github.com`만 허용하며 `rel="noopener noreferrer"`를 붙인다.
- **레이트 리밋은 어떻게 처리했나** — 인증 없이 시간당 60회다. 403·429면 에러 상태와 재시도 버튼을 보여 준다.
- **오래된 요청이 화면을 덮는 문제** — `AbortController`로 이전 요청을 취소하고, `requestId`가 달라진 응답은 화면을 바꾸지 않는다(`tests/test_main_dom.mjs` 7·8번).
- **`localStorage`의 특징** — 문자열만 저장, 동기 방식, 도메인별로 분리, 용량 제한이 있다. 접근이 막힌 환경에서도 테마 전환이 되도록 읽기·쓰기를 `try/catch`로 감쌌다.
- **접근성** — `label for`, `aria-live`(상태 문구), `aria-expanded`(메뉴), skip link, `:focus-visible`, `prefers-reduced-motion`.
- **왜 ES 모듈인가** — 판단 로직을 파일로 나눠 테스트하려고. 대신 `index.html`을 `file://`로 열면 Chrome이 모듈을 막아 JS 기능이 동작하지 않는다. Live Server나 배포 주소로 열어야 한다.
- **테스트는 어떻게 했나** — 순수 로직(`state`), 가짜 DOM(`dom`), 정적 계약(`static`), 실제 Chrome(`e2e`) 네 겹이다. 실제 Chrome 검사에서만 드러난 결함이 있었다 — 보이지 않는 맨 위로 버튼이 Tab 순서에 남는 문제([명세 대응표](requirements-traceability.md)의 7번).

## 6. 5분 시연 순서

1. 배포 주소(또는 Live Server)를 연다 → Projects가 "로딩 중..." 뒤에 카드로 바뀌는 것을 보여 준다.
2. 테마 전환 → 새로고침 → Local Storage 값을 보여 준다.
3. DevTools 반응형 모드로 1440 → 768 → 375px, 햄버거 메뉴, 카드 열 수를 보여 준다.
4. 스크롤해서 헤더 변화(60px), 맨 위로 버튼(300px), 섹션 등장 효과를 보여 준다.
5. 사용자명 입력창에 `octocat`(성공), 없는 이름(에러 + 다시 시도)을 입력한다.
6. Contact 폼을 빈 채로 제출 → 잘못된 이메일 → 정상 입력을 차례로 보여 준다.
7. `main.js`에서 다크 모드 하나를 골라 이벤트 → 상태 → 렌더링을 따라가며 설명한다([1-6](#1-6-이벤트--상태-변경--dom-업데이트)).
