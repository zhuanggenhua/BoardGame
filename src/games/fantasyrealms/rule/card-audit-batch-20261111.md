# 幻想国度逐卡数据与规则审计批次

对照 [App of Scoring](https://fantasy-realms.github.io/) 的牌库和中文文案，与本项目当前中文图集和数据。此表先完成牌名映射与基础分机械对比，效果原文、图面、实现和交互仍需逐张核对；参考文本可能含术语或版本差异，不能直接覆盖图面。四个历史名称差异使用显式映射。

| 本项目卡牌 ID | 参考 ID | 基础分 参考 / 当前 | 参考英文文案 | 参考简中文案 | 当前简中文案 | 图面与执行审计 |
| --- | --- | ---: | --- | --- | --- | --- |
| army-rangers | FR25 | 5 / 5 | +10 for each Land. ；CLEARS the word Army from all Penalties. | 每持有土地便+10. ；清除所有惩罚中的军队一词. | 奖励：每张土地牌和建筑牌+10分；清除你手中所有卡牌惩罚项中的“军队”字样。 | 图面已核对，执行待验证 |
| army-elven-archers | FR22 | 10 / 10 | +5 if no Weather. | 未持有任何气候则+5. | 奖励：若手中没有天象牌，+5分。 | 图面已核对，执行待验证 |
| army-dwarvish-infantry | FR24 | 15 / 15 | -2 for each other Army. | 每持有其他军队便-2. | 惩罚：每有另一张军队牌，-2分。 | 图面已核对，执行待验证 |
| army-light-cavalry | FR23 | 17 / 17 | -2 for each Land. | 每持有土地便-2. | 惩罚：每有一张土地牌，-2分。 | 图面已核对，执行待验证 |
| army-celestial-knights | FR21 | 20 / 20 | -8 unless with at least one Leader. | 未持有领袖则-8. | 惩罚：若手中没有至少一张领袖牌，-8分。 | 图面已核对，执行待验证 |
| artifact-protection-rune | FR50 | 1 / 1 | CLEARS the Penalty on all cards. | 清除所有卡牌的惩罚. | 清除你手中所有卡牌的惩罚项。 | 图面已核对，执行待验证 |
| artifact-world-tree | FR48 | 2 / 2 | +50 if every non-BLANKED card is a different suit. | 如所有未被封阻的手牌皆属于不同类别则+50. | 奖励：若手中所有生效牌的花色都不同，+70分。 | 图面已核对，执行待验证 |
| artifact-book-of-changes | FR49 | 3 / 3 | You may change the suit of one other card. Its name, bonuses and penalties remain the same.；Pick a suit and a target card from your hand. | 可改变另一张手牌的类别，名称、奖励和惩罚则维持不变.；选择你的一张手牌和要改变的类别. | 奖励：你可以改变另一张牌的花色；其名称、奖励与惩罚保持不变。 | 图面已核对，执行待验证 |
| artifact-shield-of-keth | FR46 | 4 / 4 | +15 with any one Leader. ；OR +40 with both Leader and Sword of Keth. | 持有领袖则+15. ；持有领袖和基夫之剑则+40. | 奖励：与任意一张领袖牌同在时+15分；若同时有领袖牌和凯斯之剑则+40分。 | 图面已核对，执行待验证 |
| artifact-gem-of-order | FR47 | 5 / 5 | +10 for 3-card run, +30 for 4-card run, +60 for 5-card run, +100 for 6-card run, +150 for 7-card run. ；(This refers to the base strength numbers.) | 如持有基本战力呈序列（连续数字）的卡牌达以下数量：5张则+60；6张则+100；7张则+150. | 奖励：3张顺子+10分，4张顺子+30分，5张顺子+60分，6张顺子+100分，7张顺子+150分。 | 图面已核对，执行待验证 |
| beast-warhorse | FR38 | 6 / 6 | +14 with any Leader or Wizard. | 持有任何领袖/法师则+14. | 奖励：每张生效的领袖牌和法师牌各+14分。 | 图面已核对，执行待验证 |
| beast-unicorn | FR36 | 9 / 9 | +30 with Princess. ；OR +15 with Empress, Queen, or Enchantress. | 持有公主则+30. ；持有女帝/皇后/结界巫女则+15. | 奖励：与公主同在时+30分；与女皇、王后或女巫同在时+15分。 | 图面已核对，执行待验证 |
| beast-hydra | FR40 | 12 / 12 | +28 with Swamp. | 持有沼泽则+28. | 奖励：与沼泽同在时+28分。 | 图面已核对，执行待验证 |
| beast-dragon | FR39 | 30 / 30 | -40 unless with at least one Wizard. | 未持有法师则-40. | 惩罚：若手中没有至少一张法师牌，-40分。 | 图面已核对，执行待验证 |
| beast-basilisk | FR37 | 35 / 35 | BLANKS all Armies, Leaders, and other Beasts. | 封阻所有军队、领袖和其他猛兽. | 惩罚：无效化所有军队牌、领袖牌以及其他巨兽牌。 | 图面已核对，执行待验证 |
| flame-candle | FR17 | 2 / 2 | +100 with Book of Changes, Bell Tower, and any one Wizard. | 持有易经、钟楼和任何法师则+100. | 奖励：与变化之书、钟塔以及任意一张法师牌同在时+100分。 | 图面已核对，执行待验证 |
| flame-fire-elemental | FR20 | 4 / 4 | +15 for each other Flame. | 每持有其他烈火便+15. | 奖励：每有另一张烈焰牌，+15分。 | 图面已核对，执行待验证 |
| flame-forge | FR18 | 9 / 9 | +9 for each Weapon and Artifact. | 每持有兵器、文物便+9. | 奖励：每张武器牌和神器牌+9分。 | 图面已核对，执行待验证 |
| flame-lightning | FR19 | 11 / 11 | +30 with Rainstorm. | 持有暴雨则+30. | 奖励：与暴风雨同在时+30分。 | 图面已核对，执行待验证 |
| flame-wildfire | FR16 | 40 / 40 | BLANKS all cards except Flames, Wizards, Weather, Weapons, Artifacts, Mountain, Great Flood, Island, Unicorn and Dragon. | 封阻所有卡牌，除了烈火、法师、气候、兵器、文物、高山、大洪水、岛屿、独角兽和巨龙. | 无效化除烈焰、天象、法师、武器、神器、大洪水、岛屿、山脉、独角兽与巨龙外的所有牌。 | 图面已核对，执行待验证 |
| flood-fountain-of-life | FR06 | 1 / 1 | Add the base strength of any one Weapon, Flood, Flame, Land or Weather in your hand. | 将任何一张兵器/洪水/烈火/土地/气候的基本战力添加到此卡牌. | 奖励：将你手中任意一张建筑牌、武器牌、洪流牌、烈焰牌、土地牌或天象牌的基础分加入此牌。 | 图面已核对，执行待验证 |
| flood-water-elemental | FR10 | 4 / 4 | +15 for each other Flood. | 每持有其他洪水便+15. | 奖励：每有另一张洪流牌，+15分。 | 图面已核对，执行待验证 |
| flood-island | FR09 | 14 / 14 | CLEARS the Penalty on any one Flood or Flame.；Pick a Flood or Flame from your hand to clear. | 清除任何一张洪水/烈火的惩罚.；从你的手牌中选一张洪水或烈火清除. | 清除任意一张洪流牌或烈焰牌的惩罚项。 | 图面已核对，执行待验证 |
| flood-swamp | FR07 | 18 / 18 | -3 for each Army and Flame. | 每持有军队/烈火便-3. | 惩罚：每张军队牌和烈焰牌-3分。 | 图面已核对，执行待验证 |
| flood-great-flood | FR08 | 32 / 32 | BLANKS all Armies, all Lands except Mountain, and all Flames except Lightning. | 封阻所有军队、土地和烈火（高山和雷电除外）. | 惩罚：无效化所有军队牌、所有建筑牌、除山脉外的所有土地牌，以及除闪电外的所有烈焰牌。 | 图面已核对，执行待验证 |
| land-earth-elemental | FR05 | 4 / 4 | +15 for each other Land. | 每持有其他土地便+15. | 奖励：每有另一张土地牌，+15分。 | 图面已核对，执行待验证 |
| land-underground-caverns | FR02 | 6 / 6 | +25 with Dwarvish Infantry or Dragon. ；CLEARS the Penalty on all Weather. | 持有矮人兵团/巨龙则+25. ；清除所有气候的惩罚. | 奖励：与矮人步兵或巨龙同在时+25分；清除所有天象牌的惩罚项。 | 图面已核对，执行待验证 |
| land-forest | FR04 | 7 / 7 | +12 for each Beast and Elven Archers. | 每持有猛兽/精灵射手便+12. | 奖励：每张巨兽牌以及精灵射手+12分。 | 图面已核对，执行待验证 |
| land-bell-tower | FR03 | 8 / 8 | +15 with any one Wizard. | 持有任何法师则+15. | 奖励：与任意一张法师牌或不死族牌同在时+15分。 | 图面已核对，执行待验证 |
| land-mountain | FR01 | 9 / 9 | +50 with both Smoke and Wildfire. ；CLEARS the Penalty on all Floods. | 持有烟雾 和野火则+50. ；清除所有洪水的惩罚. | 奖励：若同时有烟雾与野火，+50分；清除所有洪流牌的惩罚项。 | 图面已核对，执行待验证 |
| leader-princess | FR33 | 2 / 2 | +8 for each Army, Wizard, and other Leader. | 每持有军队/法师/其他领袖便+8. | 奖励：每张军队牌、法师牌和其他领袖牌+8分。 | 图面已核对，执行待验证 |
| leader-warlord | FR34 | 4 / 4 | The sum of the base strength of all Armies. | 所有军队的基本战力总和. | 奖励：等于你手中所有军队牌基础分的总和。 | 图面已核对，执行待验证 |
| leader-queen | FR32 | 6 / 6 | +5 for each Army. ；OR +20 for each Army if with King. | 每持有军队便+5. ；持有国王时，每持有军队便+20. | 奖励：每张军队牌+5分；若与国王同在，则每张军队牌改为+20分。 | 图面已核对，执行待验证 |
| leader-king | FR31 | 8 / 8 | +5 for each Army. ；OR +20 for each Army if with Queen. | 每持有军队便+5. ；持有皇后时，每持有军队便+20. | 奖励：每张军队牌+5分；若与王后同在，则每张军队牌改为+20分。 | 图面已核对，执行待验证 |
| leader-empress | FR35 | 15 / 15 | +10 for each Army.；-5 for each other Leader. | 每持有军队便+10.；每持有其他领袖便-5. | 奖励：每张军队牌+10分；惩罚：每有另一张领袖牌，-5分。 | 图面已核对，执行待验证 |
| weapon-magic-wand | FR42 | 1 / 1 | +25 with any one Wizard. | 持有法师则+25. | 奖励：与任意一张法师牌同在时+25分。 | 图面已核对，执行待验证 |
| weapon-elven-longbow | FR44 | 3 / 3 | +30 with Elven Archers, Warlord or Beastmaster. | 持有精灵射手/军阀/驯兽师则+30. | 奖励：与精灵射手、军阀或兽王同在时+30分。 | 图面已核对，执行待验证 |
| weapon-sword-of-keth | FR43 | 7 / 7 | +10 with any one Leader. ；OR +40 with both Leader and Shield of Keth. | 持有领袖则+10. ；持有领袖和基夫之盾则+40. | 奖励：与任意一张领袖牌同在时+10分；若同时有领袖牌和凯斯之盾则+40分。 | 图面已核对，执行待验证 |
| weapon-warship | FR41 | 23 / 23 | CLEARS the word Army from all Penalties of all Floods.；BLANKED unless with at least one Flood. | 清除所有洪水惩罚中的军队一词.；未持有洪水则被封阻. | 惩罚：若手中没有至少一张洪流牌，此牌无效；清除所有洪流牌惩罚项中的“军队”字样。 | 图面已核对，执行待验证 |
| weapon-war-dirigible | FR45 | 35 / 35 | BLANKED unless with at least one Army. ；BLANKED with any Weather. | 未持有军队或持有气候则被封阻. | 惩罚：若手中没有至少一张军队牌，此牌无效；若手中有任意天象牌，此牌也无效。 | 图面已核对，执行待验证 |
| weather-air-elemental | FR15 | 4 / 4 | +15 for each other Weather. | 每持有其他气候便+15. | 奖励：每有另一张天象牌，+15分。 | 图面已核对，执行待验证 |
| weather-rainstorm | FR11 | 8 / 8 | +10 for each Flood.；BLANKS all Flames except Lightning. | 每持有洪水便+10.；封阻所有烈火（雷电除外）. | 奖励：每张洪流牌+10分；惩罚：无效化除闪电外的所有烈焰牌。 | 图面已核对，执行待验证 |
| weather-whirlwind | FR14 | 13 / 13 | +40 with Rainstorm and either Blizzard or Great Flood. | 持有暴雨和暴雪/大洪水则+40. | 奖励：若同时有暴风雨以及暴雪或大洪水之一，+40分。 | 图面已核对，执行待验证 |
| weather-smoke | FR13 | 27 / 27 | This card is BLANKED unless with at least one Flame. | 未持有烈火则被封阻. | 惩罚：若手中没有至少一张烈焰牌，此牌无效。 | 图面已核对，执行待验证 |
| weather-blizzard | FR12 | 30 / 30 | BLANKS all Floods. ；-5 for each Army, Leader, Beast, and Flame. | 封阻所有洪水. ；每持有军队/领袖/猛兽/烈火便-5. | 惩罚：无效化所有洪流牌；每张军队牌、领袖牌、巨兽牌和烈焰牌-5分。 | 图面已核对，执行待验证 |
| wild-shapeshifter | FR51 | 0 / 0 | Shapeshifter may duplicate the name and suit of any one Artifact, Leader, Wizard, Weapon or Beast in the game. ；Does not take the bonus, penalty, or base strength of the card duplicated.；Pick a target card to duplicate. | 可复制游戏内任何一张以下类别卡牌的名称和类别：文物/领袖/法师/兵器/猛兽. ；不会复制奖励、惩罚和基本战力.；选择一张卡牌复制. | 可视为任意一张神器牌、领袖牌、法师牌、武器牌、巨兽牌或不死族牌的名称与花色；不复制其基础分、奖励或惩罚。 | 图面已核对，执行待验证 |
| wild-mirage | FR52 | 0 / 0 | Mirage may duplicate the name and suit of any one Army, Land, Weather, Flood or Flame in the game. ；Does not take the bonus, penalty, or base strength of the card duplicated.；Pick a target card to duplicate. | 可复制游戏内任何一张以下类别卡牌的名称和类别：军队/土地/气候/洪水/烈火. ；不会复制奖励、惩罚和基本战力.；选择一张卡牌复制. | 可视为任意一张军队牌、建筑牌、土地牌、天象牌、洪流牌或烈焰牌的名称与花色；不复制其基础分、奖励或惩罚。 | 图面已核对，执行待验证 |
| wild-doppelganger | FR53 | 0 / 0 | Doppelgänger may duplicate the name, base strength, suit, and penalty BUT NOT BONUS of any one other card in your hand.；Pick a card from your hand to duplicate. | 可复制另一张手牌的名称、基本战力、类别和惩罚（奖励除外）；选择一张手牌复制. | 可复制你手中任意另一张牌的名称、花色、基础分与惩罚，但不复制奖励。 | 图面已核对，执行待验证 |
| wizard-necromancer | FR28 | 3 / 3 | At the end of the game, you may take one Army, Leader, Wizard, or Beast from the discard pile and add it to your hand. | 游戏结束时,可从弃牌区选取一张军队/领袖/法师/猛兽，成为第8张手牌. | 奖励：游戏结束时，你可以从弃牌区选择1张军队、领袖、法师、巨兽或不死族牌加入手牌。你的不死族牌不会被无效化。 | 图面已核对，执行待验证 |
| wizard-elemental-enchantress | FR30 | 5 / 5 | +5 for each Land, Weather, Flood, and Flame. | 每持有土地/气候/洪水/烈火便+5. | 奖励：每张土地牌、天象牌、洪流牌和烈焰牌+5分。 | 图面已核对，执行待验证 |
| wizard-collector | FR26 | 7 / 7 | +10 if three different cards in same suit, +40 if four different cards in same suit, +100 if five different cards in same suit. | 如持有同类别而不同名称的卡牌达以下数量：3张则+10；4张则+40；5张则+100. | 奖励：若同一花色中有3张不同牌，+10分；4张不同牌+40分；5张不同牌+100分。 | 图面已核对，执行待验证 |
| wizard-beastmaster | FR27 | 9 / 9 | +9 for each Beast. ；CLEARS the Penalty on all Beasts. | 每持有猛兽便+9. ；清除所有猛兽的惩罚. | 奖励：每张巨兽牌+9分；清除所有巨兽牌的惩罚项。 | 图面已核对，执行待验证 |
| wizard-warlock-lord | FR29 | 25 / 25 | -10 for each Leader and other Wizard. | 每持有领袖/其他法师便-10. | 惩罚：每张领袖牌和其他法师牌-10分。 | 图面已核对，执行待验证 |
| building-dungeon | CH01 | 7 / 7 | +10 each for the first Undead, Beast, and Artifact. ；+5 for each additional card in any of these suits and Necromancer, Warlock Lord, Demon. | 每持有第一张不死族，猛兽和文物则+10. ；每持有上述类别的额外卡牌或死灵术士、魔导师、恶魔则+5. | 奖励：首张不死族、巨兽、神器牌各+10分；各类后续牌以及死灵术士、术士领主、魔鬼各+5分。 | 图面已核对，执行待验证 |
| building-castle | CH02 | 10 / 10 | +10 for the first Leader, Army, Land, and other Building. ；+5 for each additional Building. | 每持有第一张领袖、军队、土地和其他建筑则+10. ；每持有额外建筑则+5. | 奖励：首张领袖、军队、土地和其他建筑牌各+10分；每张额外建筑牌+5分。 | 图面已核对，执行待验证 |
| building-crypt | CH03 | 21 / 21 | The sum of the base strength of all Undead.；BLANKs all Leaders. | 所有不死族的基本战力总和.；封阻所有领袖. | 奖励：你的所有不死族牌基础分相加；惩罚：无效化所有领袖牌。 | 图面已核对，执行待验证 |
| building-chapel | CH04 | 2 / 2 | +40 if you have exactly two cards from among these suits: Leader, Wizard, Outsider, and Undead. | 若持有恰好2张下列类别的卡牌则+40：领袖、法师、局外人和不死族. | 奖励：若手中恰有两张牌来自领袖、法师、局外人和不死族花色的组合，+40分。 | 图面已核对，执行待验证 |
| land-garden | CH05 | 11 / 11 | +11 for each Leader and Beast.；BLANKED by any Undead, Necromancer, or Demon. | 每持有领袖/猛兽则+11.；持有不死族、死灵术士或恶魔则被封阻. | 奖励：每张领袖牌和巨兽牌+11分；若手中有不死族、死灵术士或魔鬼，此牌无效。 | 图面已核对，执行待验证 |
| outsider-genie | CH06 | -50 / -50 | +10 per other player. ；At the end of the game, look through the draw deck and put one card in your hand. ；(Resolves after Leprechaun.) | 没油一位其他玩家+10 ；在游戏结束时，可以从抽牌堆选择一张卡牌并加入手中. ；（在矮精灵之后执行）. | 奖励：每名其他玩家+10分。游戏结束时，在矮妖之后，从牌库中选择一张牌加入手牌。 | 图面已核对，执行待验证 |
| outsider-judge | CH07 | 11 / 11 | +10 for each card that contains a Penalty that is not CLEARED. | 每张含有未被清除之惩罚的卡牌则+10 | 奖励：每张带惩罚且惩罚未被清除的牌+10分。 | 图面已核对，执行待验证 |
| outsider-angel | CH08 | 16 / 16 | Prevent one other card from being BLANKED. This card can never be BLANKED.；Pick a target card from your hand. | 可以防止一张其他卡牌被封阻. ；此卡牌不会被封阻.；从你的手牌中选择一张卡牌. | 奖励：选择一张牌，使其不会被无效化；天使自身不会被无效化。 | 图面已核对，执行待验证 |
| outsider-leprechaun | CH09 | 20 / 20 | Draw the top card from the deck at the end of the game and add it to your hand. ；(Resolves before Genie.) | 在游戏结束时，从抽牌堆抽取一张卡牌并加入手中. ；（在神灯精灵之前执行）. | 奖励：游戏结束时，在灯灵之前，从牌库顶摸一张牌加入手牌。 | 图面已核对，执行待验证 |
| outsider-demon | CH10 | 45 / 45 | For every non-Outsider card: If that card is the only card you have in that suit, then that card is BLANKED. ；This takes place before any other BLANKING. | 在其他非局外人卡牌中，如果该张卡牌为其类别中唯一一张则被封阻. ；此效果优先于其他封阻. | 惩罚：无效化除局外人外的所有单花色牌。 | 图面已核对，执行待验证 |
| undead-dark-queen | CH11 | 10 / 10 | +5 for each Land, Flood, Flame, Weather, and Unicorn in the discard area. | 在弃牌区每有土地/洪水/烈火/气候或独角兽则+5. | 奖励：弃牌区每张土地牌、洪流牌、烈焰牌和天象牌+5分；若弃牌区有独角兽，再+5分。 | 图面已核对，执行待验证 |
| undead-ghoul | CH12 | 8 / 8 | +4 for each Wizard, Leader, Army, Beast, and Undead in the discard area. | 在弃牌区每有法师/领袖/军队/猛兽/不死族则+4. | 奖励：弃牌区每张法师牌、领袖牌、军队牌、巨兽牌和不死族牌+4分。 | 图面已核对，执行待验证 |
| undead-specter | CH13 | 12 / 12 | +6 for each Wizard, Artifact, and Outsider in the discard area. | 在弃牌区每有法师/文物/局外人则+6. | 奖励：弃牌区每张法师牌、神器牌和局外人牌+6分。 | 图面已核对，执行待验证 |
| undead-lich | CH14 | 13 / 13 | +10 for Necromancer and each other Undead. ；Undead may not be BLANKED. | +每持有死灵术士或其他不死族则+10. ；不死族可不被封阻. | 奖励：每张不死族牌及死灵术士各+10分。你的不死族牌不会被无效化。 | 图面已核对，执行待验证 |
| undead-death-knight | CH15 | 14 / 14 | +7 for each Weapon and Army in the discard area. | 在弃牌区每有兵器/军队则+7. | 奖励：弃牌区每张武器牌和军队牌+7分。 | 图面已核对，执行待验证 |
| building-bell-tower-ch | CH16 | 8 / 8 | +15 with any one Wizard or Undead. | 持有任何法师/不死族则+15. | 奖励：与任意一张法师牌或不死族牌同在时+15分。 | 图面已核对，执行待验证 |
| flood-fountain-of-life-ch | CH17 | 1 / 1 | Add the base strength of any one Building, Weapon, Flood, Flame, Land or Weather in your hand. | 将任何一张建筑/兵器/洪水/烈火/土地/气候的基本战力添加到此卡牌. | 奖励：将你手中任意一张建筑牌、武器牌、洪流牌、烈焰牌、土地牌或天象牌的基础分加入此牌。 | 图面已核对，执行待验证 |
| flood-great-flood-ch | CH18 | 32 / 32 | BLANKS all Armies, all Buildings, all Lands except Mountain, and all Flames except Lightning. | 封阻所有军队、土地、建筑和烈火（高山和雷电除外）. | 惩罚：无效化所有军队牌、所有建筑牌、除山脉外的所有土地牌，以及除闪电外的所有烈焰牌。 | 图面已核对，执行待验证 |
| army-rangers-ch | CH19 | 5 / 5 | +10 for each Land and Building. ；CLEARS the word Army from all Penalties. | 每持有土地或建筑便+10. ；清除所有惩罚中的军队一词. | 奖励：每张土地牌和建筑牌+10分；清除你手中所有卡牌惩罚项中的“军队”字样。 | 图面已核对，执行待验证 |
| wizard-necromancer-ch | CH20 | 3 / 3 | At the end of the game, you may take one Army, Leader, Wizard, Beast, or Undead from the discard pile and add it to your hand. ；Undead may not be BLANKED. | 游戏结束时,可从弃牌区选取一张军队/领袖/法师/猛兽/不死族，加入手牌. ；不死族可不被封阻. | 奖励：游戏结束时，你可以从弃牌区选择1张军队、领袖、法师、巨兽或不死族牌加入手牌。你的不死族牌不会被无效化。 | 图面已核对，执行待验证 |
| artifact-world-tree-ch | CH21 | 2 / 2 | +70 if every non-BLANKED card is a different suit. | 如所有未被封阻的手牌皆属于不同类别则+70. | 奖励：若手中所有生效牌的花色都不同，+70分。 | 图面已核对，执行待验证 |
| wild-shapeshifter-ch | CH22 | 0 / 0 | Shapeshifter may duplicate the name and suit of any one Artifact, Leader, Wizard, Weapon, Beast, or Undead in the game. ；Does not take the bonus, penalty, or base strength of the card duplicated.；Pick a target card to duplicate. | 可复制游戏内任何一张以下类别卡牌的名称和类别：文物/领袖/法师/兵器/猛兽/不死族. ；不会复制奖励、惩罚和基本战力.；选择一张卡牌复制. | 可视为任意一张神器牌、领袖牌、法师牌、武器牌、巨兽牌或不死族牌的名称与花色；不复制其基础分、奖励或惩罚。 | 图面已核对，执行待验证 |
| wild-mirage-ch | CH23 | 0 / 0 | Mirage may duplicate the name and suit of any one Army, Building, Land, Weather, Flood or Flame in the game. ；Does not take the bonus, penalty, or base strength of the card duplicated.；Pick a target card to duplicate. | 可复制游戏内任何一张以下类别卡牌的名称和类别：军队/土地/建筑/气候/洪水/烈火. ；不会复制奖励、惩罚和基本战力.；选择一张卡牌复制. | 可视为任意一张军队牌、建筑牌、土地牌、天象牌、洪流牌或烈焰牌的名称与花色；不复制其基础分、奖励或惩罚。 | 图面已核对，执行待验证 |

## 已锁定的交叉问题与规则裁定

- 用户明确裁定以当前实体牌图为准：战马每张领袖／法师 +14，世界树 +70；不同出版版本作为对照保留。
- 巨龙无巫师时扣 40，仍保留基础分与巨兽类别；护林人清除蛇怪及飞艇惩罚中的“军队”字样，不影响野火。
- 烟雾因缺少烈焰无效后，不再作为天象使飞艇无效。
- 扩展终局按小妖精、巨灵、死灵术士、野牌、变化之书、清除惩罚、恶魔、其他无效化的顺序处理；恶魔无效洞穴或驭兽师不撤销此前清除的惩罚。
- 扩展多人局为八张手牌、公开弃牌 12 张结束；双人变体为 14 张。
- 巨灵、小妖精、天使、巫妖、扩展死灵术士、地牢、城堡、扩展护林人和变形牌文案原来遗漏效果或数值；已补全文案，逐卡行为及真实入口仍需逐项验收。
- 野火例外不包含野牌；未变形的野牌应被无效。变形后按所选实际名称与花色判断是否属于例外。
- 小妖精、巨灵及死灵术士的额外取牌均在终局触发，不能在普通双人回合把手牌上限提前加一；基础版仍为 7、扩展为 8。
- 灯灵牌图为终局检索牌库并选择 1 张牌，没有“可不使用”；有牌时必须选择。天使牌图允许使一张卡免于无效，自身同样已免疫。
- 图集第 0、1 行逐卡核对：角色与建筑名按牌面显示为地下城、地下室、教堂、灯灵、矮妖、审判者、魔鬼、暗黑女王；内部稳定 ID 与英文规则标识不变。
- 巫妖牌图写“每张亡灵卡和死灵术士 +10”，未排除巫妖自身；按用户裁定计入自身，与外部英文计分器的“其他亡灵”区别保留。
- 运行时中文规则说明和选择界面采用牌面术语：工艺、大地、洪水、火焰、领导、巫师、野兽、天气、自然、外来、亡灵；内部 suit 标识不变。
