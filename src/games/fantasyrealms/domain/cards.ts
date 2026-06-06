import type { FantasyRealmsCardDef, FantasyRealmsSuit } from './types';

const SUIT_LABEL_ZH: Record<FantasyRealmsSuit, string> = {
    army: '军队',
    artifact: '神器',
    beast: '巨兽',
    flame: '烈焰',
    flood: '洪流',
    land: '土地',
    leader: '领袖',
    weapon: '武器',
    weather: '天象',
    wild: '百搭',
    wizard: '法师',
};

const suit = (value: string): FantasyRealmsSuit => {
    switch (value) {
        case 'Army':
            return 'army';
        case 'Artifact':
            return 'artifact';
        case 'Beast':
            return 'beast';
        case 'Flame':
            return 'flame';
        case 'Flood':
            return 'flood';
        case 'Land':
            return 'land';
        case 'Leader':
            return 'leader';
        case 'Weapon':
            return 'weapon';
        case 'Weather':
            return 'weather';
        case 'Wild':
            return 'wild';
        case 'Wizard':
            return 'wizard';
        default:
            throw new Error(`未知牌种：${value}`);
    }
};

const slugify = (value: string) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const card = (
    suitValue: string,
    name: string,
    baseValue: number,
    effectText: string,
): FantasyRealmsCardDef => {
    const normalizedSuit = suit(suitValue);
    return {
        id: `base-${slugify(name)}`,
        set: 'base',
        suit: normalizedSuit,
        suitLabelZh: SUIT_LABEL_ZH[normalizedSuit],
        name,
        baseValue,
        effectText,
        source: 'official-xlsx',
    };
};

