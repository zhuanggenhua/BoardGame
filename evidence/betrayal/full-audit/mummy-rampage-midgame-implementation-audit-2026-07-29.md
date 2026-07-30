# 小黑屋木乃伊横行中段实现审计（2026-07-29）

> 2026-07-29 接续边界：本文件只审「木乃伊横行」进入作祟后的中段运行链，消费 `docs/games/betrayal/haunts/01-mummy-rampage.md`、当前实现、测试和既有 evidence。它不重新录入图包，不裁定「女孩」触发牌版本冲突，不替代 74 张发现牌、42 个房间、全部作祟或完整自然长链 E2E。

## 审计范围

本文件覆盖第 1 剧本「木乃伊横行」作祟开始后的中段规则消费：

- setup：叛徒、木乃伊、石棺、女孩、知识标记、公开 token。
- 英雄线：寻找木乃伊真名、学习驱逐法术、驱逐木乃伊。
- 叛徒线：拾起女孩、交女孩给木乃伊、交圣符或指环给木乃伊、木乃伊回石棺胜利。
- 木乃伊规则：强制关键预兆、0/1 移动骰瞬移、同房必须先攻击、2 点以上伤害后偷取或造成伤害。
- 终局读模型：英雄胜利与叛徒胜利的 If You Win 正文承接。

本文件不审整牌库效果、房间效果、事件牌「怪异的镜子」7 号作祟完整链、圣符/指环自身牌效完整链，也不新增玩法实现。

## 结论等级

结论等级：`mummy-rampage-midgame-indexed / domain-and-board-representative-verified / hero-traitor-monster-and-forced-omen-e2e-verified / downstream-open`。

含义：木乃伊横行中段规则已经有合同、命令、校验、事件、reducer、目标条/token、领域代表测试和 Board 主动作代表测试；剧本阅读与终局朗读已有真实入口 E2E。本轮已补木乃伊怪物行动真实入口的 1 点移动骰和造成伤害分支：木乃伊移动骰为 0 或 1 时，真实页面均可从怪物动作槽进入移动模式并瞬移到女孩房间自动拾起女孩；木乃伊真实攻击后点击「造成伤害」会进入受伤英雄的「木乃伊攻击」物理伤害分配页，受伤英雄确认强制速度/力量伤害后会扣属性轨道格，并回到真实牌桌/投骰复盘界面。此前已补强制关键预兆真实探索 E2E / 截图链：英雄作祟后探索预兆房会强制从预兆堆找出「书本」，叛徒作祟后探索预兆房会强制从预兆堆找出「圣符」或「指环」，并在发现面板显示木乃伊横行强制找牌提示。此前已补叛徒行动真实入口 E2E / 截图链：叛徒从真实牌桌主动作拾起女孩、交女孩给木乃伊、交出圣符进入叛徒终局，并覆盖木乃伊已持女孩时交出指环进入叛徒终局；此前已补英雄行动真实入口 E2E / 截图链：寻找木乃伊真名取得第 1 枚知识标记、学习驱逐法术取得第 2 枚知识标记、驱逐木乃伊进入英雄终局朗读和结果报告；此前已补木乃伊怪物行动真实入口 E2E / 截图链：移动骰 0 瞬移女孩房间并拾起女孩、同房必须先攻击、攻击后返回牌桌选择偷走地图。当前仍不能宣称“木乃伊剧本完成”或“端到端完成”，因为非法目标、已攻击后移动恢复、偷女孩/偷其它预兆、死亡保护/减伤/胸针/头骨等伤害组合、整局自然链和大量卡牌/房间组合仍未闭合。

## 权威来源

| 类型 | 当前来源 |
| --- | --- |
| 剧本合同 | `docs/games/betrayal/haunts/01-mummy-rampage.md`，状态 `locked-minimum-runtime-contract` |
| 剧本卡入口 | `src/games/betrayal/scenarioConfig.ts:461-552`，默认首剧本为「木乃伊横行」 |
| 运行配置 | `src/games/betrayal/scenarioConfig.ts:2470-2518`，当前配置仍保留 `hauntTriggerLabel: '女孩'` |
| 领域实现 | `src/games/betrayal/game.ts` 的木乃伊 setup、特殊行动、怪物移动/攻击、奖励偷取、终局结算 |
| 页面承接 | `src/games/betrayal/Board.tsx` 的作祟特殊行动按钮、木乃伊奖励按钮、剧本阅读和终局朗读 |
| 测试证据 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`src/games/betrayal/__tests__/Board.foundation.test.tsx`、`e2e/betrayal/scenario-flow-new-rules.e2e.ts`、`e2e/betrayal/mummy-rampage-hero-actions.e2e.ts`、`e2e/betrayal/mummy-rampage-traitor-actions.e2e.ts`、`e2e/betrayal/mummy-rampage-monster-actions.e2e.ts`、`e2e/betrayal/mummy-rampage-forced-omen-draw.e2e.ts` |

