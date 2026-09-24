---
name: spec-steward
description: 维护 BoardGame .spec 结构、规范落点、索引和名册；新增/修改/删除 Agent、Skill、知识或规则，或需要把改动沉淀进 knowledge/ 时使用。
---

# Spec Steward（仓库管家）

保证对 `.spec/` 的任何改动都放对位置、格式合规、索引与名册同步，并在开发完成后把“改了什么、为什么”沉淀回知识库。
业务规范以 `.spec/AGENTS.md`、`knowledge/README.md`、`rules/system.md` 和对应 skill 正文为准。

## 何时使用

- 新增 / 修改 / 删除一个子 Agent、Skill、知识文档或规则时。
- 完成一处代码 / 设计改动后，要把它沉淀进 `knowledge/` 时。
- 不确定某份内容该放哪（rules / standards / features / agents / skills / decisions）时。
- 需要清理 AI 文档冗余、降低误读、压缩长规则或做全量自查时。
- 用户问“规范有没有问题 / 规范的规范有没有问题 / 要不要更新规范”时，先按 [`rules/system.md`](../../rules/system.md) 判断执行规范是否需要改变；确定维护动作后，再定位文件责任，不默认进入全量整理。

## 前置条件

- 能随时查阅 `.spec/AGENTS.md`（调度核心、宿主差异）与 `knowledge/README.md`（知识导航）。
- 改动目标明确（知道要加 / 改 / 删什么）。

## 操作步骤

### 流程 A · 维护结构（新增 / 修改 / 删除能力）

1. **判类型**——这份内容属于哪一类：
   - 禁止碰什么（护栏）→ `rules/`（硬规则在 `rules/system.md`，无 frontmatter）
   - 怎么做（流程 / 规范）→ `knowledge/standards/`（见 `knowledge/README.md`）
   - 某功能的设计 / 记录 → `knowledge/features/<领域>/...`（见 `knowledge/README.md`）
   - 一个职能角色 → `agents/`（先过 `.spec/AGENTS.md` 的准入口径，再照 `reviewer` 范例写）
   - 可复用方法 → `skills/<name>/SKILL.md`（目录名即 skill 名；description 只写触发条件，不概括流程）
   - 决策原因 → `decisions/`（ADR，只记录为什么）
2. **放对位置 + 命名**：
   - agent 文件：`<name>.agent.md`
   - skill 目录：`skills/<name>/SKILL.md`
   - knowledge 文档：kebab-case，放在 `standards/` 或 `features/`
3. **写 frontmatter**：
   - agents：仅 `name` + `description`
   - skills：仅 `name` + `description`
   - knowledge：`name` + `description` + `metadata`（`type` / `status`）
   - rules / decisions：无 frontmatter
4. **同步登记**：
   - 加 / 删子 Agent → 更新 `.spec/AGENTS.md` 子 Agent 名册与宿主差异表
   - 加 / 删知识文档 → 更新 `knowledge/README.md`
   - 加 / 删 ADR → 更新 `decisions/README.md`
   - 改动影响调度 → 更新 `.spec/AGENTS.md` 调度核心

### 流程 B · 沉淀知识（改动完成后）

1. 一句话总结：这次改了什么、为什么。
2. 判断文档归属：
   - 影响开发流程 / 规范 → 更新 `knowledge/standards/` 对应文件。
   - 影响功能设计 → 找 `knowledge/features/` 对应文档；有就更新，没有就从 `_TEMPLATE.md` 新建。
   - 决策 → `decisions/` 新增 ADR。
   - 复发问题 / 踩坑经验 → 追加进 `knowledge/lessons.md`。
3. 更新正文：只保留当前有效内容，交付历史不入库（git 提交即历史）。
4. frontmatter `status` 只能取枚举：`设计中` / `实施中` / `已交付` / `历史归档`；`description` 保持一句话。
5. `knowledge/README.md` 导航行来源于 frontmatter `description`，同一句话口径。
6. 待执行事项走任务卡，不堆进知识库。

### 流程 C · 清理离线任务卡

- `.spec/tasks/` 目录只留未完成 / 进行中的卡。
- 任务完成后直接删除卡文件；历史在 git，不设归档目录。

### 流程 D · 规范整理裁决

本 skill 只维护 BoardGame 的 `.spec` 结构；实际指导 Agent 工作的规则仍以 [`.spec/rules/system.md`](../../rules/system.md)、[`.spec/AGENTS.md`](../../AGENTS.md)、`knowledge/standards/` 和具体项目 workflow 为准。不要把本流程当成业务执行规范。

处理规范问题或整理文档时，只做以下裁决：

