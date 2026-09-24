---
name: knowledge
description: BoardGame 项目知识库导航：查“怎么做”看 standards，查功能设计看 features，复发教训看 lessons
metadata:
  type: index
---

# Knowledge（项目知识库 · 导航）

本文件是 `knowledge/` 下所有 .md 的导航 meta：一行描述 + 路径，按需下钻。

> 导航行与各文档 frontmatter `description` 同一句话口径，只写“是什么 + 何时查”。交付历史在 git，不进文档；长度、status 枚举、登记覆盖和链接可达由 `npm run spec:lint` 机械校验。

## 规范角色与唯一主源

先按角色找文件，不能因为某个 skill 或 evidence 里出现了相似句子，就把它当成新的通用规范：

| 角色 | 唯一主源 / 入口 | 负责什么 |
| --- | --- | --- |
| 项目入口 | [`../AGENTS.md`](../AGENTS.md) | 项目边界、宿主加载、任务路由和 skill 名册 |
| 硬规则与治理顺序 | [`../rules/system.md`](../rules/system.md) | 跨任务不变量、规范整理顺序、证据不得越权和规范更新后的闭环 |
| 通用目标锁定 | [`standards/conversation-handoff-target-lock.md`](standards/conversation-handoff-target-lock.md) | 原话保真、问题对象 / 真相源 / 入口环境 / 验收口径，以及目标不明时的停手格式 |
| 领域执行标准 | `standards/*.md` | 跨游戏可复用的“怎么做”；同一判断只在一个标准正文维护 |
| 项目 workflow | `../skills/*/SKILL.md` | 把主源编排成某类任务的执行入口；适配层不得复制主源正文 |
| 证据 / drift-check | 对应 skill 的 `references/`、任务记录或 `evidence/` | 记录事实、案例和缺口；不能反向成为新规范 |
| 规范维护 | [`../skills/spec-steward/SKILL.md`](../skills/spec-steward/SKILL.md) | 文档落点、去重、迁移、索引和结构校验 |

`img2threejs` 目录内的 `docs/`、`grimoire/`、`skills/` 是上游参考资料，不是 BoardGame 通用执行规范。

## standards/（开发规范 · 要遵守的“怎么做”）

