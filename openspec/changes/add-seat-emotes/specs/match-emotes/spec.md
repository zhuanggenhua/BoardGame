## ADDED Requirements

### Requirement: In-Match Emote Broadcast
The system SHALL let a seated player send a whitelisted emote to the current match room as a transient in-match event.

#### Scenario: Seated player sends emote
- **WHEN** a seated player clicks an enabled emote in an online match
- **THEN** the client sends one `matchEmote:send` event
- **AND** the server validates match membership and the emote id
- **AND** the server emits one `matchEmote:show` event to the match room

#### Scenario: Spectator cannot send emote
- **WHEN** a spectator attempts to send a match emote
- **THEN** the server rejects the request
- **AND** no `matchEmote:show` event is emitted

### Requirement: Emote Whitelist and Scope
The system SHALL only allow enabled emotes from the catalog, scoped by common availability or the current game.

#### Scenario: Game-specific emote is available in matching game
- **WHEN** the current match game id is `dicethrone`
- **THEN** enabled `gameId=dicethrone` emotes are available in the picker
- **AND** enabled common emotes are also available

#### Scenario: Game-specific emote is rejected in another game
- **WHEN** a player in a non-DiceThrone match sends a DiceThrone-only emote id
- **THEN** the server rejects the emote as invalid for that match

### Requirement: Emote Rate Limiting
The system SHALL rate-limit in-match emote sending per match and player.

#### Scenario: Player sends too frequently
- **WHEN** the same player sends a second emote before the cooldown expires
- **THEN** the server rejects the second send
- **AND** the first emote remains unaffected

### Requirement: Seat-Anchored Emote Display
The system SHALL display incoming emotes from the sender's seat or avatar anchor instead of only inside chat history.

#### Scenario: Anchor exists
- **WHEN** a `matchEmote:show` event is received for another player and `[data-player-seat-anchor="<playerId>"]` exists
- **THEN** the emote appears near that anchor
- **AND** it uses a short transform/opacity animation

#### Scenario: Sender sees local chat echo instead of own seat popup
- **WHEN** the local player sends an enabled emote from the in-match chat panel
- **THEN** the local chat panel displays the sent emote
- **AND** the local player's own seat anchor does not play the same popup

#### Scenario: Anchor missing
- **WHEN** a `matchEmote:show` event is received for another player but no matching seat anchor exists
- **THEN** the emote displays in a safe HUD fallback position
- **AND** the event is not dropped silently

### Requirement: Transient Emote Semantics
The system SHALL treat seat emotes as transient presentation events, not private chat messages.

#### Scenario: Emote does not affect chat history
- **WHEN** a player sends a seat emote
- **THEN** it is not stored in private message history
- **AND** it does not increment friend chat unread counts
