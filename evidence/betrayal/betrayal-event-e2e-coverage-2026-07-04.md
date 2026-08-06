# 山屋惊魂事件牌页面承接 E2E 覆盖矩阵

> 2026-07-29 接续裁定：本文只覆盖早期 23 张 locked 事件牌的页面承接 E2E，不是当前 43 张事件整牌库合同，也不是当前 S0/S1/S2 的完成证据。当前事件牌主合同以 `evidence/betrayal/full-audit/full-deck-data-intake-contract.md` 为准；新增 20 张事件只能按该合同的状态和缺口矩阵继续补证。不得用本文的 23 张 E2E 绿灯外推为 43 张事件、整牌库或全部作祟完成。

- 对象：山屋惊魂 23 张 locked 官方事件牌
- 日期：2026-07-04
- 文档类型：`audit`
- 关联文件：`src/games/betrayal/scenarioConfig.ts`、`src/games/betrayal/game.ts`、`src/games/betrayal/Board.tsx`、`e2e/betrayal/event-choice-coverage.e2e.ts`
- 验收口径：按项目 E2E 规范，凡事件结算需要玩家在页面选择属性、目标房间、伤害属性、确认或跳过，都必须有真实 Playwright E2E；不需要玩家页面选择的自动结算事件，不能用“缺 E2E”否定运行态，但必须在矩阵里写清无需页面承接的依据。

## 结论

当前 23 张 locked 官方事件中，正式运行事件牌堆为 23 张。`一抹鲜红`、`一瓶微尘`、`大宅饿了`、`说“茄子”！`分别已有作祟剧本 1/3/12/33 的代表链；剧本 3/12/33 成功作祟链分别见 2026-07-18 的独立 E2E evidence。页面 E2E 已覆盖这些事件的跳过分支承接。

本结论只证明“23 张 locked 官方事件合同、23 张正式运行事件牌堆、需要页面选择的事件承接链、作祟 1/3/12/33 代表链”已按当前范围收口；不代表山屋整游戏、全部作祟深分支或未来新增事件图源自动通过。

## Playwright E2E 证据

- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/betrayal/event-choice-coverage.e2e.ts`
- 结果：12 条 Playwright 测试通过。
- 截图目录：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E`
- 截图数量：24 张，每条测试保存“选择前”和“结算后”两张。

## 23 张事件覆盖矩阵

