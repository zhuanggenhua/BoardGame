# SmashUp base ability effect contract 收口后反应排序 E2E 证据

- 日期：2026-05-08
- 范围：queued base ability / extended base ability 恢复严格 `effectContract` 后，复核真实 UI 链路中“应显示顺序选择”和“不应显示顺序选择”的分流。
- 关联实现：
  - `src/games/smashup/domain/baseAbilityQueue.ts`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `src/games/smashup/domain/reactionOrdering.ts`
  - `src/games/smashup/domain/triggerEffectContract.ts`
- 关联 E2E：
  - `e2e/smashup/smashup-multi-base-scoring-complete.e2e.ts`
  - `e2e/smashup/smashup-base-minion-selection.e2e.ts`

## 验证命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-multi-base-scoring-complete.e2e.ts
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国"
```

结果：

- `smashup-multi-base-scoring-complete.e2e.ts`：1 passed
- `smashup-base-minion-selection.e2e.ts` 中“反馈复现：蘑菇王国 + Invisible Ninja...”：1 passed

## 关键截图与肉眼结论

### 1. 应显示顺序选择：多基地同时可计分

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-multi-base-scoring-complete.e2e\第二次排序选择后，最后一个基地应自动结算且只结算一次\multi-base-auto-finish-first-choice.png`
- 我实际看到：顶部提示条显示“选择先计分的基地”，三个达标基地都有绿色高亮边框和绿色分数徽章。
- 我实际看到：这是基地计分顺序选择本体，不是空的强制跳过弹窗，也不是普通单基地交互。
- 验收判断：**达到**。多基地同时达标时仍会进入真实的先计分选择界面。

### 2. 不应显示顺序选择：蘑菇王国 + Invisible Ninja 同回合开始

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序\smashup-mushroom-invisible-first-prompt.png`
- 我实际看到：顶部提示条直接显示“蘑菇王国：选择一个对手随从移动到蘑菇王国”，棋盘中有可选随从和“跳过”按钮。
- 我实际看到：画面没有 `smashup_reaction_choose` 对应的结算顺序按钮列，也没有先让玩家在两个反应之间排序。
- 验收判断：**达到**。无冲突且会打开真实交互的 mandatory 链路，首帧直接进入真实交互。

### 3. 不应显示顺序选择：交互收口后状态

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序\smashup-mushroom-invisible-resolved.png`
- 我实际看到：左上角阶段为“出牌阶段”，顶部没有蘑菇王国提示条，也没有排序或真实交互浮层残留。
- 我实际看到：右侧正常出现“结束回合”按钮和额度徽章，表示流程已回到可继续推进的回合主界面。
- 验收判断：**达到**。真实交互链收口后没有卡在排序选择或空交互状态。

## 结论

严格 `effectContract` 收口后，两类 UI 分流均通过真实 E2E 验证：

1. 多个基地同时达标计分时，仍显示“选择先计分的基地”。
2. 蘑菇王国与 Invisible Ninja 同回合开始触发时，不先弹 `smashup_reaction_choose`，而是直接进入蘑菇王国真实交互。
