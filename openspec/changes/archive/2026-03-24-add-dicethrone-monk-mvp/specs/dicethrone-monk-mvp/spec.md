## ADDED Requirements

### Requirement: 1v1 回合阶段流转
系统 SHALL 按《王权骰铸》第2版规则在 1v1 对局中驱动回合阶段，并在阶段间正确约束可执行操作。

#### Scenario: 起始玩家首回合跳过收入阶段
- **WHEN** 起始玩家进入其第 1 个回合
- **THEN** 系统跳过 Income Phase 的“获得 1CP 与抽 1 张牌”

#### Scenario: 弃牌阶段强制出售至6张
- **WHEN** 主动玩家进入 Discard Phase 且手牌数量大于 6
- **THEN** 系统 MUST 要求玩家通过“出售卡牌”将手牌弃至 6
- **AND THEN** 出售获得的 CP 不得使 CP 超过 15

### Requirement: 掷骰次数与锁定
系统 SHALL 在 Offensive Roll Phase 中允许玩家最多掷骰 3 次，并支持锁定/解锁骰子以决定重掷集合。

#### Scenario: 第一次掷 5 颗，后续可选重掷
- **WHEN** 玩家进入 Offensive Roll Phase
- **THEN** 系统 MUST 允许玩家进行最多 3 次投掷
- **AND THEN** 第 2/3 次投掷 MUST 仅对玩家选择的未锁定骰子生效

### Requirement: 技能判定与发动
系统 SHALL 根据最终骰面判定“僧侣”可发动的技能，并在玩家选择后进行结算。

#### Scenario: 小顺/大顺技能可用性提示
- **WHEN** 玩家完成掷骰并确认最终骰面
- **THEN** 系统 MUST 判定小顺(任意4连)与大顺(5连)是否成立
- **AND THEN** 系统 MUST 在 UI 中高亮可发动的对应技能

### Requirement: 技能可用性高亮与置灰
系统 SHALL 在玩家确认最终骰面后，高亮可发动技能区域并将不可发动的技能区域置灰，以减少误操作。

#### Scenario: 确认最终骰面后高亮可用技能
- **WHEN** 玩家确认最终骰面并进入选择进攻技能的阶段
- **THEN** 系统 MUST 高亮所有满足触发条件的技能区域
- **AND THEN** 系统 MUST 将不满足触发条件的技能区域置灰

### Requirement: 防御阶段触发条件
系统 SHALL 仅在进攻能力属于“攻击”且伤害可被防御时进入 Defensive Roll Phase，否则跳过。

#### Scenario: 不可防御伤害不进入防御阶段
- **WHEN** 进攻结算产生“不可防御伤害”
- **THEN** 系统 MUST NOT 进入 Defensive Roll Phase

### Requirement: 防御能力宣告
系统 SHALL 在防御玩家存在多个可选防御能力时，要求其在掷防御骰之前先宣告选择的防御能力。

#### Scenario: 有多个防御能力时先宣告再掷骰
- **WHEN** 防御玩家存在多个可用防御能力
- **THEN** 系统 MUST 在掷防御骰之前要求玩家选择并宣告其一

### Requirement: 状态效果（僧侣）
系统 SHALL 支持僧侣状态效果的堆叠上限、获得/施加、消耗与结算时机，并与提示板规则一致。

#### Scenario: 太极堆叠上限
- **WHEN** 玩家获得太极标记
- **THEN** 系统 MUST 将其堆叠数量限制在 5（超过则补到上限）

#### Scenario: 闪避用于降低伤害
- **WHEN** 持有闪避标记的玩家即将受到伤害
- **THEN** 玩家 MAY 消耗闪避并按提示板规则掷骰以减少伤害

### Requirement: 僧侣全量中文手牌的时机与结算
系统 SHALL 将僧侣全量中文手牌加入僧侣牌库，该集合来源为 `public/assets/dicethrone/images/monk/compressed/monk-ability-cards.png`；系统 SHALL 按卡牌边框颜色约束打出时机并结算其效果。

#### Scenario: 蓝色牌仅主要阶段可打出
- **WHEN** 玩家尝试打出一张主要阶段行动卡（蓝色）
- **THEN** 系统 MUST 仅在 Main Phase 1/2 允许打出

#### Scenario: 红色立即行动可中断非立即行动
- **WHEN** 任意玩家处于一个可被中断的结算流程中
- **THEN** 另一玩家 MUST 能在合法窗口打出红色立即行动卡并在结算后返回原流程继续

### Requirement: 技能牌类型区分
系统 SHALL 将技能牌区分为“升级基础技能”与“技能使用”两类，并据此驱动 UI 与流程。

#### Scenario: 升级型技能牌触发升级流程
- **WHEN** 玩家打出升级型技能牌
- **THEN** 系统 MUST 进入英雄升级流程并覆盖面板对应能力区域

#### Scenario: 技能使用型牌以技能牌缩略图展示
- **WHEN** 玩家拥有可用的技能使用型牌
- **THEN** 系统 MUST 在技能展示区域以技能牌缩略图显示该技能（来源为 `public/assets/dicethrone/images/monk/compressed/monk-ability-cards.png` 图集裁切），并允许按描述发动

