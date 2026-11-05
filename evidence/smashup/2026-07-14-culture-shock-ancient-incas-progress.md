# 文化冲击四派系 - 古代印加人阶段进展（2026-07-14）

## 2026-09-19 当前审计回写

- 古代印加人当前结论为 `representative_verified / current_scope_closed`。此前《星星上的征兆》“只写 metadata、没有继承基地能力、没有回合开始翻面关闭”的实现阻塞已修复；本轮继续补齐了真实打出、动态换顶、回合开始翻面、下一回合恢复和基地清场离场的对象级生命周期证据。
- 古代印加人当前有 18 条能力领域测试、1 条方石砌体完整计分后管线测试，另有 10 条真实入口 E2E；共享基地能力回归 4 files / 96 tests 通过。四派系批次状态仍为 `in_progress`，其它派系和远端资源发布不因本对象当前范围关闭而自动完成。

## 审计范围

- 对象全集：古代印加人 4 张随从、8 张行动、2 张基地，共 14 个登记对象；覆盖主动能力、持续能力、基地能力、计分后响应、动态基地能力来源和清场离场。
- 本轮覆盖：静态登记、规则实现消费、领域测试、共享基地能力链、真实入口 E2E、交互前后状态、`triggerQueue` / reaction session / `finalState` 和远端资源残余分流。

## 结论等级

结论等级：`representative_verified / current_scope_closed`。这里的关闭只指古代印加人当前本地玩法范围，不能外推为四派系批次完成。

## 权威来源

- 运行时真相源：`src/games/smashup/data/factions/ancient_incas.ts`、`src/games/smashup/abilities/ancient_incas.ts`、共享 reducer / reaction queue / base ability 实现。
- 行为真相源：`src/games/smashup/__tests__/abilities/ancient-incas.test.ts`、`src/games/smashup/__tests__/ancient-incas-ashlar-masonry.test.ts`、共享基地能力回归测试和 `e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts`。
- 图像合同真相源：本地完整单卡主裁图、裁图清单、crop manifest、资源 SHA256 和当前 atlas manifest；R2 / CDN 只作为单独发布状态，不替代玩法结论。

## 逐项结论

- 14 个对象均已有规则子句、实现入口、领域或共享测试落点；星星上的征兆另有三条 direct E2E 覆盖动态来源切换、回合生命周期和离场清理。
- 高风险对象的最终权威结果均回到手牌、弃牌堆、基地随从 / 行动、指示物、基地牌库、`triggerQueue`、交互关闭和 `finalState`，没有用“弹窗出现”替代结算完成。

## 验证证据

- 领域测试、共享回归和真实入口 E2E 均通过；强制额外出牌、计分后延迟清场、动态基地能力来源和无效触发拒绝均有正向与负向断言。
- 多段交互逐段验证“交互出现 -> 玩家选择 -> 下一段交互或结算 -> 流程收口”；空选、跳过、无效候选、重复使用和无残留均有对应证据。

## 共享根因与残余范围

- 共享影响集中在基地能力队列、动态有效基地能力来源、ongoing 力量 / 临界点修正和 reaction session 消费；本轮共享强制触发回归补齐了入队、消费、事件归约和最终力量稳定性。
- 当前残余仅为其它三个派系的对象级 direct L3/L4，以及文化冲击 atlas 的远端上传 / `HEAD 200`；不把这些残余归因到古代印加人本地规则。

## 修订或失效记录

- 失效原因：旧实现只保存展示 metadata，未把基地牌库顶能力接入有效基地能力来源，也没有建立回合开始翻面关闭与下一回合恢复的生命周期状态。

## 同类扩审与残余范围

- 搜索范围：古代印加人 14 个对象、所有相关 `registerTrigger` / `registerBaseAbility` / `registerActiveBaseAbility`、共享 `baseAbilityQueue`、`reactionSession`、`ongoingModifiers`、计分后清场和真实 E2E 入口。
- 命中项：动态基地能力来源、强制额外出牌消费、计分后替代清理、持续移动、检索后触发和目标过滤均已逐项核对；没有把单个代表对象的通过外推到未命中的派系。
- 残余扩审范围：阿南西传说、格林童话、俄罗斯童话的对象级 direct L3/L4，以及文化冲击 atlas 的远端上传 / `HEAD 200`。

