# 大杀四方「适者生存」选基地/平局选择 E2E 证据

## 目标

- 验证「适者生存」在“选基地 → 若最低力量平局则进入平局选择”链路中，
  不再弹出“请先完成当前选择”的噪音提示。
- 验证在平局场景下能正常进入“最低力量随从选择”界面。

## 用例

- 测试文件：`e2e/smashup/smashup-gameplay.e2e.ts`
- 用例名称：`适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择`
- 运行命令：

```bash
npm run test:e2e:ci:file -- smashup-gameplay.e2e.ts "适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择"
```

## 截图与观察

### 1. 点击「适者生存」后等待选择基地

![sotf-after-card-click-awaiting-base](../test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择/sotf-after-card-click-awaiting-base.png)

- 我实际看到：卡牌「适者生存」进入高亮/聚焦态，棋盘保持可选择状态，画面上没有任何红色错误条或“请先完成当前选择”提示。
- 验收判断：**通过**。噪音提示未出现，符合“进入选基地流程”的预期。

### 2. 选择基地后进入最低力量平局选择

![sotf-after-base-selection-awaiting-tiebreak](../test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择/sotf-after-base-selection-awaiting-tiebreak.png)

- 我实际看到：顶部出现“选择要消灭的最低力量随从”提示，说明已从“选基地”进入“最低力量平局选择”；仍未出现“请先完成当前选择”噪音提示。
- 验收判断：**通过**。平局选择阶段已正确触发。

### 3. 平局候选随从高亮可选

![sotf-tiebreak-candidates-visible](../test-results/evidence-screenshots/smashup/smashup-gameplay.e2e/适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择/sotf-tiebreak-candidates-visible.png)

- 我实际看到：最低力量随从候选被紫色外框高亮，界面仍保持“选择要消灭的最低力量随从”提示，且全屏无“请先完成当前选择”提示。
- 验收判断：**通过**。候选目标清晰可选且未出现噪音提示。

## 结论

- 「适者生存」在选基地后能继续进入最低力量平局选择流程。
- 本轮 E2E 截图未出现“请先完成当前选择”噪音提示，满足反馈修复的验收标准。
