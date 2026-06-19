# Fantasy Realms 双人真实开局态核对（2026-06-19）

## 真相源

- 规则：`src/games/fantasyrealms/rule/幻想国度规则.md`
  - 首位玩家第一回合不能从弃牌区拿牌，只能从牌库抽牌。
- 初始化：`src/games/fantasyrealms/domain/index.ts`
  - 初始状态为 `turn: 1`、`stage: 'draw'`、`discardPile: []`。
- 组件级测试：`src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`
  - 真实双人开局态断言：自动派发 `DRAW_FROM_DECK`，不显示 `从牌库摸 2 张并弃 1 张` 按钮，也不显示 `拿公开牌`。

## 当前截图

- 当前组件级真实开局图：
  - [fantasyrealms-duel-opening-real-2026-06-19.png](./fantasyrealms-duel-opening-real-2026-06-19.png)
- 当前组件级渲染 HTML：
  - `temp/rendered-board/fantasyrealms-duel-opening-real.html`

## 当前事实

- 公开弃牌区为空。
- 手牌数量为 `0`。
- 不停在右侧摸牌按钮；唯一合法来源是牌库且无目标可选，因此直接派发摸牌。
- 不提前出现 `拿公开牌`。

## 生成说明

- 这张图来自旧的“自动摸牌前”组件级渲染，只保留为本轮前置问题证据；当前正式开局收口后，应以自动摸牌后的弃牌阶段截图为准。
- 生成时读到的真实状态：
  - `buttonTexts`: `["从牌库摸 2 张并弃 1 张"]`
  - `takeDiscardVisible`: `false`
  - `handCount`: `0`
  - `discardCount`: `0`
