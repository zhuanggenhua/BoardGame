## Context
当前 4 人 / 2v2 的核心规则已经落地，但“面向玩家目标”的交互属于另一层兼容问题：

- 领域层的部分 custom action 已经把候选目标扩展为 `Object.keys(state.players)`。
- 组件测试与部分 E2E 仍按 `['0', '1']`、`自己/对手` 的 2 人口径编写。
- `validateGrantTokens` 与 `validateTransferStatus` 目前只检查“是否有 pendingInteraction、是否是当前玩家”，没有严格校验目标玩家、来源玩家、转移约束。
- `TRANSFER_STATUS` 执行层实际上同时支持状态与 token 的转移，但 4 人链路未形成明确验证闭环。

因此，这轮不应再混进“所有 2v2 功能”的大收口，而应独立成一个小 change，聚焦第一批高风险多人目标交互。

## Goals
- 收口第一批高风险“玩家目标交互”在 4 人 / 2v2 下的规则、验证、UI 与 E2E。
- 让 4 人玩家选择面板能够稳定区分多个候选玩家，而不是继续依赖 2 人语义。
- 为后续第二批/第三批多人能力审计建立统一模式和测试锚点。

## Non-Goals
- 不在本 change 中承诺“一次性穷举所有英雄全部多人能力”。
- 不重开 2v2 核心规则（回合、目标投骰、共享体力、响应窗口主链路）的既有 change。
- 不在本 change 中处理与“玩家目标交互”无关的视觉系统或普通 1v1 行为。

## Decisions

### 1. 采用“新 change + 分批收口”，不回头扩写已完成 change
- 原因：`add-dicethrone-2v2-team-mode` 已处于 complete 状态，再把后续专项缺口继续混入会让范围和验收边界失真。
- 结果：本 change 仅承担第一批“玩家目标交互”专项收口。

### 2. 第一批只覆盖三类高风险交互
- 任意玩家授 token
- 任意玩家移除状态
- 状态 / 可移除 token 转移到另一玩家

原因：这三类都共享 `selectPlayer` / `selectStatus` / `selectTargetStatus` / `TRANSFER_STATUS` 这一套核心实现，是最适合先做共享根因收口的切片。

### 3. 先修共享抽象，再补单卡 E2E
- 共享层包括：
  - `PendingInteraction.targetPlayerIds`
  - `GRANT_TOKENS` / `TRANSFER_STATUS` 验证
  - `InteractionOverlay` 的 4 人候选渲染
  - `Board.tsx` 的本地交互提交链
- 单卡验证优先挑代表性场景：
  - `Vengeance II`（任意玩家授 token）
  - `Transfer Status!` 或同类双阶段转移卡

## Risks / Trade-offs
- 当前工作树已有大量并发修改，必须避免误碰无关 2v2 代码。
- 若这轮直接追求“全英雄穷举”，会把 spec 和实现边界再次做大，难以稳定收口。
- 组件 UI 目前使用 `self/opponent` 文案表达玩家身份，4 人下需要补更稳定的区分方式，否则 E2E 难以可靠定位正确候选目标。

## Migration Plan
1. 盘点第一批相关 custom action、卡牌、命令和测试覆盖。
2. 收紧验证层与交互层共享抽象。
3. 以代表性多人能力补齐 4 人 Vitest / E2E。
4. 更新证据与 planning-with-files；未纳入本批次的多人能力记录到后续批次。

## Open Questions
- 4 人玩家选择卡片中，是否统一展示“昵称 + P 座位 + 阵营色”，作为所有多人目标交互的标准样式。
- `TRANSFER_STATUS` 是否继续沿用当前命名，同时承载 token 转移；还是仅在 spec 中明确“状态/可移除 token”都走该命令。
