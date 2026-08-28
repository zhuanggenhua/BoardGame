import type { CharacterId } from '../domain/types';

/**
 * DiceThrone 技能槽布局（游戏级配置）
 * - 使用百分比坐标，基于玩家面板图片
 * - 所有角色显式声明使用的布局版本
 */
export interface AbilitySlotLayoutItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export type DiceThronePlayerBoardLayoutVersion = 'v1' | 'v2';

type PlayerBoardDimensions = {
    width: number;
    height: number;
};

export type PlayerBoardUiTuning = {
    shellTranslateX: number;
    playerBoardTranslateY: number;
    magnifyButtonTop: number;
    playerBoardBaseHeightVw: number;
    tipBoardHeightVw: number;
    centerBoardGapVw: number;
};

const V1_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = [
    { id: 'fist', x: 0.60, y: 1.62, w: 20.80, h: 38.50 },
    { id: 'chi', x: 23, y: 1.15, w: 20.80, h: 39.65 },
    { id: 'sky', x: 55.50, y: 1.28, w: 20.70, h: 39.11 },
    { id: 'lotus', x: 77.60, y: 1.42, w: 21.10, h: 39.38 },
    { id: 'combo', x: 0.70, y: 42.05, w: 20.70, h: 38.44 },
    { id: 'lightning', x: 22.90, y: 42.40, w: 20.90, h: 38.70 },
    { id: 'calm', x: 55.10, y: 41.75, w: 21.20, h: 39.59 },
    { id: 'meditate', x: 77.80, y: 41.63, w: 20.90, h: 39.53 },
    { id: 'ultimate', x: 0.60, y: 82.89, w: 55, h: 15.60 },
];

// v2 面板来自枪手 / 武士图片裁图坐标；旧角色切到新版玩家面板后也使用这套坐标。
const V2_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = [
    { id: 'fist', x: 0.58, y: 20.27, w: 15.69, h: 38.89 },
    { id: 'chi', x: 16.69, y: 20.25, w: 16.04, h: 38.72 },
    { id: 'sky', x: 0.57, y: 59.55, w: 15.54, h: 38.57 },
    { id: 'lotus', x: 16.84, y: 60.42, w: 15.15, h: 38.09 },
    { id: 'combo', x: 67.67, y: 21.41, w: 16.02, h: 38.33 },
    { id: 'lightning', x: 83.75, y: 21.85, w: 15.68, h: 37.76 },
    { id: 'calm', x: 67.53, y: 61.87, w: 15.87, h: 37.37 },
    { id: 'meditate', x: 84.02, y: 60.96, w: 15.55, h: 38.76 },
    { id: 'ultimate', x: 33.78, y: 83.91, w: 32.27, h: 13.86 },
];

export type DiceThroneBoardShellTuningMap = Record<DiceThronePlayerBoardLayoutVersion, PlayerBoardUiTuning>;

export type DiceThroneBoardLayoutConfig = {
    slotLayouts: Record<DiceThronePlayerBoardLayoutVersion, AbilitySlotLayoutItem[]>;
    uiTuning: DiceThroneBoardShellTuningMap;
};

export const DICETHRONE_ABILITY_SLOT_LAYOUTS: Record<DiceThronePlayerBoardLayoutVersion, AbilitySlotLayoutItem[]> = {
    v1: V1_ABILITY_SLOT_LAYOUT,
    v2: V2_ABILITY_SLOT_LAYOUT,
};

export const DEFAULT_ABILITY_SLOT_LAYOUT: AbilitySlotLayoutItem[] = DICETHRONE_ABILITY_SLOT_LAYOUTS.v1;

