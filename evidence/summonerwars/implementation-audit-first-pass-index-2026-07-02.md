# 召唤师战争实现对照第一批链路索引（2026-07-02）

## 目的

- 承接 `implementation-audit-entry-2026-07-02.md`：数据录入合同已稳，下一步开始查实现链路。
- 本文件只锁实现入口、消费者入口和可能的测试入口；不写断言测试，不改机制代码。
- 两个 disputed 对象 `ferocity`、`entangle` 不进入规则断言测试或机制修复，先裁定对象归属。

## 第一批链路索引

| 对象 | 现实含义 | 已锁规则合同 | 当前实现入口信号 | 审计重点 |
| --- | --- | --- | --- | --- |
| `cold_snap` | 奥莱格让友方建筑生命增加 | 官方原文：友方建筑 +1 生命，无范围文字 | `auraStructureLife` / `cold_snap` | 核对本地 `range: 3` 是否与官方无范围原文冲突 |
| `fire_sacrifice_summon` | 伊路特-巴尔召唤时献祭并替换位置 | 官方原文：支付召唤费用时必须摧毁友方单位并替换 | ability effects 为空，逻辑应在召唤命令链 | 查召唤校验、支付、位置替换、无友方单位时的拒绝路径 |
| `living_gate` | 寒冰魔像是传送门 | 官方原文：This card is a gate | ability effects 为空，消费者应在传送门/建筑/召唤 helper | 查是否被当作 gate、structure、summon point 消费 |
| `mobile_structure` | 寒冰魔像这张结构卡可移动 | 官方原文：This card may move | ability effects 为空，消费者应在移动合法性 helper | 查结构可移动、普通移动限制、与 slow 同卡叠加 |
| `sacrifice` | 地狱火教徒被摧毁后伤害相邻敌人 | 官方 Immolate：被摧毁后，对曾相邻敌方单位加 1 伤害 | `onDeath` + `adjacentEnemies` | 查死亡前相邻集合是否保存，是否误用死亡后位置 |
| `blood_rage` | 亡灵战士在你的回合内因单位死亡充能 | 官方 Blood Fury：on your turn 单位被消灭则充能，回合末移除 2 | `onUnitDestroyed` + `condition: always` | 查是否错误响应对手回合单位死亡 |
| `rebound` | 掷术师/映射对象在相邻敌人离开时伤害该敌人 | 官方 Engage：相邻敌方单位移动或被强制离开时加 1 伤害 | `onAdjacentEnemyLeave` | 查普通移动和 forced away 是否都覆盖、是否重复触发 |
| `evasion` | 掷术师/映射对象使相邻敌人特定骰面攻击减伤 | 官方 Stupefy：相邻敌人攻击任意卡，掷出 [s] 时少加 1 伤害 | `onAdjacentEnemyAttack` | 查减伤作用于该次攻击总伤害，不误绑到本单位/target 字段 |

## 继续门禁

- 先读对应命令/解析器/状态 helper 的真实消费者，再决定是否写失败测试。
- 如果只是看到 ability effects 为空，不能直接判 bug；必须找到现实消费者是否实现了合同。
- 如果合同与实现确实冲突，下一步才进入“最小失败测试 → 最小机制修复 → 回到原始规则子句验收”。
