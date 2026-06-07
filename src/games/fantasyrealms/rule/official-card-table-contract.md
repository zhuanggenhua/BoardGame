# 幻想国度官方基础卡表录入合同

## 本轮口径

| 项 | 内容 |
| --- | --- |
| 游戏 | `fantasyrealms / 幻想国度` |
| 整理日期 | `2026-06-06` |
| 当前范围 | 官方 53 张基础卡的数据底座 |
| 主真相源 | `temp/新游戏幻想国度/Fantasy_Realms_Cards.xlsx` |
| 对照源 | `temp/新游戏幻想国度/规则.txt` |
| 当前代码落点 | `src/games/fantasyrealms/data/cards.ts` |
| 当前运行时消费 | `src/games/fantasyrealms/foundation.ts`、`src/games/fantasyrealms/domain/index.ts` |

## 说明

- 本文档是对“官方基础卡表层”的正式收口，目的是把 `data/cards.ts` 从“已写进去的代码”升级为“有真相源、有映射合同、有缺口登记的数据能力”。
- 本轮主真相源是结构化 xlsx，不是图片素材，因此**无裁图表、无可视槽位合同表**。
- `规则.txt` 负责提供玩法边界与双人变体口径，不负责提供完整逐卡中文名录；因此本轮逐卡 `name/text` 继续保留英文原文。

## 主真相源总表

| 文件 | 相对路径 | 覆盖对象 | 当前用途 | 当前状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `Fantasy_Realms_Cards.xlsx` | `temp/新游戏幻想国度/Fantasy_Realms_Cards.xlsx` | 53 张基础卡的 `Suit / Name / Value / Text` | 官方基础卡表主真相源 | 正式录入依据 | 当前只有 `Realmsdata` 这个 sheet；共 54 行，含 1 行表头与 53 行数据。 |
| `规则.txt` | `temp/新游戏幻想国度/规则.txt` | 基础流程、双人变体、计分优先级文字说明 | 玩法边界对照源 | 正式对照依据 | 用于确认双人变体口径与后续计分引擎边界，不提供完整逐卡中文字段。 |

## 对照源登记

| 对照源 | 路径 | 用途 | 备注 |
| --- | --- | --- | --- |
| 当前运行时代码 | `src/games/fantasyrealms/data/cards.ts` | 对照当前代码已接入的卡表实现 | 这是当前实现结果，不是真相源。 |
| foundation/runtime 消费链 | `src/games/fantasyrealms/foundation.ts`、`src/games/fantasyrealms/domain/index.ts` | 对照哪些运行时路径消费官方卡表 | 用于确认没有再维护另一套临时演示牌库。 |

## 真相源结构

| 项 | 结论 |
| --- | --- |
| Sheet 名 | `Realmsdata` |
| 表头 | `Suit | Name | Value | Text` |
| 数据行数 | `53` |
| 花色种类 | `11` |
| 常规花色分布 | `Army/Artifact/Beast/Flame/Flood/Land/Leader/Weapon/Weather/Wizard` 各 `5` 张 |
| 野牌分布 | `Wild` 共 `3` 张 |

## 字段映射合同表

| 真相源字段 | 含义 | 运行时字段 | 当前映射规则 | 当前状态 |
| --- | --- | --- | --- | --- |
| `Suit` | 英文花色 | `suit` | 固定映射为中文花色：`Army->军队`、`Artifact->神器`、`Beast->巨兽`、`Flame->烈焰`、`Flood->洪流`、`Land->土地`、`Leader->领袖`、`Weapon->武器`、`Weather->天象`、`Wild->野牌`、`Wizard->法师` | 已确认 |
| `Name` | 英文卡名 | `name` | 当前保留英文原文，不做自译 | 已确认 |
| `Value` | 基础分值 | `score` | 数字原样录入 | 已确认 |
| `Text` | 英文效果文案 | `text` | 当前保留英文原文，不做自译 | 已确认 |
| `Suit + Name` | 英文花色 + 英文卡名 | `id` | 统一转为 `english-suit + kebab-case english-name`，例如 `army-rangers`、`artifact-book-of-changes` | 已确认 |
| 花色语义 | 卡面配色类别 | `toneClass` | 与中文花色一一对应：`fr-suit-army`、`fr-suit-artifact` 等 | 已确认 |

## 花色分布核对表

| 英文花色 | 中文花色 | 张数 |
| --- | --- | --- |
| `Army` | `军队` | `5` |
| `Artifact` | `神器` | `5` |
| `Beast` | `巨兽` | `5` |
| `Flame` | `烈焰` | `5` |
| `Flood` | `洪流` | `5` |
| `Land` | `土地` | `5` |
| `Leader` | `领袖` | `5` |
| `Weapon` | `武器` | `5` |
| `Weather` | `天象` | `5` |
| `Wild` | `野牌` | `3` |
| `Wizard` | `法师` | `5` |

