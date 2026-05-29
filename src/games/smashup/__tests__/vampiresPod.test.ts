import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { resolveOnPlay } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { makeCard, makeMatchState, makeMinion, makePlayer, makeState, getInteractionsFromMS, applyEvents } from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { resolveSmashUpReactionChoice } from '../domain/reactionSession';
import { collectTriggers, fireTriggers, isOperationRestricted } from '../domain/ongoingEffects';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('vampires_pod: Nightstalker POD', () => {
    it('talent requires having destroyed a minion this turn', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('ns', 'vampire_nightstalker_pod', 'minion', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('m1', 'robot_microbot', 'minion', '1')] }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ns', baseIndex: 0 } },
            defaultTestRandom,
        );

        // No destroyed-this-turn => should not add temp power
        const use1 = runCommand(
            played.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(use1.success).toBe(false);
        expect(String(use1.error ?? '')).toContain('本回合你还没有消灭过随从');
        expect(use1.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);

        // Fresh state: mark as destroyed-this-turn, reset talentUsed, then talent should work
        const core2 = {
            ...played.finalState.core,
            destroyedMinionByPlayersThisTurn: ['0'] as any,
            players: {
                ...played.finalState.core.players,
                '0': {
                    ...played.finalState.core.players['0'],
                    deck: [makeCard('d1', 'robot_microbot', 'minion', '0')],
                },
            },
            bases: played.finalState.core.bases.map((b, i) => i !== 0 ? b : ({
                ...b,
                minions: b.minions.map(m => m.uid === 'ns' ? { ...m, talentUsed: false } : m),
            })),
        };
        const use2 = runCommand(
            makeMatchState(core2),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(use2.success).toBe(true);
        expect(use2.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
    });

    it('destroying your own Fledgling Vampire this turn should satisfy the talent condition', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gulp', 'vampire_big_gulp_pod', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ns', 'vampire_nightstalker_pod', '0', 4),
                    makeMinion('fv', 'vampire_fledgling_vampire_pod', '0', 2),
                ],
                ongoingActions: [],
            }],
        });

        const playBigGulp = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gulp' } },
            defaultTestRandom,
        );
        expect(playBigGulp.success).toBe(true);

        const destroyPrompt: any = getInteractionsFromMS(playBigGulp.finalState)[0];
        expect(destroyPrompt?.data?.sourceId).toBe('vampire_big_gulp_pod');
        const fledglingOption = destroyPrompt.data.options.find((o: any) => o.value?.minionUid === 'fv');
        expect(fledglingOption).toBeTruthy();

        const afterDestroy = runCommand(
            playBigGulp.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: fledglingOption.id } } as any,
            defaultTestRandom,
        );
        expect(afterDestroy.success).toBe(true);
        expect(afterDestroy.finalState.core.destroyedMinionByPlayersThisTurn).toContain('0');

        const useTalent = runCommand(
            afterDestroy.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(useTalent.success).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
    });

    it('WWTLF POD + Drone skip should still count as having destroyed a minion this turn', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('wwtlf', 'giant_ant_who_wants_to_live_forever_pod', 'action', '0')],
                    deck: [makeCard('top-card', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ns', 'vampire_nightstalker_pod', '0', 4),
                    makeMinion('fv', 'vampire_fledgling_vampire_pod', '0', 2),
                    makeMinion('drone', 'giant_ant_drone_pod', '0', 2, { powerCounters: 1 }),
                ],
                ongoingActions: [],
            }],
        });

        const playWWTLF = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'wwtlf' } },
            defaultTestRandom,
        );
        expect(playWWTLF.success).toBe(true);

        // PR64/66/67 后：交互可能同时出现在 current + queue，且顺序不稳定。
        // 这里用一个小循环把“消灭选择 / Drone 拦截 / 搜索置顶 / Fledgling bury”全部跑完，再验证 Nightstalker 的天赋条件。
        let currentState = playWWTLF.finalState;
        for (let step = 0; step < 20; step += 1) {
            const prompt: any = getInteractionsFromMS(currentState)[0];
            if (!prompt) break;

            const sourceId = prompt?.data?.sourceId as string | undefined;
            let optionId: string | undefined;

            if (sourceId === 'giant_ant_who_wants_to_live_forever_pod_destroy') {
                optionId = prompt.data.options.find((o: any) => o.value?.minionUid === 'fv')?.id;
            } else if (sourceId === 'giant_ant_drone_prevent_destroy') {
                optionId = prompt.data.options.find((o: any) => o.value?.skip)?.id;
            } else if (sourceId === 'giant_ant_who_wants_to_live_forever_pod_search') {
                optionId = prompt.data.options.find((o: any) => o.value?.cardUid === 'top-card')?.id;
            } else if (sourceId === 'vampire_fledgling_vampire_pod_bury_source') {
                optionId = prompt.data.options.find((o: any) => o.id === 'skip')?.id;
            } else if (sourceId === 'smashup_reaction_choose') {
                optionId = prompt.data.options.find((o: any) => o.id === 'pass' || o.value?.kind === 'pass' || o.value?.pass === true)?.id
                    ?? prompt.data.options[0]?.id;
            } else {
                throw new Error(`未处理的交互 sourceId: ${sourceId ?? 'unknown'}`);
            }

            expect(optionId).toBeTruthy();
            const next = runCommand(
                currentState,
                { type: INTERACTION_COMMANDS.RESPOND, playerId: prompt.playerId, payload: { optionId } } as any,
                defaultTestRandom,
            );
            expect(next.success).toBe(true);
            currentState = next.finalState;
        }

        // 若仍残留 reaction 窗口，补一次 pass 收口
        for (let guard = 0; guard < 5; guard += 1) {
            const prompt: any = getInteractionsFromMS(currentState)[0];
            if (!prompt) break;
            if (prompt?.data?.sourceId !== 'smashup_reaction_choose') break;
            const passId = prompt.data.options.find((o: any) =>
                o.id === 'pass' || o.value?.kind === 'pass' || o.value?.pass === true,
            )?.id ?? prompt.data.options[0]?.id;
            if (!passId) break;
            const next = runCommand(
                currentState,
                { type: INTERACTION_COMMANDS.RESPOND, playerId: prompt.playerId, payload: { optionId: passId } } as any,
                defaultTestRandom,
            );
            expect(next.success).toBe(true);
            currentState = next.finalState;
        }

        // 应已满足“本回合有随从进入弃牌堆”的条件（Drone skip 也不能丢失记录）
        expect(currentState.core.destroyedMinionByPlayersThisTurn).toContain('0');
        expect(currentState.core.players['0'].deck[0]?.uid).toBe('top-card');

        // 结束交互后应回到正常出牌阶段（若仍残留 reaction 窗口，则允许继续）
        const remainingInteractions = getInteractionsFromMS(currentState);
        if (remainingInteractions.length > 0) {
            expect(remainingInteractions[0]?.data?.sourceId).toBe('smashup_reaction_choose');
        }
        expect(currentState.sys.phase).toBe('playCards');
        expect(currentState.core.turnOrder[currentState.core.currentPlayerIndex]).toBe('0');

        // 交互是否完全清空不影响“本回合已消灭随从”的事实（后续天赋逻辑由其他用例覆盖）
    });

    it('House of Nine Lives declining the save should still preserve Nightstalker POD condition', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gulp', 'vampire_big_gulp_pod', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('fv', 'vampire_fledgling_vampire_pod', '0', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_house_of_nine_lives',
                    minions: [
                        makeMinion('ns', 'vampire_nightstalker_pod', '0', 4),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playBigGulp = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'gulp' } },
            defaultTestRandom,
        );
        expect(playBigGulp.success).toBe(true);

        const destroyPrompt: any = getInteractionsFromMS(playBigGulp.finalState)[0];
        expect(destroyPrompt?.data?.sourceId).toBe('vampire_big_gulp_pod');
        const fledglingOption = destroyPrompt.data.options.find((o: any) => o.value?.minionUid === 'fv');
        expect(fledglingOption).toBeTruthy();

        const afterChooseDestroy = runCommand(
            playBigGulp.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: fledglingOption.id } } as any,
            defaultTestRandom,
        );
        expect(afterChooseDestroy.success).toBe(true);

        const nineLivesPrompt: any = getInteractionsFromMS(afterChooseDestroy.finalState)[0];
        expect(nineLivesPrompt?.data?.sourceId).toBe('base_nine_lives_intercept');
        const skipOption = nineLivesPrompt.data.options.find((o: any) => o.value?.move === false);
        expect(skipOption).toBeTruthy();

        const afterNineLivesSkip = runCommand(
            afterChooseDestroy.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: skipOption.id } } as any,
            defaultTestRandom,
        );
        expect(afterNineLivesSkip.success).toBe(true);
        expect(afterNineLivesSkip.finalState.core.destroyedMinionByPlayersThisTurn).toContain('0');

        const useTalent = runCommand(
            afterNineLivesSkip.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'ns', baseIndex: 1 } } as any,
            defaultTestRandom,
        );
        expect(useTalent.success).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(useTalent.events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
    });

    it('borrowed Fledgling Vampire POD 从当前玩家手牌埋葬时，仍应保留真实 trueOwnerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('borrowed-fv', 'vampire_fledgling_vampire_pod', 'minion', '0'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('victim-a', 'robot_microbot', '0', 1)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const victim = core.bases[0].minions.find(minion => minion.uid === 'victim-a');
        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '1'),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'robot_microbot',
            triggerMinion: victim,
            destroyerId: '1',
            sourceControllerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 40,
        }) as any;

        const trigger = (queued?.payload?.triggers ?? [])
            .find((candidate: any) => candidate.sourceDefId === 'vampire_fledgling_vampire_pod');
        expect(trigger?.sourceCardUid).toBe('borrowed-fv');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: queued.payload.triggers,
            }, 'playCards', '1'),
            defaultTestRandom,
            40,
        );
        const reactionPrompt = getInteractionsFromMS(prompted?.state ?? makeMatchState(core))[0] as any;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        const triggerOption = reactionPrompt.data.options.find((option: any) => {
            const triggerId = option.value?.triggerId;
            return triggerId && triggerId === trigger.id;
        });
        expect(triggerOption).toBeTruthy();

        const chosen = resolveSmashUpReactionChoice(
            prompted!.state,
            defaultTestRandom,
            41,
            triggerOption.value,
        );

        const burySourcePrompt: any = getInteractionsFromMS(chosen.state)[0];
        expect(burySourcePrompt?.data?.sourceId).toBe('vampire_fledgling_vampire_pod_bury_source');
        const borrowedSourceOption = burySourcePrompt.data.options.find((o: any) => o.value?.cardUid === 'borrowed-fv');
        expect(borrowedSourceOption).toBeTruthy();

        const afterChooseSource = runCommand(
            chosen.state,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '1', payload: { optionId: borrowedSourceOption.id } } as any,
            defaultTestRandom,
        );
        expect(afterChooseSource.success).toBe(true);

        const buryBasePrompt: any = getInteractionsFromMS(afterChooseSource.finalState)[0];
        expect(buryBasePrompt?.data?.sourceId).toBe('vampire_fledgling_vampire_pod_bury_base');
        const targetBaseOption = buryBasePrompt.data.options.find((o: any) => o.value?.baseIndex === 1);
        expect(targetBaseOption).toBeTruthy();

        const afterChooseBase = runCommand(
            afterChooseSource.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '1', payload: { optionId: targetBaseOption.id } } as any,
            defaultTestRandom,
        );
        expect(afterChooseBase.success).toBe(true);

        const buriedEvent = afterChooseBase.events.find((event: any) => event.type === SU_EVENTS.CARD_BURIED);
        expect(buriedEvent).toEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_BURIED,
            payload: expect.objectContaining({
                playerId: '1',
                cardUid: 'borrowed-fv',
                baseIndex: 1,
                trueOwnerId: '0',
                buriedFrom: 'hand',
                reason: 'vampire_fledgling_vampire_pod',
            }),
        }));
    });
});

