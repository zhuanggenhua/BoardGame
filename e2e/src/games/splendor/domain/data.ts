import type { SplendorCardDef, SplendorNobleDef } from './types';

const BONUS_LABEL_ZH: Record<SplendorCardDef['bonus'], string> = {
    white: '白系',
    blue: '蓝系',
    green: '绿系',
    red: '红系',
    black: '黑系',
};

const REQUIREMENT_COLOR_LABEL_ZH: Record<keyof SplendorNobleDef['requirement'], string> = {
    white: '白',
    blue: '蓝',
    green: '绿',
    red: '红',
    black: '黑',
};

const TIER_LABEL_ZH: Record<1 | 2 | 3, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
};

function createCardDisplayName(
    id: string,
    tier: 1 | 2 | 3,
    bonus: SplendorCardDef['bonus'],
): string {
    const sequence = id.split('-').at(-1) ?? '1';
    return `${BONUS_LABEL_ZH[bonus]}发展卡 ${TIER_LABEL_ZH[tier]}-${sequence}`;
}

function createNobleDisplayName(requirement: SplendorNobleDef['requirement']): string {
    const colors = Object.entries(requirement)
        .filter(([, count]) => count > 0)
        .map(([color]) => REQUIREMENT_COLOR_LABEL_ZH[color as keyof SplendorNobleDef['requirement']])
        .join('');
    const kind = Object.values(requirement).filter((count) => count > 0).length >= 3 ? '多色贵族' : '双色贵族';
    return `${kind}·${colors}`;
}

const card = (
    id: string,
    tier: 1 | 2 | 3,
    bonus: SplendorCardDef['bonus'],
    points: number,
    black: number,
    blue: number,
    green: number,
    red: number,
    white: number,
): SplendorCardDef => ({
    id,
    name: createCardDisplayName(id, tier, bonus),
    tier,
    points,
    bonus,
    cost: {
        white,
        blue,
        green,
        red,
        black,
    },
});

