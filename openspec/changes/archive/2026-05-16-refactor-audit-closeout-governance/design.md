## Context

这次问题不是单张卡或单个派系实现错误，而是“审计流程把什么算完成”本身失真。

当前项目至少存在四类被混用的证据：

1. 结构审计：
   - `interactionTargetTypeAudit`
   - `interactionDefIdAudit`
   - `abilityBehaviorAudit`
   - `interactionCompletenessAudit`
   - `registerAbility` 与主回归文件的静态比对
2. 领域回归：
   - `newFactionAbilities.test.ts`
   - 其他 Vitest / GameTestRunner / smoke
3. 展示型 E2E：
   - 选择页、横幅、资源展示、房间列表
4. 真实玩法 E2E：
   - 从真实入口触发能力
   - 完成整条交互链
   - 截图能证明问题位点已修复

问题在于，现有流程没有把这四类证据分层，也没有定义“某个 claim 至少需要哪一级证据”。结果就是：

- 结构审计全绿，被拿来宣称玩法已收口
- 选择页 E2E，被拿来宣称三派系已审计完成
- 静态覆盖 0 缺口，被拿来宣称实现完整
- 注入型交互 E2E，被拿来宣称真实链路已闭环

## Goals / Non-Goals

- Goals:
  - 建立统一的审计收口等级和证据分层
  - 明确哪些证据只能证明“结构正确”，哪些才能证明“玩法收口”
  - 建立“旧结论失效”的强制回写机制
  - 建立“共享根因 / 残余范围”的强制表达
- Non-Goals:
  - 本 change 不直接修任何具体卡牌或派系规则 bug
  - 本 change 不重新审计所有历史文档，只建立后续实现与复审规则

## Decisions

### Decision: 引入 Claim 等级，而不是继续用单一“已收口”

对外结论至少区分：

- `结构审计通过`
- `代表性玩法已验证`
- `当前发布口径已收口`
- `仍有残余范围`
- `旧结论失效`

不再允许只有一个模糊的“已审计 / 已完成”。

### Decision: 把证据分成四层，并为高等级 claim 规定最低门槛

- L1 结构证据：注册、元数据、targetType、defId、handler 完整性
- L2 领域证据：Vitest / GameTestRunner / smoke 等能证明核心状态写回
- L3 真实玩法证据：从真实入口触发的 E2E / 手工截图 / 业务链
- L4 收口治理证据：残余范围、共享根因、失效回写、原文档修订

结论约束：

- 仅有 L1，不得宣称“玩法已完成”
- L1 + L2，不得宣称“真实链路已收口”
- L1 + L2 + L3，才允许宣称“当前发布口径已收口”
- 任何时候发现旧结论误判，必须补 L4

### Decision: 明确禁止的假阳性证据

以下证据禁止单独作为“玩法 / 功能已收口”依据：

- 选择页 / 横幅 / 静态资源展示 E2E
- 测试文件包含对应 id
- `registerAbility` 与测试文件名文本对齐
- 只验证 prompt 已出现，没有验证真实入口和结算收口
- 只验证注入后交互，不验证从真实打牌/真实触发开始

### Decision: 旧结论失效必须联动回写

一旦某对象被证明确实漏审或误判：

- 原审计文档必须追加失效记录
- 后续汇总文档必须同步降级或标失效
- 不允许保留旧的“已收口”摘要继续被引用

## Risks / Trade-offs

- 风险：短期内会让一部分历史 evidence 从“完成态”降级为“待复审”
  - Mitigation：允许保留“结构审计通过 / 当前仍有残余范围”的中间结论，不强迫二元化
- 风险：文档维护成本上升
  - Mitigation：提供统一模板与固定 claim 词汇，减少自由发挥

## Migration Plan

1. 新增 `audit-closeout-governance` spec
2. 在实现阶段更新通用 `testing-audit` 规则
3. 更新 SmashUp 派系 workflow，把“结构审计 / 玩法审计 / 收口 claim”拆开
4. 补统一模板，要求后续 evidence 必须显式声明 claim 等级与残余范围

## Open Questions

- 是否需要在后续实现阶段增加自动化 lint / checker，扫描 evidence 中的高风险措辞（如“已完成收口”）但缺少真实链路证据引用
