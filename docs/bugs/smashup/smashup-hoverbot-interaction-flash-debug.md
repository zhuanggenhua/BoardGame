# Smash Up Hoverbot 交互闪退排查摘要

本文是历史 bug 排查摘要，不作为通用交互系统调试指南。

## 原始症状

- 盘旋机器人触发后，选择弹窗短暂出现又立即消失。
- 玩家无法点击“打出牌库顶随从”或“放回牌库顶”。

## 当时有效线索

- 交互创建、刷新和解决链路需要同时看 `queueInteraction`、`resolveInteraction`、能力处理器和 UI 提交锁。
- 重点排查对象是同一交互是否被重复创建、选项刷新是否返回空、或 UI 是否在提交锁状态下没有正常解锁。
- 当时涉及的 Smash Up 文件包括 `src/games/smashup/abilities/robots.ts`、`src/games/smashup/domain/index.ts` 和 `src/games/smashup/ui/PromptOverlay.tsx`。

## 当前使用口径

- 遇到同类交互问题时，先按当前 `.spec` 交互与 E2E 标准定位真实对象、入口和验收口径。
- 不要照搬原长文中的临时调试按钮、重复交互兜底或旧日志格式。
- 当前是否仍存在该 bug，必须用现有源码、测试和真实入口重新证明。
