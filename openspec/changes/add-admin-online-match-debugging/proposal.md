# Change: 管理员可在生产线上对局使用调试面板

## Why

当前对局内 `GameDebugPanel` 仅在开发构建或 E2E 调试标志下显示。线上生产版本中，管理员无法用现有面板排查对局；若只放开前端显示，普通玩家仍可绕过 UI 向 `/game` socket 发送调试命令。

## What Changes

- 在生产环境的任意线上对局中，允许服务端确认的 `admin` 账号使用现有 `GameDebugPanel`，不要求管理员占用对局座位。
- 增加独立的管理员调试命令入口。游戏服务器验证登录令牌并读取当前角色，再通过权威游戏管线执行命令并广播结果。
- 普通线上命令入口拒绝未授权的作弊 / 调试命令；仅前端隐藏面板不构成权限校验。
- 记录管理员 ID、对局 ID、命令类型和执行结果，不记录命令载荷。
- 面板创建新房间并可能销毁当前线上房间时，增加明确确认。
- 保留开发、E2E 和教程现有的调试 / 状态注入行为；`developer` 角色不自动获得生产对局调试权限。

## Impact

- Affected specs: `admin-dashboard`, `cheat-system`
- Affected code: `GameDebugPanel`, `GameTransportServer` / socket 路由、游戏服务器入口 `server.ts`、相关客户端传输接口及测试。
