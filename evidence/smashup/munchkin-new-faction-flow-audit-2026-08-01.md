# Smash Up Munchkin 新派系流程审计总账

## 基本信息

- 对象：大杀四方 Munchkin / 新6扩小白扩展（8 个派系 + 宝藏牌堆 + 怪物牌堆）
- 日期：2026-08-01
- 文档类型：`audit` / `rollup`
- 当前结论等级：`仍有残余范围`
- 关联目标：按新派系流程完成；不能用 UI 布局截图替代完整流程完成。

## 前提锁定

| 前提 | 当前锁定结果 | 证据 |
| --- | --- | --- |
| 问题对象 | Smash Up Munchkin 扩展，不是单个 UI bug | 用户素材目录与当前 `munchkin.ts`、Munchkin intake 合同 |
| 主真相源 | `D:\gongzuo\webgame\gameasset\Smash Up! by Mervil (2833984701)-汉化图\新6扩小白` | 素材目录实测：8 个派系目录各 22 张、宝藏牌 22 张、怪物牌 20 张 |
| 当前实施入口 | `D:\gongzuo\webgame\BoardGame` 当前 worktree | 本文只引用当前工作树文件、当前资源树和当前测试入口 |
| 验收口径 | `.codex/skill/add-new-faction/SKILL.md` 的 S0-S6：数据录入、资源链、机制、对象级审计、真实入口 E2E、最终矩阵全 passed | 新派系 workflow、Smash Up intake / implementation workflow |

## 全面审计自检表

> 这个表用于防止把“已有 UI 和静态数据”误报成“已审计完成”。只要下表仍有 `blocked`、`scoped_debt` 或 `representative_only`，就禁止说 Munchkin 新派系流程完成。

