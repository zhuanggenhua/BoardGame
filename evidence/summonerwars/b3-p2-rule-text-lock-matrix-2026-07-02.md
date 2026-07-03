# 召唤师战争 B3 P2 目标交互与每回合次数规则原文锁定（2026-07-02）

## 目的

- 承接 `rule-text-lock-batch-queue-2026-07-02.md` 的 B3 队列。
- 本文件只做规则原文录入合同锁定，不做实现审计、不写规则断言测试、不改机制代码。
- 真相源优先使用官方站点静态包；本地 i18n、AbilityDef、旧测试和 OCR 只作对照线索。

## 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 命中字段：`Feed the Eater|TEXT`、`Raise the Dead|TEXT`、`Spirit Bond|TEXT`、`Sly|TEXT`、`Blood Runes|TEXT`、`Frost Axe|TEXT`、`Cling|TEXT`、`Heal|TEXT`、`Arrow of Light|TEXT`、`Mimic|TEXT`、`Structural Shift|TEXT`、`Commune with Spirits|TEXT`。
- 图源入口仍沿用 `data-entry-crop-manifest-2026-07-02.md` 中的完整单卡裁图和文字区裁图。

## 命名映射裁定

- 阿布亚·石「魂灵纽带」（`ancestral_bond`）对应官方 `Spirit Bond`，不是本地 `spirit_bond`。
- 祖灵法师「祖灵交流」（`spirit_bond`）对应官方 `Commune with Spirits`，不是官方 `Spirit Bond`。
- 思尼克斯「狡黠」（`vanish`）对应官方 `Sly`。
- 心灵巫女「拟态」（`illusion`）对应官方 `Mimic`，不是官方 `Illusions`。
- 部落抓附手「抓附」（`grab`）对应官方 `Cling`。

## 规则锁定矩阵