## 规则子句拆解

| 子句 | 合同语义 | 当前实现消费 |
| --- | --- | --- |
| setup | 叛徒为揭秘者；木乃伊和石棺放在叛徒房间；女孩标记放到远离木乃伊的房间；准备 2 枚知识标记。 | `setupMummyHaunt()` 创建木乃伊运行态并放置怪物，作祟开始 reducer 在 1 号木乃伊剧本时接入该 setup。 |
| 英雄找真名 | 存活英雄在石棺房、研究室/书房或图书馆做 6+ 知识检定，成功得第 1 枚知识标记。 | `isMummyNameStudyRoom()` 覆盖石棺房、`study`、`library`、研究室/书房/图书馆；validator 和 reducer 写入第 1 标记。 |
| 英雄学法术 | 找到真名后，持有书本的存活英雄做 6+ 知识检定，成功得第 2 枚知识标记并学会驱逐。 | validator 要求真名已找到且行动者持书本；reducer 写 `knowledgeTokenCount >= 2` 和 `banishmentSpellLearned`。 |
| 英雄驱逐 | 2 枚知识标记后，书本与木乃伊同房，英雄与木乃伊同房，用神志击败木乃伊则英雄胜利。 | validator 要求同房、书本同房和 2 标记；execute 用英雄神志对抗木乃伊神志；成功写英雄终局。 |
| 叛徒送女孩 | 任意人物可拾起女孩；叛徒持女孩并与木乃伊同房时可交给木乃伊。 | validator 区分拾起女孩和交女孩；Board 主动作可见“拾起女孩/交出女孩”；reducer 写女孩持有状态。 |
| 叛徒送圣符/指环 | 叛徒持圣符或指环并与木乃伊同房时可交给木乃伊。 | `findMummyWeddingOmenCard()` 只找圣符/指环；validator 要求叛徒、同房、未交过；reducer 从叛徒持有区移除并加入木乃伊携带列表。 |
| 叛徒胜利 | 木乃伊持女孩和圣符/指环之一并返回石棺，或所有英雄死亡。 | `completeMummyTraitorVictoryIfNeeded()` 在女孩、婚礼预兆和石棺同房同时成立时写叛徒终局；怪物攻击伤害路径可进入所有英雄死亡终局。 |
| 强制关键预兆 | 英雄后续翻预兆时强制找书本；叛徒后续翻预兆时强制找圣符或指环。 | `resolveMummyForcedOmenDraw()` 按角色从预兆堆找目标并洗牌；领域测试覆盖英雄找书本、叛徒找圣符/指环。 |
| 木乃伊移动 | 木乃伊移动骰为 0/1 时可去任意已发现房间；与英雄同房且未攻击时必须先攻击。 | 移动 helper 对 0/1 瞬移和同房强制攻击做领域约束；领域测试覆盖瞬移和移动禁用。 |
| 木乃伊攻击奖励 | 木乃伊造成 2 点以上伤害时，可偷 1 件物品/预兆代替伤害，也可夺取女孩；若造成伤害，英雄先扣速度再扣力量。 | 攻击后写 `pendingAttackReward`；Board 显示造成伤害/偷取按钮；reducer 支持偷女孩、偷物品/预兆或进入强制伤害分配。 |

## 实现入口索引

