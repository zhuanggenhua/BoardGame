# Fantasy Realms 在线等待页分数摘要核对

- 时间：2026-06-07
- 目标测试：`e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- 目标用例：`3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字`
- 验收视口：`1920x1080`

## 核对目标

- 在真实 `3` 人在线房间里，非当前行动玩家的等待页只能公开**当前观察者自己的**分数摘要。
- 同一等待页里允许看到当前行动玩家名字，但不得泄露第三位玩家名字或分数。
- 等待页的右上摘要必须保持 live HUD 语义，而不是退化成完整记分板或终局榜单。

## 当前结论

- Host 等待页当前只显示当前行动玩家 `Guest1-FR-1780814032001`，右上只公开 Host 自己的 `82` 分与 `第 3 名`；截图里没有第三位玩家名字，也没有第三位玩家分数。
- 第三位玩家等待页当前同样只显示当前行动玩家 `Guest1-FR-1780814032001`，右上只公开自己 `173` 分与 `第 1 名`；截图里没有 Host 名字，也没有 Host 分数。
- 两张图都仍然保持 live 牌桌语义：左上牌库、中央公开牌、底部手牌仍可见，但没有出现完整记分板、`官方总分` 标题、`终局揭示` 文案或其它会把等待页误读成完整排名入口的额外信息。

## 证据

- 截图：
  - [3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字-host-waiting-score-summary.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/evidence-screenshots/_shared/fantasyrealms-online-basic.e2e/3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字/3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字-host-waiting-score-summary.png)
  - [3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字-player3-waiting-score-summary.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/evidence-screenshots/_shared/fantasyrealms-online-basic.e2e/3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字/3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字-player3-waiting-score-summary.png)
- 相关测试：
  - [fantasyrealms-online-basic.e2e.ts](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts:1652)
- 相关实现：
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:699)
  - [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:1212)

## 验证命令

- `npx eslint e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts --grep "3人在线房间等待页只公开当前观察者分数摘要，不泄露第三方分数与名字"`
- `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
