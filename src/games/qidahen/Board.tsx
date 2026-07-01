// @asset-pipeline-allow
// 区域命中蒙版需要直接读静态 png 像素生成运行时命中表，不走玩家可见贴图渲染链路。
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import type { CardPreviewRef } from '../../core/types';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useGameAudio } from '../../lib/audio/useGameAudio';
import { safeMatchMedia, subscribeMediaQueryChange } from '../../lib/mediaQuery';
import { CardPreview } from '../../components/common/media/CardPreview';
import { MagnifyOverlay } from '../../components/common/overlays/MagnifyOverlay';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { getCardAtlasSource } from '../../components/common/media/cardAtlasRegistry';
import { getLocalizedAssetPath, getOptimizedImageUrls } from '../../core/AssetLoader';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../mobileSupport';
import type { SpriteAtlasConfig, SpriteAtlasFrame } from '../../engine/primitives/spriteAtlas';
import type {
    QidahenActionChoice,
    QidahenBattleRoll,
    QidahenBattleRollPhase,
    QidahenCasualtyPriority,
    QidahenCommandMap,
    QidahenCore,
    QidahenDiplomacySelection,
    QidahenDriveTigerConsentSelection,
    QidahenFactionId,
    QidahenFortificationMaintenanceSelection,
    QidahenHandCard,
    QidahenHandLimitDiscardSelection,
    QidahenInternalDispatchSelection,
    QidahenMapToken,
    QidahenRecruitChoice,
    QidahenScenarioId,
    QidahenWheelDispatchSelection,
    QidahenWheelMoveChoice,
} from './domain';
import {
    getQidahenDriveTigerConsentSelectionFromInteraction,
    getQidahenDiplomacySelectionFromInteraction,
    findQidahenReachableRuntimeRegions,
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenEffectiveVpByFaction,
    getQidahenFortificationMaintenanceSelectionFromInteraction,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenHandLimitDiscardSelectionFromInteraction,
    getQidahenInternalDispatchSelectionFromInteraction,
    getQidahenKhanEdictSelectionFromInteraction,
    getQidahenMaShiTradeSelectionFromInteraction,
    getQidahenPendingTargetActionForCore,
    getQidahenPendingTargetActionFromInteraction,
    getQidahenPostBattleSelectionForCore,
    getQidahenPostBattleSelectionFromInteraction,
    getQidahenRecruitSelectionFromInteraction,
    getQidahenWheelDispatchSelectionFromInteraction,
    getQidahenWheelDispatchSelectionForCore,
    getQidahenMovementProfile,
    getQidahenPrestigeBonusByFaction,
} from './domain';
import {
    getQidahenDiplomacySelectionForCore,
    getQidahenHandLimitDiscardSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './domain/interactionSelectionAccessors';
import { getActionRuleDisplayRegionName } from './domain/regionRuleSemantics';
import { getQidahenStatefulRegionDisplayName } from './domain/runtimeRegionRules';

type QidahenYearCardSlot = QidahenCore['yearCards'][number];
import { getCurrentFactionId } from './domain/factionTurnAccessors';
import { QIDAHEN_COMMANDS } from './domain/commands';
import {
    buildPendingTargetChoiceOptions,
} from './domain/pendingTargetChoiceOptions';
import type { QidahenPendingTargetChoiceValue } from './domain/interactionContracts';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from './ui/mapRegions';
import {
    getQidahenDirectedPassage,
    getQidahenPrintedRegionIdsForRuntimeRegionId,
    getQidahenRuntimeRegionIdsForPrintedRegionId,
    QIDAHEN_REGION_GRAPH_EDGES,
    QIDAHEN_REGION_GRAPH_NODE_BY_ID,
    QIDAHEN_REGION_ID_BY_MASK_COLOR,
    getQidahenBoundaryTypeMeta,
    qidahenRegionColorKey,
} from './ui/mapGraph';
import { renderRegionOwnershipOverlay, type RegionMaskOverlayToneKey } from './ui/regionMaskOverlay';
import { buildQidahenRuntimeRegionIdByPixel } from './ui/runtimeRegionOwnership';
import qidahenRegionMaskUrl from './data/region-mask.png?url';
import {
    QIDAHEN_SCENARIO_SETUP_OPTIONS,
    getQidahenScenarioVoteMeta,
} from './roomSetup';
import { QIDAHEN_AUDIO_CONFIG } from './audio.config';
import { QIDAHEN_MANIFEST } from './manifest';

type Props = GameBoardProps<QidahenCore, QidahenCommandMap>;

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

const ASSETS = {
    mainMap: 'qidahen/board/qidahen-main-map',
    coverCard: 'qidahen/cards/backs/qidahen-cover-card',
    koreaCard: 'qidahen/cards/backs/korea-card-back',
    mingCard: 'qidahen/cards/backs/ming-card-back',
    mongolCard: 'qidahen/cards/backs/mongol-card-back',
    jinCard: 'qidahen/cards/backs/jin-card-back',
    mingMarker: 'qidahen/markers/ming-control-diplomacy-marker-a',
    mongolMarker: 'qidahen/markers/mongol-control-diplomacy-marker-a',
    jinMarker: 'qidahen/markers/jin-control-diplomacy-marker-a',
} as const;

const MAP_COVER_SCALE = Math.max(STAGE_WIDTH / QIDAHEN_MAP_WIDTH, STAGE_HEIGHT / QIDAHEN_MAP_HEIGHT);
const MAP_COVER_LEFT = (STAGE_WIDTH - QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE) / 2;
const MAP_COVER_TOP = (STAGE_HEIGHT - QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE) / 2;
const MAP_COVER_WIDTH = QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE;
const MAP_COVER_HEIGHT = QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE;
const QIDAHEN_FACTION_ORDER: QidahenFactionId[] = ['ming', 'mongol', 'jin'];
const QIDAHEN_MAP_MIN_ZOOM = 1;
const QIDAHEN_MAP_MAX_ZOOM = 2.25;

const CARD_BACK_BY_FACTION: Record<QidahenFactionId, string> = {
    ming: ASSETS.mingCard,
    mongol: ASSETS.mongolCard,
    jin: ASSETS.jinCard,
};

const WHEEL_SECTORS = [
    { id: 'wheel-reclaim', label: ['开垦', '军屯'], angle: -90 },
    { id: 'wheel-military-farm', label: ['开垦', '军屯'], angle: -45 },
    { id: 'wheel-recruit-train', label: ['征兵', '训练'], angle: 0 },
    { id: 'wheel-diplomacy', label: ['进攻', '调度'], angle: 45 },
    { id: 'wheel-hire', label: ['进攻', '调度'], angle: 90 },
    { id: 'wheel-attack', label: ['外交', '雇佣'], angle: 135 },
    { id: 'wheel-midyear', label: ['征兵', '训练'], angle: 180 },
    { id: 'wheel-new-year', label: ['外交', '雇佣'], angle: 225 },
] as const;

const WHEEL_VIEW = 384;
const WHEEL_CENTER = WHEEL_VIEW / 2;
const WHEEL_INNER_RADIUS = 68;
const WHEEL_OUTER_RADIUS = 188;
const WHEEL_LABEL_RADIUS = 126;

const UI_STYLE = {
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

const UI_SURFACE = {
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
    inkInset: 'inset 0 0 0 1px rgba(255,245,218,0.52), inset 0 -2px 0 rgba(77,56,32,0.12), inset 0 1px 0 rgba(93,67,39,0.08)',
    inkLine: 'inset 0 0 0 1px rgba(49,35,21,0.18)',
    mapPanel: [
        'linear-gradient(180deg, rgba(56,39,24,0.88) 0%, rgba(28,20,13,0.82) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(231,197,126,0.16), transparent 36%)',
    ].join(', '),
    mapPanelSelected: [
        'linear-gradient(180deg, rgba(142,53,38,0.9) 0%, rgba(69,32,22,0.88) 100%)',
        'radial-gradient(circle at 15% 12%, rgba(238,198,127,0.18), transparent 38%)',
    ].join(', '),
    mapPanelShadow: '0 2px 0 rgba(7,5,3,0.7), 0 10px 18px rgba(22,14,8,0.32)',
    mapPanelInset: 'inset 0 0 0 1px rgba(232,200,133,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)',
    cutCorner: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
    smallCutCorner: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
} as const;

const CARD_DIMENSIONS = {
    deck: { width: 154, height: 214, rawWidth: 476, rawHeight: 660 },
    koreaDeck: { width: 150, height: 208, rawWidth: 476, rawHeight: 660 },
    year: { width: 154, height: 214, rawWidth: 476, rawHeight: 661 },
    hand: { width: 182, height: 251, rawWidth: 487, rawHeight: 672 },
} as const;

const BOTTOM_DOCK_INSET = 0;
const HAND_CARD_SELECTED_LIFT = 26;
const QIDAHEN_STAGE_BG = '#c8a970';
const BOTTOM_DOCK_HEIGHT = CARD_DIMENSIONS.hand.height + HAND_CARD_SELECTED_LIFT + 4;
const HAND_INTERACTION_TRAY_WIDTH = 860;
const HAND_INTERACTION_TRAY_BOTTOM = BOTTOM_DOCK_HEIGHT + 10;
const ACTIONS_DOCK_WIDTH = 420;
const ACTIONS_DOCK_RIGHT = 80;

const getQidahenHandCardTutorialTargetId = (card: QidahenHandCard): string => (
    card.cardDefId ?? card.id
);

const getQidahenDirectActionIdForHandCard = (card: QidahenHandCard): string | null => {
    if (card.cardKind === 'armament' && card.armamentId) {
        return 'upgrade-armament';
    }
    if (card.cardKind === 'event' && card.cardDefId?.includes('khan-edict')) {
        return 'khan-edict';
    }
    return null;
};

const getQidahenDirectHandActionIdsForFaction = (
    core: QidahenCore,
    factionId: QidahenFactionId,
): Set<string> => new Set(
    core.handCards
        .filter((card) => card.faction === factionId && card.status !== 'disabled')
        .map((card) => getQidahenDirectActionIdForHandCard(card))
        .filter((actionId): actionId is string => actionId != null),
);
const ACTIONS_DOCK_TOP = 276;
const ACTIONS_DOCK_HEIGHT = 470;
const ACTIONS_DOCK_LEFT = STAGE_WIDTH - ACTIONS_DOCK_RIGHT - ACTIONS_DOCK_WIDTH;
const MAP_REGION_TIP_WIDTH = 252;
const MAP_REGION_TIP_ACTION_GAP = 20;
const MAP_SELECTION_BANNER_WIDTH = 388;
const MAP_SELECTION_BANNER_TOP = 122;

const factionTone: Record<QidahenFactionId, { bg: string; border: string; text: string; chip: string }> = {
    ming: { bg: UI_STYLE.paper, border: UI_STYLE.cinnabar, text: UI_STYLE.ink, chip: ASSETS.mingMarker },
    mongol: { bg: UI_STYLE.paper, border: UI_STYLE.oldGold, text: UI_STYLE.ink, chip: ASSETS.mongolMarker },
    jin: { bg: UI_STYLE.paper, border: UI_STYLE.bronze, text: UI_STYLE.ink, chip: ASSETS.jinMarker },
};

const BOUNDARY_TYPE_RUNTIME_COLORS: Record<string, string> = {
    plain: 'rgba(218,175,83,0.82)',
    mountain: 'rgba(118,151,130,0.9)',
    river: 'rgba(83,151,188,0.9)',
    coast: 'rgba(74,144,201,0.9)',
    'wall-convex': 'rgba(168,103,51,0.9)',
    'wall-flat': 'rgba(184,128,74,0.9)',
    city: 'rgba(184,65,45,0.92)',
    shanhaiguan: 'rgba(210,194,121,0.9)',
};

const polarToPoint = (center: number, radius: number, angleDeg: number) => {
    const radians = (angleDeg * Math.PI) / 180;
    return {
        x: center + Math.cos(radians) * radius,
        y: center + Math.sin(radians) * radius,
    };
};

const getQidahenHandCardOverlapPx = (handCount: number): number => {
    if (handCount <= 6) {
        return 0;
    }
    return -Math.min(18 + Math.max(0, handCount - 7) * 12, 60);
};

const resolveViewerFactionId = (
    core: QidahenCore,
    playerID: string | null,
): QidahenFactionId | null => (
    (playerID
        ? (Object.entries(core.factions).find(([, faction]) => faction.playerId === playerID)?.[0] as QidahenFactionId | undefined)
        : undefined)
    ?? null
);

type QidahenPrimaryStageMode = 'faction' | 'wheel';
type QidahenMapViewport = {
    zoom: number;
    panX: number;
    panY: number;
};

const DEFAULT_QIDAHEN_MAP_VIEWPORT: QidahenMapViewport = {
    zoom: 1,
    panX: 0,
    panY: 0,
};

const clampNumber = (value: number, min: number, max: number): number => (
    Math.min(max, Math.max(min, value))
);

const clampQidahenMapViewport = (viewport: QidahenMapViewport): QidahenMapViewport => {
    const zoom = clampNumber(viewport.zoom, QIDAHEN_MAP_MIN_ZOOM, QIDAHEN_MAP_MAX_ZOOM);
    const scaledWidth = MAP_COVER_WIDTH * zoom;
    const scaledHeight = MAP_COVER_HEIGHT * zoom;
    const minPanX = STAGE_WIDTH - scaledWidth - MAP_COVER_LEFT;
    const maxPanX = -MAP_COVER_LEFT;
    const minPanY = STAGE_HEIGHT - scaledHeight - MAP_COVER_TOP;
    const maxPanY = -MAP_COVER_TOP;
    return {
        zoom,
        panX: clampNumber(viewport.panX, minPanX, maxPanX),
        panY: clampNumber(viewport.panY, minPanY, maxPanY),
    };
};

const projectQidahenMapPointToStage = (
    point: { x: number; y: number },
    viewport: QidahenMapViewport,
) => ({
    x: MAP_COVER_LEFT + viewport.panX + point.x * MAP_COVER_SCALE * viewport.zoom,
    y: MAP_COVER_TOP + viewport.panY + point.y * MAP_COVER_SCALE * viewport.zoom,
});

const formatQidahenCandidateRegionSummary = (regionNames: string[]): string => {
    const uniqueNames = Array.from(new Set(regionNames.filter((name) => name.trim().length > 0)));
    if (uniqueNames.length <= 0) {
        return '暂无可选地区';
    }
    if (uniqueNames.length <= 4) {
        return uniqueNames.join('、');
    }
    return `${uniqueNames.slice(0, 4).join('、')} 等 ${uniqueNames.length} 处`;
};

const _buildQidahenPrimaryStageHeadline = (
    core: QidahenCore,
    primaryStageMode: QidahenPrimaryStageMode | null,
    selectedAction: QidahenActionChoice | null,
): string => {
    if (primaryStageMode === 'wheel') {
        if (core.wheelActionUsed) {
            return '轮盘已完成';
        }
        return '轮盘行动';
    }
    if (primaryStageMode === 'faction') {
        if (core.factionActionUsed) {
            return '行动已完成';
        }
        return selectedAction ? selectedAction.label : '手牌行动';
    }
    return '等待中';
};

const _buildQidahenPrimaryStageHint = (
    core: QidahenCore,
    primaryStageMode: QidahenPrimaryStageMode | null,
    selectedAction: QidahenActionChoice | null,
): string => {
    if (primaryStageMode === 'wheel') {
        return core.wheelActionUsed
            ? '等待结算'
            : '选择轮盘格';
    }
    if (primaryStageMode === 'faction') {
        if (!selectedAction) {
            return '选择手牌行动';
        }
        if (selectedAction.id === 'upgrade-armament') {
            return '弃牌后执行';
        }
        return '选择行动目标';
    }
    return '等待中';
};

const buildQidahenPrimaryActionEntryText = (
    core: QidahenCore,
    selectedAction: QidahenActionChoice | null,
): string => {
    if (!selectedAction) {
        return '选择手牌行动';
    }
    const currentFactionId = getCurrentFactionId(core);
    const directHandActionIds = getQidahenDirectHandActionIdsForFaction(core, currentFactionId);
    if (core.factionActionUsed) {
        return core.wheelActionUsed
            ? '等待结算'
            : '选择轮盘格';
    }
    if (directHandActionIds.has(selectedAction.id)) {
        return '打出手牌';
    }
    switch (selectedAction.id) {
        case 'raid':
        case 'marriage-subjugation':
        case 'grant-pardon':
        case 'drive-tiger':
        case 'khan-edict':
        case 'recruit':
        case 'ma-shi-trade':
            return '选择行动目标';
        case 'upgrade-armament':
            return '弃牌后执行';
        default:
            return selectedAction ? selectedAction.label : '选择手牌行动';
    }
};

const isQidahenGaoDiTargetSelectionActive = (
    selection: QidahenCore['gaoDiDispatchSelection'] | null | undefined,
): boolean => Boolean(selection?.selectedCardId);

const getQidahenForegroundActionChoice = (
    core: QidahenCore,
    options: {
        actionPaymentPreviewVisible: boolean;
        recruitSelection: unknown | null;
        maShiTradeSelection: unknown | null;
        khanEdictSelection: unknown | null;
        driveTigerConsentSelection: unknown | null;
    },
): QidahenActionChoice | null => {
    if (options.actionPaymentPreviewVisible) {
        return core.actionChoices.find((action) => action.id === core.selectedActionId) ?? null;
    }
    if (options.recruitSelection) {
        return core.actionChoices.find((action) => action.id === 'recruit') ?? null;
    }
    if (options.maShiTradeSelection) {
        return core.actionChoices.find((action) => action.id === 'ma-shi-trade') ?? null;
    }
    if (options.khanEdictSelection) {
        return core.actionChoices.find((action) => action.id === 'khan-edict') ?? null;
    }
    if (options.driveTigerConsentSelection) {
        return core.actionChoices.find((action) => action.id === 'drive-tiger') ?? null;
    }
    return null;
};

const formatQidahenVisibleTurnLabel = (turnLabel: string): string => (
    turnLabel
        .replace('势力行动', '行动窗口')
        .replace('待结算', '处理中')
);

const normalizeQidahenBattleRollSummary = (summary?: string | null): string | null => {
    if (!summary) {
        return null;
    }
    return summary
        .replace(/^[^：]+：/, '掷骰结果：')
        .replace(/。$/, '');
};

const formatQidahenBattleRollPhaseLabel = (phase: QidahenBattleRollPhase): string => {
    switch (phase) {
        case 'artillery':
            return '火炮齐射';
        case 'cavalry':
            return '骑兵冲击';
        case 'infantry':
            return '步兵推进';
        case 'melee':
            return '近身混战';
        default:
            return '战斗';
    }
};

const formatQidahenBattleRollFace = (roll: QidahenBattleRoll): string => (
    roll.raw === roll.value ? `${roll.raw}` : `${roll.raw}→${roll.value}`
);

const QIDAHEN_BATTLE_ROLL_COPY = {
    attackerLabel: '攻方',
    defenderLabel: '守方',
    totalLabel: '合计',
    noRollsLabel: '未掷骰',
    summaryTitle: '本次掷骰',
    attackerDamageLabel: '攻方伤害',
    defenderDamageLabel: '守方伤害',
} as const;

const renderQidahenBattleRollDiceGroup = (
    sideLabel: string,
    rolls: QidahenBattleRoll[],
    total: number,
    tone: 'attacker' | 'defender',
) => {
    const borderColor = tone === 'attacker' ? 'rgba(232, 160, 124, 0.55)' : 'rgba(160, 188, 234, 0.55)';
    const background = tone === 'attacker' ? 'rgba(104, 34, 22, 0.32)' : 'rgba(23, 49, 88, 0.28)';
    const chipBackground = tone === 'attacker' ? 'rgba(138, 41, 28, 0.8)' : 'rgba(45, 82, 136, 0.84)';
    const chipText = tone === 'attacker' ? '#fff0e7' : '#edf5ff';

    return (
        <div className="rounded-[3px] border px-2 py-2" style={{ borderColor, background }}>
            <div className="flex items-center justify-between gap-3 text-[10px] font-black" style={{ color: '#f6d5a8' }}>
                <span>{sideLabel}</span>
                <span>{`${QIDAHEN_BATTLE_ROLL_COPY.totalLabel} ${total}`}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {rolls.map((roll, index) => (
                    <div
                        key={`${sideLabel}-${roll.troopKind}-${roll.level}-${roll.raw}-${roll.value}-${index}`}
                        className="grid h-[34px] min-w-[34px] place-items-center border text-[12px] font-black leading-none"
                        style={{ borderColor, background: chipBackground, color: chipText, borderRadius: 3, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                        title={`${roll.troopKind} Lv${roll.level} d${roll.dieSides}`}
                    >
                        {formatQidahenBattleRollFace(roll)}
                    </div>
                ))}
                {rolls.length <= 0 ? (
                    <div className="px-1 text-[10px]" style={{ color: '#d8c7ab' }}>{QIDAHEN_BATTLE_ROLL_COPY.noRollsLabel}</div>
                ) : null}
            </div>
        </div>
    );
};

const QidahenBattleRollDiceSummary: React.FC<{
    battleRolls: NonNullable<QidahenPostBattleSelection['battleRolls']>;
}> = ({ battleRolls }) => (
    <div className="mt-2 rounded-[3px] border border-[#d8b36e]/40 bg-[rgba(44,20,11,0.24)] px-2.5 py-2" data-testid="qidahen-post-battle-dice-summary">
        <div className="text-[10px] font-black tracking-[0.08em]" style={{ color: '#f6d5a8' }}>{QIDAHEN_BATTLE_ROLL_COPY.summaryTitle}</div>
        <div className="mt-2 flex flex-col gap-2">
            {battleRolls.stages.map((stage, index) => (
                <div
                    key={`${stage.phase}-${index}`}
                    className="rounded-[3px] border border-[#d8b36e]/25 bg-[rgba(0,0,0,0.12)] px-2 py-2"
                >
                    <div className="text-[10px] font-black" style={{ color: '#ffe5b3' }}>{`${formatQidahenBattleRollPhaseLabel(stage.phase)} · ${QIDAHEN_BATTLE_ROLL_COPY.attackerDamageLabel} ${stage.attackerDamage} · ${QIDAHEN_BATTLE_ROLL_COPY.defenderDamageLabel} ${stage.defenderDamage}`}</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {renderQidahenBattleRollDiceGroup(QIDAHEN_BATTLE_ROLL_COPY.attackerLabel, stage.attackerRolls, stage.attackerTotal, 'attacker')}
                        {renderQidahenBattleRollDiceGroup(QIDAHEN_BATTLE_ROLL_COPY.defenderLabel, stage.defenderRolls, stage.defenderTotal, 'defender')}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const getQidahenFriendlyPendingTargetTitle = (pendingTargetAction: QidahenCore['pendingTargetAction']): string => {
    if (!pendingTargetAction) {
        return '';
    }
    if (pendingTargetAction.targetKind === 'siege-attacker') {
        return `解围 ${pendingTargetAction.targetRegionName}`;
    }
    if ((pendingTargetAction.battleMode ?? 'field') === 'city' || pendingTargetAction.title.includes('城战')) {
        return `${pendingTargetAction.targetRegionName} 城战`;
    }
    switch (pendingTargetAction.actionId) {
        case 'raid':
            return `突袭 ${pendingTargetAction.targetRegionName}`;
        case 'wheel-dispatch':
            return `进攻 ${pendingTargetAction.targetRegionName}`;
        case 'drive-tiger':
            return `驱虎吞狼：进攻 ${pendingTargetAction.targetRegionName}`;
        case 'marriage-subjugation':
            return `联姻诱降 ${pendingTargetAction.targetRegionName}`;
        default:
            return pendingTargetAction.targetRegionName;
    }
};

const getQidahenFriendlyPendingChoiceLabel = (choice: { id: string; label: string }): string => {
    if (choice.id === 'rear-guard') {
        return '断后';
    }
    if (choice.id === 'rout') {
        return '溃退';
    }
    if (choice.id === 'cavalry-plunder-attacker') {
        return '抽己方牌堆';
    }
    if (choice.id === 'cavalry-plunder-defender') {
        return '抽守方牌堆';
    }
    if (choice.id.startsWith('cavalry-evasion:')) {
        return choice.label.replace('骑兵避战至', '骑兵撤往 ');
    }
    return choice.label;
};

const getQidahenFriendlyPostBattleTitle = (postBattleSelection: QidahenPostBattleSelection): string => (
    postBattleSelection.targetKind === 'siege-attacker'
        ? '解围后进驻'
        : '战后选择'
);

const getAtlasFrame = (index: number, atlas: SpriteAtlasConfig): SpriteAtlasFrame => {
    if ('frames' in atlas) {
        if (atlas.frames.length === 0) {
            return { x: 0, y: 0, width: atlas.imageW, height: atlas.imageH };
        }
        return atlas.frames[index % atlas.frames.length] ?? atlas.frames[0];
    }

    const safeIndex = index % (atlas.cols * atlas.rows);
    const col = safeIndex % atlas.cols;
    const row = Math.floor(safeIndex / atlas.cols);
    return {
        x: atlas.colStarts[col] ?? atlas.colStarts[0],
        y: atlas.rowStarts[row] ?? atlas.rowStarts[0],
        width: atlas.colWidths[col] ?? atlas.colWidths[0],
        height: atlas.rowHeights[row] ?? atlas.rowHeights[0],
    };
};

const describeAnnularSlice = (center: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
    const outerStart = polarToPoint(center, outerRadius, startAngle);
    const outerEnd = polarToPoint(center, outerRadius, endAngle);
    const innerEnd = polarToPoint(center, innerRadius, endAngle);
    const innerStart = polarToPoint(center, innerRadius, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
        `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
        'Z',
    ].join(' ');
};

const buildRegionMaskHitmap = (image: HTMLImageElement) => {
    if (image.naturalWidth !== QIDAHEN_MAP_WIDTH || image.naturalHeight !== QIDAHEN_MAP_HEIGHT) {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = QIDAHEN_MAP_WIDTH;
    canvas.height = QIDAHEN_MAP_HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT).data;
    for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] === 0) continue;
        const colorKey = qidahenRegionColorKey(data[offset], data[offset + 1], data[offset + 2]);
        if (QIDAHEN_REGION_ID_BY_MASK_COLOR[colorKey]) {
            return data;
        }
    }
    return null;
};

const formatSpecialTroops = (specialTroops: QidahenCore['regions'][number]['specialTroops']) => (
    specialTroops.map((stack) => `${stack.label} x${stack.count}（${stack.level}级）`).join('，')
);

const getPendingTargetChoiceTestId = (choiceId: string): string => {
    if (choiceId === 'rear-guard') {
        return 'qidahen-resolve-pending-action';
    }
    if (choiceId === 'rout') {
        return 'qidahen-resolve-pending-action-rout';
    }
    if (choiceId === 'cavalry-plunder-attacker') {
        return 'qidahen-resolve-pending-action-cavalry-plunder';
    }
    if (choiceId === 'cavalry-plunder-defender') {
        return 'qidahen-resolve-pending-action-cavalry-plunder-defender';
    }
    if (choiceId.startsWith('cavalry-evasion:')) {
        return `qidahen-resolve-pending-action-${choiceId}`;
    }
    return `qidahen-resolve-pending-action-${choiceId}`;
};

const HandInteractionTray: React.FC<{
    core: QidahenCore;
    actionPaymentPreviewVisible: boolean;
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    selectedHandLimitCardIds: string[];
    confirmTutorialLocked?: boolean;
    cancelTutorialLocked?: boolean;
    onResolveHandLimitDiscard: () => void;
    onConfirmSelectedAction: () => void;
    onCancelSelectedActionPreview: () => void;
    onResolveSunYuanhuaTech: (decision: 'confirm' | 'skip') => void;
}> = ({
    core,
    actionPaymentPreviewVisible,
    handLimitDiscardSelection,
    selectedHandLimitCardIds,
    confirmTutorialLocked = false,
    cancelTutorialLocked = false,
    onResolveHandLimitDiscard,
    onConfirmSelectedAction,
    onCancelSelectedActionPreview,
    onResolveSunYuanhuaTech,
}) => {
    const { t } = useTranslation('game-qidahen');
    const selectedAction = actionPaymentPreviewVisible
        ? core.actionChoices.find((action) => action.id === core.selectedActionId && action.cost > 0) ?? null
        : null;
    const sunYuanhuaSelection = core.sunYuanhuaTechSelection;

    if (!selectedAction && !handLimitDiscardSelection && !sunYuanhuaSelection) {
        return null;
    }

    if (selectedAction) {
        return (
            <div
                className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
                data-testid="qidahen-hand-interaction-tray"
                style={{ bottom: HAND_INTERACTION_TRAY_BOTTOM }}
            >
                <div
                    className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                    data-testid="qidahen-action-payment-panel"
                    data-ui-anchor="bottom-hand"
                    style={{
                        width: HAND_INTERACTION_TRAY_WIDTH,
                        borderColor: UI_STYLE.oldGold,
                        background: UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black leading-5">{selectedAction.label}</div>
                        <div className="mt-1 text-[11px]" data-testid="qidahen-action-payment-status" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.handInteraction.actionPaymentStatus', {
                                cost: selectedAction.cost,
                                selected: core.selectedPaymentCardIds.length,
                                defaultValue: '需弃 {{cost}} 张 · 已选 {{selected}} 张',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" data-testid="qidahen-action-payment-hint" style={{ color: '#f3d1a5' }}>
                            {t('board.handInteraction.actionPaymentHint', {
                                defaultValue: '点击底部手牌选择要弃掉的牌；再次点击已选手牌可取消该张。',
                            })}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            data-testid="qidahen-action-payment-confirm"
                            disabled={confirmTutorialLocked || core.selectedPaymentCardIds.length < selectedAction.cost}
                            className="inline-flex min-h-[40px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                            onClick={onConfirmSelectedAction}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            {t('board.handInteraction.confirmExecute', { defaultValue: '确认执行' })}
                        </button>
                        <button
                            type="button"
                            data-testid="qidahen-action-payment-cancel"
                            disabled={cancelTutorialLocked}
                            className="inline-flex min-h-[40px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={onCancelSelectedActionPreview}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            {t('board.handInteraction.cancelAction', { defaultValue: '取消本次行动' })}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (handLimitDiscardSelection) {
        return (
            <div
                className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
                data-testid="qidahen-hand-interaction-tray"
                style={{ bottom: HAND_INTERACTION_TRAY_BOTTOM }}
            >
                <div
                    className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                    data-testid="qidahen-hand-limit-discard-selection"
                    data-ui-anchor="bottom-hand"
                    style={{
                        width: HAND_INTERACTION_TRAY_WIDTH,
                        borderColor: UI_STYLE.mapInk,
                        background: UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-black leading-5">
                            {t('board.handInteraction.handLimitTitle', {
                                factionName: handLimitDiscardSelection.factionName,
                                defaultValue: '{{factionName}} · 检查手牌上限',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.handInteraction.handLimitStatus', {
                                handCount: handLimitDiscardSelection.handCount,
                                handLimit: handLimitDiscardSelection.handLimit,
                                requiredDiscardCount: handLimitDiscardSelection.requiredDiscardCount,
                                selected: selectedHandLimitCardIds.length,
                                defaultValue: '手牌 {{handCount}}/{{handLimit}} · 需弃 {{requiredDiscardCount}} · 已择 {{selected}}',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.handInteraction.handLimitHint', { defaultValue: '点击底部手牌选择要弃掉的牌。' })}
                        </div>
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-resolve-hand-limit-discard"
                        disabled={selectedHandLimitCardIds.length < handLimitDiscardSelection.requiredDiscardCount}
                        className="inline-flex min-h-[40px] min-w-[152px] shrink-0 items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                        onClick={onResolveHandLimitDiscard}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        {t('board.handInteraction.confirmDiscard', { defaultValue: '确认弃牌' })}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
            data-testid="qidahen-hand-interaction-tray"
            style={{ bottom: HAND_INTERACTION_TRAY_BOTTOM }}
        >
            <div
                className="pointer-events-auto flex items-center justify-between gap-4 border-[3px] px-4 py-3"
                data-testid="qidahen-sun-yuanhua-tech-selection"
                data-ui-anchor="bottom-hand"
                style={{
                    width: HAND_INTERACTION_TRAY_WIDTH,
                    borderColor: UI_STYLE.mapInk,
                    background: UI_SURFACE.mapPanelSelected,
                    color: UI_STYLE.mapIvory,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                    borderRadius: 3,
                }}
            >
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-black leading-5">{sunYuanhuaSelection!.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {t('board.handInteraction.sunYuanhuaStatus', {
                            requiredCardCount: sunYuanhuaSelection!.requiredCardCount,
                            selected: sunYuanhuaSelection!.selectedCardIds.length,
                            defaultValue: '需弃 {{requiredCardCount}} 张 · 已择 {{selected}}',
                        })}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {sunYuanhuaSelection!.summary}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {t('board.handInteraction.sunYuanhuaHint', { defaultValue: '点击底部手牌选择要弃掉的牌。' })}
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        data-testid="qidahen-sun-yuanhua-tech-confirm"
                        disabled={sunYuanhuaSelection!.selectedCardIds.length < sunYuanhuaSelection!.requiredCardCount}
                        className="inline-flex min-h-[40px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                        onClick={() => onResolveSunYuanhuaTech('confirm')}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        {t('board.handInteraction.confirmSunYuanhua', { defaultValue: '确认打科技' })}
                    </button>
                    <button
                        type="button"
                        data-testid="qidahen-sun-yuanhua-tech-skip"
                        className="inline-flex min-h-[40px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                        onClick={() => onResolveSunYuanhuaTech('skip')}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        {t('board.handInteraction.skipSunYuanhua', { defaultValue: '跳过孙元化科技' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

const getPendingTargetChoiceMinWidth = (choiceId: string): number => {
    if (choiceId === 'cavalry-plunder-attacker') {
        return 168;
    }
    if (choiceId === 'cavalry-plunder-defender') {
        return 180;
    }
    if (choiceId.startsWith('cavalry-evasion:')) {
        return 176;
    }
    return 132;
};

const hasStructuredCasualtyChoice = (
    core: QidahenCore,
    pending: QidahenCore['pendingTargetAction'],
): boolean => {
    if (!pending) {
        return false;
    }
    const sourceRegion = pending.sourceRegionId
        ? core.regions.find((region) => !region.isLogicalRegion && region.id === pending.sourceRegionId)
        : null;
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === pending.targetRuntimeRegionId);
    return [sourceRegion, targetRegion].some((region) => (
        region?.specialTroops.some((stack) => stack.troopKind !== 'artillery' && stack.count > 0) === true
    ));
};

const getPendingCommittedTroopOptions = (pending: QidahenCore['pendingTargetAction']): number[] => {
    if (!pending || (pending.actionId !== 'raid' && pending.actionId !== 'wheel-dispatch' && pending.actionId !== 'drive-tiger')) {
        return [];
    }
    const maxCommittedTroops = Math.max(0, Math.min(
        pending.committedTroops,
        pending.sourceAvailableTroops,
        pending.boundaryUnitCap ?? pending.committedTroops,
    ));
    return Array.from({ length: maxCommittedTroops }, (_, index) => index + 1);
};

const CardPreviewFit: React.FC<{
    previewRef: CardPreviewRef;
    locale?: string;
    title: string;
    width: number;
    height: number;
    rawWidth: number;
    rawHeight: number;
}> = ({ previewRef, locale, title, width, height, rawWidth, rawHeight }) => {
    if (previewRef.type === 'atlas') {
        const source = getCardAtlasSource(previewRef.atlasId, locale);
        if (source) {
            const frame = getAtlasFrame(previewRef.index, source.config);
            const scale = Math.min(width / frame.width, height / frame.height);
            const scaledWidth = frame.width * scale;
            const scaledHeight = frame.height * scale;
            const localizedPath = getLocalizedAssetPath(source.image, locale ?? 'zh-CN');
            const urls = getOptimizedImageUrls(localizedPath);

            return (
                <div className="absolute inset-0 overflow-hidden" style={{ background: UI_STYLE.cardField }}>
                    <div
                        className="absolute overflow-hidden"
                        data-card-atlas-frame="true"
                        data-card-atlas-id={previewRef.atlasId}
                        data-card-atlas-index={previewRef.index}
                        title={title}
                        style={{
                            left: (width - scaledWidth) / 2,
                            top: (height - scaledHeight) / 2,
                            width: scaledWidth,
                            height: scaledHeight,
                        }}
                    >
                        <img
                            src={urls.webp}
                            alt={title}
                            draggable={false}
                            style={{
                                display: 'block',
                                width: source.config.imageW * scale,
                                height: source.config.imageH * scale,
                                maxWidth: 'none',
                                transform: `translate(${-frame.x * scale}px, ${-frame.y * scale}px)`,
                                transformOrigin: 'top left',
                            }}
                        />
                    </div>
                </div>
            );
        }
    }

    const scale = Math.min(width / rawWidth, height / rawHeight);
    const scaledWidth = rawWidth * scale;
    const scaledHeight = rawHeight * scale;

    return (
        <div className="absolute inset-0 overflow-hidden" style={{ background: UI_STYLE.cardField }}>
            <CardPreview
                previewRef={previewRef}
                locale={locale}
                title={title}
                style={{
                    width: rawWidth,
                    height: rawHeight,
                    transform: `translate(${(width - scaledWidth) / 2}px, ${(height - scaledHeight) / 2}px) scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            />
        </div>
    );
};

type QidahenMagnifyTarget = {
    previewRef: CardPreviewRef;
    title: string;
    rawWidth: number;
    rawHeight: number;
};

const QidahenCardMagnifyOverlay: React.FC<{
    target: QidahenMagnifyTarget | null;
    locale?: string;
    onClose: () => void;
}> = ({ target, locale, onClose }) => (
    <MagnifyOverlay
        isOpen={target != null}
        onClose={onClose}
        containerClassName="max-h-[86vh] max-w-[92vw]"
        overlayClassName="bg-black/46"
        overlayTestId="qidahen-card-magnify-overlay"
        closeLabel="关闭查看"
    >
        {target ? (
            <div
                className="relative overflow-hidden rounded-[10px] border-[3px]"
                style={{
                    width: `min(92vw, calc(82vh * (${target.rawWidth} / ${target.rawHeight})))`,
                    aspectRatio: `${target.rawWidth} / ${target.rawHeight}`,
                    borderColor: UI_STYLE.mapInk,
                    background: UI_STYLE.cardField,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                }}
            >
                <CardPreview
                    previewRef={target.previewRef}
                    locale={locale}
                    title={target.title}
                    className="h-full w-full object-contain"
                />
            </div>
        ) : null}
    </MagnifyOverlay>
);

const StageRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [stageMetrics, setStageMetrics] = React.useState({ scale: 1, left: 0, top: 0 });
    const [isLandscapeMobileViewport, setIsLandscapeMobileViewport] = React.useState(false);
    const mapStageBackdropUrl = React.useMemo(() => {
        const localizedPath = getLocalizedAssetPath(ASSETS.mainMap, 'zh-CN');
        return getOptimizedImageUrls(localizedPath).webp || '';
    }, []);

    React.useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const update = () => {
            const rect = element.getBoundingClientRect();
            const nextLandscapeMobileViewport = window.innerWidth <= MOBILE_MAX_VIEWPORT_WIDTH && window.innerWidth > window.innerHeight;
            const visibleWidth = nextLandscapeMobileViewport ? Math.min(rect.width, window.innerWidth) : rect.width;
            const visibleHeight = nextLandscapeMobileViewport ? Math.min(rect.height, window.innerHeight) : rect.height;
            const scale = Math.min(visibleWidth / STAGE_WIDTH, visibleHeight / STAGE_HEIGHT);
            setIsLandscapeMobileViewport(nextLandscapeMobileViewport);
            setStageMetrics({
                scale,
                left: Math.max(0, (visibleWidth - STAGE_WIDTH * scale) / 2),
                top: Math.max(0, (visibleHeight - STAGE_HEIGHT * scale) / 2),
            });
        };

        update();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(element);
        window.addEventListener('resize', update);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', update);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative h-full min-h-0 overflow-hidden"
            data-testid="qidahen-board"
            style={{
                backgroundColor: QIDAHEN_STAGE_BG,
                backgroundImage: isLandscapeMobileViewport && mapStageBackdropUrl ? `url("${mapStageBackdropUrl}")` : undefined,
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: isLandscapeMobileViewport ? 'cover' : undefined,
            }}
        >
            <div
                className="absolute overflow-hidden"
                data-testid="qidahen-desktop-stage"
                style={{
                    width: STAGE_WIDTH,
                    height: STAGE_HEIGHT,
                    left: stageMetrics.left,
                    top: stageMetrics.top,
                    background: QIDAHEN_STAGE_BG,
                    color: UI_STYLE.ink,
                    transform: `scale(${stageMetrics.scale})`,
                    transformOrigin: 'top left',
                }}
            >
                {children}
            </div>
        </div>
    );
};

const PlayerChip: React.FC<{
    faction: QidahenCore['factions'][QidahenFactionId];
    current: boolean;
    effectiveVp: number;
    prestigeBonus: number;
}> = ({ faction, current, effectiveVp, prestigeBonus }) => {
    const { t } = useTranslation('game-qidahen');
    const tone = factionTone[faction.id];
    const markedCharacters = faction.characters.filter((character) => character.defeatMarkers > 0);
    const armamentSummary = faction.armaments.length > 0
        ? faction.armaments.map((armament) => `${armament.name}${armament.level}`).join(' / ')
        : t('board.player.armamentsUndeveloped', { defaultValue: '未开发' });
    const characterSummary = markedCharacters.length > 0
        ? markedCharacters.map((character) => t('board.player.characterDefeatMarkers', {
            name: character.name,
            number: character.number,
            count: character.defeatMarkers,
            defaultValue: '{{name}}({{number}})败×{{count}}',
        })).join(' / ')
        : t('board.player.characterCount', {
            count: faction.characters.filter((character) => character.inPlay).length,
            defaultValue: '人物 {{count}}',
        });
    return (
        <div
            className="relative flex h-[74px] min-w-0 flex-1 items-center gap-3 overflow-hidden border-[3px] px-3.5"
            data-testid={`qidahen-player-${faction.id}`}
            style={{
                borderColor: current ? tone.border : UI_STYLE.mapInk,
                background: current ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
                color: UI_STYLE.mapIvory,
                boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                borderRadius: 3,
            }}
        >
            <span
                className="pointer-events-none absolute inset-y-0 left-0 w-[8px]"
                style={{ background: current ? tone.border : 'rgba(210,183,117,0.72)' }}
            />
            <span className="pointer-events-none absolute inset-x-[16px] top-[3px] h-[1px]" style={{ background: 'rgba(232,200,133,0.34)' }} />
            <OptimizedImage
                src={tone.chip}
                alt={faction.name}
                className="h-10 w-10 shrink-0 rounded-full border-2 object-cover"
                style={{ borderColor: tone.border, boxShadow: `0 0 0 2px rgba(32,21,13,0.92), 0 3px 8px rgba(0,0,0,0.34)` }}
                draggable={false}
                placeholder={false}
            />
            <div className="min-w-0 flex-1 text-[19px] font-black leading-none tracking-[0.02em] [text-shadow:0_1px_0_rgba(0,0,0,0.55)]">
                <div className="min-w-0 whitespace-nowrap">
                    <span>{faction.name}</span>
                    <span className="ml-3 text-[15px]" style={{ color: UI_STYLE.mapGold }}>VP{effectiveVp}</span>
                    {prestigeBonus > 0 ? (
                        <span className="ml-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.player.prestigeBonus', {
                                bonus: prestigeBonus,
                                defaultValue: '汉城+{{bonus}}',
                            })}
                        </span>
                    ) : null}
                    <span className="ml-3 text-[15px]" style={{ color: UI_STYLE.mapGold }}>{faction.handCount}/{faction.handLimit}</span>
                </div>
                <div
                    className="mt-1 truncate text-[11px] leading-none"
                    data-testid={`qidahen-armaments-${faction.id}`}
                    style={{ color: '#f3d1a5' }}
                >
                    {t('board.player.armaments', {
                        summary: armamentSummary,
                        defaultValue: '军备 {{summary}}',
                    })}
                </div>
                <div
                    className="mt-1 truncate text-[11px] leading-none"
                    data-testid={`qidahen-character-markers-${faction.id}`}
                    style={{ color: markedCharacters.length > 0 ? '#f3d1a5' : 'rgba(243,209,165,0.62)' }}
                >
                    {characterSummary}
                </div>
            </div>
            {faction.defeatMarkers > 0 ? (
                <span
                    className="grid h-[26px] min-w-[42px] shrink-0 place-items-center border-2 px-1.5 text-[12px] font-black"
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: 'rgba(87, 35, 24, 0.92)',
                        color: '#f3d1a5',
                        boxShadow: `0 2px 6px ${UI_STYLE.shadowSoft}`,
                        borderRadius: 2,
                    }}
                >
                    {t('board.player.defeatMarkers', {
                        count: faction.defeatMarkers,
                        defaultValue: '败×{{count}}',
                    })}
                </span>
            ) : null}
            {current ? (
                <span
                    className="grid h-[28px] w-[48px] shrink-0 place-items-center border-2 text-[12px] font-black"
                    style={{
                        background: 'linear-gradient(180deg, rgba(196,81,61,0.96) 0%, rgba(159,52,38,0.96) 100%)',
                        borderColor: UI_STYLE.mapInk,
                        color: '#f8e7c9',
                        boxShadow: `0 3px 7px ${UI_STYLE.cinnabarGlow}`,
                        borderRadius: 2,
                    }}
                >
                    {t('board.player.current', { defaultValue: '当前' })}
                </span>
            ) : null}
        </div>
    );
};

const PlayerFloat: React.FC<{ core: QidahenCore }> = ({ core }) => {
    const prestigeBonusByFaction = getQidahenPrestigeBonusByFaction(core);
    return (
        <div
            className="pointer-events-auto absolute left-[720px] top-[36px] z-40 flex w-[700px] gap-3"
            data-testid="qidahen-player-float"
            data-ui-anchor="top-right"
        >
            {(['ming', 'mongol', 'jin'] as QidahenFactionId[]).map((id) => (
                <PlayerChip
                    key={id}
                    faction={core.factions[id]}
                    current={core.currentPlayer === core.factions[id].playerId}
                    effectiveVp={getQidahenEffectiveVpByFaction(core, id)}
                    prestigeBonus={prestigeBonusByFaction[id]}
                />
            ))}
        </div>
    );
};

const MapToken: React.FC<{ token: QidahenMapToken }> = ({ token }) => {
    const size = token.size ?? 30;
    const tone = factionTone[token.faction === 'neutral' ? 'ming' : token.faction];
    const isArmyToken = token.type === 'army';
    const isPopulationToken = token.type === 'population';
    const tokenShapeClass = isArmyToken ? 'rounded-[6px]' : (token.type === 'control' || isPopulationToken) ? 'rounded-full' : '';
    const showImageValueBadge = token.type === 'control' && typeof token.value === 'number';
    return (
        <div
            className={`pointer-events-none absolute grid place-items-center text-[13px] font-black ${tokenShapeClass}`}
            data-testid={`qidahen-map-token-${token.id}`}
            style={{
                left: token.x * QIDAHEN_MAP_WIDTH,
                top: token.y * QIDAHEN_MAP_HEIGHT,
                width: size,
                height: size,
                color: UI_STYLE.ink,
                transform: `translate(-50%, -50%) rotate(${token.rotationDeg ?? 0}deg)`,
            }}
        >
            {token.imageSrc ? (
                <>
                    <OptimizedImage
                        src={token.imageSrc}
                        alt={token.id}
                        className={`h-full w-full object-cover ${tokenShapeClass}`}
                        draggable={false}
                        placeholder={false}
                        style={{ boxShadow: `0 2px 8px ${UI_STYLE.shadowSoft}` }}
                    />
                    {isPopulationToken && typeof token.value === 'number' ? (
                        <span
                            className="absolute inset-0 grid place-items-center text-[12px] font-black leading-none"
                            style={{ color: UI_STYLE.ink, textShadow: '0 1px 0 rgba(255,247,224,0.45)' }}
                        >
                            {token.value}
                        </span>
                    ) : null}
                    {showImageValueBadge ? (
                        <span
                            className={`absolute -bottom-1 -right-1 grid min-h-[18px] min-w-[18px] place-items-center border-[2px] px-1 text-[11px] leading-none ${tokenShapeClass}`}
                            style={{ borderColor: tone.border, background: UI_STYLE.paperLight, color: UI_STYLE.ink, boxShadow: `0 2px 6px ${UI_STYLE.shadowSoft}` }}
                        >
                            {token.value}
                        </span>
                    ) : null}
                </>
            ) : (
                <span
                    className={`grid h-full w-full place-items-center border-2 ${tokenShapeClass}`}
                    style={{ borderColor: tone.border, background: UI_STYLE.paperLight }}
                >
                    {token.value}
                </span>
            )}
        </div>
    );
};

const MapSceneLayer: React.FC<{
    core: QidahenCore;
    perspectiveFactionId: QidahenFactionId | null;
    wheelDispatchSelection: QidahenWheelDispatchSelection | null;
    internalDispatchSelection: QidahenInternalDispatchSelection | null;
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    tutorialStepId?: string | null;
    compactRegionTip: boolean;
    viewport: QidahenMapViewport;
    onViewportChange: (viewport: QidahenMapViewport) => void;
    locale?: string;
    onSelectRegion: (regionId: string) => void;
}> = ({ core, perspectiveFactionId, wheelDispatchSelection, internalDispatchSelection, pendingTargetAction, tutorialStepId, compactRegionTip, viewport, onViewportChange, locale, onSelectRegion }) => {
    const { t } = useTranslation('game-qidahen');
    const currentFactionId = perspectiveFactionId
        ?? QIDAHEN_FACTION_ORDER.find((factionId) => core.factions[factionId].playerId === core.currentPlayer)
        ?? 'ming';
    const mapLayerRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const hitmapRef = React.useRef<Uint8ClampedArray | null>(null);
    const runtimeRegionIdByPixelRef = React.useRef<Array<string | null> | null>(null);
    const dragStateRef = React.useRef<{
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startPanX: number;
        startPanY: number;
        moved: boolean;
    } | null>(null);
    const [hoveredRegionId, setHoveredRegionId] = React.useState<string | null>(null);
    const [maskVersion, setMaskVersion] = React.useState(0);

    React.useEffect(() => {
        if (typeof Image === 'undefined') return undefined;

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            const formalHitmap = buildRegionMaskHitmap(image);
            if (!cancelled && formalHitmap) {
                hitmapRef.current = formalHitmap;
                runtimeRegionIdByPixelRef.current = buildQidahenRuntimeRegionIdByPixel(
                    formalHitmap,
                    QIDAHEN_MAP_WIDTH,
                    QIDAHEN_MAP_HEIGHT,
                );
                setMaskVersion((value) => value + 1);
            }
        };
        image.src = qidahenRegionMaskUrl;
        return () => {
            cancelled = true;
        };
    }, []);

    const tutorialMapTargetRegionId = tutorialStepId === 'select-region'
        ? 'song-jin'
        : null;

    React.useEffect(() => {
        const canvas = overlayCanvasRef.current;
        const runtimeRegionIdByPixel = runtimeRegionIdByPixelRef.current;
        if (!canvas || !runtimeRegionIdByPixel) {
            return;
        }

        const expandRuntimeRegionIds = (regionId: string | null | undefined): string[] => {
            if (!regionId) {
                return [];
            }
            const region = core.regions.find((item) => item.id === regionId);
            if (region) {
                const runtimeRegionIds = region.isLogicalRegion ? region.runtimeRegionIds : [region.id];
                const uniqueRuntimeRegionIds = Array.from(new Set(runtimeRegionIds.filter(Boolean)));
                return uniqueRuntimeRegionIds.length > 0 ? uniqueRuntimeRegionIds : [regionId];
            }
            const runtimeRegionIds = getQidahenRuntimeRegionIdsForPrintedRegionId(regionId);
            return runtimeRegionIds.length > 0 ? runtimeRegionIds : [regionId];
        };

        const toneByRegionId = new Map<string, RegionMaskOverlayToneKey>();
        const applyTone = (regionId: string | null | undefined, tone: RegionMaskOverlayToneKey) => {
            for (const runtimeRegionId of expandRuntimeRegionIds(regionId)) {
                toneByRegionId.set(runtimeRegionId, tone);
            }
        };
        for (const region of core.regions) {
            if (region.isLogicalRegion) {
                continue;
            }
            applyTone(region.id, region.controller);
        }
        applyTone(wheelDispatchSelection?.sourceRegionId, 'source');
        applyTone(core.gaoDiDispatchSelection?.sourceRegionId, 'source');
        applyTone(internalDispatchSelection?.sourceRegionId, 'source');
        applyTone(pendingTargetAction?.sourceRegionId, 'source');
        for (const candidate of wheelDispatchSelection?.candidates ?? []) {
            applyTone(candidate.targetRuntimeRegionId, 'dispatch');
        }
        if (isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection)) {
            for (const candidate of core.gaoDiDispatchSelection?.candidates ?? []) {
                applyTone(candidate.targetRegionId, 'dispatch');
            }
        }
        for (const candidate of internalDispatchSelection?.candidates ?? []) {
            applyTone(candidate.targetRegionId, 'dispatch');
        }
        if (pendingTargetAction?.targetRuntimeRegionId || pendingTargetAction?.targetRegionId) {
            applyTone(pendingTargetAction.targetRuntimeRegionId ?? pendingTargetAction.targetRegionId, 'pending');
        }
        if (tutorialMapTargetRegionId) {
            applyTone(tutorialMapTargetRegionId, 'dispatch');
        }
        if (hoveredRegionId) {
            applyTone(hoveredRegionId, 'hovered');
        }
        if (compactRegionTip && core.explicitRegionId) {
            applyTone(core.explicitRegionId, 'selected');
        }
        renderRegionOwnershipOverlay(canvas, runtimeRegionIdByPixel, QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT, toneByRegionId);
    }, [
        core.gaoDiDispatchSelection,
        internalDispatchSelection?.candidates,
        internalDispatchSelection?.sourceRegionId,
        pendingTargetAction?.sourceRegionId,
        pendingTargetAction?.targetRegionId,
        pendingTargetAction?.targetRuntimeRegionId,
        compactRegionTip,
        core.regions,
        core.explicitRegionId,
        tutorialMapTargetRegionId,
        wheelDispatchSelection?.sourceRegionId,
        wheelDispatchSelection?.candidates,
        hoveredRegionId,
        maskVersion,
    ]);

    const selectedRegion = core.explicitRegionId
        ? core.regions.find((region) => region.id === core.explicitRegionId)
        : undefined;
    const hoveredRegion = hoveredRegionId ? core.regions.find((region) => region.id === hoveredRegionId) : undefined;
    const displaySelectedRegion = compactRegionTip ? selectedRegion : undefined;
    const focusedRegion = hoveredRegion ?? displaySelectedRegion;
    const focusedSpecialTroopsSummary = focusedRegion && focusedRegion.specialTroops.length > 0
        ? formatSpecialTroops(focusedRegion.specialTroops)
        : null;

    const getRegionFromPointer = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const runtimeRegionIdByPixel = runtimeRegionIdByPixelRef.current;
        if (!canvas || !runtimeRegionIdByPixel) return null;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / rect.width) * QIDAHEN_MAP_WIDTH);
        const y = Math.floor(((event.clientY - rect.top) / rect.height) * QIDAHEN_MAP_HEIGHT);
        if (x < 0 || y < 0 || x >= QIDAHEN_MAP_WIDTH || y >= QIDAHEN_MAP_HEIGHT) return null;

        return runtimeRegionIdByPixel[(y * QIDAHEN_MAP_WIDTH) + x] ?? null;
    }, []);

    const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        setHoveredRegionId(getRegionFromPointer(event));
    }, [getRegionFromPointer]);

    const handleMapWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const layer = mapLayerRef.current;
        if (!layer) {
            return;
        }
        const rect = layer.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return;
        }
        const stageX = ((event.clientX - rect.left) / rect.width) * STAGE_WIDTH;
        const stageY = ((event.clientY - rect.top) / rect.height) * STAGE_HEIGHT;
        const nextZoom = clampNumber(
            viewport.zoom * (event.deltaY < 0 ? 1.14 : 0.88),
            QIDAHEN_MAP_MIN_ZOOM,
            QIDAHEN_MAP_MAX_ZOOM,
        );
        if (Math.abs(nextZoom - viewport.zoom) < 0.001) {
            return;
        }
        const mapX = (stageX - MAP_COVER_LEFT - viewport.panX) / (MAP_COVER_SCALE * viewport.zoom);
        const mapY = (stageY - MAP_COVER_TOP - viewport.panY) / (MAP_COVER_SCALE * viewport.zoom);
        onViewportChange(clampQidahenMapViewport({
            zoom: nextZoom,
            panX: stageX - MAP_COVER_LEFT - mapX * MAP_COVER_SCALE * nextZoom,
            panY: stageY - MAP_COVER_TOP - mapY * MAP_COVER_SCALE * nextZoom,
        }));
    }, [onViewportChange, viewport.panX, viewport.panY, viewport.zoom]);

    const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0) {
            return;
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragStateRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPanX: viewport.panX,
            startPanY: viewport.panY,
            moved: false,
        };
    }, [viewport.panX, viewport.panY]);

    const handleCanvasPointerMove = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const dragState = dragStateRef.current;
        if (dragState && dragState.pointerId === event.pointerId) {
            const layer = mapLayerRef.current;
            if (!layer) {
                return;
            }
            const rect = layer.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return;
            }
            const deltaX = ((event.clientX - dragState.startClientX) / rect.width) * STAGE_WIDTH;
            const deltaY = ((event.clientY - dragState.startClientY) / rect.height) * STAGE_HEIGHT;
            if (!dragState.moved && Math.abs(deltaX) + Math.abs(deltaY) >= 6) {
                dragState.moved = true;
            }
            if (dragState.moved) {
                setHoveredRegionId(null);
                onViewportChange(clampQidahenMapViewport({
                    zoom: viewport.zoom,
                    panX: dragState.startPanX + deltaX,
                    panY: dragState.startPanY + deltaY,
                }));
                return;
            }
        }
        handlePointerMove(event);
    }, [handlePointerMove, onViewportChange, viewport.zoom]);

    const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        dragStateRef.current = null;
        if (dragState.moved) {
            return;
        }
        const regionId = getRegionFromPointer(event);
        if (regionId) {
            onSelectRegion(regionId);
        }
    }, [getRegionFromPointer, onSelectRegion]);

    const handlePointerCancel = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (dragStateRef.current?.pointerId === event.pointerId) {
            dragStateRef.current = null;
        }
    }, []);

    const tipLeft = focusedRegion
        ? Math.min(
            Math.min(STAGE_WIDTH - MAP_REGION_TIP_WIDTH - 18, ACTIONS_DOCK_LEFT - MAP_REGION_TIP_WIDTH - MAP_REGION_TIP_ACTION_GAP),
            Math.max(18, projectQidahenMapPointToStage({
                x: focusedRegion.x * QIDAHEN_MAP_WIDTH,
                y: focusedRegion.y * QIDAHEN_MAP_HEIGHT,
            }, viewport).x + 18),
        )
        : 0;
    const tipTop = focusedRegion
        ? Math.min(STAGE_HEIGHT - 118, Math.max(18, projectQidahenMapPointToStage({
            x: focusedRegion.x * QIDAHEN_MAP_WIDTH,
            y: focusedRegion.y * QIDAHEN_MAP_HEIGHT,
        }, viewport).y - 34))
        : 0;
    const focusRuntimeRegionIds = new Set(focusedRegion?.runtimeRegionIds ?? []);
    const runtimeRegionsById = new Map(
        core.regions
            .filter((region) => !region.isLogicalRegion)
            .map((region) => [region.id, region]),
    );
    const selectedRuntimeRegionIds = new Set(displaySelectedRegion?.runtimeRegionIds ?? (displaySelectedRegion?.id ? [displaySelectedRegion.id] : []));
    const sharedPrintedRuntimeOptions = focusedRegion
        ? Array.from(new Set(
            (focusedRegion.isLogicalRegion ? focusedRegion.runtimeRegionIds : [focusedRegion.id])
                .flatMap((runtimeRegionId) => getQidahenPrintedRegionIdsForRuntimeRegionId(runtimeRegionId))
                .flatMap((printedRegionId) => getQidahenRuntimeRegionIdsForPrintedRegionId(printedRegionId)),
        ))
            .map((runtimeRegionId) => runtimeRegionsById.get(runtimeRegionId))
            .filter((region): region is NonNullable<typeof region> => region != null)
        : [];
    const runtimeGraphEdges = QIDAHEN_REGION_GRAPH_EDGES
        .filter((edge) => focusRuntimeRegionIds.has(edge.from) || focusRuntimeRegionIds.has(edge.to))
        .map((edge) => {
            const renderFromId = focusRuntimeRegionIds.has(edge.to) && !focusRuntimeRegionIds.has(edge.from)
                ? edge.to
                : edge.from;
            const renderToId = renderFromId === edge.from ? edge.to : edge.from;
            const directedPassage = getQidahenDirectedPassage(edge, renderFromId, renderToId);
            const fromRuntimeRegion = runtimeRegionsById.get(renderFromId);
            const stateBoundaryType = fromRuntimeRegion?.boundaryTypeByRegionId[renderToId];
            const stateTravelCost = fromRuntimeRegion?.travelCostByRegionId[renderToId];
            const stateBattleWidth = fromRuntimeRegion?.movementCostByRegionId[renderToId];
            const statePassage = stateBoundaryType && typeof stateTravelCost === 'number' && typeof stateBattleWidth === 'number'
                ? {
                    boundaryType: stateBoundaryType,
                    boundaryLabel: getQidahenBoundaryTypeMeta(stateBoundaryType).label,
                    travelCost: stateTravelCost,
                    battleWidth: stateBattleWidth,
                }
                : null;
            const fromNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(renderFromId);
            const toNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(renderToId);
            const from = fromNode?.center ?? fromNode?.seed ?? null;
            const to = toNode?.center ?? toNode?.seed ?? null;
            return from && to ? { edge, from, to, directedPassage: statePassage ?? directedPassage } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    const activePassageSummary = focusedRegion
        ? Object.entries(focusedRegion.travelCostByRegionId)
            .map(([regionId, travelCost]) => {
                const targetRegion = core.regions.find((region) => region.id === regionId);
                const boundaryType = focusedRegion.boundaryTypeByRegionId[regionId];
                const battleWidth = focusedRegion.movementCostByRegionId[regionId];
                const boundaryMeta = boundaryType ? getQidahenBoundaryTypeMeta(boundaryType) : getQidahenBoundaryTypeMeta('plain');
                const boundaryLabel = boundaryMeta.label;
                return {
                    regionId,
                    regionName: targetRegion
                        ? getActionRuleDisplayRegionName(targetRegion, targetRegion.name)
                        : getQidahenStatefulRegionDisplayName(regionId),
                    travelCost,
                    battleWidth,
                    boundaryLabel,
                    unitCap: boundaryMeta.unitCap,
                };
            })
            .sort((left, right) => left.travelCost - right.travelCost || left.regionName.localeCompare(right.regionName, 'zh-CN'))
            .slice(0, 3)
            .map((entry) => `${entry.regionName} ${entry.boundaryLabel} 移${entry.travelCost}/宽${entry.battleWidth ?? '-'}${entry.unitCap ? `/限${entry.unitCap}` : ''}`)
            .join(' · ')
        : '';
    const activeMovementPreview = focusedRegion && focusedRegion.controller === currentFactionId
        ? (() => {
            const previewText = (['dispatch-infantry', 'dispatch-cavalry'] as const)
                .map((profileId) => {
                    const profile = getQidahenMovementProfile(profileId);
                    const reachable = findQidahenReachableRuntimeRegions(core, focusedRegion.id, currentFactionId, profile.movementBudget)
                        .slice(0, 3)
                        .map((region) => `${region.regionName}${region.usesCoast ? ' 水' : ''}`)
                        .join(' / ');
                    return reachable ? `${profile.label} ${reachable}` : '';
                })
                .filter(Boolean)
                .join(' · ');
            return previewText || '暂无';
        })()
        : '';
    const getRegionPoint = (regionId: string | null | undefined) => {
        if (!regionId) {
            return null;
        }
        const region = runtimeRegionsById.get(regionId) ?? core.regions.find((item) => item.id === regionId);
        if (region && typeof region.x === 'number' && typeof region.y === 'number') {
            return {
                x: region.x * QIDAHEN_MAP_WIDTH,
                y: region.y * QIDAHEN_MAP_HEIGHT,
            };
        }
        const graphNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(regionId);
        return graphNode?.center ?? graphNode?.seed ?? null;
    };
    const buildGuidePathPoints = (
        pathRegionIds: string[],
        fallbackSourceRegionId: string | null | undefined,
        fallbackTargetRegionId: string | null | undefined,
    ) => {
        const mergedRegionIds = [
            fallbackSourceRegionId,
            ...pathRegionIds,
            fallbackTargetRegionId,
        ].filter((regionId, index, list): regionId is string => Boolean(regionId) && list.indexOf(regionId) === index);
        const points = mergedRegionIds
            .map((regionId) => getRegionPoint(regionId))
            .filter((point): point is NonNullable<typeof point> => point != null);
        return points.length >= 2 ? points : [];
    };
    const mapSelectionGuide = (() => {
        if (wheelDispatchSelection) {
            return {
                sourceRegionId: wheelDispatchSelection.sourceRegionId,
                title: '点一个进攻目标',
                hint: '选择目标',
                badgeLabel: '选择目标',
                candidates: wheelDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.targetRuntimeRegionId,
                    targetRegionId: candidate.targetRuntimeRegionId,
                    targetRegionName: candidate.targetRegionName,
                    resolutionHint: candidate.resolutionHint,
                    pathPoints: buildGuidePathPoints(candidate.pathRegionIds, wheelDispatchSelection.sourceRegionId, candidate.targetRuntimeRegionId),
                })),
                candidateSummary: formatQidahenCandidateRegionSummary(wheelDispatchSelection.candidates.map((candidate) => candidate.targetRegionName)),
            };
        }
        if (core.gaoDiDispatchSelection) {
            const gaoDiTargetSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);
            return {
                sourceRegionId: core.gaoDiDispatchSelection.sourceRegionId,
                title: gaoDiTargetSelectionActive
                    ? '点一个调度目标'
                    : '先弃 1 张牌',
                hint: gaoDiTargetSelectionActive ? '选择目标' : '先选要弃掉的手牌',
                badgeLabel: gaoDiTargetSelectionActive ? '选择目标' : '弃牌',
                candidates: gaoDiTargetSelectionActive ? core.gaoDiDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                    resolutionHint: candidate.resolutionHint,
                    pathPoints: buildGuidePathPoints(candidate.pathRegionIds, core.gaoDiDispatchSelection?.sourceRegionId, candidate.targetRegionId),
                })) : [],
                candidateSummary: gaoDiTargetSelectionActive
                    ? formatQidahenCandidateRegionSummary(core.gaoDiDispatchSelection.candidates.map((candidate) => candidate.targetRegionName))
                    : '等待弃牌',
            };
        }
        if (internalDispatchSelection) {
            return {
                sourceRegionId: internalDispatchSelection.sourceRegionId,
                title: '点一个调度目标',
                hint: '选择目标',
                badgeLabel: '选择目标',
                candidates: internalDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                    resolutionHint: candidate.resolutionHint,
                    pathPoints: buildGuidePathPoints(candidate.pathRegionIds, internalDispatchSelection.sourceRegionId, candidate.targetRegionId),
                })),
                candidateSummary: formatQidahenCandidateRegionSummary(internalDispatchSelection.candidates.map((candidate) => candidate.targetRegionName)),
            };
        }
        if (pendingTargetAction?.sourceRegionId) {
            return {
                sourceRegionId: pendingTargetAction.sourceRegionId,
                title: `处理中：${pendingTargetAction.targetRegionName}`,
                hint: '处理中',
                badgeLabel: '待结算',
                candidates: [
                    {
                        id: pendingTargetAction.targetRuntimeRegionId,
                        targetRegionId: pendingTargetAction.targetRuntimeRegionId,
                        targetRegionName: pendingTargetAction.targetRegionName,
                        resolutionHint: pendingTargetAction.resolutionHint,
                        pathPoints: buildGuidePathPoints([], pendingTargetAction.sourceRegionId, pendingTargetAction.targetRuntimeRegionId),
                    },
                ],
                candidateSummary: pendingTargetAction.targetRegionName,
            };
        }
        return null;
    })();
    const mapSelectionCandidateRegionIds = new Set(mapSelectionGuide?.candidates.map((candidate) => candidate.targetRegionId) ?? []);
    const activeGuideTargetRegionId = hoveredRegionId && mapSelectionCandidateRegionIds.has(hoveredRegionId)
        ? hoveredRegionId
        : core.explicitRegionId && mapSelectionCandidateRegionIds.has(core.explicitRegionId)
            ? core.explicitRegionId
            : null;
    const mapSelectionBannerLeft = (STAGE_WIDTH - MAP_SELECTION_BANNER_WIDTH) / 2;
    const mapSelectionBannerInteractive = mapSelectionGuide != null
        && pendingTargetAction == null
        && mapSelectionGuide.candidates.length > 0;

    return (
        <div
            ref={mapLayerRef}
            className="pointer-events-auto absolute inset-0 z-10 overflow-hidden"
            data-testid="qidahen-map-layer"
            data-tutorial-id="qidahen-map-layer"
            data-map-layout="full-bleed-cover"
            data-map-selected={core.explicitRegionId ?? ''}
            data-map-zoom={viewport.zoom}
            data-map-pan-x={viewport.panX}
            data-map-pan-y={viewport.panY}
            onWheel={handleMapWheel}
            style={{
                background: '#c8a970',
            }}
        >
            <div
                className="absolute"
                data-testid="qidahen-map-content"
                style={{
                    left: MAP_COVER_LEFT + viewport.panX,
                    top: MAP_COVER_TOP + viewport.panY,
                    width: QIDAHEN_MAP_WIDTH,
                    height: QIDAHEN_MAP_HEIGHT,
                    transform: `scale(${MAP_COVER_SCALE * viewport.zoom})`,
                    transformOrigin: 'top left',
                }}
            >
                <OptimizedImage
                    src={ASSETS.mainMap}
                    locale={locale}
                    alt={t('board.map.mainMapAlt', { defaultValue: '七大恨主地图' })}
                    className="absolute inset-0 h-full w-full select-none object-fill"
                    data-testid="qidahen-main-map-image"
                    draggable={false}
                    placeholder={false}
                />
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`0 0 ${QIDAHEN_MAP_WIDTH} ${QIDAHEN_MAP_HEIGHT}`}
                    aria-hidden="true"
                    data-testid="qidahen-map-overlay"
                >
                    <defs>
                        <filter id="qidahen-map-province-selected" x="-12%" y="-12%" width="124%" height="124%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.2" floodColor="rgba(255,248,233,0.58)" />
                            <feDropShadow dx="0" dy="0" stdDeviation="6.5" floodColor="rgba(184,59,39,0.34)" />
                        </filter>
                        <filter id="qidahen-map-province-hover" x="-10%" y="-10%" width="120%" height="120%">
                            <feDropShadow dx="0" dy="0" stdDeviation="4.2" floodColor="rgba(255,220,146,0.44)" />
                        </filter>
                        <marker id="qidahen-map-guide-arrow" markerWidth="18" markerHeight="18" refX="15" refY="9" orient="auto" markerUnits="userSpaceOnUse">
                            <path d="M 0 1 L 16 9 L 0 17 L 5 9 z" fill="rgba(118, 214, 138, 0.98)" />
                        </marker>
                        <marker id="qidahen-map-guide-arrow-active" markerWidth="18" markerHeight="18" refX="15" refY="9" orient="auto" markerUnits="userSpaceOnUse">
                            <path d="M 0 1 L 16 9 L 0 17 L 5 9 z" fill="rgba(255, 230, 167, 0.98)" />
                        </marker>
                        <filter id="qidahen-map-guide-glow" x="-18%" y="-18%" width="136%" height="136%">
                            <feDropShadow dx="0" dy="0" stdDeviation="4.2" floodColor="rgba(106,214,139,0.42)" />
                        </filter>
                    </defs>
                    {core.routeLines.map((route) => (
                        <polyline
                            key={route.id}
                            points={route.points.map((point) => `${point.x * QIDAHEN_MAP_WIDTH},${point.y * QIDAHEN_MAP_HEIGHT}`).join(' ')}
                            fill="none"
                            stroke={route.tone === 'red'
                                ? (mapSelectionGuide ? 'rgba(184,59,39,0.24)' : 'rgba(184,59,39,0.72)')
                                : (mapSelectionGuide ? 'rgba(43,101,145,0.22)' : 'rgba(43,101,145,0.74)')}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={route.tone === 'red' ? '12 10' : undefined}
                        />
                    ))}
                    <g data-testid="qidahen-runtime-region-graph">
                        {runtimeGraphEdges.map(({ edge, from, to, directedPassage }) => {
                            const boundaryType = directedPassage?.boundaryType ?? edge.boundaryType;
                            const boundaryLabel = directedPassage?.boundaryLabel ?? edge.boundaryLabel;
                            const battleWidth = directedPassage?.battleWidth ?? edge.battleWidth;
                            const boundaryMeta = getQidahenBoundaryTypeMeta(boundaryType);
                            const color = BOUNDARY_TYPE_RUNTIME_COLORS[boundaryType] ?? BOUNDARY_TYPE_RUNTIME_COLORS.plain;
                            const midX = (from.x + to.x) / 2;
                            const midY = (from.y + to.y) / 2;
                            return (
                                <g
                                    key={edge.id}
                                    data-testid={`qidahen-runtime-region-edge-${edge.id}`}
                                    data-boundary-type={boundaryType}
                                    data-battle-width={battleWidth}
                                >
                                    <line
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke={color}
                                        strokeWidth={5}
                                        strokeLinecap="round"
                                        strokeDasharray={boundaryType === 'coast' ? '9 9' : undefined}
                                        opacity={mapSelectionGuide ? 0.22 : 0.9}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {!mapSelectionGuide ? (
                                        <text
                                            x={midX}
                                            y={midY - 8}
                                            fill={color}
                                            stroke="rgba(32,21,13,0.78)"
                                            strokeWidth={3}
                                            paintOrder="stroke fill"
                                            textAnchor="middle"
                                            fontSize={18}
                                            fontWeight={900}
                                        >
                                            {boundaryLabel || boundaryMeta.label}
                                        </text>
                                    ) : null}
                                </g>
                            );
                        })}
                    </g>
                    {mapSelectionGuide ? (
                        <g data-testid="qidahen-map-selection-guide">
                            {mapSelectionGuide.candidates.map((candidate, index) => {
                                const pathPoints = candidate.pathPoints;
                                const activeCandidate = activeGuideTargetRegionId === candidate.targetRegionId;
                                const targetPoint = pathPoints[pathPoints.length - 1] ?? getRegionPoint(candidate.targetRegionId);
                                if (pathPoints.length < 2 || !targetPoint) {
                                    return null;
                                }
                                const pointLabel = pathPoints.map((point) => `${point.x},${point.y}`).join(' ');
                                return (
                                    <g key={candidate.id} data-testid={`qidahen-map-guide-route-${candidate.targetRegionId}`}>
                                        <polyline
                                            points={pointLabel}
                                            fill="none"
                                            stroke={activeCandidate ? 'rgba(255,226,161,0.98)' : 'rgba(109, 216, 141, 0.96)'}
                                            strokeWidth={activeCandidate ? 11 : 8}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            markerMid={activeCandidate ? 'url(#qidahen-map-guide-arrow-active)' : 'url(#qidahen-map-guide-arrow)'}
                                            markerEnd={activeCandidate ? 'url(#qidahen-map-guide-arrow-active)' : 'url(#qidahen-map-guide-arrow)'}
                                            filter="url(#qidahen-map-guide-glow)"
                                            opacity={1}
                                        />
                                        <circle
                                            cx={targetPoint.x}
                                            cy={targetPoint.y}
                                            r={activeCandidate ? 18 : 15}
                                            fill={activeCandidate ? 'rgba(43,105,57,0.98)' : 'rgba(53,143,75,0.96)'}
                                            stroke={activeCandidate ? 'rgba(255,236,190,0.98)' : 'rgba(224,255,217,0.96)'}
                                            strokeWidth={activeCandidate ? 4 : 3}
                                            filter="url(#qidahen-map-guide-glow)"
                                        />
                                        <text
                                            x={targetPoint.x}
                                            y={targetPoint.y + 0.5}
                                            fill="#f7ffef"
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize={activeCandidate ? 14 : 12}
                                            fontWeight={900}
                                        >
                                            {index + 1}
                                        </text>
                                    </g>
                                );
                            })}
                            {(() => {
                                const sourcePoint = getRegionPoint(mapSelectionGuide.sourceRegionId);
                                if (!sourcePoint) {
                                    return null;
                                }
                                return (
                                    <g data-testid="qidahen-map-selection-guide-source">
                                        <circle
                                            cx={sourcePoint.x}
                                            cy={sourcePoint.y}
                                            r={16}
                                            fill="rgba(111,74,23,0.9)"
                                            stroke="rgba(255,227,151,0.98)"
                                            strokeWidth={4}
                                            filter="url(#qidahen-map-guide-glow)"
                                        />
                                        <text
                                            x={sourcePoint.x}
                                            y={sourcePoint.y}
                                            fill="#fff6df"
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize={12}
                                            fontWeight={900}
                                        >
                                            {t('board.map.selectionGuideSource', { defaultValue: '起' })}
                                        </text>
                                    </g>
                                );
                            })()}
                        </g>
                    ) : null}
                </svg>
                <canvas
                    ref={overlayCanvasRef}
                    width={QIDAHEN_MAP_WIDTH}
                    height={QIDAHEN_MAP_HEIGHT}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    data-testid="qidahen-map-region-mask-overlay"
                    aria-hidden="true"
                />
                {core.mapTokens.map((token) => (
                    <MapToken key={token.id} token={token} />
                ))}
                <canvas
                    ref={canvasRef}
                    width={QIDAHEN_MAP_WIDTH}
                    height={QIDAHEN_MAP_HEIGHT}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    data-testid="qidahen-map-hitmap-canvas"
                    data-tutorial-id={tutorialMapTargetRegionId ? 'qidahen-map-target-song-jin' : undefined}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerLeave={() => {
                        if (!dragStateRef.current) {
                            setHoveredRegionId(null);
                        }
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    aria-label={t('board.map.regionSelectionAria', { defaultValue: '七大恨地图区域选择' })}
                />
            </div>
            <div
                className="pointer-events-auto absolute bottom-[132px] left-[26px] z-30 flex flex-col gap-2"
                data-testid="qidahen-map-viewport-controls"
                data-ui-anchor="left-bottom"
            >
                <div className="flex gap-2">
                    <button
                        type="button"
                        data-testid="qidahen-map-zoom-out"
                        className="inline-flex h-[38px] min-w-[38px] items-center justify-center border-[3px] text-[18px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                        onClick={() => onViewportChange(clampQidahenMapViewport({
                            zoom: viewport.zoom / 1.14,
                            panX: viewport.panX,
                            panY: viewport.panY,
                        }))}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        -
                    </button>
                    <button
                        type="button"
                        data-testid="qidahen-map-zoom-reset"
                        className="inline-flex h-[38px] min-w-[74px] items-center justify-center border-[3px] px-3 text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                        onClick={() => onViewportChange(DEFAULT_QIDAHEN_MAP_VIEWPORT)}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        {t('devtools.regionMaskTool.compactBoundaryStats.reset', { defaultValue: '复位' })}
                    </button>
                    <button
                        type="button"
                        data-testid="qidahen-map-zoom-in"
                        className="inline-flex h-[38px] min-w-[38px] items-center justify-center border-[3px] text-[18px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                        onClick={() => onViewportChange(clampQidahenMapViewport({
                            zoom: viewport.zoom * 1.14,
                            panX: viewport.panX,
                            panY: viewport.panY,
                        }))}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        +
                    </button>
                </div>
            </div>
            {mapSelectionGuide && pendingTargetAction == null ? (
                <div
                    className="pointer-events-none absolute z-50 border-[3px] px-4 py-3"
                    data-testid="qidahen-map-selection-banner"
                    style={{
                        left: mapSelectionBannerLeft,
                        top: MAP_SELECTION_BANNER_TOP,
                        width: MAP_SELECTION_BANNER_WIDTH,
                        borderColor: mapSelectionBannerInteractive ? '#5fb772' : UI_STYLE.oldGold,
                        background: mapSelectionBannerInteractive ? 'rgba(20, 63, 34, 0.94)' : UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div
                            className="inline-flex items-center border px-2 py-1 text-[10px] font-black tracking-[0.18em]"
                            style={{
                                borderColor: mapSelectionBannerInteractive ? '#a7e6b4' : '#f6d5a8',
                                color: mapSelectionBannerInteractive ? '#e7ffd8' : '#f6d5a8',
                                background: mapSelectionBannerInteractive ? 'rgba(76, 142, 88, 0.18)' : 'rgba(109,74,23,0.18)',
                            }}
                        >
                            {mapSelectionGuide.badgeLabel}
                        </div>
                    </div>
                    <div className="mt-2 text-[18px] font-black leading-6 [text-shadow:0_1px_0_rgba(0,0,0,0.45)]">
                        {mapSelectionGuide.title}
                    </div>
                    <div className="mt-1 text-[12px] font-black leading-5" style={{ color: mapSelectionBannerInteractive ? '#dbf5cf' : '#f3d1a5' }}>
                        {mapSelectionGuide.hint}
                    </div>
                </div>
            ) : null}
            {focusedRegion ? (
                <div
                    className="pointer-events-none absolute z-20 border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-map-region-tip"
                    style={{
                        left: tipLeft,
                        top: tipTop,
                        width: MAP_REGION_TIP_WIDTH,
                        borderColor: focusedRegion.id === core.explicitRegionId ? UI_STYLE.cinnabar : UI_STYLE.mapInk,
                        background: focusedRegion.id === core.explicitRegionId ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="text-[16px] [text-shadow:0_1px_0_rgba(0,0,0,0.55)]">{focusedRegion.name} · {focusedRegion.controlLabel}</div>
                    <div className="mt-1 text-[12px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.map.regionTroopsPopulation', {
                            troops: focusedRegion.troops,
                            population: focusedRegion.population,
                            defaultValue: '兵力 {{troops}} · 人口 {{population}}',
                        })}
                    </div>
                    {focusedSpecialTroopsSummary ? (
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.map.regionSpecialTroops', {
                                summary: focusedSpecialTroopsSummary,
                                defaultValue: '特殊 {{summary}}',
                            })}
                        </div>
                    ) : null}
                    {!compactRegionTip && activePassageSummary ? (
                        <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.map.regionPassages', {
                                summary: activePassageSummary,
                                defaultValue: '接边 {{summary}}',
                            })}
                        </div>
                    ) : null}
                    {!compactRegionTip && activeMovementPreview ? (
                        <div
                            className="mt-1 text-[11px]"
                            data-testid="qidahen-map-region-movement-preview"
                            style={{ color: '#f3d1a5' }}
                        >
                            {t('board.map.regionReachable', {
                                summary: activeMovementPreview,
                                defaultValue: '调度可达 {{summary}}',
                            })}
                        </div>
                    ) : null}
                    {!compactRegionTip && sharedPrintedRuntimeOptions.length > 1 ? (
                        <div
                            className="pointer-events-auto mt-2 flex flex-wrap items-center gap-2"
                            data-testid="qidahen-shared-printed-runtime-switcher"
                        >
                            <span className="text-[10px]" style={{ color: UI_STYLE.mapGold }}>
                                {t('board.map.sharedPrintedRegion', { defaultValue: '同图块' })}
                            </span>
                            {sharedPrintedRuntimeOptions.map((region) => {
                                const selectedOption = selectedRuntimeRegionIds.has(region.id);
                                return (
                                    <button
                                        key={region.id}
                                        type="button"
                                        data-testid={`qidahen-shared-printed-runtime-option-${region.id}`}
                                        className="inline-flex h-[28px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={() => onSelectRegion(region.id)}
                                        style={{
                                            borderColor: selectedOption ? UI_STYLE.mapGold : 'rgba(243, 209, 165, 0.42)',
                                            background: selectedOption ? 'rgba(243, 209, 165, 0.16)' : 'rgba(19, 13, 9, 0.42)',
                                            color: selectedOption ? '#fff6dc' : '#f3d1a5',
                                            borderRadius: 3,
                                        }}
                                    >
                                        {region.name}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

const DeckStack: React.FC<{
    src?: string;
    previewRef?: CardPreviewRef;
    label: string;
    count: number;
    className?: string;
    locale?: string;
    tone?: 'ink' | 'red';
    testId?: string;
    width?: number;
    height?: number;
    rawWidth?: number;
    rawHeight?: number;
}> = ({
    src,
    previewRef,
    label,
    count,
    className = '',
    locale,
    tone = 'ink',
    testId,
    width = CARD_DIMENSIONS.deck.width,
    height = CARD_DIMENSIONS.deck.height,
    rawWidth = CARD_DIMENSIONS.deck.rawWidth,
    rawHeight = CARD_DIMENSIONS.deck.rawHeight,
}) => {
    const border = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.bronze;
    const text = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.ink;

    return (
        <div className={`relative shrink-0 ${className}`} data-testid={testId} aria-label={`${label} ${count}`} style={{ width, height }}>
            <div className="absolute left-[9px] top-[8px] h-full w-full" style={{ background: 'rgba(32,21,13,0.58)', borderRadius: 7 }} />
            <div className="absolute left-[5px] top-[4px] h-full w-full" style={{ background: 'rgba(87,61,34,0.62)', borderRadius: 7 }} />
            <div className="relative h-full w-full overflow-hidden" style={{ background: UI_SURFACE.mapPanel, boxShadow: '0 8px 16px rgba(22,14,8,0.28)', borderRadius: 7 }}>
                {previewRef ? (
                    <CardPreviewFit previewRef={previewRef} locale={locale} title={label} width={width} height={height} rawWidth={rawWidth} rawHeight={rawHeight} />
                ) : src ? (
                    <OptimizedImage src={src} alt={label} className="h-full w-full object-cover" draggable={false} placeholder={false} />
                ) : null}
                <div
                    className="pointer-events-none absolute left-2 top-2 border-2 px-2 py-0.5 text-[12px] font-black tracking-[0.08em]"
                    style={{ color: tone === 'red' ? '#f4d0a0' : UI_STYLE.mapIvory, borderColor: UI_STYLE.mapInk, background: tone === 'red' ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel, borderRadius: 2, boxShadow: UI_SURFACE.mapPanelInset }}
                >
                    {label}
                </div>
                <div className="pointer-events-none absolute bottom-2 right-2 grid h-[40px] w-[40px] place-items-center rounded-full border-2 text-[17px] font-black" style={{ borderColor: border, color: text, background: 'rgba(248,237,206,0.96)', boxShadow: `0 3px 8px ${UI_STYLE.shadowSoft}` }}>
                    {count}
                </div>
            </div>
        </div>
    );
};

const WheelPanel: React.FC<{
    selectedId: string;
    selectedMoveId: string;
    moveChoices: QidahenWheelMoveChoice[];
    moveSummary: string;
    disabled: boolean;
    emphasized?: boolean;
    canActivateMove?: (moveId: string, selected: boolean) => boolean;
    directExecuteOnClick?: boolean;
    onSelectMove: (moveId: string) => void;
    onExecuteMove: (moveId: string) => void;
}> = ({ selectedId, selectedMoveId, moveChoices, moveSummary, disabled, emphasized = false, canActivateMove, directExecuteOnClick = false, onSelectMove, onExecuteMove }) => {
    const { t } = useTranslation('game-qidahen');
    const [activeMoveId, setActiveMoveId] = React.useState(selectedMoveId);
    const selectedIndex = Math.max(0, WHEEL_SECTORS.findIndex((sector) => sector.id === selectedId));
    const selectedAngle = WHEEL_SECTORS[selectedIndex]?.angle ?? -90;
    const activeMove = moveChoices.find((choice) => choice.id === activeMoveId)
        ?? moveChoices.find((choice) => choice.id === selectedMoveId)
        ?? moveChoices[0];
    const activeSummary = activeMove ? `${activeMove.label}：${activeMove.drawText}` : moveSummary;
    const activeMoveTargetIndex = activeMove ? (selectedIndex + activeMove.steps) % WHEEL_SECTORS.length : selectedIndex;
    const moveTargetIndices = new Set(
        moveChoices.map((choice) => (selectedIndex + choice.steps) % WHEEL_SECTORS.length),
    );

    React.useEffect(() => {
        setActiveMoveId(selectedMoveId);
    }, [selectedMoveId]);

    const getMoveTargetAngle = (steps: number) => {
        const targetIndex = (selectedIndex + steps) % WHEEL_SECTORS.length;
        return WHEEL_SECTORS[targetIndex]?.angle ?? selectedAngle;
    };

    const selectedMove = moveChoices.find((choice) => choice.id === selectedMoveId);
    const showCommittedMoveSelection = !directExecuteOnClick && selectedMove != null;
    const selectedMoveTargetIndex = showCommittedMoveSelection && selectedMove
        ? (selectedIndex + selectedMove.steps) % WHEEL_SECTORS.length
        : selectedIndex;
    const sectorRenderOrder = WHEEL_SECTORS
        .map((sector, index) => ({ sector, index }))
        .sort((a, b) => {
            if (a.index === selectedMoveTargetIndex) return 1;
            if (b.index === selectedMoveTargetIndex) return -1;
            return a.index - b.index;
        });

    return (
        <div
            className="pointer-events-auto group absolute left-[136px] top-[-16px] z-30 h-[438px] w-[438px]"
            data-testid="qidahen-action-wheel"
            data-tutorial-id="qidahen-action-wheel"
            data-ui-anchor="left-top"
        >
            <div
                className="relative h-full w-full"
                role="img"
                aria-label={t('board.wheel.aria', { defaultValue: '七大恨行动轮盘' })}
                data-testid="qidahen-action-wheel-asset"
            >
                <svg
                    viewBox={`0 0 ${WHEEL_VIEW} ${WHEEL_VIEW}`}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                >
                    <defs>
                        <filter id="qidahen-wheel-current" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1.4" stdDeviation="0.9" floodColor="rgba(72,54,31,0.18)" />
                        </filter>
                        <filter id="qidahen-wheel-selected" x="-24%" y="-24%" width="148%" height="148%">
                            <feDropShadow dx="0" dy="0" stdDeviation="3.8" floodColor="rgba(255,218,126,0.42)" />
                            <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="rgba(127,29,22,0.3)" />
                        </filter>
                        <filter id="qidahen-wheel-grain" x="-10%" y="-10%" width="120%" height="120%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed="21" />
                            <feColorMatrix type="saturate" values="0" />
                            <feComponentTransfer>
                                <feFuncA type="table" tableValues="0 0.14" />
                            </feComponentTransfer>
                        </filter>
                        <radialGradient id="qidahen-wheel-paper" cx="47%" cy="42%" r="58%">
                            <stop offset="0%" stopColor="#a28c58" />
                            <stop offset="62%" stopColor="#7d755d" />
                            <stop offset="100%" stopColor="#5b5442" />
                        </radialGradient>
                        <radialGradient id="qidahen-wheel-center-paper" cx="47%" cy="38%" r="62%">
                            <stop offset="0%" stopColor="#af9052" />
                            <stop offset="100%" stopColor="#99793f" />
                        </radialGradient>
                        <clipPath id="qidahen-wheel-face-clip">
                            <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS - 7} />
                        </clipPath>
                    </defs>
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_OUTER_RADIUS - 4} fill="url(#qidahen-wheel-paper)" stroke="#1f160f" strokeWidth="6" />
                    <circle
                        cx={WHEEL_CENTER}
                        cy={WHEEL_CENTER}
                        r={WHEEL_OUTER_RADIUS - 8}
                        clipPath="url(#qidahen-wheel-face-clip)"
                        filter="url(#qidahen-wheel-grain)"
                        opacity="0.82"
                        style={{ mixBlendMode: 'multiply' }}
                    />
                    {sectorRenderOrder.map(({ sector, index }) => {
                        const current = index === selectedIndex;
                        const candidateTarget = moveTargetIndices.has(index);
                        const selectedTarget = showCommittedMoveSelection ? index === selectedMoveTargetIndex : false;
                        const activeTarget = index === activeMoveTargetIndex;
                        const labelPoint = polarToPoint(WHEEL_CENTER, WHEEL_LABEL_RADIUS, sector.angle);
                        return (
                            <g
                                key={sector.id}
                                data-testid="qidahen-wheel-sector"
                                data-wheel-sector-id={sector.id}
                                data-wheel-candidate={candidateTarget ? 'true' : undefined}
                                data-wheel-selected={selectedTarget ? 'true' : undefined}
                                filter={selectedTarget ? 'url(#qidahen-wheel-selected)' : current ? 'url(#qidahen-wheel-current)' : undefined}
                            >
                                <path
                                    d={describeAnnularSlice(WHEEL_CENTER, WHEEL_INNER_RADIUS, WHEEL_OUTER_RADIUS - 16, sector.angle - 22.5, sector.angle + 22.5)}
                                    fill={selectedTarget
                                        ? 'rgba(168,41,31,0.72)'
                                        : candidateTarget && emphasized
                                            ? activeTarget
                                                ? 'rgba(78, 156, 83, 0.52)'
                                                : 'rgba(53, 124, 65, 0.42)'
                                            : current
                                                ? 'rgba(182,145,76,0.18)'
                                                : index % 2 === 0
                                                    ? 'rgba(54,52,43,0.18)'
                                                    : 'rgba(105,93,68,0.14)'}
                                    stroke={selectedTarget
                                        ? 'rgba(246,214,149,0.98)'
                                        : candidateTarget && emphasized
                                            ? activeTarget
                                                ? 'rgba(241, 255, 208, 0.98)'
                                                : 'rgba(140, 230, 153, 0.94)'
                                            : 'rgba(32,23,15,0.56)'}
                                    strokeWidth={selectedTarget ? 4 : candidateTarget && emphasized ? (activeTarget ? 4 : 3) : 0.9}
                                    strokeLinejoin="round"
                                />
                                <text
                                    x={labelPoint.x - 9}
                                    y={labelPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className={candidateTarget && emphasized ? 'fill-[#f5f2df]' : 'fill-[#241b14]'}
                                    style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: selectedTarget || activeTarget ? '13px' : '12px', fontWeight: candidateTarget && emphasized ? 900 : 650, writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.6px' }}
                                >
                                    {sector.label[0]}
                                </text>
                                <text
                                    x={labelPoint.x + 10}
                                    y={labelPoint.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className={candidateTarget && emphasized ? 'fill-[#f5f2df]' : 'fill-[#241b14]'}
                                    style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: selectedTarget || activeTarget ? '13px' : '12px', fontWeight: candidateTarget && emphasized ? 900 : 650, writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.6px' }}
                                >
                                    {sector.label[1]}
                                </text>
                            </g>
                        );
                    })}
                    <text
                        x={WHEEL_CENTER}
                        y="24"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '12px', fontWeight: 700 }}
                    >
                        {t('board.wheel.newYear', { defaultValue: '新年 >>>' })}
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_VIEW - 20}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '12px', fontWeight: 700 }}
                    >
                        {t('board.wheel.midyear', { defaultValue: '年中' })}
                    </text>
                    <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_INNER_RADIUS - 6} fill="url(#qidahen-wheel-center-paper)" stroke="#24190f" strokeWidth="2" />
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER - 32}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerTop', { defaultValue: '行' })}
                    </text>
                    <text
                        x={WHEEL_CENTER + 31}
                        y={WHEEL_CENTER}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerRight', { defaultValue: '轮' })}
                    </text>
                    <text
                        x={WHEEL_CENTER - 31}
                        y={WHEEL_CENTER}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerLeft', { defaultValue: '盘' })}
                    </text>
                    <text
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER + 34}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-[#241b14]"
                        style={{ fontFamily: 'KaiTi, STKaiti, Songti SC, serif', fontSize: '22px', fontWeight: 700 }}
                    >
                        {t('board.wheel.centerBottom', { defaultValue: '动' })}
                    </text>
                    <g data-testid="qidahen-wheel-move-layer">
                        {moveChoices.map((choice) => {
                            const targetAngle = getMoveTargetAngle(choice.steps);
                            const selected = choice.id === selectedMoveId;
                            const tutorialLocked = !canActivateMove?.(choice.id, selected);
                            const moveDisabled = disabled || tutorialLocked;
                            const activateMove = () => {
                                if (moveDisabled) {
                                    return;
                                }
                                if (directExecuteOnClick) {
                                    onExecuteMove(choice.id);
                                    return;
                                }
                                if (selected) {
                                    onExecuteMove(choice.id);
                                    return;
                                }
                                onSelectMove(choice.id);
                            };
                            return (
                                <path
                                    key={choice.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={choice.label}
                                    data-testid={`qidahen-wheel-move-target-${choice.id}`}
                                    data-tutorial-id={`qidahen-wheel-move-${choice.id}`}
                                    d={describeAnnularSlice(WHEEL_CENTER, WHEEL_INNER_RADIUS - 8, WHEEL_OUTER_RADIUS - 8, targetAngle - 23.5, targetAngle + 23.5)}
                                    fill="rgba(255,248,233,0.001)"
                                    stroke="transparent"
                                    strokeWidth="1"
                                    className={`outline-none transition-[fill,stroke] ${moveDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    aria-disabled={moveDisabled}
                                    onClick={activateMove}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            activateMove();
                                        }
                                    }}
                                    onFocus={() => setActiveMoveId(choice.id)}
                                    onMouseEnter={() => setActiveMoveId(choice.id)}
                                    onBlur={() => setActiveMoveId(selectedMoveId)}
                                    onMouseLeave={() => setActiveMoveId(selectedMoveId)}
                                />
                            );
                        })}
                    </g>
                </svg>
            </div>

            <div
                className="pointer-events-none absolute left-[372px] top-[360px] hidden w-[244px] border-[3px] px-3 py-2 text-[13px] font-black leading-5 tracking-[0.03em] group-hover:block group-focus-within:block"
                data-testid="qidahen-wheel-tip"
                role="tooltip"
                style={{
                    borderColor: UI_STYLE.mapInk,
                    background: UI_SURFACE.mapPanel,
                    color: UI_STYLE.mapIvory,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                    borderRadius: 3,
                }}
            >
                {activeSummary}
            </div>
        </div>
    );
};

const YearCardSlot: React.FC<{
    card: QidahenYearCardSlot;
    locale?: string;
    onMagnify?: (target: QidahenMagnifyTarget) => void;
}> = ({ card, locale, onMagnify }) => (
    <button
        type="button"
        className="relative overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30"
        data-testid={`qidahen-year-card-slot-${card.id}`}
        onClick={() => onMagnify?.({
            previewRef: card.previewRef,
            title: card.label,
            rawWidth: CARD_DIMENSIONS.year.rawWidth,
            rawHeight: CARD_DIMENSIONS.year.rawHeight,
        })}
        style={{
            width: CARD_DIMENSIONS.year.width,
            height: CARD_DIMENSIONS.year.height,
            background: 'transparent',
            boxShadow: '0 8px 16px rgba(56,35,15,0.18)',
            borderRadius: 7,
        }}
    >
        <CardPreviewFit
            previewRef={card.previewRef}
            locale={locale}
            title={card.label}
            width={CARD_DIMENSIONS.year.width}
            height={CARD_DIMENSIONS.year.height}
            rawWidth={CARD_DIMENSIONS.year.rawWidth}
            rawHeight={CARD_DIMENSIONS.year.rawHeight}
        />
    </button>
);

const ChronologyZone: React.FC<{
    cards: QidahenYearCardSlot[];
    locale?: string;
    onMagnify?: (target: QidahenMagnifyTarget) => void;
}> = ({ cards, locale, onMagnify }) => (
    <div className="pointer-events-auto absolute left-[80px] top-[542px] z-20" data-testid="qidahen-chronology-zone" data-ui-anchor="left-middle">
        <div className="flex items-end gap-3">
            {cards.slice(0, 2).map((card) => (
                <YearCardSlot key={card.id} card={card} locale={locale} onMagnify={onMagnify} />
            ))}
        </div>
    </div>
);

const KoreaZone: React.FC<{
    core: QidahenCore;
    locale?: string;
}> = ({ core, locale }) => {
    const { t } = useTranslation('game-qidahen');

    return (
        <div
            className="pointer-events-auto absolute right-[80px] top-[92px] z-20 flex gap-4"
            data-testid="qidahen-korea-zone"
            data-ui-anchor="right-top"
        >
            <DeckStack
                src={ASSETS.koreaCard}
                label={t('board.korea.drawPile', { defaultValue: '朝鲜牌库' })}
                count={core.koreaDeckCount}
                width={CARD_DIMENSIONS.koreaDeck.width}
                height={CARD_DIMENSIONS.koreaDeck.height}
                rawWidth={CARD_DIMENSIONS.koreaDeck.rawWidth}
                rawHeight={CARD_DIMENSIONS.koreaDeck.rawHeight}
                testId="qidahen-korea-draw-pile"
            />
            <DeckStack
                previewRef={core.koreaDiscardPreviewRef}
                locale={locale}
                label={t('board.korea.discardPile', { defaultValue: '朝鲜弃牌' })}
                count={core.koreaDiscardCount}
                tone="red"
                width={CARD_DIMENSIONS.koreaDeck.width}
                height={CARD_DIMENSIONS.koreaDeck.height}
                rawWidth={CARD_DIMENSIONS.koreaDeck.rawWidth}
                rawHeight={CARD_DIMENSIONS.koreaDeck.rawHeight}
                testId="qidahen-korea-discard-pile"
            />
        </div>
    );
};

const TopPromptBanner: React.FC<{
    title: string;
    badgeLabel: string;
    hint?: string | null;
    tone: 'wheel' | 'faction';
    testId: string;
}> = ({
    title,
    badgeLabel,
    hint,
    tone,
    testId,
}) => {
    const isWheel = tone === 'wheel';
    const width = MAP_SELECTION_BANNER_WIDTH;
    const left = (STAGE_WIDTH - width) / 2;

    return (
        <div
            className="pointer-events-none absolute z-50 border-[3px] px-4 py-3"
            data-testid={testId}
            style={{
                left,
                top: MAP_SELECTION_BANNER_TOP,
                width,
                borderColor: isWheel ? '#5fb772' : UI_STYLE.oldGold,
                background: isWheel ? 'rgba(20, 63, 34, 0.94)' : UI_SURFACE.mapPanelSelected,
                color: UI_STYLE.mapIvory,
                boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                borderRadius: 3,
            }}
        >
            <div
                className="inline-flex items-center border px-2 py-1 text-[10px] font-black tracking-[0.18em]"
                style={{
                    borderColor: isWheel ? '#a7e6b4' : '#f6d5a8',
                    color: isWheel ? '#e7ffd8' : '#f6d5a8',
                    background: isWheel ? 'rgba(76, 142, 88, 0.18)' : 'rgba(109,74,23,0.18)',
                }}
            >
                {badgeLabel}
            </div>
            <div
                className="mt-2 text-[18px] font-black leading-6 [text-shadow:0_1px_0_rgba(0,0,0,0.45)]"
                data-testid={testId === 'qidahen-wheel-next-step-banner' ? 'qidahen-wheel-next-step-title' : undefined}
            >
                {title}
            </div>
            {hint ? (
                <div
                    className="mt-1 text-[12px] font-black leading-5"
                    data-testid={testId === 'qidahen-wheel-next-step-banner' ? 'qidahen-wheel-next-step-hint' : undefined}
                    style={{ color: isWheel ? '#dbf5cf' : '#f3d1a5' }}
                >
                    {hint}
                </div>
            ) : null}
        </div>
    );
};

const ActionButton: React.FC<{
    action: QidahenActionChoice;
    focused: boolean;
    engaged?: boolean;
    disabled?: boolean;
    onClick: () => void;
}> = ({ action, focused, engaged = false, disabled = false, onClick }) => {
    const { t } = useTranslation('game-qidahen');
    const borderColor = engaged ? UI_STYLE.cinnabar : focused ? UI_STYLE.mapGold : UI_STYLE.mapInk;
    const background = engaged
        ? UI_SURFACE.mapPanelSelected
        : focused
            ? 'linear-gradient(180deg, rgba(102,74,30,0.92) 0%, rgba(41,29,18,0.9) 100%)'
            : UI_SURFACE.mapPanel;
    const accentColor = engaged ? UI_STYLE.cinnabar : 'rgba(210,183,117,0.76)';
    const glowShadow = focused && !engaged
        ? ', 0 0 0 2px rgba(232,200,133,0.18)'
        : '';

    return (
        <button
            type="button"
            data-testid={`qidahen-action-${action.id}`}
            data-tutorial-id={`qidahen-action-${action.id}`}
            title={action.detail}
            disabled={disabled}
            className="group relative inline-flex h-[52px] min-w-[146px] items-center justify-between gap-3 overflow-visible border-[3px] px-4 text-left text-[18px] font-black tracking-[0.04em] transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#9f3426]/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0"
            onClick={onClick}
            style={{
                borderColor,
                background,
                color: engaged ? '#f6d5a8' : UI_STYLE.mapIvory,
                boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}${glowShadow}`,
                borderRadius: 3,
            }}
        >
            <span className="pointer-events-none absolute inset-y-0 left-0 w-[8px]" style={{ background: accentColor }} />
            <span className="pointer-events-none absolute inset-x-[14px] top-[3px] h-[1px]" style={{ background: 'rgba(232,200,133,0.3)' }} />
            <span className="min-w-0 whitespace-nowrap [text-shadow:0_1px_0_rgba(0,0,0,0.6)]">{action.label}</span>
            <span
                className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 z-30 hidden w-[248px] -translate-y-1/2 border-[3px] px-3 py-2 text-[11px] font-black leading-5 tracking-normal text-[#f6e8c9] shadow-[0_8px_18px_rgba(0,0,0,0.28)] group-hover:block group-focus:block"
                data-testid={`qidahen-action-tooltip-${action.id}`}
                role="tooltip"
                style={{
                    borderColor: UI_STYLE.mapInk,
                    background: UI_SURFACE.mapPanel,
                    boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                    borderRadius: 3,
                    textShadow: 'none',
                    whiteSpace: 'normal',
                }}
            >
                <span className="flex items-center justify-between gap-3 text-[10px] tracking-[0.08em] text-[#d2b775]">
                    <span>{t('board.actions.tooltipHeader', { defaultValue: '功能说明' })}</span>
                    <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{
                            background: 'rgba(210,183,117,0.14)',
                            color: UI_STYLE.mapGold,
                            boxShadow: 'inset 0 0 0 1px rgba(232,200,133,0.2)',
                        }}
                    >
                        {t('board.actions.tooltipCost', {
                            cost: action.cost,
                            defaultValue: '花费 {{cost}}',
                        })}
                    </span>
                </span>
                <span className="mt-1 block text-[13px] text-[#f6d5a8]">{action.label}</span>
                <span className="mt-1 block">{action.detail}</span>
            </span>
        </button>
    );
};

const ActionsZone: React.FC<{
    core: QidahenCore;
    primaryStageMode: QidahenPrimaryStageMode | null;
    isTutorialActive: boolean;
    tutorialInfoStepActive: boolean;
    tutorialHighlightsSeasonSummary: boolean;
    actionPaymentPreviewVisible: boolean;
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    internalDispatchSelection: QidahenInternalDispatchSelection | null;
    recruitSelection: QidahenCore['recruitSelection'];
    maShiTradeSelection: QidahenCore['maShiTradeSelection'];
    khanEdictSelection: QidahenCore['khanEdictSelection'];
    diplomacySelection: QidahenDiplomacySelection | null;
    driveTigerConsentSelection: QidahenDriveTigerConsentSelection | null;
    fortificationMaintenanceSelection: QidahenFortificationMaintenanceSelection | null;
    wheelDispatchSelection: QidahenWheelDispatchSelection | null;
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    postBattleSelection: QidahenCore['postBattleSelection'];
    onExecuteAction: (actionId: string) => void;
    onSelectRegion: (regionId: string) => void;
    onResolveRecruitChoice: (choiceId: QidahenRecruitChoice['id']) => void;
    onResolveGaoDiDispatch: (choiceId: string) => void;
    onResolveMaShiTradeChoice: (troopCount: 1 | 2 | 3) => void;
    onResolveKhanEdictChoice: (choiceId: 'recruit-train' | 'hire-dispatch') => void;
    onResolveDiplomacyChoice: (choiceId: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker') => void;
    onResolveDriveTigerConsent: (choiceId: 'accept' | 'decline') => void;
    onResolveFortificationMaintenance: (choiceId: 'auto-pay' | 'skip-all', attritionPriority: QidahenCasualtyPriority) => void;
    upkeepAttritionPriority: QidahenCasualtyPriority;
    onSelectUpkeepAttritionPriority: (priority: QidahenCasualtyPriority) => void;
    pendingCommittedTroops?: number;
    onSelectPendingCommittedTroops: (committedTroops: number) => void;
    pendingAttackerCasualtyPriority: QidahenCasualtyPriority;
    pendingDefenderCasualtyPriority: QidahenCasualtyPriority;
    onSelectPendingAttackerCasualtyPriority: (priority: QidahenCasualtyPriority) => void;
    onSelectPendingDefenderCasualtyPriority: (priority: QidahenCasualtyPriority) => void;
    onResolvePendingAction: (choiceValue: QidahenPendingTargetChoiceValue, attackerCasualtyPriority?: QidahenCasualtyPriority, defenderCasualtyPriority?: QidahenCasualtyPriority, committedTroops?: number) => void;
    onResolvePostBattleDecision: (choiceId: string) => void;
    isTutorialCommandAllowed?: (commandType: string) => boolean;
    isTutorialTargetAllowed?: (targetId: string | null | undefined) => boolean;
}> = ({ core, primaryStageMode, isTutorialActive: _isTutorialActive, tutorialInfoStepActive, tutorialHighlightsSeasonSummary, actionPaymentPreviewVisible, handLimitDiscardSelection, internalDispatchSelection, recruitSelection, maShiTradeSelection, khanEdictSelection, diplomacySelection, driveTigerConsentSelection, fortificationMaintenanceSelection, wheelDispatchSelection, pendingTargetAction, postBattleSelection, onExecuteAction, onSelectRegion, onResolveRecruitChoice, onResolveGaoDiDispatch, onResolveMaShiTradeChoice, onResolveKhanEdictChoice, onResolveDiplomacyChoice, onResolveDriveTigerConsent, onResolveFortificationMaintenance, upkeepAttritionPriority, onSelectUpkeepAttritionPriority, pendingCommittedTroops, onSelectPendingCommittedTroops, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, onSelectPendingAttackerCasualtyPriority, onSelectPendingDefenderCasualtyPriority, onResolvePendingAction, onResolvePostBattleDecision, isTutorialCommandAllowed, isTutorialTargetAllowed }) => {
    const { t } = useTranslation('game-qidahen');
    const actionSlotRef = React.useRef<HTMLDivElement>(null);
    const pendingTargetChoiceOptions = pendingTargetAction ? buildPendingTargetChoiceOptions(core, pendingTargetAction) : [];
    const pendingScenarioChoices = core.scenarioVote != null
        || core.pendingScenarioCharacterChoices.length > 0
        || core.pendingScenarioArmamentChoices.length > 0;
    const selectedAction = getQidahenForegroundActionChoice(core, {
        actionPaymentPreviewVisible,
        recruitSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
    });
    const factionStageActiveSelection = core.gaoDiDispatchSelection != null
        || internalDispatchSelection != null
        || recruitSelection != null
        || maShiTradeSelection != null
        || khanEdictSelection != null
        || diplomacySelection != null
        || driveTigerConsentSelection != null
        || fortificationMaintenanceSelection != null
        || handLimitDiscardSelection != null;
    const wheelStageActiveSelection = wheelDispatchSelection != null
        || pendingTargetAction != null
        || postBattleSelection != null;
    const engagedActionId = core.confirmedActionId;
    const showWheelNextStepBanner = !pendingScenarioChoices
        && !tutorialInfoStepActive
        && primaryStageMode === 'wheel'
        && !core.wheelActionUsed
        && !factionStageActiveSelection
        && !wheelStageActiveSelection
        && core.wheelMoveChoices.length > 0;
    const suppressPassiveActionContext = showWheelNextStepBanner
        || factionStageActiveSelection
        || wheelStageActiveSelection
        || wheelDispatchSelection != null
        || pendingTargetAction != null
        || postBattleSelection != null;
    const showFortificationStrip = !suppressPassiveActionContext && core.turnPhase !== 'action-window';
    const showActionRail = !pendingScenarioChoices && !suppressPassiveActionContext && primaryStageMode === 'faction';
    const directHandActionIds = getQidahenDirectHandActionIdsForFaction(core, getCurrentFactionId(core));
    const visibleActionChoices = core.actionChoices.filter((action) => !directHandActionIds.has(action.id));
    const seasonSummaryLines = tutorialHighlightsSeasonSummary
        ? core.lastSeasonSummary?.lines ?? []
        : core.lastSeasonSummary?.lines.slice(0, 5) ?? [];
    const actionSurfaceKey = handLimitDiscardSelection ? 'hand-limit-discard'
        : internalDispatchSelection ? 'internal-dispatch'
            : recruitSelection ? 'recruit'
                : maShiTradeSelection ? 'ma-shi-trade'
                    : khanEdictSelection ? 'khan-edict'
                        : diplomacySelection ? 'diplomacy'
                            : driveTigerConsentSelection ? 'drive-tiger-consent'
                                : fortificationMaintenanceSelection ? 'fortification-maintenance'
                                    : wheelDispatchSelection ? 'wheel-dispatch'
                                        : pendingTargetAction ? `pending:${pendingTargetAction.actionId}`
                                            : postBattleSelection ? `post-battle:${postBattleSelection.actionId}`
                                                : primaryStageMode ? `primary-stage:${primaryStageMode}`
                                                    : selectedAction ? `action-rail:${selectedAction.id}` : 'action-rail:none';

    React.useEffect(() => {
        if (actionSlotRef.current) {
            actionSlotRef.current.scrollTop = 0;
        }
    }, [actionSurfaceKey]);

    return (
        <div
            className="pointer-events-auto absolute z-40 flex flex-col"
            data-testid="qidahen-actions-zone"
            data-tutorial-id="qidahen-actions-zone"
            data-ui-anchor="right-middle"
            style={{
                left: ACTIONS_DOCK_LEFT,
                top: ACTIONS_DOCK_TOP,
                width: ACTIONS_DOCK_WIDTH,
                height: ACTIONS_DOCK_HEIGHT,
            }}
        >
            <div
                className="mb-3 shrink-0 border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                data-testid="qidahen-turn-banner"
                data-tutorial-id="qidahen-turn-banner"
                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
            >
                <div>{formatQidahenVisibleTurnLabel(core.turnLabel)}</div>
                <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                    {t('board.actions.turnStatus', {
                        year: core.currentYear,
                        wheelStatus: core.wheelActionUsed
                            ? t('board.actions.status.used', { defaultValue: '已用' })
                            : t('board.actions.status.unused', { defaultValue: '未用' }),
                        factionStatus: core.factionActionUsed
                            ? t('board.actions.status.used', { defaultValue: '已用' })
                            : t('board.actions.status.unused', { defaultValue: '未用' }),
                        defaultValue: '{{year}} · 轮盘 {{wheelStatus}} · 手牌行动 {{factionStatus}}',
                    })}
                </div>
                {pendingScenarioChoices ? (
                    <div className="mt-1 text-[11px]" data-testid="qidahen-actions-blocked-by-scenario" style={{ color: '#f3d1a5' }}>
                        {core.scenarioVote
                            ? t('board.actions.scenarioVoteBlocked', {
                                defaultValue: '局内剧本投票尚未完成，当前只可处理剧本介绍与投票。',
                            })
                            : t('board.actions.scenarioBlocked', {
                                defaultValue: '剧本待决项尚未确认，当前只可处理剧本选择。',
                            })}
                    </div>
                ) : null}
            </div>
            <div ref={actionSlotRef} className="min-h-0 flex-1 overflow-y-auto pr-1" data-testid="qidahen-action-slot">
            {core.victoryStatus ? (
                <div
                    className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[12px] font-black leading-5"
                    data-testid="qidahen-victory-status"
                    style={{ borderColor: UI_STYLE.cinnabar, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{t('board.actions.victoryAchieved', {
                        winnerName: core.victoryStatus.winnerName,
                        condition: core.victoryStatus.condition === 'hegemony'
                            ? t('board.actions.victory.hegemony', { defaultValue: '霸权胜利' })
                            : core.victoryStatus.condition === 'military'
                                ? t('board.actions.victory.military', { defaultValue: '军事胜利' })
                                : t('board.actions.victory.prestige', { defaultValue: '威望胜利' }),
                        defaultValue: '{{winnerName}} 已达成{{condition}}',
                    })}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {core.victoryStatus.detail}
                    </div>
                </div>
            ) : null}
            {showFortificationStrip ? (
                <div
                    className="mb-3 flex flex-wrap items-center justify-end gap-2"
                    data-testid="qidahen-fortification-strip"
                >
                    {core.fortifications.map((fortification) => (
                        <div
                            key={fortification.id}
                            className="border-[2px] px-2 py-1 text-[11px] font-black leading-4"
                            title={fortification.ruleNote}
                            data-testid={`qidahen-fortification-${fortification.id}`}
                            style={{
                                borderColor: UI_STYLE.mapInk,
                                background: fortification.ruined ? UI_SURFACE.mapPanelSelected : UI_SURFACE.mapPanel,
                                color: fortification.ruined ? '#f6d5a8' : UI_STYLE.mapIvory,
                                boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                                borderRadius: 3,
                            }}
                        >
                            {t('board.actions.fortificationStatus', {
                                label: fortification.label,
                                status: fortification.ruined
                                    ? t('board.actions.fortification.ruined', { defaultValue: '破败' })
                                    : t('board.actions.fortification.intact', { defaultValue: '完整' }),
                                defaultValue: '{{label}} · {{status}}',
                            })}
                        </div>
                    ))}
                </div>
            ) : null}
            {!suppressPassiveActionContext && (!tutorialInfoStepActive || tutorialHighlightsSeasonSummary) && core.lastSeasonSummary ? (
                <div
                    className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[12px] font-black leading-5"
                    data-testid="qidahen-season-summary"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.lastSeasonSummary.title}</div>
                    <div className="mt-1 space-y-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {seasonSummaryLines.map((line) => (
                            <div key={line}>{line}</div>
                        ))}
                    </div>
                </div>
            ) : null}
            {fortificationMaintenanceSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-fortification-maintenance-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{fortificationMaintenanceSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {fortificationMaintenanceSelection.summary}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]" data-testid="qidahen-upkeep-attrition-priority">
                        <span className="mr-1" style={{ color: '#f3d1a5' }}>
                            {t('board.actions.attritionLabel', { defaultValue: '兵力耗损' })}
                        </span>
                        {[
                            {
                                id: 'lowest-level' as const,
                                label: t('board.actions.casualtyPriority.lowestFirst', { defaultValue: '低级先损' }),
                            },
                            {
                                id: 'highest-level' as const,
                                label: t('board.actions.casualtyPriority.highestFirst', { defaultValue: '高级先损' }),
                            },
                        ].map((option) => {
                            const selected = option.id === upkeepAttritionPriority;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    data-testid={`qidahen-upkeep-attrition-${option.id}`}
                                    className="inline-flex h-[28px] min-w-[54px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onSelectUpkeepAttritionPriority(option.id)}
                                    style={{
                                        borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                        background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                        color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                        boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {fortificationMaintenanceSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-fortification-maintenance-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveFortificationMaintenance(choice.id, upkeepAttritionPriority)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {core.gaoDiDispatchSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-gao-di-dispatch-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{core.gaoDiDispatchSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.gaoDi.summary', {
                            sourceRegionName: core.gaoDiDispatchSelection.sourceRegionName,
                            maxTroops: core.gaoDiDispatchSelection.maxTroops,
                            maxPopulation: core.gaoDiDispatchSelection.maxPopulation,
                            defaultValue: '选择调度目标 · 最多调 {{maxTroops}} 个部队或 {{maxPopulation}} 人口',
                        })}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {core.gaoDiDispatchSelection.summary}
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-gao-di-dispatch-skip"
                        className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                        onClick={() => onResolveGaoDiDispatch('skip')}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                    >
                        {t('board.actions.gaoDi.skip', { defaultValue: '跳过高第调度' })}
                    </button>
                </div>
            ) : null}
            {internalDispatchSelection ? (
                <div
                    className="mt-3 flex max-h-[calc(100vh-360px)] max-w-[420px] flex-col overflow-hidden border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-internal-dispatch-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{internalDispatchSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.internalDispatch.summary', {
                            sourceRegionName: internalDispatchSelection.sourceRegionName,
                            maxTroops: internalDispatchSelection.maxTroops,
                            defaultValue: '选择调度目标 · 最多调 {{maxTroops}} 个部队',
                        })}
                    </div>
                </div>
            ) : null}
            {recruitSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-recruit-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{t('board.actions.recruit.title', { defaultValue: '征召军队' })}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.recruit.summary', {
                            targetRegionName: recruitSelection.targetRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                            defaultValue: '选择建军方式',
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {recruitSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-recruit-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveRecruitChoice(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {maShiTradeSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-ma-shi-trade-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{t('board.actions.maShiTrade.title', { defaultValue: '马市贸易' })}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.maShiTrade.summary', {
                            targetRegionName: maShiTradeSelection.targetRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                            defaultValue: '选择建军数量',
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {maShiTradeSelection.choices.map((choice) => (
                            <button
                                key={choice.troopCount}
                                type="button"
                                data-testid={`qidahen-ma-shi-trade-choice-${choice.troopCount}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveMaShiTradeChoice(choice.troopCount)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {khanEdictSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-khan-edict-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{t('board.actions.khanEdict.title', { defaultValue: '大汗令箭' })}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.khanEdict.summary', {
                            sourceRegionName: khanEdictSelection.sourceRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                            defaultValue: '选择执行效果',
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {khanEdictSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-khan-edict-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveKhanEdictChoice(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {diplomacySelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-diplomacy-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{diplomacySelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.diplomacy.sourceSummary', {
                            sourceRegionName: diplomacySelection.sourceRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                            hireRegionName: diplomacySelection.hireRegionName ?? t('board.actions.diplomacy.currentControlRegion', { defaultValue: '当前控制区' }),
                            defaultValue: '处理外交与雇佣',
                        })}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.diplomacy.resolvedSummary', {
                            resolved: diplomacySelection.resolvedSteps.length,
                            total: diplomacySelection.maxTargetCount,
                            remaining: diplomacySelection.remainingTargetCount,
                            defaultValue: '已执行 {{resolved}}/{{total}} 次外交 · 还可继续 {{remaining}} 次',
                        })}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.diplomacy.targetSummary', {
                            targetHint: diplomacySelection.targetHint,
                            defaultValue: '当前目标步骤 · {{targetHint}}',
                        })}
                    </div>
                    {diplomacySelection.resolvedSteps.length > 0 ? (
                        <div
                            className="mt-2 border-[2px] px-2 py-2 text-[11px] leading-4"
                            data-testid="qidahen-diplomacy-history"
                            style={{ borderColor: 'rgba(232,200,133,0.26)', background: 'rgba(17,11,7,0.22)', borderRadius: 3 }}
                        >
                            {diplomacySelection.resolvedSteps.map((step) => (
                                <div key={`${step.index}-${step.targetRegionId}`} className="mt-1 first:mt-0">
                                    {t('board.actions.diplomacy.stepSummary', {
                                        index: step.index,
                                        summary: step.summary,
                                        defaultValue: '外交 {{index}} · {{summary}}',
                                    })}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {diplomacySelection.candidateTargetRegionIds.map((regionId) => {
                            const region = core.regions.find((item) => item.id === regionId && !item.isLogicalRegion);
                            if (!region) return null;
                            return (
                                <button
                                    key={regionId}
                                    type="button"
                                    data-testid={`qidahen-diplomacy-target-${regionId}`}
                                    className="border-[2px] px-2 py-1 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onSelectRegion(regionId)}
                                    style={{
                                        borderColor: UI_STYLE.mapInk,
                                        background: diplomacySelection.targetRegionId === regionId ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                        color: diplomacySelection.targetRegionId === regionId ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                        boxShadow: UI_SURFACE.hardShadow,
                                        borderRadius: 3,
                                    }}
                                >
                                    {region.name}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {diplomacySelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-diplomacy-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveDiplomacyChoice(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {driveTigerConsentSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-drive-tiger-consent-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{t('board.actions.driveTiger.title', { defaultValue: '驱虎吞狼' })}</div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {t('board.actions.driveTiger.summary', {
                            targetFactionName: driveTigerConsentSelection.targetFactionName,
                            defaultValue: '先问 {{targetFactionName}} 愿不愿听大明指挥；同意后抽 6 张牌，再由其出兵进攻。',
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {driveTigerConsentSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-drive-tiger-consent-choice-${choice.id}`}
                                className="border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolveDriveTigerConsent(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="block">
                                    {choice.label}
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {wheelDispatchSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-wheel-dispatch-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{wheelDispatchSelection.restriction}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.wheelDispatch.summary', {
                            sourceRegionName: wheelDispatchSelection.sourceRegionName,
                            count: wheelDispatchSelection.candidates.length,
                            defaultValue: '选择进攻目标 · 可攻 {{count}} 处',
                        })}
                    </div>
                    <div className="mt-2 max-h-[236px] overflow-y-auto pr-1">
                        <div className="flex flex-col gap-2">
                        {wheelDispatchSelection.candidates.map((candidate) => (
                            <div
                                key={candidate.targetRuntimeRegionId}
                                data-testid={`qidahen-wheel-dispatch-target-${candidate.targetRuntimeRegionId}`}
                                className="inline-flex min-h-[50px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black"
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">
                                        {t('board.actions.wheelDispatch.targetSummary', {
                                            targetRegionName: candidate.targetRegionName,
                                            defenderLabel: candidate.defenderLabel,
                                            defaultValue: '{{targetRegionName}} · {{defenderLabel}}',
                                        })}
                                    </span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.cinnabar }}>
                                        {t('board.actions.wheelDispatch.stats', {
                                            sourceAvailableTroops: candidate.sourceAvailableTroops,
                                            committedTroops: candidate.committedTroops,
                                            attackPressure: candidate.attackPressure,
                                            defaultValue: '本次出兵 {{committedTroops}}',
                                        })}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[11px]" style={{ color: '#2f7a40' }}>
                                    {t('board.actions.wheelDispatch.travelCost', {
                                        totalTravelCost: candidate.totalTravelCost,
                                        defaultValue: '耗 {{totalTravelCost}}',
                                    })}
                                </span>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>
            ) : null}
            {pendingTargetAction ? (
                <div
                    className="mt-3 border-[3px] px-3 py-2 text-[14px] font-black leading-6"
                    data-testid="qidahen-raid-intent"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>
                        {getQidahenFriendlyPendingTargetTitle(pendingTargetAction)}
                        <span className="sr-only">
                            {t('board.actions.pendingTarget.header', {
                                title: pendingTargetAction.title,
                                targetRegionName: pendingTargetAction.targetRegionName,
                                defenderLabel: pendingTargetAction.defenderLabel,
                                defaultValue: '{{title}} · {{targetRegionName}} · 守方 {{defenderLabel}}',
                            })}
                        </span>
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {pendingTargetAction.resolutionHint}
                        {pendingTargetAction.defenderPayCost != null
                            ? t('board.actions.pendingTarget.defenderPayCost', {
                                cost: pendingTargetAction.defenderPayCost,
                                defaultValue: ' · 守方需付 {{cost}}',
                            })
                            : ''}
                    </div>
                    {pendingTargetAction.actionId === 'raid' || pendingTargetAction.actionId === 'wheel-dispatch' || pendingTargetAction.actionId === 'drive-tiger' ? (
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.actions.pendingTarget.stats', {
                                sourceAvailableTroops: pendingTargetAction.sourceAvailableTroops,
                                committedTroops: pendingTargetAction.committedTroops,
                                attackPressure: pendingTargetAction.attackPressure,
                                defaultValue: '本次出兵 {{committedTroops}}',
                            })}
                            {pendingTargetAction.boundaryUnitCap
                                ? t('board.actions.pendingTarget.boundaryUnitCap', {
                                    count: pendingTargetAction.boundaryUnitCap,
                                    defaultValue: ' · 边界上限 {{count}}',
                                })
                                : ''}
                        </div>
                    ) : null}
                    {getPendingCommittedTroopOptions(pendingTargetAction).length > 1 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]" data-testid="qidahen-pending-committed-troops">
                            <span className="mr-1" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.pendingTarget.actualCommittedTroops', { defaultValue: '实际投入' })}
                            </span>
                            {getPendingCommittedTroopOptions(pendingTargetAction).map((committedTroops) => {
                                const selected = committedTroops === (pendingCommittedTroops ?? pendingTargetAction.committedTroops);
                                return (
                                    <button
                                        key={committedTroops}
                                        type="button"
                                        data-testid={`qidahen-pending-committed-${committedTroops}`}
                                        className="inline-flex h-[28px] min-w-[34px] items-center justify-center border-[2px] px-2 text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onSelectPendingCommittedTroops(committedTroops)}
                                        style={{
                                            borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                            background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                            color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                            boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                            borderRadius: 3,
                                        }}
                                    >
                                        {committedTroops}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                    {hasStructuredCasualtyChoice(core, pendingTargetAction) ? (
                        <div className="mt-2 space-y-1.5 text-[11px]" data-testid="qidahen-pending-casualty-priority">
                            {[
                                {
                                    id: 'attacker' as const,
                                    label: t('board.actions.pendingTarget.attackerCasualtyLabel', { defaultValue: '攻方承伤' }),
                                    selected: pendingAttackerCasualtyPriority,
                                    onSelect: onSelectPendingAttackerCasualtyPriority,
                                },
                                {
                                    id: 'defender' as const,
                                    label: t('board.actions.pendingTarget.defenderCasualtyLabel', { defaultValue: '守方承伤' }),
                                    selected: pendingDefenderCasualtyPriority,
                                    onSelect: onSelectPendingDefenderCasualtyPriority,
                                },
                            ].map((group) => (
                                <div key={group.id} className="flex flex-wrap items-center gap-1.5" data-testid={`qidahen-${group.id}-casualty-priority`}>
                                    <span className="mr-1" style={{ color: '#f3d1a5' }}>{group.label}</span>
                                    {[
                                        { id: 'highest-level' as const, label: t('board.actions.casualtyPriority.highestFirst', { defaultValue: '高级先损' }) },
                                        { id: 'lowest-level' as const, label: t('board.actions.casualtyPriority.lowestFirst', { defaultValue: '低级先损' }) },
                                    ].map((option) => {
                                        const selected = option.id === group.selected;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                data-testid={`qidahen-${group.id}-casualty-${option.id}`}
                                                className="inline-flex h-[28px] min-w-[54px] items-center justify-center border-[2px] px-2 text-[11px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                                onClick={() => group.onSelect(option.id)}
                                                style={{
                                                    borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                                    background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                                    color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                                    boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                                    borderRadius: 3,
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {pendingTargetChoiceOptions.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={getPendingTargetChoiceTestId(choice.id)}
                                className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolvePendingAction(choice.value, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, pendingCommittedTroops)}
                                style={{ minWidth: getPendingTargetChoiceMinWidth(choice.id), borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                {getQidahenFriendlyPendingChoiceLabel(choice)}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {postBattleSelection ? (
                <div
                    className="mt-3 border-[3px] px-3 py-2 text-[14px] font-black leading-6"
                    data-testid="qidahen-post-battle-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>
                        {getQidahenFriendlyPostBattleTitle(postBattleSelection)} · {postBattleSelection.targetRegionName}
                        <span className="sr-only">{postBattleSelection.title}</span>
                    </div>
                    {postBattleSelection.battleRollSummary ? (
                        <div className="mt-1 text-[11px]" style={{ color: '#ffe5b3' }} data-testid="qidahen-post-battle-roll-summary">
                            {normalizeQidahenBattleRollSummary(postBattleSelection.battleRollSummary)}
                        </div>
                    ) : null}
                    {postBattleSelection.battleRolls ? (
                        <QidahenBattleRollDiceSummary battleRolls={postBattleSelection.battleRolls} />
                    ) : null}
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {t('board.actions.postBattle.summary', {
                            summary: postBattleSelection.summary,
                            survivingTroops: postBattleSelection.survivingTroops,
                            defaultValue: '{{summary}} · 幸存 {{survivingTroops}}',
                        })}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        {postBattleSelection.choices.map((choice) => (
                            <button
                                key={choice.id}
                                type="button"
                                data-testid={`qidahen-post-battle-choice-${choice.id}`}
                                className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={() => onResolvePostBattleDecision(choice.id)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                <span className="min-w-0">
                                    <span className="block text-[13px]">{choice.label}</span>
                                    <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                        {choice.detail}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            </div>
            {showActionRail ? (
                <div className="mt-3 shrink-0">
                    <div className="flex flex-col items-end gap-2" data-testid="qidahen-action-rail">
                        {visibleActionChoices.map((action) => (
                            <ActionButton
                                key={action.id}
                                action={action}
                                focused={core.selectedActionId === action.id}
                                engaged={engagedActionId === action.id}
                                disabled={
                                    pendingScenarioChoices
                                    || core.factionActionUsed
                                    || !(isTutorialTargetAllowed?.(action.id) ?? true)
                                    || !(isTutorialCommandAllowed?.(action.cost > 0 ? QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION : QIDAHEN_COMMANDS.EXECUTE_ACTION) ?? true)
                                }
                                onClick={() => onExecuteAction(action.id)}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const HandCard: React.FC<{
    card: QidahenHandCard;
    locale?: string;
    selected?: boolean;
    stackIndex: number;
    totalCards: number;
    onClick?: () => void;
}> = ({ card, locale, selected = false, stackIndex, totalCards, onClick }) => {
    const disabled = card.status === 'disabled';
    const overlapPx = getQidahenHandCardOverlapPx(totalCards);
    const cardKindBadge = card.cardKind && card.cardKind !== 'unknown'
        ? ({
            event: '事件',
            armament: '军备',
            tactic: '战术',
            silver: '银两',
        } satisfies Record<'event' | 'armament' | 'tactic' | 'silver', string>)[card.cardKind]
        : null;

    return (
        <div
            className="relative shrink-0"
            style={{
                width: CARD_DIMENSIONS.hand.width,
                height: CARD_DIMENSIONS.hand.height,
                zIndex: selected ? totalCards + 12 : stackIndex + 1,
                marginLeft: stackIndex === 0 ? 0 : overlapPx,
            }}
        >
            <button
                type="button"
                aria-label={card.label}
                disabled={disabled}
                data-testid={`qidahen-hand-card-${card.id}`}
                data-tutorial-id={getQidahenHandCardTutorialTargetId(card)}
                tabIndex={disabled ? -1 : 0}
                className={`relative h-full w-full overflow-hidden transition-[transform,box-shadow,filter] duration-150 hover:z-50 hover:brightness-[1.03] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30 disabled:cursor-not-allowed disabled:opacity-55 ${selected ? '-translate-y-[26px]' : 'hover:-translate-y-[18px]'}`}
                onClick={onClick}
                style={{
                    background: 'transparent',
                    boxShadow: selected ? '0 0 0 4px #f0d386, 0 18px 28px rgba(56,35,15,0.38)' : '0 8px 16px rgba(56,35,15,0.18)',
                    borderRadius: 7,
                }}
            >
                <CardPreviewFit
                    previewRef={card.previewRef}
                    locale={locale}
                    title={card.label}
                    width={CARD_DIMENSIONS.hand.width}
                    height={CARD_DIMENSIONS.hand.height}
                    rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                    rawHeight={CARD_DIMENSIONS.hand.rawHeight}
                />
                {cardKindBadge ? (
                    <span
                        className="pointer-events-none absolute left-2 top-2 rounded border-[2px] px-2 py-0.5 text-[11px] font-black"
                        data-testid={`qidahen-hand-card-kind-${card.id}`}
                        style={{
                            borderColor: '#4d3620',
                            background: 'rgba(245, 231, 206, 0.92)',
                            color: '#402a18',
                            boxShadow: '0 3px 8px rgba(56,35,15,0.18)',
                        }}
                    >
                        {cardKindBadge}
                    </span>
                ) : null}
            </button>
        </div>
    );
};

const HandZone: React.FC<{
    core: QidahenCore;
    viewerFactionId: QidahenFactionId | null;
    playerID: string | null;
    locale?: string;
    actionPaymentPreviewVisible: boolean;
    selectedPaymentCardIds: string[];
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    selectedHandLimitCardIds: string[];
    onTogglePaymentCard: (cardId: string) => void;
    onToggleHandLimitDiscardCard: (cardId: string) => void;
    onSelectSunYuanhuaTechCard: (cardId: string) => void;
    onSelectGaoDiDispatchCard: (cardId: string) => void;
    onPreviewActionFromHandCard: (card: QidahenHandCard) => void;
    onMagnifyCard?: (target: QidahenMagnifyTarget) => void;
    isTutorialTargetAllowed?: (targetId: string | null | undefined) => boolean;
}> = ({
    core,
    viewerFactionId,
    playerID,
    locale,
    actionPaymentPreviewVisible,
    selectedPaymentCardIds,
    handLimitDiscardSelection,
    selectedHandLimitCardIds,
    onTogglePaymentCard,
    onToggleHandLimitDiscardCard,
    onSelectSunYuanhuaTechCard,
    onSelectGaoDiDispatchCard,
    onPreviewActionFromHandCard,
    onMagnifyCard,
    isTutorialTargetAllowed,
}) => {
    const currentFactionId = playerID == null ? (viewerFactionId ?? getCurrentFactionId(core)) : viewerFactionId;
    if (!currentFactionId) {
        return null;
    }
    const currentFaction = core.factions[currentFactionId];
    const currentHandCards = core.handCards.filter((card) => card.faction === currentFactionId);

    return (
        <div
            className="pointer-events-auto absolute inset-x-0 bottom-0 z-30"
            data-testid="qidahen-bottom-dock"
            style={{ height: BOTTOM_DOCK_HEIGHT }}
        >
            <div className="absolute left-[44px]" data-testid="qidahen-draw-anchor" style={{ bottom: BOTTOM_DOCK_INSET }}>
                <DeckStack
                    src={CARD_BACK_BY_FACTION[currentFactionId]}
                    label={`${currentFaction.name}抽牌`}
                    count={currentFaction.drawPileCount}
                    testId="qidahen-draw-pile"
                />
            </div>
            <div
                className="absolute left-1/2 flex items-end justify-center overflow-x-auto overflow-y-visible"
                data-testid="qidahen-hand-zone"
                data-tutorial-id="qidahen-hand-zone"
                data-ui-role="qidahen-hand-dock"
                style={{
                    bottom: BOTTOM_DOCK_INSET,
                    transform: 'translateX(-50%)',
                    height: BOTTOM_DOCK_HEIGHT,
                    width: 1310,
                    maxWidth: 'calc(100vw - 320px)',
                }}
            >
                <div className="mx-auto flex min-w-max items-end justify-center px-2" data-testid="qidahen-hand-row">
                    {currentHandCards.map((card, index) => {
                        const selectableForHandLimit = handLimitDiscardSelection?.candidateCardIds.includes(card.id) ?? false;
                        const sunYuanhuaSelection = core.sunYuanhuaTechSelection;
                        const selectableForSunYuanhua = sunYuanhuaSelection?.candidateCardIds.includes(card.id) ?? false;
                        const gaoDiSelection = core.gaoDiDispatchSelection;
                        const selectableForGaoDi = gaoDiSelection?.candidateCardIds.includes(card.id) ?? false;
                        const tutorialTargetId = getQidahenHandCardTutorialTargetId(card);
                        const tutorialAllowed = (isTutorialTargetAllowed?.(tutorialTargetId) ?? true)
                            || (tutorialTargetId !== card.id && (isTutorialTargetAllowed?.(card.id) ?? false));
                        const selectableForActionPayment = actionPaymentPreviewVisible && card.status !== 'disabled' && tutorialAllowed;
                        const selectableForDirectHandAction = !actionPaymentPreviewVisible
                            && !selectableForHandLimit
                            && !selectableForSunYuanhua
                            && !selectableForGaoDi
                            && getQidahenDirectActionIdForHandCard(card) != null
                            && tutorialAllowed;
                        return (
                            <HandCard
                                key={card.id}
                                card={card}
                                locale={locale}
                                selected={selectedPaymentCardIds.includes(card.id) || selectedHandLimitCardIds.includes(card.id) || (sunYuanhuaSelection?.selectedCardIds.includes(card.id) ?? false) || (gaoDiSelection?.selectedCardId === card.id)}
                                stackIndex={index}
                                totalCards={currentHandCards.length}
                                onClick={selectableForHandLimit
                                    ? () => onToggleHandLimitDiscardCard(card.id)
                                    : selectableForSunYuanhua
                                        ? () => onSelectSunYuanhuaTechCard(card.id)
                                    : selectableForGaoDi
                                        ? () => onSelectGaoDiDispatchCard(card.id)
                                    : selectableForDirectHandAction
                                        ? () => onPreviewActionFromHandCard(card)
                                    : selectableForActionPayment
                                        ? () => onTogglePaymentCard(card.id)
                                        : undefined}
                            />
                        );
                    })}
                </div>
            </div>
            <div
                className="pointer-events-none absolute left-1/2 flex items-end justify-center overflow-visible"
                style={{
                    bottom: BOTTOM_DOCK_INSET,
                    transform: 'translateX(-50%)',
                    height: BOTTOM_DOCK_HEIGHT,
                    width: 1310,
                    maxWidth: 'calc(100vw - 320px)',
                }}
            >
                <div className="mx-auto flex min-w-max items-end justify-center px-2">
                    {currentHandCards.map((card, index) => (
                        <div
                            key={`magnify-${card.id}`}
                            className="pointer-events-none relative shrink-0"
                            style={{
                                width: CARD_DIMENSIONS.hand.width,
                                height: CARD_DIMENSIONS.hand.height,
                                zIndex: currentHandCards.length + index + 24,
                                marginLeft: index === 0 ? 0 : getQidahenHandCardOverlapPx(currentHandCards.length),
                            }}
                        >
                            <button
                                type="button"
                                data-testid={`qidahen-hand-card-magnify-${card.id}`}
                                aria-label={t('board.magnifyCardAria', { card: card.label })}
                                className="pointer-events-auto absolute right-2 top-2 inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full border-[2px] text-[11px] font-black transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onMagnifyCard?.({
                                        previewRef: card.previewRef,
                                        title: card.label,
                                        rawWidth: CARD_DIMENSIONS.hand.rawWidth,
                                        rawHeight: CARD_DIMENSIONS.hand.rawHeight,
                                    });
                                }}
                                style={{
                                    borderColor: '#4d3620',
                                    background: 'rgba(245, 231, 206, 0.92)',
                                    color: '#402a18',
                                    boxShadow: '0 3px 8px rgba(56,35,15,0.18)',
                                }}
                            >
                                {t('board.magnifyButton')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="absolute right-[44px]" data-testid="qidahen-discard-anchor" style={{ bottom: BOTTOM_DOCK_INSET }}>
                <DeckStack
                    src={ASSETS.coverCard}
                    label={`${currentFaction.name}弃牌`}
                    count={currentFaction.discardPileCount}
                    tone="red"
                    testId="qidahen-discard-pile"
                />
            </div>
        </div>
    );
};

const QidahenInMatchSetupOverlay: React.FC<{
    core: QidahenCore;
    viewerFactionId: QidahenFactionId | null;
    playerID: string | null;
    onResolveScenarioCharacterChoice: (groupId: string, characterIds: string[]) => void;
    onResolveScenarioArmamentChoice: (groupId: string, armamentIds: QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds']) => void;
}> = ({
    core,
    viewerFactionId,
    playerID,
    onResolveScenarioCharacterChoice,
    onResolveScenarioArmamentChoice,
}) => {
    const { t } = useTranslation('game-qidahen');
    const pendingCharacterChoices = core.pendingScenarioCharacterChoices;
    const pendingArmamentChoices = core.pendingScenarioArmamentChoices;
    const isViewerScoped = playerID != null && viewerFactionId != null;
    const interactiveCharacterChoices = pendingCharacterChoices.filter((group) => !isViewerScoped || group.factionId === viewerFactionId);
    const waitingCharacterChoices = pendingCharacterChoices.filter((group) => isViewerScoped && group.factionId !== viewerFactionId);
    const interactiveArmamentChoices = pendingArmamentChoices.filter((group) => !isViewerScoped || group.factionId === viewerFactionId);
    const waitingArmamentChoices = pendingArmamentChoices.filter((group) => isViewerScoped && group.factionId !== viewerFactionId);
    const [selectedCharacterIdsByGroup, setSelectedCharacterIdsByGroup] = React.useState<Record<string, string[]>>({});
    const [selectedArmamentIdsByGroup, setSelectedArmamentIdsByGroup] = React.useState<Record<string, string[]>>({});
    const waitingSummaryLines = React.useMemo(() => {
        const waitingSummaries = new Map<string, {
            factionName: string;
            characterGroupCount: number;
            armamentGroupCount: number;
        }>();

        for (const group of waitingCharacterChoices) {
            const current = waitingSummaries.get(group.factionId) ?? {
                factionName: group.factionName,
                characterGroupCount: 0,
                armamentGroupCount: 0,
            };
            current.characterGroupCount += 1;
            waitingSummaries.set(group.factionId, current);
        }

        for (const group of waitingArmamentChoices) {
            const current = waitingSummaries.get(group.factionId) ?? {
                factionName: group.factionName,
                characterGroupCount: 0,
                armamentGroupCount: 0,
            };
            current.armamentGroupCount += 1;
            waitingSummaries.set(group.factionId, current);
        }

        return Array.from(waitingSummaries.values()).map((summary) => {
            const parts: string[] = [];
            if (summary.characterGroupCount > 0) {
                parts.push(`人物 ${summary.characterGroupCount} 项`);
            }
            if (summary.armamentGroupCount > 0) {
                parts.push(`军备 ${summary.armamentGroupCount} 项`);
            }
            return `${summary.factionName}：${parts.join('、')}`;
        });
    }, [waitingArmamentChoices, waitingCharacterChoices]);

    React.useEffect(() => {
        setSelectedCharacterIdsByGroup((current) => Object.fromEntries(
            Object.entries(current).filter(([groupId]) => pendingCharacterChoices.some((group) => group.id === groupId)),
        ));
        setSelectedArmamentIdsByGroup((current) => Object.fromEntries(
            Object.entries(current).filter(([groupId]) => pendingArmamentChoices.some((group) => group.id === groupId)),
        ));
    }, [pendingArmamentChoices, pendingCharacterChoices]);

    const toggleChoiceId = React.useCallback((
        groupId: string,
        optionId: string,
        maxCount: number,
        currentSelections: Record<string, string[]>,
        setSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>,
    ) => {
        const selectedIds = currentSelections[groupId] ?? [];
        const alreadySelected = selectedIds.includes(optionId);
        const nextSelectedIds = alreadySelected
            ? selectedIds.filter((id) => id !== optionId)
            : selectedIds.length >= maxCount
                ? [...selectedIds.slice(0, Math.max(0, maxCount - 1)), optionId]
                : [...selectedIds, optionId];
        setSelections((current) => ({
            ...current,
            [groupId]: nextSelectedIds,
        }));
    }, []);

    return (
        <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(14,10,7,0.78)] px-6 py-8 backdrop-blur-[2px]"
            data-testid="qidahen-inmatch-setup-overlay"
        >
            <div
                className="max-h-full w-full max-w-[1080px] overflow-auto border-[3px] p-6"
                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 6 }}
            >
                <div className="flex flex-wrap items-end justify-between gap-3 border-b-[2px] pb-4" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: UI_STYLE.cinnabar }}>
                            {t('board.setup.eyebrow', { defaultValue: '局内开局设置' })}
                        </div>
                        <div className="mt-2 text-[28px] font-black" data-testid="qidahen-inmatch-setup-title">
                            {t('board.setup.title', { defaultValue: '先完成剧本人物、军备与阵营前置项' })}
                        </div>
                        <div className="mt-2 text-[13px] leading-6" style={{ color: UI_STYLE.mutedInk }}>
                            {t('board.setup.description', { defaultValue: '对局内先完成本阵营前置项，完成后进入正式棋盘操作。' })}
                        </div>
                    </div>
                    <div
                        className="border-[2px] px-3 py-2 text-[12px] font-black"
                        data-testid="qidahen-inmatch-setup-scenario"
                        style={{ borderColor: UI_STYLE.paperEdge, background: UI_STYLE.paperLight, borderRadius: 4 }}
                    >
                        {core.scenarioLabel}
                    </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {interactiveCharacterChoices.map((group) => {
                        const selectedIds = selectedCharacterIdsByGroup[group.id] ?? [];
                        return (
                            <div
                                key={group.id}
                                className="border-[2px] p-4"
                                data-testid={`qidahen-inmatch-setup-character-${group.id}`}
                                style={{ borderColor: UI_STYLE.paperEdge, background: UI_STYLE.paperLight, borderRadius: 4 }}
                            >
                                <div className="text-[12px] font-black" style={{ color: UI_STYLE.cinnabar }}>
                                    {group.factionName} · {t('board.setup.characterLabel', { defaultValue: '人物' })}
                                </div>
                                <div className="mt-1 text-[16px] font-black">
                                    {t('board.setup.pickCount', { count: group.count, defaultValue: '请选择 {{count}} 项' })}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {group.characterIds.map((characterId, index) => {
                                        const selected = selectedIds.includes(characterId);
                                        return (
                                            <button
                                                key={characterId}
                                                type="button"
                                                data-testid={`qidahen-inmatch-setup-character-option-${group.id}-${characterId}`}
                                                className="min-h-[40px] border-[2px] px-3 text-[13px] font-black transition hover:-translate-y-0.5"
                                                onClick={() => toggleChoiceId(group.id, characterId, group.count, selectedCharacterIdsByGroup, setSelectedCharacterIdsByGroup)}
                                                style={{
                                                    borderColor: selected ? UI_STYLE.cinnabar : UI_STYLE.paperEdge,
                                                    background: selected ? UI_STYLE.cinnabarGlow : 'rgba(255,255,255,0.56)',
                                                    color: UI_STYLE.ink,
                                                    borderRadius: 4,
                                                }}
                                            >
                                                {group.characterNames[index] ?? characterId}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    data-testid={`qidahen-inmatch-setup-character-confirm-${group.id}`}
                                    disabled={selectedIds.length !== group.count}
                                    className="mt-4 min-h-[42px] min-w-[164px] border-[3px] px-4 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => onResolveScenarioCharacterChoice(group.id, selectedIds)}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paperPressed, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 4 }}
                                >
                                    {t('board.setup.confirmCharacter', { defaultValue: '确认人物' })}
                                </button>
                            </div>
                        );
                    })}

                    {interactiveArmamentChoices.map((group) => {
                        const selectedIds = selectedArmamentIdsByGroup[group.id] ?? [];
                        return (
                            <div
                                key={group.id}
                                className="border-[2px] p-4"
                                data-testid={`qidahen-inmatch-setup-armament-${group.id}`}
                                style={{ borderColor: UI_STYLE.paperEdge, background: UI_STYLE.paperLight, borderRadius: 4 }}
                            >
                                <div className="text-[12px] font-black" style={{ color: UI_STYLE.cinnabar }}>
                                    {group.factionName} · {t('board.setup.armamentLabel', { defaultValue: '军备' })}
                                </div>
                                <div className="mt-1 text-[16px] font-black">
                                    {t('board.setup.pickCount', { count: group.count, defaultValue: '请选择 {{count}} 项' })}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {group.armamentIds.map((armamentId, index) => {
                                        const selected = selectedIds.includes(armamentId);
                                        return (
                                            <button
                                                key={armamentId}
                                                type="button"
                                                data-testid={`qidahen-inmatch-setup-armament-option-${group.id}-${armamentId}`}
                                                className="min-h-[40px] border-[2px] px-3 text-[13px] font-black transition hover:-translate-y-0.5"
                                                onClick={() => toggleChoiceId(group.id, armamentId, group.count, selectedArmamentIdsByGroup, setSelectedArmamentIdsByGroup)}
                                                style={{
                                                    borderColor: selected ? UI_STYLE.cinnabar : UI_STYLE.paperEdge,
                                                    background: selected ? UI_STYLE.cinnabarGlow : 'rgba(255,255,255,0.56)',
                                                    color: UI_STYLE.ink,
                                                    borderRadius: 4,
                                                }}
                                            >
                                                {group.armamentNames[index] ?? armamentId}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    data-testid={`qidahen-inmatch-setup-armament-confirm-${group.id}`}
                                    disabled={selectedIds.length !== group.count}
                                    className="mt-4 min-h-[42px] min-w-[164px] border-[3px] px-4 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => onResolveScenarioArmamentChoice(group.id, selectedIds as QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds'])}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paperPressed, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 4 }}
                                >
                                    {t('board.setup.confirmArmament', { defaultValue: '确认军备' })}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {(waitingCharacterChoices.length > 0 || waitingArmamentChoices.length > 0) ? (
                    <div
                        className="mt-5 border-[2px] px-4 py-3 text-[13px] font-black leading-6"
                        data-testid="qidahen-inmatch-setup-waiting"
                        style={{ borderColor: UI_STYLE.paperEdge, background: 'rgba(255,255,255,0.48)', borderRadius: 4 }}
                    >
                        {t('board.setup.waiting', { defaultValue: '等待其他玩家完成其所属阵营的前置项。' })}
                        <div className="mt-1 text-[12px]" style={{ color: UI_STYLE.mutedInk }}>
                            {waitingSummaryLines.join(' / ')}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const QidahenScenarioVoteScreen: React.FC<{
    core: QidahenCore;
    playerID: string | null;
    onCastScenarioVote: (scenarioId: QidahenScenarioId | null) => void;
}> = ({
    core,
    playerID,
    onCastScenarioVote,
}) => {
    const { t } = useTranslation('game-qidahen');
    const scenarioVote = core.scenarioVote;
    const [draftScenarioId, setDraftScenarioId] = React.useState<QidahenScenarioId | null>(
        scenarioVote?.options[0]?.scenarioId ?? null,
    );

    React.useEffect(() => {
        if (!scenarioVote) {
            setDraftScenarioId(null);
            return;
        }
        const confirmedVote = playerID ? scenarioVote.votes[playerID] ?? null : null;
        setDraftScenarioId(confirmedVote ?? scenarioVote.options[0]?.scenarioId ?? null);
    }, [playerID, scenarioVote]);

    if (!scenarioVote) {
        return null;
    }

    const currentVote = playerID ? scenarioVote.votes[playerID] ?? null : null;
    const playableScenarioIds = new Set(scenarioVote.options.map((option) => option.scenarioId));
    const allScenarioOptions = QIDAHEN_SCENARIO_SETUP_OPTIONS.map((setupOption, index) => {
        const scenarioId = setupOption.value as QidahenScenarioId;
        const meta = getQidahenScenarioVoteMeta(scenarioId);
        return {
            ...meta,
            orderNo: index + 1,
            isPlayable: playableScenarioIds.has(scenarioId),
        };
    });
    const voteCountByScenarioId = scenarioVote.options.reduce<Record<string, number>>((counts, option) => {
        counts[option.scenarioId] = Object.values(scenarioVote.votes).filter((vote) => vote === option.scenarioId).length;
        return counts;
    }, {});
    const factionRows = core.currentFactionOrder
        .map((factionId) => {
            const faction = core.factions[factionId];
            if (!Object.prototype.hasOwnProperty.call(scenarioVote.votes, faction.playerId)) {
                return null;
            }
            return {
                factionId,
                factionName: faction.name,
                playerId: faction.playerId,
                confirmedVote: scenarioVote.votes[faction.playerId] ?? null,
            };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
    const hostFactionName = factionRows.find((row) => row.playerId === scenarioVote.hostPlayerId)?.factionName ?? '房主';
    const canConfirmDraft = Boolean(playerID && draftScenarioId && playableScenarioIds.has(draftScenarioId));
    const selectedScenarioLabel = draftScenarioId
        ? allScenarioOptions.find((option) => option.scenarioId === draftScenarioId)?.label ?? null
        : null;

    return (
        <div
            className="absolute inset-0 overflow-hidden px-[66px] py-[46px]"
            data-testid="qidahen-scenario-vote-screen"
            style={{
                background: [
                    'radial-gradient(circle at 15% 15%, rgba(159,52,38,0.24), transparent 28%)',
                    'radial-gradient(circle at 72% 68%, rgba(32,21,13,0.26), transparent 36%)',
                    'linear-gradient(135deg, rgba(62,43,25,0.93) 0%, rgba(211,185,127,0.96) 42%, rgba(44,30,18,0.9) 100%)',
                ].join(', '),
                color: UI_STYLE.mapIvory,
            }}
        >
            <div
                className="absolute inset-[24px] border-[4px] opacity-80"
                aria-hidden="true"
                style={{ borderColor: UI_STYLE.mapInk, clipPath: UI_SURFACE.cutCorner }}
            />
            <div
                className="absolute inset-[36px] border opacity-40"
                aria-hidden="true"
                style={{ borderColor: UI_STYLE.mapGold, clipPath: UI_SURFACE.cutCorner }}
            />
            <div
                className="absolute left-[62px] top-[46px] h-[68px] w-[430px] border-l-[12px] border-t-[4px]"
                aria-hidden="true"
                style={{ borderColor: UI_STYLE.cinnabar }}
            />
            <div
                className="relative grid h-full min-h-0 grid-cols-[1fr_360px] gap-5"
                data-testid="qidahen-scenario-vote-layout"
            >
                <section
                    className="flex min-h-0 flex-col border-[4px] p-5"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, boxShadow: UI_SURFACE.mapPanelShadow, clipPath: UI_SURFACE.cutCorner }}
                >
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b-[2px] pb-4" style={{ borderColor: 'rgba(210,183,117,0.4)' }}>
                        <div>
                        <div className="text-[12px] font-black uppercase tracking-[0.28em]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.scenarioVote.eyebrow', { defaultValue: '局内剧本投票' })}
                        </div>
                        <div className="mt-2 text-[31px] font-black tracking-[0.04em]" data-testid="qidahen-scenario-vote-title" style={{ color: UI_STYLE.mapIvory }}>
                            {t('board.scenarioVote.title', { defaultValue: '先看剧本介绍，再为本局投票' })}
                        </div>
                        <div className="mt-2 max-w-[820px] text-[13px] leading-6" style={{ color: 'rgba(234,215,167,0.82)' }}>
                            {t('board.scenarioVote.description', { defaultValue: '联机房间不再在建房阶段预设剧本。全部席位在局内完成介绍阅读与投票后，才会进入人物、军备前置。' })}
                        </div>
                    </div>
                    <div
                        className="border-[3px] px-4 py-2 text-[13px] font-black"
                        data-testid="qidahen-scenario-vote-player-count"
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paperPressed, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, clipPath: UI_SURFACE.smallCutCorner }}
                    >
                        {t('board.scenarioVote.playerCount', {
                            count: scenarioVote.playerCount,
                            defaultValue: '{{count}} 人房间',
                        })}
                    </div>
                </div>

                    <div className="mt-5 grid min-h-0 flex-1 grid-cols-3 items-start gap-4 overflow-y-auto pr-1">
                    {allScenarioOptions.map((option) => {
                        const isDraft = draftScenarioId === option.scenarioId;
                        const isConfirmed = currentVote === option.scenarioId;
                        const disabledReason = t('board.scenarioVote.unavailableForPlayerCount', {
                            count: scenarioVote.playerCount,
                            supported: option.supportedPlayerCounts.join('/'),
                            defaultValue: `当前 ${scenarioVote.playerCount} 人房不可投，适用 ${option.supportedPlayerCounts.join('/')} 人`,
                        });
                        return (
                            <button
                                key={option.scenarioId}
                                type="button"
                                data-testid={`qidahen-scenario-vote-option-${option.scenarioId}`}
                                disabled={!option.isPlayable}
                                aria-label={option.isPlayable ? option.label : `${option.label}，${disabledReason}`}
                                className="relative flex min-h-[560px] flex-col border-[3px] p-4 text-left transition-[transform,filter,box-shadow] duration-150 hover:-translate-y-1 active:translate-y-0.5 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                onClick={() => {
                                    if (option.isPlayable) {
                                        setDraftScenarioId(option.scenarioId);
                                    }
                                }}
                                style={{
                                    borderColor: isDraft ? UI_STYLE.cinnabar : UI_STYLE.mapInk,
                                    background: option.isPlayable
                                        ? (isDraft ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paperQuiet)
                                        : 'linear-gradient(180deg, rgba(72,58,39,0.7) 0%, rgba(42,33,24,0.72) 100%)',
                                    color: option.isPlayable && !isDraft ? UI_STYLE.ink : UI_STYLE.mapIvory,
                                    boxShadow: isDraft
                                        ? '0 0 0 3px rgba(210,183,117,0.5), 0 16px 28px rgba(18,11,6,0.36)'
                                        : UI_SURFACE.mapPanelShadow,
                                    clipPath: UI_SURFACE.cutCorner,
                                    opacity: option.isPlayable ? 1 : 0.78,
                                }}
                            >
                                <div
                                    className="absolute inset-x-[18px] top-[18px] h-[3px]"
                                    aria-hidden="true"
                                    style={{ background: option.isPlayable ? UI_STYLE.cinnabar : 'rgba(210,183,117,0.28)' }}
                                />
                                <div
                                    className="mb-5 mt-4 flex h-[88px] items-center justify-center border-[2px] text-[28px] font-black tracking-[0.18em]"
                                    aria-hidden="true"
                                    style={{
                                        borderColor: isDraft ? UI_STYLE.mapGold : 'rgba(32,21,13,0.62)',
                                        background: option.isPlayable
                                            ? 'radial-gradient(circle at 50% 25%, rgba(210,183,117,0.24), transparent 50%), rgba(32,21,13,0.72)'
                                            : 'rgba(32,21,13,0.68)',
                                        color: option.isPlayable ? UI_STYLE.mapGold : 'rgba(234,215,167,0.46)',
                                        clipPath: UI_SURFACE.smallCutCorner,
                                    }}
                                >
                                    {t('board.scenarioVote.orderBadge', {
                                        orderNo: option.orderNo,
                                        defaultValue: '战局 {{orderNo}}',
                                    })}
                                </div>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="text-[18px] font-black leading-7">{option.label}</div>
                                    <div
                                        className="shrink-0 border px-2 py-1 text-[11px] font-black"
                                        data-testid={`qidahen-scenario-vote-count-${option.scenarioId}`}
                                        style={{
                                            borderColor: option.isPlayable ? UI_STYLE.mapInk : 'rgba(234,215,167,0.24)',
                                            background: option.isPlayable ? UI_STYLE.paperLight : 'rgba(32,21,13,0.5)',
                                            color: option.isPlayable ? UI_STYLE.ink : 'rgba(234,215,167,0.56)',
                                            borderRadius: 999,
                                        }}
                                    >
                                        {t('board.scenarioVote.voteCount', {
                                            count: voteCountByScenarioId[option.scenarioId] ?? 0,
                                            defaultValue: '{{count}} 票',
                                        })}
                                    </div>
                                </div>
                                <div className="mt-4 min-h-[116px] text-[14px] leading-7">{option.intro}</div>
                                <div
                                    className="mt-4 border-l-[4px] py-2 pl-3 text-[12px] leading-6"
                                    style={{
                                        borderColor: option.isPlayable ? UI_STYLE.cinnabar : 'rgba(210,183,117,0.28)',
                                        color: option.isPlayable && !isDraft ? UI_STYLE.mutedInk : 'rgba(234,215,167,0.74)',
                                    }}
                                >
                                    {option.overview}
                                </div>
                                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-[11px] font-black">
                                    <span
                                        className="border px-2 py-1"
                                        style={{
                                            borderColor: option.isPlayable ? UI_STYLE.mapInk : 'rgba(234,215,167,0.24)',
                                            background: option.isPlayable ? 'rgba(243,231,196,0.72)' : 'rgba(32,21,13,0.52)',
                                            color: option.isPlayable ? UI_STYLE.ink : 'rgba(234,215,167,0.62)',
                                            borderRadius: 999,
                                        }}
                                    >
                                        {t('board.scenarioVote.supportedPlayers', {
                                            count: option.supportedPlayerCounts.join('/'),
                                            defaultValue: '适用 {{count}} 人',
                                        })}
                                    </span>
                                    {isConfirmed ? (
                                        <span
                                            className="border px-2 py-1"
                                            data-testid={`qidahen-scenario-vote-confirmed-${option.scenarioId}`}
                                            style={{ borderColor: UI_STYLE.cinnabar, background: UI_STYLE.cinnabarGlow, borderRadius: 999 }}
                                        >
                                            {t('board.scenarioVote.myVote', { defaultValue: '本席已投' })}
                                        </span>
                                    ) : null}
                                    {!option.isPlayable ? (
                                        <span
                                            className="border px-2 py-1"
                                            data-testid={`qidahen-scenario-vote-locked-${option.scenarioId}`}
                                            style={{ borderColor: UI_STYLE.mapGold, background: 'rgba(32,21,13,0.72)', color: UI_STYLE.mapGold, borderRadius: 999 }}
                                        >
                                            {disabledReason}
                                        </span>
                                    ) : null}
                                </div>
                            </button>
                        );
                    })}
                    </div>
                </section>

                <aside className="grid min-h-0 grid-rows-[1fr_auto] gap-4">
                    <div
                        className="min-h-0 overflow-y-auto border-[4px] px-4 py-4"
                        data-testid="qidahen-scenario-vote-seat-status"
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, boxShadow: UI_SURFACE.mapPanelShadow, clipPath: UI_SURFACE.cutCorner }}
                    >
                        <div className="text-[12px] font-black tracking-[0.14em]" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.scenarioVote.seatStatusTitle', { defaultValue: '各席位当前投票' })}
                        </div>
                        <div className="mt-3 grid gap-2">
                            {factionRows.map((row) => (
                                <div
                                    key={row.playerId}
                                    className="flex items-center justify-between gap-3 border-b pb-3 text-[13px]"
                                    data-testid={`qidahen-scenario-vote-status-${row.playerId}`}
                                    style={{ borderColor: 'rgba(210,183,117,0.22)' }}
                                >
                                    <div className="font-black">
                                        {row.factionName}
                                        {row.playerId === playerID ? ` · ${t('board.scenarioVote.you', { defaultValue: '你' })}` : ''}
                                        {row.playerId === scenarioVote.hostPlayerId ? ` · ${t('board.scenarioVote.host', { defaultValue: '房主' })}` : ''}
                                    </div>
                                    <div className="text-right leading-5" style={{ color: row.confirmedVote ? UI_STYLE.mapIvory : 'rgba(234,215,167,0.56)' }}>
                                        {row.confirmedVote
                                            ? allScenarioOptions.find((option) => option.scenarioId === row.confirmedVote)?.label ?? row.confirmedVote
                                            : t('board.scenarioVote.pendingVote', { defaultValue: '未投票' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 text-[12px] leading-5" style={{ color: 'rgba(234,215,167,0.68)' }}>
                            {t('board.scenarioVote.tiebreakNote', {
                                hostFactionName,
                                defaultValue: '全部席位确认后立即结算；若票数相同，则按{{hostFactionName}}的房主票裁定。',
                            })}
                        </div>
                    </div>

                    <div
                        className="border-[4px] px-4 py-4"
                        data-testid="qidahen-scenario-vote-actions"
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, clipPath: UI_SURFACE.cutCorner }}
                    >
                        <div className="text-[12px] font-black" style={{ color: UI_STYLE.mapGold }}>
                            {t('board.scenarioVote.actionTitle', { defaultValue: '本席操作' })}
                        </div>
                        <div className="mt-2 text-[13px] leading-6" style={{ color: UI_STYLE.mapIvory }}>
                            {playerID
                                ? currentVote
                                    ? t('board.scenarioVote.changeableHint', { defaultValue: '你已经提交过一票；在所有席位投完前，仍可改投或撤回。' })
                                    : t('board.scenarioVote.selectHint', { defaultValue: '选择剧本介绍卡后确认投票。' })
                                : t('board.scenarioVote.spectatorHint', { defaultValue: '观战视角只显示当前票型，不提供代投入口。' })}
                        </div>
                        <div className="mt-3 border px-3 py-2 text-[12px] font-black" style={{ borderColor: 'rgba(210,183,117,0.34)', background: 'rgba(32,21,13,0.42)', color: UI_STYLE.mapGold, clipPath: UI_SURFACE.smallCutCorner }}>
                            {selectedScenarioLabel ?? t('board.scenarioVote.noDraft', { defaultValue: '尚未选择剧本' })}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                data-testid="qidahen-scenario-vote-confirm"
                                disabled={!canConfirmDraft}
                                className="min-h-[44px] min-w-[156px] border-[3px] px-4 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                onClick={() => draftScenarioId && onCastScenarioVote(draftScenarioId)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paperPressed, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, clipPath: UI_SURFACE.smallCutCorner }}
                            >
                                {t('board.scenarioVote.confirm', { defaultValue: '确认投票' })}
                            </button>
                            <button
                                type="button"
                                data-testid="qidahen-scenario-vote-clear"
                                disabled={!playerID || currentVote == null}
                                className="min-h-[44px] min-w-[156px] border-[3px] px-4 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                onClick={() => onCastScenarioVote(null)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, clipPath: UI_SURFACE.smallCutCorner }}
                            >
                                {t('board.scenarioVote.clear', { defaultValue: '撤回本票' })}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export const QidahenBoard: React.FC<Props> = ({ G, dispatch, locale, playerID, isMultiplayer, reset, matchData }) => {
    const { t } = useTranslation('game-qidahen');
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();
    const core = G.core;
    const isGameOver = Boolean(G.sys?.gameover);
    const gameOverResult = G.sys?.gameover;
    useTutorialBridge(G.sys.tutorial, dispatch as (type: string, payload?: unknown) => void);
    const { overlayProps: endgameProps } = useEndgame({
        result: gameOverResult || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });
    const winnerPlayerId = gameOverResult?.winner;
    useGameAudio({
        config: QIDAHEN_AUDIO_CONFIG,
        gameId: QIDAHEN_MANIFEST.id,
        G: core,
        ctx: {
            turnPhase: core.turnPhase,
            isGameOver,
            isWinner: winnerPlayerId != null ? winnerPlayerId === playerID : undefined,
        },
        eventEntries: G.sys.eventStream?.entries,
    });
    const viewerFactionId = React.useMemo(() => resolveViewerFactionId(core, playerID), [core, playerID]);
    const isTutorialCommandAllowed = React.useCallback((commandType: string): boolean => {
        if (!isTutorialActive || !tutorialStep) {
            return true;
        }
        if (tutorialStep.allowedCommands && tutorialStep.allowedCommands.length > 0) {
            return tutorialStep.allowedCommands.includes(commandType);
        }
        return tutorialStep.infoStep !== true;
    }, [isTutorialActive, tutorialStep]);
    const isTutorialTargetAllowed = React.useCallback((targetId: string | null | undefined): boolean => {
        if (!isTutorialActive || !tutorialStep?.allowedTargets || tutorialStep.allowedTargets.length <= 0) {
            return true;
        }
        return !!targetId && tutorialStep.allowedTargets.includes(targetId);
    }, [isTutorialActive, tutorialStep]);
    const scenarioVotePending = core.scenarioVote != null;
    const scenarioChoicesPending = core.pendingScenarioCharacterChoices.length > 0 || core.pendingScenarioArmamentChoices.length > 0;
    const setupStagePending = scenarioVotePending || scenarioChoicesPending;
    const activeInteraction = G.sys.interaction?.current;
    const handLimitDiscardSelectionFromInteraction = getQidahenHandLimitDiscardSelectionFromInteraction(activeInteraction);
    const recruitSelectionFromInteraction = getQidahenRecruitSelectionFromInteraction(activeInteraction);
    const diplomacySelectionFromInteraction = getQidahenDiplomacySelectionFromInteraction(activeInteraction);
    const wheelDispatchSelectionFromInteraction = getQidahenWheelDispatchSelectionFromInteraction(activeInteraction);
    const internalDispatchSelectionFromInteraction = getQidahenInternalDispatchSelectionFromInteraction(activeInteraction);
    const maShiTradeSelectionFromInteraction = getQidahenMaShiTradeSelectionFromInteraction(activeInteraction);
    const khanEdictSelectionFromInteraction = getQidahenKhanEdictSelectionFromInteraction(activeInteraction);
    const driveTigerConsentSelectionFromInteraction = getQidahenDriveTigerConsentSelectionFromInteraction(activeInteraction);
    const fortificationMaintenanceSelectionFromInteraction = getQidahenFortificationMaintenanceSelectionFromInteraction(activeInteraction);
    const pendingTargetActionFromInteraction = getQidahenPendingTargetActionFromInteraction(activeInteraction);
    const postBattleSelectionFromInteraction = getQidahenPostBattleSelectionFromInteraction(activeInteraction);
    const handLimitDiscardSelection = getQidahenHandLimitDiscardSelectionForCore(core, activeInteraction);
    const recruitSelection = getQidahenRecruitSelectionForCore(core, activeInteraction);
    const diplomacySelection = getQidahenDiplomacySelectionForCore(core, activeInteraction);
    const wheelDispatchSelection = getQidahenWheelDispatchSelectionForCore(core, activeInteraction);
    const internalDispatchSelection = getQidahenInternalDispatchSelectionForCore(core, activeInteraction);
    const maShiTradeSelection = getQidahenMaShiTradeSelectionForCore(core, activeInteraction);
    const khanEdictSelection = getQidahenKhanEdictSelectionForCore(core, activeInteraction);
    const driveTigerConsentSelection = getQidahenDriveTigerConsentSelectionForCore(core, activeInteraction);
    const fortificationMaintenanceSelection = getQidahenFortificationMaintenanceSelectionForCore(core, activeInteraction);
    const pendingTargetAction = getQidahenPendingTargetActionForCore(core, activeInteraction);
    const postBattleSelection = getQidahenPostBattleSelectionForCore(core, activeInteraction);
    const displayCore = React.useMemo(() => ({
        ...core,
        internalDispatchSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
        pendingTargetAction,
    }), [
        core,
        driveTigerConsentSelection,
        internalDispatchSelection,
        khanEdictSelection,
        maShiTradeSelection,
        pendingTargetAction,
    ]);
    const [pendingCommittedTroops, setPendingCommittedTroops] = React.useState<number | undefined>(pendingTargetAction?.committedTroops);
    const [pendingAttackerCasualtyPriority, setPendingAttackerCasualtyPriority] = React.useState<QidahenCasualtyPriority>('highest-level');
    const [pendingDefenderCasualtyPriority, setPendingDefenderCasualtyPriority] = React.useState<QidahenCasualtyPriority>('highest-level');
    const [upkeepAttritionPriority, setUpkeepAttritionPriority] = React.useState<QidahenCasualtyPriority>('lowest-level');
    const actionPaymentPreviewVisible = core.turnPhase === 'action-window'
        && !core.factionActionUsed
        && core.confirmedActionId != null
        && core.payment.required > 0;
    const [mapViewport, setMapViewport] = React.useState<QidahenMapViewport>(DEFAULT_QIDAHEN_MAP_VIEWPORT);
    const [isTouchLikeWheelInteraction, setIsTouchLikeWheelInteraction] = React.useState(false);
    const [magnifyTarget, setMagnifyTarget] = React.useState<QidahenMagnifyTarget | null>(null);
    const [selectedHandLimitCardIds, setSelectedHandLimitCardIds] = React.useState<string[]>(handLimitDiscardSelection?.selectedCardIds ?? []);
    const factionStageSelectionActive = core.gaoDiDispatchSelection != null
        || internalDispatchSelection != null
        || recruitSelection != null
        || maShiTradeSelection != null
        || khanEdictSelection != null
        || diplomacySelection != null
        || driveTigerConsentSelection != null
        || fortificationMaintenanceSelection != null
        || handLimitDiscardSelection != null;
    const wheelStageSelectionActive = wheelDispatchSelection != null
        || pendingTargetAction != null
        || postBattleSelection != null;
    const factionStageAvailable = !setupStagePending
        && !core.factionActionUsed
        && !factionStageSelectionActive
        && !wheelStageSelectionActive;
    const wheelStageAvailable = !setupStagePending
        && !core.wheelActionUsed
        && !factionStageSelectionActive
        && !wheelStageSelectionActive
        && core.wheelMoveChoices.length > 0;
    const tutorialInfoStepActive = tutorialStep?.infoStep === true;
    const tutorialShowsSeasonSummary = tutorialStep?.id === 'korea-attrition'
        || tutorialStep?.id === 'shanhaiguan';
    const primaryStageMode: QidahenPrimaryStageMode | null = wheelStageSelectionActive
        ? 'wheel'
        : factionStageSelectionActive
            ? 'faction'
            : factionStageAvailable
                ? 'faction'
                : wheelStageAvailable
                    ? 'wheel'
                    : null;
    const activeHandLimitInteractionId = handLimitDiscardSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeRecruitInteractionId = recruitSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeDiplomacyInteractionId = diplomacySelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeWheelDispatchInteractionId = wheelDispatchSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeInternalDispatchInteractionId = internalDispatchSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeMaShiTradeInteractionId = maShiTradeSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeKhanEdictInteractionId = khanEdictSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeDriveTigerConsentInteractionId = driveTigerConsentSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeFortificationMaintenanceInteractionId = fortificationMaintenanceSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activePendingTargetInteractionId = pendingTargetActionFromInteraction ? activeInteraction?.id ?? null : null;
    const activePostBattleInteractionId = postBattleSelectionFromInteraction ? activeInteraction?.id ?? null : null;

    React.useEffect(() => {
        setPendingCommittedTroops(pendingTargetAction?.committedTroops);
        setPendingAttackerCasualtyPriority('highest-level');
        setPendingDefenderCasualtyPriority('highest-level');
    }, [
        pendingTargetAction?.actionId,
        pendingTargetAction?.sourceRegionId,
        pendingTargetAction?.targetRuntimeRegionId,
        pendingTargetAction?.committedTroops,
    ]);

    React.useEffect(() => {
        setSelectedHandLimitCardIds(handLimitDiscardSelection?.selectedCardIds ?? []);
    }, [activeHandLimitInteractionId, handLimitDiscardSelection]);

    React.useEffect(() => {
        const mediaQuery = safeMatchMedia('(hover: none), (pointer: coarse), (any-pointer: coarse)');
        const update = () => {
            setIsTouchLikeWheelInteraction(mediaQuery.matches);
        };
        update();
        return subscribeMediaQueryChange(mediaQuery, update);
    }, []);

    const selectWheelMove = React.useCallback((moveId: string) => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE) || !isTutorialTargetAllowed(moveId)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, { moveId });
    }, [dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed]);

    const executeWheelMove = React.useCallback((moveId: string) => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE) || !isTutorialTargetAllowed(moveId)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, { moveId });
    }, [dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed]);

    const castScenarioVote = React.useCallback((scenarioId: QidahenScenarioId | null) => {
        dispatch(QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE, { scenarioId });
    }, [dispatch]);

    const previewAction = React.useCallback((actionId: string, tutorialTargetId = actionId) => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION) || !isTutorialTargetAllowed(tutorialTargetId)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, { actionId });
    }, [dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed]);

    const cancelActionPaymentPreview = React.useCallback(() => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.CANCEL_PREVIEW_ACTION)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.CANCEL_PREVIEW_ACTION, {});
    }, [dispatch, isTutorialCommandAllowed]);

    const confirmSelectedAction = React.useCallback(() => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION, {});
    }, [dispatch, isTutorialCommandAllowed]);

    const executeAction = React.useCallback((actionId: string) => {
        const action = core.actionChoices.find((choice) => choice.id === actionId);
        if (!action) {
            return;
        }
        if (!isTutorialTargetAllowed(actionId)) {
            return;
        }
        if (action.cost > 0) {
            if (actionPaymentPreviewVisible && core.selectedActionId === actionId) {
                return;
            }
            previewAction(actionId);
            return;
        }
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_ACTION)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.EXECUTE_ACTION, { actionId });
    }, [actionPaymentPreviewVisible, core.actionChoices, core.selectedActionId, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed, previewAction]);

    const togglePaymentCard = React.useCallback((cardId: string) => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD) || !isTutorialTargetAllowed(cardId)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, { cardId });
    }, [dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed]);

    const previewActionFromHandCard = React.useCallback((card: QidahenHandCard) => {
        const actionId = getQidahenDirectActionIdForHandCard(card);
        if (!actionId || !factionStageAvailable || actionPaymentPreviewVisible || card.status === 'disabled') {
            return;
        }
        previewAction(actionId, getQidahenHandCardTutorialTargetId(card));
    }, [actionPaymentPreviewVisible, factionStageAvailable, previewAction]);

    const resolvePendingAction = React.useCallback((choiceValue: QidahenPendingTargetChoiceValue, attackerCasualtyPriority?: QidahenCasualtyPriority, defenderCasualtyPriority?: QidahenCasualtyPriority, committedTroops?: number) => {
        const { choiceId, ...choicePayload } = choiceValue;
        const interactionMergedValue = {
            ...(committedTroops != null ? { committedTroops } : {}),
            ...(attackerCasualtyPriority ? { attackerCasualtyPriority } : {}),
            ...(defenderCasualtyPriority ? { defenderCasualtyPriority } : {}),
        };
        const legacyPayload = {
            ...choicePayload,
            ...interactionMergedValue,
        };
        if (activePendingTargetInteractionId && pendingTargetAction) {
            dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
                interactionId: activePendingTargetInteractionId,
                optionId: choiceId,
                ...(Object.keys(interactionMergedValue).length > 0 ? { mergedValue: interactionMergedValue } : {}),
            } as QidahenCommandMap[keyof QidahenCommandMap]);
            return;
        }
        dispatch(
            QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            Object.keys(legacyPayload).length > 0 ? legacyPayload : {},
        );
    }, [activePendingTargetInteractionId, dispatch, pendingTargetAction]);

    const resolveRecruitChoice = React.useCallback((choiceId: QidahenRecruitChoice['id']) => {
        if (!activeRecruitInteractionId || !recruitSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeRecruitInteractionId,
            optionId: choiceId,
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeRecruitInteractionId, dispatch, recruitSelection]);

    const selectGaoDiDispatchCard = React.useCallback((cardId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD, { cardId });
    }, [dispatch]);

    const selectSunYuanhuaTechCard = React.useCallback((cardId: string) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD, { cardId });
    }, [dispatch]);

    const resolveGaoDiDispatch = React.useCallback((choiceId: string) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH, { choiceId });
    }, [dispatch]);

    const resolveSunYuanhuaTech = React.useCallback((choiceId: 'confirm' | 'skip') => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH, { choiceId });
    }, [dispatch]);

    const resolveInternalDispatch = React.useCallback((choiceId: string) => {
        if (!internalDispatchSelection) {
            return;
        }
        if (activeInternalDispatchInteractionId) {
            dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
                interactionId: activeInternalDispatchInteractionId,
                optionId: choiceId,
            } as QidahenCommandMap[keyof QidahenCommandMap]);
        }
    }, [activeInternalDispatchInteractionId, dispatch, internalDispatchSelection]);

    const resolveKhanEdictChoice = React.useCallback((choiceId: 'recruit-train' | 'hire-dispatch') => {
        if (!activeKhanEdictInteractionId || !khanEdictSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeKhanEdictInteractionId,
            optionId: choiceId,
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeKhanEdictInteractionId, dispatch, khanEdictSelection]);

    const resolveDiplomacyChoice = React.useCallback((choiceId: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker') => {
        if (!activeDiplomacyInteractionId || !diplomacySelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeDiplomacyInteractionId,
            optionId: choiceId,
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeDiplomacyInteractionId, diplomacySelection, dispatch]);

    const resolveMaShiTradeChoice = React.useCallback((troopCount: 1 | 2 | 3) => {
        if (!activeMaShiTradeInteractionId || !maShiTradeSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeMaShiTradeInteractionId,
            optionId: String(troopCount),
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeMaShiTradeInteractionId, dispatch, maShiTradeSelection]);

    const resolveDriveTigerConsent = React.useCallback((choiceId: 'accept' | 'decline') => {
        if (!activeDriveTigerConsentInteractionId || !driveTigerConsentSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeDriveTigerConsentInteractionId,
            optionId: choiceId,
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeDriveTigerConsentInteractionId, dispatch, driveTigerConsentSelection]);

    const resolveFortificationMaintenance = React.useCallback((choiceId: 'auto-pay' | 'skip-all', attritionPriority: QidahenCasualtyPriority) => {
        if (!fortificationMaintenanceSelection) {
            return;
        }
        if (activeFortificationMaintenanceInteractionId) {
            dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
                interactionId: activeFortificationMaintenanceInteractionId,
                optionId: choiceId,
                mergedValue: { attritionPriority },
            } as QidahenCommandMap[keyof QidahenCommandMap]);
            return;
        }
        dispatch(QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE, {
            choiceId,
            attritionPriority,
        });
    }, [activeFortificationMaintenanceInteractionId, dispatch, fortificationMaintenanceSelection]);

    const toggleHandLimitDiscardCard = React.useCallback((cardId: string) => {
        if (!handLimitDiscardSelection || !handLimitDiscardSelection.candidateCardIds.includes(cardId)) {
            return;
        }
        setSelectedHandLimitCardIds((currentSelectedCardIds) => {
            if (currentSelectedCardIds.includes(cardId)) {
                return currentSelectedCardIds.filter((selectedCardId) => selectedCardId !== cardId);
            }
            if (currentSelectedCardIds.length >= handLimitDiscardSelection.requiredDiscardCount) {
                return currentSelectedCardIds;
            }
            return [...currentSelectedCardIds, cardId];
        });
    }, [handLimitDiscardSelection]);

    const resolveHandLimitDiscard = React.useCallback(() => {
        if (activeHandLimitInteractionId && handLimitDiscardSelection) {
            dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
                interactionId: activeHandLimitInteractionId,
                optionIds: selectedHandLimitCardIds,
            } as QidahenCommandMap[keyof QidahenCommandMap]);
            return;
        }
        dispatch(QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD, {});
    }, [activeHandLimitInteractionId, dispatch, handLimitDiscardSelection, selectedHandLimitCardIds]);

    const resolvePostBattleDecision = React.useCallback((choiceId: string) => {
        if (!activePostBattleInteractionId || !postBattleSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activePostBattleInteractionId,
            optionId: choiceId,
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activePostBattleInteractionId, dispatch, postBattleSelection]);

    const resolveWheelDispatchChoice = React.useCallback((choiceId: string) => {
        if (!activeWheelDispatchInteractionId || !wheelDispatchSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeWheelDispatchInteractionId,
            optionId: choiceId,
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeWheelDispatchInteractionId, dispatch, wheelDispatchSelection]);

    const resolveScenarioCharacterChoice = React.useCallback((groupId: string, characterIds: string[]) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE, { groupId, characterIds });
    }, [dispatch]);

    const resolveScenarioArmamentChoice = React.useCallback((groupId: string, armamentIds: QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds']) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE, { groupId, armamentIds });
    }, [dispatch]);

    const compactMapRegionTip = setupStagePending
        || actionPaymentPreviewVisible
        || handLimitDiscardSelection != null
        || core.sunYuanhuaTechSelection != null
        || core.gaoDiDispatchSelection != null
        || internalDispatchSelection != null
        || recruitSelection != null
        || maShiTradeSelection != null
        || khanEdictSelection != null
        || diplomacySelection != null
        || driveTigerConsentSelection != null
        || fortificationMaintenanceSelection != null
        || wheelDispatchSelection != null
        || pendingTargetAction != null
        || postBattleSelection != null;
    const showTopWheelPrompt = primaryStageMode === 'wheel'
        && wheelStageAvailable
        && !tutorialInfoStepActive
        && !actionPaymentPreviewVisible
        && khanEdictSelection == null
        && recruitSelection == null
        && maShiTradeSelection == null
        && diplomacySelection == null
        && driveTigerConsentSelection == null
        && fortificationMaintenanceSelection == null
        && internalDispatchSelection == null
        && wheelDispatchSelection == null
        && pendingTargetAction == null
        && postBattleSelection == null
        && handLimitDiscardSelection == null
        && core.gaoDiDispatchSelection == null
        && core.sunYuanhuaTechSelection == null;
    const showTopFactionPrompt = primaryStageMode === 'faction'
        && factionStageAvailable
        && !tutorialInfoStepActive
        && !actionPaymentPreviewVisible
        && !actionPaymentPreviewVisible;
    const selectedPrimaryAction = getQidahenForegroundActionChoice(core, {
        actionPaymentPreviewVisible,
        recruitSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
    });
    const primaryActionEntryText = buildQidahenPrimaryActionEntryText(core, selectedPrimaryAction);
    const mapRegionSelectionDecisionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection)
        || internalDispatchSelection != null
        || recruitSelection != null
        || maShiTradeSelection != null
        || khanEdictSelection != null
        || diplomacySelection != null
        || wheelDispatchSelection != null;

    const selectRegion = React.useCallback((regionId: string) => {
        if (setupStagePending || pendingTargetAction != null || postBattleSelection != null || driveTigerConsentSelection != null || fortificationMaintenanceSelection != null || handLimitDiscardSelection != null || core.sunYuanhuaTechSelection != null) {
            return;
        }
        if (!mapRegionSelectionDecisionActive) {
            return;
        }
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_REGION) || !isTutorialTargetAllowed(regionId)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId });
    }, [setupStagePending, pendingTargetAction, postBattleSelection, driveTigerConsentSelection, fortificationMaintenanceSelection, handLimitDiscardSelection, core.sunYuanhuaTechSelection, mapRegionSelectionDecisionActive, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed]);

    const activateTopLevelGuideTarget = React.useCallback((candidate: {
        action: 'wheel-dispatch' | 'gao-di' | 'internal-dispatch' | 'select-region';
        resolutionChoiceId: string;
        targetRegionId: string;
    }) => {
        if (candidate.action === 'wheel-dispatch') {
            resolveWheelDispatchChoice(candidate.resolutionChoiceId);
            return;
        }
        if (candidate.action === 'gao-di') {
            resolveGaoDiDispatch(candidate.resolutionChoiceId);
            return;
        }
        if (candidate.action === 'internal-dispatch') {
            resolveInternalDispatch(candidate.resolutionChoiceId);
            return;
        }
        selectRegion(candidate.targetRegionId);
    }, [resolveWheelDispatchChoice, resolveGaoDiDispatch, resolveInternalDispatch, selectRegion]);

    const getTopLevelGuideRegionPoint = React.useCallback((regionId: string | null | undefined) => {
        if (!regionId) {
            return null;
        }
        const region = displayCore.regions.find((item) => item.id === regionId);
        if (region && typeof region.x === 'number' && typeof region.y === 'number') {
            return projectQidahenMapPointToStage({
                x: region.x * QIDAHEN_MAP_WIDTH,
                y: region.y * QIDAHEN_MAP_HEIGHT,
            }, mapViewport);
        }
        const graphNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(regionId);
        const point = graphNode?.center ?? graphNode?.seed ?? null;
        return point
            ? projectQidahenMapPointToStage(point, mapViewport)
            : null;
    }, [displayCore.regions, mapViewport]);

    const topLevelMapSelectionGuide = (() => {
        if (pendingTargetAction != null) {
            return null;
        }
        if (wheelDispatchSelection) {
            return {
                title: '选择目标',
                candidates: wheelDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.targetRuntimeRegionId,
                    action: 'wheel-dispatch' as const,
                    resolutionChoiceId: candidate.targetRuntimeRegionId,
                    targetRegionId: candidate.targetRuntimeRegionId,
                    targetRegionName: candidate.targetRegionName,
                })),
            };
        }
        if (core.gaoDiDispatchSelection) {
            const gaoDiTargetSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);
            return {
                title: gaoDiTargetSelectionActive
                    ? '高第调度'
                    : '先弃 1 张牌',
                candidates: gaoDiTargetSelectionActive ? core.gaoDiDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    action: 'gao-di' as const,
                    resolutionChoiceId: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                })) : [],
            };
        }
        if (internalDispatchSelection) {
            return {
                title: '王化贞调度',
                candidates: internalDispatchSelection.candidates.map((candidate) => ({
                    id: candidate.id,
                    action: 'internal-dispatch' as const,
                    resolutionChoiceId: candidate.id,
                    targetRegionId: candidate.targetRegionId,
                    targetRegionName: candidate.targetRegionName,
                })),
            };
        }
        return null;
    })();

    if (scenarioVotePending) {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
                <StageRoot>
                    <QidahenScenarioVoteScreen
                        core={core}
                        playerID={playerID}
                        onCastScenarioVote={castScenarioVote}
                    />
                </StageRoot>
            </UndoProvider>
        );
    }

    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
            <StageRoot>
            {!scenarioVotePending && scenarioChoicesPending ? (
                <QidahenInMatchSetupOverlay
                    core={core}
                    viewerFactionId={viewerFactionId}
                    playerID={playerID}
                    onResolveScenarioCharacterChoice={resolveScenarioCharacterChoice}
                    onResolveScenarioArmamentChoice={resolveScenarioArmamentChoice}
                />
            ) : null}
            <MapSceneLayer
                core={displayCore}
                perspectiveFactionId={viewerFactionId}
                wheelDispatchSelection={wheelDispatchSelection}
                internalDispatchSelection={internalDispatchSelection}
                pendingTargetAction={pendingTargetAction}
                tutorialStepId={tutorialStep?.id ?? null}
                compactRegionTip={compactMapRegionTip}
                viewport={mapViewport}
                onViewportChange={setMapViewport}
                locale={locale}
                onSelectRegion={selectRegion}
            />
            {showTopWheelPrompt ? (
                <TopPromptBanner
                    testId="qidahen-wheel-next-step-banner"
                    title={t('board.actions.wheelNextStepTitle', { defaultValue: '轮盘行动' })}
                    hint={t('board.actions.wheelNextStepHint', { defaultValue: '选择轮盘格' })}
                    badgeLabel={t('board.actions.wheelNextStepBadge', { defaultValue: '轮盘' })}
                    tone="wheel"
                />
            ) : null}
            {showTopFactionPrompt ? (
                <TopPromptBanner
                    testId="qidahen-top-action-banner"
                    title={t('board.actions.primaryActionSelectPrompt', { defaultValue: '手牌行动' })}
                    hint={selectedPrimaryAction ? primaryActionEntryText : undefined}
                    badgeLabel={t('board.actions.primaryStageTagFaction', { defaultValue: '行动' })}
                    tone="faction"
                />
            ) : null}
            <PlayerFloat core={core} />
            <WheelPanel
                selectedId={core.actionWheelPosition}
                selectedMoveId={core.selectedWheelMoveId}
                moveChoices={core.wheelMoveChoices}
                moveSummary={core.wheelMoveSummary}
                disabled={setupStagePending || core.wheelActionUsed || recruitSelection != null || core.sunYuanhuaTechSelection != null || core.gaoDiDispatchSelection != null || internalDispatchSelection != null || maShiTradeSelection != null || khanEdictSelection != null || diplomacySelection != null || fortificationMaintenanceSelection != null || handLimitDiscardSelection != null || pendingTargetAction != null || postBattleSelection != null}
                emphasized={wheelStageAvailable}
                directExecuteOnClick={!isTouchLikeWheelInteraction}
                canActivateMove={(moveId, selected) => {
                    return isTouchLikeWheelInteraction
                        ? (selected
                            ? isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE) && isTutorialTargetAllowed(moveId)
                            : isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE) && isTutorialTargetAllowed(moveId))
                        : isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE) && isTutorialTargetAllowed(moveId);
                }}
                onSelectMove={selectWheelMove}
                onExecuteMove={executeWheelMove}
            />
            <KoreaZone core={core} locale={locale} />
            <ChronologyZone cards={core.yearCards} locale={locale} onMagnify={setMagnifyTarget} />
            <ActionsZone
                core={displayCore}
                primaryStageMode={primaryStageMode}
                isTutorialActive={isTutorialActive}
                tutorialInfoStepActive={tutorialInfoStepActive}
                tutorialHighlightsSeasonSummary={tutorialShowsSeasonSummary}
                actionPaymentPreviewVisible={actionPaymentPreviewVisible}
                handLimitDiscardSelection={handLimitDiscardSelection}
                internalDispatchSelection={internalDispatchSelection}
                recruitSelection={recruitSelection}
                maShiTradeSelection={maShiTradeSelection}
                khanEdictSelection={khanEdictSelection}
                diplomacySelection={diplomacySelection}
                driveTigerConsentSelection={driveTigerConsentSelection}
                fortificationMaintenanceSelection={fortificationMaintenanceSelection}
                pendingTargetAction={pendingTargetAction}
                postBattleSelection={postBattleSelection}
                onExecuteAction={executeAction}
                onSelectRegion={selectRegion}
                onResolveRecruitChoice={resolveRecruitChoice}
                onResolveGaoDiDispatch={resolveGaoDiDispatch}
                onResolveMaShiTradeChoice={resolveMaShiTradeChoice}
                onResolveKhanEdictChoice={resolveKhanEdictChoice}
                onResolveDiplomacyChoice={resolveDiplomacyChoice}
                onResolveDriveTigerConsent={resolveDriveTigerConsent}
                onResolveFortificationMaintenance={resolveFortificationMaintenance}
                upkeepAttritionPriority={upkeepAttritionPriority}
                onSelectUpkeepAttritionPriority={setUpkeepAttritionPriority}
                pendingCommittedTroops={pendingCommittedTroops}
                onSelectPendingCommittedTroops={setPendingCommittedTroops}
                pendingAttackerCasualtyPriority={pendingAttackerCasualtyPriority}
                pendingDefenderCasualtyPriority={pendingDefenderCasualtyPriority}
                onSelectPendingAttackerCasualtyPriority={setPendingAttackerCasualtyPriority}
                onSelectPendingDefenderCasualtyPriority={setPendingDefenderCasualtyPriority}
                onResolvePendingAction={resolvePendingAction}
                onResolvePostBattleDecision={resolvePostBattleDecision}
                wheelDispatchSelection={wheelDispatchSelection}
            />
            <HandInteractionTray
                core={core}
                actionPaymentPreviewVisible={actionPaymentPreviewVisible}
                handLimitDiscardSelection={handLimitDiscardSelection}
                selectedHandLimitCardIds={selectedHandLimitCardIds}
                onResolveHandLimitDiscard={resolveHandLimitDiscard}
                onConfirmSelectedAction={confirmSelectedAction}
                onCancelSelectedActionPreview={cancelActionPaymentPreview}
                onResolveSunYuanhuaTech={resolveSunYuanhuaTech}
            />
            <HandZone
                core={core}
                viewerFactionId={viewerFactionId}
                playerID={playerID}
                locale={locale}
                actionPaymentPreviewVisible={actionPaymentPreviewVisible}
                selectedPaymentCardIds={core.selectedPaymentCardIds}
                handLimitDiscardSelection={handLimitDiscardSelection}
                selectedHandLimitCardIds={selectedHandLimitCardIds}
                onTogglePaymentCard={togglePaymentCard}
                onToggleHandLimitDiscardCard={toggleHandLimitDiscardCard}
                onSelectSunYuanhuaTechCard={selectSunYuanhuaTechCard}
                onSelectGaoDiDispatchCard={selectGaoDiDispatchCard}
                onPreviewActionFromHandCard={previewActionFromHandCard}
                onMagnifyCard={setMagnifyTarget}
            />
            {topLevelMapSelectionGuide ? (
                <div className="pointer-events-none absolute inset-0 z-40">
                    {topLevelMapSelectionGuide.candidates.map((candidate) => {
                        const targetPoint = getTopLevelGuideRegionPoint(candidate.targetRegionId);
                        if (!targetPoint) {
                            return null;
                        }
                        return (
                            <button
                                key={`top-level-guide-hit-${candidate.id}`}
                                type="button"
                                data-testid={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}
                                aria-label={`${topLevelMapSelectionGuide.title}：${candidate.targetRegionName}`}
                                className="pointer-events-auto absolute cursor-pointer rounded-full border-0 bg-transparent p-0"
                                style={{
                                    left: targetPoint.x - 26,
                                    top: targetPoint.y - 26,
                                    width: 52,
                                    height: 52,
                                    outline: 'none',
                                    boxShadow: '0 0 0 3px rgba(255,236,190,0.68)',
                                }}
                                onClick={() => activateTopLevelGuideTarget(candidate)}
                            />
                        );
                    })}
                </div>
            ) : null}
            <EndgameOverlay {...endgameProps} />
            <QidahenCardMagnifyOverlay target={magnifyTarget} locale={locale} onClose={() => setMagnifyTarget(null)} />
            </StageRoot>
        </UndoProvider>
    );
};

export default QidahenBoard;