describe('vampires_pod: Buffet POD', () => {
    it('can be played as a normal action and draws two cards', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bf', 'vampire_buffet_pod', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bf' } },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(e => e.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(played.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(c => c.uid)).toEqual(
            expect.arrayContaining(['draw-1', 'draw-2']),
        );
        expect(played.finalState.core.players['0'].discard.some(c => c.uid === 'bf')).toBe(true);
    });
});

describe('vampires_pod: The Count POD', () => {
    it('ongoing 应在任意基地触发（不是仅同基地）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('count', 'vampire_the_count_pod', 'minion', '0'),
                        makeCard('bg', 'vampire_big_gulp_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('ally', 'robot_microbot', '0', 2),
                        makeMinion('victim', 'robot_microbot', '1', 1),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const playCount = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'count', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(playCount.success).toBe(true);

        const playBigGulp = runCommand(
            playCount.finalState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bg' } },
            defaultTestRandom,
        );
        expect(playBigGulp.success).toBe(true);

        const chooseDestroy: any = getInteractionsFromMS(playBigGulp.finalState)[0];
        expect(chooseDestroy?.data?.sourceId).toBe('vampire_big_gulp_pod');
        const victimOpt = chooseDestroy.data.options.find((o: any) => o.value?.minionUid === 'victim');
        expect(victimOpt).toBeTruthy();

        const afterDestroy = runCommand(
            playBigGulp.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: victimOpt.id } },
            defaultTestRandom,
        );
        expect(afterDestroy.success).toBe(true);
        const interactions = getInteractionsFromMS(afterDestroy.finalState);
        const countPrompt = interactions.find((i: any) => i?.data?.sourceId === 'vampire_the_count_pod_add_counter');
        if (countPrompt) {
            expect(countPrompt).toBeTruthy();
        } else {
            const reactionPrompt = interactions.find((i: any) => i?.data?.sourceId === 'smashup_reaction_choose');
            expect(reactionPrompt).toBeTruthy();
            const hasCountTrigger = reactionPrompt?.data?.options?.some((o: any) =>
                String(o.id ?? '').includes('vampire_the_count_pod')
                || String(o.label ?? '').includes('伯爵'),
            );
            expect(hasCountTrigger).toBe(true);
        }
    });

    it('多个 The Count POD 走 direct fireTriggers 时，应按每个 source 继续给各自控制者链式加指示物 prompt', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: ['vampires', 'robots'],
                }),
                '1': makePlayer('1', {
                    factions: ['vampires', 'ghosts'],
                }),
            },
            bases: [
                makeState().bases[0],
                makeState().bases[0],
                {
                    defId: 'base_c',
                    minions: [
                        makeMinion('count-p0', 'vampire_the_count_pod', '0', 5),
                        makeMinion('target-a', 'robot_microbot', '0', 2),
                        makeMinion('victim-a', 'ghosts_spectre', '1', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_d',
                    minions: [
                        makeMinion('count-p1', 'vampire_the_count_pod', '1', 5),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const victim = core.bases[2].minions.find(minion => minion.uid === 'victim-a');
        const triggered = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core, 'playCards', '0'),
            playerId: '1',
            baseIndex: 2,
            triggerMinionUid: 'victim-a',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: victim,
            destroyerId: '0',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 60,
        });
        expect(triggered.events).toEqual([]);
        expect(triggered.matchState).toBeDefined();

        const firstPrompt = getInteractionsFromMS(triggered.matchState!)[0] as any;
        expect(firstPrompt?.data?.sourceId).toBe('vampire_the_count_pod_add_counter');
        expect(firstPrompt?.playerId).toBe('0');

        const skipFirst = runCommand(
            triggered.matchState!,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: 'skip' } } as any,
            defaultTestRandom,
        );
        expect(skipFirst.success).toBe(true);

        const secondPrompt = getInteractionsFromMS(skipFirst.finalState)[0] as any;
        expect(secondPrompt?.data?.sourceId).toBe('vampire_the_count_pod_add_counter');
        expect(secondPrompt?.playerId).toBe('1');
    });

    it('talent 的 -1 应持续到自己下回合开始', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('count', 'vampire_the_count_pod', '0', 5),
                    makeMinion('target', 'robot_microbot', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const useTalent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'count', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(useTalent.success).toBe(true);
        const prompt: any = getInteractionsFromMS(useTalent.finalState)[0];
        expect(prompt?.data?.sourceId).toBe('vampire_the_count_pod_talent');
        const targetOpt = prompt.data.options.find((o: any) => o.value?.minionUid === 'target');
        expect(targetOpt).toBeTruthy();

        const afterChoose = runCommand(
            useTalent.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: targetOpt.id } },
            defaultTestRandom,
        );
        expect(afterChoose.success).toBe(true);

        const afterApply = afterChoose.finalState.core.bases[0].minions.find(m => m.uid === 'target');
        expect(afterApply?.powerModifier).toBe(-1);

        const afterOpponentStart = applyEvents(afterChoose.finalState.core, [
            { type: SU_EVENTS.TURN_STARTED, payload: { playerId: '1', turnNumber: 2 }, timestamp: 100 } as any,
        ]);
        const stillDebuffed = afterOpponentStart.bases[0].minions.find(m => m.uid === 'target');
        expect(stillDebuffed?.powerModifier).toBe(-1);

        const afterOwnerStart = applyEvents(afterOpponentStart, [
            { type: SU_EVENTS.TURN_STARTED, payload: { playerId: '0', turnNumber: 3 }, timestamp: 200 } as any,
        ]);
        const reverted = afterOwnerStart.bases[0].minions.find(m => m.uid === 'target');
        expect(reverted?.powerModifier).toBe(0);
    });
});

