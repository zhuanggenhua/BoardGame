# 山屋惊魂教程覆盖矩阵

> 目的：把“规则条目 -> 教程章节 -> 真实页面锚点 -> 证据”锁清，确保教程从真实运行时主入口开始，并继续复用真实 runtime、真实终局。
> 当前真相源：`src/games/betrayal/tutorial.ts`、`src/games/betrayal/Board.tsx`、`docs/games/betrayal/README.md`、`evidence/betrayal-basic-flow/`、`evidence/betrayal-first-scenario/`、`evidence/betrayal-tutorial/`、`docs/games/betrayal/sources/official/*.md`。

## 当前章节

1. `basic-setup-and-turn`
   - 目标：直接从真实恶兆前运行时进入，合并讲清基础回合、持有物使用、移动、探索和发现牌检定；交易不再混在这一章里带过。
2. `trade-and-agreement`
   - 目标：切到同房间且双方都有持有物的真实运行时局面，讲清交易必须同一房间、物品/预兆可交换、双方同意后才结算，并完成“只选择己方物品 -> 提出交易”“只选择对方物品 -> 提出交易”和“选兔脚 -> 点同房间队友 -> 选对方地图 -> 提出交易 -> 接收方同意 -> 双向结算清空”链路。
3. `haunt-actions-and-finish`
   - 目标：切到真实第一剧本作祟后局面，先讲清“探索/预兆导致作祟、作祟后目标改变、前置调查完成后才轮到驱魔”，再完成英雄驱魔检定。
4. `hero-attack-path`
   - 目标：切到真实第一剧本英雄与叛徒同房间局面，打开剧本确认目标后，演示英雄攻击叛徒和攻击骰盘。
5. `jack-spirit-path`
   - 目标：切到真实第一剧本杰克之灵已出现后的局面，打开剧本确认怪物目标，再演示杰克之灵攻击英雄和同一攻击骰盘。
6. `traitor-path`
   - 目标：切到叛徒视角，演示叛徒攻击英雄并进入另一种结局。

隐藏兼容入口：

- `move-explore-use`：兼容旧链接，实际指向 `basic-setup-and-turn`。
- `crimson-jack-objective`：兼容旧链接，实际指向 `haunt-actions-and-finish`。

## 当前实现状态

- 已有教程本体：`src/games/betrayal/tutorial.ts`
- 已接入标准教程解析链：`src/games/manifest.client.generated.tsx`
- 已挂真实教程锚点：
  - 角色选择：`betrayal-character-select-screen`、`betrayal-character-selection-grid`、`betrayal-character-confirm`
  - 运行时：`betrayal-current-traits`、`betrayal-inventory-zone`、`betrayal-room-board`、`betrayal-latest-discovery`、`betrayal-actions-zone`、`betrayal-action-*`
  - 交易：`betrayal-trade-status`、`betrayal-room-occupant-hallway-1`、`betrayal-trade-return-selector`、`betrayal-action-trade`、`betrayal-trade-agreement-panel`
  - 帮助与终局：`betrayal-reference-entry`、`betrayal-endgame-screen`
- 已有静态验证：
  - `src/games/betrayal/__tests__/tutorial.test.ts`
  - `src/games/betrayal/__tests__/tutorialIds.test.ts`
  - `src/games/__tests__/betrayalManifestIntegration.test.ts`
  - `src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx`
  - `src/pages/__tests__/matchRoomStageRuntimeModelBuilders.test.ts`
  - `src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx`
  - `src/engine/systems/__tests__/CheatSystem.test.ts`
