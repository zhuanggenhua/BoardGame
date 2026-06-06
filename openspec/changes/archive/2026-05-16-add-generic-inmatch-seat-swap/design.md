## Context
当前换位入口主要集中在 `dicethrone`，其他带阵营选择游戏缺少统一可达入口。  
本次目标不是重写引擎层 seating 系统，而是在现有架构下提供“通用 HUD 入口 + 分游戏命令模式映射”。

## Goals
- 所有带阵营选择的目标游戏都能在同一 HUD 入口进行换位。
- `dicethrone` 保持原申请/审批语义，`smashup/summonerwars` 支持即时换位。
- 换位主要影响先后手推导；开局后入口隐藏。
- 保留 `dicethrone` 四人旧换位 UI。

## Non-Goals
- 本变更不新增引擎级 `sys.seating` 状态机。
- 不改服务端 `claim-seat` 协议与身份归属。
- 不把所有游戏都强制接入换位能力。

## Decisions
- Decision: 在 `MatchRoom` 增加 `seatSwapMode` 映射层（`request` / `instant`）。  
  Rationale: 在不重写各游戏 domain 的前提下，实现统一入口与分游戏语义。

- Decision: `instant` 模式按游戏命令直发（`su:swap_seat` / `sw:swap_seat`）。  
  Rationale: `smashup/summonerwars` 只需开局先后手调整，不需要审批链路。

- Decision: `summonerwars` 在 domain 内新增 `sw:swap_seat` 命令链，直接更新 `startingPlayerId/currentPlayer`。  
  Rationale: 该游戏主要通过 `startingPlayerId/currentPlayer` 表达先后手。

- Decision: HUD 换位悬浮球作为通用入口，视觉顺序固定在“操作日志”和“强制结束 AI 当前阶段”之间。  
  Rationale: 让玩家在日志上下文旁快速处理换位，同时不挤占主操作位。

- Decision: App 运行时隐藏 GameHUD 全屏入口。  
  Rationale: App 端空间受限且原生壳已提供窗口能力，全屏入口优先级低于局内控制入口。

- Decision: 换位悬浮球只在可换位阶段显示，开局后默认隐藏。  
  Rationale: 减少噪音入口，确保“换位主要用于开局先后手/座位顺序调整”的语义清晰。

- Decision: `instant` 模式仅在未开局且带阵营选择上下文时显示（`hostStarted === false` 且 setup/factionSelect 上下文）。  
  Rationale: 保证 AI 对局可见，同时满足“开局后隐藏”。

- Decision: `dicethrone` 的 HUD 换位入口覆盖所有可换位阶段（setup / factionSelect，含 AI 对局），且四人模式保留原选角界面换位入口。  
  Rationale: 满足统一入口可达性，同时不破坏四人模式既有换位操作习惯。

## Risks / Trade-offs
- Risk: 各游戏座位字段不同（`seatingOrder` / `turnOrder` / `startingPlayerId`），通用入口可能读错顺序。  
  Mitigation: 统一读取优先级 `seatingOrder -> turnOrder -> startingPlayerId + players -> players keys`。

- Risk: 局内换位影响先后手与相邻关系，可能引发规则回归。  
  Mitigation: 增补 4 人目标选择与回合顺序回归测试。

## Migration Plan
1. 先统一 HUD 入口和显示门禁（含 App 全屏隐藏）。
2. 接入 `smashup/summonerwars` 的 instant 模式与 `dicethrone` request 模式共存。
3. 用在线 AI E2E 验证可见性与换位生效，再继续扩展到更多带阵营选择游戏。

## Open Questions
- 后续是否需要把 `instant` 模式进一步抽象为引擎级能力（当前仍是游戏命令分发）？
- `summonerwars` 若未来扩展多人局，是否需要从 `startingPlayerId` 升级为 `seatingOrder` 结构？
