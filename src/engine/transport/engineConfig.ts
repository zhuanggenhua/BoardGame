import type { AiCommandSpec } from '../ai';
import type { AiInteractionSnapshot } from '../ai/types';
import type { EngineSystem, GameSystemsConfig } from '../systems/types';
import type { Command, DomainCore, GameEvent, MatchState, RandomFn } from '../types';
import type {
    LocalPregameControlResolver,
    LocalRuntimeControlResolver,
} from './followCurrentTurnPlayer';
import type {
    ForceEndTurnStalledAiResolution,
    HiddenInteractionDescriptor,
    HiddenSimpleChoiceInteraction,
} from './onlineAiRecovery';
import type { InteractionSelectabilityDiagnostic } from './onlineAiWatchdogFeedbackDiagnostics';

export interface GameEventTelemetryRecord {
    eventType: string;
    [key: string]: unknown;
}

export type GameEventTelemetryFormatter<TEvent extends GameEvent = GameEvent> = (
    event: TEvent,
) => GameEventTelemetryRecord | null | undefined;

export type OfflineAdjudicationInteraction = {
    id?: unknown;
    playerId?: unknown;
    kind?: unknown;
    data?: unknown;
};

/**
 * 游戏引擎配置合同。
 *
 * 这是 transport / local runtime / AI / UGC 共同消费的配置接口，不属于
 * GameTransportServer 的实现细节。
 */
export interface GameEngineConfig<
    TCore = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