| 事件 | 是否需要页面选择 | 页面交互链 | E2E 覆盖 | 复用/不复用依据 | 证据 |
| --- | --- | --- | --- | --- | --- |
| 标本剥制 | 否 | 自动力量检定；失败分支自动结算物理伤害并放置障碍物 | 不需要事件选择 E2E | 无玩家页面选择；共享自动属性检定、通用伤害和障碍物放置运行态链路 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 说“茄子”！ | 是 | 可选作祟检定；跳过后抽物品并进入持有区 | 独立 E2E | 可选作祟跳过 + 抽物品 + 持有区结果是独特可见链路，不复用其它事件 | `说茄子-跳过作祟抽物品-选择前.jpg`；`说茄子-跳过作祟抽物品-结算后.jpg` |
| 外星几何 | 否 | 自动知识检定；自动知识+1或速度-1 | 不需要事件选择 E2E | 无玩家页面选择；自动属性检定与属性变化由领域运行态覆盖 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 小丑房间 | 否 | 自动神志检定；自动无事发生或精神伤害 | 不需要事件选择 E2E | 无玩家页面选择；共享自动检定和精神伤害链路 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 咬一口！ | 否 | 自动力量检定；自动无事发生或物理伤害 | 不需要事件选择 E2E | 无玩家页面选择；共享自动检定和物理伤害链路 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 吊死鬼 | 是 | 四属性检定全通过后任选奖励属性 | 独立 E2E | 四属性连续检定后的奖励属性选择是独特进入条件，不复用普通任选属性事件 | `吊死鬼-奖励属性-选择前.jpg`；`吊死鬼-奖励属性-结算后.jpg` |
| 电话铃声 | 否 | 固定 2 骰；自动属性增益或骰数伤害 | 不需要事件选择 E2E | 无玩家页面选择；固定骰和骰数伤害由领域运行态覆盖 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 小机器人 | 否 | 自动知识检定；自动抽物品或骰数物理伤害 | 不需要事件选择 E2E | 无玩家页面选择；抽物品和骰数伤害是自动分支 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 嘎吱的木门 | 否 | 自动知识检定；按楼层自动放置到起始板块 | 不需要事件选择 E2E | 无玩家页面选择；目标由分支固定，不需要按钮候选 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 脑状食品 | 是 | 5+ 分支任选力量/速度；0 分支选择通用伤害属性 | 两条独立 E2E | 同一事件包含两种不同页面交互族：奖励属性选择和通用伤害属性选择，分别覆盖 | `脑状食品-奖励属性-选择前.jpg`；`脑状食品-奖励属性-结算后.jpg`；`脑状食品-通用伤害属性-选择前.jpg`；`脑状食品-通用伤害属性-结算后.jpg` |
| 上古旧宅 | 是 | 选择速度/力量检定；选择目标板块；选择通用伤害属性 | 独立 E2E | 同一链包含检定属性、目标房间和伤害属性三类选择，不允许只复用单一按钮族 | `上古旧宅-属性目标通用伤害-选择前.jpg`；`上古旧宅-属性目标通用伤害-结算后.jpg` |
| 肉质苔癣 | 是 | 可选吸入/不吸入；跳过后无事发生 | 独立 E2E | 可选事件跳过按钮是独立页面承接语义 | `肉质苔癣-跳过可选效果-选择前.jpg`；`肉质苔癣-跳过可选效果-结算后.jpg` |
| 夜幕众星 | 是 | 选择一项属性进行检定；按结果增减或治疗所选属性 | 独立 E2E | 选择检定属性后同一所选属性被后续结果引用，不复用普通奖励属性选择 | `夜幕众星-选择检定属性-选择前.jpg`；`夜幕众星-选择检定属性-结算后.jpg` |
| 一抹鲜红 | 是 | 可选作祟检定；跳过后结算物理伤害 | 独立 E2E | 可选作祟跳过 + 伤害结算链路，独立于抽物品或奖励属性事件 | `一抹鲜红-跳过作祟伤害-选择前.jpg`；`一抹鲜红-跳过作祟伤害-结算后.jpg` |
| 一瓶微尘 | 是 | 可选作祟检定；跳过后力量-1且神志+1 | 独立 E2E | 可选作祟跳过 + 双属性变化，独立覆盖 | `一瓶微尘-跳过作祟双属性-选择前.jpg`；`一瓶微尘-跳过作祟双属性-结算后.jpg` |
| 大宅饿了 | 是 | 可选作祟检定；跳过分支必须先选择奖励属性 | 独立 E2E | 跳过按钮和跳过分支任选属性门禁同时存在，不复用普通跳过事件 | `大宅饿了-选择属性跳过作祟-选择前.jpg`；`大宅饿了-选择属性跳过作祟-结算后.jpg` |
| 一条秘密通道 | 是 | 选择第二个目标板块放置秘密通道标志物 | 独立 E2E | 复合效果中只有第二目标板块需要玩家选择，曾暴露候选重复风险，必须独立覆盖 | `一条秘密通道-第二目标板块-选择前.jpg`；`一条秘密通道-第二目标板块-结算后.jpg` |
| 最深的壁橱 | 否 | 自动速度检定；自动抽物品、精神伤害或固定放置 | 不需要事件选择 E2E | 无玩家页面选择；固定地下室起始点放置不产生目标候选 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 磁带播放器 | 否 | 自动神志检定；自动知识+1或精神伤害 | 不需要事件选择 E2E | 无玩家页面选择；共享自动属性检定链路 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 在你背后！ | 否 | 自动速度检定；自动神志+1或物理伤害 | 不需要事件选择 E2E | 无玩家页面选择；共享自动属性检定链路 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 蜘蛛！ | 是 | 4+ 分支选择神志/速度奖励，并选择相邻已发现板块 | 独立 E2E | 属性选择 + 相邻房间候选是独特组合，不复用任意目标房间链 | `蜘蛛-属性相邻房间-选择前.jpg`；`蜘蛛-属性相邻房间-结算后.jpg` |
| 一种怪异的感觉 | 否 | 固定 2 骰；按点数自动结算属性损失或无事发生 | 不需要事件选择 E2E | 无玩家页面选择；固定骰自动分支 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |
| 葬礼 | 否 | 自动神志检定；按分支自动属性变化或固定图面放置 | 不需要事件选择 E2E | 当前效果按已发现墓园/地下墓穴自动放置，不打开页面目标选择 | `firstScenarioRuntime.test.ts` 领域运行态；山屋 core 167 条通过 |

## 截图清单

| 事件链 | 选择前截图 | 结算后截图 |
| --- | --- | --- |
| 上古旧宅 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\上古旧宅-属性目标通用伤害-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\上古旧宅-属性目标通用伤害-结算后.jpg` |
| 肉质苔癣 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\肉质苔癣-跳过可选效果-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\肉质苔癣-跳过可选效果-结算后.jpg` |
| 大宅饿了 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\大宅饿了-选择属性跳过作祟-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\大宅饿了-选择属性跳过作祟-结算后.jpg` |
| 蜘蛛！ | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\蜘蛛-属性相邻房间-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\蜘蛛-属性相邻房间-结算后.jpg` |
| 吊死鬼 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\吊死鬼-奖励属性-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\吊死鬼-奖励属性-结算后.jpg` |
| 一条秘密通道 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\一条秘密通道-第二目标板块-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\一条秘密通道-第二目标板块-结算后.jpg` |
| 脑状食品-奖励属性 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\脑状食品-奖励属性-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\脑状食品-奖励属性-结算后.jpg` |
| 脑状食品-通用伤害 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\脑状食品-通用伤害属性-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\脑状食品-通用伤害属性-结算后.jpg` |
| 夜幕众星 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\夜幕众星-选择检定属性-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\夜幕众星-选择检定属性-结算后.jpg` |
| 一抹鲜红 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\一抹鲜红-跳过作祟伤害-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\一抹鲜红-跳过作祟伤害-结算后.jpg` |
| 一瓶微尘 | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\一瓶微尘-跳过作祟双属性-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\一瓶微尘-跳过作祟双属性-结算后.jpg` |
| 说“茄子”！ | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\说茄子-跳过作祟抽物品-选择前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-事件牌页面承接E2E\说茄子-跳过作祟抽物品-结算后.jpg` |

## 禁止外推口径

- 可以说：23 张 locked 官方事件合同已登记；当前正式运行事件牌堆为 23 张，必要页面选择链已有真实浏览器 E2E 覆盖；`一瓶微尘` 的剧本 3「灰尘」成功作祟链另有独立 E2E 证据。
- 不可以说：山屋整游戏已完成；全部作祟剧本或所有深分支都已完成；未来新增事件图源自动通过当前矩阵。
