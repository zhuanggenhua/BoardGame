# Thor 全量交互覆盖矩阵（2026-10-29）

2026-11-01 后续裁定：此前奇异博士任务曾记录普通选骰提示左侧居中；之后用户在 Thor 共享交互复审中明确选择恢复 DiceThrone 旧版顶部居中。该较新的共享组件位置裁定覆盖前项；效果骰 DiceTray 提示保持自身锚点。本修订只更正提示位置，不改变其余规则审计结论。

2026-11-12 最新纠正：无懈可击原卡允许防止即将受到的伤害；复审发现独立伤害响应预检没有带入待伤害，导致该卡无法响应。已在共享受伤响应入口按直接伤害构建候选待伤害，正式枪手技能命令链及双人在线 `e2e-1794487304872-ennqmc` 验证真实发起独立伤害、索尔出牌、支付和生命保持；共享定向回归 232 项通过，新增公共牌同类命令链两项通过。该修复改变共享后端，旧截图仅证明其原运行时场景；受影响的索尔真实页面链正重新运行。新图来源差异仅为另一任务的 `ZoomPanViewport.tsx`，索尔页面未引用该组件；不因此外推其他游戏。

2026-11-12 独立伤害响应修复后的回归：索尔主交互 `e2e-1794495926062-97hald` 7/7，规则交互 `e2e-1794496043603-vc4qxs` 37/37；共享响应及索尔六文件 233/233。主交互中弃牌、奥丁重投、当之无愧与连锁闪电共十一张新整屏已逐张查看并替换进图组。在线实际攻击产生不屈意志和无懈可击响应 `e2e-1794497884061-mfjjar` 2/2，六张整屏已重看并替换；本次不屈投出6点，未触发存活。图片保留各自原始运行来源。以上为对应测试与图片覆盖，不代表 62 行全部边界通过。

2026-11-13 同类续链复审：索尔飞锤产生独立伤害后，由防御方使用公共“下次一定”防止，真实双人房间 `e2e-1794499671794-wp4g3o` 1/1：生命仍为50，主攻击未结算且进入原防御阶段；该场景预置合法已确认骰。另以正式命令链验证对手索尔使用“无懈可击”防止飞锤后，原主攻击继续完整结算；`thor-flow.test.ts` 73/73。未采集新的截图，不能将此行为证据写成视觉验收。

2026-11-13 逐图复看并替换图组 20–27、33–37：瓶中闪电锤移动与停止、破防两次响应及连锁二级四骰选择，来源分别为主交互 `e2e-1794495926062-97hald` 和规则交互 `e2e-1794496043603-vc4qxs`。画面可见原选择、效果骰提示、选中反馈和确认动作；不因此推广到其他对象。复核来源发现本地快照后四个前端文件与一项服务端文件有其他任务后续修改，其中 OptimizedImage 供索尔背景和放大视图使用；这些图片反映各自采集时源码，尚未用新源码重拍，不能标成源码完全一致。

2026-11-13 漏审修正：四人连锁闪电的附属目标之前使用通用选项弹窗，虽可完成却未复用同游戏已有玩家选择流程；原交互通过结论不适用该状态。现为此选择声明 player 类型并复用 InteractionOverlay 的玩家候选、选中反馈和确认，基础与二级共用该处理入口。四人在线 `e2e-1794519729791-8tm0fa` 实际投目标骰和效果骰，选择另一名敌人后检查独立2伤的事件目标、队伍生命48、主攻击目标保留与防御阶段；开始前的攻击骰为合法预置。新旧界面已直接看图，当前新图53–55已加入局部视觉组。Thor 三文件 139/139。此前对象行状态仍需逐项复审，不能据本链推断全角色通过。

2026-11-13 同类飞锤漏审修正：飞掷时选敌方玩家亦曾落入通用选项窗口；现使用既有玩家选择和确认，可停止的场景保留停止，召回或停止仍是动作选择。四人真实开局 `e2e-1794521010764-0pf03f` 验证弃牌、选敌、确认、持锤和一次独立伤害；零次停止、三次、一次后停止、六次、终极四次真实页面 5/5（`e2e-1794520511939-vwyhw4`），主交互 7/7（`e2e-1794521301438-dh959i`），Thor 三文件 139/139。七张已重看并替换，另补选中确认图；图组局部视觉 PASS 不等于全对象审计通过。

2026-11-13 选择权限与 AI 补验：四人在线 `e2e-1794523379980-rp8lm3` 核对非索尔客户端没有附属目标操作入口，索尔选择另一敌人后事件目标与2点独立伤害一致，原主攻击进入防御；三张新图已查看替换。正式命令链核对飞锤目标/停止及连锁两名敌人的 AI 合法动作，逐项执行且验证非操作者提交被拒；Thor 三文件 141/141。截图只覆盖上述代表态。

2026-11-13 四人飞锤权限补验 `e2e-1794523847702-56qkl1`：真实开局后索尔弃牌选目标，其余三名玩家客户端均不显示目标选择；索尔确认后目标持锤并扣1生命。五张原始画面已逐张复看并替换图组对应图片。

## 验收预期先行

规范来源：.spec/knowledge/standards/rule-driven-interaction-design.md、e2e-verification.md、ui-change-gates.md。修改前已核对规则原文、slot 原图及真实旧入口；原子规则与旧流程索引保留在 [2026-10-27 独立规则预期账本](thor-interaction-reaudit-20261027.md)。规范要求每个需要玩家输入的状态由同一合同派生提示、候选、反馈、提交和取消/跳过。

本矩阵逐对象登记 21 个能力、34 张实体卡、7 项同伴/状态操作。共用交互族只复用其操作语法；每个对象仍须独立核实规则结果、授权、时机和后态。历史截图不作为当前源码证据。

2026-11-11 补充：现行 `thor-flow.test.ts` 已通过正式命令验证雷轰电掣基础的持锤与未持锤两分支，并验证基础雷霆之力、电闪雷鸣、雷轰电掣 II、雷霆之力 II 的一组最终生命和驭电结果；本轮四文件定向测试共 122/122。下表原写的这些对象“无独立断言”是旧记录；上述测试不覆盖所有多人目标、行动分支及 UI，因此不提升对象行或全量结论为 PASS。

2026-11-12 纠正：下表奥丁之力基础、奥丁之力 II、雷电之轮基础及雷电之轮 II 的旧“静态复核一致”漏掉同时召回和雷骰奖励这一组合，原结论作废。红测确认两次授予按旧数量互相覆盖后，现已调整为锤子移动完成再结算雷骰奖励；正式命令链覆盖基础/升级和驭电上限，真实页面各覆盖一条奥丁和防御代表链。其余分支、全量审计和最终图组仍不能据此标为通过。

同类扩审记录：搜索范围为 `src/games/dicethrone/domain/customActions/thor.ts` 中 `grant`、`moveMjolnir` 和 `hammerChoice` 的全部调用，并回查其能力参数、卡面及相关正式命令测试。奥丁和雷电之轮基础/升级命中“召回后再获驭电”，已补组合与上限测试；雷霆之力、雷轰电掣 II 和雷神之锤升级均经 `hammerChoice` 的续链在移动完成后授予；挥锤时刻把召回奖励与牌面奖励合并，驭雷策电的持锤与召回分支互斥。以上是同一状态字段的扩审，不能推断其它游戏或其它状态已审完。

公共固定改骰回归复核：旧用例在选骰后等待确认按钮而失败；历史版本 `99df4042b` 的 `clientDiceMultistepInteraction.ts` 对 `set` 使用 `maxSteps` 自动提交，引擎 hook 达到上限即提交，因此该用例的额外确认与历史行为不符。移除该步骤后，原 monk 公共牌入口 `e2e-1794433656452-comfl0` 1/1 通过，实际验证首骰变 6、交互结束及卡牌消耗。此结论仅覆盖该固定 6 路径；不能据此认定其它旧交互均未回归。

旧改骰整组 `e2e-1794433730210-i0m6po` 为 10/12：终极来源骰同样在自动提交后误等确认；修正后又发现它将父掷骰阶段误当成独立骰回看。历史 `99df4042b` 的 `diceStagePolicy` 在普通掷骰阶段恢复主骰盘，测试保留效果骰权威值和结算状态断言，并核对恢复主骰；`e2e-1794434017384-ipm7bt` 该条 1/1。另一条战术优势要求攻击者重掷对手防御骰，当前实际无该入口；现有战术家规则录入表写明只能重掷自己的骰，仍需核对原素材并处理旧用例，整组未通过。

战术家规则原图复核：真实页面 `e2e-1794433730210-i0m6po` 的战术家提示板写明花费 1 个指示物可“重掷1颗你的骰子”，与录入表一致；旧用例期待对手骰可重掷属于错误预期。修正为验证对手骰不可选且指示物未消耗后，`e2e-1794434162224-m84wcr` 1/1；同一原整组另有自己主骰和奖励骰的实际重掷正向路径通过。修正后的整文件尚未重跑，不能将首次整组 10/12 记为全通过。

修正后的旧改骰整文件 `e2e-1794434218778-zayl7a` 12/12 通过，覆盖固定、复制、调整、奖励骰及重掷权限；仅证明该文件所列路径，不替代索尔全量规则和截图验收。

当前 DiceThrone 全量 Vitest：194 文件中 182 通过、12 失败，2964 条通过、23 失败、1 跳过；日志为 `temp/codex-thor-audit/dicethrone-full-current-20261112.log`。其中四条 `active-modifiers-undo` 仍向 `RightSidebar` 传已经移除的旧 `interaction` 属性，导致未渲染预期提示；其中两条带历史反馈快照，尚须核实旧快照是否会从当前真实房间入口恢复，不能直接更换断言或将它们等同当前浏览器回归。其它失败涉及工匠、武僧、炽天使、教程及旧布局等，尚未逐条归因；因此本轮不宣称 DiceThrone 全量通过。

旧反馈兼容复核：历史 `6a3cb53f` 真实快照缺少 `initialResult`，且旧版正式 `dt-dice-select-*` 元数据没有 `selectionMode`；当前严格重建会拒绝后者。持久房间加载链会恢复保存的交互，故在 DiceThrone 已有旧状态规范化入口识别旧版重投形态并补 `reroll`，保留新格式严格校验；当前与队列均迁移，输入对象不变。先有原始快照迁移红测，再通过 48 项合同/迁移定向测试；真实页面 `e2e-1794441911707-7frukd` 先打出抬一手，再注入序列化旧字段，恢复后选对手骰并完成重投 1/1。四个旧侧栏测试已按当前 Board 的恢复和合同投影入口构造，保留原反馈快照，相关 26 项通过；该代表态不证明线上现存房间或已部署修复。

索尔其余公共卡真实页面 `e2e-1794435194870-ue2d3t` 5/5：意不意外分别修改自己的两骰和对手两骰；抬一手选择并重掷对手一骰；一掷千金分别投 1 和 6 后确认并获得对应 CP。13 张原始整屏图逐张查看：原骰盘提示、预览、确认和结果均可辨认；这只覆盖所列旧交互代表路径，其中对手响应使用测试准备状态，不证明自然攻击链产生该前态，也不作为索尔新 UI 图组通过依据。

该批采集后核对 799 个前端来源，五个本地 provider / 类型文件发生并发变化：差异是向初始化 `domain.setup` 增加模式上下文参数；DiceThrone 的 `domain/index.ts` 初始化只接受原三个参数，没有消费该新增参数。此判断只针对这组本地初始化及截图链，不外推其它游戏或联机服务端。
新交互候选组 31 张原始图的前端来源复核同样仅命中上述五个文件与 `useGameProviderRuntime.ts`；后者属于在线 GameProvider，本组通过本地 TestMatchRoom 采集。截图哈希与各自原图一致；本组整体仍为 REVISE。
本轮再次直接查看候选组连锁选骰四帧、锤子选择三帧、破防五帧、不屈三帧和无懈两帧：候选、选择反馈、原确认入口及对应收口画面可辨认；此为这些图的局部观察，不据此推断全角色规则或整组通过。

