import type { Command, GameEvent, MatchState } from '../types';
import type { EngineSystem } from '../systems/types';
import {
    executePipeline,
    type PipelineConfig,
} from '../pipeline';
import { refreshInteractionOptions } from '../systems/InteractionSystem';
import { buildAiProgressMarker } from './onlineAiRecovery';
import type { GameEngineConfig } from './engineConfig';
import type { LocalProviderRandom } from './localProviderBootstrap';
import type { AiSeatController } from '../ai/types';
import {
    buildLocalAiCommandAppliedPayload,
    buildLocalAiCommandStateSnapshot,
    resolveLocalAiCommandEffect,
    type LocalAiCommandEffect,
} from './localAiCommandEffects';
import { logLocalAiPerfInfo, logLocalAiPerfWarn } from './localAiDiagnostics';
import { buildLocalDispatchCommand } from './localDispatchCommand';
import { normalizeStateForConfig } from './stateNormalization';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function withLocalSeatControllers(
    state: MatchState<unknown>,
    seatControllers: Record<string, AiSeatController>,
): MatchState<unknown> {
    if (Object.keys(seatControllers).length === 0 || !isPlainRecord(state.core)) {
        return state;
    }

    const existingSeatControllers = isPlainRecord(state.core.seatControllers)
        ? state.core.seatControllers as Record<string, AiSeatController>
        : {};

    return {
        ...state,
        core: {
            ...state.core,
            seatControllers: {
                ...seatControllers,
                ...existingSeatControllers,
            },
        },
    };
}

export function executeLocalDispatch(args: {
    commandType: string;
    payload: unknown;
    prevState: MatchState<unknown>;
    config: GameEngineConfig;
    seed: string;
    random: LocalProviderRandom;
    setupPlayerIds: string[];
    seatControllers: Record<string, AiSeatController>;
    localPregameControlledPlayerId: string | null;
    commandEffectsByToken: Record<string, LocalAiCommandEffect>;
    onCommandRejected?: (commandType: string, error: string) => void;
}): MatchState<unknown> {
    const {
        commandType,
        payload,
        prevState,
        config,
        seed,
        random,
        setupPlayerIds,
        seatControllers,
        localPregameControlledPlayerId,
        commandEffectsByToken,
        onCommandRejected,
    } = args;

    const {
        command,
        resolvedPlayerId,
        aiTraceToken,
        isTutorialAiCommand,
    } = buildLocalDispatchCommand({
        commandType,
        payload,
        state: prevState,
        localPregameControlledPlayerId,
    });

    const pipelineConfig: PipelineConfig<unknown, Command, GameEvent> = {
        domain: config.domain,
        systems: config.systems as EngineSystem<unknown>[],
        systemsConfig: config.systemsConfig,
    };

    const result = executePipeline(
        pipelineConfig,
        withLocalSeatControllers(prevState, seatControllers),
        command,
        random,
        setupPlayerIds,
    );

    if (!result.success) {
        console.warn('[LocalGame] 命令执行失败:', commandType, result.error);
        if (aiTraceToken) {
            commandEffectsByToken[aiTraceToken] = {
                hasStateDelta: false,
                markerProgressed: false,
                rejected: true,
                failureReason: result.error ?? 'command_failed',
            };
        }
        logLocalAiPerfWarn('command-rejected', {
            gameId: config.gameId,
            matchId: `local:${config.gameId}:${seed}`,
            commandType,
            playerId: resolvedPlayerId,
            error: result.error ?? 'command_failed',
            isTutorialAiCommand,
            phase: typeof prevState.sys?.phase === 'string' ? prevState.sys.phase : null,
            turnNumber: typeof prevState.sys?.turnNumber === 'number' ? prevState.sys.turnNumber : null,
        });
        if (!isTutorialAiCommand) {
            onCommandRejected?.(commandType, result.error ?? 'command_failed');
        }
        return prevState;
    }

    const normalizedNextState = normalizeStateForConfig(config, result.state);
    const refreshedState = refreshInteractionOptions(normalizedNextState);

    if (isTutorialAiCommand) {
        const snapshotBefore = buildLocalAiCommandStateSnapshot({
            state: prevState,
            playerId: resolvedPlayerId,
            marker: buildAiProgressMarker(prevState, { engineConfig: config }),
        });
        const snapshotAfter = buildLocalAiCommandStateSnapshot({
            state: refreshedState,
            playerId: resolvedPlayerId,
            marker: buildAiProgressMarker(refreshedState, { engineConfig: config }),
        });
        const effect = resolveLocalAiCommandEffect({
            before: snapshotBefore,
            after: snapshotAfter,
        });
        if (aiTraceToken) {
            commandEffectsByToken[aiTraceToken] = effect;
        }
        logLocalAiPerfInfo('command-applied', buildLocalAiCommandAppliedPayload({
            gameId: config.gameId,
            seed,
            commandType,
            playerId: resolvedPlayerId,
            before: snapshotBefore,
            after: snapshotAfter,
            effect,
        }));
    }

    return refreshedState;
}