| 链路 | 当前入口 | 审计判断 |
| --- | --- | --- |
| 默认剧本卡 | `scenarioConfig.ts:461-552` | 「木乃伊横行」是默认且 implemented；其余 6 张候选为待接入。 |
| 触发版本冲突 | `scenarioConfig.ts:466-468`、`2473-2478` | 合同/配置仍写「女孩」，但当前 9 张预兆不含女孩；运行态用真实触发牌代表进入木乃伊，仍是 `disputed / representative-only`。 |
| setup | `game.ts:4362-4369`、`20725-20727` | 作祟开始会创建木乃伊运行态和怪物。 |
| 找真名合法房间 | `game.ts:4639-4651` | 覆盖石棺房、书房/研究室、图书馆。 |
| 作祟特殊行动定义 | `game.ts:7890-7932`、`8037-8050` | 木乃伊三条英雄特殊行动进入通用特殊行动状态系统。 |
| 命令校验 | `game.ts:15462-15556` | 英雄、叛徒、女孩、婚礼预兆、同房和每回合一次预算均有 validator。 |
| 命令执行 | `game.ts:18502-18597`、`18096-18130` | 产生找真名、学法术、驱逐、拾女孩、交女孩、交预兆、攻击奖励事件。 |
| 状态写入 | `game.ts:21832-21976`、`21480-21525` | 写知识标记、recentRoll、女孩状态、木乃伊携带预兆、奖励偷取和伤害分配。 |
| 叛徒胜利 | `game.ts:4683-4695` | 女孩、圣符/指环和石棺三条件同时成立时触发叛徒终局。 |
| Board 主动作 | `Board.tsx:9033-9112` | 显示拾起女孩、交女孩、交圣符/指环、驱逐、学习法术、找真名按钮。 |
| Board 攻击奖励 | `Board.tsx:11191-11206`、`16760-16794` | 叛徒可点击造成伤害或偷取具体牌；真实 reducer 代表链覆盖偷取后奖励清空/反馈显示，以及选择伤害后打开受伤方分配面板。 |
| 终局读模型 | `game.ts:13279-13295` | 木乃伊英雄/叛徒 If You Win 正文来源被标为可用。 |

## 逐项结论

