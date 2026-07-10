## 1. AI Runtime
- [x] 1.1 新增小黑屋 AI legal actions，覆盖选角、事件选择、恶兆前和第一剧本英雄侧核心动作。
- [x] 1.2 增加叛徒与杰克之灵侧的移动、攻击和回合推进候选。
- [x] 1.3 新增稳定的合作/叛徒双阵营策略评分与目标移动优先级。
- [x] 1.4 注册 `GameAiRuntime`，配置可见动作延迟和静默推进动作。
- [x] 1.5 更新 manifest，启用本地 AI 与采集，保持远程 AI 关闭。

## 2. Tests
- [x] 2.1 补选角、事件选择和恶兆前 legal actions 测试。
- [x] 2.2 补英雄侧合作目标动作测试。
- [x] 2.3 补叛徒与杰克之灵侧动作测试。
- [x] 2.4 补代表性连续回合推进测试，验证 AI 不会卡在空动作状态。

## 4. Verification
- [x] 4.1 运行小黑屋 AI 与首剧本定向 Vitest。
- [x] 4.2 运行相关 manifest、首剧本与基础界面测试。
- [x] 4.3 运行 TypeScript、ESLint 与 `git diff --check`。
- [x] 4.4 运行 OpenSpec strict validate 并记录残余范围。

验证结果：
- AI runtime 12 条测试通过。
- manifest 集成 3 条测试通过。
- 首剧本运行时 118 条测试通过。
- 基础界面 32 条测试通过。

## 5. Explicitly Deferred
- [x] 5.1 远程 AI 本轮明确跳过。
- [x] 5.2 交易、搜尸、复杂持有物组合与兔脚最优改骰策略本轮明确跳过。
