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
| `.codex/skill/create-new-game/SKILL.md` | 已完成首轮 references 拆分，主 skill 保留流程骨架与按需读取入口 | 后续只在新增职责混杂时继续下沉 references |

## 已完成迁移

| 日期 | 来源 | 目标 | 语义变化 | 说明 |
| --- | --- | --- | --- | --- |
| 2026-06-03 | `AGENTS.md` § E2E 测试强制要求 | `docs/ai-rules/e2e-verification.md` | 有小幅澄清 | 保留原有截图验收、证据路径、看图要求；新增“默认状态注入，真实开房仅用于跨入口合同”的边界。 |
| 2026-06-03 | `AGENTS.md` § 验证测试、`docs/automated-testing.md` § 测试框架 API | `docs/ai-rules/e2e-verification.md` | 对齐口径 | 将“所有 E2E 必须状态注入 / 只有用户明确要求才真实链路”收敛为同一规则：默认状态注入；跨入口合同需要证明时可用真实链路，并必须写清额外证明点。 |
| 2026-06-04 | `docs/audio/audio-usage.md`、`docs/audio/add-audio.md` 中的执行型 SOP | `.codex/skill/audio-integration/SKILL.md` | 有结构性重构，无核心语义放宽 | 将“查找 key、接配置、生成产物、/dev/audio 收口、最终汇报”下沉到项目 skill；音频文档保留架构合同、命令入口、目录/产物/运行时约束。 |
| 2026-06-09 | `AGENTS.md` § 测试编写规范 / 验证测试 | `docs/ai-rules/e2e-verification.md` + `docs/ai-rules/doc-index.md` | 有结构性收口 | 根文件改成“测试分层 + 文档路由 + 红线”，把三板斧定义、主页/进局分层、长链预算、组合式验证下沉到二级文档。 |
| 2026-06-09 | 当前对话关于“测试太慢 / 三板斧失守 / 根 AGENTS 渐进式披露”的复盘 | `docs/ai-rules/e2e-verification.md` + `docs/ai-rules/doc-index.md` | 有约束增强 | 新增“15 分钟定位预算”“长链不得作为默认调试循环”“同一目标最多二次自然链后必须拆合同”，并把“为什么慢 / 是否还在推进实现”的入口也路由到二级文档。 |
| 2026-06-14 | `docs/ai-rules/ui-ux.md` 中误放的“实施中状态呈现”规则 | `docs/framework/frontend.md` § 实施中状态横幅 + `docs/ai-rules/doc-index.md` | 无语义放宽 | 将 `statusTag='under_construction'` 必须复用 `ImplementationStatusRibbon` 的规则从通用 UI/UX 审美规范迁到前端框架组件合同；`doc-index` 只保留路由入口。 |
| 2026-07-04 | `docs/ai-rules/testing-audit.md` 顶部规则 bug 合同门禁、回归处理与漏审复盘口径 | `docs/ai-rules/rule-contract-audit.md` + `docs/ai-rules/regression-closeout.md` + `.codex/skill/rule-bug-fix-workflow/SKILL.md` + `docs/ai-rules/doc-index.md` | 无语义放宽，有职责拆分 | 将“先判断录入合同是否被实现正确消费”“冲突才回图面/规则源”“修复必须回写合同入口”“回归漏审复盘与同类扩审”拆到短文档和项目 skill；`testing-audit.md` 头部只保留路由摘要，避免同一规则在大文档中继续扩写。 |
| 2026-07-04 | `docs/ai-rules/testing-audit.md` § D 维度库、维度选择指南、输出格式 | `docs/ai-rules/testing-audit-dimensions.md` + `docs/ai-rules/doc-index.md` + `.codex/skill/game-audit-workflow/SKILL.md` | 无语义放宽，纯拆分 | 将 D1-D57 细则从大文档无损搬到独立维度库；`testing-audit.md` 只保留入口摘要，审计 skill 与索引改为显式读取维度库。 |
| 2026-07-04 | `docs/ai-rules/testing-audit-dimensions.md` § 需要展开的关键维度 | `docs/ai-rules/testing-audit-dimensions-semantics-interaction.md` + `docs/ai-rules/testing-audit-dimensions-resource-timing.md` + `docs/ai-rules/testing-audit-dimensions-state-pipeline.md` + `docs/ai-rules/testing-audit-dimensions-deferred-interaction.md` + `docs/ai-rules/testing-audit-dimensions.md` 索引 | 无语义放宽，纯拆分 | 将超大 D 维度细则按主题拆成分卷；入口维度库只保留分卷索引、摘要表、选择指南和输出格式，避免后续审计每次加载整本细则。 |
| 2026-07-04 | `docs/ai-rules/testing-audit.md` § 核心原则 / 交互入口语义矩阵 / 技能完整流程矩阵 | `docs/ai-rules/testing-audit-core-principles.md` + `docs/ai-rules/testing-audit.md` 入口摘要 | 无语义放宽，纯拆分 | 将 fail-close 速查、全面审计完成定义、录入/图片/旧 evidence 边界、交互入口语义矩阵和技能完整流程矩阵无损搬到核心原则短文档；`testing-audit.md` 只保留入口摘要与证据分层。 |
| 2026-07-04 | `docs/ai-rules/testing-audit.md` § E2E 测试框架规范 / 流程截图证据链 | `docs/ai-rules/e2e-verification.md` + `docs/ai-rules/testing-audit.md` 入口摘要 | 无语义放宽，纯归并 | 将流程截图证据链、奖励骰/特写截图、生效时机判定、成功路径和对外口径门禁并入 E2E 专文；`testing-audit.md` 只保留 E2E 路由入口。 |
| 2026-07-04 | `docs/ai-rules/testing-audit.md` § 描述→实现全链路审查规范 | `docs/ai-rules/description-to-implementation-audit.md` + `docs/ai-rules/doc-index.md` + `docs/ai-rules/engine-systems.md` 入口摘要 | 无语义放宽，纯拆分 | 将权威描述锁定、原子断言、交互链拆分、八层追踪、grep 消费点和复杂语义模式搬到专项短文档；`testing-audit.md` 只保留专项路由入口，`engine-systems.md` 不再误指审计大文档为唯一权威。 |
| 2026-07-04 | `docs/ai-rules/engine-systems.md` § 传输层、游戏结束、SimpleChoice、动画/EventStream/特写、ActionLog | `docs/ai-rules/engine-transport.md` + `docs/ai-rules/engine-gameover.md` + `docs/ai-rules/engine-simple-choice.md` + `docs/ai-rules/engine-visual-events.md` + `docs/ai-rules/engine-action-log.md` + `docs/ai-rules/doc-index.md` | 无语义放宽，纯拆分 | 将被 `doc-index.md` 直接引用的引擎系统章节无损搬到专项短文档；`engine-systems.md` 原位置改为入口摘要，避免引擎总览继续承载系统百科。 |
| 2026-07-04 | `docs/ai-rules/engine-systems.md` § 通用能力框架、伤害计算管线、DiceThrone Token ActiveUse、SmashUp pendingSave | `docs/ai-rules/engine-ability-framework.md` + `docs/ai-rules/engine-damage-pipeline.md` + `docs/games/dicethrone/token-active-use-custom-action.md` + `docs/games/smashup/destroy-pending-save.md` + `docs/ai-rules/doc-index.md` | 无语义放宽，纯拆分 | 将跨游戏能力/伤害原语留在 `docs/ai-rules`，把 DiceThrone 和 SmashUp 的单游戏 runtime 合同下沉到游戏目录；`engine-systems.md` 只保留入口摘要。 |
| 2026-07-04 | `docs/ai-rules/ui-ux.md` § UI 动画设计原则、多端布局策略 | `docs/ai-rules/ui-animation-patterns.md` + `docs/ai-rules/ui-responsive-layout.md` + `docs/ai-rules/doc-index.md` | 无语义放宽，纯拆分 | 将动画触发/结果揭示事件身份与双端布局/单位选择规则拆到专项短文档；`ui-ux.md` 只保留入口摘要、审美、组件单一来源和游戏 UI 特化规则。 |
| 2026-07-04 | `docs/ai-rules/ui-ux.md` § UI 改动分级、样式/布局边界、真实截图、主交互槽位、UI 回归恢复 | `docs/ai-rules/ui-change-gates.md` + `docs/ai-rules/doc-index.md` + `.codex/skill/ui-ux-pro-max/SKILL.md` | 无语义放宽，纯拆分 | 将 UI 改动前置门禁与验收口径拆到专项短文档；`ui-ux.md` 主体只保留审美准则、组件单一来源、动画/响应式入口和游戏 UI 特化范式，项目 UI overlay 改为先读门禁文档。 |
| 2026-07-04 | `docs/ai-rules/asset-pipeline.md` § 关键图片预加载、音频资源规范 | `docs/ai-rules/critical-image-preload.md` + `docs/ai-rules/audio-assets.md` + `docs/ai-rules/doc-index.md` | 无语义放宽，纯拆分 | 将 `criticalImageResolver`、两阶段预加载、教程资源裁剪、图集初始化与音频运行时架构、共享音频包路径合同、音效触发路径拆到专项短文档；`asset-pipeline.md` 只保留资源总览、图片链路、服务器资源主源和 App 素材包入口。 |
| 2026-07-04 | `.codex/skill/create-new-game/SKILL.md` § 流程边界、前置门禁、机制/数据设计、UI 实现、收尾启用 | `.codex/skill/create-new-game/references/workflow-boundaries.md` + `preflight-gates.md` + `mechanics-data-design.md` + `ui-implementation-gates.md` + `finalization-checklist.md` | 无语义放宽，纯拆分 | 将 1800+ 行新游戏 workflow 拆成主入口 + references；主 `SKILL.md` 保留触发、必读索引、阶段骨架和按需读取规则，长门禁按职责分卷，避免每次触发加载整本。 |
| 2026-07-19 | `design-system/game-ui/source-families.md` 与 `docs/games/summonerwars/workflows/summonerwars-faction-intake.md` 中重复的玩家文案规则 | `design-system/game-ui/MASTER.md` §4.11 + `design-system/game-ui/source-families.md` + `docs/ai-rules/doc-index.md` | 无语义放宽，纯收口 | 将“玩家文案 vs 内部验收问题”的总原则收敛到 `MASTER.md`；来源家族只保留棋盘直选承接不变量；召唤师战争 workflow 只引用总原则和家族表，避免同一文案规则三处维护。 |
| 2026-07-19 | 小黑屋日志/撤回误判复盘 | `docs/ai-rules/testing-audit.md` + `docs/components/UndoFab.md` | 有约束增强 | 明确通用能力必须拆成系统层、Board/页面入口层和玩家真实可见入口分别证明；撤回/FAB 文档补齐 `UndoProvider + GameHUD + Board 层测试` 判定口径，避免把系统层通过误写成用户入口已接入。 |
| 2026-07-19 | 当前对话接续摘要把小黑屋目标污染成 DiceThrone 特写 | `D:\codex-home\AGENTS.md` + `AGENTS.md` + `docs/ai-rules/conversation-handoff-target-lock.md` + `docs/ai-rules/doc-index.md` + `temp/current-thread-goal-coverage.md` | 有约束增强 | 新增“交接摘要不得接管目标”跨项目红线与项目接续门禁；临时覆盖矩阵顶部必须声明 active/historical/superseded，摘要与用户当前主线冲突时立即停线，避免把旧摘要当作当前实现目标。 |
| 2026-07-19 | DiceThrone 特写 UI 被放进 token / 状态显示区域的截图复盘 | `docs/ai-rules/ui-change-gates.md` + `D:\codex-home\skills\ui-audit-loop\SKILL.md` | 有约束增强 | 将“改 UI 不能只看新增 UI 自己”升级为同屏保护槽位门禁：token、状态、资源、玩家面板、阶段、骰盘、牌堆、手牌、prompt 等必须逐项过账；新 UI 抢占这些槽位直接判 REVISE。 |

## 后续候选批次

1. `AGENTS.md` 的部署/Android OTA 细则：应下沉到 `.codex/skill/android-app-release/SKILL.md`、`docs/deploy.md` 和 `docs/mobile-release.md`，根文件只保留触发入口。
2. `AGENTS.md` 的 UI/UX 规范：应下沉到 `docs/ai-rules/ui-ux.md` 与项目 UI/UX skill，根文件只保留“UI 改动先读哪里”。
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
