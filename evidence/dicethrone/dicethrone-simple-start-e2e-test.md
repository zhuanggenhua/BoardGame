# DiceThrone 简单开局与基础多人链路 E2E 证据（已清理旧 worktree 路径）

> 本文件用于承载“简单开局/房间/站位/少量基础交互”的**可复查截图证据**。
> 4 人 2v2 的“多人目标卡牌交互”（如 The Law / Wanted / High Noon）已拆分到专门证据文档，避免本文件混杂过期截图与不同主题的断言。

## 覆盖范围（以截图证据为准）
- 2 人联机开局链路（代表性：枪手）：
  - 选角成功
  - 进入对局（开局成功）
- 4 人联机房链路：
  - 建房、host `claim-seat`、其余 3 人 `join`
  - 全员选角
  - 进入对局（第一回合画面可见）
- 4 人选角页站位交换链路：
  - 点击 AI 头像：立即交换座位
  - 点击真人头像：进入请求 UI → 对方确认 → 完成交换
- 2 人多人目标交互（Transfer Status）：
  - 第二阶段目标选择时，来源卡保持锁定且真实目标卡可见
- Meteor 目标集合/同步：
  - 2 人：不可防御伤害结算后，对手顶部 HP 同步
  - 4 人 2v2：`allOpponents` collateral 只命中敌方集合

## 运行命令（复跑入口）
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online match: Gunslinger can be selected and start a game successfully"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player room: create claim-seat join and start successfully"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player seating panel: clicking an AI portrait swaps seats immediately"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player seating panel: clicking a human portrait enters request UI and approval completes the swap"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player transfer token: transfer phase keeps locked source card and target card"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player Meteor: opponent header HP should sync after undefendable damage resolves"`
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player allOpponents: Meteor collateral only hits enemies in 2v2"`

## 关键截图与观察（绝对路径）

### 1) 2 人联机开局（枪手）
- 选角成功：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully\01-gunslinger-selection.png`
  - 观察：页面可见枪手角色卡/选中态，未出现空白/卡死。
- 进入对局（开局成功）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-match-Gunslinger-can-be-selected-and-start-a-game-successfully\02-gunslinger-game-started.png`
  - 观察：棋盘/手牌/阶段按钮可见，说明从选角到开局链路闭环。

### 2) 4 人房：创建/入座/选角/开局
- 角色选择界面（4 人）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-room-create-claim-seat-join-and-start-successfully\01-four-player-character-selection.png`
  - 观察：4 人布局已就绪，站位与选角入口同时可见。
- host 开局成功：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-room-create-claim-seat-join-and-start-successfully\02-four-player-host-game-started.png`
  - 观察：已进入对局画面，说明 4 人房间创建/加入/开始链路闭环。
- 第一回合主阶段画面可见：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-room-create-claim-seat-join-and-start-successfully\03-four-player-first-turn-main1.png`
  - 观察：阶段按钮与主要 HUD 可见，流程可继续推进。

### 3) 4 人选角页站位交换：AI 立即交换
- 交换前：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-an-AI-portrait-swaps-seats-immediately\03-four-player-seat-swap-ai-before.png`
- 交换后：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-an-AI-portrait-swaps-seats-immediately\04-four-player-seat-swap-ai-after.png`
- 观察：点击 AI 头像后座位立即变化，无需请求/审批链路。

### 4) 4 人选角页站位交换：真人请求/审批闭环
- 发起者视角（请求 UI）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap\05-four-player-seat-swap-human-requester.png`
- 被请求者视角（审批 UI）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap\06-four-player-seat-swap-human-approver.png`
- 审批后（交换完成）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap\07-four-player-seat-swap-human-approved.png`
- 观察：请求与审批是可见的两段式交互，最终座位变化落地。

### 5) 2 人 Transfer Status：第二阶段锁定来源卡且目标卡可见
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-transfer-token-transfer-phase-keeps-locked-source-card-and-target-card\01-two-player-transfer-token-target-selection.png`
- 观察：界面同时呈现锁定的“来源卡”和可选的“真实目标卡”，符合“第二阶段不要丢失来源上下文”的验收点。

### 6) 2 人 Meteor：对手顶部 HP 在不可防御伤害结算后同步
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-Meteor-opponent-header-HP-should-sync-after-undefendable-damage-resolves\03-two-player-meteor-opponent-hp-synced.png`
- 观察：结算后对手顶部 HP 与权威状态一致（避免“日志/棋盘变了但顶部 HUD 不变”的 UI 同步缺陷）。

### 7) 4 人 2v2 allOpponents：Meteor collateral 只命中敌方集合
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-allOpponents-Meteor-collateral-only-hits-enemies-in-2v2\11-four-player-meteor-all-opponents-resolution.png`
- 观察：队友未被 collateral 误伤，证明 `allOpponents` 在 2v2 下按敌对集合结算（不是“除自己外所有人”）。

## 相关证据文档（本文件不重复）
- 4 人 2v2 多人目标卡牌（含“只敌方/全目标玩家”差异）：`evidence/dicethrone/dicethrone-gunslinger-samurai-4p-targeted-cards-e2e-test.md`
- The Law 多选目标与目标集合裁决：`evidence/dicethrone/dicethrone-gunslinger-the-law-multiselect-e2e-test.md`
- Wild West（荒野西部）奖励骰特写四段式证据链：`evidence/dicethrone/dicethrone-wild-west-e2e-test.md`

