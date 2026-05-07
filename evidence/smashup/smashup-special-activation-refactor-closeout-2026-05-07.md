# SmashUp special / 响应窗口显式入口模型重构收口证据

- 日期：2026-05-07
- 范围：
  - `refactor-smashup-special-entry-model`
  - `refactor-smashup-special-activation-model`
  - `refactor-smashup-special-activation-semantics`
- 目标：把 SmashUp 里 `special` 的运行时入口语义从“模糊标签 + subtype 猜测”收口到显式声明；未声明但被当作响应窗口入口使用时直接报错；避免 trigger-driven printed `Special:` 被误当成可点/可打出的通用入口。

## 本轮收口结论

### 已完成的运行时收口

1. **响应窗口打牌入口统一走 helper**
   - `src/games/smashup/domain/utils.ts`
   - `src/games/smashup/domain/commands.ts`
   - `src/games/smashup/domain/reducer.ts`
   - `src/games/smashup/game.ts`
   - `src/games/smashup/Board.tsx`
   - `src/games/smashup/ui/MeFirstOverlay.tsx`

2. **`special` 不再默认等于 `beforeScoring`**
   - `special` 子类型若要进响应窗口，必须显式给出：
     - `specialTiming`
     - 或 `responseWindowTiming`
     - 或显式 manual activation metadata
   - 只有 printed `Special:`、但真实入口是 trigger / contextual / contextual-provider 的卡，不再因为 subtype 被通用响应窗口误收进来。

3. **未声明即使用时直接报错**
   - `getDeclaredActionLikeSpecialTiming()` / `getActionLikeResponseWindowTiming()` 现在会在“`subtype/actionSubtype = special` 但既没有 timing 也没有 manual activation 声明”的情况下直接 throw。
   - 这条就是本轮的“像强类型语言一样，使用前先定义”门禁。

4. **数据层已迁移到显式 timing**
   - 已迁移的 faction data 覆盖：
     - `ancient_egyptians*`
     - `cowboys*`
     - `elder_things`
     - `giant-ants*`
     - `innsmouth*`
     - `mermaids`
     - `miskatonic*`
     - `ninjas*`
     - `pirates*`
     - `princesses`
     - `samurai*`
     - `skeletons`
     - `tricksters_pod`
     - `vampires`
     - `world_champs`
   - 非 titan faction data 的 `abilityTags.special` 运行时真相已清掉，只保留注释说明。

### 剩余 `subtype === 'special'` 读点的裁定

本轮复查后，仓库里仍存在少量 `subtype === 'special'` / `actionSubtype === 'special'` 判断，但它们**不再承担“是否能进入通用响应窗口/是否能点击发动”的入口推断职责**，主要分为三类：

1. **执行器分流**
   - `domain/bury.ts`
   - `domain/duel.ts`
   - `domain/reducer.ts`
   - 用途：决定 uncovered / duel / execute 时走 `resolveSpecial` 还是 `resolveOnPlay`。

2. **普通打牌合法性提示**
   - `domain/playLegality.ts`
   - 用途：在正常出牌阶段阻止“只能在 beforeScoring/afterScoring 窗口里打出的牌”被当普通战术打出。

3. **纯展示/牌型识别**
   - `Board.tsx`
   - 个别 ability 文件中的分支
   - 用途：展示态或能力内部对 printed special 的执行分类。

结论：**剩余这些读点不是“双重真相”的旧入口推断**；真正会影响响应窗口、UI 高亮、AI 响应判定的主链已经切到显式 helper。

## 定向验证

### ESLint

```powershell
npx eslint src/games/smashup/Board.tsx e2e/src/games/smashup/Board.tsx src/games/smashup/domain/types.ts src/games/smashup/domain/utils.ts src/games/smashup/game.ts src/games/smashup/ui/MeFirstOverlay.tsx src/games/smashup/domain/commands.ts src/games/smashup/domain/playLegality.ts src/games/smashup/domain/reducer.ts src/games/smashup/ai.ts src/games/smashup/aiProfiles.ts src/games/smashup/__tests__/helpers/auditUtils.ts src/games/smashup/__tests__/ninja-acolyte-pod-consistency.test.ts src/games/smashup/__tests__/properties/coreProperties.test.ts
```