| 自检项 | 状态 | 证据 / 缺口 |
| --- | --- | --- |
| 对象全集 | `passed` | `evidence/smashup/munchkin-intake-atlas-contract-2026-08-01.md` 已列 8 个派系、96 张普通派系牌、16 个基地、22 张宝藏牌、20 张怪物实体 / 8 个唯一怪物；本轮又从素材目录和运行时代码复核数量 |
| 规则子句表 | `blocked` | 73 个普通牌 / 基地 locale 仍写“静态接入完成、机制待建模”；尚未逐卡把卡图规则拆成 C1/C2/C3 |
| 完整技能流程矩阵 | `blocked` | 未建立逐卡 `真相源 -> 静态定义 -> 候选/入口 -> 命令/执行 -> 主效果 -> 分支/否定 -> 清理` 矩阵 |
| L0-L4 证据层级 | `scoped_debt` | L0/L1 静态接入有证据；怪物入基地、未受控怪物抬高破坏门槛、受控怪物计入控制者力量、基地清场移走怪物、击败怪物并发宝藏到玩家手牌已有 L2；玩家击败怪物命令与 UI 本体点击已有 L2 命令正反测试 + L3 真实点击 E2E；宝藏 3 张仆从、附着行动、普通行动、特殊行动的牌种合同已有 L2；宝藏仆从按普通随从打出、宝藏附着行动按普通行动附着并消耗行动额度已有 L2；半身人雇佣兵打出后给额外随从额度、愚蠢勇气药水给目标随从本回合 +3 已有 L2；尖刺靴、血腥肢解电锯、大量宝藏、诱惑护膝、怯懦药水的持续力量修正已有 L2；怯懦药水“失去所有能力”、摆动的盾牌“不能被摧毁”、时间错乱的喷气背包“将进弃牌堆时回手牌”、火箭靴“移动宿主到另一个基地并保留附着牌”、魔法导弹“自身回公共宝藏牌库底并摧毁这里力量 3 或更少仆从”、许愿指环“获得 1VP 并自身回公共宝藏牌库底”、探宝棒“抽两张宝藏并把自身和隐藏宝藏弃牌堆重洗回公共宝藏牌库”、十字弓“选择基地和派系，使那里该派系全部仆从本回合 +2”、一袋铁蒺藜“另一个玩家力量 3 或更少仆从打到这里时摧毁自身和该仆从，己方低力/对方高力不触发”已有共享持续/触发/天赋/onPlay 效果 L2；火箭靴附着行动天赋已补真实点击 L3；其余宝藏牌效、其余宝藏真实入口使用链和绝大多数普通牌没有 L2/L3/L4 |
| 命中 D 维度 | `representative_only` | 当前已识别 D1/D3/D5/D7/D8/D15/D18/D34/D35/D36/D52/D55 适用，但未逐对象审计 |
| 关键组合矩阵 | `representative_only` | 已覆盖怪物 + 基地破坏门槛、击败怪物 + 宝藏奖励的 reducer L2 正向路径、命令正向路径、力量不足/已受控/非当前玩家负向路径，以及“点击怪物 -> 怪物移除 -> 宝藏进手牌 -> 宝藏牌堆减少”的真实 UI 正向路径；已覆盖奖励宝藏按真实牌面类型进入手牌、宝藏仆从消耗随从额度、宝藏附着行动消耗行动额度、普通行动额度用完后不能继续打出、不创建长期宝藏区、半身人雇佣兵额外随从额度、愚蠢勇气药水 +3 临时力量、5 张宝藏持续力量牌、怯懦药水失去能力、摆动的盾牌防摧毁、时间错乱的喷气背包回手牌触发、火箭靴附着行动天赋移动宿主、魔法导弹附着行动天赋回公共宝藏牌库底并摧毁低力量仆从、许愿指环获得 1VP 并回公共宝藏牌库底、探宝棒抽两张宝藏并重洗公共宝藏牌库、十字弓选择基地和派系批量 +2、一袋铁蒺藜对方低力触发/对方高力不触发/己方低力不触发的 L2 合同；火箭靴附着行动卡本体点击、目标基地选择、宿主移动收口已有 L3；尚未覆盖其余宝藏牌效、其余宝藏真实入口使用 E2E、可选/跳过、计分前后触发等组合 |
| 真实入口 E2E 与截图核验 | `representative_only` | 2026-08-01 17:10 正式 E2E 通过 2 条；截图已核：`01-当前实现-怪物行和公共牌堆.jpg` 显示基地下方怪物行、抽牌堆旁 x20/x22；`02-点击怪物后宝藏进入手牌.jpg` 显示宝藏龙移除、宝藏堆 x19、玩家手牌新增 3 张宝藏；`04-火箭靴选择目标基地.jpg` 显示短提示和目标基地高亮；`05-火箭靴移动宿主后状态.jpg` 显示宿主已在目标基地。仍只是新增怪物/宝藏 UI 与火箭靴代表链，不覆盖整批逐卡玩法 |
| 测试语义对账 / 旧测试失效检查 | `in_progress` | `munchkinIntake.test.ts` 证明静态接入；`munchkinMechanics.test.ts` 已证明怪物基础机制 L2；逐卡规则语义仍未完成 |
| 同类扩审记录 | `blocked` | 发现“静态已接入但玩法未建模”后，尚未逐 8 派系、宝藏、怪物扩审到对象级 |
| 缺口分类与范围裁定 | `passed` | 本文已把功能实现阻塞、验证缺口、留档缺口拆开 |
| 残余范围声明 | `passed` | 本文明确：当前不能宣称完成，只能继续实施 |
| 旧 evidence / 旧结论对账回写 | `representative_only` | 旧 intake 合同本身没有冒充完整 gameplay；设计稿审计已记录 UI 失败/修正；还没有完整 closeout 需要降级 |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计/已收口口径 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| 怪物如何进入基地、如何增加/影响破坏门槛、如何被击败 | `功能实现阻塞` | 部分是 | 是 | 当前范围内 | 入基地、未受控怪物提高破坏门槛、受控怪物计入控制者力量、清场移走、击败怪物命令与事件结算已有 L2；UI 本体点击击败已有 L3 真实入口 E2E |
| 宝藏如何获得、进入谁的区域、何时能使用、是否占普通行动/随从额度 | `功能实现阻塞` | 部分是 | 是 | 当前范围内 | 击败怪物奖励现在进入玩家手牌；宝藏静态定义已改为混合牌种：矮人雇佣兵、半身人雇佣兵、虎骑士是仆从，其余按普通/持续/特殊行动接入；宝藏仆从走普通随从额度，宝藏行动走普通行动额度已有 L2；半身人雇佣兵打出后给额外随从额度、愚蠢勇气药水给目标随从本回合 +3 已有 L2；尖刺靴、血腥肢解电锯、大量宝藏、诱惑护膝、怯懦药水的持续力量修正、怯懦药水失去能力、摆动的盾牌防摧毁、时间错乱的喷气背包回手牌触发、火箭靴天赋移动宿主、魔法导弹天赋回公共宝藏牌库底并摧毁低力量仆从、许愿指环获得 1VP 并回公共宝藏牌库底、探宝棒抽两张宝藏并重洗公共宝藏牌库、十字弓选择基地和派系批量 +2、一袋铁蒺藜对方低力触发并摧毁自身和目标、对方高力/己方低力不触发已有 L2；其余宝藏牌效与真实入口使用链未实现 |
| 73 个普通牌 / 基地仍是 pending 文案 | `功能实现阻塞` | 是 | 是 | 当前范围内 | 回卡图/合同拆规则子句，再逐对象实现或登记真实 blocker |
| 只有布局 E2E，没有真实派系选择到可玩链 | `当前范围验证缺口` | 不直接证明实现错误 | 是 | 当前范围内 | 已复跑布局 E2E；仍需补真实入口 E2E：派系选择、初始化、至少一条新交互闭环 |
| `munchkinIntake.test.ts` 只证明静态合同 | `当前范围验证缺口` | 不直接证明实现错误 | 是 | 当前范围内 | 已补 `munchkinMechanics.test.ts` 作为怪物基础机制、击败奖励、宝藏混合牌种、宝藏仆从/行动基础使用的 L2；仍需补真实入口使用闭环、具体宝藏牌效、逐卡能力测试 |
| 缺对象级全面审计矩阵 | `审计留档缺口` | 否 | 是 | 当前范围内 | 本文作为总账入口，后续必须补逐对象矩阵 |
| 更多怪物/宝藏组合边界 | `当前范围验证缺口` | 视子句而定 | 是 | 当前范围内 | 机制落地后列关键组合矩阵 |

