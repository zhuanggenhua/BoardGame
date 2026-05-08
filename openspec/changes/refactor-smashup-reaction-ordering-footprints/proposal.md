# Change: Refactor Smash Up reaction ordering footprints

## Why

当前 Smash Up 的 reaction ordering 仍把一部分“只影响自身来源牌状态”的 mandatory trigger 粗暴建模成通用 `sourceState`。这会带来两个错误：

- 不同来源实例的自收口 trigger 被误判为互相冲突；
- 只要同一 frame 里有任何真实冲突 trigger，UI 就会把整帧所有 mandatory trigger 一起暴露到 `smashup_reaction_choose`，导致像《泛滥横行》这种“只在回合开始自毁自身”的牌也被错误展示为可排序项。

这不是规则需要的排序权，而是内部 footprint 资源模型与 mandatory frame 展示模型都过粗。

## What Changes

- 废除 Smash Up reaction ordering 中宽泛的自来源状态桶语义，改为**实例级资源解析**
- 让 mandatory frame 按**冲突连通分量**而不是“整帧全量”推进
- 自动收口与任何 trigger 都不冲突的 singleton mandatory trigger
- `smashup_reaction_choose` 只展示当前真正需要排序的冲突分量，不再把无关 mandatory trigger 一起列出来
- 为《泛滥横行》这类“仅自毁自身”的回合开始 trigger 补回归，确保不再因为粗粒度 footprint 被错误拉进排序选择

## Impact

- Affected specs:
  - `smashup-reaction-ordering`（new）
- Affected code:
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/reactionSession.ts`
  - `src/games/smashup/domain/reactionOrdering.ts`（new）
  - `src/games/smashup/abilities/**`
  - `src/games/smashup/__tests__/reactionQueueOrdering.test.ts`
  - `src/games/smashup/__tests__/zombieInteractionChain.test.ts`
