# SmashUp 反应排序误弹窗修复（蘑菇王国 + Invisible Ninja）E2E 证据

- 日期：2026-05-06
- 范围：`smashup_reaction_choose` 不应在 `base_mushroom_kingdom` / `titan_ninjas_invisible_ninja_start_turn` 之前抢先弹出；真实交互收口后应回到 `playCards`
- 关联实现：`src/games/smashup/domain/reactionSession.ts`
- 关联测试：
  - `src/games/smashup/__tests__/reactionQueueOrdering.test.ts`
  - `src/games/smashup/__tests__/turnCycle.test.ts`
  - `e2e/smashup/smashup-base-minion-selection.e2e.ts`

## 验证命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/reactionQueueOrdering.test.ts src/games/smashup/__tests__/turnCycle.test.ts --configLoader native
$env:PW_SERVER_RUNTIME='tsx'
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "Invisible Ninja 同回合开始时"
```

## 关键截图与肉眼结论

### 1. 首帧真实交互
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序\smashup-mushroom-invisible-first-prompt.png`
- 我实际看到：顶部深色提示条直接显示“蘑菇王国：选择一个对手随从移动到蘑菇王国”，棋盘中央同时有对手随从和“跳过”按钮。
- 我实际看到：画面里没有 `smashup_reaction_choose` 那类“选择结算顺序”按钮列，也没有空弹窗或只有 emergency skip 的假交互。
- 验收判断：**达到**。这张图直接证明首帧进入的是 `base_mushroom_kingdom` 真实交互，而不是错误的排序弹窗。

### 2. 交互收口后回到可继续推进状态
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序\smashup-mushroom-invisible-resolved.png`
- 我实际看到：左上角阶段已变成“出牌阶段”，顶部不再有蘑菇王国提示条，也没有任何 `smashup_reaction_choose` / 真实交互浮层残留。
- 我实际看到：右侧出现正常的“结束回合”主按钮，说明流程已经回到可继续操作的主回合界面，而不是卡在 AI/强制跳过/排序选择上。
- 验收判断：**达到**。这张图证明开始回合的连锁交互已经完整收口，没有留下空的 mandatory reaction prompt。

## 结论

本轮修复后，这条本地反馈对应的链路已满足两条验收标准：
1. 首帧先进入真实交互，不再先弹 `smashup_reaction_choose`。
2. 真实交互处理完后，流程正常回到 `playCards`，没有 AI 卡死或只剩 emergency skip 的空提示。
