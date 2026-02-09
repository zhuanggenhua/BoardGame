import type { CardDef, BaseCardDef, MinionCardDef } from '../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';

import { PIRATE_CARDS } from './factions/pirates';
import { NINJA_CARDS } from './factions/ninjas';
import { ALIEN_CARDS } from './factions/aliens';
import { DINOSAUR_CARDS } from './factions/dinosaurs';
import { MISKATONIC_CARDS } from './factions/miskatonic';
import { CTHULHU_CARDS } from './factions/cthulhu';
import { INNSMOUTH_CARDS } from './factions/innsmouth';
import { ELDER_THINGS_CARDS } from './factions/elder_things';
import { MADNESS_CARDS } from './factions/madness';
import { GHOST_CARDS } from './factions/ghosts';
import { BEAR_CAVALRY_CARDS } from './factions/bear_cavalry';
import { STEAMPUNK_CARDS } from './factions/steampunks';
import { KILLER_PLANT_CARDS } from './factions/killer_plants';
import { ZOMBIE_CARDS } from './factions/zombies';
import { WIZARD_CARDS } from './factions/wizards';
import { TRICKSTER_CARDS } from './factions/tricksters';
import { ROBOT_CARDS } from './factions/robots';

// ============================================================================
// 注册表
// ============================================================================

/** 所有卡牌定义（按 id 索引） */
const _cardRegistry = new Map<string, CardDef>();
/** 所有基地定义（按 id 索引） */
const _baseRegistry = new Map<string, BaseCardDef>();

function registerCards(cards: CardDef[]): void {
    for (const card of cards) {
        _cardRegistry.set(card.id, card);
    }
}

function registerBases(bases: BaseCardDef[]): void {
    for (const base of bases) {
        _baseRegistry.set(base.id, base);
    }
}

// 初始化注册
registerCards(PIRATE_CARDS);
registerCards(NINJA_CARDS);
registerCards(ALIEN_CARDS);
registerCards(DINOSAUR_CARDS);
registerCards(MISKATONIC_CARDS);
registerCards(CTHULHU_CARDS);
registerCards(INNSMOUTH_CARDS);
registerCards(ELDER_THINGS_CARDS);
registerCards(MADNESS_CARDS);
registerCards(GHOST_CARDS);
registerCards(BEAR_CAVALRY_CARDS);
registerCards(STEAMPUNK_CARDS);
registerCards(KILLER_PLANT_CARDS);
registerCards(ZOMBIE_CARDS);
registerCards(WIZARD_CARDS);
registerCards(TRICKSTER_CARDS);
registerCards(ROBOT_CARDS);

// ============================================================================
// 基础基地卡（基础版）
// ============================================================================

