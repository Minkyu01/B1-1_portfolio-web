# 제출 안내

## 제출물

| 항목 | 값 | 상태 |
| --- | --- | --- |
| GitHub 저장소 URL | <https://github.com/codyssey0/B1-1_portfolio-web> | 업로드 완료 — 공개 저장소, `main` (2026-09-19) |
| 배포된 사이트 URL (GitHub Pages) | <https://codyssey0.github.io/B1-1_portfolio-web/> | **Pages 설정 전** — 2026-09-19 접속 시 404. Settings → Pages를 켜야 열림 |
| 데스크톱 스크린샷 | [`docs/screenshots/desktop.png`](screenshots/desktop.png) | 완료 |
| 모바일 스크린샷 | [`docs/screenshots/mobile.png`](screenshots/mobile.png), [메뉴 열림](screenshots/mobile-menu.png) | 완료 |
| 다크 모드 스크린샷 | [`docs/screenshots/dark-mode.png`](screenshots/dark-mode.png) | 완료 |
| README(소개·사용 기술·배포 URL·스크린샷) | [`README.md`](../README.md) | 완료 |

스크린샷은 `node tests/e2e_browser.mjs --live --screenshots`로 만든 실제 화면이다. Projects 카드는 사용자명 입력창에 `octocat`을 넣은 실제 GitHub API 결과다.

## 배포 절차

1. `main` 브랜치에 파일을 올린다.
2. 저장소 **Settings → Pages**에서 **Source: Deploy from a branch**, **Branch: `main` / `(root)`**를 선택하고 저장한다.
3. 1~2분 뒤 배포 주소에서 메뉴, 테마, 스크롤, 폼, API 상태를 한 번씩 확인한다.
4. 배포 주소를 같은 기준으로 검사한다.

```bash
node tests/e2e_browser.mjs --url=https://codyssey0.github.io/B1-1_portfolio-web/
```

## Pages를 켠 뒤 할 일

1. 배포 주소가 열리는지 확인한다(켠 뒤 1~2분).
2. 같은 기준으로 검사한다. 통과하면 59개 검사가 모두 ✓로 나온다.

```bash
node tests/e2e_browser.mjs --url=https://codyssey0.github.io/B1-1_portfolio-web/
node tests/e2e_browser.mjs --live --url=https://codyssey0.github.io/B1-1_portfolio-web/ --only='실제 GitHub'
```

3. 위 표의 "배포된 사이트 URL" 상태를 실제 확인 결과로 바꾸고, README의 "배포 상태" 문구도 함께 고친다.

## 제출 전 최종 확인

```bash
npm run check
npm run start
```

그 뒤 브라우저에서 375px, 768px, 1280px 이상을 확인한다. GitHub API는 인증 없이 호출하므로 시간당 60회 제한이 있어, 과도한 반복 새로고침 없이 필요한 만큼만 시험한다.