| 文档 | 一句话 |
| --- | --- |
| [`animation-effects.md`](standards/animation-effects.md) | 动画与特效标准：FX、Shader、反馈包和性能边界——改视觉特效或动画系统时查 |
| [`asset-pipeline.md`](standards/asset-pipeline.md) | 图片资源与发布总规范：资源目录、manifest、上传和运行时加载——改素材链路时查 |
| [`audio-assets.md`](standards/audio-assets.md) | 音频资源标准：共享包、registry、触发路径和迁移策略——接入或排查音效时查 |
| [`audit-evidence-template.md`](standards/audit-evidence-template.md) | 审计证据模板：范围、结论、缺口分类和自检口径——写审计 evidence 时查 |
| [`conversation-handoff-target-lock.md`](standards/conversation-handoff-target-lock.md) | 接续目标锁定：摘要、交接和当前目标防漂移——上下文压缩或接手任务时查 |
| [`critical-image-gate.md`](standards/critical-image-gate.md) | 关键图片门禁：阻塞加载、失败提示和验收边界——改关键图片加载时查 |
| [`critical-image-preload.md`](standards/critical-image-preload.md) | 关键图片预加载：critical/warm 分层、图集初始化和教程裁剪——改预加载链路时查 |
| [`data-entry.md`](standards/data-entry.md) | 数据录入标准：规则、图片、OCR、配置字段和核对口径——录入规则或资源数据时查 |
| [`description-to-implementation-audit.md`](standards/description-to-implementation-audit.md) | 描述到实现审计主源：从规则文字追到代码消费点——查玩法实现是否吃对规则时查 |
| [`documentation-style.md`](standards/documentation-style.md) | 项目文档写作标准：职责落点、相对链接和历史记录边界——写或整理文档时查 |
| [`e2e-verification.md`](standards/e2e-verification.md) | E2E 与截图证据：真实入口、状态注入、截图资格和证据组——跑端到端验收时查 |
| [`engine-ability-framework.md`](standards/engine-ability-framework.md) | 能力框架标准：能力定义、消费点和跨游戏抽象边界——改能力系统时查 |
| [`engine-action-log.md`](standards/engine-action-log.md) | 行动日志标准：事件、可见记录和反馈追踪——改 action log 或事件展示时查 |
| [`engine-damage-pipeline.md`](standards/engine-damage-pipeline.md) | 伤害管线标准：伤害计算、结算时机和跨层消费——改伤害或生命值流程时查 |
| [`engine-gameover.md`](standards/engine-gameover.md) | 游戏结束标准：胜负判定、终局状态和传输收口——改 gameover 流程时查 |
| [`engine-simple-choice.md`](standards/engine-simple-choice.md) | Choice Request 旧兼容附录：simple-choice 弹窗和历史兼容边界——维护旧 simple-choice 或判断新游戏禁用时查 |
| [`engine-systems.md`](standards/engine-systems.md) | 引擎系统总览：共享原语、事件、FX、AI 和状态边界——改共享引擎能力时查 |
| [`engine-transport.md`](standards/engine-transport.md) | 传输层标准：在线状态、服务端权威、恢复和反馈过滤——改联网链路时查 |
| [`engine-visual-events.md`](standards/engine-visual-events.md) | 视觉事件标准：EventStream、特写、数值冻结、实体保留和 impact 回调——改表现事件时查 |
| [`feedback-system.md`](standards/feedback-system.md) | 反馈系统标准：提交、状态、去重、恢复和回写边界——改用户反馈链路时查 |
| [`game-config-package.md`](standards/game-config-package.md) | 游戏配置包标准：manifest、配置源和包体发布边界——改游戏配置包时查 |
| [`generated-design-implementation.md`](standards/generated-design-implementation.md) | 生成设计落地标准：设计稿到前端实现的可复刻边界——按视觉稿实现 UI 时查 |
| [`global-systems.md`](standards/global-systems.md) | 全局系统标准：跨游戏公共能力和入口边界——改全局能力时查 |
| [`golden-rules.md`](standards/golden-rules.md) | 项目黄金规则：高频硬边界和不可降级口径——开工前或复盘时查 |
| [`home-v2-design.md`](standards/home-v2-design.md) | 首页设计标准：Home V2 信息架构和 UI 边界——改首页时查 |
| [`regression-closeout.md`](standards/regression-closeout.md) | 回归收口标准：症状保真、红测、同类扩审和证据口径——修回归问题时查 |
| [`rule-driven-interaction-design.md`](standards/rule-driven-interaction-design.md) | 规则驱动交互设计：Choice Request、权限、响应窗口和 AI 合法动作——新游戏、卡牌效果和特殊响应设计时查 |
| [`rule-contract-audit.md`](standards/rule-contract-audit.md) | 规则合同审计：规则源、录入合同和实现消费一致性——查规则 bug 时查 |
| [`shared-refactor-guard.md`](standards/shared-refactor-guard.md) | 共享重构护栏：共享层影响面、代表场景和防误伤验收——改公共代码时查 |
| [`code-design.md`](standards/code-design.md) | 代码设计原则、设计模式选择和反模式预防规范：写业务代码、拆职责、加抽象或审查反模式时查 |
| [`testing-audit.md`](standards/testing-audit.md) | 测试审计总入口：审计路由和证据边界——做规则或玩法审计时查 |
| [`testing-tdd.md`](standards/testing-tdd.md) | TDD 标准：先红测、再实现、保留回归保护——新功能或修 bug 前查 |
| [`timing-opportunity-resolution.md`](standards/timing-opportunity-resolution.md) | 时点-机会-结算标准：TimingPoint、Opportunity、Choice Request 和 Resolution Stack——接入复杂触发、响应、替代、防止或长事务规则时查 |
| [`tutorial-design.md`](standards/tutorial-design.md) | 教程设计标准：教学目标、提示、截图和交互顺序——改新手引导时查 |
| [`ui-animation-patterns.md`](standards/ui-animation-patterns.md) | UI 动画模式：触发、结果揭示和事件身份——改 UI 动效时查 |
| [`ui-change-gates.md`](standards/ui-change-gates.md) | UI 改动门禁：布局、槽位、截图审计和返工条件——改可见界面时查 |
| [`ui-responsive-layout.md`](standards/ui-responsive-layout.md) | 响应式布局标准：PC/移动、横竖屏和壳层分工——改多端布局时查 |
| [`ui-ux.md`](standards/ui-ux.md) | UI/UX 总原则：审美、可读性、焦点和组件边界——做界面设计或审查时查 |
| [`undo-auto-advance.md`](standards/undo-auto-advance.md) | 撤回与自动推进标准：撤回窗口、自动阶段和状态恢复——改 undo 或自动推进时查 |
| [`worktree-branch-target-lock.md`](standards/worktree-branch-target-lock.md) | worktree 与分支目标锁定：工作区归属和改动边界——处理分支或脏树时查 |

## features/（功能设计与记录 · 供了解）

| 文档 | 一句话 |
| --- | --- |
| [`_TEMPLATE.md`](features/_TEMPLATE.md) | 新功能文档模板：新增功能记录时照此建，放到对应领域或模块 |

> 暂无正式功能文档。

## lessons（经验教训 · 复发问题暂存区）

| 文档 | 一句话 |
| --- | --- |
| [`lessons.md`](lessons.md) | 经验教训：复发问题、reviewer 退回和用户纠偏的候选沉淀——开工前与复盘时查 |

---

知识文档改动先按 [`../rules/system.md`](../rules/system.md) 判定落点，再用 [`spec-steward`](../skills/spec-steward/SKILL.md) 同步索引；结构裁决记录进 [`../decisions/`](../decisions/README.md)。