describe('vampires_pod: Stakeout POD', () => {
    it('借来的随从被消灭时，Stakeout POD talent 应按控制者记录谁在该基地力量减少', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('borrowed-minion', 'robot_microbot', '1', 3, '0')],
                ongoingActions: [{
                    uid: 'stakeout-a',
                    defId: 'vampire_stakeout_pod',
                    ownerId: '0',
                    talentUsed: false,
                } as any],
            }],
        });

        const afterDestroy = applyEvents(core, [{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'borrowed-minion',
                minionDefId: 'robot_microbot',
                fromBaseIndex: 0,
                ownerId: '0',
                controllerId: '1',
                destroyerId: '0',
                reason: 'test_destroy_borrowed',
            },
            timestamp: 100,
        } as any]);

        expect(afterDestroy.basePowerDecreasedPlayersThisTurn?.[0]).toEqual(['1']);

        const result = runCommand(
            makeMatchState(afterDestroy),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'stakeout-a', baseIndex: 0 },
            } as any,
            defaultTestRandom,
        );

        expect(result.success).toBe(true);
        expect(result.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED }),
            ]),
        );
    });

    it('borrowed Stakeout POD talent 应按控制者建立封锁，并只豁免控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            basePowerDecreasedPlayersThisTurn: { 0: ['1'] },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{
                    uid: 'stakeout-borrowed',
                    defId: 'vampire_stakeout_pod',
                    ownerId: '1',
                    talentUsed: false,
                    metadata: { sourceControllerId: '0' },
                } as any],
            }],
        });

        const result = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'stakeout-borrowed', baseIndex: 0 },
            } as any,
            defaultTestRandom,
        );

        expect(result.success).toBe(true);
        expect(result.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED,
                    payload: expect.objectContaining({ baseIndex: 0, ownerId: '0' }),
                }),
            ]),
        );
        expect(isOperationRestricted(result.finalState.core, 0, '0', 'play_minion', { basePower: 3 })).toBe(false);
        expect(isOperationRestricted(result.finalState.core, 0, '1', 'play_minion', { basePower: 3 })).toBe(true);
    });

    it('同一基地两条不同 owner 的 Stakeout POD block 并存时，不应因第一条自豁免 block 漏掉后面另一条真实限制', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [
                    { uid: 'stakeout-owner-1', defId: 'vampire_stakeout_pod', ownerId: '1', talentUsed: false } as any,
                    { uid: 'stakeout-owner-0', defId: 'vampire_stakeout_pod', ownerId: '0', talentUsed: false } as any,
                ],
            }],
            stakeoutPodBlocks: [
                { baseIndex: 0, ownerId: '1', expiresOnTurnNumber: 3 },
                { baseIndex: 0, ownerId: '0', expiresOnTurnNumber: 3 },
            ],
        });

        expect(isOperationRestricted(core, 0, '1', 'play_minion', { basePower: 3 })).toBe(true);
    });
});

