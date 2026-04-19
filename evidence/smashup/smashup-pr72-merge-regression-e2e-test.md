# SmashUp PR72 合并回退修复 E2E 证据

## 范围

- 问题：PR72 合并后，大杀四方出现手牌选中/选中描边/直接点基地或随从出牌链路回退。
- 目标：确认以下 4 条关键交互已恢复到原有逻辑：
  1. `alien_terraform`：点手牌后进入基地直选，再进入替换基地 Prompt。
  2. `alien_supreme_overlord`：打出后直接进入随从直选。
  3. `alien_collector`：打出后只高亮力量 ≤ 3 的合法随从。
  4. `alien_invasion`：先选随从，再直接选目标基地完成移动。
- 收窄说明：
  - 本文只对这 4 条外星人链路负责。
  - 本文只根据列出的截图描述“当前可见的描边/高亮”和“链路是否推进”，不再把结果扩大为 Smash Up 全局颜色语义或全量回归结论。

## 运行命令

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts
```

结果：`7 passed`

## 本轮截图口径

- 当前截图里能直接看见的现象：
  - 手牌选中反馈是明显的描边，不再是“点击后几乎无差别”的弱反馈。
  - 基地/随从候选有明显高亮，且没有退回 `PromptOverlay` 弹窗 fallback。
- 根据现有截图更稳妥的描述：
  - 手牌选中更接近青色描边；
  - 候选基地/随从更接近紫色高亮。
- 本文不再宣称“绿色=选中/可选、金色=可用/激活”已在全局恢复；这些语义若要收口，需要额外截图与更广覆盖。

## 关键截图与肉眼结论

### 1. 地形改造：手牌选中 + 基地直选态

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人地形改造-不弹窗，直接点击基地\smashup-terraform-base-highlight.png`

观察：
- 手牌中的 `Terraforming / 适居化` 卡框有明显描边，当前截图观感更接近青色选中反馈，不再只是白色弱描边。
- 三个基地本体都有明显高亮框，当前截图观感更接近紫色候选高亮，说明当前处于“直接点基地”链路。
- 画面中没有 `PromptOverlay` 弹窗，符合本轮验收标准。

结论：达到验收标准。

### 2. 地形改造：第二步替换基地 Prompt

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人地形改造-不弹窗，直接点击基地\smashup-terraform-replacement-prompt.png`

观察：
- 第一轮基地直选后，界面进入变暗遮罩状态，并出现“从基地牌库中选择一张基地进行替换”的内容。
- 中央明确出现 2 张候选基地卡，而不是停留在无反应或错误的基础棋盘态。
- 右下角弃牌堆里可见 `Terraforming / 适居化` 已完成打出，链路已推进。

结论：达到验收标准。

### 3. 至高霸主：打出后直接选随从

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人至高霸主-不弹窗，直接点击随从\smashup-overlord-minion-highlight.png`

观察：
- 顶部出现“你可以将一个随从返回到其拥有者的手上”横幅，说明 onPlay 交互已触发。
- 基地上的目标随从本体有明显候选高亮边框，当前截图观感更接近紫色，且不是外围容器假高亮，说明“直接点随从”出口已恢复。
- 中央可见“跳过”按钮，说明该交互处于正常可操作状态，而非半残状态。

结论：达到验收标准。

### 4. 收集者：只高亮合法目标

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人收集者-不弹窗，直接点击随从\smashup-collector-minion-highlight.png`

观察：
- 顶部出现“你可以将这个基地的一个力量≤3的随从返回其拥有者的手上”横幅，说明 onPlay 交互已触发。
- 力量 2 的合法目标随从有明显候选高亮，当前截图观感更接近紫色。
- 另一张不合法目标呈灰暗态，没有被错误高亮，说明“力量≤3”过滤链路正常。

结论：达到验收标准。

### 5. 入侵：第二步基地直选态

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人入侵（第二步）-不弹窗，直接点击基地\smashup-invasion-base-highlight.png`

观察：
- 顶部出现“选择要移动到的基地”横幅，说明第一步选随从后已正确推进到第二步。
- 原基地被置灰，两个可选目标基地本体都有明显高亮，当前截图观感更接近紫色，说明是“直接点基地”交互，不是弹窗 fallback。
- 右下角弃牌堆里可见 `Invasion / 入侵` 已完成打出，链路没有卡死在手牌选中态。

结论：达到验收标准。

### 6. 入侵：移动完成后的收口态

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人入侵（第二步）-不弹窗，直接点击基地\smashup-invasion-resolved.png`

观察：
- 目标随从已经出现在新基地下方，说明第二步点击基地后状态真实落地。
- 顶部选择横幅已经消失，画面回到可继续操作的正常棋盘态。
- 没有出现“选中未清空 / 交互残留 / 仍停在错误高亮模式”的现象。

结论：达到验收标准。

## 结论

- 这批证据可以证明：上述 4 条外星人链路里，手牌选中反馈、候选目标高亮、合法目标过滤和交互收口都已恢复到“真实可见、可操作”的状态。
- 这批证据不能证明：Smash Up 全局都回到了某一套固定颜色语义，也不能代替其它派系/其它直点链路的回归验收。
