## ADDED Requirements

### Requirement: Smash Up Variant Binding SHALL Be Declared Explicitly
Smash Up 对存在经典版 / POD 双变体的卡牌与基地 family SHALL 通过显式变体绑定元数据声明各条 runtime surface 的关系，而不是在 `_pod` 未注册时隐式默认继承经典版实现。

#### Scenario: Shared variant family reuses base runtime only when metadata says shared
- **GIVEN** 某个经典版 / POD family 在 `ability` surface 上声明为 `shared`
- **WHEN** Smash Up runtime 初始化对应 registry
- **THEN** `_pod` surface MAY 复用经典版实现
- **AND** 这种复用 SHALL 只由该 family 的显式 metadata 决定

#### Scenario: Missing variant binding metadata fails initialization
- **GIVEN** 某个 Smash Up family 同时存在经典版 id 与 `_pod` id
- **WHEN** runtime 初始化需要为其建立变体路由
- **THEN** 若该 family 缺少显式变体绑定 metadata，系统 SHALL 失败并报告该 family
- **AND** SHALL NOT 静默回退到隐式 alias 生成

### Requirement: Smash Up Registries SHALL Isolate Base And POD Surfaces Unless Explicitly Shared
Smash Up 的 ability、interaction、ongoing 与 base ability registry SHALL 只在 metadata 明确声明 `shared` 时复用经典版 surface；否则 runtime MUST 将经典版与 POD 版视为隔离 surface。

#### Scenario: Separate variant family keeps classic and POD base abilities isolated
- **GIVEN** `base_miskatonic_university_base` family 在 `baseAbility` surface 上声明为 `separate`
- **WHEN** runtime 初始化基地能力注册
- **THEN** 经典版 id SHALL 只暴露经典版定义的触发时机与交互处理器
- **AND** POD id SHALL 只暴露 POD 定义的触发时机与交互处理器

#### Scenario: Base-only surface does not create a POD runtime entry
- **GIVEN** 某条 Smash Up surface 在 metadata 中声明为 `baseOnly`
- **WHEN** 对应 registry 初始化该 family
- **THEN** runtime SHALL 保留经典版 surface
- **AND** SHALL NOT 为 `_pod` 变体生成该 surface 的运行时入口

### Requirement: Smash Up POD Base Pools SHALL Resolve Exact POD Base IDs
当 Smash Up 选用 POD 派系时，基地池构建 SHALL 读取显式的变体绑定元数据，并返回该派系声明的 `_pod` 基地 id，而不是再回退到经典版基地 id。

#### Scenario: Miskatonic University POD uses POD base IDs
- **GIVEN** 选中的派系为 `MISKATONIC_UNIVERSITY_POD`
- **WHEN** 系统构建该派系的基地池
- **THEN** 结果 SHALL 包含 `base_miskatonic_university_base_pod` 与 `base_the_asylum_pod`
- **AND** SHALL NOT 返回 `base_miskatonic_university_base` 或 `base_the_asylum`

#### Scenario: Classic faction still uses classic base IDs
- **GIVEN** 选中的派系为 `MISKATONIC_UNIVERSITY`
- **WHEN** 系统构建该派系的基地池
- **THEN** 结果 SHALL 包含 `base_miskatonic_university_base` 与 `base_the_asylum`
- **AND** SHALL NOT 返回对应的 `_pod` 基地 id

### Requirement: Smash Up Variant Binding Validation SHALL Reject ID-To-Surface Drift
Smash Up 初始化与测试验证 SHALL 能识别“经典版 id 绑定到 POD-only 语义”或“POD family surface 漂移到错误 id”这类变体绑定错误，并在运行前阻断。

#### Scenario: Classic ID cannot bind a POD-only timing by accident
- **GIVEN** 某个 family 的 metadata 声明经典版与 POD 版在 `baseAbility` surface 上为 `separate`
- **WHEN** 初始化发现经典版 id 只注册了 POD-only timing，而没有经典版 timing
- **THEN** 系统 SHALL 报告该 family 的变体绑定错误
- **AND** SHALL NOT 继续以隐式兼容模式启动

#### Scenario: POD base-pool drift is caught by validation
- **GIVEN** 某个 POD 派系在 metadata 中声明 `basePool` 为 `separate`
- **WHEN** 测试或初始化校验到其基地池仍返回经典版 id
- **THEN** 校验 SHALL 失败并指出错误的经典版基地 id