describe('vampires_pod: Dinner Date POD', () => {
    it('ongoing -2 生效且力量变为 0 时立即消灭', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('dd', 'vampire_dinner_date_pod', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally', 'robot_microbot', '0', 2),
                    makeMinion('victim', 'robot_microbot', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'dd', targetBaseIndex: 0, targetMinionUid: 'victim' },
            },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);
        const prompt: any = getInteractionsFromMS(play.finalState)[0];
        expect(prompt?.data?.sourceId).toBe('vampire_dinner_date_pod');
        const allyOpt = prompt.data.options.find((o: any) => o.value?.minionUid === 'ally');
        expect(allyOpt).toBeTruthy();

        const resolved = runCommand(
            play.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: allyOpt.id } },
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'victim')).toBe(false);
    });

    it('ongoing -2 不应在回合开始被清零', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('dd', 'vampire_dinner_date_pod', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally', 'robot_microbot', '0', 2),
                    makeMinion('victim', 'robot_microbot', '1', 4),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'dd', targetBaseIndex: 0, targetMinionUid: 'victim' },
            },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);
        const prompt: any = getInteractionsFromMS(play.finalState)[0];
        const allyOpt = prompt.data.options.find((o: any) => o.value?.minionUid === 'ally');

        const resolved = runCommand(
            play.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: allyOpt.id } },
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);

        const victimNow = resolved.finalState.core.bases[0].minions.find(m => m.uid === 'victim')!;
        expect(getEffectivePower(resolved.finalState.core, victimNow, 0)).toBe(2);

        const afterOpponentStart = applyEvents(resolved.finalState.core, [
            { type: SU_EVENTS.TURN_STARTED, payload: { playerId: '1', turnNumber: 2 }, timestamp: 100 } as any,
        ]);
        const victimAfterTurnStart = afterOpponentStart.bases[0].minions.find(m => m.uid === 'victim')!;
        expect(getEffectivePower(afterOpponentStart, victimAfterTurnStart, 0)).toBe(2);
    });
});

