## 1. Spec and Assets
- [x] 1.1 Create OpenSpec proposal and requirements for seat emotes.
- [x] 1.2 Promote the selected DiceThrone Moon Elf emote into the formal asset tree.
- [x] 1.3 Regenerate asset manifest after final runtime assets are stable.

## 2. Shared Catalog
- [x] 2.1 Add `src/shared/emotes.ts` with common/game scoped definitions and lookup helpers.
- [x] 2.2 Register the first DiceThrone Moon Elf `speechless-facepalm` emote.
- [x] 2.3 Add unit tests for catalog filtering and invalid ID rejection.

## 3. Socket Transport
- [x] 3.1 Add `MATCH_EMOTE_EVENTS` constants on server and client.
- [x] 3.2 Server: join match emote room with existing match channel lifecycle.
- [x] 3.3 Server: validate match membership, spectator restrictions, emote whitelist, and rate limit.
- [x] 3.4 Client: add `joinEmotes`, `leaveEmotes`, `sendEmote`, and `subscribeEmote` to `matchSocket`.
- [x] 3.5 Add server/client tests for send, reject, and rate-limit paths.

## 4. UI
- [x] 4.1 Add `EmotePicker` with game-scoped and common emote filtering.
- [x] 4.2 Add `SeatEmoteOverlay` using `HudPortal` and seat anchors.
- [x] 4.3 Add in-chat emote picker without replacing existing chat/social entries.
- [x] 4.4 Add reduced-motion and same-player replacement behavior.

## 5. Verification
- [x] 5.1 Run ESLint on changed TS/TSX files.
- [x] 5.2 Run focused unit tests for socket/catalog/overlay behavior.
- [x] 5.3 Run a focused E2E or component-level browser check proving the sender uses the chat window, sees only local chat echo, and the other client sees the seat emote at the sender anchor.
- [x] 5.4 Record screenshot evidence for the HUD/seat emote visual path.
