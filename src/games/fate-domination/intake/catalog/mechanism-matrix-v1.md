# Fate/Domination 机制矩阵 v1

日期：2026-10-11。此表是实现审计索引，不替代规则书、卡图合同或运行时状态。

| 机制族 | 当前权威锚点 | 唯一运行时 owner | 查询/命令 | 事件/结算 | 可见性与失败路径 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 常规移动 | `rules/chm-进行一场圣杯战争.md` | `domain/movement.ts` + `engine/primitives/movement.ts` | `MOVE_PLAYER`、`resolveFateMovement` | `PLAYER_MOVED` | 结构化失败：交战、容量、路径、魔力、进出地点 | `pilot` |
| 效果移动 | 同上；御主令咒、迪卢木多/库丘林移动技能 | Fate movement adapter | `PLAY_SKILL.targetLocationId` | `PLAYER_MOVED(mode=effect)` | 仍校验目的地、容量、地点锁；成本默认 0 | `pilot` |
| 地点封锁 | `catalog/events-fuyuki-ocr.md`：固有结界 | Fate rule state + movement/attack query | 移动与选攻击前查询 | `FATE_RULE_MODIFIER_ATTACHED` | 进、出、特殊攻击分别拒绝；不改卡面定义 | `pilot` |
| 能力抑制 | `first-batch-servant-skills-ocr.md`：二之太刀 | Fate ability registry + `canUseFateAbility` | `PLAY_SKILL` | `FATE_RULE_MODIFIER_ATTACHED` | 同战场按阶段拒绝；其它地点不受影响 | `pilot` |
| 属性威力归零 | `demo-data.ts` / 已锁技能摘要：魔术抗性、风王结界、炽天覆七重圆环 | `resolveFatePowerValue` | `CONFIRM_ATTACK` 重新计算 | `ATTACKS_CONFIRMED` | 只匹配声明属性；保留 applied modifier IDs | `pilot` |
| 地利倍增 | `demo-data.ts`：巴比伦之门、伪·螺旋剑、守望 | `resolveFatePowerValue(selector=terrain)` | 能力执行后查询 | 战斗结算时消费 | 只改当前拥有者地利值，不改印刷地点数字 | `pilot` |
| 复制 / 代理卡 | `兰斯洛特1.htm`；`demo-data.ts`：无穷的武练、不为一己之荣光 | Fate ability registry + `copyContext` + copy record | ChoiceRequest `select-card` | `FATE_COPY_PROXY_CREATED` + child frame 合同 | 保留 owner/controller/holder/sourceController；递归深度与循环拒绝 | `pilot` |
| 规则修改生命周期 | 已锁技能的回合结束/战斗结束文本 | `FateRuleState` | `expireFateRuleModifiers` | 回合收束时清理 | `turn-end` / `round-end` / `game-end` 分离 | `pilot` |
| 败北分层与保护 | `rules/core-rules-from-chm.md`：败北持续至回合结束、可多层；阿尔托莉雅幸运 | `PlayerState.defeatMarkers` + `FATE_DEFEAT_*` | `FATE_DEFEAT_DECLARED` → EventCommit → applied/prevented | 攻击与胜者查询消费；不可阻止事件可穿透保护 | 多层 marker、直接败北保护、回合结束清理 | `pilot` |
| 回合末淘汰 | `rules/core-rules-from-chm.md`：第 8/9/10 回合按 VP 截断且平局存活；士郎首次淘汰代价 | Fate domain reducer + EventCommit | `FATE_ELIMINATION_REQUESTED` → prevented/eliminated | 严格低于 cutoff 才淘汰；首次保护失去全部魔力 | 保护只生效一次；未改写胜负源 | `pilot` |
| EventCommit 拦截 | 所有移动事件必须再次过规则查询 | `DomainCore.commitEvent` | 事件提交前 | 允许原事件、替换路径/成本或取消 | 不能用伪造 path / cost 绕过地点规则 | `pilot` |
| Battle ResolutionFrame 边界 | `rules/chm-进行一场圣杯战争.md`：战力结算按地点顺序推进，结算后再进入回合收束 | Fate domain + `TimingOpportunitySystem` + `ResolutionFrameSystem` | `FATE_BATTLE_RESOLUTION_STARTED` → `LOCATION_RESOLVED` → `BATTLE_RESOLVED` | 深山町 → 新都 → 侦察依序结算；最后一处自动收束 frame | 地点战斗后的卡牌触发队列仍待接入 | `pilot` |
| Timing / Opportunity | 能力注册映射与复制选择合同 | `TimingPoint`、`Opportunity`、`ChoiceRequest` | `createFateCopyChoiceOpportunity`、domain discovery | child `ResolutionFrame` 入口 | 选择带稳定卡牌 ID、AI command、控制者可见性 | `contract` |
| Response / replacement / prevention | 规则层已有共享 `EventCommit`、`ResponseWindow`、`ResolutionFrame` | 待 Fate 具体卡面消费 | 需卡面合同与正式触发事件 | 待接入战斗/淘汰链 | 未锁对象不生成假执行器 | `deferred` |
| owner/controller/holder/sourceController | 复制/借用合同与 `copyContext` | `FateCopyRecord.context` | 复制与代理查询 | `FATE_COPY_PROXY_CREATED` | 不把四种身份折叠成一个 `playerId` | `pilot` |

## 当前明确未完成

- 完整战斗 `ResolutionFrame`、战败/淘汰与战后触发队列仍未替代现有代表性 `BATTLE_RESOLVED` 骨架。
- 已锁定的卡牌效果已建立 typed adapter；尚未把全部 14×3 技能和所有御主附属逐张接入 executor。
- `blocked / partial / disputed` 的对象继续保持不可执行，不能用 demo 缩写或 TTS 英文补全。
