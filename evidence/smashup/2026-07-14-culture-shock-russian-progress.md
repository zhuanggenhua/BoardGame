# 文化冲击四派系 - 俄罗斯童话阶段进展（2026-07-14）

## 当前结论

- 俄罗斯童话（`russian_fairy_tales`）本轮已完成代表性玩法实现、L2 领域行为测试、Culture Shock 批次集成校验、OpenSpec 严格校验和代表性 L3/L4 真实入口 E2E。
- 当前结论等级：**代表性玩法已验证**。这证明俄罗斯童话关键交互链路已经可从真实入口进入并落到权威状态，但不能声明文化冲击四派系整体完成。
- 本轮 E2E 覆盖：派系选择页可见并加载文化冲击图集；`变化` 从真实打牌入口选择场上随从，将其放到拥有者牌库底，并从牌库变出新随从到原基地。
- 文化冲击卡牌与复用基地资源仍沿用前序 blocker：本地压缩产物和 manifest 已存在，但 R2/CDN 上传与 `HEAD 200` 仍 blocked，不能声明远端资源链路完成。

## 本轮实现补齐

| 对象 | 规则子句 | 当前处理 | 证据 |
| --- | --- | --- | --- |
| 变化 | 选择任意随从放到拥有者牌库底；从该拥有者牌库顶展示直到出现随从并打到原基地，其余洗回 | 新增随从选择 prompt；用 `CARD_TO_DECK_BOTTOM`、`REVEAL_DECK_TOP`、`MINION_PLAYED fromDeck`、`DECK_REORDERED` 落权威状态 | `变化将任意随从放到拥有者牌库底，并让其从牌库顶变出随从到原基地`；E2E `变化可从真实打牌入口将场上随从变形成牌库随从` |
| 芭芭雅嘎 | 天赋选择同基地另一个随从变形 | 复用 `变化` 的变形 helper 与交互续算；目标限定为同基地其他随从 | 注册合同测试 |
| 青蛙公主 | 附着宿主天赋：变形宿主，并把青蛙公主转移到新随从，保留已用天赋 | 变形后用中间状态生成 `ONGOING_ATTACHED`，避免新随从尚未入场时语义校验过滤重挂事件 | `青蛙公主天赋替换宿主后，会把自身转移到新随从且保留已用天赋状态` |
| 生命之水 | 弃牌堆随从放牌库顶，并获得额外行动 | 新增弃牌堆随从 prompt；成功后发 `CARD_TO_DECK_TOP` 与 contextual extra action | `生命之水把弃牌堆随从放到牌库顶并授予额外行动` |
| 我不知道要拿什么 | 展示到两张行动；可拿任意数量行动进手，其余洗回 | 新增展示、行动多选入手与剩余牌库重排 | `我不知道要拿什么展示到两张行动，并可只把选择的行动加入手牌后洗回其余牌` |
| 我不知道能去何处 | 选择基地；每个其他玩家随机一个该基地随从洗入拥有者牌库 | 新增基地目标处理与随机目标收集，使用拥有者牌库重排 | 注册合同测试 |
| 去看看我妹妹 | 己方随从打出或移动到附着基地后抽 1 | 新增 `onMinionPlayed` / `onMinionMoved` 可选触发；按附着基地和控制者过滤 | `去看看我妹妹在己方随从打出到附着基地后可抽一张牌` |
| 着魔 | 附着宿主 +2；宿主离场时转移到另一个随从 | 新增基础版专属 power modifier，避免 POD alias 二次计入；离场后通过反应队列 prompt 重新附着 | `着魔为宿主 +2，并在宿主回手离场后转移到另一个随从` |
| 白桦木女神 / 白桦木 | 一方离场或回合开始可检索另一方，加入手牌或额外打出 | 新增互相检索 prompt，覆盖手牌 / 牌库 / 弃牌堆来源 | 注册合同测试 |
| 沙皇之鹰 | 抽 1 或把另一玩家弃牌堆随从放其牌库顶 | 新增模式 prompt 和对手弃牌候选处理 | 注册合同测试 |
| 灰色之狼 | 天赋：放到牌库顶，额外打出手牌随从并给 +1 指示物 | 新增手牌随从 prompt、牌库顶回收、额外打出与 `POWER_COUNTER_ADDED` | 注册合同测试 |
| 愚蠢的魔术师 | 抽 3 后把 3 张手牌放到牌库顶或底 | 新增抽牌与 top/bottom 多选续算 | 注册合同测试 |
| 蟾蜍 | 可给另一玩家控制，并洗回该玩家这里另一个随从 | 新增目标玩家 / 目标随从处理与控制权变化 | 注册合同测试 |
| 弥撒变化 | 每位玩家手牌洗入牌库底，再抽同数量 | 新增逐玩家 `HAND_SHUFFLED_INTO_DECK` 与抽牌事件 | 注册合同测试 |
| 芬尼斯特猎鹰 | 计分前若不在计分基地则移动过去；若已在则回手并额外打到其他基地 | 新增 beforeScoring special、跨基地移动、已在计分基地时的目的基地 prompt | `芬尼斯特猎鹰计分前可从其他基地移动到计分基地` |
| 变形之泉 | 每位玩家每回合一次，打出随从后可将该随从变形 | 新增基地 `onMinionPlayed` 可选触发，并写 `transformationSpringUsedTurn_<playerId>` metadata | `变形之泉在随从打出后可把该随从变形成牌库顶随从，并记录每回合一次` |
| 巨型芜菁 | 每有一个随从，临界点 -1 | 新增 custom breakpoint modifier | `巨型芜菁每有一个随从降低 1 临界点` |

