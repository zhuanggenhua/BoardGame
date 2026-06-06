# Dice Throne 武士 Honor / Shame 上限钳制真实手牌 E2E（2026-06-05）

> 2026-06-05 当前有效口径：本文只保留武士 `Honor / Shame` 在接近上限时的对象级 `L3` clamp 证据，不代表武士整英雄或四位新英雄整批当前完成态。当前若要判断武士单英雄残余、兄弟对象补审范围或整批发布口径，应以 `evidence/dicethrone/dicethrone-samurai-audit-2026-04-11.md`、`evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 与 `src/games/dicethrone/rule/武士录入核对.md` 为准。

## 范围

- 对象：
  - `card-samurai-honor` 在己方已持有 `1` 层 `Honor` 时再授予 `2` 层
  - `card-you-should-be-ashamed` 在目标已持有 `1` 层 `Shame` 时再授予 `2` 层
- 目标：
  - 验证两条链路都从真实主阶段手牌入口触发
  - 验证最终权威状态被钳到真相源上限 `2`
  - 验证不是“静态 token 定义看起来有 `stackLimit=2`”，而是真实打牌收口后仍尊重上限

## 权威来源

- `src/games/dicethrone/rule/武士真相源表.md`
- `src/games/dicethrone/rule/武士录入核对.md`
- `public/assets/i18n/zh-CN/dicethrone/images/samurai/compressed/tip.webp`
- 真相源口径：
  - `Honor` 堆叠限制 `2`
  - `Shame` 堆叠限制 `2`

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/temp-dicethrone-ability-atlas-regression.e2e.ts "samurai 荣誉与耻辱主阶段手牌在接近上限时应 clamp 到 stackLimit"
```

执行结果：
- `1 passed`

## 关键断言

- `card-samurai-honor`
  - 起手：`player0Tokens.honor = 1`
  - 打出后：`stateAfter.core.players['0'].tokens.honor === 2`
- `card-you-should-be-ashamed`
  - 起手：`player1Tokens.shame = 1`
  - 打出后：`stateAfter.core.players['1'].tokens.shame === 2`

## 截图证据

### 1. Honor clamp 收口后

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-honor-clamp-after-play.png`
- 肉眼观察：
  - 画面仍是武士主阶段真实棋盘，不是脱离业务链的单独 token 注入面板。
  - 左侧武士状态区可见 `Honor / 荣誉` token，最终没有被错误叠到 `3`。
  - 该截图对应的权威状态断言为 `tokens.honor === 2`，证明“已有 1 层再授予 2 层”最终仍被钳在上限 `2`。

### 2. Shame clamp 收口后

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-hero-ability-cards-e2e\samurai-shame-clamp-after-play.png`
- 肉眼观察：
  - 画面仍是武士主阶段真实棋盘，说明 `你真可耻！` 是从真实手牌入口打出并完成收口。
  - 对手状态区保留 `Shame / 耻辱`，最终没有被错误叠到 `3`。
  - 该截图对应的权威状态断言为 `tokens.shame === 2`，证明“目标已有 1 层再施加 2 层”最终仍被钳在上限 `2`。

## 结论

- `Honor` 与 `Shame` 现在都具备对象级 `L3` clamp 证据：
  - 真相源上限 `2`
  - 真实主阶段手牌入口
  - 收口后权威状态分别为 `2`
- 因此，武士旧 residual “`Honor / Shame` 超上限授予仍缺最终态证据”已收口。
