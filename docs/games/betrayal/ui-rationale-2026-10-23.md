# Betrayal UI rationale — 2026-10-23

## Rule-backed resource display

The third-edition rulebook says that an Event is resolved and put on the bottom of its own deck; an Item or Omen is placed face-up in front of the explorer who drew it. The final Omen starts the haunt automatically. See the repository transcription in [`betrayal-3e-rulebook-en.md`](sources/official/betrayal-3e-rulebook-en.md), especially “Playing Event, Item, and Omen Cards” (printed page 7). Public PDF copies used for cross-checking: [qugs.org](https://www.qugs.org/rules/r358504.pdf) and [Snakes & Lattes](https://upload.snakesandlattes.com/rules/b/BetrayalattheHouseontheHill.pdf).

Keep the three real draw stocks, their counts, and card-resolution rules in game state. The interface has no draw action on those stacks: discovery automatically draws from the matching source. Do not show permanent generic draw or discard piles. The production `discardCounts` values are initialized/copied but never written, and all three displayed discard placeholders remained at zero. Present a card when discovery actually draws it, and preserve the Omen/haunt-risk feedback because the final Omen changes the rules. Engine state and card-resolution behavior remain unchanged. If a future scenario needs a public discarded card, present that specific card in its rule context rather than restoring permanent generic piles.

## Explorer ability copy

The current base-game catalog assigns all twelve explorers the same “no special ability” sentinel and the same generic setup/background explanation. It does not describe twelve distinct powers or actionable rules. Do not repeat that filler in character selection, the player rail, and explorer details. The UI now omits that block for the sentinel while preserving ability copy for any explorer with a real rule ability.

## Contextual inventory and developer controls

The lower-left inventory area is useful when a player has Item or Omen cards because those cards remain face-up in front of their owner and can be inspected or used under their rules. When the area is empty, hide its visible heading and owner label while keeping the stable tutorial anchor and screen-reader status. This avoids presenting an empty zone as a permanent player action.

The floating wrench is a developer debug entry point, not part of the tabletop UI. `GameDebugPanel` already returns `null` in production unless the explicit E2E debug flag is set; keep that guard and do not add a second Betrayal-specific gate.

## Reference and information hierarchy

The inspected [Mansions of Madness Steam screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/478980/ss_b4466d688f27d997d26cc54b401c7d183550f9b0.1920x1080.jpg?t=1790365940) keeps the map as the main field, puts a short event prompt beside its related actions, and limits persistent tools to a small set. This supports avoiding non-actionable permanent HUD furniture and keeping event copy near its controls. It is an information-hierarchy reference only; it is not a source for Betrayal rules or an instruction to copy that game's skin. [Gloomhaven's official Steam page](https://store.steampowered.com/app/780290/Gloomhaven/) is a secondary reference for showing phase actions when they matter rather than expanding every card/resource category into a permanent panel.

## Event checks and reward choice

The event card remains visible beside its resolution because it carries the rule text being acted on. During the four-trait check, each row keeps the trait, rolled faces, and outcome together; after all four checks, the same card and result summary remain while the player chooses one reward and confirms once. Keep that decision cluster compact so a result does not read as detached from its attribute. Do not add a second window or duplicate confirmation. This applies the reference hierarchy above to an actual rule decision, not to permanent decorative HUD content. Business E2E checks the four results, same event source/frame, single reward selection, and confirmation; a person reviews spacing and screenshots.

## Review checkpoint — 2026-10-23

The apparent missing Hanging Tree card in the reward screenshot was a review misread, not a rendering or JPEG conversion defect. A same-run raw PNG and its JPEG both contain the card; the independently downloaded initial and reward JPEG card crops were pixel-identical (SHA-256 `fd9ebe2f6262a1d888f9153693e0f572d559bd196024209a7ca477a0d6efcba5`). Do not add arbitrary capture delays or change the card rendering for this report.

The compact event decision group and the desktop screenshots for the current board state were reviewed and accepted by the parent reviewer. This checkpoint is limited to those desktop states; it does not approve the full UI, mobile layout, or motion/audio behavior.

## Motion and audio evidence — 2026-10-23

The isolated natural-flow browser run `betrayal-motion-audio-20261023-r3` reached scenario opening, a room-to-room move, room/event reveal, event resolution, and next-turn advancement (1/1 passed). Its 62.84-second Playwright recording is 800×450 at 25 fps and contains video only. A separate browser WebAudio recording from the same run is a 48 kHz stereo Opus WebM: 6 audio-source starts after the movement marker, 113 non-silent RMS samples, peak RMS 0.00268, and the concrete-footstep OGG returned HTTP 200. The audio and video are separate files; they were not muxed and their synchronization has not been verified. The audio capture is evidence of non-silent browser output during the movement interval, not a subjective sound-quality approval.

The video captures the natural movement and room/event flow for review. Camera framing, door/room reveal quality, turn-intro skip/acceleration, and listening review remain open. Do not mark the full motion, audio, mobile, or overall UI acceptance complete from this run alone. Automated checks remain for gameplay behavior and playback evidence; layout and visual approval remain human review items.
