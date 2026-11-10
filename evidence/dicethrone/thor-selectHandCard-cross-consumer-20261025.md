# 单张 `selectHandCard` 共享交互复审（2026-10-25）

## 当前代码路径

| 消费者 | 生产入口 | 选择语义 | 当前 UI owner |
| --- | --- | --- | --- |
| 索尔姆乔尔尼尔投掷 / 召回 | `src/games/dicethrone/domain/customActions/thor.ts:127-140` | 单张手牌成本，可取消 | `Board.tsx` 将本地拥有者的单选交给 `HandArea`；提交 `resolveInteraction([], [cardId], interactionId)` |
| 咒缚海盗深海潜行 | `src/games/dicethrone/heroes/cursed_pirate/abilities.ts:112`，共享处理器见 `customActions/cursed_pirate.ts:513-538,1267-1269` | 对手从当前手牌自选弃 1 张 | 同一 `HandArea` 选择路径；交互不提供取消 |
| 咒缚海盗瞭望台战利品 | `src/games/dicethrone/domain/customActions/cursed_pirate.ts:1149-1158` | 掷出战利品面后自选弃 1 张 | 同一 `HandArea` 选择路径 |
| 咒缚海盗走跳板弃牌分支 | `src/games/dicethrone/domain/customActions/cursed_pirate.ts:1378-1389` | 先选效果分支，再由目标玩家自选弃 1 张 | 分支选择继续使用选择弹层；进入弃牌步骤后改走同一 `HandArea` |

代码路由在 `src/games/dicethrone/Board.tsx:1542-1558,2451-2468,2537-2544`；共享提示条在 `src/games/dicethrone/ui/GameHints.tsx:95-140,378-388`；手牌点击和弃牌态在 `src/games/dicethrone/ui/HandArea.tsx:938-980`。`selectCount !== 1`、非当前交互拥有者及只读查看不进入这条路径。

## 同族语义边界

- 以上四个“玩家从当前手牌中自选一张并弃置”消费者复用手牌本体、弃牌态和共享提示条；索尔多出的“取消”来自其成本交互明确设置 `allowCancel: true`。
- 瞭望台“查看对手手牌”是查看后确认，不是弃牌选择；保留查看确认界面。
- 走跳板先决定“偷 CP 或弃牌”的效果分支；该分支弹层不替代后续手牌选择。
- 骰面组合、牌库候选、多选手牌继续由其各自 owner 呈现。不得因同属 `select*` 名称就强行合并语义。

## 复审状态

规范已覆盖同一交互族复用同源视觉语法、禁止可由手牌本体承载的单选退回通用弹窗、扩审共享消费者；本次无需改规范。问题来自旧实现 / 旧验收没有按规范使用共同 owner，属于执行和证据漏检。

本轮完整复核时发现前一组截图 sidecar 的 `sourceRevision=6631f388…` 与当前源码不一致。索尔定向测试 176/176、咒缚海盗规则测试 117/117、样式合同在摘要 `51b4dd48…` 下通过；随后源码又变化至 `7ff02cea…`，最新观察为 `7fa1ad02…`。该摘要下重跑时 9/12 套件在模块加载阶段失败，原因是 `src/games/dicethrone/heroes/treant/cards.ts:217` 使用了 `WILD_GROWTH_2`，但文件顶部未导入；该符号在 `heroes/treant/abilities.ts:265` 有导出。当前代码审查未改写该派系文件。此前E2E截图只作定位，不能作为当前源码验收；真实入口刷新也受共享单 worker runtime 占用。故本文件记录共享 owner 复审范围，不声明最终验收通过。

前一轮入口截图来源 `test-results/evidence-screenshots/dicethrone/.../_runs/e2e-1792854779230-cnzatm/` 已在当轮逐图核对：深海潜行、瞭望台战利品、走跳板的单张弃牌均出现手牌本体与共享弃牌提示；查看手牌确认和走跳板效果分支弹层属于不同语义。其源码摘要过期，复跑后应以新 run 和 sidecar 取代这些视觉结论。

## 2026-10-25 规范与消费者复核续记（未收口）

