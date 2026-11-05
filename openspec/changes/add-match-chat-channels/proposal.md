# Change: 同窗口局内聊天频道

## Why
观战者目前只能阅读局内聊天。用户要求以现有深色聊天小窗为基线，让参赛玩家和观众能够分频道交流。

## What Changes
- 玩家频道仅向有效座位开放，观战席对玩家和观众默认开放。
- 同一聊天窗口切换频道，各频道独立保存草稿、历史与未读。
- 保留现有悬浮入口、表情用途和好友私聊，补充身份与可见范围。
- 服务端核验座位凭证，隔离私有历史和实时广播。

## Approval
用户在当前会话明确要求“还是以我现在的设计为主吧，其他的作为参考，开始吧，完成后截图给我”，授权实施；后续明确频道名称为“玩家 / 观战席”，两个频道统一用数字角标提示未读数量。

## Impact
- Affected specs: social-widget
- Affected code: GameHUD、MatchChatPanel、useMatchChat、matchSocket、matchChat、FabMenu 纵向空间合同。
- 目标环境：当前工作区本地真实联机房间，不包含提交、推送或生产部署。

## Validation
真实 Socket.IO 权限测试、聊天 hook 回归、DiceThrone 多身份浏览器链路、现有座位表情回归及整屏截图视觉审查。
