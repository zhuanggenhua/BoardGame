/**
 * Wiki 描述快照数据文件
 *
 * 数据来源：SmashUp Wiki (https://smashup.fandom.com/wiki/)
 * 用途：审计卡牌描述→实现一致性的离线对照数据
 *
 * 注意：部分卡牌有 errata 版本，此处使用最新 errata 后的文本（Smash Up POD 版本优先）
 */

// ============================================================================
// 接口定义
// ============================================================================

/** 单张卡牌的 Wiki 快照 */
export interface WikiCardSnapshot {
  defId: string;
  wikiName: string;        // Wiki 上的英文名
  wikiAbilityText: string; // Wiki 上的能力描述（英文原文，使用最新 errata）
  wikiPower?: number;      // 随从力量值
}

/** 基地卡的 Wiki 快照 */
export interface WikiBaseSnapshot {
  defId: string;
  wikiName: string;
  wikiBreakpoint: number;
  wikiVpAwards: [number, number, number];
  wikiAbilityText?: string; // 基地特殊能力描述（如有）
}

// ============================================================================
// 外星人（Aliens）— 基础版
// ============================================================================

export const ALIENS_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'alien_supreme_overlord',
    wikiName: 'Supreme Overlord',
    wikiAbilityText: 'You may return a minion to its owner\'s hand.',
    wikiPower: 5,
  },
  {
    defId: 'alien_invader',
    wikiName: 'Invader',
    wikiAbilityText: 'Gain 1 VP.',
    wikiPower: 3,
  },
  {
    defId: 'alien_scout',
    wikiName: 'Scout',
    wikiAbilityText: 'Special: After this base is scored, you may place this minion into your hand instead of the discard pile.',
    wikiPower: 3,
  },
  {
    defId: 'alien_collector',
    wikiName: 'Collector',
    wikiAbilityText: 'You may return a minion of power 3 or less on this base to its owner\'s hand.',
    wikiPower: 2,
  },
  // 行动卡
  {
    defId: 'alien_abduction',
    wikiName: 'Abduction',
    wikiAbilityText: 'Return a minion to its owner\'s hand. Play an extra minion.',
  },
  {
    defId: 'alien_beam_up',
    wikiName: 'Beam Up',
    wikiAbilityText: 'Return a minion to its owner\'s hand.',
  },
  {
    defId: 'alien_crop_circles',
    wikiName: 'Crop Circles',
    wikiAbilityText: 'Choose a base. Return each minion on that base to its owner\'s hand.',
  },
  {
    defId: 'alien_disintegrator',
    wikiName: 'Disintegrator',
    wikiAbilityText: 'Place a minion of power 3 or less on the bottom of its owner\'s deck.',
  },
  {
    defId: 'alien_invasion',
    wikiName: 'Invasion',
    wikiAbilityText: 'Move a minion to another base.',
  },
  {
    defId: 'alien_jammed_signal',
    wikiName: 'Jammed Signal',
    wikiAbilityText: 'Play on a base. Ongoing: All players ignore this base\'s ability.',
  },
  {
    defId: 'alien_probe',
    wikiName: 'Probe',
    wikiAbilityText: 'Look at another player\'s hand and choose a minion in it. That player discards that minion.',
  },
  {
    defId: 'alien_terraform',
    wikiName: 'Terraforming',
    wikiAbilityText: 'Search the base deck for a base. Swap it with a base in play (discard all actions attached to it). Shuffle the base deck. You may play an extra minion on the new base.',
  },
];

// ============================================================================
// 恐龙（Dinosaurs）— 基础版
// ============================================================================