## 官方基础卡逐项核对表

| xlsx 行号 | 原始 Suit | 原始 Name | 原始 Value | runtime id | runtime suit | 原始 Text |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | Army | Rangers | 5 | army-rangers | 军队 | Bonus: +10 for each Land; Clears the word Army from Penalty section of all cards in hand |
| 3 | Army | Elven Archers | 10 | army-elven-archers | 军队 | Bonus: +5 if no Weather in hand |
| 4 | Army | Dwarvish Infantry | 15 | army-dwarvish-infantry | 军队 | Penalty: -2 for each other Army |
| 5 | Army | Light Cavalry | 17 | army-light-cavalry | 军队 | Penalty: -2 for each Land |
| 6 | Army | Celestial Knights | 20 | army-celestial-knights | 军队 | Penalty: -8 unless with at least one Leader |
| 7 | Artifact | Protection Rune | 1 | artifact-protection-rune | 神器 | Clears the Penalty sections on all cards in hand |
| 8 | Artifact | World Tree | 2 | artifact-world-tree | 神器 | Bonus: +50 if every active card in hand is a different suit |
| 9 | Artifact | Book of Changes | 3 | artifact-book-of-changes | 神器 | Bonus: you may change the suit of one other card. Its name, bonuses and penalties remain the same. |
| 10 | Artifact | Shield of Keth | 4 | artifact-shield-of-keth | 神器 | Bonus: +15 with any one Leader, +40 with both Leader and Sword of Keth |
| 11 | Artifact | Gem of Order | 5 | artifact-gem-of-order | 神器 | Bonus: +10 for 3-card run, +30 for 4-card run, +60 for 5-card run, +100 for 6-card run, +150 for 7-card run |
| 12 | Beast | Warhorse | 6 | beast-warhorse | 巨兽 | Bonus: +14 with any Leader or Wizard |
| 13 | Beast | Unicorn | 9 | beast-unicorn | 巨兽 | Bonus: +30 with Princess, +15 with Empress, Queen, or Elemental Enchantress |
| 14 | Beast | Hydra | 12 | beast-hydra | 巨兽 | Bonus: +28 with Swamp |
| 15 | Beast | Dragon | 30 | beast-dragon | 巨兽 | Penalty: -40 unless with at least one Wizard |
| 16 | Beast | Basilisk | 35 | beast-basilisk | 巨兽 | Penalty: Blanks all Armies, Leaders, and other Beasts |
| 17 | Flame | Candle | 2 | flame-candle | 烈焰 | Bonus: +100 with Book of Changes, Bell Tower, and any one Wizard |
| 18 | Flame | Fire Elemental | 4 | flame-fire-elemental | 烈焰 | Bonus: +15 for each other Flame |
| 19 | Flame | Forge | 9 | flame-forge | 烈焰 | Bonus: +9 for each Weapon and Artifact |
| 20 | Flame | Lightning | 11 | flame-lightning | 烈焰 | Bonus: +30 with Rainstorm |
| 21 | Flame | Wildfire | 40 | flame-wildfire | 烈焰 | Blanks all cards except Flames, Weather, Wizards, Weapons, Artifacts, Great Flood, Island, Mountain, Unicorn, & Dragon |
| 22 | Flood | Fountain of Life | 1 | flood-fountain-of-life | 洪流 | Bonus: Add the base strength of any Weapon, Flood, Flame, Land, or Weather in your hand |
| 23 | Flood | Water Elemental | 4 | flood-water-elemental | 洪流 | Bonus: +15 for each other Flood |
| 24 | Flood | Island | 14 | flood-island | 洪流 | Clears the Penalty on any one Flood or Flame |
| 25 | Flood | Swamp | 18 | flood-swamp | 洪流 | Penalty: -3 for each Army and Flame |
| 26 | Flood | Great Flood | 32 | flood-great-flood | 洪流 | Penalty: Blanks all Armies, all Land except Mountain, all Flames except Lightning |
| 27 | Land | Earth Elemental | 4 | land-earth-elemental | 土地 | Bonus: +15 for each other Land |
| 28 | Land | Underground Caverns | 6 | land-underground-caverns | 土地 | Bonus: +25 with Dwarvish Infantry or Dragon; Clears the Penalty on all Weather |
| 29 | Land | Forest | 7 | land-forest | 土地 | Bonus: +12 for each Beast and Elven Archers |
| 30 | Land | Bell Tower | 8 | land-bell-tower | 土地 | Bonus: +15 with any one Wizard |
| 31 | Land | Mountain | 9 | land-mountain | 土地 | Bonus: +50 with both Smoke and Wildfire; Clears the Penalty on all Floods |
| 32 | Leader | Princess | 2 | leader-princess | 领袖 | Bonus: +8 for each Army, Wizard, and other Leader |
| 33 | Leader | Warlord | 4 | leader-warlord | 领袖 | Bonus: Equal to the base strengths of all Armies in your hand |
| 34 | Leader | Queen | 6 | leader-queen | 领袖 | Bonus: +5 for each Army, +20 for each Army if in the same hand with King |
| 35 | Leader | King | 8 | leader-king | 领袖 | Bonus: +5 for each Army, +20 for each Army if in the same hand with Queen |
| 36 | Leader | Empress | 10 | leader-empress | 领袖 | Bonus: +10 for each Army; Penalty: -5 for each other leader |
| 37 | Weapon | Magic Wand | 1 | weapon-magic-wand | 武器 | Bonus: +25 with any one Wizard |
| 38 | Weapon | Elven Longbow | 3 | weapon-elven-longbow | 武器 | Bonus: +30 with Elven Archers or Warlord or Beastmaster |
| 39 | Weapon | Sword of Keth | 7 | weapon-sword-of-keth | 武器 | Bonus: +10 with any one Leader, +40 with both Leader and Shield of Keth |
| 40 | Weapon | Warship | 23 | weapon-warship | 武器 | Penalty: Blanked unless with at least one Flood; Clears the word Army from Penalty section of all Floods |
| 41 | Weapon | War Dirigible | 35 | weapon-war-dirigible | 武器 | Penalty: Blanked unless with at least one Army, Blanked if hand contains any weather |
| 42 | Weather | Air Elemental | 4 | weather-air-elemental | 天象 | Bonus: +15 for each other Weather |
| 43 | Weather | Rainstorm | 8 | weather-rainstorm | 天象 | Bonus: +10 for each Flood; Penalty: Blanks all Flames except Lightning |
| 44 | Weather | Whirlwind | 13 | weather-whirlwind | 天象 | Bonus: +40 with Rainstorm and either Blizzard or Great Flood |
| 45 | Weather | Smoke | 27 | weather-smoke | 天象 | Penalty: This card is blanked unless with at least one Flame |
| 46 | Weather | Blizzard | 30 | weather-blizzard | 天象 | Penalty: Blanks all Floods, -5 for each Army, Leader, Beast, and Flame |
| 47 | Wild | Shapeshifter | 0 | wild-shapeshifter | 野牌 | May take on the name and suit of any Artifact, Leader, Wizard, Weapon or Beast. Does not take bonus or penalty. |
| 48 | Wild | Mirage | 0 | wild-mirage | 野牌 | May take on the name and suit of any Army, Land, Weather, Flood or Flame. Does not take bonus or penalty. |
| 49 | Wild | Doppelganger | 0 | wild-doppelganger | 野牌 | May duplicate the name, suit, base strength, and penalty but not bonus of any one other card in your hand |
| 50 | Wizard | Necromancer | 3 | wizard-necromancer | 法师 | Bonus: At the end of the game, you may take one Army, Leader, Wizard, or Beast from the discard pile and add it to your hand as an eighth card. |
| 51 | Wizard | Elemental Enchantress | 5 | wizard-elemental-enchantress | 法师 | Bonus: +5 for each Land, Weather, Flood, and Flame |
| 52 | Wizard | Collector | 7 | wizard-collector | 法师 | Bonus: +10 if three different cards in same suit, +40 if four different cards, +100 if five different cards |
| 53 | Wizard | Beastmaster | 9 | wizard-beastmaster | 法师 | Bonus: +9 for each Beast; Clears the Penalty on all Beasts |
| 54 | Wizard | Warlock Lord | 25 | wizard-warlock-lord | 法师 | Penalty: -10 for each Leader and other Wizard |

