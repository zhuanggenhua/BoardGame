# DiceThrone Ninja Shuriken / Vanish 真实手牌 E2E（2026-05-17）

## 范围

- 对象：`ninja-card-shuriken / 手里剑`、`ninja-card-vanish / 雾隐`
- 真相源：`src/games/dicethrone/rule/ninja卡牌录入核对.md` 与本地卡图；Wiki 只作对照。
- 验收点：
  - `Vanish` 从真实手牌打出后消耗手牌，并获得 1 个烟雾弹。
  - `Shuriken` 在已有攻击上下文中从真实手牌打出，消耗 1CP，显示奖励骰特写；5 骰结果为 `1,2,3,4,6` 时，3 个忍刀在收口后写入 `pendingAttack.bonusDamage=3` 与 `attackModifierBonusDamage=3`。

## 运行命令

```powershell
npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者雾隐应通过真实手牌打出并获得烟雾弹"
npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正"
```

结果：两条命令均 `1 passed`。

## 截图与肉眼观察

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者雾隐应通过真实手牌打出并获得烟雾弹\01-vanish-before-drag.png`
   - 真实 Ninja 主阶段画面可见，手牌区存在 `雾隐`。
   - 左侧 token 区没有烟雾弹，能作为打出前状态对照。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者雾隐应通过真实手牌打出并获得烟雾弹\02-vanish-after-play-smoke-bomb.png`
   - `雾隐` 已离开手牌区，画面中可见烟雾弹图标反馈。
   - 断言同时验证 `smoke_bomb=1`、手牌数归零，达到本轮 `Vanish` L3 验收。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正\01-shuriken-before-drag.png`
   - 真实 Ninja 投掷阶段画面可见，手牌区存在 `手里剑`，右侧已有可结算攻击上下文。
   - CP 为 3，满足打出 1CP 攻击修正牌的前置状态。

4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正\02-shuriken-bonus-dice-overlay.png`
   - 奖励骰特写出现，能看到 5 颗奖励骰与 `手里剑` 卡牌本体。
   - 画面右上角出现攻击修正 `+3` 提示；该提示只作为 UI 反馈，权威数值以后续状态断言为准。

5. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正\03-shuriken-after-closeout-bonus-damage.png`
   - 奖励骰特写已关闭，右侧仍显示攻击修正 `+3`，手牌区不再有 `手里剑`。
   - 断言同时验证 `CP=2`、手牌数归零、`bonusDamage=3`、`attackModifierBonusDamage=3`、`pendingBonusDiceSettlement` 已清空，达到本轮 `Shuriken` L3 验收。

## 结论

- `ninja-card-vanish` 已从 L1/L2 提升到 L3：真实手牌入口、手牌消耗、烟雾弹权威状态写入均已覆盖。
- `ninja-card-shuriken` 已从 L2 提升到 L3：真实手牌入口、奖励骰特写、CP/手牌消耗、收口后攻击修正权威状态写入均已覆盖。
- 这只提升 `Vanish` 和 `Shuriken` 两张卡，不外推 `Escape`、升级卡或 Ninja 全对象完成。
