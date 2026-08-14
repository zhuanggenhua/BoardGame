---
name: spec-steward
description: 维护 BoardGame .spec 结构、规范落点、索引和名册；新增/修改/删除 Agent、Skill、知识或规则，或需要把改动沉淀进 knowledge/ 时使用。
---

# Spec Steward（仓库管家）

保证对 `.spec/` 的任何改动都放对位置、格式合规、索引与名册同步，并在开发完成后把“改了什么、为什么”沉淀回知识库。
本技能不复述业务规范；权威在 `.spec/AGENTS.md`、`knowledge/README.md`、`rules/system.md` 和对应 skill 正文。

## 何时使用

- 新增 / 修改 / 删除一个子 Agent、Skill、知识文档或规则时。
- 完成一处代码 / 设计改动后，要把它沉淀进 `knowledge/` 时。
- 不确定某份内容该放哪（rules / standards / features / agents / skills / decisions）时。

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

## 验证

- [ ] `npm run spec:lint` 通过。
- [ ] 内容在正确目录，命名合规。
- [ ] `.spec/AGENTS.md` 名册、宿主差异表、调度核心与实际一致。
- [ ] knowledge 文档 `status` 与现状一致；正文只含当前有效内容，无历史堆积。
- [ ] 没有把任何规矩复制进多处。
- [ ] 删除操作无悬空引用残留。
- [ ] `.spec/tasks/` 只含在途卡。
