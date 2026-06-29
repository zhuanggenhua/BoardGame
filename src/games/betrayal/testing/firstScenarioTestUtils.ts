import type { Command, MatchState, RandomFn } from '../../../engine/types';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    type BetrayalCommand,
    type BetrayalCommandMap,
    type BetrayalCore,
} from '../game';

export const BETRAYAL_FIXED_RANDOM: RandomFn = {
    random: () => 0.42,
    d: (max) => Math.max(1, Math.min(max, 1)),
    range: (min) => min,
    shuffle: (array) => [...array],
};

export function createBetrayalScriptedRandom(...diceResults: number[]): RandomFn {
    let index = 0;
    return {
        random: () => 0.42,
        d: (max) => {
            const next = diceResults[index] ?? 1;
            index += 1;
            return Math.max(1, Math.min(max, next));
        },
        range: (min) => min,
        shuffle: (array) => [...array],
    };
}

function stateOf(core: BetrayalCore): MatchState<BetrayalCore> {
    return { core, sys: {} as MatchState<BetrayalCore>['sys'] };
}

export function createBetrayalCommand<Type extends keyof BetrayalCommandMap>(
    type: Type,
    playerId: string,
    payload: BetrayalCommandMap[Type],
    timestamp = 100,
): BetrayalCommand {
    return {
        type,
        playerId,
        payload,
        timestamp,
    } as Command<Type & string, BetrayalCommandMap[Type]> as BetrayalCommand;
}

export function applyBetrayalCommand<Type extends keyof BetrayalCommandMap>(
    core: BetrayalCore,
    type: Type,
    playerId: string,
    payload: BetrayalCommandMap[Type],
    timestamp = 100,
    random: RandomFn = BETRAYAL_FIXED_RANDOM,
): BetrayalCore {
    const nextCommand = createBetrayalCommand(type, playerId, payload, timestamp);
    const validation = BetrayalDomain.validate(stateOf(core), nextCommand);
    if (!validation.valid) {
        throw new Error(validation.error ?? `invalid betrayal command: ${String(type)}`);
    }
    return BetrayalDomain.execute(stateOf(core), nextCommand, random)
        .reduce((nextCore, event) => BetrayalDomain.reduce(nextCore, event), core);
}

export function createStartedFirstScenarioCore(playerIds: string[] = ['0', '1', '2']): BetrayalCore {
    let core = BetrayalDomain.setup(playerIds, BETRAYAL_FIXED_RANDOM);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
    return applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });
}

export function createFirstScenarioHauntCore(): BetrayalCore {
    let core = createStartedFirstScenarioCore();
    const hauntTriggerRandom = createBetrayalScriptedRandom(
        3, 3, 3, 3, // 第三次探索第一次真正抽到恶兆：当前全员持有 4 张恶兆，haunt roll = 8
    );

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, hauntTriggerRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', {}, 100, hauntTriggerRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '2', {}, 100, hauntTriggerRandom);

    return core;
}

export function playFirstScenarioToSurvivorVictory(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    const hauntSuccessRandom = createBetrayalScriptedRandom(
        3, 3, 3, 3, // 图书馆成功
        3, 3, 3, 3, // 驱魔法阵成功
        3, 3, 3, 3, // 第二次驱魔法阵成功
        3, 3, 3, 3, 3, 3, // 最终驱魔成功
    );

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, '0', {}, 100, hauntSuccessRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', { target: 'traitor' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntSuccessRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntSuccessRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'rope' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}, 100, hauntSuccessRandom);

    return core;
}

export function playFirstScenarioToTraitorVictory(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    const traitorWinRandom = createBetrayalScriptedRandom(
        3, 3, 3, 3, 3, 3, // 第一次击倒英雄
        3, 3, 3, 3, 3, 3, // 第二次击倒英雄
    );

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero' }, 100, traitorWinRandom);

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero' }, 100, traitorWinRandom);

    return core;
}
