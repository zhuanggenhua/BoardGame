## 1. Spec
- [x] 1.1 新增 `audit-closeout-governance` spec，定义审计收口等级与证据分层
- [x] 1.2 在 spec 中明确禁止的假阳性证据与禁止表述
- [x] 1.3 在 spec 中定义旧结论失效回写与残余范围表达规则

## 2. Documentation
- [x] 2.1 更新 `.spec/knowledge/standards/testing-audit.md`，把 claim 等级、证据分层、失效回写写成硬规则
- [x] 2.2 更新 `.spec/skills/smashup-faction-implementation/SKILL.md`，明确结构审计、玩法审计、发布收口的不同门槛
- [x] 2.3 补一个统一审计 evidence 模板，要求逐项声明审计范围、claim 等级、共享根因、残余范围

## 3. Validation
- [x] 3.1 运行 `openspec validate refactor-audit-closeout-governance --strict --no-interactive`
- [x] 3.2 对照当前已暴露的 SmashUp / DiceThrone 审计误判案例，确认新规则能覆盖这些失效模式
