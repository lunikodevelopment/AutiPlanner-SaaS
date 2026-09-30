#!/usr/bin/env bash
# Publishes the built card to its own repository.
#
# The card ships from AutiPlanner-Card, because a HACS repository is added with
# one category and a dashboard card and an integration cannot be installed from
# the same entry. The source stays here, next to the integration it reads from,
# and this script assembles what HACS serves: the bundle plus the three files
# that make the card repository a HACS repository.
#
# Run it from a clean tree after `pnpm --filter @autiplanner/card build`, or let
# CI do it. It refuses to push a bundle that differs from the committed one, so
# a stale build cannot reach users.

set -euo pipefail

REPO_SLUG="${CARD_REPO:-lunikodevelopment/AutiPlanner-Card}"
REMOTE="${CARD_REMOTE:-git@github.com:${REPO_SLUG}.git}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bundle="${root}/autiplanner-card.js"
assets="${root}/apps/card/repo"

if [ ! -f "${bundle}" ]; then
  echo "error: ${bundle} is missing. Run: pnpm --filter @autiplanner/card build" >&2
  exit 1
fi

for required in hacs.json README.md LICENSE; do
  if [ ! -f "${assets}/${required}" ]; then
    echo "error: ${assets}/${required} is missing" >&2
    exit 1
  fi
done

# CI checks this too, but doing it here means a stale bundle is caught before a
# push rather than after one.
if ! git diff --quiet -- autiplanner-card.js; then
  echo "error: the committed card bundle is out of date. Run:" >&2
  echo "  pnpm --filter @autiplanner/card build && git add autiplanner-card.js" >&2
  exit 1
fi

if gh repo view "${REPO_SLUG}" >/dev/null 2>&1; then
  echo "==> ${REPO_SLUG} exists, updating it"
  workdir="$(mktemp -d)"
  trap 'rm -rf "${workdir}"' EXIT
  git clone --depth 1 "${REMOTE}" "${workdir}" >/dev/null
else
  echo "==> ${REPO_SLUG} does not exist yet, creating it"
  gh repo create "${REPO_SLUG}" \
    --public \
    --description "Lovelace dashboard card for AutiPlanner (hosted) on Home Assistant." \
    --disable-issues --disable-wiki
  workdir="${REPO_SLUG}"
  git clone "${REMOTE}" "${workdir}" >/dev/null
fi

cp "${bundle}" "${workdir}/autiplanner-card.js"
for asset in hacs.json README.md LICENSE; do
  cp "${assets}/${asset}" "${workdir}/${asset}"
done

cd "${workdir}"
git add autiplanner-card.js hacs.json README.md LICENSE
if git diff --cached --quiet; then
  echo "==> the card repository is already up to date"
  exit 0
fi

git -c user.name="AutiPlanner release" \
    -c user.email="release@users.noreply.github.com" \
    commit -m "Publish the built card from ${REPO_SLUG}" >/dev/null
git push origin HEAD:main
echo "==> published to ${REPO_SLUG}"
echo
echo "HACS will pick it up on its next refresh. The resource URL is:"
echo "  /hacsfiles/AutiPlanner-Card/autiplanner-card.js"
