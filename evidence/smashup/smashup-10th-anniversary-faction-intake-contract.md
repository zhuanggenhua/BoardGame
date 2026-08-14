# Smash Up 10th Anniversary 三派系 intake 合同

## 任务范围

本轮目标不是单纯把图片挂进去，而是完成：

1. `Mermaids / Skeletons / World Champs` 三个派系的真相源锁定
2. 图片 atlas / base atlas 索引合同
3. 后续玩法实现与验证的交接包
4. 顺带补强“新增 Smash Up 派系”的可复用 workflow

## 真相源分工

- **本地图片**
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\cards\wangling.png`
  - `D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\base\wangling_base.png`
  - 负责：中文图面、row-major 切片顺序、图内标题、基地图面文案
- **本地 TTS/atlas 源**
  - `D:\gongzuo\webgame\BoardGame\public\assets\atlas-configs\smashup\2833984701.json`
  - 负责：canonical 英文 deck/base 名称、实际 deck 内数量、基地 breakpoint / VP 奖励
- **Smash Up Fandom**
  - `https://smashup.fandom.com/wiki/Mermaids`
  - `https://smashup.fandom.com/wiki/Skeletons`
  - `https://smashup.fandom.com/wiki/World_Champs`
  - `https://smashup.fandom.com/wiki/Bases`
  - 负责：派系卡牌清单、英文规则文本、基地英文效果文本

## 关键裁定

### 1. 本批图片对应派系

已锁定为：

- `Mermaids`
- `Skeletons`
- `World Champs`

不包含 `Sheep`。

### 2. 卡牌 atlas 网格

经本地图片复核，`wangling.png` **不是 7 x 9**，而是：

- **5 行 x 9 列**
- 总槽位：`45`
- 已使用：`44`
- 末尾空白槽位：`index 44`

> 早期肉眼误判为 `7 x 9`，原因是把竖版卡面切成了横向切片。已通过整图复核纠正。

辅助图：

- `D:\gongzuo\webgame\BoardGame\temp\wangling-grid-indexed.png`
- `D:\gongzuo\webgame\BoardGame\temp\wangling-rows.png`

### 3. 基地 atlas 网格

`wangling_base.png` 已锁定为：

- **3 行 x 2 列**
- 总槽位：`6`
- 全部使用

辅助图：

- `D:\gongzuo\webgame\BoardGame\temp\wangling-base-grid-indexed.png`

## 卡牌 atlas 索引合同（row-major）

### Mermaids

| index | 名称 | 类型 | 额外信息 |
|---|---|---|---|
| 0 | Ultimate Song | action | count 1 |
| 1 | Captive Audience | action | count 2 |
| 2 | Becalmed Shores | action | count 1 |
| 3 | Siren Song | action | count 1 |
| 4 | Toll Bay | action | count 1 |
| 5 | Shipwreck Cove | action | count 1 |
| 6 | Siren | minion | power 2, count 4 |
| 7 | Temptress | minion | power 4, count 2 |
| 8 | Charmer | minion | power 3, count 3 |
| 9 | Mermaid Queen | minion | power 5, count 1 |
| 10 | Charmed | action | count 2 |
| 11 | Desert Island | action | count 1 |

### Skeletons

| index | 名称 | 类型 | 额外信息 |
|---|---|---|---|
| 12 | Gravestones | action | count 1 |
| 13 | Burst Forth | action | count 1 |
| 14 | Dig 'em Up | action | count 1 |
| 15 | Place 'em Down | action | count 1 |
| 16 | Graveyard | action | count 1 |
| 17 | Hearse Fleet | action | count 1 |
| 18 | Lord of Bones | minion | power 5, count 1 |
| 19 | Spooky, Scary... | action | count 2 |
| 20 | Grave Goods | action | count 2 |
| 21 | Returned One | minion | power 2, count 4 |
| 22 | Revenant | minion | power 3, count 3 |
| 23 | Gravetender | minion | power 4, count 2 |

### World Champs

