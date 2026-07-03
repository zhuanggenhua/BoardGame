# 召唤师战争 B6 P3/P4 充能与数值规则原文锁定（2026-07-02）

## 目的

- 承接 P3/P4 待建合同对象，先把充能写入、充能读取、伤害读取和回合末清理的数据录入合同锁稳。
- 本文件只做规则原文录入和原子子句拆分，不做实现审计、不写规则断言测试、不改机制代码。
- 已 locked 对象后续直接进入实现对照；不得再倒回图片/OCR 反复重录。

## 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 本批所有官方原文均从缓存中的 `Ability|TEXT` / `Ability|DIGITAL` 键抽取；没有使用图片重读或 OCR。

## 本批锁定矩阵

| 对象 | 承载卡牌 | 官方能力键 | 官方英文原文 | 原子子句 | 合同状态 | 继续边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `blood_rage` | 亡灵战士 | Blood Fury | Each time a unit is destroyed on your turn, boost this unit. At the end of your turn, remove 2 boost from this unit. | C1 在你的回合内每有一个单位被消灭时结算；C2 给本单位增加 1 充能；C3 在你的回合结束时移除本单位 2 充能；C4 本能力同时包含充能写入与回合末清理；C5 不是任意玩家回合触发 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读；若发现同一实现对象挂错承载卡，先转 disputed |
| `blood_rage_decay` | 亡灵战士 | Blood Fury | Each time a unit is destroyed on your turn, boost this unit. At the end of your turn, remove 2 boost from this unit. | C1 本对象是 Blood Fury 的回合末清理子句；C2 清理时机是你的回合结束时；C3 移除 2 充能；C4 只服务同一张卡的 Blood Fury，不是独立卡面能力 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读；若发现同一实现对象挂错承载卡，先转 disputed |
| `gather_power` | 祖灵法师 | Charged | After summoning this unit, boost it. | C1 本单位被召唤后结算；C2 给本单位增加 1 充能；C3 触发对象是 this unit，不是任意友方单位；C4 这是召唤后自动充能子句 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读；若发现同一实现对象挂错承载卡，先转 disputed |
| `power_boost` | 布拉夫、亡灵战士 | Imbued Strength | This unit has +1 strength for each boost it has, to a maximum of +5. | C1 本单位获得战力加成；C2 每有 1 充能获得 +1 战力；C3 最大加成为 +5；C4 读取当前充能数；C5 同名规则需分别核对布拉夫与亡灵战士承载 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读；若发现同一实现对象挂错承载卡，先转 disputed |
| `power_up` | 蒙威尊者 | Imbued Strength | This unit has +1 strength for each boost it has, to a maximum of +5. | C1 本单位获得战力加成；C2 每有 1 充能获得 +1 战力；C3 最大加成为 +5；C4 本地 power_up 与官方 Imbued Strength 同规则录入，后续实现对照再裁定命名差异 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读；若发现同一实现对象挂错承载卡，先转 disputed |
| `life_up` | 雌狮 | Imbued Life | This unit has +1 life for each boost it has, to a maximum of +5. | C1 本单位获得生命加成；C2 每有 1 充能获得 +1 生命；C3 最大加成为 +5；C4 读取当前充能数；C5 需在实现对照阶段核对伤害/死亡重算边界 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读；若发现同一实现对象挂错承载卡，先转 disputed |
| `rage` | 古尔-达斯 | Wrath | This unit has +1 strength for each damage it has. | C1 本单位获得战力加成；C2 每有 1 伤害获得 +1 战力；C3 读取本单位当前伤害；C4 官方键名为 Wrath，本地对象名 rage 只作为实现入口 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读；若发现同一实现对象挂错承载卡，先转 disputed |

## 分流结论

- B6 七个对象已经从 `待建合同-入口已补` 转为 `locked-规则原文已锁`。
- `blood_rage` 与 `blood_rage_decay` 是同一官方 Blood Fury 的两个实现入口：后续实现对照必须按同一卡共享合同处理，不能把清理子句当作独立规则来源。
- `power_boost` 与 `power_up` 都按官方 Imbued Strength 录入；后续要审的是本地命名/承载差异和充能读取实现，不是重读规则原文。
- 本文件没有确认任何实现 bug；下一步只允许进入实现对照和最小验证分流。
