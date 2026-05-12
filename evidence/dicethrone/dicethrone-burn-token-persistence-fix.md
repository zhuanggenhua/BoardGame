# DiceThrone 燃烧 Token 持续性修复

## 结论

Burn 以图片为准，必须统一为：

- 不可叠加，`stackLimit: 1`
- 维持阶段固定 2 点伤害
- 持续存在，不因 upkeep 自动移除

## 已同步的修复面

- `src/games/dicethrone/heroes/pyromancer/tokens.ts`
- `src/games/dicethrone/domain/customActions/pyromancer.ts`
- `src/games/dicethrone/domain/reducer.ts`
- `src/games/dicethrone/domain/flowHooks.ts`
- `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts`
- `src/games/dicethrone/__tests__/token-execution.test.ts`
- `src/games/dicethrone/__tests__/shared-state-consistency.test.ts`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`

## 旧脏状态处理

历史上可能存在 Burn=3 的脏状态。当前实现会在 upkeep 结算时把非法多层归一为 1，避免继续展示为可叠层规则。

## 自然消失校验

Burn 已补跨多个自己 upkeep 的回归测试：连续两轮 upkeep 后，HP 会继续按 2/轮下降，但 Burn 仍保持 1，不会自然消失。

## 备注

本文档替代旧的“Burn 可有多层但固定伤害”口径；旧 `stackLimit=3` 结论已经失效，不再作为当前实现依据。

## 验证

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/pyromancer-tokens.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/shared-state-consistency.test.ts src/games/dicethrone/__tests__/pyromancer-behavior.test.ts --configLoader native --maxWorkers 1
```

- 结果：`5 passed / 157 tests passed`
