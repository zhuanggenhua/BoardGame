# Surgeon Ability E2E Test Fix - Progress Report

## Problem Identified

The surgeon ability test was failing because **interactions returned by ability executors were not being queued into `sys.interaction`**.

## Root Cause Analysis

1. **Ability executors return interactions** - The surgeon ability executor (and others) return `{ events: [], interaction }` when they need player input
2. **Execute function ignored interactions** - The `executeActivateAbility` function in `execute.ts` only handled `result.events`, completely ignoring `result.interaction`
3. **No system to queue interactions** - There was no mechanism to convert ability executor interactions into engine system interactions

## Solution Implemented

### Phase 1: Event-Based Interaction Queueing ✅

1. **Added new event type** (`ABILITY_INTERACTION_REQUESTED`) to `events.ts`
2. **Updated execute.ts** to emit this event when an executor returns an interaction
3. **Updated systems.ts** to listen for this event and queue the interaction

### Phase 2: Interaction Data Structure Conversion ✅

1. **Created `wrapCardiaInteraction` function** in `systems.ts` that:
   - Wraps Cardia's custom interaction types in engine's `simple-choice` format
   - Converts `availableCards` (UIDs) to full card objects by looking them up in core state
   - Adds `interactionType` field for Board.tsx to recognize the interaction type
   - Preserves original Cardia interaction data in `data.cardiaInteraction`

2. **Data structure mapping**:
   ```typescript
   CardiaInteraction (from executor)
   → wrapCardiaInteraction()
   → InteractionDescriptor (engine format)
     data: {
       interactionType: 'card-selection',  // For Board.tsx
       cards: PlayedCard[],                // Full card objects
       minSelect: number,
       maxSelect: number,
       cardiaInteraction: CardiaInteraction  // Original data
     }
   ```

## Test Results

### Before Fix
```
交互状态: {
  hasInteraction: false,
  interactionType: undefined,
  interactionId: 'ability_i_surgeon_1772285346626',
  availableCards: undefined
}
```
❌ Modal did not appear

### After Fix
```
交互状态: {
  hasInteraction: true,
  interactionType: 'card-selection',
  interactionId: 'ability_i_surgeon_1772285474012',
  availableCards: 1
}
```
✅ Modal appears
✅ Card selection works
⚠️ Test times out when clicking confirm button

## Remaining Issues

### Issue: Confirm Button Click Timeout

The test successfully:
1. ✅ Activates the ability
2. ✅ Shows the modal
3. ✅ Selects a card
4. ❌ Times out when clicking "确认" (confirm) button

**Possible causes**:
1. The `CHOOSE_CARD` command handler might not be implemented correctly
2. The interaction resolution might not be working
3. The modal might not be closing after confirmation

**Next steps**:
1. Check if `CHOOSE_CARD` command is properly handled in `execute.ts`
2. Verify interaction resolution logic
3. Add debug logging to see what happens after confirm button click
4. Check if the modal close logic is working

## Files Modified

1. `src/games/cardia/domain/events.ts` - Added `ABILITY_INTERACTION_REQUESTED` event
2. `src/games/cardia/domain/execute.ts` - Emit interaction event when executor returns interaction
3. `src/games/cardia/domain/systems.ts` - Listen for interaction events and queue them with proper data structure

## Architecture Notes

### Cardia's Dual Interaction System

Cardia uses a hybrid approach:
- **Custom interaction types** (`CardiaInteraction` in `interactionHandlers.ts`) for domain logic
- **Engine InteractionSystem** (`simple-choice`) for state management and UI integration
- **Bridge layer** in `systems.ts` converts between the two

This is different from other games:
- **DiceThrone**: Creates interactions directly in systems' `afterEvents` hooks
- **SmashUp**: Uses interaction handler registry pattern
- **Cardia**: Executors return interactions, systems convert and queue them

### Why This Approach?

1. **Simpler executor logic** - Executors can directly return what they need without knowing about engine internals
2. **Type safety** - Cardia-specific interaction types are strongly typed
3. **Flexibility** - Can add new interaction types without modifying engine

## Lessons Learned

1. **Always check the full data flow** - From executor → execute → events → systems → state → UI
2. **Data structure mismatches are common** - Different layers expect different formats
3. **Debug output is essential** - The test's debug logging helped identify exactly where the problem was
4. **Read existing patterns first** - Looking at how DiceThrone handles interactions provided the solution pattern

## Next Actions

1. Investigate confirm button timeout issue
2. Verify `CHOOSE_CARD` command handling
3. Test other abilities that use interactions (Genius, Messenger, Librarian)
4. Update other E2E tests to use the same pattern
