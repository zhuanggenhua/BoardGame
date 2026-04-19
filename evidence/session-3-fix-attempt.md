# Session 3: Fix Attempt - Add CHOICE_REQUESTED Check

## Problem
Tests failing: `rollDie=莲花` tests expect phase to advance to `main2` after `SYS_INTERACTION_RESPOND`, but phase stays at `defensiveRoll`.

## Root Cause
`resolveAttack` function in `attack.ts` was missing `CHOICE_REQUESTED` checks in `withDamage` and `postDamage` phases.

## Fix Applied
Added `CHOICE_REQUESTED` checks in two places:

### 1. After `withDamage` effects (line ~170)
```typescript
const hasChoiceInWithDamage = withDamageEvents.some(e => e.type === 'CHOICE_REQUESTED');
if (hasTokenResponse || hasInteractiveBonusDiceReroll || hasChoiceInWithDamage) {
    attackEvents.push(...withDamageEvents);
    events.push(...attackEvents);
    return events;
}
```

### 2. After `postDamage` effects (line ~180)
```typescript
const postDamageEvents = attackEvents.slice(withDamageEvents.length);
const hasChoiceInPostDamage = postDamageEvents.some(e => e.type === 'CHOICE_REQUESTED');
const hasTokenResponseInPostDamage = postDamageEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED');
const hasBonusDiceRerollInPostDamage = postDamageEvents.some(e =>
    e.type === 'BONUS_DICE_REROLL_REQUESTED'
    && !(e as any).payload?.settlement?.displayOnly
);
if (hasChoiceInPostDamage || hasTokenResponseInPostDamage || hasBonusDiceRerollInPostDamage) {
    events.push(...attackEvents);
    return events;
}
```

## Test Result
Tests still failing with same error: `阶段不匹配: 预期 main2, 实际 defensiveRoll`

## Next Steps
Need to investigate why the fix didn't work. Possible issues:
1. The `CHOICE_REQUESTED` event is being generated but not detected by the check
2. The `flowHalted` flag is not being set correctly by FlowSystem
3. The `autoContinue` logic in `onAutoContinueCheck` is not triggering

## Investigation Needed
- Add debug logging to `resolveAttack` to confirm the `CHOICE_REQUESTED` event is being generated
- Add debug logging to `flowHooks.ts` to confirm `hasAttackChoice` is true
- Check if `flowHalted` is being set to `true` by FlowSystem
- Check if `onAutoContinueCheck` is being called after `SYS_INTERACTION_RESPOND`