export const BASE_CARDS: BaseCardDef[] = [
    {
        id: 'base_the_homeworld',
        name: '家园',
        nameEn: 'The Homeworld',
        breakpoint: 23,
        vpAwards: [4, 2, 1],
        abilityText: '每当有一个随从打出到这里后，它的拥有者可以额外打出一个力量为2或以下的随从。',
        abilityTextEn: 'After each time a minion is played here, its owner may play an extra minion of power 2 or less.',
        faction: 'aliens',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 0 },
    },
    {
        id: 'base_the_mothership',
        name: '母舰',
        nameEn: 'The Mothership',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        abilityText: '在这个基地计分后，冠军可以返回他在这里的一张力量为3或以下的随从到手牌。',
        abilityTextEn: 'After this base scores, the winner may return one of their minions of power 3 or less here to their hand.',
        faction: 'aliens',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 1 },
    },
    {
        id: 'base_central_brain',
        name: '中央大脑',
        nameEn: 'Central Brain',
        breakpoint: 19,
        vpAwards: [4, 2, 1],
        abilityText: '每个在这里的随从获得+1力量。',
        abilityTextEn: 'Each minion here has +1 power.',
        faction: 'robots',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 2 },
    },
    {
        id: 'base_the_jungle',
        name: '绿洲丛林',
        nameEn: 'The Jungle',
        breakpoint: 12,
        vpAwards: [2, 0, 0],
        abilityText: '',
        abilityTextEn: '',
        faction: 'dinosaurs',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 3 },
    },
    {
        id: 'base_temple_of_goju',
        name: '刚柔流寺庙',
        nameEn: 'Temple of Goju',
        breakpoint: 18,
        vpAwards: [2, 3, 2],
        abilityText: '在这个基地计分后，将每位玩家在这里力量最高的一张随从放入他们拥有者的牌库底。',
        abilityTextEn: 'After this base scores, place each player’s highest-power minion here on the bottom of its owner’s deck.',
        faction: 'ninjas',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 4 },
    },
    {
        id: 'base_cave_of_shinies',
        name: '闪光洞穴',
        nameEn: 'Cave of Shinies',
        breakpoint: 23,
        vpAwards: [4, 2, 1],
        abilityText: '每当这里的一个随从被消灭后，它的拥有者获得1VP。',
        abilityTextEn: 'After each time a minion is destroyed here, its owner gains 1 VP.',
        faction: 'tricksters',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 5 },
    },
    {
        id: 'base_haunted_house',
        name: '伊万斯堡城镇公墓',
        nameEn: 'Haunted House',
        breakpoint: 20,
        vpAwards: [5, 3, 2],
        abilityText: '在这个基地计分后，冠军弃掉他的手牌并抽取5张牌。',
        abilityTextEn: 'After this base scores, the winner discards their hand and draws five cards.',
        faction: 'zombies',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 6 },
    },
    {
        id: 'base_rhodes_plaza',
        name: '罗德百货商场',
        nameEn: 'Rhodes Plaza Mall',
        breakpoint: 24,
        vpAwards: [0, 0, 0],
        abilityText: '在这个基地计分时，每位玩家在这里每有一个随从就获得1VP。',
        abilityTextEn: 'When this base scores, each player gains 1 VP for each minion they have here.',
        faction: 'zombies',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 7 },
    },
    {
        id: 'base_the_factory',
        name: '436-1337工厂',
        nameEn: 'The Factory',
        breakpoint: 25,
        vpAwards: [2, 2, 1],
        abilityText: '当这个基地计分时，冠军在这里每有5力量就获得1VP。',
        abilityTextEn: 'When this base scores, the winner gains 1 VP for every 5 power they have here.',
        faction: 'robots',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 8 },
    },
    {
        id: 'base_tar_pits',
        name: '焦油坑',
        nameEn: 'Tar Pits',
        breakpoint: 16,
        vpAwards: [4, 3, 2],
        abilityText: '每当有一个随从在这里被消灭后，将它放到其拥有者的牌库底。',
        abilityTextEn: 'After each time a minion is destroyed here, place it on the bottom of its owner’s deck.',
        faction: 'dinosaurs',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 9 },
    },
    {
        id: 'base_ninja_dojo',
        name: '忍者道场',
        nameEn: 'Ninja Dojo',
        breakpoint: 18,
        vpAwards: [2, 3, 2],
        abilityText: '在这个基地计分后，冠军可以消灭任意一个随从。',
        abilityTextEn: 'After this base scores, the winner may destroy any one minion.',
        faction: 'ninjas',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 10 },
    },
    {
        id: 'base_mushroom_kingdom',
        name: '蘑菇王国',
        nameEn: 'Mushroom Kingdom',
        breakpoint: 20,
        vpAwards: [5, 3, 2],
        abilityText: '在每位玩家回合开始时，该玩家可以从任意基地移动一个其他玩家的随从到这。',
        abilityTextEn: 'At the start of each player’s turn, that player may move an opponent’s minion from any base to here.',
        faction: 'tricksters',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 11 },
    },
    {
        id: 'base_pirate_cove',
        name: '灰色猫眼石/海盗湾',
        nameEn: 'Pirate Cove',
        breakpoint: 17,
        vpAwards: [3, 1, 1],
        abilityText: '在这个基地计分后，除了冠军的所有玩家可以从这里移动一个随从到其他基地而不是进入弃牌堆。',
        abilityTextEn: 'After this base scores, all players other than the winner may move one of their minions from here to another base instead of placing it in the discard pile.',
        faction: 'pirates',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 12 },
    },
    {
        id: 'base_tortuga',
        name: '托尔图加',
        nameEn: 'Tortuga',
        breakpoint: 21,
        vpAwards: [4, 3, 2],
        abilityText: '冠军计分后，亚军可以移动他的一个随从到替换本基地的基地上。',
        abilityTextEn: 'After the winner scores, the runner-up may move one of their minions to the base that replaces this one.',
        faction: 'pirates',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 13 },
    },
    {
        id: 'base_great_library',
        name: '大图书馆',
        nameEn: 'Great Library',
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        abilityText: '在这个基地计分后，所有在这里有随从的玩家可以抽一张卡牌。',
        abilityTextEn: 'After this base scores, each player with a minion here may draw a card.',
        faction: 'wizards',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 14 },
    },
    {
        id: 'base_wizard_academy',
        name: '巫师学院',
        nameEn: 'Wizard Academy',
        breakpoint: 20,
        vpAwards: [3, 2, 1],
        abilityText: '在这个基地计分后，冠军查看基地牌库顶的3张牌。选择一张替换这个基地，然后以任意顺序将其余的放回。',
        abilityTextEn: 'After this base scores, the winner looks at the top three cards of the base deck. They may choose one of those bases to replace this one, then place the other two on top of the base deck in any order.',
        faction: 'wizards',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 15 },
    },
];
registerBases(BASE_CARDS);

