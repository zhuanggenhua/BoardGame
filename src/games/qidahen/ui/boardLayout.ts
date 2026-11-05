import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_REGION_SHAPES } from '../data/mapRegions';
import type { QidahenPassageBoundaryType } from '../data/mapGraph';
import type { QidahenFactionId } from '../domain';
import type { QidahenBoardLayoutConfig } from '../QidahenBoardShell';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../../../shared/mobileSupport';

export const STAGE_WIDTH = 1920;

export const STAGE_HEIGHT = 1080;

export const ASSETS = {
    mainMap: 'qidahen/board/qidahen-main-map',
    coverCard: 'qidahen/cards/backs/qidahen-common-card-back',
    koreaCard: 'qidahen/cards/backs/korea-deck-back',
    mingCard: 'qidahen/cards/backs/ming-deck-back',
    mongolCard: 'qidahen/cards/backs/mongol-deck-back',
    jinCard: 'qidahen/cards/backs/jin-deck-back',
    mingMarker: 'qidahen/markers/ming-control-diplomacy-marker-a',
    mongolMarker: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    jinMarker: 'qidahen/markers/jin-control-diplomacy-marker-a',
    wheelMarker: 'qidahen/markers/chronology-year-marker',
} as const;

export const MAP_COVER_SCALE = Math.max(STAGE_WIDTH / QIDAHEN_MAP_WIDTH, STAGE_HEIGHT / QIDAHEN_MAP_HEIGHT);

export const MAP_COVER_LEFT = (STAGE_WIDTH - QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE) / 2;

export const MAP_COVER_TOP = (STAGE_HEIGHT - QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE) / 2;

export const QIDAHEN_PIXI_MAP_PILOT_ENABLED = import.meta.env.VITE_QIDAHEN_PIXI_MAP_PILOT === '1';

export const QIDAHEN_PIXI_MAP_SCENE_REGIONS = QIDAHEN_MAP_REGION_SHAPES.map((shape) => ({
    id: shape.id,
    polygon: shape.polygon.map(([x, y]) => ({ x, y })),
}));

export const QIDAHEN_MAP_MIN_ZOOM = 1;

export const QIDAHEN_MAP_MAX_ZOOM = 5;

export const QIDAHEN_PASSAGE_BOUNDARY_TYPE_IDS: ReadonlySet<QidahenPassageBoundaryType> = new Set([
    'plain',
    'mountain',
    'river',
    'coast',
    'wall-convex',
    'wall-flat',
    'city',
    'shanhaiguan',
]);

export const CARD_BACK_BY_FACTION: Record<QidahenFactionId, string> = {
    ming: ASSETS.mingCard,
    mongol: ASSETS.mongolCard,
    jin: ASSETS.jinCard,
};

export const WHEEL_SECTORS = [
    { id: 'wheel-reclaim', label: ['开垦', '军屯'], angle: -90, actionKey: 'reclaim' },
    { id: 'wheel-military-farm', label: ['开垦', '军屯'], angle: -45, actionKey: 'militaryFarm' },
    { id: 'wheel-recruit-train', label: ['征兵', '训练'], angle: 0, actionKey: 'recruitTrain' },
    { id: 'wheel-diplomacy', label: ['进攻', '调度'], angle: 45, actionKey: 'attackDispatch' },
    { id: 'wheel-hire', label: ['进攻', '调度'], angle: 90, actionKey: 'attackDispatch' },
    { id: 'wheel-attack', label: ['外交', '雇佣'], angle: 135, actionKey: 'diplomacyHire' },
    { id: 'wheel-midyear', label: ['征兵', '训练'], angle: 180, actionKey: 'midyear' },
    { id: 'wheel-new-year', label: ['外交', '雇佣'], angle: 225, actionKey: 'newYear' },
] as const;

export const WHEEL_SECTOR_COPY_DEFAULTS: Record<
    (typeof WHEEL_SECTORS)[number]['actionKey'],
    { name: string; detail: string }
> = {
    reclaim: {
        name: '开垦',
        detail: '每个己方控制区可放置 1 人口，最多 5 区，不超过人口上限。',
    },
    militaryFarm: {
        name: '军屯',
        detail: '抽 2 张手牌，并在己方本土建立 1 个等级 2 正规军。',
    },
    recruitTrain: {
        name: '征兵训练',
        detail: '弃 1 张手牌，最多 4 次征兵或训练。',
    },
    attackDispatch: {
        name: '进攻调度',
        detail: '弃 1 张手牌，指挥最多 6 个部队移动；进入非己方或友好区会触发战斗。',
    },
    diplomacyHire: {
        name: '外交雇佣',
        detail: '对邻近控制标记区外交（友好/附庸/移除）；可弃牌建立雇佣军。',
    },
    midyear: {
        name: '年中',
        detail: '必须停留。结算土地税赋、江南漕运和人物判定。',
    },
    newYear: {
        name: '新年',
        detail: '必须停留。结算朝鲜朝贡、防线维护、兵力耗损，并翻开下年纪年卡。',
    },
};

