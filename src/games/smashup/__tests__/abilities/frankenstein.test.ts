import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { getAbilityRuntimePromptHandler } from '../../domain/abilityRuntime';
import { validate } from '../../domain/commands';
import { execute } from '../../domain/reducer';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    resolveCurrentPromptHandlerWithCore,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';
import { resolveInteraction } from '../../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Frankenstein abilities', () => {
    it('frankenstein_german_engineering 在该基地打出随从后给该随从 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('ge1', 'frankenstein_german_engineering', 'action', '0'),
                        makeCard('m1', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const afterOngoing = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ge1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const afterMinion = runCommand(
            afterOngoing.finalState,
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const geEvt = afterMinion.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_ADDED
                && (event as any).payload.reason === 'frankenstein_german_engineering',
        );
        expect(geEvt).toBeDefined();
        expect((geEvt as any).payload.minionUid).toBe('m1');

        const finalMinion = afterMinion.finalState.core.bases[0].minions.find(minion => minion.uid === 'm1');
        expect(finalMinion).toBeDefined();
        expect(finalMinion!.powerCounters).toBe(1);
    });

    it('frankenstein_the_monster 天赋移除指示物并授予额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 2 }),
                ],
                ongoingActions: [],
            }],
        });

        const talentResult = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'monster1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const removedEvt = talentResult.events.find(
            event => event.type === SU_EVENTS.POWER_COUNTER_REMOVED
                && (event as any).payload.reason === 'frankenstein_the_monster',
        );
        expect(removedEvt).toBeDefined();
        expect((removedEvt as any).payload.minionUid).toBe('monster1');

        const limitEvt = talentResult.events.find(
            event => event.type === SU_EVENTS.LIMIT_MODIFIED
                && (event as any).payload.limitType === 'minion',
        );
        expect(limitEvt).toBeDefined();
    });

    it('frankenstein_the_monster_pod 没有 +1 力量指示物时 validate 拒绝天赋', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('monster1', 'frankenstein_the_monster_pod', '0', 5, { powerCounters: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster1', baseIndex: 0 },
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('该随从当前无法发动天赋：没有+1力量指示物');
    });

    it('frankenstein_the_monster_pod 没有 +1 力量指示物时 execute 不应误生成 TALENT_USED', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('monster1', 'frankenstein_the_monster_pod', '0', 5, { powerCounters: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'monster1', baseIndex: 0 },
        }, defaultTestRandom);

        expect(events).toEqual([]);
        expect(events.some(event => event.type === SU_EVENTS.TALENT_USED)).toBe(false);
    });

    it('frankenstein_angry_mob 若所选手牌已离开手牌，不应凭旧交互再塞回牌库', () => {
        const chooseMinionHandler = getAbilityRuntimePromptHandler('frankenstein_angry_mob');
        const chooseCardHandler = getAbilityRuntimePromptHandler('frankenstein_angry_mob_choose_card');
        expect(chooseMinionHandler).toBeDefined();
        expect(chooseCardHandler).toBeDefined();

        const playState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('angry-mob', 'frankenstein_angry_mob', 'action', '0'),
                        makeCard('h1', 'test_action_a', 'action', '0'),
                        makeCard('h2', 'test_action_b', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 0 })],
                ongoingActions: [],
            }],
        }));

        const played = runCommand(
            playState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'angry-mob' } },
            defaultTestRandom,
        );
        getSimpleChoicePrompt(played.finalState, 'frankenstein_angry_mob');

        const afterChooseMinion = resolveCurrentPromptHandlerWithCore(
            played.finalState,
            played.finalState.core,
            chooseMinionHandler!,
            { minionUid: 'monster1', minionDefId: 'frankenstein_the_monster', baseIndex: 0 },
            1000,
        );
        const afterChooseMinionState = resolveInteraction(afterChooseMinion!.state);
        getSimpleChoicePrompt(afterChooseMinionState, 'frankenstein_angry_mob_choose_card');

        const liveResult = resolveCurrentPromptHandlerWithCore(
            afterChooseMinionState,
            afterChooseMinionState.core,
            chooseCardHandler!,
            { cardUid: 'h1', defId: 'test_action_a' },
            1001,
        );
        expect(liveResult?.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
        expect(liveResult?.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);

        const staleStateCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h2', 'test_action_b', 'action', '0')],
                    discard: [makeCard('h1', 'test_action_a', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('monster1', 'frankenstein_the_monster', '0', 5, { powerCounters: 0 })],
                ongoingActions: [],
            }],
        });

        const staleResult = resolveCurrentPromptHandlerWithCore(
            afterChooseMinionState,
            staleStateCore,
            chooseCardHandler!,
            { cardUid: 'h1', defId: 'test_action_a' },
            1002,
        );
        expect(staleResult?.events ?? []).toHaveLength(0);
    });
});