// ============================================================================
// 扩展基地 (Awesome Level 9000)
// ============================================================================
export const BASE_CARDS_AL9000: BaseCardDef[] = [
    // Ghosts
    {
        id: 'base_dread_lookout',
        name: '恐怖眺望台',
        nameEn: 'Dread Lookout',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        abilityText: '玩家不能打出战术到这个基地上。',
        abilityTextEn: 'Actions cannot be played on this base.',
        faction: 'ghosts',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 6 },
    },
    {
        id: 'base_haunted_house_al9000',
        name: '鬼屋',
        nameEn: 'Haunted House',
        breakpoint: 18,
        vpAwards: [4, 3, 2],
        abilityText: '在一个玩家打出一个随从到这后，这个玩家必须弃掉一张卡牌。',
        abilityTextEn: 'After each time a player plays a minion here, they must discard a card.',
        faction: 'ghosts',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 7 },
    },
    // Bear Cavalry
    {
        id: 'base_the_field_of_honor',
        name: '荣誉之地',
        nameEn: 'The Field of Honor',
        breakpoint: 18,
        vpAwards: [3, 2, 1],
        abilityText: '当一个或多个随从在这里被消灭，那个将它们消灭的玩家获得1VP。',
        abilityTextEn: 'After each time one or more minions are destroyed here, the player who destroyed them gains 1 VP.',
        faction: 'bear_cavalry',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 0 },
    },
    {
        id: 'base_tsars_palace',
        name: '沙皇宫殿',
        nameEn: 'Tsar’s Palace',
        breakpoint: 22,
        vpAwards: [5, 3, 2],
        abilityText: '力量为2或以下的随从不能被打出到这里。',
        abilityTextEn: 'Minions of power 2 or less cannot be played here.',
        faction: 'bear_cavalry',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 1 },
    },
    // Steampunks
    {
        id: 'base_inventors_salon',
        name: '发明家沙龙',
        nameEn: 'Inventor’s Salon',
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        abilityText: '冠军可以从他的弃牌堆中选取一张战术卡将其置入他的手牌。',
        abilityTextEn: 'After this base scores, the winner may take an action from their discard pile into their hand.',
        faction: 'steampunks',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 2 },
    },
    {
        id: 'base_the_workshop',
        name: '工坊',
        nameEn: 'The Workshop',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        abilityText: '当一个玩家打出一个战术到这个基地时，该玩家可以额外打出一张战术。',
        abilityTextEn: 'After each time a player plays an action on this base, they may play an extra action.',
        faction: 'steampunks',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 3 },
    },
    // Killer Plants
    {
        id: 'base_greenhouse',
        name: '温室',
        nameEn: 'Greenhouse',
        breakpoint: 24,
        vpAwards: [4, 2, 1],
        abilityText: '冠军可以从他的牌库中搜寻一张随从并将它打出到将替换本基地的基地上。',
        abilityTextEn: 'After this base scores, the winner may search their deck for a minion and play it on the replacement base.',
        faction: 'killer_plants',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 4 },
    },
    {
        id: 'base_secret_garden',
        name: '神秘花园',
        nameEn: 'Secret Garden',
        breakpoint: 21,
        vpAwards: [3, 2, 1],
        abilityText: '在你的回合，你可以额外打出一个力量为2或以下的随从到这里。',
        abilityTextEn: 'On your turn, you may play one extra minion of power 2 or less here.',
        faction: 'killer_plants',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 5 },
    },
];
registerBases(BASE_CARDS_AL9000);

