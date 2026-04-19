# Session 3: Final Fix Attempt

## Problem
`rollDie=莲花` tests failing with phase stuck at `defensiveRoll` instead of advancing to `main2`

## Root Cause (Confirmed)
`displayOnly` BONUS_DICE_REROLL_REQUESTED events were creating interactions that blocked the game flow.

## Fix Applied
Modified `src/games/dicethrone/domain/systems.ts` to NOT create interactions for `displayOnly` settlements:

```typescript
if (dtEvent.type === 'BONUS_DICE_REROLL_REQUESTED') {
    const payload = (dtEvent as BonusDiceRerollRequestedEvent).payload;
    // displayOnly settlement 不创建交互，不阻塞流程
    if (!payload.settlement.displayOnly) {
        const interaction: EngineInteractionDescriptor = {
            id: `dt-bonus-dice-${payload.settlement.id}`,
            kind: 'dt:bonus-dice',
            playerId: payload.settlement.attackerId,
            data: null,
        };
        newState = queueInteraction(newState, interaction);
    }
}
```

## Results
### Before Fix
- Player 0 HP: 6 (completely wrong)
- Player 1 HP: 0 (completely wrong)
- Phase: `defensiveRoll` (stuck)

### After Fix
- Player 0 HP: 42 (closer, expected 46)
- Player 1 HP: 38 (closer, expected 44)
- Phase: `defensiveRoll` (still stuck)

## Analysis
The HP values improved significantly, which confirms that the `displayOnly` interaction was causing issues. However:

1. **Phase still stuck**: The phase is not advancing after the choice interaction is resolved
2. **HP values still wrong**: 
   - Player 0: 42 vs expected 46 (difference of 4)
   - Player 1: 38 vs expected 44 (difference of 6)

The HP differences suggest that:
- Player 0 is taking 8 damage instead of 4 (meditation反伤)
- Player 1 is taking 12 damage instead of 6 (base damage)

This could mean:
- Damage is being applied twice
- OR the choice interaction is not being resolved correctly
- OR the test is reading an intermediate state

## Next Steps
1. Check if the choice interaction is being resolved correctly
2. Verify that the damage events are only being applied once
3. Check if there are any other blocking conditions preventing the phase advance
4. Consider adding more detailed logging to trace the exact event sequence

## Files Modified
- `src/games/dicethrone/domain/systems.ts` (lines 405-420)
- `src/games/dicethrone/domain/flowHooks.ts` (removed debug logs and displayOnly check)
