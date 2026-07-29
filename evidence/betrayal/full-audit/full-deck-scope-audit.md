# 山屋惊魂整牌库范围审计

> 日期：2026-07-28
> 续跑核验：2026-07-29
> 当前结论：此前把 9 张预兆或当前运行发现池当作整牌库口径是错误的。本文件只锁定“整牌库范围与缺口”，不宣称整牌库实现完成。

## 结论

- 官方基础游戏整牌库是 **74 张游戏牌**，由 **9 张预兆、22 张物品、43 张事件**组成；9 张只是预兆牌这一类，不是整牌库。证据：`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:343`、`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:382`。
- 原审计入口运行发现池是 **23 张事件、12 张物品、9 张预兆，共 44 张**；相对官方 74 张，原始数量缺口是 **20 张事件 + 10 张物品**。这是本轮 S0 的差异起点，不能被后续工作区配置变化覆盖。
- 当前工作区配置是 **43 张事件、22 张物品、9 张预兆，共 74 张**；配置数量已经对齐官方整牌库。事件牌仍不能说成“整牌库完成”，因为新增配置事件虽然已通过运行入口、部分关键分支、一批自动分支状态断言、失败伤害分支、成功属性分支、部分剩余可配置分支代表链和一批房间目标合法性补证，但多张事件仍需要剩余分支、作祟特例、UI 承接和组合测试闭合；物品牌也不能说成“能力完成”，因为镜子、恐怖玩偶、幸运硬币、皮夹克、枪、十字弓、电锯、牙齿项链、胸针、神秘秒表、天使之羽、炸药、奇异护符只补了最小运行承接、组合代表链或领域代表链，仍需要扩展组合验证和 UI 承接；9 张预兆已在整牌库合同里补出逐卡效果领域证据矩阵，公共作祟规则也已经补到全员当前持有预兆数、交易转移后总数、抽新预兆骰数、8 骰上限、普通预兆触发和最后一张自动作祟代表链，但这些仍只是领域/合同证据，不能替代作祟 UI 承接和更多逐卡组合回归。证据：`src/games/betrayal/scenarioConfig.ts`、`src/games/betrayal/discoveryAtlas.ts`、`src/games/betrayal/possessionAtlas.ts`、`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`src/games/betrayal/__tests__/Board.foundation.test.tsx`、`temp/betrayal-full-deck-task-state.json`。
- 本轮按用户指定本地图包复核后，项目正式事件/物品/预兆 atlas 与原始 `Mods/Images` 文件逐字节一致；图包本身不缺 E43「最深的壁橱」或 22 张物品正面。旧事件裁图 manifest 的原始 `candidateCards` 仍只有 42 个 TTS `ContainedObjects` 候选，但已经补入 `gridAudit20260728` 全格扫描字段，明确 frame 42 是事件正面、frame 43 是空格、frame 44 是背面。当前缺口主要不是图包或导入问题，而是逐卡效果、UI 承接、测试证据和 legacy alias 口径仍未完全闭合。
- 2026-07-29 S0 机器一致性复核已落地到 `temp/betrayal-full-deck-s0-consistency-audit-2026-07-29.json`：合同对象行 74 行且无重复编号；当前运行发现池 43/22/9；事件 atlas 43 个标题映射唯一覆盖 frame 0-42；当前 22 张官方运行物品唯一覆盖 item frame 0-21；非发现池 item alias 只剩 `lantern`、`notebook`、`journal`、`manuscript`，均按 legacy alias / duplicate-alias 处理，不计入官方 22 张独立牌。
- 2026-07-29 定向补证已通过：领域测试 `firstScenarioRuntime.test.ts -t "物品|镜子|持有物|武器|十字弓|电锯|皮夹克|枪"` 为 83 passed / 561 skipped；组件测试 `Board.foundation.test.tsx -t "十字弓|枪|武器"` 为 8 passed / 123 skipped；剧本候选组件测试 `Board.foundation.test.tsx -t "角色选择阶段展示七张"` 为 1 passed / 131 skipped；恐怖玩偶/最近投骰定向领域测试 `firstScenarioRuntime.test.ts -t "恐怖玩偶|当前 22 张物品牌|灰尘交叉规则分类"` 为 8 passed / 638 skipped；Board 最近投骰重掷组件测试 `Board.foundation.test.tsx -t "兔脚|最近投骰|重掷|恐怖玩偶"` 为 18 passed / 113 skipped；幸运硬币/最近投骰定向领域测试 `firstScenarioRuntime.test.ts -t "幸运硬币|恐怖玩偶|当前 22 张物品牌|灰尘交叉规则分类"` 为 14 passed / 634 skipped；幸运硬币/倒塌房间组合定向领域测试 `firstScenarioRuntime.test.ts -t "幸运硬币|倒塌房间"` 为 17 passed / 672 skipped；Board 最近投骰重掷组件测试 `Board.foundation.test.tsx -t "兔脚|最近投骰|重掷|恐怖玩偶|幸运硬币"` 为 19 passed / 113 skipped；天使之羽定向领域测试 `firstScenarioRuntime.test.ts -t "天使之羽"` 为 7 passed / 653 skipped；炸药定向领域测试 `firstScenarioRuntime.test.ts -t "炸药"` 为 8 passed / 656 skipped；奇异护符定向领域测试 `firstScenarioRuntime.test.ts -t "奇异护符"` 为 12 passed / 655 skipped；新增配置事件定向领域测试 `firstScenarioRuntime.test.ts -t "新增配置事件"` 为 26 passed / 646 skipped；怪异的镜子定向领域测试 `firstScenarioRuntime.test.ts -t "怪异的镜子|设置阶段必须从七张|新增配置事件"` 为 28 passed / 646 skipped；作祟公共规则定向领域测试 `firstScenarioRuntime.test.ts -t "作祟风险|交易转移预兆|抽到新预兆|作祟检定按全员|普通预兆触发作祟|抽到最后一张预兆"` 为 15 passed / 672 skipped。该结果只证明当前 22 张物品运行池、镜子、枪、十字弓、皮夹克、电锯、恐怖玩偶、幸运硬币、天使之羽、炸药、奇异护符代表链和武器/最近投骰/投骰结果替代/范围攻击/物理伤害被动入口，以及幸运硬币在倒塌房间回合末速度检定中按新结果取消或保留坠落、先分配精神伤害再确认坠落伤害的领域组合链；20 张新增/补录事件的运行入口、部分关键分支、一批自动分支状态断言、失败伤害分支、成功属性分支、部分剩余可配置分支代表链、技术难点地下室 fallback、一罐器官成功抽物品、怪异的镜子接受检定 0-4 / 5+ 代表入口和地狱蝙蝠/花团锦簇/秘密升降机/一声呼救房间目标合法性，角色选择候选列表能展示 7 张剧本卡且包含 `upon-reflection` 待接入项，以及作祟公共规则的全员预兆数、交易转移、8 骰上限、普通预兆触发和最后一张预兆自动触发代表链未被旧口径卡住，不等于整牌库逐卡效果全部完成，也不等于 7 号作祟完整实现。
- 2026-07-29 静态检查已分段通过：山屋数据、运行、UI、测试与审计脚本相关文件 ESLint 为 0 errors；`game.ts` 只剩既有 unused warning，`Board.tsx` 使用 `NODE_OPTIONS=--max-old-space-size=8192` 后通过且无 warning；`git diff --check` 通过，仅有 LF/CRLF 工作区提示。
- 当前 `initialDeckCounts` 已写成 `omen: 9 / item: 22 / event: 43`，与官方整牌库数量一致。证据：`src/games/betrayal/scenarioConfig.ts:656`。
- 预兆牌数量上确实是 9 张；但预兆仍要按逐卡效果、抽到预兆后的作祟检定、最后一张预兆自动作祟分别审，不能因为数量对就把整牌库或能力实现判完成。证据：`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:647`、`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:749`、`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:755`。

## 前提锁定

| 项 | 当前锁定 |
| --- | --- |
| 问题对象 | 山屋惊魂第三版基础游戏整牌库：事件、物品、预兆三类游戏牌 |
| 真相来源 | 官方规则书组件数量：`74 game cards: Omens, Items, Events` 与组件数量 `X9 X22 X43` |
| 目标入口/环境 | 当前工作区 `D:/gongzuo/webgame/BoardGame`；只审当前实现、当前素材和当前 evidence，不切换 worktree |
| 验收口径 | 先把官方整牌库数量、当前运行池数量、素材/atlas 覆盖和缺口状态写清；不得把当前运行池说成整牌库完成 |

## 原审计入口差异矩阵

| 类别 | 官方数量 | 原审计入口运行池 | 原始数量缺口 | 当前工作区配置 | S0 裁定 |
| --- | ---: | ---: | ---: | ---: | --- |
| 事件牌 | 43 | 23 | 20 | 43 | 原缺口来自旧运行池和旧 manifest 口径；当前数量已接齐，但新增事件仍需逐卡机制/UI/测试闭合 |
| 物品牌 | 22 | 12 | 10 | 22 | 原缺口来自旧运行池、旧裁图 manifest 和 alias 复用口径；当前数量已接齐，但部分物品仍是效果承接缺口 |
| 预兆牌 | 9 | 9 | 0 | 9 | 数量对不等于单卡效果和作祟公共规则完成 |
| 合计 | 74 | 44 | 30 | 74 | S0 对象/素材/atlas 数量已闭合；整牌库仍保持 `in_progress / blocked` |

## 当前工作区差异矩阵

| 类别 | 官方数量 | 当前运行池 | 当前素材/合同可见覆盖 | 当前状态 | 缺口 |
| --- | ---: | ---: | --- | --- | ---: |
| 事件牌 | 43 | 43 | `event-front-atlas` 是 9x5 图集；项目 atlas 与原始图包 hash 一致；当前 `EVENT_FRONT_FRAME_BY_TITLE` 已映射 43 个事件标题；旧 TTS 9x5 裁图 manifest 原始候选只有 42 个 `ContainedObjects`，但 `gridAudit20260728` 已补 45 格全格扫描并锁定 frame 42 为「最深的壁橱」 | `partial`：事件配置数量和 atlas 映射已闭合；「轮到约拿了」「片刻希望」「游魂」「技术难点」已补最小运行闭环；新增配置事件回归已覆盖 20 张新增/补录事件的运行入口，补到 9 张待选择事件的一个关键分支结算，并新增一批自动分支状态断言、失败伤害分支、成功属性分支、部分剩余可配置分支代表链、技术难点地下室 fallback、一罐器官成功抽物品、怪异的镜子接受检定 0-4 / 5+ 代表入口和一批房间目标合法性断言 | 配置缺口 0；剩余分支、完整作祟特例、UI 承接和组合测试仍需继续审 |
| 物品牌 | 22 | 22 | `ITEM_FRONT_ATLAS` 是 8x3=24 格；项目 atlas 与原始图包 hash 一致；frame 0-21 为 22 张物品正面，22 为空黑格，23 为物品背面；当前运行池已接 22 个官方物品对象，另有 `notebook / lantern / journal` legacy alias 不计入官方 22 | `partial / needs-ui-combo-proof`：数量和 atlas 接线已齐；镜子、恐怖玩偶、幸运硬币、皮夹克、枪、十字弓、电锯、牙齿项链、胸针、神秘秒表、天使之羽、炸药、奇异护符已有最小承接或代表链；幸运硬币已补倒塌房间回合末真实效果链组合；仍缺 UI/组合/剩余物品扩审 | 数量缺口 0；效果/UI/测试缺口仍需继续 |
| 预兆牌 | 9 | 9 | `OMEN_FRONT_ATLAS` 是 2x5，其中 9 张正面 + 1 张牌背；当前 9 张预兆正面已能对应运行对象；整牌库合同已新增 9 张预兆逐卡效果领域证据矩阵 | `locked-count / omen-effects-min-domain-verified / public-haunt-min-verified / partial-ui`：数量与官方一致；书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首均已登记已有本地领域证据；作祟公共规则已补全员当前持有预兆数、交易转移后总数、抽新预兆骰数、8 骰上限、普通预兆触发和最后一张预兆自动触发的最小领域回归 | 数量缺口 0；仍缺作祟 UI、逐卡 UI 承接和更多组合回归 |
| 合计 | 74 | 74 | 当前素材已证明覆盖事件/物品/预兆 atlas；当前发现池配置数量已对齐官方整牌库 | `partial` | 数量缺口 0；事件和物品仍缺逐张运行闭合证据 |

## 状态口径

| 状态 | 本轮含义 | 当前命中 |
| --- | --- | --- |
| `locked` | 有明确官方/合同来源，且当前运行对象能和来源对齐 | 9 张预兆数量与 atlas 正面；旧事件中 23 张素材来源已锁；当前运行中的部分物品 |
| `partial` | 有来源或运行对象，但还不能证明完整机制/UI/测试闭合 | 事件 43/43 已配置且新增配置事件已补运行入口、部分关键分支、一批自动分支状态断言、失败伤害分支、成功属性分支和部分剩余可配置分支代表链，但未逐张完整闭合；物品 22/22 已配置但恐怖玩偶、幸运硬币、天使之羽、炸药、奇异护符等只补到代表链、组合代表链或最小领域补证，仍缺 UI/组合扩审 |
| `blocked` | 缺机制消费、UI 承接或测试证据 | 新增事件仍需逐张闭合机制/UI/测试证据；部分新增物品虽已进运行池但效果仍未消费 |
| `not-in-runtime` | 官方数量内应存在，但当前 `BETRAYAL_DISCOVERY_POOLS` 没有运行对象 | 当前官方 74 张已无数量层 `not-in-runtime`；legacy alias 不计入官方对象数 |
| `duplicate-alias` | 多个运行名/裁图名共用同一 frame，不能按对象行数当作独立官方牌数 | 地图 / 笔记本 / 日记 / 手稿共用同一物品 frame；`lantern` 是 atlas alias 但不是当前运行发现池物品 |
| `unknown-slot` | atlas 或 TTS deck 中存在候选槽位，但未形成单卡 locked 合同 | 事件已无配置数量缺口；物品不再是未知槽位，已锁为具体 frame/title/效果子句，但仍缺运行接线 |

## 当前运行池清单

### 事件牌：43 / 43

当前发现池事件配置已达到 43 张：标本剥制、说“茄子”！、外星几何、小丑房间、咬一口！、吊死鬼、电话铃声、小机器人、嘎吱的木门、脑状食品、上古旧宅、肉质苔癣、夜幕众星、一抹鲜红、一瓶微尘、大宅饿了、一条秘密通道、最深的壁橱、磁带播放器、在你背后！、蜘蛛！、一种怪异的感觉、葬礼、不可能的房间、地狱蝙蝠、断手、怪异的镜子、花团锦簇、晦暗暴风夜、技术难点、佳馔满桌、禁忌知识、可怜的尤里克、轮到约拿了、秘密升降机、片刻希望、神秘液体、游魂、无线电广播、摇曳灯光、一罐器官、一声呼救、着火的人。

其中旧事件中 23 张已有素材映射和代表证据；E43「最深的壁橱」当前代码映射到 frame 42，本轮已从原始事件 atlas 直接复核为真实正面，并在旧 TTS 9x5 manifest 中补入 `gridAudit20260728` 全格扫描字段。原 `candidateCards` 没有对应候选是 manifest 生成漏扫，不是源图缺图。此前未进配置的「轮到约拿了」「片刻希望」「游魂」已进入配置、atlas 映射和最小运行/UI 测试；本轮新增配置事件回归又证明 20 张新增/补录事件都能进入运行消费入口，9 张待选择事件已能完成一个关键分支结算，一批自动分支已补抽物品、属性写入和入口大厅移动的状态断言，并补了一组失败伤害分支、成功属性分支、部分剩余可配置分支代表链和一批房间目标合法性断言；「怪异的镜子」接受检定已能走 0-4 神志 +1 分支，也能在 5+ 时进入 7 号无叛徒代表揭示态、放置镜中怪物并保留 setup manual-check；7 号作祟已补秘密组合、破咒、事件符号房间跳过事件、镜中提示、镜中怪物最近目标移动 / 平手路径与同房神志攻击的领域代表链；「无线电广播」脚注已裁定为展示/音频提示，不改变事件规则结算。剩余事件仍不能按完整运行闭合处理，必须继续逐张补剩余分支、专属 UI 承接、E2E、截图和组合测试证据。

证据入口：
- 发现池配置：`src/games/betrayal/scenarioConfig.ts`
- atlas 配置：`src/games/betrayal/discoveryAtlas.ts:19`
- 当前 frame 映射：`src/games/betrayal/discoveryAtlas.ts:37`，已覆盖当前 43 张事件标题
- TTS 9x5 manifest：`temp/betrayal-event-front-atlas-2026-07-03/event-08-tts-9x5-2026-07-04/tts-9x5-crop-manifest.json`
- 本轮图包诊断：`temp/betrayal-asset-source-diagnostics-2026-07-28/source-atlas-diagnostics.json`

### 物品牌：22 / 22

当前运行官方物品：魔法相机、恐怖玩偶、急救包、镜子、奇怪的药品、幸运硬币、皮夹克、牙齿项链、手电筒、头戴耳机、地图、奇异护符、胸针、枪、十字弓、兔脚、骨制钥匙、神秘秒表、砍刀、电锯、炸药、天使之羽。

当前裁图 manifest 物品行：魔法相机、奇怪的药品、急救包、手电筒、头戴耳机、骨制钥匙、地图、笔记本、日记、手稿、砍刀、兔脚。

差异：
- 原始图包和项目物品 atlas 已确认 frame 0-21 是 22 张真实物品正面，不是图包缺素材。
- 当前发现池已接 22 张官方物品；旧裁图 manifest 仍只覆盖旧 12 行，不能再当作当前运行池完整性来源。
- `奇异护符（strange-amulet）`、恐怖玩偶、镜子、幸运硬币、皮夹克、牙齿项链、胸针、枪、十字弓、神秘秒表、电锯、炸药、天使之羽等新增/补接物品主要依赖本轮 `temp/betrayal-asset-source-diagnostics-2026-07-28/item-*-full.jpg` 完整单卡裁图与正式 atlas alias。
- 地图、笔记本、日记、手稿共用同一 frame/hash，不能按 4 张独立官方牌面直接计数为 4 个已锁槽位。
- `notebook / lantern / journal` 仍作为首剧本起始 / legacy alias 出现在运行持有物全集；它们不是官方 22 张物品之外的新牌。
- 镜子、皮夹克、枪、十字弓、电锯已有最小运行承接；恐怖玩偶已补最近属性检定全骰重掷代表链，但作祟特殊行动属性检定仍因缺通用回滚快照不放行；幸运硬币已补最近属性检定空白骰重掷、空白精神伤害代表链和倒塌房间回合末真实效果链组合：重投非空白会取消坠落，重投仍空白会先分配幸运硬币精神伤害再确认倒塌房间坠落伤害；牙齿项链、胸针、神秘秒表、天使之羽、炸药、奇异护符已有最小领域补证；幸运硬币仍缺 UI 承接和作祟/死亡保护等更多伤害分配组合回归，炸药仍缺 UI 目标选择承接、更多怪物/作祟组合和特殊免疫边界回归；奇异护符仍缺 UI/日志提示和减伤/死亡保护/作祟伤害组合回归。

证据入口：
- 运行池：`src/games/betrayal/scenarioConfig.ts:887`
- 物品 atlas：`src/games/betrayal/possessionAtlas.ts:21`
- 持有物视觉映射：`src/games/betrayal/possessionAtlas.ts:64`
- 裁图 manifest：`temp/betrayal-possession-contract-crops/manifest.json`

### 预兆牌：9 / 9

当前运行预兆：书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首。

证据入口：
- 运行池：`src/games/betrayal/scenarioConfig.ts:837`
- 预兆 atlas：`src/games/betrayal/possessionAtlas.ts:32`
- intake 合同：`docs/games/betrayal/intake-contract.md`

## 作祟检定口径

作祟检定不是按“当前抽到第几张预兆的固定数值”随便判。官方规则是：

- 每次抽到预兆，都要进行作祟检定。
- 检定骰数等于所有玩家当前持有的预兆总数。
- 结果 5+ 开始作祟。
- 若抽到最后一张预兆且作祟尚未开始，作祟自动开始。

证据：`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:647`、`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:749`、`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:755`。

当前已有领域证据：`firstScenarioRuntime.test.ts -t "抽到最后一张预兆"` 为 1 passed / 672 skipped，覆盖牌堆只剩最后一张预兆时自动进入作祟，并记录触发预兆与翻牌确认队列。

因此 UI/实现应当表达“当前总预兆数决定作祟风险”和“最后一张预兆会自动作祟”，而不是只表达“预兆牌库还有 9 张”或只在抽牌时弹一次结果。该领域证据不替代 9 张预兆逐卡效果和作祟 UI 承接。

## 旧结论降级

以下旧文档只能作为当前运行池 / 首剧本 / 代表链证据，不再作为整牌库完成口径：

| 文档 | 旧风险 | 新口径 |
| --- | --- | --- |
| `evidence/betrayal/full-audit/first-scenario-full-audit.md` | 标题含“完整审计”，容易被理解为整牌库或整游戏完成 | 只覆盖杰克首剧本 + 当前运行发现池 + 支撑对象，不覆盖官方 74 张整牌库 |
| `evidence/betrayal/full-audit/object-inventory.json` | 统计的是 `BETRAYAL_DISCOVERY_POOLS`，不是逐卡机制完成证据 | 可证明当前配置对象数：43 事件 / 22 物品 / 9 预兆；不能证明逐卡效果和 UI 测试都完成 |
| `evidence/betrayal/full-audit/object-l0-l4-matrix.md` | “对象级 L0-L4”容易被误读为全官方对象 | 只对当前 object-inventory 里的运行对象成立 |
| `evidence/betrayal/betrayal-event-card-ingest-2026-07-03.md` | 早期 6x4 / 23 张正面事件结论不足以覆盖官方 43 张事件 | 只证明原 23 张事件原文合同与部分 TTS 9x5 复核；E43 frame 42 已由本轮原始 atlas 复核锁定；43 张事件现已补 atlas 映射，但仍需按逐张机制/UI/测试补承接 |
| `evidence/betrayal/betrayal-discovery-effect-audit-2026-07-02.md` | “发现池对象与代表性玩法已验证”不是整牌库完成 | 只能作为当前发现池效果审计历史证据 |

## 当前 S0 停点

1. 本轮可回答用户追问：素材包没有缺事件/物品/预兆三张整牌库 atlas，项目导入也没有发现逐字节差异；旧缺口来自旧 manifest 只扫 `ContainedObjects`、旧运行池数量不足、以及后续逐卡机制承接未闭合。
2. 本轮仍停在 `in_progress / blocked`：74 张对象全集、数量和 atlas 接线已经闭合，且用户已授权继续 S1/S2；但事件/物品逐卡机制、UI 承接和测试证据尚未全闭合，不能宣称整牌库完成。
3. 用户已授权进入 S1/S2 已锁对象补证；天使之羽、炸药、奇异护符、技术难点已完成最小领域补证，新增配置事件已完成一轮运行入口、部分关键分支、自动分支状态、失败伤害分支、成功属性分支和部分剩余可配置分支代表链补证，并追加覆盖技术难点地下室 fallback、一罐器官成功抽物品、怪异的镜子接受检定 0-4 / 5+ 代表入口、地狱蝙蝠/花团锦簇/秘密升降机/一声呼救房间目标合法性和无线电广播脚注用途裁定；作祟公共规则已补最后一张预兆自动触发的最小领域回归；9 张预兆逐卡效果已补领域证据矩阵。后续仍需处理剩余物品机制/UI 组合、新增事件剩余分支、完整作祟特例、预兆逐卡 UI 承接、作祟 UI 承接和组合测试；本轮继续队列已拆到 `full-deck-data-intake-contract.md` 的 6.1 节，且明确当前没有 S0 图包缺失阻塞。未闭合前这些继续作为合同阻塞清单保留。
4. 旧首剧本审计、对象矩阵和事件录入合同后续引用时必须写明“当前配置 / 当前运行闭合范围”，不得再说成整牌库。
