## ADDED Requirements

### Requirement: Smash Up SHALL register four Culture Shock factions as complete playable factions

系统 SHALL 将阿南西传说、格林童话、俄罗斯童话和古代印加人注册为四个独立、可选择、可初始化且可完整结算的 Smash Up 派系。

#### Scenario: Four factions appear in the formal faction picker

- **WHEN** 玩家打开正式派系选择入口
- **THEN** 系统 MUST 显示阿南西传说、格林童话、俄罗斯童话和古代印加人
- **AND** 每个派系 MUST 使用独立 faction ID、card ID、base ID、locale 和 faction metadata

#### Scenario: Each faction initializes with its exact twenty-card composition

- **WHEN** 任一新增派系被选入玩家牌库
- **THEN** 系统 MUST 按 TTS 来源合同构建恰好 20 张实体牌
- **AND** 阿南西传说 MUST 使用 13 个唯一卡面
- **AND** 格林童话 MUST 使用 18 个唯一卡面
- **AND** 俄罗斯童话 MUST 使用 16 个唯一卡面
- **AND** 古代印加人 MUST 使用 12 个唯一卡面

### Requirement: Culture Shock factions SHALL use auditable shared atlas contracts

系统 SHALL 使用用户提供的 `10 x 6` 卡牌 atlas 和 TTS 提供的 `4 x 3` 基地 atlas，并保持槽位、资源路径、manifest 和运行时引用可追溯。

#### Scenario: Card atlas slots map to the four factions

- **WHEN** 系统解析新增派系卡图
- **THEN** 槽位 `0-12` MUST 映射阿南西传说
- **AND** 槽位 `13-30` MUST 映射格林童话
- **AND** 槽位 `31-46` MUST 映射俄罗斯童话
- **AND** 槽位 `47-58` MUST 映射古代印加人
- **AND** 槽位 `59` MUST NOT 被注册为卡牌

#### Scenario: Culture Shock base atlas is shared without duplicate registration

- **WHEN** 本 change 与波利尼西亚人批次同时使用《文化冲击》基地 atlas
- **THEN** 系统 MUST 只保留一个 atlas ID、资源路径和 manifest key
- **AND** 每个 change MUST 只注册自己负责的基地槽位
- **AND** 任一 change MUST NOT 覆盖另一 change 已存在的基地映射

### Requirement: Every printed card and base clause SHALL resolve through the authoritative runtime

系统 SHALL 将 59 个唯一卡面和 8 张基地的每个规则子句实现到最终权威状态，而不是只完成静态展示或交互入口。

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

### Requirement: Culture Shock faction implementation SHALL close one faction at a time

系统 SHALL 逐派系完成静态数据、玩法、基地、测试、E2E 和 evidence 后再推进下一个派系。

#### Scenario: A faction is reported complete

- **WHEN** 系统将某个新增派系标记为完成
- **THEN** 该派系的全部卡牌和基地 MUST 已有对象级规则矩阵
- **AND** 该派系 MUST 已通过定向 L2 行为测试
- **AND** 该派系 MUST 已通过真实入口 L3/L4 E2E
- **AND** evidence MUST 记录截图绝对路径、最终权威状态和残余范围

### Requirement: Culture Shock assets and verification SHALL meet production delivery gates

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
