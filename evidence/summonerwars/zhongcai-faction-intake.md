# 召唤师战争：仲裁（zhongcai）派系录入合同

- 记录日期：2026-09-19
- 游戏：`summonerwars`
- 派系 ID：`zhongcai`
- 中文名：仲裁
- 当前真相源：`public/assets/i18n/zh-CN/summonerwars/hero/zhongcai/` 内 13 张原始 PNG
- 录入范围：召唤师、3 名英雄、4 类士兵、3 张普通事件、1 张传奇事件、提示板、正式图集、运行时配置与规则消费链
- 当前结论：`当前范围已收口`
- 玩家可见状态：`in_progress`；2026-09-20 对照原卡发现“抹消”原文没有“友方”限定后，已修正文案、目标候选、执行器和审计证据，并完成己方/敌方双侧验证；按新增派系人工闸门保留实施中标记，未擅自切换完成态

## 审计范围

- 本轮覆盖：`summonerwars` 的 `zhongcai`（中文名“仲裁”）派系；13 张原始素材、正式图集、派系配置、牌组、中文/英文文案、能力执行链、InteractionSystem、领域测试、真实入口 E2E、资源 manifest 和远端素材主源。
- 对象全集：1 名召唤师、3 名英雄、4 类士兵、4 张事件、起始城门、普通传送门、30 张预构筑牌组，以及 `hero` / `cards` / `tip` 三类正式资源。
- 共享链路：afterAttack / afterMove / onPhaseEnd / onSummon 触发、伤害修正、治疗 reducer、召唤位置候选、InteractionSystem 双步选择、回合/阶段清理和资源发布链。
- 不在本轮范围内：其他派系自身规则、全仓 i18n 存量缺口、其他游戏的上传或发布问题；它们不作为仲裁派系完成与否的证据。

## 结论等级

- 结论等级：`当前范围已收口`。
- 判定理由：仲裁对象全集已登记；2026-09-20 重新打开“睿智者阿不思：抹消”原卡后确认原文是“一个士兵”，不是“一个友方士兵”，已同步修正文案、候选范围、执行器和审计行，并通过己方/敌方双侧窄测与真实入口 E2E。
- 当前口径不外推到全仓 i18n 或其他派系；全仓 i18n 仍受既有 DiceThrone 缺失键阻断，属于范围外残余。

## 权威来源

- 主真相源：`public/assets/i18n/zh-CN/summonerwars/hero/zhongcai/` 内 13 张原始 PNG，以及对应完整卡面裁图。
- 对照源：`config/factions/zhongcai.ts`、中文/英文文案、`.spec/skills/summonerwars-faction-intake/SKILL.md`、当前领域实现和真实入口状态。
- 合同状态：`locked`；卡名、费用、生命、战力、攻击类型、事件阶段、起始部署、图集槽位、抹消逐字原文和目标所有权消费映射均已登记。
- 完整单卡主裁图：`temp/summonerwars-zhongcai-crops/` 内 13 张 `*-bottom.png`；正式图集只消费 `hero.png` / `cards.png` / `tip.png`。
- 裁图清单 / crop manifest：本 evidence 的原始素材登记表、图集槽位合同和 `temp/summonerwars-zhongcai-crops/` 文件清单共同构成裁图记录；素材 SHA256 已逐项记录。
- 图片合同：所有原始 PNG 为 `1050×750`；正式 `cards.png` 为 `8400×1500`、8×2，slot 11–15 为空白，不生成运行时对象。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 13 张原始素材、卡组 30 张、召唤师/英雄/士兵/事件/城门/传送门和下方对象矩阵逐项登记。 |
| 真相源状态 | `passed` | 完整单卡主裁图、裁图清单、SHA256、卡面字段合同和运行时配置已锁定。 |
| 原子语义断言 | `passed` | 召唤师、3 名英雄、4 类士兵、4 张事件均拆成 C1/C2/C3 原子规则，并记录正向与负向路径；抹消单独登记“未写友方/敌方”。 |
| 实现消费链 | `passed` | 已追到 `helpers.ts`、`validate.ts`、`execute.ts`、`abilityResolver.ts`、`customActionHandlers.ts`、`systems.ts`、`executors/zhongcai.ts` 和 `reduce.ts`。 |
| 最终权威结果 | `passed` | 测试直接断言位置、伤害、治疗、有效战力、充能/事件、临时失能和召唤候选落位；抹消同时断言己方与敌方士兵失能。 |
| 交互真实入口 | `passed` | 仲裁 E2E 5/5 通过；覆盖派系选择、起始部署、服从双步、圣言/抹消/鼓舞和律令提示；抹消截图同时显示己方与敌方合法候选。 |
| 验证证据 | `passed` | 仲裁行为 15/15；共享/定向 UI 与交互 188/188；`typecheck`、`spec:lint`、manifest validate 和 evidence selfcheck 均通过。 |
| 共享影响与代表链依据 | `passed` | `sw-after-attack-ability-v1`、`sw-phase-end-ability-v1`、`sw-summon-position-extension-v1` 已记录触发、候选、权限、payload、执行、最终状态和清理。 |
| 缺口分类与范围裁定 | `passed` | 仲裁实现缺口、审计留档缺口和全仓范围外 i18n 缺口已分开记录。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 原先合并的“代表性验证”已拆成逐项结论；旧的“中彩”误称已改为“仲裁”。 |
| 残余范围声明 | `passed` | 明确不外推到其他派系或全仓 i18n；当前范围外问题不冒充仲裁阻塞。 |

