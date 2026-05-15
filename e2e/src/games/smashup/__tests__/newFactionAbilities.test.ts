/**
 * 大杀四方 - 新增派系能力测试
 *
 * 遗留巨型派系能力测试（迁出中）。
 * 新增或迁移用例应优先落到 __tests__/abilities/ 下的聚焦文件。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, resolveSpecial } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { getDiscardSpecialOptions } from '../domain/discardSpecialAbilities';
import { startDuel } from '../domain/duel';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers, interceptEvent, isMinionProtected } from '../domain/ongoingEffects';
import { getEffectivePower, getPlayerEffectivePowerOnBase, getTotalEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { reduce } from '../domain/reduce';
import { execute, processDestroyTriggers } from '../domain/reducer';
import { getAbilityRuntimePromptHandler } from '../domain/abilityRuntime';
import { validate } from '../domain/commands';
import { resumePendingBranchingChoiceFrames } from '../domain/branchingChoice';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getInteractionsFromMS,
    findInteractionOption,
    resolveInteractionChain,
} from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import type { MatchState } from '../../../engine/types';
import {
    createSimpleChoice,
    queueInteraction,
    refreshInteractionOptions,
    resolveInteraction,
} from '../../../engine/systems/InteractionSystem';
import { getCardDef } from '../data/cards';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

function resolveDuelChain(
    initialState: MatchState<SmashUpCore>,
    overrides: Partial<Record<string, (prompt: any, state: MatchState<SmashUpCore>, step: number) => { optionId?: string; optionIds?: string[]; mergedValue?: unknown }>> = {},
) {
    return resolveInteractionChain(initialState, (prompt, state, step) => {
        const sourceId = prompt?.data?.sourceId as string | undefined;
        const custom = sourceId ? overrides[sourceId] : undefined;
        if (custom) return custom(prompt, state, step);

        if (sourceId === 'smashup_duel_pinkerton') {
            const option = findInteractionOption(prompt, option => option?.value?.amount === 0);
            if (!option) throw new Error('未找到 Pinkerton 的 0 指示物选项');
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_card' || sourceId === 'smashup_duel_deputy_card') {
            const option = findInteractionOption(prompt, option => option?.value?.skip === true);
            if (!option) throw new Error(`未找到 ${sourceId} 的跳过选项`);
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_run_em_off_move') {
            return { optionId: prompt.data.options[0].id };
        }

        throw new Error(`未处理的决斗交互 sourceId: ${sourceId ?? 'unknown'}`);
    });
}


describe('Samurai abilities', () => {
    it('samurai_samurai_chan 在自己从场上进入弃牌堆后抽一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('chan-1', 'samurai_samurai_chan', '0', 2)],
                ongoingActions: [],
            }],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('chan-1', 'samurai_samurai_chan', '0', 2),
            triggerMinionUid: 'chan-1',
            triggerMinionDefId: 'samurai_samurai_chan',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_samurai_chan_pod 在自己因基地结算进入弃牌堆后也会抽一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('chan-pod-1', 'samurai_samurai_chan_pod', '0', 2)],
                ongoingActions: [],
            }],
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('chan-pod-1', 'samurai_samurai_chan_pod', '0', 2),
            triggerMinionUid: 'chan-pod-1',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            random: defaultTestRandom,
            now: 1001,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_ronin 在自己是该基地唯一己方随从时只放置一个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ronin-1', 'samurai_ronin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ronin-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_ronin');

        const yesOption = prompt.data.options.find((entry: any) => entry.value?.apply === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: yesOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ronin-1')?.powerCounters).toBe(1);
    });

    it('samurai_ronin_pod 在自己是该基地唯一己方随从时放置两个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ronin-pod-1', 'samurai_ronin_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ronin-pod-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_ronin_pod');

        const yesOption = prompt.data.options.find((entry: any) => entry.value?.apply === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: yesOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ronin-pod-1')?.powerCounters).toBe(2);
    });

    it('samurai_ronin_pod 在天守阁登场且自己是该基地唯一己方随从时仍放置两个 +1 指示物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ronin-pod-1', 'samurai_ronin_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_shoguns_palace_pod', minions: [], ongoingActions: [] }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'ronin-pod-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_ronin_pod');

        const yesOption = prompt.data.options.find((entry: any) => entry.value?.apply === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: yesOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ronin-pod-1')?.powerCounters).toBe(2);
    });

    it('samurai_way_of_the_warrior 在阶段 3 弃置时仍会基于 LKI 结算抽 2', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            turnNumber: 2,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                    discard: [makeCard('wotw-1', 'samurai_way_of_the_warrior', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            } as any,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_bushi', '0', 4, {
                    metadata: {
                        samuraiWayOfTheWarriorDrawPlayerId: '0',
                        samuraiWayOfTheWarriorDrawUntilTurnNumber: 3,
                    },
                })],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_bushi',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const resolved = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expect(resolved!.state.sys.interaction.current).toBeUndefined();
        const drawEvent = resolved!.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
    });

    it('samurai_way_of_the_warrior 在阶段 3 弃置时仍会基于 LKI 结算抽 2', () => {
        const core = makeState({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            turnNumber: 2,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_alpha', 'minion', '0'),
                    ],
                    discard: [makeCard('wotw-1', 'samurai_way_of_the_warrior', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            } as any,
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_bushi', '0', 4, {
                    metadata: {
                        samuraiWayOfTheWarriorDrawPlayerId: '0',
                        samuraiWayOfTheWarriorDrawUntilTurnNumber: 3,
                    },
                })],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_bushi',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const resolved = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expect(resolved!.state.sys.interaction.current).toBeUndefined();
        const drawEvent = resolved!.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
    });

    it('samurai_yokai_attack 会消灭己方一个随从并给予额外随从与行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('yokai-1', 'samurai_yokai_attack', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'yokai-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('samurai_yokai_attack');

        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        const limitEvents = resolved.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(resolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(limitEvents.some((event: any) => event.payload.limitType === 'minion')).toBe(true);
        expect(limitEvents.some((event: any) => event.payload.limitType === 'action')).toBe(true);
    });

    it('cowboys_dynamite_surprise 在你的手牌被另一位玩家展示时可以直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4)],
                ongoingActions: [],
            }],
        });

        const trigger = fireTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            reason: 'test_reveal_hand',
            inspectionCards: [{ uid: 'dyn-1', defId: 'cowboys_dynamite_surprise' }],
            inspectionZone: 'hand',
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getInteractionsFromMS(trigger.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            trigger.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'dyn-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-1')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('cowboys_dynamite_surprise 在你的牌库顶被另一位玩家翻开时也可以直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4)],
                ongoingActions: [],
            }],
        });

        const trigger = fireTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            reason: 'test_reveal_deck_top',
            inspectionCards: [{ uid: 'dyn-1', defId: 'cowboys_dynamite_surprise' }],
            inspectionZone: 'deck',
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
            random: defaultTestRandom,
            now: 1001,
        });

        const prompt = getInteractionsFromMS(trigger.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            trigger.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'dyn-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-1')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('cowboys_dynamite_surprise_pod 在你的牌库顶被另一位玩家翻开时也可以直接打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('dyn-1', 'cowboys_dynamite_surprise_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4)],
                ongoingActions: [],
            }],
        });

        const trigger = fireTriggers(core, 'onDeckInspected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            reason: 'test_reveal_deck_top',
            inspectionCards: [{ uid: 'dyn-1', defId: 'cowboys_dynamite_surprise_pod' }],
            inspectionZone: 'deck',
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
            random: defaultTestRandom,
            now: 1002,
        });

        const prompt = getInteractionsFromMS(trigger.matchState!)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            trigger.matchState!,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: target.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'dyn-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-1')).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('samurai_yokai_attack 可以跳过而不消灭己方随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('yokai-1', 'samurai_yokai_attack', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'yokai-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const skipOption = prompt.data.options.find((entry: any) => entry.value?.skip === true);
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: skipOption.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(resolved.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'ally-1')).toBe(true);
    });

    it('samurai_yokai_attack 选择不能被消灭的己方随从时不会给额外额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('yokai-1', 'samurai_yokai_attack', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('warbot-1', 'robot_warbot', '0', 4)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'yokai-1' } },
            defaultTestRandom,
        );
        const prompt = getInteractionsFromMS(play.finalState)[0] as any;
        const option = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'warbot-1');
        const resolved = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(resolved.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'warbot-1')).toBe(true);
    });

    it('samurai_honorable_combat 按决斗结果给胜者 1VP 而不会默认消灭失败者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('combat-1', 'samurai_honorable_combat', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'combat-1' } },
            defaultTestRandom,
        );
        const friendlyPrompt = getInteractionsFromMS(play.finalState)[0] as any;
        expect(friendlyPrompt?.data?.sourceId).toBe('samurai_honorable_combat_friendly');

        const friendlyOption = friendlyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const afterFriendly = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: friendlyOption.id } } as any,
            defaultTestRandom,
        );

        const enemyPrompt = getInteractionsFromMS(afterFriendly.finalState)[0] as any;
        expect(enemyPrompt?.data?.sourceId).toBe('samurai_honorable_combat_enemy');

        const enemyOption = enemyPrompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            afterFriendly.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: enemyOption.id } } as any,
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);
        expect(duelResolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(duelResolved.finalState.core.bases[0].minions).toHaveLength(2);
        expect(duelResolved.finalState.core.players['1'].vp).toBe(1);
    });

    it('samurai_honorable_combat 面对仅有烟雾弹目标时不会启动决斗交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('combat-1', 'samurai_honorable_combat', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('enemy-smoke', 'ninja_tiger_assassin', '1', 4, {
                        attachedActions: [{ uid: 'smoke-1', defId: 'ninja_smoke_bomb', ownerId: '1' }],
                    }),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'combat-1' } },
            defaultTestRandom,
        );

        expect(getInteractionsFromMS(play.finalState)).toHaveLength(0);
        expect(play.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
    });

    it('samurai_honorable_combat 平局时双方各得 1VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const started = startDuel(
            makeMatchState(core),
            {
                sourceId: 'samurai_honorable_combat',
                sourcePlayerId: '0',
                challengerMinionUid: 'ally-1',
                challengedMinionUid: 'enemy-1',
                outcome: 'vp_to_winner',
            },
            1000,
        );

        const duelResolved = resolveDuelChain(started);
        const vpEvents = duelResolved.events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(2);
        expect(duelResolved.finalState.core.players['0'].vp).toBe(1);
        expect(duelResolved.finalState.core.players['1'].vp).toBe(1);
    });

    it('samurai_code_of_bushido 可以分三次把指示物分配给你的随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bushido-1', 'samurai_code_of_bushido', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    makeMinion('ally-2', 'samurai_bushi', '0', 4),
                ],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bushido-1' } },
            defaultTestRandom,
        );
        const prompt1 = getInteractionsFromMS(play.finalState)[0] as any;
        expect(prompt1?.data?.sourceId).toBe('samurai_code_of_bushido');

        const chooseAlly1a = prompt1.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const step1 = runCommand(
            play.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly1a.id } } as any,
            defaultTestRandom,
        );

        const prompt2 = getInteractionsFromMS(step1.finalState)[0] as any;
        const chooseAlly1b = prompt2.data.options.find((entry: any) => entry.value?.minionUid === 'ally-1');
        const step2 = runCommand(
            step1.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly1b.id } } as any,
            defaultTestRandom,
        );

        const prompt3 = getInteractionsFromMS(step2.finalState)[0] as any;
        const chooseAlly2 = prompt3.data.options.find((entry: any) => entry.value?.minionUid === 'ally-2');
        const resolved = runCommand(
            step2.finalState,
            { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: chooseAlly2.id } } as any,
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-1')?.powerCounters).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-2')?.powerCounters).toBe(1);
    });

    it('samurai_honor_the_ancestors 会放置一个指示物并把弃牌堆中的随从洗回牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ancestors-1', 'samurai_honor_the_ancestors', 'action', '0')],
                    deck: [makeCard('deck-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('discard-1', 'samurai_ronin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_bushi', '0', 4)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ancestors-1' } },
            defaultTestRandom,
        );

        expect(play.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        expect(play.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.powerCounters).toBe(1);
        expect(play.finalState.core.players['0'].deck.some(card => card.uid === 'discard-1')).toBe(true);
        expect(play.finalState.core.players['0'].discard.some(card => card.uid === 'discard-1')).toBe(false);
    });

    it('samurai_way_of_the_warrior 会让目标本回合进入弃牌堆时抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-1', 'samurai_way_of_the_warrior', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_ronin', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(target?.tempPowerModifier).toBe(3);

        const result = fireTriggers(play.finalState.core, 'onMinionDestroyed', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 1004,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_way_of_the_warrior 在目标因基地结算进入弃牌堆时也会抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-1', 'samurai_way_of_the_warrior', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_ronin', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const result = fireTriggers(play.finalState.core, 'onMinionDiscardedFromBase', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            random: defaultTestRandom,
            now: 1005,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_way_of_the_warrior_pod 在目标因基地结算进入弃牌堆时也会抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-pod-1', 'samurai_way_of_the_warrior_pod', 'action', '0')],
                    deck: [makeCard('draw-pod-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-pod-1', 'samurai_ronin_pod', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-pod-1', targetBaseIndex: 0, targetMinionUid: 'ally-pod-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-pod-1');
        expect(target?.tempPowerModifier).toBe(3);

        const result = fireTriggers(play.finalState.core, 'onMinionDiscardedFromBase', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-pod-1',
            triggerMinionDefId: 'samurai_ronin_pod',
            random: defaultTestRandom,
            now: 1104,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('samurai_way_of_the_warrior 在焦油坑把目标改放牌库底时不会抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('warrior-1', 'samurai_way_of_the_warrior', 'action', '0')],
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_tar_pits',
                minions: [makeMinion('ally-1', 'samurai_ronin', '0', 3)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'warrior-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
            },
            defaultTestRandom,
        );

        const target = play.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const result = fireTriggers(play.finalState.core, 'onMinionDestroyed', {
            state: play.finalState.core,
            matchState: play.finalState,
            playerId: '0',
            baseIndex: 0,
            triggerMinion: target,
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            reason: 'test_destroy',
            random: defaultTestRandom,
            now: 1006,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });

    it('samurai_shogun 会在另一名己方随从从场上进入弃牌堆后给自己一个指示物', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('shogun-1', 'samurai_shogun', '0', 5),
                    makeMinion('ally-1', 'samurai_ronin', '0', 3),
                ],
                ongoingActions: [],
            }],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('ally-1', 'samurai_ronin', '0', 3),
            triggerMinionUid: 'ally-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1001,
        });

        const counterEvent = result.events.find(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any;
        expect(counterEvent).toBeDefined();
        expect(counterEvent.payload.minionUid).toBe('shogun-1');
        expect(counterEvent.payload.amount).toBe(1);
    });

    it('samurai_bushi_pod 在以 5 力量因基地结算进入弃牌堆时会给你 1VP，且 samurai_shogun_pod 仍会获得指示物', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_shoguns_palace_pod',
                    minions: [makeMinion('bushi-pod-1', 'samurai_bushi_pod', '0', 4, { powerCounters: 1 })],
                    ongoingActions: [],
                },
                {
                    defId: 'base_great_library',
                    minions: [makeMinion('shogun-pod-1', 'samurai_shogun_pod', '0', 5)],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('bushi-pod-1', 'samurai_bushi_pod', '0', 4, { powerCounters: 1 }),
            triggerMinionUid: 'bushi-pod-1',
            triggerMinionDefId: 'samurai_bushi_pod',
            triggerMinionPower: 5,
            random: defaultTestRandom,
            now: 1002,
        });

        expect(result.events.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload.playerId === '0'
            && (event as any).payload.amount === 1,
        )).toBe(true);
        expect(result.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload.minionUid === 'shogun-pod-1',
        )).toBe(true);
    });

    it('samurai_bushi 在被消灭时应使用离场前有效力量判定 5 力量奖励 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('bushi-1', 'samurai_bushi', '0', 4, { powerCounters: 1 })],
                ongoingActions: [],
            }],
        });
        const state = makeMatchState(core);
        const destroyEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'bushi-1',
                minionDefId: 'samurai_bushi',
                fromBaseIndex: 0,
                ownerId: '0',
                destroyerId: '1',
                reason: 'test_destroy',
            },
            timestamp: 1010,
        } as any;

        const processed = processDestroyTriggers([destroyEvent], state, '1', defaultTestRandom, 1010);
        const queuedEvent = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queuedEvent).toBeDefined();

        const bushiTrigger = (queuedEvent.payload?.triggers ?? []).find((trigger: any) => trigger.sourceDefId === 'samurai_bushi');
        expect(bushiTrigger).toBeDefined();
        expect(bushiTrigger.triggerMinionPower).toBe(5);
    });

    it('samurai_final_haiku 在附着随从离场后给你的随从直到回合结束 +2 力量', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('host-1', 'samurai_bushi', '0', 4, {
                            attachedActions: [{ uid: 'haiku-1', defId: 'samurai_final_haiku', ownerId: '0' }] as any,
                        }),
                        makeMinion('ally-1', 'samurai_ronin', '0', 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-2', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('host-1', 'samurai_bushi', '0', 4),
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'samurai_bushi',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1002,
        });

        const tempPowerTargets = result.events
            .filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)
            .map((event: any) => event.payload.minionUid);
        expect(tempPowerTargets).not.toContain('host-1');
        expect(tempPowerTargets).toContain('ally-1');
        expect(tempPowerTargets).toContain('ally-2');
    });

    it('samurai_final_haiku_pod 在附着随从离场后给你的随从直到回合结束 +2 力量', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('host-pod-1', 'samurai_bushi_pod', '0', 4, {
                            attachedActions: [{ uid: 'haiku-pod-1', defId: 'samurai_final_haiku_pod', ownerId: '0' }] as any,
                        }),
                        makeMinion('ally-pod-1', 'samurai_ronin_pod', '0', 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-pod-2', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('host-pod-1', 'samurai_bushi_pod', '0', 4),
            triggerMinionUid: 'host-pod-1',
            triggerMinionDefId: 'samurai_bushi_pod',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1003,
        });

        const tempPowerTargets = result.events
            .filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)
            .map((event: any) => event.payload.minionUid);
        expect(tempPowerTargets).not.toContain('host-pod-1');
        expect(tempPowerTargets).toContain('ally-pod-1');
        expect(tempPowerTargets).toContain('ally-pod-2');
    });

    it('samurai_honor_the_fallen 在你此处的随从进入弃牌堆后让你抓一张牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'hof-1', defId: 'samurai_honor_the_fallen', ownerId: '0' } as any],
            }],
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: makeMinion('dead-1', 'samurai_ronin', '0', 3),
            triggerMinionUid: 'dead-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });
});
