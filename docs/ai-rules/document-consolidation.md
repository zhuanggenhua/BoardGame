# AI 规范文档无损整理台账

> 目标：减少根规范和大型规则文档的重复负担，同时保证内容不丢失、可追溯、可回查。

## 无损整理原则

1. 先确定唯一落点，再收拢分散内容；不得直接删除尚未迁移或尚未归档的规则。
2. 整理完成后只保留唯一入口；专项 SOP 下沉到 `docs/ai-rules/`、`.codex/skill/` 或游戏 workflow。
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
| `.codex/skill/create-new-game/SKILL.md` | 单个 skill 体量过大，混有参考资料 | 拆 references，SKILL 只保留流程骨架 |

## 已完成迁移

| 日期 | 来源 | 目标 | 语义变化 | 说明 |
| --- | --- | --- | --- | --- |
| 2026-06-03 | `AGENTS.md` § E2E 测试强制要求 | `docs/ai-rules/e2e-verification.md` | 有小幅澄清 | 保留原有截图验收、证据路径、看图要求；新增“默认状态注入，真实开房仅用于跨入口合同”的边界。 |
| 2026-06-03 | `AGENTS.md` § 验证测试、`docs/automated-testing.md` § 测试框架 API | `docs/ai-rules/e2e-verification.md` | 对齐口径 | 将“所有 E2E 必须状态注入 / 只有用户明确要求才真实链路”收敛为同一规则：默认状态注入；跨入口合同需要证明时可用真实链路，并必须写清额外证明点。 |
| 2026-06-04 | `docs/audio/audio-usage.md`、`docs/audio/add-audio.md` 中的执行型 SOP | `.codex/skill/audio-integration/SKILL.md` | 有结构性重构，无核心语义放宽 | 将“查找 key、接配置、生成产物、/dev/audio 收口、最终汇报”下沉到项目 skill；音频文档保留架构合同、命令入口、目录/产物/运行时约束。 |
| 2026-06-09 | `AGENTS.md` § 测试编写规范 / 验证测试 | `docs/ai-rules/e2e-verification.md` + `docs/ai-rules/doc-index.md` | 有结构性收口 | 根文件改成“测试分层 + 文档路由 + 红线”，把三板斧定义、主页/进局分层、长链预算、组合式验证下沉到二级文档。 |
| 2026-06-09 | 当前对话关于“测试太慢 / 三板斧失守 / 根 AGENTS 渐进式披露”的复盘 | `docs/ai-rules/e2e-verification.md` + `docs/ai-rules/doc-index.md` | 有约束增强 | 新增“15 分钟定位预算”“长链不得作为默认调试循环”“同一目标最多二次自然链后必须拆合同”，并把“为什么慢 / 是否还在推进实现”的入口也路由到二级文档。 |
| 2026-06-14 | `docs/ai-rules/ui-ux.md` 中误放的“实施中状态呈现”规则 | `docs/framework/frontend.md` § 实施中状态横幅 + `docs/ai-rules/doc-index.md` | 无语义放宽 | 将 `statusTag='under_construction'` 必须复用 `ImplementationStatusRibbon` 的规则从通用 UI/UX 审美规范迁到前端框架组件合同；`doc-index` 只保留路由入口。 |

## 后续候选批次

1. `AGENTS.md` 的部署/Android OTA 细则：应下沉到 `.codex/skill/android-app-release/SKILL.md`、`docs/deploy.md` 和 `docs/mobile-release.md`，根文件只保留触发入口。
2. `AGENTS.md` 的 UI/UX 规范：应下沉到 `docs/ai-rules/ui-ux.md` 与项目 UI/UX skill，根文件只保留“UI 改动先读哪里”。
3. `testing-audit.md` 的 E2E 框架规范：应与 `docs/ai-rules/e2e-verification.md` 去重，保留审计证据分层在原文。
4. `testing-audit.md` 的 D 维度库：应拆成 `docs/ai-rules/testing-audit-dimensions.md` 或继续由 `game-audit-workflow` references 承载。
5. `engine-systems.md` 的 ActionLog、GameOver、SimpleChoice、动画表现：应按系统拆成更短文档，由 `doc-index.md` 路由。

## 本轮事故回代

这次“余牌查询开启但正式对局点牌堆无响应”的流程问题，暴露的是两个层面：

- 代码层：房间配置与运行时状态没有单一真相。
- 规范层：E2E 验证边界写得太重且散在根文件，导致真实开房被机械升级，而不是先判断它是否能证明更多。

已通过 `docs/ai-rules/e2e-verification.md` 固化边界：默认状态注入；只有跨入口合同需要证明时，才使用真实开房链路。

## 2026-06-09 本轮补充

- 本轮新增的不是“更多根规则”，而是把根 `AGENTS.md` 朝渐进式披露再收一层：
  - 根文件保留：什么时候触发测试规则、哪些红线不能越过、先看哪份文档。
  - 二级文档承载：三板斧定义、主页/进局分层、长链时长预算、组合式验证、拆分命名。
- 这次沉淀的本质问题不是“Fantasy Realms 某条 E2E 太慢”，而是**默认测试入口和验证粒度没有被硬性约束**，导致容易机械把多个合同绑成同一条长链。
- 这次进一步补强的点也不是“以后少跑测试”这么空泛，而是把**停线条件**写实：超过预算、重复自然开局、仍未命中问题位点时，必须立刻拆合同并退回状态注入/低层验证，不能继续把 E2E 当主调试循环。
