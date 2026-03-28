## ADDED Requirements

### Requirement: 预览与运行时共享布局解析路径
系统 SHALL 让 Builder 预览与 Runtime 视图共用同一套布局解析与渲染路径，以保证锚点布局在两端表现一致。

#### Scenario: Builder 预览解析锚点布局
- **WHEN** Builder 预览渲染包含 `anchor/pivot/offset` 的布局组件
- **THEN** 系统 MUST 使用统一布局解析器计算实际矩形

#### Scenario: Runtime 复用预览布局渲染
- **WHEN** Runtime 视图从状态中提取 `builderPreviewConfig`
- **THEN** 系统 MUST 复用与 Builder 预览相同的布局渲染路径来展示布局组件
