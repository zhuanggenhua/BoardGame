import type { Command, MatchState, RandomFn } from '../../../engine/types';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    type BetrayalCommand,
    type BetrayalCommandMap,
    type BetrayalCore,
} from '../game';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';

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
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });
    core.eventOrder = [
        { name: '测试中性事件', effect: { mode: 'none', recommendedAction: 'endTurn' } },
    ];
    return core;
}

function applyTutorialDiscoveryOrder(core: BetrayalCore): BetrayalCore {
    const tutorialEvent = BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何');
    if (!tutorialEvent) {
        throw new Error('山屋教程缺少官方事件牌：外星几何');
    }
    core.eventOrder = [tutorialEvent];
    return core;
}

export function createStartedFirstScenarioTutorialCore(playerIds: string[] = ['0', '1', '2']): BetrayalCore {
    return applyTutorialDiscoveryOrder(createStartedFirstScenarioCore(playerIds));
}

export function createFirstScenarioHauntCore(): BetrayalCore {
    let core = createStartedFirstScenarioCore();
    core.roomDiscoveryOrderByFloor.basement = [
        BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'chasm')!,
    ];
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

export function createFirstScenarioHauntTutorialCore(): BetrayalCore {
    return applyTutorialDiscoveryOrder(createFirstScenarioHauntCore());
}

export function playFirstScenarioToSurvivorVictory(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    const hauntSuccessRandom = createBetrayalScriptedRandom(
        3, 3, 3, 3, // 图书馆成功
        3, 3, 1, 1, 1, 1, 1, 1, // 对攻击倒叛徒：英雄 12(+2) vs 叛徒 6
        2, 2, 2, // 杰克之灵移动到 basement-landing
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
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', { target: 'traitor' }, 100, hauntSuccessRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntSuccessRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntSuccessRandom);
    core.currentExplorer.roomId = 'basement-landing';
    core.activeRoomId = 'basement-landing';
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}, 100, hauntSuccessRandom);

    return core;
}

export function createFirstScenarioReadyToExorciseCore(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    const hauntProgressRandom = createBetrayalScriptedRandom(
        3, 3, 3, 3, // 图书馆成功
        3, 3, 1, 1, 1, 1, 1, 1, // 对攻击倒叛徒：英雄 12(+2) vs 叛徒 6
        2, 2, 2, // 杰克之灵移动到 basement-landing
        3, 3, 3, 3, // 第一处驱魔法阵成功
        3, 3, 3, 3, // 第二处驱魔法阵成功
    );

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, '0', {}, 100, hauntProgressRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '0', { target: 'traitor' }, 100, hauntProgressRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntProgressRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntProgressRandom);
    core.currentExplorer.roomId = 'basement-landing';
    core.activeRoomId = 'basement-landing';

    return core;
}

export function createFirstScenarioReadyToExorciseTutorialCore(): BetrayalCore {
    return applyTutorialDiscoveryOrder(createFirstScenarioReadyToExorciseCore());
}

export function createFirstScenarioReadyToLearnAboutJackCore(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
    return core;
}

export function createFirstScenarioReadyToStudyExorcismCore(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    const hauntProgressRandom = createBetrayalScriptedRandom(3, 3, 3, 3);

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, '0', {}, 100, hauntProgressRandom);
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });

    return core;
}

export function createTradeReadyCore(): BetrayalCore {
    const core = createStartedFirstScenarioCore();
    const teammate = core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

    core.currentExplorer = {
        ...core.currentExplorer,
        roomId: 'hallway',
        inventory: [
            { id: 'rope', name: '兔脚', kind: 'item' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
        ],
    };
    core.otherExplorers = [
        {
            ...teammate,
            roomId: 'hallway',
        },
        {
            ...traitor,
            roomId: 'entrance-hall',
        },
    ];
    core.activeRoomId = 'hallway';
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.recommendedAction = 'trade';
    core.usedCardIdsThisTurn = [];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;

    return core;
}

export function createHeroAttackTraitorReadyCore(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
    return core;
}

export function playFirstScenarioToTraitorVictory(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    const traitorWinRandom = createBetrayalScriptedRandom(
        3, 3, 3, 3, 1, 1, 1, 1, 1, 1, // 第一次对攻击倒英雄：叛徒 18 vs 英雄 6
        3, 3, 3, 3, 1, 1, 1, 1, 1, 1, // 第二次对攻击倒英雄
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
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero', targetPlayerId: '0' }, 100, traitorWinRandom);

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero', targetPlayerId: '1' }, 100, traitorWinRandom);

    return core;
}

export function createFirstScenarioReadyToTraitorVictoryCore(): BetrayalCore {
    let core = createFirstScenarioHauntCore();
    const traitorWinRandom = createBetrayalScriptedRandom(
        3, 3, 3, 3, 1, 1, 1, 1, 1, 1, // 第一次对攻击倒英雄：叛徒 18 vs 英雄 6
        3, 3, 3, 3, 1, 1, 1, 1, 1, 1, // 第二次对攻击倒英雄
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
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero', targetPlayerId: '0' }, 100, traitorWinRandom);

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

    return core;
}

export function createFirstScenarioReadyToTraitorVictoryTutorialCore(): BetrayalCore {
    return applyTutorialDiscoveryOrder(createFirstScenarioReadyToTraitorVictoryCore());
}

export function createCorpseLootReadyCore(): BetrayalCore {
    const core = createFirstScenarioHauntCore();
    const current = core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
    const corpse = core.currentExplorer;
    const traitor = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

    core.currentPlayer = '1';
    core.currentExplorer = {
        ...current,
        roomId: 'hallway',
    };
    core.otherExplorers = [
        {
            ...corpse,
            roomId: 'hallway',
            inventory: [
                { id: 'corpse-item-1', name: '匕首', kind: 'item' },
                { id: 'corpse-omen-1', name: '黑暗预兆', kind: 'omen' },
            ],
        },
        {
            ...traitor,
            roomId: 'basement-east',
        },
    ];
    core.activeRoomId = 'hallway';
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
    core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn = [];
    core.movesRemaining = 4;
    core.recommendedAction = 'trade';
    core.usedCardIdsThisTurn = [];
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;

    return core;
}

export function createJackSpiritReviveReadyCore(): BetrayalCore {
    let core = createFirstScenarioHauntCore();

    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
    core = applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.HAUNT_ATTACK,
        '0',
        { target: 'traitor' },
        100,
        createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
    );
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-east' });
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

    return core;
}

export function createJackSpiritPostReviveAttackReadyCore(): BetrayalCore {
    let core = createJackSpiritReviveReadyCore();
    core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
    return core;
}
