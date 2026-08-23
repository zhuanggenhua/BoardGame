# UndoFab 组件索引

`UndoFab` 是旧页面可直接使用的撤回悬浮按钮。当前新接入默认优先通过 `GameHUD` 承载撤回入口；只有尚未接入 `GameHUD` 的专用页面才直接使用 `UndoFab`。

## 当前入口

| 目标 | 文件 |
| --- | --- |
| 组件实现 | [UndoFab.tsx](../../src/components/game/framework/widgets/UndoFab.tsx) |
| 统一 HUD | [GameHUD.tsx](../../src/components/game/framework/widgets/GameHUD.tsx) |
| 撤回上下文 | [UndoContext.tsx](../../src/contexts/UndoContext.tsx) |

## 接入口径

- Board 层用 `UndoProvider` 包住真实游戏内容，并传入当前状态、命令分发、玩家 ID、终局状态和本地 / 联机模式。
- 真实路由环境渲染 `GameHUD`，让撤回、操作日志、反馈和设置共用同一个悬浮菜单。
- `UndoFab` 直接接入只用于旧页面或专用页面；不要在同一页面同时保留 `GameHUD` 撤回入口和独立 `UndoFab`。
- 审计“撤回已接入”时，至少要证明真实 Board / 页面层能从公共 HUD 展开并看到撤回入口。

## 不再维护

旧版长示例、截图式说明和迁移清单已删除；当前实现以源码和测试为准。
