# Smash Up longzu implementation handoff（2026-06-01）

## 目的

把 `longzu` 三派系的 implementation handoff 落成可执行清单，避免后续重新从 0 分析：

- 明确基地不再阻塞：用户指出已录入记录后，复核确认 6 个基地已在 `shayu` 基地图合同中存在
- 补齐三派系卡牌 / 基地的权威英文效果摘要
- 为每个派系建立“旧实现映射表”
- 标记哪些能力可直接复用，哪些需要补共享层

本文件同时记录当前 hidden gameplay implementation 与 visible/base 收口衔接。

2026-06-01 当前进度补记：

- 龙 / 超级英雄 / 极客三派系的 hidden gameplay implementation 已全部落地
- 基地已改为复用 `public/assets/i18n/zh-CN/smashup/base/shayu.png` 的 `smashup:base7` 已录入合同，不再等待 `base/longzu.png`

## 基地复核裁定

当前 `base/longzu.png` 仍不是本批基地，但这不再构成本批阻塞。复核 `evidence/smashup/smashup-shayu-faction-intake-contract.md` 后，确认本批所需 6 个基地已经在 `shayu` 基地图里登记：

- 图集：`public/assets/i18n/zh-CN/smashup/base/shayu.png`
- atlasId：`smashup:base7`
- grid：`4 x 3`
- 索引：row-major，0-based
- 结论：直接复用 `shayu` 已录入基地合同，允许接入真实 base defs、UI metadata 与真实派系选择流程

相关 intake 合同仍以 [smashup-longzu-intake-contract-2026-05-31.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-intake-contract-2026-05-31.md) 为准。

## 权威来源

### 本地来源

- 当前卡图：`public/assets/i18n/zh-CN/smashup/cards/longzu.png`
- 当前基地复用图集：`public/assets/i18n/zh-CN/smashup/base/shayu.png`
- 卡图切片核对：`temp/smashup-longzu-intake/longzu-cards-grid-5x8-numbered.png`
- 错基地核对：`temp/smashup-longzu-intake/longzu-base-overview.png`
- 现有隐藏静态 defs：
  - `src/games/smashup/data/factions/dragons.ts`
  - `src/games/smashup/data/factions/superheroes.ts`
  - `src/games/smashup/data/factions/geeks.ts`
- 可复用基地数值来源：`evidence/smashup/smashup-shayu-faction-intake-contract.md`

### 外部权威对照

- Dragons：<https://smashup.fandom.com/wiki/Dragons>
- Superheroes：<https://smashup.fandom.com/wiki/Superheroes>
- Geeks：<https://smashup.fandom.com/wiki/Geeks>
- Bases：<https://smashup.fandom.com/wiki/Bases>

## 六个已接入基地的静态数值

这些数值已接入 `BASE_CARDS_ITS_YOUR_FAULT`，`previewRef` 指向 `smashup:base7` 中已录入的索引。

| 派系 | 基地 | defId | base7 index | breakpoint | VP |
| --- | --- | --- | ---: | ---: | --- |
| 龙 | Wyrm's Desolation | `base_wyrms_desolation` | 1 | 20 | 5/3/2 |
| 龙 | Dragon's Lair | `base_dragons_lair` | 4 | 18 | 2/2/1 |
| 超级英雄 | Converted Cave | `base_converted_cave` | 7 | 18 | 4/3/2 |
| 超级英雄 | Crystal Fortress | `base_crystal_fortress` | 10 | 19 | 3/1/1 |
| 极客 | TableTop | `base_tabletop` | 0 | 20 | 4/2/1 |
| 极客 | The Con | `base_the_con` | 3 | 24 | 5/3/2 |

## 旧实现映射总览

