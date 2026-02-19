import React from 'react';
import type { GameBoardProps } from '../../engine/transport/protocol';

import { HAND_LIMIT, type TokenResponsePhase } from './domain/types';
import type { MatchState } from '../../engine/types';
import { RESOURCE_IDS } from './domain/resources';
import { STATUS_IDS, TOKEN_IDS } from './domain/ids';
import type { DiceThroneCore } from './domain';
import type { InteractionDescriptor } from './domain/types';
import { getUsableTokensForTiming } from './domain/tokenResponse';
import { isCardPlayableInResponseWindow } from './domain/rules';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { GameDebugPanel } from '../../components/game/framework/widgets/GameDebugPanel';
import { DiceThroneDebugConfig } from './debug-config';
import { getElementCenter } from '../../components/common/animations/FlyingEffect';
import { usePulseGlow } from '../../components/common/animations/PulseGlow';
import { useImpactFeedback } from '../../components/common/animations';
import { useFxBus, FxLayer } from '../../engine/fx';
import { diceThroneFxRegistry } from './ui/fxSetup';
import { useToast } from '../../contexts/ToastContext';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';
import { loadStatusAtlases, type StatusAtlases } from './ui/statusEffects';
import { getAbilitySlotId } from './ui/AbilityOverlays';
import type { AbilityOverlaysHandle } from './ui/AbilityOverlays';
import { HandArea } from './ui/HandArea';
import { loadCardAtlasConfig } from './ui/cardAtlas';

import { DiceThroneCharacterSelection } from './ui/CharacterSelectionAdapter';
import { TutorialSelectionGate } from '../../components/game/framework';
import { OpponentHeader } from './ui/OpponentHeader';
import { LeftSidebar } from './ui/LeftSidebar';
import { CenterBoard } from './ui/CenterBoard';
import { playSound as playSoundFn } from '../../lib/audio/useGameAudio';
import { RightSidebar } from './ui/RightSidebar';
import { BoardOverlays } from './ui/BoardOverlays';
import { GameHints } from './ui/GameHints';
import { registerCardAtlasSource } from '../../components/common/media/CardPreview';
import { useRematch } from '../../contexts/RematchContext';
import { useGameMode } from '../../contexts/GameModeContext';
import { useCurrentChoice, useDiceThroneState } from './hooks/useDiceThroneState';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { diceModifyReducer, diceModifyToCommands, diceSelectReducer, diceSelectToCommands } from './domain/systems';
// 引擎层 Hooks
import { useSpectatorMoves } from '../../engine';
// 游戏特定 Hooks
import { useInteractionState } from './hooks/useInteractionState';
import { useAnimationEffects } from './hooks/useAnimationEffects';
import { useCardSpotlight } from './hooks/useCardSpotlight';
import { useActiveModifiers } from './hooks/useActiveModifiers';
import { useUIState } from './hooks/useUIState';
import { useDiceThroneAudio } from './hooks/useDiceThroneAudio';
import { playDeniedSound } from '../../lib/audio/useGameAudio';
import { computeViewModeState } from './ui/viewMode';
import { resolveMoves, type DiceThroneMoveMap } from './ui/resolveMoves';
import { LayoutSaveButton } from './ui/LayoutSaveButton';
import { useAutoSkipSelection } from './hooks/useAutoSkipSelection';
import { useAttackShowcase } from './hooks/useAttackShowcase';
import { AttackShowcaseOverlay } from './ui/AttackShowcaseOverlay';
import { getPlayerPassiveAbilities, isPassiveActionUsable } from './domain/passiveAbility';

type DiceThroneMatchState = MatchState<DiceThroneCore>;
type DiceThroneBoardProps = GameBoardProps<DiceThroneCore>;

/** 教程 targetId → 对应的命令类型映射（用于白名单放行） */
const TUTORIAL_TARGET_COMMAND_MAP: Record<string, string[]> = {
    'advance-phase-button': ['ADVANCE_PHASE'],
    'ability-slots': ['SELECT_ABILITY'],
    'dice-roll-button': ['ROLL_DICE'],
    'dice-confirm-button': ['CONFIRM_ROLL'],
    'discard-pile': ['SELL_CARD', 'UNDO_SELL_CARD'],
    'hand-area': ['PLAY_CARD', 'SELL_CARD', 'MODIFY_DIE'],
};

