# SmashUp 样式回归修复 E2E 证据

## 执行用例

- `PC 打开派系详情时应保持居中并可点击空白关闭`
- `横屏移动端打开派系详情时应显示泰坦区，并可完整滚动查看全部卡牌`
- `移动端横屏应保持四人局布局可用，并支持手牌长按看牌`

## 截图与人工观察

### 1. PC 派系详情打开态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\PC-打开派系详情时应保持居中并可点击空白关闭\14-desktop-faction-detail-open.png`

人工观察：
- 派系详情面板位于桌面端画面中部，没有再贴右侧停靠。
- 面板左右两边都能看到明显的暗色空白遮罩区域，说明空白点击层已恢复。
- 右上角关闭按钮是深色圆形底，和白色纸张背景分离清楚，不是透明底。

### 2. PC 空白关闭后

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\PC-打开派系详情时应保持居中并可点击空白关闭\15-desktop-faction-detail-blank-close.png`

人工观察：
- 详情面板已经完全消失，只剩派系选择卡阵列。
- 顶部标题和底层卡片重新成为主视觉，没有残留半开的抽屉或遮挡层。
- 说明点击面板外空白区域后，关闭动作已实际生效。

### 3. 结束回合按钮恢复态

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-4p-layout-test.e2e\移动端横屏应保持四人局布局可用，并支持手牌长按看牌\13-desktop-end-turn-restored.png`

人工观察：
- 右下角 `FINISH TURN` 主按钮外圈有清晰的白色描边，不再是边框消失的深色圆块。
- 主按钮右侧的 `Minion`、`Action` 配额徽章仍与主按钮保持贴合，没有因为补边框而错位。
- 主按钮右下的小型显隐按钮同样有可见描边，说明同一轮边框回归点已一并恢复。

## 结论

本轮修复后的实际画面已经覆盖并恢复以下回归：

- PC 派系详情重新居中展示。
- PC 派系详情可通过点击空白区域关闭。
- 派系详情右上角关闭 icon 的背景恢复为深色实底。
- 结束回合主按钮和显隐按钮的描边恢复可见。
