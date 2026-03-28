# 实现任务清单

## 1. 布局模型与迁移
- [x] 1.1 在布局组件中落地 `anchor/pivot/offset` 模型，并由 `resolveLayoutRect` / `resolveAnchorFromPosition` 提供统一计算
- [x] 1.2 在 Builder 草稿加载链路中接入 `migrateLayoutComponents()`，把遗留 `x/y` 布局迁移为当前模型

## 2. Builder 对齐与吸附能力
- [x] 2.1 提供对齐/分布工具栏，支持左/中/右、上/中/下对齐及水平/垂直等距分布
- [x] 2.2 在画布拖拽与缩放中接入网格吸附、边缘吸附、中心吸附
- [x] 2.3 提供吸附参考线提示
- [x] 2.4 将网格与吸附偏好持久化到 `uiLayout`

## 3. 预览与运行时统一解析
- [x] 3.1 Builder 预览使用统一布局解析器
- [x] 3.2 Runtime 通过 `builderPreviewConfig` 复用 `PreviewCanvas`，共享同一套布局渲染路径

## 4. 现有验证覆盖
- [x] 4.1 布局解析工具测试已覆盖锚点解析与反推
- [x] 4.2 Preview config 测试已覆盖布局配置挂载/提取
- [x] 4.3 预览与运行时一致性测试已覆盖 runtime state 附带 builder preview config 的链路