## 原始素材登记

所有原始图片均为 `1050×750`，临时裁图只在 `temp/summonerwars-zhongcai-crops/` 用于核对，不进入运行时资源。

| 原始文件后缀 | 对象 | 用途 | SHA-256（小写） |
| --- | --- | --- | --- |
| `60224...D44246E6.png` | 传奇事件：服从 | cards slot 7 | `4d1219cd30f93e2e891a93b6006f4803eab91462e67b0cfb523641bf467abd35` |
| `6154...95C28A.png` | 提示板 | tip.png | `f12ed0a5b5d487282712cafc32ac9636853cc9bc1eb5637bb210162efb0416a8` |
| `623729...D01B0.png` | 英雄：高贵者凯西雅 | cards slot 0 | `553f088740cf8b585f70489d0e3775b2946fa273f881ad2296ce0f71132760d3` |
| `633160...B15.png` | 士兵：公正仲裁官 | cards slot 3 | `8189ad1761b1dbf7933bfd2dffb06a39dcd4ba338497d9c72ec170df86438f07` |
| `64222...CB9EF.png` | 士兵：和平仲裁官 | cards slot 4 | `e86e4a4807e81c042613140520796c4514f67c13aee118297ffc6cd5b320f04c` |
| `6531...AC9F3AE.png` | 士兵：护持牧师 | cards slot 5 | `668f8b86f054522d548e591e6420e5a674b67d738ee7974cc3e65d2b9d1be7c8` |
| `6631...D93C18.png` | 英雄：虚诚者提图斯 | cards slot 1 | `769919e4d9ad91fd67715eb0c254760b7112d093b3ec4ed906f6c83b9bb4b200` |
| `6728...18FDFA.png` | 英雄：睿智者阿不思 | cards slot 2 | `9b0e75d6efdbb0ace367b132c2a627731cd1a7a2d412fecb34d90b406765caee` |
| `6816...BCEA8.png` | 普通事件：圣戒律令 | cards slot 8 | `835c9b77365641ac991dc96ab1ff7e7ab60f368cd71645e319b97618ebe1bb48` |
| `6900...036CC9.png` | 士兵：战争仲裁官 | cards slot 6 | `8d2eb341ac86b3d25b206cb5bae13a346b5dc43f6b9b441a5bcd68b26dc44601` |
| `6982...015EF9.png` | 召唤师：正义者瓦莱瑞亚 | hero.png | `7a0892f529fe1504e51dc8251c84abf143af119140af6d7a699565d15833c781` |
| `707752...26BC04.png` | 普通事件：忠诚律令 | cards slot 9 | `374eab76c006f89b72e8e1ec893a0cbdf4c3e7c19884dc0876dc728d581c76be` |
| `7170...E50BD4.png` | 普通事件：自由律令 | cards slot 10 | `fe4097fc6b63d25c2c51c736289bf4c3ff796ae88fec953c5eadab19859ab1d3` |

正式运行时资源：

- `hero.png`：1050×750，复制自召唤师原图。
- `tip.png`：1050×750，复制自提示板原图。
- `cards.png`：8400×1500，8×2，每格 1050×750；slot 11–15 保留为空白占位。
- `compressed/hero.webp`、`compressed/tip.webp`、`compressed/cards.webp`：运行时 WebP 压缩，不降采样。

## 图集槽位合同

