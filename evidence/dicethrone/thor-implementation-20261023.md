# 索尔实施证据（2026-10-23）

2026-10-23 原验收裁定（已由用户反馈重开）：功能实现已验证；视觉与真实可选入口正在最后收口。该历史裁定不是本轮复审结论，也不是生产游戏代码部署证明。`gameId=dicethrone`，`evidenceCategory=independent`，目标是当前工作区的桌面网页（1920×1080）。锁定单英雄 `thor`，不外推 Doctor Strange 或其它游戏。

当前状态（2026-10-27用户退回）：交互验收 REVISE。06缺当前选骰提示，11将固定4/5错误接入any加减；旧51图PASS及任务6/7不能支持本轮通过。用户尚未明确确认完成态，必须保留实施中标记。

## 2026-10-24 全量复审（进行中）

用户指出弃牌成本选择仍弹出通用弹窗，并要求整项重新审查。先核对规范：`rule-driven-interaction-design.md` 明确同一交互族复用同源视觉语法，且通用弹窗不能替代可由手牌本体承载的选择；`regression-closeout.md` 要求按共享消费者、同族对象、测试和证据扩审；`e2e-verification.md` 禁止用旧弹窗结构作为选择器或验收依据。现有规范足够，不增加重复条款；上一轮漏在实现与验收执行。

直接证据：最终目录的 `01-02-弃牌飞掷选择成本.png` 实际画面标题为“技能结算选择”，显示旧 `ChoiceModal` 候选，和索尔付弃牌成本的玩家动作不符。该图在旧 `visual-review.json` 被误标 `PASS`，现已将这一媒体改为 `REVISE` 并标明错误入口；总 `pass-manifest.json` 保持 `REVISE`，整组重审中。历史截图不再作为当前源码验收。此前的 E2E 图片虽显示手牌区提示，但 sidecar 源码摘要 `e199134b…` 与当前源码摘要 `a19f45a3…` 不同，不能回灌为本轮证据。

当前源码路由：`Board.tsx` 对本地交互所有者的单张 `selectHandCard` 直接启用 `HandArea` 弃牌模式，并以 `resolveInteraction([], [cardId], interactionId)` 提交；只有交互声明允许取消时才显示“取消”。生产者检索覆盖 Thor 投掷/召回成本，以及咒缚海盗共享弃牌 helper 的瞭望台、深海潜行、走跳板三个入口，当前均为单选；未发现仍在用旧手牌候选弹窗的生产者。`selectCount > 1` 没有当前生产者，暂不扩写该状态。

当前已复核：Thor 定向行为/UI 12 个测试文件 176/176 通过；咒缚海盗相关 4 个规则用例通过；DiceThrone 本地资源 manifest、样式合同检查通过，六项正式 Thor 远端资源 HEAD 均为 200。全仓 `assets:validate` 在 `common/audio/registry.json` 的 hash/bytes 不一致处失败，未自动重生成；这不是 Thor 定向 manifest 结果。

2026-10-24 本轮真实 UI 进展：Thor 交互 E2E `e2e-1792846961240-ofrfs7` 的 4/4 场景通过，生成 23 张截图并逐图复核；在该轮结束时 23 张 sidecar 均与摘要 `aac9e7a0d79cb235bee9daa014c08ab035454fad5ebddf5ef342bada3b92abfc` 一致。弃牌成本图显示真实 Thor 主阶段、四张 Thor 手牌、“选择 1 张手牌弃置”和“取消”，没有通用 `ChoiceModal`；取消后资源未扣，真实点击弃牌后继续飞掷。连锁闪电效果骰组合图仍使用通用技能选择弹层，这是骰面组合选择，与手牌弃置不是同一交互。

之后另一条共享工作流改写了 `src/assets/audio/registry-slim.json`，当前源码摘要变为 `70302cfae22ee7bbe590a0cc74140b80b76de36bc36a9f777fe27f50111f02d4`。`getFrontendSourceHash()` 覆盖 `src`，不覆盖 `public/assets` 下的 manifest，因此前述 23 张截图不再与当前完整源码摘要相符，最终包不能混用它们。Thor 在线入口 E2E `e2e-1792850375504-76umna` 已在摘要 `70302cfae22ee7bbe590a0cc74140b80b76de36bc36a9f777fe27f50111f02d4` 下通过 1/1；2 张截图均有可见/权威状态 sidecar并与该摘要一致，已逐图复核。

尚未完成：待共享工作流稳定后，以同一当前源码摘要重跑 Thor 交互 E2E 与 12 个定向行为/UI 文件；还需咒缚海盗共享 `selectHandCard` 的真实 UI 消费者 E2E（通用交互 harness、瞭望台、深海潜行、走跳板）和逐图复核。E2E doctor 曾显示其他 DiceThrone/Fate 用例占用共享单 worker，故本轮未并行启动或清理他人 runtime。对象级审计和实施门槛任务继续保持打开；不得据后文 2026-10-23 的历史 PASS 声称本轮验收完成。

## 权威来源和范围

- 用户指定素材主源：`public/assets/i18n/zh-CN/dicethrone/images/thor/`。不是通过实现反推原文。
- 逐对象录入：`src/games/dicethrone/rule/雷神真相源表.md`、`雷神录入核对.md`、`雷神卡牌录入核对.md`，状态 locked。34张卡图、九槽、六骰面、三指示物与参考图逐项登记，原始文件保留。
- 仓库 FAQ 2.1.1 的三项时序：飞掷独立伤害、挥锤同时获电、奥丁II任选数量骰子一次重掷；官方 Marvel Update Pack v2 采用4电/自己主阶段/每回合一次抽牌。旧QA两电/旧窗口只作历史原文，不由运行时消费。
- S0为真实圣骑士成熟入口截图与v2九槽几何；Thor使用自己的3576×2157板、3420×7722卡图和独立肖像，不借其它英雄图片。完整参考路径见真相源表。
- 不包含生产Web/游戏服务部署、全游戏规则审计、移动端新增适配、教程重做或AI策略优化。

