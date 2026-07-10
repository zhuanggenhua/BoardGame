# the-gang Specification

## Purpose
定义纸牌帮 The Gang 基础版在当前项目中的正式交付状态：3-6 人合作德州扑克排序玩法、真实运行入口、可见本地 AI、基础教程、玩家可见日志、共享撤回入口，以及素材与扩展范围边界。

## Requirements
### Requirement: The Gang 基础版游戏接入
系统 SHALL 提供 `the-gang` 游戏条目，基础版支持 3-6 人，并能通过项目游戏注册表自动发现。

#### Scenario: 游戏注册表发现 The Gang
- **WHEN** 游戏 manifest 生成完成
- **THEN** 生成清单 MUST 包含 `the-gang`
- **AND** `the-gang` MUST 暴露前端 Board 与服务端 engineConfig
- **AND** manifest MUST 声明横屏移动适配和本地 AI / 测试运行能力
- **AND** 本地 AI / 测试运行能力 MUST NOT 被解释为多个真人共用一个客户端的热座产品合同

### Requirement: 基础抢劫流程
The Gang 基础版 SHALL 以抢劫为单局子流程，每次抢劫包含 4 轮筹码选择，并在第 4 轮后进入摊牌判定。

#### Scenario: 四轮公共牌推进
- **GIVEN** 一次新抢劫开始
- **WHEN** Round 1 开始
- **THEN** 每名玩家 MUST 获得 2 张底牌
- **WHEN** Round 2 开始
- **THEN** 系统 MUST 翻开 3 张公共牌
- **WHEN** Round 3 或 Round 4 开始
- **THEN** 系统 MUST 各额外翻开 1 张公共牌

### Requirement: 筹码排序表达
系统 SHALL 在每轮提供与玩家人数匹配的星级筹码，玩家通过选择筹码表达自己相对牌力。

#### Scenario: 玩家选择和更换当前轮筹码
- **GIVEN** 当前处于筹码选择阶段
- **WHEN** 玩家选择一个未被其他玩家持有的当前轮筹码
- **THEN** 该玩家 MUST 持有该筹码
- **AND** 该筹码 MUST 从当前轮可选池移除
- **WHEN** 该玩家改选另一个未被占用的当前轮筹码
- **THEN** 原筹码 MUST 回到可选池
- **AND** 新筹码 MUST 归该玩家持有

### Requirement: 德州扑克牌力判定
系统 SHALL 依据每名玩家 2 张底牌和 5 张公共牌计算最佳 5 张德州扑克牌型，并支持相同牌型的 kicker 比较。

#### Scenario: 摊牌排序
- **GIVEN** 第 4 轮所有玩家已选择红筹码
- **WHEN** 系统执行摊牌
- **THEN** 系统 MUST 为每名玩家计算最终牌力
- **AND** 系统 MUST 按真实牌力从弱到强得到玩家排序

### Requirement: 抢劫成功与游戏胜负
系统 SHALL 使用第 4 轮红色筹码顺序与真实牌力顺序比对来判定抢劫结果，并以 3 次成功或 3 次失败结束整局游戏。

#### Scenario: 抢劫结果与整局结束
- **GIVEN** 所有玩家第 4 轮红色筹码的相对顺序与真实牌力不冲突
- **WHEN** 摊牌完成
- **THEN** 本次抢劫 MUST 记为成功
- **GIVEN** 至少两名玩家的红色筹码顺序与真实牌力冲突
- **WHEN** 摊牌完成
- **THEN** 本次抢劫 MUST 记为失败
- **AND** 成功次数达到 3 时游戏 MUST 以团队胜利结束
- **AND** 失败次数达到 3 时游戏 MUST 以团队失败结束

### Requirement: 手牌信息隐藏
系统 SHALL 在非摊牌阶段只向玩家展示自己的底牌，不向其他玩家暴露隐藏手牌。

#### Scenario: 非本人玩家视图
- **GIVEN** 当前未进入摊牌公开阶段
- **WHEN** 玩家查看对局状态
- **THEN** 该玩家 MUST 只能看到自己的底牌具体内容
- **AND** 其它玩家底牌 MUST 以隐藏状态呈现

### Requirement: The Gang 数据与素材准入
The Gang SHALL maintain auditable source and intake contracts before external rules or images are promoted into runtime behavior.

#### Scenario: Source truth recorded
- **WHEN** The Gang uses PDF, DOM, Images, or existing implementation data as input
- **THEN** the project MUST record the source path, source type, coverage scope, and current confidence state
- **AND** data without readable or attributable source MUST remain candidate or out of runtime scope

#### Scenario: Runtime image promotion
- **WHEN** an external image is promoted into `public/assets/i18n/zh-CN/the-gang/**`
- **THEN** the intake contract MUST identify the source image, runtime object, compressed output, manifest key, and validation evidence
- **AND** unclassified hash-named images MUST NOT be referenced by runtime code

#### Scenario: 规则对象素材矩阵阻塞完成
- **WHEN** The Gang 汇报基础版完成
- **THEN** 项目 MUST 维护基础版规则对象到素材需求矩阵，覆盖扑克牌牌面、牌背、四轮筹码、警报/失败标记、金条/成功标记、桌面/牌槽和玩家帮助/规则卡
- **AND** 每个基础版必需对象 MUST 具备已锁定运行时素材、明确缺口/阻塞状态，或明确批准的程序化替代
- **AND** 仍处于 `blocked` 或 `base-runtime-candidate` 的图片素材 MUST NOT 被当作已完成运行时资源
- **AND** HTML/CSS 画出的相似物、纯文字牌、程序化图形、mock 图片或只属于扩展的素材 MUST NOT 被当作基础版必需素材闭环，除非矩阵明确记录用户批准的程序化替代
- **AND** 发现基础版必需素材缺口时，项目 MUST 先更新 proposal/tasks/spec 与素材矩阵，再继续查找、裁切、命名、落盘或实施；不得用 E2E 通过绕过该缺口

