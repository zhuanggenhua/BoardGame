# SmashUp 矮妖真实页面 E2E 验证（2026-06-10）

## 目标

- 验证“大杀四方”里**场上只有一只矮妖**时，对手把更弱的随从打到同基地，真实页面链路里是否会被立即消灭。

## 入口与方法

- 入口：`/play/smashup`
- 方式：项目现有 E2E 三板斧
  - 真实页面入口
  - `game.setupScene(...)` 代表态注入
  - 真实 UI 点击手牌与基地完成出牌

## 注入场景

- 基地 0：托尔图加（`base_tortuga`）
- 基地上已有：
  - 矮妖（`trickster_leprechaun`），力量 `5`
- 当前行动玩家：
  - 1 号位
- 1 号位手牌：
  - 大副（`pirate_first_mate`），力量 `2`

## 执行命令

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-trickster-leprechaun.e2e.ts "单只矮妖在真实页面中应消灭对手打到同基地的弱随从"
```

结果：

- `1 passed`

## 截图与肉眼结论

### 触发前

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-trickster-leprechaun.e2e\单只矮妖在真实页面中应消灭对手打到同基地的弱随从\smashup-leprechaun-before-play.png`
- 我实际看到：
  - 左侧第一个基地下方只有一张矮妖牌面，力量标记是 `5`
  - 底部手牌区能看到大副，牌面力量是 `2`
  - 这张图同时覆盖了“出牌前的手牌”和“目标基地上的单只矮妖”
- 验收判断：
  - **达到前态证据要求**。可以证明触发前的页面确实是“单矮妖 + 对手弱随从在手里”。

### 触发后

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-trickster-leprechaun.e2e\单只矮妖在真实页面中应消灭对手打到同基地的弱随从\smashup-leprechaun-after-resolve.png`
- 我实际看到：
  - 左侧基地下方仍只有矮妖，弱随从没有留在该基地
  - 右下弃牌堆区域能看到刚才那张大副，弃牌计数变成 `1`
  - 底部中央已经没有那张待出的手牌
- 验收判断：
  - **达到后态证据要求**。这张图能直接证明真实页面里，大副打到同基地后没有留场，而是被消灭后进入弃牌堆。

### 触发中提示

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-trickster-leprechaun.e2e\单只矮妖在真实页面中应消灭对手打到同基地的弱随从\smashup-leprechaun-triggered.png`
- 我实际看到：
  - 左侧基地内部出现了能力提示，主标题是 `矮妖 触发！`
  - 提示下面明确写了 `消灭 大副`
  - 同时基地上仍能看到那张矮妖，所以玩家能把“谁触发了”和“消灭了谁”对上
- 验收判断：
  - **现在已经有显式触发提示证据**，不是只剩“牌突然没了”的无提示销毁。

## 状态断言

E2E 同时断言了运行时状态：

- 1 号位手牌从 `['weak-hand-1']` 变为 `[]`
- 1 号位弃牌堆包含 `pirate_first_mate`
- 基地 0 随从列表最终只剩 `['lep-1']`

## 结论

- **单只矮妖的正常实时页面主链是通的。**
- 当前代码下，真实页面里对手把力量 `2` 的大副打到同基地后，会被力量 `5` 的矮妖立即消灭。
- 因此，“场上只有一只矮妖时完全不触发”这件事，本地当前树**没有复现**。
