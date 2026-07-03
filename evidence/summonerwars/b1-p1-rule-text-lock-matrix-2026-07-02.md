# 召唤师战争 B1 P1 逐字规则锁定矩阵（2026-07-02）

## 目的

- 承接 `rule-text-lock-batch-queue-2026-07-02.md` 的 B1：P1 攻击后与额外攻击对象。
- 本文件只锁规则原文和原子子句，不写规则断言测试，不改机制代码。
- 本轮不回到 P0，不重复建立入口合同；入口沿用已完成的数据录入图源、完整单卡裁图和文字区裁图。

## 权威来源

| 来源 | 用途 | 证据 |
| --- | --- | --- |
| 官方 Summoner Wars Online 静态包 | 锁官方英文能力原文 | `https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js` |
| 本地完整单卡裁图 | 确认承载卡牌与图集入口 | `temp/summonerwars-audit/card-crops-2026-07-02/full/` |
| 本地文字区裁图 | 辅助定位同一卡的能力区 | `temp/summonerwars-audit/card-crops-2026-07-02/text/` |

说明：本轮使用官方站点静态包中 `|TEXT` / `|DIGITAL` 条目锁逐字原文；没有使用实现字段、i18n、旧测试或 OCR 反推规则。

## B1 锁定结果

| 对象 | 中文承载卡 | 官方能力名 | 官方逐字原文 | 原子子句 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `rapid_fire` | 梅肯达·露、边境弓箭手 | Swift Shot | Once per turn, after this unit attacks, you may spend 1 boost to resolve an extra attack with it. | C1 每回合一次；C2 本单位攻击后；C3 可选择消耗 1 个充能；C4 若消耗，则本单位结算一次额外攻击；C5 不限定必须攻击敌方单位/卡 | `locked-规则原文已锁` |
| `withdraw` | 凯鲁尊者 | Withdraw | After this unit attacks, you may spend either 1 boost or 1 magic. If you do, force this unit 1 or 2 spaces. | C1 本单位攻击后；C2 可选择消耗 1 个充能或 1 点魔力；C3 若消耗，则强制移动本单位 1 或 2 格；C4 不限定必须攻击敌方单位/卡 | `locked-规则原文已锁` |
| `high_telekinesis` | 卡拉 | Greater Push | After this unit attacks, or instead of attacking, this unit may target a common or champion within 3 spaces. Force the target 1 space. | C1 本单位攻击后或代替攻击；C2 可选择目标；C3 目标必须是士兵或英雄，不能是召唤师/建筑；C4 目标在 3 格内；C5 强制移动目标 1 格 | `locked-规则原文已锁` |
| `mind_transmission` | 古尔壮 | Telepathic Command | After this unit attacks an enemy card, this unit may target a friendly common within 3 spaces. The target resolves an extra attack. | C1 本单位攻击敌方卡牌后；C2 可选择友方士兵；C3 目标在 3 格内；C4 目标结算一次额外攻击；C5 触发对象是敌方卡牌，不仅限敌方单位 | `locked-规则原文已锁` |
| `telekinesis` | 清风法师 | Push | After this unit attacks, or instead of attacking, this unit may target a common or champion within 2 spaces. Force the target 1 space. | C1 本单位攻击后或代替攻击；C2 可选择目标；C3 目标必须是士兵或英雄，不能是召唤师/建筑；C4 目标在 2 格内；C5 强制移动目标 1 格 | `locked-规则原文已锁` |

## 承载入口

| 对象 | 完整单卡裁图 | 文字区裁图 |
| --- | --- | --- |
| `rapid_fire` | `temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-frontier-archer__prepare,rapid_fire__CARDS_ATLAS__5.jpg`<br>`temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-makinda-ru__prepare,rapid_fire__CARDS_ATLAS__6.jpg` | `temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-frontier-archer__prepare,rapid_fire__CARDS_ATLAS__5__text.jpg`<br>`temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-makinda-ru__prepare,rapid_fire__CARDS_ATLAS__6__text.jpg` |
| `withdraw` | `temp\summonerwars-audit\card-crops-2026-07-02\full\barbaric-kalu__inspire,withdraw__CARDS_ATLAS__9.jpg` | `temp\summonerwars-audit\card-crops-2026-07-02\text\barbaric-kalu__inspire,withdraw__CARDS_ATLAS__9__text.jpg` |
| `high_telekinesis` | `temp\summonerwars-audit\card-crops-2026-07-02\full\trickster-kara__high_telekinesis,high_telekinesis_instead,stable__CARDS_ATLAS__2.jpg` | `temp\summonerwars-audit\card-crops-2026-07-02\text\trickster-kara__high_telekinesis,high_telekinesis_instead,stable__CARDS_ATLAS__2__text.jpg` |
| `mind_transmission` | `temp\summonerwars-audit\card-crops-2026-07-02\full\trickster-gulzhuang__mind_transmission__CARDS_ATLAS__3.jpg` | `temp\summonerwars-audit\card-crops-2026-07-02\text\trickster-gulzhuang__mind_transmission__CARDS_ATLAS__3__text.jpg` |
| `telekinesis` | `temp\summonerwars-audit\card-crops-2026-07-02\full\trickster-wind-mage__telekinesis,telekinesis_instead__CARDS_ATLAS__5.jpg` | `temp\summonerwars-audit\card-crops-2026-07-02\text\trickster-wind-mage__telekinesis,telekinesis_instead__CARDS_ATLAS__5__text.jpg` |

## 下一步

1. B1 五个对象已完成规则原文锁定，下一步进入实现对照和差异登记。
2. 若实现与上述原子子句直接冲突，先把对象转 `disputed`，再写最小失败测试和最小修复。
3. B2 的 `prepare`、`inspire` 虽然本轮也在官方包中找到原文，但尚未作为 B2 正式收口；下一步按队列单独锁定。
