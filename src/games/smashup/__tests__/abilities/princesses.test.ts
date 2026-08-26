import { makeMinionDestroyedEvent } from '../helpers';
import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveSpecial } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reduce';
import { validate } from '../../domain/commands';
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
    respondToPrompt,
    expectNoPrompt,
    resolveDestroyedMinions,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Princesses abilities', () => {
    it('princesses_direct_to_dvd_sequel 会把弃牌堆随从洗回牌库并抽 1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dvd-1', 'princesses_direct_to_dvd_sequel', 'action', '0')],
                    discard: [makeCard('discard-minion', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'dvd-1' } },
            defaultTestRandom,
        );
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_direct_to_dvd_sequel');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'discard-minion', 'discard minion');

        const resolved = respondToPrompt(played.finalState, option.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-minion']);
        expect(resolved.finalState.core.players['0'].deck).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('dvd-1');
    });

    it('princesses_direct_to_dvd_sequel 选择被他人拥有的弃牌随从时，仍应洗回其拥有者牌库而不是当前玩家牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dvd-1', 'princesses_direct_to_dvd_sequel', 'action', '0')],
                    deck: [makeCard('p0-deck-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('borrowed-discard', 'robot_microbot_beta', 'minion', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-1', 'wizard_archmage', 'minion', '1')],
                }),
            },
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'dvd-1' } },
            defaultTestRandom,
        );
        expect(played.success).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_direct_to_dvd_sequel');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'borrowed-discard', 'borrowed discard minion');

        const resolved = respondToPrompt(played.finalState, option.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('borrowed-discard');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('borrowed-discard');
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toContain('borrowed-discard');
    });

    it('princesses_woodland_helpers 会把刚打出的行动放到牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('spell-1', 'wizard_summon', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'woodland-1', defId: 'princesses_woodland_helpers', ownerId: '0' }],
            }],
        });

        const triggerResult = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceEventId: 'action-played:spell-1:0',
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'princesses_woodland_helpers');
        expect(prompt.displayCard).toEqual({ defId: 'wizard_summon', cardUid: 'spell-1' });
        const option = getPromptOption(prompt, entry => entry.value?.choice === 'move_to_bottom', 'move-to-bottom option');

        const resolved = respondToPrompt(triggerResult.matchState!, option.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('spell-1');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1', 'spell-1']);
    });

    it('princesses_woodland_helpers 在你打出被他人拥有的行动后，仍应给你创建回收选择并把该行动放回其拥有者牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-0', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('deck-1', 'robot_microbot_beta', 'minion', '1')],
                    discard: [makeCard('borrowed-spell-1', 'wizard_summon', 'action', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'woodland-1', defId: 'princesses_woodland_helpers', ownerId: '0' }],
            }],
        });

        const triggerResult = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            sourceControllerId: '0',
            sourceEventId: 'action-played:borrowed-spell-1:0',
            random: defaultTestRandom,
            now: 1001,
        });

        const prompt = getSimpleChoicePrompt(triggerResult.matchState!, 'princesses_woodland_helpers');
        expect(prompt.playerId).toBe('0');
        expect(prompt.displayCard).toEqual({ defId: 'wizard_summon', cardUid: 'borrowed-spell-1' });

        const option = getPromptOption(prompt, entry => entry.value?.choice === 'move_to_bottom', 'move-to-bottom option');
        const resolved = respondToPrompt(triggerResult.matchState!, option.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('borrowed-spell-1');
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['deck-1', 'borrowed-spell-1']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-0']);
    });

    it('princesses_fairy_godmother 选择 buff 时会进入第二段目标选择并给目标 +2 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fg-1', 'princesses_fairy_godmother', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                    makeMinion('enemy-1', 'robot_microbot_beta', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fg-1' } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_fairy_godmother');
        const buffOption = getPromptOption(prompt, entry => entry.value?.choice === 'buff', 'buff option');

        const choseBuff = respondToPrompt(played.finalState, buffOption.id, '0', defaultTestRandom);
        const targetPrompt = getSimpleChoicePrompt(choseBuff.finalState, 'princesses_fairy_godmother_target');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'ally-1', 'buff target');

        const resolved = respondToPrompt(choseBuff.finalState, targetOption.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1')?.tempPowerModifier).toBe(2);
    });

    it('princesses_true_loves_kiss 会先选随从再选基地并完成移动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('tlk-1', 'princesses_true_loves_kiss', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'tlk-1' } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_true_loves_kiss');
        const minionOption = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1', 'minion target');

        const choseMinion = respondToPrompt(played.finalState, minionOption.id, '0', defaultTestRandom);
        const basePrompt = getSimpleChoicePrompt(choseMinion.finalState, 'princesses_true_loves_kiss_base');
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 1, 'destination base');

        const resolved = respondToPrompt(choseMinion.finalState, baseOption.id, '0', defaultTestRandom);
        const movedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_MOVED) as any;

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy-1');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('enemy-1');
        expect(movedEvent?.payload).toMatchObject({
            sourcePlayerId: '0',
            sourceDefId: 'princesses_true_loves_kiss',
            sourceControllerId: '0',
        });
    });

    it('princesses_some_day_my_prince_will_come 会先选本基地随从再选目标基地', () => {
        const executor = resolveSpecial('princesses_some_day_my_prince_will_come');
        expect(executor).toBeDefined();

        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('ally-1', 'robot_microbot_alpha', '0', 2),
                        makeMinion('enemy-1', 'robot_microbot_beta', '1', 3),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                },
            ],
        });

        const result = executor!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'special-1',
            defId: 'princesses_some_day_my_prince_will_come',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'princesses_some_day_my_prince_will_come');
        const minionOption = getPromptOption(prompt, entry => entry.value?.minionUid === 'ally-1', 'friendly minion');

        const choseMinion = respondToPrompt(result.matchState!, minionOption.id, '0', defaultTestRandom);
        const basePrompt = getSimpleChoicePrompt(choseMinion.finalState, 'princesses_some_day_my_prince_will_come_base');
        const baseOption = getPromptOption(basePrompt, entry => entry.value?.baseIndex === 1, 'destination base');

        const resolved = respondToPrompt(choseMinion.finalState, baseOption.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally-1');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('ally-1');
    });

    it('princesses_skillet 会消灭低力量随从并抽三张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('skillet-1', 'princesses_skillet', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('draw-3', 'wizard_summon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'skillet-1' } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_skillet');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1', 'destroy target');

        const resolved = respondToPrompt(played.finalState, option.id, '0', defaultTestRandom);
        const destroyedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as any;

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy-1');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2', 'draw-3']);
        expect(destroyedEvent?.payload).toMatchObject({
            sourcePlayerId: '0',
            sourceDefId: 'princesses_skillet',
            sourceControllerId: '0',
        });
    });

    it('princesses_snow_white 会把另一个基地上的仆从移动到这里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('snow-1', 'princesses_snow_white', '0', 5)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const talent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'snow-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(talent.finalState, 'princesses_snow_white');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1', 'move target');

        const resolved = respondToPrompt(talent.finalState, option.id, '0', defaultTestRandom);
        const movedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_MOVED) as any;

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('enemy-1');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).not.toContain('enemy-1');
        expect(movedEvent?.payload).toMatchObject({
            sourcePlayerId: '0',
            sourceDefId: 'princesses_snow_white',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
        });
    });

    it('princesses_tale_as_old_as_time 会把你的所有仆从移动到选定基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('tale-1', 'princesses_tale_as_old_as_time', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_b',
                    minions: [makeMinion('enemy-1', 'robot_microbot_beta', '1', 3)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_c',
                    minions: [makeMinion('ally-2', 'wizard_apprentice', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'tale-1', targetBaseIndex: 1 } },
            defaultTestRandom,
        );
        expect(played.success).toBe(true);
        expectNoPrompt(played.finalState);

        expect(played.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['ally-1', 'ally-2', 'enemy-1']),
        );
        expect(played.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally-1');
        expect(played.finalState.core.bases[2].minions.map(minion => minion.uid)).not.toContain('ally-2');
        const movedEvents = played.events.filter(event => event.type === SU_EVENTS.MINION_MOVED) as any[];
        expect(movedEvents).toHaveLength(2);
        expect(movedEvents.every(event => event.payload?.sourcePlayerId === '0')).toBe(true);
        expect(movedEvents.every(event => event.payload?.sourceDefId === 'princesses_tale_as_old_as_time')).toBe(true);
        expect(movedEvents.every(event => event.payload?.sourceControllerId === '0')).toBe(true);
    });

    it('princesses_griselda 可以把传家宝从弃牌堆回到手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('heirloom-1', 'princesses_heirloom', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('griselda-1', 'princesses_griselda', '0', 5)],
                ongoingActions: [],
            }],
        });

        const talent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'griselda-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(talent.finalState, 'princesses_griselda');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'heirloom-1', 'heirloom target');

        const resolved = respondToPrompt(talent.finalState, option.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('heirloom-1');
        expect(resolved.finalState.core.players['0'].discard).toHaveLength(0);
    });

    it('美丽城堡上的 5 力己方随从仍可被自己的传家宝附着', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('heirloom-1', 'princesses_heirloom', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_beautiful_castle',
                minions: [makeMinion('ally-1', 'superheroes_the_burst', '0', 5)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'heirloom-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        expect(played.events.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.ABILITY_FEEDBACK
            && (event as any).payload?.messageKey === 'feedback.target_protected',
        )).toBe(false);
        expect(
            played.finalState.core.bases[0].minions[0]?.attachedActions.some(
                (action) => action.uid === 'heirloom-1' && action.defId === 'princesses_heirloom',
            ),
        ).toBe(true);
    });

    it('同一随从附着两张传家宝时，每张传家宝都会继续给该随从 +1 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [{
                    ...makeMinion('griselda-1', 'princesses_griselda', '0', 5),
                    attachedActions: [
                        { uid: 'heirloom-1', defId: 'princesses_heirloom', ownerId: '0' },
                        { uid: 'heirloom-2', defId: 'princesses_heirloom', ownerId: '0' },
                    ],
                }],
                ongoingActions: [],
            }],
        });

        const griselda = core.bases[0].minions[0]!;
        expect(griselda.attachedActions).toHaveLength(2);
        expect(core.bases[0].minions[0]?.attachedActions.filter(action => action.defId === 'princesses_heirloom')).toHaveLength(2);
        expect(getEffectivePower(core, griselda, 0)).toBe(9);
    });

    it('princesses_happily_ever_after 会在你于该基地得分时额外给 1 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'hea-1', defId: 'princesses_happily_ever_after', ownerId: '0' }],
            }],
        });

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload.playerId === '0'
            && (event as any).payload.amount === 1,
        )).toBe(true);
    });

    it('princesses_sleeping_beauty 被消灭时会洗回牌库而不是进弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('sleep-1', 'princesses_sleeping_beauty', '0', 5)],
                ongoingActions: [],
            }],
        });
        const ms = makeMatchState(core);

        const triggerResult = resolveDestroyedMinions(ms, '1', [makeMinionDestroyedEvent({minionUid: 'sleep-1',
                minionDefId: 'princesses_sleeping_beauty',
                fromBaseIndex: 0,
                ownerId: '0',
                reason: 'test_destroy', timestamp: 1000 }) as any], defaultTestRandom, 1000);

        expect(triggerResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const finalCore = triggerResult.events.reduce((current, event) => reduce(current, event as any), core);
        expect(finalCore.players['0'].discard.map(card => card.uid)).not.toContain('sleep-1');
        expect(finalCore.players['0'].deck.map(card => card.uid)).toContain('sleep-1');
    });

    it('princesses_sleeping_beauty 在对手回合进入弃牌堆后仍会通过 queued discard trigger 洗回拥有者牌库', () => {
        const preDiscardCore = makeState({
            turnOrder: ['1', '0'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-0', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('sleep-1', 'princesses_sleeping_beauty', '0', 5)],
                ongoingActions: [],
            }],
        });

        const postDiscardCore = makeState({
            turnOrder: ['1', '0'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-0', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('sleep-1', 'princesses_sleeping_beauty', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(postDiscardCore, 'onMinionDiscardedFromBase', {
            state: postDiscardCore,
            matchState: makeMatchState(postDiscardCore),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'sleep-1',
            triggerMinionDefId: 'princesses_sleeping_beauty',
            triggerMinion: preDiscardCore.bases[0].minions[0],
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        postDiscardCore.triggerQueue = (queued as any).payload.triggers;

        const resolved = maybeResolveReactionQueue(makeMatchState(postDiscardCore), defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expectNoPrompt(resolved!.state);
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.DECK_REORDERED
            && (event as any).payload.playerId === '0'
            && ((event as any).payload.deckUids ?? []).includes('sleep-1'),
        )).toBe(true);
    });

    it('princesses_eliza 会阻止对手在同回合打出第二张额外牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('extra-action-1', 'princesses_direct_to_dvd_sequel', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 2,
                    extraCardsPlayedThisTurn: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('eliza-1', 'princesses_eliza', '1', 5)],
                ongoingActions: [],
            }],
        });

        const result = validate(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'extra-action-1' } } as any,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('受伊莱莎限制：你本回合不能再打出额外牌');
    });

    it('princesses_skillet_pod 消灭低力量随从后只抽一张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('skillet-pod-1', 'princesses_skillet_pod', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-small', 'wizard_apprentice', '1', 2),
                    makeMinion('enemy-big', 'pirate_first_mate', '1', 3),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'skillet-pod-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);

        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_skillet');
        const target = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-small', 'destroy target');
        expect(getPromptOptions(prompt).some((entry: any) => entry.value?.minionUid === 'enemy-big')).toBe(false);
        const resolved = respondToPrompt(played.finalState, target.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('enemy-small');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-2']);
    });

    it('princesses_fairy_godmother_pod 抽牌分支抽两张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fg-pod-1', 'princesses_fairy_godmother_pod', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-2', 'robot_microbot_beta', 'minion', '0'),
                        makeCard('draw-3', 'wizard_summon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fg-pod-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_fairy_godmother_pod');
        const drawOption = getPromptOption(prompt, entry => entry.value?.choice === 'draw', 'draw option');

        const resolved = respondToPrompt(played.finalState, drawOption.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-3']);
    });

    it('princesses_fairy_godmother_pod buff 分支给目标 +3 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fg-pod-1', 'princesses_fairy_godmother_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 2)],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'fg-pod-1' } },
            defaultTestRandom,
        );
        expect(played.success, played.error).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'princesses_fairy_godmother_pod');
        const buffOption = getPromptOption(prompt, entry => entry.value?.choice === 'buff', 'buff option');
        const choseBuff = respondToPrompt(played.finalState, buffOption.id, '0', defaultTestRandom);

        const targetPrompt = getSimpleChoicePrompt(choseBuff.finalState, 'princesses_fairy_godmother_target');
        const target = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'ally-1', 'buff target');
        const resolved = respondToPrompt(choseBuff.finalState, target.id, '0', defaultTestRandom);

        const ally = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(ally).toBeDefined();
        expect(getEffectivePower(resolved.finalState.core, ally!, 0)).toBe(5);
    });

    it('princesses_woodland_helpers_pod 只对刚打出的标准行动触发，不对 ongoing 行动触发', () => {
        const ongoingCore = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('heirloom-pod-1', 'princesses_heirloom_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'woodland-pod-1', defId: 'princesses_woodland_helpers_pod', ownerId: '0' }],
            }],
        });

        const skipped = fireTriggers(ongoingCore, 'onActionPlayed', {
            state: ongoingCore,
            matchState: makeMatchState(ongoingCore),
            playerId: '0',
            sourceEventId: 'action-played:heirloom-pod-1:0',
            random: defaultTestRandom,
            now: 1000,
        });
        expect(skipped.events).toHaveLength(0);
        expectNoPrompt(skipped.matchState!);

        const standardCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'robot_microbot_alpha', 'minion', '0')],
                    discard: [makeCard('skillet-pod-1', 'princesses_skillet_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{ uid: 'woodland-pod-1', defId: 'princesses_woodland_helpers_pod', ownerId: '0' }],
            }],
        });

        const triggered = fireTriggers(standardCore, 'onActionPlayed', {
            state: standardCore,
            matchState: makeMatchState(standardCore),
            playerId: '0',
            sourceEventId: 'action-played:skillet-pod-1:0',
            random: defaultTestRandom,
            now: 1000,
        });
        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'princesses_woodland_helpers');
        const moveOption = getPromptOption(prompt, entry => entry.value?.choice === 'move_to_bottom', 'move-to-bottom option');
        const resolved = respondToPrompt(triggered.matchState!, moveOption.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('skillet-pod-1');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1', 'skillet-pod-1']);
    });

    it('princesses_griselda_pod 可选择取回传家宝，或选择额外行动分支', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('heirloom-pod-1', 'princesses_heirloom_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('griselda-pod-1', 'princesses_griselda_pod', '0', 5)],
                ongoingActions: [],
            }],
        });

        const talent = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'griselda-pod-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        expect(talent.success, talent.error).toBe(true);
        const prompt = getSimpleChoicePrompt(talent.finalState, 'princesses_griselda_pod');
        getPromptOption(prompt, entry => entry.value?.cardUid === 'heirloom-pod-1', 'recover heirloom');
        const extraAction = getPromptOption(prompt, entry => entry.value?.choice === 'play_extra_action', 'extra action branch');

        const resolved = respondToPrompt(talent.finalState, extraAction.id, '0', defaultTestRandom);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('heirloom-pod-1');
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({
                restrictToCardDefId: 'princesses_heirloom_pod',
            }),
        }));
    });
});
