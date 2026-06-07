# Design: In-Match Seat Emotes

## Context
现有局内聊天通过 `MATCH_CHAT_EVENTS` 挂在 `/lobby-socket` 的共享 socket 上，适合文本聊天和历史记录。座位表情是瞬时表现事件，应复用同一 socket 连接，但不进入消息历史。

## Decisions
- Project structure: feature-first on the shared match social layer. Server event handling stays beside match chat/rematch; frontend shared widgets live under `src/components/game/framework/widgets/`.
- API client approach: reuse existing `matchSocket` typed service instead of creating a new API client.
- Auth strategy: no new auth flow; server validates `matchId + playerId` against match metadata and rejects spectators/non-members.
- Real-time method: Socket.IO WebSocket through existing `/lobby-socket`, because this is bidirectional in-match interaction and already shares match chat/rematch transport.
- Error handling: server emits an ack-style result for send failures and logs structured warnings for invalid room, invalid player, invalid emote, and rate limit.

## Goals
- 一次点击只产生一次 `matchEmote:send`，服务端只转发一次 `matchEmote:show`。
- 表情从对应玩家座位/头像锚点弹出，而不是只出现在聊天框。
- 支持游戏专属表情与通用表情共存，catalog 可被未来表情库管理功能扩展。
- 表情表现层必须走 `HudPortal`，避免被 board-shell 缩放或棋盘层遮挡。

## Non-Goals
- 不做用户上传表情。
- 不做表情商城、解锁、收藏。
- 不把座位表情写入私聊历史或未读消息。
- 不在第一版要求每个游戏都提供精准锚点；缺锚点时可降级到 HUD 安全位置。

## Data Model
```ts
type EmoteScope = 'common' | 'game';

interface EmoteDefinition {
  id: string;
  scope: EmoteScope;
  gameId?: string;
  characterId?: string;
  emotion: string;
  label: string;
  assetPath: string; // 不含 compressed/
  enabled: boolean;
}

interface MatchEmotePayload {
  matchId: string;
  playerId: string;
  emoteId: string;
  createdAt: string;
}
```

## UI / UX
- HUD 快捷入口默认展示 6 个表情，移动端保持 44px 触控下限。
- 播放层根据 `[data-player-seat-anchor="<playerId>"]` 定位座位锚点。
- 同一玩家连续发送时替换旧动画，不堆叠。
- 动画使用 `transform/opacity`，约 1800-2400ms；`prefers-reduced-motion` 下禁用弹跳。

## Risks
- 不同游戏座位 DOM 结构不同：第一版用 `data-player-seat-anchor` 作为通用合同，无法定位时降级到 HUD 右下安全区。
- 频繁发送影响观感：服务端按 `matchId + playerId` 做 2 秒限流。
- 资源路径与压缩链路出错：正式资源只引用不含 `compressed/` 的 base path，运行时交给统一图片链路解析。