结果：0 error，只有仓库已有 warning。

### Vitest

已通过：

```powershell
npx vitest run src/games/smashup/__tests__/commandsValidation.test.ts
npx vitest run src/games/smashup/__tests__/ninja-acolyte-pod-consistency.test.ts
npx vitest run src/games/smashup/__tests__/properties/coreProperties.test.ts
npx vitest run src/games/smashup/__tests__/response-window-skip.test.ts
npx vitest run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts
npx vitest run src/games/smashup/__tests__/smashup.smoke.test.ts
npx vitest run src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts
npx vitest run src/games/smashup/__tests__/interactionChainE2E.test.ts
npx vitest run src/games/smashup/__tests__/specialInteractionChain.test.ts
npx vitest run src/games/smashup/__tests__/ui-interaction-manual.test.ts
npx vitest run src/games/smashup/__tests__/zombieInteractionChain.test.ts
npx vitest run src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts
```

补充说明：
- `coreProperties.test.ts` 中已补一条真实约束：`ninja_hidden_ninja` 若没有后续可打出的随从，不应把“选基地”误判成可执行响应。

### OpenSpec

```powershell
openspec validate refactor-smashup-special-entry-model --strict --no-interactive
openspec validate refactor-smashup-special-activation-model --strict --no-interactive
openspec validate refactor-smashup-special-activation-semantics --strict --no-interactive
```

结果：3 条变更全部 valid。

## E2E 关键截图与肉眼结论

### 1. Invisible Ninja / 蘑菇王国：首帧进入真实交互，而不是先弹结算顺序

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序\smashup-mushroom-invisible-first-prompt.png`
- 我实际看到：
  - 顶部直接是“蘑菇王国：选择一个对手随从移动到蘑菇王国”的真实提示条。
  - 中间基地下方已有可选随从本体和“跳过”按钮，没有先出现“选择结算顺序”那种假 prompt。
- 是否达到验收标准：达到。说明响应窗口/反应排序不会再抢在真实交互前面误弹。

### 2. Invisible Ninja / 蘑菇王国：交互结束后回到正常主流程

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国-+-Invisible-Ninja-同回合开始时，应直接进入真实交互，不先弹结算顺序\smashup-mushroom-invisible-resolved.png`
- 我实际看到：
  - 左上阶段已经回到“出牌阶段”。
  - 右侧有正常“结束回合”主按钮，没有残留排序弹窗、空交互或 AI 卡死。
- 是否达到验收标准：达到。说明真实交互链已收口，不会停在旧的 reaction ordering 死路。

### 3. 宗教圆环：同名随从已经进入正确的可打出高亮态

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地\smashup-sacred-circle-highlight.png`
- 我实际看到：
  - 手牌中的《本地人》本体有绿色高亮描边。
  - 棋盘上没有多余弹窗，仍是直点基地的链路。
- 是否达到验收标准：达到。说明宗教圆环发动后，正确进入“选择并继续打同名随从”的真实链路。

### 4. 宗教圆环：同名随从最终成功落场

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：宗教圆环发动后，应允许把手牌中的同名本地人打到该基地\smashup-sacred-circle-resolved.png`
- 我实际看到：
  - 巫师学院下方《本地人》数量从 3 张变成 4 张，总战力显示为 `12`，并有 `+2` 浮字。
  - 手牌里只剩 `Zapbot`，原来被高亮的《本地人》已经真正从手牌移除并打到基地。
- 是否达到验收标准：达到。说明宗教圆环链路不只是“能点”，而是完整执行到随从成功落场。

## 最终结论

本轮可以把“SmashUp special / 响应窗口显式入口模型重构”按**已收口**处理：

1. 响应窗口、UI 高亮、AI 响应判定已经统一改走显式 helper。
2. `special` 不再默认推断 timing；未声明却被当作窗口入口使用时会直接报错。
3. trigger-driven printed `Special:` 不再被误收进通用响应窗口。
4. 定向 Vitest、smoke、OpenSpec validate、关键 E2E 全部通过。

剩余可见的 `subtype === 'special'` 判断只承担执行器分流/展示分类，不再承担旧的模糊入口推断职责。