- 旧结论“星星上的征兆只写 metadata、没有继承基地能力、没有回合开始翻面关闭”已失效；替代证据为本轮领域 / 共享回归和 10/10 真实入口 E2E。
- 旧结论“金色秃鹰只授予等量额外行动”“方石砌体缺少完整计分后替代证据”“皇家公路、萨帕·印加、防护墙缺对象级证据”均已由当前对象级测试与 E2E 替换。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 14 个对象全集已列入规则子句表与对象矩阵 |
| 真相源状态 | `passed` | 本地数据、实现、测试、E2E 和图像合同均已定位 |
| 原子语义断言 | `passed` | 每张卡按目标、数量、时机、资源与生命周期拆分 |
| 实现消费链 | `passed` | handler / resolver / reducer / reaction session 已对账 |
| 最终权威结果 | `passed` | `finalState`、牌区、基地状态、力量 / 临界点和无残留已核对 |
| 交互真实入口 | `passed` | 真实打牌、基地能力、回合开始和计分后响应均有 E2E |
| 验证证据 | `passed` | 领域测试、共享合同、E2E、截图和负向路径均已记录 |
| 共享影响与代表链依据 | `passed` | 共享队列、动态基地来源和 ongoing 修正逐项核对 |
| 残余范围声明 | `passed` | 其它派系与远端资源明确留在当前批次残余 |
| 旧 evidence / 旧结论对账回写 | `passed` | 本节已记录旧结论失效及替代证据 |

## 当前结论

- 古代印加人（`ancient_incas`）本轮已完成代表性玩法实现、L2 领域行为测试、Culture Shock 批次集成校验、OpenSpec 严格校验和代表性 L3/L4 真实入口 E2E。
- 当前结论等级：**古代印加人本地玩法当前范围已收口；四派系批次状态仍为 `in_progress`**。这证明古代印加人 14 个对象的已登记规则链均有领域 / 共享 / 真实入口证据落点，其中星星上的征兆本轮补齐了此前唯一剩余的对象级真实生命周期缺口。
- 本轮 E2E 覆盖：派系选择页、结绳文字、金色秃鹰、方石砌体、皇家公路、萨帕·印加、防护墙，以及星星上的征兆的真实打出复制基地能力、天赋换顶、回合开始翻面、下一回合恢复和清场离场。星星上的征兆三条 E2E 共 10/10 通过，真实页面逐段观察到 reaction session、手动选择、基地有效能力来源和最终状态收口。
- 文化冲击卡牌与复用基地资源仍沿用前序 blocker：本地压缩产物和 manifest 已存在，但 R2/CDN 上传与 `HEAD 200` 仍 blocked，不能声明远端资源链路完成。

## 本轮实现补齐

