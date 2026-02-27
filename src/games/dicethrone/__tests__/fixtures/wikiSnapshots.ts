/**
 * Dice Throne Wiki 描述快照数据
 *
 * 数据来源：Dice Throne Season 1 Rerolled 官方 Wiki (https://dice-throne.fandom.com/)
 * 用途：作为审计基准，与代码中的能力/Token/卡牌定义进行比对
 *
 * 注意：
 * - 所有描述使用英文（Wiki 原文）
 * - 数值以 Wiki 为权威来源
 * - heroId 与代码中的角色目录名一致
 */

// ============================================================================
// 接口定义
// ============================================================================

/** 能力 Wiki 快照 */
export interface WikiAbilitySnapshot {
  heroId: string;
  abilityId: string;
  level: 1 | 2 | 3;
  wikiName: string;
  wikiDescription: string;
  wikiDamage?: number;
  wikiHeal?: number;
  wikiStatusEffect?: string;
  wikiStatusValue?: number;
  wikiTrigger?: string;
  wikiTags?: string[];
}

/** Token Wiki 快照 */
export interface WikiTokenSnapshot {
  heroId: string;
  tokenId: string;
  wikiName: string;
  wikiDescription: string;
  wikiTiming?: string;
  wikiStackLimit?: number;
  wikiCategory?: string;
}

/** 卡牌 Wiki 快照 */
export interface WikiCardSnapshot {
  cardId: string;
  heroId?: string;
  wikiName: string;
  wikiCpCost: number;
  wikiTiming: string;
  wikiDescription: string;
  wikiType: 'action' | 'upgrade';
}

// ============================================================================
// 狂战士 (Barbarian) 能力快照
// ============================================================================

export const BARBARIAN_ABILITY_SNAPSHOTS: WikiAbilitySnapshot[] = [
  // --- Slap ---
  { heroId: 'barbarian', abilityId: 'slap', level: 1, wikiName: 'Slap', wikiDescription: '3 Swords: Deal 4 damage. 4 Swords: Deal 6 damage. 5 Swords: Deal 8 damage.', wikiDamage: 4, wikiTrigger: '3/4/5 Swords' },
  { heroId: 'barbarian', abilityId: 'slap', level: 2, wikiName: 'Slap II', wikiDescription: '3 Swords: Deal 5 damage. 4 Swords: Deal 7 unblockable damage. 5 Swords: Deal 9 unblockable damage.', wikiDamage: 5, wikiTrigger: '3/4/5 Swords', wikiTags: ['unblockable'] },
  { heroId: 'barbarian', abilityId: 'slap', level: 3, wikiName: 'Slap III', wikiDescription: '3 Swords: Deal 6 damage. 4 Swords: Deal 8 unblockable damage. 5 Swords: Deal 10 unblockable damage.', wikiDamage: 6, wikiTrigger: '3/4/5 Swords', wikiTags: ['unblockable'] },

  // --- All-Out Strike ---
  { heroId: 'barbarian', abilityId: 'all-out-strike', level: 1, wikiName: 'All-Out Strike', wikiDescription: 'Deal 4 unblockable damage.', wikiDamage: 4, wikiTrigger: '2 Swords + 2 Strength', wikiTags: ['unblockable'] },
  { heroId: 'barbarian', abilityId: 'all-out-strike', level: 2, wikiName: 'All-Out Strike II', wikiDescription: 'Deal 5 unblockable damage.', wikiDamage: 5, wikiTrigger: '2 Swords + 2 Strength', wikiTags: ['unblockable'] },
  { heroId: 'barbarian', abilityId: 'all-out-strike', level: 3, wikiName: 'All-Out Strike III', wikiDescription: 'Deal 6 unblockable damage.', wikiDamage: 6, wikiTrigger: '2 Swords + 2 Strength', wikiTags: ['unblockable'] },

  // --- Powerful Strike ---
  { heroId: 'barbarian', abilityId: 'powerful-strike', level: 1, wikiName: 'Powerful Strike', wikiDescription: 'Deal 9 damage.', wikiDamage: 9, wikiTrigger: 'Small Straight' },
  { heroId: 'barbarian', abilityId: 'powerful-strike', level: 2, wikiName: 'Powerful Strike II', wikiDescription: 'Deal 8 unblockable damage.', wikiDamage: 8, wikiTrigger: 'Small Straight', wikiTags: ['unblockable'] },

  // --- Violent Assault ---
  { heroId: 'barbarian', abilityId: 'violent-assault', level: 1, wikiName: 'Violent Assault', wikiDescription: 'Inflict Daze. Deal 5 unblockable damage.', wikiDamage: 5, wikiStatusEffect: 'daze', wikiStatusValue: 1, wikiTrigger: '4 Strength', wikiTags: ['unblockable'] },
  { heroId: 'barbarian', abilityId: 'violent-assault', level: 2, wikiName: 'Violent Assault II', wikiDescription: '3 Strength: Inflict Concussion, deal 2 unblockable damage. 4 Strength: Inflict Daze, deal 7 unblockable damage.', wikiDamage: 2, wikiTrigger: '3/4 Strength', wikiTags: ['unblockable'] },

  // --- Steadfast ---
  { heroId: 'barbarian', abilityId: 'steadfast', level: 1, wikiName: 'Steadfast', wikiDescription: '3 Hearts: Heal 4. 4 Hearts: Heal 5. 5 Hearts: Heal 6.', wikiHeal: 4, wikiTrigger: '3/4/5 Hearts' },
  { heroId: 'barbarian', abilityId: 'steadfast', level: 2, wikiName: 'Steadfast II', wikiDescription: '3 Hearts: Heal 5, remove a status effect. 4 Hearts: Heal 6, remove a status effect. 5 Hearts: Heal 7, remove a status effect.', wikiHeal: 5, wikiTrigger: '3/4/5 Hearts' },

  // --- Suppress ---
  { heroId: 'barbarian', abilityId: 'suppress', level: 1, wikiName: 'Suppress', wikiDescription: 'Roll 3 dice. Deal damage equal to the number of Swords rolled x2.', wikiTrigger: '2 Swords + 2 Strength' },
  { heroId: 'barbarian', abilityId: 'suppress', level: 2, wikiName: 'Suppress II', wikiDescription: 'Battle Cry: 2 Swords + 2 Hearts: Heal 2, deal 2 unblockable damage. Mighty Suppress: 3 Swords + 2 Strength: Roll 3 dice, deal Swords x2 damage.', wikiTrigger: '2 Swords + 2 Hearts / 3 Swords + 2 Strength', wikiTags: ['unblockable'] },

  // --- Reckless Strike ---
  { heroId: 'barbarian', abilityId: 'reckless-strike', level: 1, wikiName: 'Reckless Strike', wikiDescription: 'Deal 15 damage. If this attack hits, deal 4 damage to yourself.', wikiDamage: 15, wikiTrigger: 'Large Straight' },
  { heroId: 'barbarian', abilityId: 'reckless-strike', level: 2, wikiName: 'Reckless Strike II', wikiDescription: 'Deal 20 damage. If this attack hits, deal 5 damage to yourself.', wikiDamage: 20, wikiTrigger: 'Large Straight' },

  // --- Rage (Ultimate) ---
  { heroId: 'barbarian', abilityId: 'rage', level: 1, wikiName: 'Rage', wikiDescription: 'Inflict Daze. Deal 15 damage.', wikiDamage: 15, wikiStatusEffect: 'daze', wikiStatusValue: 1, wikiTrigger: '5 Strength', wikiTags: ['ultimate'] },

  // --- Thick Skin (Defensive) ---
  { heroId: 'barbarian', abilityId: 'thick-skin', level: 1, wikiName: 'Thick Skin', wikiDescription: 'Roll 3 dice. Heal 1 for each Heart rolled.', wikiTrigger: 'Defensive Roll (3 dice)' },
  { heroId: 'barbarian', abilityId: 'thick-skin', level: 2, wikiName: 'Thick Skin II', wikiDescription: 'Roll 4 dice. Heal 1 and prevent 1 damage for each Heart rolled.', wikiTrigger: 'Defensive Roll (4 dice)' },
];


// ============================================================================
// 僧侣 (Monk) 能力快照
// ============================================================================

