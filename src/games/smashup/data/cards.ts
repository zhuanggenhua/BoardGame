import type { CardDef, BaseCardDef, MinionCardDef, FusionCardDef } from '../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';

import { PIRATE_CARDS } from './factions/pirates';
import { PIRATE_POD_CARDS } from './factions/pirates_pod';
import { NINJA_CARDS } from './factions/ninjas';
import { ALIEN_CARDS } from './factions/aliens';
import { ALIEN_POD_CARDS } from './factions/aliens_pod';
import { DINOSAUR_CARDS } from './factions/dinosaurs';
import { DINOSAUR_POD_CARDS } from './factions/dinosaurs_pod';
import { MISKATONIC_CARDS } from './factions/miskatonic';
import { MISKATONIC_POD_CARDS } from './factions/miskatonic_pod';
import { CTHULHU_CARDS } from './factions/cthulhu';
import { CTHULHU_POD_CARDS } from './factions/cthulhu_pod';
import { INNSMOUTH_CARDS } from './factions/innsmouth';
import { INNSMOUTH_POD_CARDS } from './factions/innsmouth_pod';
import { ELDER_THINGS_CARDS } from './factions/elder_things';
import { ELDER_THINGS_POD_CARDS } from './factions/elder_things_pod';
import { MADNESS_CARDS } from './factions/madness';
import { GHOST_CARDS } from './factions/ghosts';
import { GHOST_POD_CARDS } from './factions/ghosts_pod';
import { BEAR_CAVALRY_CARDS } from './factions/bear_cavalry';
import { BEAR_CAVALRY_POD_CARDS } from './factions/bear_cavalry_pod';
import { STEAMPUNK_CARDS } from './factions/steampunks';
import { STEAMPUNK_POD_CARDS } from './factions/steampunks_pod';
import { KILLER_PLANT_CARDS } from './factions/killer_plants';
import { KILLER_PLANT_POD_CARDS } from './factions/killer_plants_pod';
import { ZOMBIE_CARDS } from './factions/zombies';
import { ZOMBIE_POD_CARDS } from './factions/zombies_pod';
import { WIZARD_CARDS } from './factions/wizards';
import { WIZARD_POD_CARDS } from './factions/wizards_pod';
import { TRICKSTER_CARDS } from './factions/tricksters';
import { TRICKSTER_POD_CARDS } from './factions/tricksters_pod';
import { ROBOT_CARDS } from './factions/robots';
import { ROBOT_POD_CARDS } from './factions/robots_pod';
import { FRANKENSTEIN_CARDS } from './factions/frankenstein';
import { FRANKENSTEIN_POD_CARDS } from './factions/frankenstein_pod';
import { WEREWOLF_CARDS } from './factions/werewolves';
import { WEREWOLF_POD_CARDS } from './factions/werewolves_pod';
import { VAMPIRE_CARDS } from './factions/vampires';
import { VAMPIRE_POD_CARDS } from './factions/vampires_pod';
import { GIANT_ANT_CARDS } from './factions/giant-ants';
import { GIANT_ANT_CARDS as GIANT_ANT_POD_CARDS } from './factions/giant-ants_pod';
import { NINJA_POD_CARDS } from './factions/ninjas_pod';

// ============================================================================
// 注册表
// ============================================================================

/** 所有卡牌定义（按 id 索引） */
const _cardRegistry = new Map<string, CardDef>();
/** 所有基地定义（按 id 索引） */
const _baseRegistry = new Map<string, BaseCardDef>();

const normalizeCardName = (defId: string, name: string): string => {
    if (typeof name === 'string' && name.startsWith('cards.')) return name;
    return `cards.${defId}.name`;
};

function registerCards(cards: CardDef[]): void {
    for (const card of cards) {
        // 不再覆盖 def.name，保留原始中文字段作为 fallback
        _cardRegistry.set(card.id, card);
    }
}

function registerBases(bases: BaseCardDef[]): void {
    for (const base of bases) {
        // 不再覆盖 def.name，保留原始中文字段作为 fallback
        _baseRegistry.set(base.id, base);
    }
}

// 初始化注册
const POD_SUFFIX = '_pod';
const BASES_PER_FACTION = 2;

function isPodVariantId(id: string): boolean {
    return id.endsWith(POD_SUFFIX);
}

function toPodId(id: string): string {
    return isPodVariantId(id) ? id : `${id}${POD_SUFFIX}`;
}

function cloneBaseRestrictions(restrictions: BaseCardDef['restrictions']): BaseCardDef['restrictions'] {
    if (!restrictions) return undefined;
    return restrictions.map(restriction => ({
        ...restriction,
        condition: restriction.condition ? { ...restriction.condition } : undefined,
    }));
}

