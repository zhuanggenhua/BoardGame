import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondCommand,
    respondToPrompt,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(
    state: SmashUpCore,
    playerId: string,
    cardUid: string,
    targetBaseIndex?: number,
    targetMinionUid?: string,
) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex, targetMinionUid },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

describe('alien_jammed_signal 基地能力压制', () => {
    it('压制常规基地触发（onActionPlayed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_the_workshop' })],
        });
        const normalResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_the_workshop',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });

    it('压制扩展基地触发（onMinionDestroyed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_cave_of_shinies' })],
        });
        const normalResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_cave_of_shinies',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });
});

describe('外星人派系能力', () => {
    it('alien_invader: 获得1VP', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_invader', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1' })],
        });

        const { events } = execPlayMinion(state, '0', 'm1', 0);
        const vpEvents = events.filter(event => event.type === SU_EVENTS.VP_AWARDED);

        expect(vpEvents.length).toBe(1);
        expect((vpEvents[0] as any).payload.amount).toBe(1);
        expect((vpEvents[0] as any).payload.playerId).toBe('0');
    });

    it('alien_collector: 单个力量≤3对手随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_collector', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m2', 'test', '1', 3),
                    makeMinion('m3', 'test', '1', 5),
                ],
            })],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        getSimpleChoicePrompt(matchState, 'alien_collector');
    });

    it('alien_collector: 选择目标后通过 runtime prompt 返回随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_collector', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m2', 'test', '1', 3),
                    makeMinion('m3', 'test', '1', 5),
                ],
            })],
        });

        const playResult = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any, defaultTestRandom);

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'alien_collector');
        const option = getPromptOption(
            prompt,
            candidate => candidate?.value?.minionUid === 'm2',
            'alien collector target m2',
        );

        const respondResult = runCommand(
            playResult.finalState,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const returnedEvent = respondResult.events.find(event => event.type === SU_EVENTS.MINION_RETURNED);
        expect(returnedEvent).toBeDefined();
        expect((returnedEvent as any).payload).toMatchObject({
            minionUid: 'm2',
            reason: 'alien_collector',
            toPlayerId: '1',
        });
        expect(respondResult.finalState.core.bases[0].minions.some(minion => minion.uid === 'm2')).toBe(false);
    });

    it('alien_supreme_overlord: 选择目标后通过 runtime prompt 返回随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_supreme_overlord', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('ally-1', 'test_ally', '0', 4)],
                }),
                makeBase({
                    defId: 'b2',
                    minions: [makeMinion('enemy-1', 'test_enemy', '1', 3)],
                }),
            ],
        });

        const playResult = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any, defaultTestRandom);

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'alien_supreme_overlord');
        const option = getPromptOption(
            prompt,
            candidate => candidate?.value?.minionUid === 'enemy-1',
            'alien supreme overlord target enemy-1',
        );

        const respondResult = runCommand(
            playResult.finalState,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const returnedEvent = respondResult.events.find(event => event.type === SU_EVENTS.MINION_RETURNED);
        expect(returnedEvent).toBeDefined();
        expect((returnedEvent as any).payload).toMatchObject({
            minionUid: 'enemy-1',
            reason: 'alien_supreme_overlord',
            toPlayerId: '1',
        });
        expect(respondResult.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('alien_disintegrator: 缺少 targetMinionUid 时应校验失败；提供目标后正常结算', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'alien_disintegrator', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('m1', 'test', '1', 2)],
            })],
        });

        const missingTarget = execPlayAction(state, '0', 'a1');
        expectNoPrompt(missingTarget.matchState);
        expect(missingTarget.matchState.core.players['0'].hand.some(card => card.uid === 'a1')).toBe(true);

        const resolved = execPlayAction(state, '0', 'a1', 0, 'm1');
        const deckBottom = resolved.events.find(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect(deckBottom).toBeDefined();
        expect((deckBottom as any).payload).toMatchObject({
            cardUid: 'm1',
            reason: 'alien_disintegrator',
        });
    });

    describe('alien_probe: 探究', () => {
        it('单对手场景也先确认目标玩家，再创建展示整手牌的选择交互', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                        factions: ['aliens', 'dinosaurs'] as [string, string],
                    }),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('h1-1', 'pirate_first_mate', 'minion', '1'),
                            makeCard('h1-2', 'pirate_buccaneer', 'minion', '1'),
                            makeCard('h1-3', 'pirate_broadside', 'action', '1'),
                        ],
                        factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                    }),
                },
                bases: [makeBase('base_the_mothership'), makeBase('base_tar_pits')],
            });

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'probe1' },
            } as any, defaultTestRandom);

            expect(result.success).toBe(true);
            const chooseTargetPrompt = getSimpleChoicePrompt(result.finalState, 'alien_probe_choose_target');
            expect(chooseTargetPrompt.targetType).toBe('player');
            expect(chooseTargetPrompt.autoResolveIfSingle).toBe(false);
            expect(getPromptOptions(chooseTargetPrompt)).toHaveLength(1);

            const targetResolved = respondToPrompt(
                result.finalState,
                getPromptOptions(chooseTargetPrompt)[0]?.id ?? 'player-0',
                '0',
                defaultTestRandom,
            );

            const prompt = getSimpleChoicePrompt(targetResolved.finalState, 'alien_probe');
            expect(getPromptOptions(prompt)).toHaveLength(3);
            expect(getPromptOption(prompt, option => option.value?.cardUid === 'h1-1', 'probe minion h1-1').disabled).toBeFalsy();
            expect(getPromptOption(prompt, option => option.value?.cardUid === 'h1-2', 'probe minion h1-2').disabled).toBeFalsy();
            expect(getPromptOption(prompt, option => option.value?.cardUid === 'h1-3', 'probe action h1-3').disabled).toBe(true);

            expect(result.finalState.core.players['0'].hand.find(card => card.uid === 'probe1')).toBeUndefined();
            expect(result.finalState.core.players['0'].discard.find(card => card.uid === 'probe1')).toBeDefined();
        });

        it('即使只有一张可选随从，也应保留交互而不是自动默认弃掉', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                        factions: ['aliens', 'dinosaurs'] as [string, string],
                    }),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('h1-1', 'pirate_first_mate', 'minion', '1'),
                            makeCard('h1-2', 'pirate_broadside', 'action', '1'),
                            makeCard('h1-3', 'alien_crop_circles', 'action', '1'),
                        ],
                        factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                    }),
                },
                bases: [makeBase('base_the_mothership')],
            });

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'probe1' },
            } as any, defaultTestRandom);

            expect(result.success).toBe(true);
            expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(false);
            const chooseTargetPrompt = getSimpleChoicePrompt(result.finalState, 'alien_probe_choose_target');
            expect(chooseTargetPrompt.autoResolveIfSingle).toBe(false);
            const targetResolved = respondToPrompt(
                result.finalState,
                getPromptOptions(chooseTargetPrompt)[0]?.id ?? 'player-0',
                '0',
                defaultTestRandom,
            );
            const prompt = getSimpleChoicePrompt(targetResolved.finalState, 'alien_probe');
            expect(getPromptOptions(prompt)).toHaveLength(3);
            expect(getPromptOption(prompt, option => option.value?.cardUid === 'h1-1', 'single probe minion').disabled).toBeFalsy();
            expect(getPromptOption(prompt, option => option.value?.cardUid === 'h1-2', 'single probe action h1-2').disabled).toBe(true);
            expect(getPromptOption(prompt, option => option.value?.cardUid === 'h1-3', 'single probe action h1-3').disabled).toBe(true);
        });

        it('选择随从后，对手弃掉那张随从', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                        factions: ['aliens', 'dinosaurs'] as [string, string],
                    }),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('h1-1', 'pirate_first_mate', 'minion', '1'),
                            makeCard('h1-2', 'pirate_buccaneer', 'minion', '1'),
                        ],
                        factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                    }),
                },
                bases: [makeBase('base_the_mothership')],
            });

            const playResult = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'probe1' },
            } as any, defaultTestRandom);

            const targetResolved = respondToPrompt(
                playResult.finalState,
                getPromptOptions(getSimpleChoicePrompt(playResult.finalState, 'alien_probe_choose_target'))[0]?.id ?? 'player-0',
                '0',
                defaultTestRandom,
            );
            const resolved = respondToPrompt(
                targetResolved.finalState,
                getPromptOption(
                    getSimpleChoicePrompt(targetResolved.finalState, 'alien_probe'),
                    option => option.value?.cardUid === 'h1-1',
                    'probe discard target h1-1',
                ).id,
                '0',
                defaultTestRandom,
            );

            expect(resolved.success).toBe(true);
            const discardEvent = resolved.events.find(event => event.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvent).toBeDefined();
            expect((discardEvent as any).payload).toMatchObject({
                playerId: '1',
                cardUids: ['h1-1'],
            });
            expect(resolved.finalState.core.players['1'].hand.find(card => card.uid === 'h1-1')).toBeUndefined();
            expect(resolved.finalState.core.players['1'].discard.find(card => card.uid === 'h1-1')).toBeDefined();
        });

        it('对手手牌没有随从时直接结束并给出反馈，不创建交互', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                        factions: ['aliens', 'dinosaurs'] as [string, string],
                    }),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('h1-1', 'pirate_broadside', 'action', '1'),
                            makeCard('h1-2', 'pirate_powderkeg', 'action', '1'),
                        ],
                        factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                    }),
                },
                bases: [makeBase('base_the_mothership')],
            });

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'probe1' },
            } as any, defaultTestRandom);

            expect(result.success).toBe(true);
            const chooseTargetPrompt = getSimpleChoicePrompt(result.finalState, 'alien_probe_choose_target');
            expect(chooseTargetPrompt.autoResolveIfSingle).toBe(false);
            const targetResolved = respondToPrompt(
                result.finalState,
                getPromptOptions(chooseTargetPrompt)[0]?.id ?? 'player-0',
                '0',
                defaultTestRandom,
            );
            expectNoPrompt(targetResolved.finalState);
            expect(targetResolved.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
        });

        it('多对手场景会先选择对手，再进入目标手牌选择', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('probe1', 'alien_probe', 'action', '0')],
                        factions: ['aliens', 'dinosaurs'] as [string, string],
                    }),
                    '1': makePlayer('1', {
                        hand: [
                            makeCard('h1-1', 'pirate_first_mate', 'minion', '1'),
                            makeCard('h1-2', 'pirate_broadside', 'action', '1'),
                        ],
                        factions: ['pirates', 'minions_of_cthulhu'] as [string, string],
                    }),
                    '2': makePlayer('2', {
                        hand: [makeCard('h2-1', 'ninja_tiger_assassin', 'minion', '2')],
                        factions: ['ninjas', 'wizards'] as [string, string],
                    }),
                },
                bases: [makeBase('base_the_mothership'), makeBase('base_tar_pits')],
                turnOrder: ['0', '1', '2'],
            });

            const playResult = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'probe1' },
            } as any, defaultTestRandom);

            const chooseTargetPrompt = getSimpleChoicePrompt(playResult.finalState, 'alien_probe_choose_target');
            expect(chooseTargetPrompt.targetType).toBe('player');
            expect(getPromptOptions(chooseTargetPrompt)).toHaveLength(2);

            const targetResolved = respondToPrompt(
                playResult.finalState,
                getPromptOptions(chooseTargetPrompt)[0]?.id ?? 'player-0',
                '0',
                defaultTestRandom,
            );

            expect(targetResolved.success).toBe(true);
            const handPrompt = getSimpleChoicePrompt(targetResolved.finalState, 'alien_probe');
            expect(getPromptOptions(handPrompt)).toHaveLength(2);
            expect(getPromptOption(handPrompt, option => option.value?.cardUid === 'h1-1', 'target player minion').disabled).toBeFalsy();
            expect(getPromptOption(handPrompt, option => option.value?.cardUid === 'h1-2', 'target player action').disabled).toBe(true);
        });
    });

    it('alien_crop_circles: 单个基地有随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'alien_crop_circles', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m1', 'test', '0', 3),
                    makeMinion('m2', 'test', '1', 2),
                    makeMinion('m3', 'test', '1', 4),
                ],
            })],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'alien_crop_circles');
    });

    it('alien_crop_circles: 返回随从事件应保留行动玩家 sourcePlayerId', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'alien_crop_circles', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m1', 'test', '0', 3),
                    makeMinion('m2', 'test', '1', 2),
                ],
            })],
        });

        const played = execPlayAction(state, '0', 'a1');
        const resolved = respondToPrompt(
            played.matchState,
            getPromptOption(
                getSimpleChoicePrompt(played.matchState, 'alien_crop_circles'),
                option => option.value?.baseIndex === 0,
                'crop circles target base',
            ).id,
            '0',
            defaultTestRandom,
        );

        const returnedEvents = resolved.events.filter(event => event.type === SU_EVENTS.MINION_RETURNED) as any[];
        expect(returnedEvents).toHaveLength(2);
        expect(returnedEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({
                payload: expect.objectContaining({
                    minionUid: 'm1',
                    toPlayerId: '0',
                    sourcePlayerId: '0',
                    reason: 'alien_crop_circles',
                }),
            }),
            expect.objectContaining({
                payload: expect.objectContaining({
                    minionUid: 'm2',
                    toPlayerId: '1',
                    sourcePlayerId: '0',
                    reason: 'alien_crop_circles',
                }),
            }),
        ]));
        expect(resolved.finalState.core.bases[0].minions).toHaveLength(0);
    });

    it('alien_scout: 打出时无 onPlay 交互（能力为 afterScoring 触发）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'alien_invader', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                        makeCard('d3', 'alien_supreme_overlord', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        expectNoPrompt(matchState);
    });

    it('alien_scout: 牌库无随从时无抽牌事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_action2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('alien_scout: 牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expectNoPrompt(matchState);
    });
});
