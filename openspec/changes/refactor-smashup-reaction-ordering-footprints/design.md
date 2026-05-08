## Context

Smash Up 已经把 reaction queue / resolution frame 主链收束到统一 session，但 ordering 判定仍保留两个粗粒度旧债：

1. footprint 资源名过粗（尤其 `sourceState`）
2. mandatory frame 的 UI 投影按“整帧全量 trigger”输出

这会把本该自动收口的 singleton mandatory trigger 暴露成“可选顺序按钮”，让玩家看到没有业务意义的选择。

## Goals / Non-Goals

- Goals:
  - 让“只影响自身来源实例”的 trigger 不再因为共享占位资源名互相冲突
  - 让 mandatory frame 只对真正冲突的 trigger 集合打开排序 prompt
  - 保持现有 reaction queue / frame 模型，不再另造一套 ordering side state
- Non-Goals:
  - 本轮不重写所有 Smash Up ability program
  - 本轮不把所有 ordering atom 都升级为全新 DSL
  - 本轮不动 optional responder round 规则

## Decisions

### Decision 1: 自来源状态必须解析成实例级资源键

原来的 `sourceState` 把“来源牌自己的状态”建模成全局共享资源桶，这是错误的。

本轮改成：

- 声明层使用显式自来源语义（例如 `sourceSelfState`）
- queue/runtime 在 `TriggerInstance` 级别把它解析为 concrete resource key
  - 有 `sourceCardUid` → 绑定到该具体卡实例
  - 否则回退到 source base / source def 的稳定键

这样两张不同的《泛滥横行》各自自毁时，不会再互相冲突。

### Decision 2: mandatory frame 按冲突连通分量推进

当前做法只区分：

- 全帧都不冲突 → 自动收口
- 只要有任意一对冲突 → 整帧全部进 prompt

这会把与冲突无关的 singleton trigger 一起暴露给玩家。

本轮改成：

- 先基于 materialized footprint 建冲突图
- 再取当前 frame 的**第一个冲突连通分量**作为当前 mandatory resolution set
- singleton 分量自动执行，不进入 prompt
- `smashup_reaction_choose` 只展示当前分量里的 trigger

### Decision 3: 保持保守正确性，不凭空发明“默认不冲突”

没有 footprint 的 mandatory trigger 仍然按“无法证明独立”处理，不能偷偷 auto-collapse。

本轮的重点是：

- 去掉错误的宽资源桶
- 去掉整帧全量展示

而不是把“未知”误判成“安全独立”。

## Risks / Trade-offs

- 只修 `sourceState` 但不改 mandatory frame 展示，会继续出现“别的 trigger 冲突时，独立 trigger 仍被带进 prompt”的体验问题
- 只改 UI 不改 footprint 资源解析，则冲突图本身仍然错误
- 保守保留“缺 footprint = 不能证明独立”意味着仍可能保留少量历史 prompt，但这比把真实冲突静默吞掉更安全

## Migration Plan

1. 引入 reaction ordering helper，负责 materialize footprint 与 mandatory component partition
2. 替换 `reactionSession` 中旧的 pairwise auto-collapse 逻辑
3. 批量把 `sourceState` 改成新的自来源实例语义
4. 用《泛滥横行》+ 通用 ordering test 锁定行为
