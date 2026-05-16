# DiceThrone Treant 全面审计 2026-05-16

## 范围

- 角色：`treant`
- 真相源：
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\玩家面板.png`
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\提示板.png`
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\dicethrone\images\treant\abilitycards.png`
- 实现入口：
  - `src/games/dicethrone/heroes/treant/abilities.ts`
  - `src/games/dicethrone/heroes/treant/cards.ts`
  - `src/games/dicethrone/heroes/treant/tokens.ts`
  - `src/games/dicethrone/domain/passiveAbility.ts`
  - `src/games/dicethrone/domain/commandValidation.ts`
  - `src/games/dicethrone/domain/execute.ts`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/assets/atlas-configs/dicethrone/ability-cards-treant.atlas.json`

## 旧结论失效

这轮已经不能再把 Treant 描述成“只剩两个问题”或“多数只是缺逐卡 L3”。直接看图后，Treant 命中的是**批量规则录入错误 + 消费合同错误 + 交互语义错误**。

受影响的旧文档至少包括：

- `evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md`
- `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md`
- `evidence/dicethrone/dicethrone-treant-ninja-sample-deep-audit-2026-05-15.md`

这些文档里凡是把 Treant 写成“当前发布口径可收口”或“只差逐卡 E2E”的表述，现在都不能继续当真。

## 已坐实的高优先级 finding

| Finding | 图片直接结论 | 代码落点 | 命中维度 | 结论 |
|---|---|---|---|---|
| 树灵每回合限 1 次 | `每回合每种树灵仅限花费1次` | `tokens.ts` `passiveAbility.ts` `commandValidation.ts` `execute.ts` | D1 D5 D10 D18 | **未实现** |
| 养成语义整体错误 | `养成1树灵 = 获得1幼种或升级1现有树灵` | `abilities.ts` `cards.ts` 多处直接 `grantToken(... TREANT_SEEDLING ...)` / `grantToken(... TREANT_SAPLING ...)` | D1 D5 D10 D23 D52 | **系统性错误** |
| 神性树灵防负面被自动消耗 | `你可以...花费神性树灵，以防止...状态效果` | `flowHooks.ts` `preventIncomingDebuffsWithTreantDivine(...)` | D1 D5 D13 D18 | **可选被做成自动** |
| 刺藤每回合最多 2 伤害 | `每回合至多因此受到2伤害` | `flowHooks.ts` `extraRollAttempts = Math.max(0, core.rollCount - 1)` | D1 D5 D18 | **上限未实现** |
| 玩家板槽位合同 | 被动在独立紫槽，防御在右下独立槽 | `ui/abilitySlotMapping.ts` `AbilityOverlays.tsx` | D15 D52 | **本轮已修** |

## 基础技能 / 被动 / 防御 finding

| 对象 | 图片直接结论 | 当前实现 | 结论 |
|---|---|---|---|
| `quiet-cultivation` | 维持阶段 `养成1树灵` | upkeep 直接 `grant seedling 1` | 错 |
| `shattering-fist` | 可弃 1 树灵施加刺藤 | 没有这条可选消费分支 | 错 |
| `tend-care` | `抽1 + 养成3 + 1名玩家得生命源泉 + 选1名对手刺藤` | `draw1 + seedling3 + self lifeSap + opponent thorn` | 错 |
| `nature-touch` | `养成2 + 5 点不可防御伤害，每有1树灵 +1` | 固定 5 点不可防御伤害 | 错 |
| `wild-growth` | `2 伤害；可移除至多2树灵，每个 +4；可弃生命源泉使其不可防御` | `damage 2 + heal 1` | 错 |
| `rooted` | `防止 1×树枝 + 1×树灵；双树叶养成1；双树灵 1名玩家得生命源泉` | 每个树枝/树叶/树灵独立给反击/幼种/生命源泉 | 错 |
| `forest-awakens` | `你和1名队友获得生命源泉` | 只给自己 `life_sap` | 错 |

## 专属卡 finding