## S0 批次矩阵

| objectId / 对象组 | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `munchkin_dwarves` 矮人：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 8 张行动牌和多张随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_halflings` 半身人：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 行动牌和随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_thieves` 盗贼：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 行动牌和随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_mages` 法师：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 行动牌和随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_elves` 木精灵：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 行动牌和随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_clerics` 牧师：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 行动牌和随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_orcs` 兽人：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 行动牌和随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_warriors` 勇士：12 唯一卡 / 20 实体 + 2 基地 | `passed` | `passed` | `blocked: 行动牌和随从能力未建模` | `blocked` | `pending` | `in_progress` |
| `munchkin_treasure_deck` 宝藏公共牌堆：22 张 | `passed` | `passed` | `in_progress: 击败怪物奖励进入玩家手牌已有 reducer/命令 L2 + 真实点击 L3；宝藏混合牌种、宝藏仆从普通打出、宝藏附着行动基础打出已有 L2；半身人雇佣兵、愚蠢勇气药水、5 张宝藏持续力量牌、怯懦药水失去能力、摆动的盾牌防摧毁、时间错乱的喷气背包回手牌触发、火箭靴附着行动天赋移动宿主、魔法导弹附着行动天赋回公共宝藏牌库底并摧毁低力量仆从、许愿指环获得 1VP 并回公共宝藏牌库底、探宝棒抽两张宝藏并重洗公共宝藏牌库、十字弓选择基地和派系批量 +2、一袋铁蒺藜对方低力触发并摧毁自身和目标、对方高力/己方低力不触发已有 L2；其余宝藏牌效和真实入口使用链未实现` | `blocked` | `representative_only: 小牌堆数量可见；真实点击后数量从 x22 到 x19 已通过 E2E；火箭靴附着行动卡本体点击与移动宿主已通过 E2E；其余宝藏使用仍缺真实入口 E2E` | `in_progress` |
| `munchkin_monster_deck` 怪物公共牌堆：20 实体 / 8 唯一 | `passed` | `passed` | `in_progress: 入基地、未受控怪物提高破坏门槛、受控怪物计入控制者力量、清场移走、击败奖励已有 reducer/命令 L2；UI 本体点击已有 L3` | `blocked` | `representative_only: 小牌堆数量、基地怪物行、点击宝藏龙后移除并发宝藏已通过 E2E` | `in_progress` |
| Munchkin 新 UI：抽牌堆旁公共小牌、基地下方怪物行 | `passed` | `passed` | `in_progress: 展示模型、本体点击和点击后状态变化已接通；仍不代表宝藏使用或逐卡能力完成` | `representative_only` | `passed: 2026-08-01 15:34 新点击链 E2E 通过，15:35 两张截图已核` | `in_progress` |

## 当前已证明的事实

| 事实 | 当前证据 | 结论 |
| --- | --- | --- |
| 原始素材数量完整落点可查 | 素材目录实测：8 个派系目录各 22 张、宝藏牌 22 张、怪物牌 20 张 | 支持 S0/S1 对象全集 |
| 运行时静态数据存在 | `src/games/smashup/data/factions/munchkin.ts`：96 个普通派系 defId、22 个宝藏 defId、8 个唯一怪物 defId，怪物实体展开为 20 张 | 支持 L1 静态接入 |
| Munchkin 图集注册存在 | `src/games/smashup/domain/atlasCatalog.ts` / `ids.ts` 注册 8 组手牌、8 组基地、宝藏、怪物 atlas | 支持 L1 资源索引 |
| 本地压缩资源存在 | `public/assets/i18n/zh-CN/smashup/cards/compressed/munchkin_*.webp`、`base/compressed/munchkin_*_bases.webp` | 支持本地资源链，仍需本轮远端回查更新 |
| 游戏级和根级 manifest 含 Munchkin 键 | `public/assets/i18n/zh-CN/smashup/assets-manifest.json` 与 `public/assets/i18n/assets-manifest.json` 均命中 Munchkin 压缩资源键 | 支持 manifest 链 |
| 新 UI 局部验证存在 | `e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts`；截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\怪物行和公共小牌堆不抢原版布局\01-当前实现-怪物行和公共牌堆.jpg`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\怪物行和公共小牌堆不抢原版布局\02-点击怪物后宝藏进入手牌.jpg`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\火箭靴附着行动天赋可从卡本体点击并移动宿主到目标基地\04-火箭靴选择目标基地.jpg`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\火箭靴附着行动天赋可从卡本体点击并移动宿主到目标基地\05-火箭靴移动宿主后状态.jpg` | 2026-08-01 17:10 正式 E2E 2 tests passed；证明新增怪物行、公共小牌堆、点击怪物击败、宝藏进手牌、火箭靴附着行动卡本体点击和移动宿主的代表链；不证明其余宝藏使用或逐卡派系玩法 |
| 怪物与宝藏基础机制已有 L2 | `src/games/smashup/__tests__/munchkinMechanics.test.ts` 覆盖怪物数值、基地 `monsterCount`、未受控怪物提高破坏门槛、受控怪物计入控制者力量且不再抬高门槛、初始/换基地发怪物、清场进怪物弃牌堆、击败怪物并按牌面牌种把奖励宝藏加入玩家手牌、命令正向与力量不足/已受控/非当前玩家负向路径；2026-08-01 18:14 与 `munchkinIntake.test.ts` 一起复跑 49 tests passed，新增覆盖宝藏混合牌种、宝藏仆从按普通随从打出、宝藏附着行动按普通行动附着、行动额度限制、不创建 `player.treasures` 长期区域、半身人雇佣兵额外随从额度、愚蠢勇气药水 +3 临时力量、尖刺靴、血腥肢解电锯、大量宝藏、诱惑护膝、怯懦药水的持续力量修正、怯懦药水失去能力、摆动的盾牌防摧毁、时间错乱的喷气背包回手牌触发、火箭靴天赋移动宿主、魔法导弹天赋回公共宝藏牌库底并摧毁低力量仆从、许愿指环获得 1VP 并回公共宝藏牌库底、探宝棒抽两张宝藏并把自身和隐藏宝藏弃牌堆重洗回公共宝藏牌库、十字弓选择基地和派系批量 +2、一袋铁蒺藜对方低力触发/对方高力不触发/己方低力不触发 | 支持 M1/M2/M3/M4/M5 的 reducer/命令/持续/保护/压制/触发/天赋 L2 进展；不证明其余宝藏真实入口使用 E2E、时间错乱的喷气背包真实队列 L4、其余宝藏牌效或逐卡派系能力 |
| Munchkin 宝藏能力注册已有首批实现 | `src/games/smashup/abilities/munchkin.ts` 注册一袋铁蒺藜 onMinionPlayed 触发、半身人雇佣兵、愚蠢勇气药水、怯懦药水压制能力、摆动的盾牌防摧毁保护、时间错乱的喷气背包回手牌触发、火箭靴附着行动天赋、魔法导弹附着行动天赋、许愿指环 onPlay、探宝棒 onPlay、十字弓 onPlay + 选择派系交互；`src/games/smashup/abilities/index.ts` 已接入 `registerMunchkinAbilities()` 与 `registerMunchkinInteractionHandlers()`；`src/games/smashup/data/factions/munchkin.ts` 已给半身人雇佣兵、愚蠢勇气药水、许愿指环、探宝棒、十字弓补 `onPlay` 标签，给火箭靴和魔法导弹补 `talent` 标签 | 支持首批宝藏牌效 L2；当前不能宣称全部宝藏牌效完成 |

## 新 UI / 用户裁定回写

| 用户裁定 | 当前承接 | 状态 |
| --- | --- | --- |
| 怪物放在基地下面一排，允许重叠 | `BaseZone.tsx` 怪物行 + UI E2E 几何断言；截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\怪物行和公共小牌堆不抢原版布局\01-当前实现-怪物行和公共牌堆.jpg` | `passed`，本轮 2026-08-01 15:35 图面核验：怪物位于基地卡下方、玩家随从列上方；允许重叠但仍保留可点击露出切片 |
| 不抢泰坦、持续行动、行动卡位置 | UI E2E 断言泰坦/持续行动仍在基地上方 | `passed`（布局代表态） |
| 不重复显示卡牌已有信息 | 怪物行只补控制者提示，不复写怪物名称/战力/奖励 chip | `passed`（布局代表态） |
| 抽牌堆旁显示怪物/宝藏小牌数量，弃牌堆不用 | `DeckDiscardZone.tsx` + E2E 断言 `x 20` / `x 22`，点击后宝藏堆 `x 19`，且无特殊弃牌堆 | `passed`（本轮真实点击链） |
| 设计稿 / 前端应与当前前端一致 | 当前验收入口改为真实前端 E2E 截图，不再用 Open Design artifact 冒充运行页 | `passed`（口径修正） |

