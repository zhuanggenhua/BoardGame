# 开发检查清单

本文只保留开发前后最常用的检查入口；测试分层、E2E 证据和合并规则不在这里重复定义。

## 改动后先选验证层

| 改动类型 | 最小验证 |
| --- | --- |
| TypeScript / React 代码 | `npm run typecheck`，必要时 `npm run lint` |
| 游戏规则、状态机、结算、AI | 相关 Vitest / GameTestRunner；共享层再扩大到 `npm run test:games:core` |
| UI 交互、路由、联机、保存恢复 | 最窄 Playwright E2E 或真实入口验证 |
| 文案、配置、资源索引 | 对应检查脚本、最窄运行入口或截图/evidence |
| AI 规范、skill、knowledge | `npm run spec:lint` |

## 提交前自查

- 工作区里只包含本轮目标需要的文件；无临时日志、截图、测试输出误入库。
- 新增测试只锁长期行为合同，不冻结临时状态、实现细节或未定案选择。
- 改共享引擎、共享 UI 或测试 helper 时，至少验证一个直接消费场景。
- 涉及合并、冲突、分支或 push 时，改走 [`merge-pr-workflow`](../.spec/skills/merge-pr-workflow/SKILL.md)，不要只看本文。
- 涉及 E2E、截图证据或黄金链时，回到 [`e2e-verification`](../.spec/knowledge/standards/e2e-verification.md)。

## 常用入口

- 测试命令、runner 和产物目录：[`automated-testing`](automated-testing.md)。
- TestHarness API 快查：[`testing-tools-quick-reference`](testing-tools-quick-reference.md)。
- 项目硬边界：[`golden-rules`](../.spec/knowledge/standards/golden-rules.md)。
- 文档落点：[`documentation-style`](../.spec/knowledge/standards/documentation-style.md)。
