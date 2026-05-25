import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearRegistry } from '../domain/abilityRegistry';
import { postProcessSystemEvents } from '../domain';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { SU_EVENTS, type SmashUpCore, type TitanState } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { defaultTestRandom, runCommand } from './testRunner';
import { getInteractionsFromMS, makeBase, makeCard, makeMatchState, makePlayer, makeState } from './helpers';

describe('reaction queue: titan removed from play', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        clearOngoingEffectRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    it('Killer Kudzu 离场后应把可选回收/抽牌选择权交给泰坦拥有者，而不是当前事件玩家', () => {
        const killerKudzu: TitanState = {
            uid: 'kudzu-a',
            defId: 'killer_plants_killer_kudzu',
            faction: SMASHUP_FACTION_IDS.KILLER_PLANTS,
            ownerId: '0',
            controllerId: '0',
            powerCounters: 3,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0 },
        };
        const core: SmashUpCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-a', 'sharks_mako', 'minion', '0')],
                    discard: [makeCard('recycle-a', 'killer_plant_sprout', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
            titans: [killerKudzu],
        });

        const removedEvent = {
            type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY,
            payload: {
                titanUid: 'kudzu-a',
                defId: 'killer_plants_killer_kudzu',
                ownerId: '0',
                controllerId: '0',
                fromBaseIndex: 0,
                reason: 'test_titan_clash',
            },
            timestamp: 77,
        } as const;

        const result = postProcessSystemEvents(core, [removedEvent], defaultTestRandom, makeMatchState(core));

        const queuedEvent = result.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        const queuedTrigger = queuedEvent?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'killer_plants_killer_kudzu');
        expect(queuedTrigger).toBeDefined();
        const reactionPrompt = getInteractionsFromMS(result.matchState ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.playerId).toBe('0');
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const triggerOption = reactionPrompt?.data?.options?.find((option: any) =>
            option.value?.triggerId === queuedTrigger.id);
        expect(triggerOption).toBeDefined();

        const chosen = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: triggerOption.id } } as any,
            defaultTestRandom,
        );
        const kudzuPrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(kudzuPrompt?.playerId).toBe('0');
        expect(kudzuPrompt?.data?.sourceId).toBe('titan_killer_plants_killer_kudzu_removed');
    });

    it('Killer Kudzu 回收被他人拥有的弃牌随从时，应洗回其拥有者牌库', () => {
        const killerKudzu: TitanState = {
            uid: 'kudzu-a',
            defId: 'killer_plants_killer_kudzu',
            faction: SMASHUP_FACTION_IDS.KILLER_PLANTS,
            ownerId: '0',
            controllerId: '0',
            powerCounters: 3,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0 },
        };
        const core: SmashUpCore = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('p0-deck-a', 'killer_plant_sprout', 'minion', '0')],
                    discard: [makeCard('borrowed-sprout', 'killer_plant_sprout', 'minion', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'killer_plant_sprout', 'minion', '1')],
                }),
            },
            bases: [makeBase('base_a')],
            titans: [killerKudzu],
        });

        const removedEvent = {
            type: SU_EVENTS.TITAN_REMOVED_FROM_PLAY,
            payload: {
                titanUid: 'kudzu-a',
                defId: 'killer_plants_killer_kudzu',
                ownerId: '0',
                controllerId: '0',
                fromBaseIndex: 0,
                reason: 'test_titan_clash',
            },
            timestamp: 77,
        } as const;

        const result = postProcessSystemEvents(core, [removedEvent], defaultTestRandom, makeMatchState(core));
        const queuedEvent = result.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        const queuedTrigger = queuedEvent?.payload?.triggers?.find((trigger: any) =>
            trigger.sourceDefId === 'killer_plants_killer_kudzu');
        const reactionPrompt = getInteractionsFromMS(result.matchState ?? makeMatchState(core))[0] as any;
        const triggerOption = reactionPrompt?.data?.options?.find((option: any) =>
            option.value?.triggerId === queuedTrigger.id);
        const chosen = runCommand(
            result.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: triggerOption.id } } as any,
            defaultTestRandom,
        );

        const modePrompt = getInteractionsFromMS(chosen.finalState)[0] as any;
        expect(modePrompt?.data?.sourceId).toBe('titan_killer_plants_killer_kudzu_removed');
        const recycleOption = modePrompt.data.options.find((option: any) => option.value?.recycle === true);
        const recycleStarted = runCommand(
            chosen.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: recycleOption.id } } as any,
            defaultTestRandom,
        );

        const recyclePrompt = getInteractionsFromMS(recycleStarted.finalState)[0] as any;
        expect(recyclePrompt?.data?.sourceId).toBe('titan_killer_plants_killer_kudzu_recycle');
        const borrowedOption = recyclePrompt.data.options.find((option: any) => option.value?.cardUid === 'borrowed-sprout');
        const resolved = runCommand(
            recycleStarted.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: borrowedOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'borrowed-sprout')).toBe(false);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-deck-a']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck-a', 'borrowed-sprout']);
    });
});
