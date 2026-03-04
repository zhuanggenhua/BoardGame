# Code Review Report - Pre-Commit Analysis

## Executive Summary

This is a large commit with **93 files changed** (6,953 insertions, 905 deletions). I've identified **several critical bugs** and **potential issues** that should be addressed before committing.

---

## 🔴 CRITICAL BUGS

### 1. ~~**Race Condition in RevealOverlay.tsx**~~ ✅ FALSE POSITIVE
**File**: `src/games/smashup/ui/RevealOverlay.tsx`  
**Lines**: 73-85

**Status**: ❌ **NOT A BUG** - This is the CORRECT implementation

**Analysis**: 
After reviewing `useEventStreamCursor` implementation, I found that:

1. **`consumeNew()` is called BEFORE the early return**:
   ```typescript
   const { entries: newEntries, didReset } = consumeNew();  // ✅ Called first
   
   if (isFirstMount.current) {
       isFirstMount.current = false;
       return;  // ✅ Cursor already advanced inside consumeNew()
   }
   ```

2. **`consumeNew()` handles first-call internally**:
   ```typescript
   // From useEventStreamCursor.ts
   if (isFirstCallRef.current) {
       isFirstCallRef.current = false;
       if (curLen > 0) {
           lastSeenIdRef.current = entries[curLen - 1].id;  // ✅ Advances cursor
       }
       return { entries: [], didReset: false };  // Returns empty
   }
   ```

3. **The pattern is correct**:
   - First call to `consumeNew()` advances the internal cursor and returns `[]`
   - Component's `isFirstMount` check then returns early (no-op)
   - Second call to `consumeNew()` only returns NEW events after the cursor

**Conclusion**: The code is working as designed. The cursor IS advanced on first mount.

---

### 2. **Missing sourcePlayerId in MINION_RETURNED Events** ⚠️ MINOR ISSUE
**Files**: Multiple ability files (`aliens.ts`, `wizards.ts`, etc.)

**Status**: ⚠️ **OPTIONAL FIELD** - Not critical, but good to have

**Analysis**:
After checking the type definition:

```typescript
export interface MinionReturnedEvent extends GameEvent<'su:minion_returned'> {
    payload: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toPlayerId: PlayerId;
        reason: string;
        sourcePlayerId?: PlayerId;  // ✅ Optional field
    };
}
```

**Findings**:
1. `sourcePlayerId` is an **optional field** (marked with `?`)
2. The code is **type-safe** - TypeScript doesn't complain about missing optional fields
3. ActionLog doesn't currently use `sourcePlayerId` for MINION_RETURNED events
4. The field is useful for debugging and future features

**Recommendation**: 
- ✅ **Keep the changes** - Adding `sourcePlayerId` improves event traceability
- This is a **quality improvement**, not a bug fix
- No functional impact if omitted

**Impact**: LOW - Optional field for better debugging/logging

---

### 3. ~~**Potential Memory Leak in CardPreview.tsx**~~ ✅ FALSE POSITIVE
**File**: `src/components/common/media/CardPreview.tsx`  
**Lines**: 137-142

**Status**: ❌ **NOT A BUG** - `getCardAtlasSource` is synchronous

**Analysis**:
After reviewing the implementation:

```typescript
// From cardAtlasRegistry.ts
export function getCardAtlasSource(id: string, locale?: string): CardAtlasSource | undefined {
    const resolved = cardAtlasRegistry.get(id);  // ✅ Synchronous Map lookup
    if (resolved) return resolved;

    const lazy = lazyRegistry.get(id);  // ✅ Synchronous Map lookup
    if (!lazy) return undefined;

    const img = getPreloadedImageElement(lazy.image, locale);  // ✅ Synchronous cache lookup
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        // ... synchronous config generation
        return source;
    }
    return undefined;
}
```

**Findings**:
1. `getCardAtlasSource` is **100% synchronous** - no async operations
2. It only does Map lookups and reads cached HTMLImageElement properties
3. No network requests, no promises, no async/await
4. State update happens immediately in the same tick

**Conclusion**: No cleanup needed. The original concern about "async operation" was incorrect.

**Impact**: NONE - No bug exists

---

## ⚠️ POTENTIAL ISSUES

### 4. **Inconsistent Error Handling in Wizard Neophyte**
**File**: `src/games/smashup/abilities/wizards.ts`  
**Lines**: 432-487

**Issue**: The new ongoing card handling path doesn't have the same error handling as the non-ongoing path:

```typescript
// Non-ongoing path has executor check
const executor = resolveOnPlay(defId);
if (executor) {
    // ... execute
} else {
    console.warn('[wizard_neophyte] 行动卡没有注册 onPlay 能力:', defId);
}

// Ongoing path ALSO has executor check but different warning
const executor = resolveOnPlay(defId);
if (executor) {
    // ... execute
}
// ❌ No warning if executor is missing
```

**Recommendation**: Add consistent warning for ongoing cards without executors

---

### 5. **Alien Probe Card Filtering Logic Change**
**File**: `src/games/smashup/abilities/aliens.ts`  
**Lines**: 296-339

**Issue**: Changed from showing ONLY minions to showing ALL cards (with non-minions disabled):