## 规则对象与最终权威消费

以下 `flow/cards/companion` 分别指 `src/games/dicethrone/__tests__/thor-flow.test.ts`、`thor-cards.test.ts`、`thor-companion.test.ts`。能力静态定义 owner `heroes/thor/abilities.ts`，规则消费 owner `domain/customActions/thor.ts`；终值统一进既有 reducer、damageCommit、tokenResponse、FlowSystem。截图只证明可见对象与交互，不代替这些数值测试。

| 对象 | 原子语义 | 消费入口 | 最终权威结果 | 直接证据/共享依据 |
| --- | --- | --- | --- | --- |
| thor-hammer | 3/4/5锤分别4/5/7普通伤害；仅飞掷；无锤不召回亦不丢主攻击 | hammerChoice→moveMjolnir；attack | 主攻击与同伴独立1分别结算 | flow：三档表、雷神之锤飞掷后主攻击 |
| thor-mighty-summon | 锤盔盔雷；2破防、治疗2；持锤3电，否则召回并原持有人附属3；无主攻击 | thor-mighty-summon | HP、token、原持有人HP；响应完成才main2 | cards：持锤/外置四分支；flow：附属响应 |
| thor-odinforce | 两锤三盔；5普通+五效果骰；两锤移动1、两盔1CP、每雷1电；当前电增伤；基础无重掷 | thor-odinforce-settle→hammerChoice | 最终效果骰奖励、当前电与主伤害各一次 | flow：基础奥丁；整组链共享最终奖励 |
| thor-chain-lightning | 三锤两雷；三效果骰任选两点和普通；另选对手独立附属2，可同主目标 | thor-chain-settle→thor-chain-pair→thor-chain-target | bonusDamage保留、目标HP-2、主防御保留 | flow：连锁；E2E连锁五图 |
| thor-thunder-strike | 小顺子7普通；攻击目标持锤则9，否则获得1电 | thor-thunder-strike | 目标持锤分支与最终HP/电 | flow：基础/升级伤害表 |
| thor-bottled-lightning | 四雷；0..2移动；2破防；7+当前电普通 | hammerChoice→finishHammerMoves | 0次/上限次合法；后置奖励完成后结算 | companion：0次/次数；flow：伤害表、破防重复 |
| thor-power-of-thunder | 大顺子；移动1、2电、10普通 | hammerChoice→finishHammerMoves | 最终位置、token、主攻击 | flow：基础/升级伤害表 |
| thor-thunder-wheel | 防御3骰；两锤移动1、每盔防2、有雷只获1电 | thor-thunder-wheel | 防御只结算一次，移动后回父攻击 | flow：防御、飞掷后续主伤害 |
| thor-for-asgard | 五雷；1破防、0..4移动、14终极；全程对手不能行动 | hammerChoice；validateCommand终极门禁 | 逐步锤位置与14最终伤害；对手瞬时牌被拒 | flow：终极；companion：四次移动 |
| upgrade-thor-hammer-2 | 18/0CP；5/6/7；移动含召回；>=4个相同数字1电 | PLAY_UPGRADE_CARD→replaceAbility→THOR_HAMMER_2 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；数字快照、最终HP、电 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-hammer-3 | 19/2CP；5/6/8；>=3相同数字1电 | PLAY_UPGRADE_CARD→replaceAbility→THOR_HAMMER_3 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；数字快照、最终HP、电 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-mighty-summon-2 | 20/2CP；治疗3/附属4；下区两锤两雷2电6普通 | PLAY_UPGRADE_CARD→replaceAbility→THOR_MIGHTY_SUMMON_2 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；同一物理升级、治疗/攻击独立variant | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-chain-lightning-2 | 21/2CP；四效果骰选两点和；独立附属3 | PLAY_UPGRADE_CARD→replaceAbility→THOR_CHAIN_LIGHTNING_2 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；四骰来源、选两骰、独立目标HP-3 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-odinforce-2 | 22/2CP；6普通；五效果骰任选非空子集一次重掷，也可直接确认 | PLAY_UPGRADE_CARD→replaceAbility→THOR_ODINFORCE_2；REROLL_BONUS_DIE | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；未选骰保持、次数只+1、拒绝第二次、最终奖励一次 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-thunder-strike-2 | 23/2CP；小顺子移动1、1电、9普通 | PLAY_UPGRADE_CARD→replaceAbility→THOR_THUNDER_STRIKE_2 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；替换基础分支，9最终主伤害 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-power-of-thunder-2 | 24/2CP；大顺子移动1、2电、12普通；三盔治疗4 | PLAY_UPGRADE_CARD→replaceAbility→THOR_POWER_OF_THUNDER_2 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；同物理升级、独立治疗不进入防御 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-bottled-lightning-2 | 25/2CP；四雷0..3移、2破防、8+电；下区三雷0..6移 | PLAY_UPGRADE_CARD→replaceAbility→THOR_BOTTLED_LIGHTNING_2 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；可选0、3/6上限；无第二张手牌 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| upgrade-thor-thunder-wheel-2 | 26/2CP；防御4骰；每对锤移动1、每盔防2、每雷1电 | PLAY_UPGRADE_CARD→replaceAbility→THOR_THUNDER_WHEEL_2 | 手牌-1、CP按费用扣、abilityLevels与完整variant替换；与基础雷总1区分；四锤可移两次 | cards九个正式升级命令；flow基础/升级表与专属分支；奥丁II真实E2E |
| card-thor-worthy | 27/1CP/roll；自己的1骰改4或5 | thor-worthy→公共buildModifyDieAny1Interaction([4,5])→modifyDie(any) | 原骰盘加减预览；4/5才可手动确认；取消退牌退CP且骰面不变 | E2E当之无愧确认及取消两链；共用任意改骰状态机 |
| card-thor-impenetrable | 28/2CP/roll；额外实际弃2电，防全部待受伤害 | requireCommittedDamage→thor-impenetrable | 真实pendingDamage防止，HP不变，卡/CP/电实际支付；无伤害不能空付 | cards致命攻击；flow空付拒绝 |
| card-thor-undaunted | 29/2CP/roll；仅致死攻击；1效果骰盔则生命置1，否则正常伤害 | requireLethalAttack→thor-undaunted-settle | 4/5保1、1失败归0；附属/非致死拒绝 | cards真实致死攻击三分支；同一bonusDice确认 owner |
| card-thor-hammer-time | 30/0CP/instant；召回、1CP和1电；召回固有电同时获得 | thor-hammer-time | 自持锤总1电，在外总2电；无中间消费窗口 | cards持锤/外置；E2E完整卡面放大 |
| card-thor-thunderous | 31/1CP/instant；抽1、2电 | thor-thunderous→buildDrawEvents | 手牌+1、驭电+2受限 | cards抽牌与资源 |
| card-thor-storm-brewing | 32/0CP/instant；本回合已飞掷2次；抽1、1CP/破防/电 | requireMjolnirThrowsThisTurn→thor-storm-brewing | 正式飞掷事实计数，召回不算；TURN_CHANGED清；所有奖励落地 | cards条件与奖励；companion计数 |
| card-thor-bifrost | 33/0CP/main/推广；效果骰雷则抽1/1破防/2电，否则抽1；默认牌库排除 | thor-bifrost-settle | 最终骰分支、真实抽牌、常规33张无推广 | cards骰1/6及常规牌库；共享非攻击bonusDice owner |
| guard_break | 上限2；进攻投掷末花1；1效果骰4/5不可防御；失败不退，可再花1 | executeTokens→choiceEffects→thor-guard-break-settle | 真实token逐次-1；不污染usedIds；成功后主攻击跳防御 | flow正式两次消费；破防直接E2E |
| electrokinesis | 上限4；任何持有者自己主阶段花4抽1，每回合一次；能力按当前电增伤但不消费 | getPlayerPassiveAbilities→ACTIVE_PASSIVE→TURN_CHANGED | token-4/hand+1；main1/main2同一次额度；其它角色也可用 | flow非索尔持有者正式命令；companion权限；沿用主动抽牌按钮同一owner |
| mjolnir | 全场唯一位置0/1；初始自持；飞掷合法对手独立1，召回1电；不可移除/转移；败北自动回 | moveMjolnir→TOKEN_CONSUMED/GRANTED；collectThorCompanionFollowups | 唯一holder、实际HP/电；弃牌成本不等于卖牌；递归每步读已提交位置 | companion唯一性/0..2/3/4/6步/败北/计数；flow父攻击保留；E2E弃牌飞掷 |

