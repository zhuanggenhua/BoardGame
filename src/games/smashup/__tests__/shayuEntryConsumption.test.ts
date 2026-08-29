import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import { SU_COMMANDS } from '../domain/types';
import {
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    expectNoPrompt,
    getSimpleChoicePrompt,
    getPromptOptions,
    respondToPromptOption,
} from './helpers';
import { runCommand } from './testRunner';

describe('shayu 第一入口直接消费专项审计', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it.each([
        ['sharks_blood_in_the_water'],
        ['sharks_week_of_sharks'],
        ['sharks_dangerous_waters'],
    ])('playNeedsBase ongoing：%s 直接附着到已选基地，不再二次选择基地', (defId) => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('action-card', defId, 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_deep', []),
                makeBase('base_wooden_horse', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'action-card', targetBaseIndex: 1 },
        } as any);

        expect(play.success).toBe(true);
        expectNoPrompt(play.finalState);
        expect(play.finalState.core.bases[1].ongoingActions.some(action => action.uid === 'action-card')).toBe(true);
        expect(play.finalState.core.bases[0].ongoingActions.some(action => action.uid === 'action-card')).toBe(false);
    });

    it('playNeedsMinion ongoing：鲨鱼诱饵直接附着到已选随从，不再二次选择随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('chum', 'sharks_chum', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_deep', [
                    makeMinion('target', 'sharks_mako', '0', 2),
                    makeMinion('other', 'tornados_dust_devil', '1', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const play = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'chum', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(play.success).toBe(true);
        expectNoPrompt(play.finalState);
        expect(play.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.attachedActions.some(action => action.uid === 'chum')).toBe(true);
        expect(play.finalState.core.bases[0].minions.find(minion => minion.uid === 'other')?.attachedActions.some(action => action.uid === 'chum')).toBe(false);
    });

    it('playNeedsBase standard：已选基地被 handler 直接消费，不重复弹基地 prompt', () => {
        const feedingCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('feeding', 'sharks_feeding_frenzy', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [makeMinion('victim', 'sharks_mako', '1', 2)])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const feeding = runCommand(makeMatchState(feedingCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'feeding', targetBaseIndex: 0 },
        } as any);
        expect(feeding.success).toBe(true);
        expect(getSimpleChoicePrompt(feeding.finalState).targetType).toBe('minion');

        const kansasCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('kansas', 'tornados_not_in_kansas', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [makeMinion('kept', 'sharks_mako', '0', 2)])],
            baseDeck: ['base_wooden_horse'],
            turnNumber: 1,
            nextUid: 100,
        };
        const kansas = runCommand(makeMatchState(kansasCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'kansas', targetBaseIndex: 0 },
        } as any);
        expect(kansas.success).toBe(true);
        expectNoPrompt(kansas.finalState);
        expect(kansas.finalState.core.bases[0].defId).toBe('base_wooden_horse');
        expect(kansas.finalState.core.bases[0].minions.some(minion => minion.uid === 'kept')).toBe(true);

        const zeusCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('zeus', 'mythic_greeks_favor_of_zeus', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_deep', []),
                makeBase('base_wooden_horse', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const zeus = runCommand(makeMatchState(zeusCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'zeus', targetBaseIndex: 1 },
        } as any);
        expect(zeus.success).toBe(true);
        expectNoPrompt(zeus.finalState);
        expect(zeus.finalState.core.tempBreakpointModifiers?.[1]).toBe(-5);
        expect(getEffectiveBreakpoint(zeus.finalState.core, 1)).toBe(16);
    });

    it('playNeedsMinion standard：已选源随从直接消费，后续 prompt 只能是新语义目标', () => {
        const airCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('air', 'sharks_air_jaws', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_deep', [makeMinion('source', 'sharks_mako', '0', 2)]),
                makeBase('base_wooden_horse', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const air = runCommand(makeMatchState(airCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'air', targetBaseIndex: 0, targetMinionUid: 'source' },
        } as any);
        expect(air.success).toBe(true);
        const airPrompt = getSimpleChoicePrompt(air.finalState, 'sharks_air_jaws_destination');
        expect(airPrompt.targetType).toBe('base');

        const carriedCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('carried', 'tornados_carried_away', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_deep', [makeMinion('move-me', 'sharks_mako', '1', 2)]),
                makeBase('base_wooden_horse', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const carried = runCommand(makeMatchState(carriedCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'carried', targetBaseIndex: 0, targetMinionUid: 'move-me' },
        } as any);
        expect(carried.success).toBe(true);
        const carriedPrompt = getSimpleChoicePrompt(carried.finalState, 'tornados_carried_away_dest');
        expect(carriedPrompt.targetType).toBe('base');

        const aresCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('ares', 'mythic_greeks_favor_of_ares', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('chosen', 'sharks_mako', '0', 2),
                makeMinion('other-own', 'tornados_dust_devil', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const ares = runCommand(makeMatchState(aresCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'ares', targetBaseIndex: 0, targetMinionUid: 'chosen' },
        } as any);
        expect(ares.success).toBe(true);
        const aresPrompt = getSimpleChoicePrompt(ares.finalState, 'mythic_greeks_favor_of_ares');
        const aresOptions = getPromptOptions(aresPrompt);
        expect(aresPrompt.targetType).toBe('minion');
        expect(aresOptions.map((option: any) => option.value?.minionUid)).toEqual(['chosen']);
        const aresResolved = respondToPromptOption(
            ares.finalState,
            (option: any) => option.value?.minionUid === 'chosen',
            '阿瑞斯的恩惠已选源随从',
            '0',
        );
        expect(aresResolved.success).toBe(true);
        expectNoPrompt(aresResolved.finalState);
        expect(aresResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'chosen')?.tempPowerModifier).toBe(3);
        expect(aresResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'other-own')?.tempPowerModifier ?? 0).toBe(0);

        const laserCore = {
            players: {
                '0': makePlayer('0', { hand: [makeCard('laser', 'sharks_freakin_laser_beam', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_deep', [
                makeMinion('source', 'sharks_hammerhead', '0', 3),
                makeMinion('victim', 'tornados_dust_devil', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const laser = runCommand(makeMatchState(laserCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'laser', targetBaseIndex: 0, targetMinionUid: 'source' },
        } as any);
        expect(laser.success).toBe(true);
        const laserPrompt = getSimpleChoicePrompt(laser.finalState);
        const laserOptions = getPromptOptions(laserPrompt);
        expect(laserPrompt.targetType).toBe('minion');
        expect(laserOptions.some((option: any) => option.value?.minionUid === 'source')).toBe(false);
        expect(laserOptions.some((option: any) => option.value?.minionUid === 'victim')).toBe(true);
    });
});
