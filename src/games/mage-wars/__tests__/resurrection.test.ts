import type { MatchState } from '../../../engine/types';
import { getMageWarsSpellCardFromConfig } from '../data/configPackage';
import { MAGE_WARS_COMMANDS } from '../domain/commands';
import { MAGE_WARS_EVENTS } from '../domain/events';
import { resolveMageWarsResurrectionManaCostForTarget } from '../domain/spellRules';
import type { MageWarsCore } from '../domain/types';
import {
    MAGE_IDS,
} from '../domain/ids';
import {
    planCommand,
    runCommand,
    setupState,
    withPlayerMage,
} from './helpers/domainFlowHarness';

describe('mage-wars resurrection spell', () => {
    it('revives one defeated living creature in the caster mage zone and consumes one copy from both pools', () => {
        const planningState = setupState('planning');
        const priestessState: MatchState<MageWarsCore> = {
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        };
        const planned = runCommand(priestessState, planCommand([3415]));
        const targetSpell = getMageWarsSpellCardFromConfig(2811);
        const manaCost = targetSpell ? resolveMageWarsResurrectionManaCostForTarget(targetSpell) : undefined;
        expect(planned.success).toBe(true);
        expect(manaCost).toBe(6);

        const castState: MatchState<MageWarsCore> = {
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: 20,
                        defeatedLivingCreatureCardIds: [2811, 2811],
                        discardSpellCardIds: [2811, 2811],
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        };

        const cast = runCommand(castState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3415,
                manaCost: manaCost ?? 0,
                targetSpellCardId: 2811,
            },
        });

        expect(cast.success).toBe(true);
        expect(cast.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
                payload: {
                    object: expect.objectContaining({
                        ownerId: '0',
                        sourceSpellCardId: 2811,
                        zoneId: castState.core.players['0'].mageZoneId,
                        actionReady: false,
                    }),
                },
            }),
            expect.objectContaining({
                type: MAGE_WARS_EVENTS.DEFEATED_CREATURE_CARD_CONSUMED,
                payload: { playerId: '0', spellCardId: 2811 },
            }),
        ]));
        expect(cast.state.core.players['0'].mana).toBe(14);
        expect(cast.state.core.players['0'].defeatedLivingCreatureCardIds).toEqual([2811]);
        expect(cast.state.core.players['0'].discardSpellCardIds.filter((cardId) => cardId === 2811)).toEqual([2811]);
        expect(Object.values(cast.state.core.objects)).toEqual(expect.arrayContaining([
            expect.objectContaining({ ownerId: '0', sourceSpellCardId: 2811 }),
        ]));
    });

    it('rejects resurrection when the target card is not in the defeated living pool', () => {
        const planningState = setupState('planning');
        const priestessState: MatchState<MageWarsCore> = {
            core: withPlayerMage(planningState.core, '0', MAGE_IDS.PRIESTESS_APPRENTICE),
            sys: planningState.sys,
        };
        const planned = runCommand(priestessState, planCommand([3415]));
        const castState: MatchState<MageWarsCore> = {
            core: {
                ...planned.state.core,
                players: {
                    ...planned.state.core.players,
                    '0': {
                        ...planned.state.core.players['0'],
                        mana: 20,
                        defeatedLivingCreatureCardIds: [],
                        discardSpellCardIds: [2811],
                    },
                },
            },
            sys: { ...planned.state.sys, phase: 'creatureAction' },
        };

        const cast = runCommand(castState, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: 3415,
                manaCost: 6,
                targetSpellCardId: 2811,
            },
        });

        expect(cast.success).toBe(false);
        expect(cast.error).toBe('resurrectionTargetNotDefeated');
    });
});
