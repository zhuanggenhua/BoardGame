# SmashUp AI 增益目标语义修复（2026-04-08）

## 用户反馈

- 大杀四方 AI 在目标交互里会把增益效果给错目标，甚至给到敌方。

## 本轮修复点

- 为交互选项补充 AI-only hints，避免 AI 再依赖候选顺序碰运气：
  - `src/engine/ai/types.ts`
  - `src/engine/ai/snapshots.ts`
  - `src/engine/systems/InteractionSystem.ts`
  - `src/games/smashup/ai.ts`
  - `src/games/smashup/domain/abilityHelpers.ts`
- `buildMinionTargetOptions(...)` 现在会基于目标随从的 controller / owner 和 effectType 自动产出 `_ai` 语义：
  - `relationToActor`
  - `effectIntent`
  - `targetKind`
  - `targetControllerId`
- SmashUp AI 在 simple-choice 评分阶段新增 `interaction-value` scorer，优先消费 `aiHints`。
- 新增回归测试：`src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`

## 本轮验证

### ESLint

```powershell
npx eslint src/engine/ai/types.ts src/engine/ai/snapshots.ts src/engine/systems/InteractionSystem.ts src/games/smashup/ai.ts src/games/smashup/domain/abilityHelpers.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts
```

结果：
- 0 error
- `InteractionSystem.ts` 仅有仓库既有 `any` warning，本轮未新增 error

### 定向单测

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts -t "buff 型随从目标交互应透传 AI hints，且 AI 优先选择己方随从" --configLoader native --maxWorkers 1
```

结果：
- `1 passed | 16 skipped`

### OpenSpec

```powershell
openspec validate update-turn-based-ai-framework-semantics --strict --no-interactive
```

结果：
- `Change 'update-turn-based-ai-framework-semantics' is valid`

## 关键断言

新增测试实际锁住了两层风险：

1. **语义透传**
   - 己方随从候选的 `aiHints[0]` 必须包含：
     - `relationToActor: 'self'`
     - `effectIntent: 'buff'`
     - `targetKind: 'minion'`
     - `targetControllerId: '0'`
   - 敌方随从候选的 `aiHints[0]` 必须包含：
     - `relationToActor: 'enemy'`
     - `effectIntent: 'buff'`
     - `targetKind: 'minion'`
     - `targetControllerId: '1'`

2. **AI 最终决策**
   - `resolveNextLocalAiAction(...)` 返回的动作必须选中己方随从对应的 `optionId`
   - 不能再因为候选顺序或默认 tie-break 把 buff 误给到敌方

## 结论

- 这次不是只修一个具体派系或一张牌，而是把 SmashUp 目标交互的 AI 语义层补齐了。
- 当前已用单测证明：
  - 目标语义会进入交互候选
  - AI 评分会消费这些语义
  - buff 型目标选择会优先落到己方随从
- 这条反馈当前可视为已完成首轮收口；后续若再扩到更多 target helper，可继续沿同一 hints 契约扩展。
