import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { buildSmashUpAiLegalActions } from '../../ai';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers, isCardSuppressed } from '../../domain/ongoingEffects';
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
    expectNoPrompt,
    getPromptOption,
    getPromptSourceId,
    getFirstPrompt,
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
    respondToPromptOptions,
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

    it('野蛮攻击摧毁随从后，柯克船长面具先强制累计力量，再出现后续加力选择', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'diy_killers_savage_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('mask-host', 'diy_killers_michael_myers', '0', 5, {
                    attachedActions: [{ uid: 'mask1', defId: 'diy_killers_captain_kirk_mask', ownerId: '0' }],
                }),
                makeMinion('victim', 'pirate_first_mate', '1', 2, { powerModifier: 1 }),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(played.success, played.error).toBe(true);

        const destroyed = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'victim',
            '选择野蛮攻击目标',
            '0',
            defaultTestRandom,
        );
        expect(destroyed.success, destroyed.error).toBe(true);
        expect(getSimpleChoicePrompt(destroyed.finalState, 'diy_killers_savage_attack_boost')).toBeDefined();
        expect(destroyed.finalState.core.bases[0].minions.find(minion => minion.uid === 'mask-host')?.tempPowerModifier).toBe(3);

        const skippedBoost = respondToPromptOption(
            destroyed.finalState,
            option => option.value?.skip === true,
            '跳过后续加力',
            '0',
            defaultTestRandom,
        );
        expect(skippedBoost.success, skippedBoost.error).toBe(true);
        expect(skippedBoost.finalState.core.bases[0].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(skippedBoost.finalState.core.bases[0].minions.find(minion => minion.uid === 'mask-host')?.tempPowerModifier).toBe(3);
        expect(skippedBoost.finalState.core.players['0'].discard.some(card => card.uid === 'a1')).toBe(true);
        expect(skippedBoost.finalState.sys.interaction?.current).toBeUndefined();
    });

    it('野蛮攻击按印刷力量和己方基地条件筛选目标，不把有效力量当成印刷力量', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'diy_killers_savage_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('killer1', 'diy_killers_jason', '0', 5),
                    makeMinion('printed-2-effective-4', 'pirate_first_mate', '1', 2, { powerModifier: 2 }),
                    makeMinion('printed-4-effective-2', 'pirate_buccaneer', '1', 4, { powerModifier: -2 }),
                ]),
                makeBase('base_b', [makeMinion('off-base-weak', 'pirate_first_mate', '1', 2)]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_savage_attack');
        expect(prompt.options.some(option => option.value?.minionUid === 'printed-2-effective-4')).toBe(true);
        expect(prompt.options.some(option => option.value?.minionUid === 'printed-4-effective-2')).toBe(false);
        expect(prompt.options.some(option => option.value?.minionUid === 'off-base-weak')).toBe(false);

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'printed-2-effective-4',
            '选择印刷力量 2 的目标',
        );
        expect(resolved.success, resolved.error).toBe(true);
        const boostPrompt = getSimpleChoicePrompt(resolved.finalState, 'diy_killers_savage_attack_boost');
        expect(boostPrompt.options).toHaveLength(2);
        expect(boostPrompt.options.some(option => option.value?.minionUid === 'killer1')).toBe(true);
        expect(boostPrompt.options.some(option => option.value?.minionUid === 'off-base-weak')).toBe(false);
    });

    it('野蛮攻击让过时不摧毁目标，也不继续生成加力选择', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'diy_killers_savage_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('killer1', 'diy_killers_jason', '0', 5),
                makeMinion('weak1', 'pirate_first_mate', '1', 2),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        });
        expect(played.success, played.error).toBe(true);

        const skipped = respondToPromptOption(
            played.finalState,
            option => option.value?.skip === true,
            '跳过野蛮攻击摧毁',
        );
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.bases[0].minions.some(minion => minion.uid === 'weak1')).toBe(true);
        expect(skipped.finalState.sys.interaction?.current).toBeUndefined();
        expect(skipped.finalState.core.players['0'].discard.some(card => card.uid === 'a1')).toBe(true);
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

    it.each([true, false])('结束了? 指定额外打出的回收牌须立即选择使用或放弃（使用=%s）', useCard => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('end', 'diy_killers_is_it_over', 'action', '0')],
                    discard: [makeCard('machete', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5)])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'end' } });
        expect(played.success, played.error).toBe(true);
        const recovered = respondToPromptOption(played.finalState, option => option.value?.cardUid === 'machete', '回收大砍刀');
        expect(recovered.success, recovered.error).toBe(true);
        const prompt = getSimpleChoicePrompt(recovered.finalState, 'smashup_immediate_extra_action');
        expect(prompt.options.some((option: any) => option.value?.cardUid === 'machete')).toBe(true);
        expect(prompt.options.some((option: any) => option.value?.skip === true)).toBe(true);
        const choice = respondToPromptOption(
            recovered.finalState,
            option => useCard ? option.value?.cardUid === 'machete' : option.value?.skip === true,
            '决定是否立即打出大砍刀',
        );
        expect(choice.success, choice.error).toBe(true);
        if (!useCard) {
            expect(choice.finalState.core.players['0'].hand.some(card => card.uid === 'machete')).toBe(true);
            expect(choice.finalState.core.players['0'].specificExtraActionPlays ?? []).toHaveLength(0);
            return;
        }
        const attached = respondToPromptOption(choice.finalState, option => option.value?.minionUid === 'host', '选择附着宿主');
        expect(attached.success, attached.error).toBe(true);
        expect(attached.finalState.core.bases[0].minions[0].attachedActions.map(action => action.uid)).toContain('machete');
        expect(attached.finalState.core.players['0'].specificExtraActionPlays ?? []).toHaveLength(0);
    });

    it('简易武器抽到指定牌后须立即选择使用或放弃', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('weapon', 'diy_killers_improvised_weapon', 'action', '0')],
                    deck: [makeCard('machete', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5)])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'weapon' } });
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'smashup_immediate_extra_action');
        expect(prompt.options.some((option: any) => option.value?.cardUid === 'machete')).toBe(true);
        expect(prompt.options.some((option: any) => option.value?.skip === true)).toBe(true);
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
        expect(limit?.payload.destroyAttachedActionAtTurnEnd).toBe(true);
    });

    it('简易武器打出的附着行动在本回合结束时进入弃牌堆', () => {
        const state = makeMatchState(makeState({
            turnNumber: 4,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('weapon', 'diy_killers_improvised_weapon', 'action', '0')],
                    deck: [makeCard('machete1', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5)])],
        }));

        const weapon = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'weapon' },
        });
        expect(weapon.success, weapon.error).toBe(true);

        const selected = respondToPromptOption(weapon.finalState, option => option.value?.cardUid === 'machete1', '立即打出大砍刀');
        expect(selected.success, selected.error).toBe(true);
        const playedAttachment = respondToPromptOption(selected.finalState, option => option.value?.minionUid === 'host', '选择大砍刀宿主');
        expect(playedAttachment.success, playedAttachment.error).toBe(true);
        expect(playedAttachment.finalState.core.bases[0].minions[0].attachedActions).toEqual([
            expect.objectContaining({
                uid: 'machete1',
                metadata: expect.objectContaining({
                    diyKillersImprovisedWeaponControllerId: '0',
                    diyKillersImprovisedWeaponTurnNumber: 4,
                }),
            }),
        ]);
        expect(playedAttachment.finalState.core.players['0'].specificExtraActionPlays ?? []).toEqual([]);

        const turnEnd = fireTriggers(playedAttachment.finalState.core, 'onTurnEnd', {
            state: playedAttachment.finalState.core,
            matchState: playedAttachment.finalState,
            playerId: '0',
            now: 40,
        });
        expect(turnEnd.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(true);
        const detached = applyEvents(playedAttachment.finalState.core, turnEnd.events);
        expect(detached.bases[0].minions[0].attachedActions.some(action => action.uid === 'machete1')).toBe(false);
        expect(detached.players['0'].discard.some(card => card.uid === 'machete1')).toBe(true);
    });

    it('简易武器只抽到但未打出的附着行动不会在回合结束时被误弃置', () => {
        const state = makeMatchState(makeState({
            turnNumber: 4,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('weapon', 'diy_killers_improvised_weapon', 'action', '0')],
                    deck: [makeCard('machete1', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5)])],
        }));

        const weapon = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'weapon' },
        });
        expect(weapon.success, weapon.error).toBe(true);

        const skipped = respondToPromptOption(weapon.finalState, option => option.value?.skip === true, '放弃额外打出');
        expect(skipped.success, skipped.error).toBe(true);

        const turnEnd = fireTriggers(skipped.finalState.core, 'onTurnEnd', {
            state: skipped.finalState.core,
            matchState: skipped.finalState,
            playerId: '0',
            now: 40,
        });
        expect(turnEnd.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(false);
        expect(skipped.finalState.core.players['0'].hand.some(card => card.uid === 'machete1')).toBe(true);
        expect(skipped.finalState.core.players['0'].discard.some(card => card.uid === 'machete1')).toBe(false);
    });

    it('简易武器立即打出的装备经过对手反制窗口后仍在回合结束摧毁', () => {
        const state = makeMatchState(makeState({
            turnNumber: 4,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('weapon', 'diy_killers_improvised_weapon', 'action', '0')],
                    deck: [makeCard('machete', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1', { hand: [makeCard('counter', 'geeks_force_of_wil', 'action', '1')] }),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5)])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'weapon' } });
        expect(played.success, played.error).toBe(true);
        const passedWeapon = respondToPrompt(played.finalState, 'pass', '1', defaultTestRandom);
        expect(passedWeapon.success, passedWeapon.error).toBe(true);
        const selected = respondToPromptOption(passedWeapon.finalState, option => option.value?.cardUid === 'machete', '立即打出大砍刀');
        expect(selected.success, selected.error).toBe(true);
        const targeted = respondToPromptOption(selected.finalState, option => option.value?.minionUid === 'host', '选择宿主');
        expect(targeted.success, targeted.error).toBe(true);
        getSimpleChoicePrompt(targeted.finalState, 'smashup_action_counter_choose');
        const passedMachete = respondToPrompt(targeted.finalState, 'pass', '1', defaultTestRandom);
        expect(passedMachete.success, passedMachete.error).toBe(true);
        expect(passedMachete.finalState.core.bases[0].minions[0].attachedActions[0].metadata).toMatchObject({
            diyKillersImprovisedWeaponControllerId: '0', diyKillersImprovisedWeaponTurnNumber: 4,
        });
        const turnEnd = fireTriggers(passedMachete.finalState.core, 'onTurnEnd', {
            state: passedMachete.finalState.core, matchState: passedMachete.finalState, playerId: '0', now: 40,
        });
        const finished = applyEvents(passedMachete.finalState.core, turnEnd.events);
        expect(finished.players['0'].discard.some(card => card.uid === 'machete')).toBe(true);
    });

    it('回合结束前简易武器被洗入牌库并抽回手时仍摧毁其装备', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('weapon', 'diy_killers_improvised_weapon', 'action', '0')],
                    deck: [makeCard('machete', 'diy_killers_machete', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5)])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'weapon' } });
        expect(played.success, played.error).toBe(true);
        const selected = respondToPromptOption(played.finalState, option => option.value?.cardUid === 'machete', '立即打出装备');
        expect(selected.success, selected.error).toBe(true);
        const attached = respondToPromptOption(selected.finalState, option => option.value?.minionUid === 'host', '选择宿主');
        expect(attached.success, attached.error).toBe(true);
        const finished = runCommand(attached.finalState, { type: 'ADVANCE_PHASE', playerId: '0' } as any);
        expect(finished.success, finished.error).toBe(true);
        expect(finished.finalState.core.players['0'].hand.some(card => card.uid === 'weapon')).toBe(true);
        expect(finished.finalState.core.players['0'].discard.some(card => card.uid === 'machete')).toBe(true);
        expect(finished.finalState.core.bases[0].minions[0].attachedActions.some(action => action.uid === 'machete')).toBe(false);
        expect(finished.finalState.sys.interaction?.current).toBeUndefined();
        expect(finished.finalState.core.triggerQueue ?? []).toHaveLength(0);
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

    it('钉子头入场时可以从牌库抽取地狱魔盒', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('pinhead-card', 'diy_killers_pinhead', 'minion', '0')],
                    deck: [makeCard('box-card', 'diy_killers_hell_puzzle_box', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'pinhead-card', baseIndex: 0 },
        });
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'diy_killers_signature_search');
        expect(prompt.options.some(option => option.value?.cardUid === 'box-card')).toBe(true);
        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'box-card',
            '钉子头检索地狱魔盒',
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'box-card')).toBe(true);
    });

    it('钉子头天赋把己方行动转移到另一个随从且不复制原附着', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('pinhead', 'diy_killers_pinhead', '0', 5),
                    makeMinion('source', 'diy_killers_jason', '0', 5, {
                        attachedActions: [{ uid: 'box1', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_b', [makeMinion('target', 'pirate_first_mate', '1', 2)]),
            ],
        });
        const state = makeMatchState(core);

        const used = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'pinhead', baseIndex: 0 },
        });
        expect(used.success, used.error).toBe(true);

        const prompt = getSimpleChoicePrompt(used.finalState, 'diy_killers_pinhead');
        const transfer = getPromptOption(
            prompt,
            option => option.value?.mode === 'transfer'
                && option.value?.cardUid === 'box1'
                && option.value?.targetMinionUid === 'target',
            '钉子头转移地狱魔盒到另一个随从',
        );
        const resolved = respondToPromptOption(used.finalState, option => option.id === transfer.id, '钉子头转移行动');
        expect(resolved.success, resolved.error).toBe(true);

        const source = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'source');
        const target = resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'target');
        expect(source?.attachedActions.some(action => action.uid === 'box1')).toBe(false);
        expect(target?.attachedActions.filter(action => action.uid === 'box1')).toHaveLength(1);
    });

    it('钉子头天赋只列出带地狱魔盒的摧毁目标', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('pinhead', 'diy_killers_pinhead', '0', 5),
                makeMinion('with-box', 'pirate_first_mate', '1', 2, {
                    attachedActions: [{ uid: 'box1', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                }),
                makeMinion('without-box', 'pirate_buccaneer', '1', 3),
            ])],
        }));

        const used = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'pinhead', baseIndex: 0 },
        });
        expect(used.success, used.error).toBe(true);

        const prompt = getSimpleChoicePrompt(used.finalState, 'diy_killers_pinhead');
        expect(prompt.options.some(option => option.value?.mode === 'destroy' && option.value?.minionUid === 'with-box')).toBe(true);
        expect(prompt.options.some(option => option.value?.mode === 'destroy' && option.value?.minionUid === 'without-box')).toBe(false);
    });

    it('钉子头摧毁其他基地带魔盒的随从时，自己身上的大砍刀记录实际摧毁', () => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('pinhead', 'diy_killers_pinhead', '0', 5, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                })]),
                makeBase('base_b', [makeMinion('with-box', 'ninja_acolyte', '1', 2, {
                    attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                })]),
            ],
        }));
        const used = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'pinhead', baseIndex: 0 } });
        expect(used.success, used.error).toBe(true);
        const resolved = respondToPromptOption(used.finalState, option => option.value?.mode === 'destroy' && option.value?.minionUid === 'with-box', '摧毁带魔盒的随从');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'with-box')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'pinhead')?.destroyedMinionThisTurn).toBe(true);
    });

    it('随从本回合先摧毁目标，之后才装备大砍刀，回合结束仍应返回手牌', () => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('machete', 'diy_killers_machete', 'action', '0')],
                    deck: [makeCard('draw-1', 'diy_killers_jason', 'minion', '0'), makeCard('draw-2', 'kitty_cats_muffin', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('pinhead', 'diy_killers_pinhead', '0', 5)]),
                makeBase('base_b', [makeMinion('with-box', 'ninja_acolyte', '1', 2, {
                    attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                })]),
            ],
        }));
        const used = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'pinhead', baseIndex: 0 } });
        expect(used.success, used.error).toBe(true);
        const destroyed = respondToPromptOption(used.finalState, option => option.value?.mode === 'destroy' && option.value?.minionUid === 'with-box', '摧毁带魔盒的随从');
        expect(destroyed.success, destroyed.error).toBe(true);
        const attached = runCommand(destroyed.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'machete', targetBaseIndex: 0, targetMinionUid: 'pinhead' } });
        expect(attached.success, attached.error).toBe(true);
        const ended = runCommand(attached.finalState, { type: 'ADVANCE_PHASE', playerId: '0' } as any);
        expect(ended.success, ended.error).toBe(true);
        expect(ended.finalState.core.players['0'].hand.some(card => card.uid === 'machete')).toBe(true);
        expect(ended.finalState.core.bases[0].minions.find(minion => minion.uid === 'pinhead')?.attachedActions.some(card => card.uid === 'machete')).toBe(false);
    });

    it('轮到下一位玩家时，即使轮数相同，上一回合的随从摧毁记录也清除', () => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-1', 'diy_killers_jason', 'minion', '0'), makeCard('draw-2', 'diy_killers_freddy_krueger', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('pinhead', 'diy_killers_pinhead', '0', 5)]),
                makeBase('base_b', [makeMinion('with-box', 'ninja_acolyte', '1', 2, {
                    attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                })]),
            ],
        }));
        const used = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'pinhead', baseIndex: 0 } });
        expect(used.success, used.error).toBe(true);
        const destroyed = respondToPromptOption(used.finalState, option => option.value?.mode === 'destroy' && option.value?.minionUid === 'with-box', '摧毁带魔盒的随从');
        expect(destroyed.success, destroyed.error).toBe(true);
        expect(destroyed.finalState.core.bases[0].minions[0].destroyedMinionThisTurn).toBe(true);
        const ended = runCommand(destroyed.finalState, { type: 'ADVANCE_PHASE', playerId: '0' } as any);
        expect(ended.success, ended.error).toBe(true);
        expect(ended.finalState.core.currentPlayerIndex).toBe(1);
        expect(ended.finalState.core.turnNumber).toBe(7);
        expect(ended.finalState.core.bases[0].minions[0].destroyedMinionThisTurn).toBeUndefined();
    });

    it('随从摧毁后离场再入场是新随从，之后装备大砍刀不应按离场前记录回手', () => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    actionLimit: 2,
                    hand: [makeCard('do-over', 'time_travelers_do_over', 'action', '0'), makeCard('machete', 'diy_killers_machete', 'action', '0')],
                    deck: [makeCard('draw-1', 'diy_killers_jason', 'minion', '0'), makeCard('draw-2', 'time_travelers_time_raider', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [makeMinion('pinhead', 'diy_killers_pinhead', '0', 5)]),
                makeBase('base_b', [makeMinion('with-box', 'ninja_acolyte', '1', 2, {
                    attachedActions: [{ uid: 'box', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                })]),
            ],
        }));
        const used = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'pinhead', baseIndex: 0 } });
        expect(used.success, used.error).toBe(true);
        const destroyed = respondToPromptOption(used.finalState, option => option.value?.mode === 'destroy' && option.value?.minionUid === 'with-box', '摧毁带魔盒的随从');
        expect(destroyed.success, destroyed.error).toBe(true);
        const returned = runCommand(destroyed.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'do-over', targetBaseIndex: 0, targetMinionUid: 'pinhead' } });
        expect(returned.success, returned.error).toBe(true);
        const replay = respondToPromptOption(returned.finalState, option => option.value?.cardUid === 'pinhead', '重打钉子头');
        expect(replay.success, replay.error).toBe(true);
        const base = respondToPromptOption(replay.finalState, option => option.value?.baseIndex === 0, '重打目的基地');
        expect(base.success, base.error).toBe(true);
        const search = respondToPromptOption(base.finalState, option => option.value?.skip, '不检索魔盒');
        expect(search.success, search.error).toBe(true);
        const attached = runCommand(search.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'machete', targetBaseIndex: 0, targetMinionUid: 'pinhead' } });
        expect(attached.success, attached.error).toBe(true);
        const ended = runCommand(attached.finalState, { type: 'ADVANCE_PHASE', playerId: '0' } as any);
        expect(ended.success, ended.error).toBe(true);
        expect(ended.finalState.core.bases[0].minions.find(minion => minion.uid === 'pinhead')?.attachedActions.some(card => card.uid === 'machete')).toBe(true);
        expect(ended.finalState.core.players['0'].hand.some(card => card.uid === 'machete')).toBe(false);
    });

    it('大砍刀宿主是猫咪威斯克时，其天赋摧毁己方随从也记录实际摧毁', () => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_a', [
                makeMinion('whiskers', 'kitty_cats_whiskers', '0', 4, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                }),
                makeMinion('victim', 'kitty_cats_mr_grumpers', '0', 2),
            ])],
        }));
        const used = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'whiskers', baseIndex: 0 } });
        expect(used.success, used.error).toBe(true);
        const resolved = respondToPromptOption(used.finalState, option => option.value?.minionUid === 'victim', '威斯克选择摧毁目标');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'whiskers')?.destroyedMinionThisTurn).toBe(true);
    });

    it.each([
        ['杏子公主', 'princesses_apricot', 5],
        ['技术魔法少女', 'magical_girls_technomagical_lass', 4],
    ] as const)('大砍刀宿主是%s时，天赋实际摧毁对手随从后记录来源', (_name, defId, power) => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_a', [
                makeMinion('host', defId, '0', power, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                }),
                makeMinion('ally', 'diy_killers_jason', '0', 5),
                makeMinion('victim', 'ninja_acolyte', '1', 2),
            ])],
        }));
        const used = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'host', baseIndex: 0 } });
        expect(used.success, used.error).toBe(true);
        const resolved = respondToPromptOption(used.finalState, option => option.value?.minionUid === 'victim', '选择摧毁目标');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.destroyedMinionThisTurn).toBe(true);
    });

    it('大砍刀宿主是大白鲨时，移动后摧毁对手随从应记录来源', () => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('shark', 'sharks_great_white', '0', 4, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                })]),
                makeBase('base_b', [makeMinion('victim', 'ninja_acolyte', '1', 2)]),
            ],
        }));
        const used = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'shark', baseIndex: 0 } });
        expect(used.success, used.error).toBe(true);
        const moved = respondToPromptOption(used.finalState, option => option.value?.baseIndex === 1, '选择目的基地');
        expect(moved.success, moved.error).toBe(true);
        const resolved = respondToPromptOption(moved.finalState, option => option.value?.minionUid === 'victim', '选择摧毁目标');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'shark')?.destroyedMinionThisTurn).toBe(true);
    });

    it('大砍刀宿主是巨齿鲨时，计分前能力摧毁随从应记录来源', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_a', [
                makeMinion('shark', 'sharks_megalodon', '0', 5, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                }),
                makeMinion('victim', 'ninja_acolyte', '1', 2),
            ])],
        });
        const triggered = fireTriggers(core, 'beforeScoring', {
            state: core, matchState: makeMatchState(core), playerId: '0', baseIndex: 0,
            random: defaultTestRandom, now: 20,
        });
        const resolved = respondToPromptOption(triggered.matchState!, option => option.value?.targetMinionUid === 'victim', '巨齿鲨摧毁目标');
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'shark')?.destroyedMinionThisTurn).toBe(true);
    });

    it('地狱魔盒取消非控制者随从能力，但不取消控制者自己的能力', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('enemy-host', 'diy_killers_jason', '1', 5, {
                    attachedActions: [{ uid: 'box-enemy', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                }),
                makeMinion('own-host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'box-own', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                }),
            ])],
        });

        expect(isCardSuppressed(core, 'enemy-host')).toBe(true);
        expect(isCardSuppressed(core, 'own-host')).toBe(false);
    });

    it('地狱魔盒存活时见证随从被消灭并让行动控制者抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('drawn1', 'pirate_first_mate', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'box1', defId: 'diy_killers_hell_puzzle_box', ownerId: '0' }],
                }),
                makeMinion('victim', 'pirate_first_mate', '1', 2),
            ])],
        });
        const result = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim',
            triggerMinionDefId: 'pirate_first_mate',
            triggerMinion: core.bases[0].minions[1],
            destroyerId: '0',
            random: defaultTestRandom,
            now: 40,
        });

        const draw = result.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(draw).toMatchObject({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: '0', count: 1, cardUids: ['drawn1'] },
        });
    });

    it('柯克船长面具只累计同基地被摧毁随从的有效力量，不响应宿主自毁或跨基地事件', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [
                    makeMinion('host', 'diy_killers_michael_myers', '0', 5, {
                        attachedActions: [{ uid: 'mask1', defId: 'diy_killers_captain_kirk_mask', ownerId: '0' }],
                    }),
                    makeMinion('same-base-victim', 'pirate_first_mate', '1', 2, { powerModifier: 1 }),
                ]),
                makeBase('base_b', [makeMinion('other-base-victim', 'pirate_buccaneer', '1', 4)]),
            ],
        });

        const sameBase = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'same-base-victim',
            triggerMinionDefId: 'pirate_first_mate',
            triggerMinion: core.bases[0].minions[1],
            destroyerId: '1',
            random: defaultTestRandom,
            now: 50,
        });
        expect(sameBase.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'host',
                amount: 3,
                sourceDefId: 'diy_killers_captain_kirk_mask',
            }),
        }));

        const crossBase = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            playerId: '1',
            baseIndex: 1,
            triggerMinionUid: 'other-base-victim',
            triggerMinionDefId: 'pirate_buccaneer',
            triggerMinion: core.bases[1].minions[0],
            destroyerId: '1',
            random: defaultTestRandom,
            now: 51,
        });
        expect(crossBase.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);

        const hostDestroyed = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'host',
            triggerMinionDefId: 'diy_killers_michael_myers',
            triggerMinion: core.bases[0].minions[0],
            destroyerId: '1',
            random: defaultTestRandom,
            now: 52,
        });
        expect(hostDestroyed.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);
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

    it.each(['minion', 'action'] as const)('未向水晶湖打出%s时不触发基地能力', (kind) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [kind === 'minion'
                        ? makeCard('played', 'ninja_acolyte', 'minion', '0')
                        : makeCard('played', 'diy_killers_origin_story', 'action', '0')],
                    deck: [makeCard('draw', 'diy_killers_jason', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_diy_killers_camp_crystal_lake', [
                    makeMinion('own', 'ninja_acolyte', '0', 2),
                    makeMinion('enemy', 'robot_microbot_guard', '1', 1),
                ]),
                makeBase('base_a', []),
            ],
        }));
        const result = kind === 'minion'
            ? runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'played', baseIndex: 1 } })
            : runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'played' } });
        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.finalState.core.triggerQueue ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceDefId: 'base_diy_killers_camp_crystal_lake' }),
        ]));
    });

    it.each(['minion', 'action'] as const)('向水晶湖打出%s后可触发基地能力', (kind) => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [kind === 'minion'
                        ? makeCard('played', 'ninja_acolyte', 'minion', '0')
                        : makeCard('played', 'dino_wildlife_preserve', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'ninja_acolyte', '0', 2),
                makeMinion('enemy', 'robot_microbot_guard', '1', 1),
            ])],
        }));
        const result = kind === 'minion'
            ? runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'played', baseIndex: 0 } })
            : runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'played', targetBaseIndex: 0 } });
        expect(result.success, result.error).toBe(true);
        const trigger = result.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chosen = respondToPromptOption(result.finalState, option => option.value?.triggerId === trigger?.id, '水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        expect(getPromptSourceId(getSimpleChoicePrompt(chosen.finalState, 'base_diy_killers_camp_crystal_lake_destroy')))
            .toBe('base_diy_killers_camp_crystal_lake_destroy');
    });

    it('普通行动以水晶湖为效果目标，不算将行动打到基地', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('wish', 'penguins_a_wish_for_wings_that_work', 'action', '0')] }), '1': makePlayer('1') },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'ninja_acolyte', '0', 2),
                makeMinion('enemy', 'robot_microbot_guard', '1', 1),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'wish', targetBaseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(played.finalState.core.triggerQueue ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceDefId: 'base_diy_killers_camp_crystal_lake' }),
        ]));
        expectNoPrompt(played.finalState);
    });

    it('水晶湖的触发、摧毁和加力选择均可由 AI 合法动作完成', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('played', 'ninja_acolyte', 'minion', '0')] }), '1': makePlayer('1') },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'ninja_acolyte', '0', 2),
                makeMinion('low', 'robot_microbot_guard', '1', 1),
                makeMinion('high', 'ninja_shinobi', '1', 3),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'played', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const trigger = played.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chooseTrigger = buildSmashUpAiLegalActions({ playerId: '0', state: played.finalState })
            .find(action => (action.metadata?.optionValue as { triggerId?: string } | undefined)?.triggerId === trigger?.id);
        expect(chooseTrigger).toBeDefined();
        const opened = runCommand(played.finalState, { ...chooseTrigger!.commands[0], playerId: '0' } as any);
        expect(opened.success, opened.error).toBe(true);
        const destroyActions = buildSmashUpAiLegalActions({ playerId: '0', state: opened.finalState });
        expect(buildSmashUpAiLegalActions({ playerId: '1', state: opened.finalState })).toEqual([]);
        expect(destroyActions.some(action => (action.metadata?.optionValue as { minionUid?: string } | undefined)?.minionUid === 'high')).toBe(false);
        const destroy = destroyActions.find(action => (action.metadata?.optionValue as { minionUid?: string } | undefined)?.minionUid === 'low');
        expect(destroy).toBeDefined();
        const destroyed = runCommand(opened.finalState, { ...destroy!.commands[0], playerId: '0' } as any);
        expect(destroyed.success, destroyed.error).toBe(true);
        const boost = buildSmashUpAiLegalActions({ playerId: '0', state: destroyed.finalState })
            .find(action => (action.metadata?.optionValue as { minionUid?: string } | undefined)?.minionUid === 'high');
        expect(boost).toBeDefined();
        const boosted = runCommand(destroyed.finalState, { ...boost!.commands[0], playerId: '0' } as any);
        expect(boosted.success, boosted.error).toBe(true);
        expect(boosted.finalState.core.bases[0].minions.find(minion => minion.uid === 'high')?.tempPowerModifier).toBe(1);
        expectNoPrompt(boosted.finalState);
    });

    it('给水晶湖的随从打出附着行动，不算将牌打到基地', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('weapon', 'diy_killers_machete', 'action', '0')] }), '1': makePlayer('1') },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'ninja_acolyte', '0', 2),
                makeMinion('enemy', 'robot_microbot_guard', '1', 1),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'weapon', targetBaseIndex: 0, targetMinionUid: 'own' } });
        expect(played.success, played.error).toBe(true);
        expectNoPrompt(played.finalState);
        expect(played.finalState.core.triggerQueue ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceDefId: 'base_diy_killers_camp_crystal_lake' }),
        ]));
    });

    it('水晶湖计算基地上的己方牌时，不把附着随从的行动算到基地', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('preserve', 'dino_wildlife_preserve', 'action', '0')] }), '1': makePlayer('1') },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                }),
                makeMinion('low', 'ninja_acolyte', '1', 2),
                makeMinion('high', 'ninja_shinobi', '1', 3),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'preserve', targetBaseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const trigger = played.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chosen = respondToPromptOption(played.finalState, option => option.value?.triggerId === trigger?.id, '水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        const prompt = getSimpleChoicePrompt(chosen.finalState, 'base_diy_killers_camp_crystal_lake_destroy');
        expect(prompt.options.some(option => option.value?.minionUid === 'low')).toBe(true);
        expect(prompt.options.some(option => option.value?.minionUid === 'high')).toBe(false);
    });

    it.each(['titan', 'buried'] as const)('水晶湖计算基地上的己方牌时计入%s', (kind) => {
        const base = makeBase({
            defId: 'base_diy_killers_camp_crystal_lake',
            minions: [makeMinion('own', 'diy_killers_michael_myers', '0', 5), makeMinion('enemy', 'ninja_shinobi', '1', 3)],
            ...(kind === 'buried' ? { buriedCards: [{ uid: 'buried', defId: 'ancient_egyptians_mummy', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' as const }] } : {}),
        });
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('jason', 'diy_killers_jason', 'minion', '0')] }), '1': makePlayer('1') },
            bases: [base],
            titans: kind === 'titan' ? [{
                uid: 'titan', defId: 'tricksters_big_funny_giant', faction: 'tricksters', ownerId: '0', controllerId: '0',
                powerCounters: 0, talentUsed: false, location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }] : [],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'jason', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const trigger = played.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chosen = respondToPromptOption(played.finalState, option => option.value?.triggerId === trigger?.id, '水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        const prompt = getSimpleChoicePrompt(chosen.finalState, 'base_diy_killers_camp_crystal_lake_destroy');
        expect(prompt.options.some(option => option.value?.minionUid === 'enemy')).toBe(true);
    });

    it('将手牌埋到水晶湖是放置，不触发基地的打牌能力', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [
                makeCard('knowledge', 'ancient_egyptians_lost_knowledge', 'action', '0'),
                makeCard('buried', 'ninja_acolyte', 'minion', '0'),
            ] }), '1': makePlayer('1') },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('enemy', 'robot_microbot_guard', '1', 1),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'knowledge' } });
        expect(played.success, played.error).toBe(true);
        const card = respondToPromptOption(played.finalState, option => option.value?.cardUid === 'buried', '选择埋藏牌');
        expect(card.success, card.error).toBe(true);
        const base = respondToPromptOption(card.finalState, option => option.value?.baseIndex === 0, '选择水晶湖');
        expect(base.success, base.error).toBe(true);
        expect(base.finalState.core.bases[0].buriedCards?.some(entry => entry.uid === 'buried')).toBe(true);
        expect(base.finalState.core.triggerQueue ?? []).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ sourceDefId: 'base_diy_killers_camp_crystal_lake' }),
        ]));
        expectNoPrompt(base.finalState);
    });

    it('翻开埋在水晶湖的随从并打出后，触发基地能力', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('seal', 'ancient_egyptians_seal_the_tomb', 'action', '0')] }), '1': makePlayer('1') },
            bases: [makeBase({
                defId: 'base_diy_killers_camp_crystal_lake',
                minions: [makeMinion('enemy', 'robot_microbot_guard', '1', 1)],
                buriedCards: [{ uid: 'buried', defId: 'ninja_acolyte', trueOwnerId: '0', controllerId: '0', buriedFrom: 'hand' }],
            })],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'seal', targetBaseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const mode = respondToPromptOption(played.finalState, option => option.value?.mode === 'uncover', '选择翻开');
        expect(mode.success, mode.error).toBe(true);
        const prompt = getSimpleChoicePrompt(mode.finalState, 'ancient_egyptians_seal_the_tomb_uncover');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'buried', '翻开埋藏随从');
        const uncovered = respondToPromptOptions(mode.finalState, [option.id], '0', defaultTestRandom);
        expect(uncovered.success, uncovered.error).toBe(true);
        expect(uncovered.finalState.core.bases[0].minions.some(minion => minion.uid === 'buried')).toBe(true);
        expect(uncovered.finalState.core.triggerQueue?.filter(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake')).toHaveLength(1);
    });

    it('打出泰坦到水晶湖后，可按基地上的牌触发摧毁能力', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { factions: ['diy_killers', 'tricksters_pod'] }), '1': makePlayer('1') },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [makeMinion('enemy', 'robot_microbot_guard', '1', 1)])],
            titans: [{
                uid: 'titan', defId: 'tricksters_big_funny_giant_pod', faction: 'tricksters_pod', ownerId: '0', controllerId: '0',
                powerCounters: 0, talentUsed: false, location: { zone: 'setaside' },
            }],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.ACTIVATE_SPECIAL, playerId: '0', payload: { titanUid: 'titan', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(played.finalState.core.triggerQueue?.filter(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake')).toHaveLength(1);
        const trigger = played.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chosen = respondToPromptOption(played.finalState, option => option.value?.triggerId === trigger?.id, '水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        expect(getSimpleChoicePrompt(chosen.finalState, 'base_diy_killers_camp_crystal_lake_destroy').options.some(option => option.value?.minionUid === 'enemy')).toBe(true);
    });

    it('水晶湖摧毁能力使用后，同一回合再打牌不能再次使用', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('minion', 'ninja_acolyte', 'minion', '0'),
                    makeCard('weapon', 'dino_wildlife_preserve', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'ninja_acolyte', '0', 2),
                makeMinion('enemy', 'robot_microbot_guard', '1', 1),
                makeMinion('enemy-2', 'robot_microbot_guard', '1', 1),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const trigger = played.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chosen = respondToPromptOption(played.finalState, option => option.value?.triggerId === trigger?.id, '水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        const destroyed = respondToPromptOption(chosen.finalState, option => option.value?.minionUid === 'enemy', '摧毁目标');
        expect(destroyed.success, destroyed.error).toBe(true);
        const powered = respondToPromptOption(destroyed.finalState, option => option.value?.minionUid === 'own', '力量目标');
        expect(powered.success, powered.error).toBe(true);
        const second = runCommand(powered.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'weapon', targetBaseIndex: 0 } });
        expect(second.success, second.error).toBe(true);
        expectNoPrompt(second.finalState);
        expect(second.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-2')).toBe(true);
    });

    it('水晶湖摧毁被雄蜂防止后不产生加力，且本回合使用次数已消耗', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('played', 'ninja_acolyte', 'minion', '0'), makeCard('preserve', 'dino_wildlife_preserve', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_diy_killers_camp_crystal_lake', [makeMinion('enemy', 'robot_microbot_guard', '1', 1)]),
                makeBase('base_a', [makeMinion('drone', 'giant_ant_drone', '1', 3, { powerCounters: 1 })]),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'played', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const trigger = played.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chosen = respondToPromptOption(played.finalState, option => option.value?.triggerId === trigger?.id, '水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        const attempted = respondToPromptOption(chosen.finalState, option => option.value?.minionUid === 'enemy', '选择摧毁');
        expect(attempted.success, attempted.error).toBe(true);
        const saved = respondToPromptOption(attempted.finalState, option => option.value?.droneUid === 'drone', '雄蜂防止摧毁', '1');
        expect(saved.success, saved.error).toBe(true);
        expect(saved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy')).toBe(true);
        expect(saved.finalState.core.usedBaseAbilitiesThisTurn).toContainEqual({ playerId: '0', baseIndex: 0, baseDefId: 'base_diy_killers_camp_crystal_lake' });
        expectNoPrompt(saved.finalState);
        const second = runCommand(saved.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'preserve', targetBaseIndex: 0 } });
        expect(second.success, second.error).toBe(true);
        expectNoPrompt(second.finalState);
    });

    it('换到下一名玩家的回合后，水晶湖可再次使用，即使轮数未变化', () => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('first', 'ninja_acolyte', 'minion', '0')],
                    deck: [makeCard('draw-1', 'ninja_acolyte', 'minion', '0'), makeCard('draw-2', 'ninja_acolyte', 'minion', '0')],
                }),
                '1': makePlayer('1', { hand: [makeCard('second', 'robot_microbot_guard', 'minion', '1')] }),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'robot_microbot_guard', '0', 1),
                makeMinion('enemy', 'robot_microbot_guard', '1', 1),
            ])],
        }));
        const first = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'first', baseIndex: 0 } });
        expect(first.success, first.error).toBe(true);
        const firstTrigger = first.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(firstTrigger).toBeDefined();
        const chosen = respondToPromptOption(first.finalState, option => option.value?.triggerId === firstTrigger?.id, '第一次水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        const destroyed = respondToPromptOption(chosen.finalState, option => option.value?.minionUid === 'enemy', '摧毁目标');
        expect(destroyed.success, destroyed.error).toBe(true);
        const boosted = respondToPromptOption(destroyed.finalState, option => option.value?.minionUid === 'first', '选择加力');
        expect(boosted.success, boosted.error).toBe(true);
        const ended = runCommand(boosted.finalState, { type: 'ADVANCE_PHASE', playerId: '0' } as any);
        expect(ended.success, ended.error).toBe(true);
        expect(ended.finalState.core.currentPlayerIndex).toBe(1);
        expect(ended.finalState.core.turnNumber).toBe(7);
        const second = runCommand(ended.finalState, { type: SU_COMMANDS.PLAY_MINION, playerId: '1', payload: { cardUid: 'second', baseIndex: 0 } });
        expect(second.success, second.error).toBe(true);
        expect(second.finalState.core.triggerQueue?.filter(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake')).toHaveLength(1);
    });

    it('水晶湖选择不摧毁后，同一回合再打到这里仍可使用', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [
                    makeCard('minion', 'ninja_acolyte', 'minion', '0'),
                    makeCard('weapon', 'dino_wildlife_preserve', 'action', '0'),
                ] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'ninja_acolyte', '0', 2),
                makeMinion('enemy', 'robot_microbot_guard', '1', 1),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion', baseIndex: 0 } });
        expect(played.success, played.error).toBe(true);
        const trigger = played.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(trigger).toBeDefined();
        const chosen = respondToPromptOption(played.finalState, option => option.value?.triggerId === trigger?.id, '水晶湖触发');
        expect(chosen.success, chosen.error).toBe(true);
        const skipped = respondToPromptOption(chosen.finalState, option => option.value?.skip, '不摧毁');
        expect(skipped.success, skipped.error).toBe(true);
        const second = runCommand(skipped.finalState, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'weapon', targetBaseIndex: 0 } });
        expect(second.success, second.error).toBe(true);
        const secondTrigger = second.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'base_diy_killers_camp_crystal_lake');
        expect(secondTrigger).toBeDefined();
        const selected = respondToPromptOption(second.finalState, option => option.value?.triggerId === secondTrigger?.id, '再次选择水晶湖触发');
        expect(selected.success, selected.error).toBe(true);
        expect(getSimpleChoicePrompt(selected.finalState, 'base_diy_killers_camp_crystal_lake_destroy')).toBeDefined();
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
            playerId: '0',
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

    it('水晶湖营地消灭后可选择同基地其他玩家的随从获得力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own-target', 'diy_killers_jason', '0', 5),
                makeMinion('enemy-target', 'test_enemy', '1', 4),
            ])],
        });
        const result = triggerExtendedBaseAbility('base_diy_killers_camp_crystal_lake', 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            baseIndex: 0,
            baseDefId: 'base_diy_killers_camp_crystal_lake',
            playerId: '0',
            destroyerId: '0',
            minionPower: 2,
            now: 12,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_diy_killers_camp_crystal_lake_power');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'own-target')).toBe(true);
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'enemy-target')).toBe(true);
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'enemy-target',
            '水晶湖营地其他玩家随从',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-target')?.tempPowerModifier).toBe(2);
    });

    it('实际摧毁后水晶湖营地可给同基地对手随从加力量', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('attack', 'diy_killers_savage_attack', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('own', 'diy_killers_jason', '0', 5),
                makeMinion('victim', 'ninja_acolyte', '1', 2),
                makeMinion('enemy-target', 'test_enemy', '1', 4),
            ])],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'attack' } });
        expect(played.success, played.error).toBe(true);
        const destroyed = respondToPromptOption(played.finalState, option => option.value?.minionUid === 'victim', '摧毁目标');
        expect(destroyed.success, destroyed.error).toBe(true);
        const powered = respondToPromptOption(destroyed.finalState, option => option.value?.minionUid === 'enemy-target', '对手随从获得力量');
        expect(powered.success, powered.error).toBe(true);
        expect(powered.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-target')?.tempPowerModifier).toBe(2);
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

    it('人皮脸响应提交后摧毁同基地弱仆从，并写入本回合已发动', () => {
        const core = makeState({
            turnNumber: 12,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_diy_killers_camp_crystal_lake', [
                makeMinion('leatherface', 'diy_killers_leatherface', '0', 5),
                makeMinion('weak', 'ghosts_spectre', '1', 2),
            ])],
        });

        const queued = collectTriggers(core, 'onMinionAffected', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'leatherface',
            triggerMinionDefId: 'diy_killers_leatherface',
            triggerMinion: core.bases[0].minions[0],
            counterChangeKind: 'added',
            counterDelta: 1,
            random: defaultTestRandom,
            now: 21,
        }, { sourceDefIds: ['diy_killers_leatherface'] });
        expect(queued).toBeDefined();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            defaultTestRandom,
            21,
        );
        const opened = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            '人皮脸可选触发',
            '0',
            defaultTestRandom,
        );
        const resolved = respondToPromptOption(
            opened.finalState,
            option => option.value?.minionUid === 'weak',
            '人皮脸摧毁弱仆从',
            '0',
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'weak')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'leatherface')?.metadata?.diyKillersLeatherfaceUsedTurn).toBe(12);
    });

    it('电锯响应提交后把宿主移动到玩家选择的基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_diy_killers_camp_crystal_lake', [
                    makeMinion('host', 'robot_microbot_alpha', '0', 2, {
                        attachedActions: [{ uid: 'chainsaw', defId: 'diy_killers_chainsaw', ownerId: '0' } as any],
                    }),
                    makeMinion('victim', 'ghosts_spectre', '1', 2),
                ]),
                makeBase('base_the_deep', []),
            ],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'victim',
            triggerMinionDefId: 'ghosts_spectre',
            triggerMinion: core.bases[0].minions[1],
            random: defaultTestRandom,
            now: 22,
        }, { sourceDefIds: ['diy_killers_chainsaw'] });
        expect(queued).toBeDefined();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            defaultTestRandom,
            22,
        );
        const opened = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            '电锯可选触发',
            '0',
            defaultTestRandom,
        );
        const movePrompt = getSimpleChoicePrompt(opened.finalState, 'diy_killers_chainsaw_move');
        const moveOption = getPromptOption(
            movePrompt,
            option => option.value?.baseIndex === 1,
            '电锯目标基地',
        );
        const moved = respondToPrompt(
            opened.finalState,
            moveOption.id,
            '0',
            defaultTestRandom,
        );

        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'host')).toBe(false);
        const movedHost = moved.finalState.core.bases[1].minions.find(minion => minion.uid === 'host');
        expect(movedHost?.attachedActions.some(action => action.uid === 'chainsaw')).toBe(true);
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
            getPromptOption(prompt, option => option.value?.baseIndex === 1, 'machete destination base').id,
            '0',
            defaultTestRandom,
        );
        expect(moved.finalState.core.bases[0].minions.some(minion => minion.uid === 'killer1')).toBe(false);
        expect(moved.finalState.core.bases[1].minions.some(minion => minion.uid === 'killer1')).toBe(true);
    });

    it('杰森宿主摧毁仆从后记录大砍刀回收所需的本回合标记', () => {
        const core = makeState({
            turnNumber: 7,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'machete1', defId: 'diy_killers_machete', ownerId: '0' }],
                }),
                makeMinion('victim', 'test_enemy', '1', 2),
            ])],
        });

        const queued = collectTriggers(core, 'onMinionMoved', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            moveToBaseIndex: 0,
            triggerMinionUid: 'host',
            triggerMinionDefId: 'diy_killers_jason',
            triggerMinion: core.bases[0].minions[0],
            random: defaultTestRandom,
            now: 30,
        }, { sourceDefIds: ['diy_killers_jason'] });
        expect(queued).toBeDefined();

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            defaultTestRandom,
            30,
        );
        const opened = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            '杰森触发',
            '0',
            defaultTestRandom,
        );
        const resolved = respondToPromptOption(
            opened.finalState,
            option => option.value?.minionUid === 'victim',
            '杰森摧毁目标',
            '0',
            defaultTestRandom,
        );

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'victim')).toBeUndefined();
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.destroyedMinionThisTurn).toBe(true);
    });

    it.each([
        ['救下', true],
        ['放行', false],
    ])('杰森的目标被雄蜂%s后，大砍刀按实际消灭结果记录', (_label, prevent) => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                })]),
                makeBase('base_b', [makeMinion('victim', 'ninja_acolyte', '1', 2)]),
                makeBase('base_c', [makeMinion('drone', 'giant_ant_drone', '1', 3, { powerCounters: 1 })]),
            ],
        }));
        const talent = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'machete', baseIndex: 0 } });
        expect(talent.success, talent.error).toBe(true);
        const moved = respondToPromptOption(talent.finalState, option => option.value?.baseIndex === 1, '杰森移动目的地');
        expect(moved.success, moved.error).toBe(true);
        const trigger = moved.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'diy_killers_jason');
        expect(trigger).toBeDefined();
        const opened = respondToPromptOption(moved.finalState, option => option.value?.triggerId === trigger?.id, '杰森触发');
        expect(opened.success, opened.error).toBe(true);
        const attempted = respondToPromptOption(opened.finalState, option => option.value?.minionUid === 'victim', '杰森选择目标');
        expect(attempted.success, attempted.error).toBe(true);
        const saved = respondToPromptOption(attempted.finalState, option => prevent ? option.value?.droneUid === 'drone' : option.value?.skip, '雄蜂选择是否防止消灭', '1');
        expect(saved.success, saved.error).toBe(true);
        if (!prevent) expect(saved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({ minionUid: 'victim', sourcePlayerId: '0', sourceCardUid: 'host', sourceDefId: 'diy_killers_jason', sourceControllerId: '0', sourceKind: 'nonAction' }),
        }));
        expect(saved.finalState.core.bases[1].minions.some(minion => minion.uid === 'victim')).toBe(prevent);
        expect(saved.finalState.core.bases[1].minions.find(minion => minion.uid === 'host')?.destroyedMinionThisTurn)
            .toBe(prevent ? undefined : true);
    });

    it.each([
        ['转移救下', true],
        ['放行', false],
    ])('九命之屋%s杰森的目标后，大砍刀按实际消灭结果记录', (_label, prevent) => {
        const state = makeMatchState(makeState({
            turnNumber: 7,
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                })]),
                makeBase('base_b', [makeMinion('victim', 'ninja_acolyte', '1', 2)]),
                makeBase('base_house_of_nine_lives', []),
            ],
        }));
        const talent = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'machete', baseIndex: 0 } });
        expect(talent.success, talent.error).toBe(true);
        const moved = respondToPromptOption(talent.finalState, option => option.value?.baseIndex === 1, '杰森移动目的地');
        expect(moved.success, moved.error).toBe(true);
        const trigger = moved.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'diy_killers_jason');
        expect(trigger).toBeDefined();
        const opened = respondToPromptOption(moved.finalState, option => option.value?.triggerId === trigger?.id, '杰森触发');
        expect(opened.success, opened.error).toBe(true);
        const attempted = respondToPromptOption(opened.finalState, option => option.value?.minionUid === 'victim', '杰森选择目标');
        expect(attempted.success, attempted.error).toBe(true);
        const chosen = respondToPromptOption(attempted.finalState, option => option.value?.move === prevent, '九命之屋选择', '1');
        expect(chosen.success, chosen.error).toBe(true);
        if (!prevent) expect(chosen.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({ minionUid: 'victim', sourcePlayerId: '0', sourceCardUid: 'host', sourceDefId: 'diy_killers_jason', sourceControllerId: '0', sourceKind: 'nonAction' }),
        }));
        expect(chosen.finalState.core.bases[2].minions.some(minion => minion.uid === 'victim')).toBe(prevent);
        expect(chosen.finalState.core.bases[1].minions.find(minion => minion.uid === 'host')?.destroyedMinionThisTurn)
            .toBe(prevent ? undefined : true);
    });

    it('雄蜂与九命之屋均可防止同一次摧毁时，各自放行后不重复询问', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                })]),
                makeBase('base_b', [makeMinion('victim', 'ninja_acolyte', '1', 2)]),
                makeBase('base_c', [makeMinion('drone', 'giant_ant_drone', '1', 3, { powerCounters: 1 })]),
                makeBase('base_house_of_nine_lives', []),
            ],
        }));
        const talent = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'machete', baseIndex: 0 } });
        expect(talent.success, talent.error).toBe(true);
        const moved = respondToPromptOption(talent.finalState, option => option.value?.baseIndex === 1, '杰森移动');
        const trigger = moved.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'diy_killers_jason');
        expect(trigger).toBeDefined();
        const opened = respondToPromptOption(moved.finalState, option => option.value?.triggerId === trigger?.id, '杰森触发');
        const attempted = respondToPromptOption(opened.finalState, option => option.value?.minionUid === 'victim', '选择目标');
        expect(attempted.success, attempted.error).toBe(true);
        let current = attempted.finalState;
        const seen: string[] = [];
        while (getFirstPrompt(current) && seen.length < 3) {
            const source = getPromptSourceId(getFirstPrompt(current));
            expect(source).toBeDefined();
            if (!source) throw new Error('防止选择缺少 sourceId');
            seen.push(source);
            const response = respondToPromptOption(current, option => source === 'giant_ant_drone_prevent_destroy' ? option.value?.skip : option.value?.move === false, '不防止摧毁', '1');
            expect(response.success, response.error).toBe(true);
            current = response.finalState;
        }
        expect([...seen].sort()).toEqual(['base_nine_lives_intercept', 'giant_ant_drone_prevent_destroy']);
        expect(current.core.bases[1].minions.some(minion => minion.uid === 'victim')).toBe(false);
        expectNoPrompt(current);
    });

    it('九命之屋救下目标后，雄蜂不应继续询问同一次摧毁', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('host', 'diy_killers_jason', '0', 5, {
                    attachedActions: [{ uid: 'machete', defId: 'diy_killers_machete', ownerId: '0' }],
                })]),
                makeBase('base_b', [makeMinion('victim', 'ninja_acolyte', '1', 2)]),
                makeBase('base_c', [makeMinion('drone', 'giant_ant_drone', '1', 3, { powerCounters: 1 })]),
                makeBase('base_house_of_nine_lives', []),
            ],
        }));
        const talent = runCommand(state, { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { ongoingCardUid: 'machete', baseIndex: 0 } });
        expect(talent.success, talent.error).toBe(true);
        const moved = respondToPromptOption(talent.finalState, option => option.value?.baseIndex === 1, '杰森移动');
        const trigger = moved.finalState.core.triggerQueue?.find(entry => entry.sourceDefId === 'diy_killers_jason');
        const opened = respondToPromptOption(moved.finalState, option => option.value?.triggerId === trigger?.id, '杰森触发');
        const attempted = respondToPromptOption(opened.finalState, option => option.value?.minionUid === 'victim', '选择目标');
        expect(attempted.success, attempted.error).toBe(true);
        expect(getPromptSourceId(getFirstPrompt(attempted.finalState))).toBe('base_nine_lives_intercept');
        const rescued = respondToPromptOption(attempted.finalState, option => option.value?.move === true, '九命之屋救援', '1');
        expect(rescued.success, rescued.error).toBe(true);
        expect(rescued.finalState.core.bases[3].minions.some(minion => minion.uid === 'victim')).toBe(true);
        expectNoPrompt(rescued.finalState);
    });

    it('九命之屋放行行动造成的摧毁时保留原行动来源', () => {
        const state = makeMatchState(makeState({
            players: { '0': makePlayer('0', { hand: [makeCard('broadside', 'pirate_broadside', 'action', '0')] }), '1': makePlayer('1') },
            bases: [
                makeBase('base_a', [makeMinion('ally', 'pirate_buccaneer', '0', 4), makeMinion('victim', 'ninja_acolyte', '1', 2)]),
                makeBase('base_house_of_nine_lives', []),
            ],
        }));
        const played = runCommand(state, { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside' } });
        expect(played.success, played.error).toBe(true);
        const base = respondToPromptOption(played.finalState, option => option.value?.baseIndex === 0, '选择基地');
        expect(base.success, base.error).toBe(true);
        const target = respondToPromptOption(base.finalState, option => option.value?.targetPlayerId === '1', '选择对手');
        expect(target.success, target.error).toBe(true);
        const released = respondToPromptOption(target.finalState, option => option.value?.move === false, '放行摧毁', '1');
        expect(released.success, released.error).toBe(true);
        expect(released.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_DESTROYED,
            payload: expect.objectContaining({ minionUid: 'victim', sourcePlayerId: '0', sourceDefId: 'pirate_broadside', sourceControllerId: '0', sourceKind: 'action' }),
        }));
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

    it('弗莱迪天赋先给敌方仆从 -1，并按减益后力量筛选摧毁目标', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('freddy', 'diy_killers_freddy_krueger', '0', 5, {
                    attachedActions: [{ uid: 'glove1', defId: 'diy_killers_clawed_glove', ownerId: '0' }],
                }),
                makeMinion('weak', 'ghost_ghost', '1', 2),
                makeMinion('strong', 'ghost_spirit', '1', 3),
            ])],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'freddy', baseIndex: 0 },
        });
        expect(result.success, result.error).toBe(true);

        const prompt = getSimpleChoicePrompt(result.finalState, 'diy_killers_freddy_krueger_destroy');
        expect(prompt.options.some(option => option.value?.minionUid === 'weak')).toBe(true);
        expect(prompt.options.some(option => option.value?.minionUid === 'strong')).toBe(false);
        expect(prompt.options.some(option => option.value?.skip === true)).toBe(true);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'weak')?.powerModifier).toBe(-1);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'strong')?.powerModifier).toBe(-1);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'freddy')?.talentUsed).toBe(true);

        const destroyed = respondToPromptOption(
            result.finalState,
            option => option.value?.minionUid === 'weak',
            '弗莱迪摧毁减益后力量一目标',
            '0',
            defaultTestRandom,
        );
        expect(destroyed.success, destroyed.error).toBe(true);
        expect(destroyed.finalState.core.bases[0].minions.some(minion => minion.uid === 'weak')).toBe(false);
        expect(destroyed.finalState.core.bases[0].minions.find(minion => minion.uid === 'strong')?.powerModifier).toBe(-1);
        expect(destroyed.finalState.core.bases[0].minions.find(minion => minion.uid === 'freddy')?.powerCounters).toBe(1);

        const nextTurn = applyEvents(destroyed.finalState.core, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: 100,
        } as any]);
        expect(nextTurn.bases[0].minions.find(minion => minion.uid === 'strong')?.powerModifier).toBe(0);
        expect(nextTurn.bases[0].minions.find(minion => minion.uid === 'freddy')?.talentUsed).toBe(false);
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