| 对象/链路 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- |
| 开局与作祟揭示 | 七张剧本卡候选、默认木乃伊、作祟揭示读模型、公开/秘密分册已接入。 | `L2 + L3-reading-e2e` | 触发牌「女孩」冲突未裁定；作祟开始不等于中段自然链完成。 |
| setup 与公开 token | 木乃伊、石棺、女孩、知识进度已生成；目标条和 token 代表链存在。 | `L2 + component-representative` | 真实页面从作祟揭示到地图 token 全截图链仍未单独闭合。 |
| 英雄找真名 | validator、投骰、知识标记、recentRoll、目标条更新和 Board 主动作点击链已接入；真实入口 E2E 覆盖英雄从牌桌主动作点击寻找木乃伊真名，成功后显示“取得第 1 枚知识标记”和“找到了木乃伊真名”；失败反馈和同回合禁用原因已有 Board 代表测试。 | `L2 domain + Board component representative + L3 Playwright screenshot chain` | 仍缺自然整段链、非法房间/非持书等负向 UI 和兔脚/手电筒/书本加成组合。 |
| 英雄学驱逐法术 | 持书英雄、真名前置、6+ 知识检定、第 2 标记、目标条更新和 Board 主动作点击链已接入；真实入口 E2E 覆盖持书英雄从牌桌主动作点击学习驱逐法术，成功后显示“取得第 2 枚知识标记”和“学会驱逐木乃伊的法术”；失败反馈和同回合禁用原因已有 Board 代表测试。 | `L2 domain + Board component representative + L3 Playwright screenshot chain` | 仍缺自然整段链、非持书英雄负向 UI 和兔脚/手电筒/书本加成组合。 |
| 英雄驱逐木乃伊 | 2 标记、书本同房、英雄同房、神志对抗、英雄终局和 Board 主动作点击链已接入；真实入口 E2E 覆盖英雄从牌桌主动作点击驱逐木乃伊后进入英雄终局朗读和结果报告；驱逐失败反馈和同回合禁用原因已有 Board 代表测试。 | `L2 domain + Board component representative + L3 Playwright screenshot chain` | `scenario-flow-new-rules.e2e.ts` 只验证 ready-to-exorcise 注入态按钮可见；本轮补了三段注入态真实入口，但仍缺自然整段从找真名/学法术/驱逐连续走完、驱逐失败真实页和神志加值/重掷组合。 |
| 叛徒拾/交女孩 | Board 代表测试覆盖地图 token 状态、主动作按钮、点击后女孩转玩家/木乃伊持有；真实入口 E2E 覆盖叛徒从牌桌主动作点击拾起女孩，女孩 token 改为叛徒持有，再点击交出女孩，女孩 token 改为木乃伊持有。 | `L2 + Board component representative + L3 Playwright screenshot chain` | 仍缺非叛徒/不同房/死亡状态负向 UI、交易后女孩状态和自然整段链。 |
| 叛徒交圣符/指环 | validator 只允许圣符/指环，reducer 移除叛徒持有区并写木乃伊携带；Board 代表链覆盖“交出圣符”和“交出指环”，并覆盖非婚礼牌不出现交出入口、同一预兆已交过不重复显示；真实入口 E2E 覆盖交出圣符进入叛徒终局，并覆盖木乃伊已持女孩时交出指环进入叛徒终局。 | `L2 + Board component representative + L3 Playwright screenshot chain` | 仍缺死亡/交易后组合、更多负向 UI 和木乃伊自然回石棺路径。 |
| 木乃伊回石棺胜利 | 领域测试覆盖木乃伊带女孩和圣符回石棺触发叛徒胜利；叛徒行动 E2E 在木乃伊与石棺同房代表态证明交出圣符/指环后能进入叛徒终局。 | `L2 domain + L3 endgame representative` | 木乃伊自然怪物回合 UI、路径选择、石棺目标提示和自然回石棺截图仍未闭合。 |
| 强制关键预兆 | 领域测试覆盖英雄强制找书本、叛徒强制找圣符/指环并洗牌；真实入口 E2E 覆盖英雄和叛徒作祟后探索预兆房时，发现面板分别显示「书本」与「圣符」以及强制找牌提示。 | `L2 domain + L3 Playwright screenshot chain` | 仍缺牌堆顺序更深组合、与作祟抽预兆确认队列更多组合、女孩版本冲突裁定和整局自然链。 |
| 木乃伊 0/1 瞬移 | 领域测试覆盖 0/1 移动骰可选任意已发现房间并自动拾起女孩；Board 代表链覆盖从怪物动作槽开回合、掷移动骰 0、显示任意已发现房间候选、点击女孩房间并由木乃伊自动拾起女孩；真实入口 E2E 覆盖叛徒从牌桌怪物动作槽开回合，分别掷 0 点和 1 点移动骰，进入移动模式并点击女孩房间后，木乃伊瞬移到女孩房间并自动拾起女孩。 | `L2 domain + Board component representative + L3 Playwright screenshot chain` | 非法未发现房间、更多楼层/房间目标组合仍未闭合。 |
| 同房先攻击 | 领域测试覆盖木乃伊与英雄同房且未攻击时移动入口禁用、攻击目标可用；Board 代表链覆盖读模型禁用移动原因、页面不显示移动入口、攻击入口点木乃伊再点同房英雄并进入攻击投骰；真实入口 E2E 覆盖同房时页面不显示移动入口，只能点木乃伊攻击并选择同房英雄。 | `L2 domain + Board component representative + L3 Playwright screenshot chain` | 非法目标提示、已攻击后移动恢复、更多英雄/死亡过滤组合仍未闭合。 |
| 攻击后偷取/伤害 | 领域测试覆盖 2 点以上伤害后偷女孩/物品/预兆和选择伤害后先扣速度；Board 代表测试覆盖奖励按钮、偷取后奖励清空/反馈显示，以及选择伤害后等待受伤方分配；真实入口 E2E 覆盖木乃伊攻击后返回牌桌出现造成伤害/偷地图/偷圣符入口，点击偷走地图后目标英雄持有区移除地图并清空奖励，点击造成伤害后进入受伤英雄的「木乃伊攻击」物理伤害分配页，受伤英雄确认强制速度/力量伤害后扣属性轨道格并回到牌桌/投骰复盘界面。 | `L2 + Board component representative + L3 Playwright screenshot chain` | 偷女孩、偷圣符/指环、死亡保护/头骨/盔甲/胸针和更多伤害来源组合仍未闭合。 |
| 终局朗读 | 领域读模型和 Board 终局朗读测试覆盖英雄/叛徒正文，不显示翻译 key；剧本流程 E2E 覆盖阅读和终局朗读代表入口。 | `L2 + L3 reading/endgame representative` | 终局朗读证明文本承接，不证明中段自然胜利链 E2E。 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 剧本卡候选 | `Board.foundation.test.tsx:1193-1249` 覆盖七张候选、木乃伊默认 implemented、待接入剧本不能开始。 |
| 作祟揭示/读模型 | `firstScenarioRuntime.test.ts:4333-4369` 覆盖公开步骤、setup 队列和英雄/叛徒秘密边界。 |
| 目标条与 token | `firstScenarioRuntime.test.ts:4441-4478` 覆盖知识标记目标条；`firstScenarioRuntime.test.ts:4495-4517` 覆盖石棺、女孩、木乃伊 token。 |
| setup | `firstScenarioRuntime.test.ts:4564-4604` 覆盖木乃伊、石棺、女孩、0/2 知识进度。 |
| 英雄线 | `firstScenarioRuntime.test.ts:4606-4682` 覆盖找真名、学驱逐法术、驱逐木乃伊并进入英雄终局。 |
| 叛徒线 | `firstScenarioRuntime.test.ts:4684-4772` 覆盖拾女孩、交女孩、交圣符、木乃伊回石棺并进入叛徒终局。 |
| 强制关键预兆 | `firstScenarioRuntime.test.ts:4774-4847` 覆盖英雄找书本、叛徒找圣符/指环。 |
| 木乃伊移动/攻击规则 | `firstScenarioRuntime.test.ts:4849-5070` 覆盖 0/1 瞬移、同房先攻击、2 点以上偷取、伤害先扣速度和英雄死亡叛徒终局。 |
| Board 叛徒主动作 | `Board.foundation.test.tsx:1790-1869` 覆盖拾起女孩、交出女孩、交出圣符、交出指环、非婚礼牌不出现交出入口和同一预兆已交过不重复显示。 |
| Board 英雄主动作 | `Board.foundation.test.tsx:1861-2018` 覆盖找真名、学驱逐法术、驱逐木乃伊三段从牌桌主动作按钮经真实 reducer 进入玩家可见结果，并覆盖三段失败反馈与同回合禁用原因。 |
| Board 攻击奖励 | `Board.foundation.test.tsx:2121-2188` 覆盖木乃伊奖励 banner、造成伤害按钮、偷地图/圣符按钮和 dispatch；真实 reducer 代表链覆盖偷地图后奖励清空/反馈显示，以及选择伤害后打开木乃伊攻击伤害分配面板。 |
| Board 木乃伊怪物行动 | `Board.foundation.test.tsx:2190-2307` 覆盖 0 点移动骰从牌桌怪物动作槽瞬移到任意已发现房间并自动拾起女孩；覆盖同房英雄时移动 slot 被“必须先攻击”规则禁用，页面攻击入口可点木乃伊和同房英雄并进入木乃伊攻击投骰。 |
| 终局朗读 | `Board.foundation.test.tsx:5837-5867` 覆盖英雄/叛徒终局正文不显示翻译 key。 |
| 剧本阅读 E2E | `scenario-flow-new-rules.e2e.ts:110-185` 覆盖公开揭示、英雄书；`scenario-flow-new-rules.e2e.ts:230-292` 覆盖叛徒书、ready-to-exorcise 注入态按钮可见。 |
| 木乃伊英雄行动 E2E | `e2e/betrayal/mummy-rampage-hero-actions.e2e.ts` 3 passed：① 英雄从真实牌桌入口寻找木乃伊真名并取得第 1 枚知识标记；② 持书英雄从真实牌桌入口学习驱逐法术并取得第 2 枚知识标记；③ 英雄从真实牌桌入口驱逐木乃伊并进入英雄终局朗读和结果报告。截图：`evidence/山屋惊魂-木乃伊英雄行动真实入口/01-寻找真名前.jpg` 到 `07-驱逐成功英雄结果报告.jpg`。 |
| 木乃伊叛徒行动 E2E | `e2e/betrayal/mummy-rampage-traitor-actions.e2e.ts` 2 passed：① 叛徒从真实牌桌入口拾起女孩、交给木乃伊、交出圣符并进入叛徒终局朗读和结果报告；② 木乃伊已持女孩时，叛徒从真实牌桌入口交出指环并进入叛徒终局朗读。截图：`evidence/山屋惊魂-木乃伊叛徒行动真实入口/01-拾起女孩前.jpg` 到 `07-交出指环后叛徒终局朗读.jpg`；证据说明：`evidence/山屋惊魂-木乃伊叛徒行动真实入口/e2e-test.md`。 |
| 木乃伊怪物行动 E2E | `e2e/betrayal/mummy-rampage-monster-actions.e2e.ts` 4 passed：① 木乃伊移动骰 0 从怪物动作槽瞬移女孩房间并自动拾起女孩；② 木乃伊移动骰 1 仍可从怪物动作槽瞬移女孩房间并自动拾起女孩；③ 木乃伊与英雄同房时必须先攻击，攻击后返回牌桌可选择偷走地图；④ 点击造成伤害后进入受伤英雄的「木乃伊攻击」物理伤害分配页，并由受伤英雄确认强制速度/力量伤害后扣属性轨道格、回到牌桌/投骰复盘界面。截图：`evidence/山屋惊魂-木乃伊怪物行动真实入口/01-木乃伊怪物回合开始前.jpg` 到 `13-木乃伊1点瞬移后女孩由木乃伊持有.jpg`；证据说明：`evidence/山屋惊魂-木乃伊怪物行动真实入口/e2e-test.md`。 |
| 木乃伊强制关键预兆 E2E | `e2e/betrayal/mummy-rampage-forced-omen-draw.e2e.ts` 2 passed：① 英雄作祟后探索预兆房会强制从预兆堆找出「书本」；② 叛徒作祟后探索预兆房会强制从预兆堆找出「圣符」或「指环」。截图：`evidence/山屋惊魂-木乃伊强制关键预兆真实探索/01-英雄探索预兆前.jpg` 到 `04-叛徒强制找到婚礼预兆.jpg`；证据说明：`evidence/山屋惊魂-木乃伊强制关键预兆真实探索/e2e-test.md`。 |
| 本轮新增验证 | `npx eslint e2e\betrayal\mummy-rampage-monster-actions.e2e.ts`：0 errors；`npx cross-env CODEX_MANAGED_BY_NPM=1 NODE_OPTIONS=--max-old-space-size=8192 PW_USE_DEV_SERVERS=false PW_ALLOW_DEV_SERVER_TESTS=false npm run test:e2e:file -- e2e/betrayal/mummy-rampage-monster-actions.e2e.ts`：4 passed。AI 核图 `09-木乃伊选择造成伤害后分配页.jpg`：真实牌桌中央显示「伤害分配 / 木乃伊攻击」，受伤英雄为杰登·琼斯，8 点物理伤害，力量/速度分配项可见，确认按钮为等待状态。AI 核图 `10-木乃伊造成伤害分配后回到牌桌.jpg`：真实牌桌/投骰复盘可见，未进入终局，反馈区显示杰登·琼斯已将木乃伊攻击伤害分配到速度，并提供「返回牌桌」入口。AI 核图 `11-木乃伊移动骰1点.jpg`：真实牌桌骰盘显示「每只可移动 1 间」和「总点数 1」；`12-木乃伊1点瞬移女孩房间目标高亮.jpg` 显示女孩房间处于目标高亮；`13-木乃伊1点瞬移后女孩由木乃伊持有.jpg` 已由 E2E 断言确认木乃伊移动到女孩房间且女孩 token 状态为木乃伊持有。此前强制关键预兆 E2E `mummy-rampage-forced-omen-draw.e2e.ts` 为 2 passed，英雄行动 E2E `mummy-rampage-hero-actions.e2e.ts` 为 3 passed，叛徒行动 E2E `mummy-rampage-traitor-actions.e2e.ts` 为 2 passed。 |
| 审计文档自检 | `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/mummy-rampage-midgame-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/item-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/runtime-implementation-consumption-audit-2026-07-29.md` 通过，检查 6 个审计文档 OK。 |

