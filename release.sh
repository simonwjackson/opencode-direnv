#!/usr/bin/env bash
# CalVer release script: YYYY.MM.DD.BUILD
# Usage: ./release.sh

set -e

TODAY=$(date +%Y.%-m.%-d)

# Find latest tag for today and increment, or start at 0
LATEST=$(git tag -l "v${TODAY}.*" | sort -V | tail -1)

if [[ -z "$LATEST" ]]; then
  BUILD=0
else
  BUILD=$((${LATEST##*.} + 1))
fi

VERSION="${TODAY}.${BUILD}"
TAG="v${VERSION}"

echo "Releasing ${TAG}..."

git tag "$TAG"
git push origin "$TAG"

echo "Done! GitHub Actions will publish to npm."
echo "Track progress: https://github.com/simonwjackson/opencode-direnv/actions"
