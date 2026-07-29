# Design: 波利尼西亚航海者实现方案

## Context

波利尼西亚航海者（Polynesian Voyagers）在当前仓库处于半接入状态：

- `SMASHUP_FACTION_IDS.POLYNESIAN_VOYAGERS` 已存在。
- `SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_CARDS` 已存在，但本地缺少正式卡牌 atlas 文件。
- `SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES` 已存在，并被阿南西传说、格林童话、俄罗斯童话、古代印加人等文化冲击派系共享为基地 atlas。
- `evidence/smashup/SMASHUP-CARD-COUNT-AUDIT.md` 仍标记波利尼西亚航海者未实现。

本 change 需要补齐正式派系，而不是另起一套重复 ID、重复 atlas 或复制共享基地资源。

## Goals

- 让波利尼西亚航海者成为可选择、可初始化、可玩、可验证的 Smash Up 派系。
- 把用户提供的 3 行 × 4 列卡牌图集作为正式卡牌 atlas 接入 PR 范围。
- 复用已有共享基地 atlas，只新增该派系的基地 definitions 与能力绑定。
- 尽量复用现有领域事件和注册机制，避免新增一次性私有状态机。

## Non-Goals

- 不重排现有文化冲击基地 atlas。
- 不覆盖阿南西传说、格林童话、俄罗斯童话、古代印加人已使用的基地槽位。
- 不把波利尼西亚航海者需求扩展成文化冲击整包重审。
- 不在批准前修改运行时代码或正式资源树。

## Current Reusable Mechanisms

### 力量指示物

复用 `src/games/smashup/domain/abilityHelpers.ts` 的 `addPowerCounter`：

- 寻路者移动后 +1。
- 海洋纹身天赋移动后 +1。
- 鲨鱼纹身打出时 +1、回合开始满足条件时 +1。
- 岛峰回合开始满足条件时 +1。

### 附着行动

复用 `buildSemanticOngoingAttachEvents`：

- 海洋纹身、鲨鱼纹身、太阳纹身都应作为 `ongoingTarget: 'minion'` 的附着行动。
- 纹身艺术家若选择“作为额外行动打出”，也应走既有 play-action / attach 语义，不直接手写 `attachedActions`。

### 移动随从

复用 `buildValidatedMoveEvents`：

- 寻路者、毛伊人、海洋纹身、部落的成长、火山爆发、太阳纹身计分后特殊都应产出标准 `MINION_MOVED` 事件。
- 目标过滤需要额外套用“目标基地没有该玩家随从”的本派系条件。

### 抽牌与额外额度

复用：

- `buildStandardDrawEvents` 处理部落的知识。
- `grantExtraMinion` / `grantContextualExtraMinion` 处理部落的成长的额外随从打出。
- `grantExtraAction` 或现有外部行动打出链处理纹身艺术家的额外行动打出。

### 基地能力与断点修正

复用：

- `registerBaseAbility` 绑定岛链 afterScoring、岛峰 onTurnStart。
- `registerBreakpointModifier` 绑定热带天堂动态断点。
- 现有 afterScoring 反应队列负责计分后触发顺序和最终清场。

## Implementation Decisions

### 1. 派系数据文件

新增 `src/games/smashup/data/factions/polynesian_voyagers.ts`，并按图集 row-major 索引录入：

| index | 中文名 | English | 类型 | 数量 | 关键字段 |
| --- | --- | --- | --- | --- | --- |
| 0 | 部落的成长 | Growth of the Tribes | action | 1 | onPlay, extra |
| 1 | 部落的知识 | Knowledge of the Tribes | action | 1 | onPlay, draw |
| 2 | 莫艾 | Mo'ai | minion | 4 | power 3, ongoing |
| 3 | 蒂基 | Tiki | minion | 3 | power 3, ongoing |
| 4 | 寻路者 | Wayfinder | minion | 2 | power 4, talent |
| 5 | 毛伊人 | Maui | minion | 1 | power 5, onPlay, talent |
| 6 | 海洋纹身 | Ocean Tattoo | action | 1 | ongoingTarget minion, talent |
| 7 | 纹身艺术家 | Tattoo Artist | action | 1 | onPlay, search/play extra |
| 8 | 部落的统一 | Unity of the Tribes | action | 1 | onPlay, temp power |
| 9 | 火山爆发 | Volcanic Uprising | action | 1 | onPlay, extra base/replacement |
| 10 | 鲨鱼纹身 | Shark Tattoo | action | 2 | ongoingTarget minion, counter, onTurnStart |
| 11 | 太阳纹身 | Sun Tattoo | action | 2 | ongoingTarget minion, afterScoring special |

