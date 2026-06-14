## Context
当前 DiceThrone 已经有三套相关能力：

- `InteractionSystem` 负责阻塞交互队列。
- `ModalStack` 负责前台栈。
- `Board.tsx` 已把一部分阻塞 UI 同步到全局 modal stack。

问题不在“有没有栈”，而在“什么语义该进哪条通道”没有被严格定义。

最典型的混叠是：

- `targetingRoll` 的手选受击者，本质是攻击主链的一段专用目标确认，却被包装成 `CHOICE_REQUESTED -> simple-choice`。
- `compare-roll-choice` 与交互型 `dt:bonus-dice` 本质会阻塞业务推进，但仍走独立 overlay 通道，导致和 modal stack 抢前台。

## Goals
- 给 DiceThrone 建立稳定的交互语义边界，避免再把不同职责塞进 `simple-choice`。
- 让阻塞式前台默认走 modal stack，而不是靠局部 suppress 条件避免互抢。
- 让“攻击主链正在等什么”在类型和 UI 上都能直观看出来。

## Non-Goals
- 不把所有展示型 spotlight 都强行改成 modal。
- 不在本轮重写整个 InteractionSystem 或 ModalStack 框架。
- 不把 1v1 普通分支选择、状态选择、玩家多选的业务语义混成一个大一统新类型。

## Decisions

### 1. 受击者选择使用专用交互，不再复用 simple-choice
- `targetingRoll` 的 5/6 手选目标属于“攻击主链中的受击者确认”。
- 它不再通过 `CHOICE_REQUESTED` 伪装成通用 `simple-choice`。
- 新交互类型只表达一件事：为当前 `pendingAttack` 选择 defender。

结果：
- `useCurrentChoice()` 继续只服务真正的 `simple-choice`。
- DiceThrone UI 为该交互提供单独 modal，而不是继续借用通用 ChoiceModal。

### 2. simple-choice 只保留通用分支语义
- `simple-choice` 仅表示：
  - 按钮分支选择
  - token/status 通用选项选择
  - slider/数值型通用确认
- 它不再承载“攻击主目标选择”“业务主链中的专用目标确认”。

### 3. 阻塞式前台默认必须走 modal stack
- 只要某个前台 UI 满足以下任一条件，就视为阻塞式前台：
  - 对应 `sys.interaction.current`
  - 对应 `responseWindow.current`
  - 关闭/确认前业务链不能继续推进
- 这类前台默认必须通过 modal stack 承载。

本轮至少覆盖：
- `compare-roll-choice`
- 非 `displayOnly` 的 `dt:bonus-dice`
- `dt:defender-choice`

### 4. 纯展示 spotlight 允许留在 overlay 通道
- 如果前台只负责展示结果，不拥有业务确认权，也不会阻塞主链推进，则可以保留 overlay/spotlight。
- `displayOnly` bonus die 仍属于这一类。

### 5. 旧式防回归策略从“局部 suppress”改成“语义拆分 + 默认栈化”
- 可以保留必要的 suppress 作为视觉降噪，但它不再承担主修复职责。
- 主修复职责来自：
  - 独立交互类型
  - 独立 modal stack entry
  - 明确的 owner / blocksProgress 语义

## Risks / Trade-offs
- 现有 AI、测试、command validation 都默认把 targetingRoll 5/6 当作 `simple-choice`，需要同步更新。
- DiceThrone 当前存在 `src/` 与 `e2e/src/` 镜像代码，改动必须保持一致。
- 若只改 UI 栈而不改交互语义，误弹选择问题仍会以别的形式重现；因此本轮必须同时动语义层和前台层。

## Migration Plan
1. 新增 dedicated defender-choice 交互与对应请求/解决事件。
2. 从 targetingRoll 流程中移除 `CHOICE_REQUESTED(targeting-roll)`。
3. 在 Board 中增加 defender-choice / compare-roll / bonus-dice 的 stack entry。
4. 更新通用规范与现有 DiceThrone 测试。
