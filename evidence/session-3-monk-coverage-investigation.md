# Session 3: Monk Coverage Test Investigation

## Problem

Tests failing:
- `rollDie=莲花: 基础6伤害+获得闪避Token`
- `rollDie=莲花: 基础6伤害+获得净化Token`

Error: `阶段不匹配: 预期 main2, 实际 defensiveRoll`

## Test Flow

```typescript
cmd('ADVANCE_PHASE', '1'),  // defensiveRoll 退出，触发攻击结算，rollDie 产生 choice，halt
cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }), // 选择闪避
// Expected: phase should automatically advance to main2 via autoContinue
// Actual: phase stays at defensiveRoll
```

## Expected Behavior

1. `ADVANCE_PHASE` → `onPhaseExit` returns `{ halt: true }` → FlowSystem sets `sys.flowHalted = true` → phase stays at `defensiveRoll`
2. `SYS_INTERACTION_RESPOND` → interaction resolved → `onAutoContinueCheck` sees `sys.flowHalted = true` and no active interaction → returns `{ autoContinue: true }` → FlowSystem calls `ADVANCE_PHASE` automatically → phase advances to `main2`

## Actual Behavior

Debug output shows:
```
[DEBUG] onAutoContinueCheck defensiveRoll: {
    phase: 'defensiveRoll',
    flowHalted: false,  // ❌ Should be true
    hasPendingDamage: false
}
```

`sys.flowHalted` is `false` when `onAutoContinueCheck` is called, which prevents `autoContinue` from triggering.

## Root Cause Analysis

### Hypothesis 1: `flowHalted` was never set to `true`
- When `onPhaseExit` returns `{ halt: true }`, FlowSystem should set `sys.flowHalted = true`
- But debug output shows it's `false`, suggesting it was never set

### Hypothesis 2: `flowHalted` was cleared too early
- `flowHalted` might be set to `true` initially, but then cleared when the interaction is resolved
- By the time `onAutoContinueCheck` is called, it's already `false`

## Investigation Findings

1. **Other tests work correctly**: Similar tests in `paladin-coverage.test.ts` use the same pattern (`ADVANCE_PHASE` → `SYS_INTERACTION_RESPOND` → expect auto-continue) and pass
2. **Code path analysis**: The failing test executes the following path in `onPhaseExit`:
   - `from='defensiveRoll'`
   - `core.pendingAttack` exists
   - `core.pendingAttack.damageResolved` is `false` (not in the `damageResolved` branch)
   - Execute `resolveAttack` → produces `CHOICE_REQUESTED` event
   - `hasAttackChoice` is `true` → return `{ events, halt: true }`
3. **Line 607 fix was incorrect**: Changed `halt: true` to `overrideNextPhase: 'main2'`, but this is in the `damageResolved` branch which is not executed in the failing test

## Attempted Fixes

### Fix 1: Change line 607 to `overrideNextPhase: 'main2'`
- **Status**: ❌ Failed
- **Reason**: This is in the wrong branch (`damageResolved`), which is only executed when damage has already been resolved via Token response

### Fix 2: Revert line 607 and add debug logging
- **Status**: ⏸️ In progress
- **Findings**: Confirmed that `sys.flowHalted` is `false` when `onAutoContinueCheck` is called

## Next Steps

1. **Investigate FlowSystem**: Need to understand why `sys.flowHalted` is not being set correctly
   - Check if there was a recent change in FlowSystem that broke this behavior
   - Check if `onPhaseExit` returning `{ halt: true }` correctly sets `sys.flowHalted`
2. **Check POD commit**: The summary mentions commit `6ea1f9f` modified 512 files - check if this broke the `flowHalted` logic
3. **Alternative approach**: If `flowHalted` cannot be fixed, consider changing the test to manually call `ADVANCE_PHASE` after `SYS_INTERACTION_RESPOND` (but this would be inconsistent with other tests)

## Code Locations

- **Failing tests**: `src/games/dicethrone/__tests__/monk-coverage.test.ts` lines 288-383
- **onPhaseExit logic**: `src/games/dicethrone/domain/flowHooks.ts` lines 590-680
- **onAutoContinueCheck logic**: `src/games/dicethrone/domain/flowHooks.ts` lines 740-800
- **Line 607**: The `damageResolved` branch that was incorrectly modified

## Related Tests

- `paladin-coverage.test.ts` line 301: Similar pattern, passes
- `monk-coverage.test.ts` lines 97, 139: Similar pattern (preDefense choice), passes
- `monk-coverage.test.ts` lines 317, 365: Failing tests (postDamage choice)

## Key Difference

- **Passing tests**: Choice happens in `preDefense` phase (before attack resolution)
- **Failing tests**: Choice happens in `postDamage` phase (after attack resolution, during `rollDie`)

This suggests the issue might be specific to choices that happen during `rollDie` effects in the `postDamage` phase.