> {
    /** 游戏 ID */
    gameId: string;
    /** 领域内核 */
    domain: DomainCore<TCore, TCommand, TEvent>;
    /** 启用的系统 */
    systems: EngineSystem<TCore>[];
    /** 系统配置 */
    systemsConfig?: GameSystemsConfig;
    /** 命令类型列表 */
    commandTypes?: string[];
    /** 游戏事件遥测格式化；传输层只负责写日志，不识别具体游戏事件语义 */
    eventTelemetry?: GameEventTelemetryFormatter<TEvent>;
    /** 玩家数量范围 */
    minPlayers?: number;
    maxPlayers?: number;
    /** 是否禁用撤销 */
    disableUndo?: boolean;
    /** 本地模式开局阶段由游戏声明是否需要代控某个 seat */
    resolveLocalPregameControlledPlayerId?: LocalPregameControlResolver;
    /** 本地热座运行中由游戏声明实际操作者；在线命令不会使用此解析。 */
    resolveLocalRuntimeControlledPlayerId?: LocalRuntimeControlResolver;
    /** 本地测试壳的游戏专属初始状态构造；传输层不识别具体游戏 setup 命令。 */
    createLocalTestInitialState?: (args: {
        testConfig: Record<string, unknown>;
        random: RandomFn;
        setupData: unknown;
        setupPlayerIds: string[];
        aiSeatIds: string[];
    }) => MatchState<unknown> | null | undefined;
    /** 本地测试壳的游戏专属 setup 命令构造；页面层只负责分发，不识别具体游戏命令。 */
    createLocalTestSetupCommands?: (args: {
        testConfig: Record<string, unknown>;
        state: MatchState<unknown>;
    }) => Array<Pick<Command, 'type' | 'payload' | 'playerId'>>;
    /** 在线 AI watchdog 的游戏级恢复策略 */
    onlineAiRecovery?: {
        advancePhaseCommandType?: string;
        disableFallbackAdvancePhase?: boolean;
        reportObservedRecoveryWithoutForcedCommand?: boolean;
        publicPregameLegalActionPhases?: string[];
        activeTurnLegalActionOnlyPhases?: string[];
        humanTurnLegalActionProbePhases?: string[];
        shouldProbeHumanTurnLegalActionOnlyCandidate?: (args: {
            state: MatchState<unknown>;
            phase: string;
            currentPlayerId: string;
        }) => boolean | undefined;
        autoSelectFirstTriggerOnlySimpleChoiceSourceIds?: string[];
        /** 历史存档里残留的私有响应轮镜像；watchdog 恢复真实交互后可按 sourceId 清理，避免误走通用 RESPONSE_PASS。 */
        legacyResponseWindowMirrorSourceIds?: string[];
        allowForceCommandAfterLegalActionExhausted?: (args: {
            state: MatchState<unknown>;
            phase: string;
            previousCandidate: ForceEndTurnStalledAiResolution;
            nextCandidate: ForceEndTurnStalledAiResolution;
        }) => boolean;
        resolveCurrentPlayerId?: (args: {
            state: MatchState<unknown>;
            phase: string;
            fallbackPlayerId: string | null;
        }) => string | null | undefined;
        resolveManualSetupSelectionTakeoverPlayerId?: (args: {
            sharedState: MatchState<unknown>;
            seatControllers: Record<string, unknown>;
            currentPlayerId: string | null;
            hasManualDispatch: boolean;
        }) => string | null | undefined;
        shouldReleaseManualSetupAttemptFromSharedState?: (args: {
            sharedState: MatchState<unknown>;
            playerId: string;
            actionKind: string;
            selectionId: string;
        }) => boolean | undefined;
        resolveManualSetupSelectionActionKindFromCommand?: (args: {
            type: string;
            payload: unknown;
        }) => string | null | undefined;
        resolveManualSetupSelectionId?: (args: {
            actionKind: string;
            payload: unknown;
        }) => string | null | undefined;
        shouldAwaitManualSetupSharedConfirmation?: (args: {
            playerId: string;
            actionKind: string;
            selectionId: string | null;
        }) => boolean | undefined;
        shouldTreatActionAsManualSetupSelection?: (args: {
            actionKind: string;
            actionId: string;
            commandTypes: string[];
        }) => boolean | undefined;
        resolveManualSetupSelectionIdFromAction?: (args: {
            actionKind: string;
            actionId: string;
            command: AiCommandSpec | null;
        }) => string | null | undefined;
        buildPregameSelectionProgressSignature?: (args: {
            state: MatchState<unknown>;
            phase: string;
            fallbackSignature: string;
        }) => string | undefined;
        buildInteractionRecoveryFingerprintHint?: (args: {
            state: MatchState<unknown>;
            playerId: string;
            phase: string;
            interaction: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
            fallbackFingerprintHint: string;
        }) => string | undefined;
        resolveForcedInteractionCommand?: (args: {
            state: MatchState<unknown>;
            playerId: string;
            phase: string;
            interaction: HiddenInteractionDescriptor | HiddenSimpleChoiceInteraction;
            fallbackCommand: { type: string; payload: unknown } | null;
        }) => { type: string; payload: unknown } | false | null | undefined;
        resolveSeatLegalOnlyRecovery?: (args: {
            state: MatchState<unknown>;
            phase: string;
        }) => {
            playerId: string;
            command: { type: string; payload: unknown };
            fingerprintHint: string;
            attemptSuffix?: string;
        } | null | undefined;
        resolveOfflineAdjudicationCommand?: (args: {
            state: MatchState<unknown>;
            playerId: string;
            interaction: OfflineAdjudicationInteraction;
            fallbackCommandType: string | null;
        }) => string | false | null | undefined;
        shouldSuppressActiveTurnCandidate?: (args: {
            state: MatchState<unknown>;
            phase: string;
            currentPlayerId: string;
            turnNumber: number | null;
        }) => boolean;
        shouldSuppressUnsatisfiableInteractionFeedback?: (args: {
            state: MatchState<unknown>;
            phase: string;
            playerId: string;
            reason: string;
            sharedInteraction: AiInteractionSnapshot | null | undefined;
            seatInteraction: AiInteractionSnapshot | null | undefined;
            sharedSelectability: InteractionSelectabilityDiagnostic | null;
            seatSelectability: InteractionSelectabilityDiagnostic | null;
        }) => boolean;
        offlineAdjudicationCommandByInteractionKind?: Record<string, string | null>;
    };
}

/** Type-erased engine config used by registries/providers that only pass configs through. */
export type AnyGameEngineConfig = GameEngineConfig<unknown, Command, GameEvent>;