describe('vampires_pod: Wolf Pact POD', () => {
    it('随从面在“此基地没有另一个己方随从”时不应强制进入减攻流程', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('wp', 'vampire_wolf_pact_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy', 'robot_microbot', '1', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'wp', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(play.success).toBe(true);
        expect(getInteractionsFromMS(play.finalState).length).toBe(0);
    });

    it('战术面应为强制选择，不应出现“跳过”选项', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('d1', 'robot_microbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const onPlay = resolveOnPlay('vampire_wolf_pact_pod_action');
        expect(onPlay).toBeTruthy();
        const result = onPlay!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wp',
            defId: 'vampire_wolf_pact_pod_action',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 0,
        } as any);
        const ms = result.matchState ?? makeMatchState(core);
        const prompt: any = getInteractionsFromMS(ms)[0];
        expect(prompt?.data?.sourceId).toBe('vampire_wolf_pact_pod_action');
        expect(prompt.data.options.some((o: any) => o.id === 'skip')).toBe(false);
    });

    it('战术面选择被他人拥有的弃牌时，仍应洗回其拥有者牌库而不是当前玩家牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('borrowed-discard', 'robot_microbot', 'minion', '1'),
                        makeCard('own-discard', 'robot_microbot', 'minion', '0'),
                    ],
                    deck: [makeCard('p0-deck-a', 'vampire_nightstalker_pod', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'robot_microbot', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const onPlay = resolveOnPlay('vampire_wolf_pact_pod_action');
        expect(onPlay).toBeTruthy();
        const result = onPlay!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wp',
            defId: 'vampire_wolf_pact_pod_action',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 0,
        } as any);
        const ms = result.matchState ?? makeMatchState(core);
        const prompt: any = getInteractionsFromMS(ms)[0];
        const borrowedOption = prompt.data.options.find((option: any) => option.value?.cardUid === 'borrowed-discard');
        expect(borrowedOption).toBeTruthy();

        const resolved = runCommand(
            ms,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: borrowedOption.id } },
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['own-discard']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-deck-a']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck-a', 'borrowed-discard']);
    });

    it('破晓从弃牌堆打出 borrowed 低力量随从时，应保留真实 owner', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('crack', 'vampire_crack_of_dusk', 'action', '0')],
                    discard: [
                        makeCard('borrowed-minion', 'vampire_fledgling_vampire', 'minion', '1'),
                        makeCard('own-minion', 'vampire_fledgling_vampire', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'vampire_fledgling_vampire', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const onPlay = resolveOnPlay('vampire_crack_of_dusk');
        expect(onPlay).toBeTruthy();
        const result = onPlay!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'crack',
            defId: 'vampire_crack_of_dusk',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 0,
        } as any);

        const ms = result.matchState ?? makeMatchState(core);
        const chooseCardPrompt: any = getInteractionsFromMS(ms)[0];
        expect(chooseCardPrompt?.data?.sourceId).toBe('vampire_crack_of_dusk');
        const borrowedOption = chooseCardPrompt.data.options.find((option: any) => option.value?.cardUid === 'borrowed-minion');
        expect(borrowedOption).toBeTruthy();

        const chooseCard = runCommand(
            ms,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: borrowedOption.id } },
            defaultTestRandom,
        );
        expect(chooseCard.success).toBe(true);

        const chooseBasePrompt: any = getInteractionsFromMS(chooseCard.finalState)[0];
        expect(chooseBasePrompt?.data?.sourceId).toBe('vampire_crack_of_dusk_base');
        const baseOption = chooseBasePrompt.data.options.find((option: any) => option.value?.baseIndex === 0);
        expect(baseOption).toBeTruthy();

        const resolved = runCommand(
            chooseCard.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: baseOption.id } },
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);

        const minion = resolved.finalState.core.bases[0].minions.find(card => card.uid === 'borrowed-minion');
        expect(minion?.controller).toBe('0');
        expect(minion?.owner).toBe('1');
        expect(minion?.powerCounters).toBe(1);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['own-minion']);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('borrowed-minion');
    });
});

