---
name: testing-audit
description: 测试审计总入口：结论分层、工具选择和专项入口——做规则或玩法审计时查
metadata:
  type: doc
  status: 已交付
---

# 测试与审计规范

> **触发条件**：新增功能/技能/API、修复 bug、审查实现完整性时阅读。

---

## 核心原则入口

> fail-close 审计速查、全面审计完成定义、录入/图片/旧 evidence 边界、交互入口语义矩阵和技能完整流程矩阵，已拆到 `.spec/knowledge/standards/testing-audit-core-principles.md`。
>
> 本文档只保留审计总入口、证据分层和流程路由。凡要对外写“已审计 / 已收口 / 全面审计完成”，必须先读核心原则文档并按其中矩阵落证据。

### 审计结论、证据与范围门禁入口（强制）

- 对外结论等级、四类缺口和 evidence 落盘格式，统一看 `.spec/knowledge/standards/audit-evidence-template.md` 的 2.0、2.2、3、5、6 节；不得在本入口另写一套结论词。
- L1-L4 定义、跨层通用能力、deferred/finalize、时序 UI 证据和审计范围升级，统一看 `.spec/knowledge/standards/testing-audit-core-principles.md` 的“证据层级与跨层能力门禁”和核心原则；本文件只保留路由。
- `审计 / 继续 / 重审` 不自动扩大范围；若当前总账没有用户点名对象、新证据冲突或真相源变化等升级触发，只消费已有证据，不自造新的全量审计队列。

### 深度审计流程入口（强制）

深度审计执行步骤已迁入 `.spec/knowledge/standards/testing-audit-core-principles.md`。本文档不再复制 Step 0-5 细则，避免审计入口和核心原则双写。

- 适用场景：用户要求“审计 / 全面核对 / 这批都看完 / 为什么审计没发现”，或当前问题已暴露出共享根因、链式交互、跨系统状态推进风险。
- 核心原则：深审必须把对象清单、完整链路、真实入口、共享根因、失效回写五件事一次打穿。
- 执行前必须读取 `testing-audit-core-principles.md` 的「深度审计执行步骤」，按 Step 0-5 和深审禁区落 evidence。

### 禁止假阳性收口（强制）

以下证据只能证明“展示存在 / 结构有接入 / prompt 能出现”，不能单独作为玩法收口依据：

- 只证明 faction selection、横幅、房间 UI、资源展示、静态素材存在的 E2E。
- 只证明测试文件包含某个 id、`registerAbility` 出现在回归文件里、静态覆盖为零。
- 只证明 prompt / modal / interaction 被打开，未证明玩家从真实入口走到该交互。
- 通过状态注入、直接改 `sys.interaction.current`、进入 prompt 后再接管流程的注入型交互 E2E。
- 只证明按钮可点、toast 出现、日志打印，未证明最终权威状态或后续流程真的变化。
- 只证明 `prompt/modal` 打开、`pendingAttack.sourceAbilityId` 命中、`pendingDamage` 存在、`pendingBonusDiceSettlement` 出现，但未继续证明最终权威状态与临时态清理。

出现上述情况时，文档必须明确标注为“展示证据 / 结构证据 / 注入型交互证据”，不得偷换成“完整玩法验证”。

### 回归问题处理入口（强制）

> 适用场景：用户明确说“之前正常现在不行”、怀疑回归，或本轮修改后出现旧功能异常。

回归处理主源为 `.spec/knowledge/standards/regression-closeout.md`；本文档不再复制回归判定、最后正常证据、引入提交 diff、错误 hunk 还原、首跑红测、原始位点 E2E、UI 最小还原例外、代理按钮合同和输出模板。

- 回归成立前：先按用户原话锁原始症状、复现范围、最后正常证据和首次变坏范围。
- 修复前：按主源定位引入提交或改动批次，优先恢复最后正常行为；不得用新交互或新逻辑冒充回归还原。
- 修复后：按主源补回归验证、保留首跑失败证据、同类扩审，并回写旧测试 / 旧 evidence / 规范漏审原因。

### 指定“最近合并 PRxx”为权威基线时的红测归因（强制）

> 适用场景：Owner/用户明确要求“全都以最近合并（例如 PR63）为准”，或明确指定某个 merge commit 作为权威口径。

