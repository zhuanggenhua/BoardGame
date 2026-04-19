# Change: add-hud-overlay-portal-guard

## Why
board-shell 在移动端会使用 transform scale 缩放；如果 HUD/Overlay 仍在壳内用 fixed/absolute 渲染，会被缩放容器影响，出现偏移。需要一个脱离缩放上下文的 HUD 渲染入口，并明确旧实现为反模式，避免新代码继续扩散问题。

## What Changes
- 新增 HUD 级 portal 入口（hud-root）与获取函数，供新 overlay 使用。
- 明确 board-shell 内 fixed/absolute overlay 为反模式，新代码必须走 HUD portal。
- 仅修复已暴露的问题与新代码路径，不批量重构历史实现。

## Impact
- Affected specs: mobile-support-framework
- Affected code: index.html（新增 hud-root）、core/ui portal helper、UI 规范文档
