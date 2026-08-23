/**
 * 大杀四方 - 武士派系能力测试
 *
 * 聚焦验证 Samurai/Cowboys 相关能力的可观察行为。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import type { SmashUpCore } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { startDuel } from '../../domain/duel';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    respondToPrompt,
    respondToPromptOptions,
    expectNoPrompt,
    resolveInteractionChain,
    resolveDestroyedMinions,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';
import type { MatchState } from '../../../../engine/types';

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
        const sourceId = getPromptSourceId(prompt);
        const custom = sourceId ? overrides[sourceId] : undefined;
        if (custom) return custom(prompt, state, step);

        if (sourceId === 'smashup_duel_pinkerton') {
            const option = getPromptOption(prompt, option => option?.value?.amount === 0, 'Pinkerton 的 0 指示物选项');
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_card' || sourceId === 'smashup_duel_deputy_card') {
            const option = getPromptOption(prompt, option => option?.value?.skip === true, `${sourceId} 的跳过选项`);
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_run_em_off_move') {
            const options = getPromptOptions(prompt);
            if (!options[0]) throw new Error('未找到 Run Em Off 移动选项');
            return { optionId: options[0].id };
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
        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_ronin');

        const yesOption = getPromptOption(prompt, entry => entry.value?.apply === true, 'samurai_ronin apply option');
        const resolved = respondToPrompt(
            play.finalState,
            yesOption.id,
            '0',
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
        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_ronin_pod');

        const yesOption = getPromptOption(prompt, entry => entry.value?.apply === true, 'samurai_ronin_pod apply option');
        const resolved = respondToPrompt(
            play.finalState,
            yesOption.id,
            '0',
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

        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_ronin_pod');

        const yesOption = getPromptOption(prompt, entry => entry.value?.apply === true, 'samurai_ronin_pod apply option');
        const resolved = respondToPrompt(
            play.finalState,
            yesOption.id,
            '0',
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
        }, {
            sourceDefIds: ['samurai_way_of_the_warrior'],
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const resolved = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expectNoPrompt(resolved!.state);
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
        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_yokai_attack');

        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'ally-1', 'samurai_yokai_attack ally option');
        const resolved = respondToPrompt(
            play.finalState,
            option.id,
            '0',
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

        const prompt = getSimpleChoicePrompt(trigger.matchState!, 'cowboys_dynamite_surprise_seen');

        const target = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1', 'cowboys dynamite target option');
        const resolved = respondToPrompt(
            trigger.matchState!,
            target.id,
            '0',
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

        const prompt = getSimpleChoicePrompt(trigger.matchState!, 'cowboys_dynamite_surprise_seen');

        const target = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1', 'cowboys dynamite target option');
        const resolved = respondToPrompt(
            trigger.matchState!,
            target.id,
            '0',
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

        const prompt = getSimpleChoicePrompt(trigger.matchState!, 'cowboys_dynamite_surprise_seen');

        const target = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1', 'cowboys dynamite target option');
        const resolved = respondToPrompt(
            trigger.matchState!,
            target.id,
            '0',
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
        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_yokai_attack');
        const skipOption = getPromptOption(prompt, entry => entry.value?.skip === true, 'samurai_yokai_attack skip option');
        const resolved = respondToPrompt(
            play.finalState,
            skipOption.id,
            '0',
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
        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_yokai_attack');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'warbot-1', 'samurai_yokai_attack warbot option');
        const resolved = respondToPrompt(
            play.finalState,
            option.id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(resolved.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({
                playerId: '0',
                messageKey: 'feedback.target_protected',
                tone: 'warning',
            }),
        }));
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
        const basePrompt = getSimpleChoicePrompt(play.finalState, 'samurai_honorable_combat_base');
        expect(basePrompt.autoResolveIfSingle).toBe(false);
        const afterBase = respondToPrompt(
            play.finalState,
            getPromptOption(basePrompt, entry => entry.value?.baseIndex === 0, 'honorable combat base option').id,
            '0',
            defaultTestRandom,
        );
        const friendlyPrompt = getSimpleChoicePrompt(afterBase.finalState, 'samurai_honorable_combat_friendly');

        const friendlyOption = getPromptOption(friendlyPrompt, entry => entry.value?.minionUid === 'ally-1', 'honorable combat friendly option');
        const afterFriendly = respondToPrompt(
            afterBase.finalState,
            friendlyOption.id,
            '0',
            defaultTestRandom,
        );

        const enemyPrompt = getSimpleChoicePrompt(afterFriendly.finalState, 'samurai_honorable_combat_enemy');

        const enemyOption = getPromptOption(enemyPrompt, entry => entry.value?.minionUid === 'enemy-1', 'honorable combat enemy option');
        const resolved = respondToPrompt(
            afterFriendly.finalState,
            enemyOption.id,
            '0',
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

        expectNoPrompt(play.finalState);
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
        const prompt1 = getSimpleChoicePrompt(play.finalState, 'samurai_code_of_bushido');

        const chooseAlly1a = getPromptOption(prompt1, entry => entry.value?.minionUid === 'ally-1', 'code of bushido first ally option');
        const step1 = respondToPrompt(
            play.finalState,
            chooseAlly1a.id,
            '0',
            defaultTestRandom,
        );

        const prompt2 = getSimpleChoicePrompt(step1.finalState, 'samurai_code_of_bushido');
        const chooseAlly1b = getPromptOption(prompt2, entry => entry.value?.minionUid === 'ally-1', 'code of bushido second ally option');
        const step2 = respondToPrompt(
            step1.finalState,
            chooseAlly1b.id,
            '0',
            defaultTestRandom,
        );

        const prompt3 = getSimpleChoicePrompt(step2.finalState, 'samurai_code_of_bushido');
        const chooseAlly2 = getPromptOption(prompt3, entry => entry.value?.minionUid === 'ally-2', 'code of bushido third ally option');
        const resolved = respondToPrompt(
            step2.finalState,
            chooseAlly2.id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-1')?.powerCounters).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(m => m.uid === 'ally-2')?.powerCounters).toBe(1);
    });

    it('samurai_code_of_bushido 只有一个己方随从时也保留三次玩家确认', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bushido-1', 'samurai_code_of_bushido', 'action', '0')],
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
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'bushido-1' } },
            defaultTestRandom,
        );

        expect(play.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        let current = play.finalState;
        for (let step = 0; step < 3; step += 1) {
            const prompt = getSimpleChoicePrompt(current, 'samurai_code_of_bushido');
            expect(prompt.autoResolveIfSingle).toBe(false);
            const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'ally-1', 'code of bushido single ally option');
            current = respondToPrompt(current, option.id, '0', defaultTestRandom).finalState;
        }

        expect(current.core.bases[0].minions.find(m => m.uid === 'ally-1')?.powerCounters).toBe(3);
        expectNoPrompt(current);
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

        expect(play.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_honor_the_ancestors');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'ally-1', 'honor the ancestors single ally option');
        const counterResolved = respondToPrompt(play.finalState, option.id, '0', defaultTestRandom);

        expect(counterResolved.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        expect(counterResolved.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(false);
        expect(counterResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.powerCounters).toBe(1);

        const recyclePrompt = getSimpleChoicePrompt(counterResolved.finalState, 'samurai_honor_the_ancestors_recycle');
        expect(recyclePrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(recyclePrompt).map(option => option.value?.cardUid)).toEqual(['discard-1']);
        const recycleOption = getPromptOption(recyclePrompt, entry => entry.value?.cardUid === 'discard-1', 'honor the ancestors recycle option');
        const resolved = respondToPromptOptions(counterResolved.finalState, [recycleOption.id], '0', defaultTestRandom);

        expect(resolved.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'discard-1')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'discard-1')).toBe(false);
    });

    it('samurai_honor_the_ancestors 洗回被他人拥有的弃牌随从时，仍应洗回其拥有者牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ancestors-borrowed-1', 'samurai_honor_the_ancestors', 'action', '0')],
                    deck: [makeCard('p0-deck-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('borrowed-ronin', 'pirate_first_mate', 'minion', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-1', 'wizard_archmage', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'samurai_bushi', '0', 4)],
                ongoingActions: [],
            }],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'ancestors-borrowed-1' } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(play.finalState, 'samurai_honor_the_ancestors');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'ally-1', 'honor the ancestors borrowed ally option');
        const counterResolved = respondToPrompt(play.finalState, option.id, '0', defaultTestRandom);
        const recyclePrompt = getSimpleChoicePrompt(counterResolved.finalState, 'samurai_honor_the_ancestors_recycle');
        expect(recyclePrompt.autoResolveIfSingle).toBe(false);
        const recycleOption = getPromptOption(recyclePrompt, entry => entry.value?.cardUid === 'borrowed-ronin', 'honor the ancestors borrowed recycle option');
        const resolved = respondToPromptOptions(counterResolved.finalState, [recycleOption.id], '0', defaultTestRandom);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
            }),
        }));
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'borrowed-ronin')).toBe(false);
        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'borrowed-ronin')).toBe(false);
        expect(resolved.finalState.core.players['1'].deck.some(card => card.uid === 'borrowed-ronin')).toBe(true);
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

        const processed = resolveDestroyedMinions(state, '1', [destroyEvent], defaultTestRandom, 1010);
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

    it('samurai_final_haiku 在宿主进入弃牌堆后仍会通过 queued discard trigger 给其他己方随从 +2 力量', () => {
        const preDiscardCore = makeState({
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

        const queued = collectTriggers(preDiscardCore, 'onMinionDiscardedFromBase', {
            state: preDiscardCore,
            matchState: makeMatchState(preDiscardCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: preDiscardCore.bases[0].minions[0],
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'samurai_bushi',
            random: defaultTestRandom,
            now: 1006,
        }, {
            sourceDefIds: ['samurai_final_haiku'],
        });

        expect(queued).toBeDefined();

        const queuedCore = makeState({
            players: preDiscardCore.players,
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'samurai_ronin', '0', 3)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('ally-2', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
            ],
            triggerQueue: (queued as any).payload.triggers,
        });

        const resolved = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 1006);
        expect(resolved).toBeDefined();
        const tempPowerTargets = resolved!.events
            .filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)
            .map((event: any) => event.payload.minionUid);
        expect(tempPowerTargets).toContain('ally-1');
        expect(tempPowerTargets).toContain('ally-2');
        expect(tempPowerTargets).not.toContain('host-1');
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