export const MONK_ABILITY_SNAPSHOTS: WikiAbilitySnapshot[] = [
  // --- Fist Technique ---
  { heroId: 'monk', abilityId: 'fist-technique', level: 1, wikiName: 'Fist Technique', wikiDescription: '3 Fists: Deal 4 damage. 4 Fists: Deal 6 damage. 5 Fists: Deal 8 damage.', wikiDamage: 4, wikiTrigger: '3/4/5 Fists' },
  { heroId: 'monk', abilityId: 'fist-technique', level: 2, wikiName: 'Fist Technique II', wikiDescription: '3 Fists: Deal 7 damage. 4 Fists: Deal 8 damage. 5 Fists: Deal 9 damage.', wikiDamage: 7, wikiTrigger: '3/4/5 Fists' },
  { heroId: 'monk', abilityId: 'fist-technique', level: 3, wikiName: 'Fist Technique III', wikiDescription: '3 Fists: Deal 7 damage. 4 Fists: Deal 8 damage, inflict Knockdown. 5 Fists: Deal 9 damage, inflict Knockdown.', wikiDamage: 7, wikiStatusEffect: 'knockdown', wikiStatusValue: 1, wikiTrigger: '3/4/5 Fists' },

  // --- Zen Forget ---
  { heroId: 'monk', abilityId: 'zen-forget', level: 1, wikiName: 'Zen Forget', wikiDescription: 'Gain 5 Chi. Choose: gain 1 Evasive or 1 Purify.', wikiTrigger: '3 Chi symbols' },
  { heroId: 'monk', abilityId: 'zen-forget', level: 2, wikiName: 'Zen Forget II', wikiDescription: 'Zen Combat: 2 Fists + 2 Chi: Deal 6 damage, gain 2 Chi on hit. 3 Chi: Gain 6 Chi, gain 1 Evasive, gain 1 Purify.', wikiTrigger: '2 Fists + 2 Chi / 3 Chi' },

  // --- Harmony ---
  { heroId: 'monk', abilityId: 'harmony', level: 1, wikiName: 'Harmony', wikiDescription: 'Deal 5 damage. On hit: gain 2 Chi.', wikiDamage: 5, wikiTrigger: 'Small Straight' },
  { heroId: 'monk', abilityId: 'harmony', level: 2, wikiName: 'Harmony II', wikiDescription: 'Deal 6 damage. On hit: gain 3 Chi.', wikiDamage: 6, wikiTrigger: 'Small Straight' },

  // --- Lotus Palm ---
  { heroId: 'monk', abilityId: 'lotus-palm', level: 1, wikiName: 'Lotus Palm', wikiDescription: 'You may spend 2 Chi to make this attack unblockable. Deal 5 damage. On hit: Chi cap +1, fill Chi to max.', wikiDamage: 5, wikiTrigger: '4 Lotus' },
  { heroId: 'monk', abilityId: 'lotus-palm', level: 2, wikiName: 'Lotus Palm II', wikiDescription: '3 Lotus: Deal 2 unblockable damage, on hit gain 1 Evasive and 2 Chi. 4 Lotus: Deal 6 damage, on hit Chi cap +1 and gain 6 Chi. 5 Lotus: Deal 10 damage, on hit fill Chi to max.', wikiDamage: 2, wikiTrigger: '3/4/5 Lotus', wikiTags: ['unblockable'] },

  // --- Taiji Combo ---
  { heroId: 'monk', abilityId: 'taiji-combo', level: 1, wikiName: 'Taiji Combo', wikiDescription: 'Roll 1 die: Fist +2 damage, Palm +3 damage, Chi gain 2 Chi, Lotus choose Evasive or Purify. Deal 6 damage.', wikiDamage: 6, wikiTrigger: '3 Fists + 1 Palm' },
  { heroId: 'monk', abilityId: 'taiji-combo', level: 2, wikiName: 'Taiji Combo II', wikiDescription: 'Roll 2 dice: Fist +2 damage, Palm +3 damage, Chi gain 2 Chi, Lotus choose Evasive or Purify. Deal 5 damage.', wikiDamage: 5, wikiTrigger: '3 Fists + 1 Palm' },

  // --- Thunder Strike ---
  { heroId: 'monk', abilityId: 'thunder-strike', level: 1, wikiName: 'Thunder Strike', wikiDescription: 'Roll 3 dice. Deal damage equal to the number of Palms rolled x3. You may reroll 1 die.', wikiTrigger: '3 Palms' },
  { heroId: 'monk', abilityId: 'thunder-strike', level: 2, wikiName: 'Thunder Strike II', wikiDescription: 'Roll 3 dice. Deal damage equal to the number of Palms rolled x4. You may reroll 1 die.', wikiTrigger: '3 Palms' },

  // --- Calm Water ---
  { heroId: 'monk', abilityId: 'calm-water', level: 1, wikiName: 'Calm Water', wikiDescription: 'Deal 7 damage. On hit: gain 2 Chi and 1 Evasive.', wikiDamage: 7, wikiTrigger: 'Large Straight' },
  { heroId: 'monk', abilityId: 'calm-water', level: 2, wikiName: 'Calm Water II', wikiDescription: 'Way of the Monk (all 4 symbols): Deal 3 unblockable damage, gain 2 Evasive. Large Straight: Deal 7 damage, on hit gain 3 Chi, 1 Evasive, inflict Knockdown.', wikiDamage: 3, wikiTrigger: 'All 4 symbols / Large Straight', wikiTags: ['unblockable'] },

  // --- Meditation (Defensive) ---
  { heroId: 'monk', abilityId: 'meditation', level: 1, wikiName: 'Meditation', wikiDescription: 'Roll 4 dice. Gain Chi based on results. Deal damage for each Fist rolled.', wikiTrigger: 'Defensive Roll (4 dice)' },
  { heroId: 'monk', abilityId: 'meditation', level: 2, wikiName: 'Meditation II', wikiDescription: 'Roll 5 dice. Gain Chi based on results. Deal damage for each Fist rolled.', wikiTrigger: 'Defensive Roll (5 dice)' },
  { heroId: 'monk', abilityId: 'meditation', level: 3, wikiName: 'Meditation III', wikiDescription: 'Roll 5 dice. Gain Chi based on results. Deal damage for each Fist rolled (enhanced).', wikiTrigger: 'Defensive Roll (5 dice)' },

  // --- Transcendence (Ultimate) ---
  { heroId: 'monk', abilityId: 'transcendence', level: 1, wikiName: 'Transcendence', wikiDescription: 'Deal 10 damage. On hit: inflict Knockdown. Gain 1 Evasive and 1 Purify. On hit: Chi cap +1, fill Chi to max.', wikiDamage: 10, wikiStatusEffect: 'knockdown', wikiStatusValue: 1, wikiTrigger: '5 Lotus', wikiTags: ['ultimate'] },
];


// ============================================================================
// 火法师 (Pyromancer) 能力快照
// ============================================================================

