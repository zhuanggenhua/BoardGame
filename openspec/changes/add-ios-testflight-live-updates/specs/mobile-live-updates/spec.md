## ADDED Requirements

### Requirement: Mobile live updates must support platform-scoped H5 bundle channels

The system SHALL support H5 live update manifests for each mobile platform while preserving shared channel semantics.

#### Scenario: iOS and Android use separate stable manifests
- **GIVEN** Android and iOS apps are both distributed
- **WHEN** the release owner publishes a `stable` H5 live update
- **THEN** the system MUST support Android artifacts under an Android-scoped path
- **AND** the system MUST support iOS artifacts under an iOS-scoped path
- **AND** both platforms MUST preserve the same `stable`, `gray`, and `edge` channel meanings

### Requirement: Mobile live updates must not replace native binary updates

The system SHALL only use mobile live updates for Web runtime content and MUST keep native binary updates platform-specific.

#### Scenario: Native update is not delivered as H5 live update
- **GIVEN** a release changes native plugins, permissions, native source code, bundle identifiers, signing, icons, or splash screens
- **WHEN** the release owner attempts to publish the release
- **THEN** the system MUST classify it as requiring a native binary update
- **AND** the system MUST NOT present an H5 OTA bundle as a complete substitute for that native update

### Requirement: Mobile live update runtime must expose platform-neutral APIs

The system SHALL expose mobile live update runtime APIs using platform-neutral names, while preserving Android compatibility aliases during migration.

#### Scenario: UI triggers live update check on mobile app
- **GIVEN** the app is running in a supported native mobile runtime
- **WHEN** the user or startup manager requests a live update check
- **THEN** the UI MUST call a platform-neutral live update API
- **AND** Android-specific exports MAY remain as aliases only for compatibility during migration

### Requirement: All mobile live updates must be mandatory and lightweight

The system SHALL publish every Android and iOS H5 live update with `forceUpdate = true` and SHALL exclude nested runtime game assets from OTA bundles.

#### Scenario: Publish a mobile OTA on any channel
- **GIVEN** the release owner selects an Android or iOS `stable`, `gray`, or `edge` channel
- **WHEN** the live update manifest and zip are generated
- **THEN** the manifest MUST contain `forceUpdate = true`
- **AND** the release path MUST NOT allow a non-mandatory OTA
- **AND** the zip MUST exclude nested game images, audio, atlas configs, status atlas JSON, thumbnails, and logos

#### Scenario: Mobile startup check finds a mandatory update
- **GIVEN** the native mobile app finds a newer OTA manifest
- **WHEN** the automatic startup check handles the update
- **THEN** the app MUST block normal use while downloading
- **AND** MUST apply the downloaded bundle immediately instead of only queuing it for a later restart

### Requirement: iOS live updates must respect app review boundaries

The system SHALL document and enforce that iOS live updates are limited to BoardGame Web runtime content and do not introduce unsupported native capabilities or transform the app into a different product.

#### Scenario: Unsupported iOS OTA scope is rejected
- **GIVEN** an update requires new native capabilities or changes the app's primary purpose
- **WHEN** the release owner prepares an iOS live update
- **THEN** the release process MUST reject or document the update as requiring a new TestFlight build
- **AND** the update MUST NOT be shipped only as an iOS H5 live update