## 当前裁决

1. `fantasyrealms` 当前官方基础卡表以 `Fantasy_Realms_Cards.xlsx` 为唯一逐卡主真相源。
2. 当前逐卡 `name` 与 `text` 保留英文原文，这不是“临时没空汉化”，而是因为仓库里没有正式逐卡中文真相源。
3. `规则.txt` 只负责玩法口径对照，不得反向拿其中少量示例卡名去覆盖完整逐卡数据表。
4. `src/games/fantasyrealms/data/cards.ts` 是当前实现落点，后续若调整任何 `id`、花色映射、分值或效果文本，必须先回写本合同。
5. `foundation.ts` 与 `domain/index.ts` 当前共同消费这份官方卡表，后续不得再回退到另一套“示例牌库”。

## 冲突 / 未完成项

| 项目 | 当前状态 | 说明 |
| --- | --- | --- |
| 逐卡中文卡名 | 未完成 | 当前仓库无逐卡中文正式真相源。 |
| 逐卡中文效果文案 | 未完成 | 当前仓库无逐卡中文正式真相源。 |
| 完整官方计分语义 | 已完成（双人 runtime 范围内） | 当前已实现完整封印/解罚/野牌/胜者裁定；多人基础版流程仍未接入。 |
| 双人结束后胜者裁定 | 已完成 | 当前 `isGameOver` 会返回正式胜者/平局与分数。 |
