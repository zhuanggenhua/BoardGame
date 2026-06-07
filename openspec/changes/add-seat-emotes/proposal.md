# Change: Add In-Match Seat Emotes

## Why
局内聊天藏在聊天框里，玩家不一定能看到。对局社交需要一种类似“从玩家位置弹出”的即时反馈，让表情在棋盘视野内直接可见，同时避免把瞬时表情混入私聊历史和未读消息体系。

## What Changes
- 新增 `match-emotes` 能力：一次点击发送一次局内表情事件，服务端校验后向同房间玩家转发。
- 新增游戏专属与通用表情 catalog 分层，第一批接入 DiceThrone 月精灵候选表情。
- 前端在 HUD 中提供快捷表情入口，并在玩家座位/头像锚点播放短暂弹出动画。
- 表情事件不默认写入聊天历史、不影响私聊未读数；聊天窗口可后续只做可选记录展示。
- 增加旁观者禁发、房间成员校验、表情白名单校验与发送频率限制。

## Impact
- Affected specs: `match-emotes`（新增）, `social-widget`, `asset-routing`
- Affected code:
  - `server.ts`
  - `src/services/matchSocket.ts`
  - `src/components/game/framework/widgets/GameHUD.tsx`
  - `src/components/game/framework/widgets/EmotePicker.tsx`
  - `src/components/game/framework/widgets/SeatEmoteOverlay.tsx`
  - `src/shared/emotes.ts`
  - `public/assets/i18n/zh-CN/dicethrone/emotes/**`

