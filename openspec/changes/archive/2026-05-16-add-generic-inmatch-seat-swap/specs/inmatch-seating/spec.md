## ADDED Requirements

### Requirement: 通用局内换位入口模式映射
系统 SHALL 在 `MatchRoom` 提供统一的 HUD 换位入口，并按游戏映射换位模式：
- `dicethrone` 使用 `request` 模式（申请/审批/取消）
- `smashup` 与 `summonerwars` 使用 `instant` 模式（点击即换位）

#### Scenario: 支持带阵营选择游戏显示统一入口
- **GIVEN** 当前游戏为 `dicethrone` / `smashup` / `summonerwars`
- **WHEN** 对局处于该游戏允许换位的阶段
- **THEN** HUD 渲染统一的换位悬浮球入口

#### Scenario: 非接入游戏不显示入口
- **GIVEN** 当前游戏未声明换位模式
- **WHEN** HUD 渲染悬浮球菜单
- **THEN** 系统不渲染换位入口

### Requirement: 请求模式与即时模式语义
系统 SHALL 保持两类换位语义并存：
- `request` 模式：真人目标需要审批，AI 目标可立即完成
- `instant` 模式：点击目标座位立即换位，不进入审批流程

#### Scenario: request 模式真人目标进入审批
- **GIVEN** 当前为 `dicethrone` 且目标座位是真人
- **WHEN** 发起换位
- **THEN** 系统进入待审批状态并显示审批/拒绝/取消动作

#### Scenario: request 模式 AI 目标即时完成
- **GIVEN** 当前为 `dicethrone` 且目标座位是 AI
- **WHEN** 发起换位
- **THEN** 系统立即完成换位

#### Scenario: instant 模式点击即换位
- **GIVEN** 当前为 `smashup` 或 `summonerwars`
- **WHEN** 点击目标座位
- **THEN** 系统立即执行换位命令并更新先后手相关状态

### Requirement: SummonerWars 即时换位命令链
`summonerwars` SHALL 提供 `sw:swap_seat` 命令链（types/validate/execute/reduce/game 白名单），用于阵营选择阶段即时换位，并更新先后手语义。

#### Scenario: SummonerWars 换位后更新先后手
- **GIVEN** `summonerwars` 未开局且当前 `startingPlayerId` 为 `0`
- **WHEN** 玩家 `0` 与 `1` 执行 `sw:swap_seat`
- **THEN** `startingPlayerId` 与 `currentPlayer` 按换位结果更新为 `1`

### Requirement: HUD 顺序与显示门禁
系统 SHALL 保证换位入口在悬浮球菜单中的视觉顺序位于“操作日志”和“强制结束 AI 当前阶段”之间。  
App 运行时 MUST 隐藏全屏悬浮球入口。  
`instant` 模式换位入口仅在未开局且存在阵营选择上下文时显示，开局后 MUST 隐藏。

#### Scenario: HUD 入口顺序正确
- **GIVEN** HUD 同时存在操作日志与强制结束 AI 入口
- **WHEN** 玩家展开悬浮球菜单
- **THEN** 视觉顺序满足 `操作日志 -> 换位 -> 强制结束 AI 当前阶段`

#### Scenario: App 运行时隐藏全屏入口
- **GIVEN** 当前运行在 App 原生壳
- **WHEN** HUD 渲染悬浮球菜单
- **THEN** 系统不渲染全屏动作

#### Scenario: instant 模式开局后隐藏换位入口
- **GIVEN** 当前游戏为 `smashup` 或 `summonerwars`
- **AND** 对局已开局（`hostStarted=true`）
- **WHEN** HUD 渲染悬浮球菜单
- **THEN** 系统不渲染换位入口

### Requirement: DiceThrone 四人旧换位入口保留
系统 SHALL 在保留 HUD 统一入口的同时，继续保留 `dicethrone` 四人模式原选角换位入口。

#### Scenario: 四人旧入口可继续使用
- **GIVEN** 当前为 `dicethrone` 四人模式选角阶段
- **WHEN** 玩家使用原选角换位入口点击 AI 头像
- **THEN** 旧入口仍可即时换位
