#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
#  Run the database seed script using Node 18 via NVM.
#  Node 12 (the system default) is too old for TypeScript.
# ─────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh" --no-use 2>/dev/null

# Use Node 18 (falls back to whatever is installed if 18 missing)
nvm use 18 --silent 2>/dev/null || nvm use default --silent 2>/dev/null

echo "Node $(node --version)  |  $(which node)"

cd "$(dirname "$0")/.." || exit 1

node node_modules/.bin/ts-node -r tsconfig-paths/register src/database/seed.ts
