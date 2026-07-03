# 召唤师战争 B8 P3/P4 静态、召唤与死亡规则原文锁定（2026-07-02）

## 目的

- 承接 P3/P4 剩余待建合同对象，锁定静态、召唤支付、死亡伤害和击杀不获魔法的官方原文。
- 本文件只做规则原文录入和原子子句拆分，不做实现审计、不写规则断言测试、不改机制代码。
- 已 locked 对象后续直接进入实现对照；不得再倒回图片/OCR 反复重录。

## 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 本批所有官方原文均从缓存中的 `Ability|TEXT` / `Ability|DIGITAL` 键抽取；没有使用图片重读或 OCR。

## 本批锁定矩阵

| 对象 | 承载卡牌 | 官方能力键 | 官方英文原文 | 原子子句 | 合同状态 | 继续边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `sacrifice` | 地狱火教徒 | Immolate | After this unit is destroyed, add 1 damage to each enemy unit that was adjacent to it. | C1 本单位被摧毁后结算；C2 对每个曾与本单位相邻的敌方单位加 1 伤害；C3 目标集合按 destroyed 时相邻关系锁定；C4 不影响友方单位；C5 官方键名为 Immolate，本地对象名 sacrifice 只作为实现入口 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `cold_snap` | 奥莱格 | Cold Snap | Friendly structures have +1 life. | C1 友方建筑获得 +1 生命；C2 官方原文没有范围限制；C3 作用对象是 friendly structures；C4 是否动态随建筑归属/进出场重算留到实现对照 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `fire_sacrifice_summon` | 伊路特-巴尔 | Summoned by Fire | When paying costs to summon this unit, you must also destroy a friendly unit. Replace the destroyed unit with this unit. | C1 支付召唤本单位费用时结算；C2 必须额外摧毁一个友方单位；C3 用本单位替换被摧毁单位的位置；C4 这是召唤支付/放置链，不是普通 onSummon 空效果 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `living_gate` | 寒冰魔像 | Living Gate | This card is a gate. | C1 本卡是传送门；C2 该规则改变卡牌类型/建筑入口语义；C3 空 effects 不能作为实现通过证据；C4 后续实现对照必须检查召唤、建筑、目标类型消费者 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `mobile_structure` | 寒冰魔像 | Mobile Structure | This card may move. | C1 本卡可以移动；C2 该规则允许结构/传送门具备移动能力；C3 与 Living Gate 同卡共享；C4 后续实现对照必须检查移动合法性 helper，而不是只看 ability effects | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `soulless` | 亡灵疫病体 | Soulless | Do not gain magic when this unit destroys an enemy unit. | C1 本单位摧毁敌方单位时结算；C2 不获得魔法；C3 限制对象是本单位造成摧毁后的魔法获得；C4 与 Infect 同卡连锁边界留到实现对照 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |

## 分流结论

- B8 六个对象已经从 `待建合同-入口已补` 转为 `locked-规则原文已锁`。
- `cold_snap` 官方原文是“Friendly structures have +1 life.”，没有写范围；后续实现对照要重点核对本地范围光环是否与规则冲突。
- `fire_sacrifice_summon`、`living_gate`、`mobile_structure` 虽然本地 ability effects 为空或很轻，但合同已证明它们不是“可忽略的空能力”，必须进入召唤/建筑/移动消费者链路审计。
- `sacrifice` 按官方 Immolate 键录入；后续要核对死亡时相邻集合、敌方目标集合和连锁死亡边界。
- 本文件没有确认任何实现 bug；下一步只允许进入实现对照和最小验证分流。
