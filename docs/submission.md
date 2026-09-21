# 제출 안내

## 제출물

| 항목 | 값 | 상태 |
| --- | --- | --- |
| GitHub 저장소 URL | <https://github.com/Minkyu01/B1-1_portfolio-web> | 공개 저장소, `main`과 `gh-pages`. 조직 `codyssey0`에서 `Minkyu01` 계정으로 옮김 (2026-09-19) |
| 배포된 사이트 URL (GitHub Pages) | <https://minkyu01.github.io/B1-1_portfolio-web/> | **내림** — 평가 종료 후 2026-09-21에 `gh-pages` 브랜치를 삭제해 사이트를 내렸다. 지금은 열리지 않는다 |
| 데스크톱 스크린샷 | [`docs/screenshots/desktop.png`](screenshots/desktop.png) | 완료 |
| 모바일 스크린샷 | [`docs/screenshots/mobile.png`](screenshots/mobile.png), [메뉴 열림](screenshots/mobile-menu.png) | 완료 |
| 다크 모드 스크린샷 | [`docs/screenshots/dark-mode.png`](screenshots/dark-mode.png) | 완료 |
| README(소개·사용 기술·배포 URL·스크린샷) | [`README.md`](../README.md) | 완료 |

스크린샷은 `node tests/e2e_browser.mjs --live --screenshots`로 만든 실제 화면이다. Projects 카드는 사용자명 입력창에 `octocat`을 넣은 실제 GitHub API 결과다.

## 배포 기록

아래 첫 세 줄은 저장소가 조직 `codyssey0`에 있던 때의 기록이다(주소 `https://codyssey0.github.io/B1-1_portfolio-web/`). 그 뒤 저장소를 `Minkyu01` 계정으로 옮겨 주소가 바뀌었고, 새 주소에서의 검증은 표의 뒷부분에 적는다.

| 날짜 | 한 일 | 결과 |
| --- | --- | --- |
| 2026-09-19 | `git push origin main:gh-pages` | GitHub가 Pages를 자동으로 켜고 빌드했다. 약 30초 뒤 배포 주소가 HTTP 200으로 열림 |
| 2026-09-19 | `node tests/e2e_browser.mjs --url=<배포 주소>` | 59/59 통과 (GitHub API는 모의 응답) |
| 2026-09-19 | `node tests/e2e_browser.mjs --live --url=<배포 주소> --only='실제 GitHub'` | 2/2 통과. 기본 계정 `codyssey0`은 저장소 카드 1개(`B1-1_portfolio-web`), `octocat`은 실제 카드가 렌더링됨. 콘솔 에러 없음 |
| 2026-09-19 | 저장소를 `Minkyu01` 계정으로 옮김(Transfer), `origin`을 바꾸고 `git push origin main` + `git push origin main:gh-pages` | 새 주소 `https://minkyu01.github.io/B1-1_portfolio-web/`가 약 30초 만에 HTTP 200으로 열림(Pages 설정은 그대로 따라옴). 옛 `codyssey0.github.io` 주소는 새 주소로 넘어가지 않는다 |
| 2026-09-19 | `node tests/e2e_browser.mjs --url=<새 배포 주소>` | 59/59 통과 (GitHub API는 모의 응답) |
| 2026-09-19 | `node tests/e2e_browser.mjs --live --url=<새 배포 주소> --only='실제 GitHub'` | 2/2 통과. 기본 계정 `Minkyu01`은 공개 저장소 카드 9개가 렌더링되고 콘솔 에러 없음, `octocat`도 실제 카드가 렌더링됨 |
| 2026-09-21 | `git push origin --delete gh-pages` | 평가 종료 후 Pages 원본 브랜치를 삭제했다. 원본 서버는 곧바로 404(캐시를 피한 요청으로 확인)이고 API의 `has_pages`도 false다. CDN 캐시만 약 10분 남는다 |

## 배포와 갱신 방법

사이트는 지금 내려가 있다(2026-09-21). 다시 올릴 때 아래 절차를 쓴다.

1. 코드를 고치고 `main`에 커밋한다.
2. 배포 브랜치를 갱신한다. `gh-pages`는 `main`의 사본이므로 이 단계를 잊으면 사이트는 예전 그대로다.

```bash
git push origin main:gh-pages
```

3. 1분쯤 뒤 배포 주소에서 확인하고 같은 기준으로 검사한다.

```bash
node tests/e2e_browser.mjs --url=https://minkyu01.github.io/B1-1_portfolio-web/
```

브랜치를 하나로 줄이려면 저장소 **Settings → Pages**에서 **Source: Deploy from a branch**, **Branch: `main` / `(root)`**로 바꾸고 `gh-pages`를 지운다.

## 제출 전 최종 확인

```bash
npm run check
npm run start
```

그 뒤 브라우저에서 375px, 768px, 1280px 이상을 확인한다. GitHub API는 인증 없이 호출하므로 시간당 60회 제한이 있어, 과도한 반복 새로고침 없이 필요한 만큼만 시험한다.