function cloneBaseAsPodSkeleton(base: BaseCardDef): BaseCardDef | undefined {
    if (!base.faction || isPodVariantId(base.id)) return undefined;
    return {
        ...base,
        id: toPodId(base.id),
        faction: toPodId(base.faction) as BaseCardDef['faction'],
        restrictions: cloneBaseRestrictions(base.restrictions),
    };
}

function registerPodBaseSkeletons(): void {
    const podBaseSkeletons: BaseCardDef[] = [];
    for (const base of _baseRegistry.values()) {
        const podBase = cloneBaseAsPodSkeleton(base);
        if (!podBase) continue;
        if (_baseRegistry.has(podBase.id)) continue;
        podBaseSkeletons.push(podBase);
    }
    registerBases(podBaseSkeletons);
}

registerCards(PIRATE_CARDS);
registerCards(PIRATE_POD_CARDS);
registerCards(NINJA_CARDS);
registerCards(ALIEN_CARDS);
registerCards(ALIEN_POD_CARDS);
registerCards(DINOSAUR_CARDS);
registerCards(DINOSAUR_POD_CARDS);
registerCards(MISKATONIC_CARDS);
registerCards(MISKATONIC_POD_CARDS);
registerCards(CTHULHU_CARDS);
registerCards(CTHULHU_POD_CARDS);
registerCards(INNSMOUTH_CARDS);
registerCards(INNSMOUTH_POD_CARDS);
registerCards(ELDER_THINGS_CARDS);
registerCards(ELDER_THINGS_POD_CARDS);
registerCards(MADNESS_CARDS);
registerCards(GHOST_CARDS);
registerCards(GHOST_POD_CARDS);
registerCards(BEAR_CAVALRY_CARDS);
registerCards(BEAR_CAVALRY_POD_CARDS);
registerCards(STEAMPUNK_CARDS);
registerCards(STEAMPUNK_POD_CARDS);
registerCards(KILLER_PLANT_CARDS);
registerCards(KILLER_PLANT_POD_CARDS);
registerCards(ZOMBIE_CARDS);
registerCards(ZOMBIE_POD_CARDS);
registerCards(WIZARD_CARDS);
registerCards(WIZARD_POD_CARDS);
registerCards(TRICKSTER_CARDS);
registerCards(TRICKSTER_POD_CARDS);
registerCards(ROBOT_CARDS);
registerCards(ROBOT_POD_CARDS);
registerCards(FRANKENSTEIN_CARDS);
registerCards(FRANKENSTEIN_POD_CARDS);
registerCards(WEREWOLF_CARDS);
registerCards(WEREWOLF_POD_CARDS);
registerCards(VAMPIRE_CARDS);
registerCards(VAMPIRE_POD_CARDS);
registerCards(GIANT_ANT_CARDS);
registerCards(GIANT_ANT_POD_CARDS);
// POD 版本阵营（最新英文 POD 版本）
registerCards(NINJA_POD_CARDS);

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
        faction: 'aliens',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 1 },
    },
    {
        id: 'base_the_mothership',
        name: '母舰',
        nameEn: 'The Mothership',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        faction: 'aliens',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 5 },
    },
    {
        id: 'base_central_brain',
        name: '中央大脑',
        nameEn: 'Central Brain',
        breakpoint: 19,
        vpAwards: [4, 2, 1],
        faction: 'robots',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 8 },
        minionPowerBonus: 1,
    },
    {
        id: 'base_the_jungle',
        name: '绿洲丛林',
        nameEn: 'Jungle Oasis',
        breakpoint: 12,
        vpAwards: [2, 0, 0],
        faction: 'dinosaurs',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 9 },
    },
    {
        id: 'base_temple_of_goju',
        name: '刚柔流寺庙',
        nameEn: 'Temple of Goju',
        breakpoint: 18,
        vpAwards: [2, 3, 2],
        faction: 'ninjas',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 4 },
    },
    {
        id: 'base_cave_of_shinies',
        name: '闪光洞穴',
        nameEn: 'Cave of Shinies',
        breakpoint: 23,
        vpAwards: [4, 2, 1],
        faction: 'tricksters',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 11 },
    },
    {
        id: 'base_haunted_house',
        name: '伊万斯堡城镇公墓',
        nameEn: 'Haunted House',
        breakpoint: 20,
        vpAwards: [5, 3, 2],
        faction: 'zombies',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 14 },
    },
    {
        id: 'base_rhodes_plaza',
        name: '罗德百货商场',
        nameEn: 'Rhodes Plaza Mall',
        breakpoint: 24,
        vpAwards: [0, 0, 0],
        faction: 'zombies',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 2 },
    },
    {
        id: 'base_the_factory',
        name: '436-1337工厂',
        nameEn: 'The Factory',
        breakpoint: 25,
        vpAwards: [2, 2, 1],
        faction: 'robots',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 7 },
    },
    {
        id: 'base_tar_pits',
        name: '焦油坑',
        nameEn: 'Tar Pits',
        breakpoint: 16,
        vpAwards: [4, 3, 2],
        faction: 'dinosaurs',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 15 },
    },
    {
        id: 'base_ninja_dojo',
        name: '忍者道场',
        nameEn: 'Ninja Dojo',
        breakpoint: 18,
        vpAwards: [2, 3, 2],
        faction: 'ninjas',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 0 },
    },
    {
        id: 'base_mushroom_kingdom',
        name: '蘑菇王国',
        nameEn: 'Mushroom Kingdom',
        breakpoint: 20,
        vpAwards: [5, 3, 2],
        faction: 'tricksters',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 6 },
    },
    {
        id: 'base_pirate_cove',
        name: '灰色猫眼石/海盗湾',
        nameEn: 'Pirate Cove',
        breakpoint: 17,
        vpAwards: [3, 1, 1],
        faction: 'pirates',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 3 },
    },
    {
        id: 'base_tortuga',
        name: '托尔图加',
        nameEn: 'Tortuga',
        breakpoint: 21,
        vpAwards: [4, 3, 2],
        faction: 'pirates',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 13 },
    },
    {
        id: 'base_great_library',
        name: '大图书馆',
        nameEn: 'Great Library',
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        faction: 'wizards',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 10 },
    },
    {
        id: 'base_wizard_academy',
        name: '巫师学院',
        nameEn: 'Wizard Academy',
        breakpoint: 20,
        vpAwards: [3, 2, 1],
        faction: 'wizards',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 12 },
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
        faction: 'ghosts',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 6 },
        restrictions: [{ type: 'play_action' }],
    },
    {
        id: 'base_haunted_house_al9000',
        name: '鬼屋',
        nameEn: 'Haunted House',
        breakpoint: 18,
        vpAwards: [4, 3, 2],
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
        faction: 'bear_cavalry',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 0 },
    },
    {
        id: 'base_tsars_palace',
        name: '沙皇宫殿',
        nameEn: 'Tsar’s Palace',
        breakpoint: 22,
        vpAwards: [5, 3, 2],
        faction: 'bear_cavalry',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 1 },
        restrictions: [{ type: 'play_minion', condition: { maxPower: 2 } }],
    },
    // Steampunks
    {
        id: 'base_inventors_salon',
        name: '发明家沙龙',
        nameEn: 'Inventor’s Salon',
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        faction: 'steampunks',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 2 },
    },
    {
        id: 'base_the_workshop',
        name: '工坊',
        nameEn: 'The Workshop',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
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
        faction: 'killer_plants',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 4 },
    },
    {
        id: 'base_secret_garden',
        name: '神秘花园',
        nameEn: 'Secret Garden',
        breakpoint: 21,
        vpAwards: [3, 2, 1],
        faction: 'killer_plants',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE2, index: 5 },
        restrictions: [{ type: 'play_minion', condition: { extraPlayMinionPowerMax: 2 } }],
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
        faction: 'kitty_cats',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 0 },
    },
    {
        id: 'base_house_of_nine_lives',
        name: '九命之家',
        nameEn: 'House of Nine Lives',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
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
        faction: 'fairies',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 2 },
    },
    {
        id: 'base_fairy_ring',
        name: '仙灵圈',
        nameEn: 'Fairy Ring',
        breakpoint: 26,
        vpAwards: [4, 3, 2],
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
        faction: 'princesses',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 4 },
    },
    {
        id: 'base_castle_of_ice',
        name: '冰之城堡',
        nameEn: 'Castle of Ice',
        breakpoint: 15,
        vpAwards: [3, 2, 2],
        faction: 'princesses',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 5 },
        restrictions: [{ type: 'play_minion' }],
    },
    // Mythic Horses
    {
        id: 'base_land_of_balance',
        name: '平衡之地',
        nameEn: 'Land of Balance',
        breakpoint: 25,
        vpAwards: [5, 3, 2],
        faction: 'mythic_horses',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE3, index: 6 },
    },
    {
        id: 'base_pony_paradise',
        name: '小马乐园',
        nameEn: 'Pony Paradise',
        breakpoint: 18,
        vpAwards: [3, 2, 1],
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
        faction: 'cyborg_apes',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 0 },
        restrictions: [{ type: 'play_minion', condition: { minionPlayLimitPerTurn: 1 } }],
    },
    {
        id: 'base_antarctic_base',
        name: '南极基地',
        nameEn: 'Antarctic Base',
        breakpoint: 24,
        vpAwards: [5, 3, 2],
        faction: 'elder_things',
        // NOTE: atlas index 10 is reserved for this base in our atlas map
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 10 },
        restrictions: [{ type: 'play_minion', condition: { minionPlayLimitPerTurn: 1 } }],
    },
    {
        id: 'base_ritual_site',
        name: '仪式场所',
        nameEn: 'Ritual Site',
        breakpoint: 20,
        vpAwards: [4, 2, 2],
        faction: 'elder_things',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 1 },
    },
    {
        id: 'base_rlyeh',
        name: '拉莱耶',
        nameEn: 'R’lyeh',
        breakpoint: 18,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 2 },
    },
    {
        id: 'base_the_asylum',
        name: '庇护所',
        nameEn: 'The Asylum',
        breakpoint: 16,
        vpAwards: [3, 1, 1],
        faction: 'elder_things',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 3 },
    },
    {
        id: 'base_innsmouth_base',
        name: '印斯茅斯',
        nameEn: 'Innsmouth',
        breakpoint: 23,
        vpAwards: [5, 3, 2],
        faction: 'innsmouth',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 4 },
    },
    {
        id: 'base_mountains_of_madness',
        name: '疯狂山脉',
        nameEn: 'Mountains of Madness',
        breakpoint: 20,
        vpAwards: [6, 4, 3],
        faction: 'elder_things',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 5 },
    },
    {
        id: 'base_miskatonic_university_base',
        name: '米斯卡塔尼克大学',
        nameEn: 'Miskatonic University',
        breakpoint: 24,
        vpAwards: [3, 3, 2],
        faction: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY,
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 6 },
    },
    {
        id: 'base_plateau_of_leng',
        name: '伦格高原',
        nameEn: 'Plateau of Leng',
        breakpoint: 18,
        vpAwards: [3, 2, 1],
        faction: 'innsmouth',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 7 },
    },
    {
        id: 'base_the_pasture',
        name: '牧场',
        nameEn: 'The Pasture',
        breakpoint: 25,
        vpAwards: [5, 3, 2],
        faction: 'sheep',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 8 },
    },
    {
        id: 'base_sheep_shrine',
        name: '绵羊神社',
        nameEn: 'Sheep Shrine',
        breakpoint: 19,
        vpAwards: [4, 2, 1],
        faction: 'sheep',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE4, index: 9 },
        replaceOnSetup: true,
    },
    {
        id: 'base_castle_blood',
        name: '血堡',
        nameEn: 'Castle Blood',
        breakpoint: 18,
        vpAwards: [3, 1, 1],
        faction: 'vampires',
    },
    {
        id: 'base_crypt',
        name: '地窖',
        nameEn: 'Crypt',
        breakpoint: 20,
        vpAwards: [4, 2, 2],
        faction: 'vampires',
    },
];
registerBases(BASE_CARDS_SET4);

