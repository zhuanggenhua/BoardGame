## ADDED Requirements

### Requirement: iOS app shell must support TestFlight distribution

The system SHALL provide an iOS Capacitor app shell that can be signed, archived, uploaded to App Store Connect, and distributed through TestFlight without requiring public App Store listing.

#### Scenario: Upload iOS build for TestFlight
- **GIVEN** the iOS app shell is configured with a valid Bundle ID and Apple signing team
- **WHEN** the release owner archives the app in Xcode and uploads it to App Store Connect
- **THEN** the build MUST be eligible for TestFlight distribution
- **AND** the process MUST NOT require publishing the app publicly on the App Store

### Requirement: iOS app shell must default to embedded Web runtime

The system SHALL use an embedded H5 bundle as the default iOS app shell runtime, matching the Android mainline product model.

#### Scenario: First iOS install loads embedded bundle
- **GIVEN** a user installs the iOS app from TestFlight for the first time
- **WHEN** the app starts before any live update has been downloaded
- **THEN** the app MUST load the H5 bundle embedded in the signed binary
- **AND** the app MUST connect to the configured production backend over HTTPS

### Requirement: iOS native binary updates must go through TestFlight

The system SHALL treat iOS native binary updates as TestFlight/App Store Connect builds, not as in-app downloaded IPA installations.

#### Scenario: Native iOS code changes require new TestFlight build
- **GIVEN** a release includes native iOS code, Capacitor plugin, permission, icon, splash, or signing changes
- **WHEN** the release owner prepares the update
- **THEN** the system MUST require a new TestFlight build
- **AND** the app MUST NOT attempt to download and install an IPA from inside the running iOS app
