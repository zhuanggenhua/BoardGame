## Context
控制流主链已经不是这次的阻塞点。`0b50a89c` 之后，真正还没收束的是**能力执行模型**。

现状里同一个 Smash Up 能力可能分散在四处：

1. 注册点：`registerAbility` / `registerTrigger` / `registerBaseAbility`
2. 初始执行：直接返回 `events`，或直接 `queueInteraction`
3. 交互续链：`registerInteractionHandler`
4. 运行时上下文：`continuationContext` / `optionsGenerator` / deferred payload

这会造成两个直接问题：

- 无法只看一个对象就知道能力会不会改变合法结算结果、会不会开交互、会不会影响顺序；
- 即使 frame 主链已经统一，能力层仍然保留着第二套“局部流程引擎”。

本设计的目标是把能力输出改成**声明式程序**，让解释器负责把程序绑定到 resolution frame 上执行。

## Goals / Non-Goals
- Goals:
  - 把 Smash Up 能力 contract 收束为声明式 `ability program`
  - 让 prompt / flow / system bridge 成为 ability program 的一部分
  - 让 queued trigger / base ability 入口只认统一 runtime contract
  - 对缺失 executor、非法 runtime 输出、未声明 bridge 的情况直接 fail-fast
- Non-Goals:
  - 本轮不一次性迁完 396 个 `registerAbility`
  - 本轮不为旧 handler 链再包装一层长期兼容桥
  - 本轮不继续发明“按卡手写 footprint 兜底”的新债务

## Decision 1: Ability program 是能力唯一输出
每个可被运行时消费的 Smash Up 能力，最终都必须编译成 `ability program`。

最小程序节点：

- `effect`
  - 纯领域效果，生成确定性事件或 frame follow-up
- `prompt`
  - 声明一个需要玩家选择的输入步骤
  - prompt 自带 frame owner、选项生成、提交解码规则
- `sequence`
  - 顺序执行多个子节点
- `branch`
  - 根据上下文 / 最新状态决定走哪条分支
- `stop`
  - 显式结束
- `bridge`
  - 调用运行时内建的系统桥，例如 deferred scoring、replacement、duel、synthetic play

这里的“解释器”是**新内核本体**，不是兼容层。兼容层的问题在于“旧写法仍然是第一真相”；这里不会允许旧写法继续成为新增入口。

## Decision 2: Prompt 不再由卡牌直接操作 interaction queue
旧模型：

- 能力代码 `queueInteraction`
- handler 再读 `continuationContext`
- handler 自己决定后续下一步

新模型：

- ability program 产出 `prompt`
- runtime 解释器把 prompt 绑定到当前 frame
- 玩家提交后，解释器把选择写回 ability program 上下文，再继续执行后续节点

结果：

- prompt 的 owner 一定是当前 frame
- continuation 不再散落在 handler 注册表
- runtime 可以在展示前与提交时统一重验候选

## Decision 3: Flow 与 bridge 必须内建，而不是留给卡牌拼 continuation
Smash Up 的复杂度不只在“发几个 event”，而在于：

- 有条件分支
- 链式提示
- 多步上下文传递
- 读取上一步结果
- 嵌套 system bridge

所以 runtime 必须内建：

- 顺序执行
- 分支
- 局部上下文槽位
- prompt 结果绑定
- bridge 调用

否则只是把 `queueInteraction` 换皮，不是真的去掉技术债。

## Decision 4: Fail-fast 分三层
### 注册期
- 重复注册、非法 program 结构、缺失必须字段，直接抛错

### 编译期
- 能力引用了未注册的 prompt decoder / bridge / output slot，直接抛错

### 运行期
- queued trigger 找不到 executor
- prompt 恢复时 frame owner 不匹配
- bridge 返回非法结果

以上都必须直接报错，不再静默忽略。

## Decision 5: 第一批改集中入口，不先横扫所有能力文件
最先改的点必须是“所有复杂链路都会经过的集中口”：

1. `triggerExecutors.ts`
2. `reactionSession.ts`
3. `baseAbilityQueue.ts`
4. `baseAbilities.ts`

理由：

- 这些地方是 queued trigger / base trigger / reaction frame 的统一汇合点；
- 改这里才能先把 contract 卡死；
- 直接去逐张改 abilities 文件，只会让新旧写法并存更久。

## Migration Shape
### Phase 1
- 加入 ability runtime 类型和解释器骨架
- 把 trigger/base queued executor 改成统一 runtime executor
- 缺 executor 改成抛错

### Phase 2
- 把 trigger/base ability 注册改成直接注册 program
- 先迁移低复杂度样板能力

### Phase 3
- 迁移 prompt-heavy 能力
- 删除 `registerInteractionHandler` 作为能力默认续链出口

## Risks / Trade-offs
- 如果本轮还保留“新 runtime + 旧 handler 默认可写”，会继续制造双重真相
- 如果一开始就要求全量迁卡，落地节奏会失控
- 如果不先让缺 executor 变成错误，很多遗漏会继续被静默掩盖

