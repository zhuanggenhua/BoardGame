# Change: Refactor Smash Up reaction resource model

## Why

Smash Up reaction ordering currently depends on manually declared `effectContract` buckets such as `minionBoardState` and `handState`. These buckets are not the actual resources touched by effects; they are a second, duplicated truth source. As the card pool grows, this design creates false ordering prompts, missed optional semantics, and permanent maintenance debt because every trigger must keep its effect logic and its hand-written footprint in sync.

The current issue around Mushroom Kingdom, Sprout, and The Bride exposed the architectural flaw: the system should not ask players to resolve artificial conflicts caused by coarse buckets, and optional titan specials should not be modeled as mandatory ordering items or generic prompt buttons.

## What Changes

- Introduce a centralized, strongly typed Smash Up reaction resource model (`ResourceRef` / `ResourceFootprint`) for concrete entities such as minions, bases, players, decks, hands, cards, titans, source instances, and global turn resources.
- Replace hand-written coarse `effectContract` as the primary ordering truth with automatic footprint derivation from:
  - emitted `SmashUpEvent` payloads,
  - queued interaction options / target descriptors,
  - trigger source context (`sourceCardUid`, `sourceBaseIndex`, `sourceControllerId`, `titanUid`),
  - timing/frame context.
- Keep explicit fallback declarations only for effects whose influence cannot be derived, and make those fallbacks auditable exceptions rather than the normal path.
- Split mixed mandatory/optional trigger semantics so mandatory bookkeeping or forced effects do not drag optional choices into mandatory ordering.
- Change回合开始 optional titan special 的主交互入口：不再以通用 `smashup_reaction_choose` 弹窗询问“要不要打出”，而是在合法窗口高亮/点击泰坦本体执行，并保留明确跳过入口。
- Remove or downgrade legacy `effectContract` enforcement once the new derivation path is covered by tests.

## Impact

- Affected specs:
  - `smashup-reaction-resource-model` (new)
  - `interaction-system` (optional-titan click surface scenarios)
- Affected code:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/reactionOrdering.ts`
  - `src/games/smashup/domain/reactionSession.ts`
  - `src/games/smashup/domain/triggerEffectContract.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/baseAbilityQueue.ts`
  - `src/games/smashup/abilities/**`
  - `src/games/smashup/Board.tsx` and titan/base UI surfaces
  - Smash Up unit tests, E2E, and evidence docs

## Compatibility

This is an intentional architecture replacement. During migration, legacy `effectContract` may exist only as fallback/assertion data. It must not remain the primary source of ordering decisions.
