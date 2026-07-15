# 文化冲击四派系 - 古代印加人阶段进展（2026-07-14）

## 当前结论

- 古代印加人（`ancient_incas`）本轮已完成代表性玩法实现、L2 领域行为测试、Culture Shock 批次集成校验、OpenSpec 严格校验和代表性 L3/L4 真实入口 E2E。
- 当前结论等级：**代表性玩法已验证**。这证明古代印加人核心“基地附着行动 / 从弃牌堆额外打出行动 / 行动后触发 / 基地断点与抽牌”链路已经可从真实入口进入并落到权威状态，但不能声明为对象级全量审计完成。
- 本轮 E2E 覆盖：派系选择页可见并加载文化冲击图集；`结绳文字` 从真实打牌入口选择弃牌堆里的 `太阳神庙`，将其作为额外行动打到 `库斯科`，最终状态显示 `太阳神庙` 已成为基地 ongoing，`结绳文字` 进弃牌堆，且 `太阳神庙` 入场抽牌已结算。
- 文化冲击卡牌与复用基地资源仍沿用前序 blocker：本地压缩产物和 manifest 已存在，但 R2/CDN 上传与 `HEAD 200` 仍 blocked，不能声明远端资源链路完成。

## 本轮实现补齐

| 对象 | 规则子句 | 当前处理 | 证据 |
| --- | --- | --- | --- |
| 结绳文字 | 从弃牌堆选择一个可打到基地的行动，并作为额外行动打出 | 新增弃牌堆行动目标 prompt；发 `ACTION_PLAYED fromDiscard isExtraAction`，对 ongoing 基地行动发 `ONGOING_ATTACHED`，并继续执行该行动 onPlay | `结绳文字从弃牌堆额外打出太阳神庙到基地，并结算太阳神庙抽牌`；E2E `结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地` |
| 太阳神庙 | 打到基地时抽 1；此后你在该基地打出另一个行动后可抽 1 | onPlay 用标准抽牌事件；ongoing 使用 `onActionPlayed` 可选 trigger，并通过 `canTrigger` 排除自触发 | `太阳神庙在己方打出另一个行动到同基地后可抽一张牌` |
| 印加工程师 | 展示牌库直到出现可打到基地的行动，将其加入手牌，其余洗回 | 发 `REVEAL_DECK_TOP` / `DECK_INSPECTED`，选中行动用 `CARD_TRANSFERRED` 入手，其余 `DECK_REORDERED` | `印加工程师展示到第一张可打到基地的行动，将其加入手牌并洗回其余牌` |
| 萨帕·印加 | 从牌库 / 弃牌堆检索可打到基地的行动加入手牌；之后你打出行动到基地后在该基地己方随从上放 +1 | 新增检索 prompt 与 `CARD_TRANSFERRED`；ongoing trigger 在行动目标基地上选择己方随从放 `POWER_COUNTER_ADDED` | `萨帕·印加在己方行动打到基地后给该基地己方随从放置指示物` |
| 防护墙 | 打到基地时给这里一个己方随从 +1；之后你在该基地打出另一个行动后可再给 +1 | onPlay / ongoing trigger 复用 counter prompt；ongoing trigger 排除自身刚打出时的自触发 | 注册合同测试；counter prompt 覆盖在 L2 中 |
| 皇家公路 | 打到基地时可将己方随从移入 / 移出此基地；之后你在其他基地打出行动后可在此基地和该基地之间移动己方随从 | 新增双向移动候选和 move prompt；用 `buildValidatedMoveEvents` 落权威状态 | `皇家公路打出时可把其它基地的己方随从移到这里` |
| 美洲驼 | 可将其它基地的己方行动返回手牌并作为额外行动打到这里 | 新增其它基地己方 ongoing 行动选择；先 `CARD_TRANSFERRED` 回手，再复用额外打出基地行动链 | 注册合同测试 |
| 金色秃鹰 | 返回任意数量基地上的己方行动，并应逐张作为额外行动打出 | 当前实现返回所选行动并授予等量额外行动额度；强制逐张打出顺序未做专用多段 UI | 注册合同测试；残余见下 |
| 方石砌体 | 计分后可将该基地一个己方行动回手，其余洗回牌库而非弃置 | 当前实现可从计分基地选择己方行动回手，并将其余己方行动放入牌库底 / 重排；与计分清理替代时机的深层集成仍未宣称完成 | 注册合同测试；残余见下 |
| 军械库 | 你在该基地每有其它一个行动，己方在此总力量 +2 | 新增 base power modifier；按同基地同控制者其它 ongoing 行动计数 | `军械库按同基地其它己方行动提供力量，库斯科每有一个行动降低 3 临界点` |
| 星星上的征兆 | 展示基地牌库顶；天赋把基地牌库顶放底；展示期间复制该基地能力 | 当前实现展示顶牌到基地 metadata，天赋将基地牌库顶移到底；复制基地能力未做通用组合 | 注册合同测试；残余见下 |
| 库斯科 | 此基地每有一个行动，临界点 -3 | 新增 custom breakpoint modifier，统计基地 ongoing 与随从附着行动 | `军械库按同基地其它己方行动提供力量，库斯科每有一个行动降低 3 临界点` |
| 马丘比丘 | 有玩家打出行动到此基地后，该玩家抽 1 | 新增 base `onActionPlayed` 能力，按行动目标基地过滤并标准抽牌 | `马丘比丘在行动打到此基地后让打出者抽一张牌` |

