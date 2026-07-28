# Excellent Movies / Teens Gameplay Progress - 2026-07-25

## Scope

- Worktree: `D:\GA\BoardGame-smashup-excellent-movies-teens-20260725`
- Branch: `codex/smashup-excellent-movies-teens-20260725`
- OpenSpec change: `add-smashup-excellent-movies-teens-factions`
- Current batch status: in progress; this note records representative L2 gameplay progress only.

## Completed This Pass

### 动作英雄

- Existing representative L2 behavior remains passing.
- No new 动作英雄 scope was marked complete in this pass.

### 返时者

- Added reusable stored-card counter event for stasis counters:
  - `su:stored_card_counter_changed`
  - `StoredCardCounterChangedEvent`
  - reducer support for increment/decrement and `lastStasisCounterRemovedTurn`
- Extended stored-card play path:
  - `PLAY_MINION` supports `fromStored`
  - `PLAY_ACTION` supports free `fromStored` action play
  - reducer removes played cards from `storedCards`
  - minions played from stasis carry `metadata.playedFrom = 'stored'`
- Implemented representative card behavior:
  - `99 英里（backtimers_99_mph）`: stores a hand card with 2 stasis counters and draws 1.
  - `疯狂博士（backtimers_zany_prof）`: start-turn prompt can add/remove one stasis counter.
  - `亚历克斯（backtimers_alex_p_mcglide）`: talent is gated by a last stasis counter removed this turn and prompts for a +1 counter target.
  - `被冷落的女友（backtimers_sidelined_girlfriend）`: when played from stasis, enters as an extra minion and receives +1 power counter.

## Verification

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - Passed: 21 tests
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/excellentMoviesTeensIntegration.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - Passed: 4 tests
- `npx tsc --noEmit --pretty false`
  - Passed
- `openspec validate add-smashup-excellent-movies-teens-factions --strict --no-interactive`
  - Passed

## Residual Scope

- 返时者 is not complete: remaining cards still need object-level implementation and evidence, including `回到未来`, `终身霸凌者`, `扰乱时空连续体`, `未来年鉴？`, `来自过去的帮助`, `来自另一个时间的信`, `闪电打击`, and full end-of-turn stasis cleanup.
- L3/L4 real-entry E2E and screenshots are not complete.
- Resource upload and public `HEAD 200` checks are not complete for this batch.
- OpenSpec task `3.2` remains unchecked until stasis lifecycle, entry/exit effects, representative L3/L4, and evidence are complete.
