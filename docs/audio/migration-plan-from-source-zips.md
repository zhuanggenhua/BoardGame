# 音频迁移清单（基于 音效列表_完整.md）

> 说明：本清单仅基于 `BordGameAsset/SoundEffect/音效列表_完整.md` 中的 `_source_zips` 目录进行归纳。
> 规则是“剔除桌游明显用不到 + 去重”，**先全量迁移，后续再删减**。

## 迁移规则
- **保留**：怪物、魔法、战斗、牌/骰/棋、UI、通用交互、谜题、状态、蒸汽朋克、生存/环境、枪械等音效。
- **排除**：明显与桌游无关的现代交通/体育类音效；预览文件；`__MACOSX/._`。
- **去重**：同路径同文件名只保留一次（例如同一条目重复列出）。

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
- `sfx/cards/Decks and Cards Sound FX Pack/Dice | Dice Handling 001-005;Dice In Pouch 001-005;Dice Roll Velvet 001-004;Few Dice Roll 001-005;Many Dice Roll Wood 001-005;Single Die Roll 001-005`
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
