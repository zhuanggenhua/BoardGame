/**
 * 大杀四方 (Smash Up) - 基地区域 + 随从卡片组件
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Hourglass, Paperclip } from 'lucide-react';
import type { SmashUpCore, BaseInPlay, MinionOnBase } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { SMASHUP_CARD_BACK } from '../domain/ids';
import { getTotalEffectivePowerOnBase, getEffectivePower, getEffectivePowerBreakdown, getEffectiveBreakpoint, getOngoingCardPowerContribution, getPlayerEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { getBaseDef, getBasePodVariantId, getMinionDef, getCardDef, getTitanDef, resolveCardName, resolveCardText } from '../data/cards';
import { getTitansOnBase } from '../domain/abilityHelpers';
import { getBaseRestrictions } from '../domain/ongoingEffects';
import { getFactionMeta } from './factionMeta';
import { useSmashUpOverlay } from './SmashUpOverlayContext';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { PLAYER_CONFIG } from './playerConfig';
import { getMunchkinSpecialCardDescriptor } from '../data/factions/munchkin';
import { UI_Z_INDEX } from '../../../core';
import { getLayoutConfig, layoutInlineSize } from './layoutConfig';
import {
    buildMinionUidSnapshotByController,
    resolveEnteringMinionUidsByController,
} from './baseZoneEntryAnimation';
import { useArmedActivation } from '../../../hooks/ui/useArmedActivation';
import { useTouchInspectGesture } from '../../../hooks/ui/useTouchInspectGesture';
import { matchesDefId } from '../domain/utils';
import { getAccessoryChromeClass, getAccessorySurfaceClass } from './accessoryHighlight';

const USED_STATE_CLASS = 'border-slate-400 ring-2 ring-slate-300/80 shadow-[0_0_12px_rgba(148,163,184,0.32)]';
const CARD_ASPECT_RATIO = 0.714;
const BASE_CARD_ASPECT_RATIO = 1.43;

function layoutCardHeight(
    width: number,
    layout: Pick<ReturnType<typeof getLayoutConfig>, 'useRuntimeInlineUnit'>,
    aspectRatio = CARD_ASPECT_RATIO,
): string {
    return layoutInlineSize(width / aspectRatio, layout);
}

function getTimeBoxCounterLabel(titan: { defId: string; metadata?: Record<string, unknown> }): string | null {
    if (titan.defId !== 'time_travelers_time_box') return null;
    const counters = Number(titan.metadata?.timeBoxCounters ?? 0);
    if (!Number.isFinite(counters) || counters <= 0) return null;
    return String(counters);
}

function getMinionBottomOverlayDefId(minion: MinionOnBase): string | undefined {
    if (!matchesDefId(minion.defId, 'shapeshifters_copycat')) return undefined;
    const copiedDefId = minion.metadata?.copiedAbilityDefId;
    return typeof copiedDefId === 'string' && copiedDefId !== minion.defId ? copiedDefId : undefined;
}

function getMinionPowerBadgePresentation(
    core: SmashUpCore,
    minion: MinionOnBase,
    baseIndex: number,
    effectivePower: number,
) {
    const breakdown = getEffectivePowerBreakdown(core, minion, baseIndex);
    const signedContributors = [
        breakdown.powerCounters,
        breakdown.permanentModifier,
        breakdown.tempModifier,
        ...breakdown.ongoingDetails.map(detail => detail.value),
    ].filter(value => value !== 0);
    const hasPositiveContributor = signedContributors.some(value => value > 0);
    const hasNegativeContributor = signedContributors.some(value => value < 0);
    const hasMixedContributors = hasPositiveContributor && hasNegativeContributor;

    return {
        breakdown,
        badgeToneClass: hasMixedContributors
            ? 'bg-amber-700'
            : effectivePower > minion.basePower
                ? 'bg-green-600'
                : effectivePower < minion.basePower
                    ? 'bg-red-600'
                    : 'bg-slate-700',
        badgeLabel: hasMixedContributors
            ? String(breakdown.finalPower)
            : effectivePower === minion.basePower
                ? String(effectivePower)
                : `${effectivePower > minion.basePower ? '+' : ''}${effectivePower - minion.basePower}`,
    };
}

// ============================================================================
// Base Zone: The "Battlefield"
// ============================================================================

export const BaseZone: React.FC<{
    base: BaseInPlay;
    baseIndex: number;
    core: SmashUpCore;
    turnOrder: string[];
    playerNames?: Record<string, string>;
    isMobileViewport?: boolean;
    isDeployMode: boolean;
    isMinionSelectMode?: boolean;
    /** 交互驱动的随从选择：只有这些 UID 的随从可被选中 */
    selectableMinionUids?: Set<string>;
    /** 多选随从模式：已选中的随从 UID 集合 */
    multiSelectedMinionUids?: Set<string>;
    /** 当前正在决斗的随从 UID 集合 */
    duelParticipantMinionUids?: Set<string>;
    /** 埋葬牌选择模式：场上的埋葬牌直接进入可点交互 */
    isBuriedSelectMode?: boolean;
    /** 埋葬牌选择模式：只有这些 UID 的埋葬牌可被选中 */
    selectableBuriedCardUids?: Set<string>;
    /** 多选埋葬牌模式：已选中的埋葬牌 UID 集合 */
    multiSelectedBuriedCardUids?: Set<string>;
    /** 基地选择交互模式：该基地可被直接点击选中 */
    isSelectable?: boolean;
    /** 选择模式下该基地不可选（置灰） */
    isDimmed?: boolean;
    /** 交互驱动的持续行动卡选择：只有这些 UID 的行动卡可被选中 */
    selectableOngoingUids?: Set<string>;
    /** 多选持续行动模式：已选中的行动卡 UID 集合 */
    multiSelectedOngoingUids?: Set<string>;
    isMyTurn: boolean;
    myPlayerId: string | null;
    dispatch: (type: string, payload?: unknown) => void;
    onClick: () => void;
    onMinionSelect?: (minionUid: string, baseIndex: number) => void;
    onOngoingSelect?: (ongoingUid: string) => void;
    onBuriedCardSelect?: (cardUid: string) => void;
    onViewMinion: (defId: string, options?: { overlayDefId?: string }) => void;
    onViewAction: (defId: string) => void;
    onViewBase: (defId: string) => void;
    onViewTitan: (defId: string) => void;
    usableMinionTalentUids?: Set<string>;
    usableSpecialMinionUids?: Set<string>;
    usableOngoingTalentUids?: Set<string>;
    usableTitanTalentUids?: Set<string>;
    usableTitanOngoingUids?: Set<string>;
    reactionTitanTriggerUids?: Set<string>;
    onResolveTitanReaction?: (titanUid: string) => void;
    defeatableMonsterUids?: Set<string>;
    onDefeatMonster?: (baseIndex: number, monsterUid: string) => void;
    canUseBaseAbility?: boolean;
    tokenRef?: (el: HTMLDivElement | null) => void;
}> = ({ base, baseIndex, core, turnOrder, playerNames, isMobileViewport = false, isDeployMode, isMinionSelectMode, selectableMinionUids, multiSelectedMinionUids, duelParticipantMinionUids, isBuriedSelectMode, selectableBuriedCardUids, multiSelectedBuriedCardUids, isSelectable, isDimmed, selectableOngoingUids, multiSelectedOngoingUids, isMyTurn, myPlayerId, dispatch, onClick, onMinionSelect, onOngoingSelect, onBuriedCardSelect, onViewMinion, onViewAction, onViewBase, onViewTitan, usableMinionTalentUids, usableSpecialMinionUids, usableOngoingTalentUids, usableTitanTalentUids, usableTitanOngoingUids, reactionTitanTriggerUids, onResolveTitanReaction, defeatableMonsterUids, onDefeatMonster, canUseBaseAbility = false, tokenRef }) => {
    const { t } = useTranslation('game-smashup');
    const { selectedFactions } = useSmashUpOverlay();
    const [expandedMinionUid, setExpandedMinionUid] = React.useState<string | null>(null);
    const [floatingAttachedMinionUid, setFloatingAttachedMinionUid] = React.useState<string | null>(null);
    
    // 响应式布局配置
    const playerCount = turnOrder.length;
    const layout = getLayoutConfig(playerCount, { isMobileViewport });
    
    const baseDef = getBaseDef(base.defId);
    const resolvedBaseDefId = baseDef ? getBasePodVariantId(baseDef, selectedFactions) : base.defId;
    const localizedBaseDef = getBaseDef(resolvedBaseDefId) ?? baseDef;
    const baseName = localizedBaseDef ? (resolveCardName(localizedBaseDef, t) || resolvedBaseDefId) : base.defId;
    const totalPower = getTotalEffectivePowerOnBase(core, base, baseIndex);
    const breakpoint = getEffectiveBreakpoint(core, baseIndex);
    const ratio = totalPower / breakpoint;
    const isNearBreak = ratio >= 0.8 && ratio < 1;
    const isAtBreak = ratio >= 1;
    const powerTokenContainerClassName = isMobileViewport
        ? 'absolute -top-[1.05vw] -right-[1.05vw] w-[4vw] h-[4vw] pointer-events-none z-30 flex items-center justify-center'
        : 'absolute -top-[1.5vw] -right-[1.5vw] w-[4vw] h-[4vw] pointer-events-none z-30 flex items-center justify-center';
    const powerTokenLabelClassName = isMobileViewport
        ? 'absolute -bottom-[0.28vw] bg-white text-slate-900 text-[0.6vw] font-bold px-[0.4vw] py-[0.1vw] rounded shadow-sm border border-slate-300 whitespace-nowrap'
        : 'absolute -bottom-[0.5vw] bg-white text-slate-900 text-[0.6vw] font-bold px-[0.4vw] py-[0.1vw] rounded shadow-sm border border-slate-300 whitespace-nowrap';
    const titansOnBase = getTitansOnBase(core, baseIndex);
    const ongoingActions = base.ongoingActions ?? [];
    const monstersOnBase = base.monsters ?? [];
    const hasOngoingRow = ongoingActions.length > 0;
    const titanCardWidth = titansOnBase.length > 1
        ? Math.max(layout.minionCardWidth - 0.4, layout.ongoingCardWidth + 1.2)
        : layout.minionCardWidth;
    const titanCardHeight = titanCardWidth / 0.714;
    const titanRowGap = titansOnBase.length > 1 ? 0.3 : 0.45;
    const titanRowWidth = titansOnBase.length * titanCardWidth + Math.max(titansOnBase.length - 1, 0) * titanRowGap;
    const ongoingCardHeight = layout.ongoingCardWidth / 0.714;
    const titanExcessHeightOverOngoing = hasOngoingRow
        ? Math.max(titanCardHeight - ongoingCardHeight, 0)
        : 0;
    const titanRowTop = hasOngoingRow
        // 让泰坦围绕持续行动行的中线展开，而不是仅按底边对齐。
        // 这样单泰坦即使被抬到基地上方，也不会因为上方留白过多而显得更小。
        ? -(layout.ongoingTopOffset + titanExcessHeightOverOngoing / 2)
        : -(titanCardHeight - 0.6);
    const hasTitanRail = titansOnBase.length > 0;
    const ongoingSplitIndex = hasTitanRail ? Math.ceil(ongoingActions.length / 2) : ongoingActions.length;
    const leftOngoingActions = ongoingActions.slice(0, ongoingSplitIndex);
    const rightOngoingActions = ongoingActions.slice(ongoingSplitIndex);
    const ongoingCardOverlap = Math.max(layout.ongoingCardWidth * 0.2, 0.4);
    const monsterCardWidth = Math.max(
        Math.min(layout.baseCardWidth * 0.42, layout.minionCardWidth * 1.05),
        layout.minionCardWidth * 0.82,
    );
    const monsterCardHeight = monsterCardWidth / BASE_CARD_ASPECT_RATIO;
    const monsterVisibleSlice = monsterCardWidth * 0.42;
    const monsterCardOverlap = Math.max(monsterCardWidth - monsterVisibleSlice, 0);
    const titanSideContainerGap = Math.max(layout.ongoingCardWidth * 0.04, 0.08);
    const titanSideContainerAnchorOffset = titanRowWidth / 2 + titanSideContainerGap;
    const isBaseHighlighted = isSelectable || canUseBaseAbility || (isDeployMode && !isMinionSelectMode);
    const baseContainerClassName = isDimmed
        ? 'opacity-25 grayscale saturate-0 brightness-[0.72] contrast-75 cursor-not-allowed rotate-1 scale-[0.97]'
        : isBaseHighlighted
            ? 'cursor-pointer rotate-0 scale-[1.07]'
            : 'cursor-pointer rotate-1 hover:rotate-0';
    const baseCardFrameClassName = `relative w-full h-full bg-white p-[0.4vw] rounded-sm transition-[box-shadow] duration-300
        ${isSelectable
            ? 'shadow-[0_0_2.5vw_rgba(74,222,128,0.58)] ring-4 ring-green-400'
            : canUseBaseAbility
            ? 'shadow-[0_0_2vw_rgba(251,191,36,0.45)] ring-4 ring-amber-300'
            : isDeployMode && !isMinionSelectMode
            ? 'shadow-[0_0_2.6vw_rgba(16,185,129,0.72)] ring-4 ring-emerald-400'
            : 'shadow-sm group-hover/base:shadow-xl'
        }`;

    // 获取基地限制信息
    const restrictions = getBaseRestrictions(core, baseIndex);
    const {
        isCoarsePointer,
        showDesktopInspectButton,
        getTouchInspectProps: getBaseTouchInspectProps,
        shouldBlockInspectClick: shouldBlockBaseClick,
    } = useTouchInspectGesture<string, { defId: string }>({
        enabled: true,
        onInspect: (_key, payload) => {
            onViewBase(payload.defId);
        },
    });
    const {
        getTouchInspectProps: getOngoingTouchInspectProps,
        shouldBlockInspectClick: shouldBlockOngoingClick,
    } = useTouchInspectGesture<string, { defId: string }>({
        enabled: true,
        onInspect: (_key, payload) => {
            onViewAction(payload.defId);
        },
    });
    const {
        getTouchInspectProps: getTitanTouchInspectProps,
        shouldBlockInspectClick: shouldBlockTitanClick,
    } = useTouchInspectGesture<string, { defId: string }>({
        enabled: true,
        onInspect: (_key, payload) => {
            onViewTitan(payload.defId);
        },
    });
    const {
        getTouchInspectProps: getBuriedTouchInspectProps,
        shouldBlockInspectClick: shouldBlockBuriedClick,
    } = useTouchInspectGesture<string, { defId: string; cardType: 'minion' | 'action' }>({
        enabled: Boolean(base.buriedCards?.length),
        onInspect: (_key, payload) => {
            if (payload.cardType === 'minion') {
                onViewMinion(payload.defId);
                return;
            }
            onViewAction(payload.defId);
        },
    });

    // 分组
    React.useEffect(() => {
        if (expandedMinionUid && !base.minions.some((minion) => minion.uid === expandedMinionUid)) {
            setExpandedMinionUid(null);
        }
    }, [base.minions, expandedMinionUid]);

    const toggleExpandedMinion = useCallback((minionUid: string) => {
        setExpandedMinionUid((current) => current === minionUid ? null : minionUid);
    }, []);

    const isActivationKeyValid = useCallback((key: string) => {
        const isValidMinionKey = base.minions.some((minion) => `minion-${minion.uid}` === key);
        const isValidAttachedKey = base.minions.some((minion) => minion.attachedActions?.some((action) => `attached-${action.uid}` === key));
        const isValidBaseOngoingKey = base.ongoingActions?.some((action) => `ongoing-${action.uid}` === key) ?? false;
        const isValidTitanKey = titansOnBase.some((titan) => `titan-${titan.uid}` === key);

        return isValidMinionKey || isValidAttachedKey || isValidBaseOngoingKey || isValidTitanKey;
    }, [base.minions, base.ongoingActions, titansOnBase]);

    const {
        isArmed: isActivationArmed,
        setArmedKey,
        clearArmed: clearArmedActivation,
        armOrActivate,
    } = useArmedActivation<string>({
        requireArming: isCoarsePointer,
        isKeyValid: isActivationKeyValid,
        validationDeps: [base.minions, base.ongoingActions, titansOnBase],
    });

    const minionsByController = React.useMemo<Record<string, MinionOnBase[]>>(() => {
        const grouped: Record<string, MinionOnBase[]> = {};
        base.minions.forEach((minion) => {
            if (!grouped[minion.controller]) grouped[minion.controller] = [];
            grouped[minion.controller].push(minion);
        });
        return grouped;
    }, [base.minions]);

    const currentMinionUidSnapshot = React.useMemo<Record<string, Set<string>>>(() => (
        buildMinionUidSnapshotByController(turnOrder, minionsByController)
    ), [minionsByController, turnOrder]);

    const [previousMinionUidSnapshot, setPreviousMinionUidSnapshot] = React.useState<Record<string, Set<string>>>(
        currentMinionUidSnapshot,
    );

    const enteringMinionUidsByController = React.useMemo<Record<string, Set<string>>>(() => (
        resolveEnteringMinionUidsByController(turnOrder, currentMinionUidSnapshot, previousMinionUidSnapshot)
    ), [currentMinionUidSnapshot, previousMinionUidSnapshot, turnOrder]);

    React.useEffect(() => {
        setPreviousMinionUidSnapshot(currentMinionUidSnapshot);
    }, [currentMinionUidSnapshot]);

    const renderOngoingCard = (
        oa: NonNullable<BaseInPlay['ongoingActions']>[number],
        idx: number,
        isFirstInGroup = false,
    ) => {
        const actionDef = getCardDef(oa.defId);
        const actionName = resolveCardName(actionDef, t) || oa.defId;
        const actionText = resolveCardText(actionDef, t);
        const actionTitle = actionText ? `${actionName}\n${actionText}` : actionName;
        const ongoingControllerId = ((oa.metadata?.sourceControllerId as string | undefined) ?? oa.ownerId);
        const pConf = PLAYER_CONFIG[parseInt(ongoingControllerId) % PLAYER_CONFIG.length];
        const hasOngoingTalent = actionDef?.abilityTags?.includes('talent') ?? false;
        const canUseOngoingTalent = !!usableOngoingTalentUids?.has(oa.uid);
        const hasExtraTalentReady =
            oa.metadata?.mythicHorsesSeastarExtraTalent === true
            && oa.metadata?.mythicHorsesSeastarExtraTalentConsumed !== true;
        const ongoingActivationKey = `ongoing-${oa.uid}`;
        const isOngoingActivationArmed = isActivationArmed(ongoingActivationKey);
        const isSelectableOngoing = !!selectableOngoingUids?.has(oa.uid);
        const isMultiSelectedOngoing = !!multiSelectedOngoingUids?.has(oa.uid);
        const isDimmedOngoing = !!selectableOngoingUids && !selectableOngoingUids.has(oa.uid);
        const showUsedOngoingState = hasOngoingTalent && oa.talentUsed && !canUseOngoingTalent;
        const ongoingAccentHighlightActive =
            isMultiSelectedOngoing ||
            isSelectableOngoing ||
            isOngoingActivationArmed ||
            canUseOngoingTalent ||
            showUsedOngoingState;
        const ongoingAccessoryChromeClass = getAccessoryChromeClass(ongoingAccentHighlightActive, 'border-[0.1vw] border-white shadow-md');
        const ongoingPowerCounterSurfaceClass = getAccessorySurfaceClass(ongoingAccentHighlightActive, 'bg-amber-400', 'bg-gradient-to-br from-amber-300 to-amber-500');
        const showOngoingInspectButton = !isSelectableOngoing && (
            showDesktopInspectButton
            || (isCoarsePointer && isOngoingActivationArmed && !canUseOngoingTalent)
        );
        const ongoingPowerContribution = getOngoingCardPowerContribution({
            ...base,
            ongoingActions: [oa],
        }, ongoingControllerId);
        const ongoingPowerCounters = ((oa.metadata?.powerCounters as number) ?? 0);

        return (
            <div
                key={oa.uid}
                className="group relative"
                style={{
                    width: layoutInlineSize(layout.ongoingCardWidth, layout),
                    height: layoutCardHeight(layout.ongoingCardWidth, layout),
                    marginLeft: isFirstInGroup ? '0vw' : layoutInlineSize(-ongoingCardOverlap, layout),
                }}
            >
                <motion.div
                    data-ongoing-uid={oa.uid}
                    {...getOngoingTouchInspectProps(`ongoing-${oa.uid}`, { defId: oa.defId })}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (shouldBlockOngoingClick(`ongoing-${oa.uid}`)) return;
                        if (isSelectableOngoing && onOngoingSelect) {
                            clearArmedActivation();
                            onOngoingSelect(oa.uid);
                        } else if (canUseOngoingTalent) {
                            if (isCoarsePointer) {
                                armOrActivate(ongoingActivationKey, {
                                    onActivate: () => {
                                        dispatch(SU_COMMANDS.USE_TALENT, { ongoingCardUid: oa.uid, baseIndex });
                                    },
                                });
                            } else {
                                clearArmedActivation();
                                dispatch(SU_COMMANDS.USE_TALENT, { ongoingCardUid: oa.uid, baseIndex });
                            }
                        } else {
                            if (isCoarsePointer) {
                                armOrActivate(ongoingActivationKey, {
                                    onActivate: () => {
                                        onViewAction(oa.defId);
                                    },
                                });
                            } else {
                                clearArmedActivation();
                                onViewAction(oa.defId);
                            }
                        }
                    }}
                    className={`relative aspect-[0.714] w-full cursor-pointer
                        hover:z-50 hover:scale-125 hover:-translate-y-[0.3vw] transition-[transform,opacity,filter]
                        ${isDimmedOngoing ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                    style={{
                        height: '100%',
                        aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
                    }}
                    initial={{ y: 20, opacity: 0, scale: 0.6 }}
                    animate={isSelectableOngoing
                        ? { y: 0, opacity: 1, scale: 1, rotate: [-1, 1, -1], transition: { rotate: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } } }
                        : canUseOngoingTalent
                        ? { y: 0, opacity: 1, scale: 1, rotate: [-1, 1, -1], transition: { rotate: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } } }
                        : { y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 20, delay: idx * 0.06 }}
                >
                    <div
                        className={`relative h-full w-full bg-white rounded-[0.15vw] shadow-lg border-[0.12vw] ${
                            isDimmedOngoing
                                ? 'cursor-not-allowed'
                                : isMultiSelectedOngoing
                                ? 'border-green-400 ring-4 ring-green-400 shadow-[0_0_18px_rgba(74,222,128,0.72),0_0_36px_rgba(74,222,128,0.34)]'
                                : isSelectableOngoing
                                ? 'border-green-400 ring-2 ring-green-400 shadow-[0_0_15px_rgba(74,222,128,0.52)]'
                                : isOngoingActivationArmed
                                ? 'border-amber-300 ring-4 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.75)]'
                                : canUseOngoingTalent
                                ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                                : showUsedOngoingState
                                ? USED_STATE_CLASS
                                : `${pConf.border} ${pConf.shadow}`
                        }`}
                    >
                        <div className="w-full h-full overflow-hidden rounded-[0.1vw]">
                            <CardPreview
                                previewRef={actionDef?.previewRef
                                    ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: oa.defId, cardUid: oa.uid } }
                                    : undefined}
                                className="w-full h-full"
                                title={actionTitle}
                            />
                        </div>
                        {canUseOngoingTalent && (
                            <motion.div
                                className="absolute inset-0 pointer-events-none z-20 rounded-[0.1vw]"
                                animate={{ opacity: [0.3, 0.7, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                style={{ background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.4) 0%, transparent 70%)' }}
                            />
                        )}
                    </div>
                    {ongoingPowerContribution > 0 && (
                        <div
                            data-testid={`su-base-ongoing-power-badge-${oa.uid}`}
                            className={`absolute -top-[0.3vw] -left-[0.3vw] min-w-[1.1vw] h-[1.1vw] rounded-full flex items-center justify-center text-[0.55vw] font-black text-white bg-green-600 ${ongoingAccessoryChromeClass} z-40 px-[0.08vw]`}
                            title={`力量增加 +${ongoingPowerContribution}`}
                        >
                            +{ongoingPowerContribution}
                        </div>
                    )}
                    {ongoingPowerCounters > 0 && (
                        <div
                            data-testid={`su-base-ongoing-power-counter-${oa.uid}`}
                            className={`absolute min-w-[1.1vw] h-[1.1vw] rounded-full flex items-center justify-center text-[0.5vw] font-black text-amber-900 ${ongoingPowerCounterSurfaceClass} ${ongoingAccessoryChromeClass} z-40 px-[0.08vw] ${
                                ongoingPowerContribution > 0 ? 'top-[0.92vw] -left-[0.3vw]' : '-top-[0.3vw] -right-[0.3vw]'
                            }`}
                            title={`+1${t('ui.power_counter')} x${ongoingPowerCounters}`}
                        >
                            +{ongoingPowerCounters}
                        </div>
                    )}
                    {hasOngoingTalent && oa.talentUsed && (
                        <UsedStateBadge
                            label={t('ui.talent_used')}
                            compact
                            insetClassName="left-[0.12vw] right-[0.12vw]"
                            muteStroke={ongoingAccentHighlightActive}
                            testId={`su-base-ongoing-used-badge-${oa.uid}`}
                        />
                    )}
                    {hasExtraTalentReady && (
                        <TopStateBadge
                            label={t('ui.extra_talent_ready')}
                            compact
                            insetClassName="left-[0.12vw] right-[0.12vw]"
                            muteStroke={ongoingAccentHighlightActive}
                            testId={`su-base-ongoing-extra-talent-badge-${oa.uid}`}
                        />
                    )}
                </motion.div>
                {showOngoingInspectButton && (
                    <div
                        className={isCoarsePointer
                            ? 'absolute inset-0 z-60'
                            : 'absolute inset-0 z-60 pointer-events-none transition-transform duration-200 group-hover:scale-125 group-hover:-translate-y-[0.3vw]'}
                    >
                        <button
                            type="button"
                            data-testid={`su-base-ongoing-magnify-${oa.uid}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                clearArmedActivation();
                                onViewAction(oa.defId);
                            }}
                            className={isCoarsePointer
                                ? 'absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-100 pointer-events-auto shadow-lg hover:bg-amber-500/80 cursor-zoom-in'
                                : 'absolute top-[0.15vw] right-[0.15vw] flex h-[1.4vw] w-[1.4vw] items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-lg transition-[opacity,background-color] duration-200 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-amber-500/80 cursor-zoom-in'}
                        >
                            <svg
                                className={isCoarsePointer ? 'h-4 w-4 fill-current' : 'h-[0.8vw] w-[0.8vw] fill-current'}
                                viewBox="0 0 20 20"
                            >
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderTitanCard = (titan: (typeof titansOnBase)[number], idx: number, delay: number) => {
        const titanDef = getTitanDef(titan.defId);
        const titanName = resolveCardName(titanDef, t) || titan.defId;
        const titanText = resolveCardText(titanDef, t);
        const titanTitle = titanText ? `${titanName}\n${titanText}` : titanName;
        const showTitanInspectButton = showDesktopInspectButton || isCoarsePointer;
        const pConf = PLAYER_CONFIG[parseInt(titan.controllerId) % PLAYER_CONFIG.length];
        const canUseTitanTalent = !!usableTitanTalentUids?.has(titan.uid);
        const canUseTitanOngoing = !!usableTitanOngoingUids?.has(titan.uid);
        const canUseTitanReaction = !!reactionTitanTriggerUids?.has(titan.uid);
        const hasMultipleTitanActivations = canUseTitanTalent && canUseTitanOngoing;
        const canActivateTitan = canUseTitanReaction || canUseTitanTalent || canUseTitanOngoing;
        const timeBoxCounterLabel = getTimeBoxCounterLabel(titan);

        const titanActivationKey = `titan-${titan.uid}`;
        const isTitanActivationArmed = isActivationArmed(titanActivationKey);
        const showUsedTitanState = titan.talentUsed && !canActivateTitan;
        const titanAccentHighlightActive = isTitanActivationArmed || canActivateTitan || showUsedTitanState;
        const titanAccessoryChromeClass = getAccessoryChromeClass(titanAccentHighlightActive, 'border-[0.1vw] border-white shadow-md');
        const titanTimeboxSurfaceClass = getAccessorySurfaceClass(titanAccentHighlightActive, 'bg-sky-300', 'bg-gradient-to-br from-cyan-200 to-sky-400');
        const titanPowerCounterSurfaceClass = getAccessorySurfaceClass(titanAccentHighlightActive, 'bg-amber-400', 'bg-gradient-to-br from-amber-300 to-amber-500');
        const titanFrameClassName = `relative aspect-[0.714] w-full cursor-pointer rounded-[0.18vw] border-[0.12vw] bg-white shadow-lg origin-bottom transition-[transform,box-shadow,filter,opacity] duration-200 ${
            isCoarsePointer ? '' : 'hover:scale-110 hover:-translate-y-[0.12vw]'
        } ${
            isTitanActivationArmed
                ? 'border-amber-300 ring-4 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.75)]'
                : canActivateTitan
                ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                : showUsedTitanState
                ? USED_STATE_CLASS
                : `${pConf.border} ${pConf.shadow}`}`;

        return (
            <div
                key={titan.uid}
                className="group relative hover:!z-[999]"
                style={{
                    width: layoutInlineSize(titanCardWidth, layout),
                    height: layoutCardHeight(titanCardWidth, layout),
                }}
            >
            <motion.div
                data-titan-uid={titan.uid}
                data-testid={`su-base-titan-${titan.uid}`}
                {...getTitanTouchInspectProps(`titan-${titan.uid}`, { defId: titan.defId })}
                onClick={(e) => {
                    e.stopPropagation();
                    if (shouldBlockTitanClick(`titan-${titan.uid}`)) return;
                    if (canUseTitanReaction) {
                        clearArmedActivation();
                        onResolveTitanReaction?.(titan.uid);
                        return;
                    }
                    if (hasMultipleTitanActivations) {
                        if (!isCoarsePointer) {
                            setArmedKey((current) => current === titanActivationKey ? null : titanActivationKey);
                            return;
                        }
                        armOrActivate(titanActivationKey, {
                            onActivate: () => undefined,
                        });
                        return;
                    }
                    if (canUseTitanTalent) {
                        if (isCoarsePointer) {
                            armOrActivate(titanActivationKey, {
                                onActivate: () => {
                                    dispatch(SU_COMMANDS.USE_TALENT, { titanUid: titan.uid, baseIndex });
                                },
                            });
                            return;
                        }
                        clearArmedActivation();
                        dispatch(SU_COMMANDS.USE_TALENT, { titanUid: titan.uid, baseIndex });
                        return;
                    }
                    if (canUseTitanOngoing) {
                        if (isCoarsePointer) {
                            armOrActivate(titanActivationKey, {
                                onActivate: () => {
                                    dispatch(SU_COMMANDS.ACTIVATE_TITAN_ONGOING, { titanUid: titan.uid, baseIndex });
                                },
                            });
                            return;
                        }
                        clearArmedActivation();
                        dispatch(SU_COMMANDS.ACTIVATE_TITAN_ONGOING, { titanUid: titan.uid, baseIndex });
                        return;
                    }
                    clearArmedActivation();
                    onViewTitan(titan.defId);
                }}
                className={titanFrameClassName}
                style={{
                    height: '100%',
                    aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
                }}
                initial={{ y: 20, opacity: 0, scale: 0.7 }}
                animate={canActivateTitan
                    ? { y: 0, opacity: 1, scale: 1, rotate: [-1, 1, -1], transition: { rotate: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } } }
                    : { y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 22, delay }}
            >
                <div className="w-full h-full overflow-hidden rounded-[0.1vw]">
                    <CardPreview
                        previewRef={titanDef?.previewRef
                            ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: titan.defId, cardUid: titan.uid } }
                            : undefined}
                        className="w-full h-full"
                        title={titanTitle}
                    />
                </div>
                {canActivateTitan && (
                    <motion.div
                        className="absolute inset-0 pointer-events-none z-20 rounded-[0.1vw]"
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.4) 0%, transparent 70%)' }}
                    />
                )}
                {canUseTitanReaction && (
                    <div className="absolute bottom-[0.18vw] left-[0.12vw] right-[0.12vw] z-30 flex justify-center pointer-events-none">
                        <div className={`rounded ${getAccessorySurfaceClass(titanAccentHighlightActive, 'bg-emerald-300', 'bg-emerald-300/95')} px-[0.28vw] py-[0.08vw] text-[0.42vw] font-black text-emerald-950 ${getAccessoryChromeClass(titanAccentHighlightActive, 'border border-white shadow-md')}`}>
                            {t('ui.titan_reaction_available')}
                        </div>
                    </div>
                )}
                {hasMultipleTitanActivations && isTitanActivationArmed && (
                    <div className="absolute -top-[1.45vw] left-1/2 z-50 flex -translate-x-1/2 gap-[0.18vw]">
                        <button
                            type="button"
                            className="rounded bg-amber-100 px-[0.28vw] py-[0.08vw] text-[0.42vw] font-black text-amber-900 shadow border border-amber-300"
                            onClick={(event) => {
                                event.stopPropagation();
                                clearArmedActivation();
                                dispatch(SU_COMMANDS.ACTIVATE_TITAN_ONGOING, { titanUid: titan.uid, baseIndex });
                            }}
                        >
                            {t('ui.ongoing_short')}
                        </button>
                        <button
                            type="button"
                            className="rounded bg-slate-100 px-[0.28vw] py-[0.08vw] text-[0.42vw] font-black text-slate-900 shadow border border-slate-300"
                            onClick={(event) => {
                                event.stopPropagation();
                                clearArmedActivation();
                                dispatch(SU_COMMANDS.USE_TALENT, { titanUid: titan.uid, baseIndex });
                            }}
                        >
                            {t('ui.talent_short')}
                        </button>
                    </div>
                )}
                {titan.talentUsed && (
                    <UsedStateBadge
                        label={t('ui.talent_used')}
                        compact
                        insetClassName="left-[0.12vw] right-[0.12vw]"
                        muteStroke={titanAccentHighlightActive}
                        testId={`su-base-titan-used-badge-${titan.uid}`}
                    />
                )}
                {timeBoxCounterLabel && (
                    <div className="absolute inset-x-0 -top-[0.38vw] z-40 flex justify-center pointer-events-none">
                        <div
                            data-testid={`su-base-titan-timebox-counter-${titan.uid}`}
                            className={`min-w-[1.55vw] h-[1vw] rounded-full flex items-center justify-center gap-[0.1vw] text-[0.42vw] font-black leading-none text-sky-950 ${titanTimeboxSurfaceClass} ${titanAccessoryChromeClass} px-[0.18vw]`}
                            title={`时间盒子计数：${timeBoxCounterLabel}`}
                        >
                            <span className="flex h-[0.52vw] w-[0.52vw] shrink-0 items-center justify-center">
                                <Hourglass aria-hidden className="block h-full w-full stroke-[3]" />
                            </span>
                            <span className="flex items-center justify-center leading-none tabular-nums">{timeBoxCounterLabel}</span>
                        </div>
                    </div>
                )}
                {titan.powerCounters > 0 && (
                    <div
                        data-testid={`su-base-titan-power-counter-${titan.uid}`}
                        className={`absolute -top-[0.3vw] -right-[0.3vw] min-w-[1.1vw] h-[1.1vw] rounded-full flex items-center justify-center text-[0.5vw] font-black text-amber-900 ${titanPowerCounterSurfaceClass} ${titanAccessoryChromeClass} z-40 px-[0.08vw]`}
                        title={`+1${t('ui.power_counter')} x${titan.powerCounters}`}
                    >
                        +{titan.powerCounters}
                    </div>
                )}
            </motion.div>
            {showTitanInspectButton && (
                <button
                    type="button"
                    data-testid={`su-base-titan-magnify-${titan.uid}`}
                    onClick={(event) => {
                        event.stopPropagation();
                        clearArmedActivation();
                        onViewTitan(titan.defId);
                    }}
                    className={isCoarsePointer
                        ? 'absolute top-1 right-1 z-60 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-100 pointer-events-auto shadow-lg hover:bg-amber-500/80 cursor-zoom-in'
                        : 'absolute top-[0.15vw] right-[0.15vw] z-60 flex h-[1.4vw] w-[1.4vw] items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-lg transition-[opacity,background-color] duration-200 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-amber-500/80 cursor-zoom-in'}
                >
                    <svg
                        className={isCoarsePointer ? 'h-4 w-4 fill-current' : 'h-[0.8vw] w-[0.8vw] fill-current'}
                        viewBox="0 0 20 20"
                    >
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
            </div>
        );
    };

    const renderMonsterCard = (
        monster: NonNullable<BaseInPlay['monsters']>[number],
        idx: number,
        total: number,
    ) => {
        const monsterDef = getMunchkinSpecialCardDescriptor(monster.defId);
        if (!monsterDef) return null;
        const controllerLabel = monster.controllerId !== undefined
            ? (playerNames?.[monster.controllerId] ?? `P${Number(monster.controllerId) + 1}`)
            : undefined;
        const canDefeatMonster = monster.controllerId === undefined && defeatableMonsterUids?.has(monster.uid) === true;
        const rotation = (idx - (total - 1) / 2) * 2.2;
        const title = controllerLabel ? `${monsterDef.name} · ${controllerLabel}` : monsterDef.name;
        const monsterCard = (
            <div className={`relative h-full w-full overflow-hidden rounded-[0.18vw] border-[0.1vw] bg-slate-900 shadow-md transition-[box-shadow,filter] duration-200 ${
                canDefeatMonster
                    ? 'border-emerald-300/90 shadow-[0_0_16px_rgba(52,211,153,0.55)] group-hover:shadow-[0_0_22px_rgba(52,211,153,0.78)]'
                    : 'border-amber-200/70 group-hover:shadow-[0_0_14px_rgba(251,191,36,0.45)]'
            }`}>
                <CardPreview
                    previewRef={monsterDef.previewRef}
                    className="h-full w-full"
                    title={title}
                />
            </div>
        );

        return (
            <div
                key={monster.uid}
                data-testid={`su-base-monster-${monster.uid}`}
                data-monster-uid={monster.uid}
                data-monster-controller-id={monster.controllerId}
                data-defeatable-monster={canDefeatMonster ? 'true' : undefined}
                className={`group relative transition-[transform,filter] duration-200 hover:z-40 hover:-translate-y-[0.2vw] ${canDefeatMonster ? 'cursor-pointer' : 'cursor-default'}`}
                style={{
                    width: layoutInlineSize(monsterCardWidth, layout),
                    height: layoutInlineSize(monsterCardHeight, layout),
                    marginLeft: idx === 0 ? '0vw' : layoutInlineSize(-monsterCardOverlap, layout),
                    transform: `rotate(${rotation}deg)`,
                }}
                title={title}
            >
                {canDefeatMonster ? (
                    <button
                        type="button"
                        aria-label={`击败${monsterDef.name}`}
                        className="block h-full w-full rounded-[0.18vw] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                        onClick={(event) => {
                            event.stopPropagation();
                            onDefeatMonster?.(baseIndex, monster.uid);
                        }}
                    >
                        {monsterCard}
                    </button>
                ) : monsterCard}
                {controllerLabel && (
                    <div className="absolute -bottom-[0.25vw] left-1/2 z-30 h-[0.65vw] w-[0.65vw] -translate-x-1/2 rounded-full border border-white bg-emerald-400 shadow" />
                )}
            </div>
        );
    };

    return (
        <div 
            className="relative flex flex-col items-center group/base"
            style={{
                alignSelf: 'flex-start',
                marginLeft: layoutInlineSize(layout.baseGap / 2, layout),
                marginRight: layoutInlineSize(layout.baseGap / 2, layout),
            }}
        >
            <div className="relative flex flex-col items-center" style={{ width: layoutInlineSize(layout.baseCardWidth, layout) }}>
            {/* --- ONGOING EFFECTS (above base card, absolute positioned) --- */}
            {hasOngoingRow && !hasTitanRail && (
                <div 
                    className="absolute left-0 flex items-end gap-0 z-30"
                    style={{ top: layoutInlineSize(-layout.ongoingTopOffset, layout) }}
                >
                    {ongoingActions.map((oa, idx) => renderOngoingCard(oa, idx, idx === 0))}
                </div>
            )}

            {hasOngoingRow && hasTitanRail && (
                <>
                    {leftOngoingActions.length > 0 && (
                        <div
                            className="absolute flex items-end gap-0 z-30"
                            style={{
                                top: layoutInlineSize(-layout.ongoingTopOffset, layout),
                                left: `calc(50% - ${layoutInlineSize(titanSideContainerAnchorOffset, layout)})`,
                                transform: 'translateX(-100%)',
                            }}
                        >
                            {leftOngoingActions.map((oa, idx) => renderOngoingCard(oa, idx, idx === 0))}
                        </div>
                    )}
                    {rightOngoingActions.length > 0 && (
                        <div
                            className="absolute flex items-end gap-0 z-30"
                            style={{
                                top: layoutInlineSize(-layout.ongoingTopOffset, layout),
                                left: `calc(50% + ${layoutInlineSize(titanSideContainerAnchorOffset, layout)})`,
                            }}
                        >
                            {rightOngoingActions.map((oa, idx) => renderOngoingCard(oa, leftOngoingActions.length + idx, idx === 0))}
                        </div>
                    )}
                </>
            )}

            {titansOnBase.length > 0 && (
                <div
                    className="absolute left-1/2 flex items-center z-40"
                    style={{
                        top: layoutInlineSize(titanRowTop, layout),
                        gap: layoutInlineSize(titanRowGap, layout),
                        transform: 'translateX(-50%)',
                    }}
                >
                    {titansOnBase.map((titan, idx) => renderTitanCard(titan, idx, idx * 0.05))}
                </div>
            )}

            {/* --- BASE CARD --- */}
            <div
                onClick={(event) => {
                    event.stopPropagation();
                    if (shouldBlockBaseClick(`base-${baseIndex}`)) {
                        return;
                    }
                    setExpandedMinionUid(null);
                    clearArmedActivation();
                    onClick();
                }}
                {...getBaseTouchInspectProps(`base-${baseIndex}`, { defId: base.defId })}
                ref={tokenRef}
                data-base-index={baseIndex}
                data-testid={`base-zone-${baseIndex}`}
                className={`relative aspect-[1.43] transition-all duration-300 z-20 ${baseContainerClassName}`}
                style={{
                    width: layoutInlineSize(layout.baseCardWidth, layout),
                    height: layoutCardHeight(layout.baseCardWidth, layout, BASE_CARD_ASPECT_RATIO),
                    aspectRatio: `${BASE_CARD_ASPECT_RATIO} / 1`,
                }}
            >
                <div
                    className={baseCardFrameClassName}
                    style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 2px, #fdfdfd 2px, #fdfdfd 4px)',
                    }}
                >
                    {/* Inner Art Area — AnimatePresence 实现基地替换过渡 */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={base.defId}
                            className="w-full h-full bg-slate-200 border border-slate-300 overflow-hidden relative"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                        >
                        <CardPreview
                            previewRef={{ type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: resolvedBaseDefId } }}
                            className="w-full h-full"
                            title={baseName}
                        />
                        </motion.div>
                    </AnimatePresence>

                    {/* 基地可选时的脉冲发光叠层 */}
                    {isSelectable && (
                        <motion.div
                            className="absolute inset-0 pointer-events-none z-25 rounded-sm"
                            animate={{ opacity: [0.1, 0.3, 0.1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)' }}
                        />
                    )}

                    {canUseBaseAbility && !isSelectable && (
                        <motion.div
                            className="absolute inset-0 pointer-events-none z-25 rounded-sm"
                            animate={{ opacity: [0.08, 0.24, 0.08] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.32) 0%, transparent 72%)' }}
                        />
                    )}

                    {isDeployMode && !isMinionSelectMode && !isSelectable && !canUseBaseAbility && (
                        <motion.div
                            className="absolute inset-0 pointer-events-none z-25 rounded-sm"
                            animate={{ opacity: [0.12, 0.28, 0.12] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.34) 0%, transparent 70%)' }}
                        />
                    )}

                </div>

                {/* 放大镜按钮保持悬浮在卡框外层，避免被基地高亮描边吞进去 */}
                {showDesktopInspectButton && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onViewBase(base.defId); }}
                        className="absolute top-[0.6vw] left-[0.6vw] w-[1.6vw] h-[1.6vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 pointer-events-none group-hover/base:opacity-100 group-hover/base:pointer-events-auto transition-[opacity,background-color] duration-200 shadow-lg z-30 cursor-zoom-in"
                    >
                        <svg className="w-[0.9vw] h-[0.9vw] fill-current" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}

                {canUseBaseAbility && (
                    <div className="absolute bottom-[0.45vw] inset-x-0 z-30 flex justify-center px-[0.3vw] pointer-events-none">
                        <div
                            data-testid={`base-ability-badge-${baseIndex}`}
                            className="bg-amber-300/95 text-slate-900 text-[0.55vw] font-black px-[0.42vw] py-[0.08vw] rounded-sm shadow-md border border-white whitespace-nowrap"
                        >
                            {t('ui.base_ability')}
                        </div>
                    </div>
                )}

                {/* Power Token */}
                <div
                    className={powerTokenContainerClassName}
                    data-testid={`su-base-breakpoint-token-${baseIndex}`}
                >
                    <motion.div
                        className={`w-[3.5vw] h-[3.5vw] rounded-full flex items-center justify-center border-[0.2vw] border-dashed shadow-xl transform rotate-12 group-hover/base:scale-110 transition-transform ${isAtBreak
                            ? 'bg-green-600 border-green-300'
                            : isNearBreak
                                ? 'bg-amber-600 border-amber-300'
                                : 'bg-slate-900 border-white'
                            }`}
                        animate={
                            isAtBreak
                                ? { scale: [1, 1.15, 1], boxShadow: ['0 0 0px rgba(74,222,128,0)', '0 0 20px rgba(74,222,128,0.6)', '0 0 0px rgba(74,222,128,0)'] }
                                : isNearBreak
                                    ? { scale: [1, 1.06, 1] }
                                    : {}
                        }
                        transition={
                            isAtBreak
                                ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                                : isNearBreak
                                    ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                                    : {}
                        }
                    >
                        <div className={`text-[1.2vw] font-black ${isAtBreak ? 'text-white' : isNearBreak ? 'text-amber-100' : 'text-white'}`}>
                            {totalPower}
                        </div>
                        <div className={powerTokenLabelClassName}>
                            / {breakpoint}
                        </div>
                    </motion.div>
                </div>

                {/* 基地限制标识（右侧，从下往上排列） */}
                {restrictions.length > 0 && (
                    <div className="absolute bottom-[0.5vw] -right-[3vw] flex flex-col-reverse gap-[0.4vw] z-30">
                        {restrictions.map((restriction, idx) => {
                            if (restriction.type === 'blocked_faction') {
                                const factionMeta = getFactionMeta(restriction.displayText);
                                if (!factionMeta) return null;
                                const FactionIcon = factionMeta.icon;
                                return (
                                    <motion.div
                                        key={`${restriction.sourceDefId}-${idx}`}
                                        className="relative w-[2.8vw] h-[2.8vw] rounded-full bg-red-600/95 backdrop-blur-sm flex items-center justify-center shadow-lg border-[0.2vw] border-red-400"
                                        initial={{ scale: 0, rotate: -180, x: 20 }}
                                        animate={{ scale: 1, rotate: 0, x: 0 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: idx * 0.1 }}
                                        title={`${t(factionMeta.nameKey)} 派系随从不能打出到此基地`}
                                    >
                                        {/* 派系图标 */}
                                        <FactionIcon className="w-[1.5vw] h-[1.5vw] text-white" strokeWidth={2.5} />
                                        {/* 斜杠 */}
                                        <svg className="absolute inset-0 w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </motion.div>
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </div>
            </div>

            {monstersOnBase.length > 0 && (
                <div
                    data-testid={`su-base-monster-row-${baseIndex}`}
                    className="relative z-10 mt-[0.35vw] mb-[0.2vw] flex items-center justify-center"
                    style={{
                        width: layoutInlineSize(layout.baseCardWidth, layout),
                        minHeight: layoutInlineSize(monsterCardHeight, layout),
                    }}
                >
                    {monstersOnBase.map((monster, idx) => renderMonsterCard(monster, idx, monstersOnBase.length))}
                </div>
            )}


            {/* --- PLAYER COLUMNS CONTAINER --- */}
            <div 
                className="flex items-start justify-center w-full pt-[0.5vw]"
                style={{ gap: layoutInlineSize(layout.playerColumnGap, layout) }}
            >
                {turnOrder.map(pid => {
                    const minions = minionsByController[pid] || [];
                    const hasExpandedMinionInColumn = minions.some((minion) => minion.uid === expandedMinionUid);
                    const hasFloatingAttachedMinionInColumn = minions.some((minion) => minion.uid === floatingAttachedMinionUid);

                    // 个人总力量口径必须走统一计算入口，避免漏掉“只影响控制者总力量、不影响基地总力量”的持续效果。
                    const total = getPlayerEffectivePowerOnBase(core, base, baseIndex, pid);
                    const basePowerTotal = minions.reduce((sum, m) => sum + m.basePower, 0);
                    const modifierDelta = total - basePowerTotal;

                    const pConf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];

                    return (
                        <motion.div
                            key={pid}
                            // 不要对整列做尺寸缩放动画。
                            // 随从自身已有 initial/animate 入场，叠加父层 full layout 会让新卡像是在开头反复放大。
                            layout="position"
                            data-testid={`su-base-player-column-${baseIndex}-${pid}`}
                            data-player-id={pid}
                            className={`flex flex-col items-center relative ${hasExpandedMinionInColumn || hasFloatingAttachedMinionInColumn ? 'z-[1400]' : 'z-0'}`}
                            style={{ minWidth: layoutInlineSize(layout.minionCardWidth, layout) }}
                            transition={{ layout: { duration: 0.22, ease: 'easeOut' } }}
                        >

                            {/* --- MINIONS + BURIED CARDS --- */}
                            <motion.div
                                layout="position"
                                data-testid={`su-base-stack-${baseIndex}-${pid}`}
                                className={`flex flex-col items-center isolate ${hasExpandedMinionInColumn || hasFloatingAttachedMinionInColumn ? 'z-[1400]' : 'z-10 hover:z-[100]'}`}
                                transition={{ layout: { duration: 0.22, ease: 'easeOut' } }}
                            >
                                {(minions.length > 0 || (base.buriedCards?.some((buried) => buried.controllerId === pid) ?? false)) ? (
                                    <>
                                    {(() => {
                                        const buriedCards = (base.buriedCards ?? []).filter((buried) => buried.controllerId === pid);
                                        const buriedCardWidth = Math.max(layout.minionCardWidth * 0.92, 2.6);
                                        const buriedVisibleSlice = Math.max(buriedCardWidth * 0.1, 0.32);
                                        const buriedStackOffset = -(buriedCardWidth - buriedVisibleSlice);
                                        const buriedToMinionOffset = Math.max(layout.minionStackOffset * 0.32, -1.9);
                                        return buriedCards.length > 0 ? (
                                            <div
                                                className="flex flex-col items-center"
                                                data-buried-count={buriedCards.length}
                                            >
                                                {buriedCards.map((buried, index) => {
                                                    const buriedDef = buried.defId === 'buried_unknown' ? undefined : getCardDef(buried.defId);
                                                    const buriedInspectPayload = buriedDef
                                                        ? {
                                                            defId: buried.defId,
                                                            cardType: buriedDef.type === 'minion' ? 'minion' as const : 'action' as const,
                                                        }
                                                        : undefined;
                                                    const buriedInspectKey = `buried-${buried.uid}`;
                                                    const buriedOwnerName = playerNames?.[buried.controllerId] ?? `P${Number(buried.controllerId) + 1}`;
                                                    const buriedTitle = buriedDef
                                                        ? `${resolveCardName(buriedDef, t) || buried.defId}\n${resolveCardText(buriedDef, t) || ''}`.trim()
                                                        : `${t('ui.card_placeholder')} · ${buriedOwnerName}`;
                                                    const isBuriedSelectable = !!isBuriedSelectMode && !!selectableBuriedCardUids?.has(buried.uid);
                                                    const isBuriedSelected = !!multiSelectedBuriedCardUids?.has(buried.uid);
                                                    const isBuriedDimmed = !!isBuriedSelectMode && !isBuriedSelectable && !isBuriedSelected;
                                                    const buriedPreviewRef = isBuriedSelectMode && buriedDef
                                                        ? {
                                                            type: 'renderer' as const,
                                                            rendererId: 'smashup-card-renderer',
                                                            payload: { defId: buried.defId, cardUid: buried.uid },
                                                        }
                                                        : SMASHUP_CARD_BACK;
                                                    return (
                                                        <div
                                                            key={buried.uid}
                                                            className="group relative"
                                                            style={{
                                                                width: layoutInlineSize(buriedCardWidth, layout),
                                                                height: layoutCardHeight(buriedCardWidth, layout),
                                                                marginBottom: layoutInlineSize(index === buriedCards.length - 1 ? buriedToMinionOffset : buriedStackOffset, layout),
                                                                transform: `rotate(${(index % 2 === 0 ? -1 : 1) * 1.5}deg)`,
                                                            }}
                                                        >
                                                            <button
                                                                type="button"
                                                                data-buried-card-uid={buried.uid}
                                                                data-buried-selectable={isBuriedSelectable ? 'true' : 'false'}
                                                                data-buried-selected={isBuriedSelected ? 'true' : 'false'}
                                                                data-buried-face-up={isBuriedSelectMode && buriedDef ? 'true' : 'false'}
                                                                {...(buriedInspectPayload ? getBuriedTouchInspectProps(buriedInspectKey, buriedInspectPayload) : {})}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    if (shouldBlockBuriedClick(buriedInspectKey)) return;
                                                                    if (isBuriedSelectMode) {
                                                                        if (isBuriedSelectable) {
                                                                            onBuriedCardSelect?.(buried.uid);
                                                                        }
                                                                        return;
                                                                    }
                                                                    if (!buriedDef) return;
                                                                    if (buriedDef.type === 'minion') {
                                                                        onViewMinion(buried.defId);
                                                                        return;
                                                                    }
                                                                    onViewAction(buried.defId);
                                                                }}
                                                                title={buriedTitle}
                                                                className={`relative aspect-[0.714] w-full overflow-hidden rounded-[0.18vw] border-[0.12vw] shadow-md bg-slate-800 transition-[transform,box-shadow,opacity,filter,border-color] ${
                                                                    isBuriedSelected
                                                                        ? 'cursor-pointer border-amber-300 ring-4 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.75),0_0_36px_rgba(251,191,36,0.35)]'
                                                                        : isBuriedSelectable
                                                                            ? 'cursor-pointer border-amber-400 ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)] hover:scale-105'
                                                                            : isBuriedDimmed
                                                                                ? 'cursor-default border-slate-700 opacity-35 grayscale-[0.35] saturate-[0.75]'
                                                                                : 'cursor-pointer border-slate-500'
                                                                }`}
                                                                style={{
                                                                    height: '100%',
                                                                    aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
                                                                }}
                                                            >
                                                                <CardPreview previewRef={buriedPreviewRef} className="w-full h-full" title={buriedTitle} />
                                                            </button>
                                                            {showDesktopInspectButton && buriedDef && (
                                                                <button
                                                                    type="button"
                                                                    aria-label={`查看${resolveCardName(buriedDef, t) || buried.defId}`}
                                                                    data-testid={`buried-inspect-${buried.uid}`}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        if (buriedDef.type === 'minion') {
                                                                            onViewMinion(buried.defId);
                                                                            return;
                                                                        }
                                                                        onViewAction(buried.defId);
                                                                    }}
                                                                    className="absolute top-[0.15vw] right-[0.15vw] z-40 flex h-[1.25vw] w-[1.25vw] items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-lg transition-[opacity,background-color] duration-200 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-amber-500/80 cursor-zoom-in"
                                                                >
                                                                    <svg className="h-[0.72vw] w-[0.72vw] fill-current" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : null;
                                    })()}
                                    {minions.map((m, i) => (
                                        <MinionCard
                                            key={m.uid}
                                            minion={m}
                                            effectivePower={getEffectivePower(core, m, baseIndex)}
                                            core={core}
                                            index={i}
                                            pid={pid}
                                            baseIndex={baseIndex}
                                            dispatch={dispatch}
                                            isMinionSelectMode={isMinionSelectMode}
                                            isMultiSelected={!!multiSelectedMinionUids?.has(m.uid)}
                                            isDuelParticipant={!!duelParticipantMinionUids?.has(m.uid)}
                                            isDimmed={!!isMinionSelectMode && !!selectableMinionUids && !selectableMinionUids.has(m.uid)}
                                            onMinionSelect={onMinionSelect}
                                            onView={() => onViewMinion(m.defId, { overlayDefId: getMinionBottomOverlayDefId(m) })}
                                            onViewAction={onViewAction}
                                            selectableOngoingUids={selectableOngoingUids}
                                            multiSelectedOngoingUids={multiSelectedOngoingUids}
                                            onOngoingSelect={onOngoingSelect}
                                            usableMinionTalentUids={usableMinionTalentUids}
                                            usableSpecialMinionUids={usableSpecialMinionUids}
                                            usableOngoingTalentUids={usableOngoingTalentUids}
                                            isExpanded={expandedMinionUid === m.uid}
                                            onToggleExpanded={toggleExpandedMinion}
                                            onExpandMinion={setExpandedMinionUid}
                                            onAttachedOverlayVisibilityChange={(visible) => {
                                                setFloatingAttachedMinionUid((current) => {
                                                    if (visible) return m.uid;
                                                    return current === m.uid ? null : current;
                                                });
                                            }}
                                            isActivationArmed={isActivationArmed}
                                            clearArmedActivation={clearArmedActivation}
                                            armOrActivate={armOrActivate}
                                            isMobileViewport={isMobileViewport}
                                            layout={layout}
                                            turnOrder={turnOrder}
                                            isCoarsePointer={isCoarsePointer}
                                            shouldAnimateEntry={enteringMinionUidsByController[pid]?.has(m.uid) ?? false}
                                        />
                                    ))}
                                    </>
                                ) : (
                                    /* Empty Placeholder for Layout Stability */
                                    <div
                                        data-testid={`su-base-empty-slot-${baseIndex}-${pid}`}
                                        className={`h-[2vw] rounded-sm border md-2 border-dashed border-slate-300/30 ${isDeployMode && isMyTurn ? 'animate-pulse bg-white/5' : ''}`}
                                        style={{ width: layoutInlineSize(layout.minionCardWidth, layout) }}
                                    >
                                        {isDeployMode && isMyTurn && myPlayerId === pid && minions.length === 0 && (
                                            <div className="w-full h-full flex items-center justify-center text-white/50 text-[0.8vw]">+</div>
                                        )}
                                    </div>
                                )}
                            </motion.div>

                            {/* --- SCORE (POWER) --- */}
                            <motion.div
                                layout="position"
                                data-testid={`su-base-score-${baseIndex}-${pid}`}
                                className="mt-2 flex items-center justify-center gap-1 z-10 bg-slate-900/40 rounded-full px-2 py-0.5 backdrop-blur-sm"
                                transition={{ layout: { duration: 0.22, ease: 'easeOut' } }}
                            >
                                <div className={`w-[0.6vw] h-[0.6vw] rounded-full ${pConf.bg}`} />
                                <span className={`text-[0.7vw] font-black leading-none ${modifierDelta > 0 ? 'text-green-300' :
                                    modifierDelta < 0 ? 'text-red-300' :
                                        'text-white'
                                    }`}>
                                    {total}
                                </span>
                            </motion.div>

                        </motion.div>
                    );
                })}
            </div>

        </div>
    );
};

// ============================================================================
// Minion Card
// ============================================================================

// ============================================================================
// 附着行动卡角标 + 悬浮预览
// ============================================================================

/** 附着行动卡角标（纯视觉提示，不含交互） */
const AttachedBadge: React.FC<{ count: number; muteStroke?: boolean }> = ({ count, muteStroke = false }) => (
    <div
        className="absolute -top-[8%] -right-[8%] w-[24%] pointer-events-none z-30"
        style={{ height: 0, paddingTop: '24%' }}
        data-testid="smashup-attached-badge-shell"
    >
        <div
            data-testid="smashup-attached-badge-face"
            className={`absolute inset-0 rounded-full bg-purple-600 ${getAccessoryChromeClass(muteStroke, 'border-2 border-white shadow-md')} flex items-center justify-center`}
        >
            <Paperclip className="h-[58%] w-[58%] text-white" strokeWidth={3} />
        </div>
        {count > 1 && (
            <div
                className="absolute -top-[14%] -right-[14%] w-[46%]"
                style={{ height: 0, paddingTop: '46%' }}
                data-testid="smashup-attached-badge-count-shell"
            >
                <span
                    data-testid="smashup-attached-badge-count-face"
                    className={`absolute inset-0 rounded-full bg-amber-400 text-[clamp(5px,0.3vw,8px)] font-black text-slate-900 flex items-center justify-center ${getAccessoryChromeClass(muteStroke, 'border border-white')}`}
                >
                    {count}
                </span>
            </div>
        )}
    </div>
);

const UsedStateBadge: React.FC<{ label: string; compact?: boolean; insetClassName?: string; muteStroke?: boolean; testId?: string }> = ({
    label,
    compact = false,
    insetClassName = 'inset-x-0',
    muteStroke = false,
    testId,
}) => (
    <div className={`absolute pointer-events-none z-40 flex justify-center ${insetClassName} ${compact ? 'bottom-[4%]' : 'bottom-[4.2%]'}`}>
        <div
            data-testid={testId}
            className={`whitespace-nowrap rounded-full ${getAccessoryChromeClass(muteStroke, 'border border-white/90 shadow-[0_2px_8px_rgba(15,23,42,0.45)]')} ${getAccessorySurfaceClass(muteStroke, 'bg-slate-700', 'bg-slate-700/96')} text-white ${
                compact
                    ? 'min-w-[34%] px-[10%] py-[3%] text-[clamp(9px,0.5vw,12px)] font-black leading-none text-center'
                    : 'min-w-[38%] px-[12%] py-[4%] text-[clamp(10px,0.58vw,14px)] font-black leading-none text-center'
            }`}
        >
            {label}
        </div>
    </div>
);

const TopStateBadge: React.FC<{ label: string; compact?: boolean; insetClassName?: string; muteStroke?: boolean; testId?: string }> = ({
    label,
    compact = false,
    insetClassName = 'inset-x-0',
    muteStroke = false,
    testId,
}) => (
    <div className={`absolute pointer-events-none z-40 flex justify-center ${insetClassName} ${compact ? 'top-[4%]' : 'top-[4.2%]'}`}>
        <div
            data-testid={testId}
            className={`whitespace-nowrap rounded-full ${getAccessoryChromeClass(muteStroke, 'border border-white/90 shadow-[0_2px_8px_rgba(15,23,42,0.45)]')} ${getAccessorySurfaceClass(muteStroke, 'bg-emerald-700', 'bg-emerald-700/96')} text-white ${
                compact
                    ? 'min-w-[34%] px-[10%] py-[3%] text-[clamp(9px,0.5vw,12px)] font-black leading-none text-center'
                    : 'min-w-[38%] px-[12%] py-[4%] text-[clamp(10px,0.58vw,14px)] font-black leading-none text-center'
            }`}
        >
            {label}
        </div>
    </div>
);

// ============================================================================
// Minion Card
// ============================================================================

const MinionCard: React.FC<{
    minion: MinionOnBase;
    effectivePower: number;
    core: SmashUpCore;
    index: number;
    pid: string;
    baseIndex: number;
    dispatch: (type: string, payload?: unknown) => void;
    isMinionSelectMode?: boolean;
    /** 多选随从模式下已选中 */
    isMultiSelected?: boolean;
    /** 当前随从处于决斗中 */
    isDuelParticipant?: boolean;
    /** 随从选择模式下该随从不可选（置灰） */
    isDimmed?: boolean;
    onMinionSelect?: (minionUid: string, baseIndex: number) => void;
    onView: () => void;
    onViewAction: (defId: string) => void;
    /** 交互驱动的持续行动卡选择：只有这些 UID 的行动卡可被选中 */
    selectableOngoingUids?: Set<string>;
    /** 多选持续行动模式：已选中的行动卡 UID 集合 */
    multiSelectedOngoingUids?: Set<string>;
    onOngoingSelect?: (ongoingUid: string) => void;
    usableMinionTalentUids?: Set<string>;
    usableSpecialMinionUids?: Set<string>;
    usableOngoingTalentUids?: Set<string>;
    isExpanded?: boolean;
    onToggleExpanded?: (minionUid: string) => void;
    onExpandMinion?: React.Dispatch<React.SetStateAction<string | null>>;
    onAttachedOverlayVisibilityChange?: (visible: boolean) => void;
    isActivationArmed: (activationKey: string) => boolean;
    clearArmedActivation: () => void;
    armOrActivate: (activationKey: string, callbacks: { onArm?: () => void; onActivate: () => void }) => boolean;
    isMobileViewport?: boolean;
    /** 响应式布局配置 */
    layout: ReturnType<typeof getLayoutConfig>;
    /** 玩家回合顺序（用于判断是否是最右边玩家） */
    turnOrder: string[];
    isCoarsePointer: boolean;
    /** 该随从是否是本次状态变更中新进入基地的实体 */
    shouldAnimateEntry?: boolean;
}> = ({ minion, effectivePower, core, index, pid, baseIndex, dispatch, isMinionSelectMode, isMultiSelected, isDuelParticipant = false, isDimmed, onMinionSelect, onView, onViewAction, selectableOngoingUids, multiSelectedOngoingUids, onOngoingSelect, usableMinionTalentUids, usableSpecialMinionUids, usableOngoingTalentUids, isExpanded, onToggleExpanded, onExpandMinion, onAttachedOverlayVisibilityChange, isActivationArmed, clearArmedActivation, armOrActivate, isMobileViewport: _isMobileViewport = false, layout, turnOrder, isCoarsePointer, shouldAnimateEntry = false }) => {
    const { t } = useTranslation('game-smashup');
    // 兼容融合卡：Wolf Pact 这类作为随从打出时仍使用融合卡定义的图与文案
    const minionDef = getMinionDef(minion.defId);
    const genericDef = minionDef ?? getCardDef(minion.defId);
    const resolvedName = resolveCardName(genericDef, t) || minion.defId;
    const resolvedText = resolveCardText(genericDef, t);
    const minionTitle = resolvedText ? `${resolvedName}\n${resolvedText}` : resolvedName;
    const conf = PLAYER_CONFIG[parseInt(pid) % PLAYER_CONFIG.length];

    // UI 可用态统一走 Board.tsx 里基于 validate(...) 生成的集合，避免和真实命令校验分叉
    const hasTalent =
        (minionDef?.abilityTags?.includes('talent')) ||
        (genericDef && genericDef.type === 'fusion'
            ? (genericDef.minionAbilityTags ?? []).includes('talent')
            : false);
    const canUseTalent = !!usableMinionTalentUids?.has(minion.uid);
    const hasExtraTalentReady =
        minion.metadata?.mythicHorsesSeastarExtraTalent === true
        && minion.metadata?.mythicHorsesSeastarExtraTalentConsumed !== true;

    const canActivateSpecial = !!usableSpecialMinionUids?.has(minion.uid);

    // 合并：天赋或 special 都可以激活
    const canActivate = canUseTalent || canActivateSpecial;
    const hasAttachedActions = Boolean(minion.attachedActions?.length);
    const isSelectionContext = !!isMinionSelectMode;
    const isRightmostBase = baseIndex === core.bases.length - 1;
    const isRightmostPlayer = pid === turnOrder[turnOrder.length - 1];
    const isFourPlayerGame = turnOrder.length === 4;
    const shouldShowAttachedLeft = isRightmostBase && isRightmostPlayer && isFourPlayerGame;
    const shouldShowAttachedActions =
        !isSelectionContext && (Boolean(selectableOngoingUids) || (isCoarsePointer ? !!isExpanded : false));
    const [isAttachedOverlayPinned, setIsAttachedOverlayPinned] = React.useState(false);
    const attachedOverlayHideTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);
    const attachedOverlayVisibilityChangeRef = React.useRef(onAttachedOverlayVisibilityChange);
    const attachedActionsPositionClass = shouldShowAttachedLeft
        ? 'right-full flex-col-reverse pr-[0.6vw]'
        : 'left-full flex-col pl-[0.6vw]';
    const minionActivationKey = `minion-${minion.uid}`;
    const isMinionActivationArmed = isActivationArmed(minionActivationKey);
    const showTouchActivationHint = isCoarsePointer && isMinionActivationArmed && canActivate;
    const clearAttachedOverlayHideTimer = useCallback(() => {
        if (attachedOverlayHideTimerRef.current !== null) {
            window.clearTimeout(attachedOverlayHideTimerRef.current);
            attachedOverlayHideTimerRef.current = null;
        }
    }, []);
    React.useEffect(() => {
        attachedOverlayVisibilityChangeRef.current = onAttachedOverlayVisibilityChange;
    }, [onAttachedOverlayVisibilityChange]);
    const notifyAttachedOverlayVisibilityChange = useCallback((visible: boolean) => {
        attachedOverlayVisibilityChangeRef.current?.(visible);
    }, []);
    const setAttachedOverlayPinnedState = useCallback((visible: boolean) => {
        clearAttachedOverlayHideTimer();
        setIsAttachedOverlayPinned(visible);
        notifyAttachedOverlayVisibilityChange(visible);
    }, [clearAttachedOverlayHideTimer, notifyAttachedOverlayVisibilityChange]);
    const scheduleAttachedOverlayHide = useCallback(() => {
        if (shouldShowAttachedActions) return;
        clearAttachedOverlayHideTimer();
        attachedOverlayHideTimerRef.current = window.setTimeout(() => {
            setIsAttachedOverlayPinned(false);
            notifyAttachedOverlayVisibilityChange(false);
        }, 140);
    }, [clearAttachedOverlayHideTimer, notifyAttachedOverlayVisibilityChange, shouldShowAttachedActions]);
    const isAttachedOverlayVisible =
        hasAttachedActions && !isSelectionContext && (shouldShowAttachedActions || isAttachedOverlayPinned);

    React.useEffect(() => {
        if (!hasAttachedActions) {
            setAttachedOverlayPinnedState(false);
            return;
        }
        if (shouldShowAttachedActions) {
            setAttachedOverlayPinnedState(true);
        } else {
            setIsAttachedOverlayPinned(false);
            notifyAttachedOverlayVisibilityChange(false);
        }
    }, [hasAttachedActions, notifyAttachedOverlayVisibilityChange, setAttachedOverlayPinnedState, shouldShowAttachedActions]);

    React.useEffect(() => () => {
        clearAttachedOverlayHideTimer();
        notifyAttachedOverlayVisibilityChange(false);
    }, [clearAttachedOverlayHideTimer, notifyAttachedOverlayVisibilityChange]);

    const seed = minion.uid.charCodeAt(0) + index;
    const rotation = (seed % 6) - 3;
    const bottomOverlayDefId = getMinionBottomOverlayDefId(minion);
    // 选择态仍允许重叠，但每张候选至少露出约七成卡高，保证卡面和点击区域都可辨认。
    const selectionStackOffset = Number((-(layout.minionCardWidth / CARD_ASPECT_RATIO) * 0.28).toFixed(4));
    const stackStyle = {
        marginTop: index === 0 ? 0 : layoutInlineSize(isMinionSelectMode ? selectionStackOffset : layout.minionStackOffset, layout),
        zIndex: isMinionSelectMode
            ? (isSelectionContext && !isDimmed ? 2000 + index : index + 1)
            : index + 1,
        width: layoutInlineSize(layout.minionCardWidth, layout),
        height: layoutCardHeight(layout.minionCardWidth, layout),
        aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
    };
    const {
        showDesktopInspectButton,
        getTouchInspectProps: getMinionTouchInspectProps,
        shouldBlockInspectClick: shouldBlockMinionClick,
    } = useTouchInspectGesture<string, undefined>({
        enabled: true,
        onInspect: () => {
            onView();
        },
    });
    const {
        getTouchInspectProps: getAttachedTouchInspectProps,
        shouldBlockInspectClick: shouldBlockAttachedClick,
    } = useTouchInspectGesture<string, { defId: string }>({
        enabled: Boolean(minion.attachedActions?.length),
        onInspect: (_key, payload) => {
            onViewAction(payload.defId);
        },
    });

    const isSelectableMinion = isSelectionContext && !isDimmed;

    const handleSelectCapture = useCallback((e: React.MouseEvent) => {
        if (!isSelectableMinion || !onMinionSelect) return;
        const blocked = shouldBlockMinionClick(`minion-${minion.uid}`);
        if (blocked) return;
        e.preventDefault();
        e.stopPropagation();
        clearArmedActivation();
        onMinionSelect(minion.uid, baseIndex);
    }, [isSelectableMinion, onMinionSelect, shouldBlockMinionClick, minion.uid, clearArmedActivation, baseIndex]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (e.defaultPrevented) return;
        e.stopPropagation();
        const blocked = shouldBlockMinionClick(`minion-${minion.uid}`);
        if (blocked) return;
        // 随从选择模式：点击随从附着 ongoing 行动卡
        if (isSelectableMinion && onMinionSelect) {
            clearArmedActivation();
            onMinionSelect(minion.uid, baseIndex);
            return;
        }
        if (isCoarsePointer) {
            if (canActivate) {
                armOrActivate(minionActivationKey, {
                    onArm: () => {
                        onExpandMinion?.(minion.uid);
                    },
                    onActivate: () => {
                        onExpandMinion?.(minion.uid);
                        if (canUseTalent) {
                            dispatch(SU_COMMANDS.USE_TALENT, { minionUid: minion.uid, baseIndex });
                        } else if (canActivateSpecial) {
                            dispatch(SU_COMMANDS.ACTIVATE_SPECIAL, { minionUid: minion.uid, baseIndex });
                        }
                    },
                });
                return;
            }
            if (hasAttachedActions) {
                onToggleExpanded?.(minion.uid);
                clearArmedActivation();
                return;
            }
        }
        if (canUseTalent) {
            clearArmedActivation();
            dispatch(SU_COMMANDS.USE_TALENT, { minionUid: minion.uid, baseIndex });
        } else if (canActivateSpecial) {
            clearArmedActivation();
            dispatch(SU_COMMANDS.ACTIVATE_SPECIAL, { minionUid: minion.uid, baseIndex });
        } else {
            clearArmedActivation();
            onView();
        }
    }, [isSelectableMinion, onMinionSelect, clearArmedActivation, isCoarsePointer, canActivate, canUseTalent, canActivateSpecial, dispatch, minion.uid, baseIndex, shouldBlockMinionClick, armOrActivate, onToggleExpanded, onExpandMinion, hasAttachedActions, minionActivationKey, onView]);

    const showUsedMinionState = hasTalent && minion.talentUsed && !canActivate;
    const hostAccentHighlightActive =
        isMultiSelected ||
        isSelectableMinion ||
        isExpanded ||
        canActivate ||
        showUsedMinionState;
    const hostAccessoryChromeClass = getAccessoryChromeClass(hostAccentHighlightActive, 'border border-white shadow-md');
    const hostPowerCounterSurfaceClass = getAccessorySurfaceClass(hostAccentHighlightActive, 'bg-amber-400', 'bg-gradient-to-br from-amber-300 to-amber-500');
    const minionContainerClassName = `relative aspect-[0.714] group ${isAttachedOverlayVisible ? '!z-[1300]' : 'hover:!z-[999]'} ${
        isSelectableMinion
            ? 'cursor-pointer -translate-y-[0.16vw] scale-[1.04]'
            : isSelectionContext
            ? 'cursor-default'
            : 'cursor-pointer'
    }`;
    const minionFrameClassName = `relative w-full h-full bg-white p-[0.2vw] rounded-[0.2vw] border-[0.15vw] transition-shadow duration-200
        ${isMultiSelected
            ? 'border-green-400 ring-[0.26vw] ring-green-400 shadow-[0_0_18px_rgba(74,222,128,0.72),0_0_40px_rgba(74,222,128,0.34)]'
            : isSelectableMinion
            ? 'border-green-400 ring-[0.26vw] ring-green-400 shadow-[0_0_18px_rgba(74,222,128,0.68),0_0_40px_rgba(74,222,128,0.3)]'
            : isExpanded
            ? isMinionActivationArmed
                ? 'border-amber-300 ring-4 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.75),0_0_36px_rgba(251,191,36,0.35)]'
                : canActivate
                ? 'border-amber-300 ring-4 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.75),0_0_36px_rgba(251,191,36,0.35)]'
                : showUsedMinionState
                ? USED_STATE_CLASS
                : 'border-green-300 ring-2 ring-green-300/90 shadow-[0_0_14px_rgba(134,239,172,0.4),0_0_28px_rgba(134,239,172,0.18)]'
            : canActivate
            ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6),0_0_30px_rgba(251,191,36,0.3)]'
            : showUsedMinionState
            ? USED_STATE_CLASS
            : `${conf.border} ${conf.shadow}`
        }`;

    const rotationAnimate = isSelectableMinion
        ? { rotate: [rotation - 0.75, rotation + 0.75, rotation - 0.75] }
        : canActivate
            ? { rotate: [rotation - 2, rotation + 2, rotation - 2] }
            : { rotate: rotation };

    const rotationTransition = isSelectableMinion
        ? { rotate: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } }
        : canActivate
            ? { rotate: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } }
            : { type: 'spring', stiffness: 320, damping: 26 };

    return (
        <motion.div
            data-minion-uid={minion.uid}
            data-minion-def-id={minion.defId}
            data-duel-participant={isDuelParticipant ? 'true' : 'false'}
            data-expanded={isExpanded ? 'true' : 'false'}
            data-attached-actions-visible={hasAttachedActions ? (shouldShowAttachedActions ? 'true' : 'false') : 'none'}
            data-attached-overlay-visible={hasAttachedActions ? (isAttachedOverlayVisible ? 'true' : 'false') : 'none'}
            data-activation-armed={isMinionActivationArmed ? 'true' : 'false'}
            {...getMinionTouchInspectProps(`minion-${minion.uid}`, undefined)}
            onClickCapture={handleSelectCapture}
            onClick={handleClick}
            onMouseEnter={() => {
                if (hasAttachedActions && !shouldShowAttachedActions) {
                    setAttachedOverlayPinnedState(true);
                }
            }}
            onMouseLeave={() => {
                if (hasAttachedActions && !shouldShowAttachedActions) {
                    scheduleAttachedOverlayHide();
                }
            }}
            className={minionContainerClassName}
            style={stackStyle}
            initial={shouldAnimateEntry ? { scale: 0.3, y: -60, opacity: 0 } : false}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20, delay: index * 0.05 }}
        >
            {isDuelParticipant && (
                <>
                    <motion.div
                        className="absolute pointer-events-none z-30 rounded-[0.32vw]"
                        style={{
                            inset: '-0.12vw',
                            boxShadow: '0 0 0.45vw rgba(120, 53, 15, 0.55), 0 0 1vw rgba(245, 158, 11, 0.55), 0 0 1.6vw rgba(251, 191, 36, 0.42)',
                        }}
                        animate={{
                            boxShadow: [
                                '0 0 0.35vw rgba(120, 53, 15, 0.45), 0 0 0.8vw rgba(245, 158, 11, 0.45), 0 0 1.2vw rgba(251, 191, 36, 0.3)',
                                '0 0 0.55vw rgba(120, 53, 15, 0.72), 0 0 1.2vw rgba(245, 158, 11, 0.72), 0 0 1.9vw rgba(251, 191, 36, 0.52)',
                                '0 0 0.35vw rgba(120, 53, 15, 0.45), 0 0 0.8vw rgba(245, 158, 11, 0.45), 0 0 1.2vw rgba(251, 191, 36, 0.3)',
                            ],
                        }}
                        transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="absolute left-1/2 top-[0.18vw] z-40 -translate-x-1/2 rounded-sm border border-amber-100 bg-amber-950/88 px-[0.34vw] py-[0.05vw] text-[0.42vw] font-black tracking-[0.04em] text-amber-100 shadow-[0_2px_6px_rgba(120,53,15,0.35)] pointer-events-none whitespace-nowrap">
                        {t('ui.duel_badge')}
                    </div>
                </>
            )}
            <motion.div
                className="relative w-full h-full"
                animate={rotationAnimate}
                whileHover={isSelectionContext ? undefined : { scale: 1.1 }}
                transition={rotationTransition}
            >
                <div
                    data-testid={`su-minion-frame-${minion.uid}`}
                    className={minionFrameClassName}
                >
                    <div className="w-full h-full bg-slate-100 relative">
                        <div className="w-full h-full overflow-hidden">
                            <CardPreview
                                previewRef={genericDef?.previewRef
                                    ? {
                                        type: 'renderer',
                                        rendererId: 'smashup-card-renderer',
                                        payload: { defId: minion.defId, cardUid: minion.uid, overlayDefId: bottomOverlayDefId },
                                    }
                                    : undefined}
                                className="w-full h-full"
                                title={minionTitle}
                            />
                        </div>

                        {/* 天赋/特殊能力可用时的发光叠层 */}
                        {canActivate && (
                            <motion.div
                                className="absolute inset-0 pointer-events-none z-20 rounded-[0.1vw]"
                                animate={{ opacity: [0.15, 0.35, 0.15] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)' }}
                            />
                        )}
                    </div>
                </div>

                {/* 角标/按钮层与卡面高亮层拆开：仍随卡整体变形，但不参与描边 */}
                {isMultiSelected && (
                    <div className="absolute top-[0.15vw] left-[0.15vw] w-[1.4vw] h-[1.4vw] bg-green-500 rounded-full flex items-center justify-center shadow-lg border-[0.1vw] border-white z-30">
                        <svg className="w-[0.8vw] h-[0.8vw] text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}

                {showDesktopInspectButton && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onView(); }}
                        className="absolute top-[0.15vw] right-[0.15vw] w-[1.4vw] h-[1.4vw] flex items-center justify-center bg-black/60 hover:bg-amber-500/80 text-white rounded-full opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-[opacity,background-color] duration-200 shadow-lg z-[110] cursor-zoom-in"
                    >
                        <svg className="w-[0.8vw] h-[0.8vw] fill-current" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}

                {(() => {
                    if (effectivePower === minion.basePower) return null;
                    const badge = getMinionPowerBadgePresentation(core, minion, baseIndex, effectivePower);
                    const parts = [`基础: ${badge.breakdown.basePower}`];
                    if (badge.breakdown.powerCounters !== 0) parts.push(`力量指示物: ${badge.breakdown.powerCounters > 0 ? '+' : ''}${badge.breakdown.powerCounters}`);
                    if (badge.breakdown.permanentModifier !== 0) parts.push(`永久修正: ${badge.breakdown.permanentModifier > 0 ? '+' : ''}${badge.breakdown.permanentModifier}`);
                    if (badge.breakdown.tempModifier !== 0) parts.push(`临时: ${badge.breakdown.tempModifier > 0 ? '+' : ''}${badge.breakdown.tempModifier}`);
                    if (badge.breakdown.ongoingDetails.length > 0) {
                        for (const d of badge.breakdown.ongoingDetails) parts.push(`${d.sourceName}: ${d.value > 0 ? '+' : ''}${d.value}`);
                    }
                    parts.push(`= ${badge.breakdown.finalPower}`);
                    return (
                        <div
                            data-testid={`su-minion-power-badge-${minion.uid}`}
                            className={`absolute -top-[0.4vw] -left-[0.4vw] min-w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center text-[0.7vw] font-black text-white ${hostAccessoryChromeClass} px-[0.15vw] z-30 ${badge.badgeToneClass}`}
                            title={parts.join('\n')}
                        >
                            {badge.badgeLabel}
                        </div>
                    );
                })()}

                {(minion.powerCounters ?? 0) > 0 && (
                    <motion.div
                        className={`absolute -left-[0.4vw] min-w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center text-[0.55vw] font-black text-amber-900 ${hostPowerCounterSurfaceClass} ${hostAccessoryChromeClass} px-[0.1vw] z-30 ${
                            (effectivePower !== minion.basePower) ? 'top-[1vw]' : '-top-[0.4vw]'
                        }`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        title={`+1力量指示物 ×${minion.powerCounters}`}
                    >
                        +{minion.powerCounters}
                    </motion.div>
                )}

                {hasTalent && minion.talentUsed && !canUseTalent && (
                    <UsedStateBadge
                        label={t('ui.talent_used')}
                        insetClassName="left-[0.2vw] right-[0.2vw]"
                        muteStroke={hostAccentHighlightActive}
                        testId={`su-minion-used-badge-${minion.uid}`}
                    />
                )}

                {hasExtraTalentReady && (
                    <TopStateBadge
                        label={t('ui.extra_talent_ready')}
                        compact
                        insetClassName="left-[0.12vw] right-[0.12vw]"
                        muteStroke={hostAccentHighlightActive}
                        testId={`su-minion-extra-talent-badge-${minion.uid}`}
                    />
                )}

                {showTouchActivationHint && (
                    <div
                        data-testid={`su-minion-activation-hint-${minion.uid}`}
                        className={`absolute -bottom-[0.3vw] left-1/2 -translate-x-1/2 ${getAccessorySurfaceClass(hostAccentHighlightActive, 'bg-amber-400', 'bg-amber-500')} text-slate-900 text-[0.45vw] font-bold px-[0.35vw] py-[0.05vw] rounded-sm ${getAccessoryChromeClass(hostAccentHighlightActive, 'border border-white shadow-sm')} z-20 whitespace-nowrap pointer-events-none`}
                    >
                        {t('ui.tap_again_to_activate')}
                    </div>
                )}

                {hasAttachedActions && (
                    <AttachedBadge count={minion.attachedActions.length} muteStroke={hostAccentHighlightActive} />
                )}
            </motion.div>
            {/* 附着行动的 hover 层恢复到旧的外层容器，避免跟随宿主变形后 hover 提前丢失 */}
            {hasAttachedActions && (
                <>
                    <div
                        data-attached-overlay-owner={minion.uid}
                        className={`absolute top-0 flex ${attachedActionsPositionClass}
                            ${isAttachedOverlayVisible
                                ? 'opacity-100 scale-100 pointer-events-auto'
                                : 'opacity-0 scale-90 transition-all duration-150 pointer-events-none'
                            }`}
                        style={{ zIndex: UI_Z_INDEX.tooltip, gap: layoutInlineSize(0.2, layout) }}
                        onMouseEnter={() => {
                            if (!shouldShowAttachedActions) {
                                setAttachedOverlayPinnedState(true);
                            }
                        }}
                        onMouseLeave={() => {
                            if (!shouldShowAttachedActions) {
                                scheduleAttachedOverlayHide();
                            }
                        }}
                    >
                        {minion.attachedActions.map((aa) => {
                            const actionDef = getCardDef(aa.defId);
                            const actionName = resolveCardName(actionDef, t) || aa.defId;
                            const actionText = resolveCardText(actionDef, t);
                            const actionTitle = actionText ? `${actionName}\n${actionText}` : actionName;
                            const isSelectableAA = !!selectableOngoingUids?.has(aa.uid);
                            const isMultiSelectedAA = !!multiSelectedOngoingUids?.has(aa.uid);
                            const isDimmedAA = !!selectableOngoingUids && !selectableOngoingUids.has(aa.uid);
                            const hasAATalent = actionDef?.abilityTags?.includes('talent') ?? false;
                            const canUseAATalent = !!usableOngoingTalentUids?.has(aa.uid);
                            const attachedActivationKey = `attached-${aa.uid}`;
                            const isAttachedActivationArmed = isActivationArmed(attachedActivationKey);
                            const showUsedAttachedState = hasAATalent && aa.talentUsed && !canUseAATalent;
                            return (
                                <motion.div
                                    key={aa.uid}
                                    data-attached-action-uid={aa.uid}
                                    data-activation-armed={isAttachedActivationArmed ? 'true' : 'false'}
                                    {...getAttachedTouchInspectProps(`attached-${aa.uid}`, { defId: aa.defId })}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (shouldBlockAttachedClick(`attached-${aa.uid}`)) return;
                                        if (isSelectableAA && onOngoingSelect) {
                                            clearArmedActivation();
                                            onOngoingSelect(aa.uid);
                                        } else if (canUseAATalent) {
                                            clearArmedActivation();
                                            dispatch(SU_COMMANDS.USE_TALENT, { ongoingCardUid: aa.uid, baseIndex });
                                        } else {
                                            clearArmedActivation();
                                            onViewAction(aa.defId);
                                        }
                                    }}
                                    className={`aspect-[0.714] bg-white rounded-[0.1vw] shadow-lg cursor-pointer
                                        hover:scale-[2] ${shouldShowAttachedLeft ? 'hover:-translate-x-[0.8vw]' : 'hover:translate-x-[0.8vw]'} transition-transform duration-150
                                        border-[0.08vw] ${isDimmedAA
                                            ? 'opacity-40 grayscale cursor-not-allowed border-slate-400'
                                            : isMultiSelectedAA
                                            ? 'border-green-400 ring-4 ring-green-400 shadow-[0_0_14px_rgba(74,222,128,0.72),0_0_26px_rgba(74,222,128,0.34)]'
                                            : isSelectableAA
                                            ? 'border-green-400 ring-2 ring-green-400 shadow-[0_0_10px_rgba(74,222,128,0.55)]'
                                            : isAttachedActivationArmed
                                            ? 'border-amber-300 ring-4 ring-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.75)]'
                                            : canUseAATalent
                                            ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                                            : showUsedAttachedState
                                            ? USED_STATE_CLASS
                                            : 'border-slate-200 shadow-[0_6px_18px_rgba(15,23,42,0.16)]'
                                        }`}
                                    style={{
                                        width: layoutInlineSize(3, layout),
                                        height: layoutCardHeight(3, layout),
                                        aspectRatio: `${CARD_ASPECT_RATIO} / 1`,
                                    }}
                                    title={actionTitle}
                                >
                                    <div className="w-full h-full overflow-hidden rounded-[0.06vw]">
                                        <CardPreview
                                            previewRef={actionDef?.previewRef
                                                ? { type: 'renderer', rendererId: 'smashup-card-renderer', payload: { defId: aa.defId, cardUid: aa.uid, disableHoverOverlay: true } }
                                                : undefined}
                                            className="w-full h-full"
                                            title={actionName}
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </>
            )}
        </motion.div>
    );
};
