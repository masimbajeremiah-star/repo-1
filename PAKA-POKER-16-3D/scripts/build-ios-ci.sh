#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

node --version
npm --version
npx cap --version

export VITE_SOCKET_URL="${VITE_SOCKET_URL:-https://paka-poker-api.onrender.com}"
export VITE_ADMIN_VIEW=false
export VITE_SHOW_DEBUG_CONTROLS=false

npm ci --legacy-peer-deps
npm --prefix client ci
npm --prefix server ci
npm --prefix client run lint
npm --prefix server test
npm --prefix server run lint
npm --prefix client run build
npx cap sync ios

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
