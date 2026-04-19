# SmashUp 选中描边 / 直接点击打出链路 E2E 证据

## 范围
- 手牌选中后是否重新出现明确描边反馈
- 需要选基地/选随从的卡牌是否恢复真实点击链路
- 当前截图里的选中 / 可选反馈是否清晰可见
- PR72 合并后被静默吃回的 SmashUp Board 交互是否已恢复
- 收窄说明：
  - 本文主要展开外星人 4 条链路的截图观察。
  - runner 虽然一次跑过 7 个用例，但未在本文逐张给出截图的其它用例，不再拿来宣称统一视觉语义已经全量恢复。

## 本轮验证命令
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts`
- 结果：`7 passed`

## 关键截图与肉眼结论

### 1. 地形改造：手牌选中描边
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人地形改造-不弹窗，直接点击基地\smashup-terraform-card-selected.png`
- 我实际看到：`Terraform / 适居化` 这张手牌外侧有明显描边，当前截图观感更接近青色选中反馈；卡牌本体清晰可见，不是只有默认白边。
- 验收判断：**达标**。这证明“点手牌后有明确选中反馈”已经恢复；但仅凭这张图，不足以下全局颜色语义结论。

### 2. 地形改造：选基地阶段高亮
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人地形改造-不弹窗，直接点击基地\smashup-terraform-base-highlight.png`
- 我实际看到：底部手牌仍保持明显选中描边；上方 3 个基地本体都出现明显高亮边框，当前截图观感更接近紫色候选高亮，说明“点手牌 → 进入可点基地目标态”链路已恢复。
- 验收判断：**达标**。这张图能证明“可选目标高亮存在且可见”，但不能证明所有场景都统一为某个固定颜色。

### 3. 至高霸主：选随从阶段高亮
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人至高霸主-不弹窗，直接点击随从\smashup-overlord-minion-highlight.png`
- 我实际看到：顶部出现“你可以将一个随从返回到其拥有者的手上”横幅；基地下方候选随从本体带明显高亮，当前截图观感更接近紫色，且“跳过”按钮同时存在。
- 验收判断：**达标**。这证明“打出随从后进入直接点随从选择”的真实 UI 链路已恢复。

### 4. 收集者：只高亮合法随从
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人收集者-不弹窗，直接点击随从\smashup-collector-minion-highlight.png`
- 我实际看到：顶部提示要求选择力量≤3的随从；合法目标随从本体带明显高亮，旁边不合法目标是灰暗态，没有被误高亮。
- 验收判断：**达标**。这证明过滤链路仍然正确，没有把所有随从都错误刷亮。

### 5. 入侵：第二步基地高亮与收口
- 高亮路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人入侵（第二步）-不弹窗，直接点击基地\smashup-invasion-base-highlight.png`
- 收口路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人入侵（第二步）-不弹窗，直接点击基地\smashup-invasion-resolved.png`
- 我实际看到：第二步里原基地被置灰，两个可移动目标基地本体有明显候选高亮；完成点击后，顶部提示消失，随从已落到目标基地，候选高亮全部清空。
- 验收判断：**达标**。这证明候选高亮在交互收口后能正确消失，没有残留错误高亮。

## 结论
- 本轮 runner 通过了 7 个用例，但本文实际展开截图验收的仍是外星人 4 条链路；其余用例若要作为视觉收口证据，仍需各自截图或独立 evidence。
- 结合本文截图，当前可以确认：
  1. 手牌选中描边重新变得清晰可见；
  2. 基地/随从候选高亮重新变得清晰可见；
  3. 可选目标过滤与交互收口仍正常；
  4. 本轮问题位点已达到验收标准。
- 仅凭本文截图，不能确认：
  1. Smash Up 全局已经统一回某一套固定颜色语义；
  2. 其它派系、其它交互链路都已完成同等级视觉验收。
