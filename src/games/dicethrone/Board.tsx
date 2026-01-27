import React from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { AbilityCard } from './types';
import { HAND_LIMIT, type TokenResponsePhase } from './domain/types';
import type { MatchState } from '../../engine/types';
import { RESOURCE_IDS } from './domain/resources';
import type { DiceThroneCore } from './domain';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { GameDebugPanel } from '../../components/GameDebugPanel';
import { DiceThroneDebugConfig } from './debug-config';
import {
    FlyingEffectsLayer,
    useFlyingEffects,
    getViewportCenter,
    getElementCenter,
} from '../../components/common/animations/FlyingEffect';
import { useShake } from '../../components/common/animations/ShakeContainer';
import { usePulseGlow } from '../../components/common/animations/PulseGlow';
import { getLocalizedAssetPath } from '../../core';
import { useToast } from '../../contexts/ToastContext';
import { UndoProvider } from '../../contexts/UndoContext';
import { loadStatusIconAtlasConfig, type StatusIconAtlasConfig } from './ui/statusEffects';
import { getAbilitySlotId } from './ui/AbilityOverlays';
import { HandArea } from './ui/HandArea';
import { loadCardAtlasConfig, type CardAtlasConfig } from './ui/cardAtlas';
import { OpponentHeader } from './ui/OpponentHeader';
import { LeftSidebar } from './ui/LeftSidebar';
import { CenterBoard } from './ui/CenterBoard';
import { RightSidebar } from './ui/RightSidebar';
import { BoardOverlays } from './ui/BoardOverlays';
import { GameHints } from './ui/GameHints';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { useCurrentChoice, useDiceThroneState } from './hooks/useDiceThroneState';
import { PROMPT_COMMANDS } from '../../engine/systems/PromptSystem';
// 引擎层 Hooks
import { useSpectatorMoves } from '../../engine';
// 游戏特定 Hooks
import { useInteractionState } from './hooks/useInteractionState';
import { useAnimationEffects } from './hooks/useAnimationEffects';
import { useDiceInteractionConfig } from './hooks/useDiceInteractionConfig';
import { useCardSpotlight } from './hooks/useCardSpotlight';
import { useUIState } from './hooks/useUIState';

type DiceThroneMatchState = MatchState<DiceThroneCore>;
type DiceThroneBoardProps = BoardProps<DiceThroneMatchState>;
type DiceThroneMoveMap = {
    advancePhase: () => void;
    rollDice: () => void;
    rollBonusDie: () => void;
    toggleDieLock: (id: number) => void;
    confirmRoll: () => void;
    selectAbility: (abilityId: string) => void;
    playCard: (cardId: string) => void;
    sellCard: (cardId: string) => void;
    undoSellCard?: () => void;
    resolveChoice: (statusId: string) => void;
    responsePass: (forPlayerId?: string) => void;
    // 卡牌交互相关
    modifyDie: (dieId: number, newValue: number) => void;
    rerollDie: (dieId: number) => void;
    removeStatus: (targetPlayerId: string, statusId?: string) => void;
    transferStatus: (fromPlayerId: string, toPlayerId: string, statusId: string) => void;
    confirmInteraction: (interactionId: string, selectedDiceIds?: number[]) => void;
    cancelInteraction: () => void;
    // Token 响应相关
    useToken: (tokenId: string, amount: number) => void;
    skipTokenResponse: () => void;
    usePurify: (statusId: string) => void;
    // 击倒移除
    payToRemoveStun: () => void;
};

const requireMove = <T extends (...args: unknown[]) => void>(value: unknown, name: string): T => {
    if (typeof value !== 'function') {
        throw new Error(`[DiceThroneBoard] 缺少 move: ${name}`);
    }
    return value as T;
};