// ============================================================================
// 扩展基地 (Monster Smash - cards5)
// ============================================================================
export const BASE_CARDS_MONSTER_SMASH: BaseCardDef[] = [
    // Mad Scientists (Frankenstein)
    {
        id: 'base_laboratorium',
        name: '实验工坊',
        nameEn: 'Laboratorium',
        breakpoint: 25,
        vpAwards: [5, 3, 3],
        faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
    },
    {
        id: 'base_golem_schloss',
        name: '魔像城堡',
        nameEn: 'Golem Schloß',
        breakpoint: 22,
        vpAwards: [4, 3, 2],
        faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
    },
    // Werewolves
    {
        id: 'base_moot_site',
        name: '集会场',
        nameEn: 'Moot Site',
        breakpoint: 15,
        vpAwards: [2, 1, 0],
        faction: SMASHUP_FACTION_IDS.WEREWOLVES,
    },
    {
        id: 'base_standing_stones',
        name: '巨石阵',
        nameEn: 'Standing Stones',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.WEREWOLVES,
    },
    // Giant Ants
    {
        id: 'base_egg_chamber',
        name: '卵室',
        nameEn: 'Egg Chamber',
        breakpoint: 17,
        vpAwards: [3, 1, 1],
        faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
        // 使用文字兜底渲染（无 previewRef）
    },
    {
        id: 'base_the_hill',
        name: '蚁丘',
        nameEn: 'The Hill',
        breakpoint: 23,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.GIANT_ANTS,
        // 使用文字兜底渲染（无 previewRef）
    },
];
registerBases(BASE_CARDS_MONSTER_SMASH);
registerPodBaseSkeletons();

