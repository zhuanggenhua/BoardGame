# smashup-oops-faction-audit Specification (delta)

## ADDED Requirements
### Requirement: Oops faction delivery SHALL be audited faction-by-faction starting with Ancient Egyptians
系统 SHALL 以 `Ancient Egyptians → Vikings → Cowboys → Samurai` 的顺序逐派系完成规则审计，而不是等四个派系全部实现后再一次性检查。

#### Scenario: Ancient Egyptians begins the audit wave
- **GIVEN** `Ancient Egyptians` 的实现已进入可验证状态，或已出现规则争议 / bug 反馈
- **WHEN** 团队开始本轮 Oops 四派系审计
- **THEN** 必须先对 `Ancient Egyptians` 完成规则文本、FAQ、代码链路与测试覆盖的专项核对
- **AND** 在形成结论、补齐必要回归前，不得把该派系视为“等统一审计再说”

#### Scenario: Later factions cannot skip faction-specific audit
- **GIVEN** `Vikings`、`Cowboys` 或 `Samurai` 的任一派系实现完成
- **WHEN** 该派系准备进入验收
- **THEN** 系统/交付流程 MUST 先完成该派系的专项审计与 evidence
- **AND** MUST NOT 仅依赖最后的统一审计作为唯一审计门禁

### Requirement: Each faction audit SHALL cover shared-chain expansion, regression tests, and evidence
系统 SHALL 在每个派系审计中覆盖共享链路扩审、验证层/执行层/UI 链路检查，以及可复现的测试与 evidence 留档。

#### Scenario: Audit finds a shared-chain defect
- **GIVEN** 某派系审计命中了共享 helper、reducer、验证层或 UI 流程中的缺陷
- **WHEN** 修复该缺陷
- **THEN** 必须按 `.spec/knowledge/standards/testing-audit.md` 扩审其他复用同链路的调用点
- **AND** 对命中点给出“已一并修复”或“确认不受影响”的明确结论

#### Scenario: Faction audit closes with reproducible evidence
- **GIVEN** 某派系审计准备收口
- **WHEN** 输出审计结果
- **THEN** evidence MUST 包含规则来源、受影响文件、已运行测试/命令与残留风险
- **AND** 这些证据 MUST 能支撑最终统一审计的汇总，而不是只留下口头结论
