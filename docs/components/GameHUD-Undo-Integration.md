# GameHUD 撤回集成索引

本文只保留 GameHUD 撤回集成的当前事实。撤回业务合同以 `UndoContext`、引擎撤回系统和现有测试为准。

## 当前入口

| 目标 | 文件 |
| --- | --- |
| 统一悬浮菜单 | [GameHUD.tsx](../../src/components/game/framework/widgets/GameHUD.tsx) |
| 独立撤回按钮 | [UndoFab.tsx](../../src/components/game/framework/widgets/UndoFab.tsx) |
| 撤回状态上下文 | [UndoContext.tsx](../../src/contexts/UndoContext.tsx) |
| GameHUD 测试 | [GameHUD.test.tsx](../../src/components/game/framework/widgets/__tests__/GameHUD.test.tsx) |

## 集成判断

- 游戏 Board 必须在真实内容外层提供 `UndoProvider`。
- 页面必须渲染 `GameHUD`，并传入游戏、对局、玩家和阶段信息。
- 选角、准备、终局、观战或游戏专属隐藏规则不能误把正式局内撤回入口隐藏。
- 有待审批撤回请求时，公共 HUD 应提供可见通知和审批入口。

## 迁移口径

- 旧页面若直接渲染 `UndoFab`，迁入 `GameHUD` 后应删除独立按钮，避免双入口。
- 只证明底层 `UndoSystem` 或日志 allowlist 通过，不等于玩家入口已接入。
- 当前文档不保留旧逐步教程和历史变更细节；需要判断行为时看源码和测试。