基地复用共享 atlas：

| index | 中文名 | English | breakpoint | VP |
| --- | --- | --- | --- | --- |
| 8 | 岛链 | Island Chain | 17 | 3/1/1 |
| 9 | 岛峰 | Island Peak | 23 | 4/2/1 |
| 10 | 热带天堂 | Tropical Paradise | 20 | 3/2/1 |

### 2. 能力模块

新增 `src/games/smashup/abilities/polynesian_voyagers.ts`，导出：

- `registerPolynesianVoyagersAbilities`
- `registerPolynesianVoyagersInteractionHandlers`

并在 `src/games/smashup/abilities/index.ts` 中增量注册。

### 3. 莫艾移动限制

莫艾的持续能力有两层：

- 其他玩家不能把他们的随从移动到莫艾所在基地。
- 其他玩家不能把这个莫艾移动到其它基地。

优先实现为共享移动语义校验/拦截的一部分，而不是只在波利尼西亚航海者自己的 handler 里过滤。原因是限制必须影响所有派系发起的移动。候选落点：

- `buildValidatedMoveEvents` 前后的语义过滤。
- 或领域层已有 protection / semantic block 系统的 move 分支。

验收必须包含其它派系尝试移动到莫艾所在基地、其它玩家尝试移动莫艾离开两条负向测试。

### 4. 太阳纹身 afterScoring 特殊

太阳纹身存在普通附着与计分后手牌 special 两种入口：

- 普通打出：打在己方随从上，持续 +2。
- 计分后特殊：从手牌打在正在计分基地上一个没有行动的己方随从上，并把该随从移动到另一基地代替进入弃牌堆。

实现应走 afterScoring 注册和统一反应窗口，不应在计分清场后手工复活。测试必须证明：

- 响应窗口中随从仍在计分基地上。
- 有附着行动的随从不是合法目标。
- 结算后该随从和太阳纹身附着行动位于目标基地，未进入弃牌堆。

### 5. 额外基地

毛伊人、火山爆发和岛链都会增加基地数量。实现前需要确认当前 domain 是否已有“从基地牌库打出额外基地”和“替换空基地为两个基地”的标准事件；若已有则复用，若缺失则补共享 helper，而不是直接改 `core.bases`。

验收至少覆盖：

- 毛伊人可从基地牌库顶打出至多两张基地。
- 火山爆发可选择打出牌库顶基地并移动一个己方随从，或摧毁无玩家随从的基地并替换为两个基地。
- 岛链计分后打出基地牌库顶作为额外基地。

### 6. 热带天堂断点

热带天堂“若每位玩家在此基地上都有至少一个随从，起始断点为 0”应作为 breakpoint modifier，而不是永久改写 base definition。

测试需要覆盖：

- 条件不满足时有效断点仍为 20。
- 每位玩家都有随从时有效断点为 0。
- 随从移走后断点恢复。

## Risks And Mitigations

- 风险：当前工作区有大量其它 Smash Up 未提交改动。
  - 缓解：每次改共享注册文件前先读当前内容，只做增量追加；最终提交前显式审查本 change 范围。
- 风险：莫艾限制若只放本派系 handler，会漏拦其它派系移动。
  - 缓解：把它作为全局 move semantic 测试门禁。
- 风险：太阳纹身在 afterScoring 清场时序里容易变成复活/重复计分 bug。
  - 缓解：使用统一 afterScoring reaction window，并测试 `finalState / reaction session / 清场后续`。
- 风险：卡牌源图来自用户附件，不在仓库资源树。
  - 缓解：批准后复制到正式路径、压缩、manifest、远端回查，并确保 PR 包含图集源图与压缩产物。

## Validation Plan

- Static intake test:
  - faction id、20 张牌组成、3 个基地、atlas index、manifest key、locale key。
- Ability behavior tests:
  - 部落的知识抽牌。
  - 部落的统一临时力量。
  - 寻路者/海洋纹身移动并加 +1。
  - 蒂基/太阳纹身持续力量。
  - 鲨鱼纹身打出和回合开始计数。
  - 莫艾移动限制。
  - 太阳纹身 afterScoring 特殊。
  - 岛链、岛峰、热带天堂基地能力。
- E2E:
  - 派系选择显示波利尼西亚航海者。
  - 状态注入或真实打牌链看到卡图和基地图。
  - 至少一条 movement/tattoo 真实入口交互链。
- Resource gates:
  - `npm run compress:images -- public/assets/i18n/zh-CN/smashup/cards`
  - `npm run assets:manifest`
  - 定向 upload check / upload
  - 代表 URL `HEAD 200`
