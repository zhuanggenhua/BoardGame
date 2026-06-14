## Context
board-shell 在移动端通过 transform scale 进行缩放，壳内 fixed/absolute 将相对缩放容器定位，导致 HUD/overlay 偏移。

## Goals / Non-Goals
- Goals:
  - 提供统一 HUD portal 入口，确保新 overlay 不受 board-shell 缩放影响
  - 文档明确旧实现为反模式，避免继续扩散
- Non-Goals:
  - 不批量重构历史 overlay
  - 不改变现有 HUD/overlay 视觉样式

## Decisions
- 决定：新增 hud-root + getHudPortalRoot，作为 HUD/overlay 默认 portal 目标
- 决定：旧实现不强制迁移，仅在新代码/修复点采用新路径

## Risks / Trade-offs
- 风险：历史 overlay 仍可能在特定游戏中偏移
  - 缓解：文档标注反模式 + 新代码强制走 portal

## Migration Plan
1) 新增 hud-root 与 helper
2) 文档规则落地
3) 仅修复已暴露问题

## Open Questions
- 是否需要后续阶段性清理部分高频 overlay（按用户反馈再定）
