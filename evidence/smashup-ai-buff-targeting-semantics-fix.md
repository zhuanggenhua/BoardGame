# SmashUp AI 增益目标语义修复证据（2026-04-08）

## 背景

用户反馈：大杀四方 AI 在目标选择交互里会把增益 buff 给错对象，出现“应该优先加成自己，却去点敌方目标”的问题。

本轮修复不是继续堆候选顺序特判，而是补齐一层**AI-only 语义 hints**：

- `PromptOption._ai`：交互候选可附带 AI 专用语义
- `InteractionSystem`：刷新选项时保留 `_ai`
- `SmashUp buildMinionTargetOptions(...)`：自动推导 `relationToActor / effectIntent / targetKind / targetControllerId`
- `SmashUp AI scorer`：新增 `interaction-value`，按 hints 给自己 buff、给敌人 debuff/destroy 等语义加减分
- `trainingData`：同步携带 `aiHints`

## 代码范围

- `src/engine/ai/types.ts`
- `src/engine/ai/semantics.ts`
- `src/engine/ai/index.ts`
- `src/engine/ai/snapshots.ts`
- `src/engine/systems/InteractionSystem.ts`
- `src/engine/transport/__tests__/trainingData.test.ts`
- `src/games/smashup/ai.ts`
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/abilities/robots.ts`
- `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
- `openspec/changes/update-turn-based-ai-framework-semantics/**`

## 实际验证

### ESLint
```powershell
npx eslint src/engine/ai/index.ts src/engine/ai/semantics.ts src/engine/ai/snapshots.ts src/engine/ai/types.ts src/engine/systems/InteractionSystem.ts src/engine/transport/__tests__/trainingData.test.ts src/games/smashup/ai.ts src/games/smashup/domain/abilityHelpers.ts src/games/smashup/abilities/robots.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts
```

结果：
- 0 error
- `InteractionSystem.ts` 有仓库既有 `no-explicit-any` warnings，非本轮新增

### Vitest
```powershell
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/trainingData.test.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native --maxWorkers 1
```

结果：
- `2 passed / 21 passed`

其中关键新增断言：
- `buff 型随从目标交互应透传 AI hints，且 AI 优先选择己方随从`
- `trainingData` 捕获结果中包含 `aiHints`

### OpenSpec
```powershell
npx openspec validate update-turn-based-ai-framework-semantics --strict --no-interactive
```

结果：
- `Change 'update-turn-based-ai-framework-semantics' is valid`

## 关键结论

### 1. 交互候选现在带有明确 AI 语义

新增测试里，己方目标会拿到：

- `relationToActor: 'self'`
- `effectIntent: 'buff'`
- `targetKind: 'minion'`
- `targetControllerId: '0'`

敌方目标会拿到：

- `relationToActor: 'enemy'`
- `effectIntent: 'buff'`
- `targetKind: 'minion'`
- `targetControllerId: '1'`

### 2. AI 不再靠“候选顺序碰运气”

测试直接验证：

- `buildSmashUpAiLegalActions(...)` 产出的 `ownAction.aiHints` / `enemyAction.aiHints` 不同
- `resolveNextLocalAiAction(...)` 最终选择的是己方目标对应的 `optionId`

这说明 AI 的决策依据已经从“谁排前面”切到“谁的语义更对”。

### 3. 训练数据链路同步保留语义

`trainingData.test.ts` 已锁定：

- interaction snapshot 内的 option 会保留 `_ai`
- legal action 导出时会保留 `aiHints`

避免后续训练/调试链路把这层语义丢掉。

## 结论

本轮已经完成：

- 通用 AI 语义 hints 框架落地
- SmashUp 的随从目标交互接入 hints
- AI 评分消费 hints，修正“buff 给错目标”的核心问题
- 测试、OpenSpec 校验全部通过

就这条用户反馈而言，当前已经达到可交付收口标准。
