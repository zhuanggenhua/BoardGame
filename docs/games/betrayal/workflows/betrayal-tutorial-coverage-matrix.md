# 山屋惊魂教程覆盖矩阵

> 目的：把“规则条目 -> 教程章节 -> 真实页面锚点 -> 证据”锁清，确保教程从真实运行时主入口开始，并继续复用真实 runtime、真实终局。
> 当前真相源：`src/games/betrayal/tutorial.ts`、`src/games/betrayal/Board.tsx`、`docs/games/betrayal/README.md`、`evidence/betrayal-basic-flow/`、`evidence/betrayal-first-scenario/`、`evidence/betrayal-tutorial/`、`docs/games/betrayal/sources/official/*.md`。

## 当前章节

当前目录只展示当前默认首剧本「木乃伊横行」可成立的教程章节；旧「赤红杰克」分支保留为隐藏历史入口，不再作为当前玩家教程目录或当前 E2E 验收交付。

1. `basic-setup-and-turn`
   - 目标：直接从真实恶兆前运行时进入，合并讲清基础回合、属性轨、观察视角、聚焦到我的房间、预兆进度条、持有物使用、移动、探索和发现牌检定。
2. `omen-confirmation-and-haunt-risk`
   - 目标：切到真实预兆发现后的确认面板，讲清预兆牌和作祟检定同屏出现、玩家只点一次 `确认`、预兆/作祟进度条怎么读，以及确认结束后如何回到牌桌。
3. `trade-and-agreement`
   - 目标：切到同房间且双方都有持有物的真实运行时局面，讲清交易必须同一房间、物品/预兆可交换、双方同意后才结算，并完成“选兔脚 -> 点同房间队友 -> 选对方地图 -> 提出交易 -> 接收方同意 -> 双向结算清空”链路。
4. `haunt-actions-and-finish`
   - 目标：切到真实「木乃伊横行」作祟后局面，讲清作祟后目标改变、自动打开一次英雄剧本开场、手动回看英雄目标页、真名 / 驱逐法术前置因果，以及房间本体直选触发驱逐木乃伊神志对抗和终局。
5. `traitor-path`
   - 目标：切到真实「木乃伊横行」叛徒胜利前局面，讲清叛徒目标、打开叛徒剧本书、拾起女孩、把女孩交给木乃伊、交出圣符 / 指环，并触发木乃伊叛徒胜利。
6. `mummy-monster-actions`
   - 目标：切到真实「木乃伊横行」怪物行动局面，讲清木乃伊作为怪物的移动、同房必须先攻击、合法攻击目标、攻击骰盘和偷取奖励链路。

隐藏历史入口：

- `move-explore-use`：兼容旧链接，实际指向 `basic-setup-and-turn`。
- `crimson-jack-objective`：兼容旧链接，实际指向当前 `haunt-actions-and-finish`。
- `hero-attack-path`、`jack-spirit-path`：旧「赤红杰克归来」历史入口，当前已隐藏且不纳入当前「木乃伊横行」E2E；后续若恢复为可见教程或兼容回归，必须先重建对应旧剧本运行态，或明确翻正到当前默认剧本。

## 当前实现状态

- 已有教程本体：`src/games/betrayal/tutorial.ts`
- 已接入标准教程解析链：`src/games/manifest.client.generated.tsx`
- 已挂真实教程锚点：
  - 角色选择：`betrayal-character-select-screen`、`betrayal-character-selection-grid`、`betrayal-character-confirm`
  - 运行时：`betrayal-current-traits`、`betrayal-haunt-risk-status`、`betrayal-focus-self-room`、`betrayal-bottom-teammate-*`、`betrayal-inventory-zone`、`betrayal-room-board`、`betrayal-latest-discovery`、`betrayal-actions-zone`、`betrayal-action-*`
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

