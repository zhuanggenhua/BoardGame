## 1. Implementation
- [ ] 1.1 让 queued base ability / extended base ability 在收集与执行两侧都强制 require effect contract
- [ ] 1.2 为 queued base ability 执行路径套用与普通 trigger 相同的 runtime read / interaction guard
- [ ] 1.3 补齐现有 Smash Up 基地能力缺失的 effectContract 与 opensInteraction 声明
- [ ] 1.4 校正基地能力 footprint，使无冲突 mandatory trigger 不再误入排序选择

## 2. Validation
- [ ] 2.1 `npx eslint src/games/smashup/domain/baseAbilityQueue.ts src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/abilities/ancient_egyptians.ts src/games/smashup/abilities/cowboys.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts`
- [ ] 2.2 `npx vitest run src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/reactionQueueBaseOptionalClockwise.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
- [ ] 2.3 `openspec validate refactor-smashup-base-ability-effect-contract-enforcement --strict --no-interactive`