export const DINOSAURS_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'dino_king_rex',
    wikiName: 'King Rex',
    wikiAbilityText: '(no ability)',
    wikiPower: 7,
  },
  {
    defId: 'dino_laser_triceratops',
    wikiName: 'Laseratops',
    wikiAbilityText: 'Destroy a minion of power 2 or less on this base.',
    wikiPower: 4,
  },
  {
    defId: 'dino_armor_stego',
    wikiName: 'Armor Stego',
    wikiAbilityText: 'Ongoing: Has +2 power during other players\' turns.',
    wikiPower: 3,
  },
  {
    defId: 'dino_war_raptor',
    wikiName: 'War Raptor',
    wikiAbilityText: 'Ongoing: Gains +1 power for each War Raptor on this base (including this one).',
    wikiPower: 2,
  },
  // 行动卡
  {
    defId: 'dino_augmentation',
    wikiName: 'Augmentation',
    wikiAbilityText: 'One minion gains +4 power until the end of your turn.',
  },
  {
    defId: 'dino_howl',
    wikiName: 'Howl',
    wikiAbilityText: 'Each of your minions gains +1 power until the end of your turn.',
  },
  {
    defId: 'dino_natural_selection',
    wikiName: 'Natural Selection',
    wikiAbilityText: 'Choose one of your minions on a base. Destroy a minion there with less power than yours.',
  },
  {
    defId: 'dino_rampage',
    wikiName: 'Rampage',
    wikiAbilityText: 'Reduce the breakpoint of a base by the power of one of your minions on that base until the end of the turn.',
  },
  {
    defId: 'dino_survival_of_the_fittest',
    wikiName: 'Survival of the Fittest',
    wikiAbilityText: 'Destroy the lowest-power minion (you choose in case of a tie) on each base with a higher-power minion.',
  },
  {
    defId: 'dino_tooth_and_claw',
    wikiName: 'Tooth and Claw...and Guns',
    wikiAbilityText: 'Play on a minion. Ongoing: This minion is not affected by other players\' cards.',
  },
  {
    defId: 'dino_upgrade',
    wikiName: 'Upgrade',
    wikiAbilityText: 'Play on a minion. Ongoing: This minion has +2 power.',
  },
  {
    defId: 'dino_wildlife_preserve',
    wikiName: 'Wildlife Preserve',
    wikiAbilityText: 'Play on a base. Ongoing: Your minions here are not affected by other players\' actions.',
  },
];

// ============================================================================
// 忍者（Ninjas）— 基础版
// ============================================================================

export const NINJAS_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'ninja_master',
    wikiName: 'Ninja Master',
    wikiAbilityText: 'You may destroy a minion on this base.',
    wikiPower: 5,
  },
  {
    defId: 'ninja_tiger_assassin',
    wikiName: 'Tiger Assassin',
    wikiAbilityText: 'You may destroy a minion of power 3 or less on this base.',
    wikiPower: 4,
  },
  {
    defId: 'ninja_shinobi',
    wikiName: 'Shinobi',
    wikiAbilityText: 'Special: Before a base scores, you may play this minion there. You can only use one Shinobi\'s ability per base.',
    wikiPower: 3,
  },
  {
    defId: 'ninja_acolyte',
    wikiName: 'Ninja Acolyte',
    wikiAbilityText: 'Special: On your turn, if you have not yet played a minion, you may return this minion to your hand and play an extra minion on this base.',
    wikiPower: 2,
  },
  // 行动卡
  {
    defId: 'ninja_assassination',
    wikiName: 'Assassination',
    wikiAbilityText: 'Play on a minion. Ongoing: Destroy this minion at the end of the turn.',
  },
  {
    defId: 'ninja_disguise',
    wikiName: 'Disguise',
    wikiAbilityText: 'Choose one or two of your minions on one base. Play an equal number of extra minions there, and return the chosen minions to your hand.',
  },
  {
    defId: 'ninja_hidden_ninja',
    wikiName: 'Hidden Ninja',
    wikiAbilityText: 'Special: Before a base scores, play a minion there.',
  },
  {
    defId: 'ninja_infiltrate',
    wikiName: 'Infiltrate',
    wikiAbilityText: 'Play on a base. You may destroy another action on this base. Talent: Destroy this action to cancel this base\'s ability until the start of your turn.',
  },
  {
    defId: 'ninja_poison',
    wikiName: 'Poison',
    wikiAbilityText: 'Play on a minion. Destroy any number of actions on it. Ongoing: This minion has -4 power. (Minions have minimum power of 0.)',
  },
  {
    defId: 'ninja_seeing_stars',
    wikiName: 'Seeing Stars',
    wikiAbilityText: 'Destroy a minion of power 3 or less.',
  },
  {
    defId: 'ninja_smoke_bomb',
    wikiName: 'Smoke Bomb',
    wikiAbilityText: 'Play on one of your minions. Ongoing: This minion is not affected by other players\' actions.',
  },
  {
    defId: 'ninja_way_of_deception',
    wikiName: 'Way of Deception',
    wikiAbilityText: 'Move one of your minions to another base.',
  },
];