| slot | 运行时对象 | 类型 | 牌组数量 |
| ---: | --- | --- | ---: |
| 0 | 高贵者凯西雅 | 英雄 | 1 |
| 1 | 虚诚者提图斯 | 英雄 | 1 |
| 2 | 睿智者阿不思 | 英雄 | 1 |
| 3 | 公正仲裁官 | 士兵 | 4 |
| 4 | 和平仲裁官 | 士兵 | 4 |
| 5 | 护持牧师 | 士兵 | 4 |
| 6 | 战争仲裁官 | 士兵 | 4 |
| 7 | 服从 | 传奇事件 | 2 |
| 8 | 圣戒律令 | 普通事件 | 2 |
| 9 | 忠诚律令 | 普通事件 | 2 |
| 10 | 自由律令 | 普通事件 | 2 |
| 11–15 | 空白占位 | 不生成对象 | 0 |

牌组符号按图面确认复用：`double_axe + star + eye`；传奇事件“服从”运行时 `deckSymbols: []`。

## 提示板与开局合同

- 召唤师：正义者瓦莱瑞亚，10 生命城门。
- 起始单位：公正仲裁官（`(2,3)`）与和平仲裁官（`(2,2)`）。
- 传奇事件：服从 ×2。
- 召唤师位置：`(0,3)`；起始城门位置：`(1,3)`。

## 卡面字段与原子规则

### 召唤师：正义者瓦莱瑞亚

- 基础：生命 12，战力 2，远程，费用 0。
- 圣言 C1：本单位移动或攻击后触发。
- 圣言 C2：指定本单位 2 格内一个士兵，可将其推或拉 1 格。
- 高阶变门 C1：相邻敌方单位因移动或推拉而远离本单位时触发。
- 高阶变门 C2：对该敌方单位立即造成 2 点伤害。

### 英雄

- 高贵者凯西雅：费用 4，生命 6，战力 3，远程。治疗灵光：攻击阶段结束时，本单位 2 格内每个士兵移除 1 点伤害。
- 虚诚者提图斯：费用 6，生命 9，战力 3，远程。高阶变门同上；守卫：相邻敌方卡牌攻击时，必须将具有守卫的单位作为目标。
- 睿智者阿不思：费用 3，生命 5，战力 3，远程。
  - 抹消原文（卡面，繁体）：`在你的移動階段開始時，可以指定本單位3個區格以內的一個士兵為目標。目標失去所有技能，直到回合結束。`
  - 锁定翻译（运行时简体）：`在你的移动阶段开始时，可以指定本单位3个区格以内的一个士兵为目标。目标失去所有技能，直到回合结束。`
  - C1：你的移动阶段开始时，可选触发。
  - C2：目标是本单位 3 个区格以内的一个士兵，原文未限定友方或敌方。
  - C3：目标直到回合结束失去所有技能。

### 士兵

- 公正仲裁官：费用 2，生命 5，战力 3，近战。赎罪：攻击一张卡牌并造成伤害后，对自身造成 1 点伤害。清偿律令：本单位 2 格内所有士兵获得赎罪。
- 和平仲裁官：费用 1，生命 3，战力 2，远程。刚硬：一个回合中第一次被攻击时，该攻击伤害减少 1。坚忍律令：本单位 2 格内所有士兵获得强健。
- 护持牧师：费用 1，生命 3，战力 2，远程。护持：可被召唤到友方仲裁官单位相邻区格。鼓舞：召唤本单位后，可从相邻士兵移除 1 点伤害。
- 战争仲裁官：费用 2，生命 3，战力 2，近战。强健：本单位获得战力 +1。力量律令：本单位 2 格内所有士兵获得强健。

### 事件

- 服从：传奇，攻击阶段，费用 0。指定召唤师 3 格内一个士兵，将其放置到召唤师相邻空格。
- 圣戒律令：普通，建造阶段，费用 0。打出时放置 1 点充能；持续：召唤师将受到 1 点或更多伤害时，伤害至多为 1；自己的回合开始时可消耗 1 点充能弃置本事件。
- 忠诚律令：普通，攻击阶段，费用 0。打出时放置 1 点充能；持续：每个与一个或多个召唤师相邻的士兵获得战力 +1；自己的回合开始时可消耗 1 点充能弃置本事件。
- 自由律令：普通，召唤阶段，费用 0。持续：所有士兵获得“全能”，可用攻击代替移动，也可用移动代替攻击。

## 可视合同

