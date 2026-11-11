import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary, getPromptOptions } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn, TutorialManifest } from '../../../engine/types';
import { createAnnualDiplomacyTutorialStep, resolveAnnualDiplomacyTutorialStep, validateAnnualDiplomacyTutorialStep } from '../annualDiplomacyTutorial';
import { resolveAnnualHandActionTutorialStep } from '../annualHandActionTutorial';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { QidahenDomain } from '../domain';
import { canPlaceRegularTroopsInRegion } from '../domain/regionSelectionPreferences';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import { getQidahenWheelPosition } from '../domain/wheelRules';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import { engineConfig } from '../game';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: () => 1, range: min => min, shuffle: cards => [...cards] };

/** 正式初始化后依轮盘顺位走到大明外交格。 */
function setup() {
    let state: MatchState<QidahenCore> = {
        core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
        sys: createInitialSystemState(players, engineConfig.systems, 'annual-hand-action-test'),
    };
    const send = (type: string, payload: unknown = {}, playerId = state.core.currentPlayer) => {
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state,
            { type, playerId, payload, timestamp: 100 } as QidahenCommand, random, players);
        expect(result.success, JSON.stringify({ type, payload, playerId, error: result.error })).toBe(true);
        state = result.state;
        return result;
    };
    const choose = (id: string | string[]) => {
        const prompt = getCurrentInteractionSummary(state);
        const data = getCurrentInteractionData<SimpleChoiceData>(state);
        expect(prompt.playerId).toBeDefined();
        expect(data).toBeDefined();
        const ids = Array.isArray(id) ? id : [id];
        const command = createRespondToPromptCommand(state, { playerId: prompt.playerId!,
            ...(data!.multi ? { optionIds: ids } : { optionId: ids[0] }) });
        return send(command.type, command.payload, command.playerId);
    };
    let reached = false;
    for (let guard = 0; guard < 150 && !reached; guard++) {
        const frame = getQidahenTurnResolutionFrame(state);
        if (!frame) {
            if (state.core.handLimitDiscardSelection) {
                const limit = state.core.handLimitDiscardSelection;
                choose(limit.candidateCardIds.slice(0, limit.requiredDiscardCount));
            } else send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
            continue;
        }
        const data = frame.metadata.qidahenTurn;
        if (data.step === 'menu' && data.factionId === 'ming' && getQidahenWheelPosition(data.positionId)?.kind === 'diplomacy-hire') {
            reached = true;
            continue;
        }
        if (data.step === 'menu') choose('finish-slot');
        else if (data.step === 'finish-hand') choose('skip-hand');
        else if (data.step === 'income-bonus') choose('decline-bonus');
        else if (data.step === 'character-judgement') choose('roll');
        else throw new Error(`Unexpected turn step: ${data.step}`);
    }
    expect(reached).toBe(true);
    const manifest: TutorialManifest = {
        id: 'annual-hand-action-test', numPlayers: 3,
        steps: [createAnnualDiplomacyTutorialStep([]), { id: 'done', content: 'done', infoStep: true }],
        // 正式接线待完成：在此组合外交步骤与手牌动作解析器。
        stepValidator: (match, step) => {
            const current = match as MatchState<QidahenCore>;
            if (step.id === 'diplomacy-cycle' && phase(current) === 'await-hand') return true;
            return validateAnnualDiplomacyTutorialStep(current, step) ?? true;
        },
        resolveStep: (match, step) => {
            const current = match as MatchState<QidahenCore>;
            return resolveAnnualHandActionTutorialStep(current, resolveAnnualDiplomacyTutorialStep(current, step));
        },
    };
    send('SYS_TUTORIAL_START', { manifest }, '0');
    const pay = (count: number) => {
        for (let index = 0; index < count; index++) {
            const card = state.core.handCards.find(item => item.faction === 'ming' && item.status !== 'disabled'
                && !state.core.selectedPaymentCardIds.includes(item.id));
            expect(card).toBeDefined();
            send('SELECT_PAYMENT_CARD', { cardId: card!.id });
        }
    };
    return { get state() { return state; }, send, choose, pay };
}

