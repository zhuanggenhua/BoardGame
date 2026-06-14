## ADDED Requirements

### Requirement: Smash Up runtime SHALL expose normalized effect semantics for board objects
Smash Up runtime SHALL provide normalized semantic descriptors for board objects and continuous sources, including runtime identity, controller lens, relation to querying player, and variant/copied/borrowed normalization, so business code does not need to infer meaning by scanning raw collections or comparing ad hoc ids.

#### Scenario: Borrowed attached action uses shared controller semantics
- **GIVEN** 一张附着行动牌保留真实 owner，但当前由另一名玩家控制
- **WHEN** ability 或 modifier 查询“由某玩家控制的行动牌”
- **THEN** runtime SHALL 通过共享 semantic descriptor 解析该控制关系
- **AND** 业务实现 SHALL NOT 再局部拼接 `ownerId`、`sourceControllerId` 或等价字段来重建语义

### Requirement: Smash Up target-affecting effects SHALL use mandatory semantic application gateways
凡是会改变对象状态、合法目标可用性或持续规则结果的 Smash Up 效果，例如 destroy、move、return、control、attach、detach、power/breakpoint modifier 与 suppression，运行时 SHALL 通过统一 semantic application gateway 执行，而不是允许每个能力或 modifier 自己决定保护、阻断或跳过逻辑。

#### Scenario: Action-sourced control effect respects shared blockers
- **GIVEN** 一张行动牌尝试获得对手随从的控制权
- **WHEN** 运行时解析并应用该效果
- **THEN** 系统 SHALL 通过统一 gateway 处理该 `control/affect` 语义
- **AND** 受相关保护或阻断约束的目标 SHALL 被一致地跳过或拦截

### Requirement: Smash Up semantic queries SHALL distinguish target, material, and reference roles
Smash Up runtime SHALL 将语义查询至少区分为 `target`、`material` 与 `reference` 三类角色，避免“不能被影响”错误地扩散成“不能被计数、匹配、复制或作为上下文引用”。

#### Scenario: Protected card still counts as material when only used for counting
- **GIVEN** 一个持续效果只是在统计某张随从上的匹配附着牌数量
- **AND** 其中一张附着牌若被针对时会受到保护
- **WHEN** runtime 执行这条 count-only 查询
- **THEN** 该附着牌 SHALL 继续作为 `material` 被计入
- **AND** 只有当另一个效果真正试图影响该牌时，才必须经过 target-affecting gateway

### Requirement: New Smash Up abilities and modifiers MUST express semantic intent through shared selectors
新实现或迁移中的 Smash Up abilities / modifiers MUST 通过共享 semantic selector 或等价 runtime query helper 表达“查询什么对象、以什么语义读取”，而不是直接扫描 `base.minions`、`attachedActions`、`ongoingActions` 并把 controller / protection / variant 规则手写在业务文件里。

#### Scenario: New modifier uses shared selector for friendly minions
- **GIVEN** 一个新 modifier 需要查询“本基地其他己方随从”
- **WHEN** 开发者实现该 modifier
- **THEN** 该实现 MUST 使用共享 semantic selector 或等价 runtime query helper
- **AND** MUST NOT 直接通过 raw collection 扫描并手写语义过滤作为默认路径

### Requirement: Missing semantic paths SHALL fail fast instead of silently permitting bypass
当新增效果类型或新增查询意图缺少对应的 semantic selector / gateway / validation path 时，runtime、注册期校验或测试门禁 SHALL 失败，而不是默认允许业务层再发明一条 ad hoc 路径。

#### Scenario: New target-affecting helper without semantic classification fails validation
- **GIVEN** 一条新增 helper 直接修改目标对象，但没有声明其 semantic effect type 或接入共享 gateway
- **WHEN** 运行对应校验或测试门禁
- **THEN** 该实现 SHALL 失败并报告缺失的 semantic path
- **AND** MUST NOT 依赖人工记忆来保证后续不再绕路
