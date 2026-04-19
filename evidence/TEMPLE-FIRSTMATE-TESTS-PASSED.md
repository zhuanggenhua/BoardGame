# Temple + First Mate Tests - All Passed ✅

## Test Results

**Status**: ✅ **ALL TESTS PASSED**

**Test File**: `src/games/smashup/__tests__/temple-firstmate-afterscore.test.ts`

**Test Run**: 2026/3/4 11:45:40

```
✓ Temple of Goju + First Mate 时序测试 (3)
  ✓ 场景1: 寺庙移除大副后不再触发移动交互 3ms
  ✓ 场景2: 寺庙上有多个大副，部分被移除 7ms
  ✓ 场景3: _deferredPostScoringEvents 传递（寺庙跳过，大副触发） 2ms

Test Files  1 passed (1)
Tests  3 passed (3)
Duration  51.00s
```

## Test Coverage

### Scenario 1: Temple Removes First Mate
✅ **Passed** - Verifies that when Temple of Goju removes First Mate (puts it back to deck bottom), the First Mate's afterScoring movement interaction does NOT trigger.

**Key Assertions**:
- Temple interaction has `_deferredPostScoringEvents`
- First Mate is removed from base
- No First Mate movement interaction appears
- BASE_CLEARED executes (base is empty)

### Scenario 2: Multiple First Mates, Partial Removal
✅ **Passed** - Verifies that when Temple has multiple First Mates and removes one, only the remaining First Mate triggers its movement interaction.

**Key Assertions**:
- Temple interaction appears first
- first_mate_1 is removed
- first_mate_2 remains on base
- Only first_mate_2's movement interaction appears
- Interaction data contains correct minionUid (first_mate_2)

### Scenario 3: Temple Skips, First Mate Triggers
✅ **Passed** - Verifies that when Temple skips its afterScoring ability, the First Mate's movement interaction triggers correctly with inherited `_deferredPostScoringEvents`.

**Key Assertions**:
- Temple interaction has `_deferredPostScoringEvents`
- Temple skips (doesn't remove First Mate)
- First Mate movement interaction appears
- First Mate interaction inherits `_deferredPostScoringEvents`
- First Mate still on base (BASE_CLEARED hasn't executed yet)

## Technical Details

### Tiebreak Handling
All tests correctly handle Temple of Goju's tiebreak interaction:
```typescript
if ((interaction?.data as any)?.sourceId?.includes('tiebreak')) {
    // Skip tiebreak interaction first
    const result1b = engine.runCommand(state, {
        type: 'RESOLVE_INTERACTION',
        playerId: 'p1',
        payload: {
            interactionId: interaction!.id,
            value: { skip: true },
        },
    });
    // Then check for afterScoring interaction
    interaction = state.sys.interaction?.current;
}
```

### _deferredPostScoringEvents Verification
Tests verify the critical `_deferredPostScoringEvents` mechanism:
```typescript
const ctx = (interaction?.data as any)?.continuationContext;
expect(ctx?._deferredPostScoringEvents).toBeDefined();
expect(ctx?._deferredPostScoringEvents.length).toBeGreaterThan(0);
```

## Why These Tests Matter

1. **Critical Timing Scenario**: Temple + First Mate is explicitly mentioned in `docs/ai-rules/testing-audit.md` as a high-priority test case.

2. **Tests Bug Fix**: Verifies the `_deferredPostScoringEvents` mechanism that was fixed in commit 6ea1f9f (POD commit).

3. **Unique Scenario**: Temple's ability to remove minions creates a unique test case - removed minions should NOT trigger their afterScoring interactions.

4. **Multi-Interaction Chain**: Tests the complex interaction chain: Temple tiebreak → Temple afterScoring → First Mate afterScoring → BASE_CLEARED.

## Comparison with Similar Tests

| Test | Status | Scenarios | Tiebreak Handling |
|------|--------|-----------|-------------------|
| mothership-scout-afterscore-bug.test.ts | ❌ Skipped | 2 | No |
| miskatonic-scout-afterscore.test.ts | ❌ Skipped | 1 | No |
| **temple-firstmate-afterscore.test.ts** | ✅ **Active** | **3** | **Yes** |

## P2 Verification Status Update

### Before
- Temple + First Mate tests: ❌ Missing (identified in P2 verification)
- Priority: ⭐⭐⭐ High (explicitly mentioned in audit docs)

### After
- Temple + First Mate tests: ✅ **Created and Passing**
- Coverage: 3 scenarios (removal, multiple minions, skip)
- Status: Active (not skipped)

## Related Files

### Test Files
- `src/games/smashup/__tests__/temple-firstmate-afterscore.test.ts` - **NEW** ✅
- `src/games/smashup/__tests__/mothership-scout-afterscore-bug.test.ts` - Reference (skipped)
- `src/games/smashup/__tests__/miskatonic-scout-afterscore.test.ts` - Reference (skipped)

### Implementation Files
- `src/games/smashup/domain/baseAbilities.ts` - Temple of Goju implementation
- `src/games/smashup/domain/index.ts` - `_deferredPostScoringEvents` mechanism (line 370)

### Documentation
- `docs/ai-rules/testing-audit.md` - Lists Temple+FirstMate as critical
- `docs/ai-rules/engine-systems.md` - Documents `_deferredPostScoringEvents`

## Next Steps

✅ **Task Complete** - Temple + First Mate timing tests are now:
1. Created
2. Passing
3. Covering all critical scenarios
4. Properly handling tiebreak interactions
5. Verifying `_deferredPostScoringEvents` mechanism

The P2 high-priority test gap has been filled.

