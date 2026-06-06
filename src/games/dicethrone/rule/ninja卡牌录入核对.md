# Dice Throne 忍者卡牌录入核对

> 2026-05-30 重审范围：只回写**忍者升级卡**。本文件现在只回答两件事：
> 1. 升级卡图槽、`cardId`、`targetAbilityId` 是否对。
> 2. 升级卡替换进去的 `newAbilityDef` 是否被错录。

主真相源：

- `public/assets/i18n/zh-CN/dicethrone/images/ninja/Ablilitycards.png`
- `temp/ninja-upgrade-crops/*.png`

实现入口：

- `src/games/dicethrone/heroes/ninja/cards.ts`
- `src/games/dicethrone/heroes/ninja/abilities.ts`

## 2026-06-05 当前结论

- 忍者升级卡的**图槽、卡牌对象、`replaceAbility(targetAbilityId=基础技能ID)` 这一层仍然是对的**。
- 当前主问题已经不再是“升级卡接上了错误技能定义但还没修”，而是：旧文档里仍保留了这批错误历史结论，没有及时回写到当前真实状态。
- 按 2026-06-04 当前代码与当前 evidence 复核，`一往无前 II / 刀尖舔血`、`斩击 II`、`暗影步 II / 勒杀`、`烟雾阵 II / 九字切`、`影牙 II / 诳惑`、`毒刃 II`、`死亡盛放 II`、`瞬身 II` 都已经完成实现层修复；剩余缺口已收敛为批次级 `L4` 治理、旧文档统一回写与最终口径统一。
- 截至 2026-06-05，`斩击 II`、`影牙 II / 诳惑`、`暗影步 II / 勒杀`、`烟雾阵 II / 九字切` 的关键 `L4` 合同也已补齐；`一往无前 II / 刀尖舔血`、`死亡盛放 II`、`瞬身 II` 的关键 family 边界同样已锁，剩余主要是批次级 `L4` 与旧文档统一收口。

## 升级卡矩阵

| slot | cardId | 中文 | `targetAbilityId` | 当前 `newAbilityDef` 状态 | 结论 |
|---:|---|---|---|---|---|
| 18 | `upgrade-blink-2` | 瞬身 II | `blink` | 2026-06-03 已确认不是升级卡接错，而是升级技能的防御重投合同漏进共享流程；现已补 `trigger.rollLimit = 2` 并以合同测试 + 真实防御 E2E 锁定。2026-06-05 再复跑时又确认真实红点已切到 `DiceTray / Dice3D` UI 命中层，现已由 `DiceTray.tsx` 命中层补丁收口 | **升级卡接线正确；共享实现漏项与 UI 命中层回归均已修，关键 L4 已锁** |
| 19 | `upgrade-going-forward-2` | 一往无前 II | `going-forward` | 当前 `GOING_FORWARD_2` 已按主路线 + `刀尖舔血` 双分支 `variants` 落地；主路线实现了投 `2` 骰、至多重掷 `1` 次与 `<=6` 不可防御，`刀尖舔血` 分支按单骰真实伤害收口；关键阈值分层 `L4` 已补齐 | **已对齐；对象级 L3 已补齐，关键 L4 已锁，剩批次级治理与旧文档统一收口** |
| 20 | `upgrade-slash-2` | 斩击 II | `slash` | `SLASH_2` 当前已按 `4/6/8` 与“3 同点获得 1 忍术”落地；对象级 direct closeout L3 已补齐，关键攻击快照 `L4` 已补齐 | **升级卡接线正确；目标升级技能当前已对齐，关键 L4 已锁** |
| 21 | `upgrade-shadow-step-2` | 暗影步 II | `shadow-step` | 当前 `SHADOW_STEP_2` 已含主路线与 `勒杀` 双分支；主路线为 `5` 点不可防御伤害 + `2` 慢性中毒，`勒杀` 分支为 `3` 忍术 + `2` 慢性中毒并直接收口；关键 nonattack closeout `L4` 已补齐 | **已对齐；对象级 L3 已补齐，关键 L4 已锁，剩批次级治理与旧文档统一收口** |
| 26 | `upgrade-smoke-screen-2` | 烟雾阵 II | `smoke-screen` | 当前 `SMOKE_SCREEN_2` 已含主路线与 `九字切` 双分支；主路线走烟雾弹/忍术/慢性中毒目标选择，`九字切` 走两次 `4` 点真实伤害目标选择；关键 simple-choice / 多目标 `L4` 已补齐 | **已对齐；对象级 L3 已补齐，关键 L4 已锁，剩批次级治理与旧文档统一收口** |
| 27 | `upgrade-shadow-fang-2` | 影牙 II | `shadow-fang` | `SHADOW_FANG_2` 当前已按主路线 + `诳惑` 双分支落地；主路线为 `1` 烟雾弹 + `2` 忍术 + `8` 伤害，`诳惑` 分支为 `1` 烟雾弹 + `2` 不可防御伤害；关键 token 响应窗 / 不可防御直结算 `L4` 已补齐 | **升级卡接线正确；目标升级技能当前已对齐，关键 L4 已锁** |
| 28 | `upgrade-poison-blade-2` | 毒刃 II | `poison-blade` | 当前 `POISON_BLADE_2` 已与卡图奖励骰语义对齐：投 `1` 颗奖励骰，忍刀给 `1` 层慢性中毒，手里剑/面具给 `2` 层慢性中毒，再进入 `5` 点伤害收口 | **已对齐；对象级 L1/L2/L3 已达标，关键 L4 已补，剩批次级治理与旧文档统一收口** |
| 29 | `upgrade-death-blossom-2` | 死亡盛放 II | `death-blossom` | 当前 `DEATH_BLOSSOM_2` 已切到升级版奖励骰合同：按忍刀/手里剑累计伤害，`1` 面具不可防御，`2` 面具施加慢性中毒，并支持至多 `2` 次奖励骰重掷；关键面具数量分层 `L4` 已补齐 | **已对齐；对象级 L3 已补齐，关键 L4 已锁，剩批次级治理与旧文档统一收口** |

## 结构裁定

- 下列升级卡都应该是“**一张升级卡 -> 一个基础技能 -> 升级后技能内部含多个 `variants`**”：
  - `upgrade-going-forward-2`
  - `upgrade-shadow-step-2`
  - `upgrade-smoke-screen-2`
  - `upgrade-shadow-fang-2`
- 不能把下挂分支拆成新的升级卡对象，也不能继续把下挂分支忽略掉。

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
