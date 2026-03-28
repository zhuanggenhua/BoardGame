# DiceThrone 简单开局、4 人 2v2 与多人目标交互 E2E 证据

## 本轮覆盖范围
- 2 人联机开局链路：建房、入房、选角、准备、开局。
- 4 人联机房链路：建房、host `claim-seat`、其余 3 人 `join`、全员选角、开局。
- 4 人选角页站位链路：默认站位展示、点击空位移动、点击已占位拒绝交换。
- 4 人 2v2 战斗链路：顶部三窗、Targeting Roll 自动/手动选目标、目标面板显示与关闭、同队响应过滤、团队胜负 UI。
- 2 人多人目标交互链路：`Transfer Status` 第二阶段锁定来源卡 + 真实目标卡。
- 4 人多人目标交互链路：`Transfer Status` 在线双阶段交互、`Consecrate` 的任意玩家多 token 授予、`Vengeance II` 的任意玩家授 `Retribution`、`remove-status-1` 与 `remove-all-status` 的在线移除链路。
- 4 人 enemy-set / `allOpponents` 链路：`Meteor` 的真实联机结算只命中敌队共享生命，不会误伤队友。
- 4 人 direct-dice 链路：防守方确认骰面后，攻击方队友不进入 `responderQueue`，但仍可直接打出改骰牌并打开 `modifyDie` 交互。

