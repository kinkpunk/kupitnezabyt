#!/bin/bash
# Regenerates Playwright linux snapshots in Docker and copies them back.
#
# CI runs e2e tests on linux, so *-linux.png snapshots must match the linux
# rendering. Run this script after changing anything that affects the visual
# specs (UI markup/styles, fonts, onboarding flow). It:
#   1. starts a linux container with the repo (host node_modules is not reused
#      because esbuild/swc binaries are platform-specific),
#   2. installs deps, generates the Prisma client and builds workspace packages,
#   3. runs the visual specs with --update-snapshots,
#   4. re-runs them without the flag as a verification pass,
#   5. mirrors the resulting *-linux.png files into the host checkout.
#
# Prereqs: Docker running, local Postgres reachable on localhost:5432
# (see docker-compose.yml). Works on macOS Docker Desktop (host.docker.internal).
#
# Usage: ./scripts/update-linux-snapshots.sh

set -euo pipefail

cd "$(dirname "$0")/.."

PLAYWRIGHT_IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.61.1-jammy}"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@host.docker.internal:5432/kupitnezabyt}"
SPECS="tests/e2e/screens-visual.spec.ts tests/e2e/categories-visual.spec.ts"

if ! docker info >/dev/null 2>&1; then
  echo "error: docker is not running" >&2
  exit 1
fi

echo "checking local database..."
node scripts/check-local-db.mjs

echo "pulling $PLAYWRIGHT_IMAGE (if missing)..."
docker pull -q "$PLAYWRIGHT_IMAGE" >/dev/null

docker run --rm -i \
  --shm-size=2g \
  -v "$PWD":/workspace \
  -w /workspace \
  -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/phome \
  -e PNPM_HOME=/tmp/pnpm \
  -e COREPACK_HOME=/tmp/corepack \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e E2E_BASE_URL=http://127.0.0.1:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001 \
  -e E2E_API_PORT=3001 \
  -e DEV_AUTH_ENABLED=true \
  -e JWT_SECRET=e2e-secret \
  -e SPECS="$SPECS" \
  "$PLAYWRIGHT_IMAGE" bash -s <<'INNER'
set -euo pipefail

# corepack enable needs root; use a shim instead
mkdir -p /tmp/bin
printf '#!/bin/sh\nexec corepack pnpm "$@"\n' > /tmp/bin/pnpm
chmod +x /tmp/bin/pnpm
export PATH=/tmp/bin:$PATH

# copy the repo to a writable linux-local dir (excludes host node_modules)
mkdir -p /tmp/ws
tar -C /workspace --exclude=node_modules --exclude=.pnpm-store --exclude=.git -cf - . | tar -C /tmp/ws -xf -
cd /tmp/ws

echo "installing dependencies..."
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @kupitnezabyt/shared --filter @kupitnezabyt/database build

echo "updating linux snapshots..."
pnpm exec playwright test $SPECS --update-snapshots

echo "verification run..."
pnpm exec playwright test $SPECS

echo "copying linux snapshots back..."
cd /tmp/ws
find tests/e2e -path '*-snapshots/*-linux.png' | tar -cf - -T - | tar -C /workspace -xf -
find /workspace/tests/e2e -path '*-snapshots/*-linux.png' -size 0 -delete
echo "done."
INNER