1. 找到被影响的执行规则和唯一主源，标明本文件是 `canonical-source`、`adapter`、`index`、`evidence` 还是 `drift-check`。
2. 判断是主源缺失、主源不可执行、入口不通、重复 / 冲突、过时，还是本轮没有执行；已有主源覆盖时不新增同义正文。
3. 选择 `不改`、删除重复正文、改主源、改索引 / 适配或仅记证据；删除前先迁移仍有效的独有内容并清理引用。
4. 文档去噪只保留会改变触发、动作、禁止、例外或验收的内容；历史事故、案例和证据回到任务记录、`docs/` 或 `evidence/`，不反向创造规范。
5. 改动后同步索引和直接引用，运行 `npm run spec:lint`，再检查主源与适配层的职责关系。
6. **按用户要求闭环**：如果本轮同时要求“重审 / 修复”，规范校验通过后必须回到原问题位点，重新核对当前实现、配置、测试和 evidence；发现违反新规范就修唯一作者源 / 正式 owner，并用同源验证回查。若没有发现违约、证据不足或只有止血动作，必须在结果中明确写出对应状态，不能把 `spec:lint` 当成领域修复完成。

### 流程 E · 用户明确要求“全部 / 全量”时

全量不是把几个点名文件再读一遍，而是覆盖 `.spec` 下所有文档：

1. 用文件清单按 `AGENTS / rules / knowledge / skills / decisions / tasks / agents` 分组；`skills` 内再分 `SKILL.md`、项目 reference、历史 evidence、上游参考资料。
2. 逐组核对职责：`canonical-source`、`adapter / workflow`、`index`、`evidence / drift-check`、`task record` 或 `reference`。未能归类的文件列为待裁决，不默认当规范。
3. 对每组检查入口、frontmatter、状态、索引、直接引用、重复正文和冲突口径；历史文件必须明确降级，参考资料必须明确不属于项目通用规范。
4. 对重复判断只保留一个可执行主源；有效独有内容先迁移，失效内容删除或降级，入口文档只保留链接和适配说明。
5. 改完运行 `npm run spec:lint` 与 `git diff --check -- .spec`，并报告文件总数、各组覆盖、修改清单和仍未裁决的资料。不能只报告“lint 通过”来代替全量审查。

## 快速参考

| 内容 | 去处 | frontmatter |
| --- | --- | --- |
| 禁止碰 / 改 / 提交某物 | `rules/` | 无 |
| 怎么开发（流程 / 规范） | `knowledge/standards/` | 有 |
| 某功能的设计 / 记录 | `knowledge/features/...` | 有 |
| 决策（功能内 / 框架级） | `decisions/`（ADR） | 无 |
| 复发问题 / 踩坑经验 | `knowledge/lessons.md` | 有 |
| 职能角色 | `agents/` | 仅 name + description |
| 可复用方法 | `skills/<name>/SKILL.md` | 仅 name + description |

## 注意事项

- 不抄 SPEC，只指回它；同一规则只在一处定义。
- 索引漂移 = 知识隐身：新增 / 删除文档必须同步更新 `knowledge/README.md`。
- `knowledge/README.md` 强制被入口加载，导航行保持一句话。
- `rules/` 管禁止，`standards/` 管怎么做，别混。
- BoardGame 项目 skill 的落点是 `.spec/skills/`；宿主目录通过链接暴露，不维护第二份正文。
- 项目文档里的文件链接格式以 [`documentation-style`](../../knowledge/standards/documentation-style.md) 为准：指向仓内真实文件或目录时使用相对 Markdown 链接，不写 Windows 绝对路径或裸路径代替链接。

## 验证

- [ ] `npm run spec:lint` 通过。
- [ ] 内容在正确目录，命名合规。
- [ ] `.spec/AGENTS.md` 名册、宿主差异表、调度核心与实际一致。
- [ ] knowledge 文档 `status` 与现状一致；正文只含当前有效内容，无历史堆积。
- [ ] 没有把任何规矩复制进多处。
- [ ] 用户问规范问题时，已明确结论属于执行失守、规范缺口、索引缺口、重复真相、过时规则还是章节去噪；没有用“规范很长”替代责任归因。
- [ ] 文档去噪前后的核心语义仍可逐项对上，没有因压缩丢掉触发条件、例外、禁止动作或验收证据。
- [ ] 删除操作无悬空引用残留。
- [ ] `.spec/tasks/` 只含在途卡。
- [ ] 用户要求全量时，已给出全部文档分组和未裁决项，不把参考资料、证据或任务卡冒充执行规范。

## 汇报口径

- 项目规范更新完成后，必须说明唯一真相源、作用范围和同步层角色。作用范围要明确写成全项目 / 多游戏、单游戏专项、单任务记录或证据记录，避免把项目级规则误报成单游戏规则。