// ============================================================================
// 海盗（Pirates）— 基础版
// ============================================================================

export const PIRATES_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'pirate_king',
    wikiName: 'Pirate King',
    wikiAbilityText: 'Special: Before a base scores, you may move this minion there.',
    wikiPower: 5,
  },
  {
    defId: 'pirate_buccaneer',
    wikiName: 'Buccaneer',
    wikiAbilityText: 'Special: If this minion would be destroyed, move it to another base instead.',
    wikiPower: 4,
  },
  {
    defId: 'pirate_saucy_wench',
    wikiName: 'Saucy Wench',
    wikiAbilityText: 'You may destroy a minion of power 2 or less on this base.',
    wikiPower: 3,
  },
  {
    defId: 'pirate_first_mate',
    wikiName: 'First Mate',
    wikiAbilityText: 'Special: After this base is scored, you may move this minion to another base instead of the discard pile.',
    wikiPower: 2,
  },
  // 行动卡
  {
    defId: 'pirate_broadside',
    wikiName: 'Broadside',
    wikiAbilityText: 'Destroy all of one player\'s minions of power 2 or less on a base where you have a minion.',
  },
  {
    defId: 'pirate_cannon',
    wikiName: 'Cannon',
    wikiAbilityText: 'Destroy up to two minions of power 2 or less.',
  },
  {
    defId: 'pirate_dinghy',
    wikiName: 'Dinghy',
    wikiAbilityText: 'Move up to two of your minions to other bases.',
  },
  {
    defId: 'pirate_full_sail',
    wikiName: 'Full Sail',
    wikiAbilityText: 'Move any number of your minions to other bases. Special: Before a base scores, you may play this card.',
  },
  {
    defId: 'pirate_powderkeg',
    wikiName: 'Powderkeg',
    wikiAbilityText: 'Destroy one of your minions and all minions with equal or less power on the same base.',
  },
  {
    defId: 'pirate_sea_dogs',
    wikiName: 'Sea Dogs',
    wikiAbilityText: 'Name a faction. Move all other players\' minions of that faction from one base to another.',
  },
  {
    defId: 'pirate_shanghai',
    wikiName: 'Shanghai',
    wikiAbilityText: 'Move another player\'s minion to another base.',
  },
  {
    defId: 'pirate_swashbuckling',
    wikiName: 'Swashbuckling',
    wikiAbilityText: 'Each of your minions gains +1 power until the end of the turn.',
  },
];

// ============================================================================
// 机器人（Robots）— 基础版
// ============================================================================