## 测试语义对账

| 证据桶 | 测试断言证明的最终状态 | 不能外推的事项 |
| --- | --- | --- |
| 领域命令链 | 命令执行后 `scenarioRuntime.mummy`、知识标记、女孩状态、木乃伊携带牌、pending 奖励、伤害分配和 endgame result 确实变化。 | 不能证明玩家从真实页面自然触发每一步。 |
| Board 组件代表链 | 主动作按钮和奖励按钮能在特定夹具状态下显示并 dispatch；部分点击通过 Harness reducer 更新 UI。 | 不能替代 Playwright 自然链、截图证据、移动/攻击真实面板和所有负向 UI。 |
| 剧本阅读 E2E | 真实页面能显示木乃伊公开揭示、英雄书、叛徒书、目标承接和终局正文代表入口。 | 这条剧本阅读链本身不能证明找真名、学法术、交女孩、交圣符/指环或怪物行动；怪物移动/同房攻击/偷地图已由 `mummy-rampage-monster-actions.e2e.ts` 单独覆盖。 |
| 木乃伊英雄行动 E2E | 真实页面证明英雄可从牌桌主动作完成寻找真名、学习驱逐法术和驱逐木乃伊三段入口，并看到知识标记反馈、法术反馈、英雄终局朗读和结果报告。 | 不证明同一整局自然跨回合连续完成、非持书/非法房间负向 UI、加成/重掷组合或叛徒交女孩/圣符/指环。 |
| 木乃伊叛徒行动 E2E | 真实页面证明叛徒可从牌桌主动作完成拾起女孩、交女孩给木乃伊、交出圣符进入叛徒终局，并证明木乃伊已持女孩时交出指环也可进入叛徒终局。 | 不证明木乃伊自然怪物回合回石棺、死亡/交易后组合、更多负向 UI、伤害分支或整局自然胜利链。 |
| 木乃伊怪物行动 E2E | 真实页面证明叛徒可从怪物动作槽完成木乃伊移动骰 0 和 1 的瞬移、自动拾女孩、同房强制攻击、攻击后偷走地图，并可在攻击奖励里选择造成伤害进入受伤英雄的物理伤害分配页；受伤英雄确认分配后会扣速度/力量轨道格并回到牌桌/投骰复盘。 | 不证明非法目标、已攻击后移动恢复、叛徒交女孩/圣符/指环、死亡保护/减伤/胸针/头骨或整局自然胜利链。 |
| 强制关键预兆 | 领域状态和真实页面共同证明后续探索预兆时能从预兆堆找书本或圣符/指环并洗牌，发现面板能显示目标预兆和强制找牌说明。 | 不证明作祟检定队列更多组合、牌堆顺序更深组合或「女孩」版本冲突裁定。 |
| 木乃伊攻击奖励 | 领域状态证明偷取和伤害分支最终落地；Board 证明奖励按钮存在；真实入口 E2E 已证明偷走地图分支从怪物攻击面板自然产生并落地，也证明造成伤害分支会进入受伤英雄的木乃伊攻击伤害分配页，并能由受伤英雄分配强制速度/力量伤害后回到牌桌。 | 不证明偷女孩、偷其它预兆、所有伤害减免/死亡保护/偷取 UI 组合。 |

