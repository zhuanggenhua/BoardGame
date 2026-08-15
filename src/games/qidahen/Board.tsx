// @asset-pipeline-allow
// 区域命中蒙版需要直接读静态 png 像素生成运行时命中表，不走玩家可见贴图渲染链路。
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2 } from 'lucide-react';
import './qidahen-board.css';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import {
    SelectableGameObject,
    ZoomPanViewport,
    type ZoomPanViewportState,
    type ZoomPanViewportZoomAnchorArgs,
} from '../../components/game/framework';
import type { CardPreviewRef } from '../../core/types';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useGameAudio } from '../../lib/audio/useGameAudio';
import { CardPreview } from '../../components/common/media/CardPreview';
import { MagnifyOverlay } from '../../components/common/overlays/MagnifyOverlay';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { getCardAtlasSource } from '../../components/common/media/cardAtlasRegistry';
import { getLocalizedAssetPath, getOptimizedImageUrls } from '../../core/AssetLoader';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../../shared/mobileSupport';
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
    QidahenGrantPardonSelection,
    QidahenHandCard,
    QidahenHandLimitDiscardSelection,
    QidahenInternalDispatchSelection,
    QidahenMapToken,
    QidahenGrantPardonChoice,
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
    getQidahenGrantPardonSelectionFromInteraction,
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
    getQidahenGrantPardonSelectionForCore,
    getQidahenHandLimitDiscardSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './domain/interactionSelectionAccessors';
import {
    getQidahenMaShiTradeSelectionForCore as getCoreQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore as getCoreQidahenRecruitSelectionForCore,
} from './domain/selectionBuilders';
import {
    getQidahenDirectActionIdForHandCard,
    getQidahenHandCardBadgeKind,
} from './domain/handCardIdentity';
import { getActionChoiceById } from './domain/factionActionWindow';
import { getActionRuleDisplayRegionName } from './domain/regionRuleSemantics';
import { getQidahenStatefulRegionDisplayName } from './domain/runtimeRegionRules';
import { resolveQidahenPrimaryRuntimeRegionId } from './domain/regionConfig';
import { canPlaceRegularTroopsInRegion } from './domain/regionSelectionPreferences';
import {
    QIDAHEN_SCENARIO_SETUP_OPTIONS,
    getQidahenScenarioVoteMeta,
} from './roomSetup';
import {
    getQidahenScenarioCardPreview,
    getQidahenSetupArmamentPreview,
    getQidahenSetupCharacterPreview,
} from './ui/setupCardPreviews';

type QidahenYearCardSlot = QidahenCore['yearCards'][number];
import { getCurrentFactionId } from './domain/factionTurnAccessors';
import {
    isQidahenTacticCardPlayableForPendingBattle,
    QIDAHEN_COMMANDS,
} from './domain/commands';
import { isQidahenFeignedRetreatCardPlayable } from './domain/feignedRetreatSelection';
import {
    getQidahenDefeatInDetailSelectableSourceRegionIds,
    isQidahenDefeatInDetailOrderSelectionActive,
    isQidahenDefeatInDetailPlayable,
} from './domain/defeatInDetail';
import {
    buildPendingTargetChoiceOptions,
} from './domain/pendingTargetChoiceOptions';
import { buildPendingTargetAction } from './domain/pendingTargetActionBuilder';
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
import {
    buildQidahenRuntimeRegionIdByPixel,
    resolveQidahenRuntimeRegionEntryPoint,
} from './ui/runtimeRegionOwnership';
import qidahenRegionMaskUrl from './data/region-mask.png?url';
import { QIDAHEN_AUDIO_CONFIG } from './audio.config';
import { QIDAHEN_MANIFEST } from './manifest';
import { QidahenBoardShell, type QidahenBoardLayoutConfig } from './QidahenBoardShell';

type Props = GameBoardProps<QidahenCore, QidahenCommandMap>;

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

const ASSETS = {
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

const MAP_COVER_SCALE = Math.max(STAGE_WIDTH / QIDAHEN_MAP_WIDTH, STAGE_HEIGHT / QIDAHEN_MAP_HEIGHT);
const MAP_COVER_LEFT = (STAGE_WIDTH - QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE) / 2;
const MAP_COVER_TOP = (STAGE_HEIGHT - QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE) / 2;
const QIDAHEN_MAP_MIN_ZOOM = 1;
const QIDAHEN_MAP_MAX_ZOOM = 5;

type QidahenGuidePoint = { x: number; y: number };
type QidahenGuideBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    center: QidahenGuidePoint;
};
type QidahenGuideCandidate = {
    id: string;
    targetRegionId: string;
    targetRegionName: string;
    resolutionHint?: string;
    pathPoints: QidahenGuidePoint[];
    targetPoint?: QidahenGuidePoint;
    arrowTargetPoint?: QidahenGuidePoint;
    arrowHeadAnchorRatio?: number;
    targetFocusDisabled?: boolean;
    targetTokenIds?: string[];
    targetTokenBounds?: QidahenGuideBounds;
};

const buildQidahenGuideDisplayPoints = (
    points: QidahenGuidePoint[],
    trimLength: number,
): QidahenGuidePoint[] => {
    if (points.length < 2) {
        return points;
    }
    const result = points.map((point) => ({ ...point }));
    let remainingTrim = trimLength;
    for (let index = result.length - 1; index > 0 && remainingTrim > 0; index -= 1) {
        const current = result[index];
        const previous = result[index - 1];
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        const segmentLength = Math.hypot(dx, dy);
        if (segmentLength <= 0) {
            result.pop();
            continue;
        }
        if (segmentLength > remainingTrim) {
            const ratio = (segmentLength - remainingTrim) / segmentLength;
            result[index] = {
                x: previous.x + dx * ratio,
                y: previous.y + dy * ratio,
            };
            return result;
        }
        remainingTrim -= segmentLength;
        result.pop();
    }
    return result.length >= 2 ? result : points;
};

const buildQidahenGuideArrowHeadPath = (
    center: QidahenGuidePoint,
    tangent: QidahenGuidePoint,
    length: number,
    width: number,
): string => {
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const unitX = tangent.x / tangentLength;
    const unitY = tangent.y / tangentLength;
    const normalX = -unitY;
    const normalY = unitX;
    const arrowTip = { x: center.x + unitX * length, y: center.y + unitY * length };
    const leftTail = {
        x: center.x - unitX * (length * 0.46) + normalX * width,
        y: center.y - unitY * (length * 0.46) + normalY * width,
    };
    const rightTail = {
        x: center.x - unitX * (length * 0.46) - normalX * width,
        y: center.y - unitY * (length * 0.46) - normalY * width,
    };
    return [
        `M ${arrowTip.x} ${arrowTip.y}`,
        `L ${leftTail.x} ${leftTail.y}`,
        `L ${rightTail.x} ${rightTail.y}`,
        'Z',
    ].join(' ');
};

