import { describe, expect, it } from 'vitest';
import {
    createActionLogSystem,
    createEventStreamSystem,
    createInitialSystemState,
    createInteractionSystem,
    createRematchSystem,
    createSimpleChoiceSystem,
    createTutorialSystem,
    executePipeline,
    TUTORIAL_COMMANDS,
} from '../../../engine';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
import { createRespondToPromptCommand, getPromptOptions } from '../../../engine/testing/interactionTestFacade';
import { QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getExplicitRaidTargetAction } from '../domain/pendingTargetActionBuilder';
import { resolveQidahenPreviewActionCancelledEvent } from '../domain/previewActionReducer';
import { resolveQidahenHandInteraction } from '../ui/handInteractionView';
import { createQidahenInteractionSystem } from '../domain/interactionSystem';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { QIDAHEN_TEST_TUTORIALS } from '../tutorial';
import type { QidahenCore } from '../domain/types';
import { expandSpecialTroopStacksToCompatPieces } from '../domain/troopCompat';
import { buildLocalDispatchCommand } from '../../../engine/transport/localDispatchCommand';

const playerIds = ['0', '1', '2'];
const random: RandomFn = {
    random: () => 4 / 6,
    d: (max) => Math.min(4, max),
    range: (min, max) => Math.min(Math.max(min, 4), max),
    shuffle: <T,>(items: T[]) => [...items],
};
const systems = [
    createActionLogSystem(),
    createInteractionSystem(),
    createTutorialSystem(),
    createEventStreamSystem(),
    createSimpleChoiceSystem(),
    createQidahenInteractionSystem(),
    createRematchSystem(),
];

const dispatch = (state: MatchState<QidahenCore>, type: string, payload: unknown, playerId = '0', randomOverride = random): MatchState<QidahenCore> => {
    const result = executePipeline(
        { domain: QidahenDomain, systems },
        state,
        { type, playerId, payload, ...(state.sys.tutorial.step?.aiActions?.some((action) => action.commandType === type && action.playerId === playerId) ? { skipValidation: true } : {}) } as Command,
        randomOverride,
        playerIds,
    );
    expect(result.success, result.error ?? type).toBe(true);
    return result.state;
};

