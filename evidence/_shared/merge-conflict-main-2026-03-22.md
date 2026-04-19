# 冲突解决汇报：main 合并 origin/main

## 1. 背景
- base: 本地 `main`（合并前指向 `3ba6a3bcf68f6203a046d8aadae78c9917fecabe`）
- head: `origin/main`（合并前指向 `558788d4d147bbf7dd0db6207e89d50115fdffbd`）
- 触发命令: `git merge origin/main --no-commit --no-ff`

## 2. 冲突文件
- `e2e/helpers/cardia.ts`
- `src/games/cardia/Board.tsx`
- `src/games/cardia/ui/DiscardPile.tsx`
- `src/games/smashup/abilities/pirates.ts`
- `src/games/smashup/domain/reducer.ts`

## 3. 解决策略

### `e2e/helpers/cardia.ts`
- 保留了 `resolveCardiaFrontendBaseURL()` / `warmCardiaMatchRoute()` 的抽象封装。
- 同时保留了远端对 `setupCardiaTestScenario()` 的场景注入重构，统一走 `applyCardiaScenarioToPage()`。
- 原因：既保留更稳定的 E2E 启动方式，也不丢远端对 TestHarness/场景注入的复用改造。

### `src/games/cardia/Board.tsx`
- 保留远端的移动端布局分层、方向判断、长按放大镜、日志替换、`encounterFlipState` 等结构化改动。
- 同时保留本地“桌面基线不缩小”的尺寸策略：桌面仍固定 `106px / 80px`，仅在受限视口降级。
- 原因：用户明确要求响应式适配不能把桌面原版卡牌整体缩小，这里采用“桌面固定 + 移动端按视口压缩”的合并结果。

### `src/games/cardia/ui/DiscardPile.tsx`
- 保留本地从 `./layout` 统一读取弃牌堆样式的方法。
- 合并远端的外层 `overflow-hidden` 与数量角标。
- 原因：弃牌堆尺寸继续受统一 layout 控制，避免局部样式漂移；同时补上移动端裁切保护和信息提示。

### `src/games/smashup/abilities/pirates.ts`
- 保留远端抽到 `../domain/utils` 的 `resolveLiveBaseIndex()`。
- 保留本地 after-scoring / replacement 相关修复逻辑。
- 原因：基地替换后按 `baseDefId` 回定位是正确的通用方案，不能被本地旧实现覆盖。

### `src/games/smashup/domain/reducer.ts`
- 保留远端对 `SPECIAL_AFTER_SCORING_ARMED`、`pendingSaveMinionUids`、`filterProtectedReturnEvents()`、`processDestroyMoveCycle()`、`processAffectTriggers()` 等整套 destroy/save/replacement 流程增强。
- 同时保留本地 `actionTargetType` 透传给基地 `onActionPlayed` 的修复。
- 合并后额外补了一个回归修复：`processDestroyTriggers()` 在 replacement / reaction 的 `onMinionDestroyed` 上下文里补传 `destroyerId`，避免“跳过防止消灭”后丢失击杀归属，导致 `destroyedMinionByPlayersThisTurn` 不更新。
- 原因：这是本次 merge 后唯一跑出来的真实回归，直接影响 `Nightstalker POD` 等依赖“本回合是否消灭过随从”的能力判断。

## 4. 风险评估
- Cardia 风险点：移动端壳层和桌面基线同时存在，后续若再改卡牌尺寸，必须继续遵守“桌面固定、受限视口再降级”。
- SmashUp 风险点：`onMinionDestroyed` 的 replacement / deferred / reaction 链较长，后续新增“防止消灭”类交互时，必须继续透传 `destroyerId` / `reason` / `continuationContext`。
- 并发工作区风险：工作区中仍有未暂存的 Toast / socket 相关并发修改，本次未纳入 merge commit。

## 5. 验证与结果

### 已通过
- `npx tsc --noEmit`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/__tests__/mobileSupport.test.ts src/games/cardia/ui/__tests__/encounterFlipState.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/elderThingsPod.test.ts src/games/smashup/__tests__/madnessAbilities.test.ts src/games/smashup/__tests__/vampiresPod.test.ts --configLoader native`
- `npm run test:e2e:ci:file -- e2e/cardia/cardia-smoke-test.e2e.ts`
- `npm run test:e2e:ci:file -- e2e/cardia/mobile-orientation.e2e.ts`

### 补充说明
- `npm run test:changed` 未作为最终门禁结果使用：该命令在当前仓库日志输出量下超时并触发 `EPIPE`，未收敛到有效失败结论，因此改为更小粒度的定向回归。
- 已自审截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-smoke-test.e2e\手机横屏布局应完整展示战场与手牌\cardia-mobile-landscape-layout.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-smoke-test.e2e\手机竖屏布局应完整展示战场与手牌\cardia-mobile-portrait-layout.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\cardia\cardia-smoke-test.e2e\平板横屏布局应完整展示战场与手牌\cardia-tablet-landscape-layout.png`
- 自审结论：桌面与平板卡牌尺寸未被整体缩小；手机横竖屏均能同时看到战场和手牌区域，未出现整页缩放或主区域被弃牌堆挤压。

## 6. 提交信息
- merge 提交: `1cda3ffc Merge origin/main into main`
- push 目标: `origin/main`
