/**
 * 大杀四方 (Smash Up) - "Paper Chaos" Aesthetic
 * 
 * Style Guide:
 * - Theme: "Basement Board Game Night" / American Comic Spoof
 * - Background: Warm wooden table surface, cluttered but cozy.
 * - Cards: Physical objects with white printed borders, slight imperfections (rotations).
 * - UI: "Sticky notes", "Scrap paper", "Tokens" - nothing digital.
 * - Font: Thick, bold, informal.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { createPortal } from 'react-dom';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { MatchState } from '../../engine/types';
import type { SmashUpCore, CardInstance, ActionCardDef, FusionCardDef, CardOrTitanChoiceValue } from './domain/types';
import { SU_COMMANDS, HAND_LIMIT, getCurrentPlayerId } from './domain/types';
import { FLOW_COMMANDS } from '../../engine/systems/FlowSystem';
import { asSimpleChoice, INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { getCardDef, getBaseDef, getFusionDef, getMinionDef, resolveCardName, resolveCardText } from './data/cards';
import { getPlayerEffectivePowerOnBase, getScoringEligibleBaseIndices } from './domain/ongoingModifiers';
import { isOperationRestricted } from './domain/ongoingEffects';
import { isSpecialLimitBlocked } from './domain/abilityHelpers';
import { useGameAudio, playDeniedSound, playSound } from '../../lib/audio/useGameAudio';
import { CardPreview } from '../../components/common/media/CardPreview';
import { AnimatePresence, motion } from 'framer-motion';
import { initSmashUpAtlases } from './ui/cardAtlas';

// 同步注册所有图集（cards1-4 + base1-4，懒解析模式），确保首次渲染时 atlas 注册已就绪
initSmashUpAtlases();
import { SMASH_UP_MANIFEST } from './manifest';
import { getLayoutConfig } from './ui/layoutConfig';
import './cursor';
import { HandArea, type HandAreaDragPreview, type HandAreaDropTarget } from './ui/HandArea';

const END_TURN_THROTTLE_MS = 800;
import { useGameEvents } from './ui/useGameEvents';
import { useFxBus, FxLayer } from '../../engine/fx';
import { smashUpFxRegistry } from './ui/fxSetup';
import { FactionSelection } from './ui/FactionSelection';
import { PromptOverlay, resolveI18nKeys } from './ui/PromptOverlay';
import { getFactionMeta } from './ui/factionMeta';
import { PLAYER_CONFIG } from './ui/playerConfig';
import { BaseZone } from './ui/BaseZone';
import { MeFirstOverlay, type MeFirstPendingCard } from './ui/MeFirstOverlay';
import { CardMagnifyOverlay, type CardMagnifyTarget } from './ui/CardMagnifyOverlay';
import { GameButton as SmashUpGameButton } from './ui/GameButton';
import { DeckDiscardZone } from './ui/DeckDiscardZone';
import { getDiscardPlayOptions } from './domain/discardPlayability';
import {
    actionLikeNeedsPlayBase,
    actionLikeNeedsPlayMinion,
    actionLikeNeedsResponseWindowBase,
    getMaxRemainingGlobalPowerLimitedQuota,
    isActionLikeRespondableInWindow,
    mustUseBaseLimitedMinionQuota,
    mustUseGlobalPowerLimitedMinionQuota,
    isCardActionLike,
    isCardMinionLike,
} from './domain/utils';
import { validate } from './domain/commands';
import { SMASHUP_AUDIO_CONFIG } from './audio.config';
import { useTutorialBridge, useTutorial } from '../../contexts/TutorialContext';
import { UndoProvider } from '../../contexts/UndoContext';
import { MobileBattlefieldViewport, TutorialSelectionGate } from '../../components/game/framework';
import { LoadingScreen } from '../../components/system/LoadingScreen';
import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';
import { SmashUpDebugConfig } from './debug-config';
import { UI_Z_INDEX } from '../../core';
import { EndgameOverlay } from '../../components/game/framework/widgets/EndgameOverlay';
import { useEndgame } from '../../hooks/game/useEndgame';
import { SmashUpEndgameContent, SmashUpEndgameActions } from './ui/SmashUpEndgame';
import type { PlayConstraint } from './domain/types';
import { useCardSpotlightQueue, CardSpotlightQueue } from '../../components/game/framework';
import type { SpotlightItem } from '../../components/game/framework';
import { getEventStreamEntries } from '../../engine/systems/EventStreamSystem';
import { RevealOverlay } from './ui/RevealOverlay';
import { useSmashUpOverlay } from './ui/SmashUpOverlayContext';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import { resolveRuntimeLayoutScaleMetrics } from '../mobileSupport';

type Props = GameBoardProps<SmashUpCore>;
type BuriedPromptOptionValue = {
    cardUid?: string;
    defId?: string;
    baseIndex?: number;
    baseDefId?: string;
    skip?: boolean;
    done?: boolean;
};

const EMPTY_PLAYERS = {} as SmashUpCore['players'];
const EMPTY_BASES = [] as SmashUpCore['bases'];
const EMPTY_TURN_ORDER = [] as SmashUpCore['turnOrder'];
const EMPTY_TITANS = [] as NonNullable<SmashUpCore['titans']>;
const EMPTY_EVENT_ENTRIES: MatchState<SmashUpCore>['sys']['eventStream']['entries'] = [];
const SMASHUP_MOBILE_BOARD_SHELL_DESIGN_WIDTH = 1160;
const SMASHUP_FACTION_SELECTION_SHELL_DESIGN_WIDTH = 1500;
const TURN_NOTICE_DURATION_MS = 1200;

type DragGuidePoint = { x: number; y: number };

function cubicBezierPoint(t: number, p0: DragGuidePoint, p1: DragGuidePoint, p2: DragGuidePoint, p3: DragGuidePoint): DragGuidePoint {
    const oneMinusT = 1 - t;
    return {
        x: (oneMinusT ** 3) * p0.x + 3 * (oneMinusT ** 2) * t * p1.x + 3 * oneMinusT * (t ** 2) * p2.x + (t ** 3) * p3.x,
        y: (oneMinusT ** 3) * p0.y + 3 * (oneMinusT ** 2) * t * p1.y + 3 * oneMinusT * (t ** 2) * p2.y + (t ** 3) * p3.y,
    };
}

function cubicBezierTangent(t: number, p0: DragGuidePoint, p1: DragGuidePoint, p2: DragGuidePoint, p3: DragGuidePoint): DragGuidePoint {
    const oneMinusT = 1 - t;
    return {
        x: 3 * (oneMinusT ** 2) * (p1.x - p0.x) + 6 * oneMinusT * t * (p2.x - p1.x) + 3 * (t ** 2) * (p3.x - p2.x),
        y: 3 * (oneMinusT ** 2) * (p1.y - p0.y) + 6 * oneMinusT * t * (p2.y - p1.y) + 3 * (t ** 2) * (p3.y - p2.y),
    };
}

function splitCubicBezier(
    t: number,
    p0: DragGuidePoint,
    p1: DragGuidePoint,
    p2: DragGuidePoint,
    p3: DragGuidePoint,
): { left: [DragGuidePoint, DragGuidePoint, DragGuidePoint, DragGuidePoint]; right: [DragGuidePoint, DragGuidePoint, DragGuidePoint, DragGuidePoint] } {
    const p01 = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
    const p12 = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
    const p23 = { x: p2.x + (p3.x - p2.x) * t, y: p2.y + (p3.y - p2.y) * t };
    const p012 = { x: p01.x + (p12.x - p01.x) * t, y: p01.y + (p12.y - p01.y) * t };
    const p123 = { x: p12.x + (p23.x - p12.x) * t, y: p12.y + (p23.y - p12.y) * t };
    const p0123 = { x: p012.x + (p123.x - p012.x) * t, y: p012.y + (p123.y - p012.y) * t };
    return {
        left: [p0, p01, p012, p0123],
        right: [p0123, p123, p23, p3],
    };
}

function buildArrowHeadPath(
    center: DragGuidePoint,
    tangent: DragGuidePoint,
    length: number,
    width: number,
): string {
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    const unitX = tangent.x / tangentLength;
    const unitY = tangent.y / tangentLength;
    const normalX = -unitY;
    const normalY = unitX;
    const tip = { x: center.x + unitX * (length * 0.78), y: center.y + unitY * (length * 0.78) };
    const leftShoulder = {
        x: center.x + normalX * width + unitX * (length * 0.08),
        y: center.y + normalY * width + unitY * (length * 0.08),
    };
    const rightShoulder = {
        x: center.x - normalX * width + unitX * (length * 0.08),
        y: center.y - normalY * width + unitY * (length * 0.08),
    };
    const leftTail = {
        x: center.x + normalX * (width * 0.36) - unitX * (length * 0.46),
        y: center.y + normalY * (width * 0.36) - unitY * (length * 0.46),
    };
    const rightTail = {
        x: center.x - normalX * (width * 0.36) - unitX * (length * 0.46),
        y: center.y - normalY * (width * 0.36) - unitY * (length * 0.46),
    };
    const tail = {
        x: center.x - unitX * (length * 0.5),
        y: center.y - unitY * (length * 0.5),
    };
    return [
        `M ${leftTail.x} ${leftTail.y}`,
        `Q ${leftShoulder.x} ${leftShoulder.y} ${tip.x} ${tip.y}`,
        `Q ${rightShoulder.x} ${rightShoulder.y} ${rightTail.x} ${rightTail.y}`,
        `Q ${tail.x} ${tail.y} ${leftTail.x} ${leftTail.y}`,
        'Z',
    ].join(' ');
}

function buildDragArrowGuide(
    start: DragGuidePoint,
    control1: DragGuidePoint,
    control2: DragGuidePoint,
    end: DragGuidePoint,
): { linePath: string; headPath: string; hintPoint: DragGuidePoint; hintTangent: DragGuidePoint } {
    const { left } = splitCubicBezier(0.915, start, control1, control2, end);
    const [, lineControl1, lineControl2, lineEnd] = left;
    const headCenter = cubicBezierPoint(0.952, start, control1, control2, end);
    const headTangent = cubicBezierTangent(0.986, start, control1, control2, end);
    const hintPoint = cubicBezierPoint(0.56, start, control1, control2, end);
    const hintTangent = cubicBezierTangent(0.56, start, control1, control2, end);

    return {
        linePath: `M ${start.x} ${start.y} C ${lineControl1.x} ${lineControl1.y} ${lineControl2.x} ${lineControl2.y} ${lineEnd.x} ${lineEnd.y}`,
        headPath: buildArrowHeadPath(headCenter, headTangent, 18, 6.8),
        hintPoint,
        hintTangent,
    };
}

/** UI 层打出约束检查（与 commands.ts 的 checkPlayConstraint 对齐） */
function checkPlayConstraintUI(
    constraint: PlayConstraint,
    core: SmashUpCore,
    baseIndex: number,
    playerId: string,
): boolean {
    if (constraint === 'requireOwnMinion') {
        return core.bases[baseIndex].minions.some(m => m.owner === playerId);
    }
    if (typeof constraint === 'object' && constraint.type === 'requireOwnPower') {
        const base = core.bases[baseIndex];
        const myPower = getPlayerEffectivePowerOnBase(core, base, baseIndex, playerId);
        return myPower >= constraint.minPower;
    }
    return true;
}

const getPhaseNameKey = (phase: string) => `phases.${phase}`;