- 本轮教程规范 / 山屋教程补充后已通过：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/tutorial.test.ts src/games/betrayal/__tests__/tutorialIds.test.ts --configLoader native`
  - 结果：`2 passed / 28 passed`
  - `node --max-old-space-size=8192 .\node_modules\eslint\bin\eslint.js src\games\betrayal\tutorial.ts src\games\betrayal\testing\firstScenarioTestUtils.ts src\games\betrayal\__tests__\tutorial.test.ts src\games\betrayal\__tests__\tutorialIds.test.ts e2e\betrayal\betrayal-tutorial.e2e.ts src\games\betrayal\Board.tsx`
  - 结果：通过；默认 `npx eslint ...` 曾因 Node 堆内存 OOM，中断点不是代码 lint 失败。
- 本轮新增 / 刷新的真实教程 E2E：
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
  - 结果：`9 passed / 2 skipped`；2 个 skipped 是隐藏旧「赤红杰克归来」历史入口（`hero-attack-path`、`jack-spirit-path`），不纳入当前默认「木乃伊横行」教程验收。
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts "[mummy-monster-actions] 教程会完成木乃伊怪物移动、同房攻击和偷取奖励"`
  - 结果：`1 passed`，覆盖木乃伊怪物移动、同房攻击骰盘和偷取奖励，刷新 `49-57` 截图。
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts "移动探索教程会使用持有物、整张房间牌移动并探索出发现牌"`
  - 结果：`1 passed`，覆盖探索发现牌、兔脚改骰和结果回牌桌，刷新 `11-16` 截图。
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-command.mjs default e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-banish"`
  - 结果：`1 passed`，覆盖房间本体直选触发「驱逐木乃伊」和同一主骰盘。
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-command.mjs default e2e/betrayal/betrayal-tutorial.e2e.ts --grep "omen-confirm"`
  - 结果：`1 passed`，覆盖预兆牌和作祟检定同屏、单次 `确认` 与预兆进度条。
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-command.mjs default e2e/betrayal/betrayal-tutorial.e2e.ts --grep "tutorial-main"`
  - 结果：`1 passed`，覆盖当前目录章节、属性轨 / 观察 / 聚焦 / 预兆进度、木乃伊剧本开场 / 目标页、驱逐木乃伊骰盘和终局。
  - `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-traitor-path"`
  - 结果：已由整份 `betrayal-tutorial.e2e.ts` 复跑覆盖，刷新并核验 `44-48` 叛徒线截图。

## 规则覆盖矩阵

