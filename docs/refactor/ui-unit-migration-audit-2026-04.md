# UI 单位迁移审计（2026-04 历史）

本文是 2026-04 的一次性审计快照，不是当前执行规范。移动端和响应式单位的现行判断以 [`ui-responsive-layout`](../../.spec/knowledge/standards/ui-responsive-layout.md) 和 [`adapt-game-mobile`](../../.spec/skills/adapt-game-mobile/SKILL.md) 为准。

## 保留结论

- 真正需要优先迁移的是固定构图主画布、主字号、主按钮、主 HUD 和共享框架组件中的裸 `vw / vh / dvh`。
- 可以保留的是 viewport 边界保护，例如 `max-w-[90vw]`、`max-h-[90vh]`、`w-[calc(100vw-2rem)]`，以及非 `board-shell` 子树的全屏友好页 `100dvh`。
- 不应把变量名、运行时 fallback helper 或 SVG 宽高变量误判成 CSS viewport 单位问题。
- 固定构图主布局的长期方向是设计尺寸进入统一壳层缩放；文本、按钮、表单、日志和普通 HUD 优先使用 `rem` / `clamp()`。

## 当时命中的高风险区域

| 优先级 | 区域 | 保留原因 |
| --- | --- | --- |
| P0 | `src/components/game/framework/presets.tsx`、`InfoTooltip.tsx`、`BuffSystem.tsx`、`PlayerOccupancyBadge.tsx` | 共享组件会影响多个游戏和后续新功能 |
| P1 | `src/games/<gameId>/ui/` 中的固定构图主画布、手牌区、主要交互区 | 固定构图主画布和核心交互区 |
| P1 | `src/games/<gameId>/ui/` 中的骰盘、状态 HUD、主动作区域 | 高频主交互和状态 HUD |
| P2 | `FloatingText.tsx`、`FlyingEffect.tsx` | 动效层可单独评估，不作为主布局阻塞 |
| P3 | `AuthModal.tsx`、`ImageLightbox.tsx`、`AboutModal.tsx` 等 overlay | viewport 上限约束可保留 |

## 使用方式

- 只把本文当作历史排查清单；文件路径和现状可能已经变化。
- 若要继续单位迁移，先重新扫描当前源码，再按 `.spec` 的 UI 响应式标准裁决。
- 不做全仓机械替换；按共享层、主链路、动效层分批处理并验证。
