## Context
第一批 `effectApplication` 已经把“统一 apply 入口”立住了，但现在还偏向最小骨架。

要继续接近正常 GAS，有两个真实缺口：

- `stacking` 还停留在业务外部自己决定
- `granted tags` 缺少 instance/source ownership

这两个问题如果不进 primitives，后续任何一个需要持续 buff / debuff / aura / cooldown / stance 的新游戏，都会再次在游戏层重复写生命周期框架。

## Goals
- 为 persistent effect 增加统一 stacking policy 表达。
- 让 granted tags 的授予与移除可以按 effect instance/source 精确回收。
- 让 lifecycle transition 结果可机读，便于后续日志/UI/测试直接消费。

## Non-Goals
- 不实现属性捕获、periodic execution、ability grant 全家桶。
- 不强迫当前所有游戏立刻迁移。
- 不引入全局 manager 或 class-heavy 容器模型。

## Decisions

### Decision: stacking 作为 EffectSpec/instance 原语的一部分进入 apply gateway
理由：
- 这是 effect lifecycle 的核心，不应该继续由业务自己在 gateway 外部拼装。
- 如果 stacking 仍然在游戏层，每个游戏都会重新定义“新来一个同类效果时怎么办”。

方向：
- 至少支持：
  - `none`
  - `aggregate_by_target`
  - `aggregate_by_source`
- 至少支持：
  - 层数刷新
  - 持续时间刷新
  - 生命周期结果返回“新建 / 刷新 / 拒绝叠加”

### Decision: granted tags 必须带 source/instance ownership
理由：
- 仅按 tag/stacks 回收，无法保证多个同类 source 共存时的精确性。
- 这会直接影响 aura、cooldown、stance、temporary immunity 这类常见模式。

方向：
- effect instance 持有自己授予的 tag ownership 信息
- 回收时按 instance/source 移除
- 不误删其他实例仍在维持的 tag

### Decision: 继续保持纯函数 / game-scoped 容器
理由：
- 当前仓库整体架构仍偏纯函数和显式状态传递
- 不适合突然切成 Unity ASC/MonoBehaviour 模式

方向：
- 在 primitives 内继续用显式 state/context/result 表达
- 若需要辅助 ownership 容器，也应显式存在于游戏状态或 effect state 中

## Risks / Trade-offs
- lifecycle 原语继续扩张，可能做成另一套复杂框架。
  - 缓解：只做 stacking + ownership 这两块必要能力，不扩到全量 GAS。
- 如果 ownership 建模不稳，会让 tag 容器复杂度明显上升。
  - 缓解：优先最小化表达，只覆盖 effect-granted tags，不一次性改所有 tag 来源。

## Migration Plan
1. 扩展 `engine-primitives` spec。
2. 在 `effectApplication.ts` 加入 stacking/ownership 原语。
3. 增补 primitive tests。
4. 后续再选择一个新游戏或轻量样例优先接入。
