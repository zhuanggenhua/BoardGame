## ADDED Requirements
### Requirement: 预加载与渲染共享图片命中状态
系统 SHALL 让关键图片预加载、暖加载、普通图片渲染和图集渲染共享同一套图片命中状态，确保预加载结果可以被后续 UI 挂载稳定复用。

#### Scenario: 关键图片预加载后进入对局
- **GIVEN** 关键图片门禁已成功加载某逻辑图片资源
- **WHEN** 对局 UI 中的 `OptimizedImage` 或 `CardPreview` 渲染该资源
- **THEN** 组件 MUST 直接复用预加载产生的成功候选与图片尺寸
- **AND** 组件 SHOULD NOT 重新从候选链起点发起加载

#### Scenario: 视角切换后玩家面板重新挂载
- **GIVEN** 玩家面板图片在当前对局中已经通过任一候选成功加载
- **WHEN** 用户切换观察视角导致玩家面板组件卸载后重新挂载
- **THEN** 玩家面板 MUST 继续显示已命中候选
- **AND** 系统 MUST NOT 因重新挂载而让面板回到空白或长时间 shimmer

#### Scenario: 预加载失败但渲染层 fallback 成功
- **GIVEN** 关键图片预加载阶段未能加载 primary 候选
- **AND** 渲染层 fallback 候选随后加载成功
- **WHEN** 后续 warm 加载、视角切换或弹窗放大再次请求该资源
- **THEN** 系统 MUST 复用渲染层回灌的成功候选