export const PYROMANCER_ABILITY_SNAPSHOTS: WikiAbilitySnapshot[] = [
  // --- Fireball ---
  { heroId: 'pyromancer', abilityId: 'fireball', level: 1, wikiName: 'Fireball', wikiDescription: '3 Fire: Deal 4 damage, gain 1 FM. 4 Fire: Deal 6 damage, gain 1 FM. 5 Fire: Deal 8 damage, gain 1 FM.', wikiDamage: 4, wikiTrigger: '3/4/5 Fire' },
  { heroId: 'pyromancer', abilityId: 'fireball', level: 2, wikiName: 'Fireball II', wikiDescription: '3 Fire: Deal 4 damage, gain 2 FM. 4 Fire: Deal 6 damage, gain 2 FM. 5 Fire: Deal 8 damage, gain 2 FM.', wikiDamage: 4, wikiTrigger: '3/4/5 Fire' },

  // --- Soul Burn ---
  { heroId: 'pyromancer', abilityId: 'soul-burn', level: 1, wikiName: 'Soul Burn', wikiDescription: 'Gain 2x Fiery Soul count FM. Deal 1x Fiery Soul count damage.', wikiTrigger: '2 Fiery Soul' },
  { heroId: 'pyromancer', abilityId: 'soul-burn', level: 2, wikiName: 'Burning Soul II', wikiDescription: '2 Fiery Soul: Gain FM, deal damage. 3 Fiery Soul: +Inflict Burn. 5 Fiery Soul: +FM cap +1. Blazing Soul (2 Magma + 2 Fiery Soul): FM cap +1, gain 5 FM, inflict Knockdown.', wikiTrigger: '2/3/5 Fiery Soul / 2 Magma + 2 Fiery Soul', wikiStatusEffect: 'burn', wikiStatusValue: 1 },

  // --- Fiery Combo ---
  { heroId: 'pyromancer', abilityId: 'fiery-combo', level: 1, wikiName: 'Fiery Combo', wikiDescription: 'Spend all FM. Deal 2x FM spent + 2 damage.', wikiTrigger: 'Small Straight' },
  { heroId: 'pyromancer', abilityId: 'fiery-combo', level: 2, wikiName: 'Hot Streak II', wikiDescription: 'Small Straight: Gain 2 FM, spend all FM, deal 2x FM spent + 2 damage. Incinerate (2 Fire + 2 Fiery Soul): Gain 2 FM, inflict Burn, deal 6 damage.', wikiDamage: 6, wikiTrigger: 'Small Straight / 2 Fire + 2 Fiery Soul', wikiStatusEffect: 'burn', wikiStatusValue: 1 },

  // --- Meteor ---
  { heroId: 'pyromancer', abilityId: 'meteor', level: 1, wikiName: 'Meteor', wikiDescription: 'Inflict Stun. Gain 2 FM. Deal 2x FM unblockable damage. Deal 2 collateral damage.', wikiStatusEffect: 'stun', wikiStatusValue: 1, wikiTrigger: '4 Meteor', wikiTags: ['unblockable'] },
  { heroId: 'pyromancer', abilityId: 'meteor', level: 2, wikiName: 'Meteor II', wikiDescription: 'Meteor Shower (3 Meteor): Inflict Knockdown, Burn, and Stun. 4 Meteor: Inflict Stun, gain 2 FM, deal 2x FM unblockable damage, deal 3 collateral.', wikiTrigger: '3/4 Meteor', wikiTags: ['unblockable'] },

  // --- Pyro Blast ---
  { heroId: 'pyromancer', abilityId: 'pyro-blast', level: 1, wikiName: 'Pyro Blast', wikiDescription: 'Deal 6 damage. Roll 1 die: Fire +3 damage, Magma inflict Burn, Fiery Soul gain 2 FM, Meteor inflict Knockdown.', wikiDamage: 6, wikiTrigger: '3 Fire + 1 Meteor' },
  { heroId: 'pyromancer', abilityId: 'pyro-blast', level: 2, wikiName: 'Pyro Blast II', wikiDescription: 'Deal 6 damage. Roll 2 dice with enhanced effects.', wikiDamage: 6, wikiTrigger: '3 Fire + 1 Meteor' },
  { heroId: 'pyromancer', abilityId: 'pyro-blast', level: 3, wikiName: 'Pyro Blast III', wikiDescription: 'Deal 6 damage. Roll 3 dice with enhanced effects.', wikiDamage: 6, wikiTrigger: '3 Fire + 1 Meteor' },

  // --- Burn Down ---
  { heroId: 'pyromancer', abilityId: 'burn-down', level: 1, wikiName: 'Burn Down', wikiDescription: 'Gain 2 FM. Spend all FM. Deal 1x FM spent unblockable damage.', wikiTrigger: '1 Fire + 1 Magma + 1 Fiery Soul + 1 Meteor', wikiTags: ['unblockable'] },
  { heroId: 'pyromancer', abilityId: 'burn-down', level: 2, wikiName: 'Burn Down II', wikiDescription: 'Gain 3 FM. Spend all FM. Deal 2x FM spent unblockable damage.', wikiTrigger: '1 Fire + 1 Magma + 1 Fiery Soul + 1 Meteor', wikiTags: ['unblockable'] },

  // --- Ignite ---
  { heroId: 'pyromancer', abilityId: 'ignite', level: 1, wikiName: 'Ignite', wikiDescription: 'Gain 2 FM. Deal 2x FM damage. Inflict Burn.', wikiTrigger: 'Large Straight', wikiStatusEffect: 'burn', wikiStatusValue: 1 },
  { heroId: 'pyromancer', abilityId: 'ignite', level: 2, wikiName: 'Ignite II', wikiDescription: 'Gain 3 FM. Deal 2x FM damage. Inflict Burn.', wikiTrigger: 'Large Straight', wikiStatusEffect: 'burn', wikiStatusValue: 1 },

  // --- Magma Armor (Defensive) ---
  { heroId: 'pyromancer', abilityId: 'magma-armor', level: 1, wikiName: 'Magma Armor', wikiDescription: 'Roll 5 dice. Prevent damage based on Fire/Magma rolled. Gain FM for Fiery Soul. Deal damage for Meteor.', wikiTrigger: 'Defensive Roll (5 dice)' },
  { heroId: 'pyromancer', abilityId: 'magma-armor', level: 2, wikiName: 'Magma Armor II', wikiDescription: 'Roll 5 dice. Enhanced prevention and effects.', wikiTrigger: 'Defensive Roll (5 dice)' },
  { heroId: 'pyromancer', abilityId: 'magma-armor', level: 3, wikiName: 'Magma Armor III', wikiDescription: 'Roll 5 dice. Further enhanced prevention and effects.', wikiTrigger: 'Defensive Roll (5 dice)' },

  // --- Ultimate Inferno (Ultimate) ---
  { heroId: 'pyromancer', abilityId: 'ultimate-inferno', level: 1, wikiName: 'Ultimate Inferno', wikiDescription: 'Inflict Knockdown and Burn. Gain 3 FM. Deal 12 damage. Deal 2 collateral damage.', wikiDamage: 12, wikiStatusEffect: 'burn', wikiStatusValue: 1, wikiTrigger: '5 Meteor', wikiTags: ['ultimate'] },
];


// ============================================================================
// 月精灵 (Moon Elf) 能力快照
// ============================================================================

export const MOON_ELF_ABILITY_SNAPSHOTS: WikiAbilitySnapshot[] = [
  // --- Longbow ---
  { heroId: 'moon_elf', abilityId: 'longbow', level: 1, wikiName: 'Longbow', wikiDescription: '3 Bows: Deal 3 damage. 4 Bows: Deal 5 damage. 5 Bows: Deal 7 damage.', wikiDamage: 3, wikiTrigger: '3/4/5 Bows' },
  { heroId: 'moon_elf', abilityId: 'longbow', level: 2, wikiName: 'Longbow II', wikiDescription: '3 Bows: Deal 4 damage. 4 Bows: Deal 6 damage. 5 Bows: Deal 8 damage. If 4+ same symbol, inflict Entangle.', wikiDamage: 4, wikiTrigger: '3/4/5 Bows' },
  { heroId: 'moon_elf', abilityId: 'longbow', level: 3, wikiName: 'Longbow III', wikiDescription: '3 Bows: Deal 5 damage. 4 Bows: Deal 7 damage. 5 Bows: Deal 9 damage. If 3+ same symbol, inflict Entangle.', wikiDamage: 5, wikiTrigger: '3/4/5 Bows' },

  // --- Covert Fire ---
  { heroId: 'moon_elf', abilityId: 'covert-fire', level: 1, wikiName: 'Covert Fire', wikiDescription: 'Inflict Targeted. Deal 4 damage.', wikiDamage: 4, wikiStatusEffect: 'targeted', wikiStatusValue: 1, wikiTrigger: '3 Bows + 3 Moons' },
  { heroId: 'moon_elf', abilityId: 'covert-fire', level: 2, wikiName: 'Covert Fire II', wikiDescription: 'Focus (2 Bows + 1 Moon): Inflict Targeted and Entangle. Deadeye Shot (3 Bows + 2 Moons): Inflict Targeted, deal 6 damage.', wikiDamage: 6, wikiTrigger: '2 Bows + 1 Moon / 3 Bows + 2 Moons' },

  // --- Covering Fire ---
  { heroId: 'moon_elf', abilityId: 'covering-fire', level: 1, wikiName: 'Covering Fire', wikiDescription: 'Gain 1 Evasive. Deal 7 damage.', wikiDamage: 7, wikiTrigger: '2 Bows + 3 Feet' },
  { heroId: 'moon_elf', abilityId: 'covering-fire', level: 2, wikiName: 'Covering Fire II', wikiDescription: 'Silencing Trace (3 Feet): Gain 1 Evasive, deal 2 unblockable damage. Covering Fire II (2 Bows + 3 Feet): Gain 1 Evasive, deal 9 damage.', wikiDamage: 9, wikiTrigger: '3 Feet / 2 Bows + 3 Feet', wikiTags: ['unblockable'] },

  // --- Exploding Arrow ---
  { heroId: 'moon_elf', abilityId: 'exploding-arrow', level: 1, wikiName: 'Exploding Arrow', wikiDescription: 'Roll dice and resolve based on results.', wikiTrigger: '1 Bow + 3 Moons' },
  { heroId: 'moon_elf', abilityId: 'exploding-arrow', level: 2, wikiName: 'Exploding Arrow II', wikiDescription: 'Roll dice and resolve with enhanced effects.', wikiTrigger: '1 Bow + 3 Moons' },
  { heroId: 'moon_elf', abilityId: 'exploding-arrow', level: 3, wikiName: 'Exploding Arrow III', wikiDescription: 'Roll dice and resolve with further enhanced effects.', wikiTrigger: '1 Bow + 3 Moons' },

  // --- Entangling Shot ---
  { heroId: 'moon_elf', abilityId: 'entangling-shot', level: 1, wikiName: 'Entangling Shot', wikiDescription: 'Inflict Entangle. Deal 7 damage.', wikiDamage: 7, wikiStatusEffect: 'entangle', wikiStatusValue: 1, wikiTrigger: 'Small Straight' },
  { heroId: 'moon_elf', abilityId: 'entangling-shot', level: 2, wikiName: 'Entangling Shot II', wikiDescription: 'Inflict Entangle. Deal 9 damage.', wikiDamage: 9, wikiStatusEffect: 'entangle', wikiStatusValue: 1, wikiTrigger: 'Small Straight' },

  // --- Eclipse ---
  { heroId: 'moon_elf', abilityId: 'eclipse', level: 1, wikiName: 'Eclipse', wikiDescription: 'Inflict Targeted, Entangle, and Blinded. Deal 7 damage.', wikiDamage: 7, wikiTrigger: '4 Moons' },
  { heroId: 'moon_elf', abilityId: 'eclipse', level: 2, wikiName: 'Eclipse II', wikiDescription: 'Dark Moon (3 Moons): Gain 1 Evasive, inflict Blinded, Entangle, Targeted. Eclipse II (4 Moons): Inflict Blinded, Entangle, Targeted, deal 9 damage.', wikiDamage: 9, wikiTrigger: '3/4 Moons' },

  // --- Blinding Shot ---
  { heroId: 'moon_elf', abilityId: 'blinding-shot', level: 1, wikiName: 'Blinding Shot', wikiDescription: 'Inflict Blinded. Gain 1 Evasive. Deal 8 damage.', wikiDamage: 8, wikiStatusEffect: 'blinded', wikiStatusValue: 1, wikiTrigger: 'Large Straight' },
  { heroId: 'moon_elf', abilityId: 'blinding-shot', level: 2, wikiName: 'Blinding Shot II', wikiDescription: "Moon's Blessing (1 Bow + 2 Feet + 1 Moon): Gain 3 Evasive, inflict Entangle. Blinding Shot II (Large Straight): Inflict Blinded, gain 1 Evasive, deal 10 damage.", wikiDamage: 10, wikiTrigger: '1 Bow + 2 Feet + 1 Moon / Large Straight' },

  // --- Lunar Eclipse (Ultimate) ---
  { heroId: 'moon_elf', abilityId: 'lunar-eclipse', level: 1, wikiName: 'Lunar Eclipse', wikiDescription: 'Gain 1 Evasive. Inflict Blinded, Entangle, and Targeted. Deal 13 damage.', wikiDamage: 13, wikiTrigger: '5 Moons', wikiTags: ['ultimate'] },

  // --- Elusive Step (Defensive) ---
  { heroId: 'moon_elf', abilityId: 'elusive-step', level: 1, wikiName: 'Elusive Step', wikiDescription: 'Roll 5 dice. Resolve defense based on results.', wikiTrigger: 'Defensive Roll (5 dice)' },
  { heroId: 'moon_elf', abilityId: 'elusive-step', level: 2, wikiName: 'Elusive Step II', wikiDescription: 'Roll 5 dice. Enhanced defense resolution.', wikiTrigger: 'Defensive Roll (5 dice)' },
];