// --- Main Layout ---
export const DiceThroneBoard: React.FC<DiceThroneBoardProps> = ({ G: rawG, dispatch, playerID, reset, matchData, isMultiplayer }) => {
    const G = rawG.core;
    const access = useDiceThroneState(rawG);
    const choice = useCurrentChoice(access);
    const gameMode = useGameMode();
    const isSpectator = !!gameMode?.isSpectator;

    // 使用引擎层 useSpectatorMoves Hook 自动拦截观察者操作
    const engineMoves = useSpectatorMoves(
        resolveMoves(dispatch),
        isSpectator,
        playerID || undefined,
        { logPrefix: 'Spectate[DiceThrone]' }
    ) as DiceThroneMoveMap;
    const { t, i18n } = useTranslation('game-dicethrone');
    useTutorialBridge(rawG.sys.tutorial, dispatch);
    const { isActive: isTutorialActive, currentStep: tutorialStep, nextStep: nextTutorialStep } = useTutorial();
    const toast = useToast();
    const locale = i18n.resolvedLanguage ?? i18n.language;

    const isGameOver = rawG.sys.gameover;
    const rootPid = playerID || '0';
    const player = G.players[rootPid] || G.players['0'];
    const otherPid = Object.keys(G.players).find(id => id !== rootPid) || '1';
    const opponent = G.players[otherPid];
    // 获取对手用户名
    const opponentName = matchData?.find(p => String(p.id) === otherPid)?.name ?? t('common.opponent');

    // 从 access.turnPhase 读取阶段（单一权威：来自 sys.phase）
    const currentPhase = access.turnPhase;

    // 重赛系统（socket）
    const { state: rematchState, vote: handleRematchVote, registerReset } = useRematch();

    // 注册 reset 回调（当双方都投票后由 socket 触发）
    React.useEffect(() => {
        if (!isSpectator && reset) {
            registerReset(reset);
        }
    }, [reset, registerReset, isSpectator]);

    useAutoSkipSelection({
        currentPhase,
        isSpectator,
        gameMode,
        rootPid,
        selectedCharacters: G.selectedCharacters,
        hostPlayerId: G.hostPlayerId,
        hostStarted: G.hostStarted,
        readyPlayers: G.readyPlayers,
        engineMoves,
    });


    // 判断游戏结果
    const isWinner = isGameOver && isGameOver?.winner === rootPid;

    // 获取所有玩家名称映射
    const playerNames = React.useMemo(() => {
        const names: Record<string, string> = {};
        Object.keys(G.players).forEach(pid => {
            names[pid] = matchData?.find(p => String(p.id) === pid)?.name ?? t('common.opponent');
        });
        return names;
    }, [G.players, matchData, t]);

    // 音频系统
    useDiceThroneAudio({
        G,
        rawState: rawG,
        currentPlayerId: playerID ?? undefined,
        currentPhase,
        isGameOver: !!isGameOver,
        isWinner,
    });

    // 使用 useUIState Hook 整合20+个分散的UI状态
    const {
        magnify,
        isMagnifyOpen,
        setMagnifiedImage,
        setMagnifiedCards,
        closeMagnify,
        modals,
        openModal,
        closeModal,
        viewMode: manualViewMode,
        setViewMode,
        toggleViewMode,
        isLayoutEditing,
        toggleLayoutEditing,
        isTipOpen,
        toggleTip,
        headerError,
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
    const [_cardAtlasRevision, setCardAtlasRevision] = React.useState(0);
    const [statusIconAtlas, setStatusIconAtlas] = React.useState<StatusAtlases | null>(null);

    // 使用 useCardSpotlight Hook 管理卡牌和额外骰子特写
    const {
        cardSpotlightQueue,
        handleCardSpotlightClose,
        bonusDie,
        handleBonusDieClose,
    } = useCardSpotlight({
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
        currentPlayerId: rootPid,
        opponentName,
        isSpectator,
        selectedCharacters: G.selectedCharacters,
    });

    // 追踪已激活的攻击修正卡
    const { activeModifiers } = useActiveModifiers({
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
    });

    // 防御阶段进攻技能特写
    const attackerAbilityLevels = React.useMemo(() => {
        const result: Record<string, Record<string, number>> = {};
        for (const pid of Object.keys(G.players)) {
            result[pid] = G.players[pid]?.abilityLevels ?? {};
        }
        return result;
    }, [G.players]);

    const {
        isShowcaseVisible: isAttackShowcaseVisible,
        showcaseData: attackShowcaseData,
        dismissShowcase: dismissAttackShowcase,
    } = useAttackShowcase({
        currentPhase,
        currentPlayerId: rootPid,
        isSpectator,
        selectedCharacters: G.selectedCharacters,
        abilityLevels: attackerAbilityLevels,
        pendingAttack: G.pendingAttack ?? null,
    });

    // 使用 FX 引擎
    const fxBus = useFxBus(diceThroneFxRegistry, {
        playSound: (key) => {
            // 音效由 FeedbackPack 自动触发，这里只是注入播放函数
            playSoundFn(key);
        },
        triggerShake: (_intensity, _type) => {
            // 受击反馈现在由 onEffectImpact 根据目标 playerId 精确触发，
            // 不再在全局 triggerShake 中触发（无法区分目标）
        },
    });
    const opponentImpact = useImpactFeedback();
    const selfImpact = useImpactFeedback();
    const { triggerGlow: triggerAbilityGlow } = usePulseGlow(800);

    // DOM 引用
    const opponentHpRef = React.useRef<HTMLDivElement>(null);
    const selfHpRef = React.useRef<HTMLDivElement>(null);
    const opponentCpRef = React.useRef<HTMLDivElement>(null);
    const selfCpRef = React.useRef<HTMLDivElement>(null);
    const opponentBuffRef = React.useRef<HTMLDivElement>(null);
    const opponentHeaderRef = React.useRef<HTMLDivElement>(null);
    const selfBuffRef = React.useRef<HTMLDivElement>(null);
    const drawDeckRef = React.useRef<HTMLDivElement>(null);
    const discardPileRef = React.useRef<HTMLDivElement>(null);
    const abilityOverlaysRef = React.useRef<AbilityOverlaysHandle>(null);

    // 使用 useInteractionState Hook 管理交互状态（从 sys.interaction 读取）
    const sysInteraction = rawG.sys.interaction?.current;
    const pendingInteraction: InteractionDescriptor | undefined = sysInteraction?.kind === 'dt:card-interaction'
        ? sysInteraction.data as InteractionDescriptor
        : undefined;
    const { localState: localInteraction, handlers: interactionHandlers } = useInteractionState(pendingInteraction);

    // 骰子多步交互（multistep-choice，替代旧的 dt:card-interaction 骰子类型）
    // 注意：MultistepChoiceData 里的函数（localReducer/toCommands）经过 JSON 序列化后会丢失，
    // 必须在客户端根据 meta 重新注入，不能依赖从服务端传来的 data 字段。
    const diceMultistepInteraction = React.useMemo(() => {
        if (sysInteraction?.kind !== 'multistep-choice') return undefined;
        const meta = (sysInteraction.data as any)?.meta;
        if (!meta) return undefined;

        if (meta.dtType === 'modifyDie') {
            const config = meta.dieModifyConfig;
            return {
                ...sysInteraction,
                data: {
                    ...sysInteraction.data,
                    localReducer: (current: unknown, step: unknown) =>
                        diceModifyReducer(current as any, step as DiceModifyStep, config),
                    toCommands: diceModifyToCommands,
                },
            };
        }

        if (meta.dtType === 'selectDie') {
            return {
                ...sysInteraction,
                data: {
                    ...sysInteraction.data,
                    localReducer: (current: unknown, step: unknown) =>
                        diceSelectReducer(current as any, step as DiceSelectStep),
                    toCommands: diceSelectToCommands,
                },
            };
        }

        return undefined;
    }, [sysInteraction]);

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

    // 领域层计算当前阶段可用的 Token 列表（唯一数据源）
    const usableTokens = React.useMemo(() => {
        if (!pendingDamage) return [];
        return getUsableTokensForTiming(G, pendingDamage.responderId, pendingDamage.responseType);
    }, [G, pendingDamage]);

    const isActivePlayer = G.activePlayerId === rootPid;
    const { rollerId, shouldAutoObserve, viewMode, isSelfView } = computeViewModeState({
        currentPhase,
        pendingAttack: G.pendingAttack,
        activePlayerId: G.activePlayerId,
        rootPlayerId: rootPid,
        manualViewMode,
    });
    const viewPid = isSelfView ? rootPid : otherPid;
    const viewPlayer = (isSelfView ? player : opponent) || player;
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
    const isViewRolling = viewPid === rollerId;
    const rollConfirmed = G.rollConfirmed;
    // availableAbilityIds 现在是派生状态，从 useDiceThroneState hook 中获取
    const availableAbilityIds = isViewRolling ? access.availableAbilityIds : [];
    const availableAbilityIdsForRoller = access.availableAbilityIds;
    const selectedAbilityId = currentPhase === 'defensiveRoll'
        ? (isViewRolling ? G.pendingAttack?.defenseAbilityId : undefined)
        : (isViewRolling ? G.pendingAttack?.sourceAbilityId : undefined);
    const canOperateView = isSelfView && !isSpectator;
    const hasRolled = G.rollCount > 0;

    // 焦点玩家判断（统一的操作权判断）
    const isFocusPlayer = !isSpectator && access.focusPlayerId === rootPid;
    const _hasPendingInteraction = Boolean(pendingInteraction);
    // 阶段推进权限：从 useDiceThroneState 获取（领域校验 + 交互判断），叠加焦点玩家判断
    // 进攻技能特写期间阻止所有操作
    const canAdvancePhase = isFocusPlayer && access.canAdvancePhase && !isAttackShowcaseVisible;
    const canResolveChoice = Boolean(choice.hasChoice && choice.playerId === rootPid);
    const canInteractDice = canOperateView && isViewRolling && !isAttackShowcaseVisible;

    // 防御阶段进入时就应高亮可用的防御技能，不需要等投骰
    const canHighlightAbility = canOperateView && isViewRolling && isRollPhase
        && (currentPhase === 'defensiveRoll' || hasRolled) && !isAttackShowcaseVisible;
    const canSelectAbility = canOperateView && isViewRolling && isRollPhase
        && (currentPhase === 'defensiveRoll' ? true : G.rollConfirmed) && !isAttackShowcaseVisible;

    // 响应窗口状态
    const responseWindow = access.responseWindow;
    const isResponseWindowOpen = !!responseWindow;
    // 当前响应者 ID（从队列中获取）
    const currentResponderId = responseWindow?.responderQueue[responseWindow.currentResponderIndex];
    const isResponder = isResponseWindowOpen && currentResponderId === rootPid;

    // 自己的手牌永远显示
    const handOwner = player;

    // 计算响应窗口中可响应的卡牌 ID 集合（用于高亮）
    const respondableCardIds = React.useMemo(() => {
        if (!isResponseWindowOpen || !isResponder || !responseWindow?.windowType) return undefined;
        const cardIds = new Set<string>();
        for (const card of handOwner.hand) {
            if (isCardPlayableInResponseWindow(G, rootPid, card, responseWindow.windowType, currentPhase)) {
                cardIds.add(card.id);
            }
        }
        return cardIds.size > 0 ? cardIds : undefined;
    }, [isResponseWindowOpen, isResponder, responseWindow?.windowType, handOwner.hand, G, rootPid, currentPhase]);

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
            console.warn('[Board] offline auto-pass triggered', { isResponderOffline, isActivePlayer, currentResponderId, rootPid });
            // 延迟一小段时间确保 UI 状态同步
            const timer = setTimeout(() => {
                engineMoves.responsePass(currentResponderId);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isResponderOffline, isActivePlayer, currentResponderId, rootPid, engineMoves]);

    // 教学模式：若响应窗口轮到“非本地玩家”，自动跳过，避免卡在对手思考中
    React.useEffect(() => {
        if (gameMode?.mode !== 'tutorial') return;
        if (!isResponseWindowOpen || !currentResponderId || currentResponderId === rootPid) return;
        console.warn('[Board] tutorial auto-pass triggered', { gameMode: gameMode?.mode, currentResponderId, rootPid });
        const timer = setTimeout(() => {
            engineMoves.responsePass(currentResponderId);
        }, 100);
        return () => clearTimeout(timer);
    }, [gameMode?.mode, isResponseWindowOpen, currentResponderId, rootPid, engineMoves]);
    const showAdvancePhaseButton = isSelfView && !isSpectator;
    const handleCancelInteraction = React.useCallback(() => {
        if (pendingInteraction?.sourceCardId) {
            setLastUndoCardId(pendingInteraction.sourceCardId);
        }
        // 使用 InteractionSystem 的 CANCEL 命令取消当前交互
        dispatch(INTERACTION_COMMANDS.CANCEL, {});
    }, [dispatch, pendingInteraction, setLastUndoCardId]);

    // 骰子交互配置（需要在 waitingReason 之前定义）
    // 骰子交互现在走 multistep-choice，不再走 dt:card-interaction
    const isDiceInteraction = !!diceMultistepInteraction;
    // 只有交互所有者才能看到交互 UI
    const isInteractionOwner = !isSpectator && (
        pendingInteraction?.playerId === rootPid ||
        (diceMultistepInteraction as any)?.playerId === rootPid
    );

    // 等待对方思考（isFocusPlayer 已在上方定义）
    const isWaitingOpponent = !isFocusPlayer;
    const thinkingOffsetClass = 'bottom-[12vw]';

    // 可被净化移除的负面状态：由定义驱动（支持扩展）
    const purifiableStatusIds = (G.tokenDefinitions ?? [])
        .filter(def => def.category === 'debuff' && def.passiveTrigger?.removable)
        .map(def => def.id);

    // 是否可以使用净化（有净化 Token 且有可移除的负面状态）
    const canUsePurify = !isSpectator && (player.tokens?.[TOKEN_IDS.PURIFY] ?? 0) > 0 &&
        Object.entries(player.statusEffects ?? {}).some(([id, stacks]) => purifiableStatusIds.includes(id) && stacks > 0);

    // 是否可以移除击倒（有击倒状态且 CP >= 2 且在 offensiveRoll 前的阶段）
    const canRemoveKnockdown = !isSpectator && isActivePlayer &&
        (currentPhase === 'upkeep' || currentPhase === 'income' || currentPhase === 'main1') &&
        (player.statusEffects?.[STATUS_IDS.KNOCKDOWN] ?? 0) > 0 &&
        (player.resources?.[RESOURCE_IDS.CP] ?? 0) >= 2;

    // ========== 被动能力（如教皇税）==========
    const [rerollSelectingAction, setRerollSelectingAction] = React.useState<{ passiveId: string; actionIndex: number } | null>(null);

    const playerPassives = React.useMemo(
        () => getPlayerPassiveAbilities(G, rootPid),
        [G, rootPid]
    );

    const passiveActionUsability = React.useMemo(() => {
        const map = new Map<string, boolean[]>();
        for (const passive of playerPassives) {
            const usability = passive.actions.map((_, idx) =>
                !isSpectator && isPassiveActionUsable(G, rootPid, passive.id, idx, currentPhase)
            );
            map.set(passive.id, usability);
        }
        return map;
    }, [playerPassives, G, rootPid, currentPhase, isSpectator]);

    const handlePassiveActionClick = React.useCallback((passiveId: string, actionIndex: number) => {
        const passive = playerPassives.find(p => p.id === passiveId);
        if (!passive) return;
        const action = passive.actions[actionIndex];
        if (!action) return;

        if (action.type === 'rerollDie') {
            // 进入骰子选择模式
            setRerollSelectingAction({ passiveId, actionIndex });
        } else if (action.type === 'drawCard') {
            // 直接执行抽牌
            engineMoves.usePassiveAbility(passiveId, actionIndex);
        }
    }, [playerPassives, engineMoves]);

    // 被动重掷：骰子选择回调
    const handlePassiveRerollDieSelect = React.useCallback((dieId: number) => {
        if (!rerollSelectingAction) return;
        engineMoves.usePassiveAbility(
            rerollSelectingAction.passiveId,
            rerollSelectingAction.actionIndex,
            dieId
        );
        setRerollSelectingAction(null);
        setRerollingDiceIds([dieId]);
        setTimeout(() => setRerollingDiceIds([]), 600);
    }, [rerollSelectingAction, engineMoves, setRerollingDiceIds]);

    const passiveAbilityProps = React.useMemo(() => {
        if (playerPassives.length === 0) return null;
        return {
            passives: playerPassives,
            actionUsability: passiveActionUsability,
            currentCp: player.resources[RESOURCE_IDS.CP] ?? 0,
            rerollSelectingAction,
            onActionClick: handlePassiveActionClick,
            onCancelRerollSelect: () => setRerollSelectingAction(null),
        };
    }, [playerPassives, passiveActionUsability, player.resources, rerollSelectingAction, handlePassiveActionClick]);

    // 状态效果/玩家交互配置
    const isStatusInteraction = pendingInteraction && (
        pendingInteraction.type === 'selectStatus' ||
        pendingInteraction.type === 'selectPlayer' ||
        pendingInteraction.type === 'selectTargetStatus'
    );

    const handleSelectStatus = interactionHandlers.selectStatus;
    const handleSelectPlayer = interactionHandlers.selectPlayer;

    const statusInteraction = React.useMemo(() => {
        if (!pendingInteraction || !isStatusInteraction) return pendingInteraction;

        let interaction = pendingInteraction;
        if (pendingInteraction.type === 'selectStatus' && pendingInteraction.transferConfig && localInteraction.selectedStatus) {
            interaction = {
                ...pendingInteraction,
                type: 'selectTargetStatus',
                transferConfig: {
                    ...pendingInteraction.transferConfig,
                    sourcePlayerId: localInteraction.selectedStatus.playerId,
                    statusId: localInteraction.selectedStatus.statusId,
                },
            };
        }

        const selected = (() => {
            if (interaction.type === 'selectPlayer') {
                return localInteraction.selectedPlayer
                    ? [localInteraction.selectedPlayer]
                    : (interaction.selected ?? []);
            }
            if (interaction.type === 'selectTargetStatus' && interaction.transferConfig?.statusId) {
                return localInteraction.selectedPlayer
                    ? [localInteraction.selectedPlayer]
                    : (interaction.selected ?? []);
            }
            if (interaction.type === 'selectStatus' || interaction.type === 'selectTargetStatus') {
                return localInteraction.selectedStatus
                    ? [localInteraction.selectedStatus.statusId]
                    : (interaction.selected ?? []);
            }
            return interaction.selected ?? [];
        })();

        return {
            ...interaction,
            selected,
        };
    }, [
        pendingInteraction,
        isStatusInteraction,
        localInteraction.selectedPlayer,
        localInteraction.selectedStatus,
    ]);

    const handleStatusInteractionConfirm = () => {
        const activeInteraction = statusInteraction ?? pendingInteraction;
        if (!activeInteraction) return;

        if (activeInteraction.type === 'selectStatus') {
            // 移除单个状态
            if (localInteraction.selectedStatus) {
                engineMoves.removeStatus(
                    localInteraction.selectedStatus.playerId,
                    localInteraction.selectedStatus.statusId
                );
            }
        } else if (activeInteraction.type === 'selectPlayer') {
            // 移除玩家所有状态
            if (localInteraction.selectedPlayer) {
                engineMoves.removeStatus(localInteraction.selectedPlayer);
            }
        } else if (activeInteraction.type === 'selectTargetStatus') {
            // 转移状态
            const transferConfig = activeInteraction.transferConfig;
            if (transferConfig?.sourcePlayerId && transferConfig?.statusId && localInteraction.selectedPlayer) {
                engineMoves.transferStatus(
                    transferConfig.sourcePlayerId,
                    localInteraction.selectedPlayer,
                    transferConfig.statusId
                );
            } else {
                return;
            }
        }
        // REMOVE_STATUS 和 TRANSFER_STATUS 命令会自动生成 INTERACTION_COMPLETED 事件清理交互
    };

    const getAbilityStartPos = React.useCallback((abilityId?: string) => {
        if (!abilityId) return getElementCenter(opponentHeaderRef.current);
        const slotId = getAbilitySlotId(abilityId);
        if (!slotId) return getElementCenter(opponentHeaderRef.current);
        const element = document.querySelector(`[data-ability-slot="${slotId}"]`) as HTMLElement | null;
        // 技能槽在 DOM 中存在 → 从技能槽飞出（自己的技能）
        // 技能槽不存在 → 说明是对手的技能，从对手悬浮窗飞出
        return element ? getElementCenter(element) : getElementCenter(opponentHeaderRef.current);
    }, [opponentHeaderRef]);

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

    // 提取对局中所有英雄 ID（稳定引用，避免 G.players 引用变化导致重复加载）
    const heroCharIds = React.useMemo(() => {
        const ids: string[] = [];
        for (const pid of Object.keys(G.players)) {
            const charId = G.players[pid]?.characterId;
            if (charId && charId !== 'unselected' && !ids.includes(charId)) ids.push(charId);
        }
        return ids.sort().join(',');
    }, [G.players]);

    // 动态加载对局中所有英雄的卡牌图集
    React.useEffect(() => {
        if (!heroCharIds) return;
        let isActive = true;
        const loadAtlas = async (atlasId: string, imageBase: string) => {
            try {
                const config = await loadCardAtlasConfig();
                if (!isActive) return;
                registerCardAtlasSource(atlasId, {
                    image: imageBase,
                    config,
                });
                setCardAtlasRevision(prev => prev + 1);
            } catch {
                // 忽略单个图集加载失败
            }
        };

        for (const charId of heroCharIds.split(',')) {
            const atlasId = `dicethrone:${charId}-cards`;
            // imageBase 始终不带扩展名，用于 buildLocalizedImageSet
            const imageBase = `dicethrone/images/${charId}/ability-cards`;
            void loadAtlas(atlasId, imageBase);
        }

        return () => {
            isActive = false;
        };
    }, [heroCharIds]);

    React.useEffect(() => {
        let isActive = true;
        loadStatusAtlases(locale)
            .then((config) => {
                if (isActive) setStatusIconAtlas(config);
            })
            .catch(() => {
                if (isActive) setStatusIconAtlas(null);
            });
        return () => {
            isActive = false;
        };
    }, [locale]);

    const shouldBlockTutorialAction = React.useCallback((targetId: string) => {
        if (!isTutorialActive || !tutorialStep?.requireAction) return false;
        // highlightTarget 匹配 → 不拦截
        if (!tutorialStep.highlightTarget || tutorialStep.highlightTarget === targetId) return false;
        // allowedCommands 白名单包含该 targetId 对应的命令 → 不拦截
        const commands = TUTORIAL_TARGET_COMMAND_MAP[targetId];
        if (commands && tutorialStep.allowedCommands?.some(cmd => commands.includes(cmd))) return false;
        return true;
    }, [isTutorialActive, tutorialStep]);

    const advanceTutorialIfNeeded = React.useCallback((targetId: string) => {
        if (
            isTutorialActive
            && tutorialStep?.requireAction
            && tutorialStep.highlightTarget === targetId
        ) {
            nextTutorialStep();
        }
    }, [isTutorialActive, tutorialStep, nextTutorialStep]);

    const handleAdvancePhase = () => {
        if (!canAdvancePhase) {
            if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
                showHeaderError(t('error.confirmRoll'));
            } else if (currentPhase === 'defensiveRoll' && !G.rollConfirmed) {
                showHeaderError(t('error.confirmDefenseRoll'));
            }
            return;
        }
        if (shouldBlockTutorialAction('advance-phase-button')) return;
        if (currentPhase === 'offensiveRoll') {
            const hasSelectedAbility = Boolean(G.pendingAttack?.sourceAbilityId);
            const hasAvailableAbilities = availableAbilityIdsForRoller.length > 0;
            // 只有已经投过骰子后才弹出确认跳过弹窗
            // 未投骰子时直接跳过（如眩晕状态），不需要确认
            const shouldConfirmSkip = hasRolled && !hasSelectedAbility && (!G.rollConfirmed || hasAvailableAbilities);
            if (shouldConfirmSkip) {
                openModal('confirmSkip');
                return;
            }
        }
        engineMoves.advancePhase();
        advanceTutorialIfNeeded('advance-phase-button');
    };

    // 弃牌阶段：只有手牌不超限时才自动推进（upkeep/income 已由引擎层 onAutoContinueCheck 处理）
    React.useEffect(() => {
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
                setViewMode('self');
            }
            return;
        }
        if (currentPhase === 'offensiveRoll' && isActivePlayer) setViewMode('self');
    }, [currentPhase, isActivePlayer, rollerId, rootPid, setViewMode]);

    React.useEffect(() => {
        const sourceAbilityId = G.activatingAbilityId ?? G.pendingAttack?.sourceAbilityId;
        if (!sourceAbilityId) return;
        setActivatingAbilityId(sourceAbilityId);
        triggerAbilityGlow();
        const timer = setTimeout(() => setActivatingAbilityId(undefined), 800);
        return () => clearTimeout(timer);
    }, [G.activatingAbilityId, G.pendingAttack?.sourceAbilityId, triggerAbilityGlow]);

    // 使用 useAnimationEffects Hook 管理飞行动画效果（基于 FX 引擎）
    // 事件流消费采用模式 A（单一游标），统一处理伤害/治疗等事件
    const { damageBuffer, fxImpactMapRef, advanceQueue } = useAnimationEffects({
        fxBus,
        players: { player, opponent },
        currentPlayerId: rootPid,
        opponentId: otherPid,
        refs: {
            opponentHp: opponentHpRef,
            selfHp: selfHpRef,
            opponentCp: opponentCpRef,
            selfCp: selfCpRef,
            opponentBuff: opponentBuffRef,
            selfBuff: selfBuffRef,
            opponentHeader: opponentHeaderRef,
        },
        getEffectStartPos,
        getAbilityStartPos,
        locale,
        statusIconAtlas,
        eventStreamEntries: rawG.sys.eventStream?.entries ?? [],
    });

    const advanceLabel = currentPhase === 'offensiveRoll'
        ? t('actions.resolveAttack')
        : currentPhase === 'defensiveRoll'
            ? t('actions.endDefense')
            : t('actions.nextPhase');

    if (!player) return <div className="p-10 text-white">{t('status.loadingGameState', { playerId: rootPid })}</div>;

    // --- Setup 阶段：仅渲染全屏选角界面 ---
    if (currentPhase === 'setup') {
        return (
            <TutorialSelectionGate
                isTutorialMode={gameMode?.mode === 'tutorial'}
                isTutorialActive={isTutorialActive}
                containerClassName="bg-[#0F0F23] text-white"
                textClassName="text-[1.5vw] font-bold"
            >
                <UndoProvider value={{ G: rawG, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: !isMultiplayer }}>
                    <div className="relative w-full h-dvh bg-[#0a0a0c] overflow-hidden font-sans select-none">
                        <DiceThroneCharacterSelection
                            isOpen={true}
                            currentPlayerId={rootPid}
                            hostPlayerId={G.hostPlayerId}
                            selectedCharacters={G.selectedCharacters}
                            readyPlayers={G.readyPlayers ?? {}}
                            playerNames={playerNames}
                            onSelect={engineMoves.selectCharacter}
                            onReady={engineMoves.playerReady}
                            onStart={engineMoves.hostStartGame}
                            locale={locale}
                        />
                    </div>
                </UndoProvider>
            </TutorialSelectionGate>
        );
    }

    // --- 游戏进行阶段：渲染完整棋盘 UI ---
    return (
        <UndoProvider value={{ G: rawG, dispatch, playerID, isGameOver: !!isGameOver, isLocalMode: !isMultiplayer }}>
            <div className="relative w-full h-dvh bg-black overflow-hidden font-sans select-none text-slate-200">
                {!isSpectator && (
                    <GameDebugPanel G={rawG} dispatch={dispatch} playerID={playerID}>
                        {/* DiceThrone 专属作弊工具 */}
                        <DiceThroneDebugConfig G={rawG} dispatch={dispatch} />

                        {/* 测试工具 */}
                        <div className="pt-4 border-t border-gray-200 mt-4 space-y-3">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">测试工具</h4>
                            <button
                                onClick={toggleLayoutEditing}
                                className={`w-full py-2 rounded font-bold text-xs border transition-[background-color] duration-200 ${isLayoutEditing ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {isLayoutEditing ? t('layout.exitEdit') : t('layout.enterEdit')}
                            </button>
                            {isLayoutEditing && (
                                <LayoutSaveButton abilityOverlaysRef={abilityOverlaysRef} />
                            )}
                        </div>
                    </GameDebugPanel>
                )}

                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-black/40 z-10 pointer-events-none" />
                    <OptimizedImage
                        src="dicethrone/images/Common/background"
                        locale={locale}
                        className="w-full h-full object-cover"
                        alt={t('imageAlt.background')}
                    />
                </div>

                {opponent && (
                    <OpponentHeader
                        opponent={opponent}
                        opponentName={opponentName}
                        viewMode={viewMode}
                        isOpponentShaking={opponentImpact.shake.isShaking}
                        hitStopActive={opponentImpact.hitStop.isActive}
                        hitStopConfig={opponentImpact.hitStop.config}
                        shouldAutoObserve={shouldAutoObserve}
                        onToggleView={() => {
                            toggleViewMode();
                        }}
                        headerError={headerError}
                        opponentBuffRef={opponentBuffRef}
                        opponentHpRef={opponentHpRef}
                        opponentCpRef={opponentCpRef}
                        statusIconAtlas={statusIconAtlas}
                        locale={locale}
                        containerRef={opponentHeaderRef}
                        tokenDefinitions={G.tokenDefinitions}
                        damageFlashActive={opponentImpact.flash.isActive}
                        damageFlashDamage={opponentImpact.flash.damage}
                        overrideHp={damageBuffer.get(`hp-${otherPid}`, opponent.resources[RESOURCE_IDS.HP] ?? 0)}
                    />
                )}

                <FxLayer
                    bus={fxBus}
                    getCellPosition={() => ({ left: 0, top: 0, width: 0, height: 0 })}
                    onEffectImpact={(id) => {
                        // 飞行动画到达目标：释放对应 HP 冻结 + 触发受击反馈
                        const info = fxImpactMapRef.current.get(id);
                        if (info) {
                            // CP 步骤 bufferKey 为空，无需释放缓冲
                            if (info.bufferKey) {
                                damageBuffer.release([info.bufferKey]);
                            }
                            // 根据 bufferKey 判断目标，触发对应面板的受击反馈
                            if (info.damage > 0) {
                                const isOpponentHit = info.bufferKey === `hp-${otherPid}`;
                                if (isOpponentHit) {
                                    opponentImpact.trigger(info.damage);
                                } else {
                                    selfImpact.trigger(info.damage);
                                }
                            }
                            fxImpactMapRef.current.delete(id);
                        }
                    }}
                    onEffectComplete={(id) => {
                        // 动画完成：推进队列中的下一步（伤害→治疗序列化）
                        advanceQueue(id);
                    }}
                />
                <div className="absolute inset-x-0 top-[2vw] bottom-0 z-10 pointer-events-none">
                    <LeftSidebar
                        currentPhase={currentPhase}
                        viewPlayer={player} // Always show own stats
                        locale={locale}
                        statusIconAtlas={statusIconAtlas}
                        selfBuffRef={selfBuffRef}
                        selfHpRef={selfHpRef}
                        selfCpRef={selfCpRef}
                        hitStopActive={selfImpact.hitStop.isActive}
                        hitStopConfig={selfImpact.hitStop.config}
                        drawDeckRef={drawDeckRef}
                        onPurifyClick={() => openModal('purify')}
                        canUsePurify={canUsePurify}
                        tokenDefinitions={G.tokenDefinitions}
                        onKnockdownClick={() => openModal('removeKnockdown')}
                        canRemoveKnockdown={canRemoveKnockdown}
                        isSelfShaking={selfImpact.shake.isShaking}
                        selfDamageFlashActive={selfImpact.flash.isActive}
                        selfDamageFlashDamage={selfImpact.flash.damage}
                        overrideHp={damageBuffer.get(`hp-${rootPid}`, player.resources[RESOURCE_IDS.HP] ?? 0)}
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
                        onSelectAbility={(abilityId) => {
                            if (shouldBlockTutorialAction('ability-slots')) return;
                            engineMoves.selectAbility(abilityId);
                            advanceTutorialIfNeeded('ability-slots');
                        }}
                        onHighlightedAbilityClick={() => {
                            if (currentPhase === 'offensiveRoll' && !G.rollConfirmed) {
                                playDeniedSound();
                                toast.warning(t('error.confirmRoll'));
                            }
                        }}
                        selectedAbilityId={selectedAbilityId}
                        activatingAbilityId={activatingAbilityId}
                        abilityLevels={viewPlayer.abilityLevels}
                        characterId={viewPlayer.characterId}
                        locale={locale}
                        onMagnifyImage={(image) => setMagnifiedImage(image)}
                        abilityOverlaysRef={abilityOverlaysRef}
                        playerTokens={viewPlayer.tokens}
                    />

                    <RightSidebar
                        dice={G.dice}
                        rollCount={G.rollCount}
                        rollLimit={G.rollLimit}
                        rollConfirmed={rollConfirmed}
                        currentPhase={currentPhase}
                        canInteractDice={canInteractDice || !!rerollSelectingAction}
                        isRolling={isRolling}
                        setIsRolling={(rolling: boolean) => setIsRolling(rolling)}
                        rerollingDiceIds={rerollingDiceIds}
                        setRerollingDiceIds={setRerollingDiceIds}
                        locale={locale}
                        onToggleLock={(id) => {
                            // 被动重掷选择模式：点击骰子直接执行重掷
                            if (rerollSelectingAction) {
                                handlePassiveRerollDieSelect(id);
                                return;
                            }
                            engineMoves.toggleDieLock(id);
                        }}
                        onRoll={() => {
                            if (!canInteractDice) return;
                            if (shouldBlockTutorialAction('dice-roll-button')) return;
                            engineMoves.rollDice();
                            advanceTutorialIfNeeded('dice-roll-button');
                        }}
                        onConfirm={() => {
                            if (!canInteractDice) return;
                            if (shouldBlockTutorialAction('dice-confirm-button')) return;
                            engineMoves.confirmRoll();
                            advanceTutorialIfNeeded('dice-confirm-button');
                        }}
                        showAdvancePhaseButton={showAdvancePhaseButton}
                        advanceLabel={advanceLabel}
                        isAdvanceButtonEnabled={canAdvancePhase}
                        onAdvance={handleAdvancePhase}
                        discardPileRef={discardPileRef}
                        discardCards={viewPlayer.discard}
                        onInspectRecentCards={(cards) => setMagnifiedCards(cards)}
                        canUndoDiscard={canOperateView && !!G.lastSoldCardId && (currentPhase === 'main1' || currentPhase === 'main2' || currentPhase === 'discard')}
                        onUndoDiscard={() => {
                            setLastUndoCardId(G.lastSoldCardId);
                            engineMoves.undoSellCard?.();
                        }}
                        discardHighlighted={discardHighlighted}
                        sellButtonVisible={sellButtonVisible}
                        interaction={diceMultistepInteraction ?? pendingInteraction}
                        dispatch={dispatch}
                        activeModifiers={activeModifiers}
                        passiveAbilityProps={passiveAbilityProps}
                    />
                </div>

                {/* HandArea 不再依赖 cardAtlasRevision，确保手牌始终渲染 */}
                {(() => {
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
                                isPassiveRerollSelecting={!!rerollSelectingAction}
                            />
                            <HandArea
                                hand={handOwner.hand}
                                locale={locale}
                                currentPhase={currentPhase}
                                playerCp={handOwner.resources[RESOURCE_IDS.CP] ?? 0}
                                onPlayCard={(cardId) => engineMoves.playCard(cardId)}
                                onSellCard={(cardId) => {
                                    const blocked = shouldBlockTutorialAction('discard-pile');
                                    if (blocked) return;
                                    engineMoves.sellCard(cardId);
                                    advanceTutorialIfNeeded('discard-pile');
                                }}
                                onError={(msg) => { playDeniedSound(); toast.warning(msg); }}
                                canInteract={isResponder || isSelfView}
                                canPlayCards={isActivePlayer || isResponder}
                                drawDeckRef={drawDeckRef}
                                discardPileRef={discardPileRef}
                                undoCardId={lastUndoCardId}
                                onSellHintChange={setDiscardHighlighted}
                                onPlayHintChange={setCoreAreaHighlighted}
                                onSellButtonChange={setSellButtonVisible}
                                isDiscardMode={isDiscardMode}
                                onDiscardCard={(cardId) => {
                                    if (shouldBlockTutorialAction('discard-pile')) return;
                                    engineMoves.sellCard(cardId);
                                    advanceTutorialIfNeeded('discard-pile');
                                }}
                                respondableCardIds={respondableCardIds}
                            />
                        </>
                    );
                })()}

                {/* 进攻技能特写（防御阶段入口） */}
                {isAttackShowcaseVisible && attackShowcaseData && (
                    <AttackShowcaseOverlay
                        data={attackShowcaseData}
                        locale={locale}
                        opponentName={opponentName}
                        onDismiss={dismissAttackShowcase}
                    />
                )}

                <BoardOverlays
                    // 放大预览
                    isMagnifyOpen={isMagnifyOpen}
                    magnifiedImage={magnify.image}
                    magnifiedCard={magnify.card}
                    magnifiedCards={magnify.cards}
                    onCloseMagnify={closeMagnify}
                    abilityLevels={viewPlayer.abilityLevels}
                    viewCharacterId={viewPlayer.characterId}

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

                    isConfirmRemoveKnockdownOpen={modals.removeKnockdown}
                    onConfirmRemoveKnockdown={() => {
                        closeModal('removeKnockdown');
                        engineMoves.payToRemoveKnockdown();
                    }}
                    onCancelRemoveKnockdown={() => closeModal('removeKnockdown')}

                    // 选择弹窗
                    choice={choice}
                    canResolveChoice={canResolveChoice}
                    onResolveChoice={(optionId) => {
                        dispatch(INTERACTION_COMMANDS.RESPOND, { optionId });
                    }}

                    // 卡牌特写
                    cardSpotlightQueue={cardSpotlightQueue}
                    onCardSpotlightClose={handleCardSpotlightClose}
                    opponentHeaderRef={opponentHeaderRef}

                    // 额外骰子
                    bonusDie={bonusDie}
                    onBonusDieClose={handleBonusDieClose}

                    // 奖励骰重掷交互
                    // 只有攻击者才能操作重投；防御方/观察者以 displayOnly 模式展示
                    pendingBonusDiceSettlement={G.pendingBonusDiceSettlement
                        ? G.pendingBonusDiceSettlement.attackerId === rootPid
                            ? G.pendingBonusDiceSettlement
                            : { ...G.pendingBonusDiceSettlement, displayOnly: true }
                        : undefined}
                    canRerollBonusDie={Boolean(
                        G.pendingBonusDiceSettlement &&
                        G.pendingBonusDiceSettlement.attackerId === rootPid &&
                        (player.tokens?.[G.pendingBonusDiceSettlement.rerollCostTokenId] ?? 0) >= (G.pendingBonusDiceSettlement.rerollCostAmount ?? 1) &&
                        (G.pendingBonusDiceSettlement.maxRerollCount === undefined ||
                            G.pendingBonusDiceSettlement.rerollCount < G.pendingBonusDiceSettlement.maxRerollCount)
                    )}
                    onRerollBonusDie={G.pendingBonusDiceSettlement?.attackerId === rootPid
                        ? (dieIndex) => engineMoves.rerollBonusDie(dieIndex)
                        : undefined}
                    onSkipBonusDiceReroll={G.pendingBonusDiceSettlement?.attackerId === rootPid
                        ? () => engineMoves.skipBonusDiceReroll()
                        : undefined}

                    // Token 响应
                    pendingDamage={pendingDamage}
                    tokenResponsePhase={tokenResponsePhase}
                    isTokenResponder={!!isTokenResponder}
                    usableTokens={usableTokens}
                    onUseToken={(tokenId, amount) => engineMoves.useToken(tokenId, amount)}
                    onSkipTokenResponse={() => engineMoves.skipTokenResponse()}

                    // 交互覆盖层
                    isStatusInteraction={!!isStatusInteraction}
                    pendingInteraction={statusInteraction}
                    players={G.players}
                    currentPlayerId={rootPid}
                    onSelectStatus={handleSelectStatus}
                    onSelectPlayer={handleSelectPlayer}
                    onConfirmStatusInteraction={handleStatusInteractionConfirm}
                    onCancelInteraction={handleCancelInteraction}

                    // 净化相关（始终作用于自己）
                    viewPlayer={player}
                    purifiableStatusIds={purifiableStatusIds}

                    // 游戏结束
                    isGameOver={!!isGameOver}
                    gameoverResult={isGameOver}
                    playerID={playerID || undefined}
                    reset={reset}
                    rematchState={rematchState}
                    onRematchVote={handleRematchVote}

                    // 其他
                    statusIconAtlas={statusIconAtlas}
                    locale={locale}
                    dispatch={dispatch}
                    currentPhase={currentPhase}

                    // 选角相关
                    selectedCharacters={G.selectedCharacters}
                    playerNames={playerNames}
                    hostPlayerId={G.hostPlayerId}
                />
            </div>
        </UndoProvider>
    );
};

export default DiceThroneBoard;
