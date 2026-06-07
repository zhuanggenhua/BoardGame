## 1. Spec

- [x] 1.1 Add iOS app shell and cross-platform live update spec deltas.
- [x] 1.2 Validate `add-ios-testflight-live-updates` with OpenSpec strict mode.

## 2. iOS App Shell

- [x] 2.1 Add `@capacitor/ios` dependency.
- [x] 2.2 Scaffold `ios/` Capacitor project.
- [x] 2.3 Add iOS-specific app id/name/env examples without changing Android defaults.
- [x] 2.4 Document Mac/Xcode/TestFlight archive steps.

## 3. Cross-Platform Live Updates

- [x] 3.1 Introduce platform-neutral mobile runtime detection helpers.
- [x] 3.2 Introduce `MobileLiveUpdate` runtime wrappers around the existing Android implementation.
- [x] 3.3 Keep Android compatibility exports and UI components during migration.
- [x] 3.4 Add iOS OTA config resolution and iOS manifest URL support.
- [x] 3.5 Ensure iOS native update path points to TestFlight documentation/state, not APK installer behavior.

## 4. Mobile Game Packages

- [x] 4.1 Audit existing Android `GamePackage` plugin dependency and identify iOS parity gap.
- [x] 4.2 Add platform-scoped manifest URL handling for `mobile-packages/ios`.
- [x] 4.3 Keep Android `mobile-packages/android` behavior unchanged.

## 5. Publish Pipeline

- [x] 5.1 Add iOS OTA publish script skeleton or platform option while preserving Android scripts.
- [x] 5.2 Add iOS docs for channel naming, artifact paths, and manual first release.
- [x] 5.3 Defer iOS CI signing workflow until Apple credentials are available.

## 6. Verification

- [x] 6.1 Verify Android config resolution remains unchanged.
- [x] 6.2 Run focused TypeScript/ESLint checks for modified mobile files.
- [x] 6.3 Run Android doctor or equivalent config smoke if Android scripts are touched.
- [ ] 6.4 On Mac, verify `npx cap sync ios` and Xcode archive.
- [ ] 6.5 On TestFlight device, verify login, room flow, game launch, H5 OTA check, and package loading behavior.
