# 召唤师战争实现对照入口（2026-07-02）

## 前提

- 数据录入合同阶段已收口：68 个风险对象中 4 个 `locked-L4已补`，62 个 `locked-规则原文已锁`，2 个 `disputed-对象归属待裁定`，0 个 `待建合同-入口已补`。
- 本文件进入下一阶段：只对 locked 对象做实现对照预筛；不写规则断言测试，不改机制代码。
- `ferocity` 与 `entangle` 仍是对象归属争议，未裁定前不能进入规则断言测试或机制修复。

## 第一批实现对照预筛

| 对象 | 合同状态 | 预筛信号 | 下一步 |
| --- | --- | --- | --- |
| `cold_snap` | locked | 官方原文为“Friendly structures have +1 life.”，当前实现块含 `range: 3` 的建筑生命光环 | 优先核对是否存在范围限制冲突；若确认冲突，先写最小失败测试再修 |
| `fire_sacrifice_summon` | locked | 官方原文是召唤支付时必须摧毁友方单位并替换位置；当前 ability 定义 `effects: []`，逻辑由召唤命令消费 | 审召唤命令链，不按空 effects 判通过 |
| `living_gate` | locked | 官方原文为“本卡是传送门”；当前 ability 定义 `effects: []` | 审传送门/建筑/召唤消费者链，不按空 effects 判通过 |
| `mobile_structure` | locked | 官方原文为“本卡可以移动”；当前 ability 定义 `effects: []` | 审移动合法性 helper 与建筑移动边界 |
| `sacrifice` | locked | 官方 Immolate 是“本单位被摧毁后，对曾相邻的敌方单位加 1 伤害”；当前实现为 `onDeath` + `adjacentEnemies` | 核对使用的是死亡前相邻集合还是死亡后相邻集合 |
| `blood_rage` | locked | 官方 Blood Fury 限定“on your turn”；当前实现块可见 `condition: always` | 核对是否错误响应对手回合单位死亡 |
| `rebound` | locked | 官方 Engage 包含“moves or is forced away”；当前实现入口为 `onAdjacentEnemyLeave` | 核对 forced away 与普通移动是否都覆盖，且不重复触发 |
| `evasion` | locked | 官方 Stupefy 是相邻敌人攻击任意卡且掷出 [s] 时少加 1 伤害 | 核对目标是“攻击造成的伤害”，不是错误绑定到本单位或 target 字段 |

## 继续边界

- 本文件只登记实现对照入口，不确认 bug 已修复。
- 任何对象只有在合同子句与实现链路形成明确冲突后，才进入最小失败测试和最小修复。
- 两个 disputed 对象先裁定对象归属：`ferocity`、`entangle`。
