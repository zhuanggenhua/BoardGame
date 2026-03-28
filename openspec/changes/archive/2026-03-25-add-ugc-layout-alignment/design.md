## Context

UGC Builder 早期布局以绝对 `x/y` 思维为主，但当前实现已经完成向 `anchor/pivot/offset` 的过渡，并把对齐、分布、吸附和统一解析器一起接入到了编辑器、预览和运行时。当前需要收口的是文档，而不是继续设计一套未落地的新方案。

## Goals / Non-Goals

- Goals:
  - 以真实实现为准描述布局模型、迁移策略和编辑器能力。
  - 明确 Preview 与 Runtime 共享布局解析路径，而不是各自维护一套坐标逻辑。
  - 为归档提供准确 spec delta，避免后续再次把已完成能力当成 active work。
- Non-Goals:
  - 不再把这项能力描述成“旧布局完全不可用”的纯 breaking 迁移。
  - 不要求补齐新的验证项才允许归档。
  - 不在本次收口里扩展额外布局能力。

## Decisions

### Decision: 布局模型以 `anchor/pivot/offset` 为当前真实来源

- Builder 画布、预览渲染和运行时预览都以 `anchor/pivot/offset + width/height` 解析实际矩形。
- 新建、拖拽、缩放、对齐、分布操作都会回写锚点模型，而不是继续维护一套独立的 `x/y` 编辑状态。

### Decision: 旧草稿通过加载时迁移兼容，而不是让运行时长期双轨解析

- `migrateLayoutComponents()` 会把遗留 `x/y` 数据补齐为 `anchor/pivot/offset`，Builder 在读取草稿时执行迁移。
- 归档口径应描述为“支持旧草稿迁移”，而不是“所有链路永久并行支持两种布局协议”。

### Decision: 对齐/吸附属于 Builder 编辑器能力，偏好单独持久化

- 对齐与分布通过工具栏触发，直接修改选中组件的布局。
- 网格显示、网格大小、网格吸附、边缘吸附、中心吸附和阈值属于编辑器偏好，保存在 `uiLayout`，不混入单个布局组件数据。
- 参考线只作为编辑时 UI 状态存在，不写回布局 schema。

### Decision: Preview 与 Runtime 共用同一布局渲染路径

- `resolveLayoutRect()` 作为统一布局解析函数。
- Builder 预览使用 `PreviewCanvas`。
- Runtime 视图通过 `extractBuilderPreviewConfig()` 取得布局配置后，同样复用 `PreviewCanvas`，从而共享解析和组件渲染逻辑。

## Risks / Trade-offs

- 旧布局的兼容点集中在 Builder 加载迁移，如果未来存在绕过 Builder 直接消费旧草稿的链路，需要显式补迁移，而不能再假设运行时会原样识别遗留 `x/y`。
- Preview/Runtime 共用 `PreviewCanvas` 提高一致性，但也意味着布局渲染变更会同时影响两条链路，后续改动应继续走统一验证。
