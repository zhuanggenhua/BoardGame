## Context

`betrayal` 当前已经有角色选择、首剧本链路、部分作祟和 E2E 证据，但这些证据不能证明基础规则已经完整实现。当前主要问题不是“没有任何规则”，而是规则没有先被拆成可执行交互合同。

本设计只处理交互和规则语义重拆，不直接实施代码。

## Goals

- 先锁基础规则语义覆盖矩阵，再实现。
- 保留玩家必须参与的决策点，不用自动代选冒充规则。
- 把轨道、随机、进度、空间连接这些基础语义放进正式状态模型。
- 明确每个交互的 UI 承接对象和验证点。
- 用全规则账本覆盖基础规则 1-30 节和官方对照补充细节，P0 矩阵只作为首批实现切片。
- 把 50 个作祟从目录级追踪推进到官方源段映射，避免把“来源未读”和“子账本未拆”混成一个状态。

## Non-Goals

- 不在本 change 中实现全部代码。
- 不在未完成逐作祟子账本时宣称 50 个作祟已经完整设计。
- 不把当前首剧本代表链包装成完整游戏。
- 不把单游戏结论写回通用 skill；通用门禁已经单独补过。

## Decisions

### Decision: 用基础规则语义覆盖矩阵作为实施入口

每条基础规则必须先回答：

- 玩家现实中要做什么选择或看到什么状态；
- 规则真相落在哪个状态字段；
- 哪个命令/事件/结算路径负责承接；
- UI 在哪里让玩家操作或看到风险；
- 哪条测试或截图证明它真的成立。

没有闭合的条目不能进入“完成”口径。

### Decision: 全规则账本先定边界，P0 只是第一批实现

全规则账本负责回答“哪些规则存在、如何设计、当前是否阻塞”；P0 矩阵只负责第一批实现。不能因为 P0 通过就宣称完整规则完成。

第一批实现优先级顺序：

1. 剧本选择与代表 MVP 边界；
2. 属性轨模型；
3. 作祟风险/预兆总数表达；
4. 房间探索、放置、朝向和连接合法性；
5. 伤害分配和死亡规则；
6. 移动力快照、交易、特殊行动与武器声明。

理由：这些是基础规则结构，缺它们会导致后续所有剧本继续建在错误模型上。

### Decision: 官方对照补充细节必须进账本

中文整理版没有逐字展开的官方基础规则细节，若会改变交互或状态，也必须进入账本。当前已纳入的补充包括治疗回绿色起始值、最后一张预兆自动作祟、交易和特殊行动的回合限制、刚获得物品 / 预兆不可立即执行特殊行动、攻击一次 / 回合、尸体搜刮、障碍物、叛徒特殊能力和怪物通用规则。

### Decision: 作祟必须逐条建子账本

50 个作祟不能用代表剧本冒充完整。每个作祟进入实现前，必须有自己的识别、公开设置、双方目标、特殊规则、特殊行动、指示物、重要地点、怪物盒、胜利文本和验证计划。

`docs/games/betrayal/haunt-contract-ledger.md` 是逐作祟子账本的前置源段映射：它只回答“应该回读哪一页、这个作祟的机制焦点是什么、当前是否仍缺合同”。它不能替代 `docs/games/betrayal/haunts/<number>-interaction-contract.md`。

### Decision: 自动代选只能作为显式代表模式

如果暂时只做代表剧本、自动朝向、默认伤害分配或自动风险解释，必须在矩阵里标为 `representative-only` 或 `out-of-scope-approved`。不能把自动行为当完整规则。

### Decision: 用户批准前不进入实现

本 change 的职责是把交互设计清楚，而不是直接改玩法代码。后续实现必须先得到用户对 P0 列表和代表 MVP 边界的确认；确认前只能继续补设计、补证据或调整矩阵，不能修改 `src/games/betrayal/*` 的领域逻辑或 UI。

## Risks / Trade-offs

- 风险：设计阶段看起来比直接修慢。缓解：矩阵只覆盖基础规则 P0，不先穷尽 50 个作祟。
- 风险：当前已有 E2E 会被新模型重写。缓解：先把现有 E2E 映射到矩阵，能保留的保留，不能证明基础语义的降级为代表链证据。
- 风险：属性轨迁移影响大。缓解：先建 trait track adapter，让旧 UI 可通过派生值读取，逐步替换裸数值写入。

## Verification

- OpenSpec change validates with strict mode.
- `docs/games/betrayal/full-rule-interaction-redesign.md` exists and maps base rule sections plus official supplemental details.
- `docs/games/betrayal/haunt-redesign-index.md` exists and lists the 50 haunts at directory level before any individual haunt can be claimed complete.
- `docs/games/betrayal/haunt-contract-ledger.md` exists and maps all 50 haunts to official source page ranges plus contract-pending status before any haunt implementation can be claimed complete.
- `docs/games/betrayal/interaction-redesign-coverage-matrix.md` exists and lists P0 entries.
- Before code implementation, every P0 entry must have one of: `design-ready`, `blocked`, `representative-only`, or `out-of-scope-approved`.
- Before code implementation, user review has confirmed the P0 list and which entries may remain representative-only.
