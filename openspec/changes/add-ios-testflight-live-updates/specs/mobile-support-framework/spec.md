## ADDED Requirements

### Requirement: Mobile runtime detection must distinguish native platforms

The system SHALL expose mobile runtime detection that distinguishes web, Android native, and iOS native environments without forcing shared UI to inspect platform-specific globals directly.

#### Scenario: Shared mobile UI detects iOS native runtime
- **GIVEN** the app is running inside the iOS Capacitor shell
- **WHEN** shared mobile UI checks the runtime target
- **THEN** the runtime helper MUST report iOS native mobile runtime
- **AND** the shared UI MUST NOT depend on Android-only runtime helpers to decide whether mobile app features are available

#### Scenario: Android runtime detection remains compatible
- **GIVEN** the app is running inside the existing Android Capacitor shell
- **WHEN** existing Android-specific code checks the runtime target
- **THEN** Android compatibility helpers MUST continue to report Android native runtime
- **AND** existing Android behavior MUST NOT be disabled by adding iOS detection
