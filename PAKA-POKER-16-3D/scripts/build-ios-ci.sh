#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

node --version
npm --version

export VITE_SOCKET_URL="${VITE_SOCKET_URL:-https://paka-poker-api.onrender.com}"
export VITE_ADMIN_VIEW=false
export VITE_SHOW_DEBUG_CONTROLS=false

npm ci --legacy-peer-deps
npx cap --version
npm --prefix client ci
npm --prefix server ci
npm --prefix client run lint
npm --prefix server test
npm --prefix server run lint
npm --prefix client run build
npx cap sync ios

xcodebuild -list -project ios/App/App.xcodeproj

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build/DeviceDerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build

device_app='build/DeviceDerivedData/Build/Products/Debug-iphoneos/App.app'
test -d "$device_app"
file "$device_app/App"
plutil -extract CFBundleIdentifier raw "$device_app/Info.plist"
plutil -extract CFBundleDisplayName raw "$device_app/Info.plist"
plutil -extract MinimumOSVersion raw "$device_app/Info.plist"

rg -a -q 'https://paka-poker-api\.onrender\.com' "$device_app"
if rg -a -q 'paka-poker-api\.example\.invalid|localhost:3000|127\.0\.0\.1|192\.168\.' "$device_app"; then
  echo 'A forbidden development backend URL is embedded in the device app.' >&2
  exit 1
fi
if /usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$device_app/Info.plist" >/dev/null 2>&1; then
  echo 'An App Transport Security cleartext bypass is present.' >&2
  exit 1
fi

xcodebuild archive \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/PAKAPoker.xcarchive \
  CODE_SIGNING_ALLOWED=NO

test -d build/PAKAPoker.xcarchive
test -d build/PAKAPoker.xcarchive/Products/Applications/App.app
