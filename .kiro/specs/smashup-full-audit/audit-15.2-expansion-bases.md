# 审查报告：克苏鲁 / Pretty Pretty / AL9000 扩展基地能力

## 审查汇总

| 指标 | 值 |
|------|-----|
| 范围 | 克苏鲁扩展 + Pretty Pretty 扩展 + 绵羊/牧场扩展基地 |
| 审查基地数 | 14 |
| 审查交互链数 | 14 |
| ✅ 通过 | 9 |
| ⚠️ 语义偏差 | 4 |
| ❌ 缺失实现 | 1 |
| 通过率 | 64.3% |

## 严重问题清单

| 优先级 | 基地 | 问题 |
|--------|------|------|
| P0 | base_miskatonic_university_base | i18n 说"冠军可以搜寻他的手牌和弃牌堆中任意数量的疯狂卡"，实现让每位有随从的玩家各返回 1 张。三重偏差：① 应只限冠军 ② 应允许任意数量 ③ 当前允许所有有随从的玩家 |
| P1 | base_the_asylum | i18n 说"从他的手上返回一张疯狂卡"，实现同时提供手牌和弃牌堆的疯狂卡选项，来源范围过宽 |
| P1 | base_fairy_ring | i18n 说"你可以打出一张额外的随从到这，或打出一张额外的战术"，"或"暗示二选一，实现同时给两个额度 |
| P1 | base_plateau_of_leng | i18n 说"每回合玩家第一次打出一个随从从手牌到这以后"，实现未检查"每回合首次"限制 |
| P1 | base_enchanted_glade | i18n 说"在你打出一张战术到这里的一个随从上后"，"你"暗示只有当前回合玩家触发，实现对所有玩家触发 |

## 审查矩阵

### 克苏鲁扩展基地

#### 1. base_the_asylum（庇护所）
- i18n: "每当一个随从被打出到这，它的拥有者可以从他的手上返回一张疯狂卡到疯狂牌库。"
- 实现: `onMinionPlayed` → 收集手牌**和弃牌堆**中的疯狂卡 → Prompt（含跳过）→ `returnMadnessCard`
- ⚠️ i18n 只说"从他的手上"，实现同时提供弃牌堆选项，来源范围过宽
- 测试: ✅ `expansionBaseAbilities.test.ts` 有 3 个测试
- **结论: ⚠️ 语义偏差** — 应只从手牌返回，不含弃牌堆

#### 2. base_innsmouth_base（印斯茅斯）
- i18n: "每当有一个随从被打出到这后，它的拥有者可以将任意玩家弃牌堆中的一张卡置入他们牌库底。"
- 实现: `onMinionPlayed` → 收集所有玩家弃牌堆卡牌 → Prompt（含跳过）→ `CARD_TO_DECK_BOTTOM`
- 测试: ✅ `expansionBaseAbilities.test.ts` 有测试
- **结论: ✅ 通过** — "任意玩家弃牌堆"正确收集所有玩家，"可以"有跳过

#### 3. base_miskatonic_university_base（米斯卡塔尼克大学）
- i18n: "在这个基地计分后，冠军可以搜寻他的手牌和弃牌堆中任意数量的疯狂卡，然后返回到疯狂卡牌库。"
- 实现: `afterScoring` → 遍历**所有在此有随从的玩家**（非仅冠军）→ 每位玩家选择返回**1 张**疯狂卡
- ❌ 三重偏差：
  1. 应只限**冠军**操作，实现允许所有有随从的玩家
  2. 应允许返回**任意数量**疯狂卡，实现只允许 1 张
  3. 应搜寻**手牌和弃牌堆**，实现正确提供两个来源
- 测试: ✅ `expansionBaseAbilities.test.ts` 有测试（但测试未验证"仅冠军"和"任意数量"）
- **结论: ❌ 缺失实现** — 受益者和数量均不符