export const ROBOTS_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'robot_nukebot',
    wikiName: 'Nukebot',
    wikiAbilityText: 'Ongoing: After this minion is destroyed, destroy each other player\'s minions on this base.',
    wikiPower: 5,
  },
  {
    defId: 'robot_warbot',
    wikiName: 'Warbot',
    wikiAbilityText: 'Ongoing: This minion cannot be destroyed.',
    wikiPower: 4,
  },
  {
    defId: 'robot_hoverbot',
    wikiName: 'Hoverbot',
    wikiAbilityText: 'Reveal the top card of your deck. If it is a minion, you may play it as an extra minion. Otherwise, return it to the top of your deck.',
    wikiPower: 3,
  },
  {
    defId: 'robot_zapbot',
    wikiName: 'Zapbot',
    wikiAbilityText: 'You may play an extra minion of power 2 or less.',
    wikiPower: 2,
  },
  {
    defId: 'robot_microbot_alpha',
    wikiName: 'Microbot Alpha',
    wikiAbilityText: 'Ongoing: Gains +1 power for each of your other Microbots. All of your minions are considered Microbots.',
    wikiPower: 1,
  },
  {
    defId: 'robot_microbot_archive',
    wikiName: 'Microbot Archive',
    wikiAbilityText: 'Ongoing: After one of your Microbots (including this one) is destroyed, draw a card.',
    wikiPower: 1,
  },
  {
    defId: 'robot_microbot_fixer',
    wikiName: 'Microbot Fixer',
    wikiAbilityText: 'If this is the first minion you played this turn, you may play an extra minion. Ongoing: Each of your Microbots gains +1 power.',
    wikiPower: 1,
  },
  {
    defId: 'robot_microbot_guard',
    wikiName: 'Microbot Guard',
    wikiAbilityText: 'Destroy a minion on this base with power less than the number of minions you have here.',
    wikiPower: 1,
  },
  {
    defId: 'robot_microbot_reclaimer',
    wikiName: 'Microbot Reclaimer',
    wikiAbilityText: 'If this is the first minion you played this turn, you may play an extra minion. Shuffle any number of Microbots from your discard pile into your deck.',
    wikiPower: 1,
  },
  // 行动卡
  {
    defId: 'robot_tech_center',
    wikiName: 'Tech Center',
    wikiAbilityText: 'Choose a base. Draw one card for each of your minions there.',
  },
];

// ============================================================================
// 巫师（Wizards）— 基础版
// ============================================================================

export const WIZARDS_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'wizard_archmage',
    wikiName: 'Archmage',
    wikiAbilityText: 'Ongoing: You may play an extra action on each of your turns.',
    wikiPower: 4,
  },
  {
    defId: 'wizard_chronomage',
    wikiName: 'Chronomage',
    wikiAbilityText: 'You may play an extra action this turn.',
    wikiPower: 3,
  },
  {
    defId: 'wizard_enchantress',
    wikiName: 'Enchantress',
    wikiAbilityText: 'Draw a card.',
    wikiPower: 2,
  },
  {
    defId: 'wizard_neophyte',
    wikiName: 'Neophyte',
    wikiAbilityText: 'Reveal the top card of your deck. If it is an action, you may place it in your hand or play it as an extra action. Otherwise, return it to the top of your deck.',
    wikiPower: 2,
  },
  // 行动卡
  {
    defId: 'wizard_mass_enchantment',
    wikiName: 'Mass Enchantment',
    wikiAbilityText: 'Reveal the top card of each other player\'s deck. Play one revealed action as an extra action. Return unused cards to the top of their decks.',
  },
  {
    defId: 'wizard_mystic_studies',
    wikiName: 'Mystic Studies',
    wikiAbilityText: 'Draw two cards.',
  },
  {
    defId: 'wizard_portal',
    wikiName: 'Portal',
    wikiAbilityText: 'Reveal the top five cards of your deck. Place any number of minions revealed into your hand. Return the other cards to the top of your deck in any order.',
  },
  {
    defId: 'wizard_sacrifice',
    wikiName: 'Sacrifice',
    wikiAbilityText: 'Choose one of your minions. Draw cards equal to its power. Destroy that minion.',
  },
  {
    defId: 'wizard_scry',
    wikiName: 'Scry',
    wikiAbilityText: 'Search your deck for an action and reveal it to all players. Place it into your hand and shuffle your deck.',
  },
  {
    defId: 'wizard_summon',
    wikiName: 'Summon',
    wikiAbilityText: 'Play an extra minion.',
  },
  {
    defId: 'wizard_time_loop',
    wikiName: 'Time Loop',
    wikiAbilityText: 'Play two extra actions.',
  },
  {
    defId: 'wizard_winds_of_change',
    wikiName: 'Winds of Change',
    wikiAbilityText: 'Shuffle your hand into your deck and draw five cards. You may play an extra action.',
  },
];