## 执行命令
- `node D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\node_modules\typescript\lib\tsc.js --noEmit --pretty false`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`
- `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player remove single status: remove-status-1 can remove enemy token with stable owner metadata"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player remove all status: remove-all-status blocks empty targets and clears enemy removable effects"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI"`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player direct dice ally: teammate stays out of responder queue but can still open modify interaction"`
- `npm run test:e2e:ci -- e2e/dicethrone-simple-start.e2e.ts`

## 截图证据
- 2 人房 host 开局：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-match-Can-start-a-game-successfully\01-host-game-started.png`
- 2 人 `Transfer Status` 第二阶段目标选择：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-2-player-transfer-token-transfer-phase-keeps-locked-source-card-and-target-card\01-two-player-transfer-token-target-selection.png`
- 4 人房 host 开局：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-room-create-claim-seat-join-and-start-successfully\02-four-player-host-game-started.png`
- 4 人房站位移动：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-seating-panel-host-can-move-to-empty-slot-and-occupied-seat-is-rejected\03-four-player-seating-panel-moved.png`
- 4 人 2v2 目标面板：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-targeting-roll-auto-targets-and-choice-owners-stay-correct-in-2v2\04-four-player-target-choice-panel-host.png`
- 4 人 2v2 团队胜利：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-2v2-flow-response-queue-excludes-teammate-and-defense-chain-reaches-team-victory-UI\05-four-player-team-victory-ui.png`
- 4 人 `Transfer Status` 第二阶段目标选择：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-transfer-token-enemy-token-can-be-transferred-to-ally-with-stable-target-metadata\06-four-player-transfer-token-target-selection.png`
- 4 人 `Consecrate` 目标选择：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-grant-tokens-Consecrate-can-grant-four-tokens-to-ally-with-stable-target-metadata\07-four-player-consecrate-target-selection.png`
- 4 人 `Vengeance II` 目标选择：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-ability-grant-token-Vengeance-II-can-grant-Retribution-to-ally-with-stable-target-metadata\10-four-player-vengeance-2-target-selection.png`
- 4 人 `remove-status-1` 目标选择：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-remove-single-status-remove-status-1-can-remove-enemy-token-with-stable-owner-metadata\08-four-player-remove-single-status-selection.png`
- 4 人 `remove-all-status` 目标选择：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-remove-all-status-remove-all-status-blocks-empty-targets-and-clears-enemy-removable-effects\09-four-player-remove-all-status-selection.png`
- 4 人 `Meteor` enemy-set 结算：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-allOpponents-Meteor-collateral-only-hits-enemies-in-2v2\11-four-player-meteor-all-opponents-resolution.png`
- 4 人同队 direct-dice 交互：
  `D:\gongzuo\webgame\BoardGame-wt-dicethrone-4p-team-mode\test-results\evidence-screenshots\dicethrone-simple-start.e2e\Online-4-player-direct-dice-ally-teammate-stays-out-of-responder-queue-but-can-still-open-modify-interaction\12-four-player-direct-dice-ally-interaction.png`

## 截图分析
- `01` 证明 2 人联机主链路未被 4 人 / 2v2 改动破坏，host 已进入正式棋盘并可见掷骰区。
- `01-two-player-transfer-token-target-selection` 证明 2 人 `Transfer Status` 第二阶段也已同步吃到共享“四宫格/锁定来源卡”实现：`P2` 作为来源卡被锁定保留，`P1` 作为唯一真实目标卡显示为 `SELF`，不再是 4 人专用结构。
- `02` 证明 4 人房已成功进入正式棋盘，顶部并排出现 3 个他人窗，4 人布局生效。
- `03` 证明选角页右下 `2v2 Seating` 面板可用，移动后分队从默认的 `P1 / P3`、`P2 / P4` 更新为 `P2 / P1`、`P3 / P4`；同一用例也断言了点击已占位时会出现“禁止交换位置”的拒绝反馈。
- `04` 证明 `Targeting Roll` 的目标选择面板真实出现，面板内有 3 个纵向目标项；该用例同时断言了 `1/2` 自动锁左敌、`3/4` 自动锁右敌、`5` 由防守队选择、`6` 由进攻方选择，并检查了目标项的 `data-team-tone` 敌我标识。
- `05` 证明 2v2 主链路可落到团队胜负 UI：敌方队伍生命归零后 host 端显示 `Victory`；同一用例还在进入该画面前断言了防守方确认掷骰后响应队列只包含 `['0']`，不会把同队玩家 `2` 放进同队响应队列。
- `06` 证明 4 人 `Transfer Status` 在线双阶段交互已经闭环：第一阶段可选中敌方 `Crit` token，第二阶段现为统一四宫格，来源玩家 `P2` 保留在原位但以锁定禁用态显示，另外 `P1/P3/P4` 三张为真实可选目标；同一用例最终断言 token 从敌方 `P2` 成功转移到队友 `P3`，且队友页权威状态同步为 `crit=1`。
- `07` 证明 4 人 `Consecrate` 的任意玩家授 token 也已在线闭环：玩家选择面板可稳定区分 `self/ally/enemy` 四类候选；同一用例最终断言队友 `P3` 同时获得 `Protect/Retribution/Crit/Accuracy` 四个 token，且 host 与队友页权威状态一致。
- `10` 证明 4 人 `Vengeance II` 已从“规则层可通过”推进到真实在线闭环：该技能在 4 人 / 2v2 下不会误进 `targetingRoll`，而是停在玩家选择交互；同一用例最终断言队友 `P3` 获得 `Retribution`，证明“无单一敌方目标、无伤害、但仍需交互”的共享攻击流程已经兼容多人链路。
- `08` 证明 4 人 `remove-status-1` 已拿到在线证据：第一阶段仍按四宫格展示状态拥有者，host 选择敌方 `P2` 的 `Crit` 后，host 页与目标页最终都同步为 `crit=0`。
- `09` 证明 4 人 `remove-all-status` 已拿到在线证据：空目标会被禁用并显示 `无状态`，而敌方 `P2` 的可移除 `burn/crit` 会在确认后被全部清空；目标页需要等待权威态广播追平后再断言，不能只读 host 页。
- `11` 证明 `allOpponents` 的共享修复已经进入真实联机链路：炎术士在 4 人 / 2v2 下触发 `Meteor` 后，敌队共享生命从 `50` 一次性降到 `44`，而队友 `P3` 仍保持 `50`，说明 collateral 已按真实敌方集合结算，没有再把 ally 算进“所有对手”。
- `12` 证明 Batch 3 第一段共享收口已经进入真实联机链路：防守方确认骰面后，攻击方队友页虽然不进入 `responderQueue`，但仍可直接打出改骰牌并打开 `modifyDie` 交互，说明“response 只算敌对操作、队友 direct-dice 不算 response”的口径已经在页面与权威态两端闭环。

## 自动化结果
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts`：`14 passed`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata"`：`1 passed`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2"`：`1 passed`
- `npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online 4-player direct dice ally: teammate stays out of responder queue but can still open modify interaction"`：`1 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/rule-consistency.test.ts --configLoader native`：`31 passed`
- `$env:PW_USE_DEV_SERVERS='true'; $env:PW_START_SERVERS='false'; $env:PW_HAS_EXPLICIT_TARGET='true'; $env:NODE_OPTIONS='--max-old-space-size=4096'; $env:VITE_DEV_PORT='6174'; $env:GAME_SERVER_PORT='20000'; $env:API_SERVER_PORT='21000'; node .\node_modules\@playwright\test\cli.js test e2e/dicethrone-simple-start.e2e.ts`：`9 passed`
- 覆盖用例：
  - `Online match: Can start a game successfully`
  - `Online 2-player transfer token: transfer phase keeps locked source card and target card`
  - `Online 4-player room: create claim-seat join and start successfully`
  - `Online 4-player seating panel: host can move to empty slot and occupied seat is rejected`
  - `Online 4-player board: top headers show ally and enemy tones correctly`
  - `Online 4-player targeting roll: auto targets and choice owners stay correct in 2v2`
  - `Online 4-player transfer token: enemy token can be transferred to ally with stable target metadata`
  - `Online 4-player grant tokens: Consecrate can grant four tokens to ally with stable target metadata`
  - `Online 4-player ability grant token: Vengeance II can grant Retribution to ally with stable target metadata`
  - `Online 4-player remove single status: remove-status-1 can remove enemy token with stable owner metadata`
  - `Online 4-player remove all status: remove-all-status blocks empty targets and clears enemy removable effects`
  - `Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2`
  - `Online 4-player 2v2 flow: response queue excludes teammate and defense chain reaches team victory UI`
  - `Online 4-player direct dice ally: teammate stays out of responder queue but can still open modify interaction`