export const FANTASY_REALMS_BASE_CARD_DEFS: FantasyRealmsCardDef[] = [
    card('Army', 'Rangers', 5, 'Bonus: +10 for each Land; Clears the word Army from Penalty section of all cards in hand'),
    card('Army', 'Elven Archers', 10, 'Bonus: +5 if no Weather in hand'),
    card('Army', 'Dwarvish Infantry', 15, 'Penalty: -2 for each other Army'),
    card('Army', 'Light Cavalry', 17, 'Penalty: -2 for each Land'),
    card('Army', 'Celestial Knights', 20, 'Penalty: -8 unless with at least one Leader'),
    card('Artifact', 'Protection Rune', 1, 'Clears the Penalty sections on all cards in hand'),
    card('Artifact', 'World Tree', 2, 'Bonus: +50 if every active card in hand is a different suit'),
    card('Artifact', 'Book of Changes', 3, 'Bonus: you may change the suit of one other card. Its name, bonuses and penalties remain the same.'),
    card('Artifact', 'Shield of Keth', 4, 'Bonus: +15 with any one Leader, +40 with both Leader and Sword of Keth'),
    card('Artifact', 'Gem of Order', 5, 'Bonus: +10 for 3-card run, +30 for 4-card run, +60 for 5-card run, +100 for 6-card run, +150 for 7-card run'),
    card('Beast', 'Warhorse', 6, 'Bonus: +14 with any Leader or Wizard'),
    card('Beast', 'Unicorn', 9, 'Bonus: +30 with Princess, +15 with Empress, Queen, or Elemental Enchantress'),
    card('Beast', 'Hydra', 12, 'Bonus: +28 with Swamp'),
    card('Beast', 'Dragon', 30, 'Penalty: -40 unless with at least one Wizard'),
    card('Beast', 'Basilisk', 35, 'Penalty: Blanks all Armies, Leaders, and other Beasts'),
    card('Flame', 'Candle', 2, 'Bonus: +100 with Book of Changes, Bell Tower, and any one Wizard'),
    card('Flame', 'Fire Elemental', 4, 'Bonus: +15 for each other Flame'),
    card('Flame', 'Forge', 9, 'Bonus: +9 for each Weapon and Artifact'),
    card('Flame', 'Lightning', 11, 'Bonus: +30 with Rainstorm'),
    card('Flame', 'Wildfire', 40, 'Blanks all cards except Flames, Weather, Wizards, Weapons, Artifacts, Great Flood, Island, Mountain, Unicorn, & Dragon'),
    card('Flood', 'Fountain of Life', 1, 'Bonus: Add the base strength of any Weapon, Flood, Flame, Land, or Weather in your hand'),
    card('Flood', 'Water Elemental', 4, 'Bonus: +15 for each other Flood'),
    card('Flood', 'Island', 14, 'Clears the Penalty on any one Flood or Flame'),
    card('Flood', 'Swamp', 18, 'Penalty: -3 for each Army and Flame'),
    card('Flood', 'Great Flood', 32, 'Penalty: Blanks all Armies, all Land except Mountain, all Flames except Lightning'),
    card('Land', 'Earth Elemental', 4, 'Bonus: +15 for each other Land'),
    card('Land', 'Underground Caverns', 6, 'Bonus: +25 with Dwarvish Infantry or Dragon; Clears the Penalty on all Weather'),
    card('Land', 'Forest', 7, 'Bonus: +12 for each Beast and Elven Archers'),
    card('Land', 'Bell Tower', 8, 'Bonus: +15 with any one Wizard'),
    card('Land', 'Mountain', 9, 'Bonus: +50 with both Smoke and Wildfire; Clears the Penalty on all Floods'),
    card('Leader', 'Princess', 2, 'Bonus: +8 for each Army, Wizard, and other Leader'),
    card('Leader', 'Warlord', 4, 'Bonus: Equal to the base strengths of all Armies in your hand'),
    card('Leader', 'Queen', 6, 'Bonus: +5 for each Army, +20 for each Army if in the same hand with King'),
    card('Leader', 'King', 8, 'Bonus: +5 for each Army, +20 for each Army if in the same hand with Queen'),
    card('Leader', 'Empress', 10, 'Bonus: +10 for each Army; Penalty: -5 for each other leader'),
    card('Weapon', 'Magic Wand', 1, 'Bonus: +25 with any one Wizard'),
    card('Weapon', 'Elven Longbow', 3, 'Bonus: +30 with Elven Archers or Warlord or Beastmaster'),
    card('Weapon', 'Sword of Keth', 7, 'Bonus: +10 with any one Leader, +40 with both Leader and Shield of Keth'),
    card('Weapon', 'Warship', 23, 'Penalty: Blanked unless with at least one Flood; Clears the word Army from Penalty section of all Floods'),
    card('Weapon', 'War Dirigible', 35, 'Penalty: Blanked unless with at least one Army, Blanked if hand contains any weather'),
    card('Weather', 'Air Elemental', 4, 'Bonus: +15 for each other Weather'),
    card('Weather', 'Rainstorm', 8, 'Bonus: +10 for each Flood; Penalty: Blanks all Flames except Lightning'),
    card('Weather', 'Whirlwind', 13, 'Bonus: +40 with Rainstorm and either Blizzard or Great Flood '),
    card('Weather', 'Smoke', 27, 'Penalty: This card is blanked unless with at least one Flame'),
    card('Weather', 'Blizzard', 30, 'Penalty: Blanks all Floods, -5 for each Army, Leader, Beast, and Flame'),
    card('Wild', 'Shapeshifter', 0, 'May take on the name and suit of any Artifact, Leader, Wizard, Weapon or Beast. Does not take bonus or penalty.'),
    card('Wild', 'Mirage', 0, 'May take on the name and suit of any Army, Land, Weather, Flood or Flame. Does not take bonus or penalty.'),
    card('Wild', 'Doppelganger', 0, 'May duplicate the name, suit, base strength, and penalty but not bonus of any one other card in your hand'),
    card('Wizard', 'Necromancer', 3, 'Bonus: At the end of the game, you may take one Army, Leader, Wizard, or Beast from the discard pile and add it to your hand as an eighth card.'),
    card('Wizard', 'Elemental Enchantress', 5, 'Bonus: +5 for each Land, Weather, Flood, and Flame'),
    card('Wizard', 'Collector', 7, 'Bonus: +10 if three different cards in same suit, +40 if four different cards, +100 if five different cards'),
    card('Wizard', 'Beastmaster', 9, 'Bonus: +9 for each Beast; Clears the Penalty on all Beasts'),
    card('Wizard', 'Warlock Lord', 25, 'Penalty: -10 for each Leader and other Wizard'),
];

