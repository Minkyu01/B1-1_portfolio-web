#!/usr/bin/env bash
set -euo pipefail

TASK_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$TASK_DIR"

node --check js/portfolio_state.js
node --check js/main.js
node --check tests/cdp_helper.mjs
node --check tests/e2e_browser.mjs
node tests/test_state.mjs
node tests/test_main_dom.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -B tests/test_static_contract.py
# 실제 Chrome 종단 테스트(Chrome이 없으면 건너뜀). GitHub API는 모의 응답을 쓴다.
node tests/e2e_browser.mjs

echo "all portfolio tests passed"
