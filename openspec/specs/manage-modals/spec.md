# manage-modals Specification

## Purpose
TBD - created by archiving change add-global-modal-stack. Update Purpose after archive.
## Requirements
### Requirement: 全局 Modal 栈管理
系统 SHALL 提供全局 Modal 栈管理能力，支持打开、关闭与替换栈顶弹窗，并以栈顶作为当前可交互弹窗。

#### Scenario: 连续打开多个弹窗
- **WHEN** 用户依次打开多个弹窗
- **THEN** 系统 MUST 按打开顺序入栈并以最后打开的弹窗作为栈顶

#### Scenario: 关闭栈顶弹窗
- **WHEN** 栈顶弹窗触发关闭
- **THEN** 系统 MUST 仅关闭栈顶并恢复下一层为新的栈顶

### Requirement: 统一默认行为（ESC/遮罩/滚动锁）
系统 SHALL 默认启用 ESC 关闭、遮罩点击关闭与 body 滚动锁。

#### Scenario: ESC 关闭栈顶
- **WHEN** 用户按下 ESC
- **THEN** 系统 MUST 关闭当前栈顶弹窗

#### Scenario: 遮罩点击关闭
- **WHEN** 用户点击弹窗遮罩
- **THEN** 系统 MUST 关闭当前栈顶弹窗

#### Scenario: 弹窗打开期间锁定滚动
- **WHEN** 栈内存在任意弹窗
- **THEN** 系统 MUST 锁定 body 滚动

### Requirement: Portal Root 渲染
系统 SHALL 将弹窗渲染到 `#modal-root` 以避免父容器裁切与层级冲突。

#### Scenario: 弹窗渲染到 Portal Root
- **WHEN** 系统打开弹窗
- **THEN** 弹窗 MUST 挂载在 `#modal-root` 下

### Requirement: 教程提示纳入栈管理
系统 SHALL 允许教程提示通过全局栈渲染，并可配置是否启用遮罩/滚动锁。

#### Scenario: 教程提示关闭遮罩与滚动锁
- **WHEN** 教程提示以禁用遮罩与滚动锁方式打开
- **THEN** 系统 MUST 保持背景可见且不阻断交互

### Requirement: Blocking Foreground Defaults To Modal Stack
Any foreground UI that owns a blocking `sys.interaction` or `responseWindow` step SHALL default to rendering through the global modal stack instead of bypassing it with an independent overlay channel.

#### Scenario: Blocking interaction opens through stack
- **GIVEN** a foreground UI corresponds to the current blocking interaction or response window
- **WHEN** the UI is shown to the player
- **THEN** the UI MUST be registered as a modal stack entry
- **AND** stack ownership metadata MUST remain attached to that foreground entry

#### Scenario: Pure display spotlight may stay outside stack
- **GIVEN** a foreground UI is display-only and does not own business confirmation or progression
- **WHEN** the UI is shown
- **THEN** it MAY remain in a non-stack overlay channel
- **AND** it MUST NOT be treated as the blocking owner of the business flow

### Requirement: Blocking Foregrounds Must Not Compete Outside The Stack
The system SHALL avoid rendering multiple competing blocking foregrounds through separate overlay channels when they belong to the same business flow.

#### Scenario: Compare roll and bonus die do not bypass stack
- **GIVEN** a compare-roll interaction or an interactive bonus-dice interaction is active
- **WHEN** the foreground is rendered
- **THEN** it MUST render through the modal stack
- **AND** it MUST NOT independently overtake another blocking modal by rendering outside the stack

### Requirement: 阻塞式游戏弹窗前台 SHALL 由 modal stack 单点管理
系统 SHALL 使用 modal stack 作为阻塞式游戏弹窗的唯一前台 ownership。任意时刻只能有一个 blocking modal 处于前台可交互状态；当更高优先级的阻塞 UI 打开时，旧前台 MUST 退到下一层，待顶层关闭后再恢复。

#### Scenario: token 响应与目标选择不并列抢前台
- **GIVEN** 当前已有一个 token response blocking modal
- **AND** 同一条业务链稍后又出现目标选择或 simple-choice blocking modal
- **WHEN** 新的 blocking modal 打开
- **THEN** modal stack MUST 让新的 blocking modal 成为唯一前台
- **AND** 旧 modal MUST 留在栈中等待恢复，而不是与新 modal 并列可交互

#### Scenario: 顶层关闭后恢复下层前台
- **GIVEN** 一个低层 blocking modal 正在等待恢复
- **WHEN** 当前栈顶 blocking modal 被解决或关闭
- **THEN** modal stack MUST 恢复下层 modal 为新的前台
- **AND** 恢复顺序 MUST 与入栈顺序一致

### Requirement: modal stack SHALL 只管理前台 ownership，不拥有业务续链
modal stack SHALL 只负责视觉前台与交互层级，不得承担业务结算是否完成、interaction 是否应自动 resolve、response window 是否应自动关闭等主链决策。

#### Scenario: 关闭弹窗不等于业务已结算
- **GIVEN** 一个 blocking modal 对应某个 interaction 或 response window
- **WHEN** 该 modal 因栈切换、路由恢复或用户关闭而离开前台
- **THEN** modal stack MAY 更新前台 ownership
- **BUT** 系统 MUST 仍以所属 interaction / response window / resolution frame 的状态判断业务是否完成

