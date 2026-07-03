# 召唤师战争 B4 P2 攻击窗口与召唤转移规则原文锁定（2026-07-02）

## 目的

- 承接 `rule-text-lock-batch-queue-2026-07-02.md` 的 B4 队列。
- 本文件只做数据录入合同锁定：锁官方英文原文、对象归属、原子子句和继续边界。
- 本文件不做实现审计、不写规则断言测试、不改机制代码。

## 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 命中字段：`Infect|TEXT`、`Life Drain|TEXT`、`Soul Shift|TEXT`、`Greater Push|TEXT`、`Push|TEXT`。
- 图源入口沿用 `data-entry-crop-manifest-2026-07-02.md` 中的完整单卡裁图和文字区裁图；本轮没有重新 OCR 或用低清图倒推规则。

## 命名映射裁定

- 亡灵疫病体「感染」（`infection`）对应官方 `Infect`。
- 德拉戈斯「生命吸取」（`life_drain`）对应官方 `Life Drain`。
- 亡灵弓箭手「灵魂转移」（`soul_transfer`）对应官方 `Soul Shift`。
- 卡拉「高阶念力：代替攻击分支」（`high_telekinesis_instead`）对应官方 `Greater Push`，与 B1 的 `high_telekinesis` 共用同一张卡的同一条官方原文。
- 清风法师「念力：代替攻击分支」（`telekinesis_instead`）对应官方 `Push`，与 B1 的 `telekinesis` 共用同一张卡的同一条官方原文。

## 规则锁定矩阵

| 对象 | 中文承载卡 | 官方能力名 | 官方原文 | 原子子句 | 合同状态 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| `infection` | 亡灵疫病体 | Infect | After this unit destroys a unit, you may replace the destroyed unit with a Carrier unit from your discard pile. | C1 本单位摧毁一个单位后触发；C2 可选；C3 可将被摧毁单位替换为你弃牌堆中的一个疫病体单位；C4 目标来源是你的弃牌堆；C5 最终状态是用疫病体单位占据被摧毁单位的位置 | `locked-规则原文已锁` | 进入实现对照：确认击杀窗口、弃牌堆疫病体筛选、替换位置、无弃牌堆目标和取消路径 |
| `life_drain` | 德拉戈斯 | Life Drain | Before this unit attacks, it may destroy a friendly unit within 2 spaces.  If it does, during that attack, [s] = [m]. | C1 本单位攻击前结算；C2 可选摧毁 2 格内一个友方单位；C3 若摧毁成功，则本次攻击中特殊符号等同普通近战命中；C4 效果只持续本次攻击；C5 不支付摧毁成本时不获得符号替换 | `locked-规则原文已锁` | 进入实现对照：确认攻击前窗口、友方单位目标、2 格限制、摧毁成本、仅本次攻击的符号替换 |
| `soul_transfer` | 亡灵弓箭手 | Soul Shift | After a unit within 3 spaces of this unit is destroyed during your turn, you may replace the destroyed unit with this unit. | C1 在你的回合中，距离本单位 3 格内的一个单位被摧毁后触发；C2 可选；C3 可用本单位替换被摧毁单位；C4 官方原文写的是 a unit，未限定友方或敌方；C5 最终状态是本单位移动到被摧毁单位的位置 | `locked-规则原文已锁` | 进入实现对照：确认你的回合限制、3 格范围、任意单位被摧毁、替换位置、本单位原位置清理和取消路径 |
| `high_telekinesis_instead` | 卡拉 | Greater Push | After this unit attacks, or instead of attacking, this unit may target a common or champion within 3 spaces. Force the target 1 space. | C1 本单位攻击后或代替攻击均可使用；C2 本对象锁定代替攻击分支；C3 可选目标；C4 目标必须是士兵或英雄，不能是召唤师或建筑；C5 目标在 3 格内；C6 强制移动目标 1 格 | `locked-规则原文已锁` | 进入实现对照：确认代替攻击入口、目标类型限制、3 格范围、Force 1 格、与 `high_telekinesis` 攻击后分支共享次数/状态边界 |
| `telekinesis_instead` | 清风法师 | Push | After this unit attacks, or instead of attacking, this unit may target a common or champion within 2 spaces. Force the target 1 space. | C1 本单位攻击后或代替攻击均可使用；C2 本对象锁定代替攻击分支；C3 可选目标；C4 目标必须是士兵或英雄，不能是召唤师或建筑；C5 目标在 2 格内；C6 强制移动目标 1 格 | `locked-规则原文已锁` | 进入实现对照：确认代替攻击入口、目标类型限制、2 格范围、Force 1 格、与 `telekinesis` 攻击后分支共享次数/状态边界 |

## 继续边界

- B4 五个对象已完成规则原文 locked；后续不再回到 OCR、裁图重读或实现字段倒推。
- 本文件没有确认任何实现 bug；下一步只能进入实现对照和最小验证分流。
- 若实现对照发现官方子句与当前实现冲突，先把对象转 `disputed`，再按“失败测试 → 最小修复 → evidence 回写”推进。
- `high_telekinesis_instead` / `telekinesis_instead` 与 B1 的同卡攻击后分支共用规则原文；实现审计时必须检查共享次数、行动消耗和状态写入，不能把两个对象当成互不相关的独立规则。
