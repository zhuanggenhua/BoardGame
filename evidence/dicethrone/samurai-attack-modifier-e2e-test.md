# Dice Throne 武士攻击修正卡 E2E 验证

> 2026-06-05 当前有效口径：本文只保留武士 `Zanshin` 单对象奖励骰攻击修正链的真实入口 `L3/L4` 证据，不代表武士整英雄或枪手/武士整批当前完成态。当前若要判断武士对象级残余、兄弟能力补审范围或整英雄口径，应以 `evidence/dicethrone/dicethrone-samurai-audit-2026-04-11.md`、`evidence/dicethrone/dicethrone-gunslinger-samurai-vs-legacy-audit-2026-04-06.md` 与 `src/games/dicethrone/rule/武士录入核对.md` 为准。

## 修订说明

- 本轮先前误把 `Righteousness` 当成用户说的“武士攻击修正那个”。
- 用户指出“不止一个骰子吧”后，已切换到真正的多骰攻击修正卡 `Zanshin` 重新验证。
- `Righteousness` 是单骰攻击修正。
- `Zanshin` 是 5 颗奖励骰攻击修正，本次对象级真实链路证据以 `Zanshin` 为准。

## 范围

- 游戏：`dicethrone`
- 英雄：`samurai`
- 攻击修正卡：`card-zanshin`
- 对手：`paladin`
- 验证目标：
  - 奖励骰特写确实是 5 颗骰子，不是单骰
  - 特写底部描述显示最终汇总效果，而不是复读卡牌原始文案
  - 当本次 5 骰结果出现 `2` 个旭日时，最终 `Back Strike / samurai_retribution` 仍只授予 `1` 层，证明真相源 `stackLimit=1` 在真实特写链里被尊重
  - 关闭特写后流程正常收口

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"
```

执行结果：通过

2026-05-17 复跑：

```bash
npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"
```

执行结果：通过，`1 passed`。本次产物位于：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\`

## 关键截图

### 1. 多骰奖励骰特写出现

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-overlay.png`

2026-05-17 复跑截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-overlay.png`

我实际看到什么：
- 特写标题为“投掷结果”。
- 画面里能直接看到 5 颗奖励骰，本体分别显示为 `1 / 4 / 6 / 6 / 1`。
- 对应脸面是 2 个武士刀、1 个头盔、2 个旭日。
- 特写底部文案现在直接写的是最终生效结果：
  `本次伤害 +2；施加 1 层耻辱；获得 1 个反击`
- 这行文案没有再出现“2 个武士刀：... / 1 个头盔：... / 2 个旭日：...”这种按骰面逐段解释的前缀。
- 这也不是 `Zanshin` 卡牌原始说明“额外掷 5 颗骰子；每个武士刀 +1 伤害、每个头盔 +1 耻辱、每个旭日 +1 反击”，而是这次实际最终落地到状态里的结果。
- 其中 2 个旭日本来可产生 2 个反击，但因为当前这次结算最终只授予 1 个反击，所以特写底部显示的是“获得 1 个反击”，不是机械复述骰面数量。

是否达到验收标准：
- 达到。已经直接证明“多骰特写 + 最终结果文案”两点。

### 2. 点击关闭特写后收口

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-closed.png`

2026-05-17 复跑截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-closed.png`

我实际看到什么：
- 5 骰特写已经关闭，不再遮挡主棋盘。
- 战斗界面恢复可见，右上角“攻击修正 +2”徽章仍在，说明攻击修正结果已进入战斗状态。
- 没有残留的奖励骰浮层。

是否达到验收标准：
- 达到。证明特写可关闭，没有卡在浮层阶段。

### 3. 收口后的稳定棋盘态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-vs-paladin.png`

2026-05-17 复跑截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-settled.png`
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-vs-paladin.png`

我实际看到什么：
- 奖励骰特写维持关闭状态。
- 主棋盘和玩家面板稳定存在，没有再次弹出奖励骰特写。
- 这一步同时断言 `pendingBonusDiceSettlement === null`，说明不是“视觉关闭但内部还挂着待结算”。

是否达到验收标准：
- 达到。说明这条 `Zanshin` 真实奖励骰链已经拿到对象级 closeout 证据，但该结论不能外推武士整英雄。

## 状态断言

- `CARD_PLAYED` 已进入事件流
- `BONUS_DIE_ROLLED` 已进入事件流，数量 `>= 5`
- `pendingBonusDiceSettlement.dice.length === 5`
- 奖励骰脸面顺序为 `['katana', 'helm', 'rising_sun', 'rising_sun', 'katana']`
- `attackModifierBonusDamage === 2`
- `bonusDamage === 2`
- `paladin` 获得 `1` 层 `shame`
- `samurai_retribution === 1`
- 关闭后 `pendingBonusDiceSettlement === null`

## 结论

- 用户指出得对，这次应该验证的是多骰攻击修正 `Zanshin`，不是单骰的 `Righteousness`。
- `Zanshin` 的真实 E2E 链路已验证通过，但本文仍只证明这张攻击修正卡的对象级链路。
- 本次固定 5 骰结果里包含 `2` 个旭日，但最终状态与特写汇总都只落成 `1` 个 `Back Strike / samurai_retribution`，因此它同时提供了武士 `samurai_retribution stackLimit=1` 的对象级 L3 clamp 证据。
- 奖励骰特写里确实是 5 颗骰子。
- 特写底部当前显示的是最终实际效果 `本次伤害 +2；施加 1 层耻辱；获得 1 个反击`，不是卡牌原始文案，也不是“2 个什么面 / 1 个什么面”的逐面汇总文案。
