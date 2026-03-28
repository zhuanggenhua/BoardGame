import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { SmashUpCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { reduce } from '../domain/reducer';
import { collectTriggers, fireTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { asSimpleChoice, INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { defaultTestRandom, runCommand } from './testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('First Mate per-instance', () => {
    it('同一计分基地上的多个大副会按实例依次结算且不会卡死', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            turnOrder: ['0', '1'],
            bases: [
                makeBase('base_castle_blood', [
                    makeMinion('first_mate_1', 'pirate_first_mate', '0', 2),
                    makeMinion('first_mate_2', 'pirate_first_mate_pod', '0', 2),
                    makeMinion('count_1', 'vampire_the_count', '1', 5),
                ]),
                makeBase('base_the_homeworld', []),
                makeBase('base_crypt', []),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'scoreBases';

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 4, vp: 3 },
                { playerId: '1', power: 5, vp: 3 },
            ],
            random: defaultTestRandom,
            now: 2000,
        });
        expect(queued).toBeDefined();

        const coreWithQueue = reduce(core, queued as any);
        expect(coreWithQueue.triggerQueue).toHaveLength(2);
        expect(coreWithQueue.triggerQueue?.map(trigger => trigger.sourceCardUid)).toEqual(['first_mate_1', 'first_mate_2']);

        const matchStateWithQueue = makeMatchState(coreWithQueue);
        matchStateWithQueue.sys.phase = 'scoreBases';
        const queuedState = maybeResolveReactionQueue(matchStateWithQueue, defaultTestRandom, 2000);
        expect(queuedState).toBeDefined();

        let state = queuedState!.state;
        const orderingChoice = asSimpleChoice(state.sys.interaction?.current);
        expect(orderingChoice?.sourceId).toBe('reaction_queue_choose_next');

        const seenMateUids = new Set<string>();

        const resolveCurrentChoice = (currentState: MatchState<SmashUpCore>, optionId: string, playerId: string) => {
            const result = runCommand(currentState, {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId,
                payload: { optionId },
            } as any, defaultTestRandom);
            expect(result.success).toBe(true);
            return result.finalState;
        };

        state = resolveCurrentChoice(state, orderingChoice!.options[0]!.id, orderingChoice!.playerId);

        let currentInteraction = state.sys.interaction?.current as any;
        expect(currentInteraction?.data?.sourceId).toBe('pirate_first_mate_choose_base');
        const firstMateUid = currentInteraction?.data?.continuationContext?.mateUid as string;
        expect(firstMateUid).toBeTruthy();
        seenMateUids.add(firstMateUid);

        state = resolveCurrentChoice(state, 'skip', currentInteraction.playerId);

        currentInteraction = state.sys.interaction?.current as any;
        if (currentInteraction?.data?.sourceId === 'reaction_queue_choose_next') {
            state = resolveCurrentChoice(state, currentInteraction.data.options[0]!.id, currentInteraction.playerId);
            currentInteraction = state.sys.interaction?.current as any;
        }

        expect(currentInteraction?.data?.sourceId).toBe('pirate_first_mate_choose_base');
        const secondMateUid = currentInteraction?.data?.continuationContext?.mateUid as string;
        expect(secondMateUid).toBeTruthy();
        expect(secondMateUid).not.toBe(firstMateUid);
        seenMateUids.add(secondMateUid);

        state = resolveCurrentChoice(state, 'skip', currentInteraction.playerId);

        expect([...seenMateUids].sort()).toEqual(['first_mate_1', 'first_mate_2']);
        expect(state.sys.interaction?.current).toBeFalsy();
        expect(state.sys.interaction?.queue ?? []).toHaveLength(0);
        expect(state.sys.interaction?.isBlocked ?? false).toBe(false);
        expect(state.core.triggerQueue ?? []).toHaveLength(0);
    });
});

