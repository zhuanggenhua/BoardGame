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
| 攻击实付费用 | 伊莉雅「小圣杯」、中文正式卡面「风王结界」、CHM「穿刺死棘之枪」 | `fateAttackManaCost` | 常规选择、成组确认、骑乘、AI 与本人手牌显示 | 确认时一次扣除；枪在成功打出后累积，下次支付才使用新值 | 暗置免费；本人费用标签与预计魔力使用同一计算 | `pilot` |
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

## 攻击费用扩审

核对范围为当前可选 13 位御主和 14 位从者、常规攻击及骑乘。旧 demo 中范围外的角色词条不进入当前费用计算。

| 对象 | 费用语义 | 当前落点与缺口 |
| --- | --- | --- |
| 伊莉雅 · 小圣杯 | 打出攻击减 1，包含普通、技能、骑乘，最低 0 | 已接共享费用。回合结束的暗置回魔是独立触发，待实现 |
| 阿尔托莉雅 · 风王结界 | 真名隐藏时自身减 2，正式中文卡图 `skills/sc_saber_2` | 已接共享费用，保留从技能区出牌前的魔力门槛 |
| 库·丘林 · 穿刺死棘之枪 | 每次成功打出后自身 +2，持续到游戏结束 | 已接常规确认与下次报价；贯穿心脏是独立战斗效果 |
| 吉尔伽美什 · 巴比伦之门 | X 为魔力费用，并选择 X 种非特殊属性，CHM 图 `ScreenShot_2025-11-01_154236_844.png` | X 和属性决策尚未实现；原实现仅消费地利翻倍 |
| 兰斯洛特 · 不为一己之荣光 | 付一枚令咒，复制源魔耗取向下减半和减 4 的较低值 | 复制框架有代理记录；实际选源、费用、公开状态和能力执行仍待接齐 |
| 迪卢木多 · 破魔的红蔷薇 | 战斗阶段另付 6，将黄蔷薇加入攻击 | 独立激活费用；相关战斗响应尚未接入 |
| 间桐脏砚 · 创造者 | 无令咒，其他效果要求花令咒时改付 4 魔力 | 初始令咒已录入；能力替代付款与复制等消费点待接入 |
| 间桐雁夜 · 人体反应堆／远坂时臣 · 赫须绅士的令印 | 基础攻击 +3／火炎弹 +2 | 只随莎士比亚启用的升华效果，当前名册无莎士比亚 |
| 远坂时臣 · 宝石／火炎弹，卫宫士郎 · 投影，及其他追加攻击 | 效果支付、追加打出、直接加入攻击各有独立时机 | 通用常规选牌和骑乘费用已覆盖各自合法入口；御主附属与扩展追加能力逐卡待接入 |

常规移动的分段可达性和合计费用依 [中文规则](../rules/chm-进行一场圣杯战争.md#行动阶段) 与印刷箭头。魔术工房不属于战场，中文规则允许两张暗置，现有主源未写只能暗置或禁止明置。
