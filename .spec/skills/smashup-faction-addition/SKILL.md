---
name: smashup-faction-addition
description: "Smash Up 新增派系端到端流程。用于新增派系、卡牌/基地素材、从素材做到可玩；含 intake、上传、数据、玩法、审计、E2E。"
---

# Smash Up 新增派系端到端流程

## 规范来源与职责边界

- 本 skill 是 `adapter/workflow`：只承载大杀四方新增派系的项目专项流程。
- 跨游戏新增派系/角色/英雄的通用执行流以 `.spec/skills/add-new-faction/SKILL.md` 为主。
- 大杀四方录入和实现专项 workflow 以 `.spec/skills/smashup-faction-intake/SKILL.md` 与 `.spec/skills/smashup-faction-implementation/SKILL.md` 为主；本 skill 只做端到端收口顺序。
- 数据、资源、审计、E2E 标准仍回 `.spec/knowledge/standards/` 对应主源，不在本 skill 复制成通用规范。

## 默认完成定义（强制）

当用户要求 Smash Up 新增派系或“新派系增加流程”时，默认不是只做素材 intake，而是连续完成：

1. 素材与真相源合同
2. 图片压缩、manifest、服务器素材主源发布与 HEAD 回查
3. atlas / faction / card / base / locale / metadata 静态接入
4. 逐派系玩法 implementation
5. 逐派系测试与 evidence
6. 统一审计
7. 关键真实入口 E2E 与截图证据

只有用户明确说“只做 intake / 只录素材 / 先别实现玩法”时，才允许停在 intake。

## 素材与 Git 边界（强制）

- 大图源文件、压缩图、卡图/基地图默认走服务器素材主源发布链路，不把 `.gitignore` 命中的图片当成必须提交的问题。
- Git 默认只提交代码、数据、manifest、atlas 注册、locale、测试与 evidence；不要建议 `git add -f` 大图，除非用户明确要求或项目规范另有硬性例外。
- 上传完成后必须记录远端验证证据：至少包含服务器素材主源 URL、`HEAD`/等价请求结果、manifest 条目、atlas grid 尺寸。
- 如果远端验证失败，只能汇报“资源上传/回查未完成”，不得用本地图片存在或压缩成功冒充素材链路完成。
- Smash Up 新 atlas 进入运行时前，必须同时核对两层 manifest：
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
  只更新游戏级 manifest 不算资源链完成；根级 i18n manifest 漏新键时，运行时候选链会缺索引。
- 如果基地实际复用旧 atlas（例如新派系直接复用既有 `base` 合同），就不得再保留一个同名“候选基地图集”在 `public/assets/i18n/zh-CN/smashup/base/`。这种图只能放临时目录，或在判定不进入运行时后立刻从正式资源树删除，避免后续 `assets:upload` 误传。

## 必读文档

- `.spec/knowledge/standards/data-entry.md`
- `.spec/knowledge/standards/asset-pipeline.md`
- `.spec/knowledge/standards/engine-systems.md`
- `.spec/knowledge/standards/testing-audit.md`
- `.spec/knowledge/standards/e2e-verification.md`
- `docs/testing-best-practices.md`（测试工具参考）
- `docs/automated-testing.md`（runner / fixture / API 参考）
- `.spec/skills/smashup-faction-intake/SKILL.md`
- `.spec/skills/smashup-faction-implementation/SKILL.md`

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

规则子句强制门禁：

- 每张卡/基地不能只写一行“已实现”。必须把真相源文本拆成 `C1/C2/C3...` 子句，例如：时机、主效果、替代打出入口、额外行动/随从额度、持续触发、otherwise/而不是、其余牌顺序、once/turn、清理。
- 每个子句必须分别映射到数据字段、command payload、validator、handler/resolver、reducer 消费点、UI 入口或截图/测试证据。
- 只覆盖主效果时，只能把主效果子句标为通过；漏掉第二句“特殊能力 / 改为 / 否则 / 其余 / 每回合一次”时，整张卡不得标 `passed`。

可选语义强制门禁：

- 文案含“你可以 / 可以选择 / 至多 / 任意数量 / may / up to / any number”的对象，不能只实现成功路径。
- 只要有合法候选，必须提供 skip/空选/拒绝执行路径；`autoResolveIfSingle` 不能在可选 prompt 中把单候选直接结算掉。
- 只要语义是让玩家选择卡牌、基地、随从、角色、目标、来源、目的地、顺序、数量或是否执行，单候选也必须保留交互；不得用 `autoResolveIfSingle: true`、`candidates[0]` 或同类第一项回退替玩家完成选择。
- 行为测试至少覆盖：合法候选存在 → 玩家跳过/空选 → 权威状态不变且交互清空；另补成功路径证明效果本身仍可执行。
- 审计 evidence 的逐对象矩阵必须单列“强制/可选合同”和“拒绝路径证据”，不得用“能移动/能消灭/能加入手牌”替代“可以不执行”。