规范原则已有覆盖：`rule-driven-interaction-design.md:49` 要求同一游戏、同一交互族复用确认语义和同源视觉语法；`regression-closeout.md:75,88` 要求按共享 helper 横向扩审，并把共享抽象未扩审列为漏审原因。规范没有写 Dice Throne 的 `selectHandCard -> HandArea` 具体代码映射；这项游戏内映射由本矩阵和消费者测试承载即可，项目级规范无需复制实现细节。旧截图被误判 PASS 的直接原因是执行 / 验收未按既有交互族对照，不是通用规范缺少原则。

更直接的功能依据在该变更自己的 `openspec/changes/add-dicethrone-thor-faction/design.md`：弃牌飞掷 / 召回的第一入口必须是既有主动动作栏，随后让玩家选真实手牌；选定后正式提交并弃牌，“不另加确认壳”。旧 `ChoiceModal` 不符合这个已批准交互设计。

当前代码消费者检索确认：索尔的姆乔尔尼尔投掷和召回成本都由 `paidHammerChoice` 创建同一单选交互；咒缚海盗的共享 `requestOpponentDiscardOneCard` 被深海潜行、瞭望台战利品、走跳板弃牌分支调用。除当前本地交互所有者的 `selectCount === 1` 外，其余语义继续使用既有 owner；当前没有生产侧 `selectCount > 1` 例子。故需要扩审的是上述四种单张弃牌入口；查看手牌确认与走跳板效果分支仍是不同交互。

为避免把通用 `selectHandCard` 类型误判成“弃牌”，HandArea 直连条件现还要求 `titleKey === interaction.selectHandCardToDiscard`；它只表达当前明确的单张弃牌合同，未来其它手牌选择语义不会因此被误走 `onDiscardCard`。

当前代码定向验证日志记录 Thor / UI 176/176、海盗机制 117/117、Dice Throne 样式合同 11 项通过，运行时源码摘要为 `4ee0a584…`。随后工作区改为 `9756ec7f…`，又观察到 `285736d6…`。Thor 与在线入口一轮在 run `e2e-1792898214676-bl1fze` 的 5/9 项通过（Thor 四场景、在线入口一场景），之后 E2E 内存 watchdog 终止 Playwright；该轮还与七大恨 shared runtime 并行，未作为验收证据。海盗四消费者入口尚未在当前稳定源码摘要下刷新。最终结论仍为 pending。

## 2026-10-25 隔离复跑（仍待最终同源收口）

在源码摘要 `7832913e2f4552abc1cf8f9c471578c816a50ab3ef8cb73f2297515859fcd31d` 下再次通过 Thor / UI 176/176、海盗机制 117/117、样式合同11项；真实入口使用显式隔离运行器，Thor交互4/4、在线选角开局1/1、海盗单张弃牌及3个生产消费者4/4通过。Thor与在线截图 sidecar 均记录该摘要。三个隔离 run 分别为 `e2e-1792904876394-91jcdi`、`e2e-1792905122812-58vjh0`、`e2e-1792905346918-menhvl`。

运行后发现首页 CSS 的并行改动使完整前端摘要变为 `b1759009fe2ec81dc18774501365a4b99056c7887026aa584dc514fba10f8f55`；Thor截图因此仍不晋升为最终当前版本证据。随后 `e2e-doctor` 报告 Fate tutorial E2E 正在运行且占用全局重任务预算；没有停止它，也没有与它并发跑重任务。最终稳定摘要下的定向测试、真实入口、媒体逐图复核与最终校验仍待完成。

## 2026-10-26 当前源码收口

当前源码摘要 `32560733cbceff378a46e0f1cd3fd4b7ed590c06a899d1b317dfca3647a52c98` 下，Thor 交互入口 4/4、真实双人选角/开局 1/1、咒缚海盗共享弃牌消费者与三个生产入口 4/4 均通过；三个 run 分别为 `e2e-1792956074228-4ozck4`、`e2e-1792956207290-2bmsmi`、`e2e-1792955883753-o9x1jn`。行为 trace 与 24 张独特状态截图均复用该摘要。弃牌成本仍由 `Board.tsx` 的单张弃牌路由交给 `HandArea`，用户在原手牌区选牌；取消仅因索尔这项成本显式允许取消而出现。查看手牌确认和走跳板效果分支仍属不同语义。