// ============================================================================
// 扩展基地 (Pretty Pretty Smash Up)
// ============================================================================
export const BASE_CARDS_PRETTY_PRETTY: BaseCardDef[] = [
    // Kitty Cats
    {
        id: 'base_cat_fanciers_alley',
        name: '诡猫巷',
        nameEn: 'Cat Fanciers’ Alley',
        breakpoint: 18,
        vpAwards: [3, 2, 1],
        abilityText: '每回合一次，你可以消灭一个你在这里的随从以抽取一张卡牌。',
        abilityTextEn: 'Once per turn, you may destroy one of your minions here to draw a card.',
        faction: 'kitty_cats',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 0 },
    },
    {
        id: 'base_house_of_nine_lives',
        name: '九命之家',
        nameEn: 'House of Nine Lives',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        abilityText: '如果一个随从在另一个基地被消灭，它的拥有者可以将它移动到这以代替。',
        abilityTextEn: 'If a minion would be destroyed at another base, its owner may move it here instead.',
        faction: 'kitty_cats',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 1 },
    },
    // Fairies
    {
        id: 'base_enchanted_glade',
        name: '迷人峡谷',
        nameEn: 'Enchanted Glade',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        abilityText: '在你打出一张战术到这里的一个随从上后，抽取一张卡牌。',
        abilityTextEn: 'After you play an action on a minion here, draw a card.',
        faction: 'fairies',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 2 },
    },
    {
        id: 'base_fairy_ring',
        name: '仙灵圈',
        nameEn: 'Fairy Ring',
        breakpoint: 26,
        vpAwards: [4, 3, 2],
        abilityText: '每回合你第一次打出一个随从到这后，你可以打出一张额外的随从到这，或打出一张额外的战术。',
        abilityTextEn: 'The first time you play a minion here on each turn, you may play an extra minion here or an extra action.',
        faction: 'fairies',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 3 },
    },
    // Princesses
    {
        id: 'base_beautiful_castle',
        name: '美丽城堡',
        nameEn: 'Beautiful Castle',
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        abilityText: '这里的力量为5或以上的随从不受对手牌的影响。',
        abilityTextEn: 'Minions here of power 5 or more are unaffected by other players’ cards.',
        faction: 'princesses',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 4 },
    },
    {
        id: 'base_castle_of_ice',
        name: '冰之城堡',
        nameEn: 'Castle of Ice',
        breakpoint: 15,
        vpAwards: [3, 2, 2],
        abilityText: '随从不能被打出到这。',
        abilityTextEn: 'Minions cannot be played here.',
        faction: 'princesses',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 5 },
    },
    // Mythic Horses
    {
        id: 'base_land_of_balance',
        name: '平衡之地',
        nameEn: 'Land of Balance',
        breakpoint: 25,
        vpAwards: [5, 3, 2],
        abilityText: '在你打出一个随从到这后，你可以从另一个基地移动一个你的随从到这里。',
        abilityTextEn: 'After you play a minion here, you may move one of your minions from another base to here.',
        faction: 'mythic_horses',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 6 },
    },
    {
        id: 'base_pony_paradise',
        name: '小马乐园',
        nameEn: 'Pony Paradise',
        breakpoint: 18,
        vpAwards: [3, 2, 1],
        abilityText: '如果你有两个或以上的随从在这，你在这一随从无法被消灭。',
        abilityTextEn: 'If you have two or more minions here, your minions here cannot be destroyed.',
        faction: 'mythic_horses',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 7 },
    },
];
registerBases(BASE_CARDS_PRETTY_PRETTY);