// ============================================================================
// 丧尸（Zombies）— 基础版
// ============================================================================

export const ZOMBIES_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'zombie_lord',
    wikiName: 'Zombie Lord',
    wikiAbilityText: 'You may play an extra minion of power 2 or less from your discard pile on each base where you have no minions.',
    wikiPower: 5,
  },
  {
    defId: 'zombie_grave_digger',
    wikiName: 'Grave Digger',
    wikiAbilityText: 'You may place a minion from your discard pile into your hand.',
    wikiPower: 4,
  },
  {
    defId: 'zombie_tenacious_z',
    wikiName: 'Tenacious Z',
    wikiAbilityText: 'Special: During your turn you may play this card from your discard pile as an extra minion. You may only use the ability of one Tenacious Z each turn.',
    wikiPower: 2,
  },
  {
    defId: 'zombie_walker',
    wikiName: 'Walker',
    wikiAbilityText: 'Look at the top card of your deck. Discard it or return it to the top of your deck.',
    wikiPower: 2,
  },
  // 行动卡
  {
    defId: 'zombie_grave_robbing',
    wikiName: 'Grave Robbing',
    wikiAbilityText: 'Place a card from your discard pile into your hand.',
  },
  {
    defId: 'zombie_lend_a_hand',
    wikiName: 'Lend a Hand',
    wikiAbilityText: 'Shuffle any number of cards from your discard pile into your deck.',
  },
  {
    defId: 'zombie_mall_crawl',
    wikiName: 'Mall Crawl',
    wikiAbilityText: 'Search your deck for any number of cards with the same name and place them into your discard pile. Shuffle your deck.',
  },
  {
    defId: 'zombie_not_enough_bullets',
    wikiName: 'Not Enough Bullets',
    wikiAbilityText: 'Place any number of minions with the same name from your discard pile into your hand.',
  },
  {
    defId: 'zombie_outbreak',
    wikiName: 'Outbreak',
    wikiAbilityText: 'Play an extra minion on a base where you have no minions.',
  },
  {
    defId: 'zombie_overrun',
    wikiName: 'Overrun',
    wikiAbilityText: 'Play on a base. Ongoing: Other players cannot play minions on this base. Destroy this action at the start of your turn.',
  },
  {
    defId: 'zombie_they_keep_coming',
    wikiName: 'They Keep Coming',
    wikiAbilityText: 'Play an extra minion from your discard pile.',
  },
  {
    defId: 'zombie_theyre_coming_to_get_you',
    wikiName: 'They\'re Coming To Get You',
    wikiAbilityText: 'Play on a base. Ongoing: On your turn, you may play a minion here from your discard pile instead of from your hand.',
  },
];

// ============================================================================
// 捣蛋鬼（Tricksters）— 基础版
// ============================================================================