| 规则条目 | 状态 | 对应章节 | 真实锚点 / 真实动作 | 当前证据 |
| :--- | :--- | :--- | :--- | :--- |
| 角色选择 / 剧本开始属于真实进入链路，但不再作为基础教程主教学落点 | 已调整 | 真实入口保留，基础教程正文不单列 | 角色选择 UI 与 `CONFIRM_EXPLORER` / `START_SCENARIO` 仍存在，但首章改为 `setup-runtime` 注入到真实恶兆前运行时 | `tutorial.ts`、`tutorial.test.ts` |
| 恶兆前主动作入口：移动 / 探索 / 使用 / 结束回合；交易单列为双方同意章节 | 已覆盖 | `basic-setup-and-turn`、`trade-and-agreement` | `betrayal-actions-zone`、`betrayal-action-trade` | `tutorial.test.ts`、`evidence/betrayal-tutorial/02`、`29-35` |
| 速度决定理论移动范围，移动前先看属性区里的速度值 | 已覆盖 | `basic-setup-and-turn` | `betrayal-current-traits` | `tutorial.test.ts` |
| 属性轨读法：当前格高亮、绿色数字是起始值、骷髅是死亡端点；重复数字是连续物理格，不合并 | 已补教程 | `basic-setup-and-turn` | `betrayal-current-traits`、正式属性轨 DOM 合同 | `tutorial.test.ts`、`trait-track-ui.e2e.ts`、`evidence/betrayal-core-interactions/trait-track-ui/` |
| 当前这回合还剩几步，要看右上角剩余移动提示 | 已覆盖 | `basic-setup-and-turn` | `betrayal-moves-remaining` | `tutorial.test.ts`、`evidence/betrayal-tutorial/02` |
| 观察视角：点击队友面板会把左侧属性/状态切到该队友；再次点击同一队友或聚焦自己可恢复 | 已补教程 | `basic-setup-and-turn` | `betrayal-bottom-teammate-1` -> `betrayal-current-traits[data-observed-player=true]` | `tutorial.test.ts`、`Board.foundation.test.tsx`、`evidence/betrayal-tutorial/37-山屋惊魂-教程-观察队友视角.jpg` |
| 聚焦到我的房间：把镜头移回当前玩家所在房间，不是房间弹窗 | 已补教程 | `basic-setup-and-turn` | `betrayal-focus-self-room` -> 当前玩家房间 | `tutorial.test.ts`、`Board.foundation.test.tsx`、`evidence/betrayal-tutorial/38-山屋惊魂-教程-聚焦回自己房间.jpg` |
| 预兆/作祟进度条：当前高亮格是已发现预兆数；教程只教玩家如何读取和何时触发检定，设计裁定与规则详情留在 tooltip / 规范 / 测试 | 已补教程 | `basic-setup-and-turn`、`omen-confirmation-and-haunt-risk` | `betrayal-haunt-risk-status`、`betrayal-haunt-risk-progress`、`betrayal-haunt-risk-slot` | `tutorial.test.ts`、`haunt-risk-status.e2e.ts`、`evidence/betrayal-tutorial/39-山屋惊魂-教程-预兆作祟进度条.jpg`、`43-山屋惊魂-教程-确认后预兆进度条.jpg` |
| 持有区与帮助入口都在真实牌桌里，不另造说明页 | 已覆盖 | `basic-setup-and-turn` | `betrayal-inventory-zone`、`betrayal-reference-entry` | `tutorial.test.ts`、`evidence/betrayal-tutorial/03` |
| 房间牌桌是主视区 | 已覆盖 | `basic-setup-and-turn` | `betrayal-room-board` | `evidence/betrayal-tutorial/03` |
| 真实移动会消耗移动点，使用兔脚可改骰 | 已覆盖 | `basic-setup-and-turn` | `USE_POSSESSION` -> `MOVE_TO_ROOM` -> `USE_RABBIT_FOOT` | `tutorial.test.ts`、`evidence/betrayal-basic-flow/04-06` |
| 可探索的盖着房间会真实翻开，并触发事件 / 物品 / 预兆 | 已覆盖 | `basic-setup-and-turn` | `EXPLORE_ROOM` | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/11-12` |
| 预兆同屏确认：预兆牌获得和作祟检定已经在同一画面里，玩家只点一次 `确认` 关闭面板 | 已补教程 | `omen-confirmation-and-haunt-risk` | `betrayal-discovery-continue[data-pending-card-resolution-step="1/1"]`、`CARD_RESOLUTION_ACKNOWLEDGED` | `tutorial.test.ts`、`haunt-reveal-discovery-confirmation.e2e.ts`、`evidence/betrayal-tutorial/40-山屋惊魂-教程-同屏确认预兆与作祟检定.jpg`、`42-山屋惊魂-教程-确认后回牌桌持有区.jpg`、`43-山屋惊魂-教程-确认后预兆进度条.jpg` |
| 同房间交易规则：同一房间、物品/预兆、双方同意、可任意数量交换且不必等价 | 已覆盖 | `trade-and-agreement` | 规则书 `Trading`；`TRADE_POSSESSION` 先写入待同意交易，`RESOLVE_TRADE_AGREEMENT` 同意后才结算 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md`、`tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts` |
| 发起方选择要给出的持有物，并直接点击地图上的同房间队友 token | 已覆盖 | `trade-and-agreement` | `betrayal-inventory-rope` -> `betrayal-room-occupant-hallway-1` | `tutorial.test.ts`、`evidence/betrayal-tutorial/30-山屋惊魂-教程-交易选择兔脚.jpg`、`31-山屋惊魂-教程-交易选择队友.jpg` |
| 发起方只选择己方持有物时不会误以为必须从对方持有物里选一张 | 已覆盖 | `trade-and-agreement` | 选中队友后 `betrayal-trade-return-selector` 只显示真实对方持有物卡牌；不得显示 `betrayal-trade-return-skip` 或任何空值伪候选；摘要只显示“你给出兔脚”，唯一 `提出交易` 确认必须在 `betrayal-trade-flow-banner` 同一块里；直接点后 `targetCardIds=[]` | `e2e/betrayal/betrayal-tutorial.e2e.ts`、`e2e/betrayal/first-scenario-trade-interaction.e2e.ts`、`evidence/betrayal-tutorial/31-山屋惊魂-教程-交易选择队友.jpg`、`evidence/山屋惊魂-交易只给出完整链路/01-选择队友后只给出兔脚.jpg` |
| 发起方可以直接选择对方持有物作为对方给出的对象 | 已覆盖 | `trade-and-agreement` | 选中队友后显示 `betrayal-trade-return-selector`，点击 `betrayal-trade-return-card-map`，摘要显示“对方给出地图”或双方给出摘要，请求 payload 写入 `targetCardIds=['map']` | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/32-山屋惊魂-教程-交易选择对方地图.jpg` |
| 交易请求发出后进入等待态，接收方看到同意 / 拒绝面板 | 已覆盖 | `trade-and-agreement` | 流程条内 `betrayal-action-trade[data-trade-confirm-placement="flow-banner"]` -> `betrayal-trade-agreement-panel`，摘要必须显示“你给出兔脚”“对方给出地图”或接收方视角的“发起方给出兔脚 / 你给出地图”；不得显示“索要 / 换回 / 不换回”模式词 | `tutorial.test.ts`、`evidence/betrayal-tutorial/33-山屋惊魂-教程-交易请求等待同意.jpg`、`34-山屋惊魂-教程-交易接收方同意.jpg` |
| 接收方同意后，待同意状态清空，发起方得到地图、队友得到兔脚并回到牌桌反馈 | 已覆盖 | `trade-and-agreement` | `POSSESSION_TRADED` 后 `pendingTradeAgreement=null`，`betrayal-room-latest-feedback` 显示交易结果 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/35-山屋惊魂-教程-交易后互换结果.jpg` |
| 第一剧本作祟后目标改变：探索目标切换为找真名、学驱逐法术、驱逐木乃伊 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-reference-entry`、木乃伊 token、作祟后状态条 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/17-山屋惊魂-教程-木乃伊作祟目标改变.jpg` |
| 作祟变化时打开一次英雄剧本开场，稳定牌桌不反复弹 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-scenario-reader-dialog` -> 英雄开场 -> 关闭回牌桌 | `e2e/betrayal/betrayal-tutorial.e2e.ts --grep "tutorial-main"` |
| 打开剧本目标页是只读参考入口，不得只靠介绍 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-open-scenario` -> `betrayal-scenario-objective-page` -> `betrayal-scenario-reader-next-zone` -> `betrayal-scenario-reader-close`；目标页显示木乃伊横行、真名、驱逐法术、驱逐木乃伊 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/18-山屋惊魂-教程-打开木乃伊剧本目标页.jpg` |
| 驱逐木乃伊前玩家因果链：当前局面已完成两个前置说明——在石棺房 / 书房 / 图书馆用知识找到真名；持书英雄再用知识学会驱逐法术；书本与木乃伊同房后才进入最终神志对抗 | 前置说明已覆盖；前两步未在本章实操演示 | `haunt-actions-and-finish` | `betrayal-action-use`、`betrayal-room-*`、教程浮层因果说明；前两步由剧本目标页和教程文案说明 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/18-山屋惊魂-教程-打开木乃伊剧本目标页.jpg`、`19-山屋惊魂-教程-驱逐木乃伊前因果说明.jpg` |
| 英雄驱逐木乃伊：玩家点击木乃伊 / 石棺所在房间牌本体进入神志对抗骰盘 | 已覆盖 | `haunt-actions-and-finish` | `BANISH_MUMMY` -> `MUMMY_BANISHED` -> `betrayal-exorcise-roll-review` -> `betrayal-recent-roll-panel`；骰盘必须显示骰子、总点数、加值 / 对抗结果，并保持无背景托盘 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-banish"`、`evidence/betrayal-tutorial/20-山屋惊魂-教程-驱逐木乃伊神志对抗骰盘.jpg` |
| 英雄驱逐成功后进入真实木乃伊终局页 | 已覆盖 | `haunt-actions-and-finish` | `MUMMY_BANISHED success=true` -> `betrayal-endgame-screen`，终局朗读出现木乃伊化作细砂、烟消云散 | `e2e/betrayal/betrayal-tutorial.e2e.ts --grep "tutorial-main"`、`evidence/betrayal-tutorial/21-山屋惊魂-教程-驱逐木乃伊成功后的终局页.jpg` |
| 叛徒目标页：叛徒需要阅读自己的剧本书目标，不用英雄目标替代 | 已覆盖 | `traitor-path` | `betrayal-open-scenario` -> `betrayal-scenario-objective-page[data-scenario-reader-scope="traitor"]`；目标页显示女孩、圣符 / 指环、石棺和木乃伊规则 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-traitor-path"`、`evidence/betrayal-tutorial/44-山屋惊魂-教程-叛徒打开木乃伊剧本目标页.jpg` |
| 叛徒拾起女孩：女孩公开 token 从房间标记变为叛徒持有目标 | 已覆盖 | `traitor-path` | `PICK_UP_MUMMY_GIRL` -> `MUMMY_GIRL_PICKED_UP`；真实底部动作区显示“拾起女孩” | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/45-山屋惊魂-教程-叛徒拾起女孩前.jpg` |
| 叛徒把女孩交给木乃伊：叛徒与木乃伊同房后女孩转为木乃伊持有 | 已覆盖 | `traitor-path` | `GIVE_GIRL_TO_MUMMY` -> `MUMMY_GIRL_GIVEN`；女孩 token 状态从 `held-by-player` 转为 `held-by-mummy` | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/46-山屋惊魂-教程-女孩交给木乃伊前.jpg` |
| 叛徒把圣符 / 指环交给木乃伊：木乃伊带齐指定预兆后可触发叛徒胜利 | 已覆盖 | `traitor-path` | `GIVE_OMEN_TO_MUMMY` -> `MUMMY_OMEN_GIVEN`；本教程使用正式预兆「圣符」 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/47-山屋惊魂-教程-圣符交给木乃伊前.jpg` |
| 木乃伊叛徒胜利：木乃伊带着女孩和圣符回到石棺 | 已覆盖 | `traitor-path` | `phase=endgame`、`outcome=traitor`、结局朗读出现木乃伊怀中的小女孩 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts`、`evidence/betrayal-tutorial/48-山屋惊魂-教程-木乃伊叛徒胜利.jpg` |
| 木乃伊怪物回合开始：怪物行动从正式底部动作区进入，不用横幅替代 | 已覆盖 | `mummy-monster-actions` | `betrayal-action-monsterTurnStart` -> `MONSTER_TURN_START_RESOLVED`；木乃伊 token 在房间本体上可见 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-monster-actions"`、`evidence/betrayal-tutorial/49-山屋惊魂-教程-木乃伊怪物回合开始前.jpg` |
| 木乃伊怪物移动：先掷移动骰，骰盘显示骰子、合计、加值 / 结果，然后连续选择木乃伊本体和目标房间 | 已覆盖 | `mummy-monster-actions` | `betrayal-action-monsterMovementRoll` -> `betrayal-recent-roll-panel` -> `betrayal-action-monsterMove` -> `MONSTER_MOVED`；移动目标必须来自房间 / token 本体直选 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-monster-actions"`、`evidence/betrayal-tutorial/50-山屋惊魂-教程-木乃伊移动骰盘.jpg`、`51-山屋惊魂-教程-木乃伊瞬移目标.jpg`、`52-山屋惊魂-教程-木乃伊拾起女孩结果.jpg` |
| 木乃伊同房攻击：如果木乃伊和英雄同房，规则先要求攻击，不能先移动或偷取 | 已覆盖 | `mummy-monster-actions` | `betrayal-action-monsterAttack`；同房目标高亮、已死英雄与叛徒不是本次合法目标 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-monster-actions"`、`evidence/betrayal-tutorial/53-山屋惊魂-教程-木乃伊同房必须先攻击.jpg`、`54-山屋惊魂-教程-木乃伊攻击目标高亮.jpg` |
| 木乃伊攻击结算与偷取奖励：攻击骰盘结算后才出现偷取奖励入口，选择地图后木乃伊持有地图 | 已覆盖 | `mummy-monster-actions` | `MONSTER_ATTACK_HERO_RESOLVED` -> `betrayal-recent-roll-panel` -> `betrayal-mummy-reward-banner` -> `MUMMY_ATTACK_REWARD_CHOSEN`；骰盘必须显示骰子、总点数、加值 / 对抗结果，并保持无背景托盘 | `tutorial.test.ts`、`e2e/betrayal/betrayal-tutorial.e2e.ts --grep "mummy-monster-actions"`、`evidence/betrayal-tutorial/55-山屋惊魂-教程-木乃伊攻击骰盘.jpg`、`56-山屋惊魂-教程-木乃伊偷取奖励入口.jpg`、`57-山屋惊魂-教程-木乃伊偷走地图结果.jpg` |
| 旧赤红杰克英雄攻击叛徒、杰克之灵怪物行动 | 隐藏历史 / 非当前默认教程验收 | `hero-attack-path`、`jack-spirit-path` | 旧 `crimson-jack-returns` 运行态未作为当前默认剧本运行态维护，当前已 `hiddenFromCatalog=true`；不得作为「木乃伊横行」教程完整证据 | 旧截图 `22-28` 只作历史证据；旧 E2E 已跳过，恢复前必须先补旧剧本运行态或翻正到木乃伊 |
| 作祟后真实关键动作仍在正式底部动作区 | 已覆盖 | `haunt-actions-and-finish` | `betrayal-action-use` | `tutorial.test.ts`、`evidence/betrayal-tutorial/19-山屋惊魂-教程-驱逐木乃伊前因果说明.jpg` |

