# 召唤师战争移动端基础流程 E2E 证据

## 范围

- 游戏：`summonerwars`
- 场景：`/play/summonerwars?skipInitialization=true&numPlayers=2`
- 目标：验证手机横屏下，基础流程能完成 `召唤 -> 移动 -> 建造 -> 攻击 -> 魔力弃牌`
- 状态来源：`TestHarness`
- 视口：`936x432`（手机横屏）

## 本轮执行

执行命令：

```bash
node scripts/infra/run-e2e-command.mjs dev e2e/summonerwars.e2e.ts --grep "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"
```

执行结果：

- 该用例本轮已实际运行并通过。
- 由于隔离 runtime 在当前机器上启动前端时触发 Node 堆 OOM，本轮改用 `dev` 模式复用已存在的 `4173` 前端做 E2E 验证。
- 本轮已实际查看两张关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-start.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\41-mobile-basic-flow-after-magic.png`

注意：

- 本轮截图里的关键手牌卡图已实际渲染出来，不再是上一轮那种纯深色占位块。
- 下面结论仍按项目规则分别写明：
  - 我实际看到了什么
  - 这是否达到本轮验收标准

## 关键截图

### 1. 基础流程起始态

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-start.png`

我实际看到：

- 棋盘主体、右侧阶段条、`结束阶段` 按钮都在视口内，没有再出现之前那种“整组手牌从中线往右扩出去”的右偏形态。
- 底部能看到 5 张起始手牌带着真实卡图，整组落在屏幕底部中段，而不是只挤在右下角。
- 起始态 5 张牌仍然存在明显重叠，最左和最右两张只有一部分露出，但它们都还在底部手牌带里，不是消失或跑偏。

是否达到验收标准：

- **针对“手牌偏一边”这个问题：已达到验收标准。**
  - 我实际看到整组手牌已经回到屏幕底部中央，不再向右侧偏移。
- **针对“截图里必须看到真实画面，而不是占位块”这个要求：已达到验收标准。**
  - 我实际看到了真实卡图，不再是上一轮的深色占位块。
- **针对“起始态 5 张手牌的可读性已经完全理想”这个更高标准：本轮不作为收口前提。**
  - 原因是重叠仍偏重，但这不是用户这轮明确指出的两个 blocker。

### 2. 攻击结算后进入魔力阶段

路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\41-mobile-basic-flow-after-magic.png`

我实际看到：

- 右侧阶段条和 `结束阶段` 按钮仍在视口内。
- 底部手牌区这次没有整条消失；屏幕底部仍能看到剩余手牌和真实卡图，说明魔力阶段之后手牌区还存在。
- 这张图里剩余手牌已经能直接识别出卡图与边框，不是只有占位块，因此我能确认的是“手牌区没消失，而且真实卡图也还在”。

是否达到验收标准：

- **针对“魔力阶段直接没有手牌”这个问题：已达到验收标准。**
  - 我实际看到底部手牌区仍在，不再是整条 DOM 和视觉一起消失。
- **针对“魔力阶段截图里要看到真实卡图”这个要求：已达到验收标准。**
  - 我实际看到了剩余手牌的真实卡图，而不是占位块。

## 根因结论

### 1. 之前“手牌偏一边”的真实根因

- 这是实际布局问题，不是单纯截图时机。
- 根因在 [Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/Board.tsx)：手牌外层原来用 `absolute bottom-0 left-1/2 -translate-x-1/2`，在移动端实际宽度基准下，手牌组会从屏幕中线往右扩。
- 本轮保持了已修复版本：改成 `absolute inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none`，并把 [HandArea.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/HandArea.tsx) 本体设为 `pointer-events-auto`。

### 2. 之前“魔力阶段直接没有手牌”的真实根因

- 这次确认不是截图时机问题，也不是新的布局 bug。
- 根因有两层：
  - 测试场景本身原先把起始手牌收敛到 3 张，流程里 `召唤` 用掉 1 张、`建造` 用掉 1 张、到 `魔力` 再弃 1 张，手牌自然归零，`HandArea` 在 `cards.length === 0` 时会直接返回 `null`。
  - 同时本地 `TestHarness` 存在状态注入后立即读取旧快照的时序问题，导致 E2E 有时会在旧手牌状态下开拍，进一步把现象看乱。
- 本轮已修复：
  - [src/engine/transport/react.tsx](/D:/gongzuo/webgame/BoardGame/src/engine/transport/react.tsx)：`TestHarness` 读状态改为读 `stateRef.current`，写状态时先同步 `stateRef.current` 再 `setState(...)`，避免 `state.set()` 后立即读到旧 render 闭包。
  - [e2e/summonerwars.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/summonerwars.e2e.ts)：`prepareDeterministicCore` 现在保留额外手牌，且基础流程显式等待目标手牌数量，魔力阶段截图前要求剩余手牌仍存在。
  - [src/games/summonerwars/domain/uiHints.ts](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/domain/uiHints.ts) 与 [src/games/summonerwars/domain/helpers.ts](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/domain/helpers.ts)：为 `skipInitialization` 的最小化测试态补了空棋盘保护，避免在状态注入前就因 `core.board` 未就绪把页面打进“游戏页保护”。
  - [src/games/summonerwars/ui/CardSprite.tsx](/D:/gongzuo/webgame/BoardGame/src/games/summonerwars/ui/CardSprite.tsx)：补了可观测的加载态标记，并在图片后台加载完成时主动更新组件，避免 E2E 截图只拍到 shimmer 占位。

## 本轮结论

- 基础流程逻辑层面：**通过**。
- “手牌偏一边”这个问题：**已达标**。
- “魔力阶段直接没有手牌”这个问题：**已达标**。
- “截图里必须看到真实卡图、不能只看到占位块”这个要求：**已达标**。
- 本轮收口判断：
  - **如果验收标准是本轮明确指出的两个 blocker + 真实截图证据，这轮可以收口。**
  - **如果后续要继续优化移动端首屏 5 张手牌的重叠可读性，这属于下一层视觉优化，不影响本轮对已报 blocker 的结论。**

## 仍需继续的点

- 本轮 E2E 使用的是开发前端复用路径，不是隔离 runtime；隔离 runtime 当前仍被机器内存抖动与前端进程 OOM 阻断，不能作为本轮失败归因到功能实现的证据。
- 若后续继续优化，可优先看起始态 5 张手牌的重叠密度是否还需要再收紧，但这不改变本轮两个已报 blocker 的通过结论。
