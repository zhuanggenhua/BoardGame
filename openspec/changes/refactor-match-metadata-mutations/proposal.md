# Change: Refactor match metadata mutations

## Why
`claim-seat` and several match lifecycle paths currently perform `fetch(metadata) -> mutate -> setMetadata(full metadata)`. Concurrent requests that update different metadata fields can overwrite each other, which caused multi-AI room creation to lose later AI seat credentials.

## What Changes
- Add a storage-level mutation seam for match metadata updates that must be atomic or serialized per match.
- Migrate `claim-seat` seat credential/name updates away from full metadata replacement.
- Define guardrails for high-risk metadata writers such as seat credentials, connection status, disconnect markers, and gameover.
- Keep game rules, SmashUp AI decision logic, and frontend faction-pick flow out of scope.

## Impact
- Affected specs: `match-ownership`
- Affected code: `src/engine/transport/storage.ts`, `src/server/storage/*`, `src/server/claimSeat.ts`, selected transport metadata writers
- Tests: concurrent `claim-seat` regression, storage mutation unit coverage, existing manual AI faction E2E