| 对象 | 规则子句 | 当前处理 | 证据 |
| --- | --- | --- | --- |
| 结绳文字 | 从弃牌堆选择一个可打到基地的行动，并作为额外行动打出 | 新增弃牌堆行动目标 prompt；发 `ACTION_PLAYED fromDiscard isExtraAction`，对 ongoing 基地行动发 `ONGOING_ATTACHED`，并继续执行该行动 onPlay | `结绳文字从弃牌堆额外打出太阳神庙到基地，并结算太阳神庙抽牌`；E2E `结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地` |
| 太阳神庙 | 打到基地时抽 1；此后你在该基地打出另一个行动后可抽 1 | onPlay 用标准抽牌事件；ongoing 使用 `onActionPlayed` 可选 trigger，并通过 `canTrigger` 排除自触发 | `太阳神庙在己方打出另一个行动到同基地后可抽一张牌` |
| 印加工程师 | 展示牌库直到出现可打到基地的行动，将其加入手牌，其余洗回 | 发 `REVEAL_DECK_TOP` / `DECK_INSPECTED`，选中行动用 `CARD_TRANSFERRED` 入手，其余 `DECK_REORDERED` | `印加工程师展示到第一张可打到基地的行动，将其加入手牌并洗回其余牌` |
| 萨帕·印加 | 从牌库 / 弃牌堆检索可打到基地的行动加入手牌；之后你打出行动到基地后在该基地己方随从上放 +1 | 新增检索 prompt 与 `CARD_TRANSFERRED`；ongoing trigger 在行动目标基地上选择己方随从放 `POWER_COUNTER_ADDED` | 领域测试“萨帕·印加只从牌库或弃牌堆检索可打到基地的行动并加入手牌”；E2E 覆盖牌库检索、行动后指示物和牌区收口 |
| 防护墙 | 打到基地时给这里一个己方随从 +1；之后你在该基地打出另一个行动后可再给 +1 | onPlay / ongoing trigger 复用 counter prompt；ongoing trigger 排除自身刚打出时的自触发；打出时和其它行动后的目标都只允许同基地己方随从 | 18 条领域测试；E2E `防护墙真实入口覆盖打出时与其它行动后的两次指示物选择`；截图 16-18 |
| 皇家公路 | 打到基地时可将己方随从移入 / 移出此基地；之后你在其他基地打出行动后可在此基地和该基地之间移动己方随从 | 双向候选只列己方随从；打出时与持续触发都保留手动选择和跳过；用 `buildValidatedMoveEvents` 落 `MINION_MOVED` 权威状态 | 领域测试覆盖双向 / 跳过 / 同基地排除 / 他人行动排除；E2E 覆盖真实打出、持续反应、最终两次移动事件和交互关闭 |
| 美洲驼 | 可将其它基地的己方行动返回手牌并作为额外行动打到这里 | 新增其它基地己方 ongoing 行动选择；先 `CARD_TRANSFERRED` 回手，再复用额外打出基地行动链 | 注册合同测试 |
| 金色秃鹰 | 返回任意数量基地上的己方行动，并应逐张作为额外行动打出 | 多选后逐张建立强制额外出牌交互；每段只能选择当前绑定行动、不能跳过，随后手动选择目标基地并继续下一张 | 领域测试“逐张绑定行动为不可跳过的额外出牌”；E2E `金色秃鹰逐张绑定行动并连续强制额外出牌`；截图 05-08 |
| 方石砌体 | 计分后可将该基地一个己方行动回手，其余洗回牌库而非弃置 | 当前实现从计分基地选择一张己方行动回手，其他己方行动先生成 `CARD_TO_DECK_BOTTOM` 再用 `DECK_REORDERED` 入牌库；延迟 `BASE_CLEARED / BASE_REPLACED` 只清理仍留在基地上的对象 | `ancient-incas-ashlar-masonry.test.ts`；E2E 计分后响应窗口与最终事件流断言 |
| 军械库 | 你在该基地每有其它一个行动，己方在此总力量 +2 | 新增 base power modifier；按同基地同控制者其它 ongoing 行动计数 | `军械库按同基地其它己方行动提供力量，库斯科每有一个行动降低 3 临界点` |
| 星星上的征兆 | 展示基地牌库顶；天赋把基地牌库顶放底；展示期间复制该基地能力 | 已实现动态基地能力继承；天赋后有效能力来源跟随新的牌库顶；回合开始可选择翻面，本回合关闭，下一回合恢复，行动离场后失效 | 星星专测、共享基地能力回归、真实入口三条 E2E；对象级生命周期已收口 |
| 库斯科 | 此基地每有一个行动，临界点 -3 | 新增 custom breakpoint modifier，统计基地 ongoing 与随从附着行动 | `军械库按同基地其它己方行动提供力量，库斯科每有一个行动降低 3 临界点` |
| 马丘比丘 | 有玩家打出行动到此基地后，该玩家抽 1 | 新增 base `onActionPlayed` 能力，按行动目标基地过滤并标准抽牌 | `马丘比丘在行动打到此基地后让打出者抽一张牌` |

## 本轮代码落点

- `src/games/smashup/abilities/ancient_incas.ts`
  - 新增古代印加人 ability、trigger、interaction handler、base power modifier、breakpoint modifier、base ability 注册。
- `src/games/smashup/abilities/index.ts`
  - 接入 `registerAncientIncasAbilities()` 与 `registerAncientIncasInteractionHandlers()`。
