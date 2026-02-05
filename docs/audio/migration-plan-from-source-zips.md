# 音频迁移清单（基于 音效列表_完整.md）

> 说明：本清单仅基于 `BordGameAsset/SoundEffect/音效列表_完整.md` 中的 `_source_zips` 目录进行归纳。
> 规则是“剔除桌游明显用不到 + 去重”，**先全量迁移，后续再删减**。

## 迁移规则
- **保留**：怪物、魔法、战斗、牌/骰/棋、UI、通用交互、谜题、状态、蒸汽朋克、生存/环境、枪械等音效。
- **排除**：明显与桌游无关的现代交通/体育类音效；预览文件；`__MACOSX/._`。
- **去重**：同路径同文件名只保留一次（例如同一条目重复列出）。
- **分类存放**：按类别归档（卡牌/骰子/战斗/魔法/怪物/UI/环境/枪械等），便于 UGC 预览工具按类筛选。
- **子级保留素材包名**：分类目录下保留素材包/原始子目录作为末级子目录，避免同名覆盖。
- **Coin/Token 区分**：音效包中的 `Coins` 多为“硬币/宝箱/奖励”，归入 **coins**；仅当声音是“棋子/代币/放置/移动”的物理触感，才归入 **token**。
- **桌游 Buff/状态**：如 DiceThrone 的 Buff/状态反馈，优先使用 **魔法/增益** 类音效，而非 token 类。

## 目标目录结构（分类 + 多级）
> 根目录：`public/assets/common/audio`
- `bgm/`
  - `ethereal/` `fantasy/` `funk/` `general/`
- `sfx/`
  - `cards/` → `loops/` `handling/` `shuffle/` `fx/`
  - `dice/` → `roll/` `handling/` `pouch/` `general/`
  - `coins/` → `drop/` `reward/` `pouch/` `treasure/` `general/`
  - `token/` → `move/` `place/` `drop/` `box/` `handle/` `general/`
  - `combat/` → `melee/` `impact/` `whoosh/` `general/`
  - `gun/` → `fire/` `reload/` `impact/`
  - `magic/` → `fire/` `water/` `lightning/` `ice/` `poison/` `dark/` `rock/` `wind/` `general/`
  - `monster/` → `attack/` `death/` `shout/` `growl/` `breath/` `movement/` `footstep/` `general/`
  - `ui/` → `click/` `select/` `confirm/` `cancel/` `notify/` `general/`
  - `status/` → `buff/` `debuff/` `state/` `general/`
  - `system/` → `celebrate/` `general/`
  - `puzzle/`
  - `ambient/`
  - `cyberpunk/`
  - `fantasy/`
  - `steampunk/`
  - `foley/` → `object/` `object/footstep/` `build/` `write/` `swoosh/` `general/`
  - `voice/`
  - `stinger/`

## 当前清理结果（已压缩）
- 删除 foley/voice 后剩余 **6965 files / 387.78MB**（见 `docs/audio/compressed-stats.txt`）
- UGC 上传仅保存**压缩变体**（若上传本身已是压缩格式，则直接作为变体保存）

## 源路径 → 目标分类映射（摘要）
### _source_zips
- `music/*` → `bgm/*`
- `sfx/cards/Decks and Cards Sound FX Pack/Background Loops/*` → `sfx/cards/loops/`
- `sfx/cards/Decks and Cards Sound FX Pack/Cards/*` → `sfx/cards/handling/`
- `sfx/cards/Decks and Cards Sound FX Pack/Cards Shuffle*` → `sfx/cards/shuffle/`
- `sfx/cards/Decks and Cards Sound FX Pack/FX/*`、`FX/Looped/*` → **`sfx/cards/fx/`（卡牌特效）**
- `sfx/cards/Decks and Cards Sound FX Pack/Dice/*` → `sfx/dice/`（按文件名再细分 roll/handling/pouch）
- `sfx/cards/Decks and Cards Sound FX Pack/Coins/*` → `sfx/coins/`
- `sfx/cards/Decks and Cards Sound FX Pack/Token and Piece/*` → `sfx/token/`
- `sfx/magic/*` → `sfx/magic/<元素>/<动作>`（如 Fire_Hit → magic/fire/hit；无法解析则进 `magic/general`）
- `sfx/monsters/*` → `sfx/monster/<动作>`（attack/death/shout/growl/breath/movement/footstep）
- `sfx/combat/*` → `sfx/combat/`
- `sfx/player_status/*` → `sfx/status/`
- `sfx/puzzle/*` → `sfx/puzzle/`
- `sfx/survival/*` → `sfx/ambient/`
- `sfx/cyberpunk/*` → `sfx/cyberpunk/`
- `sfx/fantasy/*` → `sfx/fantasy/`
- `sfx/steampunk/*` → `sfx/steampunk/`
- `sfx/ui/*` → `sfx/ui/`

