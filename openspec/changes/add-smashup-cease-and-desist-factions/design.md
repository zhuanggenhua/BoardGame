## Context

本批次是一张共享卡牌 atlas、一个共享基地 atlas、四个独立派系和两个既有泰坦的组合接入。卡牌 atlas 为 `8 x 7`，但只有前 55 格是运行时卡牌；最后一格是宇宙武士展示图。基地 atlas 为 `2 x 4`，8 格全部是正式基地。

当前仓库已实现漫步山丘与合体机器人泰坦的静态定义、能力、交互和测试，但尚未实现其所属的卑劣封臣与百变机兵牌组。因此本 change 的核心不是重新做泰坦，而是先锁定图片和规则合同，再把四个派系接到既有 Smash Up 运行时，并证明泰坦与所属派系真实联动。

## Goals / Non-Goals

- Goals:
  - 四派系从正式派系选择入口可选、可初始化并完整结算。
  - 中文图面、row-major 索引、卡牌数量、基地归属和泰坦归属可追溯。
  - 每张卡和每个基地都有规则子句表、完整流程矩阵与 L0-L4 结论。
  - 漫步山丘和合体机器人复用当前运行时，并补所属派系的 direct E2E。
  - 正式图片完成压缩、manifest、上传与远端回查。
- Non-Goals:
  - 不覆盖现有共享 atlas 或其他派系资源。
  - 不重写已经存在的泰坦框架和泰坦能力。
  - 不在 proposal 审批前修改运行时代码。
  - 不用占位图、自绘图或临时裁片替代正式运行时资源。

## Decisions

### Decision: 将整张图作为四派系同批次处理

TTS kit、CardID 范围和图面派系脚注共同证明该 atlas 属于 `Cease and Desist` 四派系，不拆成互不关联的四个来源任务。OpenSpec、资源合同和最终汇总以一个批次管理，但 implementation 仍按单派系闭环推进。

### Decision: 锁定 cards atlas 可视合同

| atlas index | 运行时归属 | 唯一牌图数 | 处理 |
| --- | --- | ---: | --- |
| `0-17` | 宇宙武士（`astroknights`） | 18 | 正式卡牌 |
| `18-29` | 卑劣封臣（`ignobles`） | 12 | 正式卡牌 |
| `30-42` | 星际旅者（`star_roamers`） | 13 | 正式卡牌 |
| `43-54` | 百变机兵（`changerbots`） | 12 | 正式卡牌 |
| `55` | 宇宙武士展示图 | 1 | `display-only`，禁止生成 card def |

所有 previewRef、atlas frame 和卡牌定义必须从该合同派生。不得根据相邻卡名猜索引，也不得把展示图补成虚构卡牌。

### Decision: 锁定 bases atlas 可视合同

| atlas index | 基地 | 派系 |
| --- | --- | --- |
| `0` | Spikey Chair Room | 卑劣封臣 |
| `1` | No-Moon | 宇宙武士 |
| `2` | USS Undertaking | 星际旅者 |
| `3` | Unicrave | 百变机兵 |
| `4` | Wintersquashed | 卑劣封臣 |
| `5` | Changing Room | 百变机兵 |
| `6` | Neutral Space | 星际旅者 |
| `7` | Hive of Scum and Villainy | 宇宙武士 |

base atlas 必须使用独立 atlas ID 接入，不覆盖已有 base atlas。

### Decision: 泰坦运行时采用复用与补证

- 卑劣封臣复用漫步山丘（`ignobles_the_hill_that_strolls`）。
- 百变机兵复用合体机器人（`changerbots_mergacon`）。
- 星际旅者与宇宙武士没有本批次额外泰坦。

当前代码已有两张泰坦的 handler、interaction、locale 与测试，本 change 只允许：

- 补派系到泰坦的 registry/set-aside 关联。
- 校验派系选择和初始化后泰坦可用。
- 补至少一条从所属派系真实入口进入的 direct E2E。
- 若当前实现与新锁定合同冲突，先回写旧 evidence，再做最小修复。

### Decision: 每个派系使用独立数据与能力模块

预期新增：

- `data/factions/astroknights.ts`
- `data/factions/ignobles.ts`
- `data/factions/star_roamers.ts`
- `data/factions/changerbots.ts`
- 对应独立 `abilities/*.ts`

共享文件只增加注册、atlas、metadata 和必要 helper 接线。只有规则合同证明现有运行时无法表达某个 effect atom 时，才扩展共享机制。

### Decision: intake 锁定后再进入 gameplay

进入 implementation 前必须完成：

1. 55 个唯一卡牌对象和 8 个基地的完整单对象裁图。
2. 中文原文、英文 canonical 原文、数量、power、breakpoint、目标与限定词合同。
3. 逐对象规则子句表和冲突表。
4. 资源落点、压缩产物、manifest key 与上传计划。
5. 每个对象标记 `locked / blocked / disputed`。

未锁定对象不得进入 handler 实现。

## Risks / Trade-offs

- 用户图面中文名与仓库历史中文译名存在差异。
  - Mitigation: 本 change 以用户提供汉化图作为中文显示真相源，历史译名仅作对照并在 intake 冲突表留档。
- 四派系共享注册文件与其他当前批次相交。
  - Mitigation: 独立模块承载业务逻辑，共享文件只做最小增量；编辑前后逐文件 diff。
- 现有泰坦旧文档仍有“未接入”历史文本，而当前代码和测试已经接入。
  - Mitigation: implementation 前对账并回写失效正文，不用旧文档覆盖当前运行时事实。
- 百变机兵和卑劣封臣可能引入较复杂的控制权、转换与泰坦交互。
  - Mitigation: 先拆 effect atom，再决定复用或扩展 shared contract；不按卡名猜机制。
- 卡牌 atlas 包含 display-only 尾格。
  - Mitigation: 用合同测试锁定 index `55` 不进入 card registry。

## Migration Plan

1. 用户批准本 proposal。
2. 完成单卡/基地裁图与 intake 合同，锁定 63 个正式对象和 1 个 display-only 槽位。
3. 接入并发布共享 cards/base atlas，复用既有 titan atlas。
4. 依次完成宇宙武士、星际旅者、卑劣封臣、百变机兵。
5. 每个派系完成后立即跑定向测试、direct E2E 和 evidence。
6. 最后执行批次审计、manifest/R2 回查与 OpenSpec 收口。

## Open Questions

- 审批时需要确认：本轮是否按当前默认范围一次接入图中的四个派系。
- 英文规则文本需在 intake S0 通过项目专用抓取流程回访；若与中文图面存在实质规则冲突，必须先形成 disputed 项再请用户裁定。