## 18张公共卡共享判等

共享流程 `dt-common-cards`：逐卡使用 `injectCommonCardPreviewRefs(COMMON_CARDS, THOR, THOR_COMMON_ATLAS_INDEX)`，仅替换正式卡图，触发时机、费用、候选生成、目标权限、payload、执行入口、最终状态与清理消费全部保留原对象。`cards` 中18项逐对象深比较（排除唯一变化previewRef）承担合同判等；本轮未重写公共效果，也不宣称重新验收18种旧规则的全部分支。

| slot | 对象 | 原图锁定费用/时机 | 本轮消费/结论 |
| --- | --- | --- | --- |
| 00 | card-transfer-status（乾坤大挪移！） | 2/主要 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 01 | card-what-status（状什么态？） | 2/主要 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 02 | card-one-throw-fortune（一掷千金！） | 0/主要 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 03 | card-get-away（起开！） | 1/主要 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 04 | card-super-double（超级加倍！） | 2/瞬时 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 05 | card-double（加倍！） | 1/瞬时 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 06 | card-bye-bye（拜拜了您内！） | 2/瞬时 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 07 | card-flick（弹一手！） | 1/瞬时 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 08 | card-boss-generous（老板大气！） | 0/瞬时 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 09 | card-next-time（下次一定！） | 1/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 10 | card-unexpected（意不意外？！） | 3/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 11 | card-worthy-of-me（不愧是我！） | 1/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 12 | card-surprise（惊不惊喜？！） | 2/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 13 | card-me-too（俺也一样！） | 1/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 14 | card-i-can-again（我又行了！） | 1/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 15 | card-give-hand（抬一手！） | 1/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 16 | card-just-this（就这？） | 0/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |
| 17 | card-play-six（玩得六啊！） | 1/投掷 | dt-common-cards；正式atlas槽位，定义深比较通过 |

## 共享链路修复和审查

- 同伴/附属为`damageScope=direct`，结束响应不将父攻击误标为主伤害完成。伤害响应阻断原技能，待锤子步骤/最终奖励完成再恢复父Flow。
- 终极开始后的对手操作由统一validateCommand禁止；效果骰与主骰的操作者分别按真实owner授权；没有真实待伤害时禁止无懈可击空付。
- 奥丁II沿用原效果骰结算owner、骰盘和`REROLL_BONUS_DIE`，扩展该命令的一次子集输入：选中/撤选→原重掷动作槽一次提交整组→原结算确认。旧的点一骰立即重掷不能表达“任选数量、一起且仅一次”，因此只补这一必要输入语义，不声称复用`selectDie`重掷卡状态机。服务端校验非空/唯一/索引/次数；未选骰保留，重掷计数只增加一次。AI同规则列31非空子集，重掷后不再产生第二次。
- simple-choice仍是唯一选择owner。候选卡正式previewRef和目标targetPlayerId经event→candidate.value→useCurrentChoice→ChoiceModal，提交仍为原interactionId/optionId；无第二套规则状态。
- 独立审查`/root/thor_contract_review`四轮追踪实际消费链，第三轮问题均修复并加正式pipeline回归；最后新选择UI链路无明确阻塞。审查不替代实际UI截图。