| visualRegion | 运行时对象 | 允许状态 | 是否可交互 |
| --- | --- | --- | --- |
| hero 单帧 | 正义者瓦莱瑞亚 | 选角、牌桌、卡牌预览 | 选角可选；牌桌按规则操作 |
| tip 单帧 | 仲裁提示板 | 选角预览 / 开局查看 | 只读 |
| cards slot 0–2 | 3 名英雄 | 牌库、手牌、弃牌、预览 | 依卡牌/能力状态 |
| cards slot 3–6 | 4 类士兵 | 牌库、手牌、战场 | 依阶段与规则状态 |
| cards slot 7–10 | 4 张事件 | 手牌、主动事件区、弃牌 | 依阶段与充能状态 |
| cards slot 11–15 | 空白 | 永不生成卡牌 | 否 |

## 实现消费矩阵

| 对象 / 规则族 | 静态定义 | 运行时消费点 | 当前状态 |
| --- | --- | --- | --- |
| 派系注册与牌组 | `config/factions/zhongcai.ts` | faction index / deck builder | `passed` |
| 图集与资源地址 | `cards.png`、`hero.png`、`tip.png` | `ui/cardAtlas.ts`、critical resolver | `passed: 本地 manifest、服务器发布、公开 HEAD 均通过` |
| 圣言推拉 | ability + push/pull interaction | execute / systems / reduce | `passed: 定向测试 + 真实入口` |
| 高阶变门 | 离开相邻关系后的 2 点伤害 | execute / post-process | `passed: 定向行为测试` |
| 治疗灵光 | 攻击阶段结束范围治疗 | flowHooks / reduce | `passed: 定向行为测试` |
| 抹消 | 移动阶段开始选择 3 格内任意所有权的一个士兵，直到回合结束失去技能 | interaction / turn cleanup | 原卡逐字原文；定向测试覆盖己方/敌方；E2E 同时高亮两侧并结算敌方目标 | `功能实现已验证` |
| 赎罪 / 刚硬 / 强健 | 临时能力与伤害/战力修正 | helpers / execute / reduce | `passed: 定向行为测试` |
| 护持 / 鼓舞 | 特殊召唤位置与召唤后可选治疗 | validate / systems / execute | `passed: 定向行为测试 + 真实入口` |
| 服从 | 召唤师附近移动士兵 | event interaction | `passed: 真实双步交互` |
| 圣戒律令 / 忠诚律令 / 自由律令 | 主动事件、充能、光环/替代行动 | flowHooks / execute / reduce / systems | `passed: 定向行为测试 + 真实回合开始提示` |

## 审计结论

本轮结论为：`当前范围已收口`（功能与审计证据已收口，玩家可见完成态仍等待人工批准）。

- 数据录入：本地 13 张原始 PNG、图集槽位、卡面字段、提示板与开局合同已登记；本轮补回抹消原卡逐字原文，发现旧录入摘要和中英文文案额外加入了“友方”限定。
- 机制实现：仲裁技能、事件和交互已接入正式执行 / 系统 / reducer 链；本轮新增修复抹消的目标所有权过滤，使未写友方/敌方的“一个士兵”同时覆盖己方与敌方。
- 真实入口：5/5 仲裁 Playwright E2E 通过；新增流程证明抹消的己方与敌方士兵同时高亮，且实际点选敌方目标后完成失能结算。
- 资源主源：本地 manifest 增量校验通过；3 个正式压缩 WebP 已通过单文件上传发布，公开 HEAD 均返回 `200`，服务器素材主源与安卓稳定素材包刷新链已闭合。

## 2026-09-19 回归收口

- 自由律令跨阶段行动接入共享 `MOVE_UNIT` / `DECLARE_ATTACK` 校验后，保留原有“阶段优先、次数优先、单位合法性其次”的错误语义；普通士兵可跨阶段替代移动/攻击，召唤师与英雄不会被放宽。
- 新增仲裁后阵营目录扩展为 12 个可选派系；阵营选择第二页现在明确包含仲裁，并按实际剩余卡片数保留 2 个占位槽，不把旧 11 派系的 3 个占位断言继续当成真相。
- `activated_ability_target` UI 白名单已登记 `zhongcai_erase`、`zhongcai_inspire`、`zhongcai_word`，与系统交互适配器和真实棋盘目标选择保持同一入口。
- 上述三项均属于新增仲裁后的共享消费者同步，不新增第二套交互或兼容层；窄测先通过后再重跑全量召唤师战争测试。

## 逐项结论：对象级审计矩阵

