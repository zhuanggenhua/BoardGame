## Context
Smash Up 现在已经有一部分共享 helper，但这些 helper 还没有成为“唯一合法路径”。

当前真实问题不是单张牌漏判保护，而是运行时缺少统一 semantic layer：

- 目标过滤和效果应用并没有同一个引擎 owner
- target / material / reference 三类语义混在一起
- business code 仍可以直接扫描 `base.minions`、`attachedActions`、`ongoingActions`
- protection、controller lens、borrowed / copied、POD 归一仍可在各文件重复解释

结果是：

- 同一条规则语义会在目标选择、modifier 计数、事件后处理里重复出现
- 已经有统一 helper 的地方也无法阻止后续实现绕过
- 新派系和新游戏会继续把“记得调用哪个 helper”当作作者责任，而不是框架责任

## Current Evidence
当前代码已经呈现出“局部统一 + 全局可绕过”的状态：

- `ongoingEffects.ts`
  - 已有 `isMinionProtected(...)`
  - 说明“保护查询”已经开始集中
- `abilityHelpers.ts`
  - 已有 `buildMinionTargetOptions(...)` 和 `buildValidatedDestroyEvents(...)`
  - 说明“目标过滤/应用前合法化”已经有共享入口雏形
- `reducer.ts`
  - 已对 destroy / move 后处理做保护拦截
  - 说明项目已经承认“最终应用效果时还需要统一收口”
- `ongoingModifiers.ts`
  - 仍存在 `filterRuntimeMatchedActions(...)` 这类 raw 扫描 helper
  - 并把“匹配对象”和“material 语义”揉在 modifier 私有实现里
- `kitty_cats.ts`、`ongoing_modifiers.ts`
  - 仍直接枚举随从/附着/ongoing 并手写 protection、controller 或计数逻辑

因此本提案不是从零发明一个新层，而是把已经零散存在的统一入口，正式收口成框架职责。

## Goals
- 让 Smash Up effect semantic runtime 成为目标发现、材料查询、效果应用的统一真相源。
- 把 target / material / reference 三类语义明确分开，避免“受保护对象不该被影响”错误地扩散成“它也不该被计数/匹配/复制”。
- 让 `selfManaged` 例外只保留在复杂数值公式层，而不是继续承载保护、controller、variant 等共享语义。
- 让未来新增能力默认只能走 semantic selector / gateway，而不是继续直接扫原始数组。
- 对缺失语义路径的新增实现 fail-fast，而不是靠 code review 记忆。

## Non-Goals
- 本轮不把整个项目所有游戏一次性抽象成跨游戏通用 tag 引擎。
- 本轮不要求一次性迁移所有 Smash Up 牌和 modifier。
- 本轮不承诺把所有共享 helper 立刻替换成纯 DSL；能力运行时和 Effect DSL 继续保留并与 semantic runtime 对接。
- 本轮不推翻已存在的 ability runtime / effect DSL / variant binding 方向，而是补上它们共同依赖的语义层。

## Decisions
### Decision 1: 语义真相分成“对象描述”和“效果入口”两层
运行时需要同时拥有两类原语：

- semantic descriptors / selectors
  - 解决“这是什么对象、谁在控制、它属于哪个 runtime family、当前是 target 还是 material”
- semantic gateways / applicators
  - 解决“某种效果是否能合法作用到这个对象，以及失败时怎么统一跳过/拦截/消耗保护”

如果只有 selector 没有 gateway，业务层仍会自行决定保护和合法性。
如果只有 gateway 没有 selector，业务层仍会先用 raw scan 决定候选，再把偏差带进统一入口。

## Decision 2: target / material / reference 必须显式区分
这是本次重构的核心边界：

- `target`：效果真正要施加到的对象，必须走 application gateway
- `material`：仅用于计数、匹配、复制、判断条件的对象，不自动继承 target 保护逻辑
- `reference`：仅用于定位来源、生成文案、构造上下文的对象

例如：

- “消灭一个随从”里的随从是 `target`
- “每有一张同名附着牌就 +1”里的附着牌是 `material`
- “复制那张牌的持续效果”里的 copied source 是 `reference`

只有把这三类分开，才能避免 modifier 和能力实现继续把所有 raw object 读都混成一种“目标选择”。

## Decision 3: `selfManaged` 只允许管理公式，不允许管理共享语义
未来保留的 `selfManaged` modifier 只能负责：

- 自定义数值算法
- 依赖多个 runtime query 结果的组合计算

不再允许它继续负责：

- protection / suppression 判定
- action / affect / move / destroy 语义选择
- controller lens / copied / borrowed / variant 归一
- “什么该计数、什么不该计数”的局部重新发明

否则 `selfManaged` 仍然会成为“合法绕路口”。

## Decision 4: 先改共享汇合点，再迁代表能力
第一阶段优先收口这些共享层：

- `abilityHelpers.ts`
- `ongoingEffects.ts`
- `ongoingModifiers.ts`
- `reducer.ts`

原因是这些文件已经承接了部分统一职责，但边界还不完整。先把这里收口，后续迁具体派系时才不会继续长出新旁路。

## Decision 5: 需要显式的 bypass 审计门禁
仅靠“团队知道该怎么写”不够。需要至少一种可执行门禁来阻止回退：

- runtime / registration fail-fast
- focused audit tests
- 对高风险 raw scan 模式的静态审计

具体门禁形式可以在实现阶段定，但目标是不再允许“helper 已存在，但不用也能过”。

## Dependencies And Composition
- 与 `refactor-smashup-ability-runtime` 的关系：
  - ability runtime 负责“能力程序怎么执行”
  - semantic runtime 负责“能力程序在读取/应用对象时，怎样得到统一语义”
- 与 `refactor-smashup-effect-dsl-primitives` 的关系：
  - DSL primitive 可以继续编译为 ability program
  - 但凡涉及目标、材料、引用对象读取，都必须走 semantic selector / gateway
- 与 `refactor-smashup-variant-binding-metadata` 的关系：
  - semantic runtime 不重新定义经典版/POD 绑定
  - variant / copied / borrowed 归一统一读取已有 metadata 和 identity helper

## Migration Plan
### Phase 1
- 定义 semantic capability、descriptors、selectors、gateways
- 把现有保护 / 目标 helper 对接到统一 semantic runtime contract

### Phase 2
- 收口 reducer 后处理与 ongoing modifier helper
- 迁移最容易复发的代表能力与代表 modifier

### Phase 3
- 增加 bypass 审计门禁
- 分批清理 remaining raw semantic scans

## Candidate First Migrations
第一批代表迁移优先覆盖最容易继续复发的路径：

- 目标过滤与最终应用分离但语义重复的能力
  - 例如临时控场、移动、destroy、return 一类效果
- 以 attached/base ongoing 为材料计数，但又夹带 protection/controller 判断的 modifier
  - 例如 kitty cats、mythic horses、copied ongoing 相关 modifier
- reducer 中已经存在后处理保护拦截的效果类型
  - 先把它们升级成正式 gateway，而不是继续停留在“末端补救”

## Risks / Trade-offs
- 如果把 scope 扩到“全项目跨游戏统一 tag 引擎”，这轮会失控；因此先以 Smash Up runtime 为落点，但抽象命名要避免封死未来复用。
- 如果只新增 helper 不增加门禁，几周后会再次回到“重构过但没收口”的状态。
- 如果强行一次性横扫全部牌，提案会过大且难以验证；因此必须采用“共享汇合点优先 + 代表能力迁移 + 门禁跟进”的节奏。
