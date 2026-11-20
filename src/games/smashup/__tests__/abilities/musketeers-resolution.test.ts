import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from '../helpers';
import { runCommand } from '../testRunner';

describe('火枪手行动结算时序', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('达达尼昂因行动抽牌时，正在结算的行动不能提前进入弃牌堆并被洗回抽取', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('biding', 'musketeers_biding_time', 'action', '0')],
                    deck: [], discard: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('dartagnan', 'musketeers_dartagnan', '0', 4)])],
        }));
        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'biding', targetBaseIndex: 0, targetMinionUid: 'dartagnan' },
        });
        expect(played.success, played.error).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('biding');
    });

    it('预备姿势先给予目标力量，再抽一张牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('en-garde', 'musketeers_en_garde', 'action', '0')],
                    deck: [makeCard('draw', 'sumo_wrestlers_rookie_sumo', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('own', 'sumo_wrestlers_rookie_sumo', '0', 2)])],
        }));
        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'en-garde', targetBaseIndex: 0, targetMinionUid: 'own' },
        });
        expect(played.success, played.error).toBe(true);
        const powerIndex = played.events.findIndex(event => event.type === SU_EVENTS.TEMP_POWER_ADDED);
        const drawIndex = played.events.findIndex(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(powerIndex).toBeGreaterThanOrEqual(0);
        expect(drawIndex).toBeGreaterThan(powerIndex);
    });
});