export const SPLENDOR_CARD_DEFS: SplendorCardDef[] = [
    // Level 1 - Black
    card('t1-black-1', 1, 'black', 0, 0, 1, 1, 1, 1),
    card('t1-black-2', 1, 'black', 0, 0, 2, 1, 1, 1),
    card('t1-black-3', 1, 'black', 0, 0, 2, 0, 1, 2),
    card('t1-black-4', 1, 'black', 0, 1, 0, 1, 3, 0),
    card('t1-black-5', 1, 'black', 0, 0, 0, 2, 1, 0),
    card('t1-black-6', 1, 'black', 0, 0, 0, 2, 0, 2),
    card('t1-black-7', 1, 'black', 0, 0, 0, 3, 0, 0),
    card('t1-black-8', 1, 'black', 1, 0, 4, 0, 0, 0),

    // Level 1 - Blue
    card('t1-blue-1', 1, 'blue', 0, 1, 0, 1, 1, 1),
    card('t1-blue-2', 1, 'blue', 0, 1, 0, 1, 2, 1),
    card('t1-blue-3', 1, 'blue', 0, 0, 0, 2, 2, 1),
    card('t1-blue-4', 1, 'blue', 0, 0, 1, 3, 1, 0),
    card('t1-blue-5', 1, 'blue', 0, 2, 0, 0, 0, 1),
    card('t1-blue-6', 1, 'blue', 0, 2, 0, 2, 0, 0),
    card('t1-blue-7', 1, 'blue', 0, 3, 0, 0, 0, 0),
    card('t1-blue-8', 1, 'blue', 1, 0, 0, 0, 4, 0),

    // Level 1 - White
    card('t1-white-1', 1, 'white', 0, 1, 1, 1, 1, 0),
    card('t1-white-2', 1, 'white', 0, 1, 1, 2, 1, 0),
    card('t1-white-3', 1, 'white', 0, 1, 2, 2, 0, 0),
    card('t1-white-4', 1, 'white', 0, 1, 1, 0, 0, 3),
    card('t1-white-5', 1, 'white', 0, 1, 0, 0, 2, 0),
    card('t1-white-6', 1, 'white', 0, 2, 2, 0, 0, 0),
    card('t1-white-7', 1, 'white', 0, 0, 3, 0, 0, 0),
    card('t1-white-8', 1, 'white', 1, 0, 0, 4, 0, 0),

    // Level 1 - Green
    card('t1-green-1', 1, 'green', 0, 1, 1, 0, 1, 1),
    card('t1-green-2', 1, 'green', 0, 2, 1, 0, 1, 1),
    card('t1-green-3', 1, 'green', 0, 2, 1, 0, 2, 0),
    card('t1-green-4', 1, 'green', 0, 0, 3, 1, 0, 1),
    card('t1-green-5', 1, 'green', 0, 0, 1, 0, 0, 2),
    card('t1-green-6', 1, 'green', 0, 0, 2, 0, 2, 0),
    card('t1-green-7', 1, 'green', 0, 0, 0, 0, 3, 0),
    card('t1-green-8', 1, 'green', 1, 4, 0, 0, 0, 0),

    // Level 1 - Red
    card('t1-red-1', 1, 'red', 0, 1, 1, 1, 0, 1),
    card('t1-red-2', 1, 'red', 0, 1, 1, 1, 0, 2),
    card('t1-red-3', 1, 'red', 0, 2, 0, 1, 0, 2),
    card('t1-red-4', 1, 'red', 0, 3, 0, 0, 1, 1),
    card('t1-red-5', 1, 'red', 0, 0, 2, 1, 0, 0),
    card('t1-red-6', 1, 'red', 0, 0, 0, 0, 2, 2),
    card('t1-red-7', 1, 'red', 0, 0, 0, 0, 0, 3),
    card('t1-red-8', 1, 'red', 1, 0, 0, 0, 0, 4),

    // Level 2 - Black
    card('t2-black-1', 2, 'black', 1, 0, 2, 2, 0, 3),
    card('t2-black-2', 2, 'black', 1, 2, 0, 3, 0, 3),
    card('t2-black-3', 2, 'black', 2, 0, 1, 4, 2, 0),
    card('t2-black-4', 2, 'black', 2, 0, 0, 5, 3, 0),
    card('t2-black-5', 2, 'black', 2, 0, 0, 0, 0, 5),
    card('t2-black-6', 2, 'black', 3, 6, 0, 0, 0, 0),

    // Level 2 - Blue
    card('t2-blue-1', 2, 'blue', 1, 0, 2, 2, 3, 0),
    card('t2-blue-2', 2, 'blue', 1, 3, 2, 3, 0, 0),
    card('t2-blue-3', 2, 'blue', 2, 0, 3, 0, 0, 5),
    card('t2-blue-4', 2, 'blue', 2, 4, 0, 0, 1, 2),
    card('t2-blue-5', 2, 'blue', 2, 0, 5, 0, 0, 0),
    card('t2-blue-6', 2, 'blue', 3, 0, 6, 0, 0, 0),

    // Level 2 - White
    card('t2-white-1', 2, 'white', 1, 2, 0, 3, 2, 0),
    card('t2-white-2', 2, 'white', 1, 0, 3, 0, 3, 2),
    card('t2-white-3', 2, 'white', 2, 2, 0, 1, 4, 0),
    card('t2-white-4', 2, 'white', 2, 3, 0, 0, 5, 0),
    card('t2-white-5', 2, 'white', 2, 0, 0, 0, 5, 0),
    card('t2-white-6', 2, 'white', 3, 0, 0, 0, 0, 6),

    // Level 2 - Green
    card('t2-green-1', 2, 'green', 1, 0, 0, 2, 3, 3),
    card('t2-green-2', 2, 'green', 1, 2, 3, 0, 0, 2),
    card('t2-green-3', 2, 'green', 2, 1, 2, 0, 0, 4),
    card('t2-green-4', 2, 'green', 2, 0, 5, 3, 0, 0),
    card('t2-green-5', 2, 'green', 2, 0, 0, 5, 0, 0),
    card('t2-green-6', 2, 'green', 3, 0, 0, 6, 0, 0),

    // Level 2 - Red
    card('t2-red-1', 2, 'red', 1, 3, 0, 0, 2, 2),
    card('t2-red-2', 2, 'red', 1, 3, 3, 0, 2, 0),
    card('t2-red-3', 2, 'red', 2, 0, 4, 2, 0, 1),
    card('t2-red-4', 2, 'red', 2, 5, 0, 0, 0, 3),
    card('t2-red-5', 2, 'red', 2, 5, 0, 0, 0, 0),
    card('t2-red-6', 2, 'red', 3, 0, 0, 0, 6, 0),

    // Level 3 - Black
    card('t3-black-1', 3, 'black', 3, 0, 3, 5, 3, 3),
    card('t3-black-2', 3, 'black', 4, 0, 0, 0, 7, 0),
    card('t3-black-3', 3, 'black', 4, 3, 0, 3, 6, 0),
    card('t3-black-4', 3, 'black', 5, 3, 0, 0, 7, 0),

    // Level 3 - Blue
    card('t3-blue-1', 3, 'blue', 3, 5, 0, 3, 3, 3),
    card('t3-blue-2', 3, 'blue', 4, 0, 0, 0, 0, 7),
    card('t3-blue-3', 3, 'blue', 4, 3, 3, 0, 0, 6),
    card('t3-blue-4', 3, 'blue', 5, 0, 3, 0, 0, 7),

    // Level 3 - White
    card('t3-white-1', 3, 'white', 3, 3, 3, 3, 5, 0),
    card('t3-white-2', 3, 'white', 4, 7, 0, 0, 0, 0),
    card('t3-white-3', 3, 'white', 4, 6, 0, 0, 3, 3),
    card('t3-white-4', 3, 'white', 5, 7, 0, 0, 0, 3),

    // Level 3 - Green
    card('t3-green-1', 3, 'green', 3, 3, 3, 0, 3, 5),
    card('t3-green-2', 3, 'green', 4, 0, 7, 0, 0, 0),
    card('t3-green-3', 3, 'green', 4, 0, 6, 3, 0, 3),
    card('t3-green-4', 3, 'green', 5, 0, 7, 3, 0, 0),

    // Level 3 - Red
    card('t3-red-1', 3, 'red', 3, 3, 5, 3, 0, 3),
    card('t3-red-2', 3, 'red', 4, 0, 0, 7, 0, 0),
    card('t3-red-3', 3, 'red', 4, 0, 3, 6, 3, 0),
    card('t3-red-4', 3, 'red', 5, 0, 0, 7, 3, 0),
];

