# FantasyRealms 动态焦点分数推演核对（2026-06-06）

## 目标

核对 `FantasyRealms` 的 `当前焦点` 区是否已经从泛化提示，改成基于当前手牌与公开弃牌的真实分数推演。

## 环境

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms`
- 路径：`http://127.0.0.1:4276/play/fantasyrealms/local?players=6`
- 浏览器：Playwright / Chromium headless
- 视口：`1440 x 1100`

## 修前现象

- 焦点区大多只显示通用提示
- 估值通常只是泛化的 `+1 / +3`
- 不会告诉玩家“如果现在弃掉这张牌”或“如果现在拿走这张公开弃牌并改弃哪张牌”，总分会怎么变

## 修后结果

### 1. 手牌焦点会给出弃牌推演

- 在摸牌后、进入弃牌阶段时，焦点区会改成：
  - `若现在弃掉 {{当前焦点}}，你的官方总分会变为 ...`
- 同时给出净变化值，而不是只报泛化提示

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-focus-after-draw-dynamic-2026-06-06.png`

### 2. 公开弃牌焦点会给出拿牌 + 改弃推演

- 当回合推进到下一名玩家，且公开弃牌堆已有可拿牌后，焦点区会改成：
  - `若现在拿走 {{公开弃牌}} 并改弃 {{最佳换出候选}}，你的官方总分会来到 ...`
- 同时给出最佳换出候选与净变化值

证据：

- `evidence/fantasyrealms/fantasyrealms-6p-focus-after-discard-dynamic-2026-06-06.png`

## 结论

当前焦点区已经具备真实局面下的分数推演能力，不再只是泛化文案；它现在能直接服务“该弃哪张 / 这张公开弃牌值不值得拿”这两个核心决策。