#### Scenario: 布局真相源阻塞 UI 完成
- **WHEN** The Gang 使用 DOM、HTML、TTS Workshop JSON、XmlUI、对象 `Transform`、截图或 PureRef 图板作为布局输入
- **THEN** 项目 MUST 记录哪些来源为空、哪些来源非空，以及当前 UI 布局以哪个来源为权威
- **AND** 单个 DOM 文件为空 MUST NOT 排除 TTS Workshop JSON 这类非空布局真相源
- **AND** 若 TTS Workshop JSON 包含桌面对象、牌槽、token、筹码、参考板或模型坐标，项目 MUST 先抽取布局合同，再汇报主 Board UI 完成
- **AND** 在 Board 尚未按布局合同复核时，真实页面 E2E MUST 只能作为运行时流程验证，不得作为 UI 复刻完成证据

### Requirement: The Gang runtime entry validation
The Gang SHALL have a supported-entry validation path that proves the registered game can be entered and the current viewer can operate through the user-facing board. One client MUST remain bound to one viewer identity and MUST NOT expose a multi-human hotseat switcher. The current viewer's key chip choices and public progression MUST use visible UI controls. A single-client representative-state E2E MAY use state injection or test command dispatch for other seats, but it MUST be labeled as state-injection evidence and MUST NOT claim natural multi-client flow, seat authorization, or synchronization. Runtime entry validation SHALL NOT override unresolved base-game material blockers.

#### Scenario: One heist playable through the board
- **GIVEN** `the-gang` is discoverable from the generated game registry
- **WHEN** a user enters a The Gang match from a supported online entry or an approved local-AI/test entry
- **THEN** the board MUST reach the first actionable chip-selection state
- **AND** all player names and public chip states MUST remain visible without a hotseat switcher
- **AND** hidden hand contents MUST remain limited to the current viewer
- **AND** the current viewer MUST select chips and use visible progression controls through the user-facing board
- **AND** other seats MAY be driven by state injection or test commands only when the evidence is explicitly reported as a representative-state test
- **AND** evidence claiming natural multiplayer operation, seat authorization, or synchronization MUST use separate player clients
- **AND** mobile delivery MUST treat landscape as the primary orientation; portrait evidence MAY validate compatibility and key-region visibility without requiring direct horizontal scrolling inside the Board
- **AND** desktop and mobile landscape evidence MUST be recorded for the current implementation
- **AND** if required base-game assets are still missing, blocked, or unapproved as programmatic replacements, this validation MUST be reported only as runtime-code validation and MUST NOT close base-game completion

### Requirement: The Gang Public Action Log
The system SHALL record The Gang public gameplay actions in `G.sys.actionLog.entries` using i18n action-log segments.

#### Scenario: Heist progress is logged publicly
- **WHEN** a player takes a chip, ends a round, reveals showdown, or starts the next heist
- **THEN** the action log records the public progress event and visible result summary
- **AND** the log MUST NOT reveal hidden hand card details

### Requirement: The Gang Visible Local AI
The system SHALL provide a visible local AI runtime for The Gang that uses the shared AI decision contract and existing game command pipeline. This runtime SHALL represent one human viewer with AI seats or a test/tutorial path and SHALL NOT require a multi-human hotseat switcher.

#### Scenario: AI chooses from legal actions
- **GIVEN** The Gang is in chip-selection phase
- **WHEN** the AI decision context is built for a local AI player
- **THEN** the legal actions include only currently available chip choices or valid public progression commands
- **AND** the baseline policy MUST return an action id from the current legal action set

### Requirement: The Gang Basic Tutorial
The system SHALL provide a non-empty The Gang basic tutorial that teaches the public rules and points at stable Board highlight targets.

#### Scenario: Tutorial loads with concrete steps
- **WHEN** the The Gang tutorial module is loaded
- **THEN** it exposes concrete steps for goal track, hand, chip choice, round progress, player list, showdown, and finish
- **AND** the Board MUST expose stable tutorial anchors for those highlights

### Requirement: The Gang Shared Undo UI Bridge
The system SHALL expose The Gang undo snapshots through the shared undo HUD context rather than leaving undo as a hidden engine-only capability.

#### Scenario: Board provides undo state
- **GIVEN** The Gang Board is mounted
- **WHEN** the shared HUD queries undo state
- **THEN** the HUD can read the current match state, dispatch function, player id, game-over flag, and local-mode flag from `UndoProvider`
- **AND** The Gang MUST use a dedicated undo snapshot allowlist independent from the action-log allowlist

### Requirement: The Gang scope boundary
The Gang SHALL distinguish delivered base-game scope from future expansion scope.

#### Scenario: Expansion content is out of current runtime scope
- **GIVEN** 7-10 人扩展、Joker、工具牌、Dealer、挑战卡、专家卡或其它扑克变体被发现 in source material
- **WHEN** reporting current The Gang completion
- **THEN** the project MUST NOT use expansion exclusion as proof that base-game materials are complete
- **AND** expansion or variant content MUST remain outside current runtime scope unless a future change explicitly approves it