| 目标机制 | 当前 longzu 对象 | 现有参考实现 | 结论 |
| --- | --- | --- | --- |
| 基地替换并保留随从 | `Burn it Down` | `src/games/smashup/abilities/aliens.ts` `alien_terraform`；`src/games/smashup/abilities/yuanhou.ts` `time_travelers_time_is_fleeting` | 已接入：复用了 keepCards 替换主链，并补了“基地弃牌堆选替代基地 + 最终 baseDeck/baseDiscard 收敛” |
| 基地上额外打出随从 | `Bring Down the Walls`；`Dragon's Lair` 同类入口参考 | `src/games/smashup/domain/baseAbilities.ts` `base_ninja_dojo`；`src/games/smashup/abilities/sharks.ts`/`abilityHelpers.ts` extra minion helpers | 可复用“非出牌阶段额外打出随从”链路 |
| 基地上额外打出力量≤2随从 | `Sidekick`；`Converted Cave` 不同语义但同 power gate | `src/games/smashup/domain/baseAbilities.ts` `base_the_homeworld`；`src/games/smashup/domain/baseAbilities_expansion.ts` `base_secret_garden` | 可复用 `grantExtraMinion(..., { powerMax })` / restriction 消费链 |
| minion 保护：不受其他玩家卡牌 / 能力影响 | `Awesome Guy`、`Expanded Power`、`Secret Base`、`Game Guru` | `src/games/smashup/abilities/dinosaurs.ts`、`src/games/smashup/abilities/ninjas.ts`、`src/games/smashup/domain/affect.ts` | 可复用现有 protection / affect 拦截框架，但要分别实现“卡牌”“能力”“destroy carried by controller”边界 |
| 取消基地能力 | `Raze` | `src/games/smashup/abilities/aliens.ts` `alien_jammed_signal`；`src/games/smashup/abilities/yuanhou.ts` `time_travelers_stasis_field` | 已按持续型 `registerBaseAbilitySuppression()` 接入；后续同类基地压制优先复用这一链 |
| 取消随从能力直到你的下回合开始 | `Mind Lady` | 现有代码未见等价卡；可借 `ninja_infiltrate` / affect 系统的时效清理模式 | 需要新共享层：minion ability suppression with expiry |
| 临时取得随从控制权 | `Control Minion` | `src/games/smashup/abilities/mermaids.ts`、`src/games/smashup/abilities/yuanhou.ts`、`src/games/smashup/domain/reduce.ts` | 已接入：复用 `MINION_CONTROL_CHANGED` + 临时控制 metadata，并补了“在他人回合里取得控制权时，按当前回合结束归还”的共享收口 |
| 在对手打出行动时丢弃且无效 | `Force of Wil`、`Wil Wheaton` | 仓库未见现成“action counter before resolve”机制 | 已接入共享 pre-action counter 链，支持 ongoing action 取消与 counter-on-counter 嵌套续链 |
| 行动转移到另一基地 / 另一随从 | `Rules Lawyer` | `src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts` 已覆盖 borrowed attached/base ongoing 语义；`mermaids/steampunks/tricksters` 有 owner/sourceControllerId 相关辅助 | 需要补共享 helper：transfer attached/base action without controller change |
| 搜索牌库并立刻额外打出更强随从 | `Mild Mannered Citizen`、`Radioactive Exposure` | `grantExtraMinion` 现成；牌库检索在多个 faction 已有搜索模式 | 已接入：`Mild Mannered Citizen` 走固定 `5+`，`Radioactive Exposure` 走“严格高于当前目标力量”的过滤 |
| 从弃牌堆回手 / 回牌库底 / 洗回牌库 | `Not Really Dead`、`Golden Age`、`Crystal Fortress`、`Griefer`、`Mulligan` | `zombies`、`wizards`、`vampires` 等已有回收 / 洗回 / 回手分支 | 多数可复用，按 zone 行为逐张接 |
| VP 奖励减 1（不影响能力给的 VP） | `Great Wyrm`、`Ruins` | 仓库未见现成实现命中 | 需要补 scoring reward modifier 共享链 |
| 低 power 不能被他人消灭 | `Converted Cave` | 现有 protection / destroy validation 可复用 | 需要补 base-level destroy restriction consumer |

## 派系拆解

### 龙

#### 已确认规则摘要

- `Great Wyrm` / `Ruins`：让其他玩家在该基地计分时少拿 1 VP，但不影响由能力额外给的 VP
- `Wyvern`：打出时消灭同基地力量 3 或以下随从；talent 本回合该基地 breakpoint -3
- `Imperial Dragon`：其他玩家在这里打出或移入随从后，你摸 1
- `Hatchling`：其他玩家在这里打出或移入随从后，该随从本回合 -1 power
- `Bring Down the Walls`：打在基地上，`before scoring` 你可在该基地打一个随从
- `Burn it Down`：摧毁基地上的行动牌并替换基地，原基地随从保留
- `Dangerous Ground`：其他玩家在这里打出随从后，必须弃 1
- `Dragon Lands`：己方随从 +1 power；`before scoring` 可作为 special 打到将计分基地
- `Intimidating Presence`：其他玩家的随从 -1 power；`before scoring` 可作为 special 打到将计分基地
- `Raze`：该基地能力取消
- `Dragon's Lair`：计分后冠军摸 3
- `Wyrm's Desolation`：这里的每个随从 -1 power

#### 当前已落地补充

- `Dangerous Ground`
  - 已按 ongoing base action 接入
  - 其他玩家在这里打出随从后：若其仅剩 1 张手牌则自动弃掉；若剩余多张则创建 live hand prompt 强制弃 1
  - 当前未扩展到 move 触发，符合已确认规则摘要
