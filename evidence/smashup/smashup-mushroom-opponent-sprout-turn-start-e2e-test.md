# Smash Up：蘑菇王国面对对手幼苗不应弹结算顺序

## 问题

- 场景：当前进入玩家 0 的回合开始，场上有 `base_mushroom_kingdom`（蘑菇王国）和玩家 1 控制的 `killer_plant_sprout`（幼苗）。
- 错误现象：系统把对手幼苗的 `onTurnStart` 触发收进当前玩家的回合开始窗口，导致与蘑菇王国一起弹出 `smashup_reaction_choose` / “选择结算顺序”。
- 正确口径：幼苗是“其控制者回合开始”效果。不是当前玩家控制的幼苗，不应在当前玩家回合开始入队；蘑菇王国应直接进入自己的场上目标选择。

## 根因

- 回合边界触发收集阶段先把所有在场 `perInstance` 来源入队，再由执行函数内部判断控制者。
- 幼苗虽然执行时会检查 `controller !== ctx.playerId` 并跳过，但它已经在收集阶段污染了反应队列。
- 对于 `playerContext: 'sourceController'` 的 `onTurnStart/onTurnEnd`，必须在收集/执行入口按来源控制者过滤，而不是等回调内部返回空事件。

## 修复范围

- `src/games/smashup/domain/ongoingEffects.ts` / `e2e/src/games/smashup/domain/ongoingEffects.ts`
  - 在回合开始/结束边界，对 `playerContext: 'sourceController'` 的来源按 `located.controllerId === ctx.playerId` 过滤。
  - 非 `perInstance` 的同名来源不再固定取第一张；会先选中符合当前玩家上下文的来源，避免对手同名来源排在前面时遮蔽当前玩家来源。
- `src/games/smashup/abilities/killer_plants.ts` / `e2e/src/games/smashup/abilities/killer_plants.ts`
  - Killer Plants 中“控制者回合开始”类效果声明 `playerContext: 'sourceController'`，覆盖幼苗及同类回合开始来源。
- `src/games/smashup/__tests__/turnCycle.test.ts` / `e2e/src/games/smashup/__tests__/turnCycle.test.ts`
  - 增加对手幼苗不入队回归。
  - 增加同名 sourceController 来源应跳过对手来源并选中当前玩家来源的回归。
- `e2e/smashup/smashup-base-minion-selection.e2e.ts`
  - 增加真实 UI E2E：蘑菇王国 + 对手幼苗，确认不弹结算顺序并走场上选择。

## 验证

### 静态检查

```bash
npx eslint src/games/smashup/domain/ongoingEffects.ts src/games/smashup/abilities/killer_plants.ts src/games/smashup/__tests__/turnCycle.test.ts e2e/src/games/smashup/domain/ongoingEffects.ts e2e/src/games/smashup/abilities/killer_plants.ts e2e/src/games/smashup/__tests__/turnCycle.test.ts e2e/smashup/smashup-base-minion-selection.e2e.ts
```

结果：0 errors；仅既有 `any` / unused warning。

### 单元回归

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 -t "蘑菇王国面对对手幼苗|同名 sourceController|蘑菇王国|69feede0"
```

结果：1 个文件通过，4 passed。

### E2E

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序"
```

结果：1 passed。

补充验证对手 The Bride 泰坦同类场景：

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序"
```

结果：1 passed。

## 截图核对

1. 场上选择阶段：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序\smashup-mushroom-opponent-sprout-field-selection.png`
   - 观察：顶部提示是“蘑菇王国：选择一个对手随从移动到蘑菇王国”，不是“选择结算顺序”。
   - 观察：幼苗卡牌本体在 436-1337 工厂基地上可见，并带绿色可选高亮，说明走的是正常场上目标选择，不是单独新造弹窗流程。
   - 结论：达到本轮验收点；对手幼苗没有作为自己的回合开始触发进入排序。

2. 结算完成后：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国面对对手幼苗时，应走场上选择且不弹结算顺序\smashup-mushroom-opponent-sprout-resolved.png`
   - 观察：幼苗已移动到蘑菇王国下方，交互提示消失，右侧回合操作恢复为玩家可继续操作状态。
   - 观察：画面没有出现 `smashup_reaction_choose` / “选择结算顺序”。
   - 结论：达到收口标准；流程回到可继续推进状态。

3. 对手 The Bride 泰坦场景选择阶段：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序\smashup-mushroom-opponent-bride-field-selection.png`
   - 观察：顶部提示仍是“蘑菇王国：选择一个对手随从移动到蘑菇王国”，不是“选择结算顺序”。
   - 观察：目标随从本体在 436-1337 工厂基地上可见并有绿色可选高亮，说明 The Bride 的对手回合开始来源没有污染当前玩家排序窗口。
   - 结论：同类 sourceController 泰坦来源达到验收点。