/**
 * POD 基地正式覆盖（仅覆盖当前已确认条目）。
 * 说明：先由基础基地克隆骨架，再用同 id 的 *_pod 定义覆盖具体数值/名称。
 */
const POD_BASE_OVERRIDES: BaseCardDef[] = [
    {
        id: 'base_ninja_dojo_pod',
        name: '忍者道场',
        nameEn: 'Ninja Dojo',
        breakpoint: 18,
        vpAwards: [2, 3, 2],
        faction: 'ninjas_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 0 },
    },
    {
        id: 'base_temple_of_goju_pod',
        name: '刚柔流寺庙',
        nameEn: 'Temple of Goju',
        breakpoint: 16,
        vpAwards: [4, 3, 2],
        faction: 'ninjas_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 4 },
    },
    {
        id: 'base_the_factory_pod',
        name: '436-1337工厂',
        nameEn: 'Factory 436-1337',
        breakpoint: 25,
        vpAwards: [2, 2, 1],
        faction: 'robots_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 7 },
    },
    {
        id: 'base_central_brain_pod',
        name: '中央大脑',
        nameEn: 'The Central Brain',
        breakpoint: 19,
        vpAwards: [4, 2, 1],
        faction: 'robots_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 8 },
        minionPowerBonus: 1,
    },
    {
        id: 'base_cave_of_shinies_pod',
        name: '闪光洞穴',
        nameEn: 'Cave of Shinies',
        breakpoint: 23,
        vpAwards: [4, 2, 1],
        faction: 'tricksters_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 11 },
    },
    {
        id: 'base_mushroom_kingdom_pod',
        name: '蘑菇王国',
        nameEn: 'Mushroom Kingdom',
        breakpoint: 19,
        vpAwards: [4, 3, 2],
        faction: 'tricksters_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 6 },
    },
    {
        id: 'base_wizard_academy_pod',
        name: '巫术学院',
        nameEn: 'School of Wizardry',
        breakpoint: 20,
        vpAwards: [3, 2, 1],
        faction: 'wizards_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 12 },
    },
    {
        id: 'base_great_library_pod',
        name: '大图书馆',
        nameEn: 'The Great Library',
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        faction: 'wizards_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 10 },
    },
    {
        id: 'base_haunted_house_pod',
        name: '伊万斯城公墓',
        nameEn: 'Evans City Cemetery',
        breakpoint: 20,
        vpAwards: [5, 3, 2],
        faction: 'zombies_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 14 },
    },
    {
        id: 'base_rhodes_plaza_pod',
        name: '罗德百货商场',
        nameEn: 'Rhodes Plaza Mall',
        breakpoint: 24,
        vpAwards: [0, 0, 0],
        faction: 'zombies_pod',
        previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.BASE1, index: 2 },
    },
];
registerBases(POD_BASE_OVERRIDES);

