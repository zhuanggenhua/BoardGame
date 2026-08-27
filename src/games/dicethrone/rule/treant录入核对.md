# Dice Throne 树精录入核对

> 2026-05-30 重审范围：只审**树精全部升级技能**，不再沿用旧“5 张升级卡描述已按卡图展开、录入层没有残余”的结论。
>
> 主真相源：
> - `public/assets/i18n/zh-CN/dicethrone/images/treant/abilitycards.png`
> - `temp/treant-upgrade-crops/tendcare2.png`
> - `temp/treant-upgrade-crops/rooted2.png`
> - `temp/treant-upgrade-crops/shatteringfist2.png`
> - `temp/treant-upgrade-crops/shatteringfist3.png`
> - `temp/treant-upgrade-crops/naturetouch2_precise.png`
> - `temp/treant-upgrade-crops/vengefulvines2_precise.png`
> - `temp/treant-upgrade-crops/wildgrowth2_precise.png`
>
> 对照实现：
> - `src/games/dicethrone/heroes/treant/abilities.ts`
> - `src/games/dicethrone/heroes/treant/cards.ts`
> - `src/games/dicethrone/domain/customActions/treant.ts`

## 2026-06-05 当前结论

- 本文件当前只负责**树精升级技能录入合同**的现行口径，不代表四英雄整批已完成；若要看四英雄总补审当前 residual，入口是 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 的 `2026-06-06 当前真实未收口矩阵`。
- 2026-07-03 反馈复核：玩家反馈“骰出 12345 点不了大顺子技能”命中的不是 `野蛮生长 II`，而是图面中的 `野性怒吼 II`。目标裁图 `tmp/image-check/crops/treant_wild_roar_2_large_straight_card.jpg` 显示 `野性怒吼 II` 为 `大顺子`，造成 `8` 伤害并投掷 `5` 骰；`tmp/image-check/crops/treant_straight_area.jpg` 显示 `野蛮生长 II` 仍是 `2 树枝 + 3 树叶`，造成 `4` 伤害并投掷 `5` 骰。
- 树精旧文档里“5 张升级卡描述已经按卡图重录、录入层没有残余”的旧否定结论也已经过期，但原因已经从“实现没补上”转成“旧审计摘要没及时回写”。
- 截至 2026-06-04，`细心呵护 II / 培育`、`自然之触 II / 自然之怜`、`复仇枝蔓 II / 苦痛根系` 都已完成同卡双分支落地，并补到对象级 direct closeout `L3`。本句原先把 `乱花迷眼` 归到 `野蛮生长 II`，已在 2026-07-04 回图复核中确认失效。
- 2026-07-04 回图复核：`temp/dicethrone-intake/audit/treant-branch-review-sheet-4x.png` 与 `temp/dicethrone-intake/audit/upgrade-card-review-crops/treant/29-upgrade-wild-growth-2--calm--wild-roar.png` 显示，`upgrade-wild-growth-2` 的正式卡名是 `野性怒吼 II`，下半区 `乱花迷眼` 是 `野性怒吼 II` 的同卡分支，触发为 `2 树枝 + 2 树灵`，效果是施加刺藤并造成 `4` 点不可防御伤害。
- 截至 2026-06-05，`扎根 II`、`破碎之拳 II`、`破碎之拳 III` 也已补到技能本体对象级 `L3`；其中 `扎根 II` 的防御收口态、`破碎之拳 III` 的“攻击快照 vs 当前活跃骰”条件判定，已继续补到关键 `L4` 子句。
- 这些升级技能当前仍未到“全面审计完成”，但残余已经从“技能本体还没补到”继续收敛为：批次级 `L4` 判等矩阵、旧 rule/evidence 统一回写，以及更高阶批次口径统一。下方新增的批次级 `L4` 判等矩阵，就是当前这批对象可直接复查的治理入口。

## 2026-06-05 批次级 L4 判等矩阵

> 判等标准按 `.spec/knowledge/standards/testing-audit.md` 与升级重审 evidence 的“共享链路仅配置不同”门禁执行：只有 handler / resolver / interaction family / 清理语义一致，且差异只剩静态配置时，才允许复用 `L3/L4`。

