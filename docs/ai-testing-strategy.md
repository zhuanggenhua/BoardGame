# 测试分层入口（旧 AI 测试策略）

本文只保留旧链接兼容和测试分层索引；测试规则正文不在 `docs/` 维护。

## 当前主源

- TDD、回归测试和阻断测试判断：[`testing-tdd`](../.spec/knowledge/standards/testing-tdd.md)。
- E2E、真实链路、截图证据和黄金链口径：[`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md)。
- 测试命令、工具 API、运行模式和产物目录：[`automated-testing`](automated-testing.md)。
- TestHarness API 快查：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。

## 保留结论

- 规则、结算、状态机、卡牌/技能效果和非法分支，优先用 Vitest、GameTestRunner 或最窄领域合同证明。
- E2E 只证明真实入口、UI 交互、跨端同步、截图证据和少量关键玩家路径；不要用长链 E2E 承担所有规则边界。
- TestHarness、fixture 和状态注入可以用于代表态合同、局部入口验证和调试提速；它们不能替代主黄金链里的连续真实玩家动作。
- 如果目标是“玩家可用合同”，至少要证明规则状态与结算存在、正式 UI 能触发、合法输入路径可达、可见结果能解释，且非法分支有明确拒绝。

旧版长文中的示例、比例和“AI 工作流”已删除，避免和 `.spec/` 的现行测试规范形成第二套规则。
