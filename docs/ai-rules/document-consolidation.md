# AI 规范文档无损整理台账

> 目标：减少根规范和大型规则文档的重复负担，同时保证内容不丢失、可追溯、可回查。

## 无损整理原则

1. 先建新落点，再压缩旧入口；不得直接删除尚未迁移或尚未归档的规则。
2. 旧入口只保留触发条件、红线和下一步阅读位置；专项 SOP 下沉到 `docs/ai-rules/`、`.windsurf/skills/` 或游戏 workflow。
3. 每次迁移必须记录：来源、目标、是否改变规则语义、后续待清理重复项。
4. 如果迁移时发现规则冲突，必须保留冲突双方原文位置，并新增“裁决原因”；不能只采用某一边。
5. 历史事故描述不继续堆在根文件；只保留抽象后的不变量，原始事故留在 evidence、用户故事或专项 bug 文档。

## 当前体量基线

| 文件 | 当前问题 | 处理方向 |
| --- | --- | --- |
| `AGENTS.md` | 同时承载入口规则、专项 SOP、E2E、部署、设计原则和游戏专属补充 | 压缩为路由 + 红线 + 入口 |
| `docs/ai-rules/testing-audit.md` | 超大，混合审计原则、D 维度、E2E、历史教训、输出模板 | 拆成审计入口、维度库、证据模板、E2E 专项 |
| `docs/ai-rules/engine-systems.md` | 引擎总览、领域层、UI 提示、动画、ActionLog 等多个主题混放 | 按系统主题拆分，doc-index 做入口 |
| `docs/automated-testing.md` + `docs/testing-best-practices.md` | 测试执行、结构门禁、E2E 口径与 AGENTS 有重叠 | 归并测试入口，保留工具细节 |
| `.windsurf/skills/create-new-game/SKILL.md` | 单个 skill 体量过大，混有参考资料 | 拆 references，SKILL 只保留流程骨架 |

## 已完成迁移

| 日期 | 来源 | 目标 | 语义变化 | 说明 |
| --- | --- | --- | --- | --- |
| 2026-06-03 | `AGENTS.md` § E2E 测试强制要求 | `docs/ai-rules/e2e-verification.md` | 有小幅澄清 | 保留原有截图验收、证据路径、看图要求；新增“默认状态注入，真实开房仅用于跨入口合同”的边界。 |
| 2026-06-03 | `AGENTS.md` § 验证测试、`docs/automated-testing.md` § 测试框架 API | `docs/ai-rules/e2e-verification.md` | 对齐口径 | 将“所有 E2E 必须状态注入 / 只有用户明确要求才真实链路”收敛为同一规则：默认状态注入；跨入口合同需要证明时可用真实链路，并必须写清额外证明点。 |

## 后续候选批次

1. `AGENTS.md` 的部署/Android OTA 细则：应下沉到 `.windsurf/skills/android-app-release/SKILL.md`、`docs/deploy.md` 和 `docs/mobile-release.md`，根文件只保留触发入口。
2. `AGENTS.md` 的 UI/UX 规范：应下沉到 `docs/ai-rules/ui-ux.md` 与项目 UI/UX skill，根文件只保留“UI 改动先读哪里”。
3. `testing-audit.md` 的 E2E 框架规范：应与 `docs/ai-rules/e2e-verification.md` 去重，保留审计证据分层在原文。
4. `testing-audit.md` 的 D 维度库：应拆成 `docs/ai-rules/testing-audit-dimensions.md` 或继续由 `game-audit-workflow` references 承载。
5. `engine-systems.md` 的 ActionLog、GameOver、SimpleChoice、动画表现：应按系统拆成更短文档，由 `doc-index.md` 路由。

## 本轮事故回代

这次“余牌查询开启但正式对局点牌堆无响应”的流程问题，暴露的是两个层面：

- 代码层：房间配置与运行时状态没有单一真相。
- 规范层：E2E 验证边界写得太重且散在根文件，导致真实开房被机械升级，而不是先判断它是否能证明更多。

已通过 `docs/ai-rules/e2e-verification.md` 固化边界：默认状态注入；只有跨入口合同需要证明时，才使用真实开房链路。
