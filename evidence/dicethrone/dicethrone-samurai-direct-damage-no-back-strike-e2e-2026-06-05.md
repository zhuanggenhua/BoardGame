# Dice Throne 武士 Back Strike 对非攻击 direct damage 不开窗 E2E（2026-06-05）

> 2026-06-05 当前有效口径：本文只保留武士 `Back Strike / samurai_retribution` 对非攻击 `direct damage` 不应开响应窗的对象级 `L3` 证据，不代表武士整英雄或四位新英雄整批当前完成态。当前若要判断武士单英雄残余、兄弟对象补审范围或整批发布口径，应以 `evidence/dicethrone/dicethrone-samurai-audit-2026-04-11.md`、`evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 与 `src/games/dicethrone/rule/武士录入核对.md` 为准。

## 范围

- 对象：
  - 武士 `Back Strike / samurai_retribution`
  - 忍者 `刀扇 / Knife Fan`
- 目标：
  - 验证 `Back Strike` 的 attack-only 门禁不是停留在静态定义或单测断言
  - 验证真实在线双页业务链里，`direct damage` 进入武士时不会错误打开 token 响应窗
  - 验证该负路径收口后，武士血量正常结算、`samurai_retribution` 不被误消耗

## 权威来源

- `src/games/dicethrone/rule/武士录入核对.md`
- `src/games/dicethrone/rule/王权骰铸规则.md`
- `src/games/dicethrone/heroes/ninja/cards.ts`
- 真相源口径：
  - `Back Strike / samurai_retribution` 仅在“受攻击时”可用
  - `Knife Fan` 造成的是非攻击 `direct damage`

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "online ninja knife fan should not open samurai retribution response window on direct damage"
```

执行结果：
- `1 passed`

## 关键断言

- 真实业务链：
  - 在线双页对局
  - `hostPage` 选武士
  - `guestPage` 选忍者
  - 武士预置 `samurai_retribution = 1`
  - 忍者从真实手牌打出 `ninja-card-knife-fan`
- 收口后：
  - 武士 `HP: 50 -> 49`
  - 武士 `samurai_retribution === 1`
  - `pendingDamage === null`
  - `responseWindow.current === null`
  - `interaction.current === null`
  - 最近一条 `DAMAGE_DEALT.payload.damageScope === 'direct'`
  - 页面上不出现 `token-response-modal`

## 截图证据

### 1. 打出前

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-ninja-knife-fan-should-not-open-samurai-retribution-response-window-on-direct-damage\32-online-ninja-knife-fan-before-play.png`
- 肉眼观察：
  - 画面是在线双页真实对局，不是直接注入 token 响应窗的测试夹具。
  - 忍者手牌区可见 `刀扇 / Knife Fan`，武士状态区保留 `Back Strike / 反击`。
  - 此时尚未出现武士 token 响应弹窗。

### 2. 结算后

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\online-ninja-knife-fan-should-not-open-samurai-retribution-response-window-on-direct-damage\33-online-samurai-no-back-strike-on-direct-damage.png`
- 肉眼观察：
  - `Knife Fan` 已完成结算，武士页面没有出现 `Back Strike` 响应窗。
  - 武士状态区仍保留 `Back Strike / 反击`，说明没有被错误消费。
  - 该截图对应的权威状态断言为：`hp === 49`、`samurai_retribution === 1`、`lastDamageScope === 'direct'`，证明“非攻击 direct damage 不开窗”已通过真实业务链锁死。

## 结论

- 武士 `Back Strike` 现在具备对象级 `L3` 负路径证据：
  - 真相源要求 attack-only
  - 忍者 `Knife Fan` 真实手牌入口
  - 在线双页真实业务链
  - 收口后未开窗、未误消耗、血量正常结算
- 因此，武士旧 residual “`Back Strike` 对非攻击 `direct damage` 仍缺专属真实业务链”已收口。
