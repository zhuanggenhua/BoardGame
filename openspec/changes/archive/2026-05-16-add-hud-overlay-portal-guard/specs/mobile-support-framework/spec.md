## ADDED Requirements
### Requirement: board-shell 内的 HUD/Overlay 必须脱离缩放上下文渲染
系统 MUST 提供一个 HUD 级 portal 根节点，所有在 board-shell 内需要 fixed/absolute 的 HUD/Overlay 新实现 SHALL 通过该 portal 渲染到缩放容器之外。

#### Scenario: board-shell 页面显示离线横幅
- **GIVEN** 游戏页面启用了 board-shell 缩放
- **WHEN** 离线横幅通过 HUD portal 渲染
- **THEN** 横幅位置与 viewport 居中对齐，不受 board-shell transform 影响
