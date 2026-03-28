## 1. 已完成的基础能力
- [x] 1.1 新增 `game-ai-system` spec，定义统一 AI 决策上下文、动作输出、seat controller 与训练采集要求
- [x] 1.2 修改 `game-registry`，要求每个游戏显式声明 `manifest.ai`
- [x] 1.3 定义 `AiDecisionContext` / `AiActionDecision` / `AiSeatController` 类型契约与序列化边界
- [x] 1.4 完成训练样本 schema，补齐 `legalActions`、交互与响应窗口快照
- [x] 1.5 完成本地 AI seat controller、local runner 与去重边界
- [x] 1.6 完成 Tic-Tac-Toe 与 Dice Throne 的首轮 runtime 接入

## 2. 本轮：桌游优先的策略层收口
- [x] 2.1 更新 proposal / design / delta spec，明确默认策略是合法动作评分与可叠加搜索，而不是行为树
- [x] 2.2 在 `src/engine/ai` 增加通用评分策略 helper，统一 scorer 汇总、stable tie-break 与调试元数据
- [x] 2.3 将 Dice Throne baseline local policy 迁移为评分式实现
- [x] 2.4 在现有测试文件中补充 Dice Throne 本地 AI 评分决策断言

## 3. 后续未完成事项
- [x] 3.1 设计训练数据清理、归档和 schema 升级策略
- [x] 3.2 明确 AstrBot 接入方式、鉴权、超时、重试和 fallback 策略
- [x] 3.3 约束远程 AI 不得绕过 `legalActions` 与引擎 validate
- [x] 3.4 补充测试：训练采集、provider 超时、非法动作回退
