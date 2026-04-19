# DiceThrone 枪手 / 武士 变体链路 E2E 证据

## 范围

- 枪手升级变体 `The Law`
- 枪手升级变体 `Pistol Whip`
- 枪手卡牌 `Wanted`
- 武士卡牌 `You Should Be Ashamed`

## 关键截图与肉眼结论

### 1. Pistol Whip 目标选择

截图：
- [18-four-player-pistol-whip-enemy-only-selection.png](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-4-player-Pistol-Whip-variant-upgraded-Fan-the-Hammer-only-offers-enemies-in-2v2-and-applies-knockdown-plus-undefe/18-four-player-pistol-whip-enemy-only-selection.png)

肉眼观察：
- 弹窗标题为“技能结算选择”，副标题为“选择本次攻击目标”，不存在乱码。
- 只显示两名敌方目标，没有出现队友选项。
- 目标卡片使用顶部头像式选择面板，而不是错误的手牌 / 弃牌区表现。

验收判断：
- 达到本轮验收标准。

### 2. Pistol Whip 结算后

截图：
- [19-four-player-pistol-whip-resolved-on-selected-enemy.png](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-4-player-Pistol-Whip-variant-upgraded-Fan-the-Hammer-only-offers-enemies-in-2v2-and-applies-knockdown-plus-undefe/19-four-player-pistol-whip-resolved-on-selected-enemy.png)

肉眼观察：
- 右上敌方目标血量从 `50` 变为 `49`。
- 目标头像下出现击倒标记；其余玩家没有被误施加该状态。
- 枪手技能板右侧展示的是升级后的 `死亡之眼 II` / `枪托击打` 组合区，不是“升级牌进弃牌堆”的视觉。

验收判断：
- 达到本轮验收标准。

### 3. The Law 1v1 结算后

截图：
- [23-the-law-variant-1v1-after-resolve.png](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/should-resolve-immediately-in-1v1-after-selecting-the-upgraded-variant/23-the-law-variant-1v1-after-resolve.png)

肉眼观察：
- 敌方头像出现 `赏金` 与 `击倒` 两个标记。
- 技能区显示 `死亡之眼 II` 复合技能，说明运行时仍把它视为升级后的技能槽，不是独立行动牌。
- 页面停在主要阶段(2)，符合 1v1 立即结算后的阶段落点。

验收判断：
- 达到本轮验收标准。

### 4. The Law 3 人多目标已选态

截图：
- [24-the-law-variant-3p-selected-targets.png](D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/dicethrone-watch-out-spotlight.e2e/should-open-multi-target-interaction-after-selecting-the-upgraded-variant-in-3-player-scene/24-the-law-variant-3p-selected-targets.png)

肉眼观察：
- 弹窗标题为“选择至多 2 名目标玩家”，当前只出现两名敌方，不出现己方。
- 左侧目标已被选中，确认按钮处于可点击状态，说明多目标交互链路完整。
- 该界面是交互层目标选择，不是 `targetingRoll` 的单目标面板。

验收判断：
- 达到本轮验收标准。

## 实际运行的验证命令

```powershell
npm run i18n:check
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-simple-start.e2e.ts "Online 4-player The Law variant"
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-simple-start.e2e.ts "Online 4-player Pistol Whip variant"
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-simple-start.e2e.ts "Online 4-player Wanted: real hand play only offers enemies in 2v2 and grants Bounty to selected enemy"
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-simple-start.e2e.ts "Online 4-player Samurai Shame card: real hand play only offers enemies in 2v2 and applies Shame to selected enemy"
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts "枪手 The Law 升级变体真实触发"
```

## 结论

- 本轮修正后，枪手升级变体的单目标 `targetingRoll` 与多目标交互层已按各自真实 UI 契约工作。
- `Pistol Whip` 目标选择弹窗的乱码已修复。
- 本轮查看到的关键截图未发现“升级牌进入弃牌堆”或“日志/技能槽仍把变体当独立手牌”的视觉残留。