## 资源发布与备份

正式媒体共6项：player-board、tip、ability-cards、dice、status-atlas、portrait。全部为当前用户源图的压缩或登记裁切，不上传临时裁图、QA参考或其它角色。前五release `20261023104720449`，portrait release `20261023111630381`；公开地址在`https://assets.easyboardgame.top/official/i18n/zh-CN/dicethrone/images/thor/compressed/`，本轮实际回查六项200。匿名上传已成功，不再要求token；Android stable/edge资源索引随发布刷新。

用户当轮授权每周备份：服务端systemd timer固定周日03:00 Asia/Shanghai，首次下次触发2026-10-25；R2目的地weekly-server-backups/ISO周。仅copy不删除远端旧对象；本地硬链接快照/短发布锁与长期备份锁。首轮手动备份已启动、日志持续复制，尚不能将“运行中”称为完成。详情`thor-weekly-assets-backup-20261023.md`。

## 新交互与范围内验证

| 交互族 | 真实动作和直接断言 | 证据 | 验证边界 |
| --- | --- | --- | --- |
| 弃牌飞掷与手动目标 | 主动按钮→真实卡候选→目标头像→HP49/holder1/计数1 | interactions第一组九图 | 含成本和对象可识别性 |
| 奥丁II升级/效果骰子集 | 真升级→真实进攻roll→选两效果骰→整组一次→确认/回父防御 | 同组九图；flow未选保留/拒绝第二次 | 数字由权威state，不从图推断 |
| 当之无愧 | 完整放大手牌→拖牌→原骰盘加减预览→确认；另走取消退牌退CP | interactions当之无愧五图与取消两图 | 原骰区仅一骰变4、余骰保持；取消后权威骰面及手牌/CP恢复 |
| 连锁闪电 | 真实roll/选技能→效果骰确认→选两骰→独立目标→主防御 | interactions第三组五图 | 独立HP-2与主bonus10同时保留 |
| 破防连续消费 | 真技能获破防→第一枚失败→第二枚成功→不可防御结算 | interactions第四组五图 | 正式sprite/持续消费入口/效果骰；领域覆盖同链 |
| 驭电/召回等已有交互 | 主动栏、非索尔持有者、主阶段和每回合门禁 | flow/companion正式命令；共享PassiveAbilityPanel | 沿用同owner同按钮/资源支付与清理，差异为已测试成本/条件，不新增表层状态 |
| 防御/致死牌/彩虹桥 | 同一伤害响应、单效果骰与确认组件 | cards/flow；共享tokenResponse、bonusDiceSettlement | 触发、成功/失败、支付、目标和最终状态由正式pipeline验证；没有额外自造弹窗 |
| 玩家可见生命周期 | 先验证隐藏入口；通过实施中门槛后真实双人选Thor/monk、准备、开局九槽/四牌 | thor-online-entry.e2e.ts | 保留implementation_in_progress，真人完成确认未获得 |

## 当前运行结果与剩余边界

- Thor玩法与共享合同定向回归：10个文件165项通过，选择UI专项2个文件48项通过；最终综合日志见`evidence/dicethrone/thor-20261023/final/validation/final-tests.log`，专门生命周期日志见`lifecycle-tests.log`。
- 真实交互四场景 `e2e-1792757343532-13ucob` 与真实双人在线选角/开局一场景 `e2e-1792805482044-ty51qv` 均通过；共26张原始截图，每张都带权威状态sidecar。在线入口确认索尔可选、徽标可见、双方开局并加载九槽和四张手牌。
- 当之无愧、连续破防、弃牌/奥丁主流程、连锁闪电及在线入口共五组视觉审查均PASS，26张原始截图逐张通过。最终包按独特界面状态去重为25张，保留5条完整行为链。
- 最终证据`evidence/dicethrone/thor-20261023/final/pass-manifest.json`通过仓库验收器：25张媒体、5条行为链、25张逐图审查、0张未登记媒体。查看器已注册：`http://127.0.0.1:4867/?key=bc456efbc09d`；注册时未自动打开浏览器。
- 索尔正式素材定向manifest校验通过，6项正式媒体远端回查均为200；每周备份首次全量已于2026-10-23 20:31 CST完成（4.088 GiB/13,385项），timer已启用、下次为2026-10-25 03:00 CST。
- 最新全仓`npm run typecheck`仍失败（日志`temp/dicethrone-intake/thor/typecheck-final.log`）；本轮修正了索尔徽标的错误类型导入，当前索尔英雄/规则/目录测试文件无TypeScript诊断，剩余错误集中在共享DiceThrone、其它游戏、引擎和并行模块。i18n检查仍有Fate等模块文案诊断；扩展共享AI回归25项中23项通过，另外2项奖励骰夹具的掷骰者仍为未选角状态。未关闭校验，也不称全仓通过。
- Thor目录现为`in_progress`并保留实施中徽标；玩法单测/目录生命周期14项通过，真实双人在线E2E通过。用户完成态确认未获得，不会自动勾选完成。
- 大量其它任务dirty源文件和证据原样保留；未创建/切换分支，未提交、推送或部署游戏代码。
## 2026-10-25 全量复审续记

规范结论不变：交互规范已经规定手牌可承载的单张选择复用手牌本体与同源视觉语法，并要求扩审共享消费者；无需改规范。共享入口矩阵见 evidence/dicethrone/thor-selectHandCard-cross-consumer-20261025.md。索尔投掷 / 召回、咒缚海盗深海潜行、瞭望台战利品、走跳板弃牌分支都通过同一个 HandArea 单选弃牌 owner；取消按钮是索尔成本交互明确允许取消，查看手牌确认和效果分支选择仍各自保留。

