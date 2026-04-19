# Cardia 选择目标卡牌弹窗遮挡修复收口 2026-04-04

## 范围

- 反馈 ID：`69ce6242094b1acda250f790`
- 反馈简述：选择目标卡牌时，确认按钮会被底部已聚焦的手牌区挡住
- 对应分诊：`temp/feedback-triage-summary.md` 中唯一 `cardia` 真 bug

## 问题

- 触发场景：Cardia 在能力执行过程中打开 `CardSelectionModal`，同时底部手牌区处于聚焦/展开态。
- 用户可见结果：确认按钮虽然渲染出来，但会被更高层的手牌 UI 压住，导致按钮难以看见或无法正常点击。
- 这类问题本质上不是“按钮本身样式不对”，而是“模态层级低于页面内局部浮层”。

## 修法

- 文件：`src/games/cardia/ui/CardSelectionModal.tsx`
- 修法：把弹窗遮罩层和弹窗内容层从原先的硬编码 `z-50`，改为使用全局 `UI_Z_INDEX.modalOverlay` 与 `UI_Z_INDEX.modalContent`。
- 结果：`CardSelectionModal` 回到项目统一 modal 层级语义，确保它在手牌聚焦层之上显示。

## 为什么这次选择改 z-index

- 根因是层级冲突，不是布局尺寸问题。已有聚焦手牌层会主动抬高层级；如果只改按钮位置、底部留白或 modal 内边距，按钮仍可能继续被更高层 UI 压住。
- `CardSelectionModal` 语义上本来就是全局模态。把它接到统一 `UI_Z_INDEX`，比继续针对某个具体手牌组件打补丁更稳，后续也能避免同类页面内浮层再次压过 modal。
- 这次没有去压低手牌层级，是因为手牌聚焦本身仍需要高层显示；真正应该处在最上面的，是 modal，而不是反过来削弱手牌组件。

## 最小验证

### 1. 单测

- 命令：
  - `npm run test -- src/games/cardia/__tests__/discard-pile-render.test.tsx`
- 结果：
  - `1 passed`
  - `3 passed`
- 覆盖点：
  - `src/games/cardia/__tests__/discard-pile-render.test.tsx` 新增断言，确认 `CardSelectionModal` 的静态输出包含 `UI_Z_INDEX.modalOverlay` 和 `UI_Z_INDEX.modalContent`。

### 2. E2E

- 命令：
  - `npm run test:e2e:ci:file -- e2e/cardia-test-scenario-api.e2e.ts "紧凑横屏下卡牌选择弹窗确认按钮不应被已聚焦手牌遮挡"`
- 结果：
  - Playwright `1 passed`
- 用例位置：
  - `e2e/cardia-test-scenario-api.e2e.ts:316`
- 关键断言：
  - 用例先让手牌进入聚焦态，再注入卡牌选择弹窗，并用 `elementFromPoint` 校验确认按钮中心点最上层元素仍是按钮本身。

### 3. 截图人工核对

- 截图路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia-test-scenario-api.e2e\紧凑横屏下卡牌选择弹窗确认按钮不应被已聚焦手牌遮挡\紧凑横屏下卡牌选择弹窗确认按钮不应被已聚焦手牌遮挡-cardia-selection-modal-over-hand.png`
- 肉眼观察：
  - 弹窗完整覆盖在棋盘内容上方，没有看到底部手牌区压进弹窗按钮区域。
  - `确认` 和 `取消` 两个按钮完整可见，没有被切边、遮住或被底部色块盖住。
  - 选择卡牌区域与底部按钮区域之间层级关系正常，按钮位于最上层可操作区域。

## 当前还缺什么

- 就本轮仓库内最小收口材料而言，**不缺 E2E 和截图证据**：单测、定向 E2E、显式截图和人工看图结论都已具备。
- 如果要把这条反馈从后台正式回写为 `resolved`，还差最后的状态回填动作，以及把这份 evidence 文档作为备注依据挂回反馈处理链路。
