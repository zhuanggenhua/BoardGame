# Fate/Domination Table Style

## Surface

- The original Fuyuki city board and card faces are the subject. Retain the approved current working draft's dark table, restrained gold chrome and real artwork.
- Do not copy another commercial game's palette, fonts, frame art or overall skin.
- Printed cards own their frame. Do not add a second decorative CSS frame or overlap readable hand faces into narrow strips.

## Layout

- The Pixi map fills the viewport, supports drag and zoom, and owns one camera. React retains state, HUD, accessible controls and overlays.
- Attack and skill hands remain two equally allocated regions. Each region centers its actual current cards, without a fixed full-hand width after cards leave.
- Staged and committed cards occupy their own play area. Remaining hand cards reflow on selection, play and withdrawal; removal must not leave clickable exit copies.
- Event cards align with the board's printed white slots. Pawns use registered original tokens.
- The right player rail presents avatar, name, victory points, mana and hand count together. Selecting the seat exposes public played cards; clicking its selected avatar opens details.
- Details have master, servant or gold back, stacked character-specific seals, resource/power values and three large skill faces or red backs. Played cards remain in the seat drawer.
- Detail card faces scale proportionally to the available viewport; they must not be cropped to fake a fit. Only long explanatory text may scroll internally.
- The game uses the registered landscape board shell on small screens. Homepage portrait adaptation is a separate task.

## Interaction

- Legal actions derive from the domain validator. Hover/focus inspects a full card at the side; clicking the inspection closes it without changing game state.
- Map and HUD input have distinct owners. Dragging does not select a region and closing details preserves camera pose.
- Command-spell choice selects an effect first and sends one domain command only on confirmation.
- Fullscreen runtime screenshots, count-changing states and actual card-to-zone movement must be reviewed. Current implementation remains REVISE until that review completes.

## Verification limits

- The foundation change still defers the complete card-effect catalogue and advanced rule windows. UI implementation must not be described as a production-complete game.
- Known rule-contract gaps are tracked against the CHM source: ordinary face-down cards, skill cards as part of the normal two-card play, deployment slot bonuses, and preparation setup. Do not substitute working buttons for proof of those rules.
