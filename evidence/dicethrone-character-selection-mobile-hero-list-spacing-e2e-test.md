# DiceThrone 移动端选角英雄列表间距 E2E 证据

## 范围

- 页面：DiceThrone 在线对局选角界面
- 位点：手机横屏下左侧英雄列表的上下间距
- 本轮目标：列表继续保持滚动，只把上下过挤的问题拉开一点；不改按钮、不改整层 inset、不缩头像

## 实施

- 修改文件：`src/games/dicethrone/ui/DiceThroneHeroSelection.tsx`
- 实际改动：左侧英雄 grid 的 `rowGap` 从 `inlineUnit(1.15)` 收回到 `inlineUnit(0.9)`；`columnGap` 保持 `inlineUnit(0.8)` 不变

## 验证

- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/character-selection.e2e.ts "手机横屏下选角界面不应出现顶层横向滚动"`
- 结果：`1 passed`

## 截图

- PC 对照：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\mobile-character-selection\character-selection-pc-1920x1080.png`
- 移动端结果：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\mobile-character-selection\character-selection-mobile-landscape.png`

## 肉眼观察

- PC 对照图里，左侧英雄列表本来就是滚动列表，不是首屏全显列表；主预览区和底部玩家栏没有被左侧列表挤压。
- 移动端图里，左侧两列英雄卡片仍是滚动列表，底部仍然只露出下一行的一部分，这符合当前结构，不需要强行全显示。
- 移动端图里，相邻卡片之间的黑缝已经明显收回，不再像 `rowGap=1.15` 那样稀疏；头像视觉尺寸也回到接近 PC 同构缩放下的比例。
- 移动端图里，主预览区、右侧说明区、底部按钮栏的位置关系保持稳定，没有出现为修列表间距而把按钮挤偏、把中间主区压窄的副作用。

## 结论

- 本轮达到的标准是：`滚动语义保留 + 列表上下不再过挤 + 不引入头像缩小和整层位移副作用`。
- 本轮没有把“首屏全部显示英雄列表”作为目标，也不应再以那个目标驱动样式调整。