| 对象 | 共享链名称 | 代表对象 | 是否满足“仅配置不同” | 判等依据 | 当前残余 |
| --- | --- | --- | --- | --- | --- |
| `细心呵护 II` 主分支 / `培育` | 养成选择 family | — | 否 | 主分支是多目标 + 养成链；`培育` 是纯养成 `nonattack closeout`，interaction family 不同 | 对象级 `L3/L4` 已补；保留对象级代表证据 |
| `扎根 II` | 防御选择链 | — | 否 | `defensiveRoll + treant-rooted-defense + rooted choice`，且升级版新增 4 骰合同，不是纯配置差异 | 对象级 `L3/L4` 已补；保留对象级代表证据 |
| `破碎之拳 II` | 标准 token + 普通伤害直结算链 | `影牙 II` 主分支 | 是 | 与 Ninja `影牙 II` 主分支同走标准 `grantToken + damage` 攻击清理管线，差异只剩静态伤害值与 token 数量 | 可按该 family 复用 `L4`，当前无额外对象级差异 |
| `破碎之拳 III` | token + 条件养成选择 + 普通伤害链 | — | 否 | 额外依赖“三同点读取 `pendingAttack.attackDiceValues` 快照”的条件 choice，不可降成纯配置 | 对象级 `L3/L4` 已补；保留对象级代表证据 |
| `自然之触 II` 主分支 / `自然之怜` | 直伤 / 多效果后养成 family | — | 否 | 主分支是不可防御直伤，分支是“治疗 + CP + 抽牌 + 养成 1”后 closeout，不能互相复用 | 对象级 `L3/L4` 已补；保留对象级代表证据 |
| `野性怒吼 II` 的 `乱花迷眼` | 标准 token + 伤害直结算链 | `复仇枝蔓 II` 主分支 | 是 | 都走标准 `grantToken(opponent, thorn, 1) + damage(*)` 管线，差异只剩伤害值与 `unblockable` 静态标记 | `乱花迷眼` 当前归属 `wild-roar-2-dazzle`，可复用该 family 的 `L4` |
| `苦痛根系` | 树灵总数转真实伤害后 `nonattack closeout` | — | 否 | 读取树灵总数后真实伤害并直接收口，不属于标准攻击清理 family | 对象级 `L3/L4` 已补；保留对象级代表证据 |
| `野蛮生长 II` 主分支 | `displayOnly` 5 骰后继续攻击 / 养成链 | — | 否 | 奖励骰展示、加伤、生命源泉与养成 choice 同时存在，family 独立 | 对象级关键 `L4` 已补；保留对象级代表证据 |
| `野性怒吼 / 野性怒吼 II` | 大顺子 + `displayOnly` 5 骰后继续攻击 / 养成链 | — | 否 | 基础版与升级版同属 `大顺子` 触发；区别是基础版 `6` 伤害、升级版 `8` 伤害；奖励骰后续复用野蛮生长 II 的树枝加伤、树叶生命源泉、树灵养成链 | 已按 2026-07-03 反馈补基础版与升级版联查；2026-08-26 扩审确认玩家板槽位合同已补齐：`wild-roar=calm`，`nature-touch=lightning` |

## 2026-06-04 补记

- `细心呵护 II / 培育`、`自然之触 II / 自然之怜`、`复仇枝蔓 II / 苦痛根系`、`野蛮生长 II / 乱花迷眼` 的旧“录入错 + 实现错 / 严重错录 + 实现错”结论已失效。
- 当前代码已分别补上这四个升级技能的主路线 + 下挂分支结构，并通过 `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts` 与 `e2e/dicethrone/dicethrone-treant-upgrade-direct-closeout.e2e.ts` 补到对象级 L3。
- 因此，树精升级技能当前剩余缺口不再是“这四张没实现”，而是**旧 evidence/rule 回写**与整批 `L4` 治理口径统一；这些对象的关键 `L4` 子句已补，不再应继续表述成“对象级 L4 仍待补”。

