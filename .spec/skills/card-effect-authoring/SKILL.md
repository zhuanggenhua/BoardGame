---
name: card-effect-authoring
description: "BoardGame 卡牌/能力效果 authoring 入口：把规则来源、原子语义、运行时实现、AI 合法动作、测试和 evidence 串成一条可审计工作流。"
---

# Card Effect Authoring

本 skill 吸收 `ygopro-scripting-workflow` 中可迁移的工作流做法，但只作为 BoardGame 的项目级适配层。规则真相、录入合同、审计判断和 AI 合法动作仍分别由现有 canonical 文档负责。

## 何时使用

- 用 AI 新增一张卡、一个能力或一组卡牌效果。
- 根据规则书、卡图、Wiki 或用户指定来源把卡牌效果落到运行时。
- 需要同时生成卡牌数据、效果实现、AI 支持、测试和 evidence。
- 需要把一批相似卡归入同一个共享效果流程。

纯规则审计走 [`game-audit-workflow`](../game-audit-workflow/SKILL.md)；只做 AI 策略调参走 [`game-ai-strategy-design`](../game-ai-strategy-design/SKILL.md)；只做资源录入走 [`data-entry-workflow`](../data-entry-workflow/SKILL.md)。

## 先读

- [`data-entry.md`](../../knowledge/standards/data-entry.md)：主真相源、locked 合同和零猜测门禁。
- [`description-to-implementation-audit.md`](../../knowledge/standards/description-to-implementation-audit.md)：语义、消费、真实入口、最终状态和证据链。
- [`rule-driven-interaction-design.md`](../../knowledge/standards/rule-driven-interaction-design.md)：Choice Request、权限、响应窗口和 AI 合法动作。
- [`testing-audit.md`](../../knowledge/standards/testing-audit.md)：测试范围和证据边界。
- [`game-ai-adaptation`](../game-ai-adaptation/SKILL.md)：AI 合法动作、交互收口和 watchdog 边界。
- 目标游戏的卡牌 / 能力专项 spec、rule 文档和已有 evidence。

## 吸收的工作流原则

### 1. 结构化效果拆解

先把卡牌描述拆成可验证的原子语义：

- 时机与触发。
- 执行主体。
- 条件与使用门槛。
- 实际成本。
- `target`、`material`、`reference` 的对象角色。
- 玩家或 AI 的选择。
- 数值、资源、区域和状态变化。
- 持续时间、次数限制、重置、失败路径和清理。

可以借鉴外部仓库的“条件 / 费用 / 对象 / 处理”拆解习惯，但不能把 YGOPro 的 `target` 或 `operation` 直接当成 BoardGame 的语义模型。

### 2. 参考同类流程再生成

生成实现前必须检索仓库内相似卡、共享 helper、Effect DSL primitive、semantic selector / gateway 和已有 `sharedFlowId`。输出要区分：

- 可直接复用的共享流程。
- 允许的配置差异，例如数值、数量上限、文案或目标集合。
- 新增职责，例如新的资源、状态、交互、AI 动作或最终权威状态。
- 只能保留为 audited exception 的 legacy 路径。

“看起来同类”不能替代逐项一致性核对。

### 3. 先抽取共享流程，再绑定卡牌差异

一批相似卡先建立或复用一个 `sharedFlowId` 和共享配置 schema。共享流程承载运行时实现、主领域测试、负向路径和共用的 AI / 交互收口；不要为每张卡复制一套实现和完整测试。

每张卡或每个能力只需绑定：

- locked 录入合同或明确的 `partial / blocked / disputed` 状态。
- 卡牌定义 / i18n / 资源消费映射。
- `sharedFlowId` 与该卡的差异字段，例如数值、数量上限、文案或目标集合。
- 共享流程覆盖不到的最小边界测试，以及该卡特有的 AI 合法动作、真实交互或 evidence。
- 若不存在可复用流程，先实现一次共享流程，再把卡牌差异写入配置；只有新增触发时机、资源、状态生命周期、交互、AI 合法动作或最终权威状态时，才新增独立实现和测试。

测试覆盖率只能帮助发现共享流程或配置边界的漏分支，不能单独证明卡牌完成。

### 4. 写前静态门禁

在执行较大代码写入前，先检查：

- 来源合同是否已锁定。
- 每条原子语义是否有消费点。
- 新效果是否绕过 semantic selector / application gateway。
- 是否新增未经说明的 raw scan、局部 controller / variant 拼接或 `selfManaged` 语义。
- `validate()`、候选生成、`execute()`、AI legal actions 是否保持同一业务真相。
- 是否已有对应测试落点和 evidence 计划。

发现缺口时先标 `合同未锁定`、`功能实现阻塞`、`语义不一致` 或 `当前范围验证缺口`，不能用生成代码覆盖缺口。

### 5. 保留可恢复的工作包

在 `ai-repo-workbench` 中运行时，建议把卡牌工作作为固定模板节点执行，并通过现有 `WorkflowRun`、`DecisionRequest` 和 `ArtifactBundle` 保存：来源、语义草案、参考对象、实现 diff、测试结果、失败原因和待决策项。不要另建一套卡牌工作流状态真相。

## 最小执行顺序

```text
锁定来源与对象
→ 建立/更新录入合同
→ 拆原子语义
→ 查找/抽取共享流程与配置 schema
→ 生成卡牌差异定义
→ 生成或复用共享运行时实现
→ 核对 selector/gateway/validate/execute
→ 跑共享流程主测试与配置差异边界测试
→ 跑 AI 合法动作 / 真实交互验证
→ 写 evidence / ArtifactBundle
```

每一步都要留下可回查的文件或引用。只有当前对象的合同、消费链和必要验证都满足，才允许标记完成。

## 不吸收的部分

- `.cdb`、Lua、OCGCore、`Duel.*`、YGOPro MSG / response 等引擎专属模型。
- `redtext` 通过就等于效果正确或卡牌完成的口径。
- 把外部参考仓库、临时索引、测试夹具或 AI 生成文本升级成 BoardGame 规则真相。
- 把卡牌效果实现自动等同于 AI 策略设计；策略仍走 `game-ai-strategy-design`。
- 为了复用外部流程而新增第二套领域状态、第二套对象角色或第二套 evidence 总账。

## 收口自检

- 来源合同状态明确，未锁定对象没有被写成完成。
- 每条原子语义都有实现消费点或明确 deferred 去向。
- target / material / reference 没有混用。
- 新标准效果走统一 authoring surface；legacy 例外有审计理由。
- `validate()`、执行、AI legal actions 和交互收口已对齐。
- 测试证明最终权威状态和负向路径；证据边界没有越权。
