# 召唤师战争 B7 P3 移动穿越与相邻离开规则原文锁定（2026-07-02）

## 目的

- 承接 P3 移动、穿越、相邻攻击和离开相邻链的数据录入合同。
- 本文件只做官方原文锁定、对象归属裁定和原子子句拆分，不做实现审计、不写规则断言测试、不改机制代码。
- 已 locked 对象后续直接进入实现对照；`disputed` 对象先裁定承载卡归属。

## 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 本批官方原文均从缓存中的 `Ability|TEXT` / `Ability|DIGITAL` 键抽取；没有使用图片重读或 OCR。

## 本批锁定矩阵

| 对象 | 承载卡牌 | 官方能力键 | 官方英文原文 / 归属证据 | 原子子句 | 合同状态 | 继续边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `climb` | 部落攀爬手 | Climb | When this unit moves, it may move 1 extra space and through structures. | C1 本单位移动时结算；C2 可额外移动 1 格；C3 可穿越建筑；C4 写有 may，额外移动/穿越按可选移动能力录入；C5 落点限制留到实现对照 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `evasion` | 掷术师 | Stupefy | When an adjacent enemy attacks any card, if 1 or more [s] are rolled, the attack adds 1 less damage. | C1 相邻敌人攻击任意卡牌时结算；C2 条件是本次攻击掷出 1 个或更多 [s]；C3 该次攻击减少 1 点伤害；C4 目标是攻击造成的伤害，不是移动或离开相邻；C5 官方键名为 Stupefy，本地对象名 evasion 只作为实现入口 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `flying` | 葛拉克 | Flight | When this unit moves, it may move 1 extra space and through cards. | C1 本单位移动时结算；C2 可额外移动 1 格；C3 可穿越 cards；C4 写有 may，额外移动/穿越按可选移动能力录入；C5 落点限制留到实现对照 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `rebound` | 掷术师 | Engage | Each time an adjacent enemy unit moves or is forced away from this unit, add 1 damage to that enemy. | C1 每当相邻敌方单位移动或被强制离开本单位时结算；C2 给该敌方单位加 1 伤害；C3 触发对象是离开的相邻敌方单位；C4 包含普通移动和 forced away；C5 官方键名为 Engage，本地对象名 rebound 只作为实现入口 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `slow` | 寒冰魔像 | Slow | This unit moves 1 fewer space. | C1 本单位移动距离减少 1 格；C2 这是移动上限修正；C3 不改变单位是否可移动本身；C4 与同卡 Living Gate/Mobile Structure 的建筑移动语义留到实现对照 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `swift` | 清风弓箭手 | Swift | When this unit moves, it may move 1 extra space. | C1 本单位移动时结算；C2 可额外移动 1 格；C3 写有 may，按可选额外移动录入；C4 不包含穿越能力 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `trample` | 蒙威尊者、犀牛、熊骑兵 | Trample | When this unit moves, it may move through commons. After this unit moves, add 1 damage to each common it moved through. | C1 本单位移动时可穿越 commons；C2 本单位移动后结算穿越伤害；C3 对每个被穿越的 common 加 1 伤害；C4 不是穿越所有单位；C5 多承载卡按同名规则录入，承载差异留到实现对照 | `locked-规则原文已锁` | 进入实现对照：只核对实现是否符合已锁子句，不再回到 OCR/裁图重读 |
| `entangle` | 城塞骑士 | 无直接官方匹配；近似规则为 Deceiver 的 Engage | 官方缓存中 `Citadel Knight` 邻近只出现 `Protect`；`Engage|TEXT` 出现在 Deceiver 邻近，原文为：Each time an adjacent enemy unit moves or is forced away from this unit, add 1 damage to that enemy. | C1 本地城塞骑士挂 `entangle`；C2 本地实现效果与官方 Engage 相似；C3 当前官方缓存不能证明城塞骑士承载 Engage/Entangle；C4 这是对象归属争议，不是机制实现结论 | `disputed-对象归属待裁定` | 先裁定城塞骑士是否应承载该能力；未裁定前不得写规则断言测试或改机制代码 |

## 分流结论

- B7 七个对象已经从 `待建合同-入口已补` 转为 `locked-规则原文已锁`：`climb`、`evasion`、`flying`、`rebound`、`slow`、`swift`、`trample`。
- `entangle` 转为 `disputed-对象归属待裁定`：本地城塞骑士承载该能力，但官方缓存中城塞骑士邻近只锁到 Protect，无法证明城塞骑士也承载 Engage/Entangle。
- `evasion` 与 `rebound` 使用官方 Deceiver 邻近的 Stupefy / Engage 原文录入；后续实现对照要核对本地掷术师命名与官方 Deceiver 的承载映射。
- 本文件没有确认任何实现 bug；下一步只允许进入实现对照或对象归属裁定。
