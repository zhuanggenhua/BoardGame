## 1. Implementation
- [x] 1.1 为 Smash Up reaction ordering 增加实例级 footprint 资源解析，移除宽泛 `sourceState` 语义
- [x] 1.2 重构 mandatory frame 推进逻辑，按冲突分量而不是整帧全量展示 `smashup_reaction_choose`
- [x] 1.3 更新现有 Smash Up footprint 声明到新的自来源实例语义
- [x] 1.4 补齐并通过针对《泛滥横行》/自毁类 trigger 的回归测试

## 2. Validation
- [x] 2.1 `npx eslint src/games/smashup/domain/types.ts src/games/smashup/domain/reactionOrdering.ts src/games/smashup/domain/reactionSession.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts`
- [x] 2.2 `npx vitest run src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts`
- [x] 2.3 `openspec validate refactor-smashup-reaction-ordering-footprints --strict --no-interactive`
