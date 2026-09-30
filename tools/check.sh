#!/usr/bin/env bash
#
# Guards against two mistakes that are easy to make and expensive to notice:
#
# 1. The product is "AutiPlanner" and the package scope is "@autiplanner".
#    "autoplanner" is a different word and has shipped into a URL, a uid and a
#    package import before.
# 2. An unanchored `data/` in .gitignore matches a directory named `data` at any
#    depth, which silently excluded a whole source package from the repository.
set -euo pipefail

status=0

typos="$(
  grep -rIn "autoplanner" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    --include='*.json' --include='*.py' --include='*.md' --include='*.yaml' \
    --include='*.yml' --include='*.html' --include='*.css' --include='*.sh' \
    . 2>/dev/null | grep -vE '/(node_modules|dist|\.git)/' | grep -v 'tools/check.sh' || true
)"
if [ -n "$typos" ]; then
  echo "ERROR: 'autoplanner' should be 'autiplanner':"
  echo "$typos" | sed 's/^/  /'
  status=1
fi

SOURCE_PATTERN='\.(kt|kts|java|py|ts|tsx|js|jsx|mjs|md|json|ya?ml|xml|html|css)$'
ARTIFACT_PATTERN='(^|/)(node_modules|build|dist|coverage|__pycache__|\.gradle|\.pytest_cache|\.pnpm-store|\.idea|\.vscode|venv|\.venv)/'
ignored="$(
  git ls-files --others --ignored --exclude-standard 2>/dev/null \
    | grep -E "$SOURCE_PATTERN" | grep -vE "$ARTIFACT_PATTERN" || true
)"
if [ -n "$ignored" ]; then
  echo "ERROR: these source files are excluded by .gitignore and would not be published:"
  echo "$ignored" | sed 's/^/  /'
  status=1
fi

if [ "$status" -ne 0 ]; then
  exit 1
fi
echo "OK: no naming typos and no ignored source files."
