## 1. Proposal And Intake
- [x] 1.1 Read `AGENTS.md`, `.spec/AGENTS.md`, `openspec/AGENTS.md`, project context, relevant game/UI/data/E2E standards, and current active changes.
- [x] 1.2 Inspect current registry/runtime patterns and confirm `add-fate-domination-foundation` is a unique change ID.
- [x] 1.3 Read the local Chinese rulebook and record the 11-round/four-phase/base-board rules in `design.md`.
- [x] 1.4 Inventory supplied board, card, event, master, servant, wiki-reference, and situation directories; record dimensions and missing/empty sources.
- [x] 1.5 Create the rules-object x asset matrix, source contract, permission matrix, layout contract, and attachment capability matrix.
- [x] 1.6 Validate this change with `openspec validate add-fate-domination-foundation --strict --no-interactive` after the files are authored.

## 2. Approval Gate
- [x] 2.1 Obtain explicit user approval for `add-fate-domination-foundation` and its current scope.
- [x] 2.2 Re-read approved `proposal.md`, `design.md`, and `tasks.md` immediately before implementation.

## 3. Runtime Foundation
- [x] 3.1 Create `src/games/fate-domination/` with the required manifest, domain, data/rule, UI, Board, thumbnail, tutorial/audio/debug/critical-image entry files.
- [x] 3.2 Add typed deterministic setup, state, command, event, validate, execute, reduce, playerView, and game-over/deferred end-state contracts.
- [x] 3.3 Implement the approved demonstration flow: identity assignment, preparation reveal state, deployment, two-card attack selection/confirmation, phase advance, and representative battle settlement.
- [x] 3.4 Register shared action-log and undo systems using a single business command allowlist; keep audio/tutorial/debug statuses aligned with the matrix.
- [x] 3.5 Add focused domain tests for setup, legal/illegal deployment, exactly-two-card selection, inspection without mutation, deterministic reduction, and stale entity rejection.

## 4. Asset Intake And UI
- [x] 4.1 Copy only approved runtime candidates into semantic `public/assets/i18n/zh-CN/fate-domination/**` paths, preserve source aspect ratios, compress to WebP, and generate/validate the asset manifest.
- [x] 4.2 Include the supplied 13 situation fronts and one back as real runtime candidates; keep unverified effects partial and do not create guessed card data.
- [x] 4.3 Add Chinese locale keys for title, phases, commands, statuses, and confirmed card/event labels without duplicating readable card-face rules.
- [x] 4.4 Build the single desktop-first tabletop Board with map anchors, player rail, hand/attack area, event/situation zones, pile counts, action dock, and card inspection overlay.
- [x] 4.5 Add responsive behavior for 1920x1080 desktop and 375x812 mobile, preserving object hierarchy, touch targets, internal scroll, and no-overlap rules.
- [x] 4.6 Add the game-specific visual style contract under `design-system/games/fate-domination.md` and the UI preflight/evaluator evidence required by project standards.

## 5. Real Entry Verification
- [x] 5.1 Run manifest generation and focused game tests.
- [x] 5.2 Start the local development service and open the development verification entry `/dev/fate-domination`; keep the formal product route as `/play/fate-domination/match/:matchId`.
- [x] 5.3 Verify desktop and mobile screenshots: nonblank page, board/card assets loaded, no text overflow or overlap, stable card ratios, and reachable actions.
- [x] 5.4 Exercise browser interactions for card inspection, location selection, two-card selection/confirmation, phase advance, and return from overlay; record screenshot/evidence paths.
- [x] 5.5 Run typecheck/lint and relevant asset validation; report any unrun upload/remote checks as explicit residual risk.

## 6. Explicitly Deferred In This Change
- [ ] 6.1 Full situation deck effects remain deferred until every supplied front is manually transcribed and validated against the rulebook/Wiki.
- [ ] 6.2 Complete master/servant catalog, every attack/event effect, advanced response windows, all elimination/tiebreak rules, and production scoring remain deferred to follow-up changes.
- [ ] 6.3 Full AI strategy, tutorial flow, Fate/Domination audio, and player-visible debug controls remain outside this foundation implementation.
- [ ] 6.4 Remote asset upload, server file-index, Android package, and production URL verification remain outside this local foundation change.
