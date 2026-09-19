# 동료 평가 대비

미션 페이지의 동료 평가 질문 주제(기능 동작, 코드 구조, 핵심 원리, 심층 질문)마다 **시연 방법**과 **설명할 내용**을 코드 위치와 함께 적었다. 발표할 때 이 문서를 열어 두고 코드를 따라가면 된다.

## 1. 기능 동작 검증 — 이렇게 보여 준다

| 확인 항목 | 시연 방법 |
| --- | --- |
| 창 폭을 줄이면 모바일 레이아웃 | DevTools 반응형 모드에서 1440 → 1024 → 768 → 375px. 767px 이하에서 메뉴가 사라지고 햄버거가 나타남, 카드 열 수가 4 → 3 → 2 → 1로 바뀜(실측) |
| 다크/라이트 전환과 새로고침 유지 | 테마 버튼 클릭 → 새로고침. Application 탭 → Local Storage → `portfolio-theme` 값이 `dark`인 것을 함께 보여 줌 |
| 햄버거·스크롤 애니메이션·맨 위로 버튼 | 375px에서 햄버거 열기/닫기. 스크롤하면 60px부터 헤더 배경이 바뀌고 300px부터 맨 위로 버튼이 나타남. 아래 섹션이 스크롤할 때 나타남 |
| API 로딩·성공·에러·빈 상태 | 성공: 페이지를 열면 자동 로드 / 다른 계정: 입력창에 `octocat` / 에러: Network 탭을 **Offline**으로 두고 다시 시도, 또는 없는 사용자명 입력(404) / 빈 상태: 공개 저장소가 없는 계정 입력. 로딩은 Network 탭 **Slow 3G**로 보임 |
| 폼 즉각 피드백 | 빈 채로 제출 → 필드별 오류. `abc` 입력 → 이메일 형식 오류. 입력을 시작하면 그 필드의 오류가 바로 사라짐 |

## 2. 코드 구조와 설계

**HTML·CSS·JS를 나눈 이유와 각 파일의 역할**

- `index.html`: 문서의 **구조와 의미**. 화면에 무엇이 있는지.
- `css/style.css`: **표현**. 색·배치·반응형·애니메이션. HTML을 건드리지 않고 모양을 바꿀 수 있음.
- `js/main.js`: **동작**. DOM 선택, 이벤트 연결, 화면 다시 그리기.
- `js/portfolio_state.js`: 화면과 무관한 **판단 로직**(검증, 응답 정제, 오류 문구). 브라우저 없이 테스트할 수 있어서 따로 뺐다.

**시맨틱 태그를 고른 기준**: "이 덩어리가 무엇인가"로 골랐다. 사이트 머리 `header`, 이동 링크 묶음 `nav`, 페이지의 핵심 `main`, 주제별 덩어리 `section`(제목이 있음), 혼자 떼어 놓아도 뜻이 통하는 카드·소개글 `article`, 맨 아래 `footer`. `div`는 의미 없이 묶기만 할 때 쓴다. 이점은 화면 읽기 도구·검색 엔진이 구조를 이해하고, 코드를 읽는 사람도 태그만 보고 역할을 안다는 것.

**CSS 변수(`:root`)의 이점**: 색·간격을 한곳에서 관리하므로 한 줄을 고치면 전체가 바뀐다. 다크 모드는 `[data-theme="dark"]`에서 **같은 변수의 값만** 다시 정의하면 되어 컴포넌트 규칙을 다시 쓰지 않는다.

**`onclick` 대신 `addEventListener`를 쓴 이유**

| | `onclick="..."` 속성 | `addEventListener` |
| --- | --- | --- |
| 구조와 동작 | HTML에 JS가 섞임 | HTML은 구조, JS는 동작으로 분리 |
| 핸들러 수 | 하나(다시 지정하면 덮어씀) | 여러 개 등록 가능 |
| 옵션 | 없음 | `{ passive: true }`(스크롤 성능), `{ once: true }` 등 |
| 제거·테스트 | 어려움 | `removeEventListener`, 테스트에서 이벤트를 직접 발생 |

이 프로젝트의 스크롤 핸들러는 `{ passive: true }`를 써서 스크롤이 막히지 않게 했다(`main.js` 하단).

## 3. 핵심 기술 원리

**"이벤트 → 상태 변경 → 화면 업데이트"를 다크 모드로 따라가기** (`js/main.js`)

1. 이벤트: `elements.themeToggle.addEventListener("click", …)`
2. 상태 변경: `state.theme = state.theme === "dark" ? "light" : "dark"` 그리고 `writeStoredTheme(state.theme)`
3. 화면 업데이트: `renderTheme()`이 `state.theme`만 읽어 `documentElement.dataset.theme`, `aria-pressed`, 버튼 문구를 바꿈
4. CSS: `[data-theme="dark"]`가 변수 값을 바꾸므로 페이지 전체 색이 한 번에 바뀜

