#!/usr/bin/env bash
# Publishes the built card to its own repository.
#
# The card ships from AutiPlanner-Card, because a HACS repository is added with
# one category and a dashboard card and an integration cannot be installed from
# the same entry. The source stays here, next to the integration it reads from,
# and this script assembles what HACS serves: the bundle plus the three files
# that make the card repository a HACS repository.
#
# It uses git and nothing else, so it works over an SSH key without an API
# token. The repository has to exist already; create it public, since HACS
# fetches the bundle anonymously. Files GitHub adds on creation (a README, a
# .gitignore, a licence) are overwritten, not fought over.
#
# Run it from a clean tree after `pnpm --filter @autiplanner/card build`.

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

# A stale bundle must not reach users, and finding out here beats finding out
# after a push.
if ! git diff --quiet -- autiplanner-card.js; then
  echo "error: the committed card bundle is out of date. Run:" >&2
  echo "  pnpm --filter @autiplanner/card build && git add autiplanner-card.js" >&2
  exit 1
fi

# Reachability, not emptiness: `git ls-remote --exit-code` would report an empty
# repository as a failure, and an empty repository is exactly what we want to
# push into.
if ! git ls-remote "$REMOTE" >/dev/null 2>&1; then
  cat >&2 <<EOF
error: ${REPO_SLUG} does not exist or is not reachable at ${REMOTE}

Create it first, as a public repository:

  https://github.com/new?name=${REPO_SLUG}

Public matters: HACS downloads the bundle anonymously, so a private repository
needs a GitHub token configured in HACS as well. The files GitHub adds for you
are fine, they are replaced here.
EOF
  exit 1
fi

workdir="$(mktemp -d)"
trap 'rm -rf "${workdir}"' EXIT

echo "==> cloning ${REPO_SLUG}"
git clone --quiet "$REMOTE" "$workdir"

cd "$workdir"
# Build on top of whatever is already there, so a repository created with a
# README does not turn into a non-fast-forward rejection.
if git rev-parse --verify --quiet origin/main >/dev/null; then
  git checkout --quiet -B main origin/main
  echo "==> building on top of the existing main"
else
  git checkout --quiet -B main
  echo "==> starting a fresh main"
fi

cp "$bundle" autiplanner-card.js
for asset in hacs.json README.md LICENSE; do
  cp "${assets}/${asset}" "$asset"
done

git add autiplanner-card.js hacs.json README.md LICENSE
if git diff --cached --quiet; then
  echo "==> the card repository is already up to date"
  exit 0
fi

git -c user.name="AutiPlanner release" \
    -c user.email="release@users.noreply.github.com" \
    commit -m "Publish the built card from ${REPO_SLUG}" >/dev/null
git push --quiet origin main

echo "==> published to ${REPO_SLUG}"
echo
echo "HACS will serve it at:"
echo "  /hacsfiles/AutiPlanner-Card/autiplanner-card.js"
