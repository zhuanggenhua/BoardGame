# Fantasy Realms `fr-merge-pass2` 正式路线批准记录（2026-06-13）

> 文件路径沿用历史命名；当前真正生效的正式 live 真相源，不是旧 `fr-ui-current-*`，而是本文明确写出的 `fr-merge-pass2-*`。
> 若只想快速判断“旧文件名现在还算不算正式方向”，统一看 [README.md](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/docs/games/fantasyrealms/design/README.md) 里的“历史候选索引”。
> 若当前问题是“根目录 `main` 与 `fantasyrealms` worktree 到底先认哪边、哪些能双保留”，统一看 [fantasyrealms-main-vs-worktree-merge-decision-package-2026-06-14.md](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/evidence/fantasyrealms/fantasyrealms-main-vs-worktree-merge-decision-package-2026-06-14.md)。

## 当前批准结论

用户后续又给出更强裁决：**底部横幅/底部提示条绝对不是要采用的一版**。因此当前正式桌面方向已经从早先的 `fr-ui-current-*` 继续收口到 **无底部常驻提示横条** 的 `fr-merge-pass2-*` 真实运行态。

## 当前正式方向截图

- `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-opening-before-first-draw.png`
- `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-after-first-draw-before-discard.png`
- `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-first-discard-before-confirm.png`
- `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-waiting-ai-after-first-discard.png`
- `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-final-standings.png`
- `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-final-standings-review-other-player.png`

## 2026-06-14 补充截图的使用边界

- 旧 `test-results/manual/fr-merge-pass2-gameover-desktop-2026-06-14.png`
  - 现在降级为“旧手工终局补充图”，不再作为当前正式终局真相入口。
- 旧 `test-results/manual/fr-merge-pass2-waiting-desktop-2026-06-14.png`
  - 现在降级为“本地测试页 waiting 历史图”，不再作为当前在线 waiting 态真相入口。
  - 当前在线 waiting 态真相改由上面的 E2E 证据图 `...ui-full-flow-waiting-ai-after-first-discard.png` 承担。

## 已降级为历史阶段图的旧 current 截图

- `test-results/manual/fr-ui-current-opening-2026-06-13.png`
- `test-results/manual/fr-ui-current-after-draw-2026-06-13.png`
- `test-results/manual/fr-ui-current-after-select-2026-06-13.png`

这些图仍可作为“曾经收口到哪一步”的历史证据，但**不再是当前正式真相源**，因为它们仍保留了底部常驻提示横条。
这里的 `fr-ui-current` 也只是**旧文件名保留**，不代表今天还有一条现行 `current` 正式路线。

## 用户明确否定的候选

- `test-results/manual/fr-ui-rework-v4-opening-2026-06-13.png`
- 以及同族 `rework-v*` 桌面候选

这些文件名也只代表被否掉的历史候选，不代表当前仍在并行维护另一套正式桌面方向。

## 当前正式方向应满足的肉眼特征

1. 开局先给一张干净牌桌，不摆巨型空盒、永久厚带或底部常驻提示横条。
2. 当前步骤真正要处理的牌，集中出现在桌面中央。
3. 回合、分数、牌库、确认动作退到边缘。
4. 终局时右上出现可点击的最终排名榜单，并可切换查看各玩家终局手牌。
5. 桌面端正式方向不再保留底边提示条；如需提示，也只能是非默认、非底边常驻的临时态提示。
6. 旧麻将桌候选 / rework 候选不再冒充“当前正式方向”。

## 后续执行要求

- 当前唯一正式桌面 live 真相源，是 `fantasyrealms-online-basic.e2e` 这条 full-flow 用例产出的 E2E 证据截图链。
- 旧候选可以保留为历史证据，但不能继续写成现行规范或现行任务口径。
- 后续若继续改动 Board、E2E、设计规范，默认都以上述 E2E 证据图为真相源。
