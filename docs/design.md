# 설계 문서

## 설계 목표

한 페이지 안에서 시맨틱 HTML, 반응형 CSS, 브라우저 이벤트와 비동기 상태 처리를 연결한다. 정적 안내 화면을 만드는 데 그치지 않고, 각 기능이 상태를 바꾸고 그 상태가 화면을 다시 그리도록 분리했다.

## 화면 구조

`index.html`은 다음 랜드마크로 구성한다.

- `header`와 `nav`: 브랜드, 테마 토글, 모바일 메뉴, 섹션 앵커
- `main`: Hero, About, Skills, Projects, Contact 섹션
- `article`: About 소개와 API로 생성하는 각 프로젝트 카드
- `footer`: 저작권과 GitHub 프로필·저장소 링크

프로필 이미지는 로컬 SVG를 사용하고, 모든 이미지에는 구체적인 `alt`를 둔다. 폼 label의 `for`와 control `id`를 대응시키고 오류/성공 메시지에는 `aria-live`를 사용한다.

모바일 navigation은 JavaScript가 없는 경우에도 기본으로 보인다. 스크립트가 준비되면 `js-enabled` 클래스가 붙으며 햄버거 메뉴로 전환한다. 맨 위로 버튼은 `opacity`·`pointer-events`와 함께 `visibility: hidden`으로 숨겨, 보이지 않을 때 키보드 Tab 순서에서도 빠진다. `hidden` 속성은 `.scroll-top`의 `display: inline-flex`가 덮어써서 쓰지 않는다. 앵커 대상에는 sticky header 높이만큼 `scroll-margin-top`을 둔다.

## 레이아웃과 디자인 토큰

`css/style.css`의 `:root`에는 색상, 간격, radius, 그림자, typography token을 둔다. `[data-theme="dark"]`에서는 같은 token의 값만 바꿔 테마 전환 시 컴포넌트 규칙을 다시 쓰지 않는다.

- 모바일: 메뉴를 감추고 44px 이상의 햄버거·테마 조작부를 제공한다.
- 768px: 메뉴를 Flex nav로 전환하고 About/Contact를 2열로 배치한다.
- 1024px: 컨테이너 폭과 skill grid 열 수를 확장한다.
- Projects: `repeat(auto-fit, minmax(...))` Grid로 카드가 가능한 폭에 맞춰 재배치된다.

모든 규칙은 기본값을 모바일로 쓰고 `min-width` 미디어 쿼리로만 넓힌다(모바일 우선). 키보드 focus-visible, reduced-motion, skip link를 포함해 첫 화면에서도 핵심 탐색과 입력이 가능하도록 했다.

## 상태 모델

`js/portfolio_state.js`가 testable한 순수 로직을 갖고, `js/main.js`가 DOM 렌더링과 이벤트를 담당한다.

```text
state
├── theme: light | dark
├── menuOpen: boolean
├── projects: status, username, repositories, error, requestId
└── contact: errors, success
```

| 사용자 행동 | 바뀌는 상태 | 렌더 결과 |
| --- | --- | --- |
| 페이지 열기 | `projects.status` | loading, 그리고 카드 / empty / 오류+retry |
| 테마 클릭 | `theme` | `data-theme`, aria label, localStorage |
| 메뉴 클릭 | `menuOpen` | `active`, `aria-expanded`, 메뉴 보이기/숨기기 |
| GitHub 제출·재시도 | `projects.status` | loading, 카드, empty, 오류+retry |
| Contact 입력·제출 | `contact.errors`, `success` | 필드 근처 오류 또는 성공 메시지 |

새 API 요청 또는 잘못된 재제출은 `requestId`를 항상 전진시키고 진행 중인 `AbortController`를 취소한다. 그래서 이전 응답은 화면을 덮지 못하고 불필요한 중복 요청도 줄어든다.

## GitHub API 처리

API 요청은 페이지를 열 때 기본 계정(`DEFAULT_GITHUB_USERNAME`)으로 한 번, 그 뒤에는 사용자명 제출이나 재시도 버튼 클릭 때만 발생한다. response가 성공이면 fork/archived 저장소를 제외하고 필요한 필드만 정규화한다. 배열이 아닌 response는 empty가 아니라 error 상태로 처리한다. 카드 markup에 삽입하는 문자열은 escape하며, 저장소 링크도 `https://github.com`인지 확인한다.

에러 문구는 원인과 관계없이 "프로젝트를 불러올 수 없습니다."로 시작하고 뒤에 원인별 안내가 붙는다. HTTP 403·429는 요청 한도/제한 안내, 404는 사용자명 안내, 형식 오류는 응답 형식 안내, 그 밖의 실패는 네트워크 안내이며 모두 재시도 버튼이 함께 보인다.

`loading → success`, `loading → empty`, `loading → error`가 각각 별도의 UI 상태다. 로딩은 "로딩 중..." 문구와 CSS `::before` 스피너로 표현한다. 테스트는 순수 정규화·markup·오류 함수와 dependency-free DOM harness로 mocked success/empty/error/retry·요청 취소 경합을 확인하고, 실제 브라우저 테스트에서는 네트워크 계층에서 GitHub 응답을 가로채므로 실제 API 호출을 반복하지 않는다.

## 기준값

| 기능 | 값 | 이유 |
| --- | ---: | --- |
| 스크롤 탑 노출 | 300px | 명세 예시와 같은 값. Hero를 지난 뒤에만 보이게 해 첫 화면을 방해하지 않음 |
| 헤더 배경 변경 | 60px | 명세 예시와 같은 값. 짧은 이동 후 경계를 보여 줌 |
| reveal observer | 0.25 | 권장값(0.2 이상) 안. 요소 25%가 보일 때 과하지 않게 나타남 |

## 검증 방법

| 위험 | 막는 검사 |
| --- | --- |
| 판단 로직(검증·정제·문구) 회귀 | `tests/test_state.mjs` |
| 이벤트 → 상태 → 렌더링 연결 끊김, 요청 경합 | `tests/test_main_dom.mjs` |
| 명세가 요구한 마크업·CSS·문구·문서 항목 누락 | `tests/test_static_contract.py` |
| 실제 브라우저에서만 드러나는 결함(CSS 우선순위, 레이아웃, 전환, 스크롤) | `tests/e2e_browser.mjs` |

맨 위로 버튼의 `hidden` 결함은 앞의 세 검사를 모두 통과했지만 실제 Chrome에서 계산된 스타일을 확인한 e2e에서만 드러났다.