### Mini Games Sound Effects and Music Pack
- `AUDIO/MUSIC-STINGER/*` → `sfx/stinger/`
- `AUDIO/SFX/Battle-Combat-Fight/*` → `sfx/combat/`
- `AUDIO/SFX/Card and Board Games/*` → `sfx/cards/handling/`
- `AUDIO/SFX/UI/*` → `sfx/ui/`
- `AUDIO/SFX/Object Hit-Pick up-Drop-Collect/*` → `sfx/foley/object/`
- `AUDIO/SFX/Footstep-Jump/*` → `sfx/foley/object/`（脚步类）
- `AUDIO/SFX/Build-Collapse/*` → `sfx/foley/build/`
- `AUDIO/SFX/Write-Draw-Paint-Erase/*` → `sfx/foley/write/`
- `AUDIO/SFX/Generic Swoosh/*` → `sfx/foley/swoosh/`
- `AUDIO/SFX/Pop/*` → `sfx/ui/`
- `AUDIO/SFX/Voice/*` → `sfx/voice/`

## 当前体积估算（原始文件，未压缩）
- 统计范围：`_source_zips` + `Mini Games Sound Effects and Music Pack`；排除 `__MACOSX/._`、`Preview`、车辆/体育/直升机。
- `_source_zips`：**6776** 个文件，**17099.99 MB**。
- `mini-games`：**7161** 个文件，**17334.08 MB**。
- 合计：**13937** 个文件，**34434.07 MB**（约 **34.43 GB**）。
- 说明：为原始素材体积；后续转为 ogg（128kb）会显著下降，需要单独估算。

## 二次筛选（桌游常用/必要）保留清单（美式桌游）
> 目标：保留桌游“常用/必要”音效；相似功能只保留一个“主套”，但该套的编号变体（001-005 等）完整保留。

### 去重规则（功能维度）
- **功能相似去重**：同一“动作功能”只保留一套（命名最中性 + 编号最完整）。
- **变体保留**：保留该套内的所有编号变体（如 001-005）。
- **功能差异保留**：明确功能差异的动作保留多套（例如单骰 vs 多骰；attack vs shout vs hurt vs death）。

### 必留（核心）
- `sfx/cards/handling/`：放置/拿取/滚动/卡盒（保留一套）
- `sfx/cards/shuffle/`：洗牌（保留一套）
- `sfx/cards/fx/`：卡牌特效（保留一套）
- `sfx/dice/roll/`：单骰 + 多骰（各保留一套）
- `sfx/dice/handling/`：骰子手感（保留一套）
- `sfx/dice/pouch/`：骰袋（保留一套）
- `sfx/token/`：move/place/drop/box/handle（各保留一套）
- `sfx/coins/`：drop/reward/pouch/treasure（各保留一套）
- `sfx/ui/`：click/select/confirm/cancel/notify（各保留一套）
- `sfx/status/`：buff/debuff/state（各保留一套）

### 必留（美式桌游：魔法 + 怪物）
- `sfx/magic/`：**完整保留**；元素保留常见类别（fire/water/lightning/ice/poison/dark/wind/rock/general）
  - 动作：cast/spell/hit/whoosh/buff/debuff/aura（同元素内只保留一套）
- `sfx/monster/`：**保留 attack + shout + hurt + death**（各保留一套，编号变体全留）

### 可选（按项目需要）
- `sfx/combat/`：melee/impact/whoosh（保留一套即可）
- `sfx/gun/`：fire/reload/impact（仅科幻题材）
- `bgm/`：可选，若保留建议只选 1-2 个风格包
- `sfx/foley/`：脚步/环境拟音默认可选
- `sfx/ambient/`、`sfx/voice/`、`sfx/stinger/`、`sfx/puzzle/`、`sfx/steampunk/`、`sfx/cyberpunk/`、`sfx/fantasy/`

