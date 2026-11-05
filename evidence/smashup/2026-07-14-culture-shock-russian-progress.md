# 文化冲击四派系 - 俄罗斯童话阶段进展（2026-07-14）

## 2026-09-19 当前审计回写

- 俄罗斯童话当前证据仍是 `representative_only / in_progress`：27 条领域测试与 6/6 真实入口通过，已覆盖 18 个对象的 L2 行为合同，并为芬尼斯特猎鹰、青蛙公主、着魔补上对象级真实入口；仍没有把代表链外推为全部对象 direct L3/L4。
- 该结论只回写当前审计边界，不覆盖其它派系；四派系批次状态由 `2026-09-18-culture-shock-four-factions-audit.md` 汇总。

## 当前结论

- 俄罗斯童话（`russian_fairy_tales`）本轮已完成代表性玩法实现、L2 领域行为测试、Culture Shock 批次集成校验、OpenSpec 严格校验和代表性 L3/L4 真实入口 E2E。
- 当前结论等级：**代表性玩法已验证**。这证明俄罗斯童话关键交互链路已经可从真实入口进入并落到权威状态，但不能声明文化冲击四派系整体完成。
- 本轮 E2E 覆盖：派系选择页可见并加载文化冲击图集；`变化` 从真实打牌入口选择场上随从，将其放到拥有者牌库底，并从牌库变出新随从到原基地；`弥撒变化` 在真实借牌场景下按真实拥有者归还牌库、按原手牌数抽回并完成弃牌 / 交互收口；芬尼斯特借控时回当前控制者手牌后额外打出；青蛙公主在借控宿主上变形并把附着行动转移到替身；着魔从真实附着入口确认宿主 +2，宿主摧毁离场后把行动转移到另一基地的随从。
- 本轮审计修复了三处规则实现缺陷：变形链结算后没有按卡面洗牌；愚蠢的魔术师会把原有手牌混入整理范围；弥撒变化把手牌随机洗入牌库而非放到牌库底。随后真实入口又命中并修复第四处缺陷：行动卡的 `onPlay` 执行时源行动卡仍在手牌中，弥撒变化会把它误纳入置底和抽牌范围；同时补齐借来牌回真实拥有者牌库的状态链。继续按卡面逐张审计后，又修复三处控制者 / 拥有者混用：生命之水、沙皇之鹰和愚蠢的魔术师现在分别按“当前玩家 / 目标玩家 / 当前玩家”的卡面语义落牌库。新增芬尼斯特借控真实入口后，又发现其回手事件错误使用 `source.owner`，导致借来的芬尼斯特回到拥有者手牌，而后续额外打出却从当前控制者手牌取牌；现已改为回到当前控制者手牌，同时额外打出保留真实 owner。另修复派系选择 E2E 直接依赖虚拟列表首屏 DOM 的不稳定定位，改为使用真实搜索入口。
- 文化冲击卡牌与复用基地资源仍沿用前序 blocker：本地压缩产物和 manifest 已存在，但 R2/CDN 上传与 `HEAD 200` 仍 blocked，不能声明远端资源链路完成。

## 本轮实现补齐

