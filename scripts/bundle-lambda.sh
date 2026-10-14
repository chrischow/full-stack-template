#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Dependencies must be installed for the Lambda runtime platform.
# if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 || "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]]; then
#   echo 'Build the Lambda ZIP on Linux x86_64 with Node 22' >&2
#   exit 1
# fi

printf '[bundle-lambda] Building frontend and its workspace dependencies...\n' >&2
pnpm build --filter=frontend
printf '[bundle-lambda] Building backend and its workspace dependencies...\n' >&2
pnpm build --filter=backend
printf '[bundle-lambda] Bundling backend...\n' >&2
pnpm --filter=backend bundle

require_file() {
  [[ -f "$1" ]] || { printf 'Missing required file: %s\n' "$1" >&2; exit 1; }
}

printf '[bundle-lambda] Checking build outputs...\n' >&2
[[ -x apps/backend/run.sh ]] || { echo 'Launcher is missing or not executable: apps/backend/run.sh' >&2; exit 1; }
require_file apps/backend/dist/lambda.cjs
require_file apps/frontend/dist/index.html
require_file packages/db/dist/generated/client.js

work="$PWD/.lambda-package"
stage="$work/stage"
archive="$PWD/lambda.zip"
printf '[bundle-lambda] Recreating clean staging directory: %s\n' "$work" >&2
rm -rf "$work" "$archive"
# trap 'rm -rf "$work"' EXIT
mkdir -p "$stage/apps/backend/dist" "$stage/apps/frontend"

# Deploy production dependencies, including compiled workspace packages, into
# an isolated node_modules. Keep only runtime files from the deployed backend.
printf '[bundle-lambda] Deploying backend production dependencies...\n' >&2
pnpm --filter=backend --prod --no-optional deploy --ignore-scripts "$work/deployed-backend"
printf '[bundle-lambda] Staging backend bundle, dependencies, launcher and frontend...\n' >&2
cp -a "$work/deployed-backend/node_modules" "$stage/apps/backend/"
cp "$work/deployed-backend/package.json" "$stage/apps/backend/"
cp apps/backend/dist/lambda.cjs "$stage/apps/backend/dist/"
cp -p apps/backend/run.sh "$stage/run.sh"
cp -a apps/frontend/dist "$stage/apps/frontend/"

printf '[bundle-lambda] Checking staged workspace packages and Prisma client...\n' >&2
require_file "$stage/apps/backend/node_modules/@repo/db/dist/generated/client.js"
require_file "$stage/apps/backend/node_modules/@repo/api-contract/dist/contracts/index.js"
require_file "$stage/apps/backend/node_modules/@repo/db/dist/generated/internal/class.js"

# pnpm's relative links must still resolve inside the staged tree after copying.
printf '[bundle-lambda] Checking staged dependency links...\n' >&2
stage_real="$(realpath "$stage")"
while IFS= read -r -d '' link; do
  target="$(readlink "$link")"
  [[ "$target" != /* ]] || { echo "Absolute dependency link: $link" >&2; exit 1; }
  [[ -e "$link" ]] || { echo "Broken dependency link: $link" >&2; exit 1; }
  resolved="$(realpath "$link")"
  [[ "$resolved" == "$stage_real/"* ]] || { echo "Dependency link escapes ZIP: $link" >&2; exit 1; }
done < <(find "$stage" -type l -print0)

printf '[bundle-lambda] Checking staging for configuration and credential filenames...\n' >&2
matches="$work/config-credential-matches"
find "$stage" \( -name '.env' -o -name '.env.*' -o -name '.npmrc' \) -print0 > "$matches"
if [[ -s "$matches" ]]; then
  echo 'Configuration or credentials found in Lambda staging:' >&2
  while IFS= read -r -d '' path; do
    printf '  %q\n' "${path#"$stage"/}" >&2
  done < "$matches"
  exit 1
fi

# Archive the contents of stage, retaining the launcher mode and pnpm symlinks.
printf '[bundle-lambda] Creating ZIP: %s\n' "$archive" >&2
( cd "$stage" && zip -q -r -y "$archive" run.sh apps )
printf '[bundle-lambda] Checking ZIP integrity...\n' >&2
unzip -tq "$archive" >/dev/null
printf '[bundle-lambda] Created %s\n' "$archive"