describe('七大恨入门正式局面行动链', () => {
    it('正式入门清单让玩家依次完成军屯、突袭、战术与占领', () => {
        const setup = buildQidahenTutorialSetupData('basic-opening', true)!;
        const manifest = QIDAHEN_TEST_TUTORIALS.tutorials['basic-opening']!.manifest;
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(playerIds, random, setup.setupData),
            sys: createInitialSystemState(playerIds, systems, 'qidahen-guided-opening'),
        };
        const expectStep = (id: string) => expect(state.sys.tutorial.step?.id).toBe(id);
        state = dispatch(state, TUTORIAL_COMMANDS.START, { manifest });
        expectStep('frontier');
        state = dispatch(state, TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
        expectStep('select-farm-region');
        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-15' });
        expectStep('wheel-move');
        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, { moveId: 'move-2-one-opponent' });
        expectStep('wheel-opponent');
        state = dispatch(state, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, {
            moveId: 'move-2-one-opponent', opponentFactionId: 'jin',
        });
        expectStep('choose-raid');
        state = dispatch(state, QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, { actionId: 'raid' });
        expectStep('choose-target');
        expect(state.core.explicitRegionId).toBeNull();
        expect(resolveQidahenHandInteraction(state.core, true, null, [])).toMatchObject({ kind: 'action', raidTarget: null, canConfirm: false });
        const silverBeforeTarget = state.core.handCards.find((card) => card.faction === 'ming' && card.cardKind === 'silver')!;
        const paidWithoutTarget = { ...state, core: { ...state.core, selectedPaymentCardIds: [silverBeforeTarget.id] } };
        expect(QidahenDomain.validate(paidWithoutTarget, { type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION, playerId: '0', payload: {} })).toEqual({ valid: false, error: 'unknownRegion' });
        expect(QidahenDomain.validate(paidWithoutTarget, { type: QIDAHEN_COMMANDS.EXECUTE_ACTION, playerId: '0', payload: { actionId: 'raid' } })).toEqual({ valid: false, error: 'unknownRegion' });
        expect(getExplicitRaidTargetAction({ ...paidWithoutTarget.core, explicitRegionId: 'city-region-15' }, 'ming')).toBeNull();
        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-7' });
        expectStep('pay-raid');
        expect(getExplicitRaidTargetAction(state.core, 'ming')).toMatchObject({ targetRegionId: 'city-region-7' });
        const alternatives = state.core.regions.filter((region) => {
            const target = getExplicitRaidTargetAction({ ...state.core, explicitRegionId: region.id }, 'ming');
            return target && target.targetRuntimeRegionId !== 'city-region-7';
        });
        expect(alternatives.length).toBeGreaterThan(0);
        const other = alternatives[0];
        const otherTarget = getExplicitRaidTargetAction({ ...state.core, explicitRegionId: other.id }, 'ming');
        expect(otherTarget?.targetRegionId).toBe(other.id);
        const cancelled = resolveQidahenPreviewActionCancelledEvent(state.core, { type: 'PREVIEW_ACTION_CANCELLED', payload: {}, timestamp: 1 } as never);
        expect(cancelled.explicitRegionId).toBeNull();
        expect(getExplicitRaidTargetAction(cancelled, 'ming')).toBeNull();
        const silver = state.core.handCards.find((card) => card.faction === 'ming' && card.cardKind === 'silver')!;
        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, { cardId: silver.id });
        expectStep('confirm-raid-payment');
        state = dispatch(state, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION, {});
        expectStep('battle-open');
        expect(state.core.pendingTargetAction).toMatchObject({ targetRegionId: 'city-region-7' });
        const ai = state.sys.tutorial.step!.aiActions![0];
        const declaration = buildLocalDispatchCommand({ state, commandType: ai.commandType,
            payload: { ...ai.payload as object, __tutorialAiCommand: true, __tutorialPlayerId: ai.playerId },
            localPregameControlledPlayerId: '0' }).command;
        expect(declaration.payload).toMatchObject({ interactionId: state.sys.interaction.current?.id, optionId: 'defender-fight' });
        state = dispatch(state, declaration.type, declaration.payload, declaration.playerId);
        state = dispatch(state, TUTORIAL_COMMANDS.AI_CONSUMED, { stepId: 'battle-open' });
        state = dispatch(state, TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
        expectStep('play-tactic');
        const tactic = state.core.handCards.find((card) => (
            card.faction === 'ming' && card.cardDefId === 'qidahen-atlas05-1644-yuanyang-zhen'
        ))!;
        state = dispatch(state, QIDAHEN_COMMANDS.PLAY_TACTIC_CARD, { cardId: tactic.id });
        expectStep('resolve-battle');
        const nonDemoBattle = createRespondToPromptCommand(state, { playerId: '0', optionId: 'fight', mergedValue: { committedTroops: 1 } });
        state = dispatch(state, nonDemoBattle.type, nonDemoBattle.payload);
        expectStep('battle-branch-recovery');
        state = dispatch(state, TUTORIAL_COMMANDS.PREVIOUS, {});
        expectStep('resolve-battle');
        expect(state.core.pendingTargetAction?.resolvedBattleRolls).toBeUndefined();
        expect(state.core.postBattleSelection).toBeNull();
        expect(state.core.handCards.some((card) => card.id === tactic.id)).toBe(false);
        const battleCommand = createRespondToPromptCommand(state, {
            playerId: '0',
            optionId: 'fight',
            mergedValue: {
                attackerCasualtyPriority: 'highest-level',
                defenderCasualtyPriority: 'highest-level',
                committedTroops: 4,
            },
        });
        state = dispatch(state, battleCommand.type, battleCommand.payload);
        expectStep('battle-result');
        const battleRolls = state.core.postBattleSelection?.battleRolls;
        expect(battleRolls?.attackerMorale.destroyedTroops).toBe(0);
        expect(battleRolls?.stages.find((stage) => stage.phase === 'infantry')?.attackerRolls).toEqual([expect.objectContaining({ dieSides: 10, raw: 9 })]);
        expect(state.core.postBattleSelection?.forceOutcomes?.flatMap((force) => force.survivingSpecialTroops)
            .filter((stack) => stack.troopKind === 'infantry').every((stack) => stack.level === 2)).toBe(true);
        state = dispatch(state, TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
        expectStep('occupy');
        const occupy = state.core.postBattleSelection!.choices.find((choice) => choice.mode === 'occupy')!;
        const command = createRespondToPromptCommand(state, { playerId: '0', optionId: occupy.id });
        state = dispatch(state, command.type, command.payload);
        expectStep('finish');
        expect(state.core.regions.find((region) => region.id === 'city-region-7')?.controller).toBe('ming');
        state = dispatch(state, TUTORIAL_COMMANDS.NEXT, { reason: 'manual' });
        expect(state.sys.tutorial.active).toBe(false);
        expect(state.core.currentPlayer).toBe('1');
    });

    it.each(['occupy', 'withdraw'] as const)('真实开局先军屯辽北，再突袭叶赫部，战后选择%s保留实际等级与部队身份', (decision) => {
        const setup = buildQidahenTutorialSetupData('basic-opening', true)!;
        let cursor = 0;
        const battleRandom: RandomFn = { ...random, d: (max) => Math.min(max, [1, 1, 1, 1, 9][cursor++] ?? 4) };
        const dispatchBattle = (state: MatchState<QidahenCore>, type: string, payload: unknown, playerId = '0') =>
            dispatch(state, type, payload, playerId, battleRandom);
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(playerIds, random, setup.setupData),
            sys: createInitialSystemState(playerIds, systems, 'qidahen-natural-raid'),
        };
        state = dispatchBattle(state, QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-15' });
        state = dispatchBattle(state, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, {
            moveId: 'move-2-one-opponent', opponentFactionId: 'jin',
        });
        expect(state.core.regions.find((region) => region.id === 'city-region-15')?.troops).toBe(4);
        state = dispatchBattle(state, QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, { actionId: 'raid' });
        state = dispatchBattle(state, QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-7' });
        const silver = state.core.handCards.find((card) => (
            card.faction === 'ming' && card.cardKind === 'silver'
        ));
        expect(silver).toBeTruthy();
        state = dispatchBattle(state, QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, { cardId: silver!.id });
        state = dispatchBattle(state, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION, {});
        expect(state.core.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-15',
            targetRegionId: 'city-region-7',
        });
        const declaration = createRespondToPromptCommand(state, { playerId: '1', optionId: 'defender-fight' });
        state = dispatchBattle(state, declaration.type, declaration.payload, '1');
        const tactic = state.core.handCards.find((card) => (
            card.faction === 'ming' && card.cardDefId === 'qidahen-atlas05-1644-yuanyang-zhen'
        ));
        expect(tactic).toBeTruthy();
        state = dispatchBattle(state, QIDAHEN_COMMANDS.PLAY_TACTIC_CARD, { cardId: tactic!.id });
        state = dispatchBattle(state, QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION, {
            retreatLossMode: 'rear-guard',
            attackerCasualtyPriority: 'highest-level',
            defenderCasualtyPriority: 'highest-level',
            committedTroops: 4,
        });
        expect(state.core.lastSeasonSummary?.title).toContain('战');
        expect(state.core.postBattleSelection).toBeTruthy();
        expect(state.core.postBattleSelection?.battleRolls?.stages.find(stage => stage.phase === 'infantry')?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10, raw: 9 }),
        ]);
        expect(state.core.postBattleSelection?.choices.map((choice) => choice.mode)).toContain('occupy');
        const occupy = state.core.postBattleSelection!.choices.find((choice) => choice.mode === decision && (decision === 'occupy' || choice.regionId === 'city-region-15'))!;
        expect(getPromptOptions(state).map((option) => option.id)).toContain(occupy.id);
        const command = createRespondToPromptCommand(state, { playerId: '0', optionId: occupy.id });
        state = dispatchBattle(state, command.type, command.payload);
        const liaodong = state.core.regions.find((region) => region.id === 'city-region-15');
        const yehe = state.core.regions.find((region) => region.id === 'city-region-7');
        expect([liaodong?.troops, liaodong?.population]).toEqual([decision === 'occupy' ? 0 : 4, 3]);
        expect([yehe?.troops, yehe?.population, yehe?.controller]).toEqual([decision === 'occupy' ? 4 : 0, 2, decision === 'occupy' ? 'ming' : 'mongol']);
        const survivors = (decision === 'occupy' ? yehe : liaodong)!.specialTroops;
        expect(expandSpecialTroopStacksToCompatPieces(survivors).map(piece => [piece.troopKind, piece.level]).sort()).toEqual([
            ['artillery', 1], ['cavalry', 1], ['cavalry', 1], ['infantry', 2],
        ]);

        expect(state.core.factions.ming.handCount).toBe(4);
        expect(state.core.currentPlayer).toBe('1');
    });

    it('轮盘军屯后，手牌征召可在顺天建立受当地人口支持的川兵', () => {
        const setup = buildQidahenTutorialSetupData('basic-opening', true);
        expect(setup).toBeTruthy();
        const core = QidahenDomain.setup(playerIds, random, setup!.setupData);
        let state: MatchState<QidahenCore> = {
            core,
            sys: createInitialSystemState(playerIds, systems, 'qidahen-natural-opening'),
        };
        const xuanfuBefore = core.regions.find((region) => region.id === 'xuan-fu')!;
        const shuntianBefore = core.regions.find((region) => region.id === 'city-region-28')!;
        expect([xuanfuBefore.troops, xuanfuBefore.population]).toEqual([1, 2]);
        expect([shuntianBefore.troops, shuntianBefore.population]).toEqual([3, 5]);

        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'xuan-fu' });
        state = dispatch(state, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, {
            moveId: 'move-2-one-opponent', opponentFactionId: 'jin',
        });
        expect(state.core.actionWheelPosition).toBe('wheel-military-farm');
        expect(state.core.currentPlayer).toBe('0');
        expect(state.core.factionActionUsed).toBe(false);
        expect(state.core.regions.find((region) => region.id === 'xuan-fu')?.troops).toBe(2);

        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-28' });
        state = dispatch(state, QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, { actionId: 'recruit' });
        const paymentCard = state.core.handCards.find((card) => (
            card.faction === 'ming' && card.cardKind === 'silver'
        ));
        expect(paymentCard).toBeTruthy();
        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, { cardId: paymentCard!.id });
        state = dispatch(state, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION, {});
        state = dispatch(state, QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-28' });
        state = dispatch(state, QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE, { choiceId: 'level-4-chuanbing' });
        const shuntianAfter = state.core.regions.find((region) => region.id === 'city-region-28')!;
        expect([shuntianAfter.troops, shuntianAfter.population]).toEqual([5, 5]);
        expect(state.core.currentPlayer).not.toBe('0');
    });
    it.each([
        { name: '守方', dice: [1, 1, 4], committed: 3, playerId: '1', mode: 'rout', survivors: 3 },
        { name: '攻方', dice: [4, 1], committed: 1, playerId: '0', mode: 'rout', survivors: 3 },
        { name: '断后使最后步骑兵消灭，炮兵随之移除', dice: [1, 1, 1, 8], committed: 4, playerId: '0', mode: 'rear-guard', survivors: 0 },
    ])('$name在战后撤退时消费实际幸存部队，保留同一骰果与未参战部队', (scenario) => {
        const setup = buildQidahenTutorialSetupData('basic-opening', true)!;
        let cursor = 0;
        const battleRandom: RandomFn = { ...random, d: (max) => Math.min(max, scenario.dice[cursor++] ?? 1) };
        let state: MatchState<QidahenCore> = {
            core: QidahenDomain.setup(playerIds, random, setup.setupData),
            sys: createInitialSystemState(playerIds, systems, 'qidahen-retreat-morale'),
        };
        const act = (type: string, payload: unknown, playerId = '0') => {
            const result = executePipeline({ domain: QidahenDomain, systems }, state,
                { type, playerId, payload } as Command, battleRandom, playerIds);
            expect(result.success, result.error ?? type).toBe(true);
            state = result.state;
        };
        const respond = (optionId: string, playerId: string, mergedValue?: unknown) => {
            const cmd = createRespondToPromptCommand(state, { optionId, playerId, mergedValue });
            act(cmd.type, cmd.payload, playerId);
        };
        act(QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-15' });
        act(QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE, { moveId: 'move-2-one-opponent', opponentFactionId: 'jin' });
        const before = state.core.regions.find((region) => region.id === 'city-region-15')!;
        act(QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION, { actionId: 'raid' });
        act(QIDAHEN_COMMANDS.SELECT_REGION, { regionId: 'city-region-7' });
        const silver = state.core.handCards.find((card) => card.faction === 'ming' && card.cardKind === 'silver')!;
        act(QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, { cardId: silver.id });
        act(QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION, {});
        expect(state.sys.interaction.current?.playerId).toBe('1');
        expect(getPromptOptions(state).map((option) => option.id)).not.toContain('rout');
        const rejected = executePipeline({ domain: QidahenDomain, systems }, state,
            { type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION, playerId: '0', payload: {} }, battleRandom, playerIds);
        expect(rejected.success).toBe(false);
        expect(cursor).toBe(0);
        respond('defender-fight', '1');
        expect(cursor).toBe(0);
        const tactic = state.core.handCards.find((card) => card.cardDefId === 'qidahen-atlas05-1644-yuanyang-zhen')!;
        act(QIDAHEN_COMMANDS.PLAY_TACTIC_CARD, { cardId: tactic.id });
        respond('fight', '0', { committedTroops: scenario.committed });
        expect(state.core.pendingTargetAction?.battleStep).toBe('retreat');
        expect(state.sys.interaction.current?.playerId).toBe(scenario.playerId);
        const rolls = state.core.pendingTargetAction!.resolvedBattleRolls!;
        const defenderId = Object.keys(rolls.defenderMorale.remainingLevels)[0];
        expect(cursor).toBe(scenario.dice.length);
        respond(scenario.mode, scenario.playerId, { committedTroops: 4 });
        expect(cursor).toBe(scenario.dice.length);
        if (scenario.playerId === '1') {
            expect(state.core.postBattleSelection?.committedTroops).toBe(3);
            expect(expandSpecialTroopStacksToCompatPieces(state.core.regions.flatMap((region) => region.specialTroops)).some((piece) => piece.id === defenderId)).toBe(false);
        } else {
            const after = state.core.regions.find((region) => region.id === before.id)!;
            expect(after.troops).toBe(scenario.survivors);
            expect(after.specialTroops.reduce((sum, stack) => sum + stack.count, 0)).toBe(scenario.survivors);
        }
    });

});