// ============================================================================
// 暗影刺客 (Shadow Thief) 能力快照
// ============================================================================

export const SHADOW_THIEF_ABILITY_SNAPSHOTS: WikiAbilitySnapshot[] = [
  // --- Dagger Strike ---
  { heroId: 'shadow_thief', abilityId: 'dagger-strike', level: 1, wikiName: 'Dagger Strike', wikiDescription: '3 Daggers: Deal 4 damage. 4 Daggers: Deal 6 damage. 5 Daggers: Deal 8 damage. Per Bag: gain 1 CP. Per Shadow: inflict 1 Poison.', wikiDamage: 4, wikiTrigger: '3/4/5 Daggers' },
  { heroId: 'shadow_thief', abilityId: 'dagger-strike', level: 2, wikiName: 'Dagger Strike II', wikiDescription: '3 Daggers: Deal 4 damage, gain 1 CP, per Shadow inflict Poison, per Card draw 1. 4 Daggers: Deal 6 damage (same bonuses). 5 Daggers: Deal 8 damage (same bonuses).', wikiDamage: 4, wikiTrigger: '3/4/5 Daggers' },

  // --- Pickpocket ---
  { heroId: 'shadow_thief', abilityId: 'pickpocket', level: 1, wikiName: 'Pickpocket', wikiDescription: 'Gain 3 CP. Deal damage equal to half your CP (rounded up).', wikiTrigger: 'Small Straight' },
  { heroId: 'shadow_thief', abilityId: 'pickpocket', level: 2, wikiName: 'Pickpocket II', wikiDescription: 'Pickpocket II (Small Straight): Gain 4 CP, deal half CP damage. Shadow Assault (2 Daggers + 2 Shadows): Deal half CP damage, inflict Poison.', wikiTrigger: 'Small Straight / 2 Daggers + 2 Shadows', wikiStatusEffect: 'poison', wikiStatusValue: 1 },

  // --- Steal ---
  { heroId: 'shadow_thief', abilityId: 'steal', level: 1, wikiName: 'Steal', wikiDescription: '2 Bags: Gain 2 CP (steal if Shadow present). 3 Bags: Gain 3 CP. 4 Bags: Gain 4 CP.', wikiTrigger: '2/3/4 Bags' },
  { heroId: 'shadow_thief', abilityId: 'steal', level: 2, wikiName: 'Steal II', wikiDescription: '2 Bags: Gain 3 CP. 3 Bags: Gain 4 CP. 4 Bags: Gain 5 CP. 5 Bags: Gain 6 CP. (steal if Shadow present)', wikiTrigger: '2/3/4/5 Bags' },

  // --- Kidney Shot ---
  { heroId: 'shadow_thief', abilityId: 'kidney-shot', level: 1, wikiName: 'Kidney Shot', wikiDescription: 'Gain 4 CP. Deal damage equal to your CP.', wikiTrigger: 'Large Straight' },
  { heroId: 'shadow_thief', abilityId: 'kidney-shot', level: 2, wikiName: 'Kidney Shot II', wikiDescription: 'Kidney Shot II (Large Straight): Gain 4 CP, deal CP damage. Piercing Attack (1 each symbol): Gain 1 CP, gain Sneak Attack, draw 1, inflict Poison.', wikiTrigger: 'Large Straight / 1 Dagger + 1 Bag + 1 Card + 1 Shadow', wikiStatusEffect: 'poison', wikiStatusValue: 1 },

  // --- Shadow Dance ---
  { heroId: 'shadow_thief', abilityId: 'shadow-dance', level: 1, wikiName: 'Shadow Dance', wikiDescription: 'Roll 1 die, deal half the result as damage. Gain 1 Sneak and 1 Sneak Attack.', wikiTrigger: '3 Shadows' },
  { heroId: 'shadow_thief', abilityId: 'shadow-dance', level: 2, wikiName: 'Shadow Dance II', wikiDescription: 'Roll 1 die, deal half the result as unblockable (true) damage.', wikiTrigger: '3 Shadows', wikiTags: ['unblockable'] },

  // --- Cornucopia ---
  { heroId: 'shadow_thief', abilityId: 'cornucopia', level: 1, wikiName: 'Cornucopia', wikiDescription: 'Draw 1 card per Card face. If Shadow present, opponent discards 1 card.', wikiTrigger: '2 Cards' },
  { heroId: 'shadow_thief', abilityId: 'cornucopia', level: 2, wikiName: 'Cornucopia II', wikiDescription: 'Per Card draw 1. Per Shadow opponent discards 1. Per Bag gain 1 CP.', wikiTrigger: '2 Cards' },

  // --- Shadow Shank (Ultimate) ---
  { heroId: 'shadow_thief', abilityId: 'shadow-shank', level: 1, wikiName: 'Shadow Shank', wikiDescription: 'Gain 3 CP. Deal CP + 5 damage. Remove all debuffs. Gain 1 Sneak.', wikiTrigger: '5 Shadows', wikiTags: ['ultimate'] },

  // --- Shadow Defense (Defensive) ---
  { heroId: 'shadow_thief', abilityId: 'shadow-defense', level: 1, wikiName: 'Shadow Defense', wikiDescription: 'Roll 4 dice. Resolve defense based on results.', wikiTrigger: 'Defensive Roll (4 dice)' },
  { heroId: 'shadow_thief', abilityId: 'shadow-defense', level: 2, wikiName: 'Shadow Defense II', wikiDescription: 'Roll 5 dice. Enhanced defense resolution.', wikiTrigger: 'Defensive Roll (5 dice)' },

  // --- Fearless Riposte (Defensive) ---
  { heroId: 'shadow_thief', abilityId: 'fearless-riposte', level: 1, wikiName: 'Fearless Riposte', wikiDescription: 'Roll 5 dice. Deal damage per Dagger. If Dagger + Shadow, inflict Poison.', wikiTrigger: 'Defensive Roll (5 dice)' },
  { heroId: 'shadow_thief', abilityId: 'fearless-riposte', level: 2, wikiName: 'Fearless Riposte II', wikiDescription: 'Roll 5 dice. Enhanced riposte effects.', wikiTrigger: 'Defensive Roll (5 dice)' },
];


// ============================================================================
// 圣骑士 (Paladin) 能力快照
// ============================================================================