## 结论
- 本轮 E2E 已覆盖 OpenSpec `add-dicethrone-2v2-team-mode` 的在线主链路，也补上了 `update-dicethrone-4p-player-target-interactions` Batch 1 的代表性多人目标交互证据。
- DiceThrone 4 人 / 2v2 当前已具备可验证的开房、入座、选角、站位、目标投骰、目标面板、顶部三窗、同队响应过滤、团队胜负 UI 闭环。
- `Transfer Status` 这条多人目标交互主链路已经升级为 4 人在线版本，能真实证明“敌方 token -> 队友”转移在权威状态与 UI 元信息两端都成立。
- 同一套共享转移 UI 也已拿到 2 人在线证据，不再只是从 4 人截图反推 2 人必然正确。
- `Consecrate` 也已经升级为 4 人在线版本，能真实证明“任意玩家多 token 授予”不再是 2 人专用路径。
- `Vengeance II` 也已经升级为 4 人在线版本，能真实证明“无单一敌方目标、无伤害、但仍需玩家交互”的授 token 技能不会在多人模式下被共享攻击流程吞掉。
- `remove-status-1` 与 `remove-all-status` 也已拿到 4 人在线证据，说明“任意玩家移除状态/移除全部可移除状态”不再只停留在规则层或组件层。
- `Meteor` 现在也已拿到 4 人在线证据，说明 `allOpponents` 的团队感知目标集合不再只停留在规则回归层，而是已在真实联机 2v2 结算中闭环。
- 同队 direct-dice 现在也已拿到 4 人在线证据，说明“response 只算敌对操作、队友不进响应队列但可直接改骰”不再只停留在 `flow.test.ts` 规则回归层，而是已在真实联机页面中闭环。
- `Transfer Status` 的第二阶段 UI 现已回到更符合语义的四宫格：来源玩家不是被隐藏或改写成摘要，而是作为锁定来源卡保留在 4 人布局中。
