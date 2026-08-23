import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import {
    SU_COMMANDS,
    SU_EVENTS,
    type LimitModifiedEvent,
    type MinionDestroyedEvent,
    type TriggerQueuedEvent,
} from '../../domain/types';
import {
    applyEvents,
    getPromptOption,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveAffectedMinions,
    resolveDestroyedMinions,
    resolveMovedMinions,
    respondToPrompt,
    respondToPromptOption,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('DIY 杀人狂 abilities', () => {
    it('野蛮攻击摧毁印刷力量≤3仆从后，可给同基地杀人狂 +3 到回合结束', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'diy_killers_savage_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('killer1', 'diy_killers_jason', '0', 5),
                makeMinion('weak1', 'test_weak', '1', 2),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(played.success, played.error).toBe(true);

        const destroyPrompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_savage_attack');
        const destroyOption = getPromptOption(destroyPrompt, option => option.value?.minionUid === 'weak1', 'weak minion target');
        const destroyed = respondToPrompt(played.finalState, destroyOption.id);
        expect(destroyed.success, destroyed.error).toBe(true);
        expect(destroyed.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const boostPrompt = getSimpleChoicePrompt(destroyed.finalState, 'diy_killers_savage_attack_boost');
        const boostOption = getPromptOption(boostPrompt, option => option.value?.minionUid === 'killer1', 'killer boost target');
        const boosted = respondToPrompt(destroyed.finalState, boostOption.id);
        expect(boosted.success, boosted.error).toBe(true);

        const base = boosted.finalState.core.bases[0];
        expect(base.minions.some(minion => minion.uid === 'weak1')).toBe(false);
        expect(base.minions.find(minion => minion.uid === 'killer1')?.tempPowerModifier).toBe(3);
    });

    it('他是个好孩子从弃牌堆回收仆从并给予额外行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'diy_killers_good_boy', 'action', '0')],
                    discard: [makeCard('m1', 'diy_killers_jason', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'diy_killers_good_boy');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'm1')).toBe(false);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.cardUid === 'm1',
            '好孩子唯一弃牌堆仆从',
            '0',
            defaultTestRandom,
        );
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'm1')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toBe(true);
        expect(resolved.events.some((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'diy_killers_good_boy'
            && event.payload.limitType === 'action',
        )).toBe(true);
    });

    it('结束了? 回收附着行动，并把额外行动限制到该牌', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'diy_killers_is_it_over', 'action', '0')],
                    discard: [
                        makeCard('machete1', 'diy_killers_machete', 'action', '0'),
                        makeCard('other1', 'diy_killers_oh_no', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(played.success, played.error).toBe(true);

        const recovered = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'machete1',
            'machete discard option',
        );
        expect(recovered.success, recovered.error).toBe(true);
        expect(recovered.finalState.core.players['0'].hand.some(card => card.uid === 'machete1')).toBe(true);
        const limit = recovered.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'diy_killers_is_it_over'
        );
        expect(limit?.payload.restrictToCardUid).toBe('machete1');
        expect(limit?.payload.restrictToCardDefId).toBe('diy_killers_machete');
    });

    it('简易武器从牌库抽一张附着行动，并给予限定额外行动', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'diy_killers_improvised_weapon', 'action', '0')],
                    deck: [
                        makeCard('nope1', 'diy_killers_oh_no', 'action', '0'),
                        makeCard('machete1', 'diy_killers_machete', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'machete1')).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        const limit = result.events.find((event): event is LimitModifiedEvent =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && event.payload.reason === 'diy_killers_improvised_weapon'
        );
        expect(limit?.payload.restrictToCardUid).toBe('machete1');
    });

    it('起源故事在场上没有杀人狂时改为从牌库抽杀人狂', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'diy_killers_origin_story', 'action', '0')],
                    deck: [
                        makeCard('other-minion', 'alien_invader', 'minion', '0'),
                        makeCard('killer1', 'diy_killers_jason', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'killer1')).toBe(true);
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'other-minion')).toBe(false);
    });

    it('杰森入场时可以从牌库抽取大砍刀', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('jason-card', 'diy_killers_jason', 'minion', '0')],
                    deck: [makeCard('machete-card', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'jason-card', baseIndex: 0 },
        });
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_signature_search');
        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'machete-card',
            '大砍刀检索选项',
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'machete-card')).toBe(true);
        expect(prompt.options.length).toBeGreaterThan(1);
    });

    it('哦 不！！！在你摧毁其他玩家仆从后可作为额外行动打出并给己方仆从 +3', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('oh-no', 'diy_killers_oh_no', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('own1', 'diy_killers_jason', '0', 5),
                makeMinion('enemy1', 'test_enemy', '1', 2),
            ])],
        }));

        const destroyed = resolveDestroyedMinions(state, '0', [{
            minionUid: 'enemy1',
            minionDefId: 'test_enemy',
            fromBaseIndex: 0,
            ownerId: '1',
            destroyerId: '0',
            reason: 'test_destroy',
        }]);
        const queued = destroyed.events.find((event): event is TriggerQueuedEvent =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && event.payload.triggers.some(trigger => trigger.sourceDefId === 'diy_killers_oh_no'),
        );
        expect(queued).toBeDefined();

        const queuedCore = { ...applyEvents(state.core, destroyed.events), triggerQueue: queued!.payload.triggers };
        const prompted = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 10);
        const reactionPrompt = getSimpleChoicePrompt(prompted!.state, 'smashup_reaction_choose');
        expect(getPromptSourceId(reactionPrompt)).toBe('smashup_reaction_choose');

        const accepted = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId?.includes('diy_killers_oh_no'),
            '哦 不！！！特殊触发',
        );
        expect(accepted.success, accepted.error).toBe(true);
        expect(accepted.finalState.core.players['0'].hand.some(card => card.uid === 'oh-no')).toBe(false);
        const boostPrompt = getSimpleChoicePrompt(accepted.finalState, 'diy_killers_oh_no');
        expect(boostPrompt.autoResolveIfSingle).toBe(false);
        const boosted = respondToPromptOption(
            accepted.finalState,
            option => option.value?.minionUid === 'own1',
            '哦 不！！！唯一己方仆从',
            '0',
            defaultTestRandom,
        );
        expect(boosted.finalState.core.bases[0].minions.find(minion => minion.uid === 'own1')?.tempPowerModifier).toBe(3);
    });

    it('水晶湖营地在你打出牌后每回合一次摧毁力量不高于己方牌数的仆从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own1', 'diy_killers_jason', '0', 5),
                makeMinion('own2', 'test_helper', '0', 2),
                makeMinion('enemy1', 'test_enemy', '1', 2),
            ])],
        });
        const result = triggerBaseAbility('base_diy_killers_camp_crystal_lake', 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_diy_killers_camp_crystal_lake',
            playerId: '0',
            minionUid: 'own2',
            minionDefId: 'test_helper',
            now: 10,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_diy_killers_camp_crystal_lake_destroy');
        const destroyed = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'enemy1',
            '水晶湖营地摧毁目标',
        );
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'enemy1')).toBe(true);
        expect(destroyed.success, destroyed.error).toBe(true);
        expect(destroyed.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy1')).toBe(false);
        expect(destroyed.finalState.core.usedBaseAbilitiesThisTurn).toContainEqual({
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_diy_killers_camp_crystal_lake',
        });
    });

    it('水晶湖营地消灭后只有一个加力量候选也必须选择后才结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('target', 'diy_killers_jason', '0', 5),
            ])],
        });
        const result = triggerExtendedBaseAbility('base_diy_killers_camp_crystal_lake', 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_diy_killers_camp_crystal_lake',
            playerId: '1',
            destroyerId: '0',
            minionPower: 3,
            now: 11,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_diy_killers_camp_crystal_lake_power');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(result.matchState!.core.bases[0].minions[0].tempPowerModifier ?? 0).toBe(0);
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            '水晶湖营地唯一加力量目标',
            '0',
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(3);
    });

    it('躲藏在洗衣间在杀人狂移动到同基地后可摧毁未逃走的附着仆从', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', { hand: [] }),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('victim1', 'test_victim', '1', 3, {
                        attachedActions: [{
                            uid: 'laundry1',
                            defId: 'diy_killers_laundry_room',
                            ownerId: '0',
                            metadata: { sourceControllerId: '0' },
                        }],
                    }),
                ]),
                makeBase('base_b', [makeMinion('jason1', 'diy_killers_jason', '0', 5)]),
            ],
        }));

        const moved = resolveMovedMinions(state, '0', [{
            minionUid: 'jason1',
            minionDefId: 'diy_killers_jason',
            fromBaseIndex: 1,
            toBaseIndex: 0,
            reason: 'test_move',
        }]);
        const queued = moved.events.find((event): event is TriggerQueuedEvent =>
            event.type === SU_EVENTS.TRIGGER_QUEUED
            && event.payload.triggers.some(trigger => trigger.sourceDefId === 'diy_killers_laundry_room'),
        );
        expect(queued).toBeDefined();

        const movedCore = { ...applyEvents(state.core, moved.events), triggerQueue: queued!.payload.triggers };
        const prompted = maybeResolveReactionQueue(makeMatchState(movedCore), defaultTestRandom, 10);
        const destroyPrompt = getSimpleChoicePrompt(prompted!.state, 'diy_killers_laundry_room_destroy');
        expect(getPromptSourceId(destroyPrompt)).toBe('diy_killers_laundry_room_destroy');

        const destroyed = respondToPromptOption(
            prompted!.state,
            option => option.value?.mode === 'destroy',
            '洗衣间摧毁选项',
        );
        expect(destroyed.success, destroyed.error).toBe(true);
        expect(destroyed.finalState.core.bases[0].minions.some(minion => minion.uid === 'victim1')).toBe(false);
    });

    it('大砍刀天赋把宿主移动到有其他玩家仆从的基地', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('killer1', 'diy_killers_jason', '0', 5, {
                        attachedActions: [{ uid: 'machete1', defId: 'diy_killers_machete', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_b', [makeMinion('enemy1', 'test_enemy', '1', 3)]),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'machete1', baseIndex: 0 },
        });
        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'diy_killers_machete');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const moved = respondToPrompt(
            result.finalState,
            getPromptOption(prompt, option => option.value?.toBaseIndex === 1, 'machete destination base').id,
            '0',
            defaultTestRandom,
        );
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'killer1')).toBe(false);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'killer1')).toBe(true);
    });

    it('爪子手套只有一个候选仆从也必须选择后才给 -1 力量', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('freddy', 'diy_killers_freddy_krueger', '0', 5, {
                    attachedActions: [{ uid: 'glove1', defId: 'diy_killers_clawed_glove', ownerId: '0' }],
                }),
            ])],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'glove1', baseIndex: 0 },
        });
        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'diy_killers_clawed_glove');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(result.finalState.core.bases[0].minions[0].powerModifier).toBe(0);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.minionUid === 'freddy',
            '爪子手套唯一仆从',
            '0',
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions[0].powerModifier).toBe(-1);
    });

    it('麦克尔·麦尔斯计分前先以本体作为来源，再选择同基地弱随从摧毁', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('michael', 'diy_killers_michael_myers', '0', 5),
                makeMinion('weak1', 'test_weak', '1', 2),
            ])],
        });

        const triggered = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            now: 20,
        });

        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'diy_killers_michael_myers');
        expect(prompt.options).toHaveLength(2);
        const targetOption = getPromptOption(
            prompt,
            option =>
                option.value?.sourceUid === 'michael'
                && option.value?.minionUid === 'michael'
                && option.value?.fieldSourceType === 'minion'
                && option.value?.targetMinionUid === 'weak1',
            'Michael Myers field source-target option',
        );
        expect(targetOption.value).toMatchObject({
            fieldInteractionType: 'source-target',
            fieldTargetType: 'minion',
            targetMinionDefId: 'test_weak',
        });

        const resolved = respondToPrompt(triggered.matchState!, targetOption.id);
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'weak1')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'michael')).toBe(true);
    });

    it('梦魇世界计分前摧毁所有力量最低的仆从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_nightmare_world', [
                makeMinion('strong1', 'diy_killers_jason', '0', 5),
                makeMinion('weak1', 'test_weak_a', '0', 2),
                makeMinion('weak2', 'test_weak_b', '1', 2),
            ])],
        });
        const result = triggerBaseAbility('base_diy_killers_nightmare_world', 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_diy_killers_nightmare_world',
            playerId: '0',
            now: 10,
        });

        const destroyedEvents = result.events.filter(
            (event): event is MinionDestroyedEvent => event.type === SU_EVENTS.MINION_DESTROYED,
        );
        expect(destroyedEvents).toHaveLength(2);
        expect(destroyedEvents.map(event => event.payload.minionUid)).toEqual(['weak1', 'weak2']);
    });
});
