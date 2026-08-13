# iOS build path

PAKA Poker uses Capacitor 7.6.8 and requires Xcode 16 or newer. The local
Ventura machine cannot run that supported toolchain, so unsigned validation is
performed on a newer macOS runner or Mac. The generated native project uses
Swift Package Manager and does not require CocoaPods.

## Unsigned simulator validation

Run from the project root on a Mac with Xcode 16+:

```sh
VITE_SOCKET_URL=https://paka-poker-api.onrender.com \
  VITE_ADMIN_VIEW=false \
  VITE_SHOW_DEBUG_CONTROLS=false \
  ./scripts/build-ios-ci.sh
```

Project: `ios/App/App.xcodeproj`

Bundle identifier: `com.pakapoker.game16`

## Physical iPhone signing

Open `ios/App/App.xcodeproj` in Xcode. Select the App target, enable
Automatically manage signing, and choose a Personal Team or paid development
team. Apple credentials, certificates, profiles, and private keys must stay in
Xcode/Keychain or encrypted CI secrets and must never be committed.

For CI archives, store the signing certificate, certificate password,
provisioning profile, and App Store Connect credentials only as encrypted
provider secrets. An unsigned simulator build does not produce an IPA.