| 对象 | 原子语义与最终权威结果 | 实现消费点 | 直接证据 | 当前裁定 |
| --- | --- | --- | --- | --- |
| 圣言 | 移动后选择本单位 2 格内友方士兵，再选择相邻推/拉落点；单位位置最终变化 | `src/games/summonerwars/domain/systems.ts`、`src/games/summonerwars/domain/executors/zhongcai.ts`、`reduce.ts` | 真实入口用例 3，最终无交互且目标单位落位 | `功能实现已验证` |
| 抹消 | 移动阶段开始选择 3 格内任意所有权的一个士兵；目标最终写入 `suppressedUntilTurnEnd: true`，回合切换清除 | `systems.ts`、`executors/zhongcai.ts`、`reduce.ts` | 原卡原文、己方/敌方定向测试、修正后真实入口 E2E、最终 21 张展示组 | `功能实现已验证` |
| 鼓舞 | 召唤护持牧师后，可选择相邻受伤友方士兵；最终伤害减 1 且交互关闭 | `systems.ts`、`executors/zhongcai.ts`、`reduce.ts` | 定向测试；真实入口用例 3 通过 | `功能实现已验证` |
| 服从 | 攻击阶段先选士兵，再选召唤师相邻空格；最终单位移动到落点 | `systems.ts`、事件执行链 | 真实入口用例 2 的双步截图与最终状态 | `功能实现已验证` |
| 圣戒律令 / 忠诚律令 / 自由律令 | 充能、持续效果与回合开始可选弃置提示按卡面语义消费 | `flowHooks.ts`、`systems.ts`、`execute/eventCards.ts`、`reduce.ts` | 定向测试；真实入口用例 4 的保留持续效果分支 | `功能实现已验证` |
| 高阶变门 | 相邻敌方单位因移动或推拉远离时受到2点伤害 | `execute.ts` 的移动与推拉后处理 | `abilities-zhongcai.test.ts`：移动离开分支；共享后处理代码覆盖推拉入口 | `功能实现已验证` |
| 治疗灵光 | 攻击阶段结束时，范围2内每个友方士兵移除1点伤害；英雄、敌方和范围外单位不受影响 | `flowHooks.ts` → `abilityResolver.ts` → `customActionHandlers.ts` → `reduce.ts` | `abilities-zhongcai.test.ts`：最终伤害与对象边界 | `功能实现已验证` |
| 赎罪 | 攻击敌方卡牌并实际造成伤害后，对自身造成1点伤害 | `execute.ts` 攻击结算 | `abilities-zhongcai.test.ts`：敌方受伤与攻击者自伤 | `功能实现已验证` |
| 刚硬 | 一个回合第一次被攻击时，该次最终伤害减少1 | `execute.ts` 攻击伤害修正与 `reduce.ts` 回合状态 | `abilities-zhongcai.test.ts`：第一次/第二次攻击最终伤害 | `功能实现已验证` |
| 强健 | 战争仲裁官有效战力为卡面战力+1 | `abilityResolver.ts` 有效战力计算 | `abilities-zhongcai.test.ts`：最终有效战力 | `功能实现已验证` |
| 护持 | 仲裁士兵可被召唤到护持牧师相邻空格；其他阵营不获得该扩展位置 | `helpers.ts` → `validate.ts` → 召唤执行链 | `abilities-zhongcai.test.ts`：合法召唤、最终落位与反向边界 | `功能实现已验证` |
| 圣言攻击后触发 | 攻击普通敌方单位或敌方召唤师后各只生成一个圣言交互触发事件 | `abilityResolver.ts` afterAttack → `customActionHandlers.ts` → `systems.ts` | `abilities-zhongcai.test.ts`：普通单位与召唤师两条攻击分支；重复事件回归保护 | `功能实现已验证` |
| 圣戒律令 | 召唤师受到多于1点攻击伤害时，最终只承受1点 | `execute.ts` 伤害修正 → `reduce.ts` | `abilities-zhongcai.test.ts`：两骰命中压到1点 | `功能实现已验证` |

## 负向断言与生命周期收口

- 圣言不应只在“攻击召唤师且伤害大于1”时触发，也不应由 afterAttack 通用链和 execute 旁路重复发射；当前回归测试确认普通敌方单位与敌方召唤师两条攻击分支各只有一个 `zhongcai_word` 事件。
- 治疗灵光不应治疗英雄、敌方单位或范围外士兵；护持不应把相邻召唤位置扩展给其他阵营；圣戒律令不应把非召唤师伤害一起压到1点。
- 所有双步交互完成或跳过后，`sys.interaction.current` 清空；圣言/抹消/鼓舞不会留下第二个同源窗口；攻击阶段结束治疗事件完成后阶段才可继续推进。
- 这些负向断言和清理语义由 `abilities-zhongcai.test.ts`、`interaction-chain-comprehensive.test.ts`、`systemInteractionAdapter.test.ts` 与 4/4 仲裁真实入口 E2E 共同覆盖；测试只证明仲裁范围，不外推全仓。

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计 / 已收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 圣言攻击召唤师时的手写旁路 | `语义不一致` | 否，已删除 | 否，已补重复事件回归 | 当前范围内 | 保留 afterAttack → custom handler 唯一入口 |
| 原先合并为“代表性验证”的六项能力 | `审计留档缺口` | 否，现有实现已通过行为测试 | 否，已拆为逐项结论 | 当前范围内 | 保留独立最终状态断言和对象矩阵 |
| 全仓 `npm run i18n:check -- --game summonerwars` | `非阻塞扩展` | 否 | 否，仲裁 zh/en 24/24 键直接比较通过 | 当前范围外 | 另开 DiceThrone 存量键缺口治理 |
| 其他派系既有 E2E / i18n / 发布问题 | `非阻塞扩展` | 否 | 否 | 当前范围外 | 不混入仲裁证据，按各派系单独收口 |

