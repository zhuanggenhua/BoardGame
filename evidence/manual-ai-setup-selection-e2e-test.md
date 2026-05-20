# 在线房间房主替 AI 做前置选择 E2E 证据

## 范围

- `SmashUp` 四人房：房主替 3 个 AI 完成派系选择并进入对局
- `SummonerWars` 双人房：房主替 AI 选择阵营并保留在开局前状态
- `DiceThrone` 双人房：房主替 AI 选择角色并保留在开局前状态

## 验证命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts src/engine/ai/__tests__/manualFactionSelection.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs ci e2e/manual-ai-setup-selection.e2e.ts
```

## 截图与结论

### SmashUp 中途接管

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\SmashUp-四人房房主可依次为-3-个-AI-完成派系选择并进入对局\smashup-manual-ai-mid-draft.png`

观察：
- 画面仍停留在真实派系选择页，没有跳回大厅，也没有空白/重连页。
- 底部玩家条显示 `P4 SmashUp-AI-3` 高亮，说明控制权已经从房主切到当前待选的 AI 座位，不再卡在前一个 seat。
- 已选与锁定派系列表同时可见，说明房主前面替其他 seat 的选择已被权威态吸收，而不是重复写回同一个 seat。

验收：
- 达标。证明四人房不会在中途出现“自动退出再进入循环”或“等待你的回合”卡死。

### SmashUp 进入对局

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\SmashUp-四人房房主可依次为-3-个-AI-完成派系选择并进入对局\smashup-manual-ai-board-started.png`

观察：
- 已进入正式棋盘，对局 HUD 和手牌区均出现。
- 右上角 4 个座位都已进入对局，没有残留未选派系 seat。
- 左上角显示正常回合提示，不再是选派系页或错误页。

验收：
- 达标。证明四人房完整选完后能稳定开局。

### SummonerWars 房主替 AI 选阵营

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\SummonerWars-在线房间房主可替-AI-选择阵营并写回-shared-state\summonerwars-manual-ai-selected.png`

观察：
- `P1` 阵营卡显示 `堕落王国`，`P2` 阵营卡显示 `欺心巫族`，两边不再都写到房主 seat。
- 右侧玩家状态区 `P2` 已显示选中状态，页面仍停留在开局前，而不是异常推进或回退。
- “开始游戏”按钮可见，说明 host 仍保有正常开局控制，而 AI 的阵营选择已写入 shared state。

验收：
- 达标。证明第二次点击不会再错误写回 `P1`。

### DiceThrone 房主替 AI 选角色

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\manual-ai-setup-selection.e2e\DiceThrone-在线房间房主可替-AI-选择角色并写回-shared-state\dicethrone-manual-ai-selected.png`

观察：
- 左侧角色列表中 `枪手` 带 `P2` 标记，`武士` 带 `P1` 标记，说明 host 与 AI 的角色分别写到了正确 seat。
- 底部状态栏显示 `P1 武士`、`P2 枪手`，且 `P2` 已显示准备勾选。
- 页面仍处于角色选择阶段，“开始游戏”按钮可见，没有被测试环境自动跳过到正式对局。

验收：
- 达标。证明在线房间里 host 替 AI 选角能命中 AI seat，而不是被自动跳过或写回自己。

## 根因结论

- `MatchRoom` 里的在线手动前置选择桥接原先在 render 时只计算一次 takeover seat；第二次及后续点击会继续吃旧闭包，导致命令仍发到前一个 seat，四人房时尤其容易在 `AI1 -> AI2 -> AI3` 切换时卡住。
- 修复后改为“点击当下按最新 shared state 重新解析目标 seat”，并让 override 子树随受控 seat 切换强制重挂，三个游戏都走同一条桥接链。

## 为什么旧 E2E 没抓到

- 旧覆盖主要停留在“建房时把 `manualFactionSelection` 写进 setupData / payload”或普通在线开局，没有真正走“进入真实在线房间后，房主连续接管多个 AI 的前置选择”这条链。
- `DiceThrone` 额外有一个测试环境陷阱：`initContext` 默认写入 `tutorial_skip=1`，而 `useAutoSkipSelection` 会在 setup 阶段自动选角/准备。这样旧测试即使进入房间，也可能直接跳过角色选择，根本没有验证 host 替 AI 选角。
- 本次新增的 `e2e/manual-ai-setup-selection.e2e.ts` 明确覆盖了 `SmashUp / SummonerWars / DiceThrone` 三条真实在线链路，并对 shared state 与最终 UI 同时做断言。
