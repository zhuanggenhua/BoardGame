# 王权骰铸 Wild West 奖励骰特写 E2E 验证

## 覆盖范围
- 卡牌：`card-wild-west`
- 目标：
  - **触发时机**：打出卡牌后不会立即出现奖励骰；**当你花费 Loaded 时才触发**弹药特写奖励骰（可重掷一次）
  - 特写触发后不改主攻击骰盘
  - 结算后应在“攻击修正”UI 区域体现最终加伤
  - 无装填（Loaded=0）时应被出牌门禁阻止（requireLoaded）
- 流程（成功链路）：打出卡牌 → 花费 Loaded → 特写出现 → 点击重掷 → 特写更新 → 关闭结算 → 攻击修正 UI 可见（仅 Wild West 的 +1）
- 流程（否定链路）：Loaded=0 → 尝试打出 → toast 提示 requireLoaded → 不进入特写

## 真相源（卡面裁图）
- `Wild West / 荒野西部！`：`D:\gongzuo\webgame\BoardGame\temp\dicethrone\atlas-crops-20260411\gunslinger\slot-30.webp`
  - 卡面明确标注“攻击修正卡”，且语义为“花费 1 个装填指示物 → 可重掷此骰一次 → 然后总攻击值再增加 1”。
  - **指代裁决**：“此骰子”指 **装填奖励骰特写中的奖励骰**（不是主攻击骰盘上的 5 颗骰子）。

## 运行命令
- `npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-wild-west 应触发弹药特写奖励骰，不改攻击骰盘"`

## 运行结果
- Playwright：`1 passed`（单 worker / 单用例）

## 关键截图与观察
### 0) 打出卡牌后：攻击修正徽章应立即出现（效果提示，不代表数值已生效）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-attack-modifier-badge-pending.png`
- 观察：
  1. 徽章在“打出 Wild West”后即出现，说明 UI 已提示该攻击修正已激活。
  2. 徽章此时不显示 `+1`（`data-bonus-damage=0`），符合“徽章是效果提示，但数值只能在实际生效时写入”的口径。
- 结论：满足“攻击修正 UI 打出牌就出现”的规范要求。

### 1) 弹药奖励骰特写（可重掷提示）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-overlay.png`
- 观察：
  1. **触发时机核对**：E2E 先断言 `pendingBonusDiceSettlement === null`，随后通过“花费 Loaded”才出现本特写，证明特写**不是打出卡牌即触发**。
  2. 画面中央出现弹药奖励骰特写，提示“点击骰子花费0装填重掷”，说明当前可重掷。
  3. 右侧主攻击骰盘仍显示 1/2/3/4/5 原骰值，未进入主骰盘改骰交互。
  4. **徽章语义澄清**：攻击修正徽章可以在“打出卡牌后”作为**效果提示**出现，但 E2E 断言 `pendingAttack.attackModifierBonusDamage === null`，说明**Wild West 的“然后 +1”不会在特写阶段提前生效**（必须等奖励骰收口后才写入权威数值）。
- 结论：满足“触发特写且不改主骰盘”的阶段要求。

### 2) 重掷后特写更新
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-rerolled.png`
- 观察：
  1. 特写仍停留在奖励骰视图，提示变为“已达到本次重掷上限”，表明已完成一次重掷（可重掷次数用尽）。
  2. 主攻击骰盘仍保持原骰值序列，未触发主骰盘改骰。
  3. E2E 同时断言：特写仍打开时 `pendingAttack.attackModifierBonusDamage === null`，证明 Wild West 的“然后 +1”不会在特写阶段提前写入数值（必须等收口结算）。
- 结论：满足“改投后特写更新且不改主骰盘”的阶段要求。

### 3) 成功改投后可关闭特写
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-closed.png`
- 观察：
  1. 奖励骰特写已关闭，主战场界面恢复可见。
  2. 关闭后未出现卡死/遮罩残留，交互链路正常回收。
- 结论：满足“成功改投后可关闭特写”的验收要求。

### 4) 结算后总加伤与攻击修正加伤汇总（总 +4，但攻击修正只显示 +1）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-bonus-die-settled.png`
- 观察：
  1. 奖励骰特写已关闭，表示结算链路已收口。
  2. E2E 内部断言：
     - `pendingAttack.bonusDamage === 4`（Loaded 奖励骰半值向上取整：6→+3，再加上 Wild West 的“然后 +1”）
     - `pendingAttack.attackModifierBonusDamage === 1`（攻击修正卡汇总仅包含 Wild West 的 +1；Loaded 属于 token 效果，不应混入攻击修正卡汇总）
     - `pendingAttack.loadedBonusDieBoost === null`（收口后清空增强状态，避免下次 Loaded 被错误复用；这是典型 D39 风险点）
- 结论：证明“奖励骰结果确实汇总进总加伤”，且“攻击修正 UI 只显示 Wild West +1”的语义正确。

### 5) 攻击修正 UI 徽章可见（+1）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-应触发弹药特写奖励骰，不改攻击骰盘\gunslinger-wild-west-attack-modifier-badge.png`
- 观察：
  1. 右上角可见“攻击修正 +1”徽章，明确显示 Wild West 的卡牌加伤（不把 Loaded token 的半值加伤混进攻击修正卡汇总）。
  2. 截图中主攻击骰盘仍保持 1/2/3/4/5 原骰值，符合“不改主骰盘”的规则要求。
- 结论：回答“荒野西部是否应该显示在攻击修正里”：✅ 应显示，且当前实现已显示为 Wild West 的 +1。

### 6) 否定链路：无装填时被门禁阻止（requireLoaded）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-wild-west-无装填时应被出牌门禁阻止（requireLoaded）\gunslinger-wild-west-require-loaded-toast.png`
- 观察：
  1. 右上角 toast 提示“需要消耗 1 个装填才能打出此卡”，符合 `requireLoaded` 门禁口径。
  2. 未进入奖励骰特写（无 `bonus-die-overlay`），卡牌仍停留在手牌预览阶段。
- 结论：否定路径已覆盖，避免“只测成功链路导致漏审/误报”。 

## 总结
- 本轮截图链路完整（成功链路：触发前/改投后/关闭特写/收口；否定链路：门禁提示），符合流程截图证据链要求。
- 结论：达到本轮验收标准。