### Requirement: 卡牌背景资源使用
系统 SHALL 在手牌/技能牌/升级卡的渲染中使用通用卡牌背景 `public/assets/dicethrone/images/Common/compressed/card-background.*`，并遵循图片使用规范（`OptimizedImage` / `buildOptimizedImageSet`，`src` 传 `dicethrone/images/Common/compressed/card-background`）。

#### Scenario: 卡牌渲染使用通用背景
- **WHEN** 系统渲染任意手牌/技能牌/升级卡
- **THEN** 系统 MUST 使用通用卡牌背景资源作为底图

### Requirement: 英雄升级卡（I→II→III）
系统 SHALL 支持英雄升级卡在主要阶段打出，并按规则处理 I→II→III 的升级与 CP 支付。

#### Scenario: 升级卡仅主要阶段可打出
- **WHEN** 玩家尝试打出一张英雄升级卡
- **THEN** 系统 MUST 仅在 Main Phase 1/2 允许打出

#### Scenario: 已有II升级到III仅支付差价
- **WHEN** 玩家已拥有某能力的 II 级升级卡
- **AND WHEN** 玩家打出该能力的 III 级升级卡
- **THEN** 系统 MUST 仅扣除 II 与 III 的 CP 差价

#### Scenario: 升级卡覆盖替换面板能力区域
- **WHEN** 玩家成功打出升级卡并完成升级结算
- **THEN** 系统 MUST 将升级卡图像覆盖在对应能力区域以替换显示

### Requirement: 面板/提示板原图展示与对手面板查看
系统 SHALL 将僧侣玩家面板（`public/assets/dicethrone/images/monk/compressed/monk-player-board.png`）与僧侣提示板（`public/assets/dicethrone/images/monk/compressed/monk-tip-board.png`）作为原图素材提供查看，并支持通过对手头像进行“对手视图”切换以查看对手面板。

#### Scenario: 查看僧侣提示板
- **WHEN** 玩家在对局中请求查看僧侣提示板
- **THEN** 系统 MUST 打开包含 `public/assets/dicethrone/images/monk/compressed/monk-tip-board.png` 的弹窗/抽屉

#### Scenario: 点击对手头像切换到对手视图
- **WHEN** 玩家点击对手头像
- **THEN** 系统 MUST 切换到对手视图以展示对手面板
- **AND THEN** 对手视图 MUST 同时展示对手玩家面板与提示板原图
- **AND THEN** 对手视图 MUST 不显示手牌与骰盘等交互

#### Scenario: 面板弹窗合并显示玩家面板与提示板
- **WHEN** 玩家打开面板弹窗
- **THEN** 系统 MUST 在同一弹窗中展示玩家面板与提示板原图

#### Scenario: 主战斗视图以玩家面板为中心布局
- **WHEN** 玩家处于主战斗视图
- **THEN** 系统 MUST 以玩家面板为视觉中心并占据近半屏空间
- **AND THEN** 骰盘 MUST 位于玩家面板的中部区域

### Requirement: 顶部对手HUD与已使用技能展示
系统 SHALL 在主战斗视图顶部常驻显示对手头像、对手状态效果、对手最近投掷结果（骰面）与对手打出的技能牌缩略图。

#### Scenario: 对手发动技能后顶部展示更新
- **WHEN** 对手发动一个技能并开始结算
- **THEN** 系统 MUST 在顶部HUD展示该技能牌的缩略图（可附名称）

#### Scenario: 对手投掷后顶部展示更新
- **WHEN** 对手完成一次投掷并确定当前骰面
- **THEN** 系统 MUST 在顶部HUD展示对手当前骰面结果

### Requirement: 基础能力卡覆盖展示
系统 SHALL 支持使用基础能力图集 `public/assets/dicethrone/images/monk/compressed/monk-base-ability-cards.png` 将基础能力以卡牌覆盖方式展示在玩家面板对应区域。

#### Scenario: 基础能力以覆盖卡方式展示
- **WHEN** 玩家进入主战斗视图
- **THEN** 系统 MUST 将基础能力卡以覆盖方式展示在玩家面板对应区域

### Requirement: 玩家面板尺寸自适配
系统 SHALL 支持不同英雄的玩家面板图片尺寸差异，能力区域与覆盖区域位置必须基于原图宽高比例配置。

#### Scenario: 不同尺寸玩家面板的覆盖区域不偏移
- **WHEN** 系统加载一个与僧侣不同尺寸的玩家面板图片
- **THEN** 系统 MUST 仍能将能力覆盖区域渲染在正确位置且不发生明显偏移

### Requirement: 对手状态效果展示
系统 SHALL 在主战斗视图顶部HUD与对手视图中展示对手当前持有的状态效果图标与层数；状态效果图标来源为 `public/assets/dicethrone/images/monk/compressed/effect-icons.png`。

#### Scenario: 对手拥有状态效果时展示图标与层数
- **WHEN** 对手存在任意状态效果标记
- **THEN** 系统 MUST 在顶部HUD/对手视图展示对应图标并标注层数

### Requirement: 终极不可响应
系统 SHALL 执行“终极不可响应”约束：终极触发后至掷骰阶段结束，任何玩家不得采取行动；终极的伤害与效果可被增强，但不可被减少/避免/阻止/响应/中断。

#### Scenario: 终极触发后禁止响应直至阶段结束
- **WHEN** 任意玩家触发终极并进入其结算流程
- **THEN** 系统 MUST 禁止另一玩家打出卡牌或触发任何响应行为直至该掷骰阶段结束