| 对象 | 规则子句 | 当前处理 | 证据 |
| --- | --- | --- | --- |
| 变化 | 选择任意随从放到拥有者牌库底；从该拥有者牌库顶展示直到出现随从并打到原基地，其余洗回 | 新增随从选择 prompt；用 `CARD_TO_DECK_BOTTOM`、`REVEAL_DECK_TOP`、`MINION_PLAYED fromDeck`、`DECK_REORDERED` 落权威状态 | `变化将任意随从放到拥有者牌库底，并让其从牌库顶变出随从到原基地`；E2E `变化可从真实打牌入口将场上随从变形成牌库随从` |
| 芭芭雅嘎 | 天赋选择同基地另一个随从变形 | 复用 `变化` 的变形 helper 与交互续算；目标限定为同基地其他随从；补齐变形后洗牌 | `芭芭雅嘎替换后会洗牌目标拥有者的牌库` |
| 青蛙公主 | 附着宿主天赋：变形宿主，并把青蛙公主转移到新随从，保留已用天赋 | 变形后用中间状态生成 `ONGOING_ATTACHED`，避免新随从尚未入场时语义校验过滤重挂事件 | `青蛙公主天赋替换宿主后，会把自身转移到新随从且保留已用天赋状态` |
| 生命之水 | 将你弃牌堆中的一个随从放到你的牌库顶，并获得额外行动 | 新增弃牌堆随从 prompt；成功后把牌从当前玩家弃牌堆放到当前玩家牌库顶，再发 contextual extra action；借来牌保留原 owner 但不改变目标牌库 | `生命之水把弃牌堆随从放到牌库顶并授予额外行动`；`生命之水处理借来的弃牌堆随从时，按卡面放回当前玩家牌库顶` |
| 我不知道要拿什么 | 展示到两张行动；可拿任意数量行动进手，其余洗回 | 新增展示、行动多选入手与剩余牌库重排 | `我不知道要拿什么展示到两张行动，并可只把选择的行动加入手牌后洗回其余牌` |
| 我不知道能去何处 | 选择基地；每个其他玩家随机一个该基地随从洗入拥有者牌库 | 新增基地目标处理与随机目标收集，使用拥有者牌库重排 | `我不知道能去何处会为每个其他玩家随机洗回该基地的一个随从` |
| 去看看我妹妹 | 己方随从打出或移动到附着基地后抽 1 | 新增 `onMinionPlayed` / `onMinionMoved` 可选触发；按附着基地和控制者过滤 | `去看看我妹妹在己方随从打出到附着基地后可抽一张牌` |
| 着魔 | 附着宿主 +2；宿主离场时转移到另一个随从 | 新增基础版专属 power modifier，避免 POD alias 二次计入；离场后通过反应队列 prompt 重新附着 | `着魔为宿主 +2，并在宿主回手离场后转移到另一个随从` |
| 白桦木女神 / 白桦木 | 一方离场或回合开始可检索另一方，加入手牌或额外打出 | 新增互相检索 prompt，覆盖手牌 / 牌库 / 弃牌堆来源 | `白桦木女神响应提交后可寻找白桦木进入手牌`；`白桦木在拥有者回合开始可自毁，并把白桦木女神作为额外随从打到原基地` |
| 沙皇之鹰 | 抽 1 或把另一玩家弃牌堆随从放其牌库顶 | 新增模式 prompt 和对手弃牌候选处理；目标牌库按被选弃牌堆所属玩家确定，不按卡牌 owner 改写目标 | `沙皇之鹰既能把对手弃牌堆随从放到其牌库顶，也能选择抽牌`；`沙皇之鹰处理借来的对手弃牌堆随从时，按卡面放入该对手牌库顶` |
| 灰色之狼 | 天赋：放到牌库顶，额外打出手牌随从并给 +1 指示物 | 新增手牌随从 prompt、牌库顶回收、额外打出与 `POWER_COUNTER_ADDED` | `灰色之狼会回到牌库顶，并把手牌随从作为额外随从打到原基地并放置 +1 指示物` |
| 愚蠢的魔术师 | 抽 3 后把本次抽出的 3 张牌以任意顺序放到你的牌库顶或底 | 新增抽牌与 top/bottom 多选续算；限制整理范围为本次抽牌结果，并按当前玩家牌库处理借来牌 | `愚蠢的魔术师只整理本次抽出的三张牌，不会把原有手牌混入选择`；`愚蠢的魔术师整理借来的抽牌时，按卡面放回当前玩家牌库` |
| 蟾蜍 | 可给另一玩家控制，并洗回该玩家这里另一个随从 | 新增目标玩家 / 目标随从处理与控制权变化 | `蟾蜍交给对手后，会把对手在此的另一个随从洗入其拥有者牌库` |
| 弥撒变化 | 每位玩家手牌放到牌库底，再抽同数量 | 排除正在执行的源行动卡；逐张把其余手牌放到真实拥有者牌库底，再按每位玩家的有效手牌数抽回，保持原牌库在前、手牌在底 | `弥撒变化把每名玩家手牌放到牌库底后，再抽回同等数量的牌`；`弥撒变化在借来的手牌场景下按真实拥有者归还牌库`；真实入口 E2E `弥撒变化在真实入口下按真实拥有者归还借来牌并让双方按原手牌数抽回` |
| 芬尼斯特猎鹰 | 计分前若不在计分基地则移动过去；若已在则回手并额外打到其他基地 | 新增 beforeScoring special、跨基地移动、已在计分基地时的目的基地 prompt | `芬尼斯特猎鹰计分前可从其他基地移动到计分基地`；`芬尼斯特猎鹰已在计分基地时可回手并作为额外随从打到另一个基地` |
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
  - 现为 27 条俄罗斯童话 L2 行为 / 注册 / 静态合同测试，覆盖 18 个对象和关键双分支 / 生命周期；新增借来手牌 owner provenance、源行动卡时序、三张“你的 / 其牌库”卡面的归属回归，以及借控芬尼斯特回手 / 额外打出回归。