function buildPodBaseOverrideFromRegistry(id: string, overrides: Partial<BaseCardDef>): BaseCardDef {
    const podBase = _baseRegistry.get(id);
    if (!podBase) {
        throw new Error(`[smashup] missing pod base for override: ${id}`);
    }
    return {
        ...podBase,
        ...overrides,
        id,
    };
}

const POD_BASE_OVERRIDES_EXTENDED: BaseCardDef[] = [
    // Keep previously confirmed base-set POD corrections
    buildPodBaseOverrideFromRegistry('base_ninja_dojo_pod', {
        nameEn: 'Ninja Dojo',
        breakpoint: 18,
        vpAwards: [2, 3, 2],
        faction: SMASHUP_FACTION_IDS.NINJAS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_temple_of_goju_pod', {
        nameEn: 'Temple of Goju',
        breakpoint: 16,
        vpAwards: [4, 3, 2],
        faction: SMASHUP_FACTION_IDS.NINJAS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_the_factory_pod', {
        nameEn: 'Factory 436-1337',
        breakpoint: 25,
        vpAwards: [2, 2, 1],
        faction: SMASHUP_FACTION_IDS.ROBOTS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_central_brain_pod', {
        nameEn: 'The Central Brain',
        breakpoint: 19,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.ROBOTS_POD,
        minionPowerBonus: 1,
    }),
    buildPodBaseOverrideFromRegistry('base_cave_of_shinies_pod', {
        nameEn: 'Cave of Shinies',
        breakpoint: 23,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.TRICKSTERS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_mushroom_kingdom_pod', {
        nameEn: 'Mushroom Kingdom',
        breakpoint: 19,
        vpAwards: [4, 3, 2],
        faction: SMASHUP_FACTION_IDS.TRICKSTERS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_wizard_academy_pod', {
        nameEn: 'School of Wizardry',
        breakpoint: 20,
        vpAwards: [3, 2, 1],
        faction: SMASHUP_FACTION_IDS.WIZARDS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_great_library_pod', {
        nameEn: 'The Great Library',
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.WIZARDS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_haunted_house_pod', {
        nameEn: 'Evans City Cemetery',
        breakpoint: 20,
        vpAwards: [5, 3, 2],
        faction: SMASHUP_FACTION_IDS.ZOMBIES_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_rhodes_plaza_pod', {
        nameEn: 'Rhodes Plaza Mall',
        breakpoint: 24,
        vpAwards: [0, 0, 0],
        faction: SMASHUP_FACTION_IDS.ZOMBIES_POD,
    }),

    // Bear Cavalry POD
    buildPodBaseOverrideFromRegistry('base_the_field_of_honor_pod', {
        nameEn: 'Field of Honor',
        breakpoint: 16,
        vpAwards: [3, 1, 1],
        faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_tsars_palace_pod', {
        nameEn: "Tsar's Palace",
        breakpoint: 22,
        vpAwards: [5, 3, 2],
        faction: SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD,
    }),

    // Elder Things POD
    buildPodBaseOverrideFromRegistry('base_antarctic_base_pod', {
        nameEn: 'Antarctic Base',
        breakpoint: 24,
        vpAwards: [5, 3, 2],
        faction: SMASHUP_FACTION_IDS.ELDER_THINGS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_plateau_of_leng_pod', {
        nameEn: 'Plateau of Leng',
        breakpoint: 18,
        vpAwards: [3, 2, 1],
        faction: SMASHUP_FACTION_IDS.ELDER_THINGS_POD,
    }),

    // Ghosts POD
    buildPodBaseOverrideFromRegistry('base_haunted_house_al9000_pod', {
        nameEn: 'Haunted House',
        breakpoint: 18,
        vpAwards: [4, 3, 2],
        faction: SMASHUP_FACTION_IDS.GHOSTS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_dread_lookout_pod', {
        nameEn: 'The Dread Gazebo',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.GHOSTS_POD,
    }),

    // Giant Ants POD
    buildPodBaseOverrideFromRegistry('base_the_hill_pod', {
        nameEn: 'The Hill',
        breakpoint: 23,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.GIANT_ANTS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_egg_chamber_pod', {
        nameEn: 'Egg Chamber',
        breakpoint: 17,
        vpAwards: [3, 1, 1],
        faction: SMASHUP_FACTION_IDS.GIANT_ANTS_POD,
    }),

    // Innsmouth POD
    buildPodBaseOverrideFromRegistry('base_innsmouth_base_pod', {
        nameEn: 'Innsmouth',
        breakpoint: 23,
        vpAwards: [5, 3, 2],
        faction: SMASHUP_FACTION_IDS.INNSMOUTH_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_ritual_site_pod', {
        nameEn: 'Ritual Site',
        breakpoint: 20,
        vpAwards: [4, 2, 2],
        faction: SMASHUP_FACTION_IDS.INNSMOUTH_POD,
    }),

    // Killer Plants POD
    buildPodBaseOverrideFromRegistry('base_secret_garden_pod', {
        nameEn: 'Secret Grove',
        breakpoint: 21,
        vpAwards: [3, 2, 1],
        faction: SMASHUP_FACTION_IDS.KILLER_PLANTS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_greenhouse_pod', {
        nameEn: 'The Greenhouse',
        breakpoint: 24,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.KILLER_PLANTS_POD,
    }),

    // Mad Scientists POD
    buildPodBaseOverrideFromRegistry('base_golem_schloss_pod', {
        nameEn: 'Golem Schloß',
        breakpoint: 22,
        vpAwards: [4, 3, 2],
        faction: SMASHUP_FACTION_IDS.FRANKENSTEIN_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_laboratorium_pod', {
        nameEn: 'Laboratorium',
        breakpoint: 25,
        vpAwards: [5, 3, 3],
        faction: SMASHUP_FACTION_IDS.FRANKENSTEIN_POD,
    }),

    // Minions of Cthulhu POD
    buildPodBaseOverrideFromRegistry('base_mountains_of_madness_pod', {
        nameEn: 'Mountains of Madness',
        breakpoint: 20,
        vpAwards: [6, 4, 3],
        faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_rlyeh_pod', {
        nameEn: "R'lyeh",
        breakpoint: 18,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD,
    }),

    // Miskatonic University POD
    buildPodBaseOverrideFromRegistry('base_miskatonic_university_base_pod', {
        nameEn: 'Arkham University',
        breakpoint: 24,
        vpAwards: [4, 3, 2],
        faction: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_the_asylum_pod', {
        nameEn: 'Asylum',
        breakpoint: 16,
        vpAwards: [3, 1, 1],
        faction: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD,
    }),

    // Pirates POD
    buildPodBaseOverrideFromRegistry('base_pirate_cove_pod', {
        nameEn: 'The Grey Opal',
        breakpoint: 17,
        vpAwards: [3, 1, 1],
        faction: SMASHUP_FACTION_IDS.PIRATES_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_tortuga_pod', {
        nameEn: 'Tortuga',
        breakpoint: 21,
        vpAwards: [4, 3, 2],
        faction: SMASHUP_FACTION_IDS.PIRATES_POD,
    }),

    // Steampunks POD
    buildPodBaseOverrideFromRegistry('base_inventors_salon_pod', {
        nameEn: "Inventor's Salon",
        breakpoint: 22,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.STEAMPUNKS_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_the_workshop_pod', {
        nameEn: 'Workshop',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.STEAMPUNKS_POD,
    }),

    // Werewolves POD
    buildPodBaseOverrideFromRegistry('base_moot_site_pod', {
        nameEn: 'Moot Site',
        breakpoint: 15,
        vpAwards: [2, 1, 0],
        faction: SMASHUP_FACTION_IDS.WEREWOLVES_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_standing_stones_pod', {
        nameEn: 'Standing Stones',
        breakpoint: 20,
        vpAwards: [4, 2, 1],
        faction: SMASHUP_FACTION_IDS.WEREWOLVES_POD,
    }),

    // Vampires POD
    buildPodBaseOverrideFromRegistry('base_castle_blood_pod', {
        nameEn: 'Castle Blood',
        breakpoint: 17,
        vpAwards: [3, 1, 1],
        faction: SMASHUP_FACTION_IDS.VAMPIRES_POD,
    }),
    buildPodBaseOverrideFromRegistry('base_crypt_pod', {
        nameEn: 'Crypt',
        breakpoint: 20,
        vpAwards: [4, 2, 2],
        faction: SMASHUP_FACTION_IDS.VAMPIRES_POD,
    }),
];
registerBases(POD_BASE_OVERRIDES_EXTENDED);