export const PALADIN_ABILITY_SNAPSHOTS: WikiAbilitySnapshot[] = [
  // --- Righteous Combat ---
  { heroId: 'paladin', abilityId: 'righteous-combat', level: 1, wikiName: 'Righteous Combat', wikiDescription: 'Deal 5 damage. Roll 2 dice: Helm +1 damage, Sword +2 damage, Heart heal 2, Pray +1 CP.', wikiDamage: 5, wikiTrigger: '3 Swords + 2 Helms' },
  { heroId: 'paladin', abilityId: 'righteous-combat', level: 2, wikiName: 'Righteous Combat II', wikiDescription: 'Deal 5 damage, roll 3 dice with bonuses (Helm +1 damage, Sword +2 damage, Heart heal 2, Pray +1 CP).', wikiDamage: 5, wikiTrigger: '3 Swords + 2 Helms' },
  { heroId: 'paladin', abilityId: 'righteous-combat', level: 3, wikiName: 'Righteous Combat III', wikiDescription: 'Tenacity (2 Swords + 1 Helm): Heal 2, deal 2 unblockable damage. Main (3 Swords + 2 Helms): Deal 6 damage, roll 3 dice with bonuses.', wikiDamage: 6, wikiTrigger: '2 Swords + 1 Helm / 3 Swords + 2 Helms', wikiTags: ['unblockable'] },

  // --- Blessing of Might ---
  { heroId: 'paladin', abilityId: 'blessing-of-might', level: 1, wikiName: 'Blessing of Might', wikiDescription: 'Deal 3 unblockable damage. Gain 1 Crit and 1 Accuracy.', wikiDamage: 3, wikiTrigger: '3 Swords + 1 Pray', wikiTags: ['unblockable'] },
  { heroId: 'paladin', abilityId: 'blessing-of-might', level: 2, wikiName: 'Blessing of Might II', wikiDescription: 'Offensive Stance (2 Swords + 1 Pray): Deal 2 unblockable damage, choose Crit or Accuracy. Might Disciple II (3 Swords + 1 Pray): Deal 4 unblockable damage, gain 1 Crit and 1 Accuracy.', wikiDamage: 4, wikiTrigger: '2 Swords + 1 Pray / 3 Swords + 1 Pray', wikiTags: ['unblockable'] },

  // --- Holy Strike ---
  { heroId: 'paladin', abilityId: 'holy-strike', level: 1, wikiName: 'Holy Strike', wikiDescription: 'Small Straight: Heal 1, deal 5 damage. Large Straight: Heal 2, deal 8 damage.', wikiDamage: 5, wikiHeal: 1, wikiTrigger: 'Small Straight / Large Straight' },
  { heroId: 'paladin', abilityId: 'holy-strike', level: 2, wikiName: 'Holy Strike II', wikiDescription: 'Small Straight: Heal 1, deal 7 damage. Large Straight: Heal 2, deal 9 damage.', wikiDamage: 7, wikiHeal: 1, wikiTrigger: 'Small Straight / Large Straight' },

  // --- Holy Light ---
  { heroId: 'paladin', abilityId: 'holy-light', level: 1, wikiName: 'Holy Light', wikiDescription: 'Heal 2 per Heart rolled. Roll 1 die: Sword gain Crit, Helm gain Protect, Heart draw 1, Pray gain 2 CP.', wikiHeal: 2, wikiTrigger: '2 Hearts' },
  { heroId: 'paladin', abilityId: 'holy-light', level: 2, wikiName: 'Holy Light II', wikiDescription: 'Heal 2 per Heart rolled. Roll 3 dice: Sword gain Crit, Helm gain Protect, Heart draw 1, Pray gain 2 CP.', wikiHeal: 2, wikiTrigger: '2 Hearts' },

  // --- Vengeance ---
  { heroId: 'paladin', abilityId: 'vengeance', level: 1, wikiName: 'Vengeance', wikiDescription: 'Gain 1 Retribution. Gain 2 CP.', wikiTrigger: '3 Helms + 1 Pray' },
  { heroId: 'paladin', abilityId: 'vengeance', level: 2, wikiName: 'Vengeance II', wikiDescription: 'Vengeance (all 4 symbols): Gain 1 Retribution, heal 1, deal 3 unblockable damage. Retribution II (3 Helms + 1 Pray): Give any player 1 Retribution, gain 4 CP.', wikiTrigger: 'All 4 symbols / 3 Helms + 1 Pray', wikiTags: ['unblockable'] },

  // --- Righteous Prayer ---
  { heroId: 'paladin', abilityId: 'righteous-prayer', level: 1, wikiName: 'Righteous Prayer', wikiDescription: 'Deal 8 damage. Gain 1 Crit. Gain 2 CP.', wikiDamage: 8, wikiTrigger: '4 Prays' },
  { heroId: 'paladin', abilityId: 'righteous-prayer', level: 2, wikiName: 'Righteous Prayer II', wikiDescription: 'Prosperity (3 Prays): Gain 4 CP. Righteous Prayer II (4 Prays): Deal 8 unblockable damage, gain 1 Crit, gain 2 CP.', wikiDamage: 8, wikiTrigger: '3/4 Prays', wikiTags: ['unblockable'] },

  // --- Holy Defense (Defensive) ---
  { heroId: 'paladin', abilityId: 'holy-defense', level: 1, wikiName: 'Holy Defense', wikiDescription: 'Roll 3 dice. Resolve defense based on results.', wikiTrigger: 'Defensive Roll (3 dice)' },
  { heroId: 'paladin', abilityId: 'holy-defense', level: 2, wikiName: 'Holy Defense II', wikiDescription: 'Roll 4 dice. Enhanced defense resolution.', wikiTrigger: 'Defensive Roll (4 dice)' },
  { heroId: 'paladin', abilityId: 'holy-defense', level: 3, wikiName: 'Holy Defense III', wikiDescription: 'Roll 4 dice. Further enhanced defense resolution.', wikiTrigger: 'Defensive Roll (4 dice)' },

  // --- Unyielding Faith (Ultimate) ---
  { heroId: 'paladin', abilityId: 'unyielding-faith', level: 1, wikiName: 'Unyielding Faith', wikiDescription: 'Heal 5. Deal 10 unblockable damage. Gain 1 Blessing of Divinity.', wikiDamage: 10, wikiHeal: 5, wikiTrigger: '5 Prays', wikiTags: ['ultimate'] },
];


// ============================================================================
// 合并所有角色能力快照
// ============================================================================

export const ALL_ABILITY_SNAPSHOTS: WikiAbilitySnapshot[] = [
  ...BARBARIAN_ABILITY_SNAPSHOTS,
  ...MONK_ABILITY_SNAPSHOTS,
  ...PYROMANCER_ABILITY_SNAPSHOTS,
  ...MOON_ELF_ABILITY_SNAPSHOTS,
  ...SHADOW_THIEF_ABILITY_SNAPSHOTS,
  ...PALADIN_ABILITY_SNAPSHOTS,
];

// ============================================================================
// Token 快照
// ============================================================================

export const BARBARIAN_TOKEN_SNAPSHOTS: WikiTokenSnapshot[] = [
  { heroId: 'barbarian', tokenId: 'concussion', wikiName: 'Concussion', wikiDescription: 'Skip your next Income Phase. Then remove this token.', wikiTiming: 'onPhaseEnter', wikiStackLimit: 1, wikiCategory: 'debuff' },
  { heroId: 'barbarian', tokenId: 'daze', wikiName: 'Daze', wikiDescription: 'After your attack ends, remove this token and the attacker attacks again.', wikiTiming: 'onAttackEnd', wikiStackLimit: 1, wikiCategory: 'debuff' },
];

export const MONK_TOKEN_SNAPSHOTS: WikiTokenSnapshot[] = [
  { heroId: 'monk', tokenId: 'taiji', wikiName: 'Chi', wikiDescription: 'Spend 1 Chi to add or prevent 1 damage.', wikiTiming: 'beforeDamageDealt/beforeDamageReceived', wikiStackLimit: 5, wikiCategory: 'consumable' },
  { heroId: 'monk', tokenId: 'evasive', wikiName: 'Evasive', wikiDescription: 'Spend 1 Evasive. Roll 1 die. If 1-2, reduce incoming damage to 0.', wikiTiming: 'beforeDamageReceived', wikiStackLimit: 3, wikiCategory: 'consumable' },
  { heroId: 'monk', tokenId: 'purify', wikiName: 'Purify', wikiDescription: 'Spend 1 Purify to remove a negative status effect from yourself.', wikiTiming: 'anytime', wikiStackLimit: 3, wikiCategory: 'consumable' },
  { heroId: 'monk', tokenId: 'knockdown', wikiName: 'Knockdown', wikiDescription: 'Skip your next Offensive Roll Phase. You may spend 2 CP to remove this instead.', wikiTiming: 'onPhaseEnter', wikiStackLimit: 1, wikiCategory: 'debuff' },
];

export const PYROMANCER_TOKEN_SNAPSHOTS: WikiTokenSnapshot[] = [
  { heroId: 'pyromancer', tokenId: 'fire_mastery', wikiName: 'Fire Mastery', wikiDescription: 'Used by abilities to increase fire damage. Consumed by abilities automatically.', wikiStackLimit: 5, wikiCategory: 'consumable' },
  { heroId: 'pyromancer', tokenId: 'knockdown', wikiName: 'Knockdown', wikiDescription: 'Skip your next Offensive Roll Phase. You may spend 2 CP to remove this instead.', wikiTiming: 'onPhaseEnter', wikiStackLimit: 1, wikiCategory: 'debuff' },
  { heroId: 'pyromancer', tokenId: 'burn', wikiName: 'Burn', wikiDescription: 'At the start of your turn, take 2 undefendable damage. Then remove this token.', wikiTiming: 'onTurnStart', wikiStackLimit: 1, wikiCategory: 'debuff' },
  { heroId: 'pyromancer', tokenId: 'stun', wikiName: 'Stun', wikiDescription: 'Skip your next Offensive Roll Phase. Then remove this token.', wikiTiming: 'onPhaseEnter', wikiStackLimit: 1, wikiCategory: 'debuff' },
];

export const MOON_ELF_TOKEN_SNAPSHOTS: WikiTokenSnapshot[] = [
  { heroId: 'moon_elf', tokenId: 'evasive', wikiName: 'Evasive', wikiDescription: 'Spend 1 Evasive. Roll 1 die. If 1-2, reduce incoming damage to 0.', wikiTiming: 'beforeDamageReceived', wikiStackLimit: 3, wikiCategory: 'consumable' },
  { heroId: 'moon_elf', tokenId: 'blinded', wikiName: 'Blinded', wikiDescription: 'After your Offensive Roll Phase, roll 1 die. If 1-2, your attack deals no damage. Then remove this token.', wikiTiming: 'onPhaseEnter', wikiStackLimit: 1, wikiCategory: 'debuff' },
  { heroId: 'moon_elf', tokenId: 'entangle', wikiName: 'Entangle', wikiDescription: 'You have 1 fewer roll attempt during your next Offensive Roll Phase. Then remove this token.', wikiTiming: 'onPhaseEnter', wikiStackLimit: 1, wikiCategory: 'debuff' },
  { heroId: 'moon_elf', tokenId: 'targeted', wikiName: 'Targeted', wikiDescription: 'When you take damage from an opponent\'s Offensive Roll Phase, take 2 additional damage. Then remove this token.', wikiTiming: 'onDamageReceived', wikiStackLimit: 1, wikiCategory: 'debuff' },
];

