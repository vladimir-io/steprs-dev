#!/usr/bin/env bash
# Push steprs-dev to GitHub. Run from repo root after authenticating.
set -euo pipefail

REPO="${1:-vladimir-io/steprs-dev}"

echo "→ GitHub repo: $REPO"
echo "→ Ensure you are logged in: gh auth login && ssh-add ~/.ssh/id_rsa"
echo

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "git@github.com:${REPO}.git"
fi

if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "→ Repo exists, force-pushing main (backup old default branch first if needed)"
  git push -u origin main --force
else
  echo "→ Creating repo and pushing"
  gh repo create "$REPO" --public --source=. --remote=origin --push
fi

echo "✓ GitHub: https://github.com/${REPO}"
