## Context

本轮不是单一的“录图片”任务，而是一个批量派系新增任务：

- 输入是一组本地中文 atlas 图
- 需要先完成 truth-source intake
- 再逐个派系进入玩法实现
- 同时还要把这条链路沉淀为未来可复用的 workflow

项目当前已经有：

- `.spec/skills/data-entry-workflow/SKILL.md`
- `.spec/skills/smashup-faction-intake/SKILL.md`

但缺少 intake 之后的实现 workflow，因此 AI 容易在“资源接好了”和“派系真的做完了”之间停住。

## Goals / Non-Goals

- Goals:
  - 用两段式 workflow 覆盖 Smash Up 新派系批量任务
  - 正式接入 `Mermaids / Skeletons / World Champs`
  - 对 `World Champs` 建立逐张复用裁定，避免误复用
  - 让长期任务状态与多 agent 协作可以留下清晰证据
- Non-Goals:
  - 不为 Smash Up 单独再造一个新的 skill
  - 不顺手扩展其他未在本轮范围内的派系
  - 不把别的任务占用中的根 planning 文件抢过来混写

## Decisions

### Decision: 保留 `data-entry-workflow` 作为统一入口，不新增独立 Smash Up skill

- 原因：新增 skill 只会复制一层路由逻辑，维护成本更高。
- 做法：让 `data-entry-workflow` 明确分流：
  - 仅 intake → `smashup-faction-intake`
  - intake + 玩法实施 → `smashup-faction-intake` 完成后继续进入 `smashup-faction-implementation`

### Decision: 把 Smash Up 派系批量任务拆成 `intake → implementation`

- `smashup-faction-intake.md` 只负责来源合同、atlas、静态数据、locale、R2、intake 验证
- `smashup-faction-implementation.md` 专门负责玩法实现、逐派系验证、统一收口

### Decision: `World Champs` 最后实施，并要求逐张裁定

- `Mermaids` / `Skeletons` 是正常派系结构，实施边界更清晰
- `World Champs` 是混源 one-of deck，必须等已有实现复用点和缺口都看清后再落地
- “名字一样”不等于“语义可直接复用”

### Decision: 证据分层

- intake 合同文档负责证明“图、索引、名称、数量、base 元信息是真的”
- implementation evidence 负责证明“功能、交互、截图、测试真的完成”

## Risks / Trade-offs

- 风险：`World Champs` 中不少卡来自仓库尚未正式实现的旧派系  
  → 缓解：把它排到最后，并逐张写清裁定表
- 风险：当前主工作区存在大量无关脏改动  
  → 缓解：本轮不抢占根 planning 文件，不做分支/worktree 操作，改动面尽量聚焦 Smash Up

## Migration Plan

1. 先落 intake 合同
2. 起草并验证 OpenSpec change
3. 改造 workflow 文档
4. 接入 atlas / faction / locale / UI metadata
5. 按 `Mermaids → Skeletons → World Champs` 顺序逐派系实现
6. 统一完成测试、evidence、资源上传与收口

## Open Questions

- `World Champs` 中每张牌与当前仓库已有实现之间的语义差异，是否存在“同名但需要轻微特化”的情况
- 是否需要为本轮三派系新增专门的 shared helper，以降低一批重复 handler 的实现成本
