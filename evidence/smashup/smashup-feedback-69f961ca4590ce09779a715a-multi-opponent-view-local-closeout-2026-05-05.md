# SmashUp 反馈 `69f961ca4590ce09779a715a` 本地收口

## 范围

- 反馈 ID：`69f961ca4590ce09779a715a`
- 反馈主题：多人观战 / 多人局公开牌区视角只能看第一个对手，看不了其他玩家
- 验证目标：移动端横屏四人局下，点击不同对手分数应能切到对应玩家的公开牌区，并可返回自己视角

## 根因

- 根因不在 server `join` 或 `playerView` 私有裁剪。
- 真实问题在 `src/games/smashup/Board.tsx`：
  - 旧逻辑是 `viewMode: 'self' | 'opponent'`
  - `opponentPid = coreTurnOrder.find(pid => pid !== rootPid) || '1'`
- 这意味着 UI 只支持“自己 / 第一个对手”二元切换。
- 四人局或观战场景下，即使点击第 2、3 个玩家分数，也只能看到第一个对手的公开牌区。

## 修复

- `src/games/smashup/Board.tsx`
- `e2e/src/games/smashup/Board.tsx`

修复点：

- 用 `viewTargetPlayerId` 取代二元 `viewMode`。
- 公开牌区改为“点谁看谁”：
  - `displayedDeckPlayerId` 基于 `viewTargetPlayerId` 解析；
  - 返回自己视角时清空 `viewTargetPlayerId`。
- `HandArea`、`DeckDiscardZone`、视角横幅、眼睛图标高亮、移动端 touch 入口都改为基于当前 `displayedDeckPlayerId` / `isAlternateView`。

## E2E

- 用例：
  - `e2e/smashup/smashup-4p-layout-test.e2e.ts`
  - `e2e/smashup-4p-layout-test.e2e.ts`
- 用例名：
  - `移动端横屏点击不同对手分数应能切换对应玩家视角并退出`

## 验证命令

```powershell
npm run test:e2e:ci:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏点击不同对手分数应能切换对应玩家视角并退出"
```

- 结果：`1 passed`

## 关键截图

### 1. 进入第一个对手视角

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏点击不同对手分数应能切换对应玩家视角并退出\03a-mobile-opponent-view-entry.png`
- 我实际看到什么：
  - 画面上方出现“对手视角”横幅和“返回”按钮。
  - 左下角牌库显示 `3`，右下角弃牌显示 `弃牌 (1)`。
  - 主战场仍保持正常布局，没有因为切视角而白屏、偏移或缩到角落。
- 是否达到验收标准：
  - 达到。该图证明点第一个对手后，已成功进入替代视角。

### 2. 切换到第二个对手视角

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏点击不同对手分数应能切换对应玩家视角并退出\03b-mobile-opponent-view-switch-player-2.png`
- 我实际看到什么：
  - “对手视角”横幅仍在，说明仍处于替代视角。
  - 左下角牌库变为 `5`，右下角弃牌变为 `弃牌 (2)`。
  - 这和第一张图的 `3 / (1)` 明显不同，说明不是始终停留在第一个对手，而是真的切到了另一个玩家。
- 是否达到验收标准：
  - 达到。该图直接证明多人局下可以切换到不同对手玩家，而不是只支持固定第一个对手。

### 3. 返回自己视角后的收口状态

- 截图路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-4p-layout-test.e2e\移动端横屏点击不同对手分数应能切换对应玩家视角并退出\03c-mobile-opponent-view-return-self.png`
- 我实际看到什么：
  - “对手视角”横幅已经消失。
  - 底部恢复自己的两张手牌。
  - 左下角牌库为 `0`，右下角弃牌恢复 `弃牌 (0)`，和该场景自己的公开区数据一致。
- 是否达到验收标准：
  - 达到。该图证明退出后已回到自己视角，流程收口正常。

## 结论

- 该反馈本地已修并完成真实 E2E 验证。
- 现在的问题模型已从“自己 / 第一个对手”二元切换，收敛为“可切到任意被点击玩家的公开牌区视角”。
