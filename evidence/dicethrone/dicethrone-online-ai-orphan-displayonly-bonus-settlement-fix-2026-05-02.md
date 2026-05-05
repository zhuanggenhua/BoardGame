# DiceThrone 线上孤儿 displayOnly 奖励骰残留修复（2026-05-02）

## 反馈来源

- 真实线上 `open` 单：`69f5be8c9ec13b96d710baa4`
- 游戏：`dicethrone`
- 原文：`转移状态效果和用枪手的防御技能的时候会卡死`

## 线上现场

通过生产 Mongo 只读查询确认，该条反馈落盘时的关键权威态为：

- `phase = main1`
- `currentPlayerId = 0`（human）
- `sys.interaction.current = undefined`
- `sys.responseWindow.current = undefined`
- `core.pendingAttack = null`
- `core.pendingBonusDiceSettlement.displayOnly = true`
- `core.pendingBonusDiceSettlement.attackerId = 1`（枪手，本地 AI）
- `core.pendingBonusDiceSettlement.sourceAbilityId = bounty-hunter`

这说明现场并不是仍卡在 `transfer-status` 交互，也不是仍卡在 `defensiveRoll`。
真实残留物是：AI 枪手的 `displayOnly` 奖励骰展示态已经脱离战斗链，掉进了 human 的 `main1` 主阶段。

## 根因

现有 DiceThrone AI / watchdog 对 `displayOnly` 奖励骰的处理分成了两边：

1. `src/games/dicethrone/ai.ts`
   - 故意不为 `displayOnly` settlement 生成 AI legal actions，避免把纯展示态当真实 blocker。
2. `src/engine/transport/onlineAiRecovery.ts`
   - 旧逻辑只会围绕 interaction / response window / active turn / off-turn legal-only 做恢复。
   - 当状态变成：
     - 非战斗阶段
     - 无 `pendingAttack`
     - 无 interaction
     - 无 response window
     - 但残留一个 `displayOnly` settlement，且拥有者是 AI
   - watchdog 不会再把它识别成待收口对象。

结果就是：AI 自己不会点，legal action 也不会产出这一步，残留展示态会一直挂在权威态里。

## 修复

文件：

- `src/engine/transport/onlineAiRecovery.ts`

新增一条极窄的恢复分支：

- 仅在以下条件同时满足时触发：
  - 阶段不在 `offensiveRoll / targetingRoll / defensiveRoll`
  - `pendingAttack` 已空
  - 没有可见 interaction
  - 没有 response window
  - `pendingBonusDiceSettlement.displayOnly === true`
  - settlement 拥有者是 AI
- watchdog 直接代该 AI 执行一次 `SKIP_BONUS_DICE_REROLL`

这样只清理“孤儿展示态”，不碰正常战斗中的 displayOnly 展示链，也不干扰已有的 defensiveRoll / response-window 收口。

## 回归验证

新增测试：

- `src/engine/transport/__tests__/server.test.ts`
  - `DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留`
  - `dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口`

同时复跑相关既有保护测试：

- `DiceThrone afterRollConfirmed 当前响应者为 human 时，不应回退成 active-turn-legal-only`
- `DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS`
- `online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口`

执行命令：

```bash
npx vitest run src/engine/transport/__tests__/server.test.ts -t "(DiceThrone 非战斗阶段遗留 displayOnly 奖励骰时，应直接代 AI 收口而不是放任残留|dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口|DiceThrone afterRollConfirmed 当前响应者为 human 时，不应回退成 active-turn-legal-only|DiceThrone afterCardPlayed 存在 pendingInteractionId 锁时，应优先检查 hidden interaction 而不是退成 RESPONSE_PASS|online AI watchdog 在 pendingInteractionId 锁住 response window 时，应优先执行 hidden interaction 收口)"
npm run typecheck
```

结果：

- 上述定向 vitest 通过
- `npm run typecheck` 通过

## 当前结论

这条反馈至少命中了一个真实 transport/watchdog 漏口，且该漏口现已补上。
但它的用户描述同时提到了 `transfer-status` 与“枪手防御技能”，后续若生产再出现同单，还需要继续确认是否还叠加别的链路问题。