## 升级技能重审矩阵

| 基础技能 | 卡图主路线 | 卡图下挂分支 | 当前实现 | 应有结构 | 结论 |
|---|---|---|---|---|---|
| `细心呵护 II` | `2 树叶 + 2 螺旋`；抽 `1`；养成 `4` 树灵；`1` 名玩家获得生命源泉；选择 `1` 名对手施加刺藤 | `培育`：`2 树枝 + 2 螺旋`；养成 `6` 树灵 | `TEND_CARE_2` 当前已按主路线 + `培育` 双分支 `variants` 落地；对象级 direct closeout L3 已补齐 | `tend-care` 升级版应带主路线与 `培育` 两个 `variants` | **结构与实现已对齐；对象级 L3 已达标，关键 L4 已锁，剩批次级治理与旧文档统一收口** |
| `扎根 II` | 防御投掷 `4` 骰；防止 `1×树枝 + 1×树灵` 伤害；若投出 `2` 树叶则养成 `1` 树灵；若投出 `2` 螺旋则 `1` 名玩家获得生命源泉 | 当前裁图未见明确下挂第二分支 | `ROOTED_2` 与当前主路线一致；对象级真实防御入口 `L3` 已补齐，且关键收口态已补到 `L4`：防御收口后 `pendingAttack=null / pendingDamage=undefined`，`pendingBonusDiceSettlement.displayOnly=true` 仅保留展示快照，不再误判成攻击链未结束 | 保持 `rooted` 基础技能 ID；当前重点从“主路线是否录对”转为“防御收口态与批次口径统一” | **结构与实现已对齐；对象级 L3 已达标，关键 L4 子句已锁，剩批次级治理与旧文档统一收口** |
| `破碎之拳 III` | `3/4/5` 树枝造成 `5/6/7` 伤害；若投出 `3` 个相同数字，养成 `1` 树灵；施加刺藤 | 当前裁图未见明确下挂第二分支 | `SHATTERING_FIST_3` 与当前主路线一致；对象级 `L3` 已补齐，且关键 `L4` 已锁：三同点养成判定必须读取 `pendingAttack.attackDiceValues` 攻击快照，而不是 live `getActiveDice(state)` | 保持现结构；当前重点从“主路线是否录对”转为“快照条件判定与批次口径统一” | **结构与实现已对齐；对象级 L3 已达标，关键 L4 子句已锁，剩批次级治理与旧文档统一收口** |
| `自然之触 II` | `4 螺旋`；养成 `2` 树灵；然后造成 `6` 不可防御伤害；每有 `1` 树灵 `+1` 伤害 | `自然之怜`：`3 螺旋`；治疗 `1`；获得 `1` CP；抽 `1`；养成 `1` 树灵 | `NATURE_TOUCH_2` 当前已按主路线 + `自然之怜` 双分支 `variants` 落地；对象级 direct closeout L3 已补齐 | `nature-touch` 升级版应带主路线与 `自然之怜` 两个 `variants` | **结构与实现已对齐；对象级 L3 已达标，关键 L4 已锁，剩批次级治理与旧文档统一收口** |
| `复仇枝蔓 II` | 小顺子；施加刺藤；造成 `8` 伤害 | `苦痛根系`：`3 树叶`；每有 `1` 树灵造成 `1` 真实伤害 | `VENGEFUL_VINES_2` 当前已按主路线 + `苦痛根系` 双分支 `variants` 落地；对象级 direct closeout L3 已补齐 | `vengeful-vines` 升级版应带主路线与 `苦痛根系` 两个 `variants` | **结构与实现已对齐；对象级 L3 已达标，关键 L4 已锁，剩批次级治理与旧文档统一收口** |
| `野蛮生长 II` | `2 树枝 + 3 树叶`；造成 `4` 伤害并投掷 `5` 骰；增加 `1×树枝` 伤害；若投出树叶，获得生命源泉；养成 `1×螺旋` 树灵 | 2026-07-04 回图复核未把 `乱花迷眼` 归到本技能；旧归属已失效 | `WILD_GROWTH_2` 仍保留历史双分支实现，后续需要单独清理旧残留；当前 `upgrade-wild-growth-2` 不再接入 `wild-growth` | `wild-growth` 不应承接 `upgrade-wild-growth-2` 的 `大顺子` 与 `乱花迷眼` 反馈 | **当前升级卡真相不指向 `wild-growth`；旧实现残留不得再当卡图真相** |
| `野性怒吼 II` | `大顺子`；造成 `8` 伤害并投掷 `5` 骰；增加 `1×树枝` 伤害；若投出树叶，获得生命源泉；养成 `1×螺旋` 树灵 | `乱花迷眼`：`2 树枝 + 2 螺旋`；施加刺藤；造成 `4` 不可防御伤害 | 2026-07-04 已把 `WILD_ROAR_2` 改为 `wild-roar-2-main` + `wild-roar-2-dazzle` 双分支；主分支仍走大顺子奖励骰链，`乱花迷眼` 分支施加刺藤并造成 4 点不可防御伤害 | `wild-roar` 基础/升级版应同属大顺子 family；`wild-roar-2-dazzle` 承接下半区 `乱花迷眼` | **结构与实现已按正式卡图修正；回归测试覆盖 12345 可选野性怒吼 II、2 树枝 + 2 树灵可选乱花迷眼，且野蛮生长 II 不被误触发** |
| `破碎之拳 II` | `3/4/5` 树枝造成 `5/6/7` 伤害并施加刺藤 | 当前裁图未见明确下挂第二分支 | `SHATTERING_FIST_2` 与当前主路线一致；技能本体对象级 direct closeout `L3` 已补齐 | 保持现结构；当前重点从“主路线是否录对”转为批次级 `L4` 与口径统一 | **结构与实现已对齐；对象级 L3 已达标，剩批次级治理与旧文档统一收口** |