// ============================================================================
// 扩展基地 (Set 4 - Mixed including Cthulhu)
// ============================================================================
export const BASE_CARDS_SET4: BaseCardDef[] = [
    {
        id: 'base_north_pole',
        name: '北极基地',
        nameEn: 'North Pole',
        breakpoint: 24,
        vpAwards: [5, 3, 2],
        abilityText: '玩家每回合只能打出一个随从到这个基地。',
        abilityTextEn: 'Each player may play only one minion at this base each turn.',
        faction: 'cyborg_apes',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 0 },
    },
    {
        id: 'base_ritual_site',
        name: '仪式场所',
        nameEn: 'Ritual Site',
        breakpoint: 20,
        vpAwards: [4, 2, 2],
        abilityText: '在这个基地计分后。在它上面的所有随从洗回他们的拥有者牌库，而不是进入弃牌堆。',
        abilityTextEn: 'After this base scores, shuffle all minions here into their owners’ decks instead of placing them in the discard pile.',
        faction: 'elder_things',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 1 },
    },
    {
        id: 'base_rlyeh',
        name: '拉莱耶',
        nameEn: 'R’lyeh',
        breakpoint: 18,
        vpAwards: [4, 2, 1],
        abilityText: '在每位玩家回合开始时，该玩家可以消灭他在本地的一个随从，如果他这样做，获得1VP。',
        abilityTextEn: 'At the start of each player’s turn, that player may destroy one of their minions here to gain 1 VP.',
        faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 2 },
    },
    {
        id: 'base_the_asylum',
        name: '庇护所',
        nameEn: 'The Asylum',
        breakpoint: 16,
        vpAwards: [3, 1, 1],
        abilityText: '每当一个随从被打出到这，它的拥有者可以从他的手上返回一张疯狂卡到疯狂牌库。',
        abilityTextEn: 'After each time a minion is played here, its owner may return a Madness card from their hand to the Madness deck.',
        faction: 'elder_things',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 3 },
    },
    {
        id: 'base_innsmouth_base',
        name: '印斯茅斯',
        nameEn: 'Innsmouth',
        breakpoint: 23,
        vpAwards: [5, 3, 2],
        abilityText: '每当有一个随从被打出到这后，它的拥有者可以将任意玩家弃牌堆中的一张卡置入他们牌库底。',
        abilityTextEn: 'After each time a minion is played here, its owner may place a card from any player’s discard pile on the bottom of its owner’s deck.',
        faction: 'innsmouth',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 4 },
    },
    {
        id: 'base_mountains_of_madness',
        name: '疯狂山脉',
        nameEn: 'Mountains of Madness',
        breakpoint: 20,
        vpAwards: [6, 4, 3],
        abilityText: '每当一个随从被打出到这后，它的拥有者抽取一张疯狂卡。',
        abilityTextEn: 'After each time a minion is played here, its owner draws a Madness card.',
        faction: 'elder_things',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 5 },
    },
    {
        id: 'base_miskatonic_university_base',
        name: '米斯卡塔尼克大学',
        nameEn: 'Miskatonic University',
        breakpoint: 24,
        vpAwards: [3, 3, 2],
        abilityText: '在这个基地计分后，冠军可以搜寻他的手牌和弃牌堆中任意数量的疯狂卡，然后返回到疯狂卡牌库。',
        abilityTextEn: 'After this base scores, the winner may search their hand and discard pile for any number of Madness cards and return them to the Madness deck.',
        faction: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 6 },
    },
    {
        id: 'base_plateau_of_leng',
        name: '伦格高原',
        nameEn: 'Plateau of Leng',
        breakpoint: 18,
        vpAwards: [3, 2, 1],
        abilityText: '每回合玩家第一次打出一个随从从手牌到这以后，他们可以额外打出一张与其同名的随从到这里。',
        abilityTextEn: 'The first time a player plays a minion here from their hand each turn, they may play an extra minion of the same name here.',
        faction: 'innsmouth',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 7 },
    },
    {
        id: 'base_the_pasture',
        name: '牧场',
        nameEn: 'The Pasture',
        breakpoint: 25,
        vpAwards: [5, 3, 2],
        abilityText: '每回合玩家第一次移动一个随从到这里后，移动另一基地的一个随从到这。',
        abilityTextEn: 'The first time a player moves a minion here each turn, they move a minion from another base to here.',
        faction: 'sheep',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 8 },
    },
    {
        id: 'base_sheep_shrine',
        name: '绵羊神社',
        nameEn: 'Sheep Shrine',
        breakpoint: 19,
        vpAwards: [4, 2, 1],
        abilityText: '这张基地入场后，每位玩家可以移动一个他们的随从到这。',
        abilityTextEn: 'After this base enters play, each player may move one of their minions to here.',
        faction: 'sheep',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 9 },
    },
    {
        id: 'base_locker_room',
        name: '更衣室',
        nameEn: 'Locker Room',
        breakpoint: 23,
        vpAwards: [3, 2, 2],
        abilityText: '你的回合开始时，如果你有随从在这，抽一张卡牌。',
        abilityTextEn: 'At the start of your turn, if you have a minion here, draw a card.',
        faction: 'vampires',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 10 },
    },
    {
        id: 'base_stadium',
        name: '体育场',
        nameEn: 'The Stadium',
        breakpoint: 17,
        vpAwards: [3, 2, 1],
        abilityText: '这里的一个随从被消灭后，它的控制者抽一张卡牌。',
        abilityTextEn: 'After a minion here is destroyed, its controller draws a card.',
        faction: 'vampires',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 11 },
    },
];
registerBases(BASE_CARDS_SET4);

