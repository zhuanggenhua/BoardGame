import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
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

        const playedAttachment = runCommand(weapon.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'machete1', targetBaseIndex: 0, targetMinionUid: 'host' },
        });
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

        const turnEnd = fireTriggers(weapon.finalState.core, 'onTurnEnd', {
            state: weapon.finalState.core,
            matchState: weapon.finalState,
            playerId: '0',
            now: 40,
        });
        expect(turnEnd.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(false);
        expect(weapon.finalState.core.players['0'].hand.some(card => card.uid === 'machete1')).toBe(true);
        expect(weapon.finalState.core.players['0'].discard.some(card => card.uid === 'machete1')).toBe(false);
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

    it('水晶湖营地消灭后只能给消灭者自己的随从加力量', () => {
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
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'enemy-target')).toBe(false);
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
            option => option.value?.toBaseIndex === 1,
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
            getPromptOption(prompt, option => option.value?.toBaseIndex === 1, 'machete destination base').id,
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
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.metadata?.diyKillersMacheteHostDestroyedTurn).toBe(7);
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