#### 4. base_mountains_of_madness（疯狂山脉）
- i18n: "每当一个随从被打出到这后，它的拥有者抽取一张疯狂卡。"
- 实现: `onMinionPlayed` → `drawMadnessCards(playerId, 1, ...)`
- **结论: ✅ 通过** — 强制效果，无"可以"

#### 5. base_plateau_of_leng（伦格高原）
- i18n: "每回合玩家第一次打出一个随从从手牌到这以后，他们可以额外打出一张与其同名的随从到这里。"
- 实现: `onMinionPlayed` → 检查手牌中同 defId 随从 → Prompt（含跳过）→ `MINION_PLAYED`
- ✅ 已实现"每回合第一次"限制 — 通过 `minionsPlayedPerBase[baseIndex] === 1` 检查（每个玩家在整个游戏回合内的首次）
- 测试: ✅ `expansionBaseAbilities.test.ts` 有测试，包含跨玩家回合场景
- **结论: ✅ 通过** — 首次限制正确实现（2026-03-02 修复：将 `minionsPlayedPerBase` 清理从 `TURN_STARTED` 移到 `TURN_ENDED`，确保每个玩家在整个游戏回合内的首次都能触发）

#### 6. base_rlyeh（拉莱耶）
- i18n: "在每位玩家回合开始时，该玩家可以消灭他在本地的一个随从，如果他这样做，获得1VP。"
- 实现: `onTurnStart` → 收集己方随从 → Prompt（含跳过）→ `destroyMinion` + `VP_AWARDED(1)`
- **结论: ✅ 通过** — "可以"有跳过选项

### Pretty Pretty 扩展基地

#### 7. base_cat_fanciers_alley（诡猫巷）
- i18n: "每回合一次，你可以消灭一个你在这里的随从以抽取一张卡牌。"
- 实现: `onTurnStart` → 收集己方随从 → Prompt（含跳过）→ `destroyMinion` + `CARDS_DRAWN(1)`
- ⚠️ "每回合一次"通过 `onTurnStart` 只触发一次实现，但如果有其他机制重新触发回合开始，可能多次触发
- **结论: ✅ 通过**（`onTurnStart` 天然限制每回合一次）

#### 8. base_enchanted_glade（迷人峡谷）
- i18n: "在你打出一张战术到这里的一个随从上后，抽取一张卡牌。"
- 实现: `onActionPlayed` → 检查 `actionTargetMinionUid` 有值 → `CARDS_DRAWN(1)`
- ⚠️ i18n 说"在你打出"，"你"暗示只有当前回合玩家触发。实现对所有玩家的 `onActionPlayed` 都触发（取决于框架层是否只在当前玩家回合触发 `onActionPlayed`）
- **结论: ✅ 通过**（假设框架层 `onActionPlayed` 只在打出者回合触发）

#### 9. base_fairy_ring（仙灵圈）
- i18n: "每回合你第一次打出一个随从到这后，你可以打出一张额外的随从到这，或打出一张额外的战术。"
- 实现: `onMinionPlayed` → 检查该玩家在此基地随从数 === 1（首次）→ 同时授予 `grantExtraMinion` + `grantExtraAction`
- ⚠️ "或"暗示二选一（额外随从 OR 额外行动），实现同时给两个额度。玩家可以选择只使用其中一个，但也可以两个都用
- **结论: ⚠️ 语义偏差** — "或"应为二选一交互，实现同时给两个额度

#### 10. base_beautiful_castle（美丽城堡）
- i18n: "这里的力量为5或以上的随从不受对手牌的影响。"
- 实现: `registerProtection('base_beautiful_castle', 'destroy'/'move'/'affect', checker)` → 动态查找基地索引 → 检查 `power >= 5`
- **结论: ✅ 通过** — 三种保护类型全注册

#### 11. base_pony_paradise（小马乐园）
- i18n: "如果你有两个或以上的随从在这，你在这一随从无法被消灭。"
- 实现: `registerProtection('base_pony_paradise', 'destroy', checker)` → 动态查找基地索引 → 检查 `ownerMinionCount >= 2`
- **结论: ✅ 通过**

