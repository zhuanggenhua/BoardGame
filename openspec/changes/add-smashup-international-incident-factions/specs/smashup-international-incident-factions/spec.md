## ADDED Requirements

### Requirement: Smash Up SHALL register four International Incident factions as complete playable factions

系统 SHALL 将相扑手、火枪手、骑警和摔角手注册为四个独立、可选择、可初始化且可完整结算的 Smash Up 派系。

#### Scenario: Four factions appear in the formal faction picker

- **WHEN** 玩家打开正式派系选择入口
- **THEN** 系统 MUST 显示相扑手、火枪手、骑警和摔角手
- **AND** 每个派系 MUST 使用独立 faction ID、card ID、base ID、locale 和 faction metadata

#### Scenario: Each faction initializes with its exact twenty-card composition

- **WHEN** 任一新增派系被选入玩家牌库
- **THEN** 系统 MUST 按 TTS 来源合同构建恰好 20 张实体牌
- **AND** 相扑手 MUST 使用 12 个唯一卡面
- **AND** 火枪手 MUST 使用 14 个唯一卡面
- **AND** 骑警 MUST 使用 12 个唯一卡面
- **AND** 摔角手 MUST 使用 13 个唯一卡面

### Requirement: International Incident factions SHALL use auditable shared atlas contracts

系统 SHALL 使用用户提供的 `8 x 7` 卡牌 atlas 和 TTS 提供的 `4 x 4` 基地 atlas，并保持槽位、资源路径、manifest 和运行时引用可追溯。

#### Scenario: Card atlas slots map to the four factions

- **WHEN** 系统解析新增派系卡图
- **THEN** 槽位 `0-11` MUST 映射相扑手
- **AND** 槽位 `12-25` MUST 映射火枪手
- **AND** 槽位 `26-37` MUST 映射骑警
- **AND** 槽位 `38-50` MUST 映射摔角手
- **AND** 槽位 `51-55` MUST NOT 被注册为手牌

#### Scenario: Base atlas slots map to the four factions

- **WHEN** 系统解析新增派系基地图
- **THEN** 相扑手 MUST 映射 `Heya Training Stable` 与 `The Dohyo`
- **AND** 火枪手 MUST 映射 `Bastion Saint-Gervais` 与 `The Golden Lily`
- **AND** 骑警 MUST 映射 `Strategic Syrup Reserve` 与 `Great White North, Eh?`
- **AND** 摔角手 MUST 映射 `Ringside` 与 `The Squared Circle`
- **AND** 未被本批次使用的基地槽位 MUST NOT 被注册为本批次基地

### Requirement: Every printed card and base clause SHALL resolve through the authoritative runtime

系统 SHALL 将 51 个唯一卡面和 8 张基地的每个规则子句实现到最终权威状态，而不是只完成静态展示或交互入口。

#### Scenario: A card with multiple clauses resolves all clauses

- **WHEN** 一张新增卡牌包含多个时机、目标、分支、额外效果或清理子句
- **THEN** 系统 MUST 为每个 effect atom 提供对应的 validator、handler、trigger、modifier、interaction 或 reducer 消费链
- **AND** 测试 MUST 验证主效果、分支、消耗、限制和最终清理

#### Scenario: Optional effects remain optional with legal candidates

- **WHEN** 新增能力使用“可以”“至多”或“任意数量”等可选语义
- **AND** 当前存在合法候选
- **THEN** 玩家 MUST 能选择效果目标
- **AND** 玩家 MUST 同时能跳过或提交空选
- **AND** 跳过路径 MUST NOT 改变不应改变的权威状态

### Requirement: International Incident immediate extra plays SHALL expose target selection as an explicit step

系统 SHALL 将国际事件派系产生的即时额外随从或即时额外战术按规则顺序拆成“选择额外卡牌”与“选择目标”两个交互步骤；即使当前只有一个合法基地或随从目标，也不得在选择卡牌的同一次响应中静默替玩家提交目标。

#### Scenario: A single legal base for an extra minion still requires target confirmation

- **WHEN** 火枪手“投入战斗”产生即时额外随从，且当前只有一个合法基地
- **THEN** 玩家选择额外随从后 MUST 先进入基地目标选择
- **AND** 只有玩家提交该基地目标后，系统 MUST 产生随从打出、额外行动限制和待处理效果消费结果

#### Scenario: A single legal minion for an extra action still requires target confirmation

- **WHEN** 火枪手的即时额外战术只能作用于一个合法随从
- **THEN** 玩家选择额外战术后 MUST 先进入随从目标选择
- **AND** 只有玩家提交该随从目标后，系统 MUST 产生行动牌打出和目标效果结果

#### Scenario: A restricted extra action cannot affect another minion

- **WHEN** 阿拉米斯产生只允许作用于阿拉米斯本人的即时额外行动
- **THEN** 目标交互 MUST 只提供阿拉米斯
- **AND** 提交该目标后，行动牌 MUST 影响阿拉米斯而不得影响同基地的其他随从

### Requirement: International Incident faction implementation SHALL close one faction at a time

系统 SHALL 逐派系完成静态数据、玩法、基地、测试、E2E 和 evidence 后再推进下一个派系。

#### Scenario: A faction is reported complete

- **WHEN** 系统将某个新增派系标记为完成
- **THEN** 该派系的全部卡牌和基地 MUST 已有对象级规则矩阵
- **AND** 该派系 MUST 已通过定向 L2 行为测试
- **AND** 该派系 MUST 已通过真实入口 L3/L4 E2E
- **AND** evidence MUST 记录截图绝对路径、最终权威状态和残余范围

### Requirement: International Incident assets and verification SHALL meet production delivery gates

系统 SHALL 完成压缩资源、关键图片预加载、游戏级与根级 manifest、R2/CDN 上传、远端回查和自动化验证。

#### Scenario: Runtime requests the new card or base assets

- **WHEN** 玩家选择新增派系或新增基地进入游戏
- **THEN** 运行时 MUST 请求已登记的正式压缩资源
- **AND** 代表资源 URL MUST 返回成功响应
- **AND** 派系选择和棋盘截图 MUST 不存在 atlas shimmer、白板卡面或错误槽位

#### Scenario: The batch is ready for closeout

- **WHEN** 本 change 准备标记全部任务完成
- **THEN** 定向 Vitest、typecheck、i18n、资源校验和 OpenSpec strict validation MUST 通过
- **AND** 四派系真实选择、开局和代表复杂玩法链路 MUST 有有效 E2E 截图证据
- **AND** 任一未实现或未验证对象 MUST 被标记为 blocked 或经用户确认的 scoped-debt
