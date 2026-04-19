# SmashUp 派系选择页回归验证（E2E 证据）

## 测试范围
- 移动端横屏派系选择卡片密度与换行
- 桌面端参考布局未被移动端修法带偏
- 顶部回合状态提示点击不应误触发派系详情

## 运行信息
- 命令：`node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-faction-selection-spacing.e2e.ts`
- 结果：2/2 通过

## 关键截图与肉眼结论

### 1. 移动端横屏派系选择（800x450）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\mobile-landscape.png`
- 我实际看到：顶部标题与状态贴纸居中，派系卡改为两列后每列宽度明显回到可读范围；第三张卡已经换到下一行，不再挤成一排三张。
- 是否达到验收标准：达到。当前截图里没有横向溢出，也没有“整页往右偏导致右侧被吃掉”的现象。

### 2. 桌面端参考布局（1440x900）
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\desktop-reference.png`
- 我实际看到：桌面端仍保持单行多列的宽布局，顶部标题/提示条居中，卡牌之间间距均匀，没有被移动端两列压缩方案反向影响。
- 是否达到验收标准：达到。说明本轮 compact landscape 修法只命中窄横屏，没有把桌面布局一起改坏。

### 3. 顶部回合状态提示点击保护
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-waiting\turn-status-badge-click.png`
- 我实际看到：点击顶部“现在轮到你了”状态贴纸后，页面仍停留在派系选择主界面，没有弹出右侧派系详情，也没有报未知命令。
- 是否达到验收标准：达到。顶部状态提示没有错误吃到下层派系卡点击。

## 额外说明
- 本地 `/play/smashup/local` 路线启用了 `followCurrentTurnPlayer`，因此单纯把 `currentPlayerIndex` 切到下一位时，视角也会跟着切过去，页面仍可能显示“现在轮到你了”而不是“正在等待 Pn”。
- 所以这条 E2E 的真实稳定口径应是：**顶部回合状态提示本身不可误触发派系详情**，而不是强依赖本地模式必须出现 waiting 文案。
