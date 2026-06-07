# SmashUp 派系选择玩家卡片栏回归验收标准

## 背景
派系选择页近期反复出现两类回归：

1. 玩家卡片栏/玩家选择栏消失，或只存在于 DOM 但视觉上不可见。
2. 为处理派系选择状态时，误加回“过滤掉已选中/已占用派系”的效果。

本标准用于后续修改派系选择 UI 时的固定验收口径。

## 必须保持

### 玩家卡片栏
- 玩家卡片栏必须显示在派系选择页底部。
- 玩家卡片栏应采用底部绝对定位浮层，不参与主网格布局计算，不挤压派系卡片网格。
- 玩家卡片栏必须真实处于视觉顶层，不能只是 DOM 可见。
- 移动横屏、桌面宽屏、双人局场景都必须显示玩家卡片栏。
- 派系网格底部必须预留足够滚动 padding，避免最后一排派系卡被底部浮层遮住。

### 派系过滤行为
- 不允许恢复“可选 / 全部 / 已锁定”三段状态筛选按钮。
- 不允许默认过滤掉已选中派系。
- 不允许默认过滤掉已被其他玩家占用的派系。
- 已选中/已占用派系应保留在网格内，通过覆盖层、锁定态、透明度等视觉状态表达。
- 搜索框只做文本匹配，不承担 selected/taken 状态过滤。

## 当前验证用例

固定使用以下 E2E 作为最小验收：

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-faction-selection-spacing.e2e.ts "移动端横屏应保持桌面化主布局并输出移动端/桌面端参考截图"
```

该用例必须验证：

- `faction-selection-player-rail` 可见。
- 玩家状态卡真实显示在视觉顶层。
- `faction-filter-available` 不存在。
- `faction-filter-all` 不存在。
- `faction-filter-taken` 不存在。
- 移动横屏派系卡仍为桌面化主布局，不退化成窄屏双列。
- 派系卡不会与底部玩家卡片浮层发生不可接受遮挡。
- 输出移动端和桌面端截图供人工复核。

## 截图证据路径

- 移动横屏：`test-results/evidence-screenshots/smashup-faction-selection-spacing/mobile-landscape.png`
- 桌面参考：`test-results/evidence-screenshots/smashup-faction-selection-spacing/desktop-reference.png`

## 本次修复口径

- 玩家卡片栏保留为底部 absolute overlay。
- 使用 `min-height` 与高 z-index 确保浮层真实显示。
- 派系滚动区域保留底部 padding，避免浮层盖住最后一排。
- 不恢复任何状态过滤按钮或 selected/taken 默认过滤逻辑。
