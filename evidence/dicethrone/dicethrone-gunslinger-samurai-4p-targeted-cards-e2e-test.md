# DiceThrone 枪手 / 武士四人目标牌 E2E 证据

## 范围

- 枪手 `Wanted`
- 枪手 `Pistol Whip`
- 枪手 `High Noon`
- 武士 `You Should Be Ashamed`

目标不是重复覆盖 `The Law`，而是证明这两名角色剩余的“主阶段目标牌”在 4 人 `2v2` 下已经从默认对手推断改成真实选目标点击链路；同时把枪手这组牌补到三类代表性真实入口：授 `Bounty`、不可防御伤害 + `Knockdown`、bonus-die 分支结算。

> 修订说明（2026-04-12）：`Wanted` 卡面写的是“选择 1 位玩家”，当前实现与单测结论为“多人局可选全部座次玩家（包含自己）”。因此本文件对 `Wanted` 的覆盖口径已从“敌方 only”修订为“全目标可选”。（参见 `src/games/dicethrone/domain/customActions/gunslinger.ts:getWantedTargetPlayerIds` 与 `src/games/dicethrone/__tests__/cross-hero.test.ts`。）

## 执行命令

```bash
npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player Wanted: real hand play offers all target players in 2v2 and grants Bounty to selected target"
npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player Pistol Whip: real hand play only offers enemies in 2v2 and applies knockdown plus undefendable damage to selected enemy"
npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player High Noon: real hand play offers all target players in 2v2 and resolves the rolled branch on selected target"
npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player Samurai Shame card: real hand play only offers enemies in 2v2 and applies Shame to selected enemy"
npm run test:e2e:ci:file -- dicethrone-simple-start.e2e.ts "Online 4-player (Wanted|Pistol Whip|High Noon|Samurai Shame card)"
```

## 结果

- `Wanted`：`1 passed`
- `Pistol Whip`：`1 passed`
- `High Noon`：`1 passed`
- 武士耻辱牌：`1 passed`
- 组合回归：`4 passed`

## 截图

### 枪手 Wanted

- 选敌界面：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-Wanted-real-hand-play-offers-all-target-players-in-2v2-and-grants-Bounty-to-selected-target\12-four-player-wanted-all-target-selection.png`
- 结算结果：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-Wanted-real-hand-play-offers-all-target-players-in-2v2-and-grants-Bounty-to-selected-target\13-four-player-wanted-resolved-on-selected-target.png`

### 枪手 High Noon

- 选目标界面：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-High-Noon-real-hand-play-offers-all-target-players-in-2v2-and-resolves-the-rolled-branch-on-selected-tar\16-four-player-high-noon-all-target-selection.png`
- 结算结果：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-High-Noon-real-hand-play-offers-all-target-players-in-2v2-and-resolves-the-rolled-branch-on-selected-tar\17-four-player-high-noon-resolved-on-selected-target.png`

### 枪手 Pistol Whip

- 选敌界面：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-Pistol-Whip-variant-upgraded-Fan-the-Hammer-only-offers-enemies-in-2v2-and-applies-knockdown-plus-undefe\18-four-player-pistol-whip-enemy-only-selection.png`
- 结算结果：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-Pistol-Whip-variant-upgraded-Fan-the-Hammer-only-offers-enemies-in-2v2-and-applies-knockdown-plus-undefe\19-four-player-pistol-whip-resolved-on-selected-enemy.png`

### 武士耻辱牌

- 选敌界面：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-Samurai-Shame-card-real-hand-play-only-offers-enemies-in-2v2-and-applies-Shame-to-selected-enemy\14-four-player-samurai-shame-enemy-only-selection.png`
- 结算结果：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-Samurai-Shame-card-real-hand-play-only-offers-enemies-in-2v2-and-applies-Shame-to-selected-enemy\15-four-player-samurai-shame-resolved-on-selected-enemy.png`

## 断言要点

### 枪手 Wanted

- 从手牌点击后会打开 `dt:card-interaction`
- 目标卡会出现 `dt-player-target-0/1/2/3`（self + enemy + ally + enemy）
- 确认后只有被选中的目标获得 `Bounty`（其余座次保持不变）

### 枪手 High Noon

- 从手牌点击后会打开 `dt:card-interaction`
- 目标卡会出现 `dt-player-target-0/1/2/3`（self + enemy + ally + enemy）
- 确认后会真实掷出 `1` 颗 bonus die，并且结果只落到被选中的目标玩家：
  - `Bullet` → 该目标受到 `2` 点不可防御伤害
  - `Dash` → 该目标获得 `1 Knockdown`
  - `Bullseye` → 该目标获得 `1 Bounty`
- 其余未选目标（包含 self / ally / 另一名 enemy）保持不变

### 枪手 Pistol Whip

- 从手牌点击后会打开 `dt:card-interaction`
- 目标卡只出现敌方 `dt-player-target-1`、`dt-player-target-3`
- 队友 `dt-player-target-2` 不出现
- 确认后只有被选中的敌方受到 `1` 点不可防御伤害并获得 `1 Knockdown`
- 枪手自己获得 `1 Evasive`
- 其余敌方与队友保持不变，也不会错误进入防御方 token response 分支

### 武士耻辱牌

- 从手牌点击后会打开 `dt:card-interaction`
- 目标卡只出现敌方 `dt-player-target-1`、`dt-player-target-3`
- 队友 `dt-player-target-2` 不出现
- 确认后只有被选中的敌方获得 `2 Shame`

## 结论

- 枪手与武士本轮继续扫出的剩余四人目标牌，当前已拿到三条枪手、一条武士的真实联机点击证据。
- 枪手这组代表性真实入口现在分别覆盖：
  - `Wanted`：单目标授 `Bounty`
  - `Pistol Whip`：单目标不可防御伤害 + `Knockdown`
  - `High Noon`：单目标 bonus-die 分支结算
- 组合复跑 `Online 4-player (Wanted|Pistol Whip|High Noon|Samurai Shame card)` 已通过 `4 passed`，说明这组四人 `2v2` 目标牌不只是单条偶发通过，而是能作为当前角色级验收口径下的一组代表性真实入口证据。
