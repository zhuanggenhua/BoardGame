# flow-system Specification

## Purpose
TBD - created by archiving change add-flow-system. Update Purpose after archive.
## Requirements
### Requirement: FlowSystem 核心能力
引擎层 SHALL 提供 FlowSystem，负责阶段流程的执行和事件分发。

#### Scenario: 阶段推进
- **WHEN** 收到 ADVANCE_PHASE 命令
- **THEN** FlowSystem 调用 canAdvance hook 校验
- **AND** 调用 onPhaseExit hook 获取离开事件
- **AND** 调用 getNextPhase hook 获取下一阶段
- **AND** 更新 sys.phase 为新阶段
- **AND** 调用 onPhaseEnter hook 获取进入事件
- **AND** 返回所有事件

#### Scenario: 阶段推进被阻止
- **WHEN** 收到 ADVANCE_PHASE 命令
- **AND** canAdvance hook 返回 false
- **THEN** FlowSystem 返回错误，不更新 sys.phase

#### Scenario: 初始化阶段
- **WHEN** 游戏 setup 执行
- **THEN** FlowSystem 将 sys.phase 设置为 flowHooks.initialPhase

### Requirement: FlowHooks 接口
游戏层 SHALL 通过 FlowHooks 接口自定义阶段逻辑。

#### Scenario: 提供 FlowHooks
- **GIVEN** 游戏需要阶段流程管理
- **WHEN** 调用 createGameAdapter
- **THEN** 可通过 flowHooks 参数传入阶段逻辑

#### Scenario: 不提供 FlowHooks
- **GIVEN** 游戏不需要阶段流程管理（如 TicTacToe）
- **WHEN** 调用 createGameAdapter 不传 flowHooks
- **THEN** FlowSystem 不启用，ADVANCE_PHASE 命令无效

### Requirement: sys.phase 单一权威
sys.phase SHALL 是游戏阶段的唯一权威来源。

#### Scenario: 读取当前阶段
- **WHEN** 任何代码需要获取当前阶段
- **THEN** 必须读取 G.sys.phase
- **AND** 禁止读取 G.core 中的阶段字段

#### Scenario: 阶段变更事件
- **WHEN** sys.phase 发生变更
- **THEN** FlowSystem 发出 SYS_PHASE_CHANGED 事件
- **AND** 事件包含 from、to、activePlayerId 字段

### Requirement: DiceThrone FlowHooks 实现
DiceThrone 游戏 SHALL 实现 FlowHooks 以迁移现有阶段逻辑。

#### Scenario: canAdvance 校验
- **GIVEN** 当前阶段为 discard
- **WHEN** 玩家手牌数超过上限
- **THEN** canAdvance 返回 false

#### Scenario: getNextPhase 条件跳转
- **GIVEN** 当前阶段为 offensiveRoll
- **AND** pendingAttack.isDefendable 为 true
- **WHEN** 调用 getNextPhase
- **THEN** 返回 defensiveRoll

#### Scenario: onPhaseEnter income
- **WHEN** 进入 income 阶段
- **THEN** onPhaseEnter 返回 CP_CHANGED 和 CARD_DRAWN 事件

#### Scenario: onPhaseExit discard
- **WHEN** 离开 discard 阶段
- **THEN** onPhaseExit 返回 TURN_CHANGED 事件（切换到下一玩家）

### Requirement: FlowSystem 自动推进 SHALL 服从统一控制流主链
当存在未完成的 resolution frame，且该 frame 仍在等待交互、响应轮、post-reduce 恢复或 deferred follow-up 收口时，FlowSystem SHALL NOT 自动推进阶段。只有当相关 frame 明确完成并退出主链后，FlowSystem 才 MAY 继续原有推进逻辑。

#### Scenario: 未完成 frame 阻止自动推进
- **GIVEN** 当前阶段存在一个尚未完成的 resolution frame
- **AND** 该 frame 正在等待交互、响应轮或后续恢复
- **WHEN** FlowSystem 评估是否自动进入下一阶段
- **THEN** FlowSystem MUST 保持当前阶段

#### Scenario: frame 完成后恢复原有推进
- **GIVEN** 当前阶段相关的 resolution frame 已完成并从主链移除
- **WHEN** FlowSystem 再次评估自动推进
- **THEN** FlowSystem MAY 按现有 flow 规则继续推进