- `Great Wyrm` / `Ruins`
  - 已按“基础名次 VP 修正”接入
  - 共享层新增 `getModifiedBaseVp()` registry，只改 `BASE_SCORED.rankings[].vp`，不改后续额外 `VP_AWARDED`
  - `Great Wyrm` 按随从当前控制者判定“其他玩家”
  - `Ruins` 按基地 ongoing 当前控制者判定“其他玩家”
  - 已验证不会影响 `base_the_factory` 这类基地能力额外发放的 VP
- `Bring Down the Walls`
  - 已按 ongoing base action 接入
  - `beforeScoring` 时给予来源控制者一个限定在该基地的额外随从额度
  - 非 `playCards` 时经 `grantContextualExtraMinion(..., ctx.baseIndex)` 走 immediate extra-minion 语义
- `Burn it Down`
  - 已按 onPlay 行动接入，静态合同补为 `playNeedsBase`
  - 会先摧毁目标基地上的 base ongoing actions，但保留基地上的随从与随从附着行动
  - 替换来源支持：基地牌库顶牌，或基地弃牌堆中选定的基地
  - 已补最终态修正：显式收敛 `baseDeck/baseDiscard`，避免旧 `BASE_REPLACED keepCards:true` 语义把被摧毁基地错误塞回基地牌库
- `Raze`
  - 已按持续型基地能力压制接入
  - 通过 `registerBaseAbilitySuppression('dragons_raze', ...)` 在该 ongoing 留场期间持续取消基地能力
  - 已验证会同时压制常规基地触发、扩展基地触发，以及依赖 `isBaseAbilitySuppressed()` 的基地持续力量加成
- `Flank Attack`
  - 已按 `source -> card -> base` 三段 prompt 接入
  - 可搜索牌库、弃牌堆或两者；若两者都搜且最终选弃牌堆卡，牌库仍会洗切
  - 找到的牌会以额外行动立即打出到所选基地，不额外增加 `actionsPlayed`
- `Dragon's Lair`
  - 已补 hidden base ability：`afterScoring -> winner draws 3`
- `Wyrm's Desolation`
  - 已补 hidden base-level power modifier：该基地所有随从持续 `-1` power

#### 配置复用优先批

| 对象 | 现有落点 | 复用判断 |
| --- | --- | --- |
| `Imperial Dragon` | 现有 reaction / onMinionPlayed / move 触发器框架 | 可直接走“他人打出/移入触发摸牌”模式 |
| `Hatchling` | 现有 temp power modifier + move/play 触发器 | 可直接走“他人打出/移入 -> until end of turn powerModifier” |
| `Dragon Lands` | `ongoing_modifiers` 中已有 +power 行动卡模式 | 可复用 ongoing power modifier；special 入口需单独接 |
| `Intimidating Presence` | 现有 base ongoing -power 模式 | 可复用 ongoing negative modifier；special 入口需单独接 |
| `Dragon's Lair` | `base_the_mothership` 计分后冠军获益链 | 已接入 base ability 与 visible base def |
| `Wyrm's Desolation` | `Converted Cave` / `base_the_deep` 同类 base-level global modifier 参考 | 已接入 base-level power modifier 与 visible base def |

#### 需要共享扩展的一批

| 对象 | 原因 | 参考 |
| --- | --- | --- |
| `Dangerous Ground` | 需要“在对手打出随从后强制弃牌”的 post-play interaction，且需遵守 Dangerous Ground FAQ 的弃牌前置 / 失败边界 | 需补专用 trigger + discard gating |

#### 可直接复用的高价值参考

- `src/games/smashup/abilities/aliens.ts`
  - `alien_terraform` 已覆盖 `BASE_REPLACED`、新基地额外打出随从、keepCards 语义
- `src/games/smashup/abilities/yuanhou.ts`
  - `time_travelers_time_is_fleeting` 已覆盖“从基地弃牌堆选择基地并移到基地牌库顶”的 discard-source 入口
- `src/games/smashup/domain/baseAbilities.ts`
  - `base_ninja_dojo` 已覆盖 `afterScoring` 的“计分前额外打出随从”真实入口
- `src/games/smashup/domain/baseAbilities.ts`
  - `base_the_homeworld` 已覆盖 `powerMax: 2` 的 contextual extra minion

### 超级英雄

#### 已确认规则摘要

