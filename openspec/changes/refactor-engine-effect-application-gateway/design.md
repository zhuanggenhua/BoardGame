## Context
当前 `engine-primitives` 已经具备若干基础部件，但效果应用链仍停留在“游戏给一个 `EffectDef`，引擎按 `type` 找 handler”这一层。  
这对表达“怎么执行某种效果”够用，但对表达“这个效果何时可应用、何时失活、为什么被免疫、应用期间授予哪些 tags、哪些 tags 会移除它”不够。

Smash Up 这轮暴露出的结构性问题，本质上就是这一层缺位：游戏只能在业务里自己解释 effect application semantics。

用户给出的 `FantasyWord` GAS 插件层提供了清晰参考：

- `GameplayEffect`：静态定义
- `GameplayEffectSpec`：绑定 source/target/level/snapshot 的实例
- `GameplayEffectContainer.AddGameplayEffectSpec(...)`：唯一 apply 入口
- `GameplayTagAggregator`：动态 tags 与 effect active state 联动

我们不照搬 UE/GAS 的全部复杂度，但应吸收它的骨架。

## Goals
- 在 `engine-primitives` 提供跨游戏复用的 `EffectSpec` / apply gateway / tag-aware lifecycle 骨架。
- 让“required tags / blocked tags / immunity tags / granted tags / remove-with-tags”成为引擎统一能力。
- 保持实现为纯函数或显式容器/注册器，不引入全局单例。
- 为后续游戏接入提供明确默认路径，而不是继续鼓励“游戏作者手写 if”。

## Non-Goals
- 不在引擎层定义具体业务效果语义（如 destroy、heal、draw）。
- 不把单个游戏的保护规则直接搬成引擎常量。
- 不在本 change 内迁完所有游戏，只提供骨架与第一批验证。

## Decisions

### Decision: 在现有 `effects.ts` 之上增加 spec + apply 层，而不是直接推翻现有 dispatcher
理由：
- 现有 `effects.ts` 已有基础价值，适合作为“底层按 type 执行”的 primitive。
- 新的 apply gateway 需要的是“更高层的骨架”，不是把 dispatcher 本体删掉。

实现方向：
- 保留 `EffectDef` / handler registry
- 新增 `EffectSpec`、`EffectApplicationRules`、`AppliedEffectInstance`
- `applyEffectSpec(...)` 内部组合 tags + effect handlers

### Decision: tags 继续使用 game-scoped immutable container，不引入 ASC 风格全局组件
理由：
- 当前仓库以纯函数、不可变状态、按游戏自带 domain 为主，不适合直接照搬 Unity/MonoBehaviour 容器模型。
- 但“标签是一等公民”这一原则可以保留。

实现方向：
- `TagContainer` 仍按游戏持有
- gateway 接受外部传入的 `tagReader / tagWriter / targetSnapshot`
- 不依赖全局 manager

### Decision: apply 结果必须显式区分 accepted / blocked / inert
理由：
- 只返回“执行后 state + events”不够解释为什么没上效果。
- 后续 UI / 日志 / AI / 测试需要区分：
  - 被 required tags 拦住
  - 被 immunity/blocked tags 拦住
  - 已加入容器但当前 inactive

实现方向：
- 引入结构化 `EffectApplyResult`
- 至少包含 `outcome`、`reasons`、`grantedTagsDelta`、`events`

### Decision: 先做 generic lifecycle，不急着做所有 stacking 细节
理由：
- 当前最真实的框架缺口是“统一 apply gate + tag lifecycle”，不是复杂 stacking 策略。
- 先把 required/immunity/granted/remove-with-tags 建起来，收益最高。

实现方向：
- 第一批仅覆盖：
  - instant / persistent 两类
  - required tags
  - blocked/immunity tags
  - granted tags
  - remove-with-tags
- stacking 留给后续扩展

## Risks / Trade-offs
- 过早抽象可能做成另一套“没人用的通用层”。
  - 缓解：API 设计必须直接服务后续游戏接入，不做宏大 DSL。
- 如果只做引擎骨架，不给迁移样例，后续仍会回到各游戏手写。
  - 缓解：后续至少选择一个新游戏或一个轻量样例接入。
- 与现有 `systems` / domain 边界可能模糊。
  - 缓解：严格限定在 primitives 层，只做纯函数、容器、规则计算，不承接交互系统。

## Migration Plan
1. 先补 `engine-primitives` spec。
2. 新增 `EffectSpec` / apply gateway / 测试。
3. 保持老 `effects.ts` 可继续工作。
4. 后续再逐个游戏迁移到新入口。

## Open Questions
- 第一批是否要内建 stacking policy，还是留到下一条 change？
- 是否需要同时提供面向日志/AI 的 apply failure reason 枚举？
