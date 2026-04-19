export const SPLENDOR_ASSETS = {
    BOARD_DESK: 'splendor/board-desk.jpg',
    THUMBNAIL: 'splendor/picture',
    TOKEN_WHITE: 'splendor/white.png',
    TOKEN_BLUE: 'splendor/blue.png',
    TOKEN_GREEN: 'splendor/green.png',
    TOKEN_RED: 'splendor/red.png',
    TOKEN_BLACK: 'splendor/black.png',
    TOKEN_GOLD: 'splendor/gold.png',
    DECK_LEVEL_1: 'splendor/l1.jpg',
    DECK_LEVEL_2: 'splendor/l2.jpg',
    DECK_LEVEL_3: 'splendor/l3.jpg',
    CARD_LEVEL_1: 'splendor/level-1-cards.jpg',
    CARD_LEVEL_2: 'splendor/level-2-cards.jpg',
    CARD_LEVEL_3: 'splendor/level-3-cards.jpg',
    NOBLES: 'splendor/nobles.jpg',
} as const;

export const SPLENDOR_TOKEN_IMAGE_BY_COLOR = {
    white: SPLENDOR_ASSETS.TOKEN_WHITE,
    blue: SPLENDOR_ASSETS.TOKEN_BLUE,
    green: SPLENDOR_ASSETS.TOKEN_GREEN,
    red: SPLENDOR_ASSETS.TOKEN_RED,
    black: SPLENDOR_ASSETS.TOKEN_BLACK,
    gold: SPLENDOR_ASSETS.TOKEN_GOLD,
} as const;

export const SPLENDOR_DECK_IMAGE_BY_TIER = {
    1: SPLENDOR_ASSETS.DECK_LEVEL_1,
    2: SPLENDOR_ASSETS.DECK_LEVEL_2,
    3: SPLENDOR_ASSETS.DECK_LEVEL_3,
} as const;