独立 PASS 清单及完整逐图记录：`evidence/dicethrone/thor-20261026-325607/pass-manifest.json`、`.e2e-image-index.json`、`visual-review.json`。取消后的常态帧与初始帧重复，故不重复索引为媒体；取消本身仍保留在 `companion-odin.trace.json` 并核对资源、手牌、锤子状态。最终清单通过 `npm run verify:e2e-evidence`；同源规则回归、build、样式合同和定向资源 manifest 日志详见主审计文件。本次只覆盖桌面；索尔 OpenSpec 任务 8 仍需用户明确完成态确认。

## 2026-10-26 改骰交互导致整组复审重开

用户指出另一条 Thor 交互（当之无愧改骰）没有完整复用既有流程，要求整组重审。上一节 `325607` 的 PASS 记录保留为历史，不再支撑当前任务6/7。单张弃牌的 `HandArea` owner 映射与玩家任务语义未因改骰修复而改变；但这四个共享消费者的旧同源 E2E/截图也必须在新的稳定源码摘要下重跑并逐图复核，不能沿用旧包直接关闭。当前尚无本轮海盗消费者重跑结果。

## 2026-10-27 当前共享消费者复审通过

当前结果取代上一节待跑状态。最终隔离跑次 `e2e-1793036760545-ahqi4o` 中，单张弃牌代表入口、深海潜行、瞭望台战利品、走跳板弃牌四入口全部通过真实浏览器操作；与Thor5交互和在线开局一起10/10通过。日志 `temp/codex-thor-audit/thor-all-entry-clip-final-20261027.log`。

独立审图实际发现瞭望台战利品的悬停候选底边733.736超出720视口，旧E2E绿灯未覆盖几何。根因是共享长度读取把1vw读作1px，手牌悬停仅上移3.1px；修复公共长度owner后正确上移39.68px，底边697.156，原手牌候选边框完整。读取函数只由HandArea消费，未给海盗或索尔加特例。手牌完整可见配置也统一补偿扇形下移/旋转。

该跑次海盗24原图均经独立逐图复审PASS；完整报告 `temp/codex-thor-audit/visual-review-reuse-final-20261026.json` 包含它们的原路径、哈希、评分和真实观察。Thor25原图与另跑次在线2图同报合计51/51通过。用户展示只选Thor相关26张独特状态，保留6条完整行为链：[有序图集](http://127.0.0.1:4867/?key=bc28039b7cba)。唯一清单 `evidence/dicethrone/thor-20261026-shared-flow/focused-pass-manifest.json` 已通过正式validator。

范围源身份按每条链的真实runtime启动值保留，2,633文件快照和原始差异见 `source-scope.json`。范围外七大恨/教程浮层变更不冒充全仓稳定；本轮非教程路由不挂载TutorialOverlay，目标消费范围未变。全仓typecheck仍有既存工程边界错误，浏览器/构建通过不代称类型通过。移动端未覆盖；任务8仍待用户明确确认。

### 同类扩审记录

搜索范围覆盖 `selectHandCardToDiscard`、`requestOpponentDiscardOneCard`、`paidHammerChoice` 的生产者，以及 `Board.tsx` 的单张弃牌路由、`HandArea` 候选/hover变换和公共长度读取。命中索尔成本与海盗深海潜行、瞭望台战利品、走跳板四类生产入口；已全部由本轮10条真实入口中的对应测试覆盖，四共享消费者原图全部逐图复审。两个CSS长度读取函数的生产消费者只有HandArea，故单位修复的相邻覆盖包括非hover、hover、多张候选、原手牌拖牌/取消及发弃牌结果。

残余扩审范围明确保留：查看对手手牌确认和效果分支选择属于不同语义，继续用既有选择框；当前没有生产侧多张弃牌入口。未来新增多选弃牌或其它手牌选择语义时需重新扩审，不能把本次四入口通过外推给未来分支。移动端没有本轮直接证据。

### 漏审归因

旧测试断言过窄：只证明候选可见和能点击，没有证明悬停放大后的完整边界；旧截图审查又未把候选外底边逐项核对，导致图已生成、功能绿灯被误当图面通过。当前增加真实候选边界断言，并由独立审查实际打开原图；733.736出界红测与697.156修后结果保存为直接证据。此前当之无愧只复用外观、未复用公共构造的漏审另由主审计记录回写，不把相邻交互的通过当成弃牌完整性的证明。
