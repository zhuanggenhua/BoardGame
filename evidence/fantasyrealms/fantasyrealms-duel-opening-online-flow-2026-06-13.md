# Fantasy Realms 双人 online 开局关键决策流核对（历史阶段，2026-06-13）

> 历史阶段说明：
> 本文记录的是**双人开局仍通过牌库旁 cue 与底部提示条指路**的中间阶段，不再代表当前正式桌面方向。
> 当前正式开局真相源已改为规则 + 初始化状态 + `Board.foundation` 测试 + `evidence/fantasyrealms/fantasyrealms-duel-opening-real-2026-06-19.md`。
> 文中若出现 `点此摸 2 张`、`点左上牌库，先摸 2 张`、`点一张手牌，再确认弃置` 等提示语，均只代表当时阶段，不得再当成当前正式页面合同。
>
> 今天应这样理解本文：它只证明“这条旧链路当时确实跑通过”，**不证明**“底部提示条 / 牌库 cue 仍是今天要保留的正式 UI”。

- 时间：2026-06-13
- 目标入口：`http://127.0.0.1:4273/?game=fantasyrealms`
- 房间创建方式：`创建房间 -> 2 人 -> 加入 AI -> 确认创建`
- 验收视口：`1600x1000`
- 本轮关注点：
  - 双人 `0` 手牌开局不能再看起来像卡死
  - 每张关键决策前图都必须能直接看出下一步操作
  - 合法等待态必须明确是“在等 AI”，不是页面挂起

## 当前结论

### 今天仍有效的结论

- 双人 `0` 手牌开局这条规则链本身是合法的，不是流程断链。
- “玩家会不会一眼看不懂下一步”仍然是需要单独证明的 UI 问题。
- 但当时采用的 `牌库旁 cue + 底部提示条` 只是那一阶段的补法，**不是今天的正式 UI 结论**。

- 创建房间弹窗这一步在 2026-06-13 当时是合格的：`确认创建` 主按钮完整可见，`加入 AI` 状态也可见，前图能直接看出下一步。
- 2026-06-13 当时，那版进入对局后的首屏通过牌库 cue `点此摸 2 张` 与底部短提示 `点左上牌库，先摸 2 张` 指出下一步；今天这部分只保留为历史。当前正式双人开局合同改为：空弃牌、`0` 手牌时自动从牌库摸 2 张并进入弃牌阶段，不再停在摸牌按钮。
- 2026-06-13 当时，摸牌后 `2` 张真实手牌成为本步候选对象，顶部短标签切到 `弃牌`，不再是看不出该做什么的空态。
- 2026-06-13 当时，选中一张手牌后，卡面出现 `已选` 状态，右侧出现 `确认弃置`，前图能直接看出下一步确认动作落点。
- 2026-06-13 当时，确认弃置后页面切到 `AI 2 号位`，同时保留 `R2` 和 `1/12`，这说明当时是合法等待 AI 推进，而不是流程挂起。

## 关键截图

### 1. 创建前 -> 可继续创建

- 截图：
  - [fr-flow-0613-step1-create-modal.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/manual/fr-flow-0613-step1-create-modal.png)
- 肉眼结论：
  - `确认创建` 主按钮完整在可视区内，没有被裁切。
  - `加入 AI` 区块当前已开启，且 AI 难度/AI 占位可见，下一步操作很明确。

### 2. 进房首屏 -> 点牌库摸 2 张

- 截图：
  - [fr-flow-0613-step2-opening.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/manual/fr-flow-0613-step2-opening.png)
- 肉眼结论：
  - 这张历史图里，左上牌库本体清晰可见，旁边直接贴着 `点此摸 2 张`。
  - 这张历史图里，底部短提示写明 `点左上牌库，先摸 2 张`，因此这张前图在当时不再像“空桌面卡死”。
  - 今天不能再据此认定当前正式开局 UI；当前开局请看 `fantasyrealms-duel-opening-real-2026-06-19.md`。

### 3. 摸牌后 -> 进入弃牌阶段

- 截图：
  - [fr-flow-0613-step3-after-draw.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/manual/fr-flow-0613-step3-after-draw.png)
- 肉眼结论：
  - 顶部短标签已切到 `弃牌`。
  - 两张真实手牌已经出现，当前下一步候选对象就是这两张手牌，不再是无内容空态。

### 4. 选中手牌前 -> 选中后可确认弃置

- 截图：
  - [fr-flow-0613-step4-hand-selected.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/manual/fr-flow-0613-step4-hand-selected.png)
- 肉眼结论：
  - 被选中的手牌已显示 `已选`，不会和另一张未选牌混淆。
  - 右侧 `确认弃置` 已出现，前图能直接看出下一步主按钮在哪里。

### 5. 确认弃置后 -> 合法等待 AI

- 截图：
  - [fr-flow-0613-step5-after-discard.png](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/test-results/manual/fr-flow-0613-step5-after-discard.png)
- 肉眼结论：
  - 顶部明确显示 `AI 2 号位`，说明当前控制权已经交给 AI，而不是页面无响应。
  - `R2 / 1/12` 同步变化，证明弃置后的状态推进已经发生。

## 相关实现

- [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:768)
- [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:1087)
- [Board.tsx](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/src/games/fantasyrealms/Board.tsx:1235)
- [game-fantasyrealms.json](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/public/locales/zh-CN/game-fantasyrealms.json:22)
- [fantasyrealms-online-basic.e2e.ts](/D:/gongzuo/webgame/BoardGame/.worktrees/fantasyrealms/e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts:1037)

## 验证记录

- `npx vitest run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx` -> `31 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts --grep "2人在线房间可创建，host 首轮摸弃后 guest 可真实拿弃牌并结束回合"` -> `1 passed`
- 真实浏览器链路：
  - `创建房间 -> 开启 AI -> 确认创建 -> 进房`
  - `点牌库 -> 选手牌 -> 确认弃置`

## 额外说明

- 仓库当前没有 `npm run verify:open-image` 脚本；本轮已使用真实图片查看工具逐张核图，但无法按文档中的脚本步骤再打开同图。
- 本文只证明了**双人 online 开局到首轮弃牌收口**这段关键决策链，不等于已经用同一房间自然打到了整局终局。若要宣称“整局从头到尾跑通”，还需要继续按同一规则补中后盘与终局的关键决策截图对。
