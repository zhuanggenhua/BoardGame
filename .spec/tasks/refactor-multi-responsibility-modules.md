---
status: in_progress
---

# 重构单文件多职责设计债

## 涉及范围

- 本轮证据来源：2026-09-02 在仓库根目录用当前文件行数与 `describe(` 分组定位复核手写源码、测试、E2E、工具、文档和配置文件；行数只作为 [`code-design`](../knowledge/standards/code-design.md) 的设计审查触发器，不作为根因结论。
- 首批红线对象：原 `src/engine/transport/__tests__/server.test.ts` 约 28,493 行。它不是当前唯一大文件，也不是因为数字本身被选中；优先处理它是因为它属于共享 transport 测试，且把公共测试夹具、传输协议、在线 AI 恢复、响应窗口、命令队列、训练记录和即时服务端 AI 等不同责任混在同一测试套件，影响面跨多游戏。
- 剩余严重候选当前复核：`src/games/betrayal/game.ts` 约 24,105 行、`src/games/betrayal/Board.tsx` 约 19,957 行。行数变化只作为触发器；实际裁决仍看职责 owner 是否单一。
- 运行时代码风险候选：`src/games/betrayal/game.ts` 与 `src/games/betrayal/Board.tsx` 合计约 44,062 行，且当前工作区已有未提交改动；继续拆运行时前必须保护现有改动边界，按行为合同逐块迁移。
- 已完成首批拆分：公共测试夹具已进入 `src/engine/transport/__tests__/helpers/serverTestHarness.ts`；旧集中测试文件已删除，不保留中转层或兼容壳。
- 已完成第二批拆分：原 `src/games/qidahen/__tests__/payment-selection.test.ts` 已删除；七大恨领域测试夹具进入 `src/games/qidahen/__tests__/helpers/paymentSelectionHarness.ts`，旧文件内的开局、牌源、事件牌、剧本、支付、势力行动、运行时交互、调度战斗、野战撤退、城战围城、年轮结算、人物窗口和胜利规则已拆成 `qidahen-*.test.ts` owner 文件。
- 已完成第三批拆分：原 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 已删除；山屋惊魂首剧本领域测试夹具进入 `src/games/betrayal/__tests__/helpers/firstScenarioRuntimeHarness.ts`，旧文件内的开局、发现、房间文字、事件牌、作祟揭示、木乃伊、灰尘、大宅饿了、顽石之血、魔法相机、怪物行动、交易、持有物、重掷、战斗武器、杰克之灵、搜尸和作祟风险已拆成 `betrayal-*.test.ts` owner 文件。
- 当前验证边界：Betrayal 拆分前当前工作区基线为 696 个用例、7 个交易相关既有失败；拆分后仍为 696 个用例、同 7 个失败，说明本轮只迁移测试 owner，没有借机改运行时行为。
- 已开始第四批运行时 owner 迁移：山屋惊魂交易目标、狗交易目标、交易卡状态读模型已从 `game.ts` / `Board.tsx` 分散实现迁到 `src/games/betrayal/trade.ts`；房间曼哈顿距离、房间连通和地图几何统一迁到 `src/games/betrayal/roomMapModel.ts`；`game.ts`、`trade.ts`、`Board.tsx` 和测试 helper 均直接消费新 owner，不通过旧 `game.ts` re-export 留中间层。
- 已继续第四批运行时 owner 迁移：山屋惊魂剧本阅读器资料、作祟读者范围、段落筛选、开局 / 终局叙事解析和书本分页已迁到 `src/games/betrayal/scenarioReader.ts`；`Board.tsx` 直接消费该 owner，只保留 UI 渲染和交互状态，不保留旧函数转发或兼容壳。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间地图楼层、房间连通、固定暗道 / 特殊通路、地图画布几何、房间中心点和炸药目标读模型已迁到 `src/games/betrayal/roomMapModel.ts`；原 `src/games/betrayal/roomGeometry.ts` 已删除，`game.ts`、`trade.ts` 与 `Board.tsx` 都直接消费同一个地图 owner。
- 已继续第四批运行时 owner 迁移：山屋惊魂持有物展示读模型已迁到 `src/games/betrayal/inventoryPresentation.ts`，承载持有牌视觉强调、使用效果文案、被动规则摘要和减伤来源展示；`Board.tsx` 不再内联这些持有物文案 / 读模型函数。
- 已继续第四批运行时 owner 迁移：山屋惊魂事件选择预览已迁到 `src/games/betrayal/eventChoicePreview.ts`，承载待选属性、预览效果、目标房间、通用伤害选择和事件弃牌候选；该 owner 已收窄为只接收所需持有牌与武器状态，不再 value-import `game.ts` 巨型实现。
- 已继续第四批运行时 owner 迁移：山屋惊魂属性轨与伤害分配选择读模型已迁到 `src/games/betrayal/traitPresentation.ts`，承载属性轨 fallback、轨道位置、可分配伤害步数、伤害属性裁剪和加减选择；`Board.tsx` 只保留渲染组件与点击处理。
- 已继续第四批运行时 owner 迁移：山屋惊魂最近投骰展示读模型已迁到 `src/games/betrayal/recentRollPresentation.ts`，承载投骰显示身份、确认玩家、事件投骰确认展示计数、当前观看者确认资格、总点数和重掷命中框尺寸；`Board.foundation.test.tsx` 已直接引用新 owner，不再从 `Board.tsx` 取导出兼容壳。
- 已继续第四批运行时 owner 迁移：山屋惊魂最新发现展示读模型已迁到 `src/games/betrayal/latestDiscoveryPresentation.ts`，承载发现展示 key、作祟开场 / 剧本书显隐、事件符号跳过、蜘蛛相邻房间识别和发现面板携带的最近投骰快照；`Board.tsx` 只保留队列状态、渲染和点击处理。
- 已继续第四批运行时 owner 迁移：山屋惊魂运行时快照守卫已迁到 `src/games/betrayal/coreSnapshotGuard.ts`，承载外部 `G.core` 与玩家视角 core 的结构校验；`Board.tsx` 不再内联底层字段形状判断。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间展示读模型已迁到 `src/games/betrayal/roomPresentation.ts`，承载结束回合房间提示、房间边缘标记位置和房间身份标签；`Board.tsx` 不再内联这些展示映射。
- 已继续第四批运行时 owner 迁移：山屋惊魂玩家名称展示读模型已迁到 `src/games/betrayal/playerPresentation.ts`，承载玩家席位名与终局探索者展示名解析；最近投骰演员文案也归入 `src/games/betrayal/recentRollPresentation.ts`，复用同一个玩家名称 owner。
- 已继续第四批运行时 owner 迁移：山屋惊魂牌堆 / 弃牌展示读模型已迁到 `src/games/betrayal/deckPresentation.ts`，参考卡页清单已迁到 `src/games/betrayal/referencePresentation.ts`；两者都由 `Board.tsx` 显式传入资源映射，避免复制资源真相源。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间板块调整选择比较与选择裁剪已归入 `src/games/betrayal/roomMapModel.ts`；`game.ts` 的命令校验和 `Board.tsx` 的 UI 预览直接消费同一 owner，旧重复实现已删除。
- 已继续第四批运行时 owner 迁移：山屋惊魂同层直线视线、视线房间列表和视线检测已从 `game.ts` 迁到 `src/games/betrayal/roomMapModel.ts`；`game.ts`、`Board.tsx` 与 `firstScenarioRuntimeHarness.ts` 均直接消费地图 owner，不保留旧 `game.ts` 导出入口。
- 已继续第四批运行时 owner 迁移：山屋惊魂攻击武器效果、炸药识别、武器卡可用状态、失败反伤、攻击范围文案、攻击目标范围 / 炸药目标房间、可攻击探索者目标和受击防御加骰已从 `game.ts` 迁到 `src/games/betrayal/attackRules.ts`；`game.ts`、`Board.tsx`、`eventChoicePreview.ts` 与 `firstScenarioRuntimeHarness.ts` 均直接消费攻击 owner，不保留旧 `game.ts` 导出入口。
- 已继续第四批运行时 owner 迁移：山屋惊魂持有物卡面色调和牌背选择已归入 `src/games/betrayal/inventoryPresentation.ts`；山屋骰面规则值映射、canvas 皮肤生成、骰子样式配置和重掷高亮参数已迁到 `src/games/betrayal/houseDicePresentation.ts`，`Board.tsx` 只保留 3D 骰盘挂载与交互状态。
- 已继续第四批运行时 owner 迁移：山屋惊魂攻击受击反馈读模型已迁到 `src/games/betrayal/attackImpactPresentation.ts`，攻击受击反馈 UI 已迁到 `src/games/betrayal/attackImpactSurface.tsx`；前者承载攻击方 / 防御方损失投影、动画时长和闪光颜色参数，后者承载动画挂载与浮字渲染，`Board.tsx` 只保留子组件挂载。
- 已继续第四批运行时 owner 迁移：山屋惊魂 3D 骰盘 UI 已迁到 `src/games/betrayal/houseDiceSurface.tsx`，承载 DiceBox 物理源挂载、物理状态投影、可访问重掷目标和诊断锚点；`Board.tsx` 只保留 `RecentRollPanel` 中的骰盘挂载与外层结果布局。
- 已继续第四批运行时 owner 迁移：山屋惊魂电影字幕 UI 已迁到 `src/games/betrayal/cinematicNarrationSurface.tsx`，承载开局 / 终局叙事面板、字幕行渲染和按钮槽；`Board.tsx` 只在角色选择、作祟开场、终局和剧本阅读位置挂载该 UI。
- 已继续第四批运行时 owner 迁移：山屋惊魂图集图片框 UI 已迁到 `src/games/betrayal/atlasFrameSurface.tsx`，承载发现牌与持有物图集裁切图片框；`Board.tsx` 只传入已解析的 visual 与展示文案。
- 已继续第四批运行时 owner 迁移：山屋惊魂初始牌堆计数已迁到 `src/games/betrayal/deckModel.ts`，山屋骰子数量裁剪已迁到 `src/games/betrayal/diceRules.ts`，作祟风险 / 预兆总数 / 作祟进度轨读模型已迁到 `src/games/betrayal/hauntProgress.ts`；`game.ts` 只在规则结算处消费风险结果，`Board.tsx` 和相关测试直接消费新 owner，旧 `game.ts` 导出已删除。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间特殊行动状态已迁到 `src/games/betrayal/roomActionReadModel.ts`，承载神秘电梯可用性、回合内已用和发现后回合结束限制；`game.ts`、`Board.tsx` 和相关测试直接消费该 owner，不通过旧 `game.ts` 转发。
- 已继续第四批运行时 owner 迁移：山屋惊魂叛徒能力读模型已迁到 `src/games/betrayal/traitorPowerReadModel.ts`，运行时共用规则判断已迁到 `src/games/betrayal/traitorPowerRules.ts`；`game.ts` 和读模型共同消费规则 owner，旧 `game.ts` 导出和测试 helper 转发已删除。
- 已继续第四批运行时 owner 迁移：山屋惊魂阵营 / 敌友关系读模型已迁到 `src/games/betrayal/entityRelationModel.ts`，承载作祟是否开始、探索者阵营、怪物阵营、实体关系和怪物对探索者关系；`game.ts` 内部阻挡 / 攻击目标判断和 `Board.tsx` 高亮直接消费该 owner，不保留 `game.ts` 旧导出。
- 已继续第四批运行时 owner 迁移：山屋惊魂作祟类型判断、死亡玩家控制特殊怪物时的受控房间、魔法相机持有人、书本 / 图书馆 / 木乃伊 / 石像小天使等作祟实体判断已迁到 `src/games/betrayal/hauntScenarioReadModel.ts`；作祟特殊行动状态、灰尘解药可用性、魔法相机拍照 / 砸相机目标、顽石之血躲猫猫选项与选择校验已迁到 `src/games/betrayal/hauntSpecialActionReadModel.ts`；`game.ts`、`Board.tsx` 和测试直接消费新 owner，不从 `game.ts` re-export。
- 已继续第四批运行时 owner 去重：`src/games/betrayal/hauntTokenModel.ts`、`src/games/betrayal/hauntProgress.ts`、`src/games/betrayal/deathStateReadModel.ts` 不再自建探索者集合 / 玩家查找 / 木乃伊怪物查找 helper，统一消费 `explorerReadModel.ts` 与 `hauntScenarioReadModel.ts`。
- 已继续第四批运行时 owner 迁移：山屋惊魂怪物行动 / 怪物回合读模型已迁到 `src/games/betrayal/monsterActionReadModel.ts`，承载怪物开回合状态、移动骰组、移动点、移动目标、攻击槽、顽石之血怪物回合结束预览、援手巨魔手回合状态、魔法相机幻影摄影师攻击目标和普通怪物攻击目标；`game.ts` 只在 reducer / 命令校验中消费该 owner，`Board.tsx`、目标单元测试、E2E 和 `firstScenarioTestUtils.ts` 均直接 import 正式 owner；`firstScenarioRuntimeHarness.ts` 不再 re-export 这些生产 read model。
- 已继续第四批运行时 owner 迁移：山屋惊魂顽石之血 setup 放置读模型已迁到 `src/games/betrayal/bloodFromStoneSetupReadModel.ts`，承载石像小天使按探索者位置、英雄视线外房间、玩家补选房间生成放置计划和选择结果；`game.ts` 只在 setup / 命令校验 / reducer 事件编排中消费该 owner，`Board.tsx` 与目标单元测试直接 import 正式 owner；`firstScenarioRuntimeHarness.ts` 不再 re-export 该生产 read model。
- 已继续第四批运行时 owner 迁移：山屋惊魂作祟揭示协议与 setup 队列 / 进度 / 命令预览已迁到 `src/games/betrayal/hauntSetupModel.ts`，承载公开揭示步骤、秘密书可见边界、各作祟 setup 队列、setup 进度汇总和 setup 目标预览；`game.ts` 只在命令校验和 reducer 队列更新中消费该 owner，`Board.tsx`、揭示提示 UI 与目标单元测试直接 import 正式 owner；`firstScenarioRuntimeHarness.ts` 不再 re-export 这些生产 read model。
- 已继续第四批运行时 owner 迁移：山屋惊魂参考卡访问权限读模型已迁到 `src/games/betrayal/referencePresentation.ts`，承载基础参考卡、英雄书、叛徒书和怪物参考卡的作祟阶段 / 阵营 / 怪物运行态开放规则；`game.ts` 不再导出该读模型或相关类型，`betrayal-mummy-haunt.test.ts` 直接 import 正式 owner，`firstScenarioRuntimeHarness.ts` 不再 re-export 该生产 read model。
- 已继续第四批运行时 owner 迁移：山屋惊魂终局读模型已迁到 `src/games/betrayal/endgameReadModel.ts`，承载终局胜方标签、获胜玩家展示名、If You Win 文本接入状态、同时达成 / 平局合同状态和代表性说明；`game.ts` 不再导出该读模型或相关类型，终局相关测试直接 import 正式 owner，`firstScenarioRuntimeHarness.ts` 不再 re-export 该生产 read model。
- 已继续第四批运行时 owner 迁移：山屋惊魂木乃伊 / 援手攻击奖励读模型与巨魔手移动 / 攻击选项已迁到 `src/games/betrayal/hauntAttackRewardReadModel.ts`，承载可夺取卡牌、女孩 Token 伪卡、待领取攻击奖励、巨魔手合击选项和巨魔手移动消耗 / 目标房间；`game.ts` 只在命令校验和 reducer 结算中消费该 owner，`Board.tsx` 与目标测试直接 import 正式 owner，`firstScenarioRuntimeHarness.ts` 不再 re-export 这些生产 read model。
- 已继续第四批运行时 owner 迁移：山屋惊魂作祟叛徒判定、自愿替代叛徒预览、作祟首玩家决议和对应 clone 合同已迁到 `src/games/betrayal/hauntTraitorResolutionModel.ts`；`game.ts` 只在作祟触发和运行时拷贝中消费该 owner，`betrayal-haunt-reveal-and-event-cards.test.ts` 直接 import 正式 owner，`firstScenarioRuntimeHarness.ts` 不再 re-export 这些生产 read model。
- 当前本轮运行时验证：`npx tsc --noEmit --pretty false --incremental false` 通过；`game.ts`、`hauntScenarioReadModel.ts`、`hauntSpecialActionReadModel.ts`、`hauntTokenModel.ts`、`hauntProgress.ts`、`deathStateReadModel.ts` 目标 ESLint 通过；`Board.tsx` 参与目标 ESLint 时为 0 errors / 4 个既有 hook/ref warnings；作祟特殊行动、顽石之血、木乃伊作祟、作祟进度和 token 代表回归共 5 个文件 110 个用例通过。
- 当前第四批运行时验证：`npx tsc --noEmit --pretty false --incremental false` 通过；`coreSnapshotGuard.ts`、`latestDiscoveryPresentation.ts`、`eventChoicePreview.ts`、`inventoryPresentation.ts`、`traitPresentation.ts`、`recentRollPresentation.ts`、`trade.ts`、`roomMapModel.ts`、`scenarioReader.ts`、`roomPresentation.ts`、`playerPresentation.ts`、`deckPresentation.ts`、`referencePresentation.ts`、`houseDicePresentation.ts`、`houseDiceSurface.tsx`、`cinematicNarrationSurface.tsx`、`atlasFrameSurface.tsx`、`attackImpactPresentation.ts`、`attackImpactSurface.tsx`、`attackRules.ts`、`deckModel.ts`、`diceRules.ts`、`hauntProgress.ts`、`roomActionReadModel.ts`、`traitorPowerReadModel.ts`、`traitorPowerRules.ts`、`entityRelationModel.ts` 的目标 ESLint 通过；`Board.tsx` ESLint 0 errors / 5 个既有 warnings；属性轨 / 伤害分配、重掷命中框、事件投骰全员确认展示、参考卡、牌堆、房间放置、持有物 / 交易、骰子展示、电影字幕 / 终局展示、图集图片框、攻击反馈、地图视线、攻击武器、作祟进度轨、房间特殊行动、叛徒能力和阵营 / 敌友关系等窄回归均有通过记录。
- 当前怪物行动读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`monsterActionReadModel.ts`、`hauntScenarioReadModel.ts`、`diceRules.ts`、`explorerReadModel.ts`、`turnOrderReadModel.ts`、`firstScenarioTestUtils.ts`、`firstScenarioRuntimeHarness.ts` 和 8 个怪物行动相关单元测试文件，0 errors；`Board.tsx` 参与目标 ESLint 时仍为 0 errors / 4 个既有 hook/ref warnings；怪物行动 / 木乃伊 / 援手 / 顽石之血 / 事件 / 灰尘 setup / 作祟揭示 / 杰克发热怪物共 8 个文件 219 个用例通过。
- 当前顽石之血 setup 放置读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`bloodFromStoneSetupReadModel.ts`、`Board.tsx`、`betrayal-dust-haunt-setup-and-research.test.ts` 和 `firstScenarioRuntimeHarness.ts`，0 errors / `Board.tsx` 4 个既有 hook/ref warnings；顽石之血与灰尘 setup 代表回归 2 个文件 71 个用例通过。
- 当前作祟 setup 模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`hauntSetupModel.ts`、`hauntScenarioReadModel.ts`、`bloodFromStoneSetupReadModel.ts`、`Board.tsx`、`hauntRevealCueSurface.tsx`、3 个目标单元测试和 `firstScenarioRuntimeHarness.ts`，0 errors / `Board.tsx` 4 个既有 hook/ref warnings；setup / 事件 / 木乃伊 / 援手代表回归 4 个文件 142 个用例通过。
- 当前参考卡访问权限读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`referencePresentation.ts`、`hauntSetupModel.ts`、`entityRelationModel.ts`、`betrayal-mummy-haunt.test.ts` 和 `firstScenarioRuntimeHarness.ts`，0 errors；负向扫描确认 `game.ts` 与 `firstScenarioRuntimeHarness.ts` 不再保留参考卡访问读模型旧入口；木乃伊作祟代表回归 1 个文件 19 个用例通过。
- 当前终局读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`endgameReadModel.ts`、`explorerReadModel.ts`、`betrayal-crimson-jack-haunt-and-endgame.test.ts`、`betrayal-dust-sickness-and-death-protection.test.ts` 和 `firstScenarioRuntimeHarness.ts`，0 errors；负向扫描确认 `game.ts` 与 `firstScenarioRuntimeHarness.ts` 不再保留终局读模型旧入口；Crimson Jack / 灰尘终局代表回归 2 个文件 62 个用例通过。
- 当前作祟攻击奖励读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`Board.tsx`、`hauntAttackRewardReadModel.ts`、`betrayal-helping-hands-haunt.test.ts`、`betrayal-monster-actions-and-camera-haunt.test.ts`、`betrayal-mummy-haunt.test.ts`、`Board.foundation.test.tsx` 和 `firstScenarioRuntimeHarness.ts`，0 errors / `Board.tsx` 4 个既有 hook/ref warnings / `Board.foundation.test.tsx` 2 个既有 unused var warnings；负向扫描确认 `game.ts` 与 `firstScenarioRuntimeHarness.ts` 不再保留木乃伊 / 援手攻击奖励和巨魔手移动旧导出；援手 / 怪物行动 / 木乃伊代表回归 3 个文件 63 个用例通过。
- 当前作祟叛徒决议读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`hauntTraitorResolutionModel.ts`、`betrayal-haunt-reveal-and-event-cards.test.ts` 和 `firstScenarioRuntimeHarness.ts`，0 errors；负向扫描确认 `game.ts` 与 `firstScenarioRuntimeHarness.ts` 不再保留叛徒判定 / 自愿替代 / 首玩家决议旧导出或本地实现；作祟揭示与事件牌代表回归 1 个文件 24 个用例通过。
- 当前攻击目标读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`Board.tsx` 和 `attackRules.ts`，0 errors / `Board.tsx` 4 个既有 hook/ref warnings；负向扫描确认 `game.ts` 与 `firstScenarioRuntimeHarness.ts` 不再保留 `resolveBetrayalAttackTargetPlayerIds`、武器范围判断或炸药目标房间旧入口；战斗武器、援手、木乃伊和顽石之血代表回归 4 个文件 73 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂怪物受伤结果读模型已迁到 `src/games/betrayal/monsterReadModel.ts`，承载怪物受伤后无效 / 抵抗 / 击晕 / 击杀结果、幻影摄影师力量击杀和怪物状态摘要；`game.ts` 只在命令校验和 reducer 结算中消费该 owner，目标测试直接 import 正式 owner，`firstScenarioRuntimeHarness.ts` 不再 re-export 这些生产 read model。
- 当前怪物受伤读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`monsterReadModel.ts`、`firstScenarioRuntimeHarness.ts` 和 5 个怪物 / 战斗相关单元测试文件，0 errors；负向扫描确认 `game.ts` 不再定义 / 导出 `BetrayalMonsterDamageOutcome*` 或 `resolveBetrayalMonsterDamageOutcome`，`firstScenarioRuntimeHarness.ts` 不再转发 `resolveBetrayalMonsterDamageOutcome` / `resolveBetrayalMonsterStatuses`；怪物行动、战斗武器、木乃伊、援手和顽石之血代表回归 5 个文件 103 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂持有物特殊行动命令合法性已归入 `src/games/betrayal/possessionActionReadModel.ts`，承载主动持有物可用性、治疗目标、放置目标、面具移动目标和天使之羽点数范围；`game.ts` 的命令校验分支只调用正式 owner，不再内联持有物目标检查。
- 当前持有物特殊行动合法性验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`possessionActionReadModel.ts`、持有物 / 战斗 / 交易代表测试文件，0 errors；持有物重掷、战斗武器和交易面具代表回归 3 个文件 100 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂事件效果选择、目标房间 / 相邻房间选择、通用伤害选择和效果文案已归入 `src/games/betrayal/possessionEffects.ts`；可选物品效果的持有牌过滤与选择落点归入 `src/games/betrayal/possessionItemChoiceModel.ts`；`game.ts` 不再保留这些本地选择函数。
- 已继续第四批运行时 owner 迁移：山屋惊魂持有物使用命令转事件载荷已归入 `src/games/betrayal/possessionUseResolution.ts`，普通持有物使用落状态已归入 `src/games/betrayal/possessionUseState.ts`，书本替换事件投骰生成与落状态已归入 `src/games/betrayal/eventRollReplacementModel.ts`；`game.ts` 的 `USE_POSSESSION` 分支只保留事件封装，`POSSESSION_USED` reducer 只保留 owner 调用、同步和日志收尾。
- 已继续第四批运行时 owner 迁移：山屋惊魂属性损失和通用伤害分配已归入 `src/games/betrayal/traitTrackModel.ts`；交易请求 / 同意 / 拒绝事件载荷和交易状态转移已归入 `src/games/betrayal/trade.ts`；尸体搜刮事件载荷和尸体持有物转移已归入 `src/games/betrayal/deathStateReadModel.ts`。
- 当前持有物 / 交易 / 尸体搜刮结算验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`trade.ts`、`deathStateReadModel.ts`、`possessionEffects.ts`、`possessionItemChoiceModel.ts`、`possessionUseResolution.ts`、`possessionUseState.ts`、`traitTrackModel.ts`、`possessionActionReadModel.ts` 和 4 个目标测试文件，0 errors；持有物、战斗物品、交易和尸体搜刮代表回归 4 个文件 114 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间效果事件载荷、神秘电梯落状态和兔脚重掷后的神秘电梯再落状态已归入 `src/games/betrayal/roomEnterEffectModel.ts`；`game.ts` 的 `USE_ROOM_EFFECT` / `ROOM_EFFECT_USED` 分支只保留命令事件封装、reducer 同步和日志收尾。
- 当前房间效果结算验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`roomEnterEffectModel.ts`、`roomActionReadModel.ts`、电梯 / 终局代表测试文件，0 errors；负向扫描确认 `game.ts` 不再直接调用 `resolveMysticElevatorEffect`、`resolveMysticElevatorDestination`、`moveMysticElevatorRoom` 或本地拼 `BetrayalRoomEnterEffectResult`；神秘电梯和终局代表回归 2 个文件 47 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂属性检定 / 非战斗检定 / 事件检定投骰、持有物被动加成、相机属性替换、手电 / 提灯事件额外骰和祝福房间额外骰已归入 `src/games/betrayal/traitRollModel.ts`；`game.ts` 不再保留这些投骰规则常量或本地检定函数。
- 当前属性投骰 owner 验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`traitRollModel.ts`、`roomEnterEffectModel.ts`、持有物重掷 / 终局 / 灰尘 / 木乃伊代表测试文件，0 errors；负向扫描确认 `game.ts` 不再定义 `TRAIT_CHECK_PASSIVE_BONUSES`、`TRAIT_CHECK_REPLACEMENTS_BY_CARD_ID`、`EVENT_TRAIT_CHECK_EXTRA_DICE_BY_CARD_ID` 或本地属性投骰函数；属性投骰相关代表回归 4 个文件 149 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂事件分支选择、固定骰事件投骰、全属性检定、事件效果随机结果物化和事件投骰结果构造已归入 `src/games/betrayal/eventRollModel.ts`；`game.ts` 只消费事件投骰结果，不再本地维护事件分支排序、事件骰结果构造或效果物化函数。
- 当前事件投骰 owner 验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`eventRollModel.ts`、`traitRollModel.ts`、`possessionEffects.ts` 和事件 / 重掷 / 房间效果代表测试文件，0 errors；负向扫描确认 `game.ts` 不再定义 `rollEventFixedDice`、`resolveEventBranch`、`rollAllTraitChecks`、`materializeEventEffect`、`resolveEventRollResolution` 或 `MaterializeEventEffectOptions`；事件牌 / 重掷 / 房间文字代表回归 4 个文件 118 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂事件选择命令校验和 `RESOLVE_EVENT_CHOICE` 事件载荷生成已归入 `src/games/betrayal/eventChoiceResolutionModel.ts`，承载事件符号跳过 / 抽事件牌、属性投骰选择、可选作祟检定、可选物品效果、可选事件投骰、后续选择生成和发现摘要 / 日志文案；`game.ts` 的命令分支只保留牙齿项链延迟回合结束特例和事件封装，不再内联事件选择结算。
- 已继续第四批运行时 owner 迁移：山屋惊魂事件效果应用 / 回滚、事件效果快照、事件死亡保护预览、延迟伤害分配和事件伤害投骰 recentRoll 替换已归入 `src/games/betrayal/eventEffectResolutionModel.ts`；通用伤害分配、物理 / 精神 / 攻击伤害、死亡保护投骰、濒死属性设置和强制伤害属性序列已归入 `src/games/betrayal/damageResolutionModel.ts`。
- 当前事件选择 / 事件效果 / 伤害 owner 验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`eventChoiceResolutionModel.ts`、`eventEffectResolutionModel.ts`、`damageResolutionModel.ts`、`eventRollModel.ts`、`explorerReadModel.ts`、`monsterActionReadModel.ts` 和 `possessionDeckModel.ts`，0 errors；负向扫描确认 `game.ts` 不再定义事件选择校验 helper、事件效果应用 / 回滚、事件死亡保护、通用伤害队列、物理 / 精神 / 攻击伤害、死亡保护投骰或克隆 helper；事件牌、重掷、灰尘、援手、怪物行动、木乃伊和顽石之血代表回归 7 个文件 206 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂伤害分配命令校验和 `DAMAGE_ALLOCATION_RESOLVED` 事件载荷生成已归入 `src/games/betrayal/damageResolutionModel.ts`；杰克之灵复活出生房间解析已归入 `src/games/betrayal/hauntScenarioReadModel.ts`；`game.ts` 的伤害分配命令分支只保留事件封装，后续 reducer 仍作为待拆状态落地块处理。
- 当前伤害分配命令 owner 验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`damageResolutionModel.ts` 和 `hauntScenarioReadModel.ts`，0 errors；负向扫描确认 `game.ts` 不再定义 `validateDamageAllocationResolution`，`resolveBetrayalDamageAllocationResolvedPayload` 和 `validateBetrayalDamageAllocationResolution` 只由 `damageResolutionModel.ts` 承载；战斗武器、灰尘战斗 / 死亡、事件牌、杰克之灵和房间效果代表回归 7 个文件 201 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂 `DAMAGE_ALLOCATION_RESOLVED` reducer 中的属性扣减、奇怪护身符受伤奖励、死亡保护 recentRoll 生成、伤害保护后的濒死属性设置和下一笔排队伤害构造已归入 `src/games/betrayal/damageResolutionModel.ts`；`game.ts` 仍只负责死亡标记、作祟胜负、杰克之灵释放和回合推进编排。
- 当前伤害分配 reducer 纯状态落地验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`damageResolutionModel.ts` 和 `hauntScenarioReadModel.ts`，0 errors；战斗武器、灰尘战斗 / 死亡、事件牌、杰克之灵和房间效果代表回归 7 个文件 201 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂 `ROOM_EXPLORED` reducer 中的房间板块调整应用、目标房间发现状态写入、入口门连接、障碍 token 放置、当前探索者房间切换和探索前沿刷新已归入 `src/games/betrayal/roomDiscoveryModel.ts`；`game.ts` 在该事件分支只保留发现后的移动清零、抽牌消耗、事件 / 队列 / 作祟和日志编排。
- 当前房间发现 reducer 地图落地验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`roomDiscoveryModel.ts` 和 `roomMapModel.ts`，0 errors；负向扫描确认 `game.ts` 不再消费 `materializeRoomsAfterTileAdjustment` 或 `resolveOppositeRoomEdge`，`ROOM_EXPLORED` 地图落地只调用 `applyBetrayalRoomExploredPlacementState`；房间发现、房间效果、房间文字、事件、作祟风险、灰尘和杰克终局代表回归 7 个文件 216 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间发现效果应用、房间效果展示步骤、发现奖励展示步骤和奖励明细文案已归入 `src/games/betrayal/roomDiscoveryModel.ts`；`game.ts` 不再本地维护这些发现展示 / 房间文字 helper，只保留依赖运行时克隆和抽牌顺序的发现事件编排。
- 当前房间发现效果 / 奖励展示验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts` 和 `roomDiscoveryModel.ts`，0 errors；负向扫描确认 `game.ts` 不再定义 `applyRoomDiscoveryEffect`、`createRoomDiscoveryEffectResolutionSteps`、`createRoomDiscoveryCardResolutionSteps`、`formatRoomDiscoveryRewardDetailParts` 或 `getRoomDiscoveryRewardNames`；房间发现、房间效果、房间文字、事件、作祟风险、灰尘和杰克终局代表回归 7 个文件 216 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间文字 `drawUntilWeapon` 的物品牌堆扫描、武器命中和埋牌列表生成已归入 `src/games/betrayal/roomDiscoveryModel.ts`；`game.ts` 不再本地维护抽到武器为止的房间奖励解析。
- 当前房间发现抽武器奖励解析验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`roomDiscoveryModel.ts` 和 `attackRules.ts`，0 errors；负向扫描确认 `game.ts` 不再定义 `resolveRoomDiscoveryCards`、`createDrawnCardsUntilWeapon` 或消费 `isAttackWeaponCard`；房间发现、房间效果、房间文字、事件、作祟风险、灰尘和杰克终局代表回归 7 个文件 216 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂 Mummy / Dust / Helping Hands / Magic Camera / Upon Reflection / Blood From Stone 的作祟运行态创建、克隆和 setup 放置副作用已归入 `src/games/betrayal/hauntRuntimeSetupModel.ts`；作祟揭示触发解析已归入 `src/games/betrayal/hauntSetupModel.ts`；`game.ts` 不再保留这些 setup / clone / 书本替换旧函数，也不保留 `USE_POSSESSION` 的书本替换回调桥。
- 当前作祟 runtime setup 与书本替换 owner 验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`eventRollReplacementModel.ts`、`hauntRuntimeSetupModel.ts`、`hauntSetupModel.ts`、`possessionUseResolution.ts`、`possessionUseState.ts`、`eventRollModel.ts`、`traitRollModel.ts` 和 `roomEnterEffectModel.ts`，0 errors；负向扫描确认 `game.ts` 不再定义作祟 setup / clone 旧函数、`BetrayalEventRollReplacementResult` 或 `createBookPendingEventRollReplacement`。
- 已继续第四批运行时 owner 迁移：山屋惊魂怪物控制者判断已归入 `src/games/betrayal/hauntScenarioReadModel.ts`，死亡保护重掷窗口和最近投骰重掷物品命令合法性已归入 `src/games/betrayal/possessionActionReadModel.ts`；`game.ts` 不再保留本地重掷命令 validator 或怪物控制者本地判断。
- 当前最近投骰重掷物品合法性验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`possessionActionReadModel.ts`、`hauntScenarioReadModel.ts`、持有物重掷、灰尘死亡保护、灰尘战斗死亡和杰克之灵 / 狂热病患代表测试文件，0 errors；4 个代表回归文件 138 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂回合开始速度读模型已归入 `src/games/betrayal/explorerReadModel.ts`，回合开始持有物快照和神秘秒表额外行动清理已归入 `src/games/betrayal/possessionActionReadModel.ts`；`game.ts` 不再本地保存这些无副作用派生函数。
- 当前回合快照读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`possessionActionReadModel.ts`、`explorerReadModel.ts`、持有物重掷、战斗武器和杰克之灵 / 狂热病患代表测试文件，0 errors；3 个代表回归文件 87 个用例通过。
- 已继续第四批运行时 owner 迁移：山屋惊魂移动目标与移动成本读模型已迁到 `src/games/betrayal/movementReadModel.ts`，承载探索者可移动房间、敌方探索者阻挡、怪物阻挡和骷髅钥匙移动成本；`game.ts` 与 `Board.tsx` 直接消费该 owner，目标测试直接 import 正式 owner，不通过 `game.ts` 或测试 helper 转发。
- 已继续第四批运行时 owner 迁移：山屋惊魂房间发现 / 放置读模型已迁到 `src/games/betrayal/roomDiscoveryModel.ts`，承载发现牌池、抽房间结果、开放门位、放置朝向、板块调整选项和调整后房间材料化；房间克隆、反向门位、门位连接和探索前沿刷新归入 `src/games/betrayal/roomMapModel.ts`；`Board.tsx`、`traitorPowerReadModel.ts` 和目标测试均直接消费新 owner，`firstScenarioRuntimeHarness.ts` 不再 re-export 这些生产 read model。
- 当前移动与房间发现读模型验证：`npx tsc --noEmit --pretty false --incremental false` 通过；目标 ESLint 覆盖 `game.ts`、`Board.tsx`、`traitorPowerReadModel.ts`、`roomDiscoveryModel.ts`、`roomMapModel.ts`、`movementReadModel.ts`、`firstScenarioRuntimeHarness.ts` 和 9 个目标测试文件，0 errors / `Board.tsx` 4 个既有 hook/ref warnings / `Board.foundation.test.tsx` 2 个既有 unused var warnings；负向扫描确认 `game.ts` 不再定义 / 导出移动目标、移动成本、房间发现 / 放置预览旧入口，`firstScenarioRuntimeHarness.ts` 不再转发房间发现 read model；房间发现、移动、事件、灰尘、木乃伊和杰克代表回归 9 个文件 393 个用例通过。
- 当前本批修正：`betrayal-jack-revival-corpse-loot-and-haunt-risk.test.ts` 与 `betrayal-trade-dog-mask-and-elevator.test.ts` 的交易后持有物断言已改为保留夹具原有 `medical-kit`、`map`、`skull` 等未交易牌，只修正测试对真实夹具的描述，不改变运行时交易行为。
- 当前未收口风险：`Board.foundation.test.tsx` 中事件投骰确认相关用例仍失败，当前可复核表现包括投骰后找不到 `betrayal-discovery-continue`，以及驱魔投骰确认计数显示 `确认 0/1` 而测试期望 `确认 0/4`。当前证据显示 `Board.tsx` 与 `game.ts` 的基线已有“`requiresAcknowledgement === false` 时隐藏确认按钮并自动收口”的逻辑；这不是 `eventChoicePreview.ts` 或 `houseDiceSurface.tsx` 迁移直接造成的漏项。若后续要修，必须作为事件投骰确认语义问题单独列合同，不能夹在纯重构里改行为。
- 当前 transport owner 归属：`server-lifecycle-sync.test.ts` 管 setup/sync/lifecycle，`server-command-authority.test.ts` 管命令权限，`server-feedback-reporting.test.ts` 管反馈上报，`server-command-training.test.ts` 管训练记录；在线 AI 恢复按 active-turn、legal-only incident transition、legal continuation、Fantasy Realms continuation、fingerprint drift、fingerprint builder、resolved state、emergency playerView、overlay resync、即时服务端 AI、pregame/off-turn、DiceThrone recovery、feedback/response-window 和无解交互拆到对应 `onlineAi*.test.ts`。

## 一次到位完成定义

本任务当前仍是 `in_progress`：前三批测试 owner 已完成，第四批运行时读模型 owner 已开始，但必要重构尚未全部收口。一次到位的终点不是把行数切到某个数字，而是让 `game.ts` 和 `Board.tsx` 不再作为新责任默认落点。

## 一次到位执行账本

| 编号 | 必做块 | 当前状态 | 完成口径 |
| --- | --- | --- | --- |
| A | 任务状态账本 | 进行中 | 本文件记录剩余 owner、负向验收和每批验证；未满足前不得删除任务卡或汇报完成。 |
| B | 共享 / 单游戏测试 owner | 已完成 | 旧集中测试文件删除，测试按行为合同 owner 运行，公共夹具只做合法入口和通用断言。 |
| C | `Board.tsx` 读模型和 UI 子区域 | 进行中 | 已迁出多个 presentation / surface owner；剩余 UI 区域触碰时不得回流读模型、资源映射、阵营关系或规则推导。 |
| D | `game.ts` 读模型 owner | 进行中 | 已迁出交易、地图、移动目标 / 移动成本、房间发现 / 放置预览 / 抽房间 / 板块调整材料化、房间发现效果 / 奖励展示 / 抽武器奖励解析、攻击武器 / 攻击目标、作祟进度、房间特殊行动、持有物特殊行动 / 重掷物品合法性、死亡保护重掷窗口、回合开始速度 / 持有物快照、神秘秒表额外行动清理、叛徒能力、阵营关系、怪物控制者判断、杰克之灵出生房间、作祟类型 / 特殊行动状态、怪物行动 / 怪物回合、怪物受伤结果 / 状态摘要、顽石之血 setup 放置、作祟揭示 / setup 模型、作祟运行态 setup / clone、参考卡访问权限、终局读模型、作祟攻击奖励 / 巨魔手移动选项、作祟叛徒 / 首玩家决议、持有物效果选择 / 物品选择、房间效果事件载荷 / 神秘电梯落状态、属性投骰规则、事件投骰结果构造、事件选择命令校验 / 事件载荷、事件效果快照 / 死亡保护、伤害分配命令校验 / 事件载荷、伤害分配 reducer 纯状态落地、房间发现 reducer 地图落地、通用伤害 / 死亡保护基础语义、交易事件载荷和尸体搜刮等 owner；下一批优先房间发现事件生成 / 后续发现编排与怪物 / 攻击 reducer。 |
| E | `game.ts` 规则结算 owner | 进行中 | 持有物使用事件生成 / 普通持有物落状态、书本替换投骰生成与落状态、房间效果事件生成 / 神秘电梯落状态、属性检定 / 非战斗检定 / 事件检定投骰、事件分支选择 / 随机效果物化、事件选择结算、事件效果状态落地、事件伤害延迟分配、伤害分配命令到事件载荷、伤害分配 reducer 纯状态落地、房间发现 reducer 地图落地、房间发现效果应用、房间发现抽武器奖励解析、作祟 runtime setup、交易结算和尸体搜刮已开始迁出；房间发现事件生成 / 后续发现编排、死亡后续、怪物行动、攻击 / 伤害 reducer 仍必须按行为合同拆分。 |
| F | 负向入口守卫 | 进行中 | 每批迁移后检查旧集中测试和旧 `game.ts` 导出没有恢复；不得保留 wrapper / re-export。 |
| G | 收口验证 | 待最终 | 完整收口前统一跑 TypeScript、目标 ESLint、`npm run spec:lint`、`git diff --check` 和代表性 Betrayal 回归。 |

### `Board.tsx` 终点

- 只保留页面组合、React 状态绑定、事件 handler wiring、子 UI 挂载、必要的视觉布局连接。
- 不再承载读模型、资源映射、规则推导、骰子皮肤、攻击反馈、房间 / 牌堆 / 参考卡 / 持有物展示、剧本阅读、事件选择预览或属性轨计算。
- 新增 UI 可见能力时，先选择已有 presentation / read model owner；没有 owner 时新建正式 owner 并让 `Board.tsx` 只消费其结果。
- 已迁出的 `scenarioReader.ts`、`roomMapModel.ts`、`roomDiscoveryModel.ts`、`movementReadModel.ts`、`inventoryPresentation.ts`、`eventChoicePreview.ts`、`traitPresentation.ts`、`recentRollPresentation.ts`、`latestDiscoveryPresentation.ts`、`coreSnapshotGuard.ts`、`roomPresentation.ts`、`playerPresentation.ts`、`deckPresentation.ts`、`referencePresentation.ts`、`houseDicePresentation.ts`、`houseDiceSurface.tsx`、`cinematicNarrationSurface.tsx`、`atlasFrameSurface.tsx`、`attackImpactPresentation.ts`、`attackImpactSurface.tsx`、`attackRules.ts`、`deckModel.ts`、`diceRules.ts`、`hauntProgress.ts`、`roomActionReadModel.ts`、`traitorPowerReadModel.ts`、`traitorPowerRules.ts`、`entityRelationModel.ts`、`hauntScenarioReadModel.ts`、`hauntSpecialActionReadModel.ts`、`monsterActionReadModel.ts`、`bloodFromStoneSetupReadModel.ts`、`hauntSetupModel.ts`、`hauntAttackRewardReadModel.ts` 和 `trade.ts` 不得回流进 `Board.tsx`。

### `game.ts` 终点

- 只保留游戏注册、reducer 调度、必要类型聚合和跨 owner 编排；不能继续作为规则结算、命令校验、房间发现、事件结算、持有物效果、作祟 runtime、怪物行动、攻击 / 伤害、交易结算和测试夹具事实的集中入口。
- 命令校验、事件结算、房间发现 / 放置、持有物效果、作祟 runtime、怪物行动、攻击 / 伤害必须拆到按行为合同命名的正式 owner。
- 新 owner 的 Interface 必须写清成功语义、失败语义、消费者和验证方式；不能只按行号机械搬运函数。
- 能同轮切完的消费者必须直接切到新 owner 并删除旧入口；没有混部版本、外部消费者或持久化迁移证据时，不保留 wrapper、re-export 或兼容壳。

### 负向验收

- 禁止恢复旧集中测试文件：`server.test.ts`、`payment-selection.test.ts`、`firstScenarioRuntime.test.ts`。
- 禁止把已拆出的 presentation / read model owner 重新内联到 `Board.tsx`。
- 禁止把新规则分支、新命令分支或新作祟 / 战斗 / 房间 / 事件逻辑继续追加到 `game.ts`，除非本轮是紧急最小修复且同步登记拆分任务。
- 禁止用“行数下降”替代职责验收；每块迁移必须证明原文件现实责任减少、公开行为不变、旧入口没有形成第二套真相。
- 禁止把普通事件投骰确认语义的已知失败夹进纯重构里偷改；它必须单独锁规则合同、入口和验收。

### 阶段顺序

1. 锁定最终 owner 总账：列出 `game.ts`、`Board.tsx` 还在承载的规则结算、读模型、UI 区域、调试面板和测试夹具消费者。
2. 先拆 `game.ts` 深模块：命令校验、reducer 分发、事件结算、房间发现 / 放置、持有物效果、作祟 runtime、怪物行动、攻击 / 伤害。
3. 再拆 `Board.tsx` 大 UI 区域：骰盘、参考 / 剧本阅读、持有物 rail、房间地图、发现 / 事件面板、攻击 / 伤害面板。
4. 每块迁移同轮切消费者、删除旧入口、跑覆盖该 owner 的最窄测试；必要时补负向断言证明旧集中入口没有恢复。
5. 收口时统一跑 `npx tsc --noEmit --pretty false --incremental false`、目标 ESLint、`npm run spec:lint`、`git diff --check` 和代表性 Betrayal 回归。

## 六大原则初判

- **单一职责失败已收口到前三批 owner 拆分，并开始进入运行时**：原 transport 测试文件不是一个行为合同 owner，而是同时覆盖在线视图、响应窗口、AI 进展指纹、AI 延迟、强制收口、传输服务、命令队列、反馈上报、训练记录和即时服务端 AI；原 qidahen 测试文件也不是单纯“支付选择”，而是混合开局、牌源、事件、行动、交互、战斗、年轮和胜利合同；原 Betrayal 首剧本测试文件也同时混合开局、房间、事件、作祟、怪物、交易、持有物、战斗、搜尸和终局合同。当前三者均已按行为合同分文件承载；Betrayal 运行时交易读模型已独立为 `trade.ts` owner，剧本阅读器读模型已独立为 `scenarioReader.ts` owner，房间地图与房间板块调整选择已独立为 `roomMapModel.ts` owner，房间身份 / 边缘 / 结束回合提示已独立为 `roomPresentation.ts` owner，持有物展示读模型与卡面色调已独立为 `inventoryPresentation.ts` owner，持有物特殊行动、重掷物品合法性、回合开始持有物快照和神秘秒表额外行动清理已独立为 `possessionActionReadModel.ts` owner，回合开始速度已独立为 `explorerReadModel.ts` owner，怪物控制者判断已独立为 `hauntScenarioReadModel.ts` owner，事件选择预览已独立为 `eventChoicePreview.ts` owner，属性轨 / 伤害分配选择已独立为 `traitPresentation.ts` owner，最近投骰展示 / 事件投骰确认展示 / 投骰演员文案已独立为 `recentRollPresentation.ts` owner，最新发现展示已独立为 `latestDiscoveryPresentation.ts` owner，玩家名称解析已独立为 `playerPresentation.ts` owner，牌堆 / 弃牌展示已独立为 `deckPresentation.ts` owner，参考卡页清单与访问权限读模型已独立为 `referencePresentation.ts` owner，终局读模型已独立为 `endgameReadModel.ts` owner，作祟攻击奖励与巨魔手移动选项已独立为 `hauntAttackRewardReadModel.ts` owner，作祟叛徒 / 首玩家决议已独立为 `hauntTraitorResolutionModel.ts` owner，山屋 0/1/2 骰面皮肤与高亮参数已独立为 `houseDicePresentation.ts` owner，3D 骰盘 UI 已独立为 `houseDiceSurface.tsx` owner，电影字幕 UI 已独立为 `cinematicNarrationSurface.tsx` owner，图集图片框 UI 已独立为 `atlasFrameSurface.tsx` owner，攻击武器规则与攻击目标读模型已独立为 `attackRules.ts` owner，怪物受伤结果与状态摘要已独立为 `monsterReadModel.ts` owner，攻击受击反馈读模型已独立为 `attackImpactPresentation.ts` owner，攻击受击反馈 UI 已独立为 `attackImpactSurface.tsx` owner，运行时快照守卫已独立为 `coreSnapshotGuard.ts` owner，不再让 `Board.tsx` 同时拥有数据资料、范围裁决、分页计算、地图几何、房间提示、持有物规则摘要、事件选择预览、属性轨计算、投骰展示、骰面生成、骰盘物理 UI、电影字幕 UI、图集图片框 UI、攻击反馈推导、攻击反馈动画、事件投骰确认计数、发现队列读模型和入口结构校验；不再让 `game.ts` 同时拥有参考卡权限、终局展示、作祟攻击奖励、作祟叛徒 / 首玩家决议、攻击目标读模型、怪物受伤结果读模型、持有物特殊行动合法性、重掷物品合法性和回合快照派生函数。
- **开闭原则已补入口**：新增线上 AI / transport 回归时，入口改为“新增或选择行为合同测试文件 + 复用夹具”；新增七大恨领域回归时，入口改为选择对应 `qidahen-*.test.ts` owner 或建立新 owner；新增 Betrayal 首剧本领域回归时，入口改为选择对应 `betrayal-*.test.ts` owner 或建立新 owner，禁止恢复旧集中测试入口。
- **里氏替换风险仍需按具体改动验证**：共享默认与 Smash Up、Dice Throne、Summoner Wars、Splendor、Betrayal 等游戏 override 已拆到更窄测试 owner；后续改对应语义时仍必须跑代表测试。
- **接口隔离已完成第一层**：transport 的 socket、namespace、storage、metadata、engine config、训练记录器和常用事件断言已被 `serverTestHarness.ts` 隔离；七大恨的合法状态构造、命令执行、提示响应和常用场景夹具已被 `paymentSelectionHarness.ts` 隔离；Betrayal 首剧本的合法状态构造、事件确认、伤害分配、发现房间、属性轨和作祟场景夹具已被 `firstScenarioRuntimeHarness.ts` 隔离；交易 UI 只读取 `trade.ts` 给出的交易目标和卡状态，剧本书 UI 只读取 `scenarioReader.ts` 给出的资料、范围和分页结果，地图和规则结算只读取 `roomMapModel.ts` 给出的房间连通、画布几何和板块调整选择结果，房间格 UI 只读取 `roomPresentation.ts` 的展示映射，持有物 UI 只读取 `inventoryPresentation.ts` 给出的展示摘要 / 色调 / 牌背，事件选择 UI 只读取 `eventChoicePreview.ts` 的窄输入结果，属性轨 / 伤害分配 UI 只读取 `traitPresentation.ts` 的轨道与选择结果，最近投骰 UI 只读取 `recentRollPresentation.ts` 的显示结果，参考卡 UI 和参考卡权限测试只读取 `referencePresentation.ts` 的页清单 / 访问权限，终局测试只读取 `endgameReadModel.ts` 的终局展示合同，作祟攻击奖励和巨魔手移动 / 攻击入口只读取 `hauntAttackRewardReadModel.ts` 的选项 / 待处理奖励，作祟叛徒 / 首玩家测试直接读取 `hauntTraitorResolutionModel.ts` 的决议预览，攻击目标 UI 只读取 `attackRules.ts` 的可攻击玩家结果，牌堆 UI 只读取 `deckPresentation.ts` 的计数项，骰面规则和皮肤只读取 `houseDicePresentation.ts` 的映射和配置，3D 骰盘挂载只读取 `houseDiceSurface.tsx` 的 UI owner，电影字幕挂载只读取 `cinematicNarrationSurface.tsx` 的 UI owner，发现 / 持有物图集图片框只读取 `atlasFrameSurface.tsx` 的 UI owner，攻击入口只读取 `attackRules.ts` 的武器状态和规则效果，攻击反馈 UI 只读取 `attackImpactPresentation.ts` 的受击状态投影并由 `attackImpactSurface.tsx` 承载动画挂载，Board 入口只读取 `coreSnapshotGuard.ts` 的 core 结构判断，不再自建底层判断。
- **依赖倒置后续方向**：高层回归用例已从旧集中套件迁到稳定测试合同文件；后续再拆时优先提升 scenario builder，而不是把内部字段继续扩散。
- **迪米特法则后续方向**：仍穿透服务端内部 ledger、playerView、metadata 和 state 结构的断言，只能在对应 owner 文件内继续收窄；不能重新集中到共享大套件。

## 重构方案

1. 保持 `helpers/serverTestHarness.ts` 只承载 socket、namespace、storage、engine config、metadata、训练记录器和通用事件断言，不承载业务断言正文。
2. 新增在线 AI 或 transport 回归时，按行为合同选择现有 owner 测试文件；没有正确 owner 时先建新 owner 文件，禁止恢复旧集中测试入口。
3. 新增七大恨领域回归时，按开局与牌源、事件牌、剧本、支付、势力行动、运行时交互、调度战斗、战斗战术、野战撤退、城战围城、年轮、人物窗口、区域胜利规则选择现有 `qidahen-*.test.ts` owner；没有正确 owner 时先建新 owner 文件，禁止恢复旧 `payment-selection.test.ts`。
4. 新增 Betrayal 首剧本领域回归时，按 foundation/setup/movement、room effects、event cards、mummy、dust、helping hands、blood from stone、monster actions、room text、trade、possessions/rerolls、crimson jack、haunt risk、jack spirit、combat weapons、corpse loot 等现有 `betrayal-*.test.ts` owner 选择入口；没有正确 owner 时先建新 owner 文件，禁止恢复旧 `firstScenarioRuntime.test.ts`。
5. Betrayal 运行时先按读模型 / 命令校验 / 事件生成 / reducer / UI 区域逐块拆 owner；当前已迁出交易、地图、移动目标 / 移动成本、房间发现 / 放置读模型、房间发现效果 / 奖励展示 / 抽武器奖励解析、攻击武器 / 攻击目标、作祟进度、房间特殊行动、叛徒能力、阵营关系、作祟特殊行动、怪物行动、顽石之血 setup 放置、作祟揭示 / setup 模型、作祟运行态 setup / clone、作祟攻击奖励、作祟叛徒 / 首玩家决议、持有物效果选择 / 使用事件 / 普通落状态、书本替换投骰生成与落状态、房间效果事件生成 / 神秘电梯落状态、属性投骰规则、事件投骰结果构造、事件选择结算、事件效果状态落地、事件伤害延迟分配、伤害分配命令校验 / 事件载荷、伤害分配 reducer 纯状态落地、房间发现 reducer 地图落地、通用伤害 / 死亡保护基础语义、交易结算和尸体搜刮；后续房间发现事件生成 / 后续发现编排、死亡后续、怪物行动和攻击 / 伤害 reducer 必须先列成功语义、失败语义和消费者后再迁移。
6. 后续若继续处理 Betrayal 更大运行时块，先重新列规则结算、读模型、UI 区域、调试面板和测试夹具消费者，不能把测试拆分方案机械套用到 `game.ts` 或 `Board.tsx`。

## 验收标准

- 原 `src/engine/transport/__tests__/server.test.ts` 按行为合同拆成多个测试文件，公共 socket、namespace、storage、engine config、训练记录器和在线 AI 恢复夹具移动到测试 helper，且旧文件不再存在。
- 原 `src/games/qidahen/__tests__/payment-selection.test.ts` 按行为合同拆成多个 `qidahen-*.test.ts` 文件，公共七大恨领域测试夹具移动到 `helpers/paymentSelectionHarness.ts`，且旧文件不再存在。
- 原 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 按行为合同拆成多个 `betrayal-*.test.ts` 文件，公共山屋惊魂首剧本测试夹具移动到 `helpers/firstScenarioRuntimeHarness.ts`，且旧文件不再存在。
- 拆分后的测试文件必须各有明确 owner；行数下降只是结果之一，不能用“切小了”替代职责清楚。
- 拆分只迁移测试职责，不借机改 transport 或 qidahen 运行时行为。
- 运行时 owner 迁移默认不改玩家可观察行为；若只迁移读模型，验收必须包含 TypeScript、ESLint、对应领域测试和至少一条 UI 消费方回归。
- 测试名称和覆盖语义保持不变；不能把旧用例删除后用“没人引用”证明合同不存在。
- 跑通 transport 相关最窄验证，至少包含原文件覆盖的离座 / 重连、响应窗口、AI 恢复、发送接受结果和异常 / 拒绝路径。
- 若后续改到 Betrayal 运行时代码，先列规则结算、读模型、UI 区域、调试面板和测试夹具的消费者，再按 [`code-design`](../knowledge/standards/code-design.md) 与 [`shared-refactor-guard`](../knowledge/standards/shared-refactor-guard.md) 验收。

## 依赖

- 规范主源：[`code-design`](../knowledge/standards/code-design.md)。
- 共享重构验收：[`shared-refactor-guard`](../knowledge/standards/shared-refactor-guard.md)。
- 测试拆分验收：[`e2e-verification`](../knowledge/standards/e2e-verification.md) 与 [`testing-tdd`](../knowledge/standards/testing-tdd.md)。
- 开始代码重构前先确认当前未提交的 Betrayal / Mage Wars / evidence 改动是否属于同一工作流；不得覆盖或回滚用户已有改动。