## 共享流程审计与共享根因

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `sw-after-attack-ability-v1` | 攻击结算后统一触发技能并生成玩家选择事件 | `execute.ts` → `triggerAbilities('afterAttack')` → `customActionHandlers.ts` → `systems.ts` | 同一能力只由一个 owner 发射；payload 带 sourceUnitId/sourcePosition/actionId；交互完成后无残留 | 具体 abilityId 与候选范围 | 影响所有 afterAttack 技能；仲裁已覆盖普通单位/召唤师两条分支 |
| `sw-phase-end-ability-v1` | 阶段结束触发、结算、阶段推进 | `flowHooks.ts` → `abilityResolver.ts` → `customActionHandlers.ts` → `reduce.ts` | 阶段结束效果先落最终状态，之后才允许推进；重复进入不重复发射 | 治疗对象筛选与数值 | 影响所有 onPhaseEnd 技能；仲裁治疗灵光已覆盖 |
| `sw-summon-position-extension-v1` | 召唤候选扩展与命令校验 | `helpers.ts` → `validate.ts` → 召唤执行链 | 只有合法阵营、合法能力和空格进入候选；最终单位落在玩家选定空格 | 护持牧师相邻空格 | 影响所有特殊召唤位置能力；仲裁护持已覆盖正向/反向边界 |

## 共享流程引用判等表

| 本对象 | 代表对象 | sharedFlowId | 一致性核对 | 候选生成 | 权限判断 | payload / command | 执行入口 | 最终权威状态 | 清理语义 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 圣言攻击后触发 | 其他 afterAttack 选择型能力 | `sw-after-attack-ability-v1` | 触发时机均为攻击结算结束后，均由单一能力 owner 生成通知；仲裁新增了召唤师目标去重回归 | `systems.ts` 按 sourceUnitId 和范围筛选友方士兵 | 只允许能力拥有者的合法攻击后窗口 | `ABILITY_TRIGGERED` 携带 sourceUnitId/sourcePosition/actionId | `abilityResolver.ts` → `customActionHandlers.ts` → `systems.ts` | 目标单位最终推/拉1格，或跳过后位置不变 | 交互完成后 `sys.interaction.current` 清空，不重复排队 | `passed` |
| 治疗灵光 | 其他 onPhaseEnd 范围效果 | `sw-phase-end-ability-v1` | 均在阶段结束触发，先产出效果事件再允许阶段推进；差异仅为仲裁治疗对象和数值 | 遍历 owner 的士兵，筛选距离2内且伤害大于0 | 只作用于 source owner 的士兵，不作用于英雄/敌方/范围外 | `ABILITY_TRIGGERED` → `UNIT_HEALED` | `flowHooks.ts` → `customActionHandlers.ts` → `reduce.ts` | 范围内友方士兵 damage -1，其他对象不变 | 阶段结束事件完成后可继续推进，无残留窗口 | `passed` |
| 护持 | 其他特殊召唤位置扩展 | `sw-summon-position-extension-v1` | 均先扩展候选再走同一召唤校验与落位；差异仅为仲裁阵营和护持牧师相邻空格 | `helpers.ts` 把护持牧师相邻空格加入候选集合 | `validate.ts` 只接受仲裁士兵、己方护持牧师和空格 | `SUMMON_UNIT` 的 cardId/position 载荷 | `helpers.ts` → `validate.ts` → 召唤执行链 | 单位最终落在选定相邻空格，魔力和手牌按正常召唤结算 | 无额外交互残留，非法阵营不获得该候选 | `passed` |

### 已定位的共享根因