## 命中 D 维度

| 维度 | 本文件中的命中点 |
| --- | --- |
| D1 语义保真 | 「女孩」触发牌版本冲突必须保留 disputed；不能用当前运行代表链反写规则书触发表。 |
| D3 数据流闭环 | 剧本合同、命令校验、执行事件、reducer、Board 按钮和测试必须按子链对齐。 |
| D5 交互完整 | 找真名、学法术、驱逐、交女孩/预兆、偷取/伤害都是玩家决策点；当前仍缺多条真实 UI 链。 |
| D8 时序正确 | 找真名先于学法术，2 标记先于驱逐；木乃伊同房先攻击后移动；攻击后奖励必须先结算再进入伤害或偷取收口。 |
| D12 写入-消耗对称 | 知识标记、女孩 holder、木乃伊携带预兆、pending attack reward 必须由同一运行态写入并消费。 |
| D15 UI 状态同步 | Board 主动作读取 `mummyRuntime`、当前房间、叛徒身份和持有牌来展示按钮；奖励按钮读取 pending 奖励和可偷牌。 |
| D18 否定路径 | 英雄/叛徒身份、死亡、同房、持书、持圣符/指环、已交过、同房先攻击等负向路径不能被正向代表链外推。 |
| D35/D36 延迟交互 | 攻击奖励先写 pending，再由玩家选择偷取或伤害，属于 deferred/finalize 型链路。 |
| D55 多消费者一致性 | 圣符/指环既是预兆牌效对象，又是木乃伊胜利物；书本既是预兆牌效对象，又是英雄法术门槛，不能跨专项外推完成。 |

