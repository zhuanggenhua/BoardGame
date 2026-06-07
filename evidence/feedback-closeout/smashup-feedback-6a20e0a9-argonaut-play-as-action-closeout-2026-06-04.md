# SmashUp 反馈 `6a20e0a97d14bb74e8214a8e` 阿尔戈英雄按战术位打出收口

## 反馈

- 反馈 ID：`6a20e0a97d14bb74e8214a8e`
- 游戏：`smashup`
- 来源：`feedback-modal`
- 原文：`希腊人小2无法花战术位打出`

## 结论

- 用户描述成立。
- 根因不在 SmashUp 领域层 `PLAY_MINION.playAsAction` 本体，而在前端手牌入口的落点判定。
- 领域层早已允许 `阿尔戈英雄（mythic_greeks_argonaut）` 在随从额度已满、战术额度未满时按 `playAsAction: true` 打出；但 `Board.tsx` 的基地高亮与手牌点击分流仍只按“普通随从验证”判定，导致 UI 提前把可落点清空，玩家进不到真实可执行链路。

## 根因

- 数据定义：
  - [src/games/smashup/data/factions/mythic_greeks.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/data/factions/mythic_greeks.ts)
  - `mythic_greeks_argonaut` 已声明 `playAsAction: true`
- 领域验证：
  - [src/games/smashup/domain/commands.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/commands.ts)
  - `PLAY_MINION` 已支持 `playAsAction === true`
- 领域结算：
  - [src/games/smashup/domain/reduce.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/reduce.ts)
  - `playAsAction` 会消耗 `actionsPlayed`，不会额外增加 `minionsPlayed`
- 真正缺口：
  - [src/games/smashup/Board.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/Board.tsx)
  - UI 侧 `getDeployableBaseStateForCard(..., 'minion')` 只跑普通 `PLAY_MINION` 校验
  - `handlePlayMinion(...)` 自己再单独补一次 `playAsAction` 兜底
  - 结果是“真实 dispatch 能打”，但“UI 入口不给落点、不让用户走到那一步”

## 修复

- 新增统一 UI 判定 helper：
  - [src/games/smashup/ui/resolveMinionUiPlayPlan.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/ui/resolveMinionUiPlayPlan.ts)
  - 规则：
    - 先尝试普通 `PLAY_MINION`
    - 若失败且该随从声明了 `playAsAction: true`，再尝试 `PLAY_MINION + playAsAction: true`
    - 返回统一的 `validation + playAsAction` 计划
- 接回真实 UI 入口：
  - [src/games/smashup/Board.tsx](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/Board.tsx)
  - 基地高亮与 `handlePlayMinion(...)` 改为共用同一条 `resolveMinionUiPlayPlan(...)`
  - 避免“高亮判定一套、真实出牌又是另一套”

## 回归

- 新增：
  - [src/games/smashup/__tests__/resolveMinionUiPlayPlan.test.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/resolveMinionUiPlayPlan.test.ts)
- 覆盖：
  - 阿尔戈英雄在 `minionsPlayed >= minionLimit` 且 `actionsPlayed < actionLimit` 时，UI 计划必须返回 `validation.valid = true` 且 `playAsAction = true`
  - 普通随从在同场景下仍必须保持不可打出，防止 UI 误放宽
- 补充复跑：
  - [src/games/smashup/__tests__/abilities/mythic-greeks.test.ts](/abs/path/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/abilities/mythic-greeks.test.ts)
  - 既有“阿尔戈英雄可替代行动额度打出，并触发行动态持续能力”保持通过

## 验证

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/resolveMinionUiPlayPlan.test.ts src/games/smashup/__tests__/abilities/mythic-greeks.test.ts --configLoader native --maxWorkers 1
```

结果：

- `2 files passed`
- `17 tests passed`

## 生产状态

- 复核到生产 `feedbacks` 中该条在本轮修复前仍为 `status: open`
- 当前代码与回归已足够支持将该条回写为 `resolved`