- `e2e/smashup/smashup-culture-shock-russian.e2e.ts`
  - 现有俄罗斯童话派系选择、`变化`、`弥撒变化`、借控芬尼斯特计分前特殊、借控宿主上的青蛙公主和着魔宿主离场转移六条真实入口 L3/L4 E2E；派系选择改为真实搜索入口，基地选择使用明确的 `baseIndex` 谓词。

## 新增 finding：芬尼斯特借控时回手对象错误

- 原始规则语义：卡面写的是“返回你的手牌”，这里的“你”是当前控制芬尼斯特的玩家；随后额外打出仍由当前控制者执行，但随从的真实 `owner` 不应被改写。
- 复现入口：`e2e/smashup/smashup-culture-shock-russian.e2e.ts` 的借控计分前特殊场景，玩家 0 控制、玩家 1 拥有芬尼斯特。
- 直接原因：回手事件把目标玩家写成 `source.owner`，而额外打出阶段按当前 `playerId` 从手牌消费；因此借来的芬尼斯特进入玩家 1 手牌，玩家 0 后续找不到它，表现为随从离场但不能落到选择的目标基地。
- 修复：回手目标改为当前控制者 `playerId`；额外打出仍由当前控制者执行，并保留卡牌原始 `owner`。
- 验证：领域测试新增 1 条，俄罗斯童话领域测试为 27/27；真实入口升至 5/5，覆盖触发前、目标基地选择、回手后额外打出和最终 owner/controller 状态。

## 新增对象级审计：青蛙公主借控宿主转移

- 原始规则语义：青蛙公主附着在一个随从上；天赋变形该宿主后，青蛙公主必须转移到变形后的新随从，并保持天赋已使用状态。
- 复现入口：`e2e/smashup/smashup-culture-shock-russian.e2e.ts` 的真实打牌场景，玩家 0 控制、玩家 1 拥有宿主，青蛙公主由玩家 0 打出并附着到借来的宿主。
- 直接验证：真实入口先完成附着，再从附着行动入口触发天赋；替身从当前控制者牌库打出，原宿主回到真实拥有者牌库，青蛙公主附着到替身且 `talentUsed = true`，最终交互关闭。
- 初次失败裁定：第一次测试使用“沙皇之鹰”作为牌库替身；替身打出后合法打开自身 `onPlay` 选择交互，测试错误地等待“无交互”。这属于测试替身触发了合法卡面能力，不是青蛙公主运行时缺陷；改用无 `onPlay` 的“白桦木”后，产品链路通过。
- 验证：`npm run test:e2e:ci:file -- smashup-culture-shock-russian.e2e.ts` 通过 5/5；截图 `10-青蛙公主-借来宿主附着前.jpg`、`11-青蛙公主-借来宿主附着后.jpg`、`12-青蛙公主-宿主回拥有者牌库并转移行动后.jpg` 分别证明附着前、附着后和最终权威状态。

## 对象级审计：着魔宿主离场转移

