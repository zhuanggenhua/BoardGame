export type SplendorSpriteAtlasId = 'tier1' | 'tier2' | 'tier3' | 'nobles';

export interface SplendorSpriteAtlasConfig {
    id: SplendorSpriteAtlasId;
    title: string;
    imagePath: string;
    cols: number;
    rows: number;
    tier?: 1 | 2 | 3;
    modelKind: 'card' | 'noble';
    frameIds: string[];
}

export const LEVEL_1_CARD_ORDER = [
    't1-white-1',
    't1-white-2',
    't1-white-3',
    't1-white-4',
    't1-white-6',
    't1-white-5',
    't1-white-8',
    't1-white-7',
    't1-green-1',
    't1-green-2',
    't1-green-4',
    't1-green-3',
    't1-green-6',
    't1-green-5',
    't1-green-7',
    't1-green-8',
    't1-black-2',
    't1-black-1',
    't1-black-4',
    't1-black-3',
    't1-black-6',
    't1-black-5',
    't1-black-7',
    't1-black-8',
    't1-red-2',
    't1-red-1',
    't1-red-4',
    't1-red-6',
    't1-red-5',
    't1-red-8',
    't1-red-7',
    't1-red-3',
    't1-blue-1',
    't1-blue-2',
    't1-blue-4',
    't1-blue-3',
    't1-blue-6',
    't1-blue-5',
    't1-blue-8',
    't1-blue-7',
];

export const LEVEL_2_CARD_ORDER = [
    't2-white-1',
    't2-white-2',
    't2-white-3',
    't2-white-4',
    't2-white-5',
    't2-white-6',
    't2-green-5',
    't2-green-4',
    't2-green-6',
    't2-green-2',
    't2-green-1',
    't2-green-3',
    't2-black-2',
    't2-black-3',
    't2-black-1',
    't2-black-4',
    't2-black-5',
    't2-black-6',
    't2-red-1',
    't2-red-2',
    't2-red-3',
    't2-red-4',
    't2-red-5',
    't2-red-6',
    't2-blue-1',
    't2-blue-2',
    't2-blue-3',
    't2-blue-4',
    't2-blue-6',
    't2-blue-5',
];

export const LEVEL_3_CARD_ORDER = [
    't3-white-4',
    't3-white-2',
    't3-white-3',
    't3-white-1',
    't3-green-3',
    't3-green-2',
    't3-green-4',
    't3-green-1',
    't3-black-2',
    't3-black-3',
    't3-black-4',
    't3-black-1',
    't3-red-2',
    't3-red-1',
    't3-red-4',
    't3-red-3',
    't3-blue-4',
    't3-blue-3',
    't3-blue-1',
    't3-blue-2',
];


export const NOBLE_CARD_ORDER: string[] = [
    'noble-1', 'noble-2', 'noble-3', 'noble-4', 'noble-5',
    'noble-6', 'noble-7', 'noble-8', 'noble-9', 'noble-10',
];

export const SPLENDOR_SPRITE_ATLASES: SplendorSpriteAtlasConfig[] = [
    {
        id: 'tier1',
        title: '一级发展卡',
        imagePath: 'splendor/level-1-cards.jpg',
        cols: 10,
        rows: 4,
        tier: 1,
        modelKind: 'card',
        frameIds: LEVEL_1_CARD_ORDER,
    },
    {
        id: 'tier2',
        title: '二级发展卡',
        imagePath: 'splendor/level-2-cards.jpg',
        cols: 10,
        rows: 3,
        tier: 2,
        modelKind: 'card',
        frameIds: LEVEL_2_CARD_ORDER,
    },
    {
        id: 'tier3',
        title: '三级发展卡',
        imagePath: 'splendor/level-3-cards.jpg',
        cols: 10,
        rows: 2,
        tier: 3,
        modelKind: 'card',
        frameIds: LEVEL_3_CARD_ORDER,
    },
    {
        id: 'nobles',
        title: '贵族',
        imagePath: 'splendor/nobles.jpg',
        cols: 5,
        rows: 2,
        modelKind: 'noble',
        frameIds: NOBLE_CARD_ORDER,
    },
];

export const SPLENDOR_SPRITE_ATLAS_BY_ID = Object.fromEntries(
    SPLENDOR_SPRITE_ATLASES.map((atlas) => [atlas.id, atlas]),
) as Record<SplendorSpriteAtlasId, SplendorSpriteAtlasConfig>;

export function buildIndexMap(order: string[]): Record<string, number> {
    return Object.fromEntries(order.map((cardId, index) => [cardId, index])) as Record<string, number>;
}

export function serializeSplendorSpriteMapping(mapping: Record<SplendorSpriteAtlasId, string[]>): string {
    return [
        'export const LEVEL_1_CARD_ORDER = [',
        ...mapping.tier1.map((id) => `    '${id}',`),
        '];',
        '',
        'export const LEVEL_2_CARD_ORDER = [',
        ...mapping.tier2.map((id) => `    '${id}',`),
        '];',
        '',
        'export const LEVEL_3_CARD_ORDER = [',
        ...mapping.tier3.map((id) => `    '${id}',`),
        '];',
        '',
        'export const NOBLE_CARD_ORDER = [',
        ...mapping.nobles.map((id) => `    '${id}',`),
        '];',
    ].join('\n');
}