export const SHADOW_THIEF_TOKEN_SNAPSHOTS: WikiTokenSnapshot[] = [
  { heroId: 'shadow_thief', tokenId: 'sneak', wikiName: 'Sneak', wikiDescription: 'While you have Sneak, you cannot be targeted by attacks. Removed at the end of your next turn.', wikiStackLimit: 1, wikiCategory: 'buff' },
  { heroId: 'shadow_thief', tokenId: 'sneak_attack', wikiName: 'Sneak Attack', wikiDescription: 'Spend before dealing damage to add bonus damage.', wikiTiming: 'beforeDamageDealt', wikiStackLimit: 1, wikiCategory: 'consumable' },
  { heroId: 'shadow_thief', tokenId: 'poison', wikiName: 'Poison', wikiDescription: 'At the start of your turn, take damage equal to your Poison stacks. Then remove 1 stack.', wikiTiming: 'onTurnStart', wikiStackLimit: 3, wikiCategory: 'debuff' },
];

export const PALADIN_TOKEN_SNAPSHOTS: WikiTokenSnapshot[] = [
  { heroId: 'paladin', tokenId: 'crit', wikiName: 'Crit', wikiDescription: 'After your Offensive Roll Phase, if you dealt 5+ damage, spend to deal 4 additional damage.', wikiTiming: 'onOffensiveRollEnd', wikiStackLimit: 1, wikiCategory: 'consumable' },
  { heroId: 'paladin', tokenId: 'accuracy', wikiName: 'Accuracy', wikiDescription: 'After your Offensive Roll Phase, spend to make your attack undefendable.', wikiTiming: 'onOffensiveRollEnd', wikiStackLimit: 1, wikiCategory: 'consumable' },
  { heroId: 'paladin', tokenId: 'protect', wikiName: 'Protect', wikiDescription: 'Spend to halve incoming damage (rounded up).', wikiTiming: 'beforeDamageReceived', wikiStackLimit: 1, wikiCategory: 'consumable' },
  { heroId: 'paladin', tokenId: 'retribution', wikiName: 'Retribution', wikiDescription: 'When you take attack damage, spend to deal half that damage (rounded up) back to the attacker.', wikiTiming: 'beforeDamageReceived', wikiStackLimit: 1, wikiCategory: 'consumable' },
  { heroId: 'paladin', tokenId: 'blessing_of_divinity', wikiName: 'Blessing of Divinity', wikiDescription: 'When you would be reduced to 0 HP, remove this token, set HP to 1, and heal 5.', wikiTiming: 'onDamageReceived', wikiStackLimit: 1, wikiCategory: 'consumable' },
  { heroId: 'paladin', tokenId: 'tithes_upgraded', wikiName: 'Tithes Upgraded', wikiDescription: 'Passive: Income Phase grants 2 CP instead of 1. Draw card costs 2 CP instead of 3. Gain 1 CP when activating an ability with Pray face.', wikiStackLimit: 1, wikiCategory: 'unique' },
];

export const ALL_TOKEN_SNAPSHOTS: WikiTokenSnapshot[] = [
  ...BARBARIAN_TOKEN_SNAPSHOTS,
  ...MONK_TOKEN_SNAPSHOTS,
  ...PYROMANCER_TOKEN_SNAPSHOTS,
  ...MOON_ELF_TOKEN_SNAPSHOTS,
  ...SHADOW_THIEF_TOKEN_SNAPSHOTS,
  ...PALADIN_TOKEN_SNAPSHOTS,
];


// ============================================================================
// 专属卡快照 - 狂战士 (Barbarian)
// ============================================================================