// ============================================================================
// 基地选择：按所选派系过滤
// ============================================================================

/** 根据所选派系获取基地定义 ID（只使用所选派系的基地） */
function getBaseDefIdsForFactionsLegacy(factionIds: string[]): string[] {
    const selected = new Set(factionIds);
    const matched = Array.from(_baseRegistry.values())
        .filter(base => base.faction && selected.has(base.faction))
        .map(base => base.id);

    // 检查是否有派系没有对应基地（如 POD 派系）
    // 统计每个派系匹配到的基地数量
    const factionBaseCounts = new Map<string, number>();
    for (const base of _baseRegistry.values()) {
        if (base.faction && selected.has(base.faction)) {
            factionBaseCounts.set(base.faction, (factionBaseCounts.get(base.faction) || 0) + 1);
        }
    }

    // 找出没有基地的派系
    const factionsWithoutBases = factionIds.filter(fid => !factionBaseCounts.has(fid));

    // 如果有派系没有基地，为每个缺失的派系补充 2 个基地
    if (factionsWithoutBases.length > 0) {
        const allBases = getAllBaseDefIds();
        const usedBases = new Set(matched);
        const availableBases = allBases.filter(id => !usedBases.has(id));

        const missingCount = factionsWithoutBases.length * 2;
        // 从可用基地中选择（不洗牌，保持确定性，由调用方洗牌）
        const supplementBases = availableBases.slice(0, Math.min(missingCount, availableBases.length));
        return [...matched, ...supplementBases];
    }

    return matched;
}


