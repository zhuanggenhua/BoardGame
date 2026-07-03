## 1. Specification
- [x] 1.1 更新 `dice-system` 规格，定义物理状态源与游戏渲染器边界。
- [x] 1.2 写清第三方物理插件只能作为物理状态源，不能决定默认交付样式。

## 2. Shared Architecture
- [x] 2.1 新增通用骰子物理状态类型，覆盖 id、屏幕投影、三维姿态、尺寸、运动中/落定状态。
- [x] 2.2 新增通用骰子渲染器契约，允许每个游戏定义骰子 mesh/canvas/DOM 视觉、选中态、锁定态与点击层。
- [x] 2.3 将 dice-box-threejs 适配层收口为物理状态源，避免直接把插件默认骰子暴露给游戏 UI。

## 3. DiceThrone Integration
- [x] 3.1 让 DiceThrone 棋盘骰子继续使用历史圆角 DiceThrone 视觉。
- [x] 3.2 将 DiceThrone 的棋盘骰子运动输入改为可接收通用物理状态，而不是依赖插件默认视觉。
- [x] 3.3 保持锁定骰子、选中态、点击层与历史截图合同一致。

## 4. Verification
- [x] 4.1 运行 TypeScript/ESLint 针对相关文件。
- [x] 4.2 运行 DiceThrone 3D 骰子截图链，确认 `diceTexturesReady=true`、`diceSettled=true`、无 fallback。
- [x] 4.3 图片自检必须先将 PNG 压缩为 JPG；只有达标后才用系统图片查看器打开原始 PNG 给用户。
- [x] 4.4 更新 DiceThrone dice-box 文档，明确“物理-渲染分离”才是后续方向。