// ============================================================================
// 基地选择：按所选派系推断扩展包（从基地数据推断）
// ============================================================================

type BaseSetKey = 'base' | 'al9000' | 'pretty_pretty' | 'set4';

const BASE_SET_CARDS: Record<BaseSetKey, BaseCardDef[]> = {
    base: BASE_CARDS,
    al9000: BASE_CARDS_AL9000,
    pretty_pretty: BASE_CARDS_PRETTY_PRETTY,
    set4: BASE_CARDS_SET4,
};

/** 根据所选派系获取基地定义 ID（按派系对应扩展包聚合） */
export function getBaseDefIdsForFactions(factionIds: string[]): string[] {
    const selected = new Set(factionIds);
    const selectedSets = Object.entries(BASE_SET_CARDS)
        .filter(([, bases]) => bases.some(base => base.faction && selected.has(base.faction)))
        .map(([setKey]) => setKey as BaseSetKey);
    if (selectedSets.length === 0) {
        return getAllBaseDefIds();
    }
    return selectedSets.flatMap((setKey) =>
        BASE_SET_CARDS[setKey].map(base => base.id)
    );
}


/** 查找卡牌定义 */
export function getCardDef(defId: string): CardDef | undefined {
    return _cardRegistry.get(defId);
}

/** 查找随从卡定义 */
export function getMinionDef(defId: string): MinionCardDef | undefined {
    const def = _cardRegistry.get(defId);
    return def?.type === 'minion' ? def : undefined;
}

/** 查找基地定义 */
export function getBaseDef(defId: string): BaseCardDef | undefined {
    return _baseRegistry.get(defId);
}

const isEnglishLocale = (language?: string) => (language ?? '').toLowerCase().startsWith('en');

export function resolveCardName(def: CardDef | BaseCardDef | undefined, language?: string): string {
    if (!def) return '';
    return isEnglishLocale(language) ? def.nameEn : def.name;
}

export function resolveCardText(def: CardDef | BaseCardDef | undefined, language?: string): string {
    if (!def) return '';
    const useEn = isEnglishLocale(language);
    if ('type' in def) {
        if (def.type === 'minion') {
            return useEn ? def.abilityTextEn ?? '' : def.abilityText ?? '';
        }
        return useEn ? def.effectTextEn ?? '' : def.effectText ?? '';
    }
    return useEn ? def.abilityTextEn ?? '' : def.abilityText ?? '';
}

/** 注册新派系（用于后续扩展） */
export function registerFaction(cards: CardDef[], bases?: BaseCardDef[]): void {
    registerCards(cards);
    if (bases) registerBases(bases);
}

/** 获取派系的所有卡牌定义 */
export function getFactionCards(factionId: FactionId): CardDef[] {
    return Array.from(_cardRegistry.values()).filter(c => c.faction === factionId);
}

/** 获取所有基地定义 ID 列表 */
export function getAllBaseDefIds(): string[] {
    return Array.from(_baseRegistry.keys());
}

// 重导出类型用于外部引用
import type { FactionId } from '../domain/types';