- 原始规则语义：将行动打在一个随从上，宿主获得 +2 力量；宿主离场时，必须把这张行动转移到另一个随从上。
- 真实入口：玩家 0 从手牌把俄罗斯童话的 `着魔` 打到玩家 1 拥有的宿主，再用真实的“刺杀”摧毁宿主，进入 `russian_fairy_tales_bewitched_transfer` 转移选择。
- 最终状态：宿主从场上消失；玩家 0 选择第二基地的另一个随从后，着魔行动保持原 UID 重新附着，未进入玩家 0 弃牌堆，交互关闭。
- 生命周期核对：附着后的 +2、宿主离场触发、候选排除原宿主、跨基地候选、重新附着和一次性收口均由同一真实入口逐段证明；初次失败只是测试卡牌放大层未关闭，修正测试关闭动作后通过，不是规则运行时缺陷。
- 验证：`npm run test:e2e:ci:file -- smashup-culture-shock-russian.e2e.ts 着魔` 通过 1/1；四张截图分别记录附着前、+2 后、转移选择和最终重新附着。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/russian-fairy-tales.test.ts --configLoader native` | PASS，27 tests |
| `npx tsc --noEmit --pretty false --noErrorTruncation` | PASS |
| `npx vitest run src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts --configLoader native` | PASS，6 tests |
| `npx vitest run src/games/smashup/__tests__/triggerCanTriggerAlignment.test.ts --configLoader native` | PASS，14 tests |
| `npx openspec validate add-smashup-culture-shock-four-factions --strict --no-interactive` | PASS |
| Russian E2E defId precheck via `npx tsx -` | PASS，卡牌 / 基地 / faction defId 均存在 |
| `npm run test:e2e:ci:file -- smashup-culture-shock-russian.e2e.ts` | PASS，6 tests |

备注：裸 `npx playwright test e2e/smashup/smashup-culture-shock-russian.e2e.ts` 被项目 globalSetup 正常拦截，随后已改用标准入口 `node scripts/infra/run-e2e-command.mjs ci ...` 完成验证。

## L3/L4 截图证据

- 派系选择图集可见：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/派系选择页能看到俄罗斯童话，并加载文化冲击图集/01-俄罗斯童话-派系选择页图集可见.jpg`
- `变化` 真实入口触发前：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/变化可从真实打牌入口将场上随从变形成牌库随从/02-变化-触发前.jpg`
- `变化` 目标选择 prompt：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/变化可从真实打牌入口将场上随从变形成牌库随从/03-变化-选择要变形的随从.jpg`
- `变化` 结算后权威状态：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/变化可从真实打牌入口将场上随从变形成牌库随从/04-变化-白桦木变形结算后.jpg`
- `弥撒变化` 借来手牌触发前：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/弥撒变化在真实入口下按真实拥有者归还借来牌并让双方按原手牌数抽回/05-弥撒变化-借来手牌触发前.jpg`
- `弥撒变化` 结算后权威状态：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/弥撒变化在真实入口下按真实拥有者归还借来牌并让双方按原手牌数抽回/06-弥撒变化-借来牌归还真实拥有者并抽回.jpg`
- 芬尼斯特借控计分前触发：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/芬尼斯特猎鹰被借来控制时，真实计分前特殊入口仍回到控制者手牌并额外打出/07-芬尼斯特-借控计分前触发.jpg`
- 芬尼斯特基地选择：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/芬尼斯特猎鹰被借来控制时，真实计分前特殊入口仍回到控制者手牌并额外打出/08-芬尼斯特-借控选择额外打出基地.jpg`
- 芬尼斯特结算后权威状态：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/芬尼斯特猎鹰被借来控制时，真实计分前特殊入口仍回到控制者手牌并额外打出/09-芬尼斯特-借控回手后额外打出并收口.jpg`
- 青蛙公主借控宿主附着前：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/青蛙公主在借来控制的宿主上真实触发后按-owner-controller-语义转移/10-青蛙公主-借来宿主附着前.jpg`
- 青蛙公主借控宿主附着后：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/青蛙公主在借来控制的宿主上真实触发后按-owner-controller-语义转移/11-青蛙公主-借来宿主附着后.jpg`
- 青蛙公主变形转移后权威状态：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/青蛙公主在借来控制的宿主上真实触发后按-owner-controller-语义转移/12-青蛙公主-宿主回拥有者牌库并转移行动后.jpg`
- 着魔真实附着入口触发前：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/着魔从真实附着入口在宿主离场后转移到另一个随从/13-着魔-真实附着入口触发前.jpg`
- 着魔宿主附着并获得 +2：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/着魔从真实附着入口在宿主离场后转移到另一个随从/14-着魔-宿主附着并获得加力.jpg`
- 着魔宿主离场后的转移选择：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/着魔从真实附着入口在宿主离场后转移到另一个随从/15-着魔-宿主离场后的转移选择.jpg`
- 着魔附着行动转移并收口：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-culture-shock-russian.e2e/着魔从真实附着入口在宿主离场后转移到另一个随从/16-着魔-附着行动转移并收口.jpg`

## 同类扩审与残余范围

- 搜索范围：俄罗斯童话静态对象 `src/games/smashup/data/factions/russian_fairy_tales.ts`、运行时 `src/games/smashup/abilities/russian_fairy_tales.ts`、中英文卡面文本、俄罗斯童话领域测试、Culture Shock E2E，以及变形 / 牌库 / trigger / reducer 共享实现。
- 命中项：变形共享 helper 缺少卡面要求的洗牌；愚蠢的魔术师整理范围错误地包含原有手牌；弥撒变化把手牌随机洗入牌库而非放到牌库底；弥撒变化真实入口暴露源行动卡尚未移出手牌时被误纳入重排；生命之水、沙皇之鹰和愚蠢的魔术师在借来牌场景下把目标牌库错误绑定到卡牌 owner；派系选择 E2E 直接依赖虚拟列表首屏 DOM。
- 处理结果：前述规则缺陷、本轮源行动卡 / 借牌归属缺陷和芬尼斯特控制者回手缺陷均已修复，并由 27 条领域测试覆盖；派系选择改为真实搜索入口，青蛙公主和着魔对象级链路已由真实入口补证，俄罗斯童话 E2E 6/6 通过；未发现新的 L2 对象缺口。
- 残余扩审范围：18 个对象中已有 5 个对象具备 direct L3/L4，仍有 13 个对象缺整派系逐对象 direct L3/L4；当前证据只支持 L2 全对象行为审计与部分 L3/L4 入口，不升级为整派系完全收口。

## 测试语义对账 / 旧测试失效检查

- 最终状态断言：27 条领域测试与 6 条真实入口 E2E 均回到 reducer 后的手牌、牌库顶 / 底、弃牌堆、基地随从、附着行动、控制者、真实 owner、力量指示物、metadata、triggerQueue 或交互关闭状态；不以“注册存在”或“prompt 出现”单独作为通过。
- 分支与选择边界：覆盖芭芭雅嘎变形后洗牌、沙皇之鹰抽牌 / 对手弃牌堆双模式、愚蠢的魔术师只整理本次抽牌、蟾蜍控制权交换、芬尼斯特猎鹰移动 / 自有控制回手额外打出 / 借控回手额外打出三分支，以及白桦木回合开始自毁后的额外打出链。
- 旧测试失效检查：旧的 13 条测试只覆盖部分代表链和注册合同，不能证明未覆盖对象或关键分支；本轮没有保留“注册合同 = 行为完成”的旧口径，并用新增最终状态断言替换该缺口。真实入口进一步证明领域夹具若不把源行动卡放回执行时序，无法发现“源行动卡被重排后重新抽回”的缺陷，因此保留该 E2E 作为时序回归；新增借来牌测试则直接对账卡面写明的目标牌库，而不是把 owner 字段当作默认答案。

## 仍未实现 / 不得误报完成

- 已补代表性 L3/L4 E2E 文件：`e2e/smashup/smashup-culture-shock-russian.e2e.ts`。
- 当前 E2E 仍只覆盖俄罗斯童话的部分真实入口链路；变形之泉等仍可继续补对象级 L3/L4 拒绝路径或特殊窗口证据。芬尼斯特借控计分前特殊链、青蛙公主借控宿主链和着魔宿主离场转移链已补对象级真实入口，但不代表整派系完成。
- 文化冲击四派系尚未整体完成：俄罗斯童话虽已完成 18 个对象的 L2 行为审计和代表性 L3/L4 入口，仍缺整派系逐对象 direct L3/L4；古代印加人本地玩法范围已单独收口。
- 文化冲击资源远端链路仍 blocked：R2 凭据不可用，代表 CDN URL 仍未取得 `HEAD 200`。