const resolveMoves = (raw: Record<string, unknown>): DiceThroneMoveMap => {
    // 统一把 payload 包装成领域命令结构，避免 die_not_found 等校验失败
    const advancePhase = requireMove(raw.advancePhase ?? raw.ADVANCE_PHASE, 'advancePhase');
    const rollDice = requireMove(raw.rollDice ?? raw.ROLL_DICE, 'rollDice');
    const rollBonusDie = requireMove(raw.rollBonusDie ?? raw.ROLL_BONUS_DIE, 'rollBonusDie');
    const toggleDieLock = requireMove(raw.toggleDieLock ?? raw.TOGGLE_DIE_LOCK, 'toggleDieLock');
    const confirmRoll = requireMove(raw.confirmRoll ?? raw.CONFIRM_ROLL, 'confirmRoll');
    const selectAbility = requireMove(raw.selectAbility ?? raw.SELECT_ABILITY, 'selectAbility');
    const playCard = requireMove(raw.playCard ?? raw.PLAY_CARD, 'playCard');
    const sellCard = requireMove(raw.sellCard ?? raw.SELL_CARD, 'sellCard');
    const undoSellCardRaw = (raw.undoSellCard ?? raw.UNDO_SELL_CARD) as ((payload?: unknown) => void) | undefined;
    const resolveChoice = requireMove(raw.resolveChoice ?? raw.RESOLVE_CHOICE, 'resolveChoice');

    const responsePassRaw = (raw.responsePass ?? raw.RESPONSE_PASS) as ((payload?: unknown) => void) | undefined;
    // 卡牌交互 moves
    const modifyDieRaw = (raw.modifyDie ?? raw.MODIFY_DIE) as ((payload: unknown) => void) | undefined;
    const rerollDieRaw = (raw.rerollDie ?? raw.REROLL_DIE) as ((payload: unknown) => void) | undefined;
    const removeStatusRaw = (raw.removeStatus ?? raw.REMOVE_STATUS) as ((payload: unknown) => void) | undefined;
    const transferStatusRaw = (raw.transferStatus ?? raw.TRANSFER_STATUS) as ((payload: unknown) => void) | undefined;
    const confirmInteractionRaw = (raw.confirmInteraction ?? raw.CONFIRM_INTERACTION) as ((payload: unknown) => void) | undefined;
    const cancelInteractionRaw = (raw.cancelInteraction ?? raw.CANCEL_INTERACTION) as ((payload: unknown) => void) | undefined;
    // Token 响应 moves
    const useTokenRaw = (raw.useToken ?? raw.USE_TOKEN) as ((payload: unknown) => void) | undefined;
    const skipTokenResponseRaw = (raw.skipTokenResponse ?? raw.SKIP_TOKEN_RESPONSE) as ((payload: unknown) => void) | undefined;
    const usePurifyRaw = (raw.usePurify ?? raw.USE_PURIFY) as ((payload: unknown) => void) | undefined;
    const payToRemoveStunRaw = (raw.payToRemoveStun ?? raw.PAY_TO_REMOVE_STUN) as ((payload: unknown) => void) | undefined;

    return {
        advancePhase: () => advancePhase({}),
        rollDice: () => rollDice({}),
        rollBonusDie: () => rollBonusDie({}),
        toggleDieLock: (id) => toggleDieLock({ dieId: id }),
        confirmRoll: () => confirmRoll({}),
        selectAbility: (abilityId) => selectAbility({ abilityId }),
        playCard: (cardId) => playCard({ cardId }),
        sellCard: (cardId) => sellCard({ cardId }),
        undoSellCard: undoSellCardRaw ? () => undoSellCardRaw({}) : undefined,
        resolveChoice: (statusId) => resolveChoice({ statusId }),
        responsePass: (forPlayerId) => responsePassRaw?.(forPlayerId ? { forPlayerId } : {}),
        // 卡牌交互
        modifyDie: (dieId, newValue) => modifyDieRaw?.({ dieId, newValue }),
        rerollDie: (dieId) => rerollDieRaw?.({ dieId }),
        removeStatus: (targetPlayerId, statusId) => removeStatusRaw?.({ targetPlayerId, statusId }),
        transferStatus: (fromPlayerId, toPlayerId, statusId) => transferStatusRaw?.({ fromPlayerId, toPlayerId, statusId }),
        confirmInteraction: (interactionId, selectedDiceIds) => confirmInteractionRaw?.({ interactionId, selectedDiceIds }),
        cancelInteraction: () => cancelInteractionRaw?.({}),
        // Token 响应
        useToken: (tokenId, amount) => useTokenRaw?.({ tokenId, amount }),
        skipTokenResponse: () => skipTokenResponseRaw?.({}),
        usePurify: (statusId) => usePurifyRaw?.({ statusId }),
        // 击倒移除
        payToRemoveStun: () => payToRemoveStunRaw?.({}),
    };
};

