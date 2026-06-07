## ADDED Requirements

### Requirement: Mobile game package manifests must support platform-scoped roots

The system SHALL support mobile game package manifests for Android and iOS under platform-scoped roots while preserving shared game package state semantics.

#### Scenario: iOS game package manifest uses iOS path
- **GIVEN** the app is running inside the iOS Capacitor shell
- **WHEN** the user opens a game details page that requires a mobile package
- **THEN** the package manager MUST resolve the package manifest from an iOS-scoped manifest root
- **AND** it MUST NOT request the Android package manifest root

#### Scenario: Android game package manifest remains unchanged
- **GIVEN** the app is running inside the existing Android Capacitor shell
- **WHEN** the user opens a game details page that requires a mobile package
- **THEN** the package manager MUST continue to resolve the package manifest from the existing Android manifest root
- **AND** existing installed package state semantics MUST remain compatible