## 机制建模 P0 队列

| P0 项 | 现实含义 | 必选审计维度 | 目标证据 |
| --- | --- | --- | --- |
| M1 怪物入基地 | 怪物是基地公共对象，不是玩家打上去的随从 | D1/D3/D5/D8/D15/D52/D55 | `passed L2`: 初始基地和 `BASE_REPLACED` 会按 `monsterCount` 发怪物并消耗怪物牌堆；仍缺真实入口 L3 |
| M2 怪物对基地破坏的影响 | 未受控怪物力量不计入玩家总力并抬高破坏门槛；受控怪物计入控制者力量 | D1/D4/D8/D12/D15/D18 | `passed L2`: `getEffectiveBreakpoint` 只加未受控怪物力量，`getPlayerEffectivePowerOnBase` / `getTotalEffectivePowerOnBase` 纳入受控怪物力量；仍缺 UI 读数与真实计分链 L3/L4 |
| M3 击败怪物 | 玩家如何通过当前基地力量/规则条件击败怪物 | D1/D5/D7/D8/D18/D35 | `passed representative L3`: reducer 事件、命令校验、命令事件生成、力量不足/已受控/非当前玩家负向路径已测；UI 本体点击宝藏龙已通过真实入口 E2E。仍需更多怪物/卡牌效果组合审计 |
| M4 宝藏奖励 | 击败怪物或卡牌效果如何给玩家宝藏 | D1/D3/D7/D8/D57 | `passed representative L3`: reducer 事件按奖励数量抽宝藏到玩家手牌，并按卡牌定义保留真实牌种；真实点击后手牌新增 3 张宝藏、宝藏堆从 x22 到 x19。仍缺具体宝藏牌效 |
| M5 宝藏使用 | 宝藏是行动、随从、附着还是特殊牌；是否消耗普通出牌额度 | D1/D2/D5/D7/D8/D18/D55 | `passed representative L2/L3`: 已按图面分成宝藏仆从、普通行动、持续/附着行动、特殊行动；宝藏仆从通过 `PLAY_MINION` 打出并消耗随从额度；宝藏附着行动通过 `PLAY_ACTION` 附着到目标并消耗行动额度；普通行动额度用完后不能继续打出；半身人雇佣兵额外随从额度、愚蠢勇气药水 +3 临时力量、怯懦药水失去能力、摆动的盾牌防摧毁、时间错乱的喷气背包回手牌触发、火箭靴天赋移动宿主、魔法导弹天赋回公共宝藏牌库底并摧毁低力量仆从、许愿指环获得 1VP 并回公共宝藏牌库底、探宝棒抽两张宝藏并重洗公共宝藏牌库、十字弓选择基地和派系批量 +2、一袋铁蒺藜对方低力触发并摧毁自身和目标、对方高力/己方低力不触发已有 L2；火箭靴真实点击入口已有 L3。仍缺其余宝藏真实入口 E2E、喷气背包真实队列 L4 和其余具体宝藏牌效 |
| M6 逐卡派系能力 | 96 张普通派系卡与 16 个基地规则子句 | D1-D57 按适用维度选 | 每对象规则子句表 + L2/L3/L4 |