describe('Temple of Goju + First Mate 时序测试', () => {
    it('场景1: 寺庙移除大副后不会再产生错误事件', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_temple_of_goju', [
                    makeMinion('first_mate_1', 'pirate_first_mate', '0', 2),
                    makeMinion('weak_1', 'ninja_shinobi', '0', 1),
                    makeMinion('m2', 'ninja_shinobi', '1', 5),
                    makeMinion('m3', 'ninja_shinobi', '1', 3),
                    makeMinion('m4', 'ninja_shinobi', '1', 3),
                ]),
                makeBase('base_pirate_cove', []),
            ],
            baseDeck: ['base_central_brain'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });
        const ms: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                responseWindow: { current: undefined },
                interaction: { current: undefined, queue: [] },
            },
        } as any;

        const ctx: BaseAbilityContext = {
            state: core,
            matchState: ms,
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 3, vp: 2 },
                { playerId: '1', power: 11, vp: 3 },
            ],
            now: 1000,
        };

        const result = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        expect(result.events.length).toBeGreaterThan(0);
        const deckBottomEvents = result.events.filter((e: any) => e.type === 'su:card_to_deck_bottom');
        expect(deckBottomEvents.length).toBeGreaterThan(0);
    });

    it('场景2: 多个大副时，寺庙会按规则移除目标', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_temple_of_goju', [
                    makeMinion('first_mate_1', 'pirate_first_mate', '0', 3),
                    makeMinion('first_mate_2', 'pirate_first_mate', '0', 2),
                    makeMinion('m2', 'ninja_shinobi', '1', 5),
                    makeMinion('m3', 'ninja_shinobi', '1', 5),
                    makeMinion('m4', 'ninja_shinobi', '1', 5),
                    makeMinion('m5', 'ninja_shinobi', '1', 5),
                ]),
                makeBase('base_pirate_cove', []),
            ],
            baseDeck: ['base_central_brain'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });
        const ms: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                responseWindow: { current: undefined },
                interaction: { current: undefined, queue: [] },
            },
        } as any;

        const ctx: BaseAbilityContext = {
            state: core,
            matchState: ms,
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 5, vp: 2 },
                { playerId: '1', power: 20, vp: 3 },
            ],
            now: 1000,
        };

        const result = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        const deckBottomEvents = result.events.filter((e: any) => e.type === 'su:card_to_deck_bottom');
        expect(deckBottomEvents.length).toBeGreaterThan(0);
        expect(deckBottomEvents[0].payload.cardUid).toBe('first_mate_1');
    });

    it('场景3: 寺庙与 afterScoring 链式交互并存时，仍能产出延迟事件', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_temple_of_goju', [
                    makeMinion('first_mate_1', 'pirate_first_mate', '0', 2),
                    makeMinion('m2', 'ninja_shinobi', '1', 5),
                    makeMinion('m3', 'ninja_shinobi', '1', 5),
                    makeMinion('m4', 'ninja_shinobi', '1', 5),
                    makeMinion('m5', 'ninja_shinobi', '1', 5),
                ]),
                makeBase('base_pirate_cove', []),
            ],
            baseDeck: ['base_central_brain'],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });
        const ms: MatchState<SmashUpCore> = {
            core,
            sys: {
                phase: 'scoreBases',
                responseWindow: { current: undefined },
                interaction: { current: undefined, queue: [] },
            },
        } as any;

        const ctx: BaseAbilityContext = {
            state: core,
            matchState: ms,
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 2, vp: 2 },
                { playerId: '1', power: 20, vp: 3 },
            ],
            now: 1000,
        };

        const result = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        const deckBottomEvents = result.events.filter((e: any) => e.type === 'su:card_to_deck_bottom');
        expect(deckBottomEvents.length).toBeGreaterThan(0);
    });

    it('场景4: BASE_CLEARED 后索引漂移时，大副仍可按 baseDefId 移动', () => {
        const core = makeState({
            bases: [
                makeBase('base_left', []),
                makeBase('base_target', []),
            ],
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('first_mate_1', 'pirate_first_mate_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        const handler = getInteractionHandler('pirate_first_mate_choose_base');
        expect(handler).toBeDefined();

        const result = handler!(
            ms,
            '0',
            { baseIndex: 2, baseDefId: 'base_target' },
            {
                continuationContext: {
                    mateUid: 'first_mate_1',
                    mateDefId: 'pirate_first_mate_pod',
                    scoringBaseIndex: 0,
                },
            },
            {} as any,
            1000,
        );

        expect(result.events.length).toBe(1);
        expect((result.events[0] as any).payload.toBaseIndex).toBe(1);

        const nextCore = reduce(core, result.events[0] as any);
        expect(nextCore.bases[1].minions.some(m => m.uid === 'first_mate_1')).toBe(true);
        expect(nextCore.players['0'].discard.some(c => c.uid === 'first_mate_1')).toBe(false);
    });

    it('场景5: first_mate_pod 在 afterScoring 会创建移动交互', () => {
        const core = makeState({
            bases: [
                makeBase('base_scoring', [makeMinion('mate_pod_1', 'pirate_first_mate_pod', '0', 2)]),
                makeBase('base_other', []),
            ],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const ms = makeMatchState(core);

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: ms,
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 2, vp: 1 }],
            random: { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
            now: 2000,
        });

        expect(result.events.length).toBe(0);
        const interaction = result.matchState?.sys.interaction.current;
        expect(interaction).toBeDefined();
        expect((interaction?.data as any)?.sourceId).toBe('pirate_first_mate_choose_base');
    });
});