**核心约束**：必须严格对照 PR 基线实现 / 当前实现 / 测试断言，**不得默认判定“测试过时”或“实现回归”**。若该 PR 为主动修改，且与权威描述一致、确实解决问题，则直接按合并口径更新测试/证据；否则必须先询问用户后再裁决。

1. **锁定权威基线提交**：用 `git log --merges -n 20 --oneline` 找到对应 PR 的 merge commit（记录完整 commit id）。
2. **对每个失败用例列三份事实**（必须写清楚）：
   - **PR 基线实现**：`git show <mergeCommit>:<file>`（实现当时到底做了什么）
   - **当前实现**：`git show HEAD:<file>` / 工作区实际文件（现在做了什么）
   - **当前测试断言**：测试到底在断言什么（交互结构、字段、事件、错误文案等）
3. **先判定 PR 主动修改是否成立**：
   - **成立且与描述一致、确实解决问题** → 直接按合并口径更新测试/证据（必要时同步实现对齐）。
   - **不成立或无法确认** → **必须先询问用户**，再进入下方裁决。
4. **裁决类型（必须三选一）**：
   - **测试过时**：测试断言与 PR 基线实现不一致 → **优先改测试**（把测试更新到权威口径）
   - **实现回归**：当前实现偏离 PR 基线实现，且无明确业务变更理由 → **优先改实现**（恢复到权威口径）
   - **业务变更**：PR 基线后存在明确的业务变更（merge 说明、evidence、规则更新）→ **改测试 + 补证据**（不能只改实现硬凑）
5. **最小验证要求**：
   - 至少跑到“失败的那个测试文件/用例”并通过（给出命令）。
   - 若失败用例涉及交互链/结算链，除单测外还应补 1 条更贴近真实链路的验证（smoke / GameTestRunner / E2E 任选其一，按改动层级决定）。

### Bug 修复后的同类扩审入口（强制）

同类扩审主源为 `.spec/knowledge/standards/regression-closeout.md` 的「同类扩审最低要求」。本文档不再复制搜索维度、共享层覆盖和交付口径。

- 修复 bug 后必须先定根因，再按事件类型、状态字段、共享 helper、生命周期、同族对象和旧 evidence 横向搜索。
- 扩审未完成时，最终口径只能写“当前点位已修复，仍有残余扩审范围”，不得写“已收口”。
- **测试覆盖声明必须对账**：凡 evidence 或对外汇报写“有测试 / 测试覆盖 / 可玩 handler + 测试”，且对象语义包含选择、然后、可以、至多、任意数量、抽弃、prompt 或 simple-choice，必须写清测试断言覆盖的最终权威状态、玩家选择路径、负向路径或边界输入。只写 tests passed、测试文件名、用例数量或 handler 名，不能支撑语义正确。

### 根因分级与处置入口（强制）

根因分级与处置主源已迁入 `.spec/knowledge/standards/testing-audit-core-principles.md` 的「根因分级与处置」。本文档不再复制数据/录入、单点实现、共享抽象、架构/时序分级和重构完成定义。

- 修 bug、做审计或解释漏审时，先按核心原则判根因类型，再决定局部修复、共享抽象重构、时序职责调整或临时止血。
- 若根因是共享抽象、职责重叠、时序窗口或架构假设错误，不能只修当前 case；必须按核心原则和 D 维度处理。

### 审计 evidence 模板与自检入口（强制）

审计文档建议命名为 `evidence/<game-or-module>-<scope>-audit-YYYY-MM-DD.md`，正文主源为 `.spec/knowledge/standards/audit-evidence-template.md`。本文档不再复制模板字段，避免审计入口和 evidence 模板双写。

