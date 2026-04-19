# Temple + First Mate Test Progress

## Status: In Progress

## Test File Created
- `src/games/smashup/__tests__/temple-firstmate-afterscore.test.ts`

## Test Structure
- 3 test cases covering Temple + First Mate afterScoring interaction chain
- Uses FlowHooks approach (like baseAbilityIntegrationE2E.test.ts)
- Uses test helpers (makeState, makeBase, makeMinion, etc.)

## Current Issues

### Test 1 & 3: No Interaction Created
- **Expected**: Temple base ability creates interaction
- **Actual**: `ms.sys.interaction?.current` is `undefined`
- **Possible Cause**: Base power not reaching breakpoint (need to verify minion powers)

### Test 2: Wrong Interaction Source
- **Expected**: `'base_temple_of_goju'`
- **Actual**: `'base_temple_of_goju_tiebreak'`
- **Cause**: Temple base has a tiebreaker ability that triggers first
- **Solution**: Need to handle tiebreaker interaction first, then check for Temple ability

## Next Steps
1. Check Temple base definition to understand tiebreaker ability
2. Verify minion powers add up to breakpoint
3. Update tests to handle tiebreaker interaction if needed
4. Or adjust test setup to avoid tiebreaker scenario

## Logs from Test 2
```
[onPhaseExit] scoreBases 基地过滤: {  
  lockedIndices: [ 0 ],
  scoredBaseIndices: [],
  scoredBaseIndicesRef: '[]',
  remainingIndices: [ 0 ],
  flowHalted: undefined,
  hasInteraction: false
}
[onPhaseExit] 记分基地: { iter: 0, foundIndex: 0, baseDefId: 'base_temple_of_goju' }
[scoreOneBase] 开始计分: {
  baseIndex: 0,
  baseDefId: 'base_temple_of_goju',   
  timestamp: 0,
  hasInteraction: false,
  interactionId: undefined
}
[InteractionSystem] popInteraction: No current, making new interaction current: {
  interactionId: 'base_temple_of_goju_tiebreak_0',
  kind: 'simple-choice'
}
```

The logs show that:
1. Base scoring is triggered
2. Tiebreaker interaction is created first (`base_temple_of_goju_tiebreak_0`)
3. This is expected behavior - Temple base has a tiebreaker ability

## Solution
Need to either:
1. Resolve tiebreaker interaction first, then check for Temple ability
2. Or adjust test setup to avoid tiebreaker (ensure p1 has clear majority)