## 本轮代码落点

- `src/games/smashup/abilities/russian_fairy_tales.ts`
  - 新增俄罗斯童话 ability、trigger、interaction handler、power modifier、base ability 注册。
- `src/games/smashup/abilities/index.ts`
  - 接入 `registerRussianFairyTalesAbilities()` 与 `registerRussianFairyTalesInteractionHandlers()`。
- `src/games/smashup/data/factions/russian_fairy_tales.ts`
  - 修正 `芬尼斯特猎鹰` 中文名，并补 special activation metadata。
- `src/games/smashup/__tests__/abilities/russian-fairy-tales.test.ts`
  - 新增 11 条俄罗斯童话 L2 行为 / 注册 / 静态合同测试。
- `e2e/smashup/smashup-culture-shock-russian.e2e.ts`
  - 新增俄罗斯童话派系选择与 `变化` 真实入口 L3/L4 E2E。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/russian-fairy-tales.test.ts --configLoader native` | PASS，11 tests |
| `npx tsc --noEmit --pretty false` | PASS |
| `npx vitest run src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts --configLoader native` | PASS，6 tests |
| `npx openspec validate add-smashup-culture-shock-four-factions --strict --no-interactive` | PASS |
| Russian E2E defId precheck via `npx tsx -` | PASS，卡牌 / 基地 / faction defId 均存在 |
| `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-culture-shock-russian.e2e.ts` | PASS，2 tests |

备注：裸 `npx playwright test e2e/smashup/smashup-culture-shock-russian.e2e.ts` 被项目 globalSetup 正常拦截，随后已改用标准入口 `node scripts/infra/run-e2e-command.mjs ci ...` 完成验证。

## L3/L4 截图证据

- 派系选择图集可见：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/派系选择页能看到俄罗斯童话，并加载文化冲击图集/01-俄罗斯童话-派系选择页图集可见.jpg`
- `变化` 真实入口触发前：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/变化可从真实打牌入口将场上随从变形成牌库随从/02-变化-触发前.jpg`
- `变化` 目标选择 prompt：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/变化可从真实打牌入口将场上随从变形成牌库随从/03-变化-选择要变形的随从.jpg`
- `变化` 结算后权威状态：`D:/GA/BoardGame-upstream-main-dev-20260601/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/变化可从真实打牌入口将场上随从变形成牌库随从/04-变化-白桦木变形结算后.jpg`

## 仍未实现 / 不得误报完成

- 已补代表性 L3/L4 E2E 文件：`e2e/smashup/smashup-culture-shock-russian.e2e.ts`。
- 当前 E2E 只覆盖俄罗斯童话的代表性真实入口链路；青蛙公主、着魔、变形之泉、芬尼斯特猎鹰等仍可继续补对象级 L3/L4 拒绝路径或特殊窗口证据。
- 文化冲击四派系尚未整体完成：古代印加人仍未进入实现闭环。
- 文化冲击资源远端链路仍 blocked：R2 凭据不可用，代表 CDN URL 仍未取得 `HEAD 200`。