## 本轮代码落点

- `src/games/smashup/abilities/ancient_incas.ts`
  - 新增古代印加人 ability、trigger、interaction handler、base power modifier、breakpoint modifier、base ability 注册。
- `src/games/smashup/abilities/index.ts`
  - 接入 `registerAncientIncasAbilities()` 与 `registerAncientIncasInteractionHandlers()`。
- `src/games/smashup/__tests__/abilities/ancient-incas.test.ts`
  - 新增 9 条古代印加人 L2 行为 / 注册 / 静态合同测试。
- `e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts`
  - 新增古代印加人派系选择与 `结绳文字` 真实入口 L3/L4 E2E。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/ancient-incas.test.ts --configLoader native` | PASS，9 tests |
| `npx tsc --noEmit --pretty false` | PASS |
| `npx vitest run src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts --configLoader native` | PASS，6 tests |
| `npx openspec validate add-smashup-culture-shock-four-factions --strict --no-interactive` | PASS |
| Ancient Incas E2E defId precheck via `npx tsx -` | PASS，卡牌 / 基地 defId 均存在 |
| `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts` | PASS，2 tests |

备注：首次古代印加人 E2E 中，真实状态已经结算正确，但测试尝试用 `data-card-uid="temple"` 查找基地 ongoing 行动 DOM；当前 UI 不对基地 ongoing 行动暴露该锚点，因此已改为权威状态断言 + 截图证据。

## L3/L4 截图证据

- 派系选择图集可见：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/派系选择页能看到古代印加人，并加载文化冲击图集/01-古代印加人-派系选择页图集可见.jpg`
- `结绳文字` 真实入口触发前：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地/02-结绳文字-触发前.jpg`
- `结绳文字` 弃牌堆行动 / 目标基地 prompt：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地/03-结绳文字-选择弃牌堆行动和目标基地.jpg`
- `结绳文字` 结算后权威状态：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-ancient-incas.e2e/结绳文字可从真实打牌入口把太阳神庙从弃牌堆额外打到基地/04-结绳文字-太阳神庙附着并抽牌后.jpg`

## 仍未实现 / 不得误报完成

- 已补代表性 L3/L4 E2E 文件：`e2e/smashup/smashup-culture-shock-ancient-incas.e2e.ts`。
- 当前 E2E 只覆盖古代印加人的代表性真实入口链路；`萨帕·印加`、`皇家公路`、`防护墙`、`方石砌体`、`金色秃鹰`、`星星上的征兆`仍可继续补对象级 L3/L4 和拒绝路径证据。
- `金色秃鹰`当前未强制“每张回手行动必须逐张作为额外行动打出”的多段 UI 序列，只授予等量额外行动额度。
- `方石砌体`当前未与基地计分清理 pipeline 做完整替代结算证据，不能声明 afterScoring replacement 全链路已完成。
- `星星上的征兆`当前未实现“当前基地也具有翻开基地能力”的通用能力组合，只实现展示 metadata 与天赋移底。
- 文化冲击资源远端链路仍 blocked：R2 凭据不可用，代表 CDN URL 仍未取得 `HEAD 200`。
