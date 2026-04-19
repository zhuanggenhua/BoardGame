# SmashUp AI 语义提示 / Buff 目标修复验证（2026-04-08）

## 反馈背景

用户反馈：**大杀四方 AI 会把增益 buff 给错目标**，例如在有己方与敌方候选随从时，AI 会因为只按候选顺序/弱语义评分决策，误把增益给到敌方目标。

## 本轮实现范围

- 为交互选项补齐 **AI-only hints**，并与业务 `value` 显式隔离：
  - `src/engine/ai/types.ts`
  - `src/engine/systems/InteractionSystem.ts`
  - `src/engine/ai/snapshots.ts`
- SmashUp 的随从目标选择现在会自动给每个选项附带语义：
  - 目标相对行动者关系：`self/enemy`
  - 效果意图：`buff/destroy/...`
  - 目标类型与控制者信息
  - 关键文件：`src/games/smashup/domain/abilityHelpers.ts`
- SmashUp AI 在构建交互动作时，把 `_ai` hints 透传到 `legalActions.aiHints`，并启用共享的 interaction hint scorer：
  - `src/games/smashup/ai.ts`
- 顺手补了一条机器人回归，锁定 `robot_microbot_guard` 目标过滤与 live refresh：
  - `src/games/smashup/abilities/robots.ts`
  - `src/games/smashup/__tests__/factionAbilities.test.ts`

## 关键验证

### 1. ESLint
```powershell
npx eslint src/engine/ai/index.ts src/engine/ai/snapshots.ts src/engine/ai/types.ts src/engine/systems/InteractionSystem.ts src/games/smashup/ai.ts src/games/smashup/domain/abilityHelpers.ts src/games/smashup/abilities/robots.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts src/games/smashup/__tests__/factionAbilities.test.ts
```

结果：**0 errors**（存在仓库既有 warning，未新增 error）

### 2. Vitest
```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts src/games/smashup/__tests__/factionAbilities.test.ts --configLoader native --maxWorkers 1
```

结果：**55 passed**

其中本轮关键断言包括：
- `buff 型随从目标交互应透传 AI hints，且 AI 优先选择己方随从`
- `robot_microbot_guard: 4个己方随从时只能选择力量小于4的目标`

### 3. OpenSpec
```powershell
npx openspec validate update-turn-based-ai-framework-semantics --strict --no-interactive
```

结果：**通过**

### 4. TypeScript
```powershell
npx tsc --noEmit
```

结果：**通过**

## 我实际核对到的行为结论

### A. Buff 目标语义现在是显式的，不再靠候选顺序猜
- 新增测试中，己方目标的 `aiHints[0]` 明确带有：
  - `relationToActor: 'self'`
  - `effectIntent: 'buff'`
  - `targetKind: 'minion'`
  - `targetControllerId: '0'`
- 敌方目标则对应：
  - `relationToActor: 'enemy'`
  - `effectIntent: 'buff'`
  - `targetControllerId: '1'`

这说明 AI 不再只能靠“谁排在前面”做弱判断，而是拿到了真正的目标语义。

### B. 本地 AI 决策已被回归锁定为优先选己方 buff 目标
- 同一条测试里，`resolveNextLocalAiAction(...)` 最终返回的是 `interaction-choice`
- 且返回的 `optionId` 明确等于 **己方随从** 对应的 action metadata option

这条断言直接对应用户反馈：在“buff 己方 / buff 敌方”并存时，AI 现在会优先选择己方。

### C. 交互系统不会把 AI hints 污染进业务 payload
- hints 被放在 `_ai` / `aiHints` 侧带字段中
- `value` 仍保持原有规则处理器需要的业务结构
- OpenSpec 验证也覆盖了“AI-only hints 与业务 payload 隔离”这条契约

## 结论

这条反馈现在已达到可收口标准：

- 已从架构层补上 AI 语义提示链路
- 已在 SmashUp 目标选项生成处落地
- 已用真实 AI 决策回归锁定“buff 优先给己方而不是敌方”
- 已完成 ESLint / Vitest / OpenSpec / TypeScript 验证

当前可以把 **“SmashUp AI 把 buff 给错目标”** 记为：**已修并验证**。
