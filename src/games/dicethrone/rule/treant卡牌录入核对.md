# Dice Throne 树精卡牌录入核对

> 本表只覆盖 Treant 15 张专属卡，口径以 `abilitycards.png` 为准。

## 当前结论

- 2026-05-17 当前工作区里，Treant 专属卡**玩法实现已经大幅收敛**。
- 5 张升级卡描述已按卡图展开；Treant 专属卡当前残余不再是描述录入错误。
- `2026-05-17` 已补齐 15 张专属卡逐卡真实手牌入口 L3：7 张升级卡、6 张主阶段动作卡、2 张攻击修正/掷骰卡都已通过真实拖拽打出与最终状态断言。

## 专属卡矩阵（15）

| 图槽 | 对象 | 图片直接结论 | 当前状态 |
|---:|---|---|---|
| 17 | `treant-card-trample` | `投掷5骰；每个树枝 +1；若至少增加3伤害则施加刺藤` | 对齐，L2 已测；真实手牌 L3 已补 |
| 18 | `upgrade-tend-care-2` | `抽1；养成4树灵；1名玩家获得生命源泉；选择1名对手施加刺藤` | 对齐，`replaceAbility` 正确；描述已按卡图展开；真实手牌 L3 已补 |
| 19 | `upgrade-rooted-2` | `防御掷4骰；防止树枝数+树灵数伤害；双树叶养成1；双树灵1名玩家得生命源泉` | 对齐，`replaceAbility` 正确；描述已按卡图展开；真实手牌 L3 已补 |
| 20 | `treant-card-drink-deep` | `选择1名玩家获得生命源泉` | 对齐，L2 已测；真实手牌 L3 已补 |
| 21 | `upgrade-shattering-fist-3` | `5/6/7伤害；若3同点养成1；施加刺藤` | 对齐，L2 已测；真实手牌 L3 已补 |
| 22 | `treant-card-harvest` | `移除至多3树灵得CP；若至少移除2，则至多2名玩家得生命源泉` | 对齐，L2 已测；真实手牌 L3 已补 |
| 23 | `treant-card-cultivate` | `养成3树灵` | 对齐，L2 已测；真实手牌 L3 已补；`treant-card-cultivate-3-resolve` 正向路由已补 |
| 24 | `treant-card-downpour` | `养成所有现有树灵各一次（任意顺序）` | 对齐，已修掉“只升级部分现有树灵”的错误枚举；L2/L4 已测；真实手牌 L3 已补 |
| 25 | `upgrade-nature-touch-2` | `4树灵；养成2；造成6不可防御；每有1树灵+1伤害` | 对齐，`replaceAbility` 正确；描述已按卡图展开；真实手牌 L3 已补 |
| 26 | `treant-card-soulfire` | `树枝=对所有对手1附属伤害；树叶=生命源泉；树灵=养成1` | 对齐，L2 已测；真实手牌 L3 已补 |
| 27 | `treant-card-mother-tree` | `投1骰；树灵=>养成4；否则抽1` | 对齐，L2 已测；真实手牌 L3 已补 |
| 28 | `upgrade-vengeful-vines-2` | `小顺子；施加刺藤；造成8伤害` | 对齐，`replaceAbility` 正确；描述已按卡图展开；真实手牌 L3 已补 |
| 29 | `upgrade-wild-growth-2` | `2树枝+3树叶；造成4；可移除至多2树灵各+4；可弃生命源泉使不可防御` | 对齐，`replaceAbility` 正确；描述已按卡图展开；真实手牌 L3 已补 |
| 30 | `upgrade-shattering-fist-2` | `3/4/5树枝造成5/6/7伤害并施加刺藤` | 对齐，L2 已测；索引已修到 `30`；真实手牌 L3 已补 |
| 31 | `treant-card-planting` | `养成3树灵` | 对齐，L2 已测；索引已修到 `31`；真实手牌 L3 已补 |

## 当前残余

| 对象 | 残余类型 | 说明 |
|---|---|---|
| Treant 专属主阶段卡 | 逐卡真实入口 L3 已补 | `treant-card-drink-deep`、`treant-card-cultivate`、`treant-card-harvest`、`treant-card-downpour`、`treant-card-planting`、`treant-card-mother-tree` 均已通过真实手牌拖拽打出并断言最终状态 |
| Treant 专属升级卡 | 逐卡真实入口 L3 已补 | 7 张升级卡均已通过真实手牌拖拽打出，覆盖 CP 消耗、手牌消耗与目标技能等级落点 |
| Treant 攻击修正/掷骰专属卡 | 逐卡真实入口 L3 已补 | `treant-card-trample`、`treant-card-soulfire` 已通过真实手牌拖拽打出，覆盖奖励骰 UI、攻击修正/附属伤害、刺藤、生命源泉与养成落地 |
| Treant 所有组合分支 | 非录入残余；审计残余 | 专属卡逐卡入口已补 L3；领域测试已补四批 L4 分支并修掉 `Downpour` 部分升级漏洞、神性树灵同回合重复花费漏洞与 `Drink Deep` 负数索引白送生命源泉漏洞，且已补 `Tend & Care II`/`Forest Awakens`/`Drink Deep`/`Harvest` 目标资源上限边界与 `Mother Tree`/`Soulfire`/`Trample` 满栈上限边界；本轮还补了 `Soulfire` 纯三树枝/纯三树叶分布，`Shattering Fist` 跳过/伪造移除 2，`Tend & Care II` 座位表外目标索引，`Forest Awakens`/`Quiet Cultivation`/`Shattering Fist III`/`Nature Touch`/通用养成动作卡伪造不可能养成结果，`Rooted II`、`Wild Growth II`、`Harvest`、`Drink Deep` 的伪造选择非法值门禁，`Harvest` 无树灵空选和 `Rooted` 过量防伤边界，以及 `CHOICE_RESOLVED` 通用 token/status 数值门禁；但不等于所有目标数量、所有骰面排列、所有多人/队友分支都逐一达到 L4 |

## 结论

- Treant 专属卡当前不是“多数玩法都错”，而是**15 张专属卡均已按当前图片合同完成 L1/L2，并补到逐卡真实手牌入口 L3；`treant-card-cultivate-3-resolve` 的共享正向路由也已补**。
- 录入层当前没有已知残余；后续若要继续加严，应归入“全分支 L4 审计”，不是数据录入未完成。
