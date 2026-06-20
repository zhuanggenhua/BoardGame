import { describe, expect, it } from 'vitest';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import {
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    type BetrayalCommand,
    type BetrayalCommandMap,
    type BetrayalCore,
} from '../game';

const fixedRandom: RandomFn = {
    random: () => 0.42,
    d: (max) => Math.max(1, Math.min(max, 1)),
    range: (min) => min,
    shuffle: (array) => [...array],
};

function stateOf(core: BetrayalCore): MatchState<BetrayalCore> {
    return { core, sys: {} as MatchState<BetrayalCore>['sys'] };
}

function command<Type extends keyof BetrayalCommandMap>(
    type: Type,
    playerId: string,
    payload: BetrayalCommandMap[Type],
): BetrayalCommand {
    return {
        type,
        playerId,
        payload,
        timestamp: 100,
    } as Command<Type & string, BetrayalCommandMap[Type]> as BetrayalCommand;
}

function applyCommand<Type extends keyof BetrayalCommandMap>(
    core: BetrayalCore,
    type: Type,
    playerId: string,
    payload: BetrayalCommandMap[Type],
): BetrayalCore {
    const nextCommand = command(type, playerId, payload);
    const validation = BetrayalDomain.validate(stateOf(core), nextCommand);
    expect(validation).toEqual({ valid: true });
    return BetrayalDomain.execute(stateOf(core), nextCommand, fixedRandom)
        .reduce((nextCore, event) => BetrayalDomain.reduce(nextCore, event), core);
}

describe('Betrayal first scenario runtime', () => {
    it('能从角色选择跑到首剧本终局', () => {
        let core = BetrayalDomain.setup(['0', '1', '2'], fixedRandom);

        expect(core.phase).toBe('characterSelect');
        core = applyCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyCommand(core, BETRAYAL_COMMANDS.START_FIRST_SCENARIO, '0', {});

        expect(core.phase).toBe('preHaunt');
        expect(core.currentExplorer.roomId).toBe('grand-staircase');
        expect(core.rooms.some((room) => room.id === 'upper-west' && room.state === 'unexplored')).toBe(true);

        core = applyCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        expect(core.exploreIndex).toBe(1);
        expect(core.latestDiscovery?.title).toBe('回廊顺风');

        core = applyCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        expect(core.exploreIndex).toBe(2);
        expect(core.currentExplorer.inventory.some((card) => card.name === '狩猎短刀')).toBe(true);

        const cardId = core.currentExplorer.inventory.find((card) => card.name === '狩猎短刀')!.id;
        core = applyCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId });
        expect(core.usedCardIdsThisTurn).toContain(cardId);

        core = applyCommand(core, BETRAYAL_COMMANDS.COMPLETE_FIRST_SCENARIO, '0', {});
        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntTitle).toBe('饥饿');
        expect(BetrayalDomain.isGameOver?.(core)?.winners).toEqual(core.endgameResult?.winners);
    });
});