export const SPLENDOR_NOBLE_DEFS: SplendorNobleDef[] = [
    {
        id: 'noble-1',
        name: createNobleDisplayName({ white: 4, blue: 4, green: 0, red: 0, black: 0 }),
        points: 3,
        requirement: { white: 4, blue: 4, green: 0, red: 0, black: 0 },
    },
    {
        id: 'noble-2',
        name: createNobleDisplayName({ white: 0, blue: 0, green: 4, red: 4, black: 0 }),
        points: 3,
        requirement: { white: 0, blue: 0, green: 4, red: 4, black: 0 },
    },
    {
        id: 'noble-3',
        name: createNobleDisplayName({ white: 3, blue: 3, green: 3, red: 0, black: 0 }),
        points: 3,
        requirement: { white: 3, blue: 3, green: 3, red: 0, black: 0 },
    },
    {
        id: 'noble-4',
        name: createNobleDisplayName({ white: 3, blue: 3, green: 0, red: 0, black: 3 }),
        points: 3,
        requirement: { white: 3, blue: 3, green: 0, red: 0, black: 3 },
    },
    {
        id: 'noble-5',
        name: createNobleDisplayName({ white: 4, blue: 0, green: 0, red: 0, black: 4 }),
        points: 3,
        requirement: { white: 4, blue: 0, green: 0, red: 0, black: 4 },
    },
    {
        id: 'noble-6',
        name: createNobleDisplayName({ white: 0, blue: 4, green: 4, red: 0, black: 0 }),
        points: 3,
        requirement: { white: 0, blue: 4, green: 4, red: 0, black: 0 },
    },
    {
        id: 'noble-7',
        name: createNobleDisplayName({ white: 0, blue: 0, green: 0, red: 4, black: 4 }),
        points: 3,
        requirement: { white: 0, blue: 0, green: 0, red: 4, black:4 },
    },
    {
        id: 'noble-8',
        name: createNobleDisplayName({ white: 0, blue: 3, green: 3, red: 3, black: 0 }),
        points: 3,
        requirement: { white: 0, blue: 3, green:3, red: 3, black: 0 },
    },
    {
        id: 'noble-9',
        name: createNobleDisplayName({ white: 3, blue:0, green: 0, red: 3, black: 3 }),
        points: 3,
        requirement: { white: 3, blue: 0, green:0, red: 3, black:3 },
    },
    {
        id: 'noble-10',
        name: createNobleDisplayName({ white: 0, blue: 0, green: 3, red: 3, black: 3 }),
        points: 3,
        requirement: { white: 0, blue: 0, green: 3, red: 3, black: 3 },
    },
];
