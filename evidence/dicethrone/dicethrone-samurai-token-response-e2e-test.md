# Dice Throne 武士 Token Response 真实点击 E2E 证据

## 范围

- `Honor`：攻击方响应窗口内连续点击两次，验证从 `+1` 累积到总计 `+3`，并在同一窗口内禁止第三次使用。
- `Back Strike / samurai_retribution`：防御方响应窗口真实点击，验证 token 消耗、额外掷骰反打、原伤害照常结算。

## 执行命令

```bash
openspec validate dicethrone-token-response --strict --no-interactive
npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "samurai (honor token|retribution token)"
npm run test:e2e:ci:file -- dicethrone-token-response-window.e2e.ts "Token 响应窗口真实入口"
npm run test:e2e:ci:file -- dicethrone-watch-out-spotlight.e2e.ts "samurai|枪手 The Law 多目标交互"
```

## 结果摘要

- `dicethrone-token-response` spec 校验通过。
- 武士 token 响应两条真实点击 E2E 通过：
  - `samurai honor token should accumulate to +3 after two real clicks`
  - `samurai retribution token should retaliate through real click flow`
- 武士 token 响应两条“真实整局入口”E2E 通过：
  - `samurai honor should open from real attack flow and resolve by two clicks`
  - `samurai back strike should open from real attack flow and retaliate on click`
- 关键交互合并回归通过：
  - 武士 `Righteousness`
  - 武士 `Zanshin`
  - 武士 `Honor`
  - 武士 `Back Strike`
  - 枪手 `The Law` 单目标确认
  - 枪手 `The Law` 双目标确认

## 关键断言

### Honor

- 首次点击后：
  - `pendingDamage.currentDamage` 从 `4` 变为 `5`
  - `pendingDamage.tokenUsageTotals.honor = 1`
- 第二次点击后：
  - 本次攻击最终伤害为 `7`
  - 对手 `hp` 从 `50` 变为 `43`
  - 事件尾部出现两次 `TOKEN_USED`，随后 `TOKEN_RESPONSE_CLOSED`
  - Samurai 仍剩 `1` 层 `Honor`，但本窗口不再允许继续点击

### Back Strike

- 点击后：
  - `samurai_retribution` 被消耗至 `0`
  - 额外掷骰事件 `bonusDie.effect.samuraiBackStrikeDie` 出现在事件流尾部
  - 原攻击者实际掉血 = `ceil(backStrikeRoll / 2)`
  - 防御方实际掉血 = `pendingDamage.currentDamage - damageShields 总值`
  - 本轮 E2E 断言跑出的稳定结果为：`backStrikeRoll = 1`、`attacker hp = 49`、`defender hp = 45`

## 2026-03-28 补充结论：真实整局入口已闭环

- `dicethrone-token-response-window.e2e.ts` 不再是“直接注入 token 响应窗口”：
  - `Honor` 从选角、开局、进攻掷骰、选技、`Defend`、防御掷骰一路推进到 token 响应窗口，再真实点击两次。
  - `Back Strike` 同样从整局真实攻击链推进到防御方响应窗口，再真实点击完成反打。
- 这轮收口还补了一条测试层稳定性修正：
  - `e2e/helpers/dicethrone.ts` 中 `maybePassResponse` 改为按宽松文本匹配 `PASS` 按钮，不再依赖过严的可访问名称完全匹配。
  - `applyDiceValues` 继续沿用 `diceRegistry` 还原真实 `symbol/symbols`，确保武士技能识别的是实际骰面而不是裸数字。
- 当前持久化截图证据仍以 `dicethrone-watch-out-spotlight.e2e.ts` 产物为准；`dicethrone-token-response-window.e2e.ts` 这轮主要提供“真实整局入口已跑通”的命令与断言证据。

## 截图证据

- `Honor` 首击前：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-honor-token-should-accumulate-to-+3-after-two-real-clicks\17-samurai-honor-before-first-use.png`
- `Honor` 首击后：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-honor-token-should-accumulate-to-+3-after-two-real-clicks\18-samurai-honor-after-first-use.png`
- `Honor` 第二击结算后：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-honor-token-should-accumulate-to-+3-after-two-real-clicks\19-samurai-honor-finalized-after-second-use.png`
- `Back Strike` 点击前：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-retribution-token-should-retaliate-through-real-click-flow\20-samurai-retribution-before-use.png`
- `Back Strike` 结算后：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-retribution-token-should-retaliate-through-real-click-flow\21-samurai-retribution-after-retaliation.png`

## 关联截图

- 武士 `Righteousness`：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-badge-after-play.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-overlay.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-bonus-die-closed.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-settled.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-righteousness-should-resolve-a-valid-branch-against-monk\09-samurai-righteousness-vs-monk.png`
- 武士 `Zanshin`：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-badge-after-play.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-overlay.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-bonus-die-closed.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-settled.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-vs-paladin.png`
- 枪手 `The Law` 单目标：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-allow-confirming-after-selecting-only-one-target\14-the-law-single-target-selected.png`
- 枪手 `The Law` 双目标选择：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-resolve-two-selected-targets-in-one-confirmation\15-the-law-two-targets-selected.png`
- 枪手 `The Law` 双目标结算：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\should-resolve-two-selected-targets-in-one-confirmation\16-the-law-two-targets-resolved.png`
