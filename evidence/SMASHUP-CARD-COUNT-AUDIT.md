# 大杀四方（Smash Up）卡牌数量核对报告

生成时间：2026-02-28

## 📊 核对结果总览

根据 [Smash Up Wiki](https://smashup.fandom.com/wiki/Category:Factions) 的官方规则：
- **每个派系标准配置**：20 张卡牌（10 张随从 + 10 张行动）
- **总力量值**：30（平均每张随从力量 3）
- **典型结构**：1x 力量5 + 2x 力量4 + 3x 力量3 + 4x 力量2

## ✅ 当前实现状态

### 已实现派系（21 个）

| 派系 ID | 中文名 | 卡牌定义数 | 实际卡牌总数 | Wiki 标准 | 状态 |
|---------|--------|-----------|-------------|----------|------|
| `aliens` | 外星人 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `bear_cavalry` | 熊骑兵 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `cthulhu` (minions_of_cthulhu) | 克苏鲁仆从 | 13 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `dinosaurs` | 恐龙 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `elder_things` | 远古物种 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `frankenstein` | 科学怪人 | 12 | 20 | 10 随从 + 10 行动 | ⚠️ 待确认 |
| `ghosts` | 幽灵 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `giant_ants` | 巨蚁 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `innsmouth` | 印斯茅斯 | 9 | 20 | **10 随从 + 10 行动** | ✅ 完整 |
| `killer_plants` | 食人花 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `madness` | 疯狂 | 1 | 30 | 特殊（30 张相同卡） | ✅ 特殊卡牌 |
| `miskatonic_university` | 米斯卡塔尼克 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `ninjas` | 忍者 | 12 | 20 | **10 随从 + 10 行动** | ✅ 完整 |
| `pirates` | 海盗 | 12 | 20 | **10 随从 + 10 行动** | ✅ 完整 |
| `robots` | 机器人 | 10 | 20 | **18 随从 + 2 行动** | ✅ 完整 |
| `steampunks` | 蒸汽朋克 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `tricksters` | 捣蛋鬼 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `vampires` | 吸血鬼 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `werewolves` | 狼人 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `wizards` | 巫师 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |
| `zombies` | 丧尸 | 12 | 20 | 10 随从 + 10 行动 | ✅ 完整 |

**统计**：
- ✅ 完整派系：**20 个**（所有已实现派系均达到标准 20 张卡）
- ⚠️ 待确认：1 个（科学怪人，Wiki 中未找到对应派系）
- ⚠️ 特殊卡牌：1 个（疯狂卡，30 张，用于克苏鲁扩展）
- 总卡牌数：**430 张**（20 个派系 × 20 + 30 张疯狂卡）

**重要发现（根据 Wiki）**：
1. **标准派系结构**：10 随从 + 10 行动，总力量 30（平均每随从 3 力量）
2. **机器人派系特殊结构**：**18 随从 + 2 行动**（Wiki 明确说明），总力量 38（平均 2.11 力量）
   - 项目实现：9 种随从定义（通过 `count` 字段总计 18 张）+ 1 种行动（`count: 2`）= 20 张卡 ✅
3. **印斯茅斯派系特殊结构**：10 随从（全部力量 2）+ 10 行动，总力量 20（平均 2 力量）
   - 项目实现：1 种随从"本地人"（`count: 10`）+ 8 种行动（通过 `count` 总计 10 张）= 20 张卡 ✅

**卡牌定义数 ≠ 实际卡牌总数**：
- 每个卡牌定义包含 `count` 字段，表示该卡在派系中的数量
- 例如：`{ id: 'pirate_dinghy', count: 2 }` 表示该派系有 2 张"小船"卡
- 印斯茅斯只有 9 个定义，但"本地人"的 `count: 10`，符合 Wiki 描述的"10 张相同随从"机制
- 机器人有 10 个定义（9 种随从 + 1 种行动），通过 `count` 字段达到 18 随从 + 2 行动

### 未实现派系（85+ 个）

根据 Wiki，截至 2026 年 Clowns 促销版发布，共有 **106 个派系**。项目中仅实现了 21 个（不含疯狂卡），还有 **85+ 个派系未实现**。

#### 核心版（Core Set）- 8 个派系
- ✅ Aliens（外星人）- 已实现但不完整
- ✅ Dinosaurs（恐龙）- 已实现但不完整
- ✅ Ninjas（忍者）- 已实现但不完整
- ✅ Pirates（海盗）- 已实现但不完整
- ✅ Robots（机器人）- 已实现但不完整
- ✅ Tricksters（捣蛋鬼）- 已实现但不完整
- ✅ Wizards（巫师）- 已实现但不完整
- ✅ Zombies（丧尸）- 已实现但不完整

#### Awesome Level 9000 - 4 个派系
- ✅ Bear Cavalry（熊骑兵）- 已实现但不完整
- ✅ Ghosts（幽灵）- 已实现但不完整
- ✅ Killer Plants（食人花）- 已实现但不完整
- ✅ Steampunks（蒸汽朋克）- 已实现但不完整

#### The Obligatory Cthulhu Set - 4 个派系
- ✅ Elder Things（远古物种）- 已实现但不完整
- ✅ Innsmouth（印斯茅斯）- 已实现但不完整
- ✅ Minions of Cthulhu（克苏鲁仆从）- 已实现但不完整
- ✅ Miskatonic University（米斯卡塔尼克）- 已实现但不完整

#### Science Fiction Double Feature - 4 个派系
- ❌ Cyborg Apes（机械猿）- 未实现
- ❌ Shapeshifters（变形者）- 未实现
- ❌ Super Spies（超级间谍）- 未实现
- ❌ Time Travelers（时间旅行者）- 未实现

#### Monster Smash - 4 个派系
- ✅ Giant Ants（巨蚁）- 已实现但不完整
- ❌ Mad Scientists（疯狂科学家）- 未实现
- ✅ Vampires（吸血鬼）- 已实现但不完整
- ✅ Werewolves（狼人）- 已实现但不完整

#### Pretty Pretty Smash Up - 4 个派系
- ❌ Fairies（仙女）- 未实现
- ❌ Kitty Cats（小猫咪）- 未实现
- ❌ Mythic Horses（神话马）- 未实现
- ❌ Princesses（公主）- 未实现

#### Smash Up: Munchkin - 8 个派系
- ❌ Clerics（牧师）- 未实现
- ❌ Dwarves（矮人）- 未实现
- ❌ Elves（精灵）- 未实现
- ❌ Halflings（半身人）- 未实现
- ❌ Mages（法师）- 未实现
- ❌ Orcs（兽人）- 未实现
- ❌ Thieves（盗贼）- 未实现
- ❌ Warriors（战士）- 未实现

#### It's Your Fault! - 5 个派系
- ❌ Dragons（龙）- 未实现
- ❌ Mythic Greeks（神话希腊）- 未实现
- ❌ Sharks（鲨鱼）- 未实现
- ❌ Superheroes（超级英雄）- 未实现
- ❌ Tornados（龙卷风）- 未实现

#### Cease and Desist - 4 个派系
- ❌ Astroknights（星际骑士）- 未实现
- ❌ Changerbots（变形机器人）- 未实现
- ❌ Ignobles（卑鄙者）- 未实现
- ❌ Star Roamers（星际漫游者）- 未实现

#### What Were We Thinking? - 4 个派系
- ❌ Explorers（探险家）- 未实现
- ❌ Grannies（奶奶）- 未实现
- ❌ Rock Stars（摇滚明星）- 未实现
- ❌ Teddy Bears（泰迪熊）- 未实现

#### Big in Japan - 4 个派系
- ❌ Itty Critters（小动物）- 未实现
- ❌ Kaiju（怪兽）- 未实现
- ❌ Magical Girls（魔法少女）- 未实现
- ❌ Mega Troopers（超级战士）- 未实现

#### That '70s Expansion - 4 个派系
- ❌ Disco Dancers（迪斯科舞者）- 未实现
- ❌ Kung Fu Fighters（功夫战士）- 未实现
- ❌ Truckers（卡车司机）- 未实现
- ❌ Vigilantes（义警）- 未实现

#### The Bigger Geekier Box - 2 个派系
- ❌ Geeks（极客）- 未实现
- ❌ Smash Up All Stars（全明星）- 未实现

#### Oops, You Did It Again - 4 个派系
- ❌ Ancient Egyptians（古埃及人）- 未实现
- ❌ Cowboys（牛仔）- 未实现
- ❌ Samurai（武士）- 未实现
- ❌ Vikings（维京人）- 未实现

#### World Tour: International Incident - 4 个派系
- ❌ Luchadors（摔跤手）- 未实现
- ❌ Mounties（骑警）- 未实现
- ❌ Musketeers（火枪手）- 未实现
- ❌ Sumo Wrestlers（相扑手）- 未实现

#### World Tour: Culture Shock - 5 个派系
- ❌ Anansi Tales（阿南西传说）- 未实现
- ❌ Ancient Incas（古印加人）- 未实现
- ❌ Grimms' Fairy Tales（格林童话）- 未实现
- ❌ Polynesian Voyagers（波利尼西亚航海者）- 未实现
- ❌ Russian Fairy Tales（俄罗斯童话）- 未实现

#### Smash Up: Marvel - 8 个派系
- ❌ Avengers（复仇者）- 未实现
- ❌ Hydra（九头蛇）- 未实现
- ❌ Kree（克里人）- 未实现
- ❌ Masters of Evil（邪恶大师）- 未实现
- ❌ S.H.I.E.L.D.（神盾局）- 未实现
- ❌ Sinister Six（险恶六人组）- 未实现
- ❌ Spider-Verse（蜘蛛宇宙）- 未实现
- ❌ Ultimates（终极战队）- 未实现

#### Smash Up: Disney Edition - 8 个派系
- ❌ Aladdin（阿拉丁）- 未实现
- ❌ Beauty and the Beast（美女与野兽）- 未实现
- ❌ Big Hero 6（超能陆战队）- 未实现
- ❌ Frozen（冰雪奇缘）- 未实现
- ❌ Mulan（花木兰）- 未实现
- ❌ The Lion King（狮子王）- 未实现
- ❌ The Nightmare Before Christmas（圣诞夜惊魂）- 未实现
- ❌ Wreck-It Ralph（无敌破坏王）- 未实现

#### 其他扩展（促销/特殊版）
- ❌ Goblins（哥布林）- 未实现
- ❌ Knights of the Round Table（圆桌骑士）- 未实现
- ❌ Penguins（企鹅）- 未实现
- ❌ Sheep（绵羊）- 未实现
- ❌ Mermaids（美人鱼）- 未实现
- ❌ Skeletons（骷髅）- 未实现
- ❌ World Champs（世界冠军）- 未实现
- ❌ Action Heroes（动作英雄）- 未实现
- ❌ Backtimers（回到过去）- 未实现
- ❌ Extramorphs（异形）- 未实现
- ❌ Wraithrustlers（幽灵摔跤手）- 未实现
- ❌ Teens（青少年）- 未实现
- ❌ Adolescent Epic Geckos（青春史诗壁虎）- 未实现
- ❌ G.I. Gerald（特种兵杰拉德）- 未实现
- ❌ Pearl and the Images（珍珠与影像）- 未实现
- ❌ Rulers of the Cosmos（宇宙统治者）- 未实现
- ❌ Slashers（杀人狂）- 未实现
- ❌ Clowns（小丑）- 未实现

## 🎯 建议行动

### ✅ 已完成：核心版 + 3 个扩展（20 个派系）

项目已完整实现以下内容：
- ✅ **核心版（Core Set）**：8 个派系，每个 20 张卡
- ✅ **Awesome Level 9000**：4 个派系，每个 20 张卡
- ✅ **The Obligatory Cthulhu Set**：4 个派系 + 30 张疯狂卡
- ✅ **Monster Smash（部分）**：4 个派系（巨蚁、科学怪人、吸血鬼、狼人）

### 优先级 1：补全 Monster Smash 扩展
Monster Smash 还缺 1 个派系未实现：
- ❌ Mad Scientists（疯狂科学家）- 注意：`frankenstein.ts` 可能是科学怪人，不是疯狂科学家

### 优先级 2：新增热门扩展
根据玩家社区反馈和游戏完整性，建议按以下顺序新增：
1. **Science Fiction Double Feature**（4 个派系）- 科幻主题，与核心版互补
2. **Pretty Pretty Smash Up**（4 个派系）- 独特的童话/可爱主题
3. **It's Your Fault!**（5 个派系）- 社区投票产生的扩展
4. **Big in Japan**（4 个派系）- 日本动漫主题，受欢迎度高

### 优先级 3：Munchkin 联动扩展
**Smash Up: Munchkin**（8 个派系）- 与桌游 Munchkin 的联动扩展，机制独特

## 📝 数据来源

- Wiki 链接：https://smashup.fandom.com/wiki/Category:Factions
- 项目代码：`src/games/smashup/data/factions/`
- 统计时间：2026-02-28

## 🔍 核对方法

```powershell
# 统计每个派系文件的卡牌定义数和实际卡牌总数
Get-ChildItem -Path "src/games/smashup/data/factions/*.ts" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # 提取所有 count 字段的值并求和
    $counts = [regex]::Matches($content, "count:\s*(\d+)") | ForEach-Object { [int]$_.Groups[1].Value }
    $totalCards = ($counts | Measure-Object -Sum).Sum
    
    # 统计卡牌定义数量（不含 count）
    $cardDefs = ([regex]::Matches($content, "{\s*id:\s*'[^']+',\s*type:\s*'(minion|action)'")).Count
    
    [PSCustomObject]@{
        File = $_.Name
        CardDefs = $cardDefs
        TotalCards = if ($totalCards) { $totalCards } else { 0 }
    }
}
```

**验证示例**：
- **忍者派系**：12 个定义（4 种随从 + 8 种行动），通过 `count` 字段总计 20 张卡
  - 忍者大师 (count: 1) + 猛虎刺客 (count: 2) + 影舞者 (count: 3) + 忍者侍从 (count: 4) = 10 张随从
  - 8 种行动卡，各 count: 1 或 2，总计 10 张行动
- **印斯茅斯派系**：9 个定义（1 种随从 + 8 种行动），通过 `count` 字段总计 20 张卡
  - 本地人 (count: 10) = 10 张随从
  - 8 种行动卡，各 count: 1 或 2，总计 10 张行动

## ⚠️ 注意事项与发现

### 1. 疯狂卡（Madness）
- 这是克苏鲁扩展的特殊机制卡牌，不属于常规派系
- 共 30 张相同的卡牌，形成独立的"疯狂牌库"
- 游戏规则：每 2 张疯狂卡扣除 1 VP（向下取整）

### 2. 卡牌数量统计方法
- 每个卡牌定义包含 `count` 字段，表示该卡在派系中的数量
- 例如：`{ id: 'pirate_dinghy', count: 2 }` 表示该派系有 2 张"小船"卡
- 统计方法：累加所有 `count` 字段的值

### 3. 派系命名差异
- 代码中 `cthulhu.ts` 对应 Wiki 的 `Minions of Cthulhu`（克苏鲁仆从）✅
- 代码中 `frankenstein.ts` 在 Wiki 中未找到对应派系 ⚠️
  - 可能是 `Mad Scientists`（疯狂科学家）的别名
  - 或者是自定义内容/未发布扩展
  - 需要进一步确认

### 4. 特殊派系结构（根据 Wiki 验证）

#### 机器人（Robots）- Wiki 明确说明
- **Wiki 标准**：18 随从 + 2 行动（总力量 38，平均 2.11）
- **项目实现**：9 种随从定义（通过 `count` 总计 18 张）+ 1 种行动（`count: 2`）✅
- **验证结果**：完全符合 Wiki 描述

#### 印斯茅斯（Innsmouth）- Wiki 明确说明
- **Wiki 标准**：10 随从（全部力量 2）+ 10 行动（总力量 20，平均 2）
- **项目实现**：1 种随从"本地人"（`count: 10`，力量 2）+ 8 种行动（通过 `count` 总计 10 张）✅
- **验证结果**：完全符合 Wiki 描述的"多张同名随从"机制

#### 其他派系
- **标准结构**：10 随从 + 10 行动（总力量 30，平均 3）
- 项目中的忍者、海盗、外星人等派系均符合此标准 ✅

### 5. 未来扩展
Wiki 显示截至 2026 年共有 106 个派系，项目当前已实现 20 个（约 19%）。