### S3 真实入口 E2E

- E2E 必须从真实打牌 / 真实 talent / 真实 special / 真实 scoring 入口进入。
- 禁止用预打开 prompt 作为唯一完成证据。
- 截图必须看得到对应对象本体。
- 最终回复若提 E2E 通过，必须给截图绝对路径。
- 只要本轮新增对象引入了**新的交互类型**或**新的 UI 表现 / 新的交互组件 / 新的操作方式**，就必须至少补 `1` 条该新类型 / 新 UI 的 direct E2E；不得只用旧对象或同链对象的 shared 证据代替首条真实入口验证。
- 上述“新交互类型 / 新 UI”在验收时必须显式列出：对应对象、E2E 文件路径、以及本轮实际核对的截图绝对路径；缺任一项，都不能把该新类型 / 新 UI 写成“已验收”。
- 明确包含多派系的批量新增按**已锁定对象范围的对象级深审**处理，不能只做每派系 1 条“代表路径”就宣称完成；未被锁定的派系不因同批标签自动纳入。
- 必须先建立“新增对象 × 交互链路矩阵”，至少列出：对象、规则子句、入口类型、共享链路 ID、是否允许复用代表链、对应 L3/L4 证据。
- 默认要求：每个新增对象都要有自己的 L3/L4 结论。只有在已经证明“与另一对象共用完全同一条链路，差异仅为配置不同”时，才允许复用代表链，而且 evidence 必须写清复用依据与被复用对象。
- `仅配置不同` 的最低判定条件：同一 handler / resolver / interaction family、同一时机、同一资源消耗、同一候选生成、同一 skip/拒绝路径、同一 finalize/清理语义；若多出新的排序、多选、reaction、special 窗口、deferred 或替代入口，必须独立补对象级 E2E。
- 可选交互至少要有一条真实入口或行为级拒绝路径证据：有合法目标时点击跳过/空选后，截图或 finalState 必须证明目标未被移动/消灭/改变。
- “派系选择页可见”“卡图能显示”只能算静态/入口验证，不能抵扣玩法交互 E2E。

### S4 审计与收口

- 每派系必须有 evidence。
- 审计必须逐卡/逐基地列出：真相源文本、规则子句表、实现位置、旧派系参考、测试覆盖层级（静态/行为/E2E）、未覆盖风险。
- 审计结论以子句最低层级为准：一张卡有 5 个子句，其中 4 个 L3、1 个未实现，则对象状态只能是 `partial/scoped-debt`，不得写 `passed`。
- 用户或任务只说“审计 / 全面审计 / 收口审计”时，本 skill 按核心原则对**已锁定对象范围**彻底做到底：范围内每个新增对象都必须有独立审计行和 L0/L1/L2/L3/L4 结论；除非已登记为“共享链路完全同构，仅配置不同”的合法复用，否则不得用代表性玩法验证替代对象级结论。未被锁定的批次对象不自动纳入。
- 统一审计文档里只要还存在“未做对象级 L3/L4、但用代表链兜住”的情况，结论就不能写“已审计完成 / 当前发布口径已收口”，只能写“代表性验证完成”或“仍有残余范围”。
- “审计”默认就是对锁定范围做到底：锁定清单中的每张卡、每个基地、每个 Token/状态/升级对象都必须有独立矩阵行，禁止只审代表卡或代表玩法。
- 只有多个对象确认走同一共享链路，且差异只剩 `id/名称/文案/数值/目标枚举/筛选参数` 这类配置项时，才允许复用同一条 L3/L4 代表链；此时仍必须逐对象登记代表对象、共享链名称、判等依据和剩余差异。
- 只要某对象仍有未补子句、未补拒绝路径、未补 reaction/queue/afterScoring 等高风险层，整派系状态只能写“仍有残余范围”，不得写“已审计完成”。
- 统一审计文档必须区分：
  - 本任务新增范围
  - 历史基线债务
- 若本轮命中了“新交互类型 / 新 UI”，统一审计文档还必须单列一个验收小节，至少写明：
  - 新类型 / 新 UI 名称
  - 首条 direct E2E 对象
  - E2E 文件路径
  - 对应截图绝对路径
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
- 禁止把“每类交互挑 1 条代表链跑通”表述成“这批新增已全面审计”。