// --- Main Layout ---
export const DiceThroneBoard: React.FC<DiceThroneBoardProps> = ({ G: rawG, ctx, moves, playerID, reset, matchData, isMultiplayer }) => {
    const G = rawG.core;
    const access = useDiceThroneState(rawG);
    const choice = useCurrentChoice(access);
    const gameMode = useGameMode();
    const isSpectator = !!gameMode?.isSpectator;
    
    // 使用引擎层 useSpectatorMoves Hook 自动拦截观察者操作（消除88行重复代码）
    const engineMoves = useSpectatorMoves(
        resolveMoves(moves as Record<string, unknown>),
        isSpectator,
        playerID,
        { logPrefix: 'Spectate[DiceThrone]' }
    ) as DiceThroneMoveMap;
    const { t, i18n } = useTranslation('game-dicethrone');
    const toast = useToast();
    const locale = i18n.resolvedLanguage ?? i18n.language;

    // 重赛系统（socket）
    const { state: rematchState, vote: handleRematchVote, registerReset } = useRematch();

    // 注册 reset 回调（当双方都投票后由 socket 触发）
    React.useEffect(() => {
        if (!isSpectator && reset) {
            registerReset(reset);
        }
    }, [reset, registerReset, isSpectator]);

    const isGameOver = ctx.gameover;
    const rootPid = playerID || '0';
    const player = G.players[rootPid] || G.players['0'];
    const otherPid = Object.keys(G.players).find(id => id !== rootPid) || '1';
    const opponent = G.players[otherPid];
    // 获取对手用户名
    const opponentName = matchData?.find(p => String(p.id) === otherPid)?.name ?? t('common.opponent');

    // 从 access.turnPhase 读取阶段（单一权威：来自 sys.phase）
    const currentPhase = access.turnPhase;
    
    // 使用 useUIState Hook 整合20+个分散的UI状态
    const {
        magnify,
        isMagnifyOpen,
        setMagnifiedImage,
        setMagnifiedCard,
        setMagnifiedCards,
        closeMagnify,
        modals,
        openModal,
        closeModal,
        viewMode: manualViewMode,
        setViewMode: setManualViewMode,
        toggleViewMode,
        isLayoutEditing,
        setIsLayoutEditing,
        toggleLayoutEditing,
        isTipOpen,
        setIsTipOpen,
        toggleTip,
        headerError,
        setHeaderError,
        showHeaderError,
        isRolling,
        setIsRolling,
        rerollingDiceIds,
        setRerollingDiceIds,
        activatingAbilityId,
        setActivatingAbilityId,
        discardHighlighted,
        setDiscardHighlighted,
        sellButtonVisible,
        setSellButtonVisible,
        coreAreaHighlighted,
        setCoreAreaHighlighted,
        lastUndoCardId,
        setLastUndoCardId,
    } = useUIState();
    
    // Atlas 配置（保持独立，用于资源加载）
    const [cardAtlas, setCardAtlas] = React.useState<CardAtlasConfig | null>(null);
    const [statusIconAtlas, setStatusIconAtlas] = React.useState<StatusIconAtlasConfig | null>(null);
    
    // 使用 useCardSpotlight Hook 管理卡牌和额外骰子特写
    const {
        cardSpotlightQueue,
        handleCardSpotlightClose,
        bonusDie,
        handleBonusDieClose,
    } = useCardSpotlight({
        lastPlayedCard: G.lastPlayedCard,
        lastBonusDieRoll: G.lastBonusDieRoll,
        currentPlayerId: rootPid,
        opponentName,
    });
    

    // 使用动画库 Hooks
    const { effects: flyingEffects, pushEffect: pushFlyingEffect, removeEffect: handleEffectComplete } = useFlyingEffects();
    const { isShaking: isOpponentShaking, triggerShake: triggerOpponentShake } = useShake(500);
    const { triggerGlow: triggerAbilityGlow } = usePulseGlow(800);

    // DOM 引用
    const opponentHpRef = React.useRef<HTMLDivElement>(null);
    const selfHpRef = React.useRef<HTMLDivElement>(null);
    const opponentBuffRef = React.useRef<HTMLDivElement>(null);
    const opponentHeaderRef = React.useRef<HTMLDivElement>(null);
    const selfBuffRef = React.useRef<HTMLDivElement>(null);
    const drawDeckRef = React.useRef<HTMLDivElement>(null);
    const discardPileRef = React.useRef<HTMLDivElement>(null);

    // 使用 useInteractionState Hook 管理交互状态
    const pendingInteraction = G.pendingInteraction;
    const { localState: localInteraction, handlers: interactionHandlers } = useInteractionState(pendingInteraction);
    
    // 追踪取消交互时返回的卡牌ID
    const prevInteractionRef = React.useRef<typeof pendingInteraction>(undefined);
    React.useEffect(() => {
        if (prevInteractionRef.current && !pendingInteraction) {
            setLastUndoCardId(prevInteractionRef.current.sourceCardId);
        }
        prevInteractionRef.current = pendingInteraction;
    }, [pendingInteraction, setLastUndoCardId]);

    // Token 响应状态
    const pendingDamage = G.pendingDamage;
    const tokenResponsePhase: TokenResponsePhase | null = pendingDamage
        ? (pendingDamage.responderId === pendingDamage.sourcePlayerId ? 'attackerBoost' : 'defenderMitigation')
        : null;
    const isTokenResponder = pendingDamage && (pendingDamage.responderId === rootPid);

    const isActivePlayer = G.activePlayerId === rootPid;
    const rollerId = currentPhase === 'defensiveRoll' ? G.pendingAttack?.defenderId : G.activePlayerId;
    const shouldAutoObserve = currentPhase === 'defensiveRoll' && rootPid !== rollerId;
    const viewMode = shouldAutoObserve ? 'opponent' : manualViewMode;
    const isSelfView = viewMode === 'self';
    const viewPid = isSelfView ? rootPid : otherPid;
    const viewPlayer = (isSelfView ? player : opponent) || player;
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
    const isViewRolling = viewPid === rollerId;
    const rollConfirmed = G.rollConfirmed;
    // availableAbilityIds 现在是派生状态，从 useDiceThroneState hook 中获取
    const availableAbilityIds = isViewRolling ? access.availableAbilityIds : [];
    const selectedAbilityId = currentPhase === 'defensiveRoll'
        ? (isViewRolling ? G.pendingAttack?.defenseAbilityId : undefined)
        : (isViewRolling ? G.pendingAttack?.sourceAbilityId : undefined);
    const canOperateView = isSelfView && !isSpectator;
    const hasRolled = G.rollCount > 0;
    
    // 焦点玩家判断（统一的操作权判断）
    const isFocusPlayer = !isSpectator && access.focusPlayerId === rootPid;
    
    // 防御阶段进入时就应高亮可用的防御技能，不需要等投骰
    const canHighlightAbility = canOperateView && isViewRolling && isRollPhase
        && (currentPhase === 'defensiveRoll' || hasRolled);
    const canSelectAbility = canOperateView && isViewRolling && isRollPhase
        && (currentPhase === 'defensiveRoll' ? true : G.rollConfirmed);
    // 阶段推进权限：由焦点玩家控制，防御阶段需要验证 rollConfirmed
    const canAdvancePhase = isFocusPlayer && (currentPhase === 'defensiveRoll' ? rollConfirmed : true);
    const canResolveChoice = Boolean(choice.hasChoice && choice.playerId === rootPid);
    const canInteractDice = canOperateView && isViewRolling;
    // 响应窗口状态
    const responseWindow = access.responseWindow;
    const isResponseWindowOpen = !!responseWindow;
    // 当前响应者 ID（从队列中获取）
    const currentResponderId = responseWindow?.responderQueue[responseWindow.currentResponderIndex];
    const isResponder = isResponseWindowOpen && currentResponderId === rootPid;
    
    // 检测当前响应者是否离线，如果离线则自动跳过
    const isResponderOffline = React.useMemo(() => {
        if (!isResponseWindowOpen || !currentResponderId) return false;
        // 找到当前响应者的 matchData
        const responderData = matchData?.find(p => String(p.id) === currentResponderId);
        // 如果找不到或者 isConnected 为 false，认为离线
        return responderData ? responderData.isConnected === false : false;
    }, [isResponseWindowOpen, currentResponderId, matchData]);
    
    // 当检测到当前响应者离线时，自动代替他跳过响应
    // 注：只有当自己是活跃玩家时才执行（避免双方都发送 pass）
    React.useEffect(() => {
        if (isResponderOffline && isActivePlayer && currentResponderId && currentResponderId !== rootPid) {
            console.log('[DiceThrone] 检测到响应者离线，自动跳过:', currentResponderId);
            // 延迟一小段时间确保 UI 状态同步
            const timer = setTimeout(() => {
                engineMoves.responsePass(currentResponderId);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isResponderOffline, isActivePlayer, currentResponderId, rootPid, engineMoves]);
    
    // 自己的手牌永远显示
    const handOwner = player;
    const showAdvancePhaseButton = isSelfView && !isSpectator;
    const handleCancelInteraction = React.useCallback(() => {
        if (pendingInteraction?.sourceCardId) {
            setLastUndoCardId(pendingInteraction.sourceCardId);
        }
        engineMoves.cancelInteraction();
    }, [engineMoves, pendingInteraction, setLastUndoCardId]);

    // 骰子交互配置（需要在 waitingReason 之前定义）
    const isDiceInteraction = pendingInteraction && (
        pendingInteraction.type === 'selectDie' || pendingInteraction.type === 'modifyDie'
    );
    // 只有交互所有者才能看到交互 UI
    const isInteractionOwner = !isSpectator && pendingInteraction?.playerId === rootPid;

    // 等待对方思考（isFocusPlayer 已在上方定义）
    const isWaitingOpponent = !isFocusPlayer;
    const thinkingOffsetClass = 'bottom-[12vw]';

    // 可被净化移除的负面状态：由定义驱动（支持扩展）
    const purifiableStatusIds = (G.statusDefinitions ?? [])
        .filter(def => def.type === 'debuff' && def.removable)
        .map(def => def.id);

    // 是否可以使用净化（有净化 Token 且有可移除的负面状态）
    const canUsePurify = !isSpectator && (player.tokens?.['purify'] ?? 0) > 0 &&
        Object.entries(player.statusEffects ?? {}).some(([id, stacks]) => purifiableStatusIds.includes(id) && stacks > 0);

    // 是否可以移除击倒（有击倒状态且 CP >= 2 且在 offensiveRoll 前的阶段）
    const canRemoveStun = !isSpectator && isActivePlayer &&
        (currentPhase === 'upkeep' || currentPhase === 'income' || currentPhase === 'main1') &&
        (player.statusEffects?.['stun'] ?? 0) > 0 &&
        (player.resources?.[RESOURCE_IDS.CP] ?? 0) >= 2;

    // 使用 useDiceInteractionConfig Hook 生成骰子交互配置（简化132行代码）
    const diceInteractionConfig = useDiceInteractionConfig({
        pendingInteraction,
        isInteractionOwner,
        localState: localInteraction,
        dice: G.dice,
        engineMoves: {
            modifyDie: engineMoves.modifyDie,
            confirmInteraction: engineMoves.confirmInteraction,
        },
        onCancel: handleCancelInteraction,
        setRerollingDiceIds,
        onSelectDieLocal: interactionHandlers.selectDie,
        onModifyDieLocal: (dieId, newValue) => {
            interactionHandlers.modifyDie(dieId, newValue, G.dice);
            engineMoves.modifyDie(dieId, newValue);
        },
    });

    // 状态效果/玩家交互配置
    const isStatusInteraction = pendingInteraction && (
        pendingInteraction.type === 'selectStatus' ||
        pendingInteraction.type === 'selectPlayer' ||
        pendingInteraction.type === 'selectTargetStatus'
    );

    const handleSelectStatus = interactionHandlers.selectStatus;
    const handleSelectPlayer = interactionHandlers.selectPlayer;

    const handleStatusInteractionConfirm = () => {
        if (!pendingInteraction) return;

        if (pendingInteraction.type === 'selectStatus') {
            // 移除单个状态
            if (localInteraction.selectedStatus) {
                engineMoves.removeStatus(
                    localInteraction.selectedStatus.playerId,
                    localInteraction.selectedStatus.statusId
                );
            }
        } else if (pendingInteraction.type === 'selectPlayer') {
            // 移除玩家所有状态
            if (localInteraction.selectedPlayer) {
                engineMoves.removeStatus(localInteraction.selectedPlayer);
            }
        } else if (pendingInteraction.type === 'selectTargetStatus') {
            // 转移状态
            const transferConfig = pendingInteraction.transferConfig;
            if (transferConfig?.sourcePlayerId && transferConfig?.statusId && localInteraction.selectedPlayer) {
                engineMoves.transferStatus(
                    transferConfig.sourcePlayerId,
                    localInteraction.selectedPlayer,
                    transferConfig.statusId
                );
            } else if (localInteraction.selectedStatus) {
                // 第一阶段：选择要转移的状态
                // TODO: 这里需要更新 pendingInteraction.transferConfig
            }
        }
        engineMoves.confirmInteraction(pendingInteraction.id);
    };

    const getAbilityStartPos = React.useCallback((abilityId?: string) => {
        if (!abilityId) return getViewportCenter();
        const slotId = getAbilitySlotId(abilityId);
        if (!slotId) return getViewportCenter();
        const element = document.querySelector(`[data-ability-slot="${slotId}"]`) as HTMLElement | null;
        return getElementCenter(element);
    }, []);

    // 获取效果动画的起点位置（优先从技能槽位置获取）
    const getEffectStartPos = React.useCallback(
        (targetId?: string) => {
            // 优先级：lastEffectSourceByPlayerId > activatingAbilityId > pendingAttack.sourceAbilityId
            const sourceAbilityId =
                (targetId && access.lastEffectSourceByPlayerId?.[targetId]) ||
                G.activatingAbilityId ||
                G.pendingAttack?.sourceAbilityId;
            return getAbilityStartPos(sourceAbilityId);
        },
        [access.lastEffectSourceByPlayerId, G.activatingAbilityId, G.pendingAttack?.sourceAbilityId, getAbilityStartPos]
    );

    React.useEffect(() => {
        let isActive = true;
        loadCardAtlasConfig(locale)
            .then((config) => {
                if (isActive) setCardAtlas(config);
            })
            .catch(() => {
                if (isActive) setCardAtlas(null);
            });
        return () => {
            isActive = false;
        };
    }, [locale]);

    React.useEffect(() => {
        let isActive = true;
        loadStatusIconAtlasConfig()
            .then((config) => {
                if (isActive) setStatusIconAtlas(config);
            })
            .catch(() => {
                if (isActive) setStatusIconAtlas(null);
            });
        return () => {
            isActive = false;
        };
    }, []);


    const handleAdvancePhase = () => {
        if (!canAdvancePhase) {
            if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
                showHeaderError(t('error.confirmRoll'));
            } else if (currentPhase === 'defensiveRoll' && !G.rollConfirmed) {
                showHeaderError(t('error.confirmDefenseRoll'));
            }
            return;
        }
        // 只有在有可用技能但玩家没选时才弹窗确认
        if (currentPhase === 'offensiveRoll' && !selectedAbilityId && availableAbilityIds.length > 0) {
            openModal('confirmSkip');
            return;
        }
        engineMoves.advancePhase();
    };

    React.useEffect(() => {
        if (isActivePlayer && ['upkeep', 'income'].includes(currentPhase)) {
            const timer = setTimeout(() => engineMoves.advancePhase(), 800);
            return () => clearTimeout(timer);
        }
        // 弃牌阶段：只有手牌不超限时才自动推进
        if (isActivePlayer && currentPhase === 'discard' && player.hand.length <= HAND_LIMIT) {
            const timer = setTimeout(() => engineMoves.advancePhase(), 800);
            return () => clearTimeout(timer);
        }
    }, [currentPhase, isActivePlayer, engineMoves, player.hand.length]);

    React.useEffect(() => {
        if (currentPhase === 'defensiveRoll') {
            // 防御掷骰时如果自己是掷骰者，强制切回自己视角
            // 若不是掷骰者，交给 shouldAutoObserve 临时切换，不改变手动视角
            if (rollerId && rollerId === rootPid) {
                setManualViewMode('self');
            }
            return;
        }
        if (currentPhase === 'offensiveRoll' && isActivePlayer) setManualViewMode('self');
    }, [currentPhase, isActivePlayer, rollerId, rootPid]);

    React.useEffect(() => {
        const sourceAbilityId = G.activatingAbilityId ?? G.pendingAttack?.sourceAbilityId;
        if (!sourceAbilityId) return;
        setActivatingAbilityId(sourceAbilityId);
        triggerAbilityGlow();
        const timer = setTimeout(() => setActivatingAbilityId(undefined), 800);
        return () => clearTimeout(timer);
    }, [G.activatingAbilityId, G.pendingAttack?.sourceAbilityId, triggerAbilityGlow]);



    // 使用 useAnimationEffects Hook 管理飞行动画效果（替代170行重复代码）
    useAnimationEffects({
        players: { player, opponent },
        currentPlayerId: rootPid,
        opponentId: otherPid,
        refs: {
            opponentHp: opponentHpRef,
            selfHp: selfHpRef,
            opponentBuff: opponentBuffRef,
            selfBuff: selfBuffRef,
        },
        getEffectStartPos,
        pushFlyingEffect,
        triggerOpponentShake,
        locale,
        statusIconAtlas,
    });

    const advanceLabel = currentPhase === 'offensiveRoll'
        ? t('actions.resolveAttack')
        : currentPhase === 'defensiveRoll'
            ? t('actions.endDefense')
            : t('actions.nextPhase');

    if (!player) return <div className="p-10 text-white">{t('status.loadingGameState', { playerId: rootPid })}</div>;

    return (
        <UndoProvider value={{ G: rawG, ctx, moves, playerID, isGameOver: !!isGameOver, isLocalMode: !isMultiplayer }}>
        <div className="relative w-full h-dvh bg-black overflow-hidden font-sans select-none text-slate-200">
            {!isSpectator && (
                <GameDebugPanel G={rawG} ctx={ctx} moves={moves} playerID={playerID}>
                    {/* DiceThrone 专属作弊工具 */}
                    <DiceThroneDebugConfig G={rawG} ctx={ctx} moves={moves} />
                    
                    {/* 测试工具 */}
                    <div className="pt-4 border-t border-gray-200 mt-4 space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">测试工具</h4>
                        <button
                            onClick={toggleLayoutEditing}
                            className={`w-full py-2 rounded font-bold text-xs border transition-[background-color] duration-200 ${isLayoutEditing ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                            {isLayoutEditing ? t('layout.exitEdit') : t('layout.enterEdit')}
                        </button>
                    </div>
                </GameDebugPanel>
            )}

            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-black/40 z-10 pointer-events-none" />
                <OptimizedImage
                    src={getLocalizedAssetPath('dicethrone/images/Common/compressed/background', locale)}
                    fallbackSrc="dicethrone/images/Common/compressed/background"
                    className="w-full h-full object-cover"
                    alt={t('imageAlt.background')}
                />
            </div>

            {opponent && (
                <OpponentHeader
                    opponent={opponent}
                    opponentName={opponentName}
                    viewMode={viewMode}
                    isOpponentShaking={isOpponentShaking}
                    shouldAutoObserve={shouldAutoObserve}
                    onToggleView={() => {
                        setManualViewMode(prev => prev === 'self' ? 'opponent' : 'self');
                    }}
                    headerError={headerError}
                    opponentBuffRef={opponentBuffRef}
                    opponentHpRef={opponentHpRef}
                    statusIconAtlas={statusIconAtlas}
                    locale={locale}
                    containerRef={opponentHeaderRef}
                />
            )}

            <FlyingEffectsLayer effects={flyingEffects} onEffectComplete={handleEffectComplete} />
            <div className="absolute inset-x-0 top-[2vw] bottom-0 z-10 pointer-events-none">
                <LeftSidebar
                    currentPhase={currentPhase}
                    viewPlayer={viewPlayer}
                    locale={locale}
                    statusIconAtlas={statusIconAtlas}
                    selfBuffRef={selfBuffRef}
                    selfHpRef={selfHpRef}
                    drawDeckRef={drawDeckRef}
                    onPurifyClick={() => openModal('purify')}
                    canUsePurify={canUsePurify}
                    onStunClick={() => openModal('removeStun')}
                    canRemoveStun={canRemoveStun}
                />

                <CenterBoard
                    coreAreaHighlighted={coreAreaHighlighted}
                    isTipOpen={isTipOpen}
                    onToggleTip={toggleTip}
                    isLayoutEditing={isLayoutEditing}
                    isSelfView={isSelfView}
                    availableAbilityIds={availableAbilityIds}
                    canSelectAbility={canSelectAbility}
                    canHighlightAbility={canHighlightAbility}
                    onSelectAbility={(abilityId) => engineMoves.selectAbility(abilityId)}
                    onHighlightedAbilityClick={() => {
                        if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
                            toast.warning(t('error.confirmRoll'));
                        }
                    }}
                    selectedAbilityId={selectedAbilityId}
                    activatingAbilityId={activatingAbilityId}
                    abilityLevels={viewPlayer.abilityLevels}
                    cardAtlas={cardAtlas ?? undefined}
                    locale={locale}
                    onMagnifyImage={(image) => setMagnifiedImage(image)}
                />

                <RightSidebar
                    dice={G.dice}
                    rollCount={G.rollCount}
                    rollLimit={G.rollLimit}
                    rollConfirmed={rollConfirmed}
                    currentPhase={currentPhase}
                    canInteractDice={canInteractDice}
                    isRolling={isRolling}
                    setIsRolling={setIsRolling}
                    rerollingDiceIds={rerollingDiceIds}
                    locale={locale}
                    onToggleLock={(id) => engineMoves.toggleDieLock(id)}
                    onRoll={() => {
                        if (!canInteractDice) return;
                        engineMoves.rollDice();
                    }}
                    onConfirm={() => {
                        if (!canInteractDice) return;
                        engineMoves.confirmRoll();
                    }}
                    showAdvancePhaseButton={showAdvancePhaseButton}
                    advanceLabel={advanceLabel}
                    isAdvanceButtonEnabled={canAdvancePhase}
                    onAdvance={handleAdvancePhase}
                    discardPileRef={discardPileRef}
                    discardCards={viewPlayer.discard}
                    cardAtlas={cardAtlas ?? undefined}
                    onInspectRecentCards={cardAtlas ? (cards) => setMagnifiedCards(cards) : undefined}
                    canUndoDiscard={canOperateView && !!G.lastSoldCardId && (currentPhase === 'main1' || currentPhase === 'main2' || currentPhase === 'discard')}
                    onUndoDiscard={() => {
                        setLastUndoCardId(G.lastSoldCardId);
                        engineMoves.undoSellCard?.();
                    }}
                    discardHighlighted={discardHighlighted}
                    sellButtonVisible={sellButtonVisible}
                    diceInteractionConfig={diceInteractionConfig}
                />
            </div>

            {cardAtlas && (() => {
                const mustDiscardCount = Math.max(0, handOwner.hand.length - HAND_LIMIT);
                const isDiscardMode = currentPhase === 'discard' && mustDiscardCount > 0 && canOperateView;
                return (
                    <>
                        <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none bg-gradient-to-t from-black/90 via-black/40 to-transparent h-[15vw]" />
                        {/* 游戏提示统一组件 */}
                        <GameHints
                            isDiscardMode={isDiscardMode}
                            mustDiscardCount={mustDiscardCount}
                            isDiceInteraction={!!isDiceInteraction}
                            isInteractionOwner={isInteractionOwner}
                            pendingInteraction={pendingInteraction}
                            isWaitingOpponent={isWaitingOpponent}
                            opponentName={opponentName}
                            isResponder={isResponder}
                            thinkingOffsetClass={thinkingOffsetClass}
                            onResponsePass={() => engineMoves.responsePass()}
                            currentPhase={currentPhase}
                        />
                        <HandArea
                            hand={handOwner.hand}
                            locale={locale}
                            atlas={cardAtlas}
                            currentPhase={currentPhase}
                            playerCp={handOwner.resources[RESOURCE_IDS.CP] ?? 0}
                            onPlayCard={(cardId) => engineMoves.playCard(cardId)}
                            onSellCard={(cardId) => engineMoves.sellCard(cardId)}
                            onError={(msg) => toast.warning(msg)}
                            canInteract={isResponder || isSelfView}
                            canPlayCards={isActivePlayer || isResponder}
                            drawDeckRef={drawDeckRef}
                            discardPileRef={discardPileRef}
                            undoCardId={lastUndoCardId}
                            onSellHintChange={setDiscardHighlighted}
                            onPlayHintChange={setCoreAreaHighlighted}
                            onSellButtonChange={setSellButtonVisible}
                            isDiscardMode={isDiscardMode}
                            onDiscardCard={(cardId) => engineMoves.sellCard(cardId)}
                        />
                    </>
                );
            })()}

            <BoardOverlays
                // 放大预览
                isMagnifyOpen={isMagnifyOpen}
                magnifiedImage={magnify.image}
                magnifiedCard={magnify.card}
                magnifiedCards={magnify.cards}
                onCloseMagnify={closeMagnify}
                
                // 弹窗状态
                isConfirmingSkip={modals.confirmSkip}
                onConfirmSkip={() => {
                    closeModal('confirmSkip');
                    engineMoves.advancePhase();
                }}
                onCancelSkip={() => closeModal('confirmSkip')}
                
                isPurifyModalOpen={modals.purify}
                onConfirmPurify={(statusId) => {
                    engineMoves.usePurify(statusId);
                    closeModal('purify');
                }}
                onCancelPurify={() => closeModal('purify')}
                
                isConfirmRemoveStunOpen={modals.removeStun}
                onConfirmRemoveStun={() => {
                    closeModal('removeStun');
                    engineMoves.payToRemoveStun();
                }}
                onCancelRemoveStun={() => closeModal('removeStun')}
                
                // 选择弹窗
                choice={choice}
                canResolveChoice={canResolveChoice}
                onResolveChoice={(optionId) => {
                    const promptMove = (moves as Record<string, unknown>)[PROMPT_COMMANDS.RESPOND];
                    if (typeof promptMove === 'function') {
                        (promptMove as (payload: { optionId: string }) => void)({ optionId });
                    }
                }}
                
                // 卡牌特写
                cardSpotlightQueue={cardSpotlightQueue}
                onCardSpotlightClose={handleCardSpotlightClose}
                opponentHeaderRef={opponentHeaderRef}
                
                // 额外骰子
                bonusDieValue={bonusDie.value}
                bonusDieFace={bonusDie.face}
                showBonusDie={bonusDie.show}
                onBonusDieClose={handleBonusDieClose}
                
                // Token 响应
                pendingDamage={pendingDamage}
                tokenResponsePhase={tokenResponsePhase}
                isTokenResponder={!!isTokenResponder}
                tokenDefinitions={G.tokenDefinitions}
                onUseToken={(tokenId, amount) => engineMoves.useToken(tokenId, amount)}
                onSkipTokenResponse={() => engineMoves.skipTokenResponse()}
                
                // 交互覆盖层
                isStatusInteraction={isStatusInteraction}
                pendingInteraction={pendingInteraction}
                players={G.players}
                currentPlayerId={rootPid}
                onSelectStatus={handleSelectStatus}
                onSelectPlayer={handleSelectPlayer}
                onConfirmStatusInteraction={handleStatusInteractionConfirm}
                onCancelInteraction={handleCancelInteraction}
                
                // 净化相关
                viewPlayer={viewPlayer}
                purifiableStatusIds={purifiableStatusIds}
                
                // 游戏结束
                isGameOver={!!isGameOver}
                gameoverResult={isGameOver}
                playerID={playerID}
                reset={reset}
                rematchState={rematchState}
                onRematchVote={handleRematchVote}
                
                // 其他
                cardAtlas={cardAtlas ?? undefined}
                statusIconAtlas={statusIconAtlas}
                locale={locale}
                moves={moves as Record<string, unknown>}
            />
        </div>
        </UndoProvider>
    );
};

export default DiceThroneBoard;
