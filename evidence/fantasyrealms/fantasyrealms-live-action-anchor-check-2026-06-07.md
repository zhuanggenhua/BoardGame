# Fantasy Realms live 主操作锚点核对（已切到当前手牌区合同）

- 时间：2026-06-07
- 目标页面：`e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- 目标用例：`手牌区确认按钮会在拿牌确认与弃牌确认之间复用，且保持同一手牌区锚点`
- 验收视口：`1920x1080`

## 核对目标

- live 主操作按钮必须挂在手牌区头部，与当前手牌区形成同一交互壳，而不是再宣称存在一个独立右下操作坞。
- `确认选择` 与 `确认弃置` 两种确认态必须复用同一手牌区确认位，只切按钮文案与可用态，不切锚点。
- 主操作必须保持在手牌区主热区的可见边界内，不能脱离手牌区漂到另一个固定角落。

## 当前结论

- 当前实现里的主操作按钮已经收成手牌区锚点 `hand-zone`；抓牌确认与弃牌确认都复用这一手牌区确认位。
- 当前口径仍然保留“对象选择发生在牌面，主按钮只负责阶段推进与确认”，但不再把这种确认按钮解释成独立右下热区。
- 当前 E2E 应直接断言：切到确认拿牌与确认弃置后，锚点都保持 `hand-zone`，且确认位不脱离手牌区。
- 当前真图里 `离开` HUD 浮钮仍在右下角边缘层，但它不再是确认按钮的参照真相源；当前确认按钮真相源是手牌区头部。

## 证据

- 截图：
  - [手牌区确认按钮会在拿牌确认与弃牌确认之间复用，且保持同一手牌区锚点-live-action-hand-zone-confirm-take.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/evidence-screenshots/fantasyrealms/fantasyrealms-live-flow.e2e/手牌区确认按钮会在拿牌确认与弃牌确认之间复用，且保持同一手牌区锚点/手牌区确认按钮会在拿牌确认与弃牌确认之间复用，且保持同一手牌区锚点-live-action-hand-zone-confirm-take.png)
- 相关测试：
  - [fantasyrealms-live-flow.e2e.ts](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts:467)
- 相关实现：
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:879)
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:1228)
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:1821)

## 验证命令

- `npx eslint e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`
- `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts --grep "手牌区确认按钮会在拿牌确认与弃牌确认之间复用，且保持同一手牌区锚点"`
