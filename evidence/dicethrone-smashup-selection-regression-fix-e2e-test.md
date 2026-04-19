# DiceThrone / SmashUp 选择界面回归修复 E2E 证据

## 范围
- DiceThrone：角色选择页、加入中/连接中加载页、进入游戏后的 HUD 横屏布局
- SmashUp：派系选择页手机横屏主布局、顶部回合提示贴纸点击不应误开详情

## 结论
- **DiceThrone 达标**：整页选角界面恢复为页面内 overlay 后，左侧角色列表、加入中、连接中、进入游戏 HUD 均未再出现整体右偏。
- **SmashUp 达标**：手机横屏已恢复桌面化主布局，没有再被误修成双列窄布局；顶部回合提示贴纸点击不会误触发派系详情。
- **测试口径修正**：SmashUp 本地页开启了 `followCurrentTurnPlayer`，因此本地模式下不会稳定停留在“等待其他玩家”的固定视角；旧测试把 `currentPlayerIndex` 改掉后再期待 waiting badge，前提不成立，已改为验证真实存在的“顶部回合提示贴纸不可点穿”。

## 关键截图与肉眼观察

### 1. DiceThrone 横屏角色选择
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\mobile-character-selection\character-selection-mobile-landscape.png`
- 我实际看到：
  - 左侧角色列表贴在页面左边界，没有整体被挪到右侧。
  - 中间角色主面板保持居中，底部玩家条横向居中。
  - 顶部“等待对手加入...”提示在中轴附近，没有跟着 HUD 偏到右边。
- 验收判断：**达到本轮“选角页不再整体右偏”的标准**。

### 2. DiceThrone 加入中加载页
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\加入中加载界面应居中显示（移动端横屏）\joining-loading-mobile-landscape.png`
- 我实际看到：
  - 旋转图标、标题、按钮都位于画面中心区域。
  - 左右留白基本对称，没有挂在右半边。
- 验收判断：**达到“加入中居中”标准**。

### 3. DiceThrone 连接中加载页
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\连接中加载界面应居中显示（移动端横屏）\connecting-loading-mobile-landscape.png`
- 我实际看到：
  - 加载图标与两行文案都保持居中。
  - 没有出现之前那种 fixed 相对缩放层偏移到右边的现象。
- 验收判断：**达到“连接中居中”标准**。

### 4. DiceThrone 进入游戏后的 HUD
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\选角后应该能够开始游戏\dicethrone-game-hud-mobile-landscape.png`
- 我实际看到：
  - 中央战场、左侧阶段条、右侧按钮列都在各自区域内，没有整屏向右漂。
  - HUD 与棋盘层的相对关系正常，右侧按钮没有把主战场挤偏。
- 验收判断：**达到“游戏内 HUD 不再整体偏移”的标准**。

### 5. SmashUp 移动端派系选择
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\mobile-landscape.png`
- 我实际看到：
  - 横屏下首行保持 5 张卡的桌面化主布局，第三张卡仍与第一张卡处于同一行。
  - 标题区与顶部提示贴纸居中，主内容没有被压成中间一条窄列。
  - 卡面之间仍有横向间距，且页面没有横向溢出。
- 验收判断：**达到“横屏主路径不再被误修成窄布局，只修偏移不改版式”的标准**。

### 6. SmashUp 顶部回合提示贴纸点击后
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-waiting\turn-status-badge-click.png`
- 我实际看到：
  - 画面仍停留在派系选择页，顶部“现在轮到你了”贴纸存在。
  - 页面上没有弹出派系详情面板，说明贴纸点击没有误开详情。
  - 横屏桌面化主布局仍然保持，没有因点击贴纸导致界面跳成窄布局或双列路线。
- 验收判断：**达到“顶部状态提示不应触发派系详情”的标准**。

## 实际执行的校验
- `npx eslint e2e/smashup/smashup-faction-selection-spacing.e2e.ts`
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-faction-selection-spacing.e2e.ts`
- `node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/character-selection.e2e.ts`

## 备注
- SmashUp 第二条 E2E 的修复是**测试前提修正**，不是再改一轮 UI 实现。
- 根因是本地路由使用 `followCurrentTurnPlayer`，所以“等待中”视角不会稳定停留给当前设备；继续强测 waiting badge 会制造假失败。