| index | 名称 | 类型 | 额外信息 |
|---|---|---|---|
| 24 | Rainbow Girl | minion | power 2, count 1 |
| 25 | Mummy | minion | power 2, count 1 |
| 26 | Calicoin | minion | power 2, count 1 |
| 27 | Samurai-Chan | minion | power 2, count 1 |
| 28 | Diva | minion | power 3, count 1 |
| 29 | Akye the Turtle | minion | power 3, count 1 |
| 30 | Shield Maiden | minion | power 3, count 1 |
| 31 | Stoneford | minion | power 4, count 1 |
| 32 | Aramis | minion | power 4, count 1 |
| 33 | Sheriff | minion | power 5, count 1 |
| 34 | Fighting Spirit Prize | action | count 1 |
| 35 | Smart Set-Up | action | count 1 |
| 36 | Shark Tattoo | action | count 1 |
| 37 | It's Blitzin' Time! | action | count 1 |
| 38 | Kaiju Conflict | action | count 1 |
| 39 | Eh? | action | count 1 |
| 40 | Fast as Lightning | action | count 1 |
| 41 | Bewitched | action | count 1 |
| 42 | Mouse, Bird and Sausage | action | count 1 |
| 43 | High-Speed Chase | action | count 1 |
| 44 | 空白槽位 | unused | 不得接入运行时 |

## 基地 atlas 索引合同（row-major）

| index | 名称 | faction | breakpoint | VP |
|---|---|---|---:|---|
| 0 | Mermaid Reef | Mermaids | 17 | 3 / 1 / 1 |
| 1 | Mermaid Pool | Mermaids | 23 | 4 / 2 / 1 |
| 2 | Boneyard | Skeletons | 22 | 4 / 2 / 1 |
| 3 | Ossuary | Skeletons | 20 | 3 / 2 / 1 |
| 4 | Arena | World Champs | 23 | 4 / 3 / 1 |
| 5 | Hall of Fame | World Champs | 20 | 4 / 2 / 1 |

## World Champs 复用风险裁定

### 已确认与当前仓库**同名已实现**的卡

- `Mummy` → 当前仓库已有 `Ancient Egyptians`
- `Samurai-Chan` → 当前仓库已有 `Samurai`
- `Shield Maiden` → 当前仓库已有 `Vikings`
- `Sheriff` → 当前仓库已有 `Cowboys`

### 已确认在当前仓库**没有同名现成实现**的卡

- `Rainbow Girl`
- `Calicoin`
- `Diva`
- `Akye the Turtle`
- `Stoneford`
- `Aramis`
- `Fighting Spirit Prize`
- `Smart Set-Up`
- `Shark Tattoo`
- `It's Blitzin' Time!`
- `Kaiju Conflict`
- `Eh?`
- `Fast as Lightning`
- `Bewitched`
- `Mouse, Bird and Sausage`
- `High-Speed Chase`

### 当前结论

- `World Champs` **不能**被简单当成“把现有 Oops 四派系卡复制一遍”。
- 它只对其中少数卡能直接命中当前仓库已有同名实现。
- 其余卡要么来自仓库尚未正式实现的旧派系，要么至少需要重新核对后才能决定是否能复用既有 handler。

## 后续 implementation handoff 最低输入

进入正式玩法实现前，必须以上述合同为准，并至少补齐：

1. 三派系 `faction id / atlas id / previewRef index`
2. World Champs 每张卡是“直接复用旧实现 / 复制并改名 / 全新实现”的裁定表
3. 基地能力是否已有共享抽象可复用的裁定表
4. 每个派系的测试与 evidence 最小闭环

## 当前未决项

1. `World Champs` 中各卡对应的原派系来源，需要在“玩法实施裁定表”里进一步精确落档。
2. `World Champs` 同名卡是否可以直接绑定到现有 handler，仍需逐张核对当前实现语义，而不是仅凭名字判断。
3. 本轮 workflow/skill 改造应落在：
   - `.windsurf/skills/data-entry-workflow/SKILL.md`
   - `.spec/skills/smashup-faction-intake/SKILL.md`
   - 新增 `.spec/skills/smashup-faction-implementation/SKILL.md`
   该方向已基本确定，但仍待与正式 OpenSpec proposal 对齐。