- `src/games/smashup/__tests__/abilities/ancient-incas.test.ts`
  - 当前通过 18 条古代印加人 L2 行为 / 注册 / 静态合同测试；覆盖皇家公路双向候选、跳过、同基地排除、他人行动排除与持续移动收口，萨帕·印加检索候选与未选牌区保持，以及防护墙目标过滤和金色秃鹰逐张强制出牌。
- `src/games/smashup/__tests__/ancient-incas-ashlar-masonry.test.ts`
  - 新增方石砌体完整计分后链路测试：响应窗口、选择回手、其余行动入牌库、延迟清场与基地替换。
- `e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts`
  - 当前覆盖 10 条真实入口 E2E：派系选择、结绳文字、金色秃鹰、方石砌体、皇家公路、萨帕·印加、防护墙，以及星星上的征兆三条对象级生命周期链。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/ancient-incas.test.ts --configLoader native` | PASS，18 tests |
| `npx vitest run src/games/smashup/__tests__/ancient-incas-ashlar-masonry.test.ts --reporter=verbose` | PASS，1 test；方石砌体完整计分后管线 |
| `npx vitest run src/games/smashup/__tests__/abilities/ancient-incas.test.ts src/games/smashup/__tests__/ancient-incas-ashlar-masonry.test.ts src/games/smashup/__tests__/scoreBases-deferred-finalization.test.ts src/games/smashup/__tests__/scoreBases-clear-discard-triggers.test.ts --reporter=dot` | PASS，4 files / 36 tests |
| `baseAbilities.test.ts`、`reactionQueueBaseAbilities.test.ts`、`baseAbilityIntegration.test.ts`、`ongoingEffects.test.ts` | PASS，4 files / 96 tests，共享基地能力回归通过 |
| `npx tsc --noEmit --pretty false` | PASS |
| `npx vitest run src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts --configLoader native` | PASS，6 tests |
| `npx openspec validate add-smashup-culture-shock-four-factions --strict --no-interactive` | PASS |
| Ancient Incas E2E defId precheck via `npx tsx -` | PASS，卡牌 / 基地 defId 均存在 |
| `node scripts/infra/run-e2e-command.mjs isolated e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts "星星上的征兆"` | PASS，10 tests；包含派系选择、结绳文字、金色秃鹰、方石砌体、皇家公路、萨帕·印加、防护墙，以及星星上的征兆三条真实生命周期链 |

备注：首次古代印加人 E2E 中，真实状态已经结算正确，但测试尝试用 `data-card-uid="temple"` 查找基地 ongoing 行动 DOM；当前 UI 不对基地 ongoing 行动暴露该锚点，因此已改为权威状态断言 + 截图证据。

## L3/L4 截图证据

- 派系选择图集可见：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/派系选择页能看到古代印加人，并加载文化冲击图集/01-古代印加人-派系选择页图集可见.jpg`
- `结绳文字` 真实入口触发前：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地/02-结绳文字-触发前.jpg`
- `结绳文字` 弃牌堆行动 / 目标基地 prompt：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地/03-结绳文字-选择弃牌堆行动和目标基地.jpg`
- `结绳文字` 结算后权威状态：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地/04-结绳文字-太阳神庙附着并抽牌后.jpg`
- `方石砌体` 计分后选择回手行动：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/方石砌体在计分后响应窗口回手一张行动，其余行动进入牌库并完成清场换基地/09-方石砌体-计分后选择回手行动.jpg`
- `方石砌体` 清场换基地后收口：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/方石砌体在计分后响应窗口回手一张行动，其余行动进入牌库并完成清场换基地/10-方石砌体-清场换基地后收口.jpg`
- `皇家公路` 打出时双向移动候选：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/皇家公路真实入口覆盖打出时双向移动与其它基地行动后的持续触发/11-皇家公路-打出时双向移动候选.jpg`
- `皇家公路` 其它基地行动后的持续移动候选：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/皇家公路真实入口覆盖打出时双向移动与其它基地行动后的持续触发/12-皇家公路-其它基地行动后的移动候选.jpg`
- `皇家公路` 双向移动与持续触发收口：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/皇家公路真实入口覆盖打出时双向移动与其它基地行动后的持续触发/13-皇家公路-双向移动与持续触发收口.jpg`
- `萨帕·印加` 牌库与弃牌堆检索候选：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/萨帕·印加真实入口覆盖牌库弃牌堆检索与行动后指示物/14-萨帕·印加-牌库与弃牌堆检索候选.jpg`
- `萨帕·印加` 行动后指示物收口：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/萨帕·印加真实入口覆盖牌库弃牌堆检索与行动后指示物/15-萨帕·印加-行动后指示物收口.jpg`
- `防护墙` 打出时选择己方随从：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/防护墙真实入口覆盖打出时与其它行动后的两次指示物选择/16-防护墙-打出时选择己方随从.jpg`
- `防护墙` 其它行动后的可选指示物：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/防护墙真实入口覆盖打出时与其它行动后的两次指示物选择/17-防护墙-其它行动后的可选指示物.jpg`
- `防护墙` 两次指示物结算收口：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/防护墙真实入口覆盖打出时与其它行动后的两次指示物选择/18-防护墙-两次指示物结算收口.jpg`
- `星星上的征兆` 打出后复制马丘比丘：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/星星上的征兆真实打出复制牌库顶基地能力，天赋后仍保留原基地能力并切换额外来源/19-星星上的征兆-打出后复制马丘比丘.jpg`
- `星星上的征兆` 天赋后牌库顶切换：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/星星上的征兆真实打出复制牌库顶基地能力，天赋后仍保留原基地能力并切换额外来源/20-星星上的征兆-天赋后牌库顶翻转.jpg`
- `星星上的征兆` 换顶后原基地能力仍保留：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/星星上的征兆真实打出复制牌库顶基地能力，天赋后仍保留原基地能力并切换额外来源/21-星星上的征兆-换顶后保留原基地能力.jpg`
- `星星上的征兆` 回合开始翻面选择：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/星星上的征兆在每名玩家回合开始可翻面，下一回合恢复/22-星星上的征兆-回合开始翻面选择.jpg`
- `星星上的征兆` 下一回合恢复：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/星星上的征兆在每名玩家回合开始可翻面，下一回合恢复/23-星星上的征兆-下一回合恢复并再次出现选择.jpg`
- `星星上的征兆` 基地清场后离场：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/星星上的征兆随基地清场离场后不再残留/24-星星上的征兆-基地清场后能力离场.jpg`

## 当前边界与历史残余

- 已补代表性 L3/L4 E2E 文件：`e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts`。
- 当前古代印加人已登记的对象级残余已清零；本轮不把该结论外推到阿南西传说、格林童话或俄罗斯童话。
- `金色秃鹰`已通过多段真实 UI 序列：多选回手行动、逐张强制选择当前绑定行动、逐张选择目标基地、禁止跳过、第二张结算后交互关闭；旧的“只授予等量额度”残余结论失效。
- `方石砌体`已通过计分后响应窗口、`CARD_TRANSFERRED`、`CARD_TO_DECK_BOTTOM`、`DECK_REORDERED`、`BASE_CLEARED`、`BASE_REPLACED` 和交互关闭的对象级证据；这只收口方石砌体，不替代其它对象审计。
- `星星上的征兆`的动态基地能力继承、天赋换顶、回合开始翻面、下一回合恢复、清场离场和无效触发拒绝路径已由本轮领域 / 共享回归 / 三条真实入口 E2E 对账；旧“对象级残余”结论失效。
- 萨帕·印加首次 E2E 失败来自测试夹具使用马丘比丘后漏算基地的额外抽牌；事件流显示萨帕检索本身正确，已改用库斯科隔离对象链并通过 6/6 全文件回归，不属于运行时规则缺陷。
- 本轮首次皇家公路 E2E 的失败只来自测试对基地内随从顺序的过窄断言；运行时已产生两次正确移动，断言已改为集合校验，不属于规则实现缺陷。
- 文化冲击资源远端链路仍 blocked：R2 凭据不可用，代表 CDN URL 仍未取得 `HEAD 200`。