## 当前不能宣称完成的原因

- 数据与资源：已达到静态 intake 层；2026-08-01 14:00 已重新记录 4 个代表远端 URL 均为服务器主源 `HEAD 200`。
- 机制：怪物入基地、未受控怪物提高破坏门槛、受控怪物计入控制者力量、清场移走、击败怪物并奖励宝藏已到 reducer/命令 L2；玩家 UI 本体点击击败怪物和宝藏进手牌已到代表链 L3；宝藏混合牌种、宝藏仆从/附着行动的基础使用与额度消耗已到 L2；半身人雇佣兵额外随从额度、愚蠢勇气药水 +3 临时力量、尖刺靴、血腥肢解电锯、大量宝藏、诱惑护膝、怯懦药水的持续力量修正、怯懦药水“失去所有能力”、摆动的盾牌“不能被摧毁”、时间错乱的喷气背包“将进弃牌堆时回手牌”、火箭靴“移动宿主到另一个基地”、魔法导弹“自身回公共宝藏牌库底并摧毁这里力量 3 或更少仆从”、许愿指环“获得 1VP 并自身回公共宝藏牌库底”、探宝棒“抽两张宝藏并把自身和隐藏宝藏弃牌堆重洗回公共宝藏牌库”、十字弓“选择基地和派系，使那里该派系全部仆从本回合 +2”、一袋铁蒺藜“另一个玩家力量 3 或更少仆从打到这里时摧毁自身和该仆从，己方低力/对方高力不触发”已到 L2；火箭靴附着行动卡本体点击已到 L3；魔法导弹、许愿指环、探宝棒、十字弓、一袋铁蒺藜和其余宝藏真实入口使用链、喷气背包真实队列 L4、其余宝藏牌效和逐卡能力尚未完成；这是功能实现和验证缺口，不是单纯缺截图。
- 审计：本文只是总账入口；还没有逐对象规则子句表和完整技能流程矩阵。
- E2E：本轮点击怪物链路和火箭靴真实点击链路已经取得有效截图；但这些 E2E 只覆盖新增 UI / 怪物宝藏 / 火箭靴代表链，不覆盖派系全量玩法。