- 已有真实 E2E：
  - `e2e/betrayal/basic-flow.e2e.ts`
  - `e2e/betrayal/first-scenario.e2e.ts`
  - `e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `e2e/betrayal/first-scenario-traitor-victory.e2e.ts`
  - `e2e/betrayal/first-scenario-corpse-loot.e2e.ts`
  - `e2e/betrayal/first-scenario-jack-spirit-revive.e2e.ts`
  - `e2e/betrayal/first-scenario-jack-spirit-post-revive-attack.e2e.ts`

## 当前验证状态

- 这轮已重新通过教程/共享接线相关单测：
  - `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/__tests__/ActionBarSkeleton.test.tsx src/engine/systems/__tests__/CheatSystem.test.ts src/games/__tests__/betrayalManifestIntegration.test.ts src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts src/pages/__tests__/matchRoomStageRuntimeModelBuilders.test.ts src/pages/__tests__/useMatchRoomTutorialLifecycle.test.tsx --configLoader native`
  - 结果：`7 passed / 31 passed`
- 本轮新增交易教程后，已补充并通过：
  - `npx eslint src/games/betrayal/tutorial.ts src/games/betrayal/__tests__/tutorial.test.ts e2e/betrayal/betrayal-tutorial.e2e.ts`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/tutorial.test.ts --configLoader native`
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-command.mjs default e2e/betrayal/betrayal-tutorial.e2e.ts --grep "交易教程"`
- 这轮已串行通过的真实 E2E 共 7 条：
  - `basic-flow`
  - `first-scenario`
  - `first-scenario-traitor-victory`
  - `betrayal-tutorial`
  - `first-scenario-corpse-loot`
  - `first-scenario-jack-spirit-revive`
  - `first-scenario-jack-spirit-post-revive-attack`

## 规则覆盖矩阵

| 规则条目 | 状态 | 对应章节 | 真实锚点 / 真实动作 | 当前证据 |
| :--- | :--- | :--- | :--- | :--- |
| 角色选择 / 剧本开始属于真实进入链路，但不再作为基础教程主教学落点 | 已调整 | 真实入口保留，基础教程正文不单列 | 角色选择 UI 与 `CONFIRM_EXPLORER` / `START_SCENARIO` 仍存在，但首章改为 `setup-runtime` 注入到真实恶兆前运行时 | `tutorial.ts`、`tutorial.test.ts` |
| 恶兆前主动作入口：移动 / 探索 / 使用 / 结束回合；交易单列为双方同意章节 | 已覆盖 | `basic-setup-and-turn`、`trade-and-agreement` | `betrayal-actions-zone`、`betrayal-action-trade` | `tutorial.test.ts`、`evidence/betrayal-tutorial/02`、`29-35` |
| 速度决定理论移动范围，移动前先看属性区里的速度值 | 已覆盖 | `basic-setup-and-turn` | `betrayal-current-traits` | `tutorial.test.ts` |
| 当前这回合还剩几步，要看右上角剩余移动提示 | 已覆盖 | `basic-setup-and-turn` | `betrayal-moves-remaining` | `tutorial.test.ts`、`evidence/betrayal-tutorial/02` |
| 持有区与帮助入口都在真实牌桌里，不另造说明页 | 已覆盖 | `basic-setup-and-turn` | `betrayal-inventory-zone`、`betrayal-reference-entry` | `tutorial.test.ts`、`evidence/betrayal-tutorial/03` |
| 房间牌桌是主视区 | 已覆盖 | `basic-setup-and-turn` | `betrayal-room-board` | `evidence/betrayal-tutorial/03` |
| 真实移动会消耗移动点，使用兔脚可改骰 | 已覆盖 | `basic-setup-and-turn` | `USE_POSSESSION` -> `MOVE_TO_ROOM` -> `USE_RABBIT_FOOT` | `tutorial.test.ts`、`evidence/betrayal-basic-flow/04-06` |
| 可探索的盖着房间会真实翻开，并触发事件 / 物品 / 预兆 | 已覆盖 | `basic-setup-and-turn` | `EXPLORE_ROOM` | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/11-12` |
| 同房间交易规则：同一房间、物品/预兆、双方同意、可任意数量交换且不必等价 | 已覆盖 | `trade-and-agreement` | 规则书 `Trading`；`TRADE_POSSESSION` 先写入待同意交易，`RESOLVE_TRADE_AGREEMENT` 同意后才结算 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md`、`tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts` |
| 发起方选择要给出的持有物，并直接点击地图上的同房间队友 token | 已覆盖 | `trade-and-agreement` | `betrayal-inventory-rope` -> `betrayal-room-occupant-hallway-1` | `tutorial.test.ts`、`evidence/betrayal-tutorial/30-山屋惊魂-教程-交易选择兔脚.jpg`、`31-山屋惊魂-教程-交易选择队友.jpg` |
| 发起方只选择己方持有物时不会误以为必须从对方持有物里选一张 | 已覆盖 | `trade-and-agreement` | 选中队友后 `betrayal-trade-return-selector` 只显示真实对方持有物卡牌；不得显示 `betrayal-trade-return-skip` 或任何空值伪候选；摘要只显示“你给出兔脚”，唯一 `提出交易` 确认必须在 `betrayal-trade-flow-banner` 同一块里；直接点后 `targetCardIds=[]` | `e2e/betrayal/betrayal-tutorial.e2e.ts`、`e2e/betrayal/first-scenario-trade-interaction.e2e.ts`、`evidence/betrayal-tutorial/31-山屋惊魂-教程-交易选择队友.jpg`、`evidence/山屋惊魂-交易只给出完整链路/01-选择队友后只给出兔脚.jpg` |
| 发起方可以直接选择对方持有物作为对方给出的对象 | 已覆盖 | `trade-and-agreement` | 选中队友后显示 `betrayal-trade-return-selector`，点击 `betrayal-trade-return-card-map`，摘要显示“对方给出地图”或双方给出摘要，请求 payload 写入 `targetCardIds=['map']` | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/32-山屋惊魂-教程-交易选择对方地图.jpg` |
| 交易请求发出后进入等待态，接收方看到同意 / 拒绝面板 | 已覆盖 | `trade-and-agreement` | 流程条内 `betrayal-action-trade[data-trade-confirm-placement="flow-banner"]` -> `betrayal-trade-agreement-panel`，摘要必须显示“你给出兔脚”“对方给出地图”或接收方视角的“发起方给出兔脚 / 你给出地图”；不得显示“索要 / 换回 / 不换回”模式词 | `tutorial.test.ts`、`evidence/betrayal-tutorial/33-山屋惊魂-教程-交易请求等待同意.jpg`、`34-山屋惊魂-教程-交易接收方同意.jpg` |
| 接收方同意后，待同意状态清空，发起方得到地图、队友得到兔脚并回到牌桌反馈 | 已覆盖 | `trade-and-agreement` | `POSSESSION_TRADED` 后 `pendingTradeAgreement=null`，`betrayal-room-latest-feedback` 显示交易结果 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/35-山屋惊魂-教程-交易后互换结果.jpg` |
| 第一剧本作祟后目标改变：探索目标切换为调查杰克、研究法阵、驱魔 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-reference-entry`、杰克之灵 token、作祟后状态条 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/17-山屋惊魂-教程-作祟目标改变.jpg` |
| 打开剧本目标页是只读参考入口，不得只靠介绍 | 已覆盖 | `haunt-actions-and-finish`、`hero-attack-path`、`jack-spirit-path` | `betrayal-open-scenario` -> `betrayal-scenario-objective-page` -> `betrayal-reference-close`；目标页必须显示英雄目标、叛徒目标、杰克之灵目标 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/18-山屋惊魂-教程-打开剧本目标页.jpg`、`26-山屋惊魂-教程-杰克之灵目标页.jpg` |
| 驱魔前玩家因果链：前置调查与两处法阵已完成，所以现在才轮到驱魔 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-action-use`、教程浮层因果说明 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/19-山屋惊魂-教程-驱魔前因果说明.jpg` |
| 第一剧本英雄攻击叛徒：英雄可用正式攻击入口推进剧本 | 已覆盖 | `hero-attack-path` | `HAUNT_ATTACK target=traitor` -> `betrayal-attack-roll-review` -> `betrayal-recent-roll-panel`；攻击骰盘必须和其它主流程投骰一样居中、物理骰可见 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/22-山屋惊魂-教程-英雄攻击叛徒前.jpg`、`evidence/betrayal-tutorial/23-山屋惊魂-教程-英雄攻击叛徒骰盘.jpg` |
| 第一剧本杰克之灵 / 怪物行动：叛徒倒下后怪物会继续行动并攻击英雄 | 已覆盖 | `jack-spirit-path` | `betrayal-open-scenario` -> `betrayal-scenario-objective-page`；`HAUNT_ATTACK target=hero` -> `betrayal-attack-roll-review` -> `betrayal-recent-roll-panel` | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/26-山屋惊魂-教程-杰克之灵目标页.jpg`、`27-山屋惊魂-教程-杰克之灵攻击英雄前.jpg`、`28-山屋惊魂-教程-杰克之灵攻击骰盘.jpg` |
| 第一剧本敌方攻击：叛徒攻击英雄会投骰对抗并造成伤害 / 终局 | 已覆盖 | `traitor-path` | `HAUNT_ATTACK target=hero` -> `betrayal-endgame-screen` | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/24-山屋惊魂-教程-叛徒视角敌方攻击前.jpg`、`evidence/betrayal-tutorial/25-山屋惊魂-教程-叛徒终局页.jpg` |
| 作祟后真实关键动作仍在正式底部动作区 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-action-use` | `tutorial.test.ts`、`evidence/betrayal-tutorial/18` |
| 英雄驱魔成功后进入真实终局页 | 已覆盖 | `haunt-actions-and-finish` | `EXORCISE_JACK` -> `betrayal-endgame-screen` | `e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/20-山屋惊魂-教程-驱魔神志检定骰盘.jpg`、`evidence/betrayal-tutorial/21-山屋惊魂-教程-驱魔成功后的终局页.jpg` |

## 当前仍未承诺的范围

1. 更多剧本 / 更多 haunt 分支
   - 当前只承诺第一剧本 `Crimson Jack Returns` 的基础目标、英雄驱魔收尾、英雄攻击叛徒分支、杰克之灵怪物分支、叛徒攻击英雄分支。

2. 完整规则书级教学
   - 当前是“5 个可见章节 + 2 个隐藏兼容入口”的真实教程，不是把所有边界规则都塞进一次长教程。

## 当前建议

1. 继续保持“真实页面 + 真实命令 + 可见章节不重复”的教程策略，不回退到教程专用壳层。
2. 玩家链路截图必须保持游玩顺序：基础行动 -> 可探索盖着房间/发现牌 -> 作祟目标改变 -> 打开剧本目标页 -> 驱魔前因果说明 -> 驱魔投骰 -> 结局 -> 英雄攻击分支 -> 杰克之灵怪物分支 -> 敌方攻击分支；素材加载、debug、review 图只能作为技术证据，不混入全链路阶段。
3. 下一轮若扩教程，优先补更多剧本或第一剧本其它边界分支，不再重复基础移动/探索/驱魔。
4. 任何教程新增章节都先补重复机制归并表、玩家因果链、真实锚点与最小 E2E，再扩文案。