## 需要撤销的旧结论

- 下列说法已失效：
  - 2026-05-30 初版中把 `细心呵护 II / 培育`、`自然之触 II / 自然之怜`、`复仇枝蔓 II / 苦痛根系`、`野蛮生长 II / 乱花迷眼` 写成“录入错 + 实现错 / 严重错录 + 实现错”
  - 旧 evidence 里把这四张升级技能表述成“主路线仍是旧语义”
- 对这些对象，当前问题已从“实现缺失”转为“旧结论未回写、批次级 L4 与旧文档统一收口仍待补”。

## 当前最重要的结构裁定

- `细心呵护 II / 培育`
  - 应是同一基础技能 `tend-care` 的升级后双分支。
- `自然之触 II / 自然之怜`
  - 应是同一基础技能 `nature-touch` 的升级后双分支。
- `复仇枝蔓 II / 苦痛根系`
  - 应是同一基础技能 `vengeful-vines` 的升级后双分支。
- `野蛮生长 II`
  - 本轮不再把 `乱花迷眼` 归到 `wild-growth`；旧文档和旧实现里的该归属是历史残留，不得继续作为当前真相源。
- `野性怒吼 / 野性怒吼 II / 乱花迷眼`
  - 应是同一基础技能 `wild-roar` 的基础/升级版本；升级版图面上半区为 `大顺子` 造成 `8` 伤害并投掷 `5` 骰，下半区为 `乱花迷眼`。
  - `骰出 12345 点不了大顺子技能` 这类反馈必须优先命中 `wild-roar` family，而不是 `wild-growth` family。
- `扎根 II`
  - 仍是单主路线升级技能，不存在新的同卡下挂第二分支问题。
  - 当前主风险不是结构录错，而是防御 family 的收口态与批次级 `L4` 统一。
- `破碎之拳 II / 破碎之拳 III`
  - 都仍是单主路线升级技能，不存在新的同卡下挂第二分支问题。
  - `破碎之拳 III` 当前关键风险也不是结构录错，而是“三同点”条件判定必须绑定攻击快照而不是 live 活跃骰。

## 关联证据

- 全量升级重审汇总：`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