export const TRICKSTERS_WIKI: WikiCardSnapshot[] = [
  {
    defId: 'trickster_leprechaun',
    wikiName: 'Leprechaun',
    wikiAbilityText: 'Ongoing: After another player plays a minion here with less power than this minion\'s power, destroy it (resolve its ability first).',
    wikiPower: 5,
  },
  {
    defId: 'trickster_brownie',
    wikiName: 'Brownie',
    wikiAbilityText: 'Ongoing: After another player plays a card that affects this minion, that player discards two random cards.',
    wikiPower: 4,
  },
  {
    defId: 'trickster_gnome',
    wikiName: 'Gnome',
    wikiAbilityText: 'You may destroy a minion on this base with power less than the number of minions you have here.',
    wikiPower: 3,
  },
  {
    defId: 'trickster_gremlin',
    wikiName: 'Gremlin',
    wikiAbilityText: 'Ongoing: After this minion is destroyed, draw a card and each other player discards a random card.',
    wikiPower: 2,
  },
  // 行动卡
  {
    defId: 'trickster_block_the_path',
    wikiName: 'Block the Path',
    wikiAbilityText: 'Play on a base and name a faction. Ongoing: Minions of that faction cannot be played here.',
  },
  {
    defId: 'trickster_disenchant',
    wikiName: 'Disenchant',
    wikiAbilityText: 'Destroy an action that has been played on a minion or base.',
  },
  {
    defId: 'trickster_enshrouding_mist',
    wikiName: 'Enshrouding Mist',
    wikiAbilityText: 'Play on a base. Ongoing: On your turn, you may play an extra minion here.',
  },
  {
    defId: 'trickster_flame_trap',
    wikiName: 'Flame Trap',
    wikiAbilityText: 'Play on a base. Ongoing: After another player plays a minion here, destroy it (resolve its ability first) and this card.',
  },
  {
    defId: 'trickster_hideout',
    wikiName: 'Hideout',
    wikiAbilityText: 'Play on a base. Ongoing: If another player\'s action would affect your minions here, destroy this card and the action does not affect your minions.',
  },
  {
    defId: 'trickster_mark_of_sleep',
    wikiName: 'Mark of Sleep',
    wikiAbilityText: 'Choose a player. That player cannot play actions on his or her next turn.',
  },
  {
    defId: 'trickster_pay_the_piper',
    wikiName: 'Pay the Piper',
    wikiAbilityText: 'Play on a base. Ongoing: After another player plays a minion here, that player discards a card.',
  },
  {
    defId: 'trickster_take_the_shinies',
    wikiName: 'Take the Shinies',
    wikiAbilityText: 'Each other player discards two random cards.',
  },
];

// ============================================================================
// 基础版基地卡 Wiki 快照
// ============================================================================

