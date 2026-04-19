# SmashUp 外星人目标直点交互 E2E 证据

## 范围
- 文件：`e2e/smashup/smashup-base-minion-selection.e2e.ts`
- 目标：
  - `alien_terraform` 基地直点链路
  - `alien_supreme_overlord` 随从直点链路
  - `alien_collector` 力量≤3随从直点链路
  - `alien_invasion` 第二步选基地直点链路
- 口径收窄：
  - 本文只描述上述 4 条外星人链路在截图里肉眼可见的选中/候选高亮与交互推进情况。
  - 本文不再把这些截图外推成 Smash Up 全局颜色语义、全部直点链路或其它派系的统一结论。

## 本轮修复点
1. 外星人目标行动卡补齐 `playNeedsBase / playNeedsMinion` 数据接线。
2. `actionLikeNeedsPlayBase()` 不再把 `playNeedsMinion` 行动误判成基地目标模式。
3. E2E 注入时清空残留 `starting_hand_mulligan` 交互。
4. E2E 点击 helper 改为真实 DOM click，避免重叠卡面拦截导致的“点击无反应”假失败。
5. 旧的 interaction 链单测同步更新为当前契约。

## 验证命令
```powershell
npm run typecheck
npx vitest run src/games/smashup/__tests__/interactionChainE2E.test.ts -t "alien_invasion|alien_terraform"
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "基地选择：外星人地形改造 - 不弹窗，直接点击基地"
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "随从选择：外星人至高霸主 - 不弹窗，直接点击随从"
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "随从选择：外星人收集者 - 不弹窗，直接点击随从"
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-base-minion-selection.e2e.ts "基地选择：外星人入侵（第二步）- 不弹窗，直接点击基地"
```

## 截图与肉眼结论

### 1) Terraform 基地高亮
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人地形改造-不弹窗，直接点击基地\smashup-terraform-base-highlight.png`

肉眼观察：
- 手牌中的 Terraform 卡带有青色选中描边，说明卡牌已进入待打出状态，而不是只剩 hover 白边。
- 三个基地卡框都有明显紫色高亮，说明“可选基地”状态已真实渲染到基地本体。
- 画面中没有 `prompt-overlay` 弹窗，符合“直接点基地而不是先弹窗”的验收口径。

结论：达到验收标准。

### 2) Terraform 替换基地第二步
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人地形改造-不弹窗，直接点击基地\smashup-terraform-replacement-prompt.png`

肉眼观察：
- 顶部中央出现“地形改造：从基地牌库中选择一张基地进行替换”的真实提示，不再卡在第一步。
- 下方出现两张可选替换基地卡，说明交互已经推进到 `alien_terraform_choose_replacement`。
- 手牌区右下仍能看到 Terraform 已进入弃牌堆，说明行动卡已成功打出并进入后续结算链。

结论：达到验收标准。

### 3) Supreme Overlord 随从可选与收口
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人至高霸主-不弹窗，直接点击随从\smashup-overlord-minion-highlight.png`

肉眼观察：
- 顶部提示条显示“你可以将一个随从返回到其拥有者的手上”，表明已经进入正确技能交互。
- 基地上的目标随从卡框有紫色高亮，直接证明“可选随从”状态已经到达 UI 本体。
- 画面中央存在“跳过”按钮，说明这是一个真实可操作的交互阶段，而不是静态摆拍图。

结论：达到验收标准。

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人至高霸主-不弹窗，直接点击随从\smashup-overlord-resolved.png`

肉眼观察：
- 选中并结算后，左侧基地只剩至高霸主本体，原目标随从已消失。
- 顶部交互提示和中间按钮都已收口，说明流程已从“选目标”阶段退出。
- 右下弃牌区数量变为 0，未出现“打出后仍卡住”的异常收口状态。

结论：达到验收标准。

### 4) Collector 力量过滤与收口
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人收集者-不弹窗，直接点击随从\smashup-collector-minion-highlight.png`

肉眼观察：
- 顶部提示条显示“你可以将这个基地的一个力量≤3的随从返回其拥有者的手上”，提示文案与技能目标一致。
- 左侧基地上两张随从里，较弱目标保留亮色/紫框，高力量目标呈灰态不可选，说明力量过滤真实生效。
- 中央仍有“跳过”按钮，说明这是一个真实交互阶段，不是仅靠日志断言。

结论：达到验收标准。

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\随从选择：外星人收集者-不弹窗，直接点击随从\smashup-collector-resolved.png`

肉眼观察：
- 结算后该基地只剩收集者与高力量随从，原力量≤3目标已经被返回，不再留场。
- 不可选的大随从仍在场，证明这次没有把过滤条件错误地扩大成“任意随从都能选”。
- 交互提示与中央按钮已消失，说明流程已经正常收口。

结论：达到验收标准。

### 5) Invasion 第二步基地高亮与收口
截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人入侵（第二步）-不弹窗，直接点击基地\smashup-invasion-base-highlight.png`

肉眼观察：
- 顶部提示条显示“选择要移动到的基地”，说明第一步选随从后已经进入第二步选基地。
- 源基地被压暗，另外两个可去基地有紫色高亮，说明“只允许点目标基地”的筛选状态已正确显示。
- 手牌中的 Invasion 仍可见于右下弃牌区，链路语义与“行动卡已打出、等待第二步目标”一致。

结论：达到验收标准。

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\基地选择：外星人入侵（第二步）-不弹窗，直接点击基地\smashup-invasion-resolved.png`

肉眼观察：
- 原随从已经移动到中间基地，源基地不再保留该随从。
- 顶部提示与高亮收口，说明第二步点击基地后流程顺利结束。
- 画面未出现遮挡、错位或“点击无反应后残留高亮”的异常。

结论：达到验收标准。

## 未覆盖风险
- 本文档只覆盖外星人这 4 条目标直点链路，不代表 SmashUp 全部 Prompt/直点交互都已收口。
- 当前截图能确认的是“手牌有明显选中反馈、候选基地/随从有明显高亮反馈”；至于全局是否固定为某一套颜色语义，本文不作结论。
- `alienAuditFixes.test.ts` 因仓库默认 `*audit*` 排除策略，未用默认 vitest include 直接跑整文件；本轮主要依赖 typecheck、定向单测与 E2E 证明。
