# SmashUp 横屏移动端派系详情面板与泰坦区验证

## 结论

已按大杀四方 manifest 的 `preferredOrientation: 'landscape'` 进行横屏移动端验证。

当前已验证大杀四方派系选择页在横屏移动端打开派系详情弹层后：

- 详情弹层已恢复到和同场景 PC 主态接近的面板占比，不再缩成中间一张小海报，也不再放大成几乎铺满整屏
- 左侧详情区会在简介与“确认选择”按钮之间显示泰坦预览
- 有泰坦时显示真实卡面，无泰坦时显示“该种族泰坦暂未接入”占位
- 右侧卡牌预览区仍保持独立滚动能力，没有被左侧泰坦区挤坏
- 横屏主验证下不会出现错误方向提示

本轮根因分两段：

- 第一段问题是：`board-shell` 外层已经统一缩放后，`FactionSelection` 内部又对派系详情额外做了一次 `mobileLandscapeScale`，导致移动横屏详情被二次缩小。
- 第二段问题是：简单去掉内部缩放后，详情面板又被放大到接近铺满横屏，和 PC 主态不一致。

当前处理是：保留外层 `board-shell` 作为唯一缩放真值，移动端详情面板宽度改为按 `--mobile-board-shell-design-width` 的固定比例收敛，并在 E2E 中新增“不能太小、也不能太大”的双边门禁，强制对齐 PC 主态占比。

## 验证方式

执行命令：

```powershell
npm run test:e2e:ci:file -- e2e/smashup-4p-layout-test.e2e.ts "横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌"
```

结果：

- `1 passed`

本轮验证用例位置：

- `e2e/smashup-4p-layout-test.e2e.ts`
- 用例名：`横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌`

## 截图证据

顶部状态：

![横屏移动端派系详情顶部](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌/11-mobile-landscape-faction-detail-top.png)

滚动后状态：

![横屏移动端派系详情滚动后](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌/12-mobile-landscape-faction-detail-bottom.png)

无泰坦占位状态：

![横屏移动端派系详情无泰坦占位](../test-results/evidence-screenshots/smashup-4p-layout-test.e2e/横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌/13-mobile-landscape-faction-detail-no-titan.png)

## 观察

- `11-mobile-landscape-faction-detail-top.png` 里，整块派系详情相对横屏视口的占比已经接近 PC 主态：左右两侧仍保留明显 backdrop，左栏与右侧卡牌网格的权重接近桌面端，没有再缩成小海报，也没有放大成铺屏稿；这张图达到“和 PC 同构比例一致”的验收标准。
- 同一张图里，左侧 `Titan Preview` 区块位于简介下方、确认按钮上方，显示的是实际泰坦卡面，不是白块或 shimmer 占位；这张图达到“泰坦区真实渲染”的验收标准。
- `12-mobile-landscape-faction-detail-bottom.png` 里，右侧已经滚到更靠后的行动牌，左侧泰坦区与确认按钮仍保持稳定且完整可见，说明右侧是独立滚动容器，没有因为把面板拉回 PC 比例而把左栏挤坏；这张图达到“可完整滚动查看全部卡牌”的验收标准。
- `13-mobile-landscape-faction-detail-no-titan.png` 里，无泰坦派系仍保持同样的 PC 同构尺寸，左栏出现“该种族泰坦暂未接入”占位，确认按钮仍保留在底部可见区域；这张图达到“空状态不塌陷、不缩水、不放大走样”的验收标准。

## 桌面回归补充

- 额外复跑并查看了桌面派系详情泰坦预览用例：`npm run test:e2e:ci:file -- e2e/smashup-faction-selection-spacing.e2e.ts "海盗派系详情中的泰坦预览应加载真实卡图"`。
- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing.e2e\海盗派系详情中的泰坦预览应加载真实卡图\海盗派系详情中的泰坦预览应加载真实卡图-pirates-titan-preview-loaded.png`
- 肉眼可见桌面端海盗详情仍是完整的大面板布局，左栏泰坦卡和右侧卡牌网格都正常显示，没有被这次移动端修复带歪。
