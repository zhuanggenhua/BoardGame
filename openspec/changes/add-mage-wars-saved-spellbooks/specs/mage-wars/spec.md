## ADDED Requirements

### Requirement: Saved Spellbooks
Mage Wars SHALL let a player save, update, use, edit, and delete named spellbook copies scoped to the selected mage before starting a match.

#### Scenario: Save a named spellbook copy for the selected mage
- **GIVEN** a player has selected a Mage Wars mage in setup
- **AND** the builder is showing that mage's current standard starting spellbook or current selected spellbook
- **WHEN** the player opens the spellbook builder, enters a spellbook name, and saves it as new
- **THEN** the saved spellbook MUST be stored with that selected mage ID, the name, and normalized spellbook entries
- **AND** if the player has not edited entries, those entries MUST match that mage's complete standard starting spellbook
- **AND** the saved spellbook MUST be available in the selected mage setup area's saved spellbook library
- **AND** it MUST NOT appear as a selectable spellbook for a different mage

#### Scenario: Standard and named spellbooks share one library
- **GIVEN** a player has selected a Mage Wars mage in setup
- **WHEN** the selected mage setup area shows available spellbooks
- **THEN** that mage's standard starting spellbook MUST be visible as a first-class library item
- **AND** named saved spellbooks for that mage MUST appear beside it in the same library
- **AND** the UI MUST NOT hide named spellbooks in a separate corner-only DIY area
- **AND** the primary new-spellbook flow MUST NOT start from a blank empty spellbook when a standard starting spellbook exists for that mage

#### Scenario: Use a named spellbook from mage setup
- **GIVEN** a saved spellbook exists for the currently selected mage
- **WHEN** the player selects that saved spellbook from the mage setup area's saved spellbook library
- **THEN** the selected seat MUST use that saved spellbook's normalized entries
- **AND** the selected seat summary MUST identify that saved spellbook as the active one

#### Scenario: Edit and update an existing saved spellbook
- **GIVEN** a saved spellbook exists for the currently selected mage
- **WHEN** the player opens it for editing, changes its name or entries, and updates the selected saved spellbook
- **THEN** the saved spellbook MUST keep the same saved spellbook ID
- **AND** its stored name, mage ID, entries, and updated timestamp MUST reflect the edit
- **AND** the player MUST still be able to save the same draft as a separate new spellbook instead of overwriting

#### Scenario: Delete a saved spellbook from mage setup
- **GIVEN** one or more saved spellbooks exist for the currently selected mage
- **WHEN** the player deletes one saved spellbook from the mage setup area's saved spellbook library
- **THEN** that saved spellbook MUST be removed from storage and from the visible library
- **AND** deleting the active saved spellbook MUST clear the selected saved spellbook ID for that seat
- **AND** other saved spellbooks for that mage MUST remain available

#### Scenario: Use a named spellbook to start a match
- **GIVEN** a saved spellbook exists for the selected mage
- **WHEN** the player uses that spellbook from mage setup and confirms setup
- **THEN** the match setupData MUST contain the saved spellbook entries for that seat
- **AND** the runtime planning UI MUST use those entries as the player's spellbook

### Requirement: Mage First Spellbook Building
Mage Wars setup SHALL require the player to choose the mage first, then build or load a spellbook for that selected mage.

#### Scenario: Build flow starts from selected mage
- **WHEN** a player selects a mage and opens the spellbook builder
- **THEN** the builder MUST edit the spellbook for that selected mage
- **AND** the builder MUST NOT provide a second mage switcher that changes the mage inside the builder
- **AND** changing the mage from the setup selection MUST reset the editable spellbook to that mage's standard starting spellbook unless the player loads a saved spellbook for that mage