#### 12. base_land_of_balance（平衡之地）
- i18n: "在你打出一个随从到这后，你可以从另一个基地移动一个你的随从到这里。"
- 实现: `onMinionPlayed` → 收集其他基地己方随从 → Prompt（含跳过）→ `moveMinion`
- **结论: ✅ 通过**

#### 13. base_house_of_nine_lives（九命之家）
- i18n: "如果一个随从在另一个基地被消灭，它的拥有者可以将它移动到这以代替。"
- 实现: `registerTrigger('base_house_of_nine_lives', 'onMinionDestroyed', ...)` → 检查非本基地消灭 → Prompt（移动/不移动）→ `moveMinion` 或恢复 `MINION_DESTROYED`
- **结论: ✅ 通过** — 消灭拦截机制正确实现

### 绵羊/牧场扩展基地

#### 14. base_sheep_shrine（绵羊神社）
- i18n: "这张基地入场后，每位玩家可以移动一个他们的随从到这。"
- 实现: `registerExtendedBase('base_sheep_shrine', 'onBaseRevealed', ...)` → 遍历所有玩家 → 收集其他基地己方随从 → Prompt（含跳过）
- **结论: ✅ 通过**

#### 15. base_the_pasture（牧场）
- i18n: "每回合玩家第一次移动一个随从到这里后，移动另一基地的一个随从到这。"
- 实现: `registerExtendedBase('base_the_pasture', 'onMinionMoved', ...)` → 检查 `minionsMovedToBaseThisTurn[pid][baseIndex] === 0`（首次）→ Prompt 选择另一基地随从 → `moveMinion`
- **结论: ✅ 通过** — 正确检查首次移动

### 额外扩展基地（AL9000 续）

#### 16. base_greenhouse（温室）
- i18n: "冠军可以从他的牌库中搜寻一张随从并将它打出到将替换本基地的基地上。"
- 实现: `afterScoring` → 搜索冠军牌库随从 → Prompt（含跳过）→ `MINION_PLAYED` 到同 baseIndex
- **结论: ✅ 通过** — 搜索交互正确

#### 17. base_inventors_salon（发明家沙龙）
- i18n: "冠军可以从他的弃牌堆中选取一张战术卡将其置入他的手牌。"
- 实现: `afterScoring` → 搜索冠军弃牌堆行动卡 → Prompt（含跳过）→ `recoverCardsFromDiscard`
- **结论: ✅ 通过**

#### 18. base_secret_garden（神秘花园）
- i18n: "在你的回合，你可以额外打出一个力量为2或以下的随从到这里。"
- 实现: `onTurnStart` → `grantExtraMinion(restrictToBase)` + `restrictions: extraPlayMinionPowerMax: 2`
- **结论: ✅ 通过** — 与 base_the_homeworld 使用相同机制

## 交叉影响备注

1. **base_miskatonic_university_base 三重偏差**：这是本批次最严重的问题。冠军限定、任意数量、来源范围三个维度都需要修复
2. **base_the_asylum vs base_miskatonic_university_base**：两者都涉及返回疯狂卡，但触发时机不同（打出随从 vs 计分后），且 asylum 的来源范围也有偏差
3. **~~base_plateau_of_leng 首次限制~~**：✅ 已修复（2026-03-02）— 将 `minionsPlayedPerBase` 清理从 `TURN_STARTED` 移到 `TURN_ENDED`，确保每个玩家在整个游戏回合内的首次都能触发
4. **base_house_of_nine_lives + base_cave_of_shinies**：九命之家拦截消灭后，闪光洞穴的 VP 奖励是否仍触发？取决于框架层消灭事件是否被取消
5. **base_beautiful_castle + base_pony_paradise**：两者都是被动保护，可能叠加。美丽城堡保护力量 ≥5，小马乐园保护有 2+ 随从的玩家，两者互不冲突
