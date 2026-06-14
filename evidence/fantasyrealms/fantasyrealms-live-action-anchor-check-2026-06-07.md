# Fantasy Realms live 主操作锚点核对

- 时间：2026-06-07
- 目标页面：`e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- 目标用例：`右下固定主按钮可完成拿弃牌确认与弃手牌确认，且不侵入手牌主热区`
- 验收视口：`1920x1080`

## 核对目标

- live 主操作按钮必须停留在固定右下操作坞，保持和其他牌桌游戏一致的重复点击热区，而不是跟着公共区/手牌区在右侧上下漂移。
- `确认选择` 与 `确认弃置` 两种确认态必须复用同一操作坞，只切按钮文案与可用态，不切锚点。
- 右下主操作必须与全局 `离开` HUD 浮钮形成清晰上下分层，不能继续压在同一热区。

## 当前结论

- 当前页面里的主操作按钮已经收成单一固定锚点 `bottom-right`，抓牌阶段、确认拿牌、弃牌阶段、确认弃置都复用这一右下操作坞。
- 当前口径不再把“刚刚点的是公开牌/手牌”理解成“主按钮也该跟着源区漂移”；对象选择发生在牌面，主按钮只负责阶段推进与确认。
- 当前 E2E 已直接断言：抓牌阶段按钮位于 `bottom-right`，切到确认拿牌与确认弃置后仍保持同一锚点、同一横向位置与同一纵向位置。
- 当前真图里 `离开` HUD 浮钮仍在更靠右下的边角层，主操作按钮位于它左上方的固定可点击区，避免互相遮挡。
- 对照仓内既有家族：`Smash Up` 的 `结束回合 / 继续` 也复用固定右下热区，而不是随中央战场对象上下跳位；`Fantasy Realms` 这次回收后与这条交互家族重新对齐。

## 证据

- 截图：
  - [右下固定主按钮可完成拿弃牌确认与弃手牌确认，且不侵入手牌主热区-live-action-bottom-right-confirm-take.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/evidence-screenshots/_shared/fantasyrealms-live-flow.e2e/右下固定主按钮可完成拿弃牌确认与弃手牌确认，且不侵入手牌主热区/右下固定主按钮可完成拿弃牌确认与弃手牌确认，且不侵入手牌主热区-live-action-bottom-right-confirm-take.png)
- 相关测试：
  - [fantasyrealms-live-flow.e2e.ts](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts:467)
- 相关实现：
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:879)
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:1228)
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:1821)

## 验证命令

- `npx eslint e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts --grep "右下固定主按钮可完成拿弃牌确认与弃手牌确认，且不侵入手牌主热区"`
