# 审计与规则反馈阅读路由

> 角色：index / adapter。
>
> 本文件只负责渐进式披露和阅读顺序，不承载新的审计规则正文。审计规则的唯一真相源仍是 `.spec/knowledge/standards/` 下对应规范。

## 先按问题类型路由

| 用户目标 | 第一入口 | 随后按需读取 |
| --- | --- | --- |
| 卡牌、技能、Token、状态、阶段、伤害、资源、升级版效果不对 | `./.spec/skills/rule-bug-fix-workflow/SKILL.md` | `rule-contract-audit.md`、`description-to-implementation-audit.md`、`regression-closeout.md` |
| 用户问“为什么审计没审出来 / 重审 / 审计收口” | `./.spec/skills/game-audit-workflow/SKILL.md` | `testing-audit.md`、`description-to-implementation-audit.md`、`audit-evidence-template.md`、`regression-closeout.md` |
| 只改 UI、交互入口、提示、布局、截图证据 | `.spec/knowledge/standards/ui-change-gates.md`、`.spec/knowledge/standards/e2e-verification.md` | 需要玩家视角审图或用户开图时，按 `.spec` 的 UI / 开图入口执行 |
| 需要编写或运行 Vitest / Playwright | `docs/automated-testing.md` | `docs/testing-tools-quick-reference.md`；截图和证据规则仍回 `e2e-verification.md` |
| 需要选择测试、注入状态、控制骰子或读取 TestHarness | `docs/testing-tools-quick-reference.md` | 只读具体 API；不得把工具存在当成业务链路通过 |
| 需要查项目脚本、构建、资产、端口或启动命令 | `docs/tools.md` | 按脚本类别读取对应专项文档；工具清单不是规则审计规范 |
| 只处理反馈状态、分诊、resolved / closed 回写 | `./.spec/skills/feedback-closeout/SKILL.md` | 不承担玩法 bug 的合同核对和修复验收 |
| 图片、规则书、卡图、图集、OCR、录入合同未锁定 | `./.spec/skills/data-entry-workflow/SKILL.md` | `.spec/knowledge/standards/data-entry.md`、游戏专项 intake；合同未锁定时不得直接改正式规则 |

## 审计任务的最小阅读集

普通规则 bug 或对象级审计，先读：

1. 根 `AGENTS.md` 与 `.spec/AGENTS.md`。
2. 本文件和 `game-audit-workflow/SKILL.md`。
3. `.spec/knowledge/standards/testing-audit.md`：审计入口、缺口分类和旧分卷兼容。
4. `.spec/knowledge/standards/description-to-implementation-audit.md`：描述到实现审计主源。
5. `.spec/knowledge/standards/audit-evidence-template.md`：需要写 evidence 或对外使用“已审计 / 已收口”时读取。

规则 bug 额外读取：

- `.spec/knowledge/standards/rule-contract-audit.md`：权威合同与实现消费核对。
- `.spec/knowledge/standards/regression-closeout.md`：原始症状、首跑红测、同类扩审和漏审回代。

## 工具和证据的职责边界

- `docs/tools.md`：脚本目录和命令索引。
- `docs/testing-tools-quick-reference.md`：TestHarness、状态注入、随机数 / 骰子控制等 API。
- `docs/automated-testing.md`：测试运行器、测试组织和工具 API 的完整说明。
- `.spec/knowledge/standards/e2e-verification.md`：真实入口、状态型流程、截图证据和对外结论。
- `.spec/knowledge/standards/audit-evidence-template.md`：审计 evidence 字段和自检。

工具只能产生证据，不能替代规则合同、最终权威状态或玩家真实结果。

## 禁止的阅读捷径

- 只读 `docs/tools.md` 或测试工具文档，就开始修改规则。
- 只读 `testing-audit.md` 入口，不读 `description-to-implementation-audit.md` 和 evidence 模板，却声称“已审计”。
- 只读 `e2e-verification.md` 或截图，就把 UI 显示当成领域规则已正确。
- 只读 `feedback-closeout`，就把反馈状态回写当成玩法 bug 已验证。
- 为了“渐进式披露”删除仍是 canonical-source 的规范正文；需要收口时先建立引用关系和漂移检查。

## 输出时必须记录

审计或规则 bug 收口至少记录：

- 本次选择了哪条入口以及为什么。
- 实际读取的规范主源。
- 使用了哪些工具、工具只证明了什么。
- 每条原始症状对应的领域、验证、UI、i18n、测试和 evidence 证据。
- 哪些症状仍未覆盖；未覆盖时不得写“整批已收口”。
