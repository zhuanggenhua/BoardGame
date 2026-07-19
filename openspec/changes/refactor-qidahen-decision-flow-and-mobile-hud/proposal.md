# Change: 重构《七大恨》决策流程与移动端 HUD

## Why
《七大恨》当前已经补上剧本、阵营和局内前置流程，但多个高代价决定仍然是点击即提交，突袭支付阶段又没有稳定展示当前目标，导致玩家无法确认自己正在选择什么、确认后会发生什么。手机横屏则把整套 `1920x1080` HUD 缩小到约 44%，关键文字和按钮失去可读性与可点性。

## What Changes
- 将剧本、阵营、人物和军备统一为“预览候选 -> 明确确认 -> 服务端提交”的开局决策流程。
- 将突袭、免费调度等地图决策统一为“进入选择态 -> 地图对象高亮 -> 当前目标摘要 -> 确认或取消”，支付期间隐藏无关行动入口。
- 将战斗待结算与战后选择改成分层决策，避免一次平铺大量近似选项。
- 让临时地图聚焦在选择结束后恢复进入选择前的视口。
- 移除手机横屏 HUD 的整层 `1920` 比例缩放，使用同一套组件的移动布局令关键操作保持至少 `44x44 CSS px`。
- 补齐选择态、键盘操作、读屏状态与减少动画支持。

## Impact
- Affected specs: `qidahen-decision-flow`
- Affected code:
  - `src/games/qidahen/Board.tsx`
  - `src/games/qidahen/QidahenBoardShell.tsx`
  - `src/components/game/framework/SelectableGameObject.tsx`
  - `e2e/qidahen/online-inmatch-setup.e2e.ts`
  - `e2e/qidahen-basic-flow.e2e.ts`
  - 《七大恨》定向组件与领域测试