本轮打开关键截图并与咒缚海盗单张弃牌入口并排核对：两者都是手牌候选本体加共享弃牌提示条，没有 ChoiceModal / 卡池选择弹层。索尔成本可以取消，因此多出取消按钮。图片差异受视口和手牌数量影响；交互 owner 一致。

复审期间发现新源码摘要为 51b4dd48ac4a2400e651727d700767aa8e3a27e28e77fcde9a72b586fcbc5df4，旧 E2E sidecar 为 6631f38851fb74e46a525d470fe9a7755e8afa2cc86f3be8fcda76cd980361ef。因此旧25张截图包结构校验通过不等于当前源码验收；已将该包 pass-manifest.json 临时降为 REVISE，不会作为最终交付。当前源码下索尔12文件176/176、咒缚海盗机制117/117、样式合同11项全部通过。新日志保留在 evidence/dicethrone/thor-20261025/full-rereview/validation/。

待办：刷新索尔交互E2E、真实双人入口E2E，以及咒缚海盗4个共享弃牌消费者入口；更新所有行为链 sidecar / 逐图视觉报告；重新校验统一 PASS 包；随后才能勾选任务6/7。E2E 单worker现由 e2e/dicethrone/doctor-strange-real-entry.e2e.ts 占用，runtime session e2e-1792888901926-xh94r7，服务进程仍运行；未并发启动，也未停止该 runtime。任务8仍要求用户明确确认完成态。
## 2026-10-25 最新复核状态

上段记录的 51b 摘要和 176/117 项通过仅代表当时工作区状态。随后工作区有其他 DiceThrone 派系文件更新，当前完整源码摘要为 7fa1ad02159de727535d16d0a6694208938761b03cf63b93347b7105ec8efe0d；上一轮定向测试启动时摘要为 7ff02cea…，9/12 个测试套件加载失败。直接异常是 src/games/dicethrone/heroes/treant/cards.ts:217 使用 WILD_GROWTH_2，但文件 import 列表缺少该符号；该符号在 heroes/treant/abilities.ts:265 导出。这是其他派系的并行修改，本任务未编辑或回滚它。当前hash再次变化说明共享工作区仍在被修改。

因此目前不能通过编译态的 DiceThrone 当前源码复跑，也未刷新 Thor/咒缚海盗真实入口 E2E。上一段25张图片现已在统一清单中标为 REVISE，任务6/7保持未完成。需先让并行树精修改完成并恢复可加载状态，再等共享单worker runtime空闲，在同一稳定源码摘要下重跑定向测试和E2E；完成后再重建最终证据包。

## 2026-10-25 继续复审状态（尚未验收）

已获用户授权的树精导入阻塞已由并行修改补齐：`treant/cards.ts` 现在从 `abilities.ts` 导入 `WILD_GROWTH_2`，其使用点与导出均存在。规范复核结论：交互原则有覆盖，无需修改规范；单张 `selectHandCard` 对应 `HandArea` 的游戏内 owner 映射记录在共享消费者矩阵中。

在摘要 `4ee0a584…` 下，索尔定向 12 个测试文件 176/176、咒缚海盗机制 117/117、样式合同 11 项通过。随后源码持续变化，当前曾观察到摘要 `285736d6…`，这些日志不能代替稳定最终摘要下的复跑。真实入口 run `e2e-1792898214676-bl1fze` 的 Thor 四场景和在线入口一场景都通过，但总命令在 5/9 处被 memory watchdog 终止，并与七大恨 shared runtime 并行；不晋升为最终证据。完整同源重采、逐图复核、evidence validator 和 audit selfcheck 仍未完成，任务 6/7 维持未勾选，任务 8 维持未勾选。

## 2026-10-25 隔离复跑记录

在摘要 `7832913e…` 下，Thor 12 个定向测试文件 176/176、咒缚海盗机制 117/117、样式合同11项通过。显式设置 `PW_E2E_SERVICE_REUSE=isolated` 后，Thor 交互 E2E 4/4、在线选角/开局 1/1、咒缚海盗共享弃牌消费者4/4通过；隔离端口为6273/20100/21100，每次结束只关闭自身 runtime。对应验证日志在 `evidence/dicethrone/thor-20261025/full-rereview/validation/`，三个运行ID见共享消费者矩阵。

Thor与在线入口截图 sidecar 属于 `7832913e…`。运行后发现并行 `src/components/home/platform-home.css` 修改使完整摘要变为 `b1759009…`，所以本组仍不能作为最终摘要证据。当前另有 Fate tutorial E2E 占用全局重任务预算；未停止或干扰它。最终同源复跑、25张图逐图复核、清单验证与 audit selfcheck 尚未完成，任务6/7保持未勾选，任务8保持未勾选。

## 2026-10-26 当前候选摘要复核（真实入口待复跑）