상태를 바꾸는 곳과 화면을 그리는 곳이 나뉘어 있어서 `render*` 함수는 "지금 상태가 이러니 화면은 이렇다"만 책임진다.

**`async/await`와 `try/catch`로 성공·실패를 나눈 흐름** (`loadProjects`)

- `try` 안: `await fetch(...)` → `response.ok`가 아니면 `error.status`를 붙여 `throw` → `await response.json()` → `normaliseRepositories`(배열이 아니면 `INVALID_PROJECT_PAYLOAD`를 `throw`) → 결과가 있으면 `success`, 없으면 `empty`.
- `catch`: 취소(`AbortError`)나 오래된 요청이면 무시, 나머지는 `projectErrorMessage(error)`로 문구를 만들어 `error` 상태로.
- 요청 시작 전에 `loading` 상태를 먼저 렌더링하고, 마지막에 결과 상태를 렌더링한다. 그래서 화면에는 항상 다섯 상태(`idle`·`loading`·`success`·`empty`·`error`) 중 하나만 보인다.

**`map`·`filter`로 GitHub 데이터를 카드로 바꾸는 단계** (`portfolio_state.js`)

1. `filter`: 객체가 아닌 항목 제거
2. `filter`: `fork`와 `archived` 제외
3. `map`: `name`·`description`·`html_url`·`stargazers_count`·`language`만 골라 기본값과 함께 정규화 (구조분해 할당)
4. `filter`: `https://github.com` 링크가 아닌 항목 제외
5. `map`: 각 저장소를 `<article class="project-card">…</article>` 문자열로(템플릿 리터럴, HTML 이스케이프)
6. `join("")`한 문자열을 `innerHTML`에 넣음

**Flexbox와 Grid를 어디에 왜 썼나**

- 내비게이션(`.header-inner`, `.primary-navigation`): 한 줄에 로고·메뉴·버튼을 **한 방향**으로 나열하고 남는 공간을 나누는 일 → Flexbox.
- Projects 카드(`.projects-grid`): 카드 여러 개를 **행과 열 두 방향**으로 배치하고, 폭에 따라 열 수가 바뀌어야 함 → Grid의 `repeat(auto-fit, minmax(…))`.
- 기준: 한 줄(축 하나)이면 Flexbox, 표처럼 행·열을 함께 다루면 Grid.

## 4. 심층 질문

**상태(STATE) 객체를 따로 만든 이유 — 그냥 변수로 두면 안 되나?**

변수가 여기저기 흩어져 있으면 "지금 화면이 왜 이런지"를 알려면 코드 전체를 뒤져야 한다. 상태를 한 객체에 모으면 (1) `render*` 함수가 그 객체만 읽으면 화면이 결정되고, (2) 상태만 바꿔 넣고 결과 화면을 확인하는 **테스트**를 쓸 수 있고(`test_main_dom.mjs`), (3) 요청 번호(`requestId`)처럼 여러 곳에서 공유하는 값이 하나로 관리된다. React의 `state`가 바로 이 생각을 라이브러리로 만든 것이다.

**모바일 퍼스트로 작성한 이유**

기본 CSS를 가장 단순한 한 열 레이아웃으로 쓰고, 화면이 넓어질 때만 `min-width` 쿼리(768px, 1024px)로 **추가**한다. 좁은 화면에서 덮어써서 되돌릴 규칙이 줄어 CSS가 짧아지고, 성능이 낮은 모바일이 불필요한 규칙을 처리하지 않으며, 모바일을 놓치는 실수가 줄어든다. 이 프로젝트에는 `max-width` 쿼리가 하나도 없다(`test_static_contract.py`가 확인).

**오래된 요청 문제는 어떻게 막았나**

A를 요청한 직후 B를 요청하면 A 응답이 늦게 도착해 B 화면을 덮을 수 있다. `AbortController`로 A 요청을 취소하고, `requestId`가 달라진 응답은 화면을 바꾸지 않는 이중 장치를 뒀다(`test_main_dom.mjs`의 7·8번).

**테스트를 어떻게 했나**

순수 로직(`state`), 가짜 DOM(`dom`), 정적 계약(`static`), 실제 Chrome(`e2e`) 네 겹이다. 실제 Chrome 검사에서만 드러난 결함이 있었다 — 보이지 않는 맨 위로 버튼이 Tab 순서에 남는 문제([명세 대응표](requirements-traceability.md)의 7번).