- 圣言重复/错误条件的根本机制是：同一个 afterAttack 能力同时拥有正式 custom handler 和 execute.ts 内的第二个手写触发入口；第二入口又错误绑定到“目标是召唤师且 hits > 1”，所以会出现普通目标不走旁路、特定召唤师目标重复或条件错配。当前已删除第二入口，保留唯一的能力注册链。
- 鼓舞重复窗口的根本机制是：通用 `ABILITY_TRIGGERED` 和带专用 `actionId` 的通知都被 systems.ts 当成新目标选择消费；当前已收紧为只消费专用动作通知。
- 抹消 E2E 失败的根本机制是：夹具清空棋盘后没有恢复己方召唤师，回合推进进入游戏结束分支；当前夹具已补回己方召唤师并由真实入口复测。

## 修订 / 失效记录

| 旧材料或旧结论 | 当前修订 |
| --- | --- |
| 本文件原先将“高阶变门 / 治疗灵光 / 赎罪 / 刚硬 / 强健 / 护持”合并为 `代表性验证` | 现已拆成 6 个对象行，并补直接最终状态断言，统一改为 `功能实现已验证`。 |
| 本文件原先使用“当前结论：已完成”但缺少模板必填审计区块 | 已补审计范围、结论等级、权威来源、审计自检表、缺口分类、共享流程、残余范围和修订记录；当前结论改为 `当前范围已收口`。 |
| 本文件正文曾出现“中彩”误称 | 已统一改为正确中文名“仲裁”；内部 ID 仍为 `zhongcai`，不改运行时 ID。 |
| 原先圣言攻击分支缺少普通敌方单位与召唤师去重证据 | 已新增 14 条仲裁行为合同测试中的攻击后双分支回归，并删除旁路触发。 |
| 原先只登记 5 张仲裁代表截图，无法逐项展示新增交互中间态 | 已在 2026-09-19 重跑仲裁 E2E，补齐 19 张按交互族分组的触发前、选择态、结算态和继续态截图；旧 `_labeled-for-user-20260919-full` 图组不再作为本轮最终交付，改用 `_labeled-for-user-20260919-highlight-pass-v2`。 |
| 服从第二步“选择召唤师相邻空格”此前只有可点数据，没有玩家可见高亮 | 根因是 `useEventCardModes` 已生成合法落点，但没有把该候选集合传到 `BoardGrid` 的表现层；已补 `zhongcaiObedienceHighlights` 透传、格子属性和黄色高亮，并在 E2E 中逐个检查所有合法候选的计算样式与几何。 |
| “圣言：触发前”来源不清 | 该图是仲裁真实入口 E2E 的合法代表态起点：测试先用正式状态形状构造移动阶段，放入仲裁召唤师和友方战争仲裁官并截图；随后才由真实 UI 选中召唤师并移动，移动完成后才正式触发圣言。它证明触发前状态，不冒充自然对局随机获得。 |
| 旧查看器存在人为放大上限 | 已移除固定最大缩放，只保留最小缩放保护；查看器 README 和项目看图 skill 已同步说明放大后可继续拖拽查看细节。 |

## 验证证据