export const WHEEL_VIEW = 384;

export const WHEEL_CENTER = WHEEL_VIEW / 2;

export const WHEEL_INNER_RADIUS = 68;

export const WHEEL_OUTER_RADIUS = 188;

export const WHEEL_LABEL_RADIUS = 126;

export const UI_STYLE = {
    paper: '#e6d3a8',
    paperLight: '#f3e7c4',
    paperWash: 'rgba(244,233,202,0.92)',
    cardField: '#efe0ba',
    paperDeep: '#c8ae72',
    paperEdge: '#9a7d4f',
    ink: '#2a1f15',
    mutedInk: '#66503a',
    bronze: '#5f472d',
    bronzeSoft: '#a88957',
    bronzeFaint: 'rgba(95,71,45,0.34)',
    bronzeDark: '#342417',
    mapInk: '#20150d',
    mapInkSoft: 'rgba(32,21,13,0.76)',
    mapGold: '#d2b775',
    mapIvory: '#ead7a7',
    cinnabar: '#9f3426',
    cinnabarGlow: 'rgba(159,52,38,0.18)',
    oldGold: '#9f7d42',
    soot: '#1f1812',
    shadow: 'rgba(56,35,15,0.24)',
    shadowSoft: 'rgba(56,35,15,0.14)',
} as const;

export const MAP_TOKEN_IDLE_OUTLINE = `0 0 0 1.5px ${UI_STYLE.mapIvory}, 0 0 0 3px ${UI_STYLE.mapInk}, 0 2px 6px ${UI_STYLE.shadow}`;

export const UI_SURFACE = {
    paper: [
        `linear-gradient(180deg, rgba(255,247,224,0.95) 0%, ${UI_STYLE.paperWash} 34%, rgba(224,205,158,0.96) 100%)`,
        'radial-gradient(circle at 20% 18%, rgba(255,251,240,0.48), transparent 34%)',
        'radial-gradient(circle at 82% 88%, rgba(134,100,55,0.14), transparent 42%)',
    ].join(', '),
    paperQuiet: [
        'linear-gradient(180deg, rgba(248,239,211,0.94) 0%, rgba(230,211,168,0.92) 100%)',
        'radial-gradient(circle at 18% 16%, rgba(255,250,235,0.45), transparent 34%)',
    ].join(', '),
    paperPressed: 'linear-gradient(180deg, rgba(226,205,157,0.98) 0%, rgba(194,167,110,0.98) 100%)',
    panelShadow: '0 3px 0 rgba(58,37,17,0.24), 0 14px 24px rgba(56,35,15,0.14)',
    softShadow: '0 8px 18px rgba(56,35,15,0.14)',
    hardShadow: '0 4px 0 rgba(58,37,17,0.22), 0 12px 20px rgba(58,37,17,0.18)',
    inkInset:
        'inset 0 0 0 1px rgba(255,245,218,0.52), inset 0 -2px 0 rgba(77,56,32,0.12), inset 0 1px 0 rgba(93,67,39,0.08)',
    inkLine: 'inset 0 0 0 1px rgba(49,35,21,0.18)',
    mapPanel: [
        'linear-gradient(180deg, rgba(56,39,24,0.88) 0%, rgba(28,20,13,0.82) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(231,197,126,0.16), transparent 36%)',
    ].join(', '),
    mapPanelSelected: [
        'linear-gradient(180deg, rgba(142,53,38,0.9) 0%, rgba(69,32,22,0.88) 100%)',
        'radial-gradient(circle at 15% 12%, rgba(238,198,127,0.18), transparent 38%)',
    ].join(', '),
    mapOpenPanel: [
        'linear-gradient(180deg, rgba(255,246,220,0.92) 0%, rgba(236,210,153,0.86) 100%)',
        'radial-gradient(circle at 18% 14%, rgba(255,252,236,0.38), transparent 38%)',
    ].join(', '),
    mapOpenPanelSelected: [
        'linear-gradient(180deg, rgba(245,201,142,0.9) 0%, rgba(224,151,99,0.82) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(255,238,186,0.34), transparent 38%)',
    ].join(', '),
    mapPanelShadow: '0 2px 0 rgba(7,5,3,0.7), 0 10px 18px rgba(22,14,8,0.32)',
    mapPanelInset: 'inset 0 0 0 1px rgba(232,200,133,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)',
    mapOpenPanelShadow:
        '0 3px 8px rgba(56,35,15,0.1), inset 0 0 0 1px rgba(255,250,232,0.62), inset 0 -1px 0 rgba(95,71,45,0.1)',
    bookPaper: [
        'linear-gradient(90deg, rgba(174,129,73,0.22) 0%, transparent 7%, transparent 93%, rgba(112,78,38,0.18) 100%)',
        'linear-gradient(180deg, rgba(255,248,224,0.98) 0%, rgba(237,218,174,0.98) 56%, rgba(217,190,132,0.98) 100%)',
        'radial-gradient(circle at 18% 14%, rgba(255,255,242,0.55), transparent 32%)',
    ].join(', '),
    bookPage: [
        'linear-gradient(180deg, rgba(255,250,232,0.96) 0%, rgba(236,218,176,0.94) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(255,255,245,0.42), transparent 36%)',
    ].join(', '),
    cutCorner:
        'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
    smallCutCorner:
        'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
} as const;

