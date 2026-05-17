# DiceThrone Ninja Escape 真实手牌 E2E（2026-05-17）

## 范围

- 对象：`ninja-card-escape / 脱身`
- 真相源：`src/games/dicethrone/rule/ninja卡牌录入核对.md` 与本地卡图；Wiki 只作对照。
- 验收点：
  - 在受击 `beforeDamageReceived` 场景中构造真实 `afterAttackResolved` 响应窗，确保 `脱身` 手牌处于响应者可拖拽状态。
  - 从真实手牌打出 `脱身` 后出现奖励骰/骰子特写，骰面为手里剑时授予 2 点减伤护盾。
  - 手牌被消耗；后续通过伤害响应收口后，7 点待结算伤害被 2 点护盾抵消，Ninja HP 从 30 变为 25，`pendingDamage` 清空。

## 运行命令

```powershell
npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰"
```

结果：`1 passed`。

## 截图与肉眼观察

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\01-escape-before-drag-pending-damage.png`
   - 画面中可见 `脱身` 手牌；用例同时断言该牌 DOM 的 `data-can-drag="true"`，说明这不是只可见的摆拍卡。
   - 场景已注入 `pendingDamage.responseType=beforeDamageReceived` 与 `afterAttackResolved` 响应窗，覆盖受击响应窗入口。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\02-escape-bonus-die-overlay-detail.png`
   - 这是 `bonus-die-overlay` 元素截图，可直接看到“投掷结果”和奖励骰本体，不是只截到卡牌或外围遮罩。
   - 本轮固定骰面为手里剑；状态断言随后验证生成 2 点护盾。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\03-escape-after-closeout-shield-granted.png`
   - 奖励骰 overlay 已关闭，画面左侧可见 2 点盾值反馈。
   - 断言同时验证 `handCount=0`、`shieldValue=2`、`pendingDamage.currentDamage=7`，证明卡已从真实手牌消费，且减伤先作为护盾等待伤害收口。

4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰\04-escape-after-end-attack-damage-resolved.png`
   - 画面已经离开受击响应态，流程进入后续阶段；该图主要作为收口后的页面状态记录。
   - 权威状态断言验证 `hp=25`、`pendingDamageOpen=false`，说明 7 点伤害经 2 点护盾后实际扣 5 点。

## 结论

- `ninja-card-escape` 已从 L2 提升到 L3：真实响应窗手牌入口、可拖拽态、奖励骰本体、手牌消耗、护盾写入与伤害收口均已覆盖。
- 这只证明 `Escape` 这张响应窗卡的真实手牌链路；不能外推 Ninja 升级卡或其它未逐卡打出的专属卡。