- `npm run typecheck`：通过。
- `npm run test:summonerwars`：69 个测试文件、1504 条测试全部通过；包含仲裁行为、交互、阵营选择翻页、系统能力白名单和全部召唤师战争共享回归。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-zhongcai.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：2 个文件、163 条测试通过。
- `node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-zhongcai.e2e.ts --case="圣言、抹消与鼓舞均从真实棋盘入口进入目标选择并结算"`：通过；抹消最终状态包含 `suppressedUntilTurnEnd: true`，鼓舞无重复残留交互。
- `node scripts/infra/run-e2e-single.mjs default e2e/summonerwars/summonerwars-zhongcai.e2e.ts`：2026-09-20 本轮 5 个用例全部通过；新增断言逐个检查服从、圣言、抹消、鼓舞当前合法候选的实际高亮，并验证抹消己方/敌方候选和敌方结算。
- 修正后全量交互展示组：`test-results/evidence-screenshots/summonerwars/zhongcai-final-user-delivery-20260920-v2/`；19 张上方带红框效果文字的真实入口流程图，另含抹消原卡本体和多个持续事件同屏图，共 21 张。
- 修正后最终 PASS 清单：`evidence/summonerwars/zhongcai-final-user-delivery-pass-manifest.json`；查看器左侧索引：`test-results/evidence-screenshots/summonerwars/zhongcai-final-user-delivery-20260920-v2/label-source-manifest.json`。
- 旧 `_labeled-for-user-20260919-*` 与旧效果文字图组保留为历史排查材料，不再作为本轮最终交付；其中抹消旧说明含“友方”，已由本组修正版取代。
- AI 图面核验：服从相邻空格、圣言友方士兵、圣言推拉落点、抹消己方/敌方士兵均在整屏原图中显示贴合棋盘格的高亮；抹消三张图上方红框逐字显示卡面繁体原文；标记图未遮挡游戏画面，结论 `PASS`。
- `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id summonerwars`：增量 manifest 已生成。
- `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id summonerwars`：通过。
- 真实入口截图：
  - `test-results/evidence-screenshots/summonerwars/summonerwars-zhongcai.e2e/真实派系选择入口进入对局并落地起始部署/仲裁派系真实入口开局.jpg`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-zhongcai.e2e/服从真实双步交互：选择士兵后放到召唤师相邻空格/仲裁服从选择士兵.jpg`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-zhongcai.e2e/服从真实双步交互：选择士兵后放到召唤师相邻空格/仲裁服从结算完成.jpg`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-zhongcai.e2e/圣言、抹消与鼓舞均从真实棋盘入口进入目标选择并结算/仲裁圣言抹消鼓舞结算.jpg`
  - `test-results/evidence-screenshots/summonerwars/summonerwars-zhongcai.e2e/律令在真实回合开始提示消耗充能或保留持续效果/仲裁律令回合开始提示.jpg`

## 资源发布验证

- 定向上传预检命中 3 个正式对象：`compressed/cards.webp`、`compressed/hero.webp`、`compressed/tip.webp`。
- 整批上传曾返回 `status=524`；随后改为单文件上传，并对卡图使用 `ASSET_SERVER_UPLOAD_CHUNK_BYTES=131072`、`ASSET_SERVER_UPLOAD_CONCURRENCY=1` 后发布成功。
- 最终服务器发布回执：英雄图 1 个对象、提示板 1 个对象、卡图 1 个对象；服务器同时刷新 `summonerwars` 稳定安卓素材包 3 个对象。
- 公开 HEAD 回查：`compressed/hero.webp`、`compressed/tip.webp`、`compressed/cards.webp` 均为 `200 OK`。
- 2026-09-19 复核：公开 HEAD 仍为 `200 OK`；当前响应体长度分别为 `211090`、`215528`、`1940074` 字节，最近修改时间为 `2026-09-19 15:39:04`、`15:41:10`、`15:51:11`（北京时间）。
- 现实结果：本地牌桌、服务器主源和安卓稳定素材刷新链均已消费同一组正式资源，资源链完成闭合。

## 同类扩审与漏审复盘

- 搜索范围：仲裁派系的 `ABILITY_TRIGGERED` 交互入口、`zhongcai_word` / `zhongcai_erase` / `zhongcai_inspire` 三个专用动作、所有 `onSummon` 目标选择、攻击后统一触发链、对应 UI adapter 和本派系真实入口 E2E。
- 命中项：发现“鼓舞”同时经过通用技能通知和带专用动作标记的通知，系统会把同一召唤后的目标选择排成两个交互；同时发现抹消 E2E 清空棋盘后未放回己方召唤师，导致回合推进先进入游戏结束分支；2026-09-20 重新对照原卡又发现抹消原文未写友方，但旧录入、文案、交互候选和执行器均按友方实现。
- 漏审归因：旧定向测试只覆盖了执行器的最终治疗/失能状态，没有覆盖完整系统交互队列是否只生成一个窗口；原 E2E 夹具也没有在清空棋盘后断言双方召唤师仍存在，证据停在“目标选择可出现”之前，未覆盖真实命令被游戏结束分支拒绝的路径。
- 已修复项：系统只消费带 `actionId: zhongcai_inspire` 的鼓舞专用通知；圣言同步收紧为专用通知或明确的 `afterMove:zhongcai_word` 入口；抹消夹具补回己方召唤师；本轮修正抹消中文/英文文案、系统候选范围和执行器所有权过滤，并补充敌方士兵结算测试。
- 扩审结果：窄领域测试与真实入口均覆盖抹消己方与敌方候选、敌方结算和回合清理；未扩大到其他派系的同名通用交互。
- 范围说明：本轮未扩大到其他派系的同名通用交互；仲裁派系自身的录入、实现、真实入口和资源发布已完成验证。

## 审计自检状态

`npm run audit:evidence:selfcheck -- evidence/summonerwars/zhongcai-faction-intake.md`：通过。当前实现与审计状态为 `in_progress`；这是与代码中的玩家可见实施中标记一致的人工完成闸门，不代表规则或资源仍有未验证阻塞。
