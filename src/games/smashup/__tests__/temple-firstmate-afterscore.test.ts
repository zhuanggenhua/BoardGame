import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import type { SmashUpCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { expectNoPrompt, getSimpleChoicePrompt, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState, respondToPromptOption } from './helpers';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { reduce } from '../domain/reducer';
import { fireTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { defaultTestRandom } from './testRunner';
import type { TriggerInstance } from '../domain/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
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
        const promptCore = makeState({
            bases: [
                makeBase('base_scoring', [makeMinion('first_mate_1', 'pirate_first_mate_pod', '0', 2)]),
                makeBase('base_left', []),
                makeBase('base_target', []),
            ],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const promptResult = fireTriggers(promptCore, 'afterScoring', {
            state: promptCore,
            matchState: makeMatchState(promptCore),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 2, vp: 1 }],
            random: { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
            now: 2000,
        });
        const prompt = getSimpleChoicePrompt(promptResult.matchState!, 'pirate_first_mate_choose_base');
        expect(prompt).toBeDefined();

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
        const result = respondToPromptOption(
            { ...promptResult.matchState!, core },
            option => option.value?.baseDefId === 'base_target',
            'First Mate move target base',
            '0',
            { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
        );
        expect(result.success, result.error).toBe(true);

        const moveEvents = result.events.filter((event: any) => event.type === 'su:minion_moved');
        expect(moveEvents).toHaveLength(1);
        expect((moveEvents[0] as any).payload.toBaseIndex).toBe(1);

        const nextCore = reduce(core, moveEvents[0] as any);
        expect(nextCore.bases[1].minions.some(m => m.uid === 'first_mate_1')).toBe(true);
        expect(nextCore.players['0'].discard.some(c => c.uid === 'first_mate_1')).toBe(false);
    });

    it('场景4b: baseDefId 已失效时，大副不应回退到旧索引上的错误基地', () => {
        const promptCore = makeState({
            bases: [
                makeBase('base_scoring', [makeMinion('first_mate_1', 'pirate_first_mate_pod', '0', 2)]),
                makeBase('base_left', []),
                makeBase('base_target', []),
            ],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const promptResult = fireTriggers(promptCore, 'afterScoring', {
            state: promptCore,
            matchState: makeMatchState(promptCore),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 2, vp: 1 }],
            random: { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
            now: 2001,
        });
        const prompt = getSimpleChoicePrompt(promptResult.matchState!, 'pirate_first_mate_choose_base');
        expect(prompt).toBeDefined();

        const core = makeState({
            bases: [
                makeBase('base_left', []),
                makeBase('base_wrong', []),
            ],
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('first_mate_1', 'pirate_first_mate_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = respondToPromptOption(
            { ...promptResult.matchState!, core },
            option => option.value?.baseDefId === 'base_target',
            'First Mate missing target base',
            '0',
            { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
        );
        expect(result.success, result.error).toBe(true);

        const moveEvents = result.events.filter((event: any) => event.type === 'su:minion_moved');
        expect(moveEvents).toHaveLength(0);
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
        expect(getSimpleChoicePrompt(result.matchState!, 'pirate_first_mate_choose_base')).toBeDefined();
    });

    it('场景6: 大副已被计分后能力放入牌库时，不得用 LKI 快照重新移动', () => {
        const trigger: TriggerInstance = {
            id: 'queued-first-mate-after-hotel',
            timing: 'afterScoring',
            sourceDefId: 'pirate_first_mate',
            sourceCardUid: 'first-mate-hotel',
            sourceControllerId: '0',
            sourceOwnerPlayerId: '0',
            sourceBaseIndex: 0,
            mandatory: true,
            resolutionClass: 'mandatory',
            ownerPlayerId: '0',
            eventPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'first-mate-hotel',
            triggerMinionDefId: 'pirate_first_mate',
            lkiMinion: {
                uid: 'first-mate-hotel',
                defId: 'pirate_first_mate',
                owner: '0',
                controller: '0',
                baseIndex: 0,
                basePower: 2,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
            },
        };
        const core = makeState({
            turnOrder: ['0', '1'],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('first-mate-hotel', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_other', []), makeBase('base_target', [])],
            triggerQueue: [trigger],
        });

        const resolved = maybeResolveReactionQueue(makeMatchState(core), defaultTestRandom, 3000);

        expect(resolved).toBeDefined();
        expectNoPrompt(resolved!.state);
        expect(resolved!.state.core.triggerQueue ?? []).toHaveLength(0);
        expect(resolved!.state.core.bases.flatMap(base => base.minions)).toHaveLength(0);
        expect(resolved!.state.core.players['0'].deck.map(card => card.uid)).toEqual(['first-mate-hotel']);
    });
});