| 对象 | 卡图直接结论 | 当前实现 | 结论 |
|---|---|---|---|
| `treant-card-trample` | 树枝加伤；若总共至少加 3 伤害才施加刺藤 | 把刺藤触发写成“掷出树灵” | 错 |
| `upgrade-tend-care-2` | `抽1 + 养成4 + 1名玩家得生命源泉 + 选1名对手刺藤` | `seedling3 + sapling1 + self lifeSap + opponent thorn` | 错 |
| `treant-card-drink-deep` | `1名玩家获得生命源泉` | 只给自己 | 错 |
| `upgrade-shattering-fist-3` | `5/6/7伤害；若 3 个相同数字则养成1；施加刺藤` | `6/7/8伤害 + 自动刺藤` | 错 |
| `treant-card-harvest` | `移除至多3树灵换 CP；若至少移除2，则至多2名玩家得生命源泉` | `draw1 + cultivate1` | 错 |
| `treant-card-cultivate` | `养成3树灵` | 直接 `seedling3` | 受养成总语义缺失牵连 |
| `treant-card-downpour` | `养成所有现有树灵各一次（任意顺序）` | `heal2 + cultivate1` | 错 |
| `upgrade-nature-touch-2` | `养成2 + 6 点不可防御伤害，每有1树灵 +1` | 固定 6 点不可防御伤害 | 错 |
| `treant-card-soulfire` | 树枝=对所有对手 1 附属伤害；树叶=生命源泉；树灵=养成1 | 树枝分支写成攻击 +1 | 错 |
| `treant-card-mother-tree` | `树灵→养成4；否则抽1` | 分支结构对，但仍直接 `seedling4` | 受养成总语义缺失牵连 |
| `upgrade-vengeful-vines-2` | `刺藤 + 8伤害` | 当前主效果一致 | 本轮未命中主效果冲突 |
| `upgrade-wild-growth-2` | `4伤害；可移除至多2树灵各 +4；可弃生命源泉变不可防御` | `damage4 + heal1` | 错 |
| `upgrade-shattering-fist-2` | `5/6/7伤害并施加刺藤` | 规则与预览索引都错 | 错 |
| `treant-card-planting` | `养成3树灵` | `seedling4` | 错 |

## 图集 / 预览合同 finding

| 对象 | 代码现状 | 合同现状 | 结论 |
|---|---|---|---|
| `upgrade-shattering-fist-2` | `cards.ts` 绑定 `sourceAtlasIndex: 35` | `ability-cards-treant.atlas.json` 只有 `frames[0..34]` | **索引越界** |
| `treant-card-planting` | `cards.ts` 绑定 `sourceAtlasIndex: 36` | `ability-cards-treant.atlas.json` 只有 `frames[0..34]` | **索引越界** |

## 当前状态矩阵

| 家族 | 当前状态 |
|---|---|
| 槽位合同 | 已修两个硬错，但只覆盖图面落点，不代表玩法收口 |
| Token 主动入口 | 幼种 / 木苗 / 生命源泉 / 神性 +3 有部分 L2/L3/L4 证据，但其中“每回合每种限1次”“神性防负面可选”仍错 |
| 基础技能 | 多数不能再按旧 L1/L2 表外推，至少 `tend-care` / `nature-touch` / `wild-growth` / `rooted` / `forest-awakens` 需要重录 + 重做 |
| 专属卡 | 不是“缺逐卡 E2E”这么简单，已有多张主效果直接录错 |

## 结论

- Treant 当前**不能**视为已审计收口。
- 这轮不是又多出两个散点 bug，而是把 Treant 打回到了“需要按图片重录主合同，再按合同重做实现”的状态。
- 优先修复顺序应按共享根因走，不应再按单卡打补丁：
  1. `养成树灵` 的正式领域合同与状态/交互实现
  2. `每回合每种树灵仅限花费1次`
  3. 神性树灵防负面的可选响应窗
  4. 刺藤上限 2
  5. 基础技能与专属卡的错录对象批量重录
