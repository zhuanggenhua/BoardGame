## Context

Smash Up 当前的变体体系同时依赖：

- 数据层 `_pod` id 与 POD 基地覆盖定义
- `abilityRegistry` / `abilityInteractionHandlers` / `ongoingEffects` / `baseAbilities` 的自动 `_pod` alias
- 局部显式 `_pod` 覆写、no-op 截断与 `baseOnly` / `override` 例外
- 基地池白名单 `POD_BASE_POOL_VARIANT_FACTIONS`

结果是：同一个“经典版与 POD 的关系”被拆成多份暗规则。米斯卡塔尼克大学问题证明，当前架构允许“选基层 / registry 层 / 行为层”分别持有不同真相，从而出现：

- 经典版 id 绑到 POD 语义实现
- POD 版继续拿经典版基地 id
- 经典版 surface 被动泄漏到 POD

## Goals / Non-Goals

- Goals:
  - 把 Smash Up 变体绑定收敛为一份显式元数据
  - 禁止各 registry 在未声明语义时隐式生成 `_pod` alias
  - 让 base pool、ability、interaction、ongoing、base ability 共享同一份变体真相源
  - 增加强校验，阻止“经典版 id 绑 POD 语义”这类错误静默进入运行时
  - 保留复杂效果执行在代码里，不重写整套 Smash Up 效果 runtime
- Non-Goals:
  - 不把所有卡牌效果改成纯数据 DSL
  - 不在本次变更里重写所有 Smash Up 规则实现
  - 不立即把这套变体绑定 seam 推成跨游戏通用引擎层

## Decisions

### Decision: 用显式变体绑定元数据替代隐式 alias 猜测

新增一份统一的 Smash Up 变体绑定元数据，由它声明每个经典版 / POD 家族在各条 surface 上的关系。

建议的 surface 至少包括：

- `ability`
- `interaction`
- `ongoing`
- `baseAbility`
- `powerModifier`
- `basePool`

每条 surface 的语义显式限定为：

- `shared`
- `separate`
- `baseOnly`
- `podOnly`

runtime 只允许读取这份元数据做路由；不再允许“因为 `_pod` 没注册，所以先猜它和经典版相同”。

### Decision: 共享实现仍允许存在，但必须通过 metadata 明示

这次不是禁用“共享代码”，而是禁用“未声明就默认共享”。

允许的模式：

- 经典版与 POD 完全一致：metadata 声明 `shared`，`_pod` surface 可以复用经典版实现
- 经典版与 POD 时机 / 语义不同：metadata 声明 `separate`，base 与 `_pod` 必须各自显式注册
- 只有经典版存在该语义：metadata 声明 `baseOnly`
- 只有 POD 存在该语义：metadata 声明 `podOnly`

这样可以保留现在大量“语义相同就共用 handler”的代码收益，但去掉“作者忘记写 `_pod` 时框架替你猜”的 footgun。

### Decision: 基地池变体也纳入同一份元数据

当前 POD 派系是否切到 `_pod` 基地 id 由零散白名单控制，这与行为层变体关系是同一个问题，不应继续拆开。

因此：

- `basePool` 也必须读取同一份变体绑定元数据
- POD 派系若声明 `basePool: separate`，则必须只返回 `_pod` 基地 id
- 经典版若声明 `basePool: separate`，则必须只返回经典版 id

这能直接堵住“POD 派系拿经典基地 id，表面看起来像经典版出了 POD 效果”的混淆链路。

### Decision: 启动期 / 测试期强校验必须成为硬门禁

光靠元数据存在还不够，必须增加硬校验，至少覆盖：

1. 某个存在 base / `_pod` 双变体的 family，缺少显式 metadata
2. metadata 声明 `separate`，但 runtime surface 只注册了一边
3. metadata 声明 `baseOnly` / `podOnly`，但另一边仍生成了 alias
4. `basePool` 声明 `separate`，但选基仍返回了错误变体 id

这样错误会在初始化或测试阶段直接炸掉，而不是等用户在牌桌上撞出来。

### Decision: 先把“变体绑定”数据驱动，不把“效果执行”一起 DSL 化

用户提出“直接改数据驱动”是对的，但本次只把以下内容数据驱动：

- 变体 family
- surface 关系
- base pool 变体选择
- 校验规则

复杂效果执行函数仍保留在代码里：

- 连续 prompt
- 动态目标
- queued trigger / LKI / frame-owned 运行时
- 计分后延迟结算

这样可以先解决当前最大的结构性风险，而不是把整个 Smash Up 引擎一次性推翻成 DSL。

## Risks / Trade-offs

- 风险：如果 metadata 只覆盖少数特例，剩余 family 仍会偷偷走旧的默认继承路径。
  - Mitigation: 对存在 `_pod` 变体的 family 增加“未声明即失败”的硬门禁。
- 风险：一次性迁移所有 surface 可能牵连太大。
  - Mitigation: 先用统一 metadata seam 覆盖 registry 入口，再按 family 渐进迁移实现绑定。
- 风险：base pool 与行为 surface 同时收口，短期会暴露更多历史问题。
  - Mitigation: 这是期望行为；优先让错误尽早暴露，而不是继续靠静默 fallback 掩盖。

## Migration Plan

1. 定义 Smash Up 变体绑定元数据与 surface 读取 helper
2. 让 ability / interaction / ongoing / base ability registry 改读 metadata，关掉隐式默认 alias
3. 让 base pool 也改读 metadata，替换零散白名单
4. 先迁移米斯卡塔尼克大学与已知差异家族，补定向回归测试
5. 对未声明 metadata 的 POD family 打开硬校验，再继续补全剩余家族

## Open Questions

- metadata 更适合放在 `cards.ts` 邻近，还是单独放在 `variantBindings.ts` 真相表？
  - 倾向先用单独真相表，减少对海量卡牌定义文件的侵入。
- power modifier 是否在首波一并切到同一 metadata，还是继续沿用现有 `variantPolicy` 再桥接？
  - 倾向首波兼容桥接：先让 registry 统一读 metadata，再逐步把 modifier authoring 与旧 `variantPolicy` 合流。
