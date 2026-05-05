# DiceThrone 提交 `7b8ccd5e` 通用弹窗栈专项审查

## 审计范围

- 提交：`7b8ccd5ec42b827e71edf3a1edeca29c8ec07a80`
- 文件：
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/ui/BoardOverlays.tsx`
  - `src/games/dicethrone/domain/systems.ts`
  - `src/contexts/ModalStackContext.tsx`

## 结论等级

- 仍有残余范围

## 审计目标

- 核对这次“通用弹窗栈重构”是否还有与 `Loaded choice -> BonusDieOverlay` 同型的问题。
- 重点检查：
  - 已进入 `sys.interaction` / `responseWindow` 的阻塞交互，是否全部通过 `useSyncedModalStackEntry` 接入通用栈。
  - 是否仍有交互型 overlay 在 `BoardOverlays` 内旁路直渲染。

## 权威来源

- 本次提交 diff：`git show 7b8ccd5e -- src/games/dicethrone/Board.tsx src/games/dicethrone/ui/BoardOverlays.tsx`
- 当前领域交互入口：`src/games/dicethrone/domain/systems.ts`
- 当前 ModalStack 契约：`src/contexts/ModalStackContext.tsx`

## 逐项结论

### 1. `dt:bonus-dice` 未接入通用弹窗栈，属于已证实同型 bug

- 领域层在 `BONUS_DICE_REROLL_REQUESTED` 时已经创建 `kind: 'dt:bonus-dice'` 的阻塞交互。
- 但 `7b8ccd5e` 只把 `TokenResponseModal`、`InteractionOverlay`、`ChoiceModal` 迁到 `useSyncedModalStackEntry`，`BonusDieOverlay` 仍在 `BoardOverlays` 中直接按 `pendingBonusDiceSettlement` 渲染。
- 这意味着：
  - 系统层有阻塞交互实体；
  - UI 层却没有把它作为栈条目管理；
  - 因而会出现“栈内弹窗未退场，栈外奖励骰先出现”的越栈问题。
- 证据层级：
  - L1：`src/games/dicethrone/domain/systems.ts` 中创建 `dt:bonus-dice`
  - L1：`src/games/dicethrone/ui/BoardOverlays.tsx` 中直渲染 `BonusDieOverlay`
  - L2：本轮已补回归测试 `BonusDieOverlay.test.tsx`，证明 choice 在前景时必须压住奖励骰 overlay

### 2. `compare-roll-choice` 仍在栈外直渲染，属于同型残余风险

- `compare-roll-choice` 本质也是 `sys.interaction.current` 的正式交互类型。
- `Board.tsx` 通过 `asCompareRollChoice(sysInteraction)` 取出数据后，直接交给 `BoardOverlays.tsx` 中的 `CompareRollOverlay` 渲染。
- `7b8ccd5e` 没有为它创建 `useSyncedModalStackEntry` 条目。
- 这与 `dt:bonus-dice` 属于同一类架构问题：
  - 共享交互系统里有阻塞交互；
  - UI 却没统一进 modal stack。
- 当前尚未拿到明确用户复现，但从结构上看，它和 `Loaded choice -> reward die` 是同源风险，不应继续留在栈外。
- 证据层级：
  - L1：`src/engine/systems/CompareRollChoiceSystem.ts`
  - L1：`src/games/dicethrone/ui/BoardOverlays.tsx` 中直渲染 `CompareRollOverlay`

### 3. 这次迁移当时没有补 `owner`，属于“栈只接了渲染层、没接 ownership”的半迁移

- `7b8ccd5e` 新增的 `tokenResponseModalEntry`、`statusInteractionModalEntry`、`choiceModalEntry` 只有 `entryId/render/onClose`，没有 `owner`。
- `owner` 后来在 `f33bc4eb` 才补进来。
- 这说明 `7b8ccd5e` 当时的“通用栈重构”并未完整接入 resolution owner 语义，只完成了视觉渲染迁移。
- 当前代码中 `owner` 缺失的直接运行时后果没有单独复现到用户问题位点，但这是明显的结构不完整证据。
- 证据层级：
  - L1：`git show 7b8ccd5e -- src/games/dicethrone/Board.tsx`
  - L1：`git show f33bc4eb -- src/games/dicethrone/Board.tsx`

## 未命中项说明

- `MagnifyOverlay`、`CardSpotlightOverlay`、`EndgameOverlay` 本轮未记为同型问题。
- 原因：
  - 它们不依赖 `sys.interaction` / `responseWindow` 作为权威阻塞源；
  - 当前没有证据表明它们被错误建模成阻塞交互却又绕过栈。

## 命中的审计维度

- D3 数据流闭环
- D5 交互完整
- D8 时序正确
- D23 共享抽象边界
- D43 系统职责边界

## 验证与证据

- 静态审查命令：
  - `git show 7b8ccd5e -- src/games/dicethrone/Board.tsx src/games/dicethrone/ui/BoardOverlays.tsx`
  - `rg -n "useSyncedModalStackEntry|CompareRollOverlay|BonusDieOverlay|pendingBonusDiceSettlement|compareRoll" src/games/dicethrone`
  - `rg -n "dt:bonus-dice|compare-roll-choice" src/games/dicethrone src/engine`
- 已存在的回归验证：
  - `node scripts/infra/vitest-cli-safe.mjs run --configLoader native src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx -t "前景交互存在时应压住奖励骰覆盖层"`

## 结论

- `7b8ccd5e` 里已证实还有 1 个同型 bug：`dt:bonus-dice` 绕过通用弹窗栈。
- 同时还留有 1 个同型残余风险：`compare-roll-choice` 仍在栈外。
- 这次提交应定性为“通用弹窗栈迁移不完整”，而不是“栈化已收口，仅有单点显示 bug”。
