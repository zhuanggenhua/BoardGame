# Smash Up OR 分支升级 E2E 证据（2026-05-01 / 2026-05-02复核更新）

## 范围说明

- 本轮要证明的不是“仙灵泰坦单卡特判”，而是 **Smash Up 通用 OR 升级语义**：
  1. 先选一个分支；
  2. 先执行该分支；
  3. 若 `Spirit of the Forest` 可升级为双执行，再给出 **剩余分支 + 跳过**。
- 代表链路：
  - `fairies_titania`：**分支选择 → 场上直点随从 → 剩余分支 + 跳过**
  - `base_fairy_ring`：**纯按钮 OR 分支的串行补选**

## 实际运行

### Vitest

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "fairies_titania|fairies_puck|fairies_enchantment|base_fairy_ring"
```

结果：`8 passed`

### E2E（正常 Titania / Fairy Ring 串行链路）

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Fairies OR 分支"
```

结果：`2 passed`

### E2E（same-frame 插队交互门控）

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-gameplay.e2e.ts "Fairies OR 分支：同 frame 插队交互会先于剩余分支收口"
```

结果：`1 passed`

---

## 证据一：Titania 已改回正常“场上直点随从”，不是新造 PromptOverlay 选卡

### 截图 1：第一步只选分支，不混入具体目标
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过\fairies-titania-branch-prompt-visible.png`
- 我实际看到：
  - 画面中央只有两个按钮：`额外打出一个随从`、`将一个随从移回其拥有者手牌`。
  - 棋盘上仍只是正常场面，没有把 `大副` / `Titania` 做成一排卡片选项塞进中央弹层。
- 验收判断：
  - **达到验收标准。**
  - 这证明第一步语义就是“选执行哪个效果”，不是一开始就把目标卡混进来。

### 截图 2：进入回手分支后，目标选择走场上直点
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过\fairies-titania-target-prompt-visible.png`
- 我实际看到：
  - 中央 **没有** PromptOverlay 卡片列表。
  - 画面顶部是提示条：`Titania：选择一个要移回其拥有者手牌的随从`。
  - 棋盘上仍正常显示 `Titania` 和 `First Mate` 两个随从本体；这里“两个都看得到”是因为它们都还在场上，不是“两个并排做成选项卡”。
- 验收判断：
  - **达到验收标准。**
  - 这证明 Titania 的第二步已经改回正常的 **场上直点随从交互**，不是新造一套 generic 选卡弹层。

### 截图 3：回手执行后，才出现“剩余分支 + 跳过”
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过\fairies-titania-follow-up-prompt-visible.png`
- 我实际看到：
  - `First Mate` 已经不在母舰基地，只剩 `Titania` 留在场上。
  - 中央 prompt 只剩 `额外打出一个随从` 和 `跳过`。
  - 不再出现“选择一个要移回其拥有者手牌的随从”的目标选择态。
- 验收判断：
  - **达到验收标准。**
  - 这证明链路顺序已经是：**先执行回手 → 再给剩余分支 + 跳过**，不是一开始顺序编号多选。

### 截图 4：最终收口后，回手与额外随从额度都已生效
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：Titania-会先执行已选分支，再给剩余分支与跳过\fairies-titania-sequential-resolved.png`
- 我实际看到：
  - 母舰基地上只剩 `Titania`，`First Mate` 没有留在场上。
  - 右下角额外随从额度显示为 `随从 1`，说明第二边“额外打出一个随从”已经授予。
  - 中央 prompt 已关闭，流程已经回到正常棋盘态。
- 验收判断：
  - **达到验收标准。**
  - 这证明 Titania 的完整链路已收口：**分支选择 → 场上直点回手 → 剩余分支/跳过 → 最终结果落地**。

---

## 证据二：Fairy Ring 同样遵循通用串行补选语义

### 截图 1：首次 prompt 是 OR 分支入口
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：Fairy-Ring-单分支确认会先执行该分支，再允许跳过剩余分支\fairy-ring-branch-prompt-visible.png`
- 我实际看到：
  - 中央提供 `额外打出一个随从到这里`、`额外打出一张行动卡`、`跳过`。
  - 这是标准的“先选执行哪一个分支”的入口。
- 验收判断：
  - **达到验收标准。**

