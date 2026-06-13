import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, isMinionProtected, isOperationRestricted } from '../../domain/ongoingEffects';
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
    makeBase,
    makePlayer,
    makeState,
    makeMatchState,
    getInteractionsFromResult,
    getPromptHandlerData,
    getSimpleChoicePrompt,
    getCurrentPromptResolutionFrameId,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    respondToPrompt,
    expectNoPrompt,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { runCommand, defaultTestRandom } from '../testRunner';
import { resolveAbilityRuntimePrompt } from '../../domain/abilityRuntime';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    const state = overrides.state ?? makeState();
    return {
        state,
        matchState: makeMatchState(state),
        baseIndex: 0,
        baseDefId: 'test_base',
        playerId: '0',
        now: 1000,
        ...overrides,
    };
}

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
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn)
            .toBe(resolved.finalState.core.turnNumber);
    });

    it('埋葬妖精牌不会被丛林之灵误判为打出，只有翻开时才会触发额外 OR 分支', () => {
        const core = makeState({
            turnNumber: 1,
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('titania-1', 'fairies_titania', 'minion', '0')],
                    factions: ['fairies', 'ancient_egyptians'] as any,
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
            bases: [makeBase({
                defId: 'base_pyramids',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 1, { owner: '1', powerModifier: 0 })],
                ongoingActions: [],
            })],
        });

        const activated = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_BASE_ABILITY, playerId: '0', payload: { baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        const buryPrompt = getSimpleChoicePrompt(activated.finalState, 'base_pyramids');
        const buryOption = getPromptOption(buryPrompt, entry => entry.value?.cardUid === 'titania-1', 'bury titania option');

        const buried = respondToPrompt(activated.finalState, buryOption.id, '0', defaultTestRandom);

        expect(buried.success).toBe(true);
        expect(buried.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'titania-1')).toBe(true);
        expect(buried.finalState.core.bases[0].minions.some(minion => minion.uid === 'titania-1')).toBe(false);
        expect(buried.finalState.core.players['0'].hand.some(card => card.uid === 'titania-1')).toBe(false);
        expect(buried.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();
        expectNoPrompt(buried.finalState);

        const startTurnState = makeMatchState({
            ...buried.finalState.core,
            currentPlayerIndex: 1,
        });
        const enter = runCommand(
            startTurnState,
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 200 } as any,
            defaultTestRandom,
        );
        const uncoverPrompt = getSimpleChoicePrompt(enter.finalState, 'bury_uncover_start_turn');
        const uncoverOption = getPromptOption(uncoverPrompt, entry => entry.value?.cardUid === 'titania-1', 'buried titania option');

        const uncovered = respondToPrompt(enter.finalState, uncoverOption.id, '0', defaultTestRandom);
        const titaniaPrompt = getSimpleChoicePrompt(uncovered.finalState, 'fairies_titania');
        const returnOption = getPromptOption(titaniaPrompt, entry => entry.value?.branchId === 'return_minion', 'return branch');

        const choseReturnBranch = respondToPrompt(uncovered.finalState, returnOption.id, '0', defaultTestRandom);
        const targetPrompt = getSimpleChoicePrompt(choseReturnBranch.finalState, 'fairies_titania_return_minion');
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
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'enemy-1')).toBe(true);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn)
            .toBe(resolved.finalState.core.turnNumber);
    });

    it('fairies_tinx 应以 ongoing 直点附着行动卡，并把目标行动移到自己身上', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('tinx-1', 'fairies_tinx', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_a',
                minions: [
                    makeMinion('host-a', 'robot_microbot_alpha', '0', 1, {
                        attachedActions: [{ uid: 'attach-a', defId: 'fairies_enchantment', ownerId: '0', talentUsed: false }],
                    }),
                    makeMinion('tinx-host', 'ghosts_spectre', '0', 2),
                ],
                ongoingActions: [],
            })],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'tinx-1', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'fairies_tinx');
        expect(prompt.targetType).toBe('ongoing');
        const option = getPromptOption(prompt, entry => entry.value?.cardUid === 'attach-a', 'Tinx attached action option');

        const resolved = respondToPrompt(played.finalState, option.id, '0', defaultTestRandom);
        const sourceHost = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host-a');
        const tinx = resolved.finalState.core.bases[0].minions.find(minion => minion.defId === 'fairies_tinx');

        expect(sourceHost?.attachedActions.some(action => action.uid === 'attach-a')).toBe(false);
        expect(tinx?.attachedActions.some(action => action.uid === 'attach-a')).toBe(true);
    });

    it('埋骨堂把 Puck 从弃牌堆埋葬到基地时，不应触发 Puck 或丛林之灵的打出分支', () => {
        const core = makeState({
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [],
                    discard: [makeCard('puck-1', 'fairies_puck', 'minion', '0')],
                    factions: ['fairies', 'skeletons'] as any,
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-hand-1', 'robot_microbot_alpha', 'minion', '1')],
                }),
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
            bases: [makeBase({
                defId: 'base_ossuary',
                minions: [],
                ongoingActions: [],
            })],
        });

        const triggered = triggerBaseAbilityWithMS('base_ossuary', 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            baseDefId: 'base_ossuary',
            baseIndex: 0,
            playerId: '0',
            now: 1000,
        } as any);

        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'base_ossuary');
        const buryOption = getPromptOption(prompt, entry => entry.value?.cardUid === 'puck-1', 'ossuary puck option');
        const buried = respondToPrompt(triggered.matchState!, buryOption.id, '0', defaultTestRandom);

        expect(buried.success).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(buried.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        expect(buried.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'puck-1')).toBe(true);
        expect(buried.finalState.core.players['0'].discard.some(card => card.uid === 'puck-1')).toBe(false);
        expect(buried.finalState.core.titans?.find(titan => titan.uid === 'spirit-1')?.metadata?.spiritOfTheForestUsedTurn).toBeUndefined();
        expectNoPrompt(buried.finalState);
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

    it('borrowed fairies_magic_ward 应按控制者而不是真实 owner 限制其他玩家在此基地打行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_a',
                minions: [],
                ongoingActions: [{
                    uid: 'ward-borrowed',
                    defId: 'fairies_magic_ward',
                    ownerId: '1',
                    metadata: { sourceControllerId: '0' },
                } as any],
            })],
        });

        expect(isOperationRestricted(core, 0, '1', 'play_action')).toBe(true);
        expect(isOperationRestricted(core, 0, '0', 'play_action')).toBe(false);
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

    it('fairies_enchantment 对同一基地上的双方随从都应统一生效，不按控制者分流', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('enchantment-1', 'fairies_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('ally-1', 'robot_microbot_alpha', '0', 3, { powerModifier: 0 }),
                    makeMinion('enemy-1', 'dinosaur_armor_stego', '1', 4, { powerModifier: 0 }),
                ],
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
        const plusResolved = respondToPrompt(played.finalState, plusOption.id, '0', defaultTestRandom);
        const plusAlly = plusResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const plusEnemy = plusResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(getEffectivePower(plusResolved.finalState.core, plusAlly!, 0)).toBe(4);
        expect(getEffectivePower(plusResolved.finalState.core, plusEnemy!, 0)).toBe(5);

        const minusPlayed = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'enchantment-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );
        const minusPrompt = getSimpleChoicePrompt(minusPlayed.finalState, 'fairies_enchantment');
        const minusOption = getPromptOption(minusPrompt, entry => entry.value?.branchId === 'minus', 'minus branch');
        const minusResolved = respondToPrompt(minusPlayed.finalState, minusOption.id, '0', defaultTestRandom);
        const minusAlly = minusResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const minusEnemy = minusResolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy-1');
        expect(getEffectivePower(minusResolved.finalState.core, minusAlly!, 0)).toBe(2);
        expect(getEffectivePower(minusResolved.finalState.core, minusEnemy!, 0)).toBe(3);
    });

    it('borrowed fairies_enchantment 选择 -1 模式后仍应更新 metadata 并保留 sourcePlayerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('borrowed-enchantment-1', 'fairies_enchantment', 'action', '1')],
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
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'borrowed-enchantment-1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'fairies_enchantment');
        const minusOption = getPromptOption(prompt, entry => entry.value?.branchId === 'minus', 'minus branch');

        const resolved = respondToPrompt(played.finalState, minusOption.id, '0', defaultTestRandom);

        const enchantment = resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'borrowed-enchantment-1');
        const targetMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        expect(enchantment?.ownerId).toBe('1');
        expect(enchantment?.metadata?.fairiesEnchantmentMode).toBe('minus');
        expect(enchantment?.metadata?.sourcePlayerId).toBe('0');
        expect(enchantment?.metadata?.sourceControllerId).toBe('0');
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

    it('fairies_playful_tricks 应允许当前控制者打出 borrowed 丛林之灵并保留真实 owner', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('playful-borrowed', 'fairies_playful_tricks', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'borrowed-spirit',
                defId: 'fairies_spirit_of_the_forest',
                faction: 'fairies',
                ownerId: '1',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            }],
            bases: [makeBase('base_a')],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'playful-borrowed' } },
            defaultTestRandom,
        );

        const modePrompt = getSimpleChoicePrompt(played.finalState, 'fairies_playful_tricks');
        const playSpiritOption = getPromptOption(modePrompt, entry => entry.value?.branchId === 'play_spirit', 'borrowed play spirit branch');

        const choseSpirit = respondToPrompt(played.finalState, playSpiritOption.id, '0', defaultTestRandom);

        const basePrompt = getSimpleChoicePrompt(choseSpirit.finalState, 'fairies_playful_tricks_spirit_base');
        const baseOption = getPromptOptions(basePrompt)[0];
        expect(baseOption).toBeDefined();

        const summoned = respondToPrompt(choseSpirit.finalState, baseOption.id, '0', defaultTestRandom);

        expect(summoned.events.some(event => event.type === SU_EVENTS.TITAN_PLAYED)).toBe(true);
        expect(summoned.finalState.core.titans?.find(titan => titan.uid === 'borrowed-spirit')).toMatchObject({
            ownerId: '1',
            controllerId: '0',
            location: {
                zone: 'base',
                baseIndex: 0,
            },
        });
        expect(summoned.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(summoned.finalState.core.players['0'].minionsPlayed).toBe(0);
    });

    it('fairies_playful_tricks 选择消灭行动分支时应走 ongoing 直选并允许多选基地/附着行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('playful-1', 'fairies_playful_tricks', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_a',
                ongoingActions: [{ uid: 'base-action', defId: 'kaiju_stomp', ownerId: '1' }],
                minions: [
                    makeMinion('host-a', 'robot_microbot_alpha', '1', 2, {
                        attachedActions: [{ uid: 'attached-action', defId: 'fairies_enchantment', ownerId: '1', talentUsed: false }],
                    }),
                ],
            })],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'playful-1' } },
            defaultTestRandom,
        );

        const destroyPrompt = getSimpleChoicePrompt(played.finalState, 'fairies_playful_tricks_destroy');
        expect(destroyPrompt.targetType).toBe('ongoing');
        expect(destroyPrompt.multi).toMatchObject({ min: 0, max: 2 });
        expect(getPromptOption(destroyPrompt, entry => entry.value?.cardUid === 'base-action', 'base ongoing option')).toBeDefined();
        expect(getPromptOption(destroyPrompt, entry => entry.value?.cardUid === 'attached-action', 'attached ongoing option')).toBeDefined();
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
        const plusAppliedMinion = chosePlus.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-1');
        const plusAppliedEnchantment = chosePlus.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'enchantment-1');
        expect(plusAppliedEnchantment?.metadata?.fairiesEnchantmentMode).toBe('plus');
        expect(getEffectivePower(chosePlus.finalState.core, plusAppliedMinion!, 0)).toBe(4);
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

    it('base_fairy_ring 在非行动阶段会把额外分支标为 immediate', () => {
        const core = makeState({
            bases: [makeBase('base_fairy_ring', [makeMinion('m1', 'robot_microbot_alpha', '0', 3)])],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });
        const ms = makeMatchState(core);
        ms.sys.phase = 'startTurn';

        const triggerCtx = makeCtx({
            state: core,
            matchState: ms,
            baseDefId: 'base_fairy_ring',
            baseIndex: 0,
            playerId: '0',
            minionUid: 'm1',
        });
        const result = triggerBaseAbilityWithMS('base_fairy_ring', 'onMinionPlayed', triggerCtx);

        expect(result.events).toHaveLength(0);
        const prompt = getInteractionsFromResult(result)[0] as any;
        expect(getPromptSourceId(prompt)).toBe('base_fairy_ring');

        const minionTrigger = triggerBaseAbilityWithMS('base_fairy_ring', 'onMinionPlayed', triggerCtx);
        const minionPrompt = getInteractionsFromResult(minionTrigger)[0] as any;
        const minionOption = getPromptOption(minionPrompt, (entry: any) => entry.value?.branchId === 'extra_minion');
        expect(minionOption).toBeDefined();

        const minionResolved = resolveAbilityRuntimePrompt(
            minionTrigger.matchState!,
            '0',
            minionOption.value,
            getPromptHandlerData(minionPrompt),
            defaultTestRandom,
            1000,
        );

        const actionTrigger = triggerBaseAbilityWithMS('base_fairy_ring', 'onMinionPlayed', triggerCtx);
        const actionPrompt = getInteractionsFromResult(actionTrigger)[0] as any;
        const actionOption = getPromptOption(actionPrompt, (entry: any) => entry.value?.branchId === 'extra_action');
        expect(actionOption).toBeDefined();
        const actionResolved = resolveAbilityRuntimePrompt(
            actionTrigger.matchState!,
            '0',
            actionOption.value,
            getPromptHandlerData(actionPrompt),
            defaultTestRandom,
            1000,
        );

        const minionEvent = minionResolved?.events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED) as any;
        const actionEvent = actionResolved?.events.find(e => e.type === SU_EVENTS.LIMIT_MODIFIED) as any;
        expect(minionEvent?.payload.playTiming).toBe('immediate');
        expect(actionEvent?.payload.playTiming).toBe('immediate');
    });

    it('base_fairy_ring 非首次打出时不触发', () => {
        const core = makeState({
            bases: [makeBase('base_fairy_ring', [
                makeMinion('m1', 'robot_microbot_alpha', '0', 3),
                makeMinion('m2', 'robot_microbot_beta', '0', 2),
            ])],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 2 },
                }),
                '1': makePlayer('1'),
            },
        });

        const result = triggerBaseAbilityWithMS('base_fairy_ring', 'onMinionPlayed', makeCtx({
            state: core,
            matchState: makeMatchState(core),
            baseDefId: 'base_fairy_ring',
            baseIndex: 0,
            minionUid: 'm2',
        }));

        expect(result.events).toHaveLength(0);
        expect(getInteractionsFromResult(result)).toHaveLength(0);
    });

    it('base_fairy_ring 之前有随从被消灭后再打出仍不触发', () => {
        const core = makeState({
            bases: [makeBase('base_fairy_ring', [
                makeMinion('m2', 'robot_microbot_beta', '0', 2),
            ])],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 2 },
                }),
                '1': makePlayer('1'),
            },
        });

        const result = triggerBaseAbilityWithMS('base_fairy_ring', 'onMinionPlayed', makeCtx({
            state: core,
            matchState: makeMatchState(core),
            baseDefId: 'base_fairy_ring',
            baseIndex: 0,
            minionUid: 'm2',
        }));

        expect(result.events).toHaveLength(0);
        expect(getInteractionsFromResult(result)).toHaveLength(0);
    });
});
