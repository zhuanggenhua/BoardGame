# 大杀四方极客禁卡表面板 E2E 验收

## 范围

- 游戏：大杀四方
- 卡牌：禁卡表（`geeks_banned_list`）
- 验收目标：
  - 面板提供搜索入口
  - 候选以卡图方式展示，而不是纯按钮墙
  - 候选只来自当前对局已上场派系
  - 搜索结果能正确过滤
  - 选中后交互正常收口并真正生效

## 代码与测试落点

- E2E：`e2e/smashup/smashup-geeks-banned-list-ui.e2e.ts`
- 相关实现：
  - `src/games/smashup/abilities/geeks.ts`
  - `src/games/smashup/ui/PromptOverlay.tsx`

## 执行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-geeks-banned-list-ui.e2e.ts
```

## 场景设置

- 当前对局派系：
  - 你自己：极客、龙
  - 对手：外星人、海盗
- 通过测试场景直接打出 `禁卡表`。
- 面板理论上只应展示这 4 个派系对应的牌，不应混入未参战派系候选。

## 截图与观察

### 1. 初始面板

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-geeks-banned-list-ui.e2e\禁卡表面板应提供卡图搜索并只展示当前对局派系候选\geeks-banned-list-01-initial-panel.png`
- 实际看到：
  - `禁卡表：为玩家二命名一张牌` overlay 已出现。
  - 标题下方存在搜索框。
  - 候选以卡图卡面平铺展示，不是按钮列表。
  - 计数显示 `49/49`，说明当前候选池已收敛到本局派系相关牌。
- 结论：
  - 达到“卡图候选 + 搜索入口”的验收要求。

### 2. 搜索无结果

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-geeks-banned-list-ui.e2e\禁卡表面板应提供卡图搜索并只展示当前对局派系候选\geeks-banned-list-02-empty-search.png`
- 操作：
  - 搜索 `行尸`。
- 实际看到：
  - 计数变为 `0/49`。
  - 面板中央显示 `没有匹配的卡牌`。
- 结论：
  - 未参战派系相关牌不会被错误展示，搜索空结果态正常。

### 3. 搜索命中单卡

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-geeks-banned-list-ui.e2e\禁卡表面板应提供卡图搜索并只展示当前对局派系候选\geeks-banned-list-03-filtered-search.png`
- 操作：
  - 搜索 `收集者`。
- 实际看到：
  - 计数变为 `1/49`。
  - 面板内只剩 1 张 `收集者` 卡图。
- 结论：
  - 搜索过滤与卡图候选联动正常，能直接定位到单张候选牌。

### 4. 交互收口

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-geeks-banned-list-ui.e2e\禁卡表面板应提供卡图搜索并只展示当前对局派系候选\geeks-banned-list-04-resolved.png`
- 操作：
  - 点击 `收集者`。
- 实际看到：
  - overlay 已关闭，回到棋盘主态。
  - 流程没有卡死或残留旧 prompt。
- 额外状态断言：
  - 对手手牌从 `['enemy-collector', 'enemy-broadside']` 变为 `['enemy-broadside']`
  - `enemy-collector` 被压入对手牌库底
- 结论：
  - UI 不只是“看起来能搜”，而是完成了真实选牌并正确收口。

## 最终结论

- 本次 `禁卡表` 面板改动属于“交互模式变化”：
  - 候选发现方式变了
  - 候选展示载体变了
  - 新增了搜索过滤
- 因此按新增 UI / UI 重构口径补齐了真实 E2E 与截图证据。
- 当前验收结果通过。