| 对象 | 中文承载卡 | 官方能力名 | 官方原文 | 原子子句 | 合同状态 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| `feed_beast` | 巨食兽 | Feed the Eater | At the end of your Attack Phase, if this unit did not destroy a unit this turn, either discard a friendly adjacent unit or discard this unit. | C1 在你的攻击阶段结束时结算；C2 条件是本单位本回合没有摧毁单位；C3 必须在弃置一个相邻友方单位或弃置本单位之间二选一；C4 卡面未写 may；C5 目标若选友方单位，必须相邻且友方 | `locked-规则原文已锁` | 进入实现对照：确认击杀记录、阶段结束窗口、二选一强制性、无相邻友方时自弃置路径 |
| `revive_undead` | 雷塔勒斯 | Raise the Dead | Once per turn, during your Summon Phase, you may add 2 damage to this unit to retrieve an Undead unit from your discard pile and place it adjacent to this unit. | C1 每回合一次；C2 你的召唤阶段；C3 可选；C4 给本单位加 2 伤害作为成本；C5 从你的弃牌堆取回一个亡灵单位；C6 将其放置在本单位相邻格 | `locked-规则原文已锁` | 进入实现对照：确认成本、弃牌堆目标、相邻放置、伤害致死/无合法格负向 |
| `ancestral_bond` | 阿布亚·石 | Spirit Bond | After this unit moves, you may target a friendly unit within 3 spaces. Boost the target and move all boost from this unit to the target. | C1 本单位移动后触发；C2 可选；C3 目标为 3 格内友方单位；C4 目标获得 1 个充能；C5 将本单位全部充能移动到目标 | `locked-规则原文已锁` | 进入实现对照：确认目标范围、友方限制、自身目标负向、充能写入与转移顺序 |
| `vanish` | 思尼克斯 | Sly | Once per turn, during your Attack Phase, this unit may exchange places with a friendly 0 cost unit. | C1 每回合一次；C2 你的攻击阶段；C3 可选；C4 与一个友方 0 费用单位交换位置 | `locked-规则原文已锁` | 进入实现对照：确认 0 费用、友方、交换最终位置、占位/无目标负向 |
| `blood_rune` | 布拉夫 | Blood Runes | At the start of your Attack Phase, either spend 1 magic to boost this unit or add 1 damage to this unit. | C1 你的攻击阶段开始时结算；C2 二选一：花费 1 魔力给本单位 1 充能，或给本单位 1 伤害；C3 卡面未写 may，按强制二选一登记 | `locked-规则原文已锁` | 进入实现对照：确认魔力不足时伤害路径、选择入口、阶段开始重复负向 |
| `frost_axe` | 寒冰锻造师 | Frost Axe | After this unit moves, you may either boost it or spend 1 boost to place it under a friendly common within 3 spaces. When that common attacks, [s] = [m][m]. | C1 本单位移动后触发；C2 可选；C3 二选一：给本单位 1 充能，或花费 1 充能；C4 花费路径把本卡放到 3 格内友方士兵下方；C5 被附加士兵攻击时特殊符号等于两个普通命中 | `locked-规则原文已锁` | 进入实现对照：确认附加区域、目标士兵限制、充能不足负向、攻击符号替换消费链 |
| `grab` | 部落抓附手 | Cling | When a friendly unit starts its move adjacent to this unit, after that move, you may place this unit adjacent to that unit. | C1 一个友方单位开始移动时与本单位相邻；C2 在该移动之后结算；C3 可选；C4 将本单位放置到该友方单位相邻格 | `locked-规则原文已锁` | 进入实现对照：确认起始相邻而非结束相邻、跟随目标、合法相邻格、取消/无格负向 |
| `healing` | 圣殿牧师 | Heal | Before this unit attacks a friendly common or champion, you may discard 1 card from your hand. If you do, instead of adding damage, remove a number of damage equal to the number of [m] and [s] rolled. | C1 本单位攻击友方士兵或英雄前；C2 可选弃 1 张手牌；C3 若支付，攻击不加伤害；C4 改为按掷出的普通命中和特殊符号数量移除等量伤害 | `locked-规则原文已锁` | 进入实现对照：确认友方士兵/英雄目标、手牌成本、治疗替代伤害、骰面计数 |
| `holy_arrow` | 城塞弓箭手 | Arrow of Light | Before this unit attacks, reveal and discard any number of distinct units from your hand. Gain 1 magic for each. This unit has +1 strength during that attack for each. | C1 本单位攻击前；C2 可展示并弃置任意数量互不相同的单位牌；C3 每弃 1 张获得 1 魔力；C4 本次攻击每弃 1 张 +1 战力 | `locked-规则原文已锁` | 进入实现对照：确认 distinct 单位牌、手牌弃置、魔力获得、仅本次攻击战力加成 |
| `illusion` | 心灵巫女 | Mimic | At the start of your Move Phase, this unit may target a common within 3 spaces. This unit has the target's abilities until the end of your turn. | C1 你的移动阶段开始时；C2 可选；C3 目标为 3 格内士兵；C4 本单位获得目标能力直到本回合结束 | `locked-规则原文已锁` | 进入实现对照：确认士兵限制、距离、自身/建筑负向、回合结束清理 |
| `structure_shift` | 斯瓦拉 | Structural Shift | After this unit moves, it may target a friendly structure within 3 spaces. Force the target 1 space. | C1 本单位移动后触发；C2 可选；C3 目标为 3 格内友方建筑；C4 强制移动目标 1 格 | `locked-规则原文已锁` | 进入实现对照：确认友方建筑、距离、Force 1 格、路径/稳固规则来源 |
| `spirit_bond` | 祖灵法师 | Commune with Spirits | After this unit moves, either boost it or spend 1 boost to boost a friendly unit within 3 spaces. | C1 本单位移动后触发；C2 二选一：给本单位 1 充能，或花费 1 充能给 3 格内友方单位 1 充能；C3 卡面未写 may，按强制二选一登记；C4 第二路径需要友方单位目标 | `locked-规则原文已锁` | 进入实现对照：确认本地命名映射、强制/选择入口、自充能路径、花费路径与目标负向 |

## 继续边界

- B3 十二个对象已完成规则原文 locked；后续不再回 OCR/裁图重读，除非发现来源冲突或对象归属错误。
- 本文件没有判定任何实现 bug；下一步进入实现对照和最小验证分流。
- 若实现对照发现官方子句与实现冲突，先转 `disputed`，再写最小失败测试和最小修复。
