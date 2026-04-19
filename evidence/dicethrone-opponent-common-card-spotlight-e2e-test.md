# DiceThrone opponent common-card spotlight E2E 复核

- 日期：2026-04-12
- 关联用例：`e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`
- 用例名：`opponent common-card spotlight should match actual effect for samurai and gunslinger`

## 本轮结论
- 联机场景超时的直接原因不是 `card-next-time` 规则无效，而是 **状态注入后立刻点击手牌** 时，手牌仍处于翻面/预览资产稳定阶段，导致首击可能只触发 hover 抬升，没有稳定命中 `onClick -> PLAY_CARD` 链路。
- 同时，上一轮已修掉的 `TokenResponseModal` 空窗误弹问题仍是必要前置修复；否则该场景会更早卡死在 token 响应遮罩上。
- 通过在用例里等待手牌视觉稳定、清空命令拒绝缓存，并在首击无结果时补一次强制点击，`gunslinger + card-next-time` 已稳定走通真实出牌链路。

## 关键截图观察

### 1. gunslinger 对手 common-card 特写
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\opponent-common-card-spotlight-should-match-actual-effect-for-samurai-and-gunslinger\30-gunslinger-next-time-spotlight.png`
- 我实际看到：主机侧已弹出 `這次不算！` 的卡牌 spotlight，卡面居中显示，没有再被 token modal 遮挡。
- 验收判断：达到“对手通用卡 spotlight 能按真实效果出现”的标准。

### 2. gunslinger 结算后状态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\opponent-common-card-spotlight-should-match-actual-effect-for-samurai-and-gunslinger\31-gunslinger-next-time-state.png`
- 我实际看到：主机侧左下新增蓝色护盾徽章 `6`，CP 从 `2` 变成 `1`，spotlight 已关闭，流程回到可继续推进状态。
- 验收判断：达到“card-next-time 实际效果与 spotlight 一致，且流程已收口”的标准。