- 模板主源承载：审计范围、结论等级、权威来源、逐项结论、验证证据、共享根因与残余范围、修订记录、继续任务防重复门禁、测试语义对账与同类扩审。
- 凡 evidence 或审计汇报要使用“全面审计完成 / 当前发布口径已收口 / 当前代码验证口径已收口 / 已审计 / 已收口 / 已审计完成 / 对象级审计已收口 / full_audit”口径，必须按模板 6.1 运行 `npm run audit:evidence:selfcheck -- <evidence 文件>` 并把命令与结果写回 evidence。
- 自检脚本只限制审计文档继续声称“已审计 / 已收口 / 全面审计完成”，不是默认 git 提交、push、release 或 deploy 硬门禁；脚本失败时只能补证据、降级结论，或回写旧结论失效。
- 自检扫描范围、`--include-untracked`、`audit:evidence:all`、轻量 evidence 检查和脚本局限统一以 `audit-evidence-template.md` 为准；脚本通过仍不能替代 D 维度人工审计和真实规则验证。

---

## 测试工具选型（辅助手段）

> **核心原则**：GameTestRunner 行为测试最优先，审计工具是补充。

| 工具 | 适用场景 |
|------|---------|
| GameTestRunner | 命令序列+状态断言（首选） |
| entityIntegritySuite | 数据定义契约（≥20 实体时必选） |
| referenceValidator | 实体引用链验证 |
| interactionChainAudit | UI 状态机 payload 覆盖（多步 UI 交互时必选） |
| interactionCompletenessAudit | Interaction handler 注册覆盖（有 InteractionSystem 时必选） |

### 效果数据契约测试（强制）

新增游戏/英雄/卡牌/Token 定义时必须同步编写。职责：结构完整性 + 语义正确性。数据定义必须包含所有执行所需字段，禁止执行层"猜测"。

- `createEffectContractSuite`：接受 getSources/getSourceId/extractEffects/rules/minSourceCount
- `createI18nContractSuite`：验证 i18n key 格式和存在性
- 新增游戏 → 创建 `entity-chain-integrity.test.ts`；所有有 action 的效果必须声明 timing

### 交互链完整性审计

**模式 A（UI 状态机）**：多步交互必须声明 `interactionChain`。检查：声明完整性、steps ⊇ required、定义层与执行器 payloadContract 双向一致。

**模式 B（Interaction 链）**：检查 handler 注册覆盖、链式完整性、孤儿 handler。审计输入从源码自动抽取，禁止维护手工列表。

### CI 质量门禁

PR 必跑：`typecheck` → `test:games` → `i18n:check` → `test:e2e:critical`。

---

## E2E 测试选择器一致性检查（强制）

> E2E 选择器来源、交互路径、i18n 按钮文本、状态断言和反模式以 [`e2e-verification`](e2e-verification.md) 的「选择器与断言一致性」为准。
>
> 本文档只保留审计入口；凡因 UI 重构需要判断 E2E 断言是否同步，先回到 E2E 主源。`docs/automated-testing.md` 只能作为 runner、fixture 和工具 API 参考。

---

## D 维度库入口

> D1-D58 具体维度、维度选择指南和输出格式已拆到 `.spec/knowledge/standards/testing-audit-dimensions.md`。
>
> 本文档只保留审计入口、证据分层和流程门禁。需要选择具体维度时，先读 `testing-audit-dimensions.md`；涉及 UI 渲染模式时同时读 `testing-audit-d48-ui-rendering.md`；涉及力量修正主语时同时读 `testing-audit-d1-power-modifier-subject.md`。

## 描述→实现全链路审查规范入口（强制）

> 描述到实现的权威描述锁定、原子断言拆解、交互链拆分、八层追踪、grep 消费点、交叉影响和复杂语义模式，已拆到 `.spec/knowledge/standards/description-to-implementation-audit.md`。
>
> 本文档只保留审计入口、证据分层、D 维度入口和专项路由。新增或主动审查游戏机制实现时，先读该专项文档；玩家反馈的规则 bug 优先走 `.spec/skills/rule-bug-fix-workflow/SKILL.md` 与 `.spec/knowledge/standards/rule-contract-audit.md`。

## E2E 测试框架规范入口（强制）

> E2E、截图验收、流程截图证据链、奖励骰/特写截图、生效时机判定、成功路径和对外口径门禁已归并到 `.spec/knowledge/standards/e2e-verification.md`。
>
> 本文档只保留审计入口、证据分层、D 维度入口和描述→实现审查入口。凡要写“已跑 E2E / E2E 通过 / 已验证成功”，必须回到 `e2e-verification.md` 的截图证据链和对外口径门禁。
