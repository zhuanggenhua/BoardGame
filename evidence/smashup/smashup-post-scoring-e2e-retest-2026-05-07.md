# SmashUp post-scoring / Tortuga 端到端复测证据

- 日期：2026-05-07
- 游戏：`smashup`
- 本轮范围：
  - 复测 `afterScoring` 响应窗口是否能正常打开并在 PASS 后收口
  - 复测 `base_tortuga` 在 `afterScoring` 选择随从后，是否真的把随从移动到替换基地
  - 复核“棋盘原位选择反馈”这层 UI 是否仍正常工作
- 关联实现：
  - [src/games/smashup/domain/systems.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/systems.ts)
  - [src/games/smashup/abilities/pirates.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/pirates.ts)
  - [src/games/smashup/abilities/aliens.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/aliens.ts)
  - [e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts)

## 验证命令

```powershell
npm run test:e2e:ci:file -- e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts "托尔图加 afterScoring 选中随从后会移动到替换基地"
npm run test:e2e:ci:file -- e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts "基地计分后 afterScoring 响应窗口正常打开"
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "基地选择：外星人入侵（第二步）- 不弹窗，直接点击基地"
```

结果：以上 3 条均通过。

## 关键截图与肉眼结论

### 1. afterScoring 响应窗口已真实打开

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\基地计分后-afterScoring-响应窗口正常打开\04-after-scoring-open.png`
- 我实际看到：
  - 中间基地上方出现“选择一个反应动作”，按钮明确包含《我们乃最强》和“让过”，说明不是直接跳过窗口，而是真的进入了 `afterScoring` 响应链。
  - 左侧基地已经显示 `+2 VP` 浮字，右上角记分板变成 `P1=2 / P2=0`，说明计分已发生，但流程还没有提前收口。
- 是否达到验收标准：达到。这张图证明本轮关心的 `afterScoring` 窗口确实被打开，而不是像之前那样提前卡住或跳过。

### 2. afterScoring PASS 后已正常收口回出牌阶段

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\基地计分后-afterScoring-响应窗口正常打开\06-final-state.png`
- 我实际看到：
  - 左上角已回到“出牌阶段”，棋盘中央不再有响应按钮或等待文案，说明窗口已经真正关掉。
  - 原本计分过的左侧基地已经被替换成新基地，棋盘上没有残留旧计分态。
- 是否达到验收标准：达到。这张图证明“全员 PASS 后正常 finalize / replace / 回到 playCards”这条链路已经收口。

### 3. Tortuga 交互已真实进入选随从阶段

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\托尔图加-afterScoring-选中随从后会移动到替换基地\tortuga-02-interaction-open.png`
- 我实际看到：
  - 画面中央明确出现“托尔图加：选择移动一个其他基地上的随从到替换基地”，不是通用占位弹窗。
  - 左侧托尔图加还在旧基地画面上，中央 `神秘花园` 上能看到待移动的 `盘旋机器人` 本体；右上角记分板为 `P1=4 / P2=3`，说明计分结果已写入，但 `Tortuga` 交互还没收口。
  - 这张图是本地单页视角，所以文案显示“正在等待 P2”；它证明的是“真实交互已打开”，不是 `P2` 视角的高亮截图。
- 是否达到验收标准：部分达到。这张图足以证明 `Tortuga` 链路已进入真实选随从交互；但它不是响应方视角，因此不能单独拿来证明响应方本地高亮样式。

### 4. Tortuga 选中后，随从确实落到替换基地

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\托尔图加-afterScoring-选中随从后会移动到替换基地\tortuga-03-moved-to-replacement-base.png`
- 我实际看到：
  - 左侧基地已经不是托尔图加，而是新的 `绿洲丛林`，其下方现在有一张 `盘旋机器人`。
  - 中间 `神秘花园` 已经没有这张 `盘旋机器人`，说明不是“交互弹过了但没真正移动”。
  - 左上角已回到“出牌阶段”，中央也没有残留 `Tortuga` 交互文案。
- 是否达到验收标准：达到。这张图直接证明用户反馈的核心问题“选择了随从但没移动到新基地”已经被修掉。

### 5. 原位选择反馈链仍正常：目标基地会高亮并能直接点击

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人入侵（第二步）-不弹窗，直接点击基地\smashup-invasion-base-highlight.png`
- 我实际看到：
  - 中间和右侧两个候选基地都有明显绿色描边，棋盘中央是“选择要移动到的基地”提示，没有额外 PromptOverlay 遮住棋盘。
  - 说明“原位高亮 + 直接点击落点”这层交互反馈仍在工作，不是只剩灰底或只剩文案。
- 是否达到验收标准：达到。这张图不能替代 `Tortuga` 规则本身，但足以证明本轮相关的基础选择反馈链没有坏掉。

## 结论

- `afterScoring` 打开与 PASS 收口：已通过 E2E 复测。
- `Tortuga` 选中随从后移动到替换基地：已通过 E2E 复测。
- 原位选择反馈链：已通过现成选择交互 E2E 复核。
- 本轮没有额外补 `Greenhouse` 专属 UI 用例；它当前仍以本轮已通过的单测链路为主要证明。
