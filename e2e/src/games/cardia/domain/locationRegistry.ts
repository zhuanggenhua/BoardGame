/**
 * Cardia 地点卡注册表
 * 定义所有地点卡的元数据（可选规则）
 */

/**
 * 地点卡 ID
 */
export const LOCATION_IDS = {
    GIANT_SERPENT: 'location_giant_serpent',
    MARKET: 'location_market',
    SWORD_STARTER_CAMP: 'location_sword_starter_camp',
    GREAT_LIBRARY: 'location_great_library',
    GARBAGE_DUMP: 'location_garbage_dump',
    AUCTION_HOUSE: 'location_auction_house',
    HAUNTED_CATACOMBS: 'location_haunted_catacombs',
    MISTY_SWAMP: 'location_misty_swamp',
} as const;

export type LocationId = typeof LOCATION_IDS[keyof typeof LOCATION_IDS];

/**
 * 地点卡定义接口
 */
export interface LocationDef {
    id: LocationId;
    nameKey: string;
    descriptionKey: string;
    imagePath: string;  // 图片路径（不含扩展名，不含 compressed/）
}

/**
 * 地点卡定义（8 张）
 * 按照实际图片文件的对应关系排列
 */
export const LOCATIONS: LocationDef[] = [
    {
        id: LOCATION_IDS.MISTY_SWAMP,
        nameKey: 'locations.misty_swamp.name',
        descriptionKey: 'locations.misty_swamp.description',
        imagePath: 'cardia/cards/locations/1',
    },
    {
        id: LOCATION_IDS.GREAT_LIBRARY,
        nameKey: 'locations.great_library.name',
        descriptionKey: 'locations.great_library.description',
        imagePath: 'cardia/cards/locations/2',
    },
    {
        id: LOCATION_IDS.HAUNTED_CATACOMBS,
        nameKey: 'locations.haunted_catacombs.name',
        descriptionKey: 'locations.haunted_catacombs.description',
        imagePath: 'cardia/cards/locations/3',
    },
    {
        id: LOCATION_IDS.GIANT_SERPENT,
        nameKey: 'locations.giant_serpent.name',
        descriptionKey: 'locations.giant_serpent.description',
        imagePath: 'cardia/cards/locations/4',
    },
    {
        id: LOCATION_IDS.AUCTION_HOUSE,
        nameKey: 'locations.auction_house.name',
        descriptionKey: 'locations.auction_house.description',
        imagePath: 'cardia/cards/locations/5',
    },
    {
        id: LOCATION_IDS.SWORD_STARTER_CAMP,
        nameKey: 'locations.sword_starter_camp.name',
        descriptionKey: 'locations.sword_starter_camp.description',
        imagePath: 'cardia/cards/locations/6',
    },
    {
        id: LOCATION_IDS.GARBAGE_DUMP,
        nameKey: 'locations.garbage_dump.name',
        descriptionKey: 'locations.garbage_dump.description',
        imagePath: 'cardia/cards/locations/7',
    },
    {
        id: LOCATION_IDS.MARKET,
        nameKey: 'locations.market.name',
        descriptionKey: 'locations.market.description',
        imagePath: 'cardia/cards/locations/8',
    },
];

/**
 * 地点卡注册表（Map 结构，快速查询）
 */
const locationRegistry = new Map<LocationId, LocationDef>(
    LOCATIONS.map(loc => [loc.id, loc])
);

export default locationRegistry;
