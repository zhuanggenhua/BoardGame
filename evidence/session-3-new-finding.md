# Session 3: New Finding - rollDie IS Executing

## Previous Hypothesis (WRONG)
We thought the `rollDie` effect was not being executed at all.

## New Finding
The logs show that the `rollDie` effect IS being executed:

```
[effects.ts] All effects: 2 effects: [0] type=rollDie timing=withDamage, [1] type=damage timing=auto
[effects.ts] Processing effect, action.type: rollDie timing: withDamage
[effects.ts] rollDie case reached, random: true conditionalEffects: true
```

## The Real Issue
The test is running for MULTIPLE TURNS instead of ending after the first attack.

### Evidence
1. Test expects: `turnPhase: 'main2'` (end of first turn)
2. Logs show: Phase advancing through multiple turns (upkeep → income → main1 → offensiveRoll → defensiveRoll → main2 → discard → upkeep → income → main1 → ...)
3. The test continues running instead of stopping after the first attack

### Why This Happens
The fix we applied (breaking on `CHOICE_REQUESTED`) is working correctly - it prevents the `damage(6)` effect from being executed when the choice is triggered.

BUT this creates a new problem:
- The attack doesn't complete (no `ATTACK_RESOLVED` event)
- The choice is created and should halt the flow
- BUT something is causing the game to continue advancing phases instead of waiting for the choice to be resolved

### Next Steps
1. Check if the choice is being created correctly
2. Check if the interaction system is properly halting the flow
3. Check if there's an auto-continue logic that's bypassing the choice

## Hypothesis
The `CHOICE_REQUESTED` event is being generated, but:
- Either it's not being added to `sys.interaction.queue`
- Or the interaction system is not halting the flow properly
- Or there's an auto-continue logic that's advancing the phase before the choice is resolved