4. 对手 The Bride 泰坦场景结算完成后：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序\smashup-mushroom-opponent-bride-resolved.png`
   - 观察：目标随从已移动到蘑菇王国下方，交互提示消失。
   - 观察：右侧“结束回合”恢复可用，画面没有出现 `smashup_reaction_choose` / “选择结算顺序”。
   - 结论：同类泰坦场景流程已收口并回到可继续推进状态。

## 剩余风险

- 本轮聚焦回合开始/结束边界的 `sourceController` 来源。其他事件型触发仍按事件玩家语义处理，不在此修复中改变。

---

# 追加：新娘泰坦（The Bride）不应在对手回合开始污染排序

## 问题

- The Bride 的回合开始 special 注册为 `global: true`。
- 旧逻辑里 global trigger 只判断“某处存在这个 defId”，没有在收集阶段按当前回合玩家过滤 source controller。
- 结果：对手牌库旁的 The Bride 会在当前玩家回合开始被收进 reaction queue；如果同窗口还有蘑菇王国，就会误弹 `smashup_reaction_choose`。

## 修复补充

- `src/games/smashup/domain/ongoingEffects.ts` / `e2e/src/games/smashup/domain/ongoingEffects.ts`
  - 新增 global source 定位：手牌 / 弃牌 / 牌库 / 泰坦来源会带上 `controllerId`。
  - 对 `global + playerContext: sourceController + onTurnStart/onTurnEnd`，在收集和执行入口先过滤来源控制者。
- `src/games/smashup/abilities/titans.ts` / `e2e/src/games/smashup/abilities/titans.ts`
  - The Bride 的 `onTurnStart` 声明 `playerContext: 'sourceController'`。

## 验证补充

### 静态检查

```bash
npx eslint src/games/smashup/domain/ongoingEffects.ts src/games/smashup/abilities/titans.ts src/games/smashup/__tests__/turnCycle.test.ts e2e/src/games/smashup/domain/ongoingEffects.ts e2e/src/games/smashup/abilities/titans.ts e2e/src/games/smashup/__tests__/turnCycle.test.ts e2e/smashup/smashup-base-minion-selection.e2e.ts
```

结果：0 errors；仅既有 warning。

### 单元回归

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 -t "新娘泰坦在对手牌库旁|蘑菇王国面对对手幼苗|同名 sourceController"
```

结果：1 个文件通过，3 passed。

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 -t "The Bride 开始回合 special"
```

结果：1 个文件通过，1 passed。说明当前玩家自己的 The Bride 仍可正常提供跳过和分支选项。

### E2E

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序"
```

结果：1 passed。

> 注：第一次 E2E 启动阶段有一次本地 runtime 子进程异常退出，重跑后通过；最终通过结果和截图来自第二次成功运行。

## 截图核对

1. 场上选择阶段：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序\smashup-mushroom-opponent-bride-field-selection.png`
   - 观察：顶部提示为“蘑菇王国：选择一个对手随从移动到蘑菇王国”，不是“选择结算顺序”。
   - 观察：场上对手 Frankenstein 随从本体可见并带绿色高亮，说明仍走正常场上目标选择。
   - 结论：对手牌库旁 The Bride 没有进入当前玩家回合开始排序。

2. 结算完成后：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国面对对手新娘泰坦时，应走场上选择且不弹结算顺序\smashup-mushroom-opponent-bride-resolved.png`
   - 观察：目标随从已移动到蘑菇王国；交互消失，右侧回合操作恢复。
   - 观察：没有出现 `smashup_reaction_choose` / “选择结算顺序”。
   - 结论：达到本轮收口标准。

---

# 追加：自己的新娘泰坦应是可选 special，不应当作强制排序

## 问题澄清

- “是我的新娘”时，不能过滤掉 The Bride；它确实属于当前玩家的回合开始 special。
- 真实问题是分类错误：The Bride 的 special 文案是“你可以”，但注册时缺少 `optional: true`，导致它作为 mandatory trigger 参与强制排序。
- 正确行为：
  1. 若同窗口有蘑菇王国这类强制触发，先直接进入蘑菇王国真实场上选择，不弹“选择结算顺序”。
  2. 蘑菇王国结算后，The Bride 仍可以作为可选反应出现，并提供“让过/跳过”路线；这不是强制排序。

## 修复补充

- `src/games/smashup/abilities/titans.ts` / `e2e/src/games/smashup/abilities/titans.ts`
  - `frankenstein_the_bride` 的 `onTurnStart` 补 `optional: true`。

## 验证补充

### 静态检查

```bash
npx eslint src/games/smashup/abilities/titans.ts e2e/src/games/smashup/abilities/titans.ts src/games/smashup/__tests__/turnCycle.test.ts e2e/src/games/smashup/__tests__/turnCycle.test.ts e2e/smashup/smashup-base-minion-selection.e2e.ts
```

结果：0 errors；仅既有 warning。

### 单元回归

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 -t "自己的新娘泰坦|新娘泰坦在对手牌库旁|蘑菇王国面对对手幼苗|同名 sourceController"
```

结果：1 个文件通过，4 passed。

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 -t "The Bride 开始回合 special"
```

结果：1 个文件通过，1 passed。

### E2E

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序"
```

结果：1 passed。

## 截图核对

1. 蘑菇王国优先进入场上选择：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序\smashup-mushroom-own-bride-field-selection.png`
   - 观察：顶部提示为“蘑菇王国：选择一个对手随从移动到蘑菇王国”。
   - 观察：可见自己的 The Bride 在左下牌库旁，但当前没有“选择结算顺序”；场上对手随从高亮可选。
   - 结论：The Bride 没有作为 mandatory 与蘑菇王国组成强制排序。

2. 蘑菇王国结算后进入可选反应：
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\反馈复现：蘑菇王国与自己的新娘泰坦同回合开始时，不应把新娘当强制排序\smashup-mushroom-own-bride-mushroom-resolved.png`
   - 观察：对手随从已移动到蘑菇王国；随后出现的是“选择一个反应动作”，选项为“新娘 / 让过”。
   - 观察：这证明 The Bride 仍可作为可选 special 询问，且有 pass 路线；不是 mandatory “选择结算顺序”。
   - 结论：达到本轮修复标准。