- 规范复核仍判定为执行/验收漏审，不是规则缺失：`ui-ux.md` 的同类交互与既有组件复用原则、`rule-driven-interaction-design.md` 的同族视觉语法要求足以约束这次选择；具体 `selectHandCard -> HandArea` 映射由共享消费者矩阵记录，无需增写另一份规范正文。
- 当前实现仅将“本地交互 owner + 单张 + `interaction.selectHandCardToDiscard`”路由到 `HandArea`，通过原 `resolveInteraction` 提交；显式可取消的 Thor 成本保留取消入口。查看手牌确认、走跳板效果分支和非单张交互仍保留各自语义。
- 前次海盗真实入口 E2E 在 `setupCrowsNestScenario` 的完整状态 POST 返回 `request entity too large`，堆栈位于状态注入 helper，尚未进入瞭望台 UI，不能当作 UI 失败或通过。已将瞭望台场景及随后作战室场景重置改用 `/test/patch-state`，并移除 Go Fish 跳过按钮的强制点击。目标测试文件 ESLint 与 diff --check 通过；局部状态 patch 路由既有集成测试 2/2 通过；目标海盗完整 E2E 等待真实复跑。
- 候选源码摘要 `c8f1614ca11f44f897074323c1d6eba826d6b3c13aed47e7b8d2b8ef4ac46577` 下，Thor/UI 12 文件 176/176、咒缚海盗机制 117/117、DiceThrone 样式合同 11 项、Thor 定向资源 manifest 均通过；第二次稳定构建退出码 0，构建前后摘要一致。日志和摘要记录暂存于 `temp/codex-thor-audit/`，待真实入口稳定后归档到当前证据目录。
- 本轮对六项正式运行媒体逐项执行远端 HEAD：player-board、tip、ability-cards、dice、status-icons-atlas、portrait 均 200，远端长度与本地 manifest 一致。其余官方 QA / 生命盘 / CP 盘为 reference-only，未由 Thor runtime 消费；不属于六项发布集合。`thor-weekly-assets-backup-20261023.md` 已记录 2026-10-26 云端只读实查：周 timer enabled，2026-W43 service 成功完成。
- 当前最新验证仍不能关闭任务 6/7：Thor 真实交互、在线入口、四个共享弃牌消费者的同摘要 E2E、逐图审查、PASS manifest、evidence validator 和 audit selfcheck 均待完成。2026-10-26 03:03 CST 的 E2E doctor 显示 Qidahen `shared-single` runtime `e2e-1792954871874-o5c4dq` 正在运行并占用全局重任务；未启动或中断其运行。
- 任务 8 继续未勾选，须等用户明确确认进入完成态。

## 2026-10-26 稳定源码实施中门槛复审

本节为当前结论，取代上方“候选摘要待复跑”状态；只覆盖索尔实施中门槛，不代表任务 8 的完成态确认、生产部署或移动端验收。`getFrontendSourceHash()` 本轮复核为 `32560733cbceff378a46e0f1cd3fd4b7ed590c06a899d1b317dfca3647a52c98`；定向规则测试、真实 E2E、构建、样式合同与资源 manifest 日志均记录了同一摘要的前后值。

- **规则/UI 回归：通过。** 14 个定向测试文件 384/384；其中 Thor/UI 176 项、咒缚海盗机制 117 项，另含树精导入与共享合同回归。日志：`temp/codex-thor-audit/thor-cursed-treant-regressions-325607.log`。
- **真实入口：通过。** Thor 交互 4/4（`e2e-1792956074228-4ozck4`）、真实双人在线选择/开局 1/1（`e2e-1792956207290-2bmsmi`）、咒缚海盗共享弃牌消费者 4/4（`e2e-1792955883753-o9x1jn`）。三次运行隔离在 `6273/20100/21100`，未占用或停止现存 Qidahen shared runtime。日志分别见 `temp/codex-thor-audit/thor-interactions-e2e-325607.log`、`thor-online-entry-e2e-325607.log`、`cursed-pirate-four-consumers-e2e-325607.log`。
- **逐图与行为证据：通过。** 当前包 `evidence/dicethrone/thor-20261026-325607/` 包含 5 条同源行为链、24 张独特状态媒体及 24 份逐图视觉审查；另 1 张取消后常态图因与初始帧重复而不重复登记，但其取消动作、资源未扣、手牌不变和锤子保留仍在 `companion-odin` trace 中核对。`npm run verify:e2e-evidence -- evidence/dicethrone/thor-20261026-325607/pass-manifest.json` 通过。弃牌成本图显示手牌区原位选牌、共享提示与取消，没有通用弹窗；与本体弃牌交互一致。
- **正式资源与备份：通过。** 六项 Thor 运行资源远端 HEAD 均为 200，Content-Length 与本地 manifest bytes 一致；每周备份 timer enabled，2026-W43 service 成功，见 `evidence/dicethrone/thor-weekly-assets-backup-20261023.md`。
- **构建和资源合同：通过。** `npm run build` 退出码 0；DiceThrone 样式合同扫描 11 项通过；定向资产 manifest 校验通过。对应日志为 `temp/codex-thor-audit/build-325607.log`、`style-contract-325607.log`、`dicethrone-assets-manifest-325607.log`。构建仍有既存非阻塞 CSS / Browserslist / chunk-size 警告。
- **标准复核：无须改规范。** `rule-driven-interaction-design.md` 的同交互族同源复用原则和变更设计中“不另加确认壳”已足够明确；本次缺口是实现和验收没有按既有语义复用。当前规范不新增第二份执行正文，消费者映射保留在 `thor-selectHandCard-cross-consumer-20261025.md`。
- **同类扩审范围与结果：** 本次检索 `selectHandCardToDiscard`、`requestOpponentDiscardOneCard` 与 `paidHammerChoice` 的生产者及 `Board.tsx` / `HandArea.tsx` 消费路由；命中索尔姆乔尔尼尔投掷/召回成本、咒缚海盗深海潜行、瞭望台战利品、走跳板弃牌四类单张弃牌入口，逐一由真实 E2E 覆盖。查看对手手牌后确认属于只读确认；走跳板的“偷资源或弃牌”弹层属于效果分支；骰面组合及多选手牌也不是单张弃牌。当前生产侧不存在 `selectCount > 1` 的弃牌入口，残余范围仅在未来新增该类生产者或引入其它 `selectHandCard` 语义时重新扩审，不将其外推为本次通过。
- **漏审归因：** 旧最终包中的弃牌截图实际显示 `ChoiceModal`，却仍被视觉报告标为 `PASS`；旧验收没有把规则动作与既有 `HandArea` 交互 owner 作逐图对照，也没有把共享弃牌 helper 的四类生产入口放在同一矩阵内检查。结果是截图在中间态被接受，未发现实现/UI owner 不符合变更设计。当前实现已按明确的单张弃牌语义复用 `HandArea`，并由同源真实入口、逐图视觉审查和消费者矩阵覆盖。
- **边界：** 视觉证据为桌面 1920×1080，移动端未覆盖；伤害数字短时覆盖对手数值、放大手牌图顶部玩家栏贴近视口边缘，均已记入视觉审查备注且未阻塞此次交互。任务 6/7 的对象审计和实施中门槛已达成；任务 8 仍未勾选，只有用户明确确认后才能关闭派系任务。

