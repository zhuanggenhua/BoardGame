import { describe, expect, test } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine/pipeline';
import type { Command, MatchState } from '../../../engine/types';
import { engineConfig } from '../game';
import { THE_GANG_COMMANDS, type TheGangCommand, type TheGangCore } from '../domain/types';

const playerIds = ['0', '1', '2'];

const setupState = (ids = playerIds): MatchState<TheGangCore> => {
    const random = createSeededRandom('the-gang-action-log-test');
    return {
        core: engineConfig.domain.setup(ids, random),
        sys: createInitialSystemState(ids, engineConfig.systems, 'the-gang-action-log-test'),
    };
};

const runCommand = (state: MatchState<TheGangCore>, command: TheGangCommand) => {
    const random = createSeededRandom(`the-gang-action-log-${command.timestamp ?? 0}`);
    const result = executePipeline({
        domain: engineConfig.domain,
        systems: engineConfig.systems,
    }, state, command, random, state.core.playerIds);
    expect(result.success).toBe(true);
    return result.state;
};

const command = <T extends TheGangCommand>(value: T): T => value;

const startHeist = (state: MatchState<TheGangCore>, timestamp: number) => runCommand(state, command({
    type: THE_GANG_COMMANDS.START_HEIST,
    playerId: '0',
    payload: {},
    timestamp,
}));

const confirmProgressForAllPlayers = (
    state: MatchState<TheGangCore>,
    type: typeof THE_GANG_COMMANDS.END_ROUND | typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN | typeof THE_GANG_COMMANDS.START_NEXT_HEIST,
    timestamp: number,
) => {
    let nextState = state;
    for (const [index, playerId] of playerIds.entries()) {
        nextState = runCommand(nextState, command({
            type,
            playerId,
            payload: {},
            timestamp: timestamp + index,
            skipValidation: true,
        }));
    }
    return nextState;
};

