# Dice Throne 枪手基础 Loaded 真实选择单骰特写证据（2026-05-17）

> 2026-06-05 当前有效口径：本文只保留枪手基础 `Loaded` 奖励骰链路的对象级 `L2/L3` 证据，不代表枪手整英雄或四位新英雄整批当前完成态。当前若要判断枪手单英雄残余、兄弟对象补审范围或整批发布口径，应以 `evidence/dicethrone/dicethrone-gunslinger-audit-2026-04-11.md`、`evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 与 `src/games/dicethrone/rule/枪手录入核对.md` 为准。

## 范围

- 对象：枪手提示板状态 `Loaded / 装填`
- 目标：
  - 验证攻击掷骰结束后的真实选择入口，点击 `Loaded` 后会进入单骰奖励骰特写，而不是直接改主骰盘。
  - 验证 `Loaded` 从 `1 -> 0` 被正确消耗。
  - 验证进入 `defensiveRoll` 时，`pendingBonusDiceSettlement` 为 `displayOnly` 单骰特写，且使用枪手基础 `Loaded` 的效果文案。
  - 验证基础 `Loaded` 的半值向上取整加伤已有 L2 行为断言，不与 Wild West / Quick Draw II / Fill'Em With Lead 的额外语义混审。

## 权威来源

- `src/games/dicethrone/rule/枪手真相源表.md`
- `src/games/dicethrone/rule/枪手录入核对.md`
- `public/assets/i18n/zh-CN/dicethrone/images/gunslinger/compressed/tip.webp`
- 图片/录入核对优先于 Wiki；本文不使用 Quick Draw II / Fill'Em With Lead 的额外重掷语义替代基础 `Loaded` 对象本体结论。

## 证据组成

### L2：行为测试

- 文件：`src/games/dicethrone/__tests__/cross-hero.test.ts`
- 用例：`base loaded choice should create single-die display settlement and add rounded damage`
- 关键断言：
  - `result.finalState.core.players['0'].tokens.loaded === 0`
  - `result.finalState.core.pendingAttack?.sourceAbilityId === 'revolver-3'`
  - `result.finalState.core.pendingAttack?.bonusDamage === 1`
  - `result.finalState.core.pendingBonusDiceSettlement?.displayOnly === true`
  - `result.finalState.core.pendingBonusDiceSettlement?.dice[0]?.effectKey === 'bonusDie.effect.gunslingerLoadedDie'`

结论：
- 基础 `Loaded` 的权威状态链已经覆盖到“真实技能来源 + 消耗 token + 单骰特写 + 半值向上取整加伤”。

### L3：真实入口 E2E

- 文件：`e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`
- 用例：`gunslinger loaded token should open single-die spotlight after real choice click`
- 历史执行命令：

```bash
npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "gunslinger loaded token should open single-die spotlight after real choice click"
```

- 历史结果：`1 passed`

关键状态断言：
- `loaded === 0`
- `hasChoice === false`
- `phase === 'defensiveRoll'`
- `settlement.diceCount === 1`
- `settlement.displayOnly === true`
- `settlement.rerollCostTokenId === ''`
- `settlement.effectKey === 'bonusDie.effect.gunslingerLoadedDie'`

## 截图证据

- 触发前：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\20-gunslinger-loaded-choice-before-use.png`
  - 肉眼观察：真实战斗页面中可见枪手 `Loaded / 装填` token，说明当前不是注入特写中间态，而是从真实选择入口准备触发。
- 点击后：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\21-gunslinger-loaded-after-choice-click.png`
  - 肉眼观察：点击 `Loaded` 后页面已切到奖励骰特写前后态，证明 token 使用动作确实来自真实 UI，而不是仅靠测试层直接改状态。
- 单骰特写：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\22-gunslinger-loaded-single-die-spotlight.png`
  - 肉眼观察：页面中央出现单骰奖励骰特写，右侧可见奖励骰/效果文案区域，符合基础 `Loaded` 的 display-only 单骰结算口径。
  - 肉眼观察：该链路没有进入 Quick Draw II / Fill'Em With Lead 的“可再次花费装填重投”语义，说明本文覆盖的是基础 `Loaded` 本体，而不是升级/终极技来源的附加条款。

## 结论

- 基础 `Loaded` 现在已经具备：
  - `L2`：权威状态断言，证明半值向上取整加伤与 `displayOnly` 单骰特写合同成立；
  - `L3`：真实选择入口、消耗 `Loaded`、进入单骰特写的截图链。
- 因此，枪手旧 residual “基础 `Loaded` 奖励骰缺少单独 evidence 文档化”已收口；后续不应再把这条缺口写成枪手对象级未完成项。
