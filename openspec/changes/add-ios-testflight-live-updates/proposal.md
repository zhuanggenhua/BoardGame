# Change: iOS TestFlight app shell and live updates

## Why

BoardGame currently has an Android Capacitor app shell with embedded H5, OTA live updates, native APK update flow, and mobile game package publishing. The project now needs an iPhone distribution path through TestFlight while keeping Android behavior unchanged.

The target is not App Store public listing. The target is a signed iOS app that can be distributed through TestFlight, with H5 live update and game package behavior aligned with the existing Android model wherever iOS allows it.

## What Changes

- Add an iOS Capacitor app shell prepared for TestFlight distribution.
- Keep Android package id, signing, versionCode, OTA paths, native update paths, scripts, and workflows unchanged.
- Generalize the existing Android H5 OTA model into a cross-platform mobile live update model.
- Keep Android native APK self-update as Android-only; define iOS native binary updates as TestFlight builds only.
- Add iOS-specific OTA manifest and game package publish paths using the same channel semantics as Android.
- Apply the project-wide mandatory OTA policy to iOS: every channel publishes `forceUpdate = true` and cannot opt out.
- Reuse the shared lightweight OTA file classifier so iOS H5 bundles do not duplicate nested game assets.
- Add platform-aware runtime detection so existing Android-only managers are not copied into iOS code paths under Android names.
- Add iOS build and release documentation for local Mac/Xcode archive and later CI automation.

## Impact

- Affected specs:
  - `android-app-shell`
  - `mobile-support-framework`
  - `ios-app-shell` (new)
  - `mobile-live-updates` (new)
  - `mobile-game-pack-management`
- Affected code:
  - `package.json` / `package-lock.json`
  - `capacitor.config.ts`
  - `src/lib/mobile/*`
  - `src/components/system/*LiveUpdate*`
  - `src/features/mobile-packages/*`
  - `scripts/mobile/*`
  - `docs/mobile-release.md`
  - new `ios/` Capacitor project files

## Non-Goals

- No App Store public listing in this change.
- Android artifact paths and native update behavior remain unchanged; the project-wide mandatory H5 OTA policy applies consistently to both platforms.
- No iOS IPA sideload distribution as the primary path.
- No iOS native binary self-update. iOS native updates MUST go through TestFlight/App Store Connect.
- No new game UI mobile redesign in this change.