## 玩家可用元素覆盖矩阵

| 玩家可用元素 | 现实职责 | 正式 UI | 高频 / 非直觉 | 教程 / 帮助落点 | 端到端截图证据 | 当前缺口 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 阶段 / 回合状态 | 告诉玩家现在是恶兆前、作祟中、轮到谁行动 | `betrayal-runtime-header-grid`、`betrayal-phase-chip` | 高频 | `basic-setup-and-turn`、`haunt-actions-and-finish` | `evidence/betrayal-tutorial/01`、`17` | 无 |
| 底部主动作 | 进入移动、探索、交易、使用、结束回合 | `betrayal-action-*` | 高频 | `basic-setup-and-turn`、`trade-and-agreement`、作祟分支章节 | `evidence/betrayal-tutorial/01`、`19`、`29-35` | 无 |
| 属性轨 | 读取当前属性、起始值、死亡端点和重复格位置 | `betrayal-current-traits` | 高频 / 非直觉 | `basic-setup-and-turn / trait-track-reading` | `evidence/betrayal-tutorial/36-山屋惊魂-教程-属性轨读法.jpg`；专项图见 `evidence/betrayal-core-interactions/trait-track-ui/` | 无 |
| 剩余移动圆牌 | 读取本回合还剩几步 | `betrayal-moves-remaining` | 高频 | `basic-setup-and-turn / moves-remaining` | `evidence/betrayal-tutorial/02` | 无 |
| 预兆 / 作祟进度 | 读取已发现预兆数和作祟触发状态 | `betrayal-haunt-risk-status`、`betrayal-haunt-risk-progress` | 高频 / 非直觉 | `basic-setup-and-turn / haunt-risk-track`、`omen-confirmation-and-haunt-risk / haunt-risk-track`，细节走悬浮提示 | `evidence/betrayal-tutorial/39-山屋惊魂-教程-预兆作祟进度条.jpg`、`43-山屋惊魂-教程-确认后预兆进度条.jpg` | 无 |
| 持有区 | 查看与选择物品 / 预兆 | `betrayal-inventory-zone`、`betrayal-inventory-*` | 高频 | `basic-setup-and-turn`、`trade-and-agreement`、`omen-confirmation-and-haunt-risk` | `evidence/betrayal-tutorial/04-07`、`30`、`35` | 无 |
| 房间主视区 | 看自己位置、队友、连通房间、探索目标 | `betrayal-room-board`、`betrayal-room-*` | 高频 | `basic-setup-and-turn`、攻击 / 怪物分支 | `evidence/betrayal-tutorial/03`、`09-12`、`22`、`27` | 无 |
| 观察视角切换 | 点击队友后查看该队友属性 / 状态 | `betrayal-bottom-teammate-*` | 非直觉 | `basic-setup-and-turn / observe-teammate` | `evidence/betrayal-tutorial/37-山屋惊魂-教程-观察队友视角.jpg` | 无 |
| 聚焦到我的房间 | 从观察队友或拖动画面后回到自己所在房间 | `betrayal-focus-self-room` | 非直觉 | `basic-setup-and-turn / focus-self-room` | `evidence/betrayal-tutorial/38-山屋惊魂-教程-聚焦回自己房间.jpg` | 无 |
| 发现牌与单次确认 | 处理抽牌、获得、作祟检定等同屏结果，避免把内部记录拆成多个玩家动作 | `betrayal-latest-discovery`、`betrayal-discovery-continue` | 非直觉 | `omen-confirmation-and-haunt-risk` | `evidence/betrayal-tutorial/40-山屋惊魂-教程-同屏确认预兆与作祟检定.jpg`、`42-山屋惊魂-教程-确认后回牌桌持有区.jpg`、`43-山屋惊魂-教程-确认后预兆进度条.jpg` | 无 |
| 骰盘 / 随机结算 | 显示骰子、合计、加值、可改骰入口和结果 | `betrayal-recent-roll-panel`、`betrayal-attack-roll-review`、`betrayal-exorcise-roll-review` | 高频 / 非直觉 | `basic-setup-and-turn`、`haunt-actions-and-finish` | `evidence/betrayal-tutorial/13-15`、`20-山屋惊魂-教程-驱逐木乃伊神志对抗骰盘.jpg`；旧杰克截图 `23`、`28` 只作历史参考 | 无 |
| 只读规则 / 剧本入口 | 回看参考卡、英雄目标、叛徒目标、怪物目标 | `betrayal-reference-entry`、`betrayal-open-scenario` | 非直觉 | `basic-setup-and-turn`、`haunt-actions-and-finish`、`traitor-path`、`mummy-monster-actions` | `evidence/betrayal-tutorial/04`、`18-山屋惊魂-教程-打开木乃伊剧本目标页.jpg`、`44-山屋惊魂-教程-叛徒打开木乃伊剧本目标页.jpg`；旧杰克截图 `26` 只作历史参考 | 无 |
| 交易请求 / 同意 | 选择双方持有物并等待接收方同意 | `betrayal-action-trade`、`betrayal-trade-flow-banner`、`betrayal-trade-agreement-panel` | 高频 / 非直觉 | `trade-and-agreement` | `evidence/betrayal-tutorial/29-35` | 无 |
| 作祟目标与特殊行动 | 作祟后按剧本目标执行找真名、学驱逐法术、驱逐木乃伊；叛徒帮助木乃伊完成女孩 + 圣符 / 指环目标；怪物行动按规则移动、攻击和偷取 | `betrayal-open-scenario`、`betrayal-action-use`、`betrayal-room-board`、`betrayal-action-monster*`、`betrayal-mummy-reward-banner` | 非直觉 | `haunt-actions-and-finish`、`traitor-path`、`mummy-monster-actions` | `evidence/betrayal-tutorial/17-21`、`45-47`、`49-57` | 当前只承诺默认首剧本「木乃伊横行」；更多剧本仍未承诺 |
| 终局 / 结果反馈 | 告诉玩家哪方胜利、刚才动作产生什么结果 | `betrayal-endgame-screen`、`betrayal-room-latest-feedback`、`betrayal-mummy-reward-banner` | 高频 | `haunt-actions-and-finish`、`traitor-path`、`trade-and-agreement`、`mummy-monster-actions` | `evidence/betrayal-tutorial/21-山屋惊魂-教程-驱逐木乃伊成功后的终局页.jpg`、`48-山屋惊魂-教程-木乃伊叛徒胜利.jpg`、`35`、`52`、`57`；旧杰克截图 `25` 只作历史参考 | 无 |

