## ADDED Requirements

### Requirement: 领域真相边界必须显式分层
系统 SHALL 将 session context、entity lifecycle、interaction snapshot 和 presentation descriptor 视为不同层级的领域事实，并为每一层定义清晰边界。

#### Scenario: 当前决策者与对象归属被分别建模
- **GIVEN** 某条规则既依赖“当前轮到谁”也依赖“对象真实归属/控制关系”
- **WHEN** 系统执行该规则
- **THEN** 系统 MUST 能分别读取 session context 与 entity lifecycle 真相
- **AND** MUST NOT 把当前活跃玩家自动等同于对象控制者、拥有者或默认终点

#### Scenario: 交互展示模式不再由业务 payload 猜测
- **GIVEN** 某个交互同时携带业务对象引用与展示提示
- **WHEN** 共享 UI 渲染该交互
- **THEN** UI MUST 依据独立的展示描述决定渲染模式
- **AND** MUST NOT 仅因 payload 内出现 `defId`、`baseDefId` 或类似字段就改变交互语义

### Requirement: 领域对象必须具有稳定身份与独立 provenance
系统 SHALL 将“对象身份”“真实归属”“当前控制/持有/宿主”和“默认终点”视为独立领域事实，而不是把它们隐含在当前容器或当前玩家上下文里。

#### Scenario: 对象临时改变持有者或控制者
- **GIVEN** 某个领域对象具有稳定身份，并且在生命周期中可能被其他玩家临时持有、控制或代为结算
- **WHEN** 规则只改变该对象的运行时持有者、控制者或宿主
- **THEN** 系统 MUST 保留该对象原有的真实归属 provenance
- **AND** MUST NOT 把当前持有者、当前控制者或当前宿主自动视为该对象的真实归属

#### Scenario: 对象离开当前容器后仍需按 provenance 结算
- **GIVEN** 某个对象在离开当前区域、宿主或容器后仍需要进入默认终点
- **WHEN** 系统处理该对象的离场、回收、归区、重建或后续结算
- **THEN** 系统 MUST 依据该对象保存的 provenance 决定默认终点
- **AND** MUST NOT 仅依赖当前容器、来源玩家或当前活体上下文推断归属

### Requirement: 跨边界领域事件必须是自足事实
系统 SHALL 要求所有会让领域对象跨区、跨宿主、跨持有者或跨控制者边界的事件，能够在来源对象已不可见时仍被正确 replay 和 reduce。

#### Scenario: 来源对象已不可见时重放跨边界事件
- **GIVEN** 某条事件描述对象跨越了区域、宿主或持有者边界
- **AND** 事件处理时来源对象已经不再存在于可见活体容器中
- **WHEN** 系统回放或归约该事件
- **THEN** 事件 MUST 携带足够的对象引用或 provenance 信息，以便系统重建正确对象
- **AND** MUST NOT 依赖“先从当前 live state 里碰运气找回对象”作为唯一正确路径

#### Scenario: 同一事件序列在不同运行时环境下保持一致语义
- **GIVEN** 同一份初始状态和同一段跨边界事件序列
- **WHEN** 系统在不同运行时环境中回放该事件序列
- **THEN** 领域对象的归属、默认终点和重建结果 MUST 保持一致
- **AND** MUST NOT 因为某次运行时 live object 是否仍可见而改变事件语义

### Requirement: 延迟交互必须显式声明 snapshot 与 live-state 边界
系统 SHALL 要求所有跨阶段、跨清场、跨宿主变化或可能在交互解决前改变 live state 的交互，明确哪些字段按创建时快照保存，哪些字段允许在解决时重新读取 live state。

#### Scenario: 交互解决前 live state 已变化
- **GIVEN** 某个交互创建后，相关对象在解决前已经移动、离场、清场或被其他交互修改
- **WHEN** 系统解决该交互
- **THEN** 系统 MUST 依据该交互声明的 snapshot 边界读取创建时事实
- **AND** 只有被显式标记为 live lookup 的字段才可以重新读取当前状态

#### Scenario: 同类交互使用统一 snapshot seam
- **GIVEN** 多个游戏都存在 afterScoring、延迟响应或链式选择交互
- **WHEN** 这些交互在系统中建模
- **THEN** 系统 MUST 能通过统一 seam 表达 snapshot 与 live-state 边界
- **AND** MUST NOT 让每个游戏各自发明一套隐藏约定