export const BASE_CARDS_CORE_WIKI: WikiBaseSnapshot[] = [
  // 外星人基地
  {
    defId: 'base_the_homeworld',
    wikiName: 'The Homeworld',
    wikiBreakpoint: 23,
    wikiVpAwards: [4, 2, 1],
    wikiAbilityText: 'After each time a minion is played here, its owner may play an extra minion of power 2 or less here.',
  },
  {
    defId: 'base_the_mothership',
    wikiName: 'The Mothership',
    wikiBreakpoint: 20,
    wikiVpAwards: [4, 2, 1],
    wikiAbilityText: 'After this base scores, the winner may search the base deck for a base. Swap it with a base in play (discard all actions attached to it). Shuffle the base deck.',
  },
  // 机器人基地
  {
    defId: 'base_central_brain',
    wikiName: 'The Central Brain',
    wikiBreakpoint: 19,
    wikiVpAwards: [4, 2, 1],
    wikiAbilityText: 'Each minion here has +1 power.',
  },
  {
    defId: 'base_the_factory',
    wikiName: 'Factory 436-1337',
    wikiBreakpoint: 25,
    wikiVpAwards: [2, 2, 1],
    wikiAbilityText: 'After each time a Microbot is destroyed here, its owner may play an extra Microbot from their hand.',
  },
  // 恐龙基地
  {
    defId: 'base_the_jungle',
    wikiName: 'Jungle Oasis',
    wikiBreakpoint: 12,
    wikiVpAwards: [2, 0, 0],
    wikiAbilityText: 'Only one minion can be played here each turn.',
  },
  {
    defId: 'base_tar_pits',
    wikiName: 'Tar Pits',
    wikiBreakpoint: 16,
    wikiVpAwards: [4, 3, 2],
    wikiAbilityText: 'After this base scores, destroy all minions here. They are not moved to the discard pile.',
  },
  // 忍者基地
  {
    defId: 'base_temple_of_goju',
    wikiName: 'Temple of Goju',
    wikiBreakpoint: 18,
    wikiVpAwards: [2, 3, 2],
    wikiAbilityText: 'Each player with a minion here draws a card when this base scores.',
  },
  {
    defId: 'base_ninja_dojo',
    wikiName: 'Ninja Dojo',
    wikiBreakpoint: 18,
    wikiVpAwards: [2, 3, 2],
    wikiAbilityText: 'Each player with a minion here may play an extra minion on this base before it scores.',
  },
  // 捣蛋鬼基地
  {
    defId: 'base_cave_of_shinies',
    wikiName: 'Cave of Shinies',
    wikiBreakpoint: 23,
    wikiVpAwards: [4, 2, 1],
    wikiAbilityText: 'After this base scores, each player with a minion here may draw two cards.',
  },
  {
    defId: 'base_mushroom_kingdom',
    wikiName: 'Mushroom Kingdom',
    wikiBreakpoint: 20,
    wikiVpAwards: [5, 3, 2],
    wikiAbilityText: 'Minions of power 2 or less cannot be destroyed here.',
  },
  // 丧尸基地
  {
    defId: 'base_haunted_house',
    wikiName: 'Evans City Cemetery',
    wikiBreakpoint: 20,
    wikiVpAwards: [5, 3, 2],
    wikiAbilityText: 'After this base scores, each player may place one of their minions from the discard pile into their hand.',
  },
  {
    defId: 'base_rhodes_plaza',
    wikiName: 'Rhodes Plaza Mall',
    wikiBreakpoint: 24,
    wikiVpAwards: [0, 0, 0],
    wikiAbilityText: 'After this base scores, each player gains 1 VP for each minion they have here.',
  },
  // 海盗基地
  {
    defId: 'base_pirate_cove',
    wikiName: 'The Grey Opal',
    wikiBreakpoint: 17,
    wikiVpAwards: [3, 1, 1],
    wikiAbilityText: 'After each time a minion is played here, its owner may move another player\'s minion from here to another base.',
  },
  {
    defId: 'base_tortuga',
    wikiName: 'Tortuga',
    wikiBreakpoint: 21,
    wikiVpAwards: [4, 3, 2],
    wikiAbilityText: 'After this base scores and is replaced, the runner-up may move one of their minions on another base to the replacement base.',
  },
  // 巫师基地
  {
    defId: 'base_great_library',
    wikiName: 'The Great Library',
    wikiBreakpoint: 22,
    wikiVpAwards: [4, 2, 1],
    wikiAbilityText: 'After each time an action is played here, its owner draws a card.',
  },
  {
    defId: 'base_wizard_academy',
    wikiName: 'School of Wizardry',
    wikiBreakpoint: 20,
    wikiVpAwards: [3, 2, 1],
    wikiAbilityText: 'After each time a minion is played here, its owner may play an extra action.',
  },
];

// ============================================================================
// 聚合导出：按派系分组的 Wiki 快照
// ============================================================================

/** 基础版 8 派系的所有卡牌 Wiki 快照 */
export const CORE_FACTIONS_WIKI: Record<string, WikiCardSnapshot[]> = {
  aliens: ALIENS_WIKI,
  dinosaurs: DINOSAURS_WIKI,
  ninjas: NINJAS_WIKI,
  pirates: PIRATES_WIKI,
  robots: ROBOTS_WIKI,
  wizards: WIZARDS_WIKI,
  zombies: ZOMBIES_WIKI,
  tricksters: TRICKSTERS_WIKI,
};

/** 所有基础版卡牌 Wiki 快照（扁平数组） */
export const ALL_CORE_CARD_WIKI: WikiCardSnapshot[] = Object.values(CORE_FACTIONS_WIKI).flat();

/** 所有基础版基地 Wiki 快照 */
export const ALL_CORE_BASE_WIKI: WikiBaseSnapshot[] = BASE_CARDS_CORE_WIKI;

/** 按 defId 索引的快速查找表 */
export const WIKI_CARD_BY_DEF_ID: Map<string, WikiCardSnapshot> = new Map(
  ALL_CORE_CARD_WIKI.map(c => [c.defId, c])
);

export const WIKI_BASE_BY_DEF_ID: Map<string, WikiBaseSnapshot> = new Map(
  ALL_CORE_BASE_WIKI.map(b => [b.defId, b])
);