## 当前仍未承诺的范围

1. 更多剧本 / 更多 haunt 分支
   - 当前可见教程只承诺默认首剧本「木乃伊横行」的基础回合、预兆确认、交易、英雄驱逐木乃伊收尾、叛徒帮助木乃伊胜利链，以及木乃伊怪物移动 / 攻击 / 偷取链；旧「赤红杰克归来」英雄攻击、杰克之灵只作为隐藏历史入口，不算当前教程完整证据。

2. 完整规则书级教学
   - 当前是“6 个可见章节 + 4 个隐藏兼容 / 历史入口”的真实教程，不是把所有边界规则都塞进一次长教程。

## 当前建议

1. 继续保持“真实页面 + 真实命令 + 可见章节不重复”的教程策略，不回退到教程专用壳层。
2. 玩家链路截图必须保持游玩顺序：基础行动 -> 属性轨 / 观察 / 聚焦 / 预兆进度 -> 可探索盖着房间 / 发现牌 -> 预兆同屏单次确认 -> 作祟变化时剧本开场 -> 木乃伊目标页 -> 驱逐木乃伊前因果说明 -> 驱逐骰盘 -> 木乃伊终局；素材加载、debug、review 图只能作为技术证据，不混入全链路阶段。
3. 下一轮若扩教程，优先处理更多剧本或旧杰克兼容分支是否翻正为可见教程，不再重复基础移动 / 探索 / 驱逐 / 叛徒交付目标 / 木乃伊怪物行动。
4. 任何教程新增章节都先补重复机制归并表、玩家因果链、真实锚点与最小 E2E，再扩文案。
