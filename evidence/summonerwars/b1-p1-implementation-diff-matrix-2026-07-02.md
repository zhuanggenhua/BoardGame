# 召唤师战争 B1 P1 实现对照矩阵（2026-07-02）

## 目的

- 承接 `b1-p1-rule-text-lock-matrix-2026-07-02.md` 中已经 `locked-规则原文已锁` 的五个对象。
- 本文件只做“官方原子子句 → 当前实现入口 → 差异/缺口”对照；不是重新录入、不是重新读图、不是 OCR 复核。
- 若发现明确规则冲突，先标记 `suspected-gap` 或 `disputed`，再进入最小失败测试和最小修复；本文件不直接改机制代码。

## 实现对照结论

| 对象 | 中文承载卡 | 官方原子子句 | 当前实现证据 | 对照结论 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| `rapid_fire` | 梅肯达·露、边境弓箭手 | 每回合一次；本单位攻击后；可消耗 1 充能；若消耗则本单位结算一次额外攻击；不限定必须攻击敌方单位/卡 | 定义为 `afterAttack`、`usesPerTurn: 1`、custom `rapid_fire_extra_attack`；触发阶段只发通知且 `skipUsageCount: true`；系统交互在有充能时给确认/跳过；确认后 `ACTIVATE_ABILITY rapid_fire` 消耗 1 充能并发 `EXTRA_ATTACK_GRANTED`；额外攻击事件把本单位 `hasAttacked=false`、`extraAttacks+1`；新增 L4 真实入口断言覆盖确认后只授予一次额外攻击，重复响应不再消耗或授予 | `match-with-L4-proof`。真实入口确认、交互收口、重复响应负向均已补证 | L4-01 已出队；后续若扩大，只看 eventStream 刷新/回放 UI 层是否会重复打开确认 |
| `withdraw` | 凯鲁尊者 | 本单位攻击后；可消耗 1 充能或 1 魔力；若消耗则强制移动本单位 1 或 2 格；不限定必须攻击敌方单位/卡 | 定义为 `afterAttack`、`usesPerTurn: 1`、custom `withdraw_push_pull`；系统交互先选消耗类型，再选目的格；执行器按 `charge/magic` 消耗资源，并发 `UNIT_MOVED`；验证限制距离 1-2、直线、路径含终点为空；已有真实攻击后两步交互链、charge/magic 支付路径和缺资源负向测试 | `match-with-L4-proof`。攻击后真实入口、费用选择、位置选择、资源消耗和交互收口均已有证明；“直线/路径为空”作为 Force 通用规则注记保留，不阻塞实现矩阵续跑 | L4 已收口；若后续拿到通用 Force 规则来源并证明当前直线/空格约束冲突，再单独降级 Force 细则，不回到本对象图片/OCR |
| `high_telekinesis` | 卡拉 | 本单位攻击后或代替攻击；可目标 3 格内士兵或英雄；强制移动目标 1 格 | 攻击后分支定义为 `afterAttack`、`usesPerTurn: 1`、范围 3、候选只遍历棋盘单位且排除召唤师/稳固；代替攻击分支 `high_telekinesis_instead` 定义为 `activated`、`costsAttackAction: true`、未攻击且攻击次数未满才可用；共享执行器 `executeTelekinesis(ctx, 3)` 推/拉 1 格；`UnitClass` 只有 `summoner/champion/common`，建筑是 `BoardStructure` 而不是单位；本轮新增稳固代表链断言，确认高阶念力不能推动稳固目标，目标位置不变且不产生推拉事件 | `match-with-L4-proof`。目标类型、建筑排除、行动经济、稳固免疫和共享推拉执行链均已由直接或代表链证据覆盖 | L4 已收口；只在通用 Force 规则来源与当前直线/空格约束冲突时，另开 Force 细则专项 |
| `mind_transmission` | 古尔壮 | 本单位攻击敌方卡牌后；可目标 3 格内友方士兵；目标结算一次额外攻击；触发对象是敌方卡牌，不仅限敌方单位 | 定义为 `afterAttack`、`usesPerTurn: 1`；目标验证为友方 common 且 3 格内；执行器发 `EXTRA_ATTACK_GRANTED` 给目标；攻击合法性允许攻击满足距离/视线的卡牌，友方卡牌攻击可结算但不计入“攻击敌方卡牌”；已补系统验证：攻击敌方建筑后生成传念选择，攻击友方目标可结算但不生成传念入口；新增 L4 真实入口断言覆盖选择友方士兵后只授予目标一次额外攻击，重复响应不再二次授予 | `match-with-L4-proof`。触发前提、目标选择、真实入口确认、重复响应负向均已补证；2026-07-17 修正旧的“普通非治疗单位不能攻击友方目标”实现假设 | L4-02 已出队；后续若扩大，只看 eventStream 刷新/回放 UI 层是否会重复打开选择 |
| `telekinesis` | 清风法师 | 本单位攻击后或代替攻击；可目标 2 格内士兵或英雄；强制移动目标 1 格 | 攻击后分支定义为 `afterAttack`、`usesPerTurn: 1`、范围 2、候选只遍历棋盘单位且排除召唤师/稳固；代替攻击分支 `telekinesis_instead` 定义为 `activated`、`costsAttackAction: true`、未攻击且攻击次数未满才可用；共享执行器 `executeTelekinesis(ctx, 2)` 推/拉 1 格；`UnitClass` 只有 `summoner/champion/common`，建筑是 `BoardStructure` 而不是单位；稳固免疫与高阶念力共享候选过滤和推拉执行链，本轮由高阶念力代表链覆盖 | `match-with-L4-proof`。目标类型、建筑排除、行动经济、稳固免疫和共享推拉执行链均已由直接或代表链证据覆盖 | L4 已收口；只在通用 Force 规则来源与当前直线/空格约束冲突时，另开 Force 细则专项 |

## 当前分流

| 状态 | 对象 | 说明 |
| --- | --- | --- |
| `match-with-L4-proof` | `rapid_fire` | 已补真实入口确认、交互收口、重复响应不二次授予 |
| `match-with-L4-proof` | `withdraw` | 攻击后真实入口、费用选择、位置选择、资源消耗和交互收口均已有证明；Force 通用细则只作为专项注记保留 |
| `match-with-L4-proof` | `high_telekinesis`、`telekinesis` | 目标集合已由类型系统、候选生成和建筑负向验证补证；稳固免疫已由高阶念力/共享念力代表链补证 |
| `match-with-L4-proof` | `mind_transmission` | “攻击敌方卡牌后”、目标选择、真实入口确认、重复响应不二次授予均已补证 |

## 下一步

1. B1 五个 locked 对象不再回录入层；本轮实现对照疑点已完成首轮最小验证。
2. `rapid_fire`、`mind_transmission` 已完成 L4 真实入口补证：确认/选择后只授予一次额外攻击，重复响应不会二次消耗或二次授予。
3. `withdraw`、`telekinesis`、`high_telekinesis` 已完成当前实现矩阵 L4 收口；通用 Force 细则只作为独立规则来源注记保留，若后续规则来源与当前直线/空格约束冲突，再单独降级 Force 细则专项，不回图片/OCR 重录已 locked 对象。