## 共享根因与残余范围

共享根因：旧证据容易把“木乃伊合同已建、领域代表链通过、Board 有按钮、剧本书 E2E 通过”合并成“木乃伊剧本完成”。这会掩盖中段自然 UI/E2E 缺口：玩家必须能从真实牌桌一步步做出找真名、学法术、驱逐、交女孩/圣符/指环、怪物移动、攻击和奖励选择，而不是只在注入态或组件夹具里看到按钮。

残余范围：

- 英雄找真名、学习驱逐法术、驱逐木乃伊已补真实入口 E2E / 截图链、Board 主动作代表链、失败反馈和同回合禁用原因；仍缺自然整段链、非持书/非法房间负向 UI、加成/重掷组合和驱逐失败真实页。
- 叛徒拾起女孩、交女孩、交圣符/指环已补真实入口 E2E / 截图链，并已有 Board 代表链覆盖指环分支、非婚礼牌负向和同一预兆已交过负向；仍缺死亡/交易后组合、更多负向 UI、木乃伊自然回石棺路径和整局自然链。
- 木乃伊移动骰 0 和 1 瞬移女孩房间、同房必须先攻击、攻击后偷走地图、选择造成伤害进入受伤英雄伤害分配页并实际扣属性轨道格回牌桌已补真实 Playwright / 截图链；仍缺非法目标提示、已攻击后移动恢复、偷女孩/偷其它预兆、死亡保护/头骨/盔甲/胸针组合。
- 强制关键预兆已补真实探索翻牌 UI 与截图链；仍缺作祟确认队列更多组合、牌堆顺序更深组合和整局自然链。
- 「女孩」触发牌和当前 9 张预兆不含女孩的冲突仍是数据/版本裁定问题，本审计不现场补录或改触发表。
- 本文件不能替代事件、物品、预兆、房间专项审计，也不能证明 74 张牌库和 42 个房间完成。

