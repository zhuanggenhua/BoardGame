# DiceThrone 观战反馈收口（2026-10-03）

## 反馈原文
> 观战的时候，玩家出的牌不会消失，一直在屏幕中间

关联反馈：`6aafbd572a41a4d273d884c2`

## 发现的问题
此前只用 host/guest 玩家页验证了卡牌特写，未覆盖原始 `/play/dicethrone/match/:matchId?spectate=1` 入口，因此不能证明观战端的手牌可见性、只读交互或特写生命周期。当前实现已确认 spectator 视图把当前活动玩家作为观战手牌来源；观众点击手牌可打开放大查看层；观众也可以沿玩家相同路径拖牌，观战端 moves 由引擎层统一 no-op，不产生事件或效果。真实观战页收到玩家出牌事件后只渲染一个对应特写，并在自动退场时间后移除；刷新后不恢复旧特写。

## 处理方式 / 修复结果
- `src/games/dicethrone/Board.tsx`：spectator 使用当前活动玩家作为 `handOwner`，并把 spectator 的自我玩家解析到当前活动玩家。
- `src/games/dicethrone/ui/handPlayPolicy.ts`：观战允许手牌查看交互，但 `canPlayHandCardsForCurrentBoard` 仍禁止实际出牌。
- `src/games/dicethrone/hooks/useCardSpotlight.ts`：观战特写按 spectator 视图隔离缓存并自动退场，避免旧事件/重挂载残留。
- `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`：新增真实三页面 spectator E2E，覆盖玩家建局、观众进入真实 spectator URL、手牌只读放大、玩家实际出牌、单特写、自动退场、刷新无残留。

## 真实端到端证据
- 命令：`node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "real spectator should expose the current player hand as read-only and dismiss one card spotlight"`
- 结果：`1 passed (39.5s)`，真实 host / guest / spectator 三页面。
- 观战入口：`/play/dicethrone/match/:matchId?spectate=1`，运行时 `__BG_IS_SPECTATOR__ === true`。
- 交互验证：点击观战手牌打开 `board-magnify-overlay`；观众手牌 `data-can-drag=true`，沿玩家路径拖牌后事件流数量不变；观战端不提交实际命令。
- 特写验证：玩家实际出牌后 `card-spotlight-overlay` 数量为 1；观众点击 `spotlight-container-root` 空白位置后立即为 0；刷新后仍为 0。自动退场由组件单测覆盖。
- 截图：`test-results/evidence-screenshots/dicethrone/dicethrone-watch-out-spotlight.e2e/real-spectator-should-expose-the-current-player-hand-as-read-only-and-dismiss-one-card-spotlight/real-spectator-readonly-card-and-spotlight.jpg`

## 状态结论
本地当前工作树已修复并通过真实 spectator 端到端验收。该证据覆盖 DiceThrone；Smash Up 同类反馈仍需独立走其 spectator 入口，不能把本条结果外推为 Smash Up 已修复。