describe('The Gang action-log', () => {
    test('记录重新发牌但不公开新底牌', () => {
        let state = setupState();

        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.REDEAL_HEIST,
            playerId: '0',
            payload: {},
            timestamp: 1,
        }));

        const latestEntry = state.sys.actionLog.entries.at(-1);
        expect(latestEntry?.kind).toBe(THE_GANG_COMMANDS.REDEAL_HEIST);
        expect(latestEntry?.segments).toEqual([{
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.redealHeist',
            params: { player: 1, heist: 1 },
        }]);

        const serializedLog = JSON.stringify(latestEntry);
        expect(serializedLog).not.toContain('"rank"');
        expect(serializedLog).not.toContain('"suit"');
        for (const player of Object.values(state.core.players)) {
            for (const card of player.pocketCards) {
                expect(serializedLog).not.toContain(card.suit);
            }
        }
    });

    test('记录撤离筹码但不公开手牌或内部手牌槽位', () => {
        let state = setupState(['0', '1', '2', '3']);
        state = {
            ...state,
            core: {
                ...state.core,
                heistStarted: true,
                round: 4,
                phase: 'chip-selection',
                rules: {
                    ...state.core.rules,
                    config: {
                        ...state.core.rules.config,
                        gameMode: 'texas-holdem',
                        twoHand: true,
                        challenges: {},
                    },
                },
                currentRoundChips: {
                    '0:top': 1,
                    '0:bottom': 2,
                    '1:top': 3,
                    '1:bottom': 4,
                    '2:top': 5,
                    '2:bottom': 6,
                    '3:top': 7,
                    '3:bottom': 8,
                },
                currentRoundExitChipOwners: [],
            },
        };

        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.TAKE_EXIT_CHIP,
            playerId: '0',
            payload: { handSlot: 'top' },
            timestamp: 2,
        }));

        const latestEntry = state.sys.actionLog.entries.at(-1);
        expect(latestEntry?.kind).toBe(THE_GANG_COMMANDS.TAKE_EXIT_CHIP);
        expect(latestEntry?.segments).toEqual([{
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.takeExitChipHand',
            params: { player: 1, hand: '上手' },
        }]);

        const serializedLog = JSON.stringify(latestEntry);
        expect(serializedLog).not.toContain('"rank"');
        expect(serializedLog).not.toContain('"suit"');
        expect(serializedLog).not.toContain('handSlot');
        expect(serializedLog).not.toContain('top');
        for (const player of Object.values(state.core.players)) {
            for (const card of player.pocketCards) {
                expect(serializedLog).not.toContain(card.suit);
            }
        }
    });

    test('记录退回筹码但不公开手牌或内部手牌槽位', () => {
        let state = setupState();
        state = {
            ...state,
            core: {
                ...state.core,
                heistStarted: true,
                round: 1,
                phase: 'chip-selection',
                currentRoundChips: {
                    0: 1,
                },
            },
        };

        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.RETURN_CHIP,
            playerId: '0',
            payload: {},
            timestamp: 2,
        }));

        const latestEntry = state.sys.actionLog.entries.at(-1);
        expect(latestEntry?.kind).toBe(THE_GANG_COMMANDS.RETURN_CHIP);
        expect(latestEntry?.segments).toEqual([{
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.returnChip',
            params: { player: 1, round: 1, chip: 1 },
        }]);

        const serializedLog = JSON.stringify(latestEntry);
        expect(serializedLog).not.toContain('"rank"');
        expect(serializedLog).not.toContain('"suit"');
        expect(serializedLog).not.toContain('handSlot');
        for (const player of Object.values(state.core.players)) {
            for (const card of player.pocketCards) {
                expect(serializedLog).not.toContain(card.suit);
            }
        }
    });

    test('记录公开抢劫流程且不暴露隐藏手牌', () => {
        let state = setupState();
        state = startHeist(state, 1);

        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 2,
        }));
        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 2 },
            timestamp: 3,
        }));
        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '2',
            payload: { chip: 3 },
            timestamp: 4,
        }));
        state = confirmProgressForAllPlayers(state, THE_GANG_COMMANDS.END_ROUND, 5);

        const entries = state.sys.actionLog.entries;
        expect(entries).toHaveLength(5);
        expect(entries.map((entry) => entry.kind)).toEqual([
            THE_GANG_COMMANDS.START_HEIST,
            THE_GANG_COMMANDS.TAKE_CHIP,
            THE_GANG_COMMANDS.TAKE_CHIP,
            THE_GANG_COMMANDS.TAKE_CHIP,
            THE_GANG_COMMANDS.END_ROUND,
        ]);
        expect(entries[0].segments).toEqual([{
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.startHeist',
            params: { player: 1, heist: 1 },
        }]);
        expect(entries[1].segments).toEqual([{
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.takeChip',
            params: { player: 1, round: 1, chip: 1 },
        }]);
        expect(entries[4].segments).toEqual([{
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.endRound',
            params: { player: 3, round: 1, nextRound: 2 },
        }]);

        const serializedLog = JSON.stringify(entries);
        expect(serializedLog).not.toContain('"rank"');
        expect(serializedLog).not.toContain('"suit"');
        expect(serializedLog).not.toContain('"cardId"');
        expect(serializedLog).not.toContain('"previewRef"');
        for (const player of Object.values(state.core.players)) {
            for (const card of player.pocketCards) {
                expect(serializedLog).not.toContain(card.suit);
            }
        }
    });

    test('记录手牌调换确认但不公开调换的隐藏牌', () => {
        let state = setupState();

        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }));
        state = startHeist(state, 2);

        state = runCommand(state, command({
            type: THE_GANG_COMMANDS.CONFIRM_HAND_SWAP,
            playerId: '0',
            payload: { topIndex: 0, bottomIndex: 1 },
            timestamp: 3,
        }));

        const latestEntry = state.sys.actionLog.entries.at(-1);
        expect(latestEntry?.kind).toBe(THE_GANG_COMMANDS.CONFIRM_HAND_SWAP);
        expect(latestEntry?.segments).toEqual([{
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.confirmHandSwap',
            params: { player: 1 },
        }]);

        const serializedLog = JSON.stringify(latestEntry);
        expect(serializedLog).not.toContain('"rank"');
        expect(serializedLog).not.toContain('"suit"');
        expect(serializedLog).not.toContain('"topIndex"');
        expect(serializedLog).not.toContain('"bottomIndex"');
    });

    test('记录摊牌结果和下一次抢劫', () => {
        let state = setupState();
        state = startHeist(state, 1);

        for (const round of [1, 2, 3, 4]) {
            for (const [index, playerId] of playerIds.entries()) {
                state = runCommand(state, command({
                    type: THE_GANG_COMMANDS.TAKE_CHIP,
                    playerId,
                    payload: { chip: index + 1 },
                    timestamp: round * 10 + index,
                    skipValidation: true,
                }));
            }

            if (round < 4) {
                state = confirmProgressForAllPlayers(state, THE_GANG_COMMANDS.END_ROUND, round * 100);
            }
        }

        state = confirmProgressForAllPlayers(state, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 500);
        expect(state.sys.actionLog.entries.at(-1)?.segments[0]).toMatchObject({
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.revealShowdown',
        });

        state = confirmProgressForAllPlayers(state, THE_GANG_COMMANDS.START_NEXT_HEIST, 600);
        expect(state.sys.actionLog.entries.at(-1)?.segments[0]).toEqual({
            type: 'i18n',
            ns: 'game-the-gang',
            key: 'actionLog.startNextHeist',
            params: { player: 3, heist: 2 },
        });
    });

    test('formatter 对非 The Gang 命令不生成日志', () => {
        const state = setupState();
        const system = engineConfig.systems.find((item) => item.id === 'actionLog');
        const result = system?.afterEvents?.({
            state,
            command: {
                type: 'UNKNOWN',
                playerId: '0',
                payload: {},
                timestamp: 1,
            } satisfies Command,
            events: [],
            random: createSeededRandom('the-gang-action-log-unknown'),
            playerIds,
        });

        expect(result).toBeUndefined();
    });
});
