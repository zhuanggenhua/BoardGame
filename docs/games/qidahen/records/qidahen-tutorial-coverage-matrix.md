# 七大恨教程覆盖矩阵

> 状态：按当前规则流程重构后的维护基线。
>
> 规则真相源：`src/games/qidahen/rule/七大恨规则.md`。
>
> 运行态真相源：`src/games/qidahen/tutorial.ts`、`src/games/qidahen/tutorialSetup.ts`、`src/games/qidahen/__tests__/tutorialFlow.test.ts`、`e2e/qidahen/qidahen-closeout.e2e.ts`。

## 1. 章节边界

目录只显示 6 个玩家可直接选择的章节：

1. `basic-opening`：开局、公共轮盘与首回合
2. `attack-and-battle`：进攻与野战
3. `siege-and-occupation`：攻城与围城 / 占领
4. `wheel-shared-cost`：轮盘代价与进攻调度
5. `year-and-characters`：年中、新年与纪年
6. `korea-and-special-map-rules`：朝鲜与地图特例

隐藏专题用于承载真实代表局面，但都是独立入口，不是假装连续的一局：

- `retreat-and-rout`、`cavalry-evasion`、`cavalry-plunder`
- `neutral-invasion`、`water-dispatch`
- `wheel-reclaim`、`wheel-military-farm`、`wheel-recruit-train`
- `armament-upgrade`、`event-action`、`diplomacy-and-hire`

隐藏专题没有自动 `nextTutorialId` 串联。完成一个预设局面后返回教程入口；需要继续学习时，由玩家从目录或正式路由重新选择对应专题。这样可以保证截图和文案不会把互不连续的预设局面包装成同一局自然后果。

## 2. 基础教程流程合同

正式大明起手为 3 张手牌，手牌上限为 15 张。首局局面没有超限，因此手牌上限检查自动通过；基础教程不得把弃牌做成第一步。

基础主线固定为：

| 顺序 | 步骤 | 玩家看到 / 执行的事情 | 规则后果 |
|---|---|---|---|
| 1 | `welcome` | 读取三种胜法 | 进入玩家行动流程 |
| 2 | `turn-flow` | 读取手牌上限、轮盘行动与手牌行动的正式顺序关系 | 识别本回合的一级行动层 |
| 3 | `wheel-first` | 确认正式开局未触发手牌上限处理 | 轮盘成为当前真实决策入口 |
| 4 | `wheel-rule` | 读取轮盘可走 1、2、3 格及其不同结果 | 进入轮盘选择 |
| 5 | `wheel-move` | 点击公共轮盘免费走 1 格 | 轮盘位置改变 |
| 5a | `wheel-branch-stop` | 误选 2 格或 3 格时停在当前分支；通用“上一步”只负责恢复导航 | 不进入征兵训练后续链 |
| 6 | `wheel-result` | 读取征兵 / 训练落点的真实地图变化 | 落点效果已经自动结算 |
| 7 | `hand-action-order` | 读取大明四个同层势力行动 | 进入手牌行动选择 |
| 8 | `grant-pardon-rule` | 读取赐印招安规则原文 | 进入行动选择 |
| 9 | `pick-action` | 选择手牌行动「赐印招安」 | 进入真实支付窗口 |
| 10 | `pay-cards` | 按当前费用弃 3 张手牌 | 支付完成，等待地图目标 |
| 11 | `choose-grant-pardon-target` | 点击地图上的招安目标 | 地图关系发生变化 |
| 12 | `action-result` | 读取控制权变化和结算摘要 | 手牌行动完成 |
| 13 | `finish` | 看到首回合基础链完成 | 关闭教程，不跳转其它专题 |

每一步必须符合 `上一画面 -> 玩家输入或自动结算 -> 下一画面`。没有发生的条件分支（例如未超上限时的弃牌）只能作为状态断言，不能变成当前动作。

## 3. 规则覆盖

| 规则对象 | 教学承接 | 当前状态 | 直接证据 |
|---|---|---|---|
| 正式开局、起手牌、手牌上限 | `basic-opening` 的 `welcome` / `wheel-first` | 已覆盖 | `tutorialFlow.test.ts`、基础 E2E 起手状态断言 |
| 公共轮盘 1 / 2 / 3 格 | `basic-opening`、`wheel-shared-cost` | 已覆盖 | 真实轮盘目标、当前位置和落点结果断言 |
| 轮盘落点即时结算 | `basic-opening` 的 `wheel-result` | 已覆盖 | 征兵 / 训练摘要和状态变化 |
| 手牌行动与支付 | `basic-opening`、`armament-upgrade`、`event-action` | 已覆盖代表链 | 真实手牌入口、支付面板、支付后结果 |
| 轮盘代价与进攻调度 | `wheel-shared-cost` | 已覆盖代表链 | 对手摸牌、部队选择、调度目标 |
| 开垦 / 军屯 / 征兵训练 | 3 个隐藏独立专题 | 已覆盖代表链 | 对应落点与摘要截图 |
| 进攻 / 野战 / 战术时机 | `attack-and-battle` | 已覆盖代表链 | 突袭作战、支付、战斗、战术牌和战后处理 |
| 撤退、骑兵避战、骑兵劫掠 | 独立隐藏专题 | 已覆盖代表链 | 对应真实按钮和结算摘要 |
| 中立入侵、水路运补 | 独立隐藏专题 | 已覆盖代表链 | 中立守军、海岸水路限 2、排除陆路后续目标 |
| 攻城、围城、占领 | `siege-and-occupation` | 已覆盖代表链 | 守城宣告、城战、围城 / 占领选择 |
| 外交、雇佣 | `diplomacy-and-hire` | 已覆盖代表链 | 友好标记、附庸 / 雇佣结算 |
| 年中、新年、纪年、顺位刷新 | `year-and-characters` | 已覆盖代表链 | 年中摘要、新年维护、纪年卡、年份推进 |
| 朝鲜、汉城、水路、山海关 | `korea-and-special-map-rules` | 已覆盖代表链 | 朝贡、朝鲜耗损、地图特例摘要 |

## 4. 当前未外推项

- 教程只证明对应专题的真实入口和代表局面，不代表《七大恨》全部规则、全部手牌效果和全部战术牌已经完成。
- 教程注入的预设局面不能替代正式普通对局真相；需要证明正式入口时，必须另有同视角正式入口对照证据。
- 规则没有要求的作者解释、策略建议和“为了演示”的桥接句不进入玩家文案；教程导航控件（如“上一步”）也不写进规则正文。
- 截图、单测或历史 PASS 只覆盖它直接指向的节点；不得外推为其它专题或整体游戏完成。

## 5. 验收入口

- 教程源码：`src/games/qidahen/tutorial.ts`
- 教程单测：`src/games/qidahen/__tests__/tutorialFlow.test.ts`
- 真实 E2E：`e2e/qidahen/qidahen-closeout.e2e.ts`
- 截图根目录：`test-results/evidence-screenshots/_shared/qidahen-教程完成/`
- 收口证据：`evidence/qidahen/qidahen-tutorial-closeout-e2e-test.md`

后续只要改章节、步骤、文案、交互承接物或截图顺序，必须同步源码、测试、矩阵、E2E 和当前 PASS 清单。不得重新引入与当前局面无关的弃牌、手牌检视、士气或重复轮盘说明。
