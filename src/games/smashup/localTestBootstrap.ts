import type { EngineSystem } from '../../engine/systems/types';
import type { GameEngineConfig } from '../../engine/transport/server';
import type { MatchState } from '../../engine/types';
import {
    createInitialSystemState,
    executePipeline,
    type PipelineConfig,
} from '../../engine/pipeline';
import { setUndoAiSeatIds } from '../../engine/systems/UndoSystem';
import {
    SmashUpDomain,
    SU_COMMANDS,
    type SmashUpCommand,
    type SmashUpCore,
    type SmashUpEvent,
} from './domain';

type LocalTestInitialStateFactory = NonNullable<GameEngineConfig['createLocalTestInitialState']>;
type LocalTestSetupCommandsFactory = NonNullable<GameEngineConfig['createLocalTestSetupCommands']>;

const SELECTION_ORDER: Array<{ playerId: string; factionIndex: number }> = [
    { playerId: '0', factionIndex: 0 },
    { playerId: '1', factionIndex: 0 },
    { playerId: '1', factionIndex: 1 },
    { playerId: '0', factionIndex: 1 },
];

const asStringArray = (value: unknown): string[] | undefined => (
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : undefined
);

function buildSkippedInitializationState(args: {
    systems: EngineSystem<SmashUpCore>[];
    setupPlayerIds: string[];
}): MatchState<SmashUpCore> {
    const { systems, setupPlayerIds } = args;
    const core = {
        players: Object.fromEntries(setupPlayerIds.map((playerId) => [
            playerId,
            {
                id: playerId,
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                factions: ['', ''],
            },
        ])),
        turnOrder: setupPlayerIds,
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 1,
    } as unknown as SmashUpCore;

    const sys = createInitialSystemState(setupPlayerIds, systems);
    sys.phase = 'playCards';
    return { sys, core };
}

export function createSmashUpLocalTestInitialStateFactory(
    systems: EngineSystem<SmashUpCore>[],
): LocalTestInitialStateFactory {
    return ({ testConfig, random, setupData, setupPlayerIds, aiSeatIds }) => {
        if (testConfig.skipInitialization === true) {
            return buildSkippedInitializationState({ systems, setupPlayerIds });
        }

        const player0Factions = asStringArray(testConfig.player0Factions);
        const player1Factions = asStringArray(testConfig.player1Factions);
        const shouldSkipFactionSelect = testConfig.skipFactionSelect === true
            && (player0Factions?.length ?? 0) > 0;
        if (!shouldSkipFactionSelect) {
            return null;
        }

        const core = SmashUpDomain.setup(setupPlayerIds, random, setupData);
        const sys = createInitialSystemState(setupPlayerIds, systems);
        let currentState: MatchState<SmashUpCore> = setUndoAiSeatIds({ sys, core }, aiSeatIds);

        const pipelineConfig: PipelineConfig<SmashUpCore, SmashUpCommand, SmashUpEvent> = {
            domain: SmashUpDomain,
            systems,
        };

        for (const { playerId, factionIndex } of SELECTION_ORDER) {
            const factions = playerId === '0' ? player0Factions : player1Factions;
            const factionId = factions?.[factionIndex];

            if (!factionId) {
                console.warn(`[SmashUp LocalGameProvider] 玩家 ${playerId} 的第 ${factionIndex + 1} 个派系未指定，跳过`);
                continue;
            }

            const command: SmashUpCommand = {
                type: SU_COMMANDS.SELECT_FACTION,
                playerId,
                payload: { factionId },
                timestamp: Date.now(),
                skipValidation: true,
            } as SmashUpCommand;

            const result = executePipeline(
                pipelineConfig,
                currentState,
                command,
                random,
                setupPlayerIds,
            );

            if (!result.success) {
                console.error('[SmashUp LocalGameProvider] 派系选择失败:', result.error);
                break;
            }

            currentState = result.state;
        }

        return currentState;
    };
}

export function createSmashUpLocalTestSetupCommandsFactory(): LocalTestSetupCommandsFactory {
    return ({ testConfig, state }) => {
        if (testConfig.skipFactionSelect === true) {
            return [];
        }

        const player0Factions = asStringArray(testConfig.player0Factions);
        const player1Factions = asStringArray(testConfig.player1Factions);
        if ((player0Factions?.length ?? 0) === 0 && (player1Factions?.length ?? 0) === 0) {
            return [];
        }

        const smashUpState = state as MatchState<SmashUpCore>;
        if (smashUpState.sys.phase !== 'factionSelect' || !smashUpState.core.factionSelection) {
            return [];
        }

        return SELECTION_ORDER.flatMap(({ playerId, factionIndex }) => {
            const factions = playerId === '0' ? player0Factions : player1Factions;
            const factionId = factions?.[factionIndex];

            if (!factionId) {
                console.warn(`[SmashUp TestMatchRoom] 玩家 ${playerId} 的第 ${factionIndex + 1} 个派系未指定，跳过`);
                return [];
            }

            return [{
                type: SU_COMMANDS.SELECT_FACTION,
                playerId,
                payload: { factionId },
            }];
        });
    };
}
