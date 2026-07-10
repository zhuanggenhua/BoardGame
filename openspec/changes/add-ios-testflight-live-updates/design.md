## Context

The existing app is React/Vite + Capacitor. Android already uses an embedded app shell, Capgo-based H5 OTA, native APK update checks, and mobile game package downloads. The iOS path must preserve that product model where platform rules allow it, while recognizing that iOS native binary updates cannot use the Android APK installer model.

The current codebase names many mobile concepts as Android-specific:

- `AndroidLiveUpdateManager`
- `androidLiveUpdates.ts`
- `androidRuntime.ts`
- `VITE_ANDROID_OTA_*`
- `VITE_ANDROID_NATIVE_UPDATE_*`
- `mobile-packages/android/...`

The implementation should avoid copying these names into an iOS parallel stack. Shared H5 live update behavior should move behind mobile-neutral names, with Android compatibility aliases where needed.

## Goals

- Add iOS TestFlight distribution support without affecting Android release behavior.
- Align iOS H5 live updates with Android embedded + OTA semantics.
- Align iOS game package channel and manifest semantics with Android.
- Keep Android native APK update as Android-only.
- Make future platform-specific differences explicit at config and runtime boundaries.

## Non-Goals

- Do not attempt direct iOS IPA sideload as the main distribution mechanism.
- Do not implement iOS native binary self-update.
- Do not change Android update channel semantics or existing published manifest paths.
- Do not redesign mobile game boards.

## Decisions

### Decision: Use TestFlight as the iOS binary distribution path

iOS binary installation SHALL be handled through App Store Connect / TestFlight. Ad Hoc IPA is not the default because it requires registered device UDIDs and does not scale as a normal distribution path.

### Decision: Keep embedded as the iOS default app shell mode

iOS should start with an embedded bundle in the signed binary, matching the Android mainline. Remote WebView can remain a debugging or emergency compatibility mode if introduced later, but it is not the product default.

### Decision: Split live update from native update

H5 bundle updates are cross-platform mobile live updates. Native binary updates are platform-specific:

- Android: existing native APK update flow remains valid.
- iOS: new native binary versions are uploaded to TestFlight.

### Decision: Use platform-scoped publish paths

To avoid Android regressions and allow platform-specific compatibility rules, iOS uses separate artifact roots:

- `app-updates/android/<channel>/...`
- `app-updates/ios/<channel>/...`
- `mobile-packages/android/<channel>/...`
- `mobile-packages/ios/<channel>/...`

### Decision: All mobile H5 live updates are mandatory and lightweight

Every Android and iOS H5 OTA manifest must publish `forceUpdate = true`. Release scripts must reject `--no-force-update`, and automatic startup checks must promote mandatory manifests to blocking immediate application.

Both platforms use the same OTA file classifier: Vite root outputs, Chinese locales, fonts, required public files, and asset manifests are included; nested game images, audio, atlas configs, status atlas JSON, thumbnails, and logos remain on the server asset or mobile game package path.

### Decision: Introduce mobile-neutral env keys with compatibility fallback

New shared runtime code should prefer mobile-neutral or platform-specific keys, while preserving old Android keys for Android:

- `VITE_MOBILE_OTA_ENABLED`
- `VITE_MOBILE_OTA_CHANNEL`
- `VITE_MOBILE_OTA_APP_READY_TIMEOUT_MS`
- `VITE_IOS_OTA_MANIFEST_URL`
- `VITE_ANDROID_OTA_MANIFEST_URL`
- `VITE_MOBILE_PACKAGE_MANIFEST_URL`

Android must continue accepting the existing `VITE_ANDROID_OTA_*` keys.

## Risks / Trade-offs

- App Review policy risk: iOS live updates must not turn the app into a different product or bypass review for native capabilities. Mitigation: document that OTA is limited to BoardGame Web content and existing platform purpose.
- Refactor risk: renaming Android update runtime can touch many files. Mitigation: introduce mobile-neutral wrappers first, keep Android aliases during migration, and verify Android tests/build scripts.
- Windows limitation: `ios/` can be scaffolded locally, but archive/sign/upload requires Mac + Xcode. Mitigation: separate repository preparation from final TestFlight archive.

## Migration Plan

1. Add OpenSpec proposal and validate it.
2. Add `@capacitor/ios` and scaffold `ios/` without modifying Android native files.
3. Refactor runtime detection to expose platform-neutral helpers.
4. Introduce `MobileLiveUpdate` wrappers and keep Android aliases.
5. Add iOS OTA config and publish script skeletons using iOS artifact paths.
6. Add iOS docs for Mac/Xcode/TestFlight archive.
7. Verify Android configs still resolve to existing values.
8. On Mac, run `npx cap sync ios`, archive with Xcode, upload to TestFlight, and verify real device behavior.

## Open Questions

- Apple Developer Team ID and final Bundle ID are not known in this repository.
- Whether iOS game packages need a custom native plugin parity layer or can initially use Web storage/Capacitor filesystem depends on current Android `GamePackage` plugin implementation.
- CI for iOS requires macOS runner signing secrets; initial implementation can document manual Xcode archive first.
