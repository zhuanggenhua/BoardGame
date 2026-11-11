import type { MatchState, TutorialStepSnapshot } from '../../engine/types';
import { buildQidahenTurnChoice } from './domain/turnResolutionChoices';
import { getQidahenTurnResolutionFrame } from './domain/turnResolutionOpportunities';
import type { QidahenCore } from './domain/types';

const RESPONSE = 'SYS_INTERACTION_RESPOND';
const PLAYER_PREFIX = 'season-upkeep-player-';
const OPPONENT_PREFIX = 'season-upkeep-opponent-';
const PAYMENT = 'season-chronology-payment';
const CHRONOLOGY_OPPONENT_PREFIX = 'season-chronology-opponent-';

/**
 * 一个玩家步骤可承接连续地区和分次支付；切换到对手时才进入自动步骤。
 * 空槽由 stepValidator 跳过，不预先猜测各地区是否产生耗损。
 */
export function createAnnualSeasonTutorialSteps(avoidOverlapSelectors: string[]): TutorialStepSnapshot[] {
    const steps: TutorialStepSnapshot[] = [];
    for (let index = 1; index <= 4; index++) {
        steps.push({
            id: `${PLAYER_PREFIX}${index}`,
            content: index === 1 ? 'game-qidahen:tutorial.annual.steps.season-upkeep' : '',
            ...(index === 1 ? {} : { hideOverlay: true }),
            requireAction: true, hideActionHint: true, highlightFrame: 'none', position: 'right',
            avoidOverlapSelectors: [...avoidOverlapSelectors, '[data-qidahen-map-candidate-protection="true"]', '[data-qidahen-candidate-object="true"]'],
            allowedCommands: [RESPONSE],
        });
        steps.push({
            id: `${OPPONENT_PREFIX}${index}`, content: '',
            // 绑定真实状态时 resolveAnnualSeasonTutorialStep 会替换为当前对手的合法选择。
            aiActions: [{ commandType: RESPONSE, playerId: '2', payload: { optionId: 'hand-10' }, waitForBoardSyncAfter: true }],
            hiddenAutomation: {
                kind: 'compressed-repeat', equivalentStepIds: [`${PLAYER_PREFIX}1`],
                reason: '对手依同一已展示的耗损规则处理自己的部队，玩家不代替对手操作。',
            },
        });
    }
    return steps;
}

export function createAnnualChronologyPaymentStep(): TutorialStepSnapshot {
    return { id: PAYMENT, content: '', hideOverlay: true, hideActionHint: true, requireAction: true,
        highlightFrame: 'none', highlightTarget: 'qidahen-hand-zone', position: 'top', allowedCommands: [RESPONSE] };
}

/** 大明放弃后，依真实顺位由对手决定与支付；每个独立槽处理一次正式输入。 */
export function createAnnualChronologyOpponentSteps(): TutorialStepSnapshot[] {
    return Array.from({ length: 12 }, (_, index) => ({ id: `${CHRONOLOGY_OPPONENT_PREFIX}${index + 1}`, content: '',
        aiActions: [{ commandType: RESPONSE, playerId: '2', payload: { optionId: 'claim' }, waitForBoardSyncAfter: true }],
        hiddenAutomation: { kind: 'compressed-repeat' as const, equivalentStepIds: ['claim-year'],
            reason: '对手依已展示的纪年领取和支付规则处理自己的选择。' } }));
}

/** 未处理的 id 返回 undefined，便于与其它教学步骤校验组合。 */
export function validateAnnualSeasonTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): boolean | undefined {
    const isPlayer = step.id.startsWith(PLAYER_PREFIX);
    const isOpponent = step.id.startsWith(OPPONENT_PREFIX);
    const isChronologyOpponent = step.id.startsWith(CHRONOLOGY_OPPONENT_PREFIX);
    if (!isPlayer && !isOpponent && !isChronologyOpponent && step.id !== PAYMENT) return undefined;
    const data = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn;
    if (isChronologyOpponent) {
        if (!data || !['chronology', 'chronology-payment'].includes(data.step)) return false;
        const choice = buildQidahenTurnChoice(state.core, data);
        return Boolean(choice && choice.factionId !== 'ming');
    }
    if (step.id === PAYMENT) return data?.step === 'chronology-payment';
    if (data?.step !== 'upkeep') return false;
    const task = data.upkeepTasks[data.upkeepIndex];
    if (!task) return false;
    return isPlayer ? task.factionId === 'ming' : task.factionId !== 'ming';
}

/** 只从正式结算 frame 构造可选对象；不缓存地区、手牌或支付数量。 */
export function resolveAnnualSeasonTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): TutorialStepSnapshot {
    if (validateAnnualSeasonTutorialStep(state, step) !== true) return step;
    const data = getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn;
    const choice = buildQidahenTurnChoice(state.core, data);
    if (!choice) throw new Error(`年度教程无法解析正式选择: ${step.id}`);
    const candidates = choice.candidates.filter(candidate => !candidate.disabled).map(candidate => candidate.id);
    if (!candidates.length) throw new Error(`年度教程没有合法候选: ${step.id}`);

    if (step.id === PAYMENT) {
        return { ...step, allowedTargets: undefined, tooltipAnchorTarget: `qidahen-hand-guide-${candidates[0]}` };
    }
    if (step.id.startsWith(CHRONOLOGY_OPPONENT_PREFIX)) {
        const current = state.sys.interaction?.current as { id?: string; data?: { multi?: unknown } } | null | undefined;
        const optionId = candidates.includes('claim') ? 'claim' : candidates[0];
        return { ...step, aiActions: [{ commandType: RESPONSE, playerId: state.core.factions[choice.factionId].playerId,
            payload: { ...(current?.id ? { interactionId: current.id } : {}),
                ...(current?.data?.multi ? { optionIds: [optionId] } : { optionId }) }, waitForBoardSyncAfter: true }] };
    }
    const task = data.upkeepTasks[data.upkeepIndex];
    if (step.id.startsWith(PLAYER_PREFIX)) {
        // 一种耗损原因首次遇到时解释原因；同类后续地区让正式控件承接选择。
        const explained = data.upkeepTasks.slice(0, data.upkeepIndex)
            .some(previous => previous.factionId === 'ming' && previous.reason === task.reason);
        return { ...step, allowedTargets: undefined, highlightTarget: `qidahen-map-region-focus-${task.regionId}`,
            tooltipAnchorTarget: 'qidahen-map-region-focus-name', hideOverlay: explained,
            content: `game-qidahen:tutorial.annual.steps.season-upkeep-${task.reason}` };
    }

    const current = state.sys.interaction?.current as { id?: string; data?: { multi?: unknown } } | null | undefined;
    const count = Math.min(choice.max ?? 1, candidates.length);
    const selected = candidates.slice(0, count);
    const payload = { ...(current?.id ? { interactionId: current.id } : {}),
        ...(current?.data?.multi ? { optionIds: selected } : { optionId: selected[0] }) };
    return { ...step, aiActions: [{ commandType: RESPONSE, playerId: state.core.factions[task.factionId].playerId,
        payload, waitForBoardSyncAfter: true }] };
}
