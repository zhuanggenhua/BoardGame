---
name: game-audit-workflow
description: "BoardGame 规则审计 workflow：读取路由、执行顺序和 evidence 落点——做规则、玩法或机制审计时用。"
---

# 游戏审计 Workflow

## 角色

本 skill 是 `workflow / adapter`，只负责审计执行顺序、读取路由和 evidence 落点；不承载审计规则正文，不维护 D 编号清单，也不写单游戏答案。

审计规则主源：

- 规则、玩法、机制实现审计：`.spec/knowledge/standards/description-to-implementation-audit.md`
- 审计入口、缺口分类和旧分卷兼容：`.spec/knowledge/standards/testing-audit.md`
- 证据记录、自检和旧结论回写：`.spec/knowledge/standards/audit-evidence-template.md`
- 规则 bug 与录入合同裁定：`.spec/knowledge/standards/rule-contract-audit.md`
- 真实入口、E2E 和截图证据：`.spec/knowledge/standards/e2e-verification.md`
- 权限、响应窗口、Choice Request、AI 合法动作：`.spec/knowledge/standards/rule-driven-interaction-design.md`
- 回归、同类扩审和漏审归因：`.spec/knowledge/standards/regression-closeout.md`

旧 `testing-audit-core-principles.md`、`testing-audit-dimensions*.md` 和本 skill 的 `references/` 只作历史兼容或索引，不得作为新的项目级完成定义。

## 使用入口

开始前先读 `references/reading-map.md`。它只负责把任务分流到规则 bug、审计、UI / E2E、工具、反馈状态或数据录入；真正的审计判断必须回到上方主源。

## 执行顺序

### 0. 锁定范围

写清：

- `gameId`
- 本轮对象、规则子句、共享链路或旧 evidence
- 真相来源和合同状态
- 目标入口 / 环境
- 允许使用的对外口径

`审计 / 重审 / 继续 / 全面` 只承接已锁定范围，不自动扩大到整批、全牌库或全仓库。

### 1. 选择主源

- 卡牌、技能、Token、状态、阶段、伤害、资源或玩法实现是否吃对规则：读 `description-to-implementation-audit.md`。
- 用户反馈规则 bug、合同缺失、需要回图面或规则源冲突：读 `rule-contract-audit.md`，必要时转数据录入 workflow。
- 真实入口、截图、E2E 或可见结果：读 `e2e-verification.md`。
- 响应窗口、特殊行动、权限、AI 或自动推进：读 `rule-driven-interaction-design.md`。
- 旧结论失效、回归或漏审复盘：读 `regression-closeout.md`。
- 需要落 evidence 或对外说已审计 / 已收口：读 `audit-evidence-template.md`。

### 2. 做描述到实现审计

按 `description-to-implementation-audit.md` 执行：

1. 锁定权威描述或合同状态。
2. 拆原子语义。
3. 追静态定义、合法性、命令 / handler / reducer、最终权威状态、UI、AI / 自动推进和测试。
4. 先分类缺口，再判断是否阻塞当前口径。
5. 只有共享消费者有直接影响证据时，才扩到最小受影响对象集。

### 3. 写 evidence

审计文档默认落到 `evidence/<gameId>/`。已有同主题审计文档时优先原地回写，不新建平行总账。

Evidence 必须写清：

- 本轮范围和不在范围内的对象。
- 权威来源或合同状态。
- 原子语义断言。
- 实现消费点和最终权威状态。
- 真实入口、测试、截图或人工核对证据分别证明了什么。
- 缺口分类、阻塞口径和最小补救动作。
- 旧 evidence / 旧测试 / 旧总结是否需要降级或回写。

### 4. 验证与收口

- 逻辑 / 规则问题优先补领域测试、GameTestRunner 或最小共享合同测试。
- UI / 交互问题按 `e2e-verification.md` 补真实入口 E2E、截图或手工证据。
- 对外说“已审计 / 已收口 / 当前范围已收口”前，运行 `npm run audit:evidence:selfcheck -- <evidence 文件>`。
- 脚本通过只能证明 evidence 结构没有明显漏项，不能替代规则正确性。

## 禁止

- 禁止把旧 D 编号、旧 L0-L4 层级或旧矩阵当成新审计清单。
- 禁止把单游戏卡牌、骰面、基地、房间、教程章节、截图路径或历史事故写进项目级 workflow。
- 禁止用 `prompt / modal / pending / sourceAbilityId / 按钮可点` 替代最终权威状态。
- 禁止用截图目录、测试文件名、工具成功或旧 summary 替代规则合同和实现消费证据。
- 禁止把 evidence、截图说明、测试报告或复盘文档写成新的规范来源。

## References

- `references/reading-map.md`：阅读路由 index。
- `references/audit-redlines.md`：旧高风险红线兼容入口。
- `references/dimensions.md`：旧 D 维度兼容入口。
- `references/evidence-template.md`：旧模板路径兼容入口。
