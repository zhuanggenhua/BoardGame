# DiceThrone 选角与 HUD Portal E2E 证据

## 测试范围
- 选角界面移动端纵向布局
- 角色面板放大预览 Overlay
- 进入对局后的 HUD 布局（移动端横屏）

## 运行信息
- 测试文件：`e2e/dicethrone/character-selection.e2e.ts`
- 结果：7/7 通过

## 截图与观察

1. 移动端纵向选角界面（375x812）
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\应该显示角色选择界面\character-selection-mobile-portrait.png`
   - 观察：选角面板整体居中可见，左侧角色列表与中央卡面完整显示，未见右移或被裁剪。
   - 结论：达到“移动端选角界面不偏移”的验收标准。

2. 角色面板放大预览（Overlay）
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\应该能够放大预览第二版角色面板且不被裁剪\samurai-v2-player-board-magnify-open.png`
   - 观察：预览层完整覆盖视口，关闭按钮可见，卡面内容未被遮挡或裁切。
   - 结论：达到“放大预览不被裁剪”的验收标准。

3. 进入对局后的 HUD（移动端横屏）
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\选角后应该能够开始游戏\dicethrone-game-hud-mobile-landscape.png`
   - 观察：左侧回合序列、顶部提示与右侧 HUD 均完整显示在视口内，未见整体右偏或超出屏幕边界。
   - 结论：达到“游戏内 HUD 不偏移”的验收标准（移动端横屏基线）。

4. 加入中加载界面（移动端横屏）
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\加入中加载界面应居中显示（移动端横屏）\joining-loading-mobile-landscape.png`
   - 观察：加载法阵与“正在加入房间/校验房间席位”文案居中显示，左右留白对称，未见整体右偏。
   - 结论：达到“加入中加载界面居中”的验收标准（移动端横屏基线）。

5. 连接中加载界面（移动端横屏）
   - 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\连接中加载界面应居中显示（移动端横屏）\connecting-loading-mobile-landscape.png`
   - 观察：加载法阵与进度文案（本次为“加载游戏模块…”）居中显示，左右留白对称，未见整体右偏。
   - 结论：达到“连接中加载界面居中”的验收标准（移动端横屏基线）。