## 二次筛选体积估值（粗略）
> 说明：尚未按上面的规则执行脚本统计，以下为**粗略区间**。
- **保留核心 + 魔法 + 怪物（含 hurt/death）**：约 **35%~45%** 的原始体积
  - 估算：**12~16 GB（原始）**
  - 若转为 ogg 128kb：约 **1.1~1.5 GB**
- 若 **BGM 全量保留**，体积可能 **显著上浮**；建议只保留 1-2 个风格包

## 排除清单（不迁移）
### _source_zips 过滤
- `**/__MACOSX/**`
- `**/._*`

### Mini Games Sound Effects and Music Pack
- `. | Music Preview;Sound Effects Preview`
- `AUDIO/SFX/Engine-Car/*`
- `AUDIO/SFX/Helicopter`
- `AUDIO/SFX/Sports/*`

---

## 迁移清单（计划迁移）

> 以下条目按 `音效列表_完整.md` 原始目录结构整理。

### _source_zips/music
- `music/ethereal/Ethereal Music Pack/*`
- `music/fantasy/Fantasy Music Pack Vol. 5/*`
- `music/funk/Funk Music Pack/*`
- `music/general/Casual Music Pack Vol. 1/*`

### _source_zips/sfx/cards
- `sfx/cards/Decks and Cards Sound FX Pack/Background Loops | Abstract Drone Bellish Loop;Abstract Drone Charm Loop;Abstract Drone Dark Loop;Abstract Drone Hollow Loop;Abstract Drone Mystic Loop`
- `sfx/cards/Decks and Cards Sound FX Pack/Cards | Card Box Handling 001-005;Card Placing 001-008;Card Take 001-008;Cards Scrolling 001-004;Cards Shuffle Fast 001-004;Cards Shuffle Oneshot 001-005;Cards Shuffle Slow 001-003`
- `sfx/cards/Decks and Cards Sound FX Pack/Coins | Bet Placed 001-005;Big Coin Drop 001-005;Fair Reward 001-004;Gold Pouch Handle 001-004;Small Coin Drop 001-004;Small Coin Drop Long;Small Reward 001-005;Treasure Box 001-005`
- `sfx/cards/Decks and Cards Sound FX Pack/Dice | Dice Handling 001-005;Dice In Pouch 001-005;Dice Roll Velvet 001-004;Few Dice Roll 001-005;;Single Die Roll 001-005`
- `sfx/cards/Decks and Cards Sound FX Pack/FX | FX Boost 001-004;FX Deck Reassemble 001-004;FX Discard 001-004;FX Discard For Gold 001-004;FX Dispel 001-004;FX Flying Cards 001-004;FX Magic Deck 001-004`
- `sfx/cards/Decks and Cards Sound FX Pack/FX/Looped | FX Counter Cards Loop 001-002;FX Counter Crystals Loop 001-003;FX Counter Money Loop 001-003`
- `sfx/cards/Decks and Cards Sound FX Pack/Token and Piece | Move Piece Harsh 001-005;Move Piece Soft 001-004;Token Box Handling 001-003;Token Box Shake 001-005;Token Drop 001-005;Token Place Hard 001-005;Token Place Soft 001-005;Tokens Handling 001-003`

### _source_zips/sfx/combat
- `sfx/combat/Fight Fury Vol 2/*`
- `sfx/combat/Forged In Fury Vol 1/*`
- `sfx/combat/Khron Studio - Fight Fury Vol 1 ASSETS/*`

### _source_zips/sfx/cyberpunk
- `sfx/cyberpunk/Cyberpunk Sound FX Pack Vol. 1/*`
- `sfx/cyberpunk/Cyberpunk Sound FX Pack Vol. 3/*`

### _source_zips/sfx/fantasy
- `sfx/fantasy | (该行含大量魔法/武器/弓箭/元素攻击等条目，保持全量迁移)`
- `sfx/fantasy/Medieval Fantasy Sound FX Pack Vol. 2/Ambience/*`
- `sfx/fantasy/Medieval Fantasy Sound FX Pack Vol. 2/Armor/*`
- `sfx/fantasy/Medieval Fantasy Sound FX Pack Vol. 2/Items & Misc/*`
- `sfx/fantasy/Medieval Fantasy Sound FX Pack Vol. 2/Weapons/*`
- `sfx/fantasy/Medieval Fantasy Sound FX Pack Vol. 2/Whooshes/*`

