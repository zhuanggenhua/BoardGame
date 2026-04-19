# SmashUp E2E Test - setupScene State Preservation Fix

## 问题描述

E2E 测试 `smashup-complex-multi-base-scoring.e2e.ts` 在运行时卡在加载屏幕，无法进入游戏。

## 根本原因

`e2e/framework/GameTestContext.ts` 中的 `setupScene` 方法在构建状态补丁时，只保留了部分 `core` 字段，导致关键字段（如 `turnOrder`、`baseDeck`、`nextUid` 等）在状态注入后丢失。

原始代码（第 631 行左右）：
```typescript
const patch: any = {
    core: {
        players: { ...state.core.players },
        bases,
        factionSelection: undefined,
    },
};
```

这种浅层结构会导致 `harness.state.patch(patch)` 覆盖整个 `core` 对象，丢失未显式列出的字段。

UI 组件 `src/games/smashup/Board.tsx` 检查 `!core.turnOrder || !core.bases` 时会显示加载屏幕，因为这些字段已丢失。

## 修复方案

修改 `e2e/framework/GameTestContext.ts` (约第 631 行) 以保留所有现有状态字段：

```typescript
const patch: any = {
    core: {
        ...state.core, // 保留所有现有字段
        players: { ...state.core.players },
        bases,
        ...(cfg.phase === 'factionSelect' ? {} : { factionSelection: undefined }),
    },
};
```

## 修复效果

- ✅ 保留所有 `core` 字段（`turnOrder`、`baseDeck`、`nextUid` 等）
- ✅ UI 不再卡在加载屏幕
- ✅ 测试可以正常进入游戏场景

## 相关文件

- `e2e/framework/GameTestContext.ts` - 修复位置
- `e2e/smashup-complex-multi-base-scoring.e2e.ts` - 受影响的测试
- `src/games/smashup/Board.tsx` - UI 加载检查逻辑
- `evidence/smashup-complex-multi-base-scoring-test-failure.md` - 原始失败报告

## 测试状态

**当前状态**：代码已修复，但测试因环境问题（端口占用/Playwright 配置）无法运行。

**下一步**：
1. 手动验证端口 6173 已释放
2. 运行测试：`npm run test:e2e:ci -- e2e/smashup-complex-multi-base-scoring.e2e.ts`
3. 验证测试通过且游戏正常加载
4. 查看测试截图确认功能正确

## 日期

2026-03-10

---

## 2026-03-10 后续验证结果

### 新发现的后续根因

在修复 `setupScene` 丢失 `core` 字段后，目标 E2E 不再卡在加载屏，但仍会出现新的流程问题：

- `scoreBases` 阶段打开 `afterScoring` 响应窗口后，
- `src/games/smashup/domain/index.ts` 的 `onAutoContinueCheck` 先检查了 `eligibleIndices.length === 0`，
- 而 `afterScoring` 窗口打开时，基地已经可能被 `BASE_CLEARED` / `BASE_REPLACED` 处理掉，
- 这会让 `eligibleIndices` 变成空数组，
- 从而错误触发自动推进，直接把流程一路推进到 `draw → endTurn → startTurn → playCards`，
- 最终留下“`afterScoring` 窗口本该暂停在 `scoreBases`，却被偷偷推进回下个回合”的异常。

### 追加修复

已在 `src/games/smashup/domain/index.ts` 中增加守卫：

- 只要 `state.sys.responseWindow?.current` 仍存在，
- `scoreBases` 阶段就必须继续等待响应，
- 不能再因为 `eligibleIndices` 为空而自动推进。

同时补充了领域层回归测试：

- `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`

新增断言覆盖：

- `afterScoring` 响应窗口打开时，
- 即使 `eligibleIndices` 已为空，
- `onAutoContinueCheck` 也必须返回 `undefined`。

### 测试结果

已实际运行并通过：

```bash
npx vitest run src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts
npm run test:e2e:ci -- e2e/smashup-complex-multi-base-scoring.e2e.ts
```

其中目标 E2E 最终结果为：

- `1 passed`
- 关键日志显示推进后状态为 `phase: 'scoreBases'`
- `afterScoring` 首次 `PASS` 后，流程稳定落到对手的 `playCards`

### 截图证据与分析

#### 1. 场景注入成功

截图：

- `test-results/smashup-complex-multi-base-6bc04-基地计分后-afterScoring-响应窗口正常打开-chromium/01-scene-ready.png`

截图分析：

- 左侧基地显示总力量 `13 / 12`，说明测试场景中的计分基地已经正确达标。
- 左下区域能看到玩家 0 的 2 个场上随从，右侧圆形按钮为 `Finish Turn`，说明页面已成功进入正常对局而不是加载/选派系界面。
- 右上角计分板仍为 `0 : 0`，符合“尚未结算基地计分”的预期。

#### 2. afterScoring 响应窗口正确打开

截图：

- `test-results/smashup-complex-multi-base-6bc04-基地计分后-afterScoring-响应窗口正常打开-chromium/04-after-scoring-open.png`

截图分析：

- 中央明确出现 `AFTER SCORING RESPONSE` 浮层，且 `PASS` 按钮可见，说明目标交互已经真实渲染到 UI。
- 左上角阶段标签已从 `Play` 变为 `Score`，说明流程正确停在 `scoreBases`。
- 右上角分数变为 `2 : 0`，说明基地计分已经结算，随后进入 `afterScoring` 响应窗口。
- 浮层底部显示当前轮到 `YOU` 响应，且旁边的手牌数量标记为 `1`，与测试构造的 1 张 `afterScoring` 特殊行动牌一致。

#### 3. 玩家 PASS 后，窗口关闭并自动进入下家回合

截图：

- `test-results/smashup-complex-multi-base-6bc04-基地计分后-afterScoring-响应窗口正常打开-chromium/05-p0-passed-after-scoring.png`

截图分析：

- 中央浮层已消失，说明 `afterScoring` 响应窗口被成功关闭。
- 左上角回合标签显示 `OPP / Play`，说明流程没有卡死，而是顺利完成 `scoreBases → draw → endTurn → startTurn → playCards` 自动链路。
- 右上角分数仍保持 `2 : 0`，说明本次计分结果被正确保留，没有因为自动推进而回滚或重复结算。

#### 4. 最终稳定状态

截图：

- `test-results/smashup-complex-multi-base-6bc04-基地计分后-afterScoring-响应窗口正常打开-chromium/06-final-state.png`

截图分析：

- 最终画面与第 3 张截图保持一致，说明状态已经稳定停在对手的 `playCards`，不是短暂闪过。
- 页面上不存在任何响应窗口、交互框或加载遮罩，证明本次修复后的最终状态可正常继续游戏。
- 右上角分数仍为 `2 : 0`，符合“玩家 0 赢得该基地 2 分”的预期。

### 备注

- 同目录下的 `test-failed-1.png` / `error-context.md` 为此前失败运行遗留产物；项目配置 `preserveOutput: 'always'` 会保留历史结果，最新通过截图以上述 4 张为准。
