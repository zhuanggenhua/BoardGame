# 0002 · 时点-机会-结算升级为平台级规则内核

- 日期：2026-08-21
- 状态：生效

## 背景

项目需要支持约 100 个桌游。复杂桌游普遍存在触发、响应、替代、防止、长事务、隐藏选择和 AI 阻塞，不只是 TCG 才需要这些能力。

现有引擎已经有 `ChoiceRequest`、`ResponseWindowSystem`、`InteractionSystem` 和 `ResolutionFrame` 骨架，但缺少统一的“时点生成机会”主模型。结果是游戏层仍会反复长出私有 `pending*`、`continuationContext`、reaction session、action counter 栈和各自的合法动作判断。

`ygopro` 证明了裁判式模型的价值：规则核心推进到时点，需要外部响应时暂停，收到 response 后继续；卡牌效果按条件、费用、目标和执行注册。但本项目不能照搬它的单游戏代码、GPL 脚本、原生 UI 或素材。

## 决策

将 `TimingPoint -> Opportunity -> ChoiceRequest / ResponseWindow -> ResolutionFrame -> EventCommit` 定为平台级规则内核主合同。

新游戏只有在需求涉及触发、响应、替代、防止、长事务或 AI 阻塞时，才接入 Timing/Opportunity 矩阵；接入后，UI、服务端验证、AI legal-actions 和结算 driver 应消费同一份机会合同。

旧游戏保留兼容，不做大爆炸迁移；但触碰相关窗口时，必须审查是否迁移到该主模型。旧 `pending* / continuationContext / simple-choice / 私有 session` 只能作为兼容 adapter 或局部候选状态，不能继续扩展为新主权威。

## 后果

- [`timing-opportunity-resolution`](../knowledge/standards/timing-opportunity-resolution.md) 成为复杂触发、响应、替代、防止和长事务需求的 AI 标准入口。
- 连续结算 driver 的既有提案继续推进，但需要补 Opportunity 层；提案位置归 `openspec/` 产品流程管理。
- 第一试点选择已存在复杂响应链路的游戏；第二试点应选择另一类伤害 / 响应 / 替代链路，避免单游戏外推。
- 后续代码重构优先补引擎层 `TimingPoint / Opportunity` 类型和 discovery 接口，再补完整 resolution driver。
