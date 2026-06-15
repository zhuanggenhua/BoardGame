# Fantasy Realms 当前 worktree 全流程引导复核（历史阶段，2026-06-13）

> 历史阶段说明：
> 本文记录的是**底部常驻提示横条与牌库旁提示仍存在时**的流程观察，不再代表当前正式桌面方向。
> 当前正式真相源已改为可溯源的 E2E 证据链：`test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/...`。
> 文中若出现 `点此摸 2 张`、`点左上牌库，先摸 2 张`、`点左上牌库摸 2 张，或点一张公开弃牌` 等提示语，均只代表当时阶段，不得再当成当前正式页面合同。
>
> 今天应这样理解本文：它只证明“当时这条首页到终局的流程链已真实跑通”，**不证明**“底部常驻提示横条仍应作为今天的正式 UI 组成部分”。

## 目标

回答本轮用户质疑的两个问题：

1. 当前 `fantasyrealms` worktree 的真实前端现场里，流程到底有没有真的跑通。
2. 关键前图里，用户是否还能直接看出下一步，而不是停在“规则上合法但像卡住”。

## 当前运行现场

- 前端：`http://127.0.0.1:4273/?homeStyle=classic`
- 游戏服务：`http://127.0.0.1:18000`
- API：`http://127.0.0.1:18001`

## 现场复核结论

### 今天仍有效的结论

- 首页真实建房到终局这条产品链，当时已经有过真实打通证据。
- “关键中途态要让人一眼看懂下一步”这个验收口径仍然有效。
- 但文中依赖的底部短提示横条与牌库旁 cue，只是历史阶段的中间补法，今天已经退出正式桌面方向。

- 首页 -> 幻想国度 -> 创建房间 -> `加入 AI` -> `确认创建` -> 进房：当前 worktree 真实可走。
- 开局首屏不是自动发牌，而是双人变体的 `0` 手牌起局；但现在页面已明确给出 `点此摸 2 张 / 点左上牌库，先摸 2 张`，不再像死页。
- 点击牌库后会真实进入弃牌阶段；之前让用户误判“卡住”的核心原因，是中途前图缺少短提示，而不是流程本身停死。

## 验证

- 单测：
  - `npx vitest run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - 结果：`31 passed`
- Full-flow E2E：
  - `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts --grep "首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图"`
  - 结果：`1 passed`

## 关键图证

### 1. 开局首屏：可见下一步入口

![开局首屏](../../test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-opening-before-first-draw.png)

- 牌库旁直接可见：`点此摸 2 张`
- 底部直接可见：`点左上牌库，先摸 2 张`

### 2. 摸牌后待弃牌：可见下一步是“先选手牌，再确认”

![摸牌后待弃牌](../../test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-after-first-draw-before-discard.png)

- 底部短提示已明确：`点一张手牌，再确认弃置`

### 3. AI 回合后回到 host：可见下一步仍是牌库入口

![AI 后回到 host](../../test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-host-next-turn-after-ai.png)

- 牌库旁仍有：`点此摸 2 张`
- 底部短提示：`点左上牌库，先摸 2 张`

### 4. 公开弃牌分支前图：可见是“牌库 / 公开弃牌”二选一

![公开弃牌分支前图](../../test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-pre-take-discard-branch.png)

- 底部短提示已明确：`点左上牌库摸 2 张，或点一张公开弃牌`

## 结论

- 当前 worktree 里的 Fantasy Realms 流程是真能从首页真实入口一路跑到终局的。
- 用户之前会觉得“卡住”，根因不是流程断了，而是关键中途态没有把“下一步点哪里”写清楚。
- 这一轮已经把这个缺口补成运行时合同，并用当前现场和 full-flow E2E 同时复核。