### 截图 2：先执行行动分支后，才出现剩余分支与跳过
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：Fairy-Ring-单分支确认会先执行该分支，再允许跳过剩余分支\fairy-ring-follow-up-prompt-visible.png`
- 我实际看到：
  - 右下角额外行动额度已经变成 `行动 2`，说明第一边已经先执行。
  - 中央现在只剩 `额外打出一个随从到这里` 和 `跳过`。
  - 原来的 `额外打出一张行动卡` 不再重复出现。
- 验收判断：
  - **达到验收标准。**
  - 这证明 Fairy Ring 也不是“一次性把两边顺序挑完再统一结算”。

### 截图 3：选择跳过后，不会偷偷执行剩余分支
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：Fairy-Ring-单分支确认会先执行该分支，再允许跳过剩余分支\fairy-ring-sequential-resolved.png`
- 我实际看到：
  - 中央 prompt 已关闭。
  - 右下角仍然只有 `行动 2`，没有额外出现随从额度。
  - 棋盘状态已经收口，没有残留第二个分支的半完成交互。
- 验收判断：
  - **达到验收标准。**

---

## 证据三：same-frame 插队交互会挡住剩余分支，直到插队交互自己收口

> 这一组不是拿来冒充“真实回手触发器已经完整接进来了”，而是专门验证 **resolution frame gating**：
> - 正常 Titania 链路由“证据一”证明：**先执行已选分支，再出现剩余分支**；
> - 这一组额外证明：**只要同一个 frame 里还挂着插队交互，剩余分支不能抢先弹出来**。
> - 场景通过 test harness 把一个 `synthetic_inserted` simple-choice 注入到 Titania 当前 frame，目的是验证控制流门禁，不是假装它就是某张真实卡的 returned-to-hand 效果。

### 截图 1：注入 same-frame 插队交互后，界面先显示插队交互本体
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：同-frame-插队交互会先于剩余分支收口\fairies-titania-inserted-interaction-visible.png`
- 我实际看到：
  - 画面中央是一个黑底小弹层，标题是 `模拟返回时插队交互`。
  - 这一步只有一个 `跳过` 按钮。
  - 画面上 **还看不到** `额外打出一个随从` 这个剩余分支按钮。
- 验收判断：
  - **达到验收标准。**
  - 这证明只要 same-frame 插队交互还活着，第二边不会抢先出现。

### 截图 2：插队交互关闭后，才恢复 Titania 的剩余分支 + 跳过
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：同-frame-插队交互会先于剩余分支收口\fairies-titania-follow-up-after-inserted-visible.png`
- 我实际看到：
  - 中央 prompt 已经从 `模拟返回时插队交互` 切换回 Titania 的 follow-up。
  - 现在可见的按钮是 `额外打出一个随从` 和 `跳过`。
  - 原先的插队交互按钮不再停留在界面上。
- 验收判断：
  - **达到验收标准。**
  - 这证明恢复顺序正确：**先收口插队交互，再恢复 OR 的剩余分支**。

### 截图 3：执行剩余分支后，prompt 收口且额外随从额度落地
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\Fairies-OR-分支：同-frame-插队交互会先于剩余分支收口\fairies-titania-inserted-interaction-resolved.png`
- 我实际看到：
  - 中央 prompt 已经关闭，界面回到正常棋盘态。
  - 右下角资源区显示 `随从 1`，说明剩余分支“额外打出一个随从”已经实际生效。
  - `First Mate` 仍在场上；这是因为这组 synthetic gating 场景只验证 **插队交互门控 + 剩余分支恢复**，不是用来重复证明真实回手结果。真实回手已经由“证据一”的 Titania 正常链路证明。
- 验收判断：
  - **达到验收标准。**
  - 这证明插队交互收口后，剩余分支可以继续执行并最终正常收口，没有残留半完成 frame / prompt。

---

## 本轮结论

- Titania 之前接错成 `targetType: 'generic'` 的问题，本轮已经改回：
  - `targetType: 'minion'`
  - 使用正常 **场上直点随从** 链路
- Fairy Ring 证明这不是单卡修补，而是 **通用 OR 升级语义** 已统一改成串行补选。
- same-frame synthetic gating 进一步证明：**剩余分支的恢复点已经从“旧 prompt 一结束”提升为“整条 resolution frame 真正空闲以后”**。
- 因此本轮可以成立的对外交付口径是：
  - **Smash Up 的 OR 升级交互已经重构为“先选分支 → 先执行 → 再给剩余分支 + 跳过”**
  - **Titania 的目标选择已经恢复为正常场上交互，不再使用新造的 generic PromptOverlay 选卡方式**
  - **若第一边过程里同一 frame 还有插队交互 / response / child prompt，第二边会等待这些东西先收口，不会提前弹出**
