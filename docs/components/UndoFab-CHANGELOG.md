# UndoFab 历史变更摘要

本文是历史变更摘要，不作为当前接入指南。当前接入口径见 [UndoFab 组件索引](UndoFab.md) 和 [GameHUD 撤回集成索引](GameHUD-Undo-Integration.md)。

## 保留事实

- `UndoFab` 曾用于替代底部固定撤回控件。
- 当前统一方向是通过 `GameHUD` 承载撤回入口。
- 独立 `UndoFab` 只作为旧页面或专用页面的兼容入口。

## 当前入口

- [UndoFab.tsx](../../src/components/game/framework/widgets/UndoFab.tsx)
- [GameHUD.tsx](../../src/components/game/framework/widgets/GameHUD.tsx)
- [UndoContext.tsx](../../src/contexts/UndoContext.tsx)
