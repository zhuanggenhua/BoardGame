# DiceThrone 维持/收入阶段自动推进

## 变更概述

在 `src/games/dicethrone/game.ts` 的 `onAutoContinueCheck` 中新增了 upkeep 和 income 阶段的自动推进逻辑。这两个阶段是纯自动结算（burn/poison/CP/抽牌），无需玩家操作。

## 自动推进行为

- **setup → upkeep**：已有逻辑，通过 `HOST_STARTED` 事件触发
- **upkeep → main1/income**：新增，通过 `SYS_PHASE_CHANGED` 事件检测进入 upkeep 后自动推进
- **income → main1**：新增，同上

## 关键技术细节：afterEventsRound 限制

`FlowSystem.afterEvents` 在 `afterEventsRound > 0` 时会传空 events 给 `onAutoContinueCheck`，防止事件在多轮中被误读。

这意味着：
1. `executePipeline` 执行单个命令时，自动推进链最多跨越 **一个阶段**
2. 例如 `discard → upkeep` 后，round 0 检测到 `SYS_PHASE_CHANGED` to upkeep → 自动推进到 income；round 1 events 为空 → income **不会**自动推进到 main1
3. `createInitializedState` 中 HOST_START_GAME 触发 setup → upkeep（round 0），但 upkeep → main1 在 round 1 不会触发

因此 `createInitializedState` 返回的状态仍然是 **upkeep**，测试中仍需手动 `cmd('ADVANCE_PHASE', '0')` 推进到 main1。

## 测试修改规则

| 场景 | 修改方式 |
|------|----------|
| 初始状态第一个命令 `// upkeep -> main1` | **保留**（初始状态是 upkeep） |
| 回合切换后 `// upkeep -> income` | **删除**（discard → upkeep 后自动推进到 income） |
| 回合切换后 `// income -> main1` | **保留**（income 不会自动推进，需手动） |
| 期望 `turnPhase` 在 `discard → upkeep` 后 | 改为 `'income'`（upkeep 自动推进到 income） |

## 教训

### 1. PowerShell 编码陷阱
使用 PowerShell 的 `-replace` / `Set-Content` / `Out-File` 修改含中文的 `.ts` 文件会导致 UTF-8 编码被破坏（PowerShell 默认使用 UTF-16/BOM）。必须使用 Node.js 脚本或编辑器工具（如 `strReplace`）进行修改。

### 2. afterEventsRound 对测试的影响
不能假设 `createInitializedState` 会完成整个自动推进链。`executePipeline` 的单次调用中，`afterEvents` 的多轮机制会限制自动推进的深度。测试中仍需手动推进 upkeep → main1。
