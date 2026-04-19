# Session 3: displayOnly Settlement Investigation

## Problem
Tests failing with phase mismatch: expected `main2`, actual `defensiveRoll`

## Root Cause Analysis

### Event Flow
1. `defensiveRoll` phase exit → calls `resolveAttack`
2. `resolveAttack` → calls `resolveEffectsToEvents` for `withDamage` timing
3. `resolveEffectsToEvents` → calls `resolveEffectAction` for `rollDie` effect
4. `resolveEffectAction` (rollDie case) generates 3 events:
   - `BONUS_DIE_ROLLED` (value: 6, face: lotus)
   - `CHOICE_REQUESTED` (from `resolveConditionalEffect`)
   - `BONUS_DICE_REROLL_REQUESTED` (displayOnly settlement)

### Detection in attack.ts
```typescript
const hasChoiceInWithDamage = withDamageEvents.some(e => e.type === 'CHOICE_REQUESTED');
// hasChoiceInWithDamage = true ✅

const hasInteractiveBonusDiceReroll = withDamageEvents.some(e =>
    e.type === 'BONUS_DICE_REROLL_REQUESTED'
    && !(e as any).payload?.settlement?.displayOnly
);
// hasInteractiveBonusDiceReroll = false ✅ (correctly filtered out displayOnly)

if (hasChoiceInWithDamage || ...) {
    return { events, halt: true }; // ✅ Correctly halts
}
```

### Interaction Queue
After `defensiveRoll` phase exit with `halt: true`, two interactions are created:
1. `choice-taiji-combo-9` (kind: 'simple-choice') - from CHOICE_REQUESTED
2. `dt-bonus-dice-taiji-combo-display-9` (kind: 'dt:bonus-dice') - from displayOnly settlement

### Auto-Continue Check
After user responds to the choice interaction (`SYS_INTERACTION_RESPOND`), the `onAutoContinueCheck` is called:

```typescript
if (phase === 'offensiveRoll' || phase === 'defensiveRoll') {
    if (!state.sys.flowHalted) return undefined;

    const currentInteraction = state.sys.interaction?.current;
    const isDisplayOnlySettlement = currentInteraction?.kind === 'dt:bonus-dice' 
        && (currentInteraction as any).data?.settlement?.displayOnly === true;
    const hasActiveInteraction = currentInteraction !== undefined && !isDisplayOnlySettlement;
    
    if (!hasActiveInteraction && !hasActiveResponseWindow && !hasPendingDamage && !pendingOffensiveTokenChoice) {
        return { autoContinue: true, playerId: getRollerId(core, phase) };
    }
    return undefined;
}
```

## Hypothesis
The `displayOnly` settlement interaction is still in the queue after the choice is resolved, blocking the auto-continue.

## Fix Attempt
Modified `onAutoContinueCheck` to treat `displayOnly` settlements as non-blocking:
- Check if `currentInteraction.kind === 'dt:bonus-dice'` AND `data.settlement.displayOnly === true`
- If yes, treat it as if there's no active interaction

## Status
Fix applied, need to verify with test run and debug logs.

## Next Steps
1. Add debug logging to see what `currentInteraction` looks like after choice is resolved
2. Verify that `isDisplayOnlySettlement` is correctly detecting the displayOnly flag
3. Check if there are other blocking conditions preventing auto-continue