### _source_zips/sfx/magic
- `sfx/magic/*`（包含 1-44 系列、Modern Magic Sound FX Pack Vol. 1、Simple Magic Sound FX Pack Vol. 1、Spells Variations Vol 1-4，全量迁移）

### _source_zips/sfx/monsters
- `sfx/monsters | (整体怪物音效条目，保持全量迁移)`
- `sfx/monsters/files/*`
- `sfx/monsters/Khron Studio - Monster Library Vol 3 ASSETS/*`
- `sfx/monsters/Khron Studio - Monster Library Vol 4 ASSETS/*`
- `sfx/monsters/Monster Library Vol. 5/*`

### _source_zips/sfx/other
- `sfx/other/Casual & Mobile Sound FX Pack Vol. 1/*`

### _source_zips/sfx/player_status
- `sfx/player_status/Player Status Sound FX Pack Vol. 3/*`
- `sfx/player_status/Player Status Sound FX Pack/*`

### _source_zips/sfx/puzzle
- `sfx/puzzle/*`

### _source_zips/sfx/steampunk
- `sfx/steampunk/Steampunk Sound FX Pack Vol. 3/*`

### _source_zips/sfx/survival
- `sfx/survival/Khron Studio - Sound Of Survival Vol 1 ASSETS/*`

### _source_zips/sfx/ui
- `sfx/ui/Khron Studio - RPG Interface Essentials - Inventory & Dialog (UCS System 192Khz)/*`
- `sfx/ui/Khron Studio - RPG Interface Essentials - Map Menu & Principal Menu (UCS System 192Khz)/*`
- `sfx/ui/Khron Studio - RPG Interface Essentials - Pop-Ups (UCS System 192Khz)/*`
- `sfx/ui/UI & Menu Sound FX Pack Vol. 2/*`

### Mini Games Sound Effects and Music Pack
- `AUDIO/MUSIC-STINGER | MUSC_Action;MUSC_Cute_Horror_Action_Loop;MUSC_Cute_Horror_Action_Loop_2;MUSC_Cute_Theme_Loop;MUSC_Puzzle_Theme_Loop;MUSC_Reaction_Theme_Loop;MUSC_Retro_Theme_Loop;MUSC_Sports_Theme_Loop`
- `AUDIO/MUSIC-STINGER/STINGER | STGR_Action_Lose;STGR_Action_Win;STGR_Lose_Cute;STGR_Lose_Cute_Horror_Action;STGR_Lose_Puzzle;STGR_Lose_Reaction;STGR_Lose_Retro;STGR_Lose_Sports;STGR_Win_Cute;STGR_Win_Cute_Horror_Action;STGR_Win_Puzzle;STGR_Win_Reaction;STGR_Win_Retro;STGR_Win_Sports`
- `AUDIO/SFX/Applause-Firework-Confetti-Explosion/*`
- `AUDIO/SFX/Battle-Combat-Fight/Body Hit | SFX_Body_Hit_Generic_*;SFX_Fight_Hit_*;SFX_Weapon_Melee_Body_Hit_Bloody_*`
- `AUDIO/SFX/Battle-Combat-Fight/Bow | SFX_Weapon_Bow_Hit_*;SFX_Weapon_Bow_Shoot_*`
- `AUDIO/SFX/Battle-Combat-Fight/Gun/Reload | SFX_Gun_Mechanic_*`
- `AUDIO/SFX/Battle-Combat-Fight/Gun/Shoot | SFX_Gun_*`
- `AUDIO/SFX/Battle-Combat-Fight/Kick-Punch | SFX_Fight_Kick_Swoosh_*;SFX_Fight_Punch_Swoosh_*`
- `AUDIO/SFX/Battle-Combat-Fight/Weapon Swoosh | SFX_Weapon_Melee_Swoosh_*`
- `AUDIO/SFX/Build-Collapse | SFX_Build_*;SFX_Collapse_*`
- `AUDIO/SFX/Card and Board Games/*`
- `AUDIO/SFX/Footstep-Jump/*`
- `AUDIO/SFX/Generic Swoosh | SFX_Swoosh_Movement_Generic_*`
- `AUDIO/SFX/Object Hit-Pick up-Drop-Collect/*`
- `AUDIO/SFX/Pop | SFX_Interact_Pop_*`
- `AUDIO/SFX/UI/*`
- `AUDIO/SFX/Voice/Stickman/*`
- `AUDIO/SFX/Voice/Tiny Monster/*`
- `AUDIO/SFX/Write-Draw-Paint-Erase/*`