```typescript
// OLD: Only show minion cards
const minionCards = targetPlayer.hand.filter(c => c.type === 'minion');
const minionOptions = minionCards.map(card => { ... });

// NEW: Show all cards, disable non-minions
const allHandOptions = targetPlayer.hand.map(card => {
    const isMinion = card.type === 'minion';
    return {
        id: card.uid,
        label: def?.name ?? card.defId,
        value: { ... },
        disabled: !isMinion,  // ⚠️ Shows but disables
    };
});
```

**Concern**: 
- This reveals information about non-minion cards in opponent's hand
- Original implementation only showed minions (hiding other card types)
- **Is this intentional or a bug?**

**Recommendation**: Verify with game rules whether opponent should see ALL cards or only minions

---

### 6. **Supreme Overlord Can Now Return Self**
**File**: `src/games/smashup/abilities/aliens.ts`  
**Lines**: 57-59

**Issue**: Removed the self-exclusion check:

```typescript
// OLD: Cannot return self
if (m.uid === ctx.cardUid) continue; // 排除自身

// NEW: Can return self
// Wiki 描述："You may return a minion to its owner's hand."
// 没有说 "another minion"，所以可以返回自己
```

**Concern**:
- This is a significant gameplay change
- Need to verify this matches the official rules
- Could be exploited for infinite loops or unintended combos

**Recommendation**: Double-check Wiki/official rules to confirm this is correct

---

## ✅ GOOD CHANGES

### 7. **Socket.io Transport Fallback**
**File**: `src/engine/transport/client.ts`

```typescript
// OLD: WebSocket only
transports: ['websocket'],

// NEW: WebSocket with polling fallback
transports: ['websocket', 'polling'],
```

**Good**: Improves connection reliability in restrictive network environments

---

### 8. **Base Power Modifier System**
**File**: `src/games/smashup/domain/ongoingModifiers.ts`

**Good**: New `BasePowerModifierFn` system provides a clean, extensible way to add base-level power modifiers (like Steampunk Aggromotive)

---

### 9. **Comprehensive ActionLog Coverage**
**File**: `src/games/smashup/actionLog.ts`

**Good**: Added formatters for many missing event types:
- `REVEAL_HAND`
- `REVEAL_DECK_TOP`
- `PERMANENT_POWER_ADDED`
- `TEMP_POWER_ADDED`
- `ONGOING_CARD_COUNTER_CHANGED`
- `BREAKPOINT_MODIFIED`
- `BASE_DECK_SHUFFLED`
- `SPECIAL_LIMIT_USED`
- `ABILITY_FEEDBACK`
- `ABILITY_TRIGGERED`
- `BASE_CLEARED`
- `DECK_REORDERED`
- `FACTION_SELECTED`

---

## 📊 STATISTICS

- **Total Files Changed**: 93
- **Insertions**: 6,953
- **Deletions**: 905
- **Critical Bugs**: 0 ✅ (2 false positives identified)
- **Minor Issues**: 1 (optional field)
- **Potential Issues**: 4 (need verification)
- **Good Changes**: 3

---

## 🎯 RECOMMENDATIONS

### ✅ Safe to Commit - No Critical Bugs Found

After detailed verification:
- ❌ Bug #1 (RevealOverlay): **FALSE POSITIVE** - Code is correct
- ⚠️ Bug #2 (sourcePlayerId): **OPTIONAL FIELD** - Good to have, not required
- ❌ Bug #3 (CardPreview): **FALSE POSITIVE** - Function is synchronous

### Optional Improvements (Not Blocking):

1. **KEEP**: `sourcePlayerId` additions (improves debugging)
2. **VERIFY**: Alien Probe card visibility change (Issue #5) - Check game rules
3. **VERIFY**: Supreme Overlord self-return rule (Issue #6) - Check game rules
4. **CONSIDER**: Consistent error handling in Wizard Neophyte (Issue #4)

### Testing Checklist:

- [x] ~~Test RevealOverlay after page refresh~~ - Code is correct, no bug
- [x] ~~Test ActionLog shows correct player~~ - Optional field, not critical
- [ ] Test Alien Probe interaction (verify card visibility matches rules)
- [ ] Test Supreme Overlord can/cannot return self (verify against rules)
- [ ] Test Wizard Neophyte with ongoing cards
- [ ] Test socket connection in restrictive networks (polling fallback)

---

## 📝 NOTES

This is a well-structured commit with good separation of concerns. The majority of changes are solid improvements (ActionLog coverage, base power modifiers, socket reliability). However, the critical bugs should be fixed before merging to avoid production issues.

The codebase shows good practices:
- Comprehensive testing (many new test files)
- Detailed documentation (bug analysis files)
- Consistent code style
- Good use of TypeScript types

---

## 🔍 VERIFICATION SUMMARY

### False Positives Identified:
1. **RevealOverlay "race condition"**: Incorrect analysis - `consumeNew()` is called before early return, and it handles first-call internally
2. **CardPreview "memory leak"**: Incorrect assumption - `getCardAtlasSource()` is synchronous, not async

### Root Cause of False Positives:
- Insufficient understanding of `useEventStreamCursor` internal implementation
- Incorrect assumption that `getCardAtlasSource` was async based on naming convention

### Lessons Learned:
- Always verify function implementations before reporting bugs
- Don't assume async behavior without checking the code
- Optional TypeScript fields are not bugs

---

**Generated**: 2026-03-02  
**Updated**: 2026-03-02 (After verification)  
**Reviewer**: Kiro AI Code Review System
