# 제출 안내

## 제출물

| 항목 | 값 | 상태 |
| --- | --- | --- |
| GitHub 저장소 URL | <https://github.com/codyssey0/B1-1_portfolio-web> | 업로드 완료 — 공개 저장소, `main`과 `gh-pages` (2026-09-19) |
| 배포된 사이트 URL (GitHub Pages) | <https://codyssey0.github.io/B1-1_portfolio-web/> | **배포 완료** — `gh-pages` 브랜치에서 서비스 중, 아래 검증 통과 (2026-09-19) |
| 데스크톱 스크린샷 | [`docs/screenshots/desktop.png`](screenshots/desktop.png) | 완료 |
| 모바일 스크린샷 | [`docs/screenshots/mobile.png`](screenshots/mobile.png), [메뉴 열림](screenshots/mobile-menu.png) | 완료 |
| 다크 모드 스크린샷 | [`docs/screenshots/dark-mode.png`](screenshots/dark-mode.png) | 완료 |
| README(소개·사용 기술·배포 URL·스크린샷) | [`README.md`](../README.md) | 완료 |

스크린샷은 `node tests/e2e_browser.mjs --live --screenshots`로 만든 실제 화면이다. Projects 카드는 사용자명 입력창에 `octocat`을 넣은 실제 GitHub API 결과다.

## 배포 기록

| 날짜 | 한 일 | 결과 |
| --- | --- | --- |
| 2026-09-19 | `git push origin main:gh-pages` | GitHub가 Pages를 자동으로 켜고 빌드했다. 약 30초 뒤 배포 주소가 HTTP 200으로 열림 |
| 2026-09-19 | `node tests/e2e_browser.mjs --url=<배포 주소>` | 59/59 통과 (GitHub API는 모의 응답) |
| 2026-09-19 | `node tests/e2e_browser.mjs --live --url=<배포 주소> --only='실제 GitHub'` | 2/2 통과. 기본 계정 `codyssey0`은 저장소 카드 1개(`B1-1_portfolio-web`), `octocat`은 실제 카드가 렌더링됨. 콘솔 에러 없음 |

## 배포와 갱신 방법

1. 코드를 고치고 `main`에 커밋한다.
2. 배포 브랜치를 갱신한다. `gh-pages`는 `main`의 사본이므로 이 단계를 잊으면 사이트는 예전 그대로다.

```bash
git push origin main:gh-pages
```

3. 1분쯤 뒤 배포 주소에서 확인하고 같은 기준으로 검사한다.

```bash
node tests/e2e_browser.mjs --url=https://codyssey0.github.io/B1-1_portfolio-web/
```

브랜치를 하나로 줄이려면 저장소 **Settings → Pages**에서 **Source: Deploy from a branch**, **Branch: `main` / `(root)`**로 바꾸고 `gh-pages`를 지운다.

## 제출 전 최종 확인

```bash
npm run check
npm run start
```

그 뒤 브라우저에서 375px, 768px, 1280px 이상을 확인한다. GitHub API는 인증 없이 호출하므로 시간당 60회 제한이 있어, 과도한 반복 새로고침 없이 필요한 만큼만 시험한다.