- `Awesome Guy`：你在这里的随从不会被其他玩家的卡牌消灭
- `Captain Amazing`：talent，让这里你当前在场的每个随从本回合 +1
- `Mind Lady`：选择另一名玩家的一个随从，该随从能力取消直到你下回合开始
- `The Burst`：任意基地打出随从后，你可把它移动到那里
- `Mild Mannered Citizen`：你回合开始时可自毁；若如此，从牌库搜一个力量 5+ 随从并在这里额外打出，然后洗牌
- `Expanded Power`：打在随从上，+1 power 且不会被其他玩家消灭
- `Golden Age`：最多 3 个随从从弃牌堆放回牌库底
- `Justice Friends`：你力量 5+ 的随从本回合 +2
- `My Only Weakness!`：打在随从上，该随从能力取消
- `Not Really Dead`：最多 2 个力量 2 或以下随从从弃牌堆回手
- `Radioactive Exposure`：消灭你一个随从，从牌库搜一个更高力量随从，原地额外打出，然后洗牌
- `Secret Base`：你这里力量 3 或以下的随从不会被其他玩家消灭
- `Sidekick`：选择一个你有力量 5+ 随从的基地，在那里额外打出一个力量 2 或以下随从
- `Converted Cave`：力量 2 或以下的随从在这里不能被其控制者以外的人消灭
- `Crystal Fortress`：你在这里打出随从后，可把弃牌堆一个随从放到牌库底

#### 配置复用优先批

| 对象 | 现有落点 | 复用判断 |
| --- | --- | --- |
| `Captain Amazing` | 现有 `until end of turn` power modifier 链 | 可直接复用临时增益框架 |
| `The Burst` | 大量 `moveMinion(...)` / 触发后选择新基地链 | 可直接复用“play trigger -> move source self”模式 |
| `Mild Mannered Citizen` | `grantExtraMinion` + deck search | 可复用检索后立即额外打出链 |
| `Golden Age` | 多 zone 操作中已有“放牌库底”与多选 | 可复用弃牌堆多选 + bottom-of-deck |
| `Not Really Dead` | `discard -> hand` 已有现成 reducer 事件 | 可复用最多 2 个、力量≤2 的检索回手 |
| `Sidekick` | `base_the_homeworld` / `base_secret_garden` 同类 power 限定 extra minion | 可复用 `grantExtraMinion(..., { powerMax: 2 })` |
| `Crystal Fortress` | `base` 触发 + 弃牌堆随从回牌库底 | 主要是 zone helper 组合，风险低 |

#### 需要共享扩展的一批

| 对象 | 原因 | 参考 |
| --- | --- | --- |
| `Awesome Guy` / `Expanded Power` / `Secret Base` / `Converted Cave` | 现有 protection 框架能拦截 destroy / affect，但要分别覆盖“其他玩家卡牌”“其他玩家 carried destruction”“低力量 base restriction”的精确边界 | `dinosaurs.ts`、`ninjas.ts`、`domain/affect.ts` |
| `Mind Lady` | 需要对随从本体 abilities 做 timed suppression，且要持续到“你下回合开始”，即使来源离场仍保留 | 仓库未见等价现成卡 |
| `My Only Weakness!` | 和 `Mind Lady` 同属 minion ability suppression，但它是 attached ongoing 常驻版本 | 可与 `Mind Lady` 共用 suppression 基础设施 |
| `Radioactive Exposure` | 已接入“destroy own minion -> search strictly higher power -> play there as extra minion” 检索链 | 复用了 `Mild Mannered Citizen` 的 deck search 主链，并补了基于当前有效力量的严格阈值过滤 |

#### 可直接复用的高价值参考

- `src/games/smashup/domain/baseAbilities.ts`
  - `base_the_homeworld`：基地限定 `powerMax` 额外随从