/** 查找卡牌定义 */
/** 鏍规嵁鎵€閫夋淳绯昏幏鍙栧熀鍦板畾涔?ID锛堝悓鍙樹綋琛ュ厖锛欿OD 鍙ˉ POD锛屽熀纭€鍙ˉ鍩虹锛?*/
export function getBaseDefIdsForFactions(factionIds: string[]): string[] {
    const selectedFactions = Array.from(new Set(factionIds));
    if (selectedFactions.length === 0) {
        return getBaseDefIdsForFactionsLegacy(factionIds);
    }
    const allBases = Array.from(_baseRegistry.values()).filter(base => !!base.faction);

    const basesByFaction = new Map<string, string[]>();
    for (const base of allBases) {
        const faction = base.faction as string;
        const existing = basesByFaction.get(faction);
        if (existing) {
            existing.push(base.id);
        } else {
            basesByFaction.set(faction, [base.id]);
        }
    }

    const result: string[] = [];
    const usedBaseIds = new Set<string>();
    const appendBaseIds = (baseIds: string[]) => {
        for (const baseId of baseIds) {
            if (usedBaseIds.has(baseId)) continue;
            usedBaseIds.add(baseId);
            result.push(baseId);
        }
    };

    // 1) 绮剧‘鍖归厤鎵€閫夋淳绯伙紙鍚?POD 锛?
    for (const factionId of selectedFactions) {
        appendBaseIds(basesByFaction.get(factionId) ?? []);
    }

    // 2) 杞繃娓★細姣忎釜娲剧郴涓嶈冻 2 寮犲熀鍦版椂锛屾寜鍚屽彉浣撹ˉ榻?
    for (const factionId of selectedFactions) {
        const exactCount = (basesByFaction.get(factionId) ?? []).length;
        const needCount = Math.max(0, BASES_PER_FACTION - exactCount);
        if (needCount === 0) continue;

        const wantsPodVariant = isPodVariantId(factionId);
        const supplementCandidates = allBases
            .filter(base => isPodVariantId(base.id) === wantsPodVariant)
            .map(base => base.id)
            .filter(baseId => !usedBaseIds.has(baseId));

        appendBaseIds(supplementCandidates.slice(0, needCount));
    }

    return result;
}

export function getCardDef(defId: string): CardDef | undefined {
    return _cardRegistry.get(defId);
}

/** 查找随从卡定义 */
export function getMinionDef(defId: string): MinionCardDef | undefined {
    const def = _cardRegistry.get(defId);
    return def?.type === 'minion' ? def : undefined;
}

