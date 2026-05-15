import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, isMinionProtected } from '../../domain/ongoingEffects';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reduce';
import { resumePendingBranchingChoiceFrames } from '../../domain/branchingChoice';
import {
    createSimpleChoice,
    queueInteraction,
    resolveInteraction,
} from '../../../../engine/systems/InteractionSystem';
import {
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    getSimpleChoicePrompt,
    getCurrentPromptResolutionFrameId,
    getPromptOption,
    getPromptOptions,
    respondToPrompt,
    expectNoPrompt,
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

describe('Fairies abilities', () => {
    it('fairies_titania 可以先选择回手分支，再选择具体随从移回其拥有者手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('titania-1', 'fairies_titania', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { owner: '1', powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'titania-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'fairies_titania');
        const returnBranchOption = getPromptOption(prompt, entry => entry.value?.branchId === 'return_minion', 'return branch');

        const choseReturnBranch = respondToPrompt(played.finalState, returnBranchOption.id, '0', defaultTestRandom);
        const targetPrompt = getSimpleChoicePrompt(choseReturnBranch.finalState, 'fairies_titania_return_minion');
        expect(targetPrompt.targetType).toBe('minion');
        const returnTargetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-1', 'return target');

        const resolved = respondToPrompt(choseReturnBranch.finalState, returnTargetOption.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'enemy-1')).toBe(true);
    });

    it('fairies_titania 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('titania-1', 'fairies_titania', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { owner: '1', powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'titania-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'fairies_titania');
        getPromptOption(prompt, entry => entry.value?.branchId === 'extra_minion', 'extra minion branch');
        const returnOption = getPromptOption(prompt, entry => entry.value?.branchId === 'return_minion', 'return branch');

        const choseReturnBranch = respondToPrompt(played.finalState, returnOption.id, '0', defaultTestRandom);
        const targetPrompt = getSimpleChoicePrompt(choseReturnBranch.finalState, 'fairies_titania_return_minion');
        expect(targetPrompt.targetType).toBe('minion');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-1', 'return target');

        const choseTarget = respondToPrompt(choseReturnBranch.finalState, targetOption.id, '0', defaultTestRandom);
        const followUpPrompt = getSimpleChoicePrompt(choseTarget.finalState, 'fairies_titania');
        const followUpExtraMinion = getPromptOption(followUpPrompt, entry => entry.value?.branchId === 'extra_minion', 'follow-up extra minion');
        getPromptOption(followUpPrompt, entry => entry.value?.skip === true, 'skip option');
        expect(getPromptOptions(followUpPrompt).find(entry => entry.value?.branchId === 'return_minion')).toBeUndefined();
        expect(choseTarget.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const resolved = respondToPrompt(choseTarget.finalState, followUpExtraMinion.id, '0', defaultTestRandom);

        expectNoPrompt(resolved.finalState);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'enemy-1')).toBe(true);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });

    it('fairies_titania 的第二个 OR 分支必须等待同 frame 的插队交互先结清', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('titania-1', 'fairies_titania', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { owner: '1', powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'titania-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const firstPrompt = getSimpleChoicePrompt(played.finalState, 'fairies_titania');
        const returnOption = getPromptOption(firstPrompt, entry => entry.value?.branchId === 'return_minion', 'return branch');

        const choseReturnBranch = respondToPrompt(played.finalState, returnOption.id, '0', defaultTestRandom);
        getSimpleChoicePrompt(choseReturnBranch.finalState, 'fairies_titania_return_minion');
        const frameId = getCurrentPromptResolutionFrameId(choseReturnBranch.finalState, 'fairies_titania_return_minion');
        expect(frameId).toBeTruthy();

        const injectedPrompt = createSimpleChoice(
            'synthetic-inserted',
            '0',
            '模拟返回时插队交互',
            [{ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }],
            { sourceId: 'synthetic_inserted', targetType: 'button', autoResolveIfSingle: false },
        );
        const queuedInserted = queueInteraction(choseReturnBranch.finalState, {
            ...injectedPrompt,
            resolutionFrameId: frameId,
        });
        const insertedCurrentState = resolveInteraction(queuedInserted);
        getSimpleChoicePrompt(insertedCurrentState, 'synthetic_inserted');

        const blockedByInserted = resumePendingBranchingChoiceFrames(insertedCurrentState, 5003);
        getSimpleChoicePrompt(blockedByInserted, 'synthetic_inserted');

        const afterInsertedResolved = resolveInteraction(insertedCurrentState);
        const resumedState = resumePendingBranchingChoiceFrames(afterInsertedResolved, 5004);
        const followUpPrompt = getSimpleChoicePrompt(resumedState, 'fairies_titania');
        getPromptOption(followUpPrompt, entry => entry.value?.branchId === 'extra_minion', 'follow-up extra minion');
        expect(getPromptOptions(followUpPrompt).find(entry => entry.value?.branchId === 'return_minion')).toBeUndefined();
    });

    it('fairies_glymmer 对其他随从的 -4 力量会在你的下回合开始时结束', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('glymmer-1', 'fairies_glymmer', '0', 4, { powerModifier: 0 }),
                    makeMinion('enemy-1', 'robot_microbot_alpha', '1', 3, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'glymmer-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(used.finalState, 'fairies_glymmer');
        const targetBranch = getPromptOption(prompt, entry => entry.value?.choice === 'target_other', 'target-other branch');

        const choseTargetBranch = respondToPrompt(used.finalState, targetBranch.id, '0', defaultTestRandom);
        const targetPrompt = getSimpleChoicePrompt(choseTargetBranch.finalState, 'fairies_glymmer_target');
        const targetOption = getPromptOption(targetPrompt, entry => entry.value?.minionUid === 'enemy-1', 'weaken target');

        const resolved = respondToPrompt(choseTargetBranch.finalState, targetOption.id, '0', defaultTestRandom);

        const weakened = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(weakened).toBeDefined();
        expect(getEffectivePower(resolved.finalState.core, weakened!, 0)).toBe(0);

        const afterTurnStart = reduce(resolved.finalState.core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 3 },
            timestamp: 4100,
        } as any);
        const restored = afterTurnStart.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(restored).toBeDefined();
        expect(getEffectivePower(afterTurnStart, restored!, 0)).toBe(3);
    });

    it('fairies_ladybug 会让附着随从不能被消灭', () => {
        const protectedMinion = makeMinion('ally-1', 'robot_microbot_alpha', '0', 3, {
            powerModifier: 0,
            attachedActions: [{ uid: 'ladybug-1', defId: 'fairies_ladybug', ownerId: '0' }],
        });
        const core = makeState({
            bases: [{
                defId: 'base_a',
                minions: [protectedMinion],
                ongoingActions: [],
            }],
        });

        expect(isMinionProtected(core, protectedMinion, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, protectedMinion, 0, '0', 'destroy')).toBe(true);
    });

    it('fairies_enchantment 选择 -1 模式后会写入 metadata 并降低基地上随从力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('enchantment-1', 'fairies_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 3, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'enchantment-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'fairies_enchantment');
        const minusOption = getPromptOption(prompt, entry => entry.value?.branchId === 'minus', 'minus branch');

        const resolved = respondToPrompt(played.finalState, minusOption.id, '0', defaultTestRandom);

        const enchantment = resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'enchantment-1');
        const targetMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(enchantment?.metadata?.fairiesEnchantmentMode).toBe('minus');
        expect(targetMinion).toBeDefined();
        expect(getEffectivePower(resolved.finalState.core, targetMinion!, 0)).toBe(2);
    });

    it('fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('puck-1', 'fairies_puck', 'minion', '0')],
                    deck: [],
                    discard: [makeCard('draw-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'puck-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'fairies_puck');
        const drawOption = getPromptOption(prompt, entry => entry.value?.branchId === 'draw_card', 'draw branch');
        getPromptOption(prompt, entry => entry.value?.branchId === 'extra_action', 'extra action branch');

        const drewCard = respondToPrompt(played.finalState, drawOption.id, '0', defaultTestRandom);
        expect(drewCard.events.some(event => event.type === SU_EVENTS.DECK_RESHUFFLED)).toBe(true);
        expect(drewCard.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(drewCard.finalState.core.players['0'].hand.length).toBe(1);
        expect(drewCard.finalState.core.players['0'].discard).toHaveLength(0);
        expect(drewCard.finalState.core.players['0'].actionLimit).toBe(1);
        expect(drewCard.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const followUpPrompt = getSimpleChoicePrompt(drewCard.finalState, 'fairies_puck');
        const followUpAction = getPromptOption(followUpPrompt, entry => entry.value?.branchId === 'extra_action', 'follow-up extra action');
        getPromptOption(followUpPrompt, entry => entry.value?.skip === true, 'skip option');
        expect(getPromptOptions(followUpPrompt).find(entry => entry.value?.branchId === 'draw_card')).toBeUndefined();

        const resolved = respondToPrompt(drewCard.finalState, followUpAction.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].hand.length).toBe(1);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });

    it('fairies_playful_tricks 可以直接把丛林之灵打到场上而不额外消耗通常随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('playful-1', 'fairies_playful_tricks', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'playful-1' } },
            defaultTestRandom,
        );

        const modePrompt = getSimpleChoicePrompt(played.finalState, 'fairies_playful_tricks');
        const playSpiritOption = getPromptOption(modePrompt, entry => entry.value?.branchId === 'play_spirit', 'play spirit branch');

        const choseSpirit = respondToPrompt(played.finalState, playSpiritOption.id, '0', defaultTestRandom);

        const basePrompt = getSimpleChoicePrompt(choseSpirit.finalState, 'fairies_playful_tricks_spirit_base');
        const baseOption = getPromptOptions(basePrompt)[0];
        expect(baseOption).toBeDefined();

        const summoned = respondToPrompt(choseSpirit.finalState, baseOption.id, '0', defaultTestRandom);

        const spirit = summoned.finalState.core.titans?.find(titan => titan.uid === 'spirit-1');
        expect(spirit?.location.zone).toBe('base');
        expect(spirit?.location.baseIndex).toBe(0);
        expect(summoned.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(summoned.finalState.core.players['0'].minionsPlayed).toBe(0);
    });

    it('fairies_enchantment 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过并记录 both 模式', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('enchantment-1', 'fairies_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 3, { powerModifier: 0 })],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'enchantment-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'fairies_enchantment');
        const plusOption = getPromptOption(prompt, entry => entry.value?.branchId === 'plus', 'plus branch');
        const chosePlus = respondToPrompt(played.finalState, plusOption.id, '0', defaultTestRandom);
        const followUpPrompt = getSimpleChoicePrompt(chosePlus.finalState, 'fairies_enchantment');
        const minusOption = getPromptOption(followUpPrompt, entry => entry.value?.branchId === 'minus', 'minus branch');
        getPromptOption(followUpPrompt, entry => entry.value?.skip === true, 'skip option');
        expect(chosePlus.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const resolved = respondToPrompt(chosePlus.finalState, minusOption.id, '0', defaultTestRandom);

        const enchantment = resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'enchantment-1');
        const targetMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(enchantment?.metadata?.fairiesEnchantmentMode).toBe('both');
        expect(getEffectivePower(resolved.finalState.core, targetMinion!, 0)).toBe(3);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });

    it('base_fairy_ring 选择额外行动时不会同时授予额外随从额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_fairy_ring',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'base_fairy_ring');
        const actionOption = getPromptOption(prompt, entry => entry.value?.branchId === 'extra_action', 'extra action branch');

        const resolved = respondToPrompt(played.finalState, actionOption.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota).toBeUndefined();
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
    });

    it('base_fairy_ring 在丛林之灵在场时只选单分支时，会先执行该分支并允许跳过剩余分支', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_fairy_ring',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'base_fairy_ring');
        const actionOption = getPromptOption(prompt, entry => entry.value?.branchId === 'extra_action', 'extra action branch');
        getPromptOption(prompt, entry => entry.value?.skip === true, 'initial skip option');

        const choseAction = respondToPrompt(played.finalState, actionOption.id, '0', defaultTestRandom);
        expect(choseAction.finalState.core.players['0'].actionLimit).toBe(2);
        const followUpPrompt = getSimpleChoicePrompt(choseAction.finalState, 'base_fairy_ring');
        getPromptOption(followUpPrompt, entry => entry.value?.branchId === 'extra_minion', 'follow-up extra minion');
        const followUpSkip = getPromptOption(followUpPrompt, entry => entry.value?.skip === true, 'follow-up skip option');
        expect(getPromptOptions(followUpPrompt).find(entry => entry.value?.branchId === 'extra_action')).toBeUndefined();

        const resolved = respondToPrompt(choseAction.finalState, followUpSkip.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota).toBeUndefined();
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();
    });

    it('base_fairy_ring 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minion-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'spirit-1',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            bases: [{
                defId: 'base_fairy_ring',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'minion-1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt = getSimpleChoicePrompt(played.finalState, 'base_fairy_ring');
        const actionOption = getPromptOption(prompt, entry => entry.value?.branchId === 'extra_action', 'extra action branch');

        const choseAction = respondToPrompt(played.finalState, actionOption.id, '0', defaultTestRandom);
        const followUpPrompt = getSimpleChoicePrompt(choseAction.finalState, 'base_fairy_ring');
        const minionOption = getPromptOption(followUpPrompt, entry => entry.value?.branchId === 'extra_minion', 'extra minion branch');
        getPromptOption(followUpPrompt, entry => entry.value?.skip === true, 'skip option');
        expect(choseAction.finalState.core.players['0'].actionLimit).toBe(2);
        expect(choseAction.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();

        const resolved = respondToPrompt(choseAction.finalState, minionOption.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(1);
        expect(resolved.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBe(1);
    });
});
