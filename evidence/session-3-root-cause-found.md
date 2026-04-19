# Session 3: Root Cause Found - rollDie=莲花 Issue

## Problem Summary
Tests fail with phase stuck at `defensiveRoll` instead of advancing to `main2`, and HP values are wrong (42, 38) vs expected (46, 44).

## Root Cause Identified

### The Issue
`resolveEffectsToEvents` in `effects.ts` does NOT break when it encounters a `CHOICE_REQUESTED` event, unlike `TOKEN_RESPONSE_REQUESTED`.

### Evidence Chain

1. **Ability Definition** (`src/games/dicethrone/heroes/monk/abilities.ts` lines 133-168):
   ```typescript
   {
       id: 'taiji-combo',
       effects: [
           // Effect 1: rollDie (timing: 'withDamage')
           {
               action: {
                   type: 'rollDie',
                   conditionalEffects: [
                       { face: DICE_FACE_IDS.LOTUS, triggerChoice: { ... } },
                   ],
               },
               timing: 'withDamage',
           },
           // Effect 2: damage(6) (timing: 'withDamage' by default)
           damage(6, ...),
       ],
   }
   ```

2. **Effect Processing** (`src/games/dicethrone/domain/effects.ts` lines 1149-1266):
   - `resolveEffectsToEvents` processes all `withDamage` effects in order
   - When `rollDie` rolls 莲花, it generates `CHOICE_REQUESTED`
   - **BUT the loop continues** and processes `damage(6)`, generating `DAMAGE_DEALT`
   - Result: `withDamageEvents = [BONUS_DIE_ROLLED, BONUS_DICE_REROLL_REQUESTED (displayOnly), CHOICE_REQUESTED, DAMAGE_DEALT]`

3. **Early Return Check** (`src/games/dicethrone/domain/attack.ts` lines 160-177):
   ```typescript
   const hasChoiceInWithDamage = withDamageEvents.some(e => e.type === 'CHOICE_REQUESTED');
   if (hasTokenResponse || hasInteractiveBonusDiceReroll || hasChoiceInWithDamage) {
       console.log('[attack.ts] Early return from withDamage, not generating ATTACK_RESOLVED');
       attackEvents.push(...withDamageEvents);
       events.push(...attackEvents);
       return events;  // ← Returns early, but DAMAGE_DEALT is already in the array!
   }
   ```

4. **The Bug**:
   - Early return prevents `ATTACK_RESOLVED` from being generated (correct)
   - BUT `DAMAGE_DEALT` event is already in `withDamageEvents` and gets applied (wrong!)
   - This causes damage to be dealt before the choice is resolved
   - Phase gets stuck because the choice halts the flow, but damage was already applied

### Why This Happens
`resolveEffectsToEvents` has a break for `TOKEN_RESPONSE_REQUESTED` (line 1217):
```typescript
if (effectEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED')) {
    break;
}
```

But NO break for `CHOICE_REQUESTED`! So the loop continues and processes subsequent effects.

## The Fix

Add a break for `CHOICE_REQUESTED` in `resolveEffectsToEvents`, right after the `TOKEN_RESPONSE_REQUESTED` check:

```typescript
// TOKEN_RESPONSE_REQUESTED 意味着伤害被挂起等待玩家响应，
// 后续效果（如 rollDie）应在 Token 响应完成后由 resolvePostDamageEffects 执行。
// 此处必须中断，否则 rollDie 会消耗 random 值，导致后续重新执行时 random 队列偏移。
if (effectEvents.some(e => e.type === 'TOKEN_RESPONSE_REQUESTED')) {
    break;
}

// CHOICE_REQUESTED 同样需要中断：用户选择完成前不应执行后续效果
// 例如：taiji-combo 的 rollDie=莲花 产生选择，后续的 damage(6) 应等待选择完成后再执行
if (effectEvents.some(e => e.type === 'CHOICE_REQUESTED')) {
    break;
}
```

## Impact Analysis

### Affected Scenarios
Any ability with multiple `withDamage` effects where an earlier effect can generate `CHOICE_REQUESTED`:
- `taiji-combo`: rollDie (can generate choice) + damage(6)
- Potentially other abilities with similar patterns

### Why This Wasn't Caught Earlier
- Most abilities with choices use `timing: 'preDefense'` (like `zen-forget`)
- `taiji-combo` is one of the few abilities with a choice in `withDamage` timing
- The bug only manifests when the choice is triggered (rollDie=莲花), not for other faces

### Test Coverage Gap
The existing tests for `taiji-combo` only tested the non-choice faces (拳头, 掌, 太极), not the 莲花 face that triggers the choice.

## Next Steps
1. Apply the fix to `src/games/dicethrone/domain/effects.ts`
2. Run the failing tests to verify the fix
3. Check if any other abilities have similar patterns
