import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearRegistry, resolveSpecial } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearOngoingEffectRegistry, fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { reduce } from '../../domain/reduce';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOptions,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Mythic Horses abilities', () => {
    it('mythic_horses_seastar 有其他己方随从基地时授予自己本回合一次额外天赋', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('seastar-1', 'mythic_horses_seastar', '0', 3)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('friend-1', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const first = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'seastar-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(first.success, first.error).toBe(true);
        expect(first.finalState.core.bases[0].minions[0]?.metadata?.mythicHorsesSeastarExtraTalent).toBe(true);

        const second = runCommand(
            first.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'seastar-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(second.success, second.error).toBe(true);
        expect(second.finalState.core.bases[0].minions[0]?.metadata?.mythicHorsesSeastarExtraTalentConsumed).toBe(true);

        const third = runCommand(
            second.finalState,
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'seastar-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(third.success).toBe(false);
    });

    it('mythic_horses_rainbow 有同基地己方其他随从时天赋抽 1 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('rainbow-1', 'mythic_horses_rainbow', '0', 4),
                    makeMinion('friend-1', 'robot_microbot_beta', '0', 2),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1),
                ],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'rainbow-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        expect(used.success, used.error).toBe(true);
        expectNoPrompt(used.finalState);
        expect(used.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
    });

    it('mythic_horses_super_future_space_armor_power 给目标 +2 并只让其免疫其他玩家卡牌效果', () => {
        const core = makeState({
            turnNumber: 4,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('armor-1', 'mythic_horses_super_future_space_armor_power', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('target-1', 'robot_microbot_alpha', '0', 3)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'armor-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'mythic_horses_super_future_space_armor_power');
        const target = getPromptOption(prompt, option => option.value?.minionUid === 'target-1', 'armor target');
        const resolved = respondToPrompt(played.finalState, target.id, '0', defaultTestRandom);

        const protectedMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'target-1');
        expect(protectedMinion).toBeDefined();
        expect(getEffectivePower(resolved.finalState.core, protectedMinion!, 0)).toBe(5);
        expect(isMinionProtected(resolved.finalState.core, protectedMinion!, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(resolved.finalState.core, protectedMinion!, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(resolved.finalState.core, protectedMinion!, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(resolved.finalState.core, protectedMinion!, 0, '1', 'action')).toBe(true);
        expect(isMinionProtected(resolved.finalState.core, protectedMinion!, 0, '0', 'destroy')).toBe(false);

        const nextTurn = reduce(resolved.finalState.core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '1', turnNumber: 5 },
            timestamp: 2000,
        } as any);
        const expired = nextTurn.bases[0].minions.find(minion => minion.uid === 'target-1');
        expect(getEffectivePower(nextTurn, expired!, 0)).toBe(3);
        expect(isMinionProtected(nextTurn, expired!, 0, '1', 'destroy')).toBe(false);
    });

    it('mythic_horses_teaching_power 计分前按己方随从数展示牌库顶并可打出展示随从', () => {
        const special = resolveSpecial('mythic_horses_teaching_power');
        expect(special).toBeDefined();
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-action', 'wizard_summon', 'action', '0'),
                        makeCard('top-minion', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('top-action-2', 'wizard_summon', 'action', '0'),
                        makeCard('hidden-minion', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('friend-1', 'mythic_horses_pinkie', '0', 2),
                    makeMinion('friend-2', 'robot_microbot_beta', '0', 2),
                    makeMinion('friend-3', 'mythic_horses_pinkie', '0', 2),
                    makeMinion('enemy-1', 'pirate_first_mate', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const result = special!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'teaching-1',
            defId: 'mythic_horses_teaching_power',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        expect(result.events.some(event =>
            event.type === SU_EVENTS.REVEAL_DECK_TOP
            && (event as any).payload.cards.map((card: any) => card.uid).join(',') === 'top-action,top-minion,top-action-2',
        )).toBe(true);
        const prompt = getSimpleChoicePrompt(result.matchState!, 'mythic_horses_teaching_power');
        const topMinion = getPromptOption(prompt, option => option.value?.cardUid === 'top-minion', 'revealed minion');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.cardUid === 'hidden-minion')).toBe(false);
        const choseMinion = respondToPrompt(result.matchState!, topMinion.id, '0', defaultTestRandom);
        const orderPrompt = getSimpleChoicePrompt(choseMinion.finalState, 'mythic_horses_teaching_power_order');
        const topAction2 = getPromptOption(orderPrompt, option => option.value?.cardUid === 'top-action-2', 'second action');
        const topAction = getPromptOption(orderPrompt, option => option.value?.cardUid === 'top-action', 'first action');
        const resolved = respondToPromptOptions(choseMinion.finalState, [topAction2.id, topAction.id], '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('top-minion');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-action-2', 'top-action', 'hidden-minion']);
    });

    it('mythic_horses_teaching_power 可在 Me First 计分前窗口从手牌打出并展示牌库顶', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('teaching-1', 'mythic_horses_teaching_power', 'action', '0')],
                    deck: [
                        makeCard('top-minion', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('top-action', 'wizard_summon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('friend-1', 'mythic_horses_pinkie', '0', 2),
                    makeMinion('enemy-1', 'pirate_first_mate', '1', 3),
                ],
                ongoingActions: [],
            }],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'scoreBases';
        matchState.sys.responseWindow = {
            current: {
                id: 'me-first-test',
                windowType: 'meFirst',
                sourceId: 'test',
                responderQueue: ['0', '1'],
                currentResponderIndex: 0,
                passedPlayers: [],
                sourceBaseIndex: 0,
            },
        } as any;

        const played = runCommand(
            matchState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'teaching-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        expect(played.success, played.error).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.REVEAL_DECK_TOP
            && (event as any).payload.cards.map((card: any) => card.uid).join(',') === 'top-minion',
        )).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'mythic_horses_teaching_power');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.cardUid === 'top-minion')).toBe(true);
        expect(played.finalState.core.specialLimitUsed?.mythic_horses_teaching_power).toContain(0);
    });

    it('mythic_horses_freedom_power 将基地或随从上的行动回到所有者手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('freedom-1', 'mythic_horses_freedom_power', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('host-1', 'robot_microbot_alpha', '0', 2, {
                        attachedActions: [{ uid: 'attached-1', defId: 'mythic_horses_encouragement_power', ownerId: '0' }],
                    }),
                ],
                ongoingActions: [{ uid: 'base-action-1', defId: 'mythic_horses_sharing_power', ownerId: '1' }],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'freedom-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'mythic_horses_freedom_power');
        const target = getPromptOption(prompt, option => option.value?.cardUid === 'base-action-1', 'base action');
        const resolved = respondToPrompt(played.finalState, target.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].ongoingActions.map(action => action.uid)).not.toContain('base-action-1');
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('base-action-1');
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('base-action-1');
    });

    it('mythic_horses_togetherness_power 只允许选择已有己方随从的基地并授予该基地限定额外随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('together-1', 'mythic_horses_togetherness_power', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('friend-1', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-1', 'robot_microbot_beta', '1', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'together-1' } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'mythic_horses_togetherness_power');
        expect(getPromptOptions(prompt).some((option: any) => option.value?.baseIndex === 1)).toBe(false);
        const base = getPromptOption(prompt, option => option.value?.baseIndex === 0, 'friendly base');
        const resolved = respondToPrompt(played.finalState, base.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
    });

    it('mythic_horses_adventure_power 会多选己方随从并移动到目标基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('adventure-1', 'mythic_horses_adventure_power', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('friend-1', 'robot_microbot_alpha', '0', 2),
                        makeMinion('enemy-1', 'robot_microbot_beta', '1', 2),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('friend-2', 'wizard_apprentice', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'adventure-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const minionPrompt = getSimpleChoicePrompt(played.finalState, 'mythic_horses_adventure_power_minions');
        const friend1 = getPromptOption(minionPrompt, option => option.value?.minionUid === 'friend-1', 'friend 1');
        const friend2 = getPromptOption(minionPrompt, option => option.value?.minionUid === 'friend-2', 'friend 2');
        expect(getPromptOptions(minionPrompt).some((option: any) => option.value?.minionUid === 'enemy-1')).toBe(false);

        const choseMinions = respondToPromptOptions(played.finalState, [friend1.id, friend2.id], '0', defaultTestRandom);
        const basePrompt = getSimpleChoicePrompt(choseMinions.finalState, 'mythic_horses_adventure_power_base');
        const targetBase = getPromptOption(basePrompt, option => option.value?.baseIndex === 1, 'target base');
        const resolved = respondToPrompt(choseMinions.finalState, targetBase.id, '0', defaultTestRandom);

        expectNoPrompt(resolved.finalState);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy-1']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(expect.arrayContaining(['friend-1', 'friend-2']));
    });

    it('mythic_horses_friendship_power 移动己方随从到另一个己方基地，并可把本行动放回牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('friendship-1', 'mythic_horses_friendship_power', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('mover-1', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('friend-1', 'robot_microbot_beta', '0', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_c',
                    minions: [makeMinion('enemy-1', 'pirate_first_mate', '1', 3)],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'friendship-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const minionPrompt = getSimpleChoicePrompt(played.finalState, 'mythic_horses_friendship_power_minion');
        const mover = getPromptOption(minionPrompt, option => option.value?.minionUid === 'mover-1', 'mover');
        const choseMinion = respondToPrompt(played.finalState, mover.id, '0', defaultTestRandom);

        const basePrompt = getSimpleChoicePrompt(choseMinion.finalState, 'mythic_horses_friendship_power_base');
        const targetBase = getPromptOption(basePrompt, option => option.value?.baseIndex === 1, 'friendly target base');
        expect(getPromptOptions(basePrompt).some((option: any) => option.value?.baseIndex === 2)).toBe(false);
        const moved = respondToPrompt(choseMinion.finalState, targetBase.id, '0', defaultTestRandom);

        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(expect.arrayContaining(['friend-1', 'mover-1']));
        const topPrompt = getSimpleChoicePrompt(moved.finalState, 'mythic_horses_friendship_power_top');
        const putOnTop = getPromptOption(topPrompt, option => option.value?.putOnDeckTop === true, 'deck top choice');
        const resolved = respondToPrompt(moved.finalState, putOnTop.id, '0', defaultTestRandom);

        expectNoPrompt(resolved.finalState);
        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('friendship-1');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('friendship-1');
    });

    it('mythic_horses_sharing_power 在回合开始且该基地有力量 2 或以下随从时由拥有者抽 1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('small-1', 'robot_microbot_beta', '1', 2)],
                ongoingActions: [{ uid: 'sharing-1', defId: 'mythic_horses_sharing_power', ownerId: '0' }],
            }],
        });

        const triggered = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.CARDS_DRAWN
            && (event as any).payload.playerId === '0'
            && (event as any).payload.cardUids.includes('draw-1'),
        )).toBe(true);
    });
});