export const DICETHRONE_PLAYER_BOARD_DIMENSIONS: Record<string, PlayerBoardDimensions> = {
    barbarian: { width: 2048, height: 1260 },
    gunslinger: { width: 2048, height: 1254 },
    monk: { width: 2048, height: 1260 },
    moon_elf: { width: 2048, height: 1260 },
    paladin: { width: 2048, height: 1250 },
    pyromancer: { width: 2048, height: 1260 },
    samurai: { width: 2048, height: 1248 },
    shadow_thief: { width: 2048, height: 1260 },
    treant: { width: 2048, height: 1233 },
    ninja: { width: 2048, height: 1260 },
    zhanshujia: { width: 2048, height: 1260 },
    cursed_pirate: { width: 2048, height: 1256 },
    artificer: { width: 2048, height: 1256 },
    tianshi: { width: 3643, height: 2234 },
    lieren: { width: 3632, height: 2234 },
    vampire_lord: { width: 3627, height: 2234 },
};

export const DICETHRONE_PLAYER_BOARD_LAYOUT_VERSION_BY_CHARACTER: Record<string, DiceThronePlayerBoardLayoutVersion> = {
    monk: 'v2',
    barbarian: 'v2',
    pyromancer: 'v2',
    moon_elf: 'v2',
    shadow_thief: 'v2',
    paladin: 'v2',
    gunslinger: 'v2',
    samurai: 'v2',
    treant: 'v2',
    ninja: 'v2',
    zhanshujia: 'v2',
    cursed_pirate: 'v2',
    artificer: 'v2',
    tianshi: 'v2',
    lieren: 'v2',
    vampire_lord: 'v2',
};

export const DICETHRONE_PLAYER_BOARD_UI_TUNING: DiceThroneBoardShellTuningMap = {
    v1: {
        shellTranslateX: 0,
        playerBoardTranslateY: 0,
        magnifyButtonTop: 0.48,
        playerBoardBaseHeightVw: 35,
        tipBoardHeightVw: 35,
        centerBoardGapVw: 0.50,
    },
    v2: {
        shellTranslateX: 1.10,
        playerBoardTranslateY: -1.45,
        magnifyButtonTop: 1.85,
        playerBoardBaseHeightVw: 31,
        tipBoardHeightVw: 29.60,
        centerBoardGapVw: 0.24,
    },
};

export const DICETHRONE_BOARD_LAYOUT_CONFIG: DiceThroneBoardLayoutConfig = {
    slotLayouts: DICETHRONE_ABILITY_SLOT_LAYOUTS,
    uiTuning: DICETHRONE_PLAYER_BOARD_UI_TUNING,
};

export const getPlayerBoardLayoutVersion = (characterId?: string | null): DiceThronePlayerBoardLayoutVersion => (
    DICETHRONE_PLAYER_BOARD_LAYOUT_VERSION_BY_CHARACTER[characterId ?? ''] ?? 'v1'
);

export const getAbilitySlotLayoutByVersion = (version: DiceThronePlayerBoardLayoutVersion): AbilitySlotLayoutItem[] => (
    DICETHRONE_ABILITY_SLOT_LAYOUTS[version]
);

export const getAbilitySlotLayoutForCharacter = (characterId?: CharacterId | string | null): AbilitySlotLayoutItem[] => (
    getAbilitySlotLayoutByVersion(getPlayerBoardLayoutVersion(characterId))
);

export const getPlayerBoardDimensions = (characterId?: CharacterId | string | null): PlayerBoardDimensions => (
    DICETHRONE_PLAYER_BOARD_DIMENSIONS[characterId ?? ''] ?? DICETHRONE_PLAYER_BOARD_DIMENSIONS.monk
);

export const getPlayerBoardAspectRatio = (characterId?: CharacterId | string | null): number => {
    const { width, height } = getPlayerBoardDimensions(characterId);
    return width / height;
};

export const getPlayerBoardUiTuning = (characterId?: CharacterId | string | null): PlayerBoardUiTuning => (
    DICETHRONE_PLAYER_BOARD_UI_TUNING[getPlayerBoardLayoutVersion(characterId)]
);