本轮复查 21 个玩家板及升级能力定义与独立规则账本：触发骰型、伤害档、基础/升级骰数、锤移动次数、可选停止及治疗/资源参数一致；同时追踪 `thor.ts` 中锤移动、效果骰、附属伤害、破防及伤害响应的结算入口。复查结果不代替每种人数和每个分支的真实对局证据；此前召回与雷骰同时授予的漏审仍以已补正式命令和页面证据为准。
本轮复核 34 个物理槽位的映射及索尔专属牌：18 张公共牌复用 `COMMON_CARDS` 仅替换图集引用；9 张升级分别替换对应能力；7 张专属行动的费用、时机和规则条件与独立账本对应，推广彩虹桥未进入常规牌库。公共“下次一定”的受伤目标、队友重投权限与额外投掷阶段限制已追到当前共享条件与消费入口，并以现有多人端到端和出牌条件审计覆盖；逐卡全部自然对局路径未由上述证据证明。
本轮复核破防、驭电、姆乔尔尼尔的上限与主动入口，以及弃牌飞掷/召回、免费移动和败北召回的共享消费链；驭电抽牌入口随合法持有者提供，免费移动继续使用同一锤位置状态。上述静态检查配合既有正式命令、桌面和多人代表态测试，不外推未单独实测的所有玩家人数及响应组合。

联机服务器源码更新后，并发复跑两个独立双人房间：当之无愧 `e2e-1794436186336-0c6bdm` 1/1，主人选 5 并选骰，客人无代选窗口，服务端仅目标骰变为 5；连锁闪电 `e2e-1794436186336-pm4ulf` 1/1，主人选择两骰，对手等待，服务端核对伤害和阶段。两项均使用已投骰合法代表态，不证明从开局自然走到该前态，也没有新增在线视觉截图。
后续为核查双方视角复跑 `e2e-1794439256024-zp9wj6` 和 `e2e-1794438820410-nlqn8f` 各 1/1，直接查看四张在线诊断整屏：当之无愧主人可见 4/5 和取消，对手关闭卡牌特写后见等待；连锁主人见三颗效果骰和选择提示，对手见等待。图片保存在 `temp/thor-worthy-online-{host,guest}.png` 和 `temp/thor-chain-online-{host,guest}.png`，没有正式来源 sidecar，只作诊断，不作为最终展示图。

当前服务器源码下的四人房间 `e2e-1794436846739-rchzcn` 1/1：合法代表态覆盖队友选骰、随机目标和队友护盾，包含实际玩家动作和服务端结果；这不证明整局从开局自然推进到这些状态。
其中已直接查看“不愧是我”骰主等待和选中两张原始整屏：原骰盘、重投提示、选中标记与原确认/取消按钮可辨认；该批其余图未逐张复核，不作为完整图面验收。

当前服务器源码真实双人选角及开局 `e2e-1794437863551-4jsd1m` 1/1，两张原始整屏已直接查看：选角处可见索尔与实施中标记，入局后角色板和提示板素材正常显示。此条只证明选角与开局入口，不证明完整对局和全部交互；普通手牌按现有收纳方式显示。

漏审归因：旧测试分别覆盖了召回和效果骰奖励，却没有在同一真实结算链同时触发两者，且旧静态审计没有追踪两条 `TOKEN_GRANTED.newTotal` 均从同一旧状态计算；单独事件和中间选择存在无法证明最终堆叠。现在以规则原文为预期，先复现最终数量错误，再检查修复后的基础/升级、上限与多人选择；本段不将剩余对象标为通过。

当前源码边界：矩阵逐行静态复核曾完成，但 11:02–11:05 UTC 的共享 DiceThrone reducer、reroll、Board 和 UI 写入后，受影响规则与交互行待按新源码复核。最新完成的 GameHints 顶部居中单测 7/7 只覆盖提示锚点，不把全量矩阵升级为 PASS。

### 本轮先锁定的骰盘交互模式

| 交互原子 | 规则来源 | 旧入口/玩家任务 | 当前提示与候选反馈 | 提交、取消或跳过及权威后态 | 必须不存在 |
| --- | --- | --- | --- | --- | --- |
| 普通效果骰确认 | Dice Throne 效果骰结算合同；索尔效果骰技能/卡及 FAQ | 既有奖励骰在右侧 DiceTray 展示真实骰面；当前决策者按原“确认”继续结算 | 提示“确认效果骰结果并继续结算”；骰子本体及来源归属标识显示真实结果 | 复用右侧原“确认”动作，继续同一 pendingBonusDiceSettlement；没有取消/跳过 | 不能出现无提示确认、卡牌池弹窗、第二套确认入口或额外骰子编辑 |
| 奥丁之力 II 组选重掷 | slot22 原图/FAQ；可任选0–5颗、同批只重掷一次 | 复用同一 DiceTray 的骰子点选与动作轨；有选择时左槽提交已选骰组，无选择时沿原确认保留结果 | 同一合同派生选骰/已选数量提示；骰盘显示完整5颗与选中标记 | 左槽提交所选组一次；右槽继续原结算；空组选时右槽直接确认；重掷后选择反馈清空 | 不得出现新增 reset 按钮、每骰独立重掷、二次组选或缺提示 |
| 固定改骰（slot17/27） | 公共slot17固定6；索尔slot27固定4/5；两张图分别锁定 | 复用既有 set 流程：先选规则枚举值，再点自己骰子 | 当前提示随操作阶段变化；骰面点击前权威值不变，目标值候选仅来自卡面 | 取消退款且不改骰；点骰后只改目标骰并结算 | 不得用任意加减、手动确认、非规则候选值或改写别的玩家骰子 |

### 升级牌共享流程审计

`sharedFlowId: S-upgrade`：当前玩家在主要阶段从原手牌拖出升级牌，提交 `PLAY_UPGRADE_CARD(cardId, targetAbilityId)`；`validatePlayUpgradeCard` 与 `checkPlayUpgradeCard` 校验手牌、时机、费用和升级等级，`executeCards` / `handleAbilityReplaced` 扣费、替换原能力槽并清理手牌，不在升级时自动发动能力。`card-system.test.ts` 检查费用不足和错误阶段，`card-cross-audit.test.ts` 检查所有普通升级牌的事件、交互清理与槽位；索尔九张原卡在 `thor-cards.test.ts` 分别核对独立目标、等级、费用及其他槽位不变，并逐张验证 AI 动作、正式命令与后续阶段推进。真实页面已从手牌打出九张并查看原技能槽；其中四张在同页继续发动升级能力。各卡差异仅为卡 ID、目标技能、等级、费用和图集槽；升级后能力效果有独立能力行，不能由本表代替。若触发时机、候选权限、UI、命令形状、替换/清理或 AI 消费改变，须重审全部引用对象。

### 对象逐行矩阵

