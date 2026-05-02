# DiceThrone `card-dizzy` afterAttackResolved 响应链路 E2E 证据

- 测试用例：`Online 2-player afterAttackResolved: card-dizzy should be playable and inflict Concussion`
- 运行日期：`2026-05-02`
- 运行命令：`$env:VITE_CONFIG_LOADER='bundle'; $env:NODE_OPTIONS='--max-old-space-size=8192'; npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player afterAttackResolved: card-dizzy should be playable and inflict Concussion"`
- 目的：验证 2 人联机真实链路下，Barbarian 的 15 伤害攻击结算后，`card-dizzy` 会在真实 `afterAttackResolved` 响应机会中可打出；打出后目标获得 `Concussion`，响应窗收口且流程可继续推进。

## 关键截图与观察

### `06a-two-player-after-attack-dizzy-open.png`
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-card-dizzy-should-be-playable-and-inflict-Concussion\06a-two-player-after-attack-dizzy-open.png`
观察：
- 左侧阶段高亮仍在 `5. 掷骰防御阶段`，说明这张图拍的是“防御收口后的真实响应时刻”，不是伪造跳到别的阶段。
- 画面底部能直接看到 `card-dizzy` 本体，以及 `可以响应 / 略过` 两个按钮，证明 `afterAttackResolved` 响应窗已经真实打开。
- 右上目标血量是 `35`，说明前面的真实攻击 15 伤害已经结算到目标身上。
结论：
- 达到“真实攻击已结算，并且 `card-dizzy` 在正确响应时机真实出现”的验收点。

### `06b-two-player-after-attack-dizzy-played.png`
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-card-dizzy-should-be-playable-and-inflict-Concussion\06b-two-player-after-attack-dizzy-played.png`
观察：
- 左侧阶段已进入 `6. 主要阶段(2)`，说明响应动作执行后链路继续向前推进，而不是卡死在旧窗口。
- 进攻方生命从 `50` 变成 `46`，对应这次真实攻击链里的 4 点自伤也已落地，不是跳过真实战斗副作用的假链路。
- 目标头像下方已经出现红色 `Concussion` 图标，说明 `card-dizzy` 的效果已落到正确玩家。
结论：
- 达到“`card-dizzy` 可真实打出，且目标已实际拿到 `Concussion`”的验收点。

### `06c-two-player-after-attack-dizzy-resolved.png`
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-card-dizzy-should-be-playable-and-inflict-Concussion\06c-two-player-after-attack-dizzy-resolved.png`
观察：
- `可以响应 / 略过` 小面板已经消失，右下重新出现 `下一阶段` 按钮，说明响应窗已经正确关闭并回到可继续推进状态。
- 目标血量仍为 `35`，进攻方仍为 `46`，没有出现重复结算或异常回滚。
- 目标头像下的 `Concussion` 图标仍然保留，说明效果没有在收口时丢失。
结论：
- 达到“响应窗正确收口，`Concussion` 结果稳定保留”的验收点。

### `06d-two-player-after-attack-dizzy-opponent-header.png`
路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-2-player-afterAttackResolved-card-dizzy-should-be-playable-and-inflict-Concussion\06d-two-player-after-attack-dizzy-opponent-header.png`
观察：
- 这是对手顶部区域的局部图，能直接看到头像下的红色 `Concussion` 图标。
- 该局部图把结果对象单独放大，避免主图里图标过小难以复查。
结论：
- 达到“`Concussion` 确实落在目标玩家头部状态区”的复查要求。

## 最终结论

- 这条真实 E2E 已通过。
- 本轮证据链完整覆盖了三段：`afterAttackResolved` 窗口真实出现 -> `card-dizzy` 真实打出并命中目标 -> 响应窗关闭且目标保留 `Concussion`。