export const CARD_DIMENSIONS = {
    deck: { width: 154, height: 214, rawWidth: 476, rawHeight: 660 },
    koreaRailThumbnail: { width: 38, height: 54, rawWidth: 476, rawHeight: 660 },
    year: { width: 154, height: 214, rawWidth: 476, rawHeight: 661 },
    hand: { width: 182, height: 251, rawWidth: 487, rawHeight: 672 },
} as const;

export const BOTTOM_DOCK_INSET = 0;

export const MOBILE_LANDSCAPE_BOTTOM_DOCK_INSET = 0;

export const MOBILE_LANDSCAPE_TOP_SAFE_INSET = 18;

export const MOBILE_LANDSCAPE_CHRONOLOGY_TOP = 670;

export const QIDAHEN_BOARD_LAYOUT: QidahenBoardLayoutConfig = {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    mobileMaxViewportWidth: MOBILE_MAX_VIEWPORT_WIDTH,
    bottomDockInset: BOTTOM_DOCK_INSET,
    mobileLandscapeTopSafeInset: MOBILE_LANDSCAPE_TOP_SAFE_INSET,
    mobileLandscapeBottomDockInset: MOBILE_LANDSCAPE_BOTTOM_DOCK_INSET,
    mobileLandscapeChronologyTop: MOBILE_LANDSCAPE_CHRONOLOGY_TOP,
};

export const HAND_DOCK_WIDTH = 1310;

export const MOBILE_LANDSCAPE_HAND_CARD_MIN_WIDTH = 92;

export const MOBILE_LANDSCAPE_HAND_CARD_MAX_WIDTH = 118;

export const HAND_ROW_HORIZONTAL_PADDING = 16;

export const MOBILE_LANDSCAPE_VISIBLE_HAND_LIMIT = 6;

export const HAND_CARD_SELECTED_LIFT = 46;

export const HAND_CARD_SELECTED_SCALE = 1.055;

export const QIDAHEN_STAGE_BG = '#c8a970';

export const BOTTOM_DOCK_HEIGHT = CARD_DIMENSIONS.hand.height + HAND_CARD_SELECTED_LIFT + 4;

export const HAND_INTERACTION_TRAY_WIDTH = 860;

export const HAND_INTERACTION_TRAY_BOTTOM = BOTTOM_DOCK_HEIGHT + 10;

export const ACTIONS_DOCK_WIDTH = 350;

export const ACTIONS_DOCK_RIGHT = 80;

export const ACTIONS_DOCK_TOP = 276;

export const ACTIONS_DOCK_HEIGHT = 470;

export const ACTIONS_DOCK_LEFT = STAGE_WIDTH - ACTIONS_DOCK_RIGHT - ACTIONS_DOCK_WIDTH;

export const MAP_REGION_TIP_WIDTH = 252;

export const MAP_REGION_TIP_ACTION_GAP = 20;

export const MAP_SELECTION_BANNER_WIDTH = 388;

export const MAP_SELECTION_BANNER_TOP = 122;

export const BOUNDARY_TYPE_RUNTIME_COLORS: Record<string, string> = {
    plain: 'rgba(218,175,83,0.82)',
    mountain: 'rgba(118,151,130,0.9)',
    river: 'rgba(83,151,188,0.9)',
    coast: 'rgba(74,144,201,0.9)',
    'wall-convex': 'rgba(168,103,51,0.9)',
    'wall-flat': 'rgba(184,128,74,0.9)',
    city: 'rgba(184,65,45,0.92)',
    shanhaiguan: 'rgba(210,194,121,0.9)',
};

export const HAND_CARD_KIND_LABELS = {
    event: '事件',
    armament: '军备',
    tactic: '战术',
    silver: '银两',
    character: '人物',
    scenario: '剧本',
    chronology: '纪年',
    'card-back': '牌背',
} satisfies Record<
    'event' | 'armament' | 'tactic' | 'silver' | 'character' | 'scenario' | 'chronology' | 'card-back',
    string
>;
