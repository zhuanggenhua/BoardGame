## ADDED Requirements

### Requirement: Flowise fork 源码 MUST 落在仓库内的独立固定目录

当团队进入 `Flowise` 真实接入阶段时，系统 MUST 在仓库中存在一个可审计、可升级的上游源码固定落点，而不是只保留文档裁决。

#### Scenario: 仓库内存在固定 fork 源码目录
- **WHEN** 团队开始真实接入 `Flowise`
- **THEN** 仓库 MUST 存在独立的上游源码目录
- **AND** 该目录 MUST 对应锁定的 tag / commit
- **AND** 不得继续只有基线说明文件而没有真实源码

#### Scenario: 不保留嵌套 git 仓库
- **WHEN** 上游 `Flowise` 源码被拉入主仓库
- **THEN** 该目录 MUST 作为主仓库受管文件存在
- **AND** 不得保留上游 `.git` 造成嵌套仓库或 submodule 语义漂移

### Requirement: Flowise fork 边界 MUST 在源码落地和页面收敛时被再次显式声明

系统在把 Flowise 源码真正拉入仓库时，MUST 再次把“只做节点画布 / workflow shell，不接管领域真相”的边界写成仓库内可见说明。

#### Scenario: fork 落地时保留领域边界声明
- **WHEN** 用户或开发者查看仓库内的 Flowise fork 落点
- **THEN** 仓库 MUST 明确说明 Flowise 只承载节点画布与 workflow shell
- **AND** 必须继续保留 `RepoSession / WorktreeTask / WorkflowRun / DecisionRequest / ArtifactBundle` 由本项目 domain/runtime 持有的边界

#### Scenario: 页面切到 Flowise 主壳不等于领域真相迁移
- **WHEN** `AIRepoWorkbench` 页面已经以 Flowise shell 作为主布局
- **THEN** 系统 MUST 明确说明这只代表图交互与页面骨架切到 Flowise
- **AND** 不得把“主布局已切换”误写成“`RepoSession / WorkflowRun / DecisionRequest / ArtifactBundle` 已交给 Flowise 接管”

### Requirement: AI Repo Workbench MUST 以只读 Flowise shell 作为唯一图交互面

当团队开始把 Flowise 真正接回当前工作台页面时，系统 MUST 支持在不替换本地 runtime/orchestrator 真相层的前提下，使用一个直接消费本地 journal 状态的只读 Flowise shell 作为页面主图交互面。

#### Scenario: 页面渲染本地 journal 驱动的 Flowise 主画布
- **WHEN** 用户进入 `AIRepoWorkbench` 且当前工作树已有 `WorkflowRun`
- **THEN** 页面 MUST 能基于本地 `WorkflowTemplateDefinition / NodeExecutionRecord / WorkflowRun` 映射出 `FlowData`
- **AND** 以只读方式渲染 Flowise shell 主画布
- **AND** 不得要求 Flowise API server 参与当前页面渲染

#### Scenario: 页面能力填入 Flowise 壳层
- **WHEN** 页面需要展示模板启动、RepoSession、工作树管理或运行摘要
- **THEN** 系统 MUST 优先把这些能力挂载到 Flowise header、palette 或围绕画布的业务覆盖层
- **AND** 不得继续在外层长期维护一套与 Flowise 平级的独立产品壳

#### Scenario: 自绘节点图降级为状态轨
- **WHEN** 页面仍需要展示节点摘要、当前节点切换或状态总览
- **THEN** 系统 MAY 提供非画布状态轨
- **AND** 该状态轨 MUST 只承担摘要与切换职责
- **AND** 不得继续保留第二套自绘 graph interaction surface

#### Scenario: Flowise 主画布不接管本地执行真相
- **WHEN** 页面已切到 Flowise 主画布
- **THEN** `DecisionRequest`、`ArtifactBundle`、`WorkflowRun` 状态推进仍 MUST 由本地 orchestrator/runtime 驱动
- **AND** 不得把 Flowise 画布误实现成另一套独立执行状态机