## 2026-10-27 完整交互复审（当前范围通过）

本节是当前状态；前文 `325607` 及后续失败候选均为历史证据。用户要求一个交互有问题就整组重审，本轮覆盖全部索尔交互族及四个共享单张弃牌消费者。当前范围的规则、真实入口、独立图面审查、构建和最终媒体清单均已通过，达到本地桌面实施中门槛；任务6/7按本节范围收口，任务8继续保留用户确认门。

### 根因与正式 owner

- **规范与执行：** 当前 [`ui-change-gates.md:136`](../../.spec/knowledge/standards/ui-change-gates.md) 已要求复用组件、状态机、选择、预览、确认和取消完整链路。此前只换成骰盘外观、仍自行构造 `thor-worthy` 描述，属于实施与验收漏审；本轮不再新增平行规范正文。
- **改骰：** `modify-die-any-1` 与 `thor-worthy` 共用公共 `buildModifyDieAny1Interaction`。索尔只配置 `[4,5]`，沿用 `mode:any`、骰盘原加减预览、手动确认和原取消退款链；服务端继续检查操作者、合法骰及允许点数。没有角色专属点数弹窗。
- **弃牌：** 单张弃牌成本继续由既有 `HandArea` 选择提交；索尔成本允许取消，海盗强制弃牌不增加取消。完整可见配置补偿扇形位移与旋转。扩审实际发现瞭望台悬停候选仍越过720底边，根因是公共单位读取把 `1vw` 当作 `1px`；`runtimeLayoutUnits` 现在保留 `px/vw/vh` 语义。两个读取函数的生产消费者均为 `HandArea`，未增加角色偏移特例。红测底边733.736、悬停上移3.1px，修后底边697.156、上移39.68px。
- **棋盘视口：** 逐图复审继续发现改骰后P2头像被裁，红测记录棋盘根 `scrollTop=38`、头像top=-20.734，窗口scrollY仍0。固定棋盘根由 `overflow-hidden` 改为 `overflow-clip`，消除根容器的程序滚动语义。原加减定位点击未改，绿测五图顶部均17.266、内部滚动为空；未用scrollTo、强制点击或状态重置掩盖问题。
- **奥丁II：** 复用效果骰结算owner、骰盘、原动作槽与 `REROLL_BONUS_DIE`，扩展规则必需的一次子集输入：选中/撤选→同槽整组重掷→原结算确认。旧点一骰立即重掷不能表达这项规则，因此不声称复用了 `selectDie` 重掷卡状态机；没有“重置所选”额外按钮。
- **连锁闪电与破防：** 连锁闪电在既有 `ChoiceModal` 比较两骰组合及伤害，属于结果比较，不能直接替换为确认后重掷的 `selectDie`；破防沿用原响应入口、效果骰和确认链。两者都没有第二套规则状态。

### 当前验证与源码范围

- 15个定向测试文件442/442，包括Thor领域/卡牌、共享UI、海盗/树精回归、响应边界及4个公共CSS长度行为测试；日志 `temp/codex-thor-audit/thor-regressions-clip-final-20261027.log`。当之无愧测试断言公共交互合同，不把调用同一个builder作期望值。
- 正式隔离真实入口10/10：`e2e-1793036760545-ahqi4o`，含索尔5条交互、在线开局1条与四个海盗共享弃牌入口；日志 `thor-all-entry-clip-final-20261027.log`。在线媒体另于 `e2e-1793038085138-is2r0u` 真实复跑1/1，修正其运行身份元数据；不改写旧sidecar。两次均仅清理自有隔离runtime。
- Thor25张交互原图绑定实际runtime启动摘要 `1c90c20f2ac33b548363a763236d9461f13eb116c006855a74b7ddeb2818205b`，磁盘摘要另存 `workspaceSourceRevision`；在线链保留它自己的真实启动版本。不能把实时磁盘摘要冒充运行身份。
- `source-scope.json` 保存2,633个前端输入的逐文件指纹、测试/E2E/当前差异及后端实际打包输入核对。范围外Fate、七大恨与未挂载的 `TutorialOverlay` 变更不机械使本轮DiceThrone证据失效：非课程路由在 `useMatchRoomTutorialLifecycle.tsx:671` 提前返回，只有课程激活分支挂载教程浮层；本轮测试导入链和真实对局均不消费该浮层。保留原始差异，不称当前全仓摘要通过。
- 本地 `npm run build` 退出码0；样式合同11项、定向manifest校验通过。日志分别为 `build-clip-final-20261027.log`、`style-contract-clip-final-20261027.log`、`asset-manifest-clip-final-20261027.log`。既存CSS/Browserslist/chunk警告保留。
- **全仓类型检查未通过。** `typecheck-final-20261027.log` 保留完整诊断；旧 `temp/dicethrone-intake/thor/typecheck-final.log` 已有Board的Die、DiceTray的PlayerId、通用turnPhase及server项目DOM边界诊断。既存server DOM工程边界仍未修复，本轮长度读取新增的window引用也受同一边界影响。未改TypeScript配置、关闭检查或吞错；本轮浏览器交互及证据通过不等于全仓类型通过。
- 六项正式运行资源再次HEAD均200且字节数等于本地，记录 `thor-20261026-shared-flow/asset-head-check.json`；每周备份沿用已启用的timer与2026-W43成功记录，见备份专项证据。