/** 查找融合卡定义 */
export function getFusionDef(defId: string): FusionCardDef | undefined {
    const def = _cardRegistry.get(defId);
    return def?.type === 'fusion' ? def : undefined;
}

/** 获取“作为随从”打出时的印制力量（随从或融合卡） */
export function getMinionLikePower(defId: string): number | undefined {
    const def = _cardRegistry.get(defId);
    if (!def) return undefined;
    if (def.type === 'minion') return def.power;
    if (def.type === 'fusion') return def.minionPower;
    return undefined;
}

/** 查找基地定义 */
export function getBaseDef(defId: string): BaseCardDef | undefined {
    return _baseRegistry.get(defId);
}

function resolveLocaleValue(t: (key: string) => string, keys: string[]): string | undefined {
    for (const key of keys) {
        const resolved = t(key);
        if (resolved && resolved !== key) return resolved;
    }
    return undefined;
}

function getPodFallbackKeyId(defId: string): string | undefined {
    return defId.endsWith('_pod') ? defId.replace(/_pod$/, '') : undefined;
}

/**
 * 解析卡牌名称（从 i18n 获取）
 *
 * @param def 卡牌定义
 * @param t   i18n 翻译函数（来自 useTranslation('game-smashup')）
 * @returns   本地化的卡牌名称
 */
export function resolveCardName(def: CardDef | BaseCardDef | undefined, t: (key: string) => string): string {
    if (!def) return '';
    // 1) 优先尝试完整 ID（POD 版应优先命中 cards.xxx_pod.name）
    const primaryKey = `cards.${def.id}.name`;
    const resolvedPrimary = t(primaryKey);
    if (resolvedPrimary && resolvedPrimary !== primaryKey) return resolvedPrimary;

    // 2) 若未命中且是 POD 版，回退到基础版本 cards.xxx.name
    const fallbackLocaleKeyId = getPodFallbackKeyId(def.id);
    if (fallbackLocaleKeyId) {
        const fallbackKey = `cards.${fallbackLocaleKeyId}.name`;
        const resolvedFallback = t(fallbackKey);
        if (resolvedFallback && resolvedFallback !== fallbackKey) return resolvedFallback;
    }

    // 3) 若 def.name 已是 i18n key，则继续尝试；否则用 cards.<baseId>.name
    const baseId = def.id.replace(/_pod$/, '');
    const key = def.name.startsWith('cards.') ? def.name : `cards.${baseId}.name`;
    const resolved = t(key);
    return (resolved && resolved !== key) ? resolved : def.name;
}

/**
 * 解析卡牌效果文本（从 i18n 获取）
 *
 * @param def 卡牌定义
 * @param t   i18n 翻译函数（来自 useTranslation('game-smashup')）
 * @returns   本地化的效果文本
 */
export function resolveCardText(def: CardDef | BaseCardDef | undefined, t: (key: string) => string): string {
    if (!def) return '';
    const textField = ('type' in def && def.type === 'action') ? 'effectText' : 'abilityText';
    const localeKeys = [`cards.${def.id}.${textField}`];
    const fallbackLocaleKeyId = getPodFallbackKeyId(def.id);
    if (fallbackLocaleKeyId) {
        localeKeys.push(`cards.${fallbackLocaleKeyId}.${textField}`);
    }

    const localeValue = resolveLocaleValue(t, localeKeys);
    if (localeValue) return localeValue;
    // 随从用 abilityText，行动卡用 effectText，基地用 abilityText
    const field = ('type' in def && def.type === 'action') ? 'effectText' : 'abilityText';

    // 1. 优先尝试完整 ID (如果是 POD 版，这将匹配 cards.xxx_pod.xxxText)
    const podKey = `cards.${def.id}.${field}`;
    const resolvedPod = t(podKey);
    if (resolvedPod && resolvedPod !== podKey) return resolvedPod;

    // 2. 如果未命中，且 ID 含有 _pod，尝试去掉后缀的基础版本
    const keyId = def.id.replace(/_pod$/, '');
    const key = `cards.${keyId}.${field}`;
    const resolved = t(key);

    // 如果找到了翻译，返回翻译
    if (resolved && resolved !== key) return resolved;

    // 未命中则查找原始对象中的属性 fallback
    // @ts-ignore
    const fallbackAttr = def[field];
    return typeof fallbackAttr === 'string' ? fallbackAttr : '';
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

/** 获取所有卡牌定义 */
export function getAllCardDefs(): CardDef[] {
    return Array.from(_cardRegistry.values());
}

/** 获取所有基地定义 ID 列表 */
export function getAllBaseDefIds(): string[] {
    return Array.from(_baseRegistry.keys());
}

/** 获取所有基地定义 */
export function getAllBaseDefs(): BaseCardDef[] {
    return Array.from(_baseRegistry.values());
}

// 重导出类型用于外部引用
import type { FactionId } from '../domain/types';