export const BARBARIAN_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  { cardId: 'card-energetic', heroId: 'barbarian', wikiName: 'Energetic', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Roll 1 die: Strength - heal 2 and inflict Concussion; otherwise draw 1 card.', wikiType: 'action' },
  { cardId: 'card-dizzy', heroId: 'barbarian', wikiName: 'Dizzy', wikiCpCost: 0, wikiTiming: 'roll', wikiDescription: 'If you dealt 8+ damage this attack, inflict Concussion.', wikiType: 'action' },
  { cardId: 'card-head-blow', heroId: 'barbarian', wikiName: 'Head Blow', wikiCpCost: 1, wikiTiming: 'instant', wikiDescription: 'Inflict Concussion on opponent.', wikiType: 'action' },
  { cardId: 'card-lucky', heroId: 'barbarian', wikiName: 'Lucky', wikiCpCost: 0, wikiTiming: 'instant', wikiDescription: 'Roll 3 dice: Heal 1 + 2 per Heart rolled.', wikiType: 'action' },
  { cardId: 'card-more-please', heroId: 'barbarian', wikiName: 'More Please', wikiCpCost: 2, wikiTiming: 'roll', wikiDescription: 'Roll 5 dice: Add 1 damage per Sword. Inflict Concussion.', wikiType: 'action' },
  { cardId: 'card-thick-skin-2', heroId: 'barbarian', wikiName: 'Thick Skin II', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Thick Skin to level II.', wikiType: 'upgrade' },
  { cardId: 'card-slap-2', heroId: 'barbarian', wikiName: 'Slap II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Slap to level II.', wikiType: 'upgrade' },
  { cardId: 'card-slap-3', heroId: 'barbarian', wikiName: 'Slap III', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Slap to level III.', wikiType: 'upgrade' },
  { cardId: 'card-all-out-strike-2', heroId: 'barbarian', wikiName: 'All-Out Strike II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade All-Out Strike to level II.', wikiType: 'upgrade' },
  { cardId: 'card-all-out-strike-3', heroId: 'barbarian', wikiName: 'All-Out Strike III', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade All-Out Strike to level III.', wikiType: 'upgrade' },
  { cardId: 'card-powerful-strike-2', heroId: 'barbarian', wikiName: 'Powerful Strike II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Powerful Strike to level II.', wikiType: 'upgrade' },
  { cardId: 'card-reckless-strike-2', heroId: 'barbarian', wikiName: 'Reckless Strike II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Reckless Strike to level II.', wikiType: 'upgrade' },
  { cardId: 'card-suppress-2', heroId: 'barbarian', wikiName: 'Suppress II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Suppress to level II.', wikiType: 'upgrade' },
  { cardId: 'card-steadfast-2', heroId: 'barbarian', wikiName: 'Steadfast II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Steadfast to level II.', wikiType: 'upgrade' },
  { cardId: 'card-violent-assault-2', heroId: 'barbarian', wikiName: 'Violent Assault II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Violent Assault to level II.', wikiType: 'upgrade' },
];

// ============================================================================
// 专属卡快照 - 僧侣 (Monk)
// ============================================================================

export const MONK_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  { cardId: 'card-enlightenment', heroId: 'monk', wikiName: 'Enlightenment', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Roll 1 die: Lotus - gain 2 Chi, 1 Evasive, 1 Purify; otherwise draw 1 card.', wikiType: 'action' },
  { cardId: 'card-inner-peace', heroId: 'monk', wikiName: 'Inner Peace', wikiCpCost: 0, wikiTiming: 'instant', wikiDescription: 'Gain 2 Chi.', wikiType: 'action' },
  { cardId: 'card-deep-thought', heroId: 'monk', wikiName: 'Deep Thought', wikiCpCost: 3, wikiTiming: 'instant', wikiDescription: 'Gain 5 Chi.', wikiType: 'action' },
  { cardId: 'card-buddha-light', heroId: 'monk', wikiName: 'Buddha Light', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Gain 1 Chi, 1 Evasive, 1 Purify. Inflict Knockdown on opponent.', wikiType: 'action' },
  { cardId: 'card-palm-strike', heroId: 'monk', wikiName: 'Palm Strike', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Inflict Knockdown on opponent.', wikiType: 'action' },
  { cardId: 'card-meditation-3', heroId: 'monk', wikiName: 'Meditation III', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Meditation to level III.', wikiType: 'upgrade' },
  { cardId: 'card-meditation-2', heroId: 'monk', wikiName: 'Meditation II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Meditation to level II.', wikiType: 'upgrade' },
  { cardId: 'card-zen-fist-2', heroId: 'monk', wikiName: 'Calm Water II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Calm Water to level II.', wikiType: 'upgrade' },
  { cardId: 'card-storm-assault-2', heroId: 'monk', wikiName: 'Thunder Strike II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Thunder Strike to level II.', wikiType: 'upgrade' },
  { cardId: 'card-combo-punch-2', heroId: 'monk', wikiName: 'Taiji Combo II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Taiji Combo to level II.', wikiType: 'upgrade' },
  { cardId: 'card-lotus-bloom-2', heroId: 'monk', wikiName: 'Lotus Palm II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Lotus Palm to level II.', wikiType: 'upgrade' },
  { cardId: 'card-mahayana-2', heroId: 'monk', wikiName: 'Harmony II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Harmony to level II.', wikiType: 'upgrade' },
  { cardId: 'card-thrust-punch-2', heroId: 'monk', wikiName: 'Fist Technique II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Fist Technique to level II.', wikiType: 'upgrade' },
  { cardId: 'card-thrust-punch-3', heroId: 'monk', wikiName: 'Fist Technique III', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Fist Technique to level III.', wikiType: 'upgrade' },
  { cardId: 'card-contemplation-2', heroId: 'monk', wikiName: 'Zen Forget II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Zen Forget to level II.', wikiType: 'upgrade' },
];


// ============================================================================
// 专属卡快照 - 火法师 (Pyromancer)
// ============================================================================

export const PYROMANCER_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  { cardId: 'card-turning-up-the-heat', heroId: 'pyromancer', wikiName: 'Turning Up the Heat', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Gain 1 FM. You may spend CP to gain additional FM (1 CP per FM).', wikiType: 'action' },
  { cardId: 'card-infernal-embrace', heroId: 'pyromancer', wikiName: 'Infernal Embrace', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Roll 1 die: Fire - gain 2 FM; otherwise draw 1 card.', wikiType: 'action' },
  { cardId: 'card-fan-the-flames', heroId: 'pyromancer', wikiName: 'Fan the Flames', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'FM cap +1. Gain 2 FM.', wikiType: 'action' },
  { cardId: 'card-red-hot', heroId: 'pyromancer', wikiName: 'Red Hot', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'Deal 1 damage per FM you have.', wikiType: 'action' },
  { cardId: 'card-get-fired-up', heroId: 'pyromancer', wikiName: 'Get Fired Up', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'Roll dice for bonus fire effects.', wikiType: 'action' },
  { cardId: 'card-magma-armor-2', heroId: 'pyromancer', wikiName: 'Magma Armor II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Magma Armor to level II.', wikiType: 'upgrade' },
  { cardId: 'card-magma-armor-3', heroId: 'pyromancer', wikiName: 'Magma Armor III', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Magma Armor to level III.', wikiType: 'upgrade' },
  { cardId: 'card-fireball-2', heroId: 'pyromancer', wikiName: 'Fireball II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Fireball to level II.', wikiType: 'upgrade' },
  { cardId: 'card-burning-soul-2', heroId: 'pyromancer', wikiName: 'Burning Soul II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Soul Burn to level II.', wikiType: 'upgrade' },
  { cardId: 'card-hot-streak-2', heroId: 'pyromancer', wikiName: 'Hot Streak II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Fiery Combo to level II.', wikiType: 'upgrade' },
  { cardId: 'card-meteor-2', heroId: 'pyromancer', wikiName: 'Meteor II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Meteor to level II.', wikiType: 'upgrade' },
  { cardId: 'card-pyro-blast-2', heroId: 'pyromancer', wikiName: 'Pyro Blast II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Pyro Blast to level II.', wikiType: 'upgrade' },
  { cardId: 'card-pyro-blast-3', heroId: 'pyromancer', wikiName: 'Pyro Blast III', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Pyro Blast to level III.', wikiType: 'upgrade' },
  { cardId: 'card-burn-down-2', heroId: 'pyromancer', wikiName: 'Burn Down II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Burn Down to level II.', wikiType: 'upgrade' },
  { cardId: 'card-ignite-2', heroId: 'pyromancer', wikiName: 'Ignite II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Ignite to level II.', wikiType: 'upgrade' },
];

// ============================================================================
// 专属卡快照 - 月精灵 (Moon Elf)
// ============================================================================

export const MOON_ELF_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  { cardId: 'moon-shadow-strike', heroId: 'moon_elf', wikiName: 'Moon Shadow Strike', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Deal damage based on dice roll.', wikiType: 'action' },
  { cardId: 'dodge', heroId: 'moon_elf', wikiName: 'Dodge', wikiCpCost: 1, wikiTiming: 'instant', wikiDescription: 'Gain 1 Evasive.', wikiType: 'action' },
  { cardId: 'volley', heroId: 'moon_elf', wikiName: 'Volley', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'Attack modifier: add bonus damage.', wikiType: 'action' },
  { cardId: 'watch-out', heroId: 'moon_elf', wikiName: 'Watch Out', wikiCpCost: 0, wikiTiming: 'roll', wikiDescription: 'Attack modifier: bonus effect.', wikiType: 'action' },
  { cardId: 'moonlight-magic', heroId: 'moon_elf', wikiName: 'Moonlight Magic', wikiCpCost: 4, wikiTiming: 'main', wikiDescription: 'Gain 1 Evasive. Inflict Blinded, Entangle, and Targeted.', wikiType: 'action' },
  { cardId: 'upgrade-elusive-step-2', heroId: 'moon_elf', wikiName: 'Elusive Step II', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Elusive Step to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-eclipse-2', heroId: 'moon_elf', wikiName: 'Eclipse II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Eclipse to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-blinding-shot-2', heroId: 'moon_elf', wikiName: 'Blinding Shot II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Blinding Shot to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-entangling-shot-2', heroId: 'moon_elf', wikiName: 'Entangling Shot II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Entangling Shot to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-exploding-arrow-3', heroId: 'moon_elf', wikiName: 'Exploding Arrow III', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Exploding Arrow to level III.', wikiType: 'upgrade' },
  { cardId: 'upgrade-exploding-arrow-2', heroId: 'moon_elf', wikiName: 'Exploding Arrow II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Exploding Arrow to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-covering-fire-2', heroId: 'moon_elf', wikiName: 'Covering Fire II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Covering Fire to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-deadeye-shot-2', heroId: 'moon_elf', wikiName: 'Covert Fire II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Covert Fire to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-longbow-3', heroId: 'moon_elf', wikiName: 'Longbow III', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Longbow to level III.', wikiType: 'upgrade' },
  { cardId: 'upgrade-longbow-2', heroId: 'moon_elf', wikiName: 'Longbow II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Longbow to level II.', wikiType: 'upgrade' },
];

// ============================================================================
// 专属卡快照 - 暗影刺客 (Shadow Thief)
// ============================================================================

export const SHADOW_THIEF_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  { cardId: 'action-sneaky-sneaky', heroId: 'shadow_thief', wikiName: 'Sneaky Sneaky', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Gain 1 Sneak Attack.', wikiType: 'action' },
  { cardId: 'action-one-with-shadows', heroId: 'shadow_thief', wikiName: 'One With Shadows', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Roll 1 die: Shadow - gain Sneak Attack and 2 CP; otherwise draw 1 card.', wikiType: 'action' },
  { cardId: 'action-poison-tip', heroId: 'shadow_thief', wikiName: 'Poison Tip', wikiCpCost: 2, wikiTiming: 'instant', wikiDescription: 'Inflict 1 Poison on opponent.', wikiType: 'action' },
  { cardId: 'action-card-trick', heroId: 'shadow_thief', wikiName: 'Card Trick', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Card trick resolution effect.', wikiType: 'action' },
  { cardId: 'action-shadow-coins', heroId: 'shadow_thief', wikiName: 'Shadow Coins', wikiCpCost: 0, wikiTiming: 'instant', wikiDescription: 'Shadow coins resolution effect.', wikiType: 'action' },
  { cardId: 'action-shadow-manipulation', heroId: 'shadow_thief', wikiName: 'Shadow Manipulation', wikiCpCost: 4, wikiTiming: 'roll', wikiDescription: 'Manipulate dice during roll phase.', wikiType: 'action' },
  { cardId: 'action-into-the-shadows', heroId: 'shadow_thief', wikiName: 'Into the Shadows', wikiCpCost: 4, wikiTiming: 'instant', wikiDescription: 'Gain 1 Sneak.', wikiType: 'action' },
  { cardId: 'upgrade-pickpocket-2', heroId: 'shadow_thief', wikiName: 'Pickpocket II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Pickpocket to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-kidney-shot-2', heroId: 'shadow_thief', wikiName: 'Kidney Shot II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Kidney Shot to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-shadow-defense-2', heroId: 'shadow_thief', wikiName: 'Shadow Defense II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Shadow Defense to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-dagger-strike-2', heroId: 'shadow_thief', wikiName: 'Dagger Strike II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Dagger Strike to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-shadow-dance-2', heroId: 'shadow_thief', wikiName: 'Shadow Dance II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Shadow Dance to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-steal-2', heroId: 'shadow_thief', wikiName: 'Steal II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Steal to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-cornucopia-2', heroId: 'shadow_thief', wikiName: 'Cornucopia II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Cornucopia to level II.', wikiType: 'upgrade' },
  { cardId: 'upgrade-fearless-riposte-2', heroId: 'shadow_thief', wikiName: 'Fearless Riposte II', wikiCpCost: 4, wikiTiming: 'main', wikiDescription: 'Upgrade Fearless Riposte to level II.', wikiType: 'upgrade' },
];


// ============================================================================
// 专属卡快照 - 圣骑士 (Paladin)
// ============================================================================

export const PALADIN_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  { cardId: 'card-might', heroId: 'paladin', wikiName: 'Might', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'A player gains 1 Crit.', wikiType: 'action' },
  { cardId: 'card-consecrate', heroId: 'paladin', wikiName: 'Consecrate', wikiCpCost: 4, wikiTiming: 'main', wikiDescription: 'Choose a player to gain Protect, Retribution, Crit, and Accuracy.', wikiType: 'action' },
  { cardId: 'card-divine-favor', heroId: 'paladin', wikiName: 'Divine Favor', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Roll 1 die: Sword draw 2, Helm heal 3, Heart heal 4, Pray gain 3 CP.', wikiType: 'action' },
  { cardId: 'card-absolution', heroId: 'paladin', wikiName: 'Absolution', wikiCpCost: 1, wikiTiming: 'instant', wikiDescription: 'After being attacked, roll 1 die: Sword deal 3 damage, Helm prevent 3, Heart prevent 5, Pray prevent 2 and gain 2 CP.', wikiType: 'action' },
  { cardId: 'card-gods-grace', heroId: 'paladin', wikiName: "God's Grace", wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Roll 1 die: Pray gain 4 CP; otherwise draw 1 card.', wikiType: 'action' },
  { cardId: 'card-holy-defense-3', heroId: 'paladin', wikiName: 'Holy Defense III', wikiCpCost: 4, wikiTiming: 'main', wikiDescription: 'Upgrade Holy Defense to level III.', wikiType: 'upgrade' },
  { cardId: 'card-holy-defense-2', heroId: 'paladin', wikiName: 'Holy Defense II', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Holy Defense to level II.', wikiType: 'upgrade' },
  { cardId: 'card-holy-light-2', heroId: 'paladin', wikiName: 'Holy Light II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Holy Light to level II.', wikiType: 'upgrade' },
  { cardId: 'card-righteous-combat-3', heroId: 'paladin', wikiName: 'Righteous Combat III', wikiCpCost: 4, wikiTiming: 'main', wikiDescription: 'Upgrade Righteous Combat to level III.', wikiType: 'upgrade' },
  { cardId: 'card-righteous-combat-2', heroId: 'paladin', wikiName: 'Righteous Combat II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Righteous Combat to level II.', wikiType: 'upgrade' },
  { cardId: 'card-blessing-of-might-2', heroId: 'paladin', wikiName: 'Blessing of Might II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Blessing of Might to level II.', wikiType: 'upgrade' },
  { cardId: 'card-holy-strike-2', heroId: 'paladin', wikiName: 'Holy Strike II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Holy Strike to level II.', wikiType: 'upgrade' },
  { cardId: 'card-vengeance-2', heroId: 'paladin', wikiName: 'Vengeance II', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Upgrade Vengeance to level II.', wikiType: 'upgrade' },
  { cardId: 'card-righteous-prayer-2', heroId: 'paladin', wikiName: 'Righteous Prayer II', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Upgrade Righteous Prayer to level II.', wikiType: 'upgrade' },
  { cardId: 'card-tithes-2', heroId: 'paladin', wikiName: 'Tithes II', wikiCpCost: 3, wikiTiming: 'main', wikiDescription: 'Upgrade Tithes to level II.', wikiType: 'upgrade' },
];

// ============================================================================
// 合并所有专属卡快照
// ============================================================================

export const ALL_HERO_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  ...BARBARIAN_CARD_SNAPSHOTS,
  ...MONK_CARD_SNAPSHOTS,
  ...PYROMANCER_CARD_SNAPSHOTS,
  ...MOON_ELF_CARD_SNAPSHOTS,
  ...SHADOW_THIEF_CARD_SNAPSHOTS,
  ...PALADIN_CARD_SNAPSHOTS,
];

// ============================================================================
// 通用卡快照 (18 张共享卡)
// ============================================================================

export const COMMON_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  { cardId: 'card-play-six', wikiName: 'Play a 6', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'Change 1 die to a 6.', wikiType: 'action' },
  { cardId: 'card-just-this', wikiName: 'Just This', wikiCpCost: 0, wikiTiming: 'roll', wikiDescription: 'During Defensive Roll, reroll up to 5 dice.', wikiType: 'action' },
  { cardId: 'card-give-hand', wikiName: 'Give a Hand', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'Force opponent to reroll 1 die.', wikiType: 'action' },
  { cardId: 'card-i-can-again', wikiName: 'I Can Again', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'During Offensive Roll, reroll up to 5 dice.', wikiType: 'action' },
  { cardId: 'card-me-too', wikiName: 'Me Too', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'Change 1 die to match another die.', wikiType: 'action' },
  { cardId: 'card-surprise', wikiName: 'Surprise', wikiCpCost: 2, wikiTiming: 'roll', wikiDescription: 'Change any 1 die to any value.', wikiType: 'action' },
  { cardId: 'card-worthy-of-me', wikiName: 'Worthy of Me', wikiCpCost: 1, wikiTiming: 'roll', wikiDescription: 'Reroll up to 2 dice.', wikiType: 'action' },
  { cardId: 'card-unexpected', wikiName: 'Unexpected', wikiCpCost: 3, wikiTiming: 'roll', wikiDescription: 'Change any 2 dice to any values.', wikiType: 'action' },
  { cardId: 'card-next-time', wikiName: 'Next Time', wikiCpCost: 1, wikiTiming: 'instant', wikiDescription: 'Prevent 6 damage.', wikiType: 'action' },
  { cardId: 'card-boss-generous', wikiName: 'Boss Generous', wikiCpCost: 0, wikiTiming: 'instant', wikiDescription: 'Gain 2 CP.', wikiType: 'action' },
  { cardId: 'card-flick', wikiName: 'Flick', wikiCpCost: 1, wikiTiming: 'instant', wikiDescription: 'Increase or decrease 1 die value by 1.', wikiType: 'action' },
  { cardId: 'card-bye-bye', wikiName: 'Bye Bye', wikiCpCost: 2, wikiTiming: 'instant', wikiDescription: 'Remove 1 status effect.', wikiType: 'action' },
  { cardId: 'card-double', wikiName: 'Double', wikiCpCost: 1, wikiTiming: 'instant', wikiDescription: 'Draw 2 cards.', wikiType: 'action' },
  { cardId: 'card-super-double', wikiName: 'Super Double', wikiCpCost: 2, wikiTiming: 'instant', wikiDescription: 'Draw 3 cards.', wikiType: 'action' },
  { cardId: 'card-get-away', wikiName: 'Get Away', wikiCpCost: 1, wikiTiming: 'main', wikiDescription: 'Remove 1 status effect from any player.', wikiType: 'action' },
  { cardId: 'card-one-throw-fortune', wikiName: 'One Throw Fortune', wikiCpCost: 0, wikiTiming: 'main', wikiDescription: 'Roll 1 die to gain CP.', wikiType: 'action' },
  { cardId: 'card-what-status', wikiName: 'What Status', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Remove all status effects from 1 player.', wikiType: 'action' },
  { cardId: 'card-transfer-status', wikiName: 'Transfer Status', wikiCpCost: 2, wikiTiming: 'main', wikiDescription: 'Transfer a status effect from one player to another.', wikiType: 'action' },
];

// ============================================================================
// 全部卡牌快照（专属卡 + 通用卡）
// ============================================================================

export const ALL_CARD_SNAPSHOTS: WikiCardSnapshot[] = [
  ...ALL_HERO_CARD_SNAPSHOTS,
  ...COMMON_CARD_SNAPSHOTS,
];

// ============================================================================
// 角色 ID 列表（便于遍历）
// ============================================================================

export const ALL_HERO_IDS = ['barbarian', 'monk', 'pyromancer', 'moon_elf', 'shadow_thief', 'paladin'] as const;
export type HeroId = typeof ALL_HERO_IDS[number];

/** 按角色 ID 获取能力快照 */
export const ABILITY_SNAPSHOTS_BY_HERO: Record<HeroId, WikiAbilitySnapshot[]> = {
  barbarian: BARBARIAN_ABILITY_SNAPSHOTS,
  monk: MONK_ABILITY_SNAPSHOTS,
  pyromancer: PYROMANCER_ABILITY_SNAPSHOTS,
  moon_elf: MOON_ELF_ABILITY_SNAPSHOTS,
  shadow_thief: SHADOW_THIEF_ABILITY_SNAPSHOTS,
  paladin: PALADIN_ABILITY_SNAPSHOTS,
};

/** 按角色 ID 获取 Token 快照 */
export const TOKEN_SNAPSHOTS_BY_HERO: Record<HeroId, WikiTokenSnapshot[]> = {
  barbarian: BARBARIAN_TOKEN_SNAPSHOTS,
  monk: MONK_TOKEN_SNAPSHOTS,
  pyromancer: PYROMANCER_TOKEN_SNAPSHOTS,
  moon_elf: MOON_ELF_TOKEN_SNAPSHOTS,
  shadow_thief: SHADOW_THIEF_TOKEN_SNAPSHOTS,
  paladin: PALADIN_TOKEN_SNAPSHOTS,
};

/** 按角色 ID 获取专属卡快照 */
export const HERO_CARD_SNAPSHOTS_BY_HERO: Record<HeroId, WikiCardSnapshot[]> = {
  barbarian: BARBARIAN_CARD_SNAPSHOTS,
  monk: MONK_CARD_SNAPSHOTS,
  pyromancer: PYROMANCER_CARD_SNAPSHOTS,
  moon_elf: MOON_ELF_CARD_SNAPSHOTS,
  shadow_thief: SHADOW_THIEF_CARD_SNAPSHOTS,
  paladin: PALADIN_CARD_SNAPSHOTS,
};