| 对象 | 规则子句/来源账本 | 旧入口与操作语义 | 提示、候选、反馈、收口和禁项 | 行为证据 | 真实入口/当前截图 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 能力：雷神之锤基础 | [3/4/5锤选相应4/5/7伤害档；只飞掷一次，自己不持锤时主攻击仍成立](thor-interaction-reaudit-20261027.md#L38) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + 必需一次锤移动；负向约束：不得凭基础版召回；不累加伤害档；敌人选择与独立1伤害 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_HAMMER / thor-hammer-moves；thor-flow 雷神之锤飞掷保留主攻击/防御；thor-companion 唯一锤目标 | 双人在线 e2e-1794529090039-p7p0nq：预置合法已确认的5神锤，实际从最高档技能槽发动并完成对手防御；飞锤独立伤害后生命50→49，主攻击后49→42，攻击清理。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：驭雷策电基础 | [获2破防、治疗2；持锤获3驭电，否则召回并对原持锤者3附属伤害](thor-interaction-reaudit-20261027.md#L39) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability；分支由正式锤位置派生，无额外选择；负向约束：无主攻击；原持锤目标不得偷换为默认敌人；召回仍获1驭电 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_MIGHTY_SUMMON / thor-mighty-summon；thor-flow 双人和四人正式命令链验证召回、治疗及伤害事件指向原持锤者；thor-cards 治疗与附属伤害参数 | 当前 e2e-1794446745593-r1tm7s 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：奥丁之力基础 | [主攻击5、投5效果骰；2锤移动一次、2盔获1CP、每雷获1驭电；按当前驭电加伤](thor-interaction-reaudit-20261027.md#L40) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + S-bonus；效果骰当前确认提示；负向约束：不可重掷；奖励读取效果骰；主攻击保持 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_ODINFORCE / thor-odinforce-settle；thor-flow 基础奥丁最终骰奖励 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：连锁闪电基础 | [投3效果骰，从中选2决定主伤害；另对1敌人2独立附属伤害](thor-interaction-reaudit-20261027.md#L41) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-bonus + S-choice（3种组合）；多敌另选附属目标；负向约束：不自动最高；可选与主攻击同一敌人；不可把2并入主伤害 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_CHAIN_LIGHTNING / thor-chain-settle + thor-chain-pair；thor-flow 手选两骰与独立附属目标 | 当前 e2e-1794444607345-y62z12 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷轰电掣基础 | [小顺子；目标持锤则9伤，否则7伤并获1驭电](thor-interaction-reaudit-20261027.md#L42) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability；目标分支无新选择；负向约束：不按任意敌人持锤；9伤分支不再获驭电 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_THUNDER_STRIKE / thor-thunder-strike；thor-flow 四人真实开局、目标骰选持锤或不持锤敌人分别断言加伤和驭电 | 双人在线 e2e-1794528780149-x7yze2：预置合法已确认的小顺与目标未持锤，实际从技能槽发动并经对手防御，目标生命50→43、索尔获1驭电，攻击清理；不外推目标持锤分支。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：瓶中闪电基础 | [0..2次合法锤移动，获2破防，7+当前驭电伤害](thor-interaction-reaudit-20261027.md#L43) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + S-choice；每步飞掷/召回/停止提示；负向约束：0次合法；每步更新锤位置；不可2次连续飞掷；不消耗驭电 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_BOTTLED_LIGHTNING / thor-hammer-moves；thor-rule E2E 零次停止场景（待当前运行） | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷霆之力基础 | [一次合法锤移动，获2驭电，主攻击10](thor-interaction-reaudit-20261027.md#L44) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + 必需一次锤移动；负向约束：无额外驭电加伤；召回本身的1驭电不能漏 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_POWER_OF_THUNDER / thor-hammer-moves；thor-flow 从技能发动到防御后验证飞锤1伤、主攻击10伤与2驭电 | 双人在线 e2e-1794528780149-x7yze2：预置合法已确认大顺，从技能槽发动并完成对手防御；飞锤独立伤害后生命50→49，主攻击后49→39，获2驭电，攻击清理。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷电之轮基础 | [原防御3骰；2锤移动一次，每盔防2；有雷总共获1驭电](thor-interaction-reaudit-20261027.md#L45) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability防御 + 必需移动；负向约束：多雷不是多枚；独立锤伤害不混减伤 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_THUNDER_WHEEL / thor-thunder-wheel；thor-flow 防御返回原主伤害流程 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：为了阿斯加德 | [获1破防，0..4次合法锤移动，14终极伤害](thor-interaction-reaudit-20261027.md#L46) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + S-choice；每步允许停止；负向约束：终极中对手不得插入锤伤响应；无驭电增伤 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_ULTIMATE / thor-hammer-moves；thor-flow 终极四次移动、14伤及禁止对手插入 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷神之锤II | [3/4/5锤5/6/7伤；飞掷或召回一次；4相同数字获1驭电](thor-interaction-reaudit-20261027.md#L47) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + 必需移动；等级II牌面；负向约束：相同数字不是相同符号；读取攻击骰快照 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_HAMMER_2 / THOR_HAMMER_2 + duplicateThreshold=4；thor-flow 正式命令链核对3同点无奖励及4同点奖励 | 双人在线 e2e-1794529090039-p7p0nq：真实拖0 CP升级牌，预置合法已确认的5神锤，技能槽发动并完成对手防御；飞锤后生命50→49，主攻击后49→42，相同数值奖励1驭电，攻击清理。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷神之锤III | [3/4/5锤5/6/8伤；飞掷或召回一次；3相同数字获1驭电](thor-interaction-reaudit-20261027.md#L48) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + 必需移动；等级III牌面；负向约束：不能继承II的4数字阈值 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_HAMMER_3 / THOR_HAMMER_3 + duplicateThreshold=3；thor-flow 正式命令链核对2同点无奖励及3同点奖励 | 双人在线 e2e-1794529090039-p7p0nq：真实拖升级牌并支付2 CP，预置合法已确认的5神锤，技能槽发动并完成对手防御；飞锤后生命50→49，主攻击后49→41，相同数值奖励1驭电，攻击清理。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：驭雷策电II主区 | [获2破防治疗3；持锤获3驭电，否则召回并对原持有者4附属](thor-interaction-reaudit-20261027.md#L49) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability，无新决策；负向约束：无主攻击；与基础只差治疗/附属数字，不差目标语义 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_MIGHTY_SUMMON_2 / thor-mighty-summon；thor-cards 参数化核对治疗3/附属4；thor-flow 四人正式命令链验证伤害事件指向原持锤者 | 当前 e2e-1794446745593-r1tm7s 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：电闪雷鸣（II下区） | [2锤2雷；获2驭电并6普通伤害](thor-interaction-reaudit-20261027.md#L50) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability variant；负向约束：同一物理升级牌；不能漏variant入口或混为自我能力 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_FLASH_AND_THUNDER / thor-grant-electrokinesis；thor-flow 从该分支发动到防御后验证6伤与2驭电 | 双人在线 e2e-1794528780149-x7yze2：真实拖手牌升级并支付2 CP，预置合法已确认骰面，从同牌下区技能槽发动并完成对手防御；目标生命50→44、索尔获2驭电，攻击清理。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：连锁闪电II | [投4效果骰，6种两骰组合；另对1敌人3附属](thor-interaction-reaudit-20261027.md#L51) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-bonus + S-choice；6候选与原确认；负向约束：不是基础3候选；不是只显示最好两骰；独立目标保留 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_CHAIN_LIGHTNING_2 / thor-chain-settle；thor-flow 四骰六组合、独立3附属 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：奥丁之力II | [主攻击6+5效果骰；可任选0..5颗一起重掷一次，再按最终骰结算所有奖励/当前驭电增伤](thor-interaction-reaudit-20261027.md#L52) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-bonus + S-reroll；选子集提示、选中反馈、原重掷槽与确认；负向约束：本次06；空选确认跳过；不可每颗各重掷一次；重掷后不可再选第二批 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_ODINFORCE_2 / thor-odinforce-settle；thor-flow 最终骰奖励及空选保留 | 当前 e2e-1794442456114-eszw2q 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷轰电掣II | [小顺子，锤移动一次、获1驭电、9伤](thor-interaction-reaudit-20261027.md#L53) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + 必需移动；负向约束：不保留基础持锤分支7/9 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_THUNDER_STRIKE_2 / thor-hammer-moves；thor-flow 从技能发动到防御后验证飞锤1伤、主攻击9伤与1驭电 | 双人在线 e2e-1794528780149-x7yze2：真实拖手牌升级并支付2 CP，预置合法已确认小顺，从技能槽发动并完成对手防御；飞锤独立伤害后生命50→49，主攻击后49→40，获1驭电，攻击清理。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷霆之力II主区 | [大顺子，锤移动一次、获2驭电、12伤](thor-interaction-reaudit-20261027.md#L54) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + 必需移动；负向约束：无额外驭电增伤 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_POWER_OF_THUNDER_2 / thor-hammer-moves；thor-flow 从技能发动到防御后验证飞锤1伤、主攻击12伤与2驭电 | 双人在线 e2e-1794528780149-x7yze2：真实拖手牌升级并支付2 CP，预置合法已确认大顺，从技能槽发动并完成对手防御；飞锤独立伤害后生命50→49，主攻击后49→37，获2驭电，攻击清理。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：阿斯加德神力（II下区） | [3盔治疗4](thor-interaction-reaudit-20261027.md#L55) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability variant；负向约束：无攻击、防御或附属目标选择；同一物理升级牌 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_ASGARDIAN_MIGHT；thor-flow 明确治疗variant不进防御 | 当前 e2e-1794447124338-1vow0z 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：瓶中闪电II主区 | [0..3次移动、获2破防、8+当前驭电伤害](thor-interaction-reaudit-20261027.md#L56) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability + S-choice；负向约束：可立即停止、执行一部分后停止、上限3；升级当前牌面 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_BOTTLED_LIGHTNING_2 / thor-hammer-moves；thor-flow 正式命令链验证0、1、2、3次及最终伤害 | e2e-1794442456000-hlpzif 验证真实页面三次移动及一次后停止；零次、两次的结果由正式命令链验证，尚无对应页面截图。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：连锁锤击（II下区） | [3雷，可0..6次移动](thor-interaction-reaudit-20261027.md#L57) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability variant + S-choice；负向约束：可0次；上限6；无主攻击但有每飞掷独立1伤 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_HAMMER_CHAIN / thor-hammer-moves；thor-rule E2E 六次上限场景（待当前运行） | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 能力：雷电之轮II | [原防御4骰；每组2锤移动一次；每盔防2；每雷获1驭电](thor-interaction-reaudit-20261027.md#L58) | 能力入口及正式攻击/防御/结算链；细分族见源账本 S-* | S-ability防御 + 必需移动；负向约束：4锤可2次；数量不能沿用基础3；雷数量不能沿用基础有无 | [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；THOR_THUNDER_WHEEL_2 / thor-thunder-wheel upgraded；thor-rule E2E 四防御骰场景（待当前运行） | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：00 乾坤大挪移 | [2CP主要，将一名玩家身上1状态移到另一名玩家](thor-interaction-reaudit-20261027.md#L66) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-choice/状态转移原入口；来源状态→不同目标玩家→原提交/取消；负向约束：姆乔尔尼尔不可转移；来源、目标和数量均不能默认代选 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-transfer-status / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 00; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 真实页面 e2e-1794496043603-vc4qxs：选择对手2层中毒并转移1层给索尔；对手1、索尔1、神锤仍在、CP 5→3、卡进入弃牌堆。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：01 状什么态 | [2CP主要，移除一名玩家所有状态](thor-interaction-reaudit-20261027.md#L67) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原玩家选择/状态移除；负向约束：不只自选；同伴非可移除状态 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-what-status / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 01; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 真实页面 e2e-1794496043603-vc4qxs：选择对手并清除其中毒和太极各2层，神锤仍在，CP 5→3、卡进入弃牌堆。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：02 一掷千金 | [0CP主要，投1骰，获得ceil(点数/2)CP](thor-interaction-reaudit-20261027.md#L68) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-bonus；效果骰结果→原确认；负向约束：不得据原实现猜CP；边界1/6分别1/3 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-one-throw-fortune / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 02; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794435194870-ue2d3t 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：03 起开 | [1CP主要，从一名玩家移除1状态](thor-interaction-reaudit-20261027.md#L69) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原状态移除交互；候选提示/原取消；负向约束：任意合法玩家；不是移除所有状态 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-get-away / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 03; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 真实页面 e2e-1794496043603-vc4qxs：原状态选择及确认移除对手1层太极，2→1，CP 5→4、卡进入弃牌堆。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：04 超级加倍 | [2CP瞬时，自己抽3](thor-interaction-reaudit-20261027.md#L70) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原出牌→抽牌结果反馈；负向约束：无新增目标选择；抽3而非2 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-super-double / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 04; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794445792412-a1783r 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：05 加倍 | [1CP瞬时，自己抽2](thor-interaction-reaudit-20261027.md#L71) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原出牌→抽牌结果反馈；负向约束：无新增目标选择 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-double / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 05; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794445792412-a1783r 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：06 拜拜了您内 | [2CP瞬时，从一名玩家移除1状态](thor-interaction-reaudit-20261027.md#L72) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 与03同原状态选择族，时机不同；负向约束：不可把主要时机直接继承；同伴不可移除 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-bye-bye / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 06; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 真实页面 e2e-1794496043603-vc4qxs：投掷阶段走原状态选择及确认，移除对手1层太极，2→1，CP 5→3、卡进入弃牌堆，返回进攻投掷。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：07 弹一手 | [1CP瞬时，任意一骰±1；1不可减、6不可增](thor-interaction-reaudit-20261027.md#L73) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-adjust；当前调整提示、±1预览与原确认/取消；负向约束：不是任意改值；自己的/对手骰候选须合法 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-flick / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 07; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果; card-flick-locked-dice 单测 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：08 老板大气 | [0CP瞬时，自己获2CP](thor-interaction-reaudit-20261027.md#L74) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原出牌直接结果反馈；负向约束：无目标选择；遵守CP上限 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-boss-generous / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 08; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794445792412-a1783r 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：09 下次一定 | [1CP投掷行动，一名玩家防止6即将受到的伤害](thor-interaction-reaudit-20261027.md#L75)；官方规则说明2v2队友减伤仅在卡牌文字授权时成立，卡面“一名玩家”可跨玩家指定 | 复用待受伤响应窗口；无需重复选择受伤者，窗口权威目标唯一确定候选 | S-response；timing=roll + beforeDamageReceived，允许当前任何有权限玩家打出；pendingDamageTarget=true 将6点护盾给实际受伤者。负向约束：不把出牌者误当受伤者；不在错误窗口生效 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts)；[card-timing-response-boundaries.test.ts](../../src/games/dicethrone/__tests__/card-timing-response-boundaries.test.ts) 验证他人代打与承伤者；Thor 2v2 E2E 会验证队友替索尔打出后只扣剩余2点 | 双人独立伤害及四人在线 e2e-1794517583316-9d76hs：僧侣实际触发莲花掌及目标骰，树精替受击索尔出牌，5点伤害降为0；索尔生命50，卡进入树精弃牌、树精CP 5→4，响应及护盾清理。攻击骰与手牌为合法预置。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：10 意不意外 | [3CP投掷，改变任意2骰数值](thor-interaction-reaudit-20261027.md#L76) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-any 2骰，候选/预览/确认/取消；负向约束：任意2而非自己2；不要把当前字段等同源合同 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-unexpected / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 10; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794435194870-ue2d3t 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：11 不愧是我 | [1CP投掷，你或一队友至多2次重掷；可同骰两次](thor-interaction-reaudit-20261027.md#L77) | 复用当前骰主原重掷流程；出牌者仅限当前掷骰者或其队友，实际点骰由当前骰主完成 | S-reroll，限制出牌授权为 requireIsRollerOrTeammate；骰主为真实 dice owner；允许同骰两次或两骰各一次，提示累计到2次。负向约束：对手不得出牌；不退化为一次性组选重掷 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [customActions/common.ts](../../src/games/dicethrone/domain/customActions/common.ts)；[card-playCondition-audit.test.ts](../../src/games/dicethrone/__tests__/card-playCondition-audit.test.ts) 对照队友/对手边界；Thor 2v2 E2E 验证队友出牌、同骰两次及权威骰事件 | 四人在线 e2e-1794517583316-9d76hs：队友用自己的牌，索尔本人沿原骰盘对同一颗骰重掷两次；检查骰主、费用、事件与交互关闭，骰面为合法预置。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：12 惊不惊喜 | [2CP投掷，改变任意1骰数值](thor-interaction-reaudit-20261027.md#L78) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-any 1骰，原加减预览/确认/取消；负向约束：any语义允许任意值，不受11无愧4/5限制 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-surprise / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 12; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：13 俺也一样 | [1CP投掷，自己一骰改为自己另一骰值，同一阶段且目的相同](thor-interaction-reaudit-20261027.md#L79) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-copy，源骰提示→目标骰提示→原提交；负向约束：不能复制自身、不能跨目的骰区 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-me-too / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 13; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：14 我又行了 | [1CP投掷，一名玩家在其进攻投掷阶段，对至多5骰做一次额外投掷尝试](thor-interaction-reaudit-20261027.md#L80)；官方规则允许任意玩家在任意玩家的对应投掷阶段打出投掷阶段行动牌 | 当前阶段唯一确定受益骰主；骰主可对0–5颗骰提交一次额外投掷尝试 | phase=offensiveRoll；target=select 把当前进攻骰交给骰主选，支持0–5后提交，不强迫重掷。负向约束：不能在定位/防御阶段使用；不把出牌者误当骰主 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [customActions/common.ts](../../src/games/dicethrone/domain/customActions/common.ts)；[card-playCondition-audit.test.ts](../../src/games/dicethrone/__tests__/card-playCondition-audit.test.ts) 检查阶段边界；Thor 2v2 E2E 验证队友打牌、当前骰主选骰和结果事件 | 四人在线 e2e-1794517583316-9d76hs：队友出牌，索尔本人沿原骰盘任选两颗并提交一次额外投掷；检查骰主、费用及服务器骰事件，骰面为合法预置。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：15 抬一手 | [1CP投掷，选择对手1骰强制重掷](thor-interaction-reaudit-20261027.md#L81) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-reroll对手选择；原确认语义与提示；负向约束：不能变自骰；不能给被迫方选择是否重掷 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-give-hand / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 15; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果 | 当前 e2e-1794435194870-ue2d3t 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：16 就这 | [0CP投掷，一名玩家在其防御投掷阶段，对至多5骰做一次额外投掷尝试](thor-interaction-reaudit-20261027.md#L82)；官方规则允许任意玩家在任意玩家的对应投掷阶段打出投掷阶段行动牌 | 当前防御阶段唯一确定受益骰主；由当前骰主选择0–5颗并提交一次额外投掷尝试 | phase=defensiveRoll；target=select 作用于当前防御骰；不向出牌者开放另一套骰子选择。负向约束：不能在进攻/定位阶段使用；骰主确认后才提交 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [customActions/common.ts](../../src/games/dicethrone/domain/customActions/common.ts)；[card-playCondition-audit.test.ts](../../src/games/dicethrone/__tests__/card-playCondition-audit.test.ts) 检查阶段边界；Thor 2v2 E2E 验证防御骰权属和服务端重掷事件 | 四人在线 e2e-1794517583316-9d76hs：队友出牌，防御中的索尔本人沿原骰盘选两颗并提交额外投掷；检查骰主、零费用及服务器骰事件，防御和骰面为合法预置。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：17 玩得六啊 | [1CP投掷，自己一骰改至6](thor-interaction-reaudit-20261027.md#L83) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-set，提示目标6→点自己一骰按旧语义直接提交；负向约束：是11无愧固定结果的旧语法基线；不能出现加减 | [commonCards.ts](../../src/games/dicethrone/domain/commonCards.ts) + [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts)；card-play-six / COMMON_CARDS 原定义 + THOR_COMMON_ATLAS_INDEX slot 17; card-playCondition-audit 131/131只证明合法性边界，不证明结算结果; thor-rule E2E 固定6旧流程（待运行） | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：18 雷神之锤II | [0CP主要升级，同一雷神之锤槽变II](thor-interaction-reaudit-20261027.md#L84) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade；新牌面/等级/费用反馈；负向约束：不重复生成技能；能力预期见上表 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-hammer-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行10 | 独立原卡断言：费用 0、仅替换雷神之锤为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-0cqogg 从手牌升级并检查费用、等级和对应原技能槽，整屏已查看。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：19 雷神之锤III | [2CP主要升级，同一槽变III](thor-interaction-reaudit-20261027.md#L85) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade；负向约束：不能退回II或保留旧阈值 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-hammer-3；thor-cards 参数化升级/费用/替换断言；能力结果见能力行11 | 独立原卡断言：费用 2、仅替换雷神之锤为3级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-0cqogg 从手牌升级并检查费用、等级和对应原技能槽，整屏已查看。 另以正式命令验证先升三级后持有二级不能降级、扣费或丢牌。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：20 驭雷策电II | [2CP主要升级，主区+电闪雷鸣下区属于同卡](thor-interaction-reaudit-20261027.md#L86) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade + 原variant入口；负向约束：不拆第二手牌 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-mighty-summon-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行12/13 | 独立原卡断言：费用 2、仅替换驭雷策电为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-0cqogg 从手牌升级并检查费用、等级和对应原技能槽，整屏已查看。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：21 连锁闪电II | [2CP主要升级](thor-interaction-reaudit-20261027.md#L87) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade；负向约束：生效后4效果骰/6组合/3附属 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-chain-lightning-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行14 | 独立原卡断言：费用 2、仅替换连锁闪电为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-fefpf2 从手牌升级并触发升级能力，已查看整屏。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：22 奥丁之力II | [2CP主要升级](thor-interaction-reaudit-20261027.md#L88) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade；负向约束：生效后才有子集一次重掷；基础不可获得 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-odinforce-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行15 | 独立原卡断言：费用 2、仅替换奥丁之力为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-fefpf2 从手牌升级并触发升级能力，已查看整屏。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：23 雷轰电掣II | [2CP主要升级](thor-interaction-reaudit-20261027.md#L89) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade；负向约束：升级后固定9分支 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-thunder-strike-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行16 | 独立原卡断言：费用 2、仅替换雷轰电掣为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-0cqogg 从手牌升级并检查费用、等级和对应原技能槽，整屏已查看。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：24 雷霆之力II | [2CP主要升级，含阿斯加德神力下区](thor-interaction-reaudit-20261027.md#L90) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade + 原variant入口；负向约束：不拆第二手牌 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-power-of-thunder-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行17/18 | 独立原卡断言：费用 2、仅替换雷霆之力为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-0cqogg 从手牌升级并检查费用、等级和对应原技能槽，整屏已查看。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：25 瓶中闪电II | [2CP主要升级，含连锁锤击下区](thor-interaction-reaudit-20261027.md#L91) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade + 原variant入口；负向约束：不拆第二手牌 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-bottled-lightning-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行19/20 | 独立原卡断言：费用 2、仅替换瓶中闪电为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-fefpf2 从手牌升级并触发升级能力，已查看整屏。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：26 雷电之轮II | [2CP防御升级，4防御骰](thor-interaction-reaudit-20261027.md#L92) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-upgrade；负向约束：主阶段出升级，防御能力生效时4骰 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；upgrade-thor-thunder-wheel-2；thor-cards 参数化升级/费用/替换断言；能力结果见能力行21 | 独立原卡断言：费用 2、仅替换雷电之轮为2级，记录卡牌并保留其他槽位；正式命令通过。真实页面 e2e-1794525352166-fefpf2 从手牌升级并触发升级能力，已查看整屏。 | passed（S-upgrade 升级牌替换合同；升级后能力效果按对应能力行另审） |
| 卡牌：27 当之无愧 | [1CP投掷，自己一骰设为4或5](thor-interaction-reaudit-20261027.md#L93) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 扩展S-set的两个规则结果候选；选值提示→选骰提示→按旧set自动提交；取消；负向约束：本次11；不得any加减，不得出现1/2/3/6可选结果；合同中旧消费映射须清除 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [abilities.ts](../../src/games/dicethrone/heroes/thor/abilities.ts)；card-thor-worthy / thor-worthy -> buildModifyDieSetInteraction allowedValues=[4,5]；thor-cards 固定值规则断言 | 当前 e2e-1794442456114-eszw2q 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：28 无懈可击 | [2CP投掷，额外弃2驭电，防止所有即将受到伤害](thor-interaction-reaudit-20261027.md#L94) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-response原手牌入口，正式支付及伤害收口；负向约束：少于2驭电不能打/不能扣CP；不是永久护盾 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；card-thor-impenetrable / thor-impenetrable；thor-cards 与 card-timing-response-boundaries 核对目标、2驭电成本与当前伤害防护 | e2e-1794487304872-ennqmc 双人在线预置合法升级、手牌和攻击骰，枪手实际技能生成独立伤害响应；索尔出牌支付两枚驭电、伤害归零且生命保持，三图逐张查看；另有普通攻击代表链。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：29 不屈的意志 | [2CP投掷，攻击后致死门槛，投1骰，4/5成功使自己剩1血](thor-interaction-reaudit-20261027.md#L95) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | S-response + S-bonus；原效果骰确认及继续原伤害事务；负向约束：1/2/3/6失败；独立/同伴伤害不适用；不能只证明弹窗出现 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；card-thor-undaunted / thor-undaunted-settle；thor-cards 在预置致命伤害响应下验证六个骰面及4/5留1血；thor-flow 从正式掷骰与防御自然进入致命伤害响应并验证4点留1血 | e2e-1794470883891-af4zcr 双人在线预置攻击骰和手牌，经实际技能槽产生致命攻击响应，掷4确认后保留1生命；三张新图已逐张查看。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：30 挥锤时刻 | [0CP瞬时，召回，获1CP与1驭电；真召回另获1驭电且同时获得](thor-interaction-reaudit-20261027.md#L96) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原出牌，合法召回自动完成，无重复目标选择；负向约束：已持锤不能伪召回；不得在两枚驭电之间插入抽牌 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；card-thor-hammer-time / thor-hammer-time；thor-cards 持锤/召回时资源合计断言 | 当前 e2e-1794445281670-jbpfay 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：31 雷霆万钧 | [1CP瞬时，自己抽1并获2驭电](thor-interaction-reaudit-20261027.md#L97) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原出牌→抽牌/资源反馈；负向约束：不需要骰子或额外确认 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；card-thor-thunderous / thor-thunderous；thor-cards 抽牌与2驭电结果断言 | 当前 e2e-1794445281670-jbpfay 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：32 风暴来袭 | [0CP瞬时，本回合已两次飞掷后可打；抽1获1CP/1破防/1驭电](thor-interaction-reaudit-20261027.md#L98) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原手牌可用性/出牌流程；负向约束：召回不计飞掷；未满足入口不得看似可用 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；card-thor-storm-brewing / thor-storm-brewing；thor-cards 两次飞掷且召回不计数断言 | 真实页面 e2e-1794515991262-230s8q：两次实际弃牌飞掷、中间实际召回后出牌；对手生命48，索尔7 CP、3驭电、1破防并抽1牌。两图已查看，首图处于生命数字过渡，仅作过程记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 卡牌：33 彩虹桥（推广） | [0CP主要，投1骰；总抽1，6则额外1破防2驭电](thor-interaction-reaudit-20261027.md#L99) | 该卡源账本 S-* 操作族；保留逐卡时机、操作者、目标和费用 | 原出牌+S-bonus；负向约束：常规33卡牌库不含推广；骰面不是主攻击骰，不意外开启重掷 | [thor/cards.ts](../../src/games/dicethrone/heroes/thor/cards.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；card-thor-bifrost / thor-bifrost-settle；thor-cards 两种骰面结算断言 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 同伴/Token操作：破防 | [自己以攻击结束进攻投掷时，可花1投1效果骰；4/5使本次攻击不可防御，失败不退款，可再花剩余枚](thor-interaction-reaudit-20261027.md#L105) | 主动栏、响应、手牌成本或自动状态收口；细分族见源账本 S-* | S-response Token入口 + S-bonus原确认；负向约束：非攻击不能花；满2获新枚前不可提前腾位；每次独立骰与消费 | [tokens.ts](../../src/games/dicethrone/heroes/thor/tokens.ts) + [passiveAbilities.ts](../../src/games/dicethrone/heroes/thor/passiveAbilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；TOKEN.GUARD_BREAK / thor-guard-break-settle；thor-flow 六个骰面、失败仍消费、可再用及成功禁防 | 当前 e2e-1794442456114-eszw2q 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 同伴/Token操作：驭电抽牌 | [持有者自己的主要阶段，付4抽1，每回合总计一次](thor-interaction-reaudit-20261027.md#L106) | 主动栏、响应、手牌成本或自动状态收口；细分族见源账本 S-* | S-passive原主动栏，成本/次数提示来自同一合同；负向约束：main1用了main2不可再用；非主要阶段禁用；可转移持有者也有权用 | [tokens.ts](../../src/games/dicethrone/heroes/thor/tokens.ts) + [passiveAbilities.ts](../../src/games/dicethrone/heroes/thor/passiveAbilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；ELECTROKINESIS_PASSIVE / electrokinesis-draw；thor-flow 转移持有者与跨主要阶段每回合一次 | e2e-1794459319637-asiyx9 双人在线预置索尔1枚、僧侣3枚及公共转移牌，实际选择来源和目标、确认并处理响应后，僧侣花4枚抽牌；同回合预置重新持有后入口不可用。五张原图已逐张查看；重新获得为预置状态。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 同伴/Token操作：驭电增伤 | [只被奥丁、瓶中闪电显式加伤消费，不付成本](thor-interaction-reaudit-20261027.md#L107) | 主动栏、响应、手牌成本或自动状态收口；细分族见源账本 S-* | 共享伤害结果投影，无主动新交互；负向约束：雷霆之力/终极等不能自动加伤 | [tokens.ts](../../src/games/dicethrone/heroes/thor/tokens.ts) + [passiveAbilities.ts](../../src/games/dicethrone/heroes/thor/passiveAbilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；BONUS_DAMAGE_ADDED / Odin、瓶中闪电显式消费；thor-flow 基础/升级奥丁最终结果 | 当前 e2e-1794442456114-eszw2q 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 同伴/Token操作：姆乔尔尼尔付费飞掷 | [只有自己持锤，任意合法窗口弃自己1手牌；选敌人放置，立即独立1不可防御](thor-interaction-reaudit-20261027.md#L108) | 主动栏、响应、手牌成本或自动状态收口；细分族见源账本 S-* | S-passive→S-hand-cost→必要S-choice；负向约束：无牌禁用；弃牌前取消不付费；敌人目标不是只能当前攻击对手 | [tokens.ts](../../src/games/dicethrone/heroes/thor/tokens.ts) + [passiveAbilities.ts](../../src/games/dicethrone/heroes/thor/passiveAbilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；thor-paid-throw -> selectHandCard selectCount=1 -> thor-mjolnir-paid-throw；thor-flow 提示区/取消/支付后移动，另验证无手牌及不持锤时拒绝且状态不变 | 当前 e2e-1794448282175-8zhv6g 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 同伴/Token操作：姆乔尔尼尔付费召回 | [自己不持锤，弃自己1牌；回自己板并获1驭电](thor-interaction-reaudit-20261027.md#L109) | 主动栏、响应、手牌成本或自动状态收口；细分族见源账本 S-* | S-passive→S-hand-cost→自动固定目标结果；负向约束：持锤禁召回；取消不弃牌；一次付费不能飞掷+召回 | [tokens.ts](../../src/games/dicethrone/heroes/thor/tokens.ts) + [passiveAbilities.ts](../../src/games/dicethrone/heroes/thor/passiveAbilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；thor-paid-retrieve -> selectHandCard selectCount=1 -> thor-mjolnir-paid-retrieve；thor-flow 取消/召回/驭电，另验证无手牌及自己持锤时拒绝且状态不变 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 同伴/Token操作：姆乔尔尼尔免费移动 | [只由当前能力规则授权的次数执行，不弃牌](thor-interaction-reaudit-20261027.md#L110) | 主动栏、响应、手牌成本或自动状态收口；细分族见源账本 S-* | 能力S-choice；按当前锤位置推导方向，能停止的分支保留停止；负向约束：每次完整独立伤害后继续；不能跳中间响应；终极维持禁对手行动 | [tokens.ts](../../src/games/dicethrone/heroes/thor/tokens.ts) + [passiveAbilities.ts](../../src/games/dicethrone/heroes/thor/passiveAbilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；thor-hammer-moves -> thor-mjolnir-move；thor-companion 0/4次、多人候选；thor-flow 逐次响应与终极边界 | 当前 e2e-1794442456000-hlpzif 已验证对应代表路径；具体断言及人数边界见本页最新记录。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |
| 同伴/Token操作：姆乔尔尼尔持有者被击败 | [多人敌人持锤且被击败时自动召回，仍获1驭电](thor-interaction-reaudit-20261027.md#L111) | 主动栏、响应、手牌成本或自动状态收口；细分族见源账本 S-* | 原击败后状态反馈，无新选择；负向约束：不制造第二个锤子；不变成普通可移除/可转移状态 | [tokens.ts](../../src/games/dicethrone/heroes/thor/tokens.ts) + [passiveAbilities.ts](../../src/games/dicethrone/heroes/thor/passiveAbilities.ts) + [customActions/thor.ts](../../src/games/dicethrone/domain/customActions/thor.ts)；collectThorCompanionFollowups -> moveMjolnir；thor-companion 击败持有人后的单一位置与驭电 | e2e-1794462748324-erta1u 真实四人房间预置低血量、持锤和攻击骰，实际目标骰及防御后敌队败北，截图可见索尔重新持锤；两图逐张查看。正式命令链覆盖直接受击持锤者及受击其队友两种分支。 | representative_only：本行证据覆盖已列路径，剩余边界按本页及源账本核对。 |

### 当前共享合同修复记录

| 问题 | 根因 | 修复口径 | 验收证据 |
| --- | --- | --- | --- |
| 普通效果骰结算有确认动作却无提示 | bonusSettlement 联合分支禁止 hint，右侧只显示 multistep 提示 | 所有可操作合同分支都必须携带提示；纯结算态提示由同一合同生成 | 合同、RightSidebar、DiceTray目标测试已通过；Thor当前真实入口 E2E/全屏截图待运行 |
| 骰子多步输入允许从缺失元数据臆造单骰/普通重掷语义 | UI parser 对 selectCount 默认1、对缺失 selectionMode 默认 reroll；系统转换对缺失数量同样默认1 | 拒绝无效骰子输入合同，数量与操作语义由来源明确给出 | 合同/客户端投影/DiceTray目标测试已通过；systems.ts来源输出已静态核对；Thor当前真实入口待运行 |
| 成功 Token 闪避在骰子次数归零时落回禁用的普通确认 | 闪避结算是 `dt:token-response`，不是奖励骰 `dt:bonus-dice`；旧合同未表达此消费者 | 新增受当前响应玩家校验的 `tokenResponseSettlement`，沿旧 ResponseWindowHint、右侧原确认动作和 `onConfirm` 收口；不增加按钮或重复提示 | 合同、DiceTray、GameHints 目标测试通过；月精灵真实闪避 E2E 尚待当前源码复跑 |

### 最新实时 UI 验收状态（2026-10-29）

- 历史首轮 6 项曾在截图门禁因提示遮住 `tip-board` 而失败；第二轮有 4 项通过、2 项几何失败。第二轮 23 张图曾逐张打开，但均属于锚点修复前源码，仅作诊断，不登记为当前源码 PASS。
- 最新修改把同一合同生成的提示放在右侧栏外框右沿，并保留相对骰盘顶部的垂直位置。目标 ESLint、`git diff --check` 与 `RightSidebar.contract.test.tsx` 4/4 通过；这只证明语法/合同接线，不替代最新截图几何复验。
- 2026-10-29 `thor-full-reaudit-20261029-r3` 初始前端指纹为 `0a15275c…`。它与 Doctor Strange `r12` runtime 重叠，Thor 用例前三项在没有最终汇总前被内存看门狗以可用内存 0.14% 终止，后三项未运行；Playwright 自动失败图无 `shot` helper sidecar，因此不核图、不登记。
- 截至 2026-10-29 08:34 UTC，Doctor Strange `r13` 仍是活跃隔离 runtime；未停止该任务。等待它空闲且工作区输入稳定后，Thor 三组 E2E 仍待重跑。

### 状态词

- 静态复核一致；当前源码 E2E/图面未收口：规则源与当前实现逐对象静态对照一致；本轮当前源码截图未通过，也不代表交互行为已经通过完整 E2E。
- 共享组件代表测试不能自动把其他对象标为通过；只有规则语义、操作者、候选、确认/取消和权威后态一致的对象才可共用该证据。
- E2E 通过仍需对当前运行目录内每张整屏截图逐图检查；代表态/状态注入必须标注，不证明自然创建该窗口。

## 2026-10-31 当前运行与对象覆盖结果（覆写旧待运行状态）

- 当前源码 E2E 批次：`e2e-1793384355862-i04ube`，`shared-single` runtime；`thor-interactions.e2e.ts`、`thor-rule-interactions.e2e.ts`、`thor-online-entry.e2e.ts`、`thor-2v2-shared-dice-real-entry.e2e.ts` 共 25/25 通过，批次 4/4 文件通过。定向 Vitest 11 个文件、228/228 通过。旧表中“当前源码待重跑”的标记由本节覆盖。
- 执行命令：
  - `$env:PW_E2E_SERVICE_REUSE='shared-single'; node scripts/infra/run-e2e-batch.mjs default --files e2e/dicethrone/thor-interactions.e2e.ts e2e/dicethrone/thor-rule-interactions.e2e.ts e2e/dicethrone/thor-online-entry.e2e.ts e2e/dicethrone/thor-2v2-shared-dice-real-entry.e2e.ts -- --retries=0`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/thor-flow.test.ts src/games/dicethrone/__tests__/thor-companion.test.ts src/games/dicethrone/__tests__/thor-cards.test.ts src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts src/games/dicethrone/ui/__tests__/diceInteractionContract.test.ts src/games/dicethrone/ui/__tests__/DiceTray.test.tsx src/games/dicethrone/ui/__tests__/GameHints.test.tsx src/games/dicethrone/ui/__tests__/RightSidebar.contract.test.tsx src/games/dicethrone/ui/__tests__/clientDiceMultistepInteraction.test.ts src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx src/games/dicethrone/ui/__tests__/handDiscardInteractionContract.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：Playwright 4 文件 25/25；定向 Vitest 11 文件 228/228。Vitest 负向路径日志与缺失音效警告不是失败项。
- 本批 102 张截图均为 1920×1080，102 份状态 sidecar 均绑定 `D:\\gongzuo\\webgame\\BoardGame::shared-single`。去重后检查了 1,185 个 sidecar 声明的源码文件，与当前磁盘哈希差异为 0；源码图中实际加载的游戏专属目录只有 `src/games/dicethrone/`，其余 `src/games` 项是共享根级运行时模块。图面逐张审查仍待单独记录，E2E 通过本身不把图面升级为 PASS。
- 100 份 Thor `shot` sidecar 的提示与弃牌几何机检均无视口越界或受保护区域相交；另外 2 份双人在线入口 sidecar 使用独立结构，不纳入该几何计数。此项是机检旁证，不能替代 102 张图的逐图目视检查。
- 手牌放大用例曾在旧全套运行中缺失 `board-magnify-overlay`；同一动作脱离套件重复两次及本批全套运行均通过。没有发现可复现根因或针对性源码修复，因此记录为“本批未复现”，不称其已修复；保留用例断言。
- 本次直接行为覆盖：06 组选重掷、空选沿原确认收口；27 固定 4/5、未提交时取消退款、再提交；普通选骰提示的次数/重复同骰/下一步确认；真实四人 2v2 中队友打出 11/14/16，由当前骰主索尔操作原骰盘；09 队友减伤并让索尔继续原伤害事务；真实双人房间选角并开局。02/06/07/08/09 槽截图与结果状态均来自本批当前源码。
- 09、11、14、16 在本批真实四席线上对局入口中分别验证；骰子/阶段和 09 的待受伤害窗口使用合法代表态注入。09 证明既有待伤害事务中的队友出牌、减伤与继续扣血，不证明自然攻击链自动创建该响应窗口；本批不覆盖移动视口。

| 对象集合 | 逐项规则/旧流程审计 | 当前浏览器直接行为覆盖 | 明确未覆盖的独立浏览器对象 |
| --- | --- | --- | --- |
| 21 项能力/变体 | 21 行仍逐项引用原规则和旧入口，覆盖触发、结果、权限及禁项；领域测试只作为对应规则结果证据 | 奥丁之力基础/II、连锁闪电基础/II、瓶中闪电基础/II、连锁锤击下区、雷电之轮基础/II、为了阿斯加德基础 | 雷神之锤基础、驭雷策电基础、雷轰电掣基础、雷霆之力基础、雷神之锤II、雷神之锤III、驭雷策电II主区、电闪雷鸣（II下区）、雷轰电掣II、雷霆之力II主区、阿斯加德神力（II下区）。这些对象有逐行静态/领域审计，不借同族截图宣称浏览器直测通过。 |
| 34 张物理卡 | 34 行逐卡核对原图、规则字段、费用、时机、目标与共享流程；升级卡与能力效果分开登记 | 09、11、14、16、17、27、28、29、33；升级卡21、22、25、26 | 00–08、10、12、13、15、18、19、20、23、24、30、31、32 的卡牌效果没有本批独立浏览器结算图。30 被放大、31/30 可作为成本弃牌，不等于其牌面效果已做浏览器验收。 |
| 7 类 Token/同伴操作 | 7 行分别核对正式状态、旧操作入口、权限、费用、次数和清理语义 | 破防、驭电抽牌、驭电增伤、姆乔尔尼尔付费飞掷、付费召回、免费移动 | 姆乔尔尼尔持有者被击败后的自动转移仅有领域/静态证据；无本批浏览器后态图。 |

本表中的“逐项审计”指规则真源和旧操作语义已逐行核对；“浏览器直接覆盖”只指列出的实际 E2E 对象。余项明确是当前浏览器范围债务，不被共享组件通过或历史图补齐。

### 2026-10-29 实时续审增量

- 08:45 UTC `r4` 首条真实入口行为 E2E 1/1 通过，但 9 张截图中的 06/07/08 提示与 `tip-board` 相交，视觉 `REVISE`；它暴露了截图 helper 未把几何记录转成不遮挡断言。
- 修复骰盘上沿锚点及截图几何断言后，08:50 UTC `r5` 同链 1/1 通过；9 张图逐张复核，提示与提示板/玩家栏/骰盘不相交。弃牌选牌、取消、空选确认、组选重掷、结算确认画面沿旧交互呈现，无重置所选按钮。该 run 指纹为 `22244a30…`。
- r5 后共享工作区的 DiceThrone `AbilityOverlays.tsx`、`flowHooks.ts`、`reducer.ts`、`rules.ts` 与 `customActions/*` 于 08:54–08:57 UTC 更新，当前工作区指纹 `e4fbb3ef…`；因此 r5 只作诊断，不是最终当前源码证据。保留其它任务改动，待输入稳定两分钟后重跑。

### 2026-10-29 共享消费者再审

- 旧版 `DiceActions` 的 `isBonusDiceSettlement` 兼容范围也承载 Token 闪避成功后的右侧确认。重构初版只把 `dt:bonus-dice` 纳入合同，漏掉 `dt:token-response`，因此 `rollCount=0` / `rollConfirmed=true` 时普通确认会禁用。已补独立合同变体并把当前响应者、原确认按钮和原响应提示接入共同投影。
- 11 个 Thor/共享交互测试文件 186/186 通过；出牌条件独立审计 131/131 通过。普通提示位置已恢复到 `GameHints` 原顶部居中；组选提示仍由原骰盘承载。当前源码 E2E 与图面验收仍未由这些单测代替。
- 前端指纹 `e9fc4abf89c476c4c173bbaef816724112d2119dec6238c516174a74bc080ceb` 在 10:44 与 10:45 UTC 两次读取一致。此后 Doctor Strange 隔离 E2E 正运行；需等它结束再串行运行 Thor、Token 闪避和 2v2 场景。

### 2026-10-29 11:05 当前提示位置纠正

- 已撤销的历史归因：当时仅按 `HEAD` 旧实现把 `left-center` 判错并改回顶部，同时改写两英雄测试期望；没有保留用户已明确的位置裁定。该记录仅用于追查误改来源，不能作为后续恢复顶部的依据。
- 11:02–11:05 UTC 有后续 DiceThrone 共享代码保存，186 项目标套件的运行时间早于部分写入，不能代表最新版本；完整目标回归待新的源码稳定窗口。
- 最近一次记录的前端 hash 为 `c597623b194a367dcb9f708fd079bdd2515a6e32f7c86ecadcaa217d7246a6dd`，对应最后观察到的源码写入时间 11:05:08 UTC。无活跃 E2E runtime；E2E doctor 可用内存约 1.4GB，暂不启动，避免复现 OOM。

### 2026-11-01 当前源码交互复审与展示媒体

- 最新相关浏览器运行取代上面的待运行记录：`e2e-1793502053186-pq2d31`（索尔主交互与规则交互 23/23）、`e2e-1793502626583-rm9ukl`（双人选角开局 1/1）、`e2e-1793503226459-3i4yfg`（四人 2v2 共享交互 1/1）。合计 25/25，四个 E2E 文件通过；本轮定向 Vitest 11 个文件 228/228 通过。
- 三个运行共 113 张整屏截图及 113 份状态 sidecar；核对 1,101 个唯一源码输入，缺失 0、哈希漂移 0。此核验只覆盖 sidecar 声明的实际消费输入。
- 用户交付媒体组收录 34 张当前整屏图：索尔角色板与手牌成本 4 张、06 奥丁组选/空选 5 张、11 固定值/取消重提 6 张、2v2 队友重投与伤害响应 19 张。34/34 有逐图 `PASS`；9 组视觉代表态、0 张合同外媒体。清单、索引与逐图报告位于 `test-results/evidence-screenshots/dicethrone/thor-shared-interactions-final-20261101/`，逐图报告为 `evidence/dicethrone/thor-visual-review-20261101.json`。
- 视觉结论限于上述 34 张最终展示媒体，不外推到另外 79 张采集图。未展示原始图没有登记为逐图 PASS；浏览器行为边界仍按本表“当前浏览器直接覆盖 / 明确未覆盖”两列执行。
- 当前直接复核确认：06 仍走原骰盘组选、原重掷与原确认，空选沿原确认收口；11 只给固定 4/5，沿旧点骰流程提交，取消不改骰并退回卡牌/费用；弃牌成本沿手牌区原操作；2v2 队友出牌后由当前骰主索尔操作原骰盘。
- 2v2 的 09 待伤害响应由合法代表态注入，不证明自然攻击链自动创建该窗口；移动视口及矩阵所列独立浏览器对象仍未覆盖。领域/静态证据不代替这些缺口。

## 2026-11-01 当前源码证据增补（`e2e-1793539933248-w3ijl2`）

本增补覆盖当前四个 Thor 真实入口 E2E 文件的 25/25 结果、定向 Vitest 十一个文件的 230/230 结果，以及本包 24 张新交互整屏图的逐图图审：[`索尔当前交互复审图包`](thor-interaction-reaudit-e2e-1793539933248-w3ijl2/focused-pass-manifest.json)。它更新下列已有静态行的当前入口证据，但不把抽样 UI 代表态外推成 62 行整体通过：

| 当前入口/交互族 | 当前证据 | 保留的未覆盖边界 |
|---|---|---|
| 奥丁之力II与效果骰选择 | 真实骰盘等待选择、两颗所选骰子的旧重掷/确认、空选原确认；当前 25/25 E2E | 仅覆盖对应代表状态，不等同全部能力与升级变体通过 |
| 当之无愧固定改骰 | 只出现固定 4/5；选择骰、提交 4、选择 5 后取消退款均有当前行为与整屏图证据 | 不外推至其它改骰卡的任意值、增减、复制和目标权限 |
| 原任意改值流程 | 当前图显示旧逐骰加减控件、数值预览、手动确认与单骰提交结果 | 只直接覆盖一条任意改值分支，不外推到其它卡牌的目标及权限 |
| 连锁闪电基础与二级 | 基础效果骰选择、二级四颗候选及选中两颗后的旧确认均有当前整屏图 | 其它能力效果与附属目标未由本图包覆盖 |
| 弃牌成本与破防 | 弃牌飞掷、召回成本复用原手牌区；破防失败后仍可操作第二枚标记 | 其它手牌成本、Token 消费与状态分支保持原行状态 |
| 公共卡 09/11/14/16 | 当前四席入口验证队友授权、索尔骰主选择、11 同骰两次、14 任选两骰，以及 09 减伤后待伤害变化 | 09 响应窗口为合法代表态注入；公共卡 16 的防御骰盘选择有一张当前图；其它公共交互仍不由本图包证明 |
| 真实线上角色板 | 索尔在真实双人选角与牌桌入口显示九槽角色板 | 不代表移动端、新手流程或完整角色局部的整体视觉验收 |

历史行内“待当前源码重跑 / 当前源码图面尚无有效 PASS”仅对上表明确列出的直接覆盖状态由本增补更新；其它矩阵行仍按原状态保留，直到获得各自直接证据。

## 2026-11-01 同批当前源码图面增补：选择模态层

本次续审在既有 e2e-1793539933248-w3ijl2 图包增加 5 张图，当前合计 29 张、18 组。逐图审查新增同牌多变体、瓶中闪电 II 神锤移动至次数上限、基础瓶中闪电零次停止三类代表态；通用选择模态层承载变体/玩家目标/停止选择，弃牌成本仍由 HandArea 承载。该证据更新相关当前入口状态，不把背景牌桌或代表态外推为全角色 UI/规则通过。

| 当前入口/交互族 | 当前直接证据 | 保留边界 |
|---|---|---|
| 同牌多变体与神锤移动 | 图 25 显示瓶中闪电 II / 连锁锤击选择；图 26–28 显示目标/停止、飞掷后召回更新、到上限后回攻击响应；图 29 显示基础瓶中零次停止后回攻击响应 | 零次停止图未覆盖中途停止后的独立终态；移动端和其它能力变体仍未覆盖 |

本增补只更新上表直接涉及的对象；矩阵其余行及 62 项整体状态继续保持待覆盖。

## 2026-11-01 当前图包追加：不屈意志响应

当前图包增至 30 张、19 组。图 30 直接检查不屈意志的效果骰提示、结果和原确认动作，并核对待响应生命及费用在同屏可读。窗口来自合法代表态准备，不能外推为自然攻击链创建响应窗口的证明；其它未覆盖矩阵对象继续开放。

## 2026-11-01 补充：中途停止真实交互

新增浏览器用例实际执行一次飞掷后点选停止，1/1 通过；图 31 显示目标仍持有姆乔尔尼尔、生命为 49、移动窗口关闭且原攻击响应恢复。该项使用独立隔离运行并已加入 31 张视觉 PASS 图包。证据只覆盖瓶中闪电二级的一次飞掷后停止状态；其余矩阵对象、移动端和不同能力分支继续按各行保留未覆盖状态。

## 2026-11-02 当前源码续审：共享合同与四项问题对象

- 本轮重新锁定四个易混淆对象：能力槽 06 奥丁之力 II 组选重掷；公共卡槽 11“不愧是我”重复重掷；公共卡槽 12“惊不惊喜”任意改值；索尔技能槽 27“当之无愧”固定四或五。规则源分别区分了这些语义，不能用相邻卡牌或错误实现推导测试预期。
- 当前真实浏览器结果：`thor-interactions.e2e.ts` 6/6、`thor-rule-interactions.e2e.ts` 18/18、`thor-online-entry.e2e.ts` 1/1、`thor-2v2-shared-dice-real-entry.e2e.ts` 1/1，合计 4 个文件 26/26。定向 Vitest 15 个文件 270/270；它们证明各自规则/合同，不代替图面判定。
- 当前用户图包 [`四项索尔交互整屏图`](thor-new-interaction-review-20261102/focused-pass-manifest.json) 收录 9 张 1920×1080 当前源码整屏截图，按 4 条操作族分组。逐图 9/9 `PASS`，旧新对照 4/4 `PASS`，证据门禁通过；每张图的原图哈希与复制哈希一致。9 份 sidecar 声明的 1,103 个唯一源码文件均存在且哈希一致，缺失 0、漂移 0。

| 对象 | 当前直接行为与图面 | 旧流程保留 | 仍不证明 |
| --- | --- | --- | --- |
| 槽 06 奥丁之力 II | 原骰盘候选、选择两骰、原重掷和原确认收口；未出现“重置所选” | 仍由原骰盘和原动作槽承接 | 不外推到全部效果骰能力/升级变体 |
| 公共卡槽 11“不愧是我” | 四席入口里队友出牌、索尔骰主重复选同骰、次数进度和服务端重掷结果 | 原骰盘、原投掷与确认按钮 | 2v2 以合法代表态准备；不替代其它公共卡的权限/结算 |
| 公共卡槽 12“惊不惊喜” | 当前图显示加减预览、取消、手动确认及单骰结果 | 保留任意改值的旧语义，不套用固定值选择器 | 不外推到其它任意改值卡的目标、费用和权限 |
| 技能槽 27“当之无愧” | 当前图仅显示固定四或五，不出现加减控件；行为套件覆盖目标骰提交、取消不改骰和退款 | 按原“先选值、再点骰”语义提交 | 当前交付图只证明固定候选的可见状态，不代替其它改骰能力 |

规范入口复核结果：`.spec/AGENTS.md` 强制写操作前执行 `before-you-code`；该 skill 冻结新增/旧 UI 范围并在未锁定前禁止写入；`ui-change-gates` 要求新 UI 只能由其真实操作态证明；`e2e-verification` 规定逐图、来源哈希、目录和开图前门禁。四项规则各有一个 canonical source，知识索引有对应入口；正向搜索命中、重复执行正文的负向搜索未发现副本，入口顺序回放与阻断条件一致。规范本身覆盖了本轮问题，当前偏差归因于执行时没有按入口先锁范围/按真实图验收；本增补不再建立第二份规范正文。`npm run spec:lint` 本次复跑通过。

剩余范围：这 9 张图只证明表内四类新交互。62 行矩阵仍含未做当前浏览器直接验收的能力、实体卡与同伴状态；移动视口未覆盖；公共卡 09 的待伤害窗口由合法代表态注入，不证明自然攻击链自动创建该窗口。没有把这些边界升级为全量 PASS。

## 2026-11-02 后续：当前共享源码变化与复审记录

- 用户随后明确普通重投提示以骰盘左侧垂直居中为基线，骰盘上方留给攻击修正提示；本文件开头和历史增补中把普通重投提示定为顶部居中的说法作废。共享提示由另一项任务处理，Thor 侧不改其组件。
- 06 实际入口运行 `e2e-1793585266203-50xm9n` 失败：测试期待 `tray-top`，页面返回 `tray-left-center`。失败整屏图显示提示遮住右侧提示板文字；该图仅记录失败状态，不能作为视觉 PASS。共享源码之后继续变化，须在共享修改完成后重新运行并核对当前画面。
- 付费召回与驭电抽牌真实入口 `e2e-1793585532601-dw9qwd` 1/1 通过；已查看四张整屏图，选择弃牌时使用手牌区及取消提示。采集后首次核对 1,368 个来源文件，缺失和漂移均为 0；随后共享源码继续变化，不能将该批图直接视为最新源码的最终验收。
- 瓶中闪电 II 飞掷一次后停止的真实入口 `e2e-1793585749850-hgsusn` 1/1 通过；实际打开选择层与停止后状态图，旧运行与本次选择层图片 SHA-256 相同。复核时 `InteractionOverlay.tsx` 和 `diceInteractionContract.ts` 已相对 sidecar 漂移，故该图只证明采集时画面，当前源码仍须重拍。
- 按独立规则账本补充基础雷轰电掣目标持锤和不持锤的规则断言；Thor 领域、卡牌、同伴三文件当前运行 91/91 通过。该结果不证明全部 62 行真实入口或图面通过；任务 6/7 继续保持打开。

## 2026-11-02 续跑：破防与防御入口

- 破防连续消费真实入口 `e2e-1793604455419-3lih44` 在第一枚效果骰截图处失败：提示与提示板相交。已打开原始整屏图确认遮挡；后续第二枚消费及最终结算本次未执行，保持未通过。
- 雷电之轮基础三骰 `e2e-1793604753517-tkdgl5` 和二级四骰 `e2e-1793605007969-0zs56x` 真实入口各 1/1 通过；已逐张查看各自三张整屏图。对应骰盘显示三颗或四颗骰子并沿原确认入口；结算图出现旧的对手思考提示，不将其作为本轮新增 UI。两个测试用合法待攻击代表态准备防御，不证明自然攻击链创建该前态。
- 三骰 sidecar 首次核对 1,372 个来源文件、四骰核对 1,371 个；均缺失 0、漂移 0。此记录仅覆盖两条防御入口，后续源码变动时须重新核对；未登记为完整角色截图包。
- 神锤移动五条真实入口 `e2e-1793605412770-r1726f` 5/5 通过，覆盖瓶中基础零次停止、瓶中二级三次及中途停止、连锁锤击六次、终极四次。21 份截图 sidecar 的 1,036 个唯一来源文件缺失 0、漂移 0；已实际查看其中六个不同状态，其余原图尚未逐张审查，不作为最终图包或全量视觉 PASS。
- 公共卡出牌时机审计使用 `vitest.config.audit.ts` 定向运行 131/131 通过；该项只证明测试覆盖的合法性边界，不能外推卡牌结算或玩家界面。默认 Vitest 配置排除 audit 文件，因此首次直接运行未找到测试，已改用审计配置。
- 双人真实房间 `e2e-1793606949853-1jqbah` 1/1 通过；截图前后运行时和源码身份一致，两张图已实际查看，1,162 个唯一来源文件缺失 0、漂移 0。截图直接覆盖索尔选角实施中标记和开局角色板；普通手牌处于原底部收纳态，不据此宣称手牌布局通过或修改了手牌 UI。
- 索尔公共卡 03“起开”真实入口 `e2e-1793612045190-a08u7l` 1/1 通过：选对手两层气、确认后剩一层，支付 1 CP 且牌进入弃牌堆。候选、选中和结果三张整屏图已实际查看；1,370 个来源文件缺失 0、漂移 0。该项覆盖一条移除单层状态路径，不外推其它目标、取消或状态转移路径。
- 索尔公共卡 00“乾坤大挪移”真实入口 `e2e-1793613835306-r8f8pa` 1/1 通过：从对手两层中毒中选择来源、选索尔为目标并确认，转移一层，神锤不作为来源候选且仍由索尔持有。四张整屏图已实际查看；1,370 个来源文件缺失 0、漂移 0。该项不外推取消、其它状态和多人目标。
- 索尔公共卡 01“状什么态”真实入口 `e2e-1793616621763-y20v9y` 1/1 通过：选择对手并清除其两类状态，索尔神锤保留，支付 2 CP 且牌进入弃牌堆。三张整屏图已实际查看；1,371 个来源文件缺失 0、漂移 0。该项不外推其它目标或取消路径。
- 索尔公共卡 04“超级加倍”和 05“加倍”补充正式出牌结果断言：分别支付 2/1 CP，从索尔牌库抽 3/2 张并弃置已打出的牌。Thor 领域、卡牌、同伴三文件现共 93/93 通过；这两项不新增 UI，不由规则测试冒充图面验收。
- 索尔公共卡 06“拜拜了您内”真实入口 `e2e-1793639100761-17lolk` 1/1 通过：投掷阶段瞬时出牌、选择对手气并确认后只移除一层，支付 2 CP 且返回原阶段。三张整屏图已实际查看；1,370 个来源文件缺失 0、漂移 0。该卡槽编号与能力槽 06 奥丁之力 II 不是同一对象。
- 共享改骰和响应权限两文件 14/14 通过，直接覆盖锁定骰可修改、对手不得使用只授权骰主的卡、额外投掷由骰主操作及进攻/防御阶段限制；不证明弹一手的所有边界点数、索尔实际页面或当前提示图面通过。

## 2026-11-03：改骰命令合同复审

- 以本矩阵对应的独立规则账本为预期，经正式出牌和 `MODIFY_DIE` 命令复现：弹一手接受超过一格的变化、玩得六啊接受非 6 点、俺也一样允许修改来源骰为任意点数。修复前负向用例失败，表明权威命令缺少相应校验；并非通过界面限制即可证明服务端符合规则。
- `validateModifyDie` 现校验整数、固定值、相对当前骰面的调整范围及复制来源骰的权威点数。正式流程测试覆盖边界 1/6、错误固定值、复制来源与目标错误值，以及合法操作；Thor flow 与 cards 两文件 85/85 通过。该修复没有改动旧骰盘 UI，规则测试也不替代真实页面验收。
- 扩审八文件曾得到 347/349：四人模式“第一名对手强制重掷后第二名对手继续干预”和“攻击修正卡在目标写回前结算”两条失败。两条路径没有 `MODIFY_DIE`，不能归因为本次校验变更，也不能计作通过；需要独立定位和复验。
- 骰子共享规则补充回归三文件 18/18 通过，包含锁骰复制和奖励骰复制。旧的 `dicethrone-watch-out-spotlight.e2e.ts` 因测试文件内浏览器路径被编译器解析失败，未能运行；不将其计为浏览器通过。
- 索尔真实入口 `e2e-1793667001151-xvyk5x` 拖出“俺也一样”后进入原骰盘复制来源选择，但在首张截图的提示与提示板相交断言失败。已打开失败原图确认提示覆盖提示板；来源、目标选择及最终结果未执行，不能算交互或视觉验收通过。该项等待共享提示修复后按同一入口重跑。
- 2026-11-03 重跑四人共享流程两条失败仍可复现：一条自动收口后测试再次发送确认，另一条中间 continuation 与旧断言不同；尚未完成最终结果与规则合同对照，不能据此判定测试过时或实际结算正确。
- 同日连锁闪电真实入口第一次重跑被内存看门狗终止（可用内存连续三次不高于 1%），没有完成结果；共享端口可复用，不能将该次中断归因为端口冲突。后续须重新完整执行。
- 连锁闪电二级第二次真实入口 `e2e-1793667714488-4gb220` 已进入效果骰确认，但断言仍要求 `tray-top`，实际锚点为 `tray-left-center`，因此失败；四骰选择和结算没有执行。历史测试位置期望与用户后续普通重投基线存在冲突，不能仅据该断言认定实际提示位置有错，也不能因此放弃提示板遮挡检查或将该场景判为通过。
- “当之无愧”真实入口 `e2e-1793667933749-7mj7uy` 进入选骰前，旧测试期望 viewport 顶部，实际使用骰盘左侧提示，锚点断言失败；选值、选骰和权威结果未完整运行。此项与共享提示裁决及遮挡修复同步复验，不用改期望伪造通过。
- 2026-11-03 依据用户对普通重投提示的左侧居中裁定，单独更正 2v2 队友重投的旧顶部锚点断言；未改变固定改骰或效果骰锚点预期，也未削弱截图遮挡检查。`e2e-1793672401669-v2diko` 运行通过锚点检查后，在队友打出“不愧是我”的截图处因提示和提示板相交失败；实际重投及该测试后续场景没有执行，保持未通过。ESLint 和目标文件 diff 空白检查通过。
- 当前 Thor 正式命令、卡牌及同伴三套领域测试重新执行为 97/97；仅证明覆盖到的规则分支，不代替四人真实交互和逐图验收。
- “无懈可击”真实入口 `e2e-1793672696944-29z9ol` 1/1：以合法代表态准备 5 血、8 点待受伤害，实际出牌后伤害归零并继续结算，最终生命 5、CP 3。三份 sidecar 声明的 789 个唯一源码文件当前缺失 0、哈希漂移 0；截图尚未逐图审查，因此只记行为通过，不证明自然攻击创建待伤害窗口或视觉通过。
- “不屈意志”两种效果骰分支 `e2e-1793673494254-efrpey` 均在效果骰确认前的截图检查因提示遮挡提示板失败；骰值已出现，确认、伤害和最终生命未执行，两个真实入口均未验收通过。领域测试覆盖的结果不能替代这次未走完的玩家路径。
- 瓶中闪电 II 飞掷一次后主动停止真实入口 `e2e-1793673629420-9dj0ik` 1/1：锤子留在对手处、对手损失 1 点生命、主攻击仍待继续；五份 sidecar 的 796 个唯一源码文件缺失 0、漂移 0。该次截图尚未逐图审查，暂只记行为和源码身份通过。
- 神锤零次停止、瓶中 II 三次、连锁锤击六次和终极四次真实入口 `e2e-1793673827070-d7bh6o` 4/4 行为通过。16 份截图 sidecar 的 797 个唯一源码文件当前缺失 0、漂移 0；尚未逐图视觉审查，不作截图 PASS。
- 雷电之轮基础三骰和二级四骰 `e2e-1793674096338-lrwsj0` 2/2 行为通过，分别按原防御入口投出 3/4 骰并结算生命；使用代表性待攻击前态，不证明自然攻击链。六张截图对应 796 个唯一源码文件缺失 0、漂移 0；截图尚未逐图视觉审查。
- 付费召回及驭电抽牌、“起开”、“拜拜了您内”、“乾坤大挪移”、“状什么态”当前源码真实入口 `e2e-1793674277602-2ia1sl` 5/5 行为通过；覆盖弃牌成本、单层移除、状态转移、神锤排除和清除对手状态。17 张截图对应 793 个唯一源码文件缺失 0、漂移 0；截图尚未逐图视觉审查。
- 双人真实房间入口 `e2e-1793674524879-ndxwd2` 1/1：索尔可从选角以实施中状态进入牌桌；两张截图对应 1,163 个唯一源码文件缺失 0、漂移 0。该结果仅覆盖入口，截图尚未逐图视觉审查，不代替规则和新交互验收。
- 弃牌飞掷及奥丁连贯用例 `e2e-1793674654052-pn5y0b`：实际经过原手牌区选择、取消不扣资源、重新选择弃牌及飞掷后对手扣 1 血/持锤；随后奥丁效果骰处因旧 `tray-top` 锚点断言失败，组选与结算未执行。失败前五张图的 798 个来源文件缺失 0、漂移 0，尚未逐图视觉审查；整条 E2E 保持失败。
- 四人强制重掷复审发现选目标交互的领域 ID 与引擎 ID 不同，完成事件未关闭父交互，导致骰子确认后无法继续到第二名对手。修正 ID 匹配后原确认及第二名对手流程测试通过；相关七文件共 264/264 通过。攻击修正牌临时骰保持父攻击阶段的测试期望也按已有 continuation 合同修正。共享修复后的付费召回 E2E 1/1 通过；弃牌飞掷前段走完，整条 `e2e-1793676023774-wl9fpk` 仍在奥丁旧锚点处失败，未完成视觉验收。
- 拆出弃牌飞掷真实入口 `e2e-1793676929632-2thg9c`，取消和重新支付并结算 1/1 通过。三张 1920×1080 原图逐张检查：弃牌提示和取消按钮可见，候选在原手牌区，无卡池弹窗；取消后手牌和锤子保留，支付后手牌消失、对手生命显示 49 且获得锤子。此视觉结论仅覆盖该单手牌桌面路径；普通手牌底部收纳沿旧 UI，不扩展为全部交互通过。789 个源码文件缺失 0、漂移 0。
- 瓶中 II 一次飞掷后停止 `e2e-1793676484500-hj24pm` 的五张原图逐张检查：双变体选择、升级牌面、飞掷/停止、召回/停止以及停止后响应均可辨认；只覆盖该桌面分支，不外推其它移动次数或整体视觉验收。

## 2026-11-03 遮挡判定纠正

- 上文将提示与背景提示板的矩形相交直接判为遮挡缺陷、要求修复共享提示的结论作废；不同层相交本身不能判失败。此前因此提前中断的用例仍需完整重跑，不能倒推为通过。
- 骰盘左侧居中是现有骰盘交互的提示位置；测试改按该基线检查。视觉结果以真实截图判定，关键操作通过实际点击及权威状态变化验证。
- 奥丁组选重掷 `e2e-1793688307724-ue0wpb` 行为 1/1，已查看等待选择及选择两骰整屏图：提示、骰子选中标记与重掷/确认按钮可辨认；该结果只覆盖此桌面分支。
- `e2e-1793688501375-sfr7mo` 主交互文件 6/6；已查看“当之无愧”固定点数选择和选值后选骰两张图，4/5 候选、提示及原骰盘可辨认；该行为测试也覆盖取消不提交，尚不代表全部索尔交互已完成图审。
- 四人用例原断言期待“2/2”，旧版本 `RightSidebar` 在选满后实际使用“完成”；只修正该旧提示预期，完整多人提交与结算仍以重跑结果为准。
- `e2e-1793689604447-drpav8` 规则交互 24/24，`e2e-1793688501375-sfr7mo` 主交互 6/6；各自只证明实际覆盖的行为，不外推矩阵其余对象。
- `e2e-1793693456198-ky2uxy` 在同一轮覆盖弃牌飞掷、奥丁组选、当之无愧固定改骰、任意改骰和四人共享骰，5/5 通过；已逐图查看这五条流程各三张整屏图。采集结束后源码哈希无漂移；后续两个在线人工智能故障诊断文件增加诊断字段，通过精确还原并核对哈希确认仅是这两处变化，不影响本组玩家操作与图面。图包只覆盖这五条桌面代表路径，多人前态包含合法状态准备，不代表所有索尔对象及移动端均已验收。
- 六项正式 Thor 资源同日远端 HEAD 均返回 200，长度分别为 player-board 2210036、tip 1026300、ability-cards 5697612、dice 52514、status-icons-atlas 233066、portrait 194472 字节；这只证明当前远端可访问及响应长度，不证明客户端完整加载或规则交互通过。

2026-11-12 最新源码复跑：`e2e-1794442456114-eszw2q`（索尔新交互 7/7）与 `e2e-1794442456000-hlpzif`（规则交互 26/26）通过；前者及后者所选 31 张交互整屏已重新逐张检查并更新最终截图组，限于图中代表状态的交互画面。升级连锁闪电四骰的五张完整画面另已逐张看图：升级牌面、原骰盘效果骰确认、四骰候选、两骰选中与原确认、进入防御；该页行为断言覆盖所选低值组合，未推断其它人数自然开局。

最新定向 Vitest 五文件 102/102、`npm run typecheck` 通过；全量 DiceThrone Vitest 的既有 12 文件失败尚未以修复后全量重跑结果更新，此处不声称全量绿灯。31 图仅证明所选代表状态，不把尚未独立验证的所有能力/人数/自然对局分支写为通过。

公共牌“下次一定”的旧失败经逐项核对：测试先构造尚未处理的待伤害，再把同一份状态标成攻击结束，期望不可响应；这与当前正式待伤害响应合同和 2v2 实际出牌路径冲突。现保留待伤害时允许响应的断言，再清除已结算的待伤害与攻击状态，验证攻击结束后不得使用；圣骑士相关文件和公共响应时机文件共 33/33 通过。该修正没有改卡牌实现，也不证明所有四人技能完成续链。

2026-11-12 再次在独立端口重跑四人联机 `e2e-1794444107302-nibqsc`，1/1 通过；复看三类队友辅助重掷的六张整屏，索尔作为骰主看到原骰盘、提示、选择标记与原确认/取消。测试使用合法代表态准备，不等同从开局自然走完整局；该六张未加入此前 31 张新 UI 交付组。

最新全量 DiceThrone Vitest 重跑结果：195 个文件中 185 通过、10 失败，2971 项通过、18 失败、1 跳过，日志 `temp/codex-thor-audit/dicethrone-full-after-fixes-20261112.log`。此前旧侧栏四项和公共牌旧状态前提一项已通过；剩余失败主要涉及工匠、武僧、炽天使、吸血鬼、教程、兼容布局及圣骑士多人 preDefense 续链，尚不能将它们全部归类为旧问题或宣布全套通过。

截图纠正：上一轮图组第 15 张仍拍到确认按钮灰色过渡帧，原图组视觉 PASS 作废。原因是通用按钮有 200ms 状态样式过渡，而“已启用”断言不等待过渡结束；没有改按钮 UI。真实入口 `e2e-1794444607345-y62z12` 1/1，等待过渡后重拍连锁四张并逐张查看，选中两骰后确认按钮稳定呈橙色；已替换图组并重新完成 31 图清单校验。本结论只覆盖该组交互画面。

截图组扩充：升级版连锁闪电四颗效果骰的五张当前整屏已逐张审阅，加入同一链接，现共 36 张；仍只声明代表状态的视觉结果。

索尔专属牌补验：`e2e-1794445281670-jbpfay` 通过 3/3，真实手牌出牌分别核对挥锤时刻召回、雷霆万钧抽牌与驭电、风暴来袭的抽牌与资源，六张整屏已逐张查看；风暴来袭的两次飞掷计数为合法代表态注入，不宣称从两次实际飞掷连续走到出牌。

风暴来袭进一步从实际动作验证：`e2e-1794445478896-5d0i21` 从合法主阶段出发，分别弃两张牌完成两次真实飞掷，中间打出挥锤时刻召回；随后出风暴来袭，权威状态为对手48生命、自己7CP、3驭电、1破防及1张新手牌，1/1 通过。前后两张已查看；首张带飞掷尾帧，只作为过程观察，不列最终视觉通过图。

更正此前“下次一定待伤害窗口为直接注入”的旧记录：最新四人用例 `e2e-1794444107302-nibqsc` 源码及运行结果显示，测试仅预置僧侣可用攻击骰面与两位队友手牌；随后由玩家点击莲花掌、掷正式目标骰、解析目标，服务端自然生成 5 点待伤害窗口，再由另一队友出牌并阻止伤害。它证明此段攻击到响应的实际续链，不证明预置骰面之前的完整对局；此前早期测试确有注入，不应覆盖本次自然生成结果。

36 张最终展示图的来源 sidecar 再次逐项与当前前端源码核对：812 个唯一来源版本、缺失 0、哈希漂移 0；这只证明截图来源一致，不代替视觉和规则验收。

公共牌实测覆盖更新：`e2e-1794445792412-a1783r` 从索尔真实手牌入口分别打出加倍、超级加倍和老板大气，3/3；核对费用、抽二/抽三或获2CP、弃牌及无额外交互，六张整屏已查看。这补上公共牌 04/05/08 的桌面出牌代表路径；其余公共牌由本页记载的 26 项规则交互、5 项公共改骰/重投和四人用例覆盖，具体人数与边界仍按各用例区分，不能外推所有自然对局。

五张尚缺页面证据的升级牌：`e2e-1794446036406-x7dv38` 从索尔真实手牌分别打出雷神之锤 II / III、驭雷策电 II、雷轰电掣 II、雷霆之力 II，5/5；核对技能等级、费用与手牌移除，10 张出牌前后整屏已直接查看，对应升级图确实覆盖正确技能槽。其余四张升级牌由主交互/规则交互 E2E 覆盖；这些运行只覆盖各自出牌及所执行的能力分支。

顺子能力补验：初次 `e2e-1794446313214-mb3bix` 为 3/4；失败因新增测试错误把雷轰电掣基础版写成飞锤。独立规则账本写明基础版由目标持锤与否决定7/9伤和驭电，只有二级固定要求移动锤；按该源纠正测试后 `e2e-1794446512254-u2kvpa` 4/4。已查看八张整屏，分别覆盖基础/升级雷轰电掣、基础/升级雷霆之力的技能槽与攻击继续；权威断言检查神锤归属、附属伤害及驭电，主伤害完整落地由现有正式命令链覆盖，不把本次画面代替最终伤害结算。

双能力分支补验：`e2e-1794446745593-r1tm7s` 真实技能槽触发驭雷策电基础及二级的治疗、破防和驭电，以及同张二级升级的电闪雷鸣攻击，3/3；六张整屏已逐张查看，分别核对技能槽、目标阶段与资源。该次只覆盖持锤分支及电闪雷鸣对应骰型，未将它外推到多人召回或所有骰型。

雷神之锤各等级补验：`e2e-1794446944601-3uv3p7` 从技能槽触发基础、二级、三级最高档，3/3；飞锤后对手生命与持锤、驭电和保留的攻击来源均已断言。六张整屏逐张看过，基础/二级/三级技能牌面及攻击继续可见；较低骰档和最终主伤害仍以正式命令链单测为证据，不由这六图外推。

阿斯加德神力补验：`e2e-1794447124338-1vow0z` 从真实升级牌和技能槽触发三头盔治疗分支，1/1；权威状态确认生命 30→34、对手生命不变、不产生待攻击并返回主要阶段。两张整屏已查看；不据此扩展到其他升级分支。

持锤者败北补验：在合法对局中预置对手持锤且剩1生命，经正式掷骰、技能、防御掷骰与阶段推进执行雷轰电掣，最终对手生命0且失去锤、索尔持锤并获得1驭电；`thor-flow.test.ts` 定向1/1。该命令链覆盖两人状态，尚不证明多人对局被击败后的全部可见表现。

对象覆盖复核：21 个基础/升级能力均已有当前代码的真实页面代表路径，34 个物理卡槽均已有该卡真实手牌使用或升级路径（含单独验证的推广牌，推广牌不进入常规牌库）；七类锤/Token操作均有正式命令证据，其中被击败召回为两人命令链，其他入口另有页面代表路径。各路径的上限、多人组合和从开局自然产生前态仍以各专项证据为准，不能以对象数量推断穷举所有组合。对象表中早于上述运行所写的“当前源码无 E2E”不再适用于这些已列代表路径。

更正上一段“34 个物理卡槽均已有该卡真实手牌使用”的范围：不愧是我、我又行了、就这的四人页面用例由索尔队友出牌，证明共享卡效果与索尔骰盘，不自动证明这三张索尔图集牌由索尔本人出牌。其余已列路径不受此更正影响；上述三张的索尔本人手牌入口继续补证。

索尔本人出牌补证：`e2e-1794447694666-6oo503` 验证不愧是我同骰两次、我又行了两颗骰，2/2；`e2e-1794447855999-g25y8n` 验证就这在索尔防御骰入口重投，1/1。九张整屏已逐张查看：索尔卡图、原骰盘提示、选中反馈和确认均可见；另有前述四人队友出牌权限验证。这样才补齐 34 个物理卡槽各自的真实手牌使用/升级代表入口；不代表所有联机席位与状态组合均覆盖。

多人真实开局补验：`e2e-1794448282175-8zhv6g` 从四人在线选角、准备和开局出发，索尔从原手牌区弃牌并在两名敌人中选一人飞锤；服务端确认仅所选者持锤、独立伤害和飞掷计数均正确，1/1；四张整屏逐张查看并加入截图组，现共40张。截图源码回查共1105个前后端来源版本，缺失0；唯一漂移为其他任务的 `feedbackScreenshot.ts`，差异涉及反馈截图后台编码/调度，非该链页面交互或骰盘渲染；不将此表述为全文件零漂移。

索尔及共享交互最新定向回归 8 文件、196/196 通过。全量 DiceThrone 仍为 18 项失败，未因定向通过而声明全量通过。

共享四人防御前续链接口复核：完整四人正式命令从角色选择、升级、掷骰、技能到目标选择，选择前保持暂停，选择后神罚落到指定玩家、CP只增加一次、交互和攻击收口并进入主要阶段；`four-player-pre-defense-continuation.test.ts` 1/1。全量失败中的 `rule-consistency` 原要求“选择发出即标记已完成”，与实际续链矛盾；修正为断言暂停及续接合同后，与正式命令链合计41/41。此次只证明该续链，没有改生产规则或替其它角色失败做结论。

多人败北补验：四人真实选角与开局后，将敌方队伍预置为1生命、1号敌人持锤，通过正式进攻掷骰、目标骰、敌方防御掷骰和结算命令击败该队；最终队伍生命0、索尔重新持锤并得1驭电，定向1/1。首次测试用目标骰1实际选中了另一名敌人，故其后错误地让1号防御而被拒；按左右目标规则改用3并先断言实际目标为1后通过。该项为权威命令链，不冒充多人浏览器截图。

基础雷神之锤“不持锤”负向边界：预置敌人持锤后经正式掷骰、发动、对手防御和结算，敌人仍持锤、未被飞锤额外扣血，但主攻击完整造成7伤且索尔不获额外驭电，定向1/1；对应持锤时飞锤的正向浏览器链另已覆盖。