const buildQidahenGuideLinePath = (points: QidahenGuidePoint[], curved: boolean = true): string | null => {
    if (points.length < 2) {
        return null;
    }
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (!curved) {
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    const curveLift = Math.min(108, Math.max(34, distance * 0.14));
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const control1 = {
        x: start.x + dx * 0.24 + normalX * curveLift,
        y: start.y + dy * 0.18 + normalY * curveLift,
    };
    const control2 = {
        x: start.x + dx * 0.78 + normalX * (curveLift * 0.72),
        y: start.y + dy * 0.84 + normalY * (curveLift * 0.72),
    };
    return `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
};

const buildQidahenGuideArrow = (
    points: QidahenGuidePoint[],
    lineTrimLength: number,
    headLength: number,
    headWidth: number,
    headAnchorRatio: number = 0.952,
): { linePath: string | null; headPath: string | null } => {
    if (points.length < 2) {
        return { linePath: null, headPath: null };
    }
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    const curveLift = Math.min(108, Math.max(34, distance * 0.14));
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const control1 = {
        x: start.x + dx * 0.24 + normalX * curveLift,
        y: start.y + dy * 0.18 + normalY * curveLift,
    };
    const control2 = {
        x: start.x + dx * 0.78 + normalX * (curveLift * 0.72),
        y: start.y + dy * 0.84 + normalY * (curveLift * 0.72),
    };
    const lineEnd = {
        x: start.x + (end.x - start.x) * Math.max(0.4, headAnchorRatio - 0.037),
        y: start.y + (end.y - start.y) * Math.max(0.4, headAnchorRatio - 0.037),
    };
    const displayPoints = buildQidahenGuideDisplayPoints([start, control1, control2, lineEnd], lineTrimLength);
    const linePath = buildQidahenGuideLinePath(displayPoints);
    const headCenter = {
        x: start.x + dx * headAnchorRatio,
        y: start.y + dy * headAnchorRatio,
    };
    const headTangent = {
        x: 3 * (end.x - control2.x),
        y: 3 * (end.y - control2.y),
    };
    return {
        linePath,
        headPath: buildQidahenGuideArrowHeadPath(headCenter, headTangent, headLength, headWidth),
    };
};

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
    mapOpenPanelShadow: '0 3px 8px rgba(56,35,15,0.1), inset 0 0 0 1px rgba(255,250,232,0.62), inset 0 -1px 0 rgba(95,71,45,0.1)',
    bookPaper: [
        'linear-gradient(90deg, rgba(174,129,73,0.22) 0%, transparent 7%, transparent 93%, rgba(112,78,38,0.18) 100%)',
        'linear-gradient(180deg, rgba(255,248,224,0.98) 0%, rgba(237,218,174,0.98) 56%, rgba(217,190,132,0.98) 100%)',
        'radial-gradient(circle at 18% 14%, rgba(255,255,242,0.55), transparent 32%)',
    ].join(', '),
    bookPage: [
        'linear-gradient(180deg, rgba(255,250,232,0.96) 0%, rgba(236,218,176,0.94) 100%)',
        'radial-gradient(circle at 16% 12%, rgba(255,255,245,0.42), transparent 36%)',
    ].join(', '),
    cutCorner: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px)',
    smallCutCorner: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
} as const;

const CARD_DIMENSIONS = {
    deck: { width: 154, height: 214, rawWidth: 476, rawHeight: 660 },
    koreaRailThumbnail: { width: 38, height: 54, rawWidth: 476, rawHeight: 660 },
    year: { width: 154, height: 214, rawWidth: 476, rawHeight: 661 },
    hand: { width: 182, height: 251, rawWidth: 487, rawHeight: 672 },
} as const;

const BOTTOM_DOCK_INSET = 0;
const MOBILE_LANDSCAPE_BOTTOM_DOCK_INSET = 0;
const MOBILE_LANDSCAPE_TOP_SAFE_INSET = 18;
const MOBILE_LANDSCAPE_CHRONOLOGY_TOP = 670;
const QIDAHEN_BOARD_LAYOUT: QidahenBoardLayoutConfig = {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    mobileMaxViewportWidth: MOBILE_MAX_VIEWPORT_WIDTH,
    bottomDockInset: BOTTOM_DOCK_INSET,
    mobileLandscapeTopSafeInset: MOBILE_LANDSCAPE_TOP_SAFE_INSET,
    mobileLandscapeBottomDockInset: MOBILE_LANDSCAPE_BOTTOM_DOCK_INSET,
    mobileLandscapeChronologyTop: MOBILE_LANDSCAPE_CHRONOLOGY_TOP,
};
const HAND_DOCK_WIDTH = 1310;
const MOBILE_LANDSCAPE_HAND_CARD_MIN_WIDTH = 92;
const MOBILE_LANDSCAPE_HAND_CARD_MAX_WIDTH = 118;
const HAND_ROW_HORIZONTAL_PADDING = 16;
const MOBILE_LANDSCAPE_VISIBLE_HAND_LIMIT = 6;
const HAND_CARD_SELECTED_LIFT = 46;
const HAND_CARD_SELECTED_SCALE = 1.055;
const QIDAHEN_STAGE_BG = '#c8a970';
const BOTTOM_DOCK_HEIGHT = CARD_DIMENSIONS.hand.height + HAND_CARD_SELECTED_LIFT + 4;
const HAND_INTERACTION_TRAY_WIDTH = 860;
const HAND_INTERACTION_TRAY_BOTTOM = BOTTOM_DOCK_HEIGHT + 10;
const ACTIONS_DOCK_WIDTH = 350;
const ACTIONS_DOCK_RIGHT = 80;

const getQidahenHandCardTutorialTargetId = (card: QidahenHandCard): string => (
    card.cardDefId ?? card.id
);

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

const armyHiddenBackColorByFaction: Record<QidahenFactionId | 'neutral', string> = {
    ming: UI_STYLE.cinnabar,
    mongol: UI_STYLE.oldGold,
    jin: UI_STYLE.bronze,
    neutral: UI_STYLE.paperDeep,
};

const shouldRevealQidahenMapArmyToken = (
    token: QidahenMapToken,
    viewerFactionId: QidahenFactionId | null,
    revealedBattleRegionIds: ReadonlySet<string>,
): boolean => {
    if (token.type !== 'army') {
        return true;
    }
    if (viewerFactionId != null && token.faction === viewerFactionId) {
        return true;
    }
    return token.regionId != null && revealedBattleRegionIds.has(token.regionId);
};

const buildRevealedBattleRegionIds = (
    pendingTargetAction: QidahenCore['pendingTargetAction'],
    postBattleSelection: QidahenCore['postBattleSelection'],
): ReadonlySet<string> => {
    const regionIds = [
        pendingTargetAction?.sourceRegionId,
        pendingTargetAction?.targetRegionId,
        pendingTargetAction?.targetRuntimeRegionId,
        pendingTargetAction?.attackerPositionRegionId,
        postBattleSelection?.sourceRegionId,
        postBattleSelection?.targetRegionId,
        postBattleSelection?.targetRuntimeRegionId,
        postBattleSelection?.attackerPositionRegionId,
    ].filter((regionId): regionId is string => Boolean(regionId));
    return new Set(regionIds);
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

const renderQidahenWheelVerticalText = (
    text: string,
    x: number,
    y: number,
    options: {
        className: string;
        fontSize: number;
        fontWeight: number;
    },
) => {
    const chars = Array.from(text);
    const lineHeight = options.fontSize * 1.12;
    const top = y - ((chars.length - 1) * lineHeight) / 2;

    return (
        <text
            x={x}
            y={top}
            textAnchor="middle"
            dominantBaseline="middle"
            className={options.className}
            style={{
                fontFamily: 'KaiTi, STKaiti, Songti SC, serif',
                fontSize: `${options.fontSize}px`,
                fontWeight: options.fontWeight,
                letterSpacing: 0,
            }}
        >
            {chars.map((char, index) => (
                <tspan key={`${text}-${index}-${char}`} x={x} y={top + index * lineHeight}>
                    {char}
                </tspan>
            ))}
        </text>
    );
};

const getQidahenMobileLandscapeHandLayout = (dockWidth: number) => {
    const availableWidth = Math.max(240, dockWidth - HAND_ROW_HORIZONTAL_PADDING * 2);
    const fourCardWidth = Math.floor((availableWidth - HAND_ROW_HORIZONTAL_PADDING) / 4);
    const width = Math.max(
        MOBILE_LANDSCAPE_HAND_CARD_MIN_WIDTH,
        Math.min(MOBILE_LANDSCAPE_HAND_CARD_MAX_WIDTH, fourCardWidth),
    );
    return {
        availableWidth,
        width,
        height: Math.round(width * CARD_DIMENSIONS.hand.height / CARD_DIMENSIONS.hand.width),
    };
};

const getQidahenHandCardOverlapPx = (
    handCount: number,
    cardWidth: number = CARD_DIMENSIONS.hand.width,
    availableWidth?: number,
): number => {
    if (availableWidth != null && handCount > 1) {
        const visibleCardCount = Math.min(handCount, MOBILE_LANDSCAPE_VISIBLE_HAND_LIMIT);
        const visibleRowWidth = Math.max(cardWidth, availableWidth - HAND_ROW_HORIZONTAL_PADDING);
        const fitOverlap = Math.floor(
            (visibleRowWidth - cardWidth * visibleCardCount) / (visibleCardCount - 1),
        );
        return Math.max(-64, Math.min(0, fitOverlap));
    }
    if (handCount <= 6) {
        return 0;
    }
    return -Math.min(18 + Math.max(0, handCount - 7) * 12, 60);
};

const resolveViewerFactionId = (
    core: QidahenCore,
    playerID: string | null,
): QidahenFactionId | null => (
    core.factionSelection
        ? null
        : (playerID
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
    const scaledMapWidth = QIDAHEN_MAP_WIDTH * MAP_COVER_SCALE * zoom;
    const scaledMapHeight = QIDAHEN_MAP_HEIGHT * MAP_COVER_SCALE * zoom;
    const minPanX = STAGE_WIDTH - MAP_COVER_LEFT - scaledMapWidth;
    const maxPanX = -MAP_COVER_LEFT;
    const minPanY = STAGE_HEIGHT - MAP_COVER_TOP - scaledMapHeight;
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

const buildQidahenFocusedMapViewport = (
    point: { x: number; y: number },
    zoom: number = 1.62,
): QidahenMapViewport => (
    clampQidahenMapViewport({
        zoom,
        panX: (STAGE_WIDTH / 2) - MAP_COVER_LEFT - point.x * MAP_COVER_SCALE * zoom,
        panY: (STAGE_HEIGHT / 2) - MAP_COVER_TOP - point.y * MAP_COVER_SCALE * zoom,
    })
);

const buildQidahenFocusedMapViewportForPoints = (
    points: Array<{ x: number; y: number }>,
    zoom: number = 1.48,
): QidahenMapViewport | null => {
    if (points.length <= 0) {
        return null;
    }
    if (points.length === 1) {
        return buildQidahenFocusedMapViewport(points[0], zoom);
    }
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const focusPoint = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
    };
    return clampQidahenMapViewport({
        zoom,
        panX: (STAGE_WIDTH / 2) - MAP_COVER_LEFT - focusPoint.x * MAP_COVER_SCALE * zoom,
        panY: (STAGE_HEIGHT * 0.44) - MAP_COVER_TOP - focusPoint.y * MAP_COVER_SCALE * zoom,
    });
};

const QIDAHEN_MAP_GUIDE_TARGET_PREFIX = 'qidahen-map-guide-hit-target-';

const getQidahenTutorialMapFocusRegionId = (
    highlightTarget: string | null | undefined,
): string | null => {
    if (!highlightTarget?.startsWith(QIDAHEN_MAP_GUIDE_TARGET_PREFIX)) {
        return null;
    }
    return highlightTarget.slice(QIDAHEN_MAP_GUIDE_TARGET_PREFIX.length) || null;
};

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
        return '轮盘落点行动';
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
            return '选军备牌升级';
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
            return '选军备牌升级';
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
    if (options.actionPaymentPreviewVisible && core.selectedActionId) {
        return getActionChoiceById(core.selectedActionId)
            ?? core.actionChoices.find((action) => action.id === core.selectedActionId)
            ?? null;
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

const formatQidahenTutorialWheelTurnLabel = (turnLabel: string): string => (
    turnLabel.replace(/ · [^·]+$/, ' · 轮盘推进')
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
    if (choice.id === 'defender-hold-city') {
        return '守城避战';
    }
    if (choice.id === 'defender-sortie') {
        return '出城野战';
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
    const selectedAction = actionPaymentPreviewVisible && core.selectedActionId
        ? [getActionChoiceById(core.selectedActionId), ...core.actionChoices]
            .find((action) => action?.id === core.selectedActionId && action.cost > 0) ?? null
        : null;
    const sunYuanhuaSelection = core.sunYuanhuaTechSelection;
    const selectedPaymentRegionId = core.explicitRegionId ?? core.selectedRegionId;
    const selectedPaymentRegion = core.regions.find((region) => region.id === selectedPaymentRegionId);
    const raidPaymentPreview = selectedAction?.id === 'raid' && selectedPaymentRegion
        ? buildPendingTargetAction(
            core,
            getCurrentFactionId(core),
            'raid',
            selectedPaymentRegion,
            selectedPaymentRegionId,
        )
        : null;

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
                            {selectedAction.id === 'upgrade-armament'
                                ? t('board.handInteraction.armamentPaymentStatus', {
                                    cost: selectedAction.cost,
                                    selected: core.selectedPaymentCardIds.length,
                                    defaultValue: '需选 {{cost}} 张军备牌 · 已选 {{selected}} 张',
                                })
                                : t('board.handInteraction.actionPaymentStatus', {
                                    cost: selectedAction.cost,
                                    selected: core.selectedPaymentCardIds.length,
                                    defaultValue: '需弃 {{cost}} 张 · 已选 {{selected}} 张',
                                })}
                        </div>
                        <div className="mt-1 text-[11px]" data-testid="qidahen-action-payment-hint" style={{ color: '#f3d1a5' }}>
                            {selectedAction.id === 'raid'
                                ? raidPaymentPreview
                                    ? t('board.handInteraction.raidPaymentTarget', {
                                        targetRegionName: raidPaymentPreview.targetRegionName,
                                        resolutionHint: raidPaymentPreview.resolutionHint,
                                        defaultValue: '目标：{{targetRegionName}} · {{resolutionHint}}',
                                    })
                                    : t('board.handInteraction.raidPaymentInvalidTarget', {
                                        defaultValue: '当前地区不能发动突袭，请在地图上选择高亮的合法目标',
                                    })
                                : selectedAction.id === 'upgrade-armament'
                                ? t('board.handInteraction.armamentPaymentHint', {
                                    defaultValue: '点选要使用的军备牌；先作为升级军备打出，结算后才进入弃牌堆。',
                                })
                                : t('board.handInteraction.actionPaymentHint', {
                                    defaultValue: '点击底部手牌选择要弃掉的牌；再次点击已选手牌可取消该张。',
                                })}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            data-testid="qidahen-action-payment-confirm"
                            disabled={confirmTutorialLocked || core.selectedPaymentCardIds.length < selectedAction.cost || (selectedAction.id === 'raid' && !raidPaymentPreview)}
                            className="inline-flex min-h-[44px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                            onClick={onConfirmSelectedAction}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            {selectedAction.id === 'upgrade-armament'
                                ? t('board.handInteraction.confirmUseArmament', { defaultValue: '使用并升级' })
                                : t('board.handInteraction.confirmExecute', { defaultValue: '确认执行' })}
                        </button>
                        <button
                            type="button"
                            data-testid="qidahen-action-payment-cancel"
                            disabled={cancelTutorialLocked}
                            className="inline-flex min-h-[44px] min-w-[152px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
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

const HAND_CARD_KIND_LABELS = {
    event: '事件',
    armament: '军备',
    tactic: '战术',
    silver: '银两',
    character: '人物',
    scenario: '剧本',
    chronology: '纪年',
    'card-back': '牌背',
} satisfies Record<'event' | 'armament' | 'tactic' | 'silver' | 'character' | 'scenario' | 'chronology' | 'card-back', string>;

const QidahenCardMagnifyOverlay: React.FC<{
    target: QidahenMagnifyTarget | null;
    locale?: string;
    onClose: () => void;
}> = ({ target, locale, onClose }) => (
    <MagnifyOverlay
        isOpen={target != null}
        onClose={onClose}
        containerClassName="max-h-[82vh] max-w-[92vw]"
        overlayClassName="bg-black/46"
        overlayTestId="qidahen-card-magnify-overlay"
        closeLabel="关闭查看"
        closeButtonClassName="!-top-11 min-h-11 !border !border-white/60 !bg-black/80 px-5 !text-white !shadow-lg hover:!bg-black/95"
    >
        {target ? (
            <div
                data-testid="qidahen-card-magnify-content"
                className="relative overflow-hidden rounded-[10px] border-[3px]"
                style={{
                    width: `min(92vw, calc(78vh * (${target.rawWidth} / ${target.rawHeight})))`,
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

const StaticMapScene: React.FC<{ locale?: string }> = ({ locale }) => (
    <OptimizedImage
        src={ASSETS.mainMap}
        locale={locale}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        data-testid="qidahen-static-map-scene"
        draggable={false}
        placeholder={false}
    />
);

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
            className="relative flex h-[58px] min-w-0 flex-1 items-center gap-2 overflow-hidden border px-2.5"
            data-testid={`qidahen-player-${faction.id}`}
            style={{
                borderColor: current ? tone.border : UI_STYLE.mapInk,
                background: current ? UI_SURFACE.mapOpenPanelSelected : UI_SURFACE.mapOpenPanel,
                color: UI_STYLE.ink,
                boxShadow: current ? UI_SURFACE.mapOpenPanelShadow : '0 2px 7px rgba(56,35,15,0.08), inset 0 0 0 1px rgba(255,250,232,0.42)',
                borderRadius: 10,
            }}
        >
            <span
                className="pointer-events-none absolute inset-y-0 left-0 w-[5px]"
                style={{ background: current ? tone.border : 'rgba(210,183,117,0.72)' }}
            />
            <span className="pointer-events-none absolute inset-x-[16px] top-[3px] h-[1px]" style={{ background: 'rgba(232,200,133,0.34)' }} />
            <OptimizedImage
                src={tone.chip}
                alt={faction.name}
                className="h-9 w-9 shrink-0 rounded-full border object-cover"
                style={{ borderColor: tone.border, boxShadow: '0 2px 6px rgba(56,35,15,0.18)' }}
                draggable={false}
                placeholder={false}
            />
            <div className="min-w-0 flex-1 text-[15px] font-black leading-none tracking-[0.02em]">
                <div className="min-w-0 whitespace-nowrap">
                    <span>{faction.name}</span>
                    <span className="ml-2 text-[12px]" style={{ color: UI_STYLE.bronze }}>VP{effectiveVp}</span>
                    {prestigeBonus > 0 ? (
                        <span className="ml-2 text-[11px]" style={{ color: UI_STYLE.bronze }}>
                            {t('board.player.prestigeBonus', {
                                bonus: prestigeBonus,
                                defaultValue: '汉城+{{bonus}}',
                            })}
                        </span>
                    ) : null}
                    <span className="ml-2 text-[12px]" style={{ color: UI_STYLE.bronze }}>{faction.handCount}/{faction.handLimit}</span>
                </div>
                <div
                    className="mt-1 truncate text-[11px] leading-none"
                    data-testid={`qidahen-armaments-${faction.id}`}
                    style={{ color: UI_STYLE.mutedInk }}
                >
                    {t('board.player.armaments', {
                        summary: armamentSummary,
                        defaultValue: '军备 {{summary}}',
                    })}
                </div>
                <div
                    className="mt-1 truncate text-[11px] leading-none"
                    data-testid={`qidahen-character-markers-${faction.id}`}
                    style={{ color: markedCharacters.length > 0 ? UI_STYLE.mutedInk : 'rgba(42,31,21,0.62)' }}
                >
                    {characterSummary}
                </div>
            </div>
            {faction.defeatMarkers > 0 ? (
                <span
                    className="grid h-[24px] min-w-[38px] shrink-0 place-items-center border px-1.5 text-[11px] font-black"
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: 'rgba(238, 210, 159, 0.78)',
                        color: UI_STYLE.ink,
                        boxShadow: `0 2px 5px ${UI_STYLE.shadowSoft}`,
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
                    className="grid h-[24px] w-[44px] shrink-0 place-items-center border text-[11px] font-black"
                    style={{
                        background: 'linear-gradient(180deg, rgba(216,123,82,0.78) 0%, rgba(180,76,54,0.72) 100%)',
                        borderColor: UI_STYLE.mapInk,
                        color: UI_STYLE.ink,
                        boxShadow: `0 2px 5px ${UI_STYLE.cinnabarGlow}`,
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
            className="pointer-events-auto absolute left-[740px] top-[16px] z-40 flex w-[720px] gap-2"
            data-testid="qidahen-player-float"
            data-ui-anchor="top-right"
            style={{
                left: 'calc(740px + var(--qidahen-mobile-edge-pull, 0px))',
                top: 'calc(16px + var(--qidahen-mobile-top-inset, 0px))',
            }}
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

const MapToken: React.FC<{
    token: QidahenMapToken;
    revealFront: boolean;
    pendingCommittedSelected?: boolean;
    pendingCommittedSelectable?: boolean;
    onSelectPendingCommittedTroops?: (committedTroops: number) => void;
    pincerAdvanceSelected?: boolean;
    pincerAdvanceSelectable?: boolean;
    onTogglePincerAdvanceTroop?: (choiceId: string) => void;
    instigateDefectionSelectable?: boolean;
    onResolveInstigateDefection?: (choiceId: string) => void;
    wuzhenChaohaSelectable?: boolean;
    onResolveWuzhenChaoha?: (choiceId: string) => void;
}> = ({
    token,
    revealFront,
    pendingCommittedSelected = false,
    pendingCommittedSelectable = false,
    onSelectPendingCommittedTroops,
    pincerAdvanceSelected = false,
    pincerAdvanceSelectable = false,
    onTogglePincerAdvanceTroop,
    instigateDefectionSelectable = false,
    onResolveInstigateDefection,
    wuzhenChaohaSelectable = false,
    onResolveWuzhenChaoha,
}) => {
    const { t } = useTranslation('game-qidahen');
    const size = token.size ?? 30;
    const tone = factionTone[token.faction === 'neutral' ? 'ming' : token.faction];
    const isArmyToken = token.type === 'army';
    const tokenShapeClass = isArmyToken ? 'rounded-[6px]' : token.type === 'control' ? 'rounded-full' : '';
    const showImageValueBadge = token.type === 'control' && typeof token.value === 'number';
    const showTokenImage = Boolean(token.imageSrc) && (!isArmyToken || revealFront);
    const pendingCommittedTone = pendingCommittedSelected
        ? {
            opacity: 1,
            boxShadow: '0 0 0 1px rgba(29, 83, 36, 0.72), 0 0 7px rgba(112, 238, 124, 0.34)',
            filter: 'brightness(1.07) saturate(1.08)',
        }
        : pendingCommittedSelectable
            ? {
                opacity: 1,
                boxShadow: '0 0 0 1px rgba(29, 83, 36, 0.6), 0 0 5px rgba(91, 215, 101, 0.28)',
                filter: 'brightness(1.04) saturate(1.05)',
            }
            : undefined;
    const pincerAdvanceTone = pincerAdvanceSelected
        ? {
            opacity: 1,
            boxShadow: '0 0 0 1.5px rgba(42, 109, 48, 0.88), 0 0 8px rgba(124, 244, 134, 0.48)',
            filter: 'brightness(1.08) saturate(1.1)',
        }
        : pincerAdvanceSelectable
            ? {
                opacity: 1,
                boxShadow: '0 0 0 1px rgba(42, 109, 48, 0.72), 0 0 5px rgba(100, 220, 112, 0.32)',
                filter: 'brightness(1.04) saturate(1.05)',
            }
            : undefined;
    const instigateDefectionTone = instigateDefectionSelectable
        ? {
            opacity: 1,
            boxShadow: '0 0 0 1.5px rgba(42, 109, 48, 0.9), 0 0 8px rgba(124, 244, 134, 0.5)',
            filter: 'brightness(1.08) saturate(1.1)',
        }
        : undefined;
    const wuzhenChaohaTone = wuzhenChaohaSelectable
        ? {
            opacity: 1,
            boxShadow: '0 0 0 1.5px rgba(42, 109, 48, 0.9), 0 0 8px rgba(124, 244, 134, 0.5)',
            filter: 'brightness(1.08) saturate(1.1)',
        }
        : undefined;
    const resolvedSelectionTone = wuzhenChaohaTone ?? instigateDefectionTone ?? pincerAdvanceTone ?? pendingCommittedTone;
    const tokenSelectable = pendingCommittedSelectable || pincerAdvanceSelectable || instigateDefectionSelectable || wuzhenChaohaSelectable;
    const resolvedBoxShadow = resolvedSelectionTone?.boxShadow;
    return (
        <div
            className={`${tokenSelectable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} absolute grid place-items-center text-[13px] font-black ${tokenShapeClass}`}
            data-testid={`qidahen-map-token-${token.id}`}
            data-qidahen-map-token-type={token.type}
            data-qidahen-map-token-faction={token.faction}
            data-qidahen-map-token-region={token.regionId}
            data-qidahen-army-face={isArmyToken ? (revealFront ? 'front' : 'hidden-back') : undefined}
            data-pending-committed-selectable={pendingCommittedSelectable ? 'true' : undefined}
            data-pending-committed-selected={pendingCommittedSelectable ? String(pendingCommittedSelected) : undefined}
            data-pending-committed-index={pendingCommittedSelectable ? token.troopIndex : undefined}
            data-pincer-advance-selectable={pincerAdvanceSelectable ? 'true' : undefined}
            data-pincer-advance-selected={pincerAdvanceSelectable ? String(pincerAdvanceSelected) : undefined}
            data-instigate-defection-selectable={instigateDefectionSelectable ? 'true' : undefined}
            data-wuzhen-chaoha-selectable={wuzhenChaohaSelectable ? 'true' : undefined}
            role={tokenSelectable ? 'button' : undefined}
            aria-pressed={tokenSelectable && !instigateDefectionSelectable && !wuzhenChaohaSelectable ? (pincerAdvanceSelectable ? pincerAdvanceSelected : pendingCommittedSelected) : undefined}
            tabIndex={tokenSelectable ? 0 : undefined}
            onClick={wuzhenChaohaSelectable
                ? () => onResolveWuzhenChaoha?.(token.id)
                : instigateDefectionSelectable
                ? () => onResolveInstigateDefection?.(token.id)
                : pincerAdvanceSelectable
                    ? () => onTogglePincerAdvanceTroop?.(token.id)
                    : pendingCommittedSelectable && token.troopIndex
                        ? () => onSelectPendingCommittedTroops?.(token.troopIndex!)
                        : undefined}
            onKeyDown={tokenSelectable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (wuzhenChaohaSelectable) {
                            onResolveWuzhenChaoha?.(token.id);
                        } else if (instigateDefectionSelectable) {
                            onResolveInstigateDefection?.(token.id);
                        } else if (pincerAdvanceSelectable) {
                            onTogglePincerAdvanceTroop?.(token.id);
                        } else if (token.troopIndex) {
                            onSelectPendingCommittedTroops?.(token.troopIndex);
                        }
                    }
                }
                : undefined}
            style={{
                left: token.x * QIDAHEN_MAP_WIDTH,
                top: token.y * QIDAHEN_MAP_HEIGHT,
                width: size,
                height: size,
                color: UI_STYLE.ink,
                transform: `translate(-50%, -50%) rotate(${token.rotationDeg ?? 0}deg)`,
                opacity: resolvedSelectionTone?.opacity,
                filter: resolvedSelectionTone?.filter,
                boxShadow: resolvedBoxShadow,
                zIndex: tokenSelectable ? 64 : undefined,
            }}
        >
            {showTokenImage ? (
                <>
                    <OptimizedImage
                        src={token.imageSrc}
                        alt={token.id}
                        className={`h-full w-full object-cover ${tokenShapeClass}`}
                        draggable={false}
                        placeholder={false}
                        style={{ boxShadow: tokenSelectable ? 'none' : `0 2px 8px ${UI_STYLE.shadowSoft}` }}
                    />
                    {showImageValueBadge ? (
                        <span
                            className={`absolute -bottom-1 -right-1 grid min-h-[18px] min-w-[18px] place-items-center border-[2px] px-1 text-[11px] leading-none ${tokenShapeClass}`}
                            style={{ borderColor: tone.border, background: UI_STYLE.paperLight, color: UI_STYLE.ink, boxShadow: `0 2px 6px ${UI_STYLE.shadowSoft}` }}
                        >
                            {token.value}
                        </span>
                    ) : null}
                </>
            ) : isArmyToken ? (
                <span
                    className={`grid h-full w-full place-items-center border-2 ${tokenShapeClass}`}
                    data-qidahen-army-face="hidden-back"
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: armyHiddenBackColorByFaction[token.faction],
                        boxShadow: `inset 0 0 0 1px rgba(255,241,205,0.22), 0 2px 8px ${UI_STYLE.shadowSoft}`,
                    }}
                    aria-label={t('board.map.armyBackAlt', { defaultValue: '部队背面' })}
                />
            ) : (
                <span
                    className={`grid h-full w-full place-items-center border-2 ${tokenShapeClass}`}
                    style={{ borderColor: tone.border, background: UI_STYLE.paperLight }}
                >
                    {token.value}
                </span>
            )}
            {pendingCommittedSelectable ? (
                <span
                    aria-hidden="true"
                    data-testid={`qidahen-pending-committed-highlight-${token.id}`}
                    className={`pointer-events-none absolute inset-[-2px] ${tokenShapeClass}`}
                    style={{
                        border: pendingCommittedSelected ? '1.5px solid #8cf694' : '1.5px solid #69d873',
                        background: pendingCommittedSelected ? 'rgba(101, 255, 128, 0.045)' : 'rgba(87, 240, 103, 0.028)',
                        boxShadow: pendingCommittedSelected
                            ? '0 0 6px rgba(134, 255, 145, 0.42), inset 0 0 3px rgba(134, 255, 145, 0.14)'
                            : '0 0 5px rgba(93, 240, 108, 0.34), inset 0 0 2px rgba(93, 240, 108, 0.1)',
                    }}
                />
            ) : null}
            {pincerAdvanceSelectable ? (
                <span
                    aria-hidden="true"
                    data-testid={`qidahen-pincer-advance-highlight-${token.id}`}
                    className={`pointer-events-none absolute inset-[-2px] ${tokenShapeClass}`}
                    style={{
                        border: pincerAdvanceSelected ? '1.5px solid #8cf694' : '1.25px solid #69d873',
                        background: pincerAdvanceSelected ? 'rgba(101, 255, 128, 0.05)' : 'rgba(87, 240, 103, 0.025)',
                        boxShadow: pincerAdvanceSelected
                            ? '0 0 7px rgba(134, 255, 145, 0.46), inset 0 0 3px rgba(134, 255, 145, 0.14)'
                            : '0 0 4px rgba(93, 240, 108, 0.28)',
                    }}
                />
            ) : null}
        </div>
    );
};

const MapSceneLayer: React.FC<{
    core: QidahenCore;
    perspectiveFactionId: QidahenFactionId | null;
    mapHitTestingDisabled?: boolean;
    wheelDispatchSelection: QidahenWheelDispatchSelection | null;
    grantPardonSelection: QidahenGrantPardonSelection | null;
    grantPardonMapChoices: QidahenGrantPardonSelection['choices'];
    internalDispatchSelection: QidahenInternalDispatchSelection | null;
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    pendingCommittedTroops?: number;
    onSelectPendingCommittedTroops?: (committedTroops: number) => void;
    onTogglePincerAdvanceTroop?: (choiceId: string) => void;
    onResolveInstigateDefection?: (choiceId: string) => void;
    onResolveWuzhenChaoha?: (choiceId: string) => void;
    tutorialStepId?: string | null;
    tutorialGuideTargetRegionId?: string | null;
    compactRegionTip: boolean;
    viewport: QidahenMapViewport;
    onViewportChange: (viewport: QidahenMapViewport) => void;
    locale?: string;
    onSelectRegion: (regionId: string) => void;
}> = ({ core, perspectiveFactionId, mapHitTestingDisabled = false, wheelDispatchSelection, grantPardonSelection, grantPardonMapChoices, internalDispatchSelection, pendingTargetAction, pendingCommittedTroops, onSelectPendingCommittedTroops, onTogglePincerAdvanceTroop, onResolveInstigateDefection, onResolveWuzhenChaoha, tutorialStepId, tutorialGuideTargetRegionId, compactRegionTip, viewport, onViewportChange, locale, onSelectRegion }) => {
    const { t } = useTranslation('game-qidahen');
    const currentFactionId = perspectiveFactionId;
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const hitmapRef = React.useRef<Uint8ClampedArray | null>(null);
    const runtimeRegionIdByPixelRef = React.useRef<Array<string | null> | null>(null);
    const [runtimeRegionOwnership, setRuntimeRegionOwnership] = React.useState<Array<string | null> | null>(null);
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
                const nextRuntimeRegionOwnership = buildQidahenRuntimeRegionIdByPixel(
                    formalHitmap,
                    QIDAHEN_MAP_WIDTH,
                    QIDAHEN_MAP_HEIGHT,
                );
                runtimeRegionIdByPixelRef.current = nextRuntimeRegionOwnership;
                setRuntimeRegionOwnership(nextRuntimeRegionOwnership);
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
    const defeatInDetailSelectableSourceRegionIds = React.useMemo(
        () => getQidahenDefeatInDetailSelectableSourceRegionIds(pendingTargetAction),
        [pendingTargetAction],
    );

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
        const wheelDispatchTargetRegionIds = new Set(
            pendingCommittedTroops != null && pendingCommittedTroops > 0
                ? wheelDispatchSelection?.candidates.map((candidate) => candidate.targetRuntimeRegionId) ?? []
                : [],
        );
        const activeWheelDispatchTargetRegionId = hoveredRegionId && wheelDispatchTargetRegionIds.has(hoveredRegionId)
            ? hoveredRegionId
            : tutorialGuideTargetRegionId && wheelDispatchTargetRegionIds.has(tutorialGuideTargetRegionId)
                ? tutorialGuideTargetRegionId
                : core.explicitRegionId && wheelDispatchTargetRegionIds.has(core.explicitRegionId)
                    ? core.explicitRegionId
                    : wheelDispatchSelection?.candidates[0]?.targetRuntimeRegionId ?? null;
        applyTone(wheelDispatchSelection?.sourceRegionId, 'source');
        if (activeWheelDispatchTargetRegionId) {
            applyTone(activeWheelDispatchTargetRegionId, 'activeDispatch');
        }
        applyTone(core.gaoDiDispatchSelection?.sourceRegionId, 'source');
        applyTone(internalDispatchSelection?.sourceRegionId, 'source');
        if (defeatInDetailSelectableSourceRegionIds.length > 0) {
            for (const sourceRegionId of defeatInDetailSelectableSourceRegionIds) {
                applyTone(sourceRegionId, 'dispatch');
            }
        } else {
            applyTone(pendingTargetAction?.sourceRegionId, 'source');
        }
        if (isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection)) {
            for (const candidate of core.gaoDiDispatchSelection?.candidates ?? []) {
                applyTone(candidate.targetRegionId, 'dispatch');
            }
        }
        for (const candidate of internalDispatchSelection?.candidates ?? []) {
            applyTone(candidate.targetRegionId, 'dispatch');
        }
        for (const choice of grantPardonMapChoices) {
            if (tutorialStepId !== 'choose-grant-pardon-target') {
                applyTone(choice.sourceRegionId, 'source');
            }
            applyTone(choice.targetRegionId, 'dispatch');
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
        defeatInDetailSelectableSourceRegionIds,
        compactRegionTip,
        core.regions,
        core.explicitRegionId,
        grantPardonMapChoices,
        tutorialMapTargetRegionId,
        tutorialStepId,
        wheelDispatchSelection?.sourceRegionId,
        wheelDispatchSelection?.candidates,
        pendingCommittedTroops,
        hoveredRegionId,
        tutorialGuideTargetRegionId,
        maskVersion,
    ]);

    const selectedRegion = core.explicitRegionId
        ? core.regions.find((region) => region.id === core.explicitRegionId)
        : undefined;
    const hoveredRegion = hoveredRegionId ? core.regions.find((region) => region.id === hoveredRegionId) : undefined;
    const pendingCommittedOptions = getPendingCommittedTroopOptions(pendingTargetAction);
    const pendingCommittedMax = pendingCommittedOptions.at(-1) ?? 0;
    const wheelDispatchSelectableTroopCount = wheelDispatchSelection
        ? Math.max(0, ...wheelDispatchSelection.candidates.map((candidate) => candidate.committedTroops))
        : 0;
    const activeCommittedMax = pendingCommittedMax > 0
        ? pendingCommittedMax
        : wheelDispatchSelectableTroopCount;
    const pendingCommittedSelectionActive = activeCommittedMax > 0
        && (pendingTargetAction != null || wheelDispatchSelection != null);
    const displaySelectedRegion = compactRegionTip && !pendingCommittedSelectionActive ? selectedRegion : undefined;
    const displayHoveredRegion = pendingCommittedSelectionActive ? undefined : hoveredRegion;
    const focusedRegion = displayHoveredRegion ?? displaySelectedRegion;
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

    const controlledMapViewport = React.useMemo<ZoomPanViewportState>(() => ({
        zoomLevel: viewport.zoom,
        position: {
            x: viewport.panX,
            y: viewport.panY,
        },
    }), [viewport.panX, viewport.panY, viewport.zoom]);

    const handleControlledViewportChange = React.useCallback((nextViewport: ZoomPanViewportState) => {
        setHoveredRegionId(null);
        onViewportChange(clampQidahenMapViewport({
            zoom: nextViewport.zoomLevel,
            panX: nextViewport.position.x,
            panY: nextViewport.position.y,
        }));
    }, [onViewportChange]);

    const resolveMapZoomAnchorPosition = React.useCallback(({
        position,
        zoomLevel,
        nextZoomLevel,
        pointer,
        containerRect,
    }: ZoomPanViewportZoomAnchorArgs) => {
        const stageX = ((pointer.clientX - containerRect.left) / containerRect.width) * STAGE_WIDTH;
        const stageY = ((pointer.clientY - containerRect.top) / containerRect.height) * STAGE_HEIGHT;
        const mapX = (stageX - MAP_COVER_LEFT - position.x) / (MAP_COVER_SCALE * zoomLevel);
        const mapY = (stageY - MAP_COVER_TOP - position.y) / (MAP_COVER_SCALE * zoomLevel);
        return {
            x: stageX - MAP_COVER_LEFT - mapX * MAP_COVER_SCALE * nextZoomLevel,
            y: stageY - MAP_COVER_TOP - mapY * MAP_COVER_SCALE * nextZoomLevel,
        };
    }, []);

    const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const regionId = getRegionFromPointer(event);
        if (regionId) {
            onSelectRegion(regionId);
        }
    }, [getRegionFromPointer, onSelectRegion]);

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
    const getGuideArmyTokens = (
        regionId: string | null | undefined,
        factionId: QidahenFactionId | null | undefined,
    ) => {
        if (!regionId || !factionId) {
            return [];
        }
        return core.mapTokens
            .filter((token) => token.type === 'army' && token.regionId === regionId && token.faction === factionId)
            .sort((left, right) => (
                Number(left.troopIndex == null) - Number(right.troopIndex == null)
                || (left.troopIndex ?? 999) - (right.troopIndex ?? 999)
                || left.id.localeCompare(right.id, 'en')
            ));
    };
    const getGuideArmyTokenPoint = (
        regionId: string | null | undefined,
        factionId: QidahenFactionId | null | undefined,
        selectedTroopCount?: number | null,
    ) => {
        const matchingTokens = getGuideArmyTokens(regionId, factionId);
        const selectedTokens = selectedTroopCount == null
            ? matchingTokens
            : matchingTokens.filter((token) => (
                typeof token.troopIndex === 'number'
                && token.troopIndex <= selectedTroopCount
            ));
        const targetTokens = selectedTokens.length > 0 ? selectedTokens : matchingTokens;
        if (targetTokens.length <= 0) {
            return null;
        }
        return {
            x: (targetTokens.reduce((sum, token) => sum + token.x, 0) / targetTokens.length) * QIDAHEN_MAP_WIDTH,
            y: (targetTokens.reduce((sum, token) => sum + token.y, 0) / targetTokens.length) * QIDAHEN_MAP_HEIGHT,
        };
    };
    const getGuideArmyTokenBounds = (
        regionId: string | null | undefined,
        factionId: QidahenFactionId | null | undefined,
        preferredTroopIndex?: number | null,
    ): QidahenGuideBounds | null => {
        const matchingTokens = getGuideArmyTokens(regionId, factionId);
        const preferredToken = preferredTroopIndex == null
            ? null
            : matchingTokens.find((token) => token.troopIndex === preferredTroopIndex) ?? null;
        const targetTokens = preferredToken ? [preferredToken] : matchingTokens;
        if (targetTokens.length <= 0) {
            return null;
        }
        const bounds = targetTokens.reduce(
            (nextBounds, token) => {
                const size = token.size ?? 30;
                const halfSize = size / 2;
                const centerX = token.x * QIDAHEN_MAP_WIDTH;
                const centerY = token.y * QIDAHEN_MAP_HEIGHT;
                return {
                    left: Math.min(nextBounds.left, centerX - halfSize),
                    top: Math.min(nextBounds.top, centerY - halfSize),
                    right: Math.max(nextBounds.right, centerX + halfSize),
                    bottom: Math.max(nextBounds.bottom, centerY + halfSize),
                };
            },
            { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
        );
        return {
            ...bounds,
            center: {
                x: (bounds.left + bounds.right) / 2,
                y: (bounds.top + bounds.bottom) / 2,
            },
        };
    };
    const getWheelDispatchTargetPoint = (candidate: QidahenWheelDispatchSelection['candidates'][number]) => (
        (() => {
            const targetPoint = getRegionPoint(candidate.targetRuntimeRegionId);
            if (candidate.targetRuntimeRegionId === 'city-region-22' && targetPoint) {
                return {
                    x: targetPoint.x,
                    y: targetPoint.y,
                };
            }
            return targetPoint;
        })()
    );
    const getGuideArrowTargetPoint = (
        targetRuntimeRegionId: string,
        sourcePoint: QidahenGuidePoint | null | undefined,
        targetPoint: QidahenGuidePoint | null | undefined,
    ) => {
        const runtimeRegionIdByPixel = runtimeRegionOwnership;
        if (runtimeRegionIdByPixel && sourcePoint && targetPoint) {
            const entryPoint = resolveQidahenRuntimeRegionEntryPoint(
                runtimeRegionIdByPixel,
                QIDAHEN_MAP_WIDTH,
                QIDAHEN_MAP_HEIGHT,
                targetRuntimeRegionId,
                sourcePoint,
                targetPoint,
                14,
            );
            if (entryPoint) {
                return entryPoint;
            }
        }
        if (targetRuntimeRegionId === 'city-region-22' && targetPoint) {
            return {
                x: targetPoint.x - 36,
                y: targetPoint.y - 58,
            };
        }
        return targetPoint;
    };
    const getWheelDispatchArrowTargetPoint = (
        candidate: QidahenWheelDispatchSelection['candidates'][number],
        sourcePoint: QidahenGuidePoint | null | undefined,
        targetPoint: QidahenGuidePoint | null | undefined,
    ) => getGuideArrowTargetPoint(candidate.targetRuntimeRegionId, sourcePoint, targetPoint);
    const buildGuidePathPoints = (
        pathRegionIds: string[],
        fallbackSourceRegionId: string | null | undefined,
        fallbackTargetRegionId: string | null | undefined,
        startPoint?: QidahenGuidePoint | null,
        endPoint?: QidahenGuidePoint | null,
    ) => {
        const mergedRegionIds = [
            fallbackSourceRegionId,
            ...pathRegionIds,
            fallbackTargetRegionId,
        ].filter((regionId, index, list): regionId is string => Boolean(regionId) && list.indexOf(regionId) === index);
        const points = mergedRegionIds
            .map((regionId) => getRegionPoint(regionId))
            .filter((point): point is NonNullable<typeof point> => point != null);
        const anchoredPoints = points.map((point, index) => (
            index === 0 && startPoint
                ? startPoint
                : index === points.length - 1 && endPoint
                    ? endPoint
                    : point
        ));
        return anchoredPoints.length >= 2 ? anchoredPoints : [];
    };
    const inferPendingTargetPathRegionIds = (pending: QidahenCore['pendingTargetAction']): string[] => {
        if (!pending?.sourceRegionId) {
            return [];
        }
        const movementProfile = getQidahenMovementProfile(pending.movementProfileId ?? undefined);
        const reachableTarget = findQidahenReachableRuntimeRegions(
            core,
            pending.sourceRegionId,
            pending.attackerFactionId,
            movementProfile.movementBudget,
            {
                movementProfileId: pending.movementProfileId ?? undefined,
                allowEndOnNonFriendly: true,
                allowPassThroughNonFriendly: false,
            },
        ).find((region) => region.regionId === pending.targetRuntimeRegionId);
        return reachableTarget?.pathRegionIds ?? [];
    };
    const mapSelectionGuide = (() => {
        if (wheelDispatchSelection) {
            if (pendingCommittedTroops == null || pendingCommittedTroops <= 0) {
                return {
                    sourceRegionId: wheelDispatchSelection.sourceRegionId,
                    title: '选择参与部队',
                    hint: '先点源地区兵牌确认本次出兵',
                    badgeLabel: '选择部队',
                    candidates: [],
                    candidateSummary: `${wheelDispatchSelection.displayAnchorRegionName} 出发`,
                };
            }
            return {
                sourceRegionId: wheelDispatchSelection.sourceRegionId,
                title: '点一个进攻目标',
                hint: `${wheelDispatchSelection.displayAnchorRegionName} 出发`,
                badgeLabel: '选择地区',
                candidates: wheelDispatchSelection.candidates.map((candidate) => {
                    const sourcePoint = getGuideArmyTokenPoint(
                        wheelDispatchSelection.sourceRegionId,
                        wheelDispatchSelection.attackerFactionId,
                        pendingCommittedTroops,
                    );
                    const targetPoint = getWheelDispatchTargetPoint(candidate);
                    const arrowTargetPoint = getWheelDispatchArrowTargetPoint(candidate, sourcePoint, targetPoint);
                    const arrowHeadAnchorRatio = candidate.targetRuntimeRegionId === 'city-region-22' ? 0.95 : undefined;
                    const targetTokens = getGuideArmyTokens(candidate.targetRuntimeRegionId, candidate.defenderFactionId);
                    const targetTokenBounds = getGuideArmyTokenBounds(candidate.targetRuntimeRegionId, candidate.defenderFactionId);
                    return {
                        id: candidate.targetRuntimeRegionId,
                        targetRegionId: candidate.targetRuntimeRegionId,
                        targetRegionName: candidate.targetRegionName,
                        resolutionHint: candidate.resolutionHint,
                        targetPoint,
                        arrowTargetPoint,
                        arrowHeadAnchorRatio,
                        targetFocusDisabled: true,
                        targetTokenIds: targetTokens.map((token) => token.id),
                        targetTokenBounds: targetTokenBounds ?? undefined,
                        pathPoints: buildGuidePathPoints(
                            candidate.pathRegionIds,
                            wheelDispatchSelection.sourceRegionId,
                            candidate.targetRuntimeRegionId,
                            sourcePoint,
                            arrowTargetPoint,
                        ),
                    };
                }),
                candidateSummary: formatQidahenCandidateRegionSummary(wheelDispatchSelection.candidates.map((candidate) => candidate.targetRegionName)),
            };
        }
        if (core.gaoDiDispatchSelection) {
            const gaoDiTargetSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);
            return {
                sourceRegionId: core.gaoDiDispatchSelection.sourceRegionId,
                title: gaoDiTargetSelectionActive
                    ? '调度目标'
                    : '弃牌',
                hint: gaoDiTargetSelectionActive ? '选择目标' : '弃 1 张手牌',
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
        if (grantPardonSelection) {
            const candidates = grantPardonMapChoices.map((choice) => ({
                id: choice.id,
                targetRegionId: choice.targetRegionId,
                targetRegionName: choice.targetRegionName,
                resolutionHint: choice.detail,
                pathPoints: buildGuidePathPoints([], choice.sourceRegionId, choice.targetRegionId),
            }));
            return {
                sourceRegionId: grantPardonSelection.sourceRegionId,
                title: '招安目标',
                hint: '点地图接收区',
                badgeLabel: '选择招安',
                candidates,
                candidateSummary: formatQidahenCandidateRegionSummary(candidates.map((choice) => choice.targetRegionName)),
            };
        }
        if (internalDispatchSelection) {
            return {
                sourceRegionId: internalDispatchSelection.sourceRegionId,
                title: '调度目标',
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
        if (defeatInDetailSelectableSourceRegionIds.length > 0) {
            const candidates = defeatInDetailSelectableSourceRegionIds.map((regionId) => {
                const region = core.regions.find((candidate) => candidate.id === regionId);
                return {
                    id: regionId,
                    targetRegionId: regionId,
                    targetRegionName: region?.name ?? regionId,
                    resolutionHint: '选择该方向的进攻先进行战斗',
                    pathPoints: [],
                };
            });
            return {
                sourceRegionId: null,
                title: '各个击破',
                hint: '选择先结算的进攻方向',
                badgeLabel: '决定顺序',
                candidates,
                candidateSummary: formatQidahenCandidateRegionSummary(
                    candidates.map((candidate) => candidate.targetRegionName),
                ),
            };
        }
        if (pendingTargetAction?.sourceRegionId) {
            const sourcePoint = getGuideArmyTokenPoint(
                pendingTargetAction.sourceRegionId,
                pendingTargetAction.attackerFactionId,
                pendingCommittedTroops ?? pendingTargetAction.committedTroops,
            );
            const targetPoint = getRegionPoint(pendingTargetAction.targetRuntimeRegionId);
            const arrowTargetPoint = getGuideArrowTargetPoint(
                pendingTargetAction.targetRuntimeRegionId,
                sourcePoint,
                targetPoint,
            );
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
                        targetPoint: targetPoint ?? undefined,
                        arrowTargetPoint: arrowTargetPoint ?? undefined,
                        pathPoints: buildGuidePathPoints(
                            inferPendingTargetPathRegionIds(pendingTargetAction),
                            pendingTargetAction.sourceRegionId,
                            pendingTargetAction.targetRuntimeRegionId,
                            sourcePoint,
                            arrowTargetPoint,
                        ),
                    },
                ],
                candidateSummary: pendingTargetAction.targetRegionName,
            };
        }
        return null;
    })() as null | {
        sourceRegionId: string | null | undefined;
        title: string;
        hint: string;
        badgeLabel: string;
        candidates: QidahenGuideCandidate[];
        candidateSummary: string;
    };
    const mapSelectionCandidateRegionIds = new Set(mapSelectionGuide?.candidates.map((candidate) => candidate.targetRegionId) ?? []);
    const activeGuideTargetRegionId = hoveredRegionId && mapSelectionCandidateRegionIds.has(hoveredRegionId)
        ? hoveredRegionId
        : tutorialGuideTargetRegionId && mapSelectionCandidateRegionIds.has(tutorialGuideTargetRegionId)
            ? tutorialGuideTargetRegionId
            : core.explicitRegionId && mapSelectionCandidateRegionIds.has(core.explicitRegionId)
                ? core.explicitRegionId
                : pendingTargetAction?.targetRuntimeRegionId ?? null;
    const activeGuideTargetCandidate = mapSelectionGuide?.candidates.find((candidate) => candidate.targetRegionId === activeGuideTargetRegionId) ?? null;
    const mapSelectionBannerHint = activeGuideTargetCandidate
        ? `${mapSelectionGuide?.hint ?? ''} · 当前目标：${activeGuideTargetCandidate.targetRegionName}`
        : mapSelectionGuide?.candidateSummary
            ? `${mapSelectionGuide.hint} · 可选：${mapSelectionGuide.candidateSummary}`
            : mapSelectionGuide?.hint ?? '';
    const mapSelectionBannerLeft = (STAGE_WIDTH - MAP_SELECTION_BANNER_WIDTH) / 2;
    const mapSelectionBannerInteractive = mapSelectionGuide != null
        && (pendingTargetAction == null || defeatInDetailSelectableSourceRegionIds.length > 0)
        && mapSelectionGuide.candidates.length > 0;
    const mapSelectionGuideUsesRegionHighlight = grantPardonSelection != null
        || defeatInDetailSelectableSourceRegionIds.length > 0
        || tutorialStepId === 'choose-grant-pardon-target';
    const mapSelectionGuideDrawsRoute = mapSelectionGuide != null && !mapSelectionGuideUsesRegionHighlight;
    const revealedBattleRegionIds = React.useMemo(
        () => buildRevealedBattleRegionIds(pendingTargetAction, core.postBattleSelection),
        [pendingTargetAction, core.postBattleSelection],
    );
    const pendingCommittedSelectedCount = Math.min(
        pendingCommittedTroops ?? pendingTargetAction?.committedTroops ?? 0,
        activeCommittedMax,
    );
    const handleSelectPendingCommittedTroopsFromMap = React.useCallback((troopIndex: number) => {
        if (activeCommittedMax <= 0) {
            return;
        }
        onSelectPendingCommittedTroops?.(Math.max(1, Math.min(troopIndex, activeCommittedMax)));
    }, [activeCommittedMax, onSelectPendingCommittedTroops]);

    return (
        <ZoomPanViewport
            className="pointer-events-auto absolute inset-0 z-10 overflow-hidden"
            contentClassName="absolute inset-0"
            containerTestId="qidahen-map-layer"
            contentTestId="qidahen-map-viewport-content"
            scaleTestId="qidahen-map-scale"
            initialScale={DEFAULT_QIDAHEN_MAP_VIEWPORT.zoom}
            minScale={QIDAHEN_MAP_MIN_ZOOM}
            maxScale={QIDAHEN_MAP_MAX_ZOOM}
            panBoundsMode="free"
            controlledViewport={controlledMapViewport}
            onControlledViewportChange={handleControlledViewportChange}
            coordinateSize={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
            clampViewport={(nextViewport) => {
                const clampedViewport = clampQidahenMapViewport({
                    zoom: nextViewport.zoomLevel,
                    panX: nextViewport.position.x,
                    panY: nextViewport.position.y,
                });
                return {
                    zoomLevel: clampedViewport.zoom,
                    position: {
                        x: clampedViewport.panX,
                        y: clampedViewport.panY,
                    },
                };
            }}
            getZoomAnchorPosition={resolveMapZoomAnchorPosition}
            wheelZoomFactor={1.14}
            renderContentTransform={false}
            scaleBadgeClassName="border-[#3f2d18] bg-[rgba(24,16,9,0.88)] text-[#f4dfad]"
            ariaLabel={t('board.map.regionSelectionAria', { defaultValue: '七大恨地图区域选择' })}
            containerProps={{
                'data-tutorial-id': 'qidahen-map-layer',
                'data-map-layout': 'full-bleed-cover',
                'data-map-selected': core.explicitRegionId ?? '',
                'data-map-zoom': viewport.zoom,
                'data-map-pan-x': viewport.panX,
                'data-map-pan-y': viewport.panY,
            } as React.HTMLAttributes<HTMLDivElement>}
            style={{
                background: '#c8a970',
                width: STAGE_WIDTH,
                height: STAGE_HEIGHT,
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
                                ? (mapSelectionGuide ? 'rgba(184,59,39,0.08)' : 'rgba(184,59,39,0.72)')
                                : (mapSelectionGuide ? 'rgba(43,101,145,0.06)' : 'rgba(43,101,145,0.74)')}
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
                                        opacity={mapSelectionGuide ? 0.06 : 0.9}
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
                    {mapSelectionGuideDrawsRoute ? (
                        <g data-testid="qidahen-map-selection-guide" data-qidahen-map-guide-layer="background">
                            {mapSelectionGuide.candidates.map((candidate) => {
                                const pathPoints = candidate.pathPoints;
                                const activeCandidate = activeGuideTargetRegionId === candidate.targetRegionId;
                                if (!activeCandidate || candidate.targetFocusDisabled || pathPoints.length < 2) {
                                    return null;
                                }
                                const targetPoint = candidate.targetPoint ?? pathPoints[pathPoints.length - 1];
                                const targetFocusRadius = activeCandidate ? 22 : 18;
                                const targetFocusCorner = activeCandidate ? 8 : 7;
                                const targetFocusStroke = activeCandidate ? '#d0ffbf' : '#7de08e';
                                const targetFocusOpacity = activeCandidate ? 0.86 : 0.42;
                                const targetFocusLeft = targetPoint.x - targetFocusRadius;
                                const targetFocusTop = targetPoint.y - targetFocusRadius;
                                const targetFocusRight = targetPoint.x + targetFocusRadius;
                                const targetFocusBottom = targetPoint.y + targetFocusRadius;
                                const boundedTargetFocusCorner = Math.min(
                                    targetFocusCorner,
                                    Math.max(4, (targetFocusRight - targetFocusLeft) / 3),
                                    Math.max(4, (targetFocusBottom - targetFocusTop) / 3),
                                );
                                const targetFocusPaths = [
                                    `M ${targetFocusLeft} ${targetFocusTop + boundedTargetFocusCorner} L ${targetFocusLeft} ${targetFocusTop} L ${targetFocusLeft + boundedTargetFocusCorner} ${targetFocusTop}`,
                                    `M ${targetFocusRight - boundedTargetFocusCorner} ${targetFocusTop} L ${targetFocusRight} ${targetFocusTop} L ${targetFocusRight} ${targetFocusTop + boundedTargetFocusCorner}`,
                                    `M ${targetFocusLeft} ${targetFocusBottom - boundedTargetFocusCorner} L ${targetFocusLeft} ${targetFocusBottom} L ${targetFocusLeft + boundedTargetFocusCorner} ${targetFocusBottom}`,
                                    `M ${targetFocusRight - boundedTargetFocusCorner} ${targetFocusBottom} L ${targetFocusRight} ${targetFocusBottom} L ${targetFocusRight} ${targetFocusBottom - boundedTargetFocusCorner}`,
                                ];
                                return (
                                    <g
                                        key={candidate.id}
                                        data-testid={`qidahen-map-guide-route-${candidate.targetRegionId}`}
                                        data-guide-target-x={targetPoint.x}
                                        data-guide-target-y={targetPoint.y}
                                    >
                                        <g
                                            data-testid={`qidahen-map-guide-target-focus-${candidate.targetRegionId}`}
                                            opacity={targetFocusOpacity}
                                            filter={activeCandidate ? 'url(#qidahen-map-guide-glow)' : undefined}
                                        >
                                            {targetFocusPaths.map((focusPath) => (
                                                <path
                                                    key={focusPath}
                                                    d={focusPath}
                                                    fill="none"
                                                    stroke={targetFocusStroke}
                                                    strokeWidth={activeCandidate ? 3.4 : 2.4}
                                                    strokeLinecap="square"
                                                    strokeLinejoin="miter"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            ))}
                                        </g>
                                    </g>
                                );
                            })}
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
                {core.mapTokens.map((token) => {
                    const pincerAdvanceChoice = core.pincerAdvanceSelection?.choices.find((choice) => (
                        choice.tokenId === token.id
                    ));
                    const instigateDefectionChoice = core.instigateDefectionSelection?.choices.find((choice) => (
                        choice.tokenId === token.id
                    ));
                    const wuzhenChaohaChoice = core.wuzhenChaohaSelection?.choices.find((choice) => (
                        choice.tokenId === token.id
                    ));
                    const pendingCommittedSourceRegionId = pendingTargetAction?.sourceRegionId ?? wheelDispatchSelection?.sourceRegionId ?? null;
                    const pendingCommittedSelectable = token.type === 'army'
                        && core.pincerAdvanceSelection == null
                        && core.instigateDefectionSelection == null
                        && core.wuzhenChaohaSelection == null
                        && pendingCommittedSourceRegionId != null
                        && token.regionId === pendingCommittedSourceRegionId
                        && typeof token.troopIndex === 'number'
                        && token.troopIndex >= 1
                        && token.troopIndex <= activeCommittedMax;
                    return (
                        <MapToken
                            key={token.id}
                            token={token}
                            revealFront={shouldRevealQidahenMapArmyToken(token, currentFactionId, revealedBattleRegionIds)}
                            pendingCommittedSelectable={pendingCommittedSelectable}
                            pendingCommittedSelected={pendingCommittedSelectable && (token.troopIndex ?? 0) <= pendingCommittedSelectedCount}
                            onSelectPendingCommittedTroops={handleSelectPendingCommittedTroopsFromMap}
                            pincerAdvanceSelectable={pincerAdvanceChoice != null}
                            pincerAdvanceSelected={pincerAdvanceChoice != null && core.pincerAdvanceSelection?.selectedChoiceIds.includes(pincerAdvanceChoice.id)}
                            onTogglePincerAdvanceTroop={onTogglePincerAdvanceTroop}
                            instigateDefectionSelectable={instigateDefectionChoice != null}
                            onResolveInstigateDefection={onResolveInstigateDefection}
                            wuzhenChaohaSelectable={wuzhenChaohaChoice != null}
                            onResolveWuzhenChaoha={onResolveWuzhenChaoha}
                        />
                    );
                })}
                {mapSelectionGuideDrawsRoute ? (
                    <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox={`0 0 ${QIDAHEN_MAP_WIDTH} ${QIDAHEN_MAP_HEIGHT}`}
                        aria-hidden="true"
                        data-testid="qidahen-map-guide-route-overlay"
                    >
                        <g data-testid="qidahen-map-selection-guide-routes">
                            {mapSelectionGuide.candidates.map((candidate) => {
                                const pathPoints = candidate.pathPoints;
                                const activeCandidate = activeGuideTargetRegionId === candidate.targetRegionId;
                                if (!activeCandidate || pathPoints.length < 2) {
                                    return null;
                                }
                                const arrowPoints = pathPoints;
                                const { linePath, headPath: arrowHeadPath } = buildQidahenGuideArrow(
                                    arrowPoints,
                                    activeCandidate ? 14 : 11,
                                    activeCandidate ? 10 : 9,
                                    activeCandidate ? 4.8 : 4.2,
                                    candidate.arrowHeadAnchorRatio,
                                );
                                const routeColor = activeCandidate ? 'rgba(218,255,190,0.96)' : 'rgba(109, 216, 141, 0.68)';
                                return (
                                    <g key={candidate.id} data-testid={`qidahen-map-guide-route-foreground-${candidate.targetRegionId}`}>
                                        {linePath ? (
                                            <path
                                                d={linePath}
                                                fill="none"
                                                stroke={routeColor}
                                                strokeWidth={activeCandidate ? 4 : 2.6}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                vectorEffect="non-scaling-stroke"
                                                opacity={activeCandidate ? 0.88 : 0.34}
                                                data-testid={`qidahen-map-guide-line-${candidate.targetRegionId}`}
                                            />
                                        ) : null}
                                        {arrowHeadPath ? (
                                            <path
                                                d={arrowHeadPath}
                                                fill={routeColor}
                                                vectorEffect="non-scaling-stroke"
                                                opacity={activeCandidate ? 1 : 0.42}
                                                data-testid={`qidahen-map-guide-arrow-head-${candidate.targetRegionId}`}
                                            />
                                        ) : null}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                ) : null}
                <canvas
                    ref={canvasRef}
                    width={QIDAHEN_MAP_WIDTH}
                    height={QIDAHEN_MAP_HEIGHT}
                    className={`${mapHitTestingDisabled ? 'pointer-events-none' : 'pointer-events-auto'} absolute inset-0 h-full w-full cursor-pointer opacity-0`}
                    data-testid="qidahen-map-hitmap-canvas"
                    data-tutorial-id={tutorialMapTargetRegionId ? 'qidahen-map-target-song-jin' : undefined}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={() => setHoveredRegionId(null)}
                    onPointerUp={handlePointerUp}
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
            {mapSelectionGuide
                && core.gaoDiDispatchSelection == null
                && internalDispatchSelection == null
                && (pendingTargetAction == null || defeatInDetailSelectableSourceRegionIds.length > 0) ? (
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
                        {mapSelectionBannerHint}
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
        </ZoomPanViewport>
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
    const activatableMoveChoices = moveChoices.filter(
        (choice) => canActivateMove?.(choice.id, choice.id === selectedMoveId) ?? true,
    );
    const activeMove = activatableMoveChoices.find((choice) => choice.id === activeMoveId)
        ?? activatableMoveChoices.find((choice) => choice.id === selectedMoveId)
        ?? activatableMoveChoices[0];
    const activeSummary = activeMove ? `${activeMove.label}：${activeMove.drawText}` : moveSummary;
    const activeMoveTargetIndex = activeMove ? (selectedIndex + activeMove.steps) % WHEEL_SECTORS.length : selectedIndex;
    const moveTargetIndices = new Set(
        activatableMoveChoices.map((choice) => (selectedIndex + choice.steps) % WHEEL_SECTORS.length),
    );
    const currentMarkerPoint = polarToPoint(WHEEL_CENTER, WHEEL_OUTER_RADIUS - 18, selectedAngle);

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
            className="pointer-events-none group absolute left-[136px] top-[-16px] z-30 h-[438px] w-[438px]"
            data-testid="qidahen-action-wheel"
            data-tutorial-id="qidahen-action-wheel"
            data-ui-anchor="left-top"
            style={{
                left: 'calc(136px - var(--qidahen-mobile-edge-pull, 0px))',
                top: 'calc(-16px + var(--qidahen-mobile-top-inset, 0px))',
            }}
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
                        const labelClassName = candidateTarget && emphasized ? 'fill-[#f5f2df]' : 'fill-[#241b14]';
                        const labelFontSize = selectedTarget || activeTarget ? 13 : 12;
                        const labelFontWeight = candidateTarget && emphasized ? 900 : 650;
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
                                {renderQidahenWheelVerticalText(sector.label[0], labelPoint.x - 9, labelPoint.y, {
                                    className: labelClassName,
                                    fontSize: labelFontSize,
                                    fontWeight: labelFontWeight,
                                })}
                                {renderQidahenWheelVerticalText(sector.label[1], labelPoint.x + 10, labelPoint.y, {
                                    className: labelClassName,
                                    fontSize: labelFontSize,
                                    fontWeight: labelFontWeight,
                                })}
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
                                    className={`pointer-events-auto outline-none transition-[fill,stroke] ${moveDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
                <div
                    className="pointer-events-none absolute z-10 h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
                    data-testid="qidahen-wheel-current-marker"
                    data-wheel-current-position={selectedId}
                    style={{
                        left: `${(currentMarkerPoint.x / WHEEL_VIEW) * 100}%`,
                        top: `${(currentMarkerPoint.y / WHEEL_VIEW) * 100}%`,
                        filter: 'drop-shadow(0 2px 3px rgba(31, 22, 15, 0.72))',
                    }}
                >
                    <OptimizedImage
                        src={ASSETS.wheelMarker}
                        alt={t('board.wheel.currentMarker', { defaultValue: '轮盘行动标记当前位置' })}
                        className="h-full w-full scale-[1.08] object-cover"
                        draggable={false}
                        placeholder={false}
                    />
                </div>
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
    <div
        className="pointer-events-auto absolute left-[80px] top-[542px] z-20"
        data-testid="qidahen-chronology-zone"
        data-ui-anchor="left-middle"
        style={{ top: 'var(--qidahen-mobile-chronology-top, 542px)' }}
    >
        <div className="flex items-end gap-3">
            {cards.slice(0, 2).map((card) => (
                <YearCardSlot key={card.id} card={card} locale={locale} onMagnify={onMagnify} />
            ))}
        </div>
    </div>
);

const KoreaRailItem: React.FC<{
    src?: string;
    previewRef?: CardPreviewRef;
    label: string;
    count: number;
    locale?: string;
    tone?: 'ink' | 'red';
    testId: string;
}> = ({ src, previewRef, label, count, locale, tone = 'ink', testId }) => {
    const accent = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.bronze;
    const countColor = tone === 'red' ? UI_STYLE.cinnabar : UI_STYLE.ink;
    const thumbnail = CARD_DIMENSIONS.koreaRailThumbnail;

    return (
        <div
            className="relative flex h-[66px] w-[156px] items-center gap-2 overflow-hidden border-[2px] px-2 py-1.5"
            data-testid={testId}
            data-qidahen-korea-rail-item
            aria-label={`${label} ${count}`}
            style={{
                borderColor: 'rgba(49,35,21,0.5)',
                background: tone === 'red' ? 'rgba(78,35,28,0.76)' : 'rgba(34,24,16,0.72)',
                boxShadow: '0 2px 0 rgba(7,5,3,0.55), 0 8px 14px rgba(22,14,8,0.26), inset 0 0 0 1px rgba(232,200,133,0.18)',
                borderRadius: 4,
            }}
        >
            <div
                className="relative shrink-0 overflow-hidden border"
                style={{
                    width: thumbnail.width,
                    height: thumbnail.height,
                    borderColor: accent,
                    background: UI_STYLE.cardField,
                    boxShadow: '0 4px 8px rgba(0,0,0,0.18)',
                    borderRadius: 3,
                }}
            >
                {previewRef ? (
                    <CardPreviewFit
                        previewRef={previewRef}
                        locale={locale}
                        title={label}
                        width={thumbnail.width}
                        height={thumbnail.height}
                        rawWidth={thumbnail.rawWidth}
                        rawHeight={thumbnail.rawHeight}
                    />
                ) : src ? (
                    <OptimizedImage src={src} alt={label} className="h-full w-full object-cover" draggable={false} placeholder={false} />
                ) : null}
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black leading-4" style={{ color: UI_STYLE.mapIvory }}>
                    {label}
                </div>
                <div className="mt-1 h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            </div>
            <div
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 text-[13px] font-black"
                style={{
                    borderColor: accent,
                    color: countColor,
                    background: 'rgba(248,237,206,0.96)',
                    boxShadow: `0 3px 8px ${UI_STYLE.shadowSoft}`,
                }}
            >
                {count}
            </div>
        </div>
    );
};

const KoreaZone: React.FC<{
    core: QidahenCore;
    locale?: string;
}> = ({ core, locale }) => {
    const { t } = useTranslation('game-qidahen');

    return (
        <div
            className="pointer-events-none absolute right-[50px] top-[104px] z-20 flex flex-col gap-2"
            data-testid="qidahen-korea-zone"
            data-ui-anchor="right-deck-slot"
            data-qidahen-korea-zone-layout="desktop-rail"
            style={{ top: 'calc(104px + var(--qidahen-mobile-top-inset, 0px))' }}
        >
            <KoreaRailItem
                src={ASSETS.koreaCard}
                label={t('board.korea.drawPile', { defaultValue: '朝鲜牌库' })}
                count={core.koreaDeckCount}
                testId="qidahen-korea-draw-pile"
            />
            <KoreaRailItem
                previewRef={core.koreaDiscardPreviewRef}
                locale={locale}
                label={t('board.korea.discardPile', { defaultValue: '朝鲜弃牌' })}
                count={core.koreaDiscardCount}
                tone="red"
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
    const width = 256;
    const left = (STAGE_WIDTH - width) / 2;

    return (
        <div
            className="pointer-events-none absolute z-50 border px-2.5 py-1.5"
            data-testid={testId}
            style={{
                left,
                top: `calc(${MAP_SELECTION_BANNER_TOP}px + var(--qidahen-mobile-top-inset, 0px))`,
                width,
                borderColor: isWheel ? '#5fb772' : UI_STYLE.oldGold,
                background: isWheel ? 'rgba(225, 235, 190, 0.68)' : UI_SURFACE.mapOpenPanelSelected,
                color: UI_STYLE.ink,
                boxShadow: UI_SURFACE.mapOpenPanelShadow,
                borderRadius: 10,
            }}
        >
            <div
                className="inline-flex items-center border px-1.5 py-0.5 text-[8px] font-black tracking-[0.1em]"
                style={{
                    borderColor: isWheel ? '#a7e6b4' : '#f6d5a8',
                    color: UI_STYLE.ink,
                    background: isWheel ? 'rgba(126, 166, 93, 0.2)' : 'rgba(109,74,23,0.18)',
                }}
            >
                {badgeLabel}
            </div>
            <div
                className="mt-0.5 text-[12px] font-black leading-4"
                data-testid={testId === 'qidahen-wheel-next-step-banner' ? 'qidahen-wheel-next-step-title' : undefined}
            >
                {title}
            </div>
            {hint ? (
                <div
                    className="mt-0.5 text-[9px] font-black leading-3"
                    data-testid={testId === 'qidahen-wheel-next-step-banner' ? 'qidahen-wheel-next-step-hint' : undefined}
                    style={{ color: UI_STYLE.bronze }}
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
        ? UI_SURFACE.mapOpenPanelSelected
        : focused
            ? 'linear-gradient(180deg, rgba(239,213,157,0.86) 0%, rgba(203,162,91,0.76) 100%)'
            : UI_SURFACE.mapOpenPanel;
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
            className="group relative inline-flex h-[48px] min-w-[132px] items-center justify-between gap-2 overflow-visible border-[2px] px-3.5 text-left text-[14px] font-black tracking-[0.02em] transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#9f3426]/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:translate-y-0"
            onClick={onClick}
            style={{
                borderColor,
                background,
                color: UI_STYLE.ink,
                boxShadow: `${UI_SURFACE.mapOpenPanelShadow}${glowShadow}`,
                borderRadius: 9,
            }}
        >
            <span className="pointer-events-none absolute inset-y-0 left-0 w-[5px]" style={{ background: accentColor }} />
            <span className="pointer-events-none absolute inset-x-[14px] top-[3px] h-[1px]" style={{ background: 'rgba(232,200,133,0.3)' }} />
            <span className="min-w-0 whitespace-nowrap">{action.label}</span>
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
    grantPardonSelection: QidahenGrantPardonSelection | null;
    grantPardonMapChoices: QidahenGrantPardonSelection['choices'];
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
    onResolveGrantPardonChoice: (choiceId: QidahenGrantPardonChoice['id']) => void;
    selectedGaoDiChoiceId: string | null;
    onResolveGaoDiDispatch: (choiceId: string) => void;
    selectedInternalDispatchChoiceId: string | null;
    onResolveInternalDispatch: (choiceId: string) => void;
    onClearInternalDispatchChoice: () => void;
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
    onResolvePincerAdvance: () => void;
    onCancelPincerAdvance: () => void;
    onResolveInfantryCavalryCombined: (mode: 'withdraw-cavalry' | 'joint-attack') => void;
    onCancelInstigateDefection: () => void;
    onSetWuzhenChaohaArtilleryTechCount: (count: number) => void;
    onCancelWuzhenChaoha: () => void;
    onResolvePostBattleDecision: (choiceId: string) => void;
    isTutorialCommandAllowed?: (commandType: string) => boolean;
    isTutorialTargetAllowed?: (targetId: string | null | undefined) => boolean;
}> = ({ core, primaryStageMode, isTutorialActive, tutorialInfoStepActive, tutorialHighlightsSeasonSummary, actionPaymentPreviewVisible, handLimitDiscardSelection, internalDispatchSelection, recruitSelection, grantPardonSelection, grantPardonMapChoices, maShiTradeSelection, khanEdictSelection, diplomacySelection, driveTigerConsentSelection, fortificationMaintenanceSelection, wheelDispatchSelection, pendingTargetAction, postBattleSelection, onExecuteAction, onSelectRegion, onResolveRecruitChoice, onResolveGrantPardonChoice, selectedGaoDiChoiceId, onResolveGaoDiDispatch, selectedInternalDispatchChoiceId, onResolveInternalDispatch, onClearInternalDispatchChoice, onResolveMaShiTradeChoice, onResolveKhanEdictChoice, onResolveDiplomacyChoice, onResolveDriveTigerConsent, onResolveFortificationMaintenance, upkeepAttritionPriority, onSelectUpkeepAttritionPriority, pendingCommittedTroops, onSelectPendingCommittedTroops, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, onSelectPendingAttackerCasualtyPriority, onSelectPendingDefenderCasualtyPriority, onResolvePendingAction, onResolvePincerAdvance, onCancelPincerAdvance, onResolveInfantryCavalryCombined, onCancelInstigateDefection, onSetWuzhenChaohaArtilleryTechCount, onCancelWuzhenChaoha, onResolvePostBattleDecision, isTutorialCommandAllowed, isTutorialTargetAllowed }) => {
    const { t } = useTranslation('game-qidahen');
    const actionSlotRef = React.useRef<HTMLDivElement>(null);
    const grantPardonHasMapTargets = Boolean(grantPardonSelection?.choices.length);
    const pendingTargetChoiceOptions = pendingTargetAction ? buildPendingTargetChoiceOptions(core, pendingTargetAction) : [];
    const pendingScenarioChoices = core.scenarioVote != null
        || core.pendingScenarioCharacterChoices.length > 0
        || core.pendingScenarioArmamentChoices.length > 0;
    const selectedAction = getQidahenForegroundActionChoice(core, {
        actionPaymentPreviewVisible,
        recruitSelection,
        grantPardonSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
    });
    const selectedGaoDiCandidate = core.gaoDiDispatchSelection?.candidates.find((candidate) => candidate.id === selectedGaoDiChoiceId) ?? null;
    const selectedInternalDispatchCandidate = internalDispatchSelection?.candidates.find(
        (candidate) => candidate.id === selectedInternalDispatchChoiceId,
    ) ?? null;
    const postBattleSelectionKey = postBattleSelection
        ? `${postBattleSelection.actionId}:${postBattleSelection.targetRuntimeRegionId}`
        : null;
    const [postBattleMode, setPostBattleMode] = React.useState<NonNullable<QidahenCore['postBattleSelection']>['choices'][number]['mode'] | null>(null);
    const [draftPostBattleChoiceId, setDraftPostBattleChoiceId] = React.useState<string | null>(null);
    const postBattleModeChoices = postBattleMode
        ? postBattleSelection?.choices.filter((choice) => choice.mode === postBattleMode) ?? []
        : [];
    const draftPostBattleChoice = postBattleSelection?.choices.find((choice) => choice.id === draftPostBattleChoiceId) ?? null;

    React.useEffect(() => {
        setPostBattleMode(null);
        setDraftPostBattleChoiceId(null);
    }, [postBattleSelectionKey]);
    const factionStageActiveSelection = core.gaoDiDispatchSelection != null
        || internalDispatchSelection != null
        || recruitSelection != null
        || grantPardonSelection != null
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
    const suppressPassiveActionContext = actionPaymentPreviewVisible
        || showWheelNextStepBanner
        || factionStageActiveSelection
        || wheelStageActiveSelection
        || wheelDispatchSelection != null
        || pendingTargetAction != null
        || postBattleSelection != null;
    const showFortificationStrip = !suppressPassiveActionContext && core.turnPhase !== 'action-window';
    const showActionRail = !pendingScenarioChoices && !suppressPassiveActionContext && primaryStageMode === 'faction';
    const visibleTurnLabel = isTutorialActive
        && primaryStageMode === 'wheel'
        && !core.wheelActionUsed
        && !core.factionActionUsed
        ? formatQidahenTutorialWheelTurnLabel(core.turnLabel)
        : core.turnLabel;
    const directHandActionIds = getQidahenDirectHandActionIdsForFaction(core, getCurrentFactionId(core));
    const visibleActionChoices = core.actionChoices.filter((action) => !directHandActionIds.has(action.id));
    const seasonSummaryLines = tutorialHighlightsSeasonSummary
        ? core.lastSeasonSummary?.lines ?? []
        : core.lastSeasonSummary?.lines.slice(0, 5) ?? [];
    const explicitSelectedRuntimeRegionId = core.explicitRegionId
        ? resolveQidahenPrimaryRuntimeRegionId(core.explicitRegionId)
        : null;
    const recruitRegionExplicitlySelected = recruitSelection != null
        && explicitSelectedRuntimeRegionId === recruitSelection.targetRegionId;
    const maShiTradeRegionExplicitlySelected = maShiTradeSelection != null
        && explicitSelectedRuntimeRegionId === maShiTradeSelection.targetRegionId;
    const actionSurfaceKey = handLimitDiscardSelection ? 'hand-limit-discard'
        : internalDispatchSelection ? 'internal-dispatch'
            : recruitSelection ? 'recruit'
                : grantPardonSelection ? 'grant-pardon'
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
            className="pointer-events-auto absolute z-40 flex flex-col items-end"
            data-testid="qidahen-actions-zone"
            data-tutorial-id="qidahen-actions-zone"
            data-ui-anchor="right-middle"
            style={{
                left: `calc(${ACTIONS_DOCK_LEFT}px + var(--qidahen-mobile-edge-pull, 0px))`,
                top: ACTIONS_DOCK_TOP,
                width: suppressPassiveActionContext ? ACTIONS_DOCK_WIDTH + 12 : ACTIONS_DOCK_WIDTH,
                height: ACTIONS_DOCK_HEIGHT,
            }}
        >
            <div
                className="mb-1.5 w-fit shrink-0 border px-2 py-1 text-[10px] font-black leading-3"
                data-testid="qidahen-turn-banner"
                data-tutorial-id="qidahen-turn-banner"
                style={{ borderColor: 'rgba(49,35,21,0.42)', background: 'rgba(255,246,220,0.88)', color: UI_STYLE.ink, boxShadow: '0 2px 7px rgba(56,35,15,0.08)', borderRadius: 9 }}
            >
                <div>{formatQidahenVisibleTurnLabel(visibleTurnLabel)}</div>
                <div className="mt-0.5 text-[9px]" style={{ color: UI_STYLE.bronze }}>
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
                                defaultValue: '局内剧本选择尚未完成，当前只可处理剧本介绍与房主选择。',
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
            {(!suppressPassiveActionContext || tutorialHighlightsSeasonSummary) && (!tutorialInfoStepActive || tutorialHighlightsSeasonSummary) && core.lastSeasonSummary ? (
                <div
                    className="mb-3 max-w-[420px] border-[3px] px-3 py-2 text-[12px] font-black leading-5"
                    data-testid="qidahen-season-summary"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapOpenPanel, color: UI_STYLE.ink, boxShadow: UI_SURFACE.mapOpenPanelShadow, borderRadius: 3 }}
                >
                    <div>{core.lastSeasonSummary.title}</div>
                    <div className="mt-1 space-y-1 text-[11px]" style={{ color: UI_STYLE.bronze }}>
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
                            sourceRegionName: core.gaoDiDispatchSelection.displayAnchorRegionName,
                            maxTroops: core.gaoDiDispatchSelection.maxTroops,
                            maxPopulation: core.gaoDiDispatchSelection.maxPopulation,
                            defaultValue: '选择调度目标 · 最多调 {{maxTroops}} 个部队或 {{maxPopulation}} 人口',
                        })}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {core.gaoDiDispatchSelection.summary}
                    </div>
                    {isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection) ? (
                        <div className="mt-2 border-t pt-2" style={{ borderColor: 'rgba(210,183,117,0.28)' }}>
                            <div className="text-[12px]" data-testid="qidahen-gao-di-dispatch-target" style={{ color: selectedGaoDiCandidate ? UI_STYLE.mapIvory : UI_STYLE.mapGold }}>
                                {selectedGaoDiCandidate
                                    ? t('board.actions.gaoDi.currentTarget', {
                                        targetRegionName: selectedGaoDiCandidate.targetRegionName,
                                        defaultValue: '当前目标：{{targetRegionName}}',
                                    })
                                    : t('board.actions.gaoDi.selectMapTarget', {
                                        defaultValue: '在地图上选择目标地区',
                                    })}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    data-testid="qidahen-gao-di-dispatch-confirm"
                                    disabled={!selectedGaoDiCandidate}
                                    className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                                    onClick={() => {
                                        if (selectedGaoDiCandidate) {
                                            onResolveGaoDiDispatch(selectedGaoDiCandidate.id);
                                        }
                                }}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                    {t('board.actions.gaoDi.confirmDispatch', { defaultValue: '确认调度' })}
                                </button>
                                <button
                                    type="button"
                                    data-testid="qidahen-gao-di-dispatch-skip"
                                    className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onResolveGaoDiDispatch('skip')}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                >
                                    {t('board.actions.gaoDi.skip', { defaultValue: '跳过调度' })}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            data-testid="qidahen-gao-di-dispatch-skip"
                            className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => onResolveGaoDiDispatch('skip')}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            {t('board.actions.gaoDi.skip', { defaultValue: '跳过高第调度' })}
                        </button>
                    )}
                </div>
            ) : null}
            {internalDispatchSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-internal-dispatch-selection"
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanel, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 3 }}
                >
                    <div>{internalDispatchSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.internalDispatch.summary', {
                            sourceRegionName: internalDispatchSelection.displayAnchorRegionName,
                            maxTroops: internalDispatchSelection.maxTroops,
                            defaultValue: '选择调度目标 · 最多调 {{maxTroops}} 个部队',
                        })}
                    </div>
                    <div className="mt-2 border-t pt-2" style={{ borderColor: 'rgba(210,183,117,0.28)' }}>
                        <div
                            className="text-[12px]"
                            data-testid="qidahen-internal-dispatch-target"
                            aria-live="polite"
                            style={{ color: selectedInternalDispatchCandidate ? UI_STYLE.mapIvory : UI_STYLE.mapGold }}
                        >
                            {selectedInternalDispatchCandidate
                                ? t('board.actions.internalDispatch.currentTarget', {
                                    targetRegionName: selectedInternalDispatchCandidate.targetRegionName,
                                    defaultValue: '当前目标：{{targetRegionName}}',
                                })
                                : t('board.actions.internalDispatch.selectMapTarget', {
                                    defaultValue: '在地图上选择目标地区',
                                })}
                        </div>
                        {selectedInternalDispatchCandidate ? (
                            <div
                                className="mt-1 text-[11px] font-bold"
                                data-testid="qidahen-internal-dispatch-consequence"
                                style={{ color: UI_STYLE.mapGold }}
                            >
                                {selectedInternalDispatchCandidate.resolutionHint}
                            </div>
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                data-testid="qidahen-internal-dispatch-confirm"
                                disabled={!selectedInternalDispatchCandidate}
                                className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                                onClick={() => {
                                    if (selectedInternalDispatchCandidate) {
                                        onResolveInternalDispatch(selectedInternalDispatchCandidate.id);
                                    }
                            }}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                                {t('board.actions.internalDispatch.confirmDispatch', { defaultValue: '确认调度' })}
                            </button>
                            <button
                                type="button"
                                data-testid="qidahen-internal-dispatch-cancel"
                            disabled={!selectedInternalDispatchCandidate}
                            className="inline-flex min-h-[44px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-45"
                            onClick={onClearInternalDispatchChoice}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                                {t('board.actions.internalDispatch.cancelSelection', { defaultValue: '取消选择' })}
                            </button>
                        </div>
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
                            targetRegionName: recruitSelection.displayAnchorRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                            defaultValue: '选择建军方式',
                        })}
                    </div>
                    {recruitRegionExplicitlySelected ? (
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
                    ) : (
                        <div className="mt-2 border-[2px] px-2 py-2 text-[12px]" data-testid="qidahen-recruit-map-first-hint" style={{ borderColor: UI_STYLE.mapGold, background: 'rgba(255, 241, 205, 0.08)', color: UI_STYLE.mapIvory, borderRadius: 3 }}>
                            {t('board.actions.recruit.mapFirstHint', { defaultValue: '先点击地图上的建军地区，再选择建军方式。' })}
                        </div>
                    )}
                </div>
            ) : null}
            {grantPardonSelection ? (
                <div
                    className="mt-3 max-w-[420px] border-[3px] px-3 py-2 text-[13px] font-black leading-5"
                    data-testid="qidahen-grant-pardon-selection"
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: UI_SURFACE.mapPanel,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                        opacity: grantPardonHasMapTargets ? 0.72 : 1,
                    }}
                >
                    <div>{grantPardonSelection.title}</div>
                    <div className="mt-1 text-[11px]" style={{ color: UI_STYLE.mapGold }}>
                        {t('board.actions.grantPardon.mapFirstHint', {
                            summary: grantPardonMapChoices.length === 1
                                ? `${grantPardonMapChoices[0].sourceRegionName} → ${grantPardonMapChoices[0].targetRegionName}`
                                : grantPardonSelection.summary,
                            defaultValue: '主路径：点击地图上的目标地区完成招安；列表只作备用。{{summary}}',
                        })}
                    </div>
                    {grantPardonHasMapTargets ? null : (
                        <div className="mt-2 flex flex-col gap-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: UI_STYLE.mapGold }}>
                                {t('board.actions.grantPardon.fallbackListLabel', { defaultValue: '备用选择' })}
                            </div>
                            {grantPardonSelection.choices.map((choice) => (
                                <button
                                    key={choice.id}
                                    type="button"
                                    data-testid={`qidahen-grant-pardon-choice-${choice.id}`}
                                    className="inline-flex min-h-[44px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onResolveGrantPardonChoice(choice.id)}
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
                    )}
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
                            targetRegionName: maShiTradeSelection.displayAnchorRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
                            defaultValue: '选择建军数量',
                        })}
                    </div>
                    {maShiTradeRegionExplicitlySelected ? (
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
                    ) : (
                        <div className="mt-2 border-[2px] px-2 py-2 text-[12px]" data-testid="qidahen-ma-shi-trade-map-first-hint" style={{ borderColor: UI_STYLE.mapGold, background: 'rgba(255, 241, 205, 0.08)', color: UI_STYLE.mapIvory, borderRadius: 3 }}>
                            {t('board.actions.maShiTrade.mapFirstHint', { defaultValue: '先点击地图上的建军地区，再选择建军数量。' })}
                        </div>
                    )}
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
                            sourceRegionName: khanEdictSelection.displayAnchorRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
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
                            sourceRegionName: diplomacySelection.displayAnchorRegionName ?? t('board.actions.targetUnlocked', { defaultValue: '待选地区' }),
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
                            defaultValue: '在地图上点击外交目标；下方地区按钮仅作备用 · {{targetHint}}',
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
                    <div className="sr-only">
                        {diplomacySelection.candidateTargetRegionIds.map((regionId) => {
                            const region = core.regions.find((item) => item.id === regionId && !item.isLogicalRegion);
                            if (!region) return null;
                            return (
                                <button
                                    key={regionId}
                                    type="button"
                                    data-testid={`qidahen-diplomacy-target-${regionId}`}
                                    className="border-[2px] px-2 py-1 text-[11px] font-black"
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
                            sourceRegionName: wheelDispatchSelection.displayAnchorRegionName,
                            count: wheelDispatchSelection.candidates.length,
                            defaultValue: '进攻目标',
                        })}
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
                    {!core.pincerAdvanceSelection && !core.instigateDefectionSelection && !core.wuzhenChaohaSelection && getPendingCommittedTroopOptions(pendingTargetAction).length > 1 ? (
                        <div className="mt-2 text-[11px]" data-testid="qidahen-pending-committed-troops">
                            <span className="mr-1" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.pendingTarget.actualCommittedTroopsMapFirst', {
                                    defaultValue: '实际出兵：点击地图上的源地区兵牌切换数量',
                                })}
                            </span>
                            <span className="sr-only">
                                {getPendingCommittedTroopOptions(pendingTargetAction).map((committedTroops) => (
                                    <button
                                        key={committedTroops}
                                        type="button"
                                        data-testid={`qidahen-pending-committed-${committedTroops}`}
                                        onClick={() => onSelectPendingCommittedTroops(committedTroops)}
                                    >
                                        {committedTroops}
                                    </button>
                                ))}
                            </span>
                        </div>
                    ) : null}
                    {!core.pincerAdvanceSelection && !core.instigateDefectionSelection && !core.wuzhenChaohaSelection && hasStructuredCasualtyChoice(core, pendingTargetAction) ? (
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
                                                data-tutorial-id={`qidahen-${group.id}-casualty-${option.id}`}
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
                    {core.wuzhenChaohaSelection ? (
                        <div className="mt-2" data-testid="qidahen-wuzhen-chaoha-selection">
                            <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.wuzhenChaoha.hint', { defaultValue: '点击绿色步兵牌，指定其提前在炮兵阶段攻击。' })}
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span style={{ color: '#f3d1a5' }}>
                                    {t('board.actions.wuzhenChaoha.artilleryTechLabel', { defaultValue: '销毁《火炮技术》：' })}
                                </span>
                                {Array.from(
                                    { length: core.wuzhenChaohaSelection.maxDestroyedArtilleryTechCount + 1 },
                                    (_, count) => count,
                                ).map((count) => {
                                    const selected = count === core.wuzhenChaohaSelection?.destroyedArtilleryTechCount;
                                    return (
                                        <button
                                            key={count}
                                            type="button"
                                            data-testid={`qidahen-wuzhen-chaoha-artillery-tech-${count}`}
                                            className="inline-flex h-[28px] min-w-[34px] items-center justify-center border-[2px] px-2 text-[11px] font-black"
                                            onClick={() => onSetWuzhenChaohaArtilleryTechCount(count)}
                                            style={{
                                                borderColor: selected ? UI_STYLE.oldGold : UI_STYLE.mapInk,
                                                background: selected ? UI_SURFACE.mapPanelSelected : UI_SURFACE.paper,
                                                color: selected ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                                boxShadow: selected ? UI_SURFACE.mapPanelShadow : UI_SURFACE.hardShadow,
                                                borderRadius: 3,
                                            }}
                                        >
                                            {t('board.actions.wuzhenChaoha.artilleryTechCount', { count, defaultValue: '{{count}} 张' })}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                data-testid="qidahen-wuzhen-chaoha-cancel"
                                className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black"
                                onClick={onCancelWuzhenChaoha}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                {t('board.actions.cancel', { defaultValue: '取消' })}
                            </button>
                        </div>
                    ) : core.instigateDefectionSelection ? (
                        <div className="mt-2" data-testid="qidahen-instigate-defection-selection">
                            <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.instigateDefection.hint', { defaultValue: '点击绿色兵牌选择要策反的敌方次级部队。' })}
                            </div>
                            <button
                                type="button"
                                data-testid="qidahen-instigate-defection-cancel"
                                className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                onClick={onCancelInstigateDefection}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                            >
                                {t('board.actions.cancel', { defaultValue: '取消' })}
                            </button>
                        </div>
                    ) : core.pincerAdvanceSelection ? (
                        <div className="mt-2" data-testid="qidahen-pincer-advance-selection">
                            <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.pincerAdvance.hint', {
                                    selected: core.pincerAdvanceSelection.selectedChoiceIds.length,
                                    max: core.pincerAdvanceSelection.maxTroops,
                                    defaultValue: '点击绿色兵牌选择增援，已选 {{selected}}/{{max}}',
                                })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    data-testid="qidahen-pincer-advance-confirm"
                                    disabled={core.pincerAdvanceSelection.selectedChoiceIds.length === 0}
                                    className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={onResolvePincerAdvance}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                >
                                    {t('board.actions.pincerAdvance.confirm', { defaultValue: '确认增援' })}
                                </button>
                                <button
                                    type="button"
                                    data-testid="qidahen-pincer-advance-cancel"
                                    className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={onCancelPincerAdvance}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                >
                                    {t('board.actions.cancel', { defaultValue: '取消' })}
                                </button>
                            </div>
                        </div>
                    ) : core.infantryCavalryCombinedSelection ? (
                        <div className="mt-2" data-testid="qidahen-infantry-cavalry-combined-selection">
                            <div className="mb-2 text-[11px]" style={{ color: '#f3d1a5' }}>
                                {t('board.actions.infantryCavalryCombined.hint', { defaultValue: '步骑联合：选择骑兵撤离，或让骑兵转入步兵阶段共同攻击。' })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    data-testid="qidahen-infantry-cavalry-combined-withdraw"
                                    className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onResolveInfantryCavalryCombined('withdraw-cavalry')}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                >
                                    {t('board.actions.infantryCavalryCombined.withdraw', { defaultValue: '骑兵撤离' })}
                                </button>
                                <button
                                    type="button"
                                    data-testid="qidahen-infantry-cavalry-combined-joint-attack"
                                    className="inline-flex h-[38px] items-center justify-center border-[3px] px-3 text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                    onClick={() => onResolveInfantryCavalryCombined('joint-attack')}
                                    style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                >
                                    {t('board.actions.infantryCavalryCombined.jointAttack', { defaultValue: '步骑联合攻击' })}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {pendingTargetChoiceOptions.map((choice) => {
                                const consequence = choice.id === 'rear-guard'
                                    ? '撤退时最多损失 1 个幸存部队'
                                    : choice.id === 'rout'
                                        ? '撤退时损失全部幸存部队'
                                        : choice.id.startsWith('cavalry-evasion:')
                                            ? '骑兵退出本次战斗并撤往所选地区'
                                            : choice.id.startsWith('cavalry-plunder-')
                                                ? '骑兵改为劫掠，不进入常规交战'
                                                : choice.id === 'defender-hold-city'
                                                    ? '守军收入城内，直接进入城战'
                                                    : choice.id === 'defender-sortie'
                                                        ? '守军出城进行野战'
                                                        : null;
                                return (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        data-testid={getPendingTargetChoiceTestId(choice.id)}
                                        data-tutorial-id={getPendingTargetChoiceTestId(choice.id)}
                                        className="inline-flex min-h-[52px] flex-col items-start justify-center border-[3px] px-3 py-1.5 text-left text-[14px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => onResolvePendingAction(choice.value, pendingAttackerCasualtyPriority, pendingDefenderCasualtyPriority, pendingCommittedTroops)}
                                        style={{ minWidth: getPendingTargetChoiceMinWidth(choice.id), borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                    >
                                        <span>{getQidahenFriendlyPendingChoiceLabel(choice)}</span>
                                        {consequence ? <span className="mt-0.5 text-[10px]" style={{ color: UI_STYLE.mutedInk }}>{consequence}</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                    )}
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
                    {postBattleSelection.battleRolls && postBattleMode == null ? (
                        <QidahenBattleRollDiceSummary battleRolls={postBattleSelection.battleRolls} />
                    ) : null}
                    <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                        {t('board.actions.postBattle.summary', {
                            summary: postBattleSelection.summary,
                            survivingTroops: postBattleSelection.survivingTroops,
                            defaultValue: '{{summary}} · 幸存 {{survivingTroops}}',
                        })}
                    </div>
                    {postBattleMode == null ? (
                        <div className="mt-3 grid grid-cols-3 gap-2" data-testid="qidahen-post-battle-mode-selection">
                            {(['occupy', 'besiege', 'withdraw'] as const).map((mode) => {
                                const choiceCount = postBattleSelection.choices.filter((choice) => choice.mode === mode).length;
                                if (choiceCount === 0) {
                                    return null;
                                }
                                const label = mode === 'occupy'
                                    ? t('board.actions.postBattle.modeOccupy', { defaultValue: '占领' })
                                    : mode === 'besiege'
                                        ? t('board.actions.postBattle.modeBesiege', { defaultValue: '围城' })
                                        : t('board.actions.postBattle.modeWithdraw', { defaultValue: '撤回' });
                                return (
                                    <button
                                        key={mode}
                                        type="button"
                                        data-testid={`qidahen-post-battle-mode-${mode}`}
                                        className="min-h-[52px] border-[3px] px-3 py-2 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                        onClick={() => setPostBattleMode(mode)}
                                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                        >
                                        <span className="block">{label}</span>
                                        <span className="mt-1 block text-[10px]" style={{ color: UI_STYLE.mutedInk }}>
                                            {t('board.actions.postBattle.choiceCount', {
                                                count: choiceCount,
                                                defaultValue: '{{count}} 种结果',
                                            })}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mt-3" data-testid={`qidahen-post-battle-mode-options-${postBattleMode}`}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="text-[12px]" style={{ color: UI_STYLE.mapGold }}>
                                    {postBattleMode === 'occupy'
                                        ? t('board.actions.postBattle.occupyTitle', { defaultValue: '占领方式' })
                                        : postBattleMode === 'besiege'
                                            ? t('board.actions.postBattle.besiegeTitle', { defaultValue: '围城方式' })
                                            : t('board.actions.postBattle.withdrawTitle', { defaultValue: '撤回路线' })}
                                </div>
                                <button
                                    type="button"
                                    className="min-h-[44px] border-[2px] px-3 text-[12px] font-black"
                                    onClick={() => {
                                        setPostBattleMode(null);
                                        setDraftPostBattleChoiceId(null);
                                    }}
                                    style={{ borderColor: UI_STYLE.mapGold, color: UI_STYLE.mapIvory, borderRadius: 3 }}
                                >
                                    {t('board.actions.postBattle.back', { defaultValue: '返回' })}
                                </button>
                            </div>
                            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
                                {postBattleModeChoices.map((choice) => {
                                    const selected = choice.id === draftPostBattleChoiceId;
                                    return (
                                        <button
                                            key={choice.id}
                                            type="button"
                                            aria-pressed={selected}
                                            data-testid={`qidahen-post-battle-choice-${choice.id}`}
                                            className="inline-flex min-h-[52px] items-start justify-between gap-3 border-[3px] px-3 py-2 text-left text-[12px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                                            onClick={() => setDraftPostBattleChoiceId(choice.id)}
                                            style={{ borderColor: selected ? UI_STYLE.cinnabar : UI_STYLE.mapInk, background: selected ? UI_SURFACE.paperPressed : UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                                        >
                                            <span className="min-w-0">
                                                <span className="block text-[13px]">{choice.label}</span>
                                                <span className="mt-1 block text-[11px]" style={{ color: UI_STYLE.mutedInk }}>
                                                    {choice.detail}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                data-testid="qidahen-post-battle-confirm"
                                disabled={!draftPostBattleChoice}
                                className="mt-3 min-h-[44px] w-full border-[3px] px-4 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                                onClick={() => {
                                    if (draftPostBattleChoice) {
                                        onResolvePostBattleDecision(draftPostBattleChoice.id);
                                    }
                            }}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                                {t('board.actions.postBattle.confirm', { defaultValue: '确认战后处理' })}
                            </button>
                        </div>
                    )}
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
    width?: number;
    height?: number;
    overlapPx?: number;
    onClick?: () => void;
}> = ({
    card,
    locale,
    selected = false,
    stackIndex,
    totalCards,
    width = CARD_DIMENSIONS.hand.width,
    height = CARD_DIMENSIONS.hand.height,
    overlapPx = getQidahenHandCardOverlapPx(totalCards),
    onClick,
}) => {
    const disabled = card.status === 'disabled';
    const cardKindBadgeKind = getQidahenHandCardBadgeKind(card);
    const cardKindBadge = cardKindBadgeKind
        ? HAND_CARD_KIND_LABELS[cardKindBadgeKind]
        : null;
    const selectedTransform = selected
        ? `translateY(-${HAND_CARD_SELECTED_LIFT}px) scale(${HAND_CARD_SELECTED_SCALE})`
        : undefined;

    return (
        <div
            className="relative shrink-0 rounded-[11px]"
            data-qidahen-hand-card-selected={selected ? 'true' : undefined}
            data-testid={`qidahen-hand-card-shell-${card.id}`}
            style={{
                width,
                height,
                zIndex: selected ? totalCards + 12 : stackIndex + 1,
                marginLeft: stackIndex === 0 ? 0 : overlapPx,
                transform: selectedTransform,
                transformOrigin: 'bottom center',
                transition: 'transform 180ms ease-out',
            }}
        >
            <SelectableGameObject
                aria-label={card.label}
                disabled={disabled}
                selected={selected}
                available={Boolean(onClick)}
                data-testid={`qidahen-hand-card-${card.id}`}
                data-tutorial-id={getQidahenHandCardTutorialTargetId(card)}
                tabIndex={disabled ? -1 : 0}
                className={`z-20 h-full w-full origin-bottom rounded-[9px] bg-transparent hover:z-50 hover:brightness-[1.03] ${selected ? 'brightness-[1.08]' : 'hover:-translate-y-[18px]'}`}
                onClick={onClick}
                style={{
                    background: 'transparent',
                    borderRadius: 9,
                }}
            >
                <span
                    className="pointer-events-none absolute inset-0 z-0 rounded-[9px]"
                    style={{ boxShadow: selected ? '0 12px 22px rgba(56,35,15,0.32)' : '0 8px 16px rgba(56,35,15,0.18)' }}
                />
                <span className="pointer-events-none relative z-10 block h-full w-full overflow-hidden rounded-[9px]">
                    <CardPreviewFit
                        previewRef={card.previewRef}
                        locale={locale}
                        title={card.label}
                        width={width}
                        height={height}
                        rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                        rawHeight={CARD_DIMENSIONS.hand.rawHeight}
                    />
                </span>
                {cardKindBadge ? (
                    <span
                        className="pointer-events-none absolute left-2 top-2 z-30 rounded border-[2px] px-2 py-0.5 text-[11px] font-black"
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
            </SelectableGameObject>
        </div>
    );
};

const HandZone: React.FC<{
    core: QidahenCore;
    pendingTargetAction: QidahenCore['pendingTargetAction'];
    viewerFactionId: QidahenFactionId | null;
    playerID: string | null;
    locale?: string;
    mapTargetSelectionActive?: boolean;
    actionPaymentPreviewVisible: boolean;
    selectedPaymentCardIds: string[];
    handLimitDiscardSelection: QidahenHandLimitDiscardSelection | null;
    selectedHandLimitCardIds: string[];
    onTogglePaymentCard: (cardId: string) => void;
    onToggleHandLimitDiscardCard: (cardId: string) => void;
    onSelectSunYuanhuaTechCard: (cardId: string) => void;
    onSelectGaoDiDispatchCard: (cardId: string) => void;
    onPlayTacticCard: (cardId: string) => void;
    onPlayBattleResponseEventCard: (cardId: string) => void;
    onPreviewActionFromHandCard: (card: QidahenHandCard) => void;
    onMagnifyCard?: (target: QidahenMagnifyTarget) => void;
    isTutorialTargetAllowed?: (targetId: string | null | undefined) => boolean;
}> = ({
    core,
    pendingTargetAction,
    viewerFactionId,
    playerID,
    locale,
    mapTargetSelectionActive = false,
    actionPaymentPreviewVisible,
    selectedPaymentCardIds,
    handLimitDiscardSelection,
    selectedHandLimitCardIds,
    onTogglePaymentCard,
    onToggleHandLimitDiscardCard,
    onSelectSunYuanhuaTechCard,
    onSelectGaoDiDispatchCard,
    onPlayTacticCard,
    onPlayBattleResponseEventCard,
    onPreviewActionFromHandCard,
    onMagnifyCard,
    isTutorialTargetAllowed,
}) => {
    const { t } = useTranslation('game-qidahen');
    const [isMobileLandscapeViewport, setIsMobileLandscapeViewport] = React.useState(() => (
        typeof window !== 'undefined'
        && window.innerWidth <= MOBILE_MAX_VIEWPORT_WIDTH
        && window.innerWidth > window.innerHeight
    ));
    const [mobileViewportWidth, setMobileViewportWidth] = React.useState(() => (
        typeof window !== 'undefined' ? window.innerWidth : STAGE_WIDTH
    ));
    const [selectedTacticCardId, setSelectedTacticCardId] = React.useState<string | null>(null);
    React.useEffect(() => {
        const updateViewportMode = () => {
            setIsMobileLandscapeViewport(window.innerWidth <= MOBILE_MAX_VIEWPORT_WIDTH && window.innerWidth > window.innerHeight);
            setMobileViewportWidth(window.innerWidth);
        };
        updateViewportMode();
        window.addEventListener('resize', updateViewportMode);
        return () => {
            window.removeEventListener('resize', updateViewportMode);
        };
    }, []);
    const currentFactionId = handLimitDiscardSelection?.factionId
        ?? (playerID == null ? (viewerFactionId ?? getCurrentFactionId(core)) : viewerFactionId);
    if (!currentFactionId) {
        return null;
    }
    const currentFaction = core.factions[currentFactionId];
    const currentHandCards = core.handCards.filter((card) => card.faction === currentFactionId);
    const selectedTacticCard = currentHandCards.find((card) => card.id === selectedTacticCardId) ?? null;
    const handDockWidth = isMobileLandscapeViewport ? Math.max(360, mobileViewportWidth - 190) : HAND_DOCK_WIDTH;
    const handDockMaxWidth: number | string = isMobileLandscapeViewport ? handDockWidth : 'calc(100vw - 320px)';
    const mobileHandLayout = getQidahenMobileLandscapeHandLayout(handDockWidth);
    const handCardWidth = isMobileLandscapeViewport
        ? mobileHandLayout.width
        : CARD_DIMENSIONS.hand.width;
    const handCardHeight = isMobileLandscapeViewport
        ? mobileHandLayout.height
        : CARD_DIMENSIONS.hand.height;
    const handCardSelectedLift = isMobileLandscapeViewport ? 18 : HAND_CARD_SELECTED_LIFT;
    const bottomDockHeight = handCardHeight + handCardSelectedLift + 4;
    const handCardOverlapPx = getQidahenHandCardOverlapPx(
        currentHandCards.length,
        handCardWidth,
        isMobileLandscapeViewport ? mobileHandLayout.availableWidth : undefined,
    );
    const isHandCardSelected = (card: QidahenHandCard): boolean => (
        selectedPaymentCardIds.includes(card.id)
        || selectedHandLimitCardIds.includes(card.id)
        || (core.sunYuanhuaTechSelection?.selectedCardIds.includes(card.id) ?? false)
        || (core.gaoDiDispatchSelection?.selectedCardId === card.id)
        || selectedTacticCardId === card.id
    );
    const dockBottomInset = 'var(--qidahen-mobile-bottom-inset, 0px)';

    return (
        <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[80]"
            data-testid="qidahen-bottom-dock"
            style={{
                height: bottomDockHeight,
                bottom: dockBottomInset,
            }}
        >
            {selectedTacticCard ? (
                <div
                    className="pointer-events-auto absolute left-1/2 z-[96] flex items-center justify-between gap-3 border-[3px] px-4 py-3"
                    data-testid="qidahen-tactic-card-selection-panel"
                    data-ui-anchor="bottom-hand"
                    style={{
                        bottom: handCardHeight + handCardSelectedLift + 12,
                        transform: 'translateX(-50%)',
                        width: Math.min(620, handDockWidth - 48),
                        borderColor: UI_STYLE.oldGold,
                        background: UI_SURFACE.mapPanelSelected,
                        color: UI_STYLE.mapIvory,
                        boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`,
                        borderRadius: 3,
                    }}
                >
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-black leading-5" data-testid="qidahen-selected-tactic-card-label">
                            {t('board.handInteraction.selectedTacticCard', {
                                card: selectedTacticCard.label,
                                defaultValue: '已选战术牌「{{card}}」',
                            })}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: '#f3d1a5' }}>
                            {t('board.handInteraction.tacticCardHint', {
                                defaultValue: '点击“打出战术牌”确认；再次点击这张手牌可取消选中。',
                            })}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            data-testid="qidahen-confirm-tactic-card"
                            data-tutorial-id="qidahen-confirm-tactic-card"
                            className="inline-flex min-h-[40px] min-w-[128px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => onPlayTacticCard(selectedTacticCard.id)}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            {t('board.handInteraction.confirmTacticCard', { defaultValue: '打出战术牌' })}
                        </button>
                        <button
                            type="button"
                            data-testid="qidahen-cancel-tactic-card"
                            className="inline-flex min-h-[40px] min-w-[88px] items-center justify-center border-[3px] px-3 text-[13px] font-black transition hover:-translate-y-0.5 active:translate-y-0.5"
                            onClick={() => setSelectedTacticCardId(null)}
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paper, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, borderRadius: 3 }}
                        >
                            {t('board.handInteraction.cancelTacticCard', { defaultValue: '取消' })}
                        </button>
                    </div>
                </div>
            ) : null}
            <div
                className="pointer-events-auto absolute left-[44px]"
                data-testid="qidahen-draw-anchor"
                style={{ bottom: BOTTOM_DOCK_INSET, left: 'calc(44px - var(--qidahen-mobile-edge-pull, 0px))' }}
            >
                <DeckStack
                    src={CARD_BACK_BY_FACTION[currentFactionId]}
                    label={`${currentFaction.name}抽牌`}
                    count={currentFaction.drawPileCount}
                    testId="qidahen-draw-pile"
                />
            </div>
            <div
                className={`${mapTargetSelectionActive ? 'pointer-events-none' : 'pointer-events-auto'} absolute left-1/2 flex items-end ${isMobileLandscapeViewport ? 'justify-start' : 'justify-center'} overflow-x-auto overflow-y-visible`}
                data-testid="qidahen-hand-zone"
                data-tutorial-id="qidahen-hand-zone"
                data-ui-role="qidahen-hand-dock"
                data-map-target-selection-active={mapTargetSelectionActive ? 'true' : undefined}
                style={{
                    bottom: BOTTOM_DOCK_INSET,
                    transform: 'translateX(-50%)',
                    height: bottomDockHeight,
                    width: handDockWidth,
                    maxWidth: handDockMaxWidth,
                }}
            >
                <div className="mx-auto flex min-w-max items-end justify-center px-2" data-testid="qidahen-hand-row">
                    {currentHandCards.map((card, index) => {
                        const selectableForHandLimit = handLimitDiscardSelection?.candidateCardIds.includes(card.id) ?? false;
                        const sunYuanhuaSelection = core.sunYuanhuaTechSelection;
                        const selectableForSunYuanhua = sunYuanhuaSelection?.candidateCardIds.includes(card.id) ?? false;
                        const gaoDiSelection = core.gaoDiDispatchSelection;
                        const selectableForGaoDi = gaoDiSelection?.candidateCardIds.includes(card.id) ?? false;
                        const tacticSide = pendingTargetAction?.attackerFactionId === card.faction
                            ? 'attacker'
                            : pendingTargetAction?.defenderFactionId === card.faction
                                ? 'defender'
                                : null;
                        const selectableForTactic = !actionPaymentPreviewVisible
                            && !selectableForHandLimit
                            && !selectableForSunYuanhua
                            && !selectableForGaoDi
                            && pendingTargetAction != null
                            && tacticSide != null
                            && card.cardKind === 'tactic'
                            && card.status !== 'disabled'
                            && (
                                isQidahenFeignedRetreatCardPlayable(core, card)
                                || isQidahenTacticCardPlayableForPendingBattle(
                                    core,
                                    card,
                                    pendingTargetAction,
                                    tacticSide,
                                )
                            );
                        const selectableForBattleResponseEvent = !actionPaymentPreviewVisible
                            && !selectableForHandLimit
                            && !selectableForSunYuanhua
                            && !selectableForGaoDi
                            && pendingTargetAction != null
                            && isQidahenDefeatInDetailPlayable(core, card, pendingTargetAction);
                        const tutorialTargetId = getQidahenHandCardTutorialTargetId(card);
                        const tutorialAllowed = (isTutorialTargetAllowed?.(tutorialTargetId) ?? true)
                            || (tutorialTargetId !== card.id && (isTutorialTargetAllowed?.(card.id) ?? false));
                        const selectableForActionPayment = actionPaymentPreviewVisible && card.status !== 'disabled' && tutorialAllowed;
                        const selectableForDirectHandAction = !actionPaymentPreviewVisible
                            && !selectableForHandLimit
                            && !selectableForSunYuanhua
                            && !selectableForGaoDi
                            && !selectableForBattleResponseEvent
                            && getQidahenDirectActionIdForHandCard(card) != null
                            && tutorialAllowed;
                        return (
                            <HandCard
                                key={card.id}
                                card={card}
                                locale={locale}
                                selected={isHandCardSelected(card)}
                                stackIndex={index}
                                totalCards={currentHandCards.length}
                                width={handCardWidth}
                                height={handCardHeight}
                                overlapPx={handCardOverlapPx}
                                onClick={selectableForHandLimit
                                    ? () => onToggleHandLimitDiscardCard(card.id)
                                    : selectableForSunYuanhua
                                        ? () => onSelectSunYuanhuaTechCard(card.id)
                                    : selectableForGaoDi
                                        ? () => onSelectGaoDiDispatchCard(card.id)
                                    : selectableForBattleResponseEvent && tutorialAllowed
                                        ? () => onPlayBattleResponseEventCard(card.id)
                                    : selectableForTactic && tutorialAllowed
                                        ? () => setSelectedTacticCardId((current) => (current === card.id ? null : card.id))
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
                    height: bottomDockHeight,
                    width: handDockWidth,
                    maxWidth: handDockMaxWidth,
                }}
            >
                <div className="mx-auto flex min-w-max items-end justify-center px-2">
                    {currentHandCards.map((card, index) => {
                        const selected = isHandCardSelected(card);
                        return (
                            <div
                                key={`magnify-${card.id}`}
                                className="pointer-events-none relative shrink-0"
                                style={{
                                    width: handCardWidth,
                                    height: handCardHeight,
                                    zIndex: selected ? currentHandCards.length + 48 : currentHandCards.length + index + 24,
                                    marginLeft: index === 0 ? 0 : handCardOverlapPx,
                                    transform: selected
                                        ? `translateY(-${handCardSelectedLift}px) scale(${HAND_CARD_SELECTED_SCALE})`
                                        : undefined,
                                    transformOrigin: 'bottom center',
                                    transition: 'transform 180ms ease-out',
                                }}
                            >
                                <button
                                    type="button"
                                    data-testid={`qidahen-hand-card-magnify-${card.id}`}
                                    aria-label={t('board.magnifyCardAria', { card: card.label })}
                                    className={`${mapTargetSelectionActive || handLimitDiscardSelection != null ? 'pointer-events-none' : 'pointer-events-auto'} absolute right-1 top-1 inline-flex items-center justify-center rounded-full border-[2px] text-[11px] font-black transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30 ${isMobileLandscapeViewport ? 'h-11 min-w-11' : 'h-[26px] min-w-[26px]'}`}
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
                        );
                    })}
                </div>
            </div>
            <div
                className="absolute right-[44px]"
                data-testid="qidahen-discard-anchor"
                style={{ bottom: BOTTOM_DOCK_INSET, right: 'calc(44px - var(--qidahen-mobile-edge-pull, 0px))' }}
            >
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

const QidahenSetupObjectChoice: React.FC<{
    label: string;
    previewRef: CardPreviewRef | null;
    selected: boolean;
    testId: string;
    onClick: () => void;
    onMagnify?: () => void;
    disabled?: boolean;
}> = ({ label, previewRef, selected, testId, onClick, onMagnify, disabled = false }) => {
    const { t } = useTranslation('game-qidahen');
    return (
        <div className="relative h-[226px] w-[164px] shrink-0" data-qidahen-setup-choice-shell>
            <SelectableGameObject
                aria-label={`选择${label}`}
                selected={selected}
                available={!disabled}
                disabled={disabled}
                data-testid={testId}
                data-qidahen-choice-selected={selected ? 'true' : undefined}
                className={`group h-[226px] w-[164px] rounded-[9px] bg-transparent active:translate-y-0 ${disabled ? 'cursor-default opacity-65' : 'hover:-translate-y-2'} ${selected ? '-translate-y-2 opacity-100' : ''}`}
                onClick={onClick}
            >
                {previewRef ? (
                    <span className="pointer-events-none relative block h-full w-full overflow-hidden rounded-[9px] bg-[#efe3c4] shadow-[0_8px_18px_rgba(56,35,15,0.24)]">
                        <CardPreviewFit
                            previewRef={previewRef}
                            title={label}
                            width={164}
                            height={226}
                            rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                            rawHeight={CARD_DIMENSIONS.hand.rawHeight}
                        />
                    </span>
                ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[9px] border-[2px] border-dashed px-3 text-center" style={{ borderColor: UI_STYLE.cinnabar, background: UI_SURFACE.paperQuiet, color: UI_STYLE.ink }}>
                        <span className="text-[15px] font-black">{label}</span>
                        <span className="text-[11px]" style={{ color: UI_STYLE.mutedInk }}>{t('board.setup.missingOfficialCardArt', { defaultValue: '缺少正式卡图' })}</span>
                    </span>
                )}
            </SelectableGameObject>
            {previewRef && onMagnify ? (
                <button
                    type="button"
                    className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center border-[2px] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#b83b27]/30"
                    aria-label={`放大查看${label}`}
                    title={`放大查看${label}`}
                    onClick={onMagnify}
                    style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.paperLight, color: UI_STYLE.ink, borderRadius: 4 }}
                >
                    <Maximize2 aria-hidden="true" className="h-5 w-5" />
                </button>
            ) : null}
        </div>
    );
};

const QidahenInMatchSetupOverlay: React.FC<{
    core: QidahenCore;
    viewerFactionId: QidahenFactionId | null;
    playerID: string | null;
    onResolveScenarioCharacterChoice: (groupId: string, characterIds: string[]) => void;
    onResolveScenarioArmamentChoice: (groupId: string, armamentIds: QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds']) => void;
    onMagnifyCard: (target: QidahenMagnifyTarget) => void;
}> = ({
    core,
    viewerFactionId,
    playerID,
    onResolveScenarioCharacterChoice,
    onResolveScenarioArmamentChoice,
    onMagnifyCard,
}) => {
    const { t } = useTranslation('game-qidahen');
    const pendingCharacterChoices = core.pendingScenarioCharacterChoices;
    const pendingArmamentChoices = core.pendingScenarioArmamentChoices;
    const [setupCharacterChoices] = React.useState(() => pendingCharacterChoices);
    const [setupArmamentChoices] = React.useState(() => pendingArmamentChoices);
    const isViewerScoped = playerID != null && viewerFactionId != null;
    const interactiveCharacterChoices = setupCharacterChoices.filter((group) => !isViewerScoped || group.factionId === viewerFactionId);
    const waitingCharacterChoices = pendingCharacterChoices.filter((group) => isViewerScoped && group.factionId !== viewerFactionId);
    const interactiveArmamentChoices = setupArmamentChoices.filter((group) => !isViewerScoped || group.factionId === viewerFactionId);
    const waitingArmamentChoices = pendingArmamentChoices.filter((group) => isViewerScoped && group.factionId !== viewerFactionId);
    const [selectedCharacterIdsByGroup, setSelectedCharacterIdsByGroup] = React.useState<Record<string, string[]>>({});
    const [selectedArmamentIdsByGroup, setSelectedArmamentIdsByGroup] = React.useState<Record<string, string[]>>({});
    const applyInlineChoice = React.useCallback((
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

    const currentSeatLabel = t('board.setup.currentSeat', { defaultValue: '本席' });

    return (
        <div
            className="pointer-events-auto absolute inset-0 z-[140] flex items-center justify-center bg-[rgba(14,10,7,0.78)] px-6 py-8 backdrop-blur-[2px]"
            data-testid="qidahen-inmatch-setup-overlay"
        >
            <div
                className="relative max-h-full w-full max-w-[1180px] overflow-hidden border-[4px] p-5"
                data-ui-family="qidahen-book-setup"
                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.bookPaper, color: UI_STYLE.ink, boxShadow: '0 8px 0 rgba(58,37,17,0.26), 0 28px 46px rgba(13,8,4,0.42)', borderRadius: 8 }}
            >
                <div className="pointer-events-none absolute bottom-5 left-1/2 top-5 w-[2px] -translate-x-1/2" style={{ background: 'linear-gradient(180deg, transparent, rgba(84,55,24,0.38), transparent)' }} />
                <div className="relative flex flex-wrap items-end justify-between gap-3 border-b-[2px] pb-4" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: UI_STYLE.cinnabar }}>
                            {t('board.setup.eyebrow', { defaultValue: '局内开局设置' })}
                        </div>
                        <div className="mt-2 text-[28px] font-black" data-testid="qidahen-inmatch-setup-title">
                            {t('board.setup.title', { defaultValue: '确认本阵营人物与军备' })}
                        </div>
                        <div className="mt-2 text-[13px] leading-6" style={{ color: UI_STYLE.mutedInk }}>
                            {t('board.setup.description', { defaultValue: '选择候选后确认；确认前可以随时改选。' })}
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

                <div className="relative mt-5 grid min-h-0 gap-5 md:grid-cols-2">
                    <section
                        className="min-h-0 overflow-y-auto border-[3px] p-4"
                        data-testid="qidahen-inmatch-setup-book-page-player"
                        style={{ borderColor: UI_STYLE.paperEdge, background: UI_SURFACE.bookPage, boxShadow: UI_SURFACE.inkInset, borderRadius: 5 }}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                            <div className="text-[12px] font-black tracking-[0.16em]" style={{ color: UI_STYLE.cinnabar }}>
                                {viewerFactionId ? core.factions[viewerFactionId]?.name ?? currentSeatLabel : currentSeatLabel}
                            </div>
                            <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                {t('board.setup.playerPage', { defaultValue: '人物与军备' })}
                            </div>
                        </div>
                    {interactiveCharacterChoices.map((group) => {
                        const selectedIds = selectedCharacterIdsByGroup[group.id] ?? [];
                        const completed = !pendingCharacterChoices.some((pendingGroup) => pendingGroup.id === group.id);
                        return (
                            <div
                                key={group.id}
                                className="mb-4 border-b-[2px] pb-4 last:mb-0 last:border-b-0 last:pb-0"
                                data-testid={`qidahen-inmatch-setup-character-${group.id}`}
                                data-qidahen-inline-choice="character"
                                data-completed={completed ? 'true' : 'false'}
                                style={{ borderColor: UI_STYLE.bronzeFaint }}
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <div className="text-[12px] font-black tracking-[0.18em]" style={{ color: UI_STYLE.cinnabar }}>
                                        {group.factionName} · {t('board.setup.characterLabel', { defaultValue: '人物' })}
                                    </div>
                                    <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                        {completed
                                            ? t('board.setup.completed', { defaultValue: '已完成' })
                                            : t('board.setup.selectedCount', {
                                                selected: selectedIds.length,
                                                count: group.count,
                                                defaultValue: '已选 {{selected}} / {{count}}',
                                            })}
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-end gap-4">
                                    {group.characterIds.map((characterId, index) => {
                                        const selected = selectedIds.includes(characterId);
                                        const label = group.characterNames[index] ?? characterId;
                                        return (
                                            <QidahenSetupObjectChoice
                                                key={characterId}
                                                label={label}
                                                previewRef={getQidahenSetupCharacterPreview(group.factionId, characterId)}
                                                selected={selected}
                                                disabled={completed}
                                                testId={`qidahen-inmatch-setup-character-option-${group.id}-${characterId}`}
                                                onMagnify={() => {
                                                    const previewRef = getQidahenSetupCharacterPreview(group.factionId, characterId);
                                                    if (previewRef) {
                                                        onMagnifyCard({
                                                            previewRef,
                                                            title: label,
                                                            rawWidth: CARD_DIMENSIONS.hand.rawWidth,
                                                            rawHeight: CARD_DIMENSIONS.hand.rawHeight,
                                                        });
                                                    }
                                                }}
                                                onClick={() => applyInlineChoice(
                                                    group.id,
                                                    characterId,
                                                    group.count,
                                                    selectedCharacterIdsByGroup,
                                                    setSelectedCharacterIdsByGroup,
                                                )}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-4 border-t pt-3" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                                    <span className="text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                        {completed
                                            ? t('board.setup.characterConfirmed', { defaultValue: '人物选择已确认' })
                                            : selectedIds.length === group.count
                                                ? t('board.setup.readyToConfirm', { defaultValue: '候选已齐，可以确认' })
                                                : t('board.setup.remainingChoices', {
                                                    count: group.count - selectedIds.length,
                                                    defaultValue: '还需选择 {{count}} 项',
                                                })}
                                    </span>
                                    <button
                                        type="button"
                                        data-testid={`qidahen-inmatch-setup-character-confirm-${group.id}`}
                                        disabled={completed || selectedIds.length !== group.count}
                                        className="min-h-11 border-[2px] px-5 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                                        onClick={() => onResolveScenarioCharacterChoice(group.id, selectedIds)}
                                        style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, borderRadius: 4 }}
                                    >
                                        {completed
                                            ? t('board.setup.characterButtonConfirmed', { defaultValue: '人物已确认' })
                                            : t('board.setup.confirmCharacter', { defaultValue: '确认人物' })}
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {interactiveArmamentChoices.map((group) => {
                        const selectedIds = selectedArmamentIdsByGroup[group.id] ?? [];
                        const completed = !pendingArmamentChoices.some((pendingGroup) => pendingGroup.id === group.id);
                        return (
                            <div
                                key={group.id}
                                className="mb-4 border-b-[2px] pb-4 last:mb-0 last:border-b-0 last:pb-0"
                                data-testid={`qidahen-inmatch-setup-armament-${group.id}`}
                                data-qidahen-inline-choice="armament"
                                data-completed={completed ? 'true' : 'false'}
                                style={{ borderColor: UI_STYLE.bronzeFaint }}
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <div className="text-[12px] font-black tracking-[0.18em]" style={{ color: UI_STYLE.cinnabar }}>
                                        {group.factionName} · {t('board.setup.armamentLabel', { defaultValue: '军备' })}
                                    </div>
                                    <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                        {completed
                                            ? t('board.setup.completed', { defaultValue: '已完成' })
                                            : t('board.setup.selectedCount', {
                                                selected: selectedIds.length,
                                                count: group.count,
                                                defaultValue: '已选 {{selected}} / {{count}}',
                                            })}
                                    </div>
                                </div>
                                <div className="mt-2 text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                    {t('board.setup.armamentEligible', {
                                        factionName: group.factionName,
                                        defaultValue: '通用军备卡 · 本剧本允许{{factionName}}选择',
                                    })}
                                </div>
                                <div className="mt-3 flex flex-wrap items-end gap-4">
                                    {group.armamentIds.map((armamentId, index) => {
                                        const selected = selectedIds.includes(armamentId);
                                        const label = group.armamentNames[index] ?? armamentId;
                                        return (
                                            <QidahenSetupObjectChoice
                                                key={armamentId}
                                                label={label}
                                                previewRef={getQidahenSetupArmamentPreview(armamentId)}
                                                selected={selected}
                                                disabled={completed}
                                                testId={`qidahen-inmatch-setup-armament-option-${group.id}-${armamentId}`}
                                                onMagnify={() => {
                                                    const previewRef = getQidahenSetupArmamentPreview(armamentId);
                                                    if (previewRef) {
                                                        onMagnifyCard({
                                                            previewRef,
                                                            title: label,
                                                            rawWidth: CARD_DIMENSIONS.hand.rawWidth,
                                                            rawHeight: CARD_DIMENSIONS.hand.rawHeight,
                                                        });
                                                    }
                                                }}
                                                onClick={() => applyInlineChoice(
                                                    group.id,
                                                    armamentId,
                                                    group.count,
                                                    selectedArmamentIdsByGroup,
                                                    setSelectedArmamentIdsByGroup,
                                                )}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-4 border-t pt-3" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                                    <span className="text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                        {completed
                                            ? t('board.setup.armamentConfirmed', { defaultValue: '军备选择已确认' })
                                            : selectedIds.length === group.count
                                                ? t('board.setup.readyToConfirm', { defaultValue: '候选已齐，可以确认' })
                                                : t('board.setup.remainingChoices', {
                                                    count: group.count - selectedIds.length,
                                                    defaultValue: '还需选择 {{count}} 项',
                                                })}
                                    </span>
                                    <button
                                        type="button"
                                        data-testid={`qidahen-inmatch-setup-armament-confirm-${group.id}`}
                                        disabled={completed || selectedIds.length !== group.count}
                                        className="min-h-11 border-[2px] px-5 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                                        onClick={() => onResolveScenarioArmamentChoice(
                                            group.id,
                                            selectedIds as QidahenCore['pendingScenarioArmamentChoices'][number]['armamentIds'],
                                        )}
                                        style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, borderRadius: 4 }}
                                    >
                                        {completed
                                            ? t('board.setup.armamentButtonConfirmed', { defaultValue: '军备已确认' })
                                            : t('board.setup.confirmArmament', { defaultValue: '确认军备' })}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {interactiveCharacterChoices.length === 0 && interactiveArmamentChoices.length === 0 ? (
                        <div
                            className="flex min-h-[260px] items-center justify-center border-[2px] px-8 text-center text-[15px] font-black"
                            data-testid="qidahen-inmatch-setup-no-private-choice"
                            style={{ borderColor: UI_STYLE.bronzeFaint, color: UI_STYLE.mutedInk, background: 'rgba(255,255,255,0.32)', borderRadius: 4 }}
                        >
                            {t('board.setup.noPrivateChoice', { defaultValue: '本阵营没有需要选择的前置项，等待其他玩家完成。' })}
                        </div>
                    ) : null}
                    </section>

                    <section
                        className="min-h-0 overflow-y-auto border-[3px] p-4"
                        data-testid="qidahen-inmatch-setup-book-page-status"
                        style={{ borderColor: UI_STYLE.paperEdge, background: UI_SURFACE.bookPage, boxShadow: UI_SURFACE.inkInset, borderRadius: 5 }}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                            <div className="text-[12px] font-black tracking-[0.16em]" style={{ color: UI_STYLE.cinnabar }}>
                                {t('board.setup.tablePage', { defaultValue: '席位状态' })}
                            </div>
                            <div className="text-[11px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                {core.scenarioLabel}
                            </div>
                        </div>
                        <div
                            className="border-[2px] px-4 py-3 text-[13px] font-black leading-6"
                            data-testid="qidahen-inmatch-setup-waiting"
                            style={{ borderColor: UI_STYLE.paperEdge, background: 'rgba(255,255,255,0.48)', borderRadius: 4 }}
                        >
                            {waitingCharacterChoices.length > 0 || waitingArmamentChoices.length > 0
                                ? t('board.setup.waiting', { defaultValue: '等待其他玩家完成其所属阵营的前置项。' })
                                : t('board.setup.noWaiting', { defaultValue: '本席当前没有等待中的他人前置项。' })}
                            <div className="mt-1 text-[12px]" style={{ color: UI_STYLE.mutedInk }}>
                                {waitingSummaryLines.length > 0
                                    ? waitingSummaryLines.join(' / ')
                                    : t('board.setup.privateOnly', { defaultValue: '只显示你所属阵营可处理的项目，不暴露他人私有候选。' })}
                            </div>
                        </div>
                        <div className="mt-4 grid gap-2 text-[12px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                            {core.currentFactionOrder.map((factionId) => {
                                const faction = core.factions[factionId];
                                const ownCharacterCount = pendingCharacterChoices.filter((group) => group.factionId === factionId).length;
                                const ownArmamentCount = pendingArmamentChoices.filter((group) => group.factionId === factionId).length;
                                return (
                                    <div key={factionId} className="flex items-center justify-between border-b pb-2" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                                        <span>{faction.name}</span>
                                        <span>{ownCharacterCount + ownArmamentCount > 0
                                            ? t('board.setup.pendingItems', { count: ownCharacterCount + ownArmamentCount, defaultValue: '待完成 {{count}} 项' })
                                            : t('board.setup.completed', { defaultValue: '已完成' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

const QidahenScenarioVoteScreen: React.FC<{
    core: QidahenCore;
    playerID: string | null;
    playerNamesById: Record<string, string>;
    onCastScenarioVote: (scenarioId: QidahenScenarioId | null) => void;
}> = ({
    core,
    playerID,
    playerNamesById,
    onCastScenarioVote,
}) => {
    const { t } = useTranslation('game-qidahen');
    const [inspectedScenarioId, setInspectedScenarioId] = React.useState<QidahenScenarioId | null>(null);
    const [draftScenarioId, setDraftScenarioId] = React.useState<QidahenScenarioId | null>(null);
    const scenarioVote = core.scenarioVote;

    if (!scenarioVote) {
        return null;
    }

    const isHostViewer = playerID === scenarioVote.hostPlayerId;
    const playableScenarioIds = new Set(scenarioVote.options.map((option) => option.scenarioId));
    const scenarioOptions = QIDAHEN_SCENARIO_SETUP_OPTIONS.map((setupOption) => {
        const scenarioId = setupOption.value as QidahenScenarioId;
        return {
            ...getQidahenScenarioVoteMeta(scenarioId),
            isPlayable: playableScenarioIds.has(scenarioId),
        };
    });
    const seatRows = core.playerIds
        .map((seatPlayerId, index) => {
            if (!Object.prototype.hasOwnProperty.call(scenarioVote.votes, seatPlayerId)) {
                return null;
            }
            return {
                playerId: seatPlayerId,
                seatNumber: index + 1,
            };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
    const selectedScenarioLabel = draftScenarioId
        ? scenarioOptions.find((option) => option.scenarioId === draftScenarioId)?.label ?? null
        : null;
    const previewScenarioId = inspectedScenarioId ?? draftScenarioId;
    const previewScenario = previewScenarioId
        ? scenarioOptions.find((option) => option.scenarioId === previewScenarioId) ?? null
        : null;
    const previewDisabledReason = previewScenario
        ? t('board.scenarioVote.unavailableForPlayerCount', {
            count: scenarioVote.playerCount,
            supported: previewScenario.supportedPlayerCounts.join('/'),
            defaultValue: `当前 ${scenarioVote.playerCount} 人房不可用，适用 ${previewScenario.supportedPlayerCounts.join('/')} 人`,
        })
        : null;

    return (
        <div
            className="pointer-events-auto absolute inset-0 overflow-hidden px-[52px] py-[34px]"
            data-testid="qidahen-scenario-vote-screen"
            style={{
                background: [
                    'radial-gradient(circle at 13% 18%, rgba(159,52,38,0.24), transparent 26%)',
                    'radial-gradient(circle at 86% 26%, rgba(210,183,117,0.22), transparent 30%)',
                    'radial-gradient(circle at 72% 76%, rgba(32,21,13,0.34), transparent 36%)',
                    'linear-gradient(135deg, rgba(46,31,18,0.96) 0%, rgba(159,128,72,0.96) 44%, rgba(35,24,16,0.94) 100%)',
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
                className="relative grid h-full min-h-0 grid-cols-[0.78fr_1.22fr] gap-0 border-[4px] p-5"
                data-testid="qidahen-scenario-vote-layout"
                data-ui-family="qidahen-book-setup"
                style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.bookPaper, boxShadow: '0 8px 0 rgba(58,37,17,0.26), 0 28px 46px rgba(13,8,4,0.36)', borderRadius: 8 }}
            >
                <div className="pointer-events-none absolute bottom-5 left-1/2 top-5 w-[2px] -translate-x-1/2" style={{ background: 'linear-gradient(180deg, transparent, rgba(84,55,24,0.42), transparent)' }} />
                <section
                    className="flex min-h-0 flex-col border-[3px] p-5"
                    data-testid="qidahen-scenario-vote-book-page-intro"
                    style={{ borderColor: UI_STYLE.paperEdge, background: UI_SURFACE.bookPage, boxShadow: UI_SURFACE.inkInset, borderRadius: 5 }}
                >
                    <div className="flex items-start justify-between gap-4 border-b-[2px] pb-4" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                        <div>
                            <div className="text-[12px] font-black uppercase tracking-[0.28em]" style={{ color: UI_STYLE.cinnabar }}>
                                {t('board.scenarioVote.eyebrow', { defaultValue: '局内剧本选择' })}
                            </div>
                            <div className="mt-2 text-[31px] font-black tracking-[0.04em]" data-testid="qidahen-scenario-vote-title" style={{ color: UI_STYLE.ink }}>
                                {t('board.scenarioVote.title', { defaultValue: '房主选择本局剧本' })}
                            </div>
                            <div className="mt-2 text-[13px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                {isHostViewer
                                    ? t('board.scenarioVote.selectCard', { defaultValue: '选择一张剧本卡' })
                                    : t('board.scenarioVote.waitingHost', { defaultValue: '等待房主选择' })}
                            </div>
                        </div>
                        <div
                            className="shrink-0 border-[3px] px-4 py-2 text-[13px] font-black"
                            data-testid="qidahen-scenario-vote-player-count"
                            style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.paperPressed, color: UI_STYLE.ink, boxShadow: UI_SURFACE.hardShadow, clipPath: UI_SURFACE.smallCutCorner }}
                        >
                            {t('board.scenarioVote.playerCount', {
                                count: scenarioVote.playerCount,
                                defaultValue: '{{count}} 人房间',
                            })}
                        </div>
                    </div>

                    <div className="mt-5 flex min-h-0 flex-1 items-start">
                        <div className="grid w-full grid-cols-3 gap-5 pt-8" data-testid="qidahen-scenario-vote-card-rail">
                        {scenarioOptions.map((option) => {
                            const isDraft = draftScenarioId === option.scenarioId;
                            const isPreview = previewScenario?.scenarioId === option.scenarioId;
                            const disabledReason = t('board.scenarioVote.unavailableForPlayerCount', {
                                count: scenarioVote.playerCount,
                                supported: option.supportedPlayerCounts.join('/'),
                                defaultValue: `当前 ${scenarioVote.playerCount} 人房不可用，适用 ${option.supportedPlayerCounts.join('/')} 人`,
                            });
                            return (
                                <SelectableGameObject
                                    key={option.scenarioId}
                                    data-testid={`qidahen-scenario-vote-option-${option.scenarioId}`}
                                    disabled={!isHostViewer || !option.isPlayable}
                                    selected={isDraft}
                                    available={false}
                                    aria-label={option.isPlayable ? option.label : `${option.label}，${disabledReason}`}
                                    className={`group h-[350px] w-full rounded-[12px] bg-transparent cursor-pointer transition hover:-translate-y-1 active:translate-y-0 ${isDraft ? '-translate-y-2 ring-[#9f3426] shadow-[0_0_20px_rgba(159,52,38,0.36)]' : ''}`}
                                    onFocus={() => setInspectedScenarioId(option.scenarioId)}
                                    onMouseEnter={() => setInspectedScenarioId(option.scenarioId)}
                                    onMouseLeave={() => setInspectedScenarioId(null)}
                                    onClick={() => {
                                        if (isHostViewer && option.isPlayable) {
                                            setDraftScenarioId(option.scenarioId);
                                            setInspectedScenarioId(option.scenarioId);
                                        }
                                    }}
                                >
                                    <span className="pointer-events-none relative block h-full w-full overflow-hidden rounded-[12px] bg-[#efe3c4] shadow-[0_14px_24px_rgba(44,27,13,0.32)]">
                                        <CardPreviewFit
                                            previewRef={getQidahenScenarioCardPreview(option.scenarioId)}
                                            title={option.label}
                                            width={252}
                                            height={350}
                                            rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                                            rawHeight={CARD_DIMENSIONS.hand.rawHeight}
                                        />
                                    </span>
                                    <span
                                        className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-[2px] px-2 py-0.5 text-[10px] font-black"
                                        style={{
                                            borderColor: UI_STYLE.mapInk,
                                            background: isDraft ? UI_STYLE.cinnabar : isPreview ? UI_SURFACE.paperPressed : UI_SURFACE.paper,
                                            color: isDraft ? UI_STYLE.mapIvory : UI_STYLE.ink,
                                            boxShadow: UI_SURFACE.hardShadow,
                                        }}
                                    >
                                        {option.label}
                                    </span>
                                    {isDraft ? (
                                        <span
                                            className="pointer-events-none absolute -bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-[2px] px-3 py-1 text-[11px] font-black"
                                        data-testid={`qidahen-scenario-host-selected-${option.scenarioId}`}
                                        style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, boxShadow: UI_SURFACE.hardShadow }}
                                    >
                                            {t('board.scenarioVote.pendingConfirm', { defaultValue: '待确认' })}
                                        </span>
                                    ) : null}
                                    {!option.isPlayable ? (
                                        <span
                                            className="pointer-events-none absolute inset-x-3 bottom-3 z-20 border-[2px] px-3 py-2 text-center text-[10px] font-black"
                                            data-testid={`qidahen-scenario-vote-locked-${option.scenarioId}`}
                                            style={{ borderColor: UI_STYLE.mapGold, background: 'rgba(32,21,13,0.88)', color: UI_STYLE.mapGold, boxShadow: UI_SURFACE.mapPanelShadow }}
                                        >
                                            {disabledReason}
                                        </span>
                                    ) : null}
                                </SelectableGameObject>
                            );
                        })}
                        </div>
                    </div>
                </section>

                <section
                    className="flex min-h-0 flex-col border-[3px] p-5"
                    data-testid="qidahen-scenario-vote-feature-page"
                    data-ui-page="qidahen-scenario-vote-book-page-focus"
                    style={{ borderColor: UI_STYLE.paperEdge, background: UI_SURFACE.bookPage, color: UI_STYLE.ink, boxShadow: UI_SURFACE.inkInset, borderRadius: 5 }}
                >
                    <div
                        className="grid grid-cols-3 gap-3 text-[12px] font-black"
                        data-testid="qidahen-scenario-vote-seat-status"
                        data-ui-page="qidahen-scenario-vote-book-page-status"
                    >
                        {seatRows.map((row) => (
                            <div
                                key={row.playerId}
                                className="min-w-0 border px-3 py-2"
                                data-testid={`qidahen-scenario-vote-status-${row.playerId}`}
                                style={{ borderColor: UI_STYLE.bronzeFaint, background: 'rgba(255,249,225,0.56)', color: UI_STYLE.mutedInk, boxShadow: UI_SURFACE.inkInset, borderRadius: 4 }}
                            >
                                <div className="truncate" style={{ color: UI_STYLE.ink }}>
                                    {playerNamesById[row.playerId] ?? `席位 ${row.seatNumber}`}
                                    {row.playerId === playerID ? ` · ${t('board.scenarioVote.you', { defaultValue: '你' })}` : ''}
                                    {row.playerId === scenarioVote.hostPlayerId ? ` · ${t('board.scenarioVote.host', { defaultValue: '房主' })}` : ''}
                                </div>
                                <div className="mt-1 truncate">
                                    {row.playerId === scenarioVote.hostPlayerId
                                        ? t('board.scenarioVote.pendingVote', { defaultValue: '正在选择剧本' })
                                        : t('board.scenarioVote.waitingHost', { defaultValue: '等待剧本结果' })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex min-h-0 flex-1 items-center justify-center py-5">
                        {previewScenario ? (
                            <div
                                className="relative h-[720px] w-[520px] rounded-[16px] bg-[#efe3c4] shadow-[0_22px_46px_rgba(44,27,13,0.38)]"
                                data-testid="qidahen-scenario-vote-feature-card"
                            >
                                <CardPreviewFit
                                    previewRef={getQidahenScenarioCardPreview(previewScenario.scenarioId)}
                                    title={previewScenario.label}
                                    width={520}
                                    height={720}
                                    rawWidth={CARD_DIMENSIONS.hand.rawWidth}
                                    rawHeight={CARD_DIMENSIONS.hand.rawHeight}
                                />
                                {draftScenarioId === previewScenario.scenarioId ? (
                                    <span
                                        className="pointer-events-none absolute -bottom-4 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-[2px] px-4 py-1 text-[12px] font-black"
                                        data-testid={`qidahen-scenario-feature-selected-${previewScenario.scenarioId}`}
                                        style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, boxShadow: UI_SURFACE.hardShadow }}
                                    >
                                        {t('board.scenarioVote.pendingConfirm', { defaultValue: '待确认' })}
                                    </span>
                                ) : null}
                                {!previewScenario.isPlayable && previewDisabledReason ? (
                                    <span
                                        className="pointer-events-none absolute inset-x-5 bottom-5 z-20 border-[2px] px-3 py-2 text-center text-[12px] font-black"
                                        style={{ borderColor: UI_STYLE.mapGold, background: 'rgba(32,21,13,0.88)', color: UI_STYLE.mapGold, boxShadow: UI_SURFACE.mapPanelShadow }}
                                    >
                                        {previewDisabledReason}
                                    </span>
                                ) : null}
                            </div>
                        ) : (
                            <div
                                className="flex h-[360px] w-[520px] items-center justify-center border-[3px] px-12 text-center text-[16px] font-black"
                                data-testid="qidahen-scenario-vote-empty-preview"
                                style={{ borderColor: UI_STYLE.paperEdge, color: UI_STYLE.mutedInk, background: UI_SURFACE.paperQuiet, borderRadius: 6 }}
                            >
                                {t('board.scenarioVote.emptyPreview', { defaultValue: '选择左侧剧本卡查看详情' })}
                            </div>
                        )}
                    </div>

                    <div
                        className="grid grid-cols-[1fr_auto] items-center gap-4 border-[3px] px-4 py-3"
                        data-testid="qidahen-scenario-vote-actions"
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_SURFACE.mapPanelSelected, color: UI_STYLE.mapIvory, boxShadow: `${UI_SURFACE.mapPanelShadow}, ${UI_SURFACE.mapPanelInset}`, borderRadius: 5 }}
                    >
                        <div className="min-w-0">
                            <div className="text-[12px] font-black" style={{ color: UI_STYLE.mapGold }}>
                                {t('board.scenarioVote.actionTitle', { defaultValue: isHostViewer ? '房主操作' : '等待房主' })}
                            </div>
                            <div className="mt-1 text-[15px] font-black leading-6" style={{ color: UI_STYLE.mapIvory }}>
                                {isHostViewer
                                    ? selectedScenarioLabel ?? t('board.scenarioVote.selectCard', { defaultValue: '选择一张剧本卡' })
                                    : t('board.scenarioVote.waitingHost', { defaultValue: '等待房主选择' })}
                            </div>
                        </div>
                        {isHostViewer ? (
                            <button
                                type="button"
                                data-testid="qidahen-scenario-vote-confirm"
                                disabled={!draftScenarioId}
                                className="min-h-11 min-w-[190px] border-[2px] px-5 text-[14px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                                onClick={() => onCastScenarioVote(draftScenarioId)}
                                style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, borderRadius: 4 }}
                            >
                                {t('board.scenarioVote.confirmScenario', { defaultValue: '确认采用' })}
                            </button>
                        ) : (
                            <div
                                className="min-w-[180px] border px-3 py-2 text-center text-[13px] font-black"
                                style={{ borderColor: 'rgba(210,183,117,0.34)', background: 'rgba(32,21,13,0.42)', color: UI_STYLE.mapGold, clipPath: UI_SURFACE.smallCutCorner }}
                            >
                                {t('board.scenarioVote.waitingHostShort', { defaultValue: '等待房主' })}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

const FACTION_MARKER_ASSET: Record<QidahenFactionId, string> = {
    ming: ASSETS.mingMarker,
    mongol: ASSETS.mongolMarker,
    jin: ASSETS.jinMarker,
};

const QIDAHEN_FACTION_SELECTION_SUMMARY: Record<QidahenFactionId, string> = {
    ming: '资源紧张 · 守势经营',
    mongol: '机动灵活 · 牵制突袭',
    jin: '手牌充足 · 正面扩张',
};

const QidahenFactionSelectionScreen: React.FC<{
    core: QidahenCore;
    playerID: string | null;
    playerNamesById: Record<string, string>;
    locale?: string;
    onSelectFaction: (factionId: QidahenFactionId) => void;
}> = ({ core, playerID, playerNamesById, locale, onSelectFaction }) => {
    const { t } = useTranslation('game-qidahen');
    const selectionState = core.factionSelection;
    const ownSelection = playerID ? selectionState?.selections[playerID] ?? null : null;
    const [draftFactionId, setDraftFactionId] = React.useState<QidahenFactionId | null>(ownSelection);

    React.useEffect(() => {
        if (!selectionState || !draftFactionId) {
            return;
        }
        const ownerPlayerId = Object.entries(selectionState.selections).find(([, selectedFactionId]) => selectedFactionId === draftFactionId)?.[0] ?? null;
        if (ownerPlayerId && ownerPlayerId !== playerID) {
            setDraftFactionId(ownSelection);
        }
    }, [draftFactionId, ownSelection, playerID, selectionState]);

    if (!selectionState) {
        return null;
    }

    return (
        <div
            className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[rgba(18,12,8,0.78)] px-10 py-9 backdrop-blur-[2px]"
            data-testid="qidahen-faction-selection-screen"
        >
            <div
                className="w-full max-w-[1240px] border-[4px] p-7"
                style={{
                    borderColor: UI_STYLE.mapInk,
                    background: UI_SURFACE.bookPaper,
                    color: UI_STYLE.ink,
                    boxShadow: '0 8px 0 rgba(58,37,17,0.26), 0 28px 46px rgba(13,8,4,0.42)',
                    borderRadius: 8,
                }}
            >
                <div className="flex items-end justify-between gap-6 border-b-[2px] pb-5" style={{ borderColor: UI_STYLE.bronzeFaint }}>
                    <div>
                        <div className="text-[12px] font-black" style={{ color: UI_STYLE.cinnabar }}>
                            {t('board.factionSelection.eyebrow', { defaultValue: '局内开局设置' })}
                        </div>
                        <h2 className="mt-2 text-[30px] font-black" data-testid="qidahen-faction-selection-title">
                            {t('board.factionSelection.title', { defaultValue: '选择你的阵营' })}
                        </h2>
                    </div>
                    <div className="border-[2px] px-4 py-2 text-[13px] font-black" style={{ borderColor: UI_STYLE.paperEdge, background: UI_STYLE.paperLight, borderRadius: 4 }}>
                        {core.scenarioLabel}
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-5" data-testid="qidahen-faction-selection-options">
                    {selectionState.availableFactionIds.map((factionId) => {
                        const faction = core.factions[factionId];
                        const ownerPlayerId = Object.entries(selectionState.selections).find(([, selectedFactionId]) => selectedFactionId === factionId)?.[0] ?? null;
                        const ownerSeatNumber = ownerPlayerId ? core.playerIds.indexOf(ownerPlayerId) + 1 : null;
                        const selectedByViewer = draftFactionId === factionId;
                        const confirmedByViewer = ownerPlayerId != null && ownerPlayerId === playerID;
                        const occupiedByOther = ownerPlayerId != null && ownerPlayerId !== playerID;
                        return (
                            <button
                                key={factionId}
                                type="button"
                                data-testid={`qidahen-faction-option-${factionId}`}
                                data-selected={selectedByViewer ? 'true' : 'false'}
                                disabled={!playerID || occupiedByOther}
                                className="group relative flex min-h-[290px] flex-col items-center justify-center border-[4px] px-5 py-6 text-center transition duration-150 enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                    borderColor: selectedByViewer ? UI_STYLE.cinnabar : UI_STYLE.mapInk,
                                    background: selectedByViewer ? UI_SURFACE.mapOpenPanelSelected : UI_SURFACE.bookPage,
                                    boxShadow: selectedByViewer ? UI_SURFACE.mapOpenPanelShadow : UI_SURFACE.mapPanelShadow,
                                    borderRadius: 6,
                                }}
                                aria-pressed={selectedByViewer}
                                onClick={() => setDraftFactionId(factionId)}
                            >
                                <OptimizedImage
                                    src={FACTION_MARKER_ASSET[factionId]}
                                    locale={locale}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-[118px] w-[118px] object-contain drop-shadow-[0_10px_12px_rgba(50,31,14,0.28)]"
                                    draggable={false}
                                    placeholder={false}
                                />
                                <span className="mt-5 text-[25px] font-black">{faction.name}</span>
                                <span className="mt-2 text-[13px] font-black" style={{ color: UI_STYLE.mutedInk }}>
                                    {QIDAHEN_FACTION_SELECTION_SUMMARY[factionId]}
                                </span>
                                <span className="mt-3 text-[12px] font-black" style={{ color: selectedByViewer ? UI_STYLE.cinnabar : UI_STYLE.mutedInk }}>
                                    {confirmedByViewer && selectedByViewer
                                        ? t('board.factionSelection.youConfirmed', { defaultValue: '你已确认' })
                                        : selectedByViewer
                                            ? t('board.factionSelection.pendingConfirm', { defaultValue: '待确认' })
                                        : occupiedByOther
                                            ? t('board.factionSelection.occupiedBy', {
                                                playerName: playerNamesById[ownerPlayerId] ?? t('board.factionSelection.seatFallback', {
                                                    seatNumber: ownerSeatNumber,
                                                    defaultValue: '席位 {{seatNumber}}',
                                                }),
                                                defaultValue: '{{playerName}} 已确认',
                                            })
                                            : t('board.factionSelection.available', { defaultValue: '可选择' })}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 flex items-center justify-between gap-6 border-t-[2px] pt-4 text-[13px] font-black" style={{ borderColor: UI_STYLE.bronzeFaint, color: UI_STYLE.mutedInk }}>
                    <div className="min-w-0">
                        <span data-testid="qidahen-faction-selection-status">
                            {draftFactionId
                                ? t('board.factionSelection.draftStatus', {
                                    status: ownSelection === draftFactionId
                                        ? t('board.factionSelection.confirmedStatus', { defaultValue: '已确认' })
                                        : t('board.factionSelection.pendingStatus', { defaultValue: '待确认' }),
                                    factionName: core.factions[draftFactionId].name,
                                    defaultValue: '{{status}} {{factionName}}',
                                })
                                : t('board.factionSelection.chooseAvailable', { defaultValue: '请选择一个未被占用的阵营' })}
                        </span>
                        <span className="ml-4">
                            {t('board.factionSelection.confirmedCount', {
                                confirmed: Object.keys(selectionState.selections).length,
                                total: core.playerIds.length,
                                defaultValue: '已确认 {{confirmed}} / {{total}}',
                            })}
                        </span>
                    </div>
                    <button
                        type="button"
                        data-testid="qidahen-faction-selection-confirm"
                        disabled={!draftFactionId || draftFactionId === ownSelection}
                        className="min-h-11 min-w-[156px] border-[2px] px-5 text-[14px] font-black disabled:cursor-not-allowed disabled:opacity-45"
                        onClick={() => {
                            if (draftFactionId) {
                                onSelectFaction(draftFactionId);
                            }
                        }}
                        style={{ borderColor: UI_STYLE.mapInk, background: UI_STYLE.cinnabar, color: UI_STYLE.mapIvory, borderRadius: 4 }}
                    >
                        {t('board.factionSelection.confirmFaction', { defaultValue: '确认阵营' })}
                    </button>
                </div>
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
    const playerNamesById = React.useMemo(() => Object.fromEntries(
        (matchData ?? []).map((player) => [String(player.id), player.name?.trim() || `席位 ${player.id + 1}`]),
    ), [matchData]);
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
    const factionSelectionPending = core.factionSelection != null;
    const scenarioChoicesPending = core.pendingScenarioCharacterChoices.length > 0 || core.pendingScenarioArmamentChoices.length > 0;
    const setupStagePending = scenarioVotePending || factionSelectionPending || scenarioChoicesPending;
    const activeInteraction = G.sys.interaction?.current;
    const handLimitDiscardSelectionFromInteraction = getQidahenHandLimitDiscardSelectionFromInteraction(activeInteraction);
    const recruitSelectionFromInteraction = getQidahenRecruitSelectionFromInteraction(activeInteraction);
    const grantPardonSelectionFromInteraction = getQidahenGrantPardonSelectionFromInteraction(activeInteraction);
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
    const recruitSelectionFromCore = getCoreQidahenRecruitSelectionForCore(core);
    const recruitSelectionFromMirror = getQidahenRecruitSelectionForCore(core, activeInteraction);
    const recruitSelection = core.explicitRegionId && recruitSelectionFromCore
        ? recruitSelectionFromCore
        : recruitSelectionFromMirror;
    const grantPardonSelection = getQidahenGrantPardonSelectionForCore(core, activeInteraction);
    const grantPardonMapChoices = React.useMemo(() => (
        grantPardonSelection?.choices.filter((choice) => isTutorialTargetAllowed(choice.id)) ?? []
    ), [grantPardonSelection?.choices, isTutorialTargetAllowed]);
    const diplomacySelection = getQidahenDiplomacySelectionForCore(core, activeInteraction);
    const wheelDispatchSelection = getQidahenWheelDispatchSelectionForCore(core, activeInteraction);
    const internalDispatchSelection = getQidahenInternalDispatchSelectionForCore(core, activeInteraction);
    const maShiTradeSelectionFromCore = getCoreQidahenMaShiTradeSelectionForCore(core);
    const maShiTradeSelectionFromMirror = getQidahenMaShiTradeSelectionForCore(core, activeInteraction);
    const maShiTradeSelection = core.explicitRegionId && maShiTradeSelectionFromCore
        ? maShiTradeSelectionFromCore
        : maShiTradeSelectionFromMirror;
    const khanEdictSelection = getQidahenKhanEdictSelectionForCore(core, activeInteraction);
    const driveTigerConsentSelection = getQidahenDriveTigerConsentSelectionForCore(core, activeInteraction);
    const fortificationMaintenanceSelection = getQidahenFortificationMaintenanceSelectionForCore(core, activeInteraction);
    const pendingTargetAction = getQidahenPendingTargetActionForCore(core, activeInteraction);
    const postBattleSelection = getQidahenPostBattleSelectionForCore(core, activeInteraction);
    const [draftGaoDiChoiceId, setDraftGaoDiChoiceId] = React.useState<string | null>(null);
    const [draftInternalDispatchChoiceId, setDraftInternalDispatchChoiceId] = React.useState<string | null>(null);
    const draftGaoDiCandidate = core.gaoDiDispatchSelection?.candidates.find((candidate) => candidate.id === draftGaoDiChoiceId) ?? null;
    const draftInternalDispatchCandidate = internalDispatchSelection?.candidates.find(
        (candidate) => candidate.id === draftInternalDispatchChoiceId,
    ) ?? null;
    const draftMapCandidate = draftGaoDiCandidate ?? draftInternalDispatchCandidate;
    const draftMapSelectionActive = core.gaoDiDispatchSelection != null || internalDispatchSelection != null;
    const displayCore = React.useMemo(() => ({
        ...core,
        ...(draftMapSelectionActive ? {
            ...(draftMapCandidate ? { selectedRegionId: draftMapCandidate.targetRegionId } : {}),
            explicitRegionId: draftMapCandidate?.targetRegionId ?? null,
        } : {}),
        internalDispatchSelection,
        grantPardonSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
        pendingTargetAction,
    }), [
        core,
        draftMapCandidate,
        draftMapSelectionActive,
        driveTigerConsentSelection,
        grantPardonSelection,
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
    const mapViewportBeforeAutoFocusRef = React.useRef<QidahenMapViewport | null>(null);
    const activeAutoFocusKeyRef = React.useRef<string | null>(null);
    const [magnifyTarget, setMagnifyTarget] = React.useState<QidahenMagnifyTarget | null>(null);
    const [selectedHandLimitCardIds, setSelectedHandLimitCardIds] = React.useState<string[]>(handLimitDiscardSelection?.selectedCardIds ?? []);
    const gaoDiSelectionKey = core.gaoDiDispatchSelection
        ? `${core.gaoDiDispatchSelection.sourceRegionId}:${core.gaoDiDispatchSelection.selectedCardId ?? ''}`
        : null;
    const internalDispatchSelectionKey = internalDispatchSelection
        ? `${internalDispatchSelection.sourceRegionId}:${internalDispatchSelection.candidates.map((candidate) => candidate.id).join('|')}`
        : null;
    const factionStageSelectionActive = core.gaoDiDispatchSelection != null
        || internalDispatchSelection != null
        || recruitSelection != null
        || grantPardonSelection != null
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
    const tutorialShowsSeasonSummary = tutorialStep?.highlightTarget === 'qidahen-season-summary';
    const tutorialPrefersWheelStage = tutorialStep?.id === 'wheel-first'
        || tutorialStep?.id === 'wheel-move';
    const primaryStageMode: QidahenPrimaryStageMode | null = wheelStageSelectionActive
        ? 'wheel'
        : factionStageSelectionActive
            ? 'faction'
            : tutorialPrefersWheelStage && wheelStageAvailable
                ? 'wheel'
                : factionStageAvailable
                    ? 'faction'
                    : wheelStageAvailable
                        ? 'wheel'
                        : null;
    const activeHandLimitInteractionId = handLimitDiscardSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeRecruitInteractionId = recruitSelectionFromInteraction ? activeInteraction?.id ?? null : null;
    const activeGrantPardonInteractionId = grantPardonSelectionFromInteraction ? activeInteraction?.id ?? null : null;
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
        setDraftGaoDiChoiceId(null);
    }, [gaoDiSelectionKey]);

    React.useEffect(() => {
        setDraftInternalDispatchChoiceId(null);
    }, [internalDispatchSelectionKey]);

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

    const selectFaction = React.useCallback((factionId: QidahenFactionId) => {
        dispatch(QIDAHEN_COMMANDS.SELECT_FACTION, { factionId });
    }, [dispatch]);

    const previewAction = React.useCallback((actionId: string, tutorialTargetId = actionId, sourceHandCardId?: string) => {
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION) || !isTutorialTargetAllowed(tutorialTargetId)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, {
            actionId,
            ...(sourceHandCardId ? { sourceHandCardId } : {}),
        });
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

    const playTacticCard = React.useCallback((cardId: string) => {
        const card = core.handCards.find((candidate) => candidate.id === cardId);
        const tutorialTargetId = card ? getQidahenHandCardTutorialTargetId(card) : cardId;
        if (
            !isTutorialCommandAllowed(QIDAHEN_COMMANDS.PLAY_TACTIC_CARD)
            || (!isTutorialTargetAllowed(cardId) && !isTutorialTargetAllowed(tutorialTargetId))
        ) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.PLAY_TACTIC_CARD, { cardId });
    }, [core.handCards, dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed]);

    const playBattleResponseEventCard = React.useCallback((cardId: string) => {
        if (
            !isTutorialCommandAllowed(QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD)
            || !isTutorialTargetAllowed(cardId)
        ) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD, { cardId });
    }, [dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed]);

    const togglePincerAdvanceTroop = React.useCallback((choiceId: string) => {
        dispatch(QIDAHEN_COMMANDS.TOGGLE_PINCER_ADVANCE_TROOP, { choiceId });
    }, [dispatch]);

    const resolvePincerAdvance = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE, {});
    }, [dispatch]);

    const cancelPincerAdvance = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.CANCEL_PINCER_ADVANCE, {});
    }, [dispatch]);

    const resolveInfantryCavalryCombined = React.useCallback((mode: 'withdraw-cavalry' | 'joint-attack') => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_INFANTRY_CAVALRY_COMBINED, { mode });
    }, [dispatch]);

    const resolveInstigateDefection = React.useCallback((choiceId: string) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_INSTIGATE_DEFECTION, { choiceId });
    }, [dispatch]);

    const cancelInstigateDefection = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.CANCEL_INSTIGATE_DEFECTION, {});
    }, [dispatch]);

    const setWuzhenChaohaArtilleryTechCount = React.useCallback((count: number) => {
        dispatch(QIDAHEN_COMMANDS.SET_WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT, { count });
    }, [dispatch]);

    const resolveWuzhenChaoha = React.useCallback((choiceId: string) => {
        dispatch(QIDAHEN_COMMANDS.RESOLVE_WUZHEN_CHAOHA, { choiceId });
    }, [dispatch]);

    const cancelWuzhenChaoha = React.useCallback(() => {
        dispatch(QIDAHEN_COMMANDS.CANCEL_WUZHEN_CHAOHA, {});
    }, [dispatch]);

    const previewActionFromHandCard = React.useCallback((card: QidahenHandCard) => {
        const actionId = getQidahenDirectActionIdForHandCard(card);
        if (!actionId || !factionStageAvailable || actionPaymentPreviewVisible || card.status === 'disabled') {
            return;
        }
        previewAction(actionId, getQidahenHandCardTutorialTargetId(card), card.id);
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
            mergedValue: { qidahenRecruitSelection: recruitSelection },
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeRecruitInteractionId, dispatch, recruitSelection]);

    const resolveGrantPardonChoice = React.useCallback((choiceId: QidahenGrantPardonChoice['id']) => {
        if (!activeGrantPardonInteractionId || !grantPardonSelection) {
            return;
        }
        if (!isTutorialTargetAllowed(choiceId)) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeGrantPardonInteractionId,
            optionId: choiceId,
            mergedValue: { qidahenGrantPardonSelection: grantPardonSelection },
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeGrantPardonInteractionId, dispatch, grantPardonSelection, isTutorialTargetAllowed]);

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
                mergedValue: { qidahenInternalDispatchSelection: internalDispatchSelection },
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
            mergedValue: { qidahenKhanEdictSelection: khanEdictSelection },
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeKhanEdictInteractionId, dispatch, khanEdictSelection]);

    const resolveDiplomacyChoice = React.useCallback((choiceId: 'hire-only' | 'place-friendly' | 'flip-vassal' | 'remove-marker') => {
        if (!activeDiplomacyInteractionId || !diplomacySelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeDiplomacyInteractionId,
            optionId: choiceId,
            mergedValue: { qidahenDiplomacySelection: diplomacySelection },
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeDiplomacyInteractionId, diplomacySelection, dispatch]);

    const resolveMaShiTradeChoice = React.useCallback((troopCount: 1 | 2 | 3) => {
        if (!activeMaShiTradeInteractionId || !maShiTradeSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeMaShiTradeInteractionId,
            optionId: String(troopCount),
            mergedValue: { qidahenMaShiTradeSelection: maShiTradeSelection },
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeMaShiTradeInteractionId, dispatch, maShiTradeSelection]);

    const resolveDriveTigerConsent = React.useCallback((choiceId: 'accept' | 'decline') => {
        if (!activeDriveTigerConsentInteractionId || !driveTigerConsentSelection) {
            return;
        }
        dispatch(INTERACTION_COMMANDS.RESPOND as keyof QidahenCommandMap, {
            interactionId: activeDriveTigerConsentInteractionId,
            optionId: choiceId,
            mergedValue: { qidahenDriveTigerConsentSelection: driveTigerConsentSelection },
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
            mergedValue: {
                qidahenWheelDispatchSelection: wheelDispatchSelection,
                ...(pendingCommittedTroops != null ? { committedTroops: pendingCommittedTroops } : {}),
            },
        } as QidahenCommandMap[keyof QidahenCommandMap]);
    }, [activeWheelDispatchInteractionId, dispatch, pendingCommittedTroops, wheelDispatchSelection]);

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
        || grantPardonSelection != null
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
        && grantPardonSelection == null
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
        && khanEdictSelection == null
        && recruitSelection == null
        && grantPardonSelection == null
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
    const selectedPrimaryAction = getQidahenForegroundActionChoice(core, {
        actionPaymentPreviewVisible,
        recruitSelection,
        maShiTradeSelection,
        khanEdictSelection,
        driveTigerConsentSelection,
    });
    const primaryActionEntryText = buildQidahenPrimaryActionEntryText(core, selectedPrimaryAction);
    const defeatInDetailOrderSelectionActive = isQidahenDefeatInDetailOrderSelectionActive(
        pendingTargetAction,
    );
    const actionPaymentMapRegionSelectionActive = actionPaymentPreviewVisible
        && core.confirmedActionId === 'raid';
    const gaoDiMapRegionSelectionActive = isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection);
    const directMapRegionSelectionActive = actionPaymentMapRegionSelectionActive || gaoDiMapRegionSelectionActive;
    const mapRegionSelectionDecisionActive = gaoDiMapRegionSelectionActive
        || actionPaymentMapRegionSelectionActive
        || defeatInDetailOrderSelectionActive
        || internalDispatchSelection != null
        || recruitSelection != null
        || grantPardonSelection != null
        || maShiTradeSelection != null
        || khanEdictSelection != null
        || diplomacySelection != null
        || wheelDispatchSelection != null;

    const selectRegion = React.useCallback((regionId: string) => {
        if (
            setupStagePending
            || (pendingTargetAction != null && !defeatInDetailOrderSelectionActive)
            || postBattleSelection != null
            || driveTigerConsentSelection != null
            || fortificationMaintenanceSelection != null
            || handLimitDiscardSelection != null
            || core.sunYuanhuaTechSelection != null
        ) {
            return;
        }
        if (!mapRegionSelectionDecisionActive) {
            return;
        }
        if (isQidahenGaoDiTargetSelectionActive(core.gaoDiDispatchSelection)) {
            const runtimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionId);
            const candidate = core.gaoDiDispatchSelection?.candidates.find((item) => (
                item.targetRegionId === regionId || item.targetRegionId === runtimeRegionId
            ));
            if (candidate) {
                setDraftGaoDiChoiceId(candidate.id);
            }
            return;
        }
        if (internalDispatchSelection) {
            const runtimeRegionId = resolveQidahenPrimaryRuntimeRegionId(regionId);
            const candidate = internalDispatchSelection.candidates.find((item) => (
                item.targetRegionId === regionId || item.targetRegionId === runtimeRegionId
            ));
            if (candidate) {
                setDraftInternalDispatchChoiceId(candidate.id);
            }
            return;
        }
        if (grantPardonSelection != null) {
            const choice = grantPardonMapChoices.find((item) => item.targetRegionId === regionId);
            if (choice && isTutorialTargetAllowed(choice.id)) {
                resolveGrantPardonChoice(choice.id);
            }
            return;
        }
        if (!isTutorialCommandAllowed(QIDAHEN_COMMANDS.SELECT_REGION) || !isTutorialTargetAllowed(regionId)) {
            return;
        }
        dispatch(QIDAHEN_COMMANDS.SELECT_REGION, { regionId });
    }, [setupStagePending, pendingTargetAction, defeatInDetailOrderSelectionActive, postBattleSelection, driveTigerConsentSelection, fortificationMaintenanceSelection, handLimitDiscardSelection, core.sunYuanhuaTechSelection, core.gaoDiDispatchSelection, internalDispatchSelection, mapRegionSelectionDecisionActive, grantPardonSelection, grantPardonMapChoices, isTutorialTargetAllowed, isTutorialCommandAllowed, dispatch, resolveGrantPardonChoice, setDraftGaoDiChoiceId, setDraftInternalDispatchChoiceId]);

    const activateTopLevelGuideTarget = React.useCallback((candidate: {
        action: 'wheel-dispatch' | 'gao-di' | 'internal-dispatch' | 'grant-pardon' | 'select-region';
        resolutionChoiceId: string;
        targetRegionId: string;
    }) => {
        if (candidate.action === 'wheel-dispatch') {
            resolveWheelDispatchChoice(candidate.resolutionChoiceId);
            return;
        }
        if (candidate.action === 'gao-di') {
            setDraftGaoDiChoiceId(candidate.resolutionChoiceId);
            return;
        }
        if (candidate.action === 'internal-dispatch') {
            setDraftInternalDispatchChoiceId(candidate.resolutionChoiceId);
            return;
        }
        if (candidate.action === 'grant-pardon') {
            resolveGrantPardonChoice(candidate.resolutionChoiceId);
            return;
        }
        selectRegion(candidate.targetRegionId);
    }, [resolveWheelDispatchChoice, resolveGrantPardonChoice, selectRegion, setDraftGaoDiChoiceId, setDraftInternalDispatchChoiceId]);

    const buildRegularTroopPlacementCandidates = React.useCallback((factionId: QidahenFactionId) => (
        displayCore.regions
            .filter((region) => !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, factionId))
            .map((region) => ({
                id: region.id,
                action: 'select-region' as const,
                resolutionChoiceId: region.id,
                targetRegionId: region.id,
                targetRegionName: region.name,
            }))
    ), [displayCore.regions]);

    const getTopLevelGuideRegionMapPoint = React.useCallback((regionId: string | null | undefined) => {
        if (!regionId) {
            return null;
        }
        const region = displayCore.regions.find((item) => item.id === regionId);
        if (region && typeof region.x === 'number' && typeof region.y === 'number') {
            return {
                x: region.x * QIDAHEN_MAP_WIDTH,
                y: region.y * QIDAHEN_MAP_HEIGHT,
            };
        }
        const graphNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(regionId);
        return graphNode?.center ?? graphNode?.seed ?? null;
    }, [displayCore.regions]);

    const getTopLevelGuideRegionPoint = React.useCallback((regionId: string | null | undefined) => {
        const point = getTopLevelGuideRegionMapPoint(regionId);
        return point
            ? projectQidahenMapPointToStage(point, mapViewport)
            : null;
    }, [getTopLevelGuideRegionMapPoint, mapViewport]);

    const topLevelMapSelectionGuide = (() => {
        if (defeatInDetailOrderSelectionActive) {
            return {
                title: '决定战斗顺序',
                candidates: getQidahenDefeatInDetailSelectableSourceRegionIds(pendingTargetAction)
                    .map((regionId) => {
                        const region = displayCore.regions.find((candidate) => candidate.id === regionId);
                        return {
                            id: regionId,
                            action: 'select-region' as const,
                            resolutionChoiceId: regionId,
                            targetRegionId: regionId,
                            targetRegionName: region?.name ?? regionId,
                        };
                    }),
            };
        }
        if (pendingTargetAction != null) {
            return null;
        }
        if (wheelDispatchSelection && (pendingCommittedTroops == null || pendingCommittedTroops <= 0)) {
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
        if (grantPardonSelection) {
            return {
                title: '赐印招安',
                candidates: grantPardonMapChoices.map((choice) => ({
                    id: choice.id,
                    action: 'grant-pardon' as const,
                    resolutionChoiceId: choice.id,
                    targetRegionId: choice.targetRegionId,
                    targetRegionName: choice.targetRegionName,
                })),
            };
        }
        if (recruitSelection) {
            const recruitFactionId = getCurrentFactionId(core);
            return {
                title: '征召地区',
                candidates: buildRegularTroopPlacementCandidates(recruitFactionId),
            };
        }
        if (maShiTradeSelection) {
            return {
                title: '马市建军地区',
                candidates: buildRegularTroopPlacementCandidates('ming'),
            };
        }
        if (khanEdictSelection) {
            const khanFactionId = getCurrentFactionId(core);
            return {
                title: '大汗令箭地区',
                candidates: buildRegularTroopPlacementCandidates(khanFactionId),
            };
        }
        if (diplomacySelection) {
            return {
                title: '外交目标',
                candidates: diplomacySelection.candidateTargetRegionIds.map((regionId) => {
                    const region = displayCore.regions.find((item) => item.id === regionId && !item.isLogicalRegion);
                    return {
                        id: regionId,
                        action: 'select-region' as const,
                        resolutionChoiceId: regionId,
                        targetRegionId: regionId,
                        targetRegionName: region?.name ?? regionId,
                    };
                }),
            };
        }
        return null;
    })();

    const autoFocusMapTargetRegionIdsKey = topLevelMapSelectionGuide?.candidates
        .map((candidate) => candidate.targetRegionId)
        .join('|') ?? '';
    const tutorialMapFocusRegionId = getQidahenTutorialMapFocusRegionId(tutorialStep?.highlightTarget);
    const tutorialAllowedMapTargetRegionId = tutorialStep?.allowedTargets?.find((targetId) => (
        topLevelMapSelectionGuide?.candidates.some((candidate) => candidate.targetRegionId === targetId)
    )) ?? null;
    const tutorialMapFocusCandidateRegionId = tutorialMapFocusRegionId
        && topLevelMapSelectionGuide?.candidates.some((candidate) => candidate.targetRegionId === tutorialMapFocusRegionId)
        ? tutorialMapFocusRegionId
        : tutorialAllowedMapTargetRegionId;
    const autoFocusMapTargetKey = topLevelMapSelectionGuide && autoFocusMapTargetRegionIdsKey
        ? `${topLevelMapSelectionGuide.title}:${autoFocusMapTargetRegionIdsKey}:${tutorialMapFocusCandidateRegionId ?? ''}:${wheelDispatchSelection?.sourceRegionId ?? core.gaoDiDispatchSelection?.sourceRegionId ?? internalDispatchSelection?.sourceRegionId ?? grantPardonSelection?.sourceRegionId ?? ''}`
        : null;
    const mapTargetSelectionActive = topLevelMapSelectionGuide != null && topLevelMapSelectionGuide.candidates.length > 0;

    React.useEffect(() => {
        const autoFocusMapTargetRegionIds = autoFocusMapTargetRegionIdsKey
            ? autoFocusMapTargetRegionIdsKey.split('|')
            : [];
        if (!autoFocusMapTargetKey || autoFocusMapTargetRegionIds.length <= 0) {
            if (activeAutoFocusKeyRef.current && mapViewportBeforeAutoFocusRef.current) {
                setMapViewport(mapViewportBeforeAutoFocusRef.current);
            }
            activeAutoFocusKeyRef.current = null;
            mapViewportBeforeAutoFocusRef.current = null;
            return;
        }
        const activeTargetRegionId = tutorialMapFocusCandidateRegionId
            ?? autoFocusMapTargetRegionIds[0]
            ?? null;
        const activeTargetPoint = getTopLevelGuideRegionMapPoint(activeTargetRegionId);
        const focusRegionIds = [
            wheelDispatchSelection?.sourceRegionId,
            core.gaoDiDispatchSelection?.sourceRegionId,
            internalDispatchSelection?.sourceRegionId,
            grantPardonSelection?.sourceRegionId,
            ...autoFocusMapTargetRegionIds,
        ];
        const points = focusRegionIds
            .map((regionId) => getTopLevelGuideRegionMapPoint(regionId))
            .filter((point): point is { x: number; y: number } => point != null);
        const viewport = activeTargetPoint
            ? buildQidahenFocusedMapViewport(activeTargetPoint, 1.82)
            : buildQidahenFocusedMapViewportForPoints(points);
        if (!viewport) {
            return;
        }
        setMapViewport((currentViewport) => {
            if (!activeAutoFocusKeyRef.current) {
                mapViewportBeforeAutoFocusRef.current = currentViewport;
            }
            activeAutoFocusKeyRef.current = autoFocusMapTargetKey;
            return currentViewport.zoom === viewport.zoom
                && currentViewport.panX === viewport.panX
                && currentViewport.panY === viewport.panY
                    ? currentViewport
                    : viewport;
        });
    }, [
        autoFocusMapTargetKey,
        autoFocusMapTargetRegionIdsKey,
        core.gaoDiDispatchSelection?.sourceRegionId,
        grantPardonSelection?.sourceRegionId,
        getTopLevelGuideRegionMapPoint,
        internalDispatchSelection?.sourceRegionId,
        tutorialMapFocusCandidateRegionId,
        wheelDispatchSelection?.sourceRegionId,
    ]);

    const boardScene = (
        <>
            <MapSceneLayer
                core={displayCore}
                perspectiveFactionId={viewerFactionId}
                mapHitTestingDisabled={!directMapRegionSelectionActive && (
                    actionPaymentPreviewVisible
                    || handLimitDiscardSelection != null
                    || core.sunYuanhuaTechSelection != null
                    || core.gaoDiDispatchSelection != null
                )}
                wheelDispatchSelection={wheelDispatchSelection}
                grantPardonSelection={grantPardonSelection}
                grantPardonMapChoices={grantPardonMapChoices}
                internalDispatchSelection={internalDispatchSelection}
                pendingTargetAction={pendingTargetAction}
                pendingCommittedTroops={pendingCommittedTroops}
                onSelectPendingCommittedTroops={setPendingCommittedTroops}
                onTogglePincerAdvanceTroop={togglePincerAdvanceTroop}
                onResolveInstigateDefection={resolveInstigateDefection}
                onResolveWuzhenChaoha={resolveWuzhenChaoha}
                tutorialStepId={tutorialStep?.id ?? null}
                tutorialGuideTargetRegionId={tutorialMapFocusCandidateRegionId}
                compactRegionTip={compactMapRegionTip}
                viewport={mapViewport}
                onViewportChange={setMapViewport}
                locale={locale}
                onSelectRegion={selectRegion}
            />
            {topLevelMapSelectionGuide && tutorialStep?.id === 'choose-grant-pardon-target' ? (
                <div className="pointer-events-none absolute inset-0 z-40" aria-hidden="true">
                    {topLevelMapSelectionGuide.candidates.map((candidate) => {
                        const targetPoint = getTopLevelGuideRegionPoint(candidate.targetRegionId);
                        if (!targetPoint) {
                            return null;
                        }
                        return (
                            <div
                                key={`top-level-guide-anchor-${candidate.id}`}
                                data-testid={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}
                                data-tutorial-id={`qidahen-map-guide-hit-target-${candidate.targetRegionId}`}
                                data-choice-id={candidate.resolutionChoiceId}
                                data-action={candidate.action}
                                data-grant-pardon-map-choice={candidate.action === 'grant-pardon' ? candidate.resolutionChoiceId : undefined}
                                style={{
                                    position: 'absolute',
                                    left: targetPoint.x - 1,
                                    top: targetPoint.y - 1,
                                    width: 2,
                                    height: 2,
                                    opacity: 0,
                                }}
                            />
                        );
                    })}
                </div>
            ) : null}
            {topLevelMapSelectionGuide && tutorialStep?.id !== 'choose-grant-pardon-target' ? (
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
                                data-choice-id={candidate.resolutionChoiceId}
                                data-action={candidate.action}
                                data-grant-pardon-map-choice={candidate.action === 'grant-pardon' ? candidate.resolutionChoiceId : undefined}
                                aria-label={`${topLevelMapSelectionGuide.title}：${candidate.targetRegionName}`}
                                aria-pressed={candidate.action === 'gao-di'
                                    ? draftGaoDiChoiceId === candidate.resolutionChoiceId
                                    : candidate.action === 'internal-dispatch'
                                        ? draftInternalDispatchChoiceId === candidate.resolutionChoiceId
                                        : resolveQidahenPrimaryRuntimeRegionId(displayCore.explicitRegionId) === resolveQidahenPrimaryRuntimeRegionId(candidate.targetRegionId)}
                                className="qidahen-map-guide-hit-target pointer-events-auto absolute cursor-pointer border-0 bg-transparent p-0"
                                style={{
                                    left: targetPoint.x - 34,
                                    top: targetPoint.y - 34,
                                    width: 68,
                                    height: 68,
                                    background: 'transparent',
                                    boxShadow: 'none',
                                }}
                                onClick={() => activateTopLevelGuideTarget(candidate)}
                            />
                        );
                    })}
                </div>
            ) : null}
        </>
    );

    if (scenarioVotePending) {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
                <QidahenBoardShell
                    layout={QIDAHEN_BOARD_LAYOUT}
                    backgroundColor={QIDAHEN_STAGE_BG}
                    scene={<StaticMapScene locale={locale} />}
                    hud={(
                        <QidahenScenarioVoteScreen
                            core={core}
                            playerID={playerID}
                            playerNamesById={playerNamesById}
                            onCastScenarioVote={castScenarioVote}
                        />
                    )}
                />
            </UndoProvider>
        );
    }

    if (factionSelectionPending) {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
                <QidahenBoardShell
                    layout={QIDAHEN_BOARD_LAYOUT}
                    backgroundColor={QIDAHEN_STAGE_BG}
                    scene={<StaticMapScene locale={locale} />}
                    hud={(
                        <QidahenFactionSelectionScreen
                            core={core}
                            playerID={playerID}
                            playerNamesById={playerNamesById}
                            locale={locale}
                            onSelectFaction={selectFaction}
                        />
                    )}
                />
            </UndoProvider>
        );
    }

    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver, isLocalMode: !isMultiplayer }}>
            <QidahenBoardShell
                layout={QIDAHEN_BOARD_LAYOUT}
                backgroundColor={QIDAHEN_STAGE_BG}
                scene={boardScene}
                hud={(
                    <>
            {!scenarioVotePending && scenarioChoicesPending ? (
                <QidahenInMatchSetupOverlay
                    core={core}
                    viewerFactionId={viewerFactionId}
                    playerID={playerID}
                    onResolveScenarioCharacterChoice={resolveScenarioCharacterChoice}
                    onResolveScenarioArmamentChoice={resolveScenarioArmamentChoice}
                    onMagnifyCard={setMagnifyTarget}
                />
            ) : null}
            {showTopWheelPrompt ? (
                <TopPromptBanner
                    testId="qidahen-wheel-next-step-banner"
                    title={t('board.actions.wheelNextStepTitle', { defaultValue: '轮盘落点行动' })}
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
                directExecuteOnClick
                canActivateMove={(moveId) => (
                    isTutorialCommandAllowed(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE) && isTutorialTargetAllowed(moveId)
                )}
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
                grantPardonSelection={grantPardonSelection}
                grantPardonMapChoices={grantPardonMapChoices}
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
                onResolveGrantPardonChoice={resolveGrantPardonChoice}
                selectedGaoDiChoiceId={draftGaoDiChoiceId}
                onResolveGaoDiDispatch={resolveGaoDiDispatch}
                selectedInternalDispatchChoiceId={draftInternalDispatchChoiceId}
                onResolveInternalDispatch={resolveInternalDispatch}
                onClearInternalDispatchChoice={() => setDraftInternalDispatchChoiceId(null)}
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
                onResolvePincerAdvance={resolvePincerAdvance}
                onCancelPincerAdvance={cancelPincerAdvance}
                onResolveInfantryCavalryCombined={resolveInfantryCavalryCombined}
                onCancelInstigateDefection={cancelInstigateDefection}
                onSetWuzhenChaohaArtilleryTechCount={setWuzhenChaohaArtilleryTechCount}
                onCancelWuzhenChaoha={cancelWuzhenChaoha}
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
                pendingTargetAction={pendingTargetAction}
                viewerFactionId={viewerFactionId}
                playerID={playerID}
                locale={locale}
                mapTargetSelectionActive={mapTargetSelectionActive}
                actionPaymentPreviewVisible={actionPaymentPreviewVisible}
                selectedPaymentCardIds={core.selectedPaymentCardIds}
                handLimitDiscardSelection={handLimitDiscardSelection}
                selectedHandLimitCardIds={selectedHandLimitCardIds}
                onTogglePaymentCard={togglePaymentCard}
                onToggleHandLimitDiscardCard={toggleHandLimitDiscardCard}
                onSelectSunYuanhuaTechCard={selectSunYuanhuaTechCard}
                onSelectGaoDiDispatchCard={selectGaoDiDispatchCard}
                onPlayTacticCard={playTacticCard}
                onPlayBattleResponseEventCard={playBattleResponseEventCard}
                onPreviewActionFromHandCard={previewActionFromHandCard}
                onMagnifyCard={setMagnifyTarget}
            />
            <EndgameOverlay {...endgameProps} />
            <QidahenCardMagnifyOverlay target={magnifyTarget} locale={locale} onClose={() => setMagnifyTarget(null)} />
                    </>
                )}
            />
        </UndoProvider>
    );
};

export default QidahenBoard;