const phase = (state: MatchState<QidahenCore>) => getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn.step;
const prompt = (state: MatchState<QidahenCore>) => ({ summary: getCurrentInteractionSummary(state), options: getPromptOptions(state) });

/** 所有后续响应仍由当前真实 prompt 的 owner 和候选决定。 */
function finishBattle(match: ReturnType<typeof setup>) {
    let animations = 0;
    for (let guard = 0; guard < 24; guard++) {
        expect(match.state.sys.tutorial.step?.id).toBe('diplomacy-cycle');
        if (match.state.sys.tutorial.pendingAnimationAdvance) {
            animations++;
            match.send('SYS_TUTORIAL_ANIMATION_COMPLETE', {}, '0');
            continue;
        }
        if (phase(match.state) === 'menu') return animations;
        if (match.state.sys.tutorial.step?.aiActions?.length) {
            runTutorialAi(match);
            continue;
        }
        const current = prompt(match.state);
        const ids = current.options.map(option => option.id);
        const choice = ['defender-fight', 'fight', 'rear-guard', 'rout', 'occupy'].find(id => ids.includes(id))
            ?? ids.find(id => id.startsWith('withdraw:'));
        expect(choice, JSON.stringify({ phase: phase(match.state), prompt: current })).toBeDefined();
        match.choose(choice!);
    }
    throw new Error('战斗未返回外交轮盘菜单');
}

/** 与客户端相同，先执行实际批次动作，再发送该批次回执。 */
function runTutorialAi(match: ReturnType<typeof setup>) {
    const step = match.state.sys.tutorial.step!;
    const batchId = step.aiBatchId;
    const actions = step.aiActions;
    expect(batchId).toBeDefined();
    expect(actions?.length).toBe(1);
    const action = actions![0];
    expect(action.playerId).toBe(getCurrentInteractionSummary(match.state).playerId);
    match.send(action.commandType, action.payload, action.playerId);
    match.send('SYS_TUTORIAL_AI_CONSUMED', { stepId: step.id, batchId }, '0');
    return batchId!;
}