const SmashUpBoard: FC<Props> = ({ G, dispatch, playerID: rawPlayerID, reset, matchData, isMultiplayer }) => {
    const { t } = useTranslation('game-smashup');
    const { setSelectedFactions, interactionMode } = useSmashUpOverlay();

    const core = G?.core;
    const phase = G?.sys?.phase;
    const corePlayers = core?.players ?? EMPTY_PLAYERS;
    const coreBases = core?.bases ?? EMPTY_BASES;
    const coreTurnOrder = core?.turnOrder ?? EMPTY_TURN_ORDER;
    const coreTitans = core?.titans ?? EMPTY_TITANS;
    const currentPid = core ? getCurrentPlayerId(core) : '0';
    const playerID = rawPlayerID;
    const isMyTurn = playerID === currentPid;
    const rootPid = playerID || '0';
    // 观战模式下默认显示玩家 0 的视角
    const myPlayer = corePlayers[rootPid];
    const isGameOver = G?.sys?.gameover;
    const activeDuelParticipantUids = useMemo(() => {
        const duel = core?.activeDuel;
        if (!duel) return new Set<string>();
        return new Set([duel.challengerMinionUid, duel.challengedMinionUid]);
    }, [core?.activeDuel]);
    const activeDuelBanner = useMemo(() => {
        const duel = core?.activeDuel;
        if (!duel) return null;
        const challenger = core.bases.flatMap(base => base.minions).find(minion => minion.uid === duel.challengerMinionUid);
        const challenged = core.bases.flatMap(base => base.minions).find(minion => minion.uid === duel.challengedMinionUid);
        const challengerName = challenger ? resolveCardName(getCardDef(challenger.defId), t) ?? challenger.defId : t('ui.card_placeholder');
        const challengedName = challenged ? resolveCardName(getCardDef(challenged.defId), t) ?? challenged.defId : t('ui.card_placeholder');
        return {
            title: `${challengerName} VS ${challengedName}`,
            subtitle: t('ui.duel_in_progress', { defaultValue: '决斗进行中：依次处理平克顿加指示物、从手牌打出决斗牌、弃副警长加力量，最后再结算胜负' }),
        };
    }, [core, t]);
    const isWinner = !!isGameOver && isGameOver.winner === rootPid;
    const isMobileViewport = useMobileViewport();
    const runtimeViewport = useRuntimeViewport({ syncCssVars: false });
    
    // 响应式布局配置
    const playerCount = coreTurnOrder.length || 2;
    const layout = getLayoutConfig(playerCount, { isMobileViewport });
    const topHudScale = layout.topHudScale;
    const endTurnHudScale = layout.endTurnHudScale;
    const mobileEndTurnHintReserve = Math.round(92 * endTurnHudScale);
    const turnTrackerStyle = isMobileViewport && topHudScale !== 1
        ? { transform: `scale(${topHudScale})`, transformOrigin: 'top left' as const }
        : undefined;
    const scoreboardStyle = isMobileViewport && topHudScale !== 1
        ? { transform: `scale(${topHudScale})`, transformOrigin: 'top right' as const }
        : undefined;
    const endTurnButtonStyle = isMobileViewport
        ? {
            right: `${Math.max(layout.boardHorizontalPadding, 48) + mobileEndTurnHintReserve}px`,
            bottom: `${layout.floatingActionBottom}px`,
            ...(endTurnHudScale !== 1 ? {
                transform: `scale(${endTurnHudScale})`,
                transformOrigin: 'bottom right' as const,
            } : {}),
        }
        : undefined;
    const endTurnQuotaBadgeClassName = isMobileViewport
        ? 'flex items-center gap-1 px-1.5 py-0.5 rounded border-2 shadow-md text-[10px] font-black whitespace-nowrap cursor-default'
        : 'flex items-center gap-1.5 px-2 py-1 rounded border-2 shadow-md text-xs font-black whitespace-nowrap cursor-default';
    const endTurnQuotaIconClassName = isMobileViewport ? 'w-3 h-3 fill-current shrink-0' : 'w-3.5 h-3.5 fill-current shrink-0';
    const endTurnQuotaExtraIconClassName = isMobileViewport
        ? 'w-3 h-3 fill-amber-300 shrink-0 drop-shadow-[0_0_2px_rgba(252,211,77,0.6)]'
        : 'w-3.5 h-3.5 fill-amber-300 shrink-0 drop-shadow-[0_0_2px_rgba(252,211,77,0.6)]';
    const floatingHintClassName = isMobileViewport
        ? 'absolute inset-x-0 flex justify-center pointer-events-none'
        : 'fixed inset-x-0 flex justify-center pointer-events-none';
    const floatingHintStyle = { zIndex: UI_Z_INDEX.hint, bottom: `${layout.floatingActionBottom}px` };
    const topFloatingBannerClassName = isMobileViewport
        ? 'absolute inset-x-0 z-30 flex justify-center pointer-events-none'
        : 'fixed inset-x-0 z-30 flex justify-center pointer-events-none';
    const duelBannerTopOffset = isMobileViewport ? 10 : 14;
    const stackedTopBannerGap = isMobileViewport ? 40 : 48;
    const turnNoticeClassName = isMobileViewport
        ? 'absolute inset-x-0 top-[5rem] z-30 flex justify-center pointer-events-none'
        : 'fixed inset-x-0 top-[6rem] z-30 flex justify-center pointer-events-none';
    const resolvePromptOptionLabel = useCallback((opt: { label: string; labelKey?: string; labelParams?: Record<string, string | number> }) => {
        if (typeof opt.labelKey === 'string') {
            return t(opt.labelKey, {
                ...(opt.labelParams ?? {}),
                defaultValue: resolveI18nKeys(opt.label, t),
            });
        }
        return resolveI18nKeys(opt.label, t);
    }, [t]);
    
    // 更新选择的派系到 Context（游戏开始后）
    useEffect(() => {
        if (phase !== 'factionSelect') {
            const allFactions: string[] = [];
            for (const player of Object.values(corePlayers)) {
                if (player.factions) {
                    allFactions.push(...player.factions);
                }
            }
            setSelectedFactions(allFactions);
        }
    }, [phase, corePlayers, setSelectedFactions]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const isLandscapeMobileShellViewport = isMobileViewport
            && runtimeViewport.width > runtimeViewport.height
            && runtimeViewport.width > 0
            && runtimeViewport.height > 0;
        if (!isLandscapeMobileShellViewport) {
            return;
        }

        const designWidth = phase === 'factionSelect' && core?.factionSelection
            ? SMASHUP_FACTION_SELECTION_SHELL_DESIGN_WIDTH
            : SMASHUP_MOBILE_BOARD_SHELL_DESIGN_WIDTH;
        const metrics = resolveRuntimeLayoutScaleMetrics(
            { width: runtimeViewport.width, height: runtimeViewport.height },
            designWidth,
        );
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--mobile-board-shell-design-width', `${metrics.designWidth}px`);
        rootStyle.setProperty('--mobile-board-shell-scale', metrics.scale.toFixed(6));
        rootStyle.setProperty('--mobile-board-shell-inverse-scale', metrics.inverseScale.toFixed(6));
        rootStyle.setProperty('--mobile-board-shell-logical-height', `${metrics.logicalHeight.toFixed(3)}px`);
        rootStyle.setProperty('--mobile-board-shell-inline-unit', `${metrics.inlineUnit.toFixed(4)}px`);
        rootStyle.setProperty('--mobile-board-shell-block-unit', `${metrics.blockUnit.toFixed(4)}px`);
        rootStyle.setProperty('--mobile-layout-inline-unit', `${metrics.inlineUnit.toFixed(4)}px`);
        rootStyle.setProperty('--mobile-layout-block-unit', `${metrics.blockUnit.toFixed(4)}px`);
    }, [
        core?.factionSelection,
        isMobileViewport,
        phase,
        runtimeViewport.height,
        runtimeViewport.width,
    ]);
    
    // 对手视角切换状态（必须在使用前声明，避免 TDZ 错误）
    const [viewMode, setViewMode] = useState<'self' | 'opponent'>('self');
    const toggleViewMode = useCallback(() => {
        setViewMode(prev => prev === 'self' ? 'opponent' : 'self');
    }, []);
    
    // 对手玩家数据
    const opponentPid = coreTurnOrder.find(pid => pid !== rootPid) || '1';
    const opponentPlayer = corePlayers[opponentPid];
    
    // 根据视角模式选择显示的玩家数据
    // 重赛系统（通用 hook）
    const { overlayProps: endgameProps } = useEndgame({
        result: isGameOver || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });

    const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
    const [selectedCardMode, setSelectedCardMode] = useState<'minion' | 'action' | 'ongoing' | 'ongoing-minion' | 'action-minion' | null>(null);
    const [selectedSetAsideTitanUid, setSelectedSetAsideTitanUid] = useState<string | null>(null);
    const [pendingFusionChoiceUid, setPendingFusionChoiceUid] = useState<string | null>(null);
    const [discardSelection, setDiscardSelection] = useState<Set<string>>(new Set());
    const [meFirstPendingCard, setMeFirstPendingCard] = useState<MeFirstPendingCard | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [endTurnCooldownUntil, setEndTurnCooldownUntil] = useState(0);
    const endTurnCooldownUntilRef = useRef(0);
    const [handDragPreview, setHandDragPreview] = useState<HandAreaDragPreview | null>(null);

    // 弃牌判断：抽牌阶段 + 是我的回合 + 手牌超限
    // 使用 useMemo 确保使用最新的依赖值（避免时序问题）
    const needDiscard = useMemo(() => {
        return phase === 'draw' && isMyTurn && !!myPlayer && myPlayer.hand.length > HAND_LIMIT;
    }, [phase, isMyTurn, myPlayer]);

    const discardCount = needDiscard && myPlayer ? myPlayer.hand.length - HAND_LIMIT : 0;

    // 弃牌堆可打出卡牌选项（仅在出牌阶段且是自己回合时计算）
    // 随从额度已满时，过滤掉消耗正常额度的选项（不消耗额度的额外打出仍然可用）
    // 但需要考虑基地限定额度和同名额度：如果有额度，则保留可以打到对应基地的选项
    const discardPlayOptions = useMemo(() => {
        if (!isMyTurn || phase !== 'playCards' || !playerID) return [];
        const all = getDiscardPlayOptions(core, playerID);
        const globalQuotaFull = myPlayer ? myPlayer.minionsPlayed >= myPlayer.minionLimit : false;
        if (!globalQuotaFull) return all;

        // 全局额度已满，检查同名额度和基地限定额度
        const sameNameRemaining = myPlayer?.sameNameMinionRemaining ?? 0;
        const sameNameDefId = myPlayer?.sameNameMinionDefId;
        const baseQuota = myPlayer?.baseLimitedMinionQuota ?? {};
        const baseSameNameRequired = myPlayer?.baseLimitedSameNameRequired ?? {};
        const hasBaseQuota = Object.values(baseQuota).some(v => v > 0);

        return all.filter(opt => {
            // 不消耗正常额度的选项（额外打出）始终保留
            if (!opt.consumesNormalLimit) return true;
            // 同名额度可用时，检查 defId 是否匹配
            if (sameNameRemaining > 0) {
                // 尚未锁定 defId 或 defId 匹配时可用
                if (sameNameDefId === null || sameNameDefId === undefined || opt.defId === sameNameDefId) {
                    return true;
                }
            }
            // 消耗正常额度的选项：只有当有基地限定额度且可以打到对应基地时才保留
            if (!hasBaseQuota) return false;
            if (opt.allowedBaseIndices === 'all') {
                // 可以打到任意基地，检查是否有任何基地有额度
                return Object.keys(baseQuota).some(baseIdx => {
                    const idx = Number(baseIdx);
                    if (baseQuota[idx] <= 0) return false;
                    // 检查同名约束
                    if (baseSameNameRequired[idx]) {
                        // 必须与该基地上已有随从同名（运行时检查）
                        return true;
                    }
                    return true;
                });
            }
            // 只能打到特定基地，检查这些基地是否有额度
            return opt.allowedBaseIndices.some(baseIdx => {
                if ((baseQuota[baseIdx] ?? 0) <= 0) return false;
                // 检查同名约束
                if (baseSameNameRequired[baseIdx]) {
                    // 必须与该基地上已有随从同名（运行时检查）
                    return true;
                }
                return true;
            });
        });
    }, [core, isMyTurn, phase, playerID, myPlayer]);

    // 手牌弃牌交互检测：当前 interaction 的所有选项都对应手牌时，用手牌区直接选择
    const currentInteraction = G?.sys?.interaction?.current;
    const currentPrompt = useMemo(() => asSimpleChoice(currentInteraction), [currentInteraction]);

    const isHandDiscardPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        // 多选交互（如疯狂解放）不走手牌直选，交给 PromptOverlay 处理
        if (currentPrompt.multi) return false;

        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        return data?.targetType === 'hand';
    }, [currentPrompt, playerID, currentInteraction]);

    // 手牌交互中不可选的 uid 集合（置灰）
    // 框架层已支持通用刷新（所有交互自动刷新），此处只处理明确禁用的选项
    const handPromptDisabledUids = useMemo<Set<string> | undefined>(() => {
        if (!isHandDiscardPrompt || !currentPrompt || !myPlayer) return undefined;

        // 只标记选项中明确禁用的卡牌（opt.disabled === true）
        const disabled = new Set<string>();
        for (const opt of currentPrompt.options) {
            if (opt.disabled) {
                const val = opt.value as { cardUid?: string } | undefined;
                if (val?.cardUid) disabled.add(val.cardUid);
            }
        }

        return disabled.size > 0 ? disabled : undefined;
    }, [isHandDiscardPrompt, currentPrompt, myPlayer]);

    const handPromptTitanUids = useMemo<Set<string>>(() => {
        if (!isHandDiscardPrompt || !currentPrompt) return new Set();
        const titanUids = new Set<string>();
        for (const opt of currentPrompt.options) {
            const val = opt.value as CardOrTitanChoiceValue | undefined;
            if (val?.titanUid) titanUids.add(val.titanUid);
        }
        return titanUids;
    }, [isHandDiscardPrompt, currentPrompt]);

    // 手牌选择中的非手牌选项（如"跳过"/"完成"），需要作为浮动按钮显示
    const handSelectExtraOptions = useMemo(() => {
        if (!isHandDiscardPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return false;
            // 非手牌选项：没有 cardUid 字段的选项（如 skip/done/confirm）
            return !val.cardUid && !val.titanUid;
        }).map(opt => ({
            ...opt,
            label: resolvePromptOptionLabel(opt),
        }));
    }, [isHandDiscardPrompt, currentPrompt, resolvePromptOptionLabel]);

    // 基地选择交互检测：当前 interaction 的选项包含有效 baseIndex 时，用基地区直接点击选择
    const isBaseSelectPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        // 多选交互不走棋盘点击模式，交给 PromptOverlay 卡牌多选面板处理
        if (currentPrompt.multi) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        return data?.targetType === 'base';
    }, [currentPrompt, playerID, currentInteraction]);

    const _baseSelectPromptTitle = isBaseSelectPrompt && currentPrompt ? currentPrompt.title : '';

    // 可选基地索引集合（只高亮候选基地，baseIndex≥0）
    const selectableBaseIndices = useMemo<Set<number>>(() => {
        if (!isBaseSelectPrompt || !currentPrompt) return new Set();
        const indices = new Set<number>();
        for (const opt of currentPrompt.options) {
            const val = opt.value as { baseIndex?: number } | undefined;
            if (val != null && typeof val.baseIndex === 'number' && val.baseIndex >= 0) {
                indices.add(val.baseIndex);
            }
        }
        return indices;
    }, [isBaseSelectPrompt, currentPrompt]);

    // 基地选择中的非基地选项（如"完成"/"跳过"），需要作为浮动按钮显示
    const baseSelectExtraOptions = useMemo(() => {
        if (!isBaseSelectPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return true;
            // 有效基地选项：baseIndex >= 0
            if (typeof val.baseIndex === 'number' && val.baseIndex >= 0) return false;
            // 其余都是非基地操作选项（skip / done / cancel 等）
            return true;
        }).map(opt => ({
            ...opt,
            label: resolvePromptOptionLabel(opt),
        }));
    }, [isBaseSelectPrompt, currentPrompt, resolvePromptOptionLabel]);

    // 埋葬牌选择交互检测：generic 交互中的卡牌选项全部映射到场上的埋葬牌
    const isBuriedSelectPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        if (data?.targetType !== 'generic') return false;

        let buriedOptionCount = 0;
        for (const opt of currentPrompt.options) {
            const val = opt.value as BuriedPromptOptionValue | undefined;
            if (!val) return false;
            if (val.skip === true || val.done === true) continue;
            if (typeof val.cardUid !== 'string' || typeof val.baseIndex !== 'number' || val.baseIndex < 0) {
                return false;
            }
            const buriedCards = coreBases[val.baseIndex]?.buriedCards ?? [];
            if (!buriedCards.some(card => card.uid === val.cardUid)) {
                return false;
            }
            buriedOptionCount += 1;
        }

        return buriedOptionCount > 0;
    }, [coreBases, currentPrompt, currentInteraction, playerID]);

    const buriedPromptOptionsByUid = useMemo(() => {
        const optionsByUid = new Map<string, { optionId: string; disabled: boolean }>();
        if (!isBuriedSelectPrompt || !currentPrompt) return optionsByUid;
        for (const opt of currentPrompt.options) {
            const val = opt.value as BuriedPromptOptionValue | undefined;
            if (!val?.cardUid || typeof val.baseIndex !== 'number' || val.baseIndex < 0) continue;
            optionsByUid.set(val.cardUid, { optionId: opt.id, disabled: !!opt.disabled });
        }
        return optionsByUid;
    }, [isBuriedSelectPrompt, currentPrompt]);

    const selectableBuriedCardUids = useMemo<Set<string>>(() => {
        const uids = new Set<string>();
        if (!isBuriedSelectPrompt || !currentPrompt) return uids;
        for (const opt of currentPrompt.options) {
            const val = opt.value as BuriedPromptOptionValue | undefined;
            if (opt.disabled || val?.skip === true || val?.done === true) continue;
            if (typeof val?.cardUid === 'string') {
                uids.add(val.cardUid);
            }
        }
        return uids;
    }, [isBuriedSelectPrompt, currentPrompt]);

    const buriedSelectExtraOptions = useMemo(() => {
        if (!isBuriedSelectPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as BuriedPromptOptionValue | undefined;
            if (!val) return true;
            return !(typeof val.cardUid === 'string' && typeof val.baseIndex === 'number' && val.baseIndex >= 0);
        }).map(opt => ({
            ...opt,
            label: resolvePromptOptionLabel(opt),
        }));
    }, [isBuriedSelectPrompt, currentPrompt, resolvePromptOptionLabel]);

    const isMultiBuriedSelect = useMemo(() => {
        return isBuriedSelectPrompt && !!currentPrompt?.multi;
    }, [isBuriedSelectPrompt, currentPrompt]);

    // 随从选择交互检测：targetType === 'minion' 或有随从选项（跳过选项不影响判断）
    const isMinionSelectPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        return data?.targetType === 'minion';
    }, [currentPrompt, playerID, currentInteraction]);

    // 可选随从 UID 集合（只高亮候选随从，排除跳过选项）
    const selectableMinionUids = useMemo<Set<string>>(() => {
        if (!isMinionSelectPrompt || !currentPrompt) return new Set();
        const uids = new Set<string>();
        for (const opt of currentPrompt.options) {
            const val = opt.value as { minionUid?: string; skip?: boolean } | undefined;
            // 排除跳过选项（不高亮）
            if (val?.skip === true) continue;
            if (val?.minionUid) uids.add(val.minionUid);
        }
        return uids;
    }, [isMinionSelectPrompt, currentPrompt]);

    // 随从选择中的非随从选项（如"跳过"/"完成"），需要作为浮动按钮显示
    const minionSelectExtraOptions = useMemo(() => {
        if (!isMinionSelectPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return true;
            // 包含 minionUid 的是随从选项，不在此显示
            if (typeof val.minionUid === 'string') return false;
            // 其余都是非随从操作选项（skip / done / cancel 等）
            return true;
        }).map(opt => ({
            ...opt,
            label: resolvePromptOptionLabel(opt),
        }));
    }, [isMinionSelectPrompt, currentPrompt, resolvePromptOptionLabel]);

    // 多选随从模式检测
    const isMultiMinionSelect = useMemo(() => {
        return isMinionSelectPrompt && !!currentPrompt?.multi;
    }, [isMinionSelectPrompt, currentPrompt]);

    // 多选随从模式：已选中的 optionId 集合
    const [multiSelectedOptionIds, setMultiSelectedOptionIds] = useState<Set<string>>(new Set());

    // 多选随从模式：约束
    const multiMinionConstraints = useMemo(() => {
        if (!isMultiMinionSelect || !currentPrompt?.multi) return { min: 0, max: Infinity };
        const multi = currentPrompt.multi as { min?: number; max?: number };
        return { min: multi.min ?? 0, max: multi.max ?? Infinity };
    }, [isMultiMinionSelect, currentPrompt]);

    // 多选随从已选中的 UID 集合（用于 BaseZone 高亮已选随从）
    const multiSelectedMinionUids = useMemo<Set<string>>(() => {
        if (!isMultiMinionSelect) return new Set();
        const uids = new Set<string>();
        for (const optId of multiSelectedOptionIds) {
            const opt = currentPrompt?.options.find(o => o.id === optId);
            const val = opt?.value as { minionUid?: string } | undefined;
            if (val?.minionUid) uids.add(val.minionUid);
        }
        return uids;
    }, [isMultiMinionSelect, multiSelectedOptionIds, currentPrompt]);

    const multiSelectedBuriedCardUids = useMemo<Set<string>>(() => {
        if (!isMultiBuriedSelect) return new Set();
        const uids = new Set<string>();
        for (const optId of multiSelectedOptionIds) {
            const opt = currentPrompt?.options.find(o => o.id === optId);
            const val = opt?.value as BuriedPromptOptionValue | undefined;
            if (val?.cardUid) uids.add(val.cardUid);
        }
        return uids;
    }, [isMultiBuriedSelect, multiSelectedOptionIds, currentPrompt]);

    // 持续行动卡选择交互检测：targetType === 'ongoing'
    const isOngoingSelectPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        return data?.targetType === 'ongoing';
    }, [currentPrompt, playerID, currentInteraction]);

    // 可选持续行动卡 UID 集合（高亮候选行动卡）
    const selectableOngoingUids = useMemo<Set<string>>(() => {
        if (!isOngoingSelectPrompt || !currentPrompt) return new Set();
        const uids = new Set<string>();
        for (const opt of currentPrompt.options) {
            const val = opt.value as { cardUid?: string; skip?: boolean } | undefined;
            if (val?.skip === true) continue;
            if (val?.cardUid) uids.add(val.cardUid);
        }
        return uids;
    }, [isOngoingSelectPrompt, currentPrompt]);

    // 持续行动卡选择中的非行动卡选项（如"跳过"），需要作为浮动按钮显示
    const ongoingSelectExtraOptions = useMemo(() => {
        if (!isOngoingSelectPrompt || !currentPrompt) return [];
        return currentPrompt.options.filter(opt => {
            const val = opt.value as Record<string, unknown> | undefined;
            if (!val) return true;
            // 包含 cardUid 的是行动卡目标选项，不在此显示
            if (typeof val.cardUid === 'string') return false;
            // 其余都是非行动卡操作选项（skip / done / cancel 等）
            return true;
        });
    }, [isOngoingSelectPrompt, currentPrompt]);

    // 交互驱动的选择提示标题（基地/随从/手牌/行动卡选择统一）
    const interactionSelectTitle = useMemo(() => {
        let raw = '';
        if (isBaseSelectPrompt && currentPrompt) raw = currentPrompt.title;
        else if (isBuriedSelectPrompt && currentPrompt) raw = currentPrompt.title;
        else if (isMinionSelectPrompt && currentPrompt) raw = currentPrompt.title;
        else if (isHandDiscardPrompt && currentPrompt) raw = currentPrompt.title;
        else if (isOngoingSelectPrompt && currentPrompt) raw = currentPrompt.title;
        return raw ? resolveI18nKeys(raw, t) : '';
    }, [isBaseSelectPrompt, isBuriedSelectPrompt, isMinionSelectPrompt, isHandDiscardPrompt, isOngoingSelectPrompt, currentPrompt, t]);

    // 弃牌堆随从选择交互检测（僵尸领主等）：targetType === 'discard_minion'
    const isDiscardMinionPrompt = useMemo(() => {
        if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        return data?.targetType === 'discard_minion';
    }, [currentPrompt, playerID, currentInteraction]);



    // 弃牌堆随从选择：可选基地索引（从 interaction data 中读取）
    const discardMinionAllowedBases = useMemo<Set<number>>(() => {
        if (!isDiscardMinionPrompt) return new Set();
        const data = currentInteraction?.data as Record<string, unknown> | undefined;
        const indices = data?.allowedBaseIndices as number[] | undefined;
        return new Set(indices ?? []);
    }, [isDiscardMinionPrompt, currentInteraction]);

    // 弃牌堆出牌横排选中的卡 uid（统一状态）
    const [discardStripSelectedUid, setDiscardStripSelectedUid] = useState<string | null>(null);

    // interaction 切换时重置手牌/弃牌区选中状态。
    // 这里必须监听 currentPrompt 对象引用，而不是 currentPrompt?.id，
    // 否则同 id 的新交互复用时会残留上一轮移动端选中态。
    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            if (currentPrompt) {
                setSelectedCardUid(null);
                setSelectedCardMode(null);
                setPendingFusionChoiceUid(null);
            }
            setDiscardStripSelectedUid(null);
            setMultiSelectedOptionIds(new Set());
        });
        return () => {
            cancelled = true;
        };
    }, [currentPrompt]);

    // 统一弃牌堆出牌：合并正常弃牌堆出牌 + interaction 驱动的弃牌堆随从选择
    const discardStripCards = useMemo<{ uid: string; defId: string; label: string; optionId?: string; optionValue?: unknown }[]>(() => {
        // interaction 驱动模式优先（僵尸领主等）
        if (isDiscardMinionPrompt && currentPrompt) {
            return currentPrompt.options
                .filter(opt => !(opt.value as Record<string, unknown>)?.done)
                .map(opt => {
                    const val = opt.value as { cardUid: string; defId: string };
                    return { uid: val.cardUid, defId: val.defId, label: opt.label, optionId: opt.id, optionValue: opt.value };
                });
        }
        // 正常弃牌堆出牌模式
        if (discardPlayOptions.length > 0) {
            return discardPlayOptions.map(opt => ({
                uid: opt.card.uid, defId: opt.defId, label: opt.name,
            }));
        }
        return [];
    }, [isDiscardMinionPrompt, currentPrompt, discardPlayOptions]);

    // 弃牌堆出牌横排的"完成"选项（interaction 模式下的 done 选项）
    const discardStripDoneOption = useMemo(() => {
        if (!isDiscardMinionPrompt || !currentPrompt) return null;
        return currentPrompt.options.find(opt => (opt.value as Record<string, unknown>)?.done) ?? null;
    }, [isDiscardMinionPrompt, currentPrompt]);

    // 横排消失时重置
    useEffect(() => {
        if (discardStripCards.length !== 0) return;
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            setDiscardStripSelectedUid(null);
        });
        return () => {
            cancelled = true;
        };
    }, [discardStripCards.length]);

    // 弃牌堆出牌横排可选基地集合
    const discardStripAllowedBases = useMemo<Set<number>>(() => {
        if (!discardStripSelectedUid) return new Set();
        // interaction 模式：从 interaction data 读取
        if (isDiscardMinionPrompt) return discardMinionAllowedBases;
        // 正常弃牌堆出牌：从 discardPlayOptions 读取
        const opt = discardPlayOptions.find(o => o.card.uid === discardStripSelectedUid);
        if (!opt) return new Set();
        if (opt.allowedBaseIndices === 'all') {
            return new Set(coreBases.map((_, i) => i));
        }
        return new Set(opt.allowedBaseIndices);
    }, [discardStripSelectedUid, isDiscardMinionPrompt, discardMinionAllowedBases, discardPlayOptions, coreBases]);


    // 响应窗口状态判断（meFirst 或 afterScoring）
    const responseWindow = G?.sys?.responseWindow?.current;
    const isMeFirstResponse = useMemo(() => {
        if (!responseWindow || responseWindow.windowType !== 'meFirst') return false;
        const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
        return playerID === currentResponderId;
    }, [responseWindow, playerID]);

    const isAfterScoringResponse = useMemo(() => {
        if (!responseWindow || responseWindow.windowType !== 'afterScoring') return false;
        const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
        return playerID === currentResponderId;
    }, [responseWindow, playerID]);

    // 响应窗口期间禁用不匹配的卡牌（置灰）
    // 但当有手牌选择交互时（isHandDiscardPrompt），不禁用手牌（交互会自己处理可选项）
    const meFirstDisabledUids = useMemo<Set<string> | undefined>(() => {
        // 只在响应窗口期间且轮到我时生效
        const isMyResponseTurn = isMeFirstResponse || isAfterScoringResponse;
        if (!isMyResponseTurn || !myPlayer) return undefined;
        // 有手牌选择交互时，不应用响应窗口禁用规则（交互自己控制可选项）
        if (isHandDiscardPrompt) return undefined;
        
        const disabled = new Set<string>();
        const windowType = responseWindow?.windowType;
        
        for (const card of myPlayer.hand) {
            if (card.type === 'minion') {
                // beforeScoringPlayable 随从只在 meFirst 窗口可用
                if (windowType === 'meFirst') {
                    const mDef = getMinionDef(card.defId);
                    if (!mDef?.beforeScoringPlayable) {
                        disabled.add(card.uid);
                    }
                } else {
                    // afterScoring 窗口禁用所有随从
                    disabled.add(card.uid);
                }
                continue;
            }
            if (!isCardActionLike(card)) {
                disabled.add(card.uid);
                continue;
            }
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!def) {
                disabled.add(card.uid);
                continue;
            }
            if (!isActionLikeRespondableInWindow(def, windowType)) {
                disabled.add(card.uid);
            }
        }
        return disabled.size > 0 ? disabled : undefined;
    }, [isMeFirstResponse, isAfterScoringResponse, myPlayer, isHandDiscardPrompt, responseWindow?.windowType]);

    // Me First! 可选基地集合（达到临界点的基地索引）
    // 使用统一查询函数：优先使用进入 scoreBases 阶段时锁定的列表（Wiki Phase 3 Step 4）
    const meFirstEligibleBaseIndices = useMemo<Set<number>>(() => {
        if (!meFirstPendingCard) return new Set();
        return new Set(getScoringEligibleBaseIndices(core));
    }, [meFirstPendingCard, core]);

    const displayedDeckPlayerId = viewMode === 'opponent' ? opponentPid : (playerID ?? '0');
    const setAsideTitansForDisplay = useMemo(() => {
        return coreTitans.filter((titan) =>
            titan.ownerId === displayedDeckPlayerId && titan.location.zone === 'setaside',
        );
    }, [coreTitans, displayedDeckPlayerId]);

    const setAsideTitanActivationState = useMemo(() => {
        const result = new Map<string, { baseIndices: Set<number>; firstError: string | null }>();
        if (!playerID) return result;

        const ownedSetAsideTitans = coreTitans.filter((titan) =>
            titan.ownerId === playerID && titan.location.zone === 'setaside',
        );

        for (const titan of ownedSetAsideTitans) {
            const baseIndices = new Set<number>();
            let firstError: string | null = null;

            for (let i = 0; i < coreBases.length; i++) {
                const validation = validate(G, {
                    type: SU_COMMANDS.ACTIVATE_SPECIAL,
                    playerId: playerID,
                    payload: { titanUid: titan.uid, baseIndex: i },
                });
                if (validation.valid) {
                    baseIndices.add(i);
                } else if (!firstError && validation.error) {
                    firstError = validation.error;
                }
            }

            result.set(titan.uid, { baseIndices, firstError });
        }

        return result;
    }, [G, coreBases.length, coreTitans, playerID]);

    const activatableSetAsideTitanUids = useMemo(() => {
        const next = new Set<string>();
        if (displayedDeckPlayerId !== playerID) return next;
        for (const [titanUid, activation] of setAsideTitanActivationState.entries()) {
            if (activation.baseIndices.size > 0) {
                next.add(titanUid);
            }
        }
        return next;
    }, [displayedDeckPlayerId, playerID, setAsideTitanActivationState]);

    const selectableSetAsideTitanUids = useMemo(() => {
        const next = new Set<string>(activatableSetAsideTitanUids);
        if (displayedDeckPlayerId !== playerID) return next;
        for (const titanUid of handPromptTitanUids) {
            next.add(titanUid);
        }
        return next;
    }, [activatableSetAsideTitanUids, displayedDeckPlayerId, handPromptTitanUids, playerID]);

    const selectedTitanDeployableBaseIndices = useMemo(() => {
        if (!selectedSetAsideTitanUid) return new Set<number>();
        return new Set(setAsideTitanActivationState.get(selectedSetAsideTitanUid)?.baseIndices ?? []);
    }, [selectedSetAsideTitanUid, setAsideTitanActivationState]);
    const activeSelectedSetAsideTitanUid = selectedSetAsideTitanUid && selectedTitanDeployableBaseIndices.size > 0
        ? selectedSetAsideTitanUid
        : null;

    const usableTitanTalentUids = useMemo(() => {
        const next = new Set<string>();
        if (!playerID) return next;

        if (!G || !core) return next;
        for (const titan of coreTitans) {
            if (titan.location.zone !== 'base' || titan.controllerId !== playerID) continue;
            const validation = validate(G, {
                type: SU_COMMANDS.USE_TALENT,
                playerId: playerID,
                payload: { titanUid: titan.uid, baseIndex: titan.location.baseIndex },
            });
            if (validation.valid) {
                next.add(titan.uid);
            }
        }

        return next;
    }, [G, core, coreTitans, playerID]);

    const usableMinionTalentUids = useMemo(() => {
        const next = new Set<string>();
        if (!playerID || !G || !core) return next;

        for (let baseIndex = 0; baseIndex < coreBases.length; baseIndex += 1) {
            for (const minion of coreBases[baseIndex].minions) {
                if (minion.controller !== playerID) continue;
                const validation = validate(G, {
                    type: SU_COMMANDS.USE_TALENT,
                    playerId: playerID,
                    payload: { minionUid: minion.uid, baseIndex },
                });
                if (validation.valid) {
                    next.add(minion.uid);
                }
            }
        }

        return next;
    }, [G, core, coreBases, playerID]);

    const usableSpecialMinionUids = useMemo(() => {
        const next = new Set<string>();
        if (!playerID || !G || !core) return next;

        for (let baseIndex = 0; baseIndex < coreBases.length; baseIndex += 1) {
            for (const minion of coreBases[baseIndex].minions) {
                if (minion.controller !== playerID) continue;
                const validation = validate(G, {
                    type: SU_COMMANDS.ACTIVATE_SPECIAL,
                    playerId: playerID,
                    payload: { minionUid: minion.uid, baseIndex },
                });
                if (validation.valid) {
                    next.add(minion.uid);
                }
            }
        }

        return next;
    }, [G, core, coreBases, playerID]);

    const usableOngoingTalentUids = useMemo(() => {
        const next = new Set<string>();
        if (!playerID || !G || !core) return next;

        for (let baseIndex = 0; baseIndex < coreBases.length; baseIndex += 1) {
            const base = coreBases[baseIndex];

            for (const ongoing of base.ongoingActions ?? []) {
                if (ongoing.ownerId !== playerID) continue;
                const validation = validate(G, {
                    type: SU_COMMANDS.USE_TALENT,
                    playerId: playerID,
                    payload: { ongoingCardUid: ongoing.uid, baseIndex },
                });
                if (validation.valid) {
                    next.add(ongoing.uid);
                }
            }

            for (const minion of base.minions) {
                for (const attachedAction of minion.attachedActions ?? []) {
                    if (attachedAction.ownerId !== playerID) continue;
                    const validation = validate(G, {
                        type: SU_COMMANDS.USE_TALENT,
                        playerId: playerID,
                        payload: { ongoingCardUid: attachedAction.uid, baseIndex },
                    });
                    if (validation.valid) {
                        next.add(attachedAction.uid);
                    }
                }
            }
        }

        return next;
    }, [G, core, coreBases, playerID]);

    const usableTitanOngoingUids = useMemo(() => {
        const next = new Set<string>();
        if (!playerID) return next;

        if (!G || !core) return next;
        for (const titan of coreTitans) {
            if (titan.location.zone !== 'base' || titan.controllerId !== playerID) continue;
            const validation = validate(G, {
                type: SU_COMMANDS.ACTIVATE_TITAN_ONGOING,
                playerId: playerID,
                payload: { titanUid: titan.uid, baseIndex: titan.location.baseIndex },
            });
            if (validation.valid) {
                next.add(titan.uid);
            }
        }

        return next;
    }, [G, core, coreTitans, playerID]);

    const resolvePlayableCardMode = useCallback((card: CardInstance): 'minion' | 'action' | 'ongoing' | 'ongoing-minion' | 'action-minion' | null => {
        if (card.uid === selectedCardUid && selectedCardMode) return selectedCardMode;
        if (card.type === 'minion') return 'minion';
        if (card.type !== 'action') return null;
        const actionDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
        if (!actionDef) return null;
        if (actionDef.subtype === 'ongoing') {
            return actionDef.ongoingTarget === 'minion' ? 'ongoing-minion' : 'ongoing';
        }
        if (actionLikeNeedsPlayMinion(actionDef)) return 'action-minion';
        if (actionLikeNeedsPlayBase(actionDef)) return 'ongoing';
        return 'action';
    }, [selectedCardMode, selectedCardUid]);

    const getDeployableBaseStateForCard = useCallback((card: CardInstance, cardMode: 'minion' | 'action' | 'ongoing' | 'ongoing-minion' | 'action-minion' | null): { deployableBaseIndices: Set<number>; deployBlockReason: string | null } => {
        const indices = new Set<number>();
        if (!playerID || !cardMode) return { deployableBaseIndices: indices, deployBlockReason: null };

        // Me First! 窗口中 beforeScoringPlayable 随从：只允许即将计分的基地
        if (isMeFirstResponse && card.type === 'minion') {
            const mDef = getMinionDef(card.defId);
            if (mDef?.beforeScoringPlayable) {
                const eligible = getScoringEligibleBaseIndices(core);
                for (const idx of eligible) {
                    if (!isSpecialLimitBlocked(core, card.defId, idx)) {
                        indices.add(idx);
                    }
                }
                return { deployableBaseIndices: indices, deployBlockReason: null };
            }
        }

        const player = core.players[playerID];
        if (!player) return { deployableBaseIndices: indices, deployBlockReason: null };

        // 同名额度检查：全局额度用完且只剩同名额度时，defId 必须匹配
        if (cardMode === 'minion') {
            const globalRemaining = player.minionLimit - player.minionsPlayed;
            const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
            const baseQuotaTotal = Object.values(player.baseLimitedMinionQuota ?? {}).reduce((s, v) => s + v, 0);
            if (globalRemaining <= 0 && sameNameRemaining > 0 && baseQuotaTotal <= 0) {
                if (player.sameNameMinionDefId !== null && player.sameNameMinionDefId !== undefined && card.defId !== player.sameNameMinionDefId) {
                    return {
                        deployableBaseIndices: indices,
                        deployBlockReason: t('ui.same_name_only', {
                            defaultValue: '额外出牌只能打出同名随从',
                        }),
                    };
                }
            }
        }

        for (let i = 0; i < core.bases.length; i++) {
            if (cardMode === 'minion') {
                const minionDef = getMinionDef(card.defId);
                const basePower = minionDef?.power ?? 0;
                const onlyBaseQuota = mustUseBaseLimitedMinionQuota(core, player, i, card.defId, basePower);
                const onlyGlobalPowerLimitedQuota = mustUseGlobalPowerLimitedMinionQuota(core, player, i, card.defId, basePower);
                const maxAllowedPower = getMaxRemainingGlobalPowerLimitedQuota(player);
                if (onlyGlobalPowerLimitedQuota && maxAllowedPower !== undefined && basePower > maxAllowedPower) {
                    continue;
                }
                if (!isOperationRestricted(core, i, playerID, 'play_minion', {
                    minionDefId: card.defId,
                    basePower,
                    usesBaseLimitedMinionQuota: onlyBaseQuota,
                })) {
                    if (onlyBaseQuota) {
                        const bQuota = player.baseLimitedMinionQuota?.[i] ?? 0;
                        if (bQuota <= 0) continue;
                        if (player.baseLimitedSameNameRequired?.[i]) {
                            const baseDefIds = new Set(core.bases[i].minions.map(m => m.defId));
                            if (!baseDefIds.has(card.defId)) continue;
                        }
                    }
                    if (minionDef?.playConstraint) {
                        if (checkPlayConstraintUI(minionDef.playConstraint, core, i, playerID)) {
                            indices.add(i);
                        }
                    } else {
                        indices.add(i);
                    }
                }
            } else if (cardMode === 'ongoing-minion' || cardMode === 'action-minion') {
                if (core.bases[i].minions.length === 0) {
                    continue;
                }
                const actionDef = getCardDef(card.defId) as ActionCardDef | undefined;
                if (actionDef?.playConstraint) {
                    if (checkPlayConstraintUI(actionDef.playConstraint, core, i, playerID)) {
                        indices.add(i);
                    }
                } else {
                    indices.add(i);
                }
            } else if (cardMode === 'ongoing') {
                if (!isOperationRestricted(core, i, playerID, 'play_action')) {
                    const actionDef = getCardDef(card.defId) as ActionCardDef | undefined;
                    if (actionDef?.playConstraint) {
                        if (checkPlayConstraintUI(actionDef.playConstraint, core, i, playerID)) {
                            indices.add(i);
                        }
                    } else {
                        indices.add(i);
                    }
                }
            }
        }
        return { deployableBaseIndices: indices, deployBlockReason: null };
    }, [core, isMeFirstResponse, playerID, t]);

    const collectMinionTargetUids = useCallback((baseIndices: Set<number>) => {
        const uids = new Set<string>();
        for (let i = 0; i < coreBases.length; i++) {
            if (!baseIndices.has(i)) continue;
            for (const minion of coreBases[i].minions) {
                uids.add(minion.uid);
            }
        }
        return uids;
    }, [coreBases]);

    const getCardPlayTargetState = useCallback((card: CardInstance, cardMode: 'action' | 'ongoing' | 'ongoing-minion' | 'action-minion') => {
        if (cardMode === 'action') {
            return {
                hasValidTargets: true,
                deployableBaseIndices: new Set<number>(),
                deployBlockReason: null,
                minionTargetUids: new Set<string>(),
            };
        }

        const { deployableBaseIndices: nextDeployableBaseIndices, deployBlockReason: nextDeployBlockReason } = getDeployableBaseStateForCard(card, cardMode);
        if (cardMode === 'ongoing-minion' || cardMode === 'action-minion') {
            const minionTargetUids = collectMinionTargetUids(nextDeployableBaseIndices);
            return {
                hasValidTargets: minionTargetUids.size > 0,
                deployableBaseIndices: nextDeployableBaseIndices,
                deployBlockReason: nextDeployBlockReason,
                minionTargetUids,
            };
        }

        return {
            hasValidTargets: nextDeployableBaseIndices.size > 0,
            deployableBaseIndices: nextDeployableBaseIndices,
            deployBlockReason: nextDeployBlockReason,
            minionTargetUids: new Set<string>(),
        };
    }, [collectMinionTargetUids, getDeployableBaseStateForCard]);

    // 手牌选中卡牌的有效部署基地集合（排除被 ongoing 限制的基地）
    // deployBlockReason: 当所有基地都不可选时的原因（用于 toast 提示）
    const { deployableBaseIndices, deployBlockReason } = useMemo<{ deployableBaseIndices: Set<number>; deployBlockReason: string | null }>(() => {
        if (!selectedCardUid || !myPlayer) return { deployableBaseIndices: new Set(), deployBlockReason: null };
        const card = myPlayer.hand.find(c => c.uid === selectedCardUid);
        if (!card) return { deployableBaseIndices: new Set(), deployBlockReason: null };
        return getDeployableBaseStateForCard(card, selectedCardMode);
    }, [getDeployableBaseStateForCard, myPlayer, selectedCardMode, selectedCardUid]);

    // ongoing-minion 模式下的有效随从 UID 集合（只包含未被限制基地上的随从）
    const ongoingMinionTargetUids = useMemo<Set<string>>(() => {
        if ((selectedCardMode !== 'ongoing-minion' && selectedCardMode !== 'action-minion') || !playerID) return new Set();
        return collectMinionTargetUids(deployableBaseIndices);
    }, [collectMinionTargetUids, deployableBaseIndices, playerID, selectedCardMode]);

    const usableActiveBaseAbilityIndices = useMemo(() => {
        if (!playerID || !isMyTurn || phase !== 'playCards') return new Set<number>();
        if (selectedCardUid || discardStripSelectedUid || activeSelectedSetAsideTitanUid || isBaseSelectPrompt || isBuriedSelectPrompt || meFirstPendingCard) {
            return new Set<number>();
        }
        const usable = new Set<number>();
        coreBases.forEach((base, baseIndex) => {
            const validation = validate(G, {
                type: SU_COMMANDS.USE_BASE_ABILITY,
                playerId: playerID,
                payload: { baseIndex },
            });
            if (validation.valid) {
                usable.add(baseIndex);
            }
        });
        return usable;
    }, [G, playerID, isMyTurn, phase, selectedCardUid, discardStripSelectedUid, activeSelectedSetAsideTitanUid, isBaseSelectPrompt, isBuriedSelectPrompt, meFirstPendingCard, coreBases]);

    const draggedCard = useMemo(() => {
        if (!handDragPreview || !myPlayer) return null;
        return myPlayer.hand.find((card) => card.uid === handDragPreview.cardUid) ?? null;
    }, [handDragPreview, myPlayer]);

    const draggedCardMode = useMemo(() => {
        if (!draggedCard) return null;
        return resolvePlayableCardMode(draggedCard);
    }, [draggedCard, resolvePlayableCardMode]);

    const dragDeployableBaseIndices = useMemo<Set<number>>(() => {
        if (!draggedCard) return new Set();
        return getDeployableBaseStateForCard(draggedCard, draggedCardMode).deployableBaseIndices;
    }, [draggedCard, draggedCardMode, getDeployableBaseStateForCard]);

    const dragOngoingMinionTargetUids = useMemo<Set<string>>(() => {
        if (draggedCardMode !== 'ongoing-minion' && draggedCardMode !== 'action-minion') return new Set();
        return collectMinionTargetUids(dragDeployableBaseIndices);
    }, [collectMinionTargetUids, dragDeployableBaseIndices, draggedCardMode]);
    // 基地 DOM 引用（用于 FX 特效定位）
    const baseRefsMap = useRef<Map<number, HTMLElement>>(new Map());

    // FX 系统
    const fxBus = useFxBus(smashUpFxRegistry, { playSound });

    // 事件流消费 → FX 特效驱动
    const myPid = playerID || '0';
    const gameEvents = useGameEvents({ G, myPlayerId: myPid, fxBus, baseRefs: baseRefsMap });
    const { feedbacks: gameFeedbacks, removeFeedback: removeGameFeedback } = gameEvents;

    // 行动卡特写队列：
    // - 在线模式：只显示对手打出的行动卡
    // - 本地/测试模式：显示双方行动卡；测试页会固定注入 playerID='0'，因此不能仅靠 playerID 是否为空来区分
    const extractActionCard = useCallback((event: { type: string; payload: unknown }) => {
        const p = event.payload as { playerId: string; defId: string };
        if (!p?.playerId || !p?.defId) return null;
        return { playerId: p.playerId, cardData: { defId: p.defId } };
    }, []);

    const SPOTLIGHT_TRIGGER_EVENTS = useMemo(() => ['su:action_played'], []);

    // 事件流条目（统一获取，避免重复调用）
    const eventStreamEntries = getEventStreamEntries(G);
    const spotlightViewerId = isMultiplayer ? playerID : null;

    const { queue: spotlightQueue, dismiss: dismissSpotlight } = useCardSpotlightQueue<{ defId: string }>({
        entries: eventStreamEntries,
        currentPlayerId: spotlightViewerId,
        // 联机时对手页依赖服务端确认事件驱动特写，不能在 reconcile 时静默吞掉。
        consumeOnReconcile: true,
        triggerEventTypes: SPOTLIGHT_TRIGGER_EVENTS,
        extractCard: extractActionCard,
        maxQueue: 5,
    });

    // 行动卡特写渲染
    const renderSpotlightCard = useCallback((item: SpotlightItem<{ defId: string }>) => {
        const def = getCardDef(item.cardData.defId);
        const resolvedName = resolveCardName(def, t) || item.cardData.defId;
        const resolvedText = resolveCardText(def, t);
        return (
            <div
                className="relative w-[20vw] max-w-[320px] aspect-[0.714] bg-white rounded-lg shadow-2xl border-2 border-slate-300 overflow-hidden"
                data-testid="smashup-action-spotlight-card"
                data-card-def-id={item.cardData.defId}
            >
                <CardPreview
                    previewRef={def?.previewRef}
                    className="w-full h-full object-cover"
                    title={resolvedName}
                />
                {!def?.previewRef && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#f3f0e8]">
                        <div className="text-[1.2vw] font-black uppercase text-slate-800 mb-2">{resolvedName}</div>
                        <div className="text-[0.7vw] text-slate-600 text-center font-mono">{resolvedText}</div>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-red-500 text-white text-[0.7vw] font-black px-2 py-0.5 rounded shadow-md rotate-6">
                    {t('ui.played')}
                </div>
            </div>
        );
    }, [t]);

    // 能力反馈 toast：失败提示，以及成功获得额外出牌额度的明确反馈。
    useEffect(() => {
        if (gameFeedbacks.length === 0) return;
        for (const fb of gameFeedbacks) {
            if (fb.playerId === playerID) {
                const defaultMessage = fb.messageKey === 'ui.extra_minion_granted'
                    ? '获得{{count}}次额外随从机会'
                    : fb.messageKey === 'ui.extra_minion_granted_after_interaction'
                    ? '获得{{count}}次额外随从机会，处理完当前交互流程后可使用'
                    : fb.messageKey === 'ui.extra_action_granted'
                    ? '获得{{count}}次额外行动机会'
                    : fb.messageKey === 'ui.extra_action_granted_after_interaction'
                    ? '获得{{count}}次额外行动机会，处理完当前交互流程后可使用'
                    : '牌库中未找到符合条件的卡牌，已重洗牌库';
                toast(t(fb.messageKey, { defaultValue: defaultMessage, ...fb.messageParams }));
            }
            removeGameFeedback(fb.id);
        }
    }, [gameFeedbacks, removeGameFeedback, playerID, t]);

    // 音效系统
    useGameAudio({
        config: SMASHUP_AUDIO_CONFIG,
        gameId: SMASH_UP_MANIFEST.id,
        G: core,
        ctx: {
            currentPhase: phase,
            isGameOver: !!isGameOver,
            isWinner,
        },
        meta: {
            currentPlayerId: currentPid,
        },
        eventEntries: G?.sys?.eventStream?.entries ?? EMPTY_EVENT_ENTRIES,
    });

    // 教学系统集成
    useTutorialBridge(G?.sys?.tutorial, dispatch);
    const { isActive: isTutorialActive, currentStep: tutorialStep } = useTutorial();
    const isTutorialMode = isTutorialActive;

    // 教学模式下的命令权限检查
    const isTutorialCommandAllowed = useCallback((commandType: string): boolean => {
        if (!isTutorialActive || !tutorialStep) return true;
        // 系统命令不受限制
        if (commandType.startsWith('SYS_')) return true;
        // 有 allowedCommands 白名单时，只允许白名单内的命令
        if (tutorialStep.allowedCommands && tutorialStep.allowedCommands.length > 0) {
            return tutorialStep.allowedCommands.includes(commandType);
        }
        return true;
    }, [isTutorialActive, tutorialStep]);

    // 教学模式下的目标级门控（卡牌/单位粒度）
    const isTutorialTargetAllowed = useCallback((targetId: string): boolean => {
        if (!isTutorialActive || !tutorialStep) return true;
        if (!tutorialStep.allowedTargets || tutorialStep.allowedTargets.length === 0) return true;
        return tutorialStep.allowedTargets.includes(targetId);
    }, [isTutorialActive, tutorialStep]);

    // 教学模式下被禁用的手牌 uid 集合
    const tutorialDisabledUids = useMemo<Set<string> | undefined>(() => {
        if (!isTutorialActive || !tutorialStep?.allowedTargets?.length) return undefined;
        const allowed = tutorialStep.allowedTargets;
        return new Set(
            myPlayer?.hand.filter(c => !allowed.includes(c.uid)).map(c => c.uid) ?? []
        );
    }, [isTutorialActive, tutorialStep, myPlayer?.hand]);

    // 回合切换提示
    const [showTurnNotice, setShowTurnNotice] = useState(false);
    const [isEndTurnUiHidden, setIsEndTurnUiHidden] = useState(false);
    const prevCurrentPidRef = useRef(currentPid);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;
        if (prevCurrentPidRef.current !== currentPid) {
            prevCurrentPidRef.current = currentPid;
            if (currentPid === playerID) {
                queueMicrotask(() => {
                    if (cancelled) return;
                    setShowTurnNotice(true);
                    timer = setTimeout(() => setShowTurnNotice(false), TURN_NOTICE_DURATION_MS);
                });
            }
        }
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [currentPid, playerID]);

    // --- State Management ---
    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            setDiscardSelection(new Set());
            setMeFirstPendingCard(null);
            setIsSubmitting(false);
            setIsEndTurnUiHidden(false);
            setHandDragPreview(null);
        });
        return () => {
            cancelled = true;
        };
    }, [phase, currentPid]);

    useEffect(() => {
        if (interactionMode === 'drag' && viewMode !== 'opponent') return;
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            setHandDragPreview(null);
        });
        return () => {
            cancelled = true;
        };
    }, [interactionMode, viewMode]);

    useEffect(() => {
        if (endTurnCooldownUntil <= Date.now()) return;
        const timeout = window.setTimeout(() => {
            setEndTurnCooldownUntil(0);
        }, Math.max(0, endTurnCooldownUntil - Date.now()));
        return () => window.clearTimeout(timeout);
    }, [endTurnCooldownUntil]);

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            setPendingFusionChoiceUid(null);
            setMeFirstPendingCard(null);
            setSelectedSetAsideTitanUid(null);
        });
        return () => {
            cancelled = true;
        };
    }, [interactionMode]);

    // 卡牌和基地图集已在模块顶层 initSmashUpAtlases() 同步注册，无需异步加载

    // --- Handlers ---
    const handlePlayMinion = useCallback((cardUid: string, baseIndex: number) => {
        if (!isTutorialCommandAllowed(SU_COMMANDS.PLAY_MINION)) {
            playDeniedSound();
            return;
        }
        dispatch(SU_COMMANDS.PLAY_MINION, { cardUid, baseIndex });
        setSelectedCardUid(null);
        setSelectedCardMode(null);
    }, [dispatch, isTutorialCommandAllowed]);

    const handlePlayOngoingAction = useCallback((cardUid: string, baseIndex: number) => {
        if (!isTutorialCommandAllowed(SU_COMMANDS.PLAY_ACTION)) {
            playDeniedSound();
            return;
        }
        // 二次防御：行动额度检查（正常流程在 handleCardClick 已拦截）
        if (myPlayer && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
            playDeniedSound();
            toast(t('ui.action_limit_reached', { defaultValue: '本回合行动额度已用完' }));
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            return;
        }
        dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid, targetBaseIndex: baseIndex });
        setSelectedCardUid(null);
        setSelectedCardMode(null);
    }, [dispatch, isTutorialCommandAllowed, myPlayer, t]);

    /** 持续行动卡附着到随从：点击随从时触发 */
    const handlePlayOngoingToMinion = useCallback((cardUid: string, baseIndex: number, minionUid: string) => {
        if (!isTutorialCommandAllowed(SU_COMMANDS.PLAY_ACTION)) {
            playDeniedSound();
            return;
        }
        // 二次防御：行动额度检查
        if (myPlayer && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
            playDeniedSound();
            toast(t('ui.action_limit_reached', { defaultValue: '本回合行动额度已用完' }));
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            return;
        }
        dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid, targetBaseIndex: baseIndex, targetMinionUid: minionUid });
        setSelectedCardUid(null);
        setSelectedCardMode(null);
    }, [dispatch, isTutorialCommandAllowed, myPlayer, t]);

    const validateImmediateActionPlay = useCallback((card: CardInstance) => {
        return validate(G, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: rootPid,
            payload: { cardUid: card.uid },
        });
    }, [G, rootPid]);

    const handlePlayActionWithoutTarget = useCallback((card: CardInstance) => {
        if (!isTutorialCommandAllowed(SU_COMMANDS.PLAY_ACTION) || !isTutorialTargetAllowed(card.uid)) {
            playDeniedSound();
            return false;
        }

        const validation = validateImmediateActionPlay(card);
        if (!validation.valid) {
            playDeniedSound();
            toast(validation.error || t('ui.no_valid_targets', { defaultValue: '场上没有符合条件的目标' }));
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            return false;
        }

        const cardDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
        const isSpecialAction = card.type === 'fusion'
            ? cardDef?.actionSubtype === 'special'
            : cardDef?.subtype === 'special';
        const isResponseWindowAction = !!responseWindow
            && !!cardDef
            && isActionLikeRespondableInWindow(cardDef, responseWindow.windowType);
        if (!isSpecialAction && !isResponseWindowAction && myPlayer && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
            playDeniedSound();
            toast(t('ui.action_limit_reached', { defaultValue: '本回合战术额度已用完' }));
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            return false;
        }

        dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid: card.uid });
        setSelectedCardUid(null);
        setSelectedCardMode(null);
        return true;
    }, [dispatch, isTutorialCommandAllowed, isTutorialTargetAllowed, myPlayer, responseWindow, t, validateImmediateActionPlay]);

    const enterActionTargetSelection = useCallback((card: CardInstance, cardMode: 'action' | 'ongoing' | 'ongoing-minion' | 'action-minion') => {
        if (cardMode !== 'action') {
            const { hasValidTargets, deployBlockReason } = getCardPlayTargetState(card, cardMode);
            if (!hasValidTargets) {
                playDeniedSound();
                toast(deployBlockReason || t('ui.no_valid_targets', { defaultValue: '场上没有符合条件的目标' }));
                setSelectedCardUid(null);
                setSelectedCardMode(null);
                return false;
            }
        }

        setSelectedCardUid(card.uid);
        setSelectedCardMode(cardMode);
        return true;
    }, [getCardPlayTargetState, t]);

    // VIEWING STATE
    const [viewingCard, setViewingCard] = useState<CardMagnifyTarget | null>(null);

    const handleBaseClick = useCallback((index: number) => {
        // Me First! 基地选择模式：打出需要基地目标的 Special 卡
        if (meFirstPendingCard) {
            if (!meFirstEligibleBaseIndices.has(index)) {
                toast(t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            dispatch(SU_COMMANDS.PLAY_ACTION, { cardUid: meFirstPendingCard.cardUid, targetBaseIndex: index });
            setMeFirstPendingCard(null);
            return;
        }
        // 弃牌堆出牌模式：选中随从后点基地
        if (discardStripSelectedUid) {
            if (!discardStripAllowedBases.has(index)) {
                toast(t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            // interaction 驱动模式（僵尸领主等）：合并 cardUid + baseIndex 响应
            if (isDiscardMinionPrompt && currentPrompt) {
                const card = discardStripCards.find(c => c.uid === discardStripSelectedUid);
                if (card?.optionId) {
                    dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: card.optionId, mergedValue: { ...card.optionValue as Record<string, unknown>, baseIndex: index } });
                }
                setDiscardStripSelectedUid(null);
                return;
            }
            // 正常弃牌堆出牌模式
            dispatch(SU_COMMANDS.PLAY_MINION, { cardUid: discardStripSelectedUid, baseIndex: index, fromDiscard: true });
            setDiscardStripSelectedUid(null);
            return;
        }
        if (activeSelectedSetAsideTitanUid && playerID) {
            if (!selectedTitanDeployableBaseIndices.has(index)) {
                toast(t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            dispatch(SU_COMMANDS.ACTIVATE_SPECIAL, { titanUid: activeSelectedSetAsideTitanUid, baseIndex: index });
            setSelectedSetAsideTitanUid(null);
            return;
        }
        // 基地选择交互模式：直接响应 interaction
        if (isBaseSelectPrompt && currentPrompt) {
            if (!selectableBaseIndices.has(index)) {
                toast(t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            const option = currentPrompt.options.find(
                opt => (opt.value as { baseIndex?: number })?.baseIndex === index
            );
            if (option) {
                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
            }
            return;
        }
        if (selectedCardUid) {
            if (selectedCardMode === 'ongoing-minion' || selectedCardMode === 'action-minion') {
                // 需要选择随从，点击基地无效
                toast(t('ui.select_minion_hint', { defaultValue: '请选择一个随从' }));
                return;
            }
            
            // Me First! 响应窗口期间打出 beforeScoringPlayable 随从：检查响应窗口状态
            if (responseWindow && responseWindow.windowType === 'meFirst') {
                const card = myPlayer?.hand.find(c => c.uid === selectedCardUid);
                if (card?.type === 'minion') {
                    const mDef = getMinionDef(card.defId);
                    if (mDef?.beforeScoringPlayable) {
                        // 检查是否还是当前响应者
                        const currentResponderId = responseWindow.responderQueue[responseWindow.currentResponderIndex];
                        if (playerID !== currentResponderId) {
                            toast(t('ui.wait_for_your_turn', { defaultValue: '等待你的响应回合' }));
                            setSelectedCardUid(null);
                            setSelectedCardMode(null);
                            return;
                        }
                    }
                }
            }
            
            // 被限制的基地不可部署
            if (!deployableBaseIndices.has(index)) {
                toast(deployBlockReason || t('ui.invalid_base_target', { defaultValue: '该基地不可选择' }));
                return;
            }
            if (selectedCardMode === 'action') {
                playDeniedSound();
                return;
            }
            if (selectedCardMode === 'ongoing') {
                handlePlayOngoingAction(selectedCardUid, index);
            } else {
                handlePlayMinion(selectedCardUid, index);
            }
            return;
        }

        if (usableActiveBaseAbilityIndices.has(index)) {
            if (!isTutorialCommandAllowed(SU_COMMANDS.USE_BASE_ABILITY)) {
                playDeniedSound();
                return;
            }
            dispatch(SU_COMMANDS.USE_BASE_ABILITY, { baseIndex: index });
        }
    }, [selectedCardUid, selectedCardMode, activeSelectedSetAsideTitanUid, selectedTitanDeployableBaseIndices, handlePlayMinion, handlePlayOngoingAction, t, isBaseSelectPrompt, selectableBaseIndices, currentPrompt, dispatch, meFirstPendingCard, deployableBaseIndices, deployBlockReason, discardStripSelectedUid, discardStripAllowedBases, isDiscardMinionPrompt, discardStripCards, meFirstEligibleBaseIndices, responseWindow, playerID, myPlayer, usableActiveBaseAbilityIndices, isTutorialCommandAllowed]);

    const handleBuriedCardSelect = useCallback((cardUid: string) => {
        if (!isBuriedSelectPrompt || !currentPrompt) return;
        const optionMeta = buriedPromptOptionsByUid.get(cardUid);
        if (!optionMeta || optionMeta.disabled) return;

        if (isMultiBuriedSelect) {
            setMultiSelectedOptionIds(prev => {
                const next = new Set(prev);
                if (next.has(optionMeta.optionId)) {
                    next.delete(optionMeta.optionId);
                } else if (next.size < multiMinionConstraints.max) {
                    next.add(optionMeta.optionId);
                }
                return next;
            });
            return;
        }

        dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: optionMeta.optionId });
    }, [buriedPromptOptionsByUid, currentPrompt, dispatch, isBuriedSelectPrompt, isMultiBuriedSelect, multiMinionConstraints.max]);

    const handleSetAsideTitanSelect = useCallback((titanUid: string) => {
        if (!playerID) return;
        if (isHandDiscardPrompt && currentPrompt && handPromptTitanUids.has(titanUid)) {
            const option = currentPrompt.options.find(
                opt => (opt.value as CardOrTitanChoiceValue | undefined)?.titanUid === titanUid,
            );
            if (option) {
                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
            } else {
                playDeniedSound();
            }
            return;
        }
        const activation = setAsideTitanActivationState.get(titanUid);
        if (!activation || activation.baseIndices.size === 0) {
            playDeniedSound();
            if (activation?.firstError) {
                toast(activation.firstError);
            }
            return;
        }

        setSelectedCardUid(null);
        setSelectedCardMode(null);
        setPendingFusionChoiceUid(null);
        setDiscardStripSelectedUid(null);
        setMeFirstPendingCard(null);
        setSelectedSetAsideTitanUid(activeSelectedSetAsideTitanUid === titanUid ? null : titanUid);
    }, [playerID, isHandDiscardPrompt, currentPrompt, handPromptTitanUids, dispatch, setAsideTitanActivationState, activeSelectedSetAsideTitanUid]);

    const handleCardClick = useCallback((card: CardInstance) => {
        if (activeSelectedSetAsideTitanUid) {
            setSelectedSetAsideTitanUid(null);
        }
        if (isHandDiscardPrompt && currentPrompt) {
            const option = currentPrompt.options.find(
                opt => (opt.value as { cardUid?: string })?.cardUid === card.uid
            );
            if (option) {
                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
            } else {
                playDeniedSound();
                toast(t('ui.card_not_in_options', { defaultValue: '该卡牌不在当前可选范围内' }));
            }
            return;
        }

        if (needDiscard) {
            setDiscardSelection(prev => {
                const next = new Set(prev);
                if (next.has(card.uid)) {
                    next.delete(card.uid);
                } else if (next.size < discardCount) {
                    next.add(card.uid);
                }
                return next;
            });
            return;
        }

        const isInResponseWindow = isMeFirstResponse || isAfterScoringResponse;
        if (isInResponseWindow) {
            const windowType = responseWindow?.windowType;

            if (isCardMinionLike(card)) {
                if (windowType !== 'meFirst') {
                    playDeniedSound();
                    return;
                }
                const mDef = getMinionDef(card.defId);
                const fDef = getFusionDef(card.defId);
                const canBeforeScoring = mDef?.beforeScoringPlayable || fDef?.minionBeforeScoringPlayable;
                if (!canBeforeScoring) {
                    playDeniedSound();
                    return;
                }
                if (selectedCardUid === card.uid) {
                    setSelectedCardUid(null);
                    setSelectedCardMode(null);
                    setPendingFusionChoiceUid(null);
                } else {
                    setSelectedCardUid(card.uid);
                    setSelectedCardMode('minion');
                    setPendingFusionChoiceUid(null);
                }
                return;
            }

            if (!isCardActionLike(card)) {
                playDeniedSound();
                return;
            }
            const cardDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!cardDef || !isActionLikeRespondableInWindow(cardDef, windowType)) {
                playDeniedSound();
                return;
            }

            if (actionLikeNeedsResponseWindowBase(cardDef)) {
                if (getScoringEligibleBaseIndices(core).length === 0) {
                    playDeniedSound();
                    toast(t('ui.no_valid_targets', { defaultValue: '场上没有符合条件的目标' }));
                    return;
                }
                setMeFirstPendingCard({ cardUid: card.uid, defId: card.defId });
                setSelectedCardUid(null);
                setSelectedCardMode(null);
                return;
            }

            if (selectedCardUid === card.uid && selectedCardMode === 'action') {
                handlePlayActionWithoutTarget(card);
            } else {
                const actionValidation = validateImmediateActionPlay(card);
                if (!actionValidation.valid) {
                    playDeniedSound();
                    toast(actionValidation.error || t('ui.no_valid_targets', { defaultValue: '场上没有符合条件的目标' }));
                    setSelectedCardUid(null);
                    setSelectedCardMode(null);
                    return;
                }
                setSelectedCardUid(card.uid);
                setSelectedCardMode('action');
                setPendingFusionChoiceUid(null);
            }
            return;
        }

        if (!isMyTurn || phase !== 'playCards') {
            playDeniedSound();
            toast(t('ui.invalid_play'));
            return;
        }

        const commandType = isCardActionLike(card) ? SU_COMMANDS.PLAY_ACTION : SU_COMMANDS.PLAY_MINION;
        if (!isTutorialCommandAllowed(commandType)) {
            playDeniedSound();
            return;
        }

        if (!isTutorialTargetAllowed(card.uid)) {
            playDeniedSound();
            return;
        }

        if (card.type === 'fusion') {
            if (selectedCardUid === card.uid && !pendingFusionChoiceUid) {
                setSelectedCardUid(null);
                setSelectedCardMode(null);
                return;
            }
            setPendingFusionChoiceUid(card.uid);
            setSelectedCardUid(card.uid);
            setSelectedCardMode(null);
            return;
        }

        if (card.type === 'action') {
            const cardDef = getCardDef(card.defId) as ActionCardDef | undefined;
            if (cardDef?.subtype !== 'special' && myPlayer && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
                playDeniedSound();
                toast(t('ui.action_limit_reached', { defaultValue: '本回合战术额度已用完' }));
                return;
            }

            if (cardDef?.subtype === 'ongoing') {
                const cardMode = cardDef.ongoingTarget === 'minion' ? 'ongoing-minion' : 'ongoing';
                if (selectedCardUid === card.uid && selectedCardMode === cardMode) {
                    setSelectedCardUid(null);
                    setSelectedCardMode(null);
                } else {
                    enterActionTargetSelection(card, cardMode);
                }
                return;
            }

            if (cardDef && actionLikeNeedsPlayMinion(cardDef)) {
                if (selectedCardUid === card.uid && selectedCardMode === 'action-minion') {
                    setSelectedCardUid(null);
                    setSelectedCardMode(null);
                } else {
                    enterActionTargetSelection(card, 'action-minion');
                }
                return;
            }

            if (cardDef && actionLikeNeedsPlayBase(cardDef)) {
                if (selectedCardUid === card.uid && selectedCardMode === 'ongoing') {
                    setSelectedCardUid(null);
                    setSelectedCardMode(null);
                } else {
                    enterActionTargetSelection(card, 'ongoing');
                }
                return;
            }

            if (selectedCardUid === card.uid && selectedCardMode === 'action') {
                handlePlayActionWithoutTarget(card);
            } else {
                const actionValidation = validateImmediateActionPlay(card);
                if (!actionValidation.valid) {
                    playDeniedSound();
                    toast(actionValidation.error || t('ui.no_valid_targets', { defaultValue: '场上没有符合条件的目标' }));
                    setSelectedCardUid(null);
                    setSelectedCardMode(null);
                    return;
                }
                setSelectedCardUid(card.uid);
                setSelectedCardMode('action');
            }
            return;
        }

        if (selectedCardUid === card.uid) {
            setSelectedCardUid(null);
            setSelectedCardMode(null);
        } else {
            setSelectedCardUid(card.uid);
            setSelectedCardMode('minion');
        }
    }, [activeSelectedSetAsideTitanUid, core, currentPrompt, discardCount, dispatch, enterActionTargetSelection, handlePlayActionWithoutTarget, isAfterScoringResponse, isHandDiscardPrompt, isMeFirstResponse, isMyTurn, isTutorialCommandAllowed, isTutorialTargetAllowed, myPlayer, needDiscard, pendingFusionChoiceUid, phase, responseWindow, selectedCardMode, selectedCardUid, t, validateImmediateActionPlay]);

    const confirmFusionPlayAs = useCallback((playAs: 'minion' | 'action') => {
        if (!pendingFusionChoiceUid || !myPlayer) return;
        const card = myPlayer.hand.find(c => c.uid === pendingFusionChoiceUid);
        if (!card || card.type !== 'fusion') return;
        const def = getCardDef(card.defId) as FusionCardDef | undefined;
        if (!def) return;

        setPendingFusionChoiceUid(null);

        if (playAs === 'minion') {
            setSelectedCardUid(card.uid);
            setSelectedCardMode('minion');
            return;
        }

        if (phase === 'playCards' && def.actionSubtype !== 'special' && myPlayer.actionsPlayed >= myPlayer.actionLimit) {
            playDeniedSound();
            toast(t('ui.action_limit_reached', { defaultValue: '本回合战术额度已用完' }));
            setSelectedCardUid(null);
            setSelectedCardMode(null);
            return;
        }

        if (def.actionSubtype === 'ongoing') {
            enterActionTargetSelection(card, (def.actionOngoingTarget ?? 'base') === 'minion' ? 'ongoing-minion' : 'ongoing');
            return;
        }

        if (actionLikeNeedsPlayMinion(def)) {
            enterActionTargetSelection(card, 'action-minion');
            return;
        }

        if (actionLikeNeedsPlayBase(def)) {
            enterActionTargetSelection(card, 'ongoing');
            return;
        }

        setSelectedCardUid(card.uid);
        setSelectedCardMode('action');
    }, [enterActionTargetSelection, myPlayer, pendingFusionChoiceUid, phase, t]);

    /** 随从点击回调：ongoing-minion 模式下附着行动卡到随从，或交互驱动的随从选择 */
    const handleMinionSelect = useCallback((minionUid: string, baseIndex: number) => {
        // 交互驱动的随从选择
        if (isMinionSelectPrompt && currentPrompt) {
            if (!selectableMinionUids.has(minionUid)) return;
            const option = currentPrompt.options.find(
                opt => (opt.value as { minionUid?: string })?.minionUid === minionUid
            );
            if (!option) return;

            // 多选模式：toggle 选中状态
            if (isMultiMinionSelect) {
                setMultiSelectedOptionIds(prev => {
                    const next = new Set(prev);
                    if (next.has(option.id)) {
                        next.delete(option.id);
                    } else {
                        if (next.size >= multiMinionConstraints.max) return prev;
                        next.add(option.id);
                    }
                    return next;
                });
                return;
            }

            // 单选模式：立即提交
            dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
            return;
        }
        // 需要随从目标的行动卡：点击随从后直接打出
        if (selectedCardUid && (selectedCardMode === 'ongoing-minion' || selectedCardMode === 'action-minion')) {
            if (!ongoingMinionTargetUids.has(minionUid)) return;
            handlePlayOngoingToMinion(selectedCardUid, baseIndex, minionUid);
        }
    }, [selectedCardUid, selectedCardMode, handlePlayOngoingToMinion, isMinionSelectPrompt, isMultiMinionSelect, multiMinionConstraints, selectableMinionUids, currentPrompt, dispatch, ongoingMinionTargetUids]);

    /** 持续行动卡点击回调：交互驱动的行动卡选择 */
    const handleOngoingSelect = useCallback((ongoingUid: string) => {
        if (!isOngoingSelectPrompt || !currentPrompt) return;
        if (!selectableOngoingUids.has(ongoingUid)) return;
        const option = currentPrompt.options.find(
            opt => (opt.value as { cardUid?: string })?.cardUid === ongoingUid
        );
        if (option) {
            dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: option.id });
        }
    }, [isOngoingSelectPrompt, selectableOngoingUids, currentPrompt, dispatch]);

    const handleViewCardDetail = useCallback((card: CardInstance) => {
        const nextTarget = { defId: card.defId, type: card.type === 'minion' ? 'minion' : 'action' } as const;
        if (typeof window !== 'undefined') {
            window.setTimeout(() => {
                setViewingCard(nextTarget);
            }, 0);
            return;
        }
        setViewingCard(nextTarget);
    }, [setViewingCard]);
    const isEndTurnCoolingDown = endTurnCooldownUntil > Date.now();

    const resolveHandDropTarget = useCallback((card: CardInstance, clientX: number, clientY: number): HandAreaDropTarget | null => {
        const cardMode = resolvePlayableCardMode(card);
        if (!cardMode) return null;
        if (cardMode === 'action') {
            if (typeof document === 'undefined' || typeof window === 'undefined') return null;
            const handAreaElement = document.querySelector<HTMLElement>('[data-testid="su-hand-area"]');
            const handAreaTop = handAreaElement?.getBoundingClientRect().top ?? window.innerHeight;
            return clientY < handAreaTop - 16 ? { kind: 'board' } : null;
        }
        const { deployableBaseIndices: dragDeployableBaseIndices } = getDeployableBaseStateForCard(card, cardMode);
        const elements = typeof document !== 'undefined' ? document.elementsFromPoint(clientX, clientY) : [];
        let hoveredBaseIndex: number | null = null;

        for (const element of elements) {
            if (!(element instanceof HTMLElement)) continue;

            const baseIndexText = element.dataset.baseIndex;
            if (baseIndexText != null && hoveredBaseIndex == null) {
                const baseIndex = Number(baseIndexText);
                if (Number.isFinite(baseIndex)) {
                    hoveredBaseIndex = baseIndex;
                }
            }

            if (cardMode === 'ongoing-minion' || cardMode === 'action-minion') {
                const minionUid = element.dataset.minionUid;
                if (!minionUid) continue;
                if (hoveredBaseIndex == null || !dragDeployableBaseIndices.has(hoveredBaseIndex)) return null;
                if (!core.bases[hoveredBaseIndex]?.minions.some((minion) => minion.uid === minionUid)) return null;
                return { kind: 'minion', baseIndex: hoveredBaseIndex, minionUid };
            }

            if (hoveredBaseIndex != null) {
                if (!dragDeployableBaseIndices.has(hoveredBaseIndex)) return null;
                return { kind: 'base', baseIndex: hoveredBaseIndex };
            }
        }
        return null;
    }, [core.bases, getDeployableBaseStateForCard, resolvePlayableCardMode]);

    const handleCardDragPlay = useCallback((card: CardInstance, dropTarget: HandAreaDropTarget) => {
        if (interactionMode !== 'drag') return;
        if (isHandDiscardPrompt || needDiscard || isBaseSelectPrompt || isMinionSelectPrompt || isOngoingSelectPrompt || isDiscardMinionPrompt) return;

        const cardMode = resolvePlayableCardMode(card);
        if (!cardMode) {
            playDeniedSound();
            return;
        }

        if (!isMyTurn || phase !== 'playCards') {
            playDeniedSound();
            return;
        }

        const commandType = cardMode === 'minion' ? SU_COMMANDS.PLAY_MINION : SU_COMMANDS.PLAY_ACTION;
        if (!isTutorialCommandAllowed(commandType) || !isTutorialTargetAllowed(card.uid)) {
            playDeniedSound();
            return;
        }

        if (cardMode === 'action') {
            if (dropTarget.kind !== 'board') {
                playDeniedSound();
                return;
            }
            handlePlayActionWithoutTarget(card);
            return;
        }

        const { deployableBaseIndices: dragDeployableBaseIndices, deployBlockReason: dragDeployBlockReason } = getDeployableBaseStateForCard(card, cardMode);
        if (dropTarget.kind === 'board' || !dragDeployableBaseIndices.has(dropTarget.baseIndex)) {
            if (dragDeployBlockReason) {
                toast(dragDeployBlockReason);
            } else {
                playDeniedSound();
            }
            return;
        }

        if (cardMode === 'ongoing-minion' || cardMode === 'action-minion') {
            if (dropTarget.kind !== 'minion') {
                playDeniedSound();
                return;
            }
            handlePlayOngoingToMinion(card.uid, dropTarget.baseIndex, dropTarget.minionUid);
            return;
        }

        if (cardMode === 'ongoing') {
            if (dropTarget.kind !== 'base') {
                playDeniedSound();
                return;
            }
            handlePlayOngoingAction(card.uid, dropTarget.baseIndex);
            return;
        }

        if (dropTarget.kind !== 'base') {
            playDeniedSound();
            return;
        }
        handlePlayMinion(card.uid, dropTarget.baseIndex);
    }, [getDeployableBaseStateForCard, handlePlayActionWithoutTarget, handlePlayMinion, handlePlayOngoingAction, handlePlayOngoingToMinion, interactionMode, isBaseSelectPrompt, isDiscardMinionPrompt, isHandDiscardPrompt, isMinionSelectPrompt, isMyTurn, isOngoingSelectPrompt, isTutorialCommandAllowed, isTutorialTargetAllowed, needDiscard, phase, resolvePlayableCardMode]);



    const handleViewAction = useCallback((defId: string) => {
        setViewingCard({ defId, type: 'action' });
    }, [setViewingCard]);

    const dragGuideTarget = useMemo(() => {
        if (!handDragPreview?.dropTarget || typeof document === 'undefined') return null;
        const { dropTarget } = handDragPreview;
        if (dropTarget.kind === 'board') {
            return { x: handDragPreview.clientX, y: handDragPreview.clientY };
        }
        if (dropTarget.kind === 'minion') {
            const minionElement = Array.from(document.querySelectorAll<HTMLElement>('[data-minion-uid]'))
                .find((element) => element.dataset.minionUid === dropTarget.minionUid);
            if (minionElement) {
                const rect = minionElement.getBoundingClientRect();
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
        }
        if (dropTarget.kind !== 'base') return null;
        const baseElement = document.querySelector<HTMLElement>(`[data-base-index="${dropTarget.baseIndex}"]`);
        if (!baseElement) return null;
        const rect = baseElement.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, [handDragPreview]);

    const dragGuideEnd = useMemo(() => {
        if (!handDragPreview) return null;
        if (!dragGuideTarget) {
            return { x: handDragPreview.clientX, y: handDragPreview.clientY };
        }
        const dx = dragGuideTarget.x - handDragPreview.originX;
        const dy = dragGuideTarget.y - handDragPreview.originY;
        const distance = Math.hypot(dx, dy) || 1;
        const unitX = dx / distance;
        const unitY = dy / distance;
        const endOffset = handDragPreview.dropTarget?.kind === 'minion' ? 28 : 40;
        return {
            x: dragGuideTarget.x - unitX * endOffset,
            y: dragGuideTarget.y - unitY * endOffset,
        };
    }, [dragGuideTarget, handDragPreview]);

    const dragGuideGeometry = useMemo(() => {
        if (!handDragPreview || !dragGuideEnd) return null;
        const startX = handDragPreview.originX;
        const startY = handDragPreview.originY;
        const endX = dragGuideEnd.x;
        const endY = dragGuideEnd.y;
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const unitX = deltaX / distance;
        const unitY = deltaY / distance;
        let normalX = -unitY;
        let normalY = unitX;
        if (normalY > 0) {
            normalX *= -1;
            normalY *= -1;
        }
        const curveLift = Math.min(184, Math.max(92, distance * 0.22));
        const startInset = 18;
        const visibleStartX = startX + unitX * startInset;
        const visibleStartY = startY + unitY * startInset;
        const control1X = visibleStartX + deltaX * 0.12 + normalX * curveLift;
        const control1Y = visibleStartY + deltaY * 0.04 + normalY * curveLift;
        const endTangent = Math.min(104, Math.max(56, distance * 0.2));
        const control2X = endX - unitX * endTangent;
        const control2Y = endY - unitY * endTangent;
        return {
            startX: visibleStartX,
            startY: visibleStartY,
            endX,
            endY,
            control1X,
            control1Y,
            control2X,
            control2Y,
            path: `M ${visibleStartX} ${visibleStartY} C ${control1X} ${control1Y} ${control2X} ${control2Y} ${endX} ${endY}`,
        };
    }, [dragGuideEnd, handDragPreview]);

    const dragGuidePaths = useMemo(() => {
        if (!dragGuideGeometry) return null;
        return buildDragArrowGuide(
            { x: dragGuideGeometry.startX, y: dragGuideGeometry.startY },
            { x: dragGuideGeometry.control1X, y: dragGuideGeometry.control1Y },
            { x: dragGuideGeometry.control2X, y: dragGuideGeometry.control2Y },
            { x: dragGuideGeometry.endX, y: dragGuideGeometry.endY },
        );
    }, [dragGuideGeometry]);

    const dragGuideHint = useMemo(() => {
        if (!dragGuidePaths) return null;
        const tangentLength = Math.hypot(dragGuidePaths.hintTangent.x, dragGuidePaths.hintTangent.y) || 1;
        let normalX = -dragGuidePaths.hintTangent.y / tangentLength;
        let normalY = dragGuidePaths.hintTangent.x / tangentLength;
        if (normalY > 0) {
            normalX *= -1;
            normalY *= -1;
        }
        return {
            x: dragGuidePaths.hintPoint.x + normalX * 18,
            y: dragGuidePaths.hintPoint.y + normalY * 18,
        };
    }, [dragGuidePaths]);

    // 等待状态就绪
    if (!G || !core) {
        return <LoadingScreen anchor="container" title={t('ui.loading', { defaultValue: '加载中...' })} />;
    }

    // 防御性检查：HMR 或 client 重建时 core 可能不完整
    if (!core.turnOrder || !core.bases) {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: false }}>
                <LoadingScreen
                    anchor="container"
                    description={t('ui.loading', { defaultValue: '加载中...' })}
                    className="bg-[#3e2723]"
                />
            </UndoProvider>
        );
    }

    // EARLY RETURN: Faction Selection
    if (phase === 'factionSelect' && core.factionSelection) {
        return (
            <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: false }}>
                <TutorialSelectionGate
                    isTutorialMode={isTutorialMode}
                    isTutorialActive={isTutorialActive}
                    containerClassName="bg-[#3e2723]"
                    textClassName="text-lg"
                >
                    <div className="relative w-full h-full bg-[#3e2723] overflow-hidden font-sans select-none">
                        <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                        </div>
                        <FactionSelection core={core} dispatch={dispatch} playerID={playerID} />
                    </div>
                </TutorialSelectionGate>
            </UndoProvider>
        );
    }

    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: false }}>
            {/* BACKGROUND: A warm, dark wooden table texture. */}
            <div className="relative w-full h-full bg-[#3e2723] overflow-hidden font-sans select-none"
            >

                {/* Table Texture Layer */}
                <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                </div>
                {/* Vignette for focus: keep desktop mood, but do not add a translucent cover on mobile battlefield baseline. */}
                {!isMobileViewport && (
                    <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
                )}

                {/* --- TOP HUD: "Sticky Notes" Style --- */}
                <div className="relative z-20 flex justify-between items-start pt-6 px-[2vw] pointer-events-none">

                    {/* Left: Turn Tracker (Yellow Notepad) */}
                    <div
                        className={`bg-[#fef3c7] text-slate-800 p-3 pt-4 shadow-[2px_3px_5px_rgba(0,0,0,0.2)] -rotate-1 min-w-[140px] clip-path-jagged ${isMobileViewport ? 'pointer-events-none' : 'pointer-events-auto'}`}
                        data-tutorial-id="su-turn-tracker"
                        style={turnTrackerStyle}
                    >
                        <div className="w-3 h-3 rounded-full bg-red-400 absolute top-1 left-1/2 -translate-x-1/2 opacity-50 shadow-inner" /> {/* Pin */}
                        <motion.div
                            key={`turn-${core.turnNumber}`}
                            initial={{ scale: 0.9, rotate: -3 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className="text-center font-black uppercase text-xl leading-none tracking-tighter mb-1 border-b-2 border-slate-800/20 pb-1"
                        >
                            {t('ui.turn')} {core.turnNumber}
                        </motion.div>
                        <div className="flex justify-between items-center text-sm font-bold font-mono">
                            <span>{isMyTurn ? t('ui.you') : t('ui.opp')}</span>
                            <motion.span
                                key={phase}
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                className="text-blue-600 bg-blue-100 px-1 rounded transform rotate-2 inline-block"
                            >
                                {t(getPhaseNameKey(phase))}
                            </motion.span>
                        </div>
                    </div>

                    {/* Right: Score Sheet + Player Info */}
                    <div
                        className={`bg-white text-slate-900 p-4 shadow-[3px_4px_10px_rgba(0,0,0,0.3)] rotate-1 max-w-[500px] rounded-sm ${isMobileViewport ? 'pointer-events-none' : 'pointer-events-auto'}`}
                        data-tutorial-id="su-scoreboard"
                        style={scoreboardStyle}
                    >
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-2 border-b border-slate-200">{t('ui.score_sheet')}</div>
                        <div className="flex gap-5">
                            {core.turnOrder.map(pid => {
                                const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];
                                const isCurrent = pid === currentPid;
                                const player = core.players[pid];
                                const isMe = pid === playerID;
                                const isOpponent = !isMe;
                                // 派系图标
                                const factionIcons = (player.factions ?? [])
                                    .map(fid => getFactionMeta(fid))
                                    .filter(Boolean);
                                return (
                                    <motion.div
                                        key={pid}
                                        className={`flex flex-col items-center relative group ${isCurrent ? 'scale-110' : 'opacity-60 grayscale'}`}
                                        animate={isCurrent ? { scale: 1.1 } : { scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        onMouseEnter={() => {
                                            // 悬浮在对手区域时显示眼睛图标
                                        }}
                                    >
                                        <span className="text-xs font-black uppercase mb-1">
                                            {isMe ? t('ui.you_short') : t('ui.player_short', { id: pid })}
                                        </span>
                                        <motion.div
                                            key={`vp-${pid}-${core.players[pid]?.vp ?? 0}`}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-black text-white shadow-md border-2 border-white ${conf.bg} ${isOpponent ? 'cursor-pointer relative' : ''}`}
                                            initial={{ scale: 1 }}
                                            animate={{ scale: [1, 1.3, 1] }}
                                            transition={{ duration: 0.4, ease: 'easeOut' }}
                                            onClick={() => {
                                                if (isOpponent) {
                                                    toggleViewMode();
                                                }
                                            }}
                                        >
                                            {core.players[pid]?.vp ?? 0}
                                            {/* 对手区域悬浮时显示眼睛图标（无背景，直接叠加在圆球上） */}
                                            {isOpponent && (
                                                <svg 
                                                    viewBox="0 0 24 24" 
                                                    className={`absolute inset-0 m-auto w-5 h-5 fill-white/80 drop-shadow-[0_0_4px_rgba(0,0,0,0.8)] transition-opacity duration-300 pointer-events-none ${viewMode === 'opponent' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                >
                                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-2.135-4.695-6.305-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                                </svg>
                                            )}
                                        </motion.div>
                                        {/* 派系图标 */}
                                        <div className="flex gap-0.5 mt-1">
                                            {factionIcons.map(meta => {
                                                if (!meta) return null;
                                                const Icon = meta.icon;
                                                return (
                                                    <span key={meta.id} title={t(meta.nameKey)}>
                                                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        {/* 自己的牌库/弃牌信息已移至下方 DeckDiscardZone */}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 对手视角指示器 */}
                <AnimatePresence>
                    {viewMode === 'opponent' && (
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            className="absolute top-[120px] inset-x-0 z-30 flex justify-center pointer-events-none"
                        >
                            <div className="bg-amber-900/95 backdrop-blur-sm text-amber-100 px-6 py-3 rounded-lg border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-3">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-2.135-4.695-6.305-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                </svg>
                                <span className="font-black text-lg uppercase tracking-wider">
                                    {t('ui.opponent_view', { defaultValue: '对手视角' })}
                                </span>
                                <button
                                    onClick={toggleViewMode}
                                    className="ml-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm rounded transition-colors pointer-events-auto"
                                >
                                    {t('ui.back_to_self', { defaultValue: '返回' })}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div
                    className={isMobileViewport
                        ? 'absolute z-50 flex pointer-events-none w-24 h-24'
                        : 'fixed right-[8vw] bottom-[28vh] z-50 flex pointer-events-none w-24 h-24'}
                    style={endTurnButtonStyle}
                    data-tutorial-id="su-end-turn-btn"
                >
                    <AnimatePresence>
                        {isMyTurn && (phase === 'playCards' || (phase === 'scoreBases' && !G.sys.responseWindow?.current && !G.sys.interaction?.current)) && (
                            <motion.div
                                initial={{ y: 100, opacity: 0, scale: 0.5 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 100, opacity: 0, scale: 0.5 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="pointer-events-auto relative h-24 w-24"
                            >
                                {!isEndTurnUiHidden && (
                                    <>
                                <button
                                    data-testid="su-end-turn-action-button"
                                    onClick={() => {
                                        const isBlocked = G.sys.interaction?.isBlocked || !isTutorialCommandAllowed(FLOW_COMMANDS.ADVANCE_PHASE);
                                        const now = Date.now();
                                        if (isBlocked || isSubmitting || now < endTurnCooldownUntilRef.current) {
                                            playDeniedSound();
                                            return;
                                        }
                                        const nextCooldownUntil = now + END_TURN_THROTTLE_MS;
                                        endTurnCooldownUntilRef.current = nextCooldownUntil;
                                        setEndTurnCooldownUntil(nextCooldownUntil);
                                        setIsSubmitting(true);
                                        dispatch(FLOW_COMMANDS.ADVANCE_PHASE, {});
                                        // 超时兜底：3秒后强制重置（防止命令失败导致按钮永久禁用）
                                        setTimeout(() => setIsSubmitting(false), 3000);
                                    }}
                                    disabled={!!G.sys.interaction?.isBlocked || !isTutorialCommandAllowed(FLOW_COMMANDS.ADVANCE_PHASE) || isSubmitting || isEndTurnCoolingDown}
                                    className={`group w-24 h-24 rounded-full border-solid border-4 border-white/95 ring-1 ring-white/55 shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center transition-all text-white relative overflow-hidden ${G.sys.interaction?.isBlocked || !isTutorialCommandAllowed(FLOW_COMMANDS.ADVANCE_PHASE) || isSubmitting || isEndTurnCoolingDown
                                            ? 'bg-slate-600 opacity-50 cursor-not-allowed'
                                            : 'bg-slate-900 hover:scale-110 hover:rotate-3 active:scale-95'
                                        }`}
                                >
                                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />

                                    {G.sys.interaction?.isBlocked ? (
                                        <span className="text-xs font-bold text-amber-300 text-center leading-tight">
                                            {t('ui.waiting_opponent', { defaultValue: '等待对方操作' })}
                                        </span>
                                    ) : t('ui.finish_turn').includes(' ') ? (
                                        <>
                                            <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter leading-tight">
                                                {t('ui.finish_turn').split(' ')[0]}
                                            </span>
                                            <span className="text-lg font-black uppercase italic leading-none">
                                                {t('ui.finish_turn').split(' ')[1]}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-lg font-black uppercase italic leading-none tracking-tighter">
                                            {t('ui.finish_turn')}
                                        </span>
                                    )}

                                    <div className="absolute -inset-1 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
                                </button>

                                {/* 剩余出牌额度指示器 - 绝对定位在按钮右侧 */}
                                {myPlayer && (
                                    <div
                                        className="absolute left-full top-1/2 -translate-y-1/2 ml-3 flex flex-col gap-2"
                                        data-testid="su-end-turn-hints"
                                    >
                                        {/* 随从额度（含基地限定额度 + 力量限制 tooltip） */}
                                        {(() => {
                                            const baseQuota = myPlayer.baseLimitedMinionQuota ?? {};
                                            const baseQuotaTotal = Object.values(baseQuota).reduce((s, v) => s + v, 0);
                                            const sameNameRemaining = myPlayer.sameNameMinionRemaining ?? 0;
                                            const globalRemaining = Math.max(0, myPlayer.minionLimit - myPlayer.minionsPlayed);
                                            const totalRemaining = globalRemaining + baseQuotaTotal + sameNameRemaining;
                                            const hasExtra = baseQuotaTotal > 0 || myPlayer.extraMinionPowerMax !== undefined || sameNameRemaining > 0;
                                            return (
                                                <div className="relative group/minion" data-testid="su-end-turn-minion-quota">
                                                    <div className={`${endTurnQuotaBadgeClassName} ${totalRemaining > 0
                                                            ? 'bg-emerald-600 border-emerald-400 text-white'
                                                            : 'bg-slate-700 border-slate-500 text-slate-300'
                                                        }`}>
                                                        <svg className={endTurnQuotaIconClassName} viewBox="0 0 20 20">
                                                            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                                        </svg>
                                                        <span>{t('ui.minion_short', { defaultValue: '随从' })}</span>
                                                        <span>{totalRemaining}</span>
                                                        {hasExtra && (
                                                            <svg className={endTurnQuotaExtraIconClassName} viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    {/* Tooltip：紧凑纯文本，无图标 */}
                                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/minion:block z-50 pointer-events-none">
                                                        <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[11px] leading-tight rounded border border-slate-600 shadow-xl px-2 py-1.5 whitespace-nowrap space-y-0.5">
                                                            <div className="flex justify-between gap-3">
                                                                <span className="text-slate-300">{t('ui.minion_global_quota', { defaultValue: '通用额度' })}</span>
                                                                <span className="font-bold">{globalRemaining}/{myPlayer.minionLimit}</span>
                                                            </div>
                                                            {Object.entries(baseQuota).map(([baseIdx, count]) => {
                                                                if (count <= 0) return null;
                                                                const bDef = getBaseDef(core.bases[Number(baseIdx)]?.defId);
                                                                const bName = bDef?.name ? t(`cards.${bDef.id}.name`, { defaultValue: bDef.name }) : `#${Number(baseIdx) + 1}`;
                                                                return (
                                                                    <div key={baseIdx} className="text-amber-300">+{count} → {bName}</div>
                                                                );
                                                            })}
                                                            {myPlayer.extraMinionPowerMax !== undefined && (
                                                                <div className="text-orange-300 border-t border-slate-700 pt-0.5">{t('ui.minion_power_cap', { defaultValue: '力量限制 ≤{{max}}', max: myPlayer.extraMinionPowerMax })}</div>
                                                            )}
                                                            {sameNameRemaining > 0 && (
                                                                <div className="text-cyan-300 border-t border-slate-700 pt-0.5">
                                                                    {t('ui.same_name_quota', { defaultValue: '同名额度 +{{count}}', count: sameNameRemaining })}
                                                                    {myPlayer.sameNameMinionDefId && (() => {
                                                                        const def = getMinionDef(myPlayer.sameNameMinionDefId);
                                                                        const name = def ? t(`cards.${myPlayer.sameNameMinionDefId}.name`, { defaultValue: def.name }) : myPlayer.sameNameMinionDefId;
                                                                        return <span className="text-cyan-200 ml-1">({name})</span>;
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="absolute right-3 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-600" />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* 行动额度（含 tooltip） */}
                                        {(() => {
                                            const actionRemaining = Math.max(0, myPlayer.actionLimit - myPlayer.actionsPlayed);
                                            const hasExtraAction = myPlayer.actionLimit > 1;
                                            return (
                                                <div className="relative group/action" data-testid="su-end-turn-action-quota">
                                                    <div className={`${endTurnQuotaBadgeClassName} ${actionRemaining > 0
                                                            ? 'bg-blue-600 border-blue-400 text-white'
                                                            : 'bg-slate-700 border-slate-500 text-slate-300'
                                                        }`}>
                                                        <svg className={endTurnQuotaIconClassName} viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>{t('ui.action_short', { defaultValue: '战术' })}</span>
                                                        <span>{actionRemaining}</span>
                                                        {hasExtraAction && (
                                                            <svg className={endTurnQuotaExtraIconClassName} viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    {/* Tooltip：紧凑纯文本，与随从额度 tooltip 风格一致 */}
                                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/action:block z-50 pointer-events-none">
                                                        <div className="bg-slate-900/95 backdrop-blur-sm text-white text-[11px] leading-tight rounded border border-slate-600 shadow-xl px-2 py-1.5 whitespace-nowrap space-y-0.5">
                                                            <div className="flex justify-between gap-3">
                                                                <span className="text-slate-300">{t('ui.action_global_quota', { defaultValue: '通用额度' })}</span>
                                                                <span className="font-bold">{actionRemaining}/{myPlayer.actionLimit}</span>
                                                            </div>
                                                            {hasExtraAction && (
                                                                <div className="text-amber-300">{t('ui.action_extra_hint', { defaultValue: '含额外行动额度 +{{extra}}', extra: myPlayer.actionLimit - 1 })}</div>
                                                            )}
                                                        </div>
                                                        <div className="absolute right-3 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-slate-600" />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                                    </>
                                )}
                                <button
                                    type="button"
                                    data-testid="su-end-turn-visibility-toggle"
                                    aria-label={isEndTurnUiHidden
                                        ? t('ui.show_end_turn_controls', { defaultValue: '显示结束回合按钮和额度提示' })
                                        : t('ui.hide_end_turn_controls', { defaultValue: '隐藏结束回合按钮和额度提示' })}
                                    onClick={() => setIsEndTurnUiHidden(prev => !prev)}
                                    className={`absolute right-0 bottom-0 z-10 flex items-center justify-center rounded-full border-solid border-2 border-white/95 ring-1 ring-slate-950/15 bg-slate-900/95 text-white shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-all hover:scale-105 active:scale-95 ${isMobileViewport ? 'h-7 w-7 translate-x-[30%] translate-y-[30%] text-[11px]' : 'h-8 w-8 translate-x-[35%] translate-y-[35%] text-xs'}`}
                                >
                                    <span className="font-black leading-none">{isEndTurnUiHidden ? '显' : '隐'}</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 弃牌模式：继续按钮（复用结束回合按钮位置） */}
                    <AnimatePresence>
                        {needDiscard && (
                            <motion.div
                                initial={{ y: 100, opacity: 0, scale: 0.5 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 100, opacity: 0, scale: 0.5 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="pointer-events-auto"
                            >
                                <button
                                    onClick={() => {
                                        if (discardSelection.size === discardCount) {
                                            dispatch(SU_COMMANDS.DISCARD_TO_LIMIT, { cardUids: Array.from(discardSelection) });
                                            setDiscardSelection(new Set());
                                        }
                                    }}
                                    disabled={discardSelection.size !== discardCount}
                                    className={`group w-24 h-24 rounded-full border-solid border-4 border-white/95 ring-1 ring-white/55 shadow-[0_10px_20px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center transition-all text-white relative overflow-hidden ${discardSelection.size !== discardCount
                                            ? 'bg-slate-600 opacity-50 cursor-not-allowed'
                                            : 'bg-slate-900 hover:scale-110 hover:rotate-3 active:scale-95'
                                        }`}
                                >
                                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]" />
                                    <span className="text-lg font-black uppercase italic leading-none tracking-tighter">
                                        {t('ui.continue', { defaultValue: '继续' })}
                                    </span>
                                    <div className="absolute -inset-1 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- 交互选择提示横幅（基地/随从/手牌选择） --- */}
                <AnimatePresence>
                    {(isBaseSelectPrompt || isBuriedSelectPrompt || isMinionSelectPrompt || isHandDiscardPrompt || isOngoingSelectPrompt) && (
                        <motion.div
                            initial={{ y: -20, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: -20, opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="absolute inset-x-0 z-30 flex justify-center pointer-events-none"
                            style={{ top: `${layout.hudTopOffset}px` }}
                        >
                            <div className="bg-slate-900/95 backdrop-blur-sm text-white px-8 py-3 rounded border border-slate-600 shadow-[0_4px_0_#334155,0_8px_24px_rgba(0,0,0,0.5)]">
                                <span className="font-black text-lg uppercase tracking-tighter">
                                    {interactionSelectTitle}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 基地选择浮动操作栏（完成/跳过按钮） --- */}
                <AnimatePresence>
                    {isBaseSelectPrompt && baseSelectExtraOptions.length > 0 && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className={floatingHintClassName}
                            style={floatingHintStyle}
                        >
                            <div className="flex gap-3 pointer-events-auto">
                                {baseSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id })}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 随从选择浮动操作栏（多选确认 + 跳过按钮） --- */}
                <AnimatePresence>
                    {isMinionSelectPrompt && (isMultiMinionSelect || minionSelectExtraOptions.length > 0) && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className={floatingHintClassName}
                            style={floatingHintStyle}
                        >
                            <div className="flex gap-3 items-center pointer-events-auto">
                                {isMultiMinionSelect && (
                                    <>
                                        <div className="bg-slate-900/90 backdrop-blur-sm text-white px-4 py-2 rounded border border-slate-600 shadow-lg">
                                            <span className="font-bold text-sm">
                                                已选 {multiSelectedOptionIds.size}
                                                {multiMinionConstraints.max !== Infinity && ` / ${multiMinionConstraints.max}`}
                                            </span>
                                        </div>
                                        <SmashUpGameButton
                                            variant="primary"
                                            size="md"
                                            disabled={multiSelectedOptionIds.size < multiMinionConstraints.min}
                                            onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: Array.from(multiSelectedOptionIds) })}
                                        >
                                            确认选择
                                        </SmashUpGameButton>
                                    </>
                                )}
                                {minionSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => {
                                            if (isMultiMinionSelect) {
                                                dispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: [opt.id] });
                                            } else {
                                                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id });
                                            }
                                        }}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 埋葬牌选择浮动操作栏（多选确认 + 跳过按钮） --- */}
                <AnimatePresence>
                    {isBuriedSelectPrompt && (isMultiBuriedSelect || buriedSelectExtraOptions.length > 0) && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className={floatingHintClassName}
                            style={floatingHintStyle}
                        >
                            <div className="flex gap-3 items-center pointer-events-auto">
                                {isMultiBuriedSelect && (
                                    <>
                                        <div className="bg-slate-900/90 backdrop-blur-sm text-white px-4 py-2 rounded border border-slate-600 shadow-lg">
                                            <span className="font-bold text-sm">
                                                已选 {multiSelectedOptionIds.size}
                                                {multiMinionConstraints.max !== Infinity && ` / ${multiMinionConstraints.max}`}
                                            </span>
                                        </div>
                                        <SmashUpGameButton
                                            variant="primary"
                                            size="md"
                                            disabled={multiSelectedOptionIds.size < multiMinionConstraints.min}
                                            onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: Array.from(multiSelectedOptionIds) })}
                                        >
                                            确认选择
                                        </SmashUpGameButton>
                                    </>
                                )}
                                {buriedSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => {
                                            if (isMultiBuriedSelect) {
                                                dispatch(INTERACTION_COMMANDS.RESPOND, { optionIds: [opt.id] });
                                            } else {
                                                dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id });
                                            }
                                        }}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 手牌选择浮动操作栏（跳过按钮） --- */}
                <AnimatePresence>
                    {isHandDiscardPrompt && handSelectExtraOptions.length > 0 && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className={floatingHintClassName}
                            style={floatingHintStyle}
                        >
                            <div className="flex gap-3 pointer-events-auto">
                                {handSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id })}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- 持续行动卡选择浮动操作栏（跳过按钮） --- */}
                <AnimatePresence>
                    {isOngoingSelectPrompt && ongoingSelectExtraOptions.length > 0 && (
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className={floatingHintClassName}
                            style={floatingHintStyle}
                        >
                            <div className="flex gap-3 pointer-events-auto">
                                {ongoingSelectExtraOptions.map(opt => (
                                    <SmashUpGameButton
                                        key={opt.id}
                                        variant="secondary"
                                        size="md"
                                        onClick={() => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: opt.id })}
                                    >
                                        {opt.label}
                                    </SmashUpGameButton>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- MAIN BOARD --- */}
                {/* Scrollable table area */}
                <MobileBattlefieldViewport
                    zoomMode={SMASH_UP_MANIFEST.mobileBattlefieldZoom}
                    transformTarget="content"
                    visibleInsets={{
                        top: layout.hudTopOffset,
                        bottom: layout.handAreaHeight,
                    }}
                    className="absolute inset-0 z-10"
                    testId="su-battlefield-viewport"
                >
                    <div
                        className="absolute inset-0 flex items-center justify-center overflow-x-auto overflow-y-hidden no-scrollbar"
                        data-testid="su-battlefield-zoom-target"
                        data-tutorial-id="su-base-area"
                        style={{
                            paddingTop: `${layout.boardPaddingTop}px`,
                            paddingBottom: `${layout.handAreaHeight}px`,
                        }}
                    >
                        <div
                            className="flex items-center min-w-max"
                            data-mobile-battlefield-zoom-target="true"
                            style={{
                                gap: `${layout.baseGap}vw`,
                                paddingInline: `${layout.boardHorizontalPadding}px`,
                            }}
                        >
                            {core.bases.map((base, idx) => (
                                <BaseZone
                                    key={`${base.defId}-${idx}`}
                                    base={base}
                                    baseIndex={idx}
                                    core={core}
                                    turnOrder={core.turnOrder}
                                    isMobileViewport={isMobileViewport}
                                    isDeployMode={
                                        (!!selectedCardUid && selectedCardMode !== 'action' && deployableBaseIndices.has(idx))
                                        || (!!meFirstPendingCard && meFirstEligibleBaseIndices.has(idx))
                                        || (!!activeSelectedSetAsideTitanUid && selectedTitanDeployableBaseIndices.has(idx))
                                        || (!!handDragPreview && draggedCardMode !== 'action' && dragDeployableBaseIndices.has(idx))
                                    }
                                    isMinionSelectMode={!isOngoingSelectPrompt && (
                                        ((selectedCardMode === 'ongoing-minion' || selectedCardMode === 'action-minion') && ongoingMinionTargetUids.size > 0)
                                        || (isMinionSelectPrompt && selectableMinionUids.size > 0)
                                        || (!!handDragPreview && (draggedCardMode === 'ongoing-minion' || draggedCardMode === 'action-minion') && dragOngoingMinionTargetUids.size > 0)
                                    )}
                                    selectableMinionUids={
                                        isMinionSelectPrompt
                                            ? selectableMinionUids
                                            : (selectedCardMode === 'ongoing-minion' || selectedCardMode === 'action-minion')
                                                ? ongoingMinionTargetUids
                                                : !!handDragPreview && (draggedCardMode === 'ongoing-minion' || draggedCardMode === 'action-minion')
                                                    ? dragOngoingMinionTargetUids
                                                    : undefined
                                    }
                                    multiSelectedMinionUids={isMultiMinionSelect ? multiSelectedMinionUids : undefined}
                                    duelParticipantMinionUids={activeDuelParticipantUids.size > 0 ? activeDuelParticipantUids : undefined}
                                    isBuriedSelectMode={isBuriedSelectPrompt}
                                    selectableBuriedCardUids={isBuriedSelectPrompt ? selectableBuriedCardUids : undefined}
                                    multiSelectedBuriedCardUids={isMultiBuriedSelect ? multiSelectedBuriedCardUids : undefined}
                                    isSelectable={(isBaseSelectPrompt && selectableBaseIndices.has(idx)) || (discardStripSelectedUid != null && discardStripAllowedBases.has(idx))}
                                    isDimmed={
                                        (isBaseSelectPrompt && !selectableBaseIndices.has(idx))
                                        || (discardStripSelectedUid != null && !discardStripAllowedBases.has(idx))
                                        || (!!selectedCardUid && selectedCardMode !== 'ongoing-minion' && selectedCardMode !== 'action-minion' && selectedCardMode !== 'action' && !deployableBaseIndices.has(idx))
                                        || (!!meFirstPendingCard && !meFirstEligibleBaseIndices.has(idx))
                                        || (!!activeSelectedSetAsideTitanUid && !selectedTitanDeployableBaseIndices.has(idx))
                                        || (!!handDragPreview && draggedCardMode !== 'ongoing-minion' && draggedCardMode !== 'action-minion' && draggedCardMode !== 'action' && !dragDeployableBaseIndices.has(idx))
                                    }
                                    isMyTurn={isMyTurn}
                                    myPlayerId={playerID}
                                    dispatch={dispatch}
                                    onClick={() => handleBaseClick(idx)}
                                    onMinionSelect={handleMinionSelect}
                                    onOngoingSelect={handleOngoingSelect}
                                    onBuriedCardSelect={handleBuriedCardSelect}
                                    selectableOngoingUids={isOngoingSelectPrompt ? selectableOngoingUids : undefined}
                                    onViewMinion={(defId) => setViewingCard({ defId, type: 'minion' })}
                                    onViewAction={handleViewAction}
                                    onViewBase={(defId) => setViewingCard({ defId, type: 'base' })}
                                    onViewTitan={(defId) => setViewingCard({ defId, type: 'titan' })}
                                    usableMinionTalentUids={usableMinionTalentUids}
                                    usableSpecialMinionUids={usableSpecialMinionUids}
                                    usableOngoingTalentUids={usableOngoingTalentUids}
                                    usableTitanTalentUids={usableTitanTalentUids}
                                    usableTitanOngoingUids={usableTitanOngoingUids}
                                    canUseBaseAbility={usableActiveBaseAbilityIndices.has(idx)}
                                    tokenRef={(el) => {
                                        if (el) baseRefsMap.current.set(idx, el);
                                        else baseRefsMap.current.delete(idx);
                                    }}
                                />

                            ))}
                        </div>
                    </div>
                </MobileBattlefieldViewport>

                {/* --- BOTTOM: HAND & CONTROLS --- */}
                {/* Not a bar, but floating elements */}

                {/* 弃牌提示横幅（顶部，不遮挡手牌） */}
                {myPlayer && needDiscard && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className={topFloatingBannerClassName}
                        style={{ top: `${layout.hudTopOffset}px` }}
                    >
                        <div className="bg-red-900/90 backdrop-blur-sm text-white px-6 py-2 rounded border border-red-500 shadow-lg">
                            <span className="font-black text-base uppercase tracking-tight">
                                {t('ui.discard_desc', { count: discardCount })}（{discardSelection.size}/{discardCount}）
                            </span>
                        </div>
                    </motion.div>
                )}

                {activeDuelBanner && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className={topFloatingBannerClassName}
                        style={{
                            top: `${duelBannerTopOffset + (myPlayer && needDiscard ? stackedTopBannerGap : 0)}px`,
                        }}
                    >
                        <div className="bg-amber-950/92 text-amber-50 px-5 py-2 rounded border-2 border-amber-400 shadow-lg max-w-[min(92vw,680px)]">
                            <div className="font-black text-sm tracking-tight text-center">{activeDuelBanner.title}</div>
                            <div className="text-[11px] md:text-xs text-amber-100/90 text-center mt-0.5">{activeDuelBanner.subtitle}</div>
                        </div>
                    </motion.div>
                )}
                {interactionMode === 'drag' && handDragPreview && viewMode !== 'opponent' && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[58] pointer-events-none">
                        <svg className="absolute inset-0 w-full h-full overflow-visible">
                            {dragGuidePaths && (
                                <g data-testid="su-drag-arrow">
                                    <path
                                        d={dragGuidePaths.linePath}
                                        fill="none"
                                        stroke={dragGuideTarget ? '#d97706' : '#dc6b5f'}
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d={dragGuidePaths.headPath}
                                        fill={dragGuideTarget ? '#d97706' : '#dc6b5f'}
                                    />
                                </g>
                            )}
                        </svg>
                        {dragGuideHint && (
                            <div
                                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3e1bc]/95 px-3 py-[5px] text-[11px] font-bold tracking-[0.04em] text-[#6d4c2f] shadow-[0_8px_18px_rgba(62,39,24,0.18)]"
                                style={{
                                    left: `${dragGuideHint.x}px`,
                                    top: `${dragGuideHint.y}px`,
                                }}
                            >
                                {dragGuideTarget
                                    ? t(
                                        handDragPreview.dropTarget?.kind === 'minion'
                                            ? 'ui.drag_release_to_minion'
                                            : handDragPreview.dropTarget?.kind === 'board'
                                                ? 'ui.drag_release_to_board'
                                                : 'ui.drag_release_to_base',
                                        {
                                            defaultValue: handDragPreview.dropTarget?.kind === 'minion'
                                                ? '松手附着到该随从'
                                                : handDragPreview.dropTarget?.kind === 'board'
                                                    ? '松手打出该卡'
                                                    : '松手打到该基地',
                                        },
                                    )
                                    : t('ui.drag_no_target', { defaultValue: '拖到发光目标上' })}
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
                {/* 手牌区：z-60，在弃牌遮罩之上 */}
                {
                    myPlayer && (
                        <div 
                            className="absolute bottom-0 inset-x-0 z-60 pointer-events-none"
                            style={{ height: `${layout.handAreaHeight}px` }}
                        >

                            <HandArea
                                hand={viewMode === 'opponent' ? opponentPlayer.hand : myPlayer.hand}
                                selectedCardUid={selectedCardUid}
                                onCardSelect={handleCardClick}
                                compactLayout={isMobileViewport}
                                isDiscardMode={needDiscard || isHandDiscardPrompt}
                                discardSelection={discardSelection}
                                // 教学模式下，当不允许打出随从和行动时禁用手牌交互（摇头反馈）
                                disableInteraction={
                                    isTutorialActive &&
                                    !isTutorialCommandAllowed(SU_COMMANDS.PLAY_MINION) &&
                                    !isTutorialCommandAllowed(SU_COMMANDS.PLAY_ACTION)
                                }
                                disabledCardUids={meFirstDisabledUids ?? handPromptDisabledUids ?? tutorialDisabledUids}
                                onCardView={handleViewCardDetail}
                                isOpponentView={viewMode === 'opponent'}
                                interactionMode={interactionMode}
                                onResolveDropTarget={resolveHandDropTarget}
                                onCardDragPlay={handleCardDragPlay}
                                onDragStateChange={setHandDragPreview}
                            />

                            {/* Fusion card playAs selector */}
                            <AnimatePresence>
                                {pendingFusionChoiceUid && (
                                    <motion.div
                                        className="fixed inset-0 flex items-center justify-center"
                                        style={{ zIndex: UI_Z_INDEX.overlayRaised }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => {
                                            setPendingFusionChoiceUid(null);
                                            setSelectedCardUid(null);
                                            setSelectedCardMode(null);
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
                                        <motion.div
                                            className="relative w-[92vw] max-w-[520px] rounded-lg border-2 border-amber-300/60 bg-[#f3f0e8] shadow-2xl p-4 pointer-events-auto"
                                            initial={{ y: 16, scale: 0.98 }}
                                            animate={{ y: 0, scale: 1 }}
                                            exit={{ y: 10, scale: 0.98 }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="font-black text-slate-900 text-lg mb-3">
                                                {t('ui.fusion_choose_playas', { defaultValue: '选择打出方式' })}
                                            </div>
                                            <div className="text-slate-700 text-sm mb-4">
                                                {t('ui.fusion_choose_playas_desc', { defaultValue: '融合卡可以作为随从或战术打出。请选择本次打出的类型。' })}
                                            </div>
                                            <div className="flex gap-3">
                                                <SmashUpGameButton
                                                    variant="primary"
                                                    className="flex-1"
                                                    onClick={() => confirmFusionPlayAs('minion')}
                                                >
                                                    {t('ui.play_as_minion', { defaultValue: '作为随从' })}
                                                </SmashUpGameButton>
                                                <SmashUpGameButton
                                                    variant="secondary"
                                                    className="flex-1"
                                                    onClick={() => confirmFusionPlayAs('action')}
                                                >
                                                    {t('ui.play_as_action', { defaultValue: '作为战术' })}
                                                </SmashUpGameButton>
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* NEW: Deck & Discard Zone */}
                            <DeckDiscardZone
                                deckCount={viewMode === 'opponent' ? opponentPlayer.deck.length : myPlayer.deck.length}
                                madnessSupplyCount={core.madnessDeck !== undefined ? core.madnessDeck.length : undefined}
                                discard={viewMode === 'opponent' ? opponentPlayer.discard : myPlayer.discard}
                                compactLayout={isMobileViewport}
                                isMyTurn={isMyTurn}
                                hasPlayableFromDiscard={discardPlayOptions.length > 0 || isDiscardMinionPrompt}
                                autoOpenPanel={isDiscardMinionPrompt}
                                playableCards={discardStripCards.map(c => ({ uid: c.uid, defId: c.defId, label: c.label }))}
                                selectedUid={discardStripSelectedUid}
                                onSelectCard={setDiscardStripSelectedUid}
                                selectHint={discardStripSelectedUid ? t('ui.click_base_to_deploy', { defaultValue: '点击基地放置随从' }) : undefined}
                                onClosePanel={isDiscardMinionPrompt
                                    ? (discardStripDoneOption
                                        ? () => dispatch(INTERACTION_COMMANDS.RESPOND, { optionId: discardStripDoneOption!.id })
                                        : () => dispatch(INTERACTION_COMMANDS.CANCEL, {}))
                                    : () => { setDiscardStripSelectedUid(null); }
                                }
                                setAsideTitans={setAsideTitansForDisplay}
                                activatableTitanUids={selectableSetAsideTitanUids}
                                selectedTitanUid={activeSelectedSetAsideTitanUid}
                                onSelectTitan={handleSetAsideTitanSelect}
                                onViewTitan={(defId) => setViewingCard({ defId, type: 'titan' })}
                                onViewCard={handleViewCardDetail}
                                dispatch={dispatch}
                                playerID={playerID}
                            />
                        </div>
                    )
                }

                {/* FX 特效层 */}
                <FxLayer
                    bus={fxBus}
                    getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
                />

                {/* 回合切换提示 */}
                <AnimatePresence>
                    {showTurnNotice && (
                        <motion.div
                            className={turnNoticeClassName}
                            style={{ zIndex: UI_Z_INDEX.hint }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <motion.div
                                className="bg-[#fef3c7] text-slate-900 px-5 py-2.5 shadow-xl border-4 border-dashed border-slate-800/30"
                                initial={{ scale: 0.86, y: -10, rotate: -6 }}
                                animate={{ scale: 1, y: 0, rotate: 1.5 }}
                                exit={{ scale: 0.92, y: -8, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                                style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
                            >
                                <span className="text-[clamp(18px,1.5vw,28px)] font-black uppercase tracking-tight">{t('ui.your_turn')}</span>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* DEBUG PANEL */}
                <GameDebugPanel G={G} dispatch={dispatch} playerID={playerID} autoSwitch={false}>
                    <SmashUpDebugConfig G={G} dispatch={dispatch} />
                </GameDebugPanel>

                {/* 行动卡特写队列（在线只看对手，本地模式显示双方，点击关闭） */}
                <CardSpotlightQueue
                    queue={spotlightQueue}
                    onDismiss={dismissSpotlight}
                    renderCard={renderSpotlightCard}
                />

                {/* 卡牌展示浮层（非阻塞，点击关闭） */}
                <RevealOverlay
                    entries={eventStreamEntries}
                    currentPlayerId={rootPid}
                />

                {/* PREVIEW OVERLAY */}
                <CardMagnifyOverlay target={viewingCard} onClose={() => setViewingCard(null)} />

                {/* PROMPT OVERLAY（手牌弃牌/基地选择/随从选择/行动卡选择/弃牌堆出牌交互时隐藏，由对应区域直接处理） */}
                {(() => {
                    const shouldRender = !isHandDiscardPrompt && !isBaseSelectPrompt && !isBuriedSelectPrompt && !isMinionSelectPrompt && !isOngoingSelectPrompt && !isDiscardMinionPrompt;
                    return shouldRender ? (
                        <PromptOverlay
                            interaction={G.sys.interaction?.current}
                            dispatch={dispatch}
                            playerID={playerID}
                        />
                    ) : null;
                })()}

                {/* ME FIRST! 响应窗口 */}
                <MeFirstOverlay
                    G={G}
                    dispatch={dispatch}
                    playerID={playerID}
                    pendingCard={meFirstPendingCard}
                    onSelectCard={setMeFirstPendingCard}
                />

                {/* 自定义结束页面（计分轨风格） */}
                <EndgameOverlay
                    {...endgameProps}
                    renderContent={(props) => (
                        <SmashUpEndgameContent
                            {...props}
                            core={core}
                            myPlayerId={playerID}
                        />
                    )}
                    renderActions={(actionsProps) => (
                        <SmashUpEndgameActions {...actionsProps} />
                    )}
                />
            </div>
        </UndoProvider>
    );
};

export default SmashUpBoard;