### 本轮交互与媒体覆盖

| 新增交互 / 可见状态 | 玩家真实动作 | 直接断言 | 截图组 / trace / PASS清单 | VIEWER_URL | 当前结论 | 未覆盖范围 |
| --- | --- | --- | --- | --- | --- | --- |
| 单张弃牌成本与取消 | 主动入口→原手牌选牌/取消 | HP49、锤子归属、手牌/CP恢复；候选边界完整 | companion-odin；四共享消费者矩阵 | [图集](http://127.0.0.1:4867/?key=bc28039b7cba) | passed | 移动端 |
| 奥丁II一次子集重掷 | 真升级→掷骰选能力→选两骰→同槽重掷→确认 | 子集高亮、rerollCount仅增1、回主防御 | companion-odin | [图集](http://127.0.0.1:4867/?key=bc28039b7cba) | passed | 移动端 |
| 当之无愧预览/确认 | 真鼠标完整检视→拖牌→原加减→确认 | 非4/5禁确认、仅一骰变4、顶部栏始终完整 | worthy | [图集](http://127.0.0.1:4867/?key=bc28039b7cba) | passed | 移动端 |
| 当之无愧取消 | 原加减预览4→原取消 | 权威骰不变、退牌、CP恢复5、弃牌堆空 | worthy-cancel | [图集](http://127.0.0.1:4867/?key=bc28039b7cba) | passed | 移动端 |
| 连锁结果比较 | 原效果骰确认→组合候选 | 附属HP-2与主bonus10分别保留 | chain-lightning | [图集](http://127.0.0.1:4867/?key=bc28039b7cba) | passed | 移动端 |
| 破防持续消费 | 原响应入口→失败确认→再次消费→成功确认 | 资源2→1→0、HP43、main2收口 | guard-break | [图集](http://127.0.0.1:4867/?key=bc28039b7cba) | passed | 移动端 |
| 在线生命周期 | 双浏览器选角、准备、开局 | 实施中徽标、九槽、四牌 | online-entry | [图集](http://127.0.0.1:4867/?key=bc28039b7cba) | passed | 移动端 |

最终证据目录为 `evidence/dicethrone/thor-20261026-shared-flow/`，唯一清单 `focused-pass-manifest.json`。独立审查51/51原图通过；展示按独特状态整理为26张整屏原图、6条行为链，成本取消回常态保留在trace且显式排除重复展示。正式validator、网页查看器dry-run均通过；注册后实际HTTP列表为26张、索引匹配26张。查看入口：[26张有序图集](http://127.0.0.1:4867/?key=bc28039b7cba)，供用户查看，未据此代称用户已验收。

完整对象清单沿用本文件前面的技能、卡牌和共享流程表，本节回写其受影响消费链，不用图片数量替代逐对象审计。只覆盖桌面1920×1080与共享消费者1280×720；移动端、生产发布、全仓类型通过和用户完成态确认未包含。

## 2026-10-27 用户退回后的规则与交互重审（进行中）

用户要求：先补共享交互合同和验收流程，再修06/11，全部索尔交互按规则与旧流程重审并实际看图。

治理处置：保留ui-change-gates的完整复用原则；在rule-driven-interaction-design的唯一主源补操作分型与提示合同；在e2e-verification的唯一主源补先锁独立预期/红测/图审顺序。没有新增平行skill或通用正文。spec:lint已通过；独立review指出任意编辑也是有限骰值，已将原笼统“有限集合”收窄为“规则枚举的固定目标结果”。

回归锁定：06是旧图集中奥丁II子集重掷无提示；11是固定4/5误接any加减。原图已实际读取。旧正常操作语法来源为公共固定6的mode:set及clientDiceMultistepInteraction自动提交；原选骰提示来源为RightSidebar原hint_select投影。旧51图不能反驳用户指出的问题。首次错误在选择共享流程时按实现便利选择any，随后测试及合同消费映射依样自证。

| 对象 | 规则/旧流程来源 | 修改前锁定的玩家预期 | 禁止行为与权威后态 |
| --- | --- | --- | --- |
| 06 奥丁II | 原卡slot22、FAQ任意数量一次；原效果骰结算与提示气泡 | 空选提示可选子集或确认保留；已选提示重掷/保留；原同槽动作一次提交；原确认继续 | 不新增重置按钮；未提交不改骰；只重掷所选一次，基础奥丁不可用 |
| 11 当之无愧 | 原卡slot27实际读图“将你1颗骰子的数值改至4或5”；公共固定6旧set链 | 直接4/5候选→带目标值的选骰提示→点击自己骰子即提交；点骰前可取消退款 | 不出现加减/其它值；点骰前权威骰面不变；仅一骰改变且清理交互 |
| 全部索尔交互 | 独立规则预期temp/codex-thor-audit/independent-rule-expectations-20261027.md；原板/提示板/34卡 | 逐对象审计并按共享流程等价性绑定真实入口与图面证据 | 不能把六条旧代表链说成覆盖所有独有响应、升级或状态 |

同屏保护槽位：角色板九槽、双方头像/生命/CP/token、原阶段与动作区、骰盘、手牌/查看入口、牌库/弃牌堆及当前提示。06提示沿用原骰盘侧边气泡，11仅在原骰盘内补规则候选；不迁移上述槽位。所有新图必须复核提示与对象关系、正式素材、完整候选及玩家第一眼动作。

红测：contract-red-20261027.log为原卡27独立set预期，43项中1失败（实际any、预期set）；真实入口红测在项目runner执行，初次启动被并行源码变化拒绝，未冒充功能红测。后续结果待回填。