- `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `base_secret_garden`：banked extra minion 限定到基地
- `src/games/smashup/abilities/ninjas.ts`
  - `ninja_infiltrate` / `ninja_infiltrate_pod_talent`：现有取消 / 压制相关清理模式

#### 当前已落地补充

- `Mind Lady`
  - 已按 `onPlay` 接入
  - 选择另一名玩家的一个随从，并压制其能力直到你下回合开始
  - 已验证目标选择、压制生效与定时恢复
- `My Only Weakness!`
  - 已按 attached suppression 接入
  - 附着期间压制目标随从能力；失去附着后恢复
  - 已验证附着压制与 detached 恢复
- `Captain Amazing`
  - 已按 `talent` 接入
  - 发动时让该基地你当前在场的每个随从本回合 `+1` power
- `Not Really Dead`
  - 已按 optional multi-select prompt 接入
  - 可从弃牌堆中选择至多 `2` 个力量 `2` 或以下的随从回手
- `Golden Age`
  - 已按 optional multi-select prompt 接入
  - 可从弃牌堆中选择至多 `3` 个随从放到牌库底
- `Sidekick`
  - 已按基地选择 prompt 接入
  - 选择一个你有力量 `5+` 随从的基地后，授予一个限定到该基地、且只允许力量 `2` 或以下的额外随从额度
- `The Burst`
  - 已按 `onMinionPlayed` 触发器接入
  - 任意玩家在别的基地打出随从后，`爆发` 的控制者可选择把它移动到该基地，或留在原地
  - 已验证移动成功、主动留在原地、以及同基地打出时不创建交互三条分支
- `Mild Mannered Citizen`
  - 已按 `onTurnStart` 触发器接入
  - 你的回合开始时，会先询问是否自毁
  - 若选择自毁，则消灭当前 `温和市民`，再从牌库中选择一个力量 `5+` 的随从额外打到原基地，并重排剩余牌库
  - 已验证“自毁后检索进场”和“主动跳过，不自毁也不继续检索”两条分支
- `Radioactive Exposure`
  - 已按 `playNeedsMinion` + `onPlay` 接入
  - 直接消费你选定的己方目标随从，先消灭它，再从牌库中找一个力量严格更高的随从额外打到原基地，并重排剩余牌库
  - 当前实现按目标随从结算时的当前有效力量做阈值比较
  - 已验证单候选自动进场、无候选时只消灭目标、以及多候选时会过滤掉等于或更低力量的随从
- `Justice Friends`
  - 已按 `onPlay` 行动接入
  - 你所有当前力量 `5+` 的随从本回合 `+2` power
  - 已验证会跨基地命中己方符合条件的随从，不影响敌方随从，并按当前有效力量而非仅印制力量判定资格
- `Awesome Guy`
  - 已按 destroy protection 接入
  - 同基地你控制的随从不能被其他玩家消灭
  - 已验证 checker 命中和 reducer 层真实 destroy 拦截
- `Expanded Power`
  - 已补 attached ongoing `+1` power
  - 已按 destroy protection 接入：被附着随从不能被其他玩家消灭
- `Secret Base`
  - 已按 base ongoing destroy protection 接入
  - 这里你力量 `3` 或以下的随从不能被其他玩家消灭
- `Converted Cave`
  - 已补 hidden base protection
  - 这里力量 `2` 或以下的随从不能被其控制者以外的人消灭
- `Crystal Fortress`
  - 已补 hidden base ability
  - 你在这里打出随从后，可把弃牌堆中的一个随从放到牌库底
  - 已验证成功路径、跳过路径和“弃牌堆没有随从时不创建交互”路径

### 极客

#### 已确认规则摘要

- `Felicia Day`：把所有随从移到这个基地
- `Wil Wheaton`：当对手打出行动时可作为 special 打出；弃掉那张行动且其无效
- `Game Guru`：该随从不受其他玩家的能力影响
- `Fan`：你回合中可从手牌弃掉它来摸 1
- `Banned List`：对每个其他玩家，命名一张牌并看其手牌；该玩家把手里该牌的所有拷贝放到底牌
- `Control Minion`：选择一个随从，本回合你控制它；或当其他玩家打出随从时作为 special 直接接管那个新随从直到回合结束
- `Cosplay`：当你获得 1+ VP 时作为 special，再得 1 VP
- `Force of Wil`：当对手打出行动时作为 special，弃掉那张行动且其无效
- `Griefer`：对每个其他玩家分别选 1 个效果：随机弃 1、毁 1 个自己的随从、或把自己的弃牌堆洗回牌库
- `Min-Maxing`：看对手手牌；你可从其手牌额外打 1 张行动
- `Mulligan`：看牌库顶 5；可把它们拿到手里，并把你手里其余牌洗回牌库
- `Non-Infinite Loop`：额外打 1 张标准行动；之后你可把它送回手里，而不是去它本应去的地方
- `Rules Lawyer`：把打在基地上的行动移到另一基地，或把打在随从上的行动移到另一随从；不改变控制者
- `TableTop`：计分后冠军摸 3 再弃 2
- `The Con`：有随从打到这里时，这里其他同派系随从本回合 +1 power

#### 配置复用优先批

| 对象 | 现有落点 | 复用判断 |
| --- | --- | --- |
| `Fan` | 手牌 special discard-for-draw | 风险低，可复用现有 hand special + draw |
| `Felicia Day` | 一次效果同时移动多名随从到同一基地 | 已接入：补了同批移动 witness 门禁，避免组内互相见证 |
| `Cosplay` | `after scoring / gain VP` 触发 | 已接入：共享触发层新增 `onVpAwarded`，并复用全局手牌 reaction + triggered special 打出链 |
| `Banned List` | 先命名，再 reveal 对手手牌，再处理所有同名拷贝 | 已接入：复用了 reveal-hand 与 hand->deck-bottom，外层补了 exact-name prompt |
| `Griefer` | 多玩家分支选择 + discard/shuffle/destroy | 已接入：复用了随机弃牌 / destroy / deck reorder，外层补了顺序 prompt 编排 |
| `Min-Maxing` | 看对手手牌后，从其手牌额外打 1 张行动 | 已接入：复用了 borrowed `CARD_TRANSFERRED` + 真实 `PLAY_ACTION` 验证/执行链 |
| `TableTop` | `afterScoring -> draw then discard` | 已接入：复用了标准摸牌链，并补了抽牌后强制弃 2 的 live hand prompt |
| `The Con` | base-level 临时 power 增益 | 已接入：复用了 base trigger + until end of turn modifier |

#### 需要共享扩展的一批

| 对象 | 原因 | 参考 |
| --- | --- | --- |
| `Wil Wheaton` / `Force of Wil` | 已完成：共享层新增“行动已打出但效果未结算前”的 counter 窗口，并支持 ongoing action 取消、弃牌归属与 counter-on-counter 续链 | `src/games/smashup/domain/actionCounter.ts` |
| `Mulligan` | 查看 top 5、全拿或原顺序放回、其余手牌洗回牌库 | 已接入：复用了顶牌快照 + 手牌洗回事件，并补了 discard refill |
| `Non-Infinite Loop` | 需要 extra standard action + 本回合内“改写该行动离场去向” | 需要 action replacement bookkeeping |
| `Rules Lawyer` | 需要转移动作附着目标但不改控制者、不改 owner | 需补 shared transfer helper |

#### 可直接复用的高价值参考

- `src/games/smashup/abilities/yuanhou.ts`
  - 已存在 borrowed attached/base ongoing 相关测试面，可为 `Rules Lawyer` / `Control Minion` 提供 owner/sourceControllerId 边界参考
- `src/games/smashup/domain/reducer.ts`
  - 已有 card returned to hand / discard / bottom-of-deck 基础事件
- `src/games/smashup/domain/baseAbilities.ts`
  - 已有 `afterScoring`、`onMinionPlayed` 的 prompt 编排模板

#### 当前已落地补充

- `Fan`
  - 已按手牌 `special` 接入，静态合同补为 `activatableAbilities=[{ kind: 'special', zone: 'hand', window: 'playCards' }]`
  - 你的回合内可通过 `ACTIVATE_SPECIAL` 从手牌发动；结算时弃掉自己并摸 `1`
  - 共享层最小增量已落地：
    - `SmashUpActivationZone` 新增 `hand`
    - `ACTIVATE_SPECIAL` 新增 `handCardUid`
    - 命令验证与 reducer 执行链都已支持手牌手动 `special`
  - 已验证静态合同、命令校验与真实结算路径
- `Felicia Day`
  - 已按 `onPlay` 随从接入
  - 打出后会把其他基地上的所有随从移动到 `Felicia Day` 所在基地
  - 为满足 Geeks FAQ，移动事件会带同批标记；同一批被移动的随从不会互相见证彼此的 `onMinionMoved`
- `Control Minion`
  - 已按普通行动接入，静态合同补为 `playNeedsMinion`
  - 正常打出时：选择一个随从，本回合控制它
  - 已按全局手牌 reaction 接入：当其他玩家打出随从后，这张牌可作为 triggered special 从手牌打出，直接接管那个新随从直到当前回合结束
  - 共享层最小增量已落地：
    - `MINION_METADATA_UPDATED` 的临时控制 metadata 新增 `temporaryControlEndsOnTurnEndPlayerId`
    - `reduce(TURN_ENDED)` 优先按该字段归还控制权；旧的人鱼/源猴语义保持兼容
  - 已验证普通打出路径、手牌 special 路径，以及“在他人回合里取得控制权也会在该回合结束恢复”的收口
  - 共享层同时补了 `onMinionPlayed` 的“晚到见证者”过滤，避免只因 `Felicia Day` 的 onPlay 才被移入该基地的随从，反过来见证 `Felicia Day` 这次打出
  - 已验证三条关键边界：
    - 基本结果：所有其他基地的随从都会被收拢到同一基地
    - FAQ 边界：同批移入的 `幼熊斥候` 不会消灭同批移入的弱随从
    - FAQ 边界：同批一起被移走的 `帝国龙` 只会因自己的那次移动摸 `1`
- `TableTop`
  - 已补 hidden base ability
  - 计分后冠军先抽 `3`，再从更新后的手牌中强制弃 `2`
  - 已验证抽牌后 live discard prompt 分支，以及抽牌后手牌不足 `3` 时直接弃尽的自动分支
- `The Con`
  - 已补 hidden base ability
  - 当有随从打到这里时，这里其他与该随从同派系的随从本回合 `+1` power
  - 已验证只会加成“其他同派系随从”，不会误加刚打出的随从或不同派系随从
- `Game Guru`
  - 已按 `ongoing` 随从接入
  - 该随从不会受其他玩家的能力影响，但不会错误免疫其他玩家的行动牌
  - 为此共享保护链补了最小来源区分：`sourceKind = action | nonAction`
  - 已验证 direct protection check 与 live target filtering 两条行为证据
- `Cosplay`
  - 已按 `triggered special` 接入，静态合同改为 `subtype=special`、`abilityTags=['special']`、`specialTiming='triggered'`
  - 共享触发层新增 `onVpAwarded` 时机；当你获得 `1+ VP` 时，会先进入全局 reaction queue，再弹出“打出/跳过” prompt
  - 若选择打出，则这张牌会作为额外 special 从手牌结算，进入弃牌堆，并额外产生 `VP_AWARDED +1`
  - 已验证打出成功与主动跳过两条分支
- `Griefer`
  - 已按顺序 prompt 接入
  - 会按 turn order 逐个处理其他玩家；若某位对手当前没有任何合法分支，会被自动跳过
  - 对每位被处理的对手，当前实现支持三种合法分支：随机弃 `1`、消灭 `1` 个自己的随从、将自己的弃牌堆洗回牌库
  - “消灭自己的随从”分支已按目标玩家自己的 destroy 身份结算，避免误触发“不能被其他玩家消灭”的保护
  - 已验证多对手顺序处理、destroy 目标选择、以及无合法分支时的自动跳过
- `Banned List`
  - 已按逐个对手的命名 prompt 接入
  - 会先为当前对手命名一张牌，再只向施放者 reveal 该对手手牌
  - 之后该对手会把手里所有与所命名牌同名的牌放到底牌；基础版与 `_pod` 版按同名处理
  - 已验证 reveal-first 顺序、same-name normalization、无命中不改手牌、以及空手对手自动跳过
- `Mulligan`
  - 已按 `onPlay` 行动接入
  - 当前实现遵循 Geeks 页与 General FAQ 语义：查看牌库顶 `5` 张后，只存在“全部拿进手牌”或“完全不拿、保持原顺序”两条分支，不支持从顶五中任意拿部分
  - 若选择拿进手牌，则只把你其余手牌洗回牌库；新拿到的顶牌不会再被一起洗回
  - 若牌库不足 `5` 张，会先把弃牌堆洗回牌库，再形成这次查看的顶牌快照
  - 已验证 draw-all、keep-order、以及 short-deck + discard refill 三条分支
- `Min-Maxing`
  - 已按“先看对手手牌，再从其手牌额外打 1 张行动”接入
  - 当前实现会先 reveal 所选对手的手牌给施放者，再按真实 `PLAY_ACTION` 语义只列出当前可合法打出的行动
  - 结算时复用了 borrowed `CARD_TRANSFERRED` + 真实 `PLAY_ACTION` 验证/执行链，因此：
    - 无目标行动会直接结算
    - 需要基地 / 随从目标的行动会继续走真实目标 prompt
    - 打出的牌仍保留原拥有者，结算后的弃牌去向仍回到原拥有者弃牌堆
  - 已验证主动跳过、无目标行动立即结算、以及附着到随从的 ongoing 行动按当前玩家身份生效三条分支
- `Non-Infinite Loop`
  - 已按“额外打出 1 张标准行动，随后可把它收入手牌”接入
  - 当前实现复用了真实 `PLAY_ACTION` 验证/执行链，因此无目标行动会直接结算，需基地 / 随从目标的行动会继续走真实目标 prompt
  - 共享层新增 `ACTION_RETURN_TO_HAND_OPTION_ARMED` 事件，并在 `postProcessSystemEvents()` 末尾统一把“是否收入手牌”prompt 追加到现有交互队列尾部
  - 因此若这张额外行动自己还会创建 prompt（例如 `禁卡表`），会先完成它自己的交互，再出现 `无限循环` 的回手 prompt，不会抢到前面
  - 选择回手时，当前实现通过共享 `CARD_TRANSFERRED` 把该行动从弃牌堆移回原拥有者手牌，并复用现有 `onCardReturnedToHand` 后处理链
  - 已验证无目标额外行动分支，以及“行动先创建自己的 prompt，回手 prompt 后出现”的排序分支
- `Rules Lawyer`
  - 已按“转移已在场的持续行动，但不改 owner / sourceController 语义”接入
  - 当前实现直接复用现成 `ONGOING_DETACHED + ONGOING_ATTACHED` 的同 uid 重新附着合同：
     - 若目标是基地行动，则从原基地移到另一基地
     - 若目标是随从附着行动，则从原宿主移到另一随从
   - 重新附着时会保留原行动的 `metadata` 与 `talentUsed`，因此借用控制者、持续修正来源等运行时语义不会被冲掉
   - 已验证：
     - 基地持续行动分支：效果会从旧基地转移到新基地，且原 `sourceControllerId` 继续生效
     - 随从附着行动分支：附着与力量修正会跟着转移到新宿主
- `Force of Wil`
  - 已按手牌 `triggered special` 接入，并把静态合同补为 `subtype=special`、`specialTiming='triggered'`
  - 共享层新增 pre-action counter 窗口：`PLAY_ACTION` 在执行行动本体前，先检查所有已注册的 action counter
  - 若 `Force of Wil` 成功结算：
    - 普通行动不会继续结算
    - ongoing 行动不会附着到目标，但仍会按原拥有者进入弃牌堆
  - 已验证标准行动反制、ongoing 行动反制，以及 `Force of Wil -> Force of Wil` 的嵌套反制链
- `Wil Wheaton`
  - 已按手牌 `triggered special` 接入
  - 当对手打出行动时，可从手牌作为 counter 打出；你先选择一个基地把 `Wil Wheaton` 打到那里，再令目标行动无效
  - 与 `Force of Wil` 共用同一条共享 action counter 续链，因此同样处于“行动本体结算前”的合法 timing
- 共享 `action counter` 链
  - 新增 `src/games/smashup/domain/actionCounter.ts`
  - 当前已支持：
    - 注册可响应的 counter 卡
    - `PLAY_ACTION` 的 pre-resolution counter window
    - nested counter stack continuation
    - `ACTION_COUNTERED` 事件，用于取消原行动并覆盖 ongoing 行动未附着但仍入弃牌堆的分支
  - 本轮修正了 `continue` 续链中的 responder offset 提前推进问题，确保 `Force -> Force` 时第二层 counter prompt 不会被吞掉

## 当前收口状态

- 龙 / 超级英雄 / 极客已完成卡牌静态接入、主要玩法实现与行为级测试。
- 六个基地已复用 `shayu` 的 `smashup:base7` 合同接入 visible base defs。
- 三派系已解除 `implementation in progress` 门禁，并补齐派系选择页 metadata 与中英文 locale。
- `base/longzu.png` 仍可后续替换为独立图集，但不再是当前三派系真实选角 / 真实牌堆 / 基地池接入的阻塞项。

## 本轮新增验证

- `npx vitest run src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native` after `shayu/base7` base reuse：通过
- `node -e "JSON.parse(require('fs').readFileSync('public/locales/zh-CN/game-smashup.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/en/game-smashup.json','utf8')); console.log('locale json ok')"`：通过
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts src/games/smashup/__tests__/shayuFactionIntake.test.ts --configLoader native` after visible base defs：通过
- `npx tsc --noEmit` after visible base defs：通过
- `npm run i18n:check`：失败；阻塞点是既有 DiceThrone `src/games/dicethrone/ui/InteractionOverlay.tsx:468` 缺失 key，不是本轮 Smash Up locale JSON
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native`
- `npx tsc --noEmit`
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native`
- `npx tsc --noEmit`
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native` after `Mulligan`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native` after `Mulligan`
- `npx tsc --noEmit` after `Mulligan`
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native` after `Felicia Day`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/bear-cavalry.test.ts --configLoader native` after `Felicia Day`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native` after `Felicia Day`
- `npx tsc --noEmit` after `Felicia Day`
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native` after `Min-Maxing`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native` after `Min-Maxing`
- `npx tsc --noEmit` after `Min-Maxing`
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native` after `Non-Infinite Loop`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native` after `Non-Infinite Loop`
- `npx tsc --noEmit` after `Non-Infinite Loop`
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts --configLoader native` after `Rules Lawyer`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native` after `Rules Lawyer`
- `npx tsc --noEmit` after `Rules Lawyer`
- `npx vitest run src/games/smashup/__tests__/abilities/geeks.test.ts -t "维尔的力量可以反制另一张维尔的力量，被反制后的原行动会继续正常结算" --configLoader native`
- `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts --configLoader native`
- `npx tsc --noEmit`

结果：均通过。