## 同类扩审记录

| 项 | 本轮实际范围 |
| --- | --- |
| 搜索范围 | `docs/games/betrayal/haunts/01-mummy-rampage.md`、`scenarioConfig.ts`、`game.ts`、`Board.tsx`、`firstScenarioRuntime.test.ts`、`Board.foundation.test.tsx`、`scenario-flow-new-rules.e2e.ts`、`mummy-rampage-hero-actions.e2e.ts`、`mummy-rampage-traitor-actions.e2e.ts`、`mummy-rampage-monster-actions.e2e.ts`、`mummy-rampage-forced-omen-draw.e2e.ts` |
| 根因关键词 | `mummy-rampage`、`STUDY_MUMMY_NAME`、`LEARN_MUMMY_BANISHMENT`、`BANISH_MUMMY`、`PICK_UP_MUMMY_GIRL`、`GIVE_GIRL_TO_MUMMY`、`GIVE_OMEN_TO_MUMMY`、`RESOLVE_MUMMY_ATTACK_REWARD`、`女孩`、`圣符`、`指环`、`书本` |
| 横向搜索命中 | 木乃伊专属 setup、英雄线、叛徒线、攻击奖励、强制关键预兆、终局读模型和 Board 代表入口均存在；本轮新增强制关键预兆真实探索 E2E 与 4 张截图；此前已补叛徒拾女孩 / 交女孩 / 交圣符 / 交指环真实入口 E2E 与 7 张截图、英雄找真名 / 学法术 / 驱逐真实入口 E2E 与 7 张截图、怪物移动骰 0/1 / 同房攻击 / 偷地图 / 造成伤害分配回牌桌真实入口 E2E 与 13 张截图；伤害/死亡组合和自然整局链仍未覆盖。 |
| 当前裁定 | 可继续做实现消费审计；当前等级只能给 `domain-and-board-representative-verified / hero-traitor-monster-and-forced-omen-e2e-verified / downstream-open`，不能给完成口径。 |

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧矩阵风险 | `runtime-implementation-consumption-audit-2026-07-29.md` 已写“木乃伊中段仍需补真实入口 E2E”，但缺单独专项账本，容易被“剧本阅读/终局朗读 E2E 已通过”误读成剧本完成。 |
| 本轮修订 | 本文件把 setup、英雄线、叛徒线、木乃伊移动/攻击、强制关键预兆和终局朗读拆成独立中段矩阵，并把强制关键预兆真实探索、木乃伊叛徒拾女孩 / 交女孩 / 交圣符 / 交指环、木乃伊英雄找真名 / 学法术 / 驱逐、木乃伊怪物移动骰 0/1 / 同房攻击 / 偷地图 / 造成伤害分配回牌桌真实入口截图链写入对应层级与残余。 |
| 当前状态 | `mummy-rampage-midgame-indexed / domain-and-board-representative-verified / hero-traitor-monster-and-forced-omen-e2e-verified / downstream-open`，不是完成。 |
