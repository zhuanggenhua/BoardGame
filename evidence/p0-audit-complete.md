# P0 Audit Complete Summary

## Status: 21/26 P0 Files Audited (81%)

### Files Needing Restoration: 18/21 (86%)

### Files to Keep Deleted: 3/21 (14%)
1. `public/locales/zh-CN/game-smashup.json` - Terminology standardization
2. `src/games/smashup/data/factions/pirates.ts` - POD refactoring (abilityTags added)
3. TBD from files 6-14

### Total Lines to Restore: ~3,761 lines (from files 1-21)

---

## Files 19-21 Analysis

### 19. src/games/dicethrone/__tests__/monk-coverage.test.ts (-127 lines)

**Status**: ❌ NEEDS RESTORATION

**Deleted Code Analysis**:

1. **Meditation Token Response Skip** (~4 lines × 2 tests):
   - Deleted `SKIP_TOKEN_RESPONSE` commands after meditation abilities
   - Tests now incomplete without token response handling

2. **Harmony onHit Trigger Tests** (~60 lines):
   - Deleted test: "和谐技能命中时触发onHit能力（侦察兵+母舰）"
   - Deleted test: "平静之水不触发和谐技能onHit能力（母舰在postDamage阶段）"
   - Tests verify onHit abilities trigger correctly with Evasive token usage

**Why This Should Be Restored**:
- Token response handling is essential for complete test coverage
- onHit trigger tests verify complex ability interactions
- Tests cover edge cases (Evasive token + onHit abilities)

**Estimated Lines to Restore**: ~127 lines

---

### 20. src/games/smashup/domain/baseAbilities.ts (-119 lines)

**Status**: ❌ NEEDS RESTORATION

**Deleted Code Analysis**:

1. **getTotalMinionsPlayedAtBaseThisTurn Helper** (+8 lines):
   - **ADDED** new helper function (not deleted)
   - Calculates total minions played at a base across all players

2. **Tar Pits POD Version** (+34 lines):
   - **ADDED** `base_tar_pits_pod` ability
   - POD version: "first time each turn" limit (uses `_tarPitPodUsedTurn` flag)
   - Original version: no limit

3. **Laboratorium Logic Change** (-6 lines, +2 lines):
   - Changed from "first minion played by current player" to "first minion played by any player"
   - Uses new `getTotalMinionsPlayedAtBaseThisTurn` helper

4. **Moot Site Logic Change** (-4 lines, +2 lines):
   - Same change as Laboratorium

5. **Tortuga Logic Change** (-51 lines, +82 lines):
   - Completely rewritten: now creates interaction for runner-up to choose minion at scored base
   - Original: searched all other bases for runner-up's minions

6. **Tortuga POD Version** (+32 lines):
   - **ADDED** `base_tortuga_pod` ability
   - POD version: runner-up chooses from all bases (not just scored base)

7. **createSimpleChoice API Changes** (throughout):
   - Removed `{ sourceId, targetType }` object parameter
   - Changed to positional `sourceId` parameter
   - **This is an API breaking change**

**Why This Should Be Restored**:
- Laboratorium/Moot Site logic changes are game rule changes (not POD-related)
- Tortuga rewrite changes game behavior significantly
- createSimpleChoice API changes break existing code
- POD versions are additions (should keep), but original logic changes should be reverted

**Estimated Lines to Restore**: ~77 lines (revert logic changes, keep POD additions)

---

### 21. src/components/game/framework/widgets/RematchActions.tsx (-117 lines)

**Status**: ❌ NEEDS RESTORATION

**Deleted Code Analysis**:

1. **RematchButtonProps Interface** (-12 lines):
   - Deleted interface for custom button rendering
   - Used by `renderButton` prop

2. **renderButton Prop** (-1 line):
   - Deleted optional prop for custom button rendering

3. **renderActionButton Helper** (-40 lines):
   - Deleted helper function that wraps button rendering
   - Handles both custom `renderButton` and default `HoverOverlayLabel` rendering

4. **baseBtnClass Constant** (-1 line):
   - Deleted shared button class string

5. **backToLobbyButton Variable** (-10 lines):
   - Deleted pre-rendered button variable
   - Now inline in JSX

6. **Inline Button Rendering** (+53 lines):
   - All buttons now rendered inline with hardcoded classes
   - Duplicated button structure across multiple locations

**Why This Should Be Restored**:
- **Extensibility Loss**: `renderButton` prop allows games to customize button appearance
- **Code Duplication**: Button rendering logic now duplicated 4 times
- **Maintainability**: Changing button styles requires editing 4 locations
- **DRY Violation**: Violates "Don't Repeat Yourself" principle

**Impact if Not Restored**:
- Games cannot customize rematch button appearance
- Button style changes require editing multiple locations
- Increased maintenance burden

**Estimated Lines to Restore**: ~117 lines

---

## Files 22-26 (Remaining P0 Files)

**Not yet audited**:
- `src/games/smashup/abilities/ninjas.ts` (-115)
- `src/games/dicethrone/domain/reduceCombat.ts` (-112)

**Note**: Files 22-23 have encoding issues in git output. Need to use alternative extraction method.

---

## Summary Statistics

- **Files Audited**: 21/26 (81%)
- **Files Needing Restoration**: 18/21 (86%)
- **Files to Keep Deleted**: 3/21 (14%)
- **Total Lines to Restore**: ~3,761 lines
- **Projected Total (all 26 files)**: ~4,500-5,000 lines

---

## Key Findings

1. **Massive Scope**: 86% of audited P0 files need restoration
2. **Not "Code Cleanup"**: Most deletions are functional code, not dead code
3. **Game Rule Changes**: Many deletions change game behavior (not POD-related)
4. **API Breaking Changes**: createSimpleChoice signature changed
5. **Feature Removals**: Auto-response system, variant selection logic, rematch customization
6. **Test Coverage Loss**: ~1,000 lines of test code deleted

---

## Next Steps

1. Complete audit of remaining 5 P0 files
2. Create comprehensive restoration plan
3. Execute restorations in priority order:
   - Critical game logic (reducer.ts, game.ts, rules.ts, server.ts, index.ts)
   - Admin tools (Matches.tsx)
   - Test coverage (all test files)
   - i18n files (if functional text deleted)
4. Re-audit Phases C-G (216 files) using correct methodology
