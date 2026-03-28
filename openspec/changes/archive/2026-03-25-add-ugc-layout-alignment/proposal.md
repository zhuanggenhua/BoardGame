# Change: 收口 UGC 布局对齐/锚点/吸附能力

## Why
`add-ugc-layout-alignment` 的实现已经落地，但 proposal 仍停留在旧口径，错误地把这项变更描述成“彻底 breaking 且旧布局不再兼容”的未来计划。继续保留这份过时文档会误导后续判断，也阻碍归档。

## What Changes
- 将 change 口径改为与现状一致：UGC 布局组件已使用 `anchor/pivot/offset` 模型，Builder 在加载旧草稿时会迁移遗留 `x/y` 布局数据。
- Builder 已提供对齐/分布工具栏，支持左/中/右、上/中/下对齐，以及水平/垂直等距分布。
- Builder 已提供网格吸附、边缘吸附、中心吸附、参考线提示，并将这些编辑器偏好持久化到 `uiLayout`。
- Preview 与 Runtime 已共用统一布局解析工具；Runtime 通过 `builderPreviewConfig + PreviewCanvas` 复用同一套布局渲染路径。
- 将现有测试覆盖反映到任务口径中，包括布局解析、preview config 和预览/运行时一致性验证。

## Impact
- Affected specs:
  - `ugc-prototype-builder`
  - `ugc-runtime`
- Affected code:
  - `src/ugc/utils/layout.ts`
  - `src/ugc/builder/ui/SceneCanvas.tsx`
  - `src/ugc/builder/pages/UnifiedBuilder.tsx`
  - `src/ugc/builder/pages/panels/CanvasToolbar.tsx`
  - `src/ugc/builder/ui/RenderPreview.tsx`
  - `src/ugc/runtime/UGCRuntimeView.tsx`
  - `src/ugc/runtime/previewConfig.ts`
  - `src/ugc/__tests__/layout.test.ts`
  - `src/ugc/__tests__/previewConfig.test.ts`
  - `src/ugc/__tests__/previewRuntimeConsistency.test.ts`
