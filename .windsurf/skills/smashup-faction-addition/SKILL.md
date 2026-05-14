---
name: smashup-faction-addition
description: "Smash Up 新增派系端到端流程。用于用户说“新增派系”“新派系增加流程”“加了卡牌和基地素材”“把派系做进游戏”“从素材做到可玩”等场景；默认整合 intake、图片上传、静态数据、玩法实现、审计、E2E 与 evidence，除非用户明确说只做 intake。"
---

# Smash Up 新增派系端到端流程

## 默认完成定义（强制）

当用户要求 Smash Up 新增派系或“新派系增加流程”时，默认不是只做素材 intake，而是连续完成：

1. 素材与真相源合同
2. 图片压缩、manifest、R2/CDN 上传与 HEAD 回查
3. atlas / faction / card / base / locale / metadata 静态接入
4. 逐派系玩法 implementation
5. 逐派系测试与 evidence
6. 统一审计
7. 关键真实入口 E2E 与截图证据

只有用户明确说“只做 intake / 只录素材 / 先别实现玩法”时，才允许停在 intake。

## 素材与 Git 边界（强制）

- 大图源文件、压缩图、卡图/基地图默认走 R2/CDN 链路，不把 `.gitignore` 命中的图片当成必须提交的问题。
- Git 默认只提交代码、数据、manifest、atlas 注册、locale、测试与 evidence；不要建议 `git add -f` 大图，除非用户明确要求或项目规范另有硬性例外。
- 上传完成后必须记录远端验证证据：至少包含 R2/CDN URL、`HEAD`/等价请求结果、manifest 条目、atlas grid 尺寸。
- 如果远端验证失败，只能汇报“资源上传/回查未完成”，不得用本地图片存在或压缩成功冒充素材链路完成。

## 必读文档

- `docs/ai-rules/data-entry.md`
- `docs/ai-rules/asset-pipeline.md`
- `docs/ai-rules/engine-systems.md`
- `docs/ai-rules/testing-audit.md`
- `docs/testing-best-practices.md`
- `docs/automated-testing.md`
- `docs/games/smashup/workflows/smashup-faction-intake.md`
- `docs/games/smashup/workflows/smashup-faction-implementation.md`

## 工作区与计划

- 必须先确认当前 worktree / branch 是本任务专用。
- 如果根目录 `task_plan.md/findings.md/progress.md` 已被其他任务占用，不得混写。
- 此时在 `temp/smashup-<batch>-implementation-status.md` 建立本任务状态清单，至少包含：
  - 派系列表
  - 每派系卡牌 / 基地对象清单
  - L0/L1/L2/L3/L4 当前状态
  - 已跑命令与结果
  - evidence 路径

## 旧派系参考门禁（强制）

新增派系实施前，必须先参考旧派系实现，而不是凭牌面直接硬写：

1. 对每个新派系建立“旧实现映射表”：
   - 目标机制
   - 已有相似派系 / 卡 / base
   - 复用位置（`data/factions`、`abilities`、domain helper、tests）
   - 差异与新增缺口
2. 至少搜索并阅读以下旧实现类别：
   - destroy / power threshold
   - move minion / swap / transfer action
   - beforeScoring / afterScoring special
   - ongoing modifier / talent
   - extra minion / extra action
   - reveal top deck / discard recursion / shuffle discard
   - base ability hooks
3. 若旧实现已有共享机制，优先复用或抽象，不得为新派系复制硬编码分支。
4. 若旧实现是历史债或只适合旧卡，必须在 evidence 记录“参考但不复用”的原因。

## 执行顺序

### S0 Intake

按 `smashup-faction-intake.md` 完成并验证。完成后不能停；继续进入 S1/S2/S3。

### S1 静态与配置复用

- 补齐 `abilityTags`、`targetType`、已有 handler 绑定等能直接复用的字段。
- 新增/调整静态字段后，必须补静态合同测试。

### S2 玩法机制实现

按单派系闭环推进，禁止三派系同时半成品：

1. Sharks：实现 → 单测/行为测试 → evidence
2. Tornados：实现 → 单测/行为测试 → evidence
3. Mythic Greeks：实现 → 单测/行为测试 → evidence

每个派系内再拆：

- 可复用机制
- 共享机制缺口
- UI/交互与 E2E 缺口

可选语义强制门禁：

- 文案含“你可以 / 可以选择 / 至多 / 任意数量 / may / up to / any number”的对象，不能只实现成功路径。
- 只要有合法候选，必须提供 skip/空选/拒绝执行路径；`autoResolveIfSingle` 不能在可选 prompt 中把单候选直接结算掉。
- 行为测试至少覆盖：合法候选存在 → 玩家跳过/空选 → 权威状态不变且交互清空；另补成功路径证明效果本身仍可执行。
- 审计 evidence 的逐对象矩阵必须单列“强制/可选合同”和“拒绝路径证据”，不得用“能移动/能消灭/能加入手牌”替代“可以不执行”。

### S3 真实入口 E2E

- E2E 必须从真实打牌 / 真实 talent / 真实 special / 真实 scoring 入口进入。
- 禁止用预打开 prompt 作为唯一完成证据。
- 截图必须看得到对应对象本体。
- 最终回复若提 E2E 通过，必须给截图绝对路径。
- 多派系批量新增不能只做每派系 1 条“代表路径”就宣称完成。必须先建立“新增交互覆盖矩阵”，按交互类型覆盖：
  - 手牌行动 / 持续行动 / 天赋 / special / 基地能力 / 计分前后能力 / 多选或逐目标交互 / attach-detach 或状态迁移。
  - 三个及以上新派系批量接入时，E2E 下限为至少 5 条不同新交互；若实际新增交互类型超过 5 个，应覆盖所有高风险类型，并在 evidence 写明哪些仅由行为测试覆盖。
  - 可选交互至少要有一条真实入口或行为级拒绝路径证据：有合法目标时点击跳过/空选后，截图或 finalState 必须证明目标未被移动/消灭/改变。
  - “派系选择页可见”“卡图能显示”只能算静态/入口验证，不能抵扣玩法交互 E2E。

### S4 审计与收口

- 每派系必须有 evidence。
- 审计必须逐卡/逐基地列出：真相源文本、实现位置、旧派系参考、测试覆盖层级（静态/行为/E2E）、未覆盖风险。
- 统一审计文档必须区分：
  - 本任务新增范围
  - 历史基线债务
- 只能按实际层级汇报：
  - 结构审计通过
  - 行为级已验证
  - 代表性玩法已验证
  - 当前发布口径已收口
  - 仍有残余范围

## 禁止事项

- 禁止 intake 完成后直接停下并让用户“下一步再说”。
- 禁止用“素材已接入 / faction selection 可见 / 单测过”冒充玩法完成。
- 禁止不参考旧派系实现就新增私有硬编码。
- 禁止没有 evidence 就宣称“已审计 / 已收口”。