describe('外交格中手牌行动正式流程', () => {
    it.each(['raid', 'recruit', 'grant-pardon', 'drive-tiger'] as const)('%s 预览付费选择可取消且保留对局', action => {
        const match = setup();
        const before = match.state.core.factions.ming.handCount;
        match.choose(`hand-action:${action}`);
        const rule = { raid: 'hand-raid-rule', recruit: 'hand-recruit-rule', 'grant-pardon': 'hand-grant-rule', 'drive-tiger': 'hand-drive-rule' }[action];
        const payable = match.state.core.handCards.filter(card => card.faction === 'ming' && card.status !== 'disabled'
            && !match.state.core.selectedPaymentCardIds.includes(card.id));
        const recommended = payable.find(card => card.cardKind === 'silver') ?? payable[0];
        expect(recommended).toBeDefined();
        expect(match.state.sys.tutorial.step).toMatchObject({
            id: 'diplomacy-cycle', hideOverlay: false, content: expect.stringContaining(rule),
            recommendedTargets: [recommended.id], highlightTarget: `qidahen-hand-card-${recommended.id}`,
            tooltipAnchorTarget: `qidahen-hand-guide-${recommended.id}`,
        });
        expect(match.state.sys.tutorial.step?.allowedTargets).toBeUndefined();
        match.pay(1);
        match.send('CANCEL_PREVIEW_ACTION');
        expect(phase(match.state)).toBe('menu');
        expect(match.state.sys.tutorial.step?.id).toBe('diplomacy-cycle');
        expect(match.state.core.confirmedActionId).toBeNull();
        expect(match.state.core.factions.ming.handCount).toBe(before);
    });

    it('征召费用选足后隐藏选牌提示，撤选或取消后恢复正确状态', () => {
        const match = setup();
        const before = match.state.core.factions.ming.handCount;
        match.choose('hand-action:recruit');
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: false,
            content: expect.stringContaining('hand-recruit-rule') });
        match.pay(1);
        const selected = match.state.core.selectedPaymentCardIds[0];
        expect(match.state.core.payment.selected).toBeGreaterThanOrEqual(match.state.core.payment.required);
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: true });
        expect(match.state.sys.tutorial.step?.highlightTarget).toBeUndefined();
        expect(match.state.sys.tutorial.step?.tooltipAnchorTarget).toBeUndefined();
        expect(match.state.sys.tutorial.step?.recommendedTargets).toBeUndefined();
        match.send('SELECT_PAYMENT_CARD', { cardId: selected });
        expect(match.state.core.payment.selected).toBeLessThan(match.state.core.payment.required);
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: false,
            content: expect.stringContaining('hand-recruit-rule') });
        expect(match.state.sys.tutorial.step?.recommendedTargets).toHaveLength(1);
        match.pay(1);
        match.send('CANCEL_PREVIEW_ACTION');
        expect(phase(match.state)).toBe('menu');
        expect(match.state.core.factions.ming.handCount).toBe(before);
        expect(match.state.sys.tutorial.step?.hideOverlay).not.toBe(true);
        expect(match.state.sys.tutorial.step?.content).toContain('diplomacy-menu-dynamic');
        match.choose('hand-action:recruit');
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: false,
            content: expect.stringContaining('hand-recruit-rule') });
        match.pay(1);
        expect(match.state.sys.tutorial.step?.hideOverlay).toBe(true);
        match.send('EXECUTE_SELECTED_ACTION');
        expect(prompt(match.state).summary.sourceId).toBe('qidahen:recruit');
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: false,
            content: expect.stringContaining('hand-recruit-region') });
    });

    it('赐印三张费用部分支付仍提示，选足后允许真实确认', () => {
        const match = setup();
        match.choose('hand-action:grant-pardon');
        match.pay(1);
        expect(match.state.core.payment.selected).toBeLessThan(match.state.core.payment.required);
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: false,
            content: expect.stringContaining('hand-grant-rule') });
        match.pay(2);
        expect(match.state.core.payment.selected).toBeGreaterThanOrEqual(match.state.core.payment.required);
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: true });
        expect(match.state.sys.tutorial.step?.recommendedTargets).toBeUndefined();
        expect(match.state.sys.tutorial.step?.tooltipAnchorTarget).toBeUndefined();
        match.send('EXECUTE_SELECTED_ACTION');
        expect(prompt(match.state).summary).toMatchObject({ playerId: '0', sourceId: 'qidahen:grant-pardon' });
    });

    it('预览可取消而不扣牌，征召在真实选兵后返回外交格', () => {
        const match = setup();
        const before = match.state.core.factions.ming.handCount;
        match.choose('hand-action:recruit');
        expect(phase(match.state)).toBe('await-hand');
        match.pay(1);
        match.send('CANCEL_PREVIEW_ACTION');
        expect(phase(match.state)).toBe('menu');
        expect(match.state.core.factions.ming.handCount).toBe(before);
        match.choose('hand-action:recruit');
        match.pay(1);
        match.send('EXECUTE_SELECTED_ACTION');
        expect(phase(match.state)).toBe('await-hand');
        expect(prompt(match.state).summary.sourceId).toBe('qidahen:recruit');
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: false,
            content: expect.stringContaining('hand-recruit-region'),
            recommendedTargets: ['city-region-15'], highlightTarget: 'qidahen-map-region-focus-city-region-15' });
        expect(match.state.sys.tutorial.step?.allowedTargets).toBeUndefined();
        match.send('SELECT_REGION', { regionId: 'city-region-15' });
        const recruitOptions = prompt(match.state).options.filter(option => !option.disabled).map(option => option.id);
        expect(recruitOptions).toEqual(expect.arrayContaining(['level-2-troops', 'level-4-chuanbing']));
        const recommended = recruitOptions.find(id => id === 'level-2-troops')!;
        expect(match.state.sys.tutorial.step).toMatchObject({ hideOverlay: false,
            content: expect.stringContaining('hand-recruit-choice'),
            highlightTarget: 'qidahen-map-region-focus-city-region-15',
            recommendedTargets: [recommended], tooltipAnchorTarget: `qidahen-recruit-choice-${recommended}` });
        expect(match.state.sys.tutorial.step?.allowedTargets).toBeUndefined();
        const regionBefore = match.state.core.regions.find(region => region.id === 'city-region-15')!.troops;
        match.choose('level-4-chuanbing');
        expect(match.state.core.regions.find(region => region.id === 'city-region-15')!.troops).toBe(regionBefore + 2);
        expect(phase(match.state)).toBe('menu');
        expect(match.state.core.factions.ming.handCount).toBe(before - 1);
    });


    it('辽北不可征召时不推荐该区域，其他真实合法本土仍可选择', () => {
        const match = setup();
        match.choose('hand-action:recruit');
        match.pay(1);
        match.send('EXECUTE_SELECTED_ACTION');
        const live = match.state;
        const state: MatchState<QidahenCore> = { ...live, core: { ...live.core, regions: live.core.regions.map(region =>
            region.id === 'city-region-15' ? { ...region, controller: 'jin' as const } : region) } };
        const liaobei = state.core.regions.find(region => region.id === 'city-region-15')!;
        expect(canPlaceRegularTroopsInRegion(liaobei, 'ming', state.core)).toBe(false);
        const resolved = resolveAnnualHandActionTutorialStep(state, live.sys.tutorial.step!);
        expect(resolved.recommendedTargets ?? []).not.toContain('city-region-15');
        const id = resolved.recommendedTargets?.[0];
        expect(id).toBeDefined();
        const candidate = state.core.regions.find(region => region.id === id)!;
        expect(candidate.isLogicalRegion).not.toBe(true);
        expect(canPlaceRegularTroopsInRegion(candidate, 'ming', state.core)).toBe(true);
        expect(resolved.allowedTargets).toBeUndefined();
    });

    it('辽北合法时只作为推荐，另一本土大同可实际征召', () => {
        const match = setup();
        match.choose('hand-action:recruit');
        match.pay(1);
        match.send('EXECUTE_SELECTED_ACTION');
        expect(match.state.sys.tutorial.step?.recommendedTargets).toEqual(['city-region-15']);
        expect(match.state.sys.tutorial.step?.allowedTargets).toBeUndefined();
        const region = match.state.core.regions.find(item => item.id === 'city-region-1')!;
        expect(canPlaceRegularTroopsInRegion(region, 'ming', match.state.core)).toBe(true);
        const before = region.troops;
        match.send('SELECT_REGION', { regionId: region.id });
        expect(match.state.sys.tutorial.step?.highlightTarget).toBe(`qidahen-map-region-focus-${region.id}`);
        match.choose('level-2-troops');
        expect(match.state.core.regions.find(item => item.id === region.id)!.troops).toBe(before + 6);
        expect(phase(match.state)).toBe('menu');
    });

    it('赐印选择接收区后由对应后金选择真实兵牌，结束后回到大明菜单', () => {
        const match = setup();
        match.choose('hand-action:grant-pardon');
        match.pay(3);
        match.send('EXECUTE_SELECTED_ACTION');
        expect(prompt(match.state).summary).toMatchObject({ playerId: '0', sourceId: 'qidahen:grant-pardon' });
        match.choose('region:xian-xing');
        expect(prompt(match.state).summary).toMatchObject({ playerId: '2', sourceId: 'qidahen:grant-pardon' });
        const piece = prompt(match.state).options[0];
        expect(piece.id).toContain('->xian-xing');
        expect(match.state.sys.tutorial.step?.aiActions?.[0].payload).toMatchObject({ optionId: piece.id });
        runTutorialAi(match);
        expect(phase(match.state)).toBe('menu');
        expect(prompt(match.state).summary.playerId).toBe('0');
    });

    it.each(['accept', 'decline'] as const)('驱虎由蒙古选择 %s，按真实回应继续', decision => {
        const match = setup();
        match.choose('hand-action:drive-tiger');
        match.send('SELECT_REGION', { regionId: 'city-region-7' });
        match.pay(3);
        match.send('EXECUTE_SELECTED_ACTION');
        expect(prompt(match.state).summary).toMatchObject({ playerId: '1', sourceId: 'qidahen:drive-tiger-consent' });
        expect(prompt(match.state).options.map(option => option.id)).toEqual(['accept', 'decline']);
        const hand = match.state.core.factions.mongol.handCount;
        if (decision === 'accept') runTutorialAi(match);
        else match.choose(decision);
        if (decision === 'decline') {
            expect(phase(match.state)).toBe('menu');
            expect(prompt(match.state).summary.playerId).toBe('0');
            expect(match.state.core.factions.mongol.handCount).toBe(hand);
            return;
        }
        expect(phase(match.state)).toBe('await-hand');
        expect(match.state.core.factions.mongol.handCount).toBe(hand + 6);
        expect(prompt(match.state).summary).toMatchObject({ playerId: '0', sourceId: 'qidahen:dispatch-targeting' });
        match.choose('city-region-13');
        expect(match.state.core.pendingTargetAction?.actionId).toBe('drive-tiger');
        expect(prompt(match.state).summary).toMatchObject({ playerId: '2', sourceId: 'qidahen:pending-target' });
        runTutorialAi(match);
        expect(prompt(match.state).summary).toMatchObject({ playerId: '1', sourceId: 'qidahen:pending-target' });
        expect(prompt(match.state).options.some(option => option.id === 'fight')).toBe(true);
        expect(finishBattle(match)).toBeGreaterThan(0);
        expect(phase(match.state)).toBe('menu');
        expect(prompt(match.state).summary.playerId).toBe('0');
    });

    it('突袭按来源、目标、费用顺序进入真实战斗', () => {
        const match = setup();
        match.choose('hand-action:raid');
        match.send('SELECT_REGION', { regionId: 'city-region-15' });
        match.send('SELECT_REGION', { regionId: 'city-region-7' });
        match.pay(1);
        match.send('EXECUTE_SELECTED_ACTION');
        expect(phase(match.state)).toBe('await-hand');
        expect(match.state.core.pendingTargetAction?.actionId).toBe('raid');
        expect(prompt(match.state).summary).toMatchObject({ playerId: '1', sourceId: 'qidahen:pending-target' });
        runTutorialAi(match);
        expect(prompt(match.state).summary).toMatchObject({ playerId: '0', sourceId: 'qidahen:pending-target' });
        expect(prompt(match.state).options.some(option => option.id === 'fight')).toBe(true);
        expect(finishBattle(match)).toBeGreaterThan(0);
        expect(phase(match.state)).toBe('menu');
        expect(prompt(match.state).summary.playerId).toBe('0');
    });
    it('同一步骤依次处理不同对手，旧批次回执不能吞掉新提示', () => {
        const match = setup();
        match.choose('hand-action:drive-tiger');
        match.send('SELECT_REGION', { regionId: 'city-region-7' });
        match.pay(3);
        match.send('EXECUTE_SELECTED_ACTION');
        const consent = match.state.sys.tutorial.step!;
        expect(consent.aiActions?.[0]).toMatchObject({ playerId: '1', payload: { optionId: 'accept' } });
        const oldBatch = runTutorialAi(match);
        expect(prompt(match.state).summary.playerId).toBe('0');
        match.choose('city-region-13');
        const defence = match.state.sys.tutorial.step!;
        expect(defence.id).toBe(consent.id);
        expect(defence.aiBatchId).toBeDefined();
        expect(defence.aiBatchId).not.toBe(oldBatch);
        expect(defence.aiActions?.[0]).toMatchObject({ playerId: '2', payload: { optionId: 'defender-fight' } });
        const newBatch = defence.aiBatchId;
        const newActions = defence.aiActions;
        match.send('SYS_TUTORIAL_AI_CONSUMED', { stepId: consent.id, batchId: oldBatch }, '0');
        expect(match.state.sys.tutorial.step?.aiBatchId).toBe(newBatch);
        expect(match.state.sys.tutorial.step?.aiActions).toEqual(newActions);
        runTutorialAi(match);
        expect(match.state.sys.tutorial.step?.aiBatchId).not.toBe(newBatch);
        expect(match.state.sys.tutorial.step?.aiActions?.[0].playerId).toBe('1');
        expect(finishBattle(match)).toBeGreaterThan(0);
        expect(phase(match.state)).toBe('menu');
    });

});