## 验证证据

| 层级 | 命令 / 证据 | 当前状态 |
| --- | --- | --- |
| L1 静态 intake | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/munchkinIntake.test.ts --configLoader native` | `passed`：2026-08-01 14:00，1 file / 22 tests passed |
| L2 怪物与宝藏基础机制 | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/munchkinMechanics.test.ts src/games/smashup/__tests__/munchkinIntake.test.ts --configLoader native` | `passed`：2026-08-01 18:14，2 files / 49 tests passed；覆盖怪物数值、基地怪物数量、初始/换基地发怪物、未受控/受控怪物力量分流、清场移走、击败怪物奖励宝藏进手牌、命令正向与负向路径，以及宝藏混合牌种、宝藏仆从按随从打出、宝藏附着行动按行动打出、额度消耗、无长期宝藏区、半身人雇佣兵额外随从额度、愚蠢勇气药水 +3 临时力量、5 张宝藏持续力量牌、怯懦药水失去能力、摆动的盾牌防摧毁、时间错乱的喷气背包回手牌触发、火箭靴天赋移动宿主并保留附着牌、魔法导弹天赋回公共宝藏牌库底并摧毁低力量仆从、许愿指环获得 1VP 并回公共宝藏牌库底、探宝棒抽两张宝藏并把自身和隐藏宝藏弃牌堆重洗回公共宝藏牌库、十字弓选择基地和派系批量 +2、一袋铁蒺藜对方低力触发/对方高力不触发/己方低力不触发 |
| L3 UI 点击链 | `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts --project=chromium` | `passed`：2026-08-01 17:10，2 tests passed；截图 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\怪物行和公共小牌堆不抢原版布局\01-当前实现-怪物行和公共牌堆.jpg`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\怪物行和公共小牌堆不抢原版布局\02-点击怪物后宝藏进入手牌.jpg`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\火箭靴附着行动天赋可从卡本体点击并移动宿主到目标基地\03-火箭靴附着行动可点击.jpg`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\火箭靴附着行动天赋可从卡本体点击并移动宿主到目标基地\04-火箭靴选择目标基地.jpg`、`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\火箭靴附着行动天赋可从卡本体点击并移动宿主到目标基地\05-火箭靴移动宿主后状态.jpg`；17:11 图面核验：火箭靴提示为短标签，目标基地高亮，收口图显示宿主已在目标基地 |
| 历史 L3 UI 代表态 | `npm run test:e2e:ci:file -- e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts` | `historical_passed`：2026-08-01 14:42，1 test passed；截图 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\怪物行和公共小牌堆不抢原版布局\01-当前实现-怪物行和公共牌堆.jpg`，只证明旧布局代表态 |
| 交互审计过滤 | `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native *> temp/smashup-interaction-audit-2026-08-01.log` 后按 `munchkin/Munchkin/十字弓/crossbow` 过滤输出 | `historical_fail / no_munchkin_new_failure`：2026-08-01 18:05，命令仍因全局历史交互债退出 1；过滤结果无 Munchkin / 十字弓命中；本轮新增 `munchkin_treasure_crossbow_choose_faction`、`munchkin_treasure_magic_missile_destroy`、`munchkin_treasure_rocket_boots_move` 未被点名 |
| ESLint 定向检查 | `npx eslint src/games/smashup/abilities/munchkin.ts src/games/smashup/__tests__/munchkinMechanics.test.ts` | `passed`：2026-08-01 18:18，0 errors / 0 warnings；覆盖本轮一袋铁蒺藜改动文件 |
| 类型检查 | `npm run typecheck` | `passed`：2026-08-01 18:18，`tsc --noEmit` 通过 |
| 资源远端代表 URL | `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/munchkin_dwarves.webp` | `passed`：HTTP 200，`Content-Length=4434966`，`X-Asset-Source=server` |
| 资源远端代表 URL | `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/munchkin_dwarves_bases.webp` | `passed`：HTTP 200，`Content-Length=550516`，`X-Asset-Source=server` |
| 资源远端代表 URL | `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/munchkin_treasures.webp` | `passed`：HTTP 200，`Content-Length=4777288`，`X-Asset-Source=server` |
| 资源远端代表 URL | `HEAD https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/munchkin_monsters.webp` | `passed`：HTTP 200，`Content-Length=6951672`，`X-Asset-Source=server` |

## 对外汇报口径

- 允许说：Munchkin 扩展已经完成静态 intake、资源本地链路、新 UI 代表态验证，以及怪物入基地、未受控怪物提高破坏门槛、受控怪物计入控制者力量、清场移走、击败怪物命令、玩家点击怪物、宝藏进手牌的 L2/L3 代表链验证；宝藏混合牌种、宝藏仆从基础打出、宝藏附着行动基础打出、额度消耗、半身人雇佣兵额外随从额度、愚蠢勇气药水 +3 临时力量、5 张宝藏持续力量牌、怯懦药水失去能力、摆动的盾牌防摧毁、时间错乱的喷气背包回手牌触发、魔法导弹回公共宝藏牌库底并摧毁低力量仆从、许愿指环获得 1VP 并回公共宝藏牌库底、探宝棒抽两张宝藏并重洗公共宝藏牌库、十字弓选择基地和派系批量 +2、一袋铁蒺藜对方低力触发/对方高力不触发/己方低力不触发已完成 L2 合同验证；火箭靴已完成 L2 行为和 L3 真实点击代表链。
- 禁止说：Munchkin 新派系已完成、已全面审计、已可玩、已收口、宝藏具体牌效已完成、全部宝藏使用真实入口已完成、或逐卡派系能力已完成。
- 下一步默认动作：实现宝藏非力量牌效、补宝藏真实入口使用 E2E，并继续逐派系规则子句。
