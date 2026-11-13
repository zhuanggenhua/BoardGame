import type { MatchState, TutorialAiAction, TutorialStepSnapshot } from '../../engine/types';
import { isQidahenTacticCardPlayableForPendingBattle } from './domain/commands';
import { getQidahenPendingBattleActingFaction } from './domain/battleState';
import { getQidahenPendingTargetActionForCore, getQidahenPostBattleSelectionForCore } from './domain/interactionSelectionAccessors';
import { QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID } from './domain/interactionSources';
import { buildPendingTargetChoiceOptions } from './domain/pendingTargetChoiceOptions';
import { buildQidahenTurnChoice } from './domain/turnResolutionChoices';
import { getQidahenTurnResolutionFrame } from './domain/turnResolutionOpportunities';
import { getQidahenDispatchDraftTargets } from './domain/wheelDispatchDraft';
import type { QidahenCore, QidahenPendingTargetAction } from './domain/types';

const RESPONSE = 'SYS_INTERACTION_RESPOND';
const TEXT = 'game-qidahen:tutorial.annual.steps.';

/** 正式战术可能带有后续选择，仍由游戏交互本身确定合法输入。 */
const BATTLE_COMMANDS = [RESPONSE, 'SELECT_REGION', 'PLAY_TACTIC_CARD', 'PLAY_BATTLE_RESPONSE_EVENT_CARD',
    'TOGGLE_PINCER_ADVANCE_TROOP', 'RESOLVE_PINCER_ADVANCE', 'CANCEL_PINCER_ADVANCE',
    'RESOLVE_INFANTRY_CAVALRY_COMBINED', 'RESOLVE_INSTIGATE_DEFECTION', 'CANCEL_INSTIGATE_DEFECTION',
    'RESOLVE_WUZHEN_CHAOHA', 'CANCEL_WUZHEN_CHAOHA', 'RESOLVE_PENDING_ACTION'];

function pendingBattle(state: MatchState<QidahenCore>): QidahenPendingTargetAction | null {
    const pending = getQidahenPendingTargetActionForCore(state.core, state.sys.interaction?.current);
    return pending?.actionId === 'wheel-dispatch' ? pending : null;
}

function postBattle(state: MatchState<QidahenCore>) {
    const post = getQidahenPostBattleSelectionForCore(state.core, state.sys.interaction?.current);
    return post?.actionId === 'wheel-dispatch' ? post : null;
}

function actingPlayer(state: MatchState<QidahenCore>, pending: QidahenPendingTargetAction): string {
    return state.core.factions[getQidahenPendingBattleActingFaction(pending)].playerId;
}

function opponentResponse(state: MatchState<QidahenCore>, pending: QidahenPendingTargetAction, preferred: string[]): TutorialAiAction[] {
    const playerId = actingPlayer(state, pending);
    if (playerId === state.core.factions.ming.playerId) return [];
    const interaction = state.sys.interaction?.current;
    const data = interaction?.data as { sourceId?: string; options?: Array<{ id: string; disabled?: boolean }> } | undefined;
    const matchingPrompt = data?.sourceId === QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID && interaction?.playerId === playerId;
    const options = matchingPrompt ? data.options ?? [] : buildPendingTargetChoiceOptions(state.core, pending);
    const optionId = preferred.find(id => options.some(option => option.id === id && !('disabled' in option && option.disabled)));
    if (!optionId) throw new Error(`年度教程无法为对手当前战斗请求选择合法响应: ${pending.battleStep}`);
    return [{ commandType: RESPONSE, playerId, payload: { ...(matchingPrompt ? { interactionId: interaction!.id } : {}), optionId }, waitForBoardSyncAfter: true }];
}

/** 对应真实交互的条件步骤：友军调度和全灭不伪造一场战斗或战后占领。 */
export function validateAnnualDispatchTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): boolean | undefined {
    const pending = pendingBattle(state);
    const playerId = state.core.factions.ming.playerId;
    const current = state.sys.tutorial.step?.id === step.id;
    switch (step.id) {
        case 'dispatch-target': {
            const phase = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn.step;
            return phase === 'dispatch-target' || phase === 'dispatch-troops';
        }
        case 'defender-response':
            return current || Boolean(pending?.battleStep === 'defender-declaration' && actingPlayer(state, pending) !== playerId);
        case 'tactic-card': return false;
        case 'battle-roll':
        case 'battle-roll-followup':
            return Boolean(pending && (pending.battleStep === 'tactics' || pending.battleStep == null)
                && actingPlayer(state, pending) === playerId);
        case 'opponent-retreat':
        case 'opponent-retreat-followup':
            return current || Boolean(pending?.battleStep === 'retreat' && actingPlayer(state, pending) !== playerId);
        case 'player-retreat':
        case 'player-retreat-followup':
            return Boolean(pending?.battleStep === 'retreat' && actingPlayer(state, pending) === playerId);
        case 'occupy': {
            const post = postBattle(state);
            return Boolean(post && state.core.factions[post.attackerFactionId].playerId === playerId);
        }
        default: return undefined;
    }
}

/** 对局只保留一个战斗节点，战术牌可选；开始战斗后等待真实骰子动画。 */
export function createAnnualBattleTutorialSteps(avoidOverlapSelectors: string[]): TutorialStepSnapshot[] {
    return [
        { id: 'defender-response', content: `${TEXT}defender-response-dynamic`, infoStep: true, highlightTarget: 'qidahen-raid-intent',
            position: 'left', avoidOverlapSelectors, autoAdvanceAfterAi: false },
        { id: 'battle-roll', content: `${TEXT}battle-roll-dynamic`, requireAction: true, hideActionHint: true,
            highlightTarget: 'qidahen-raid-intent', position: 'left', avoidOverlapSelectors,
            allowedCommands: BATTLE_COMMANDS, advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'fight' } }, { type: 'QIDAHEN_BATTLE_ROLLED' }], waitForAnimation: true },
        { id: 'opponent-retreat', content: `${TEXT}opponent-retreat-dynamic`, infoStep: true, highlightTarget: 'qidahen-raid-intent',
            position: 'left', avoidOverlapSelectors, autoAdvanceAfterAi: false },
        { id: 'player-retreat', content: `${TEXT}player-retreat`, requireAction: true, hideActionHint: true,
            highlightTarget: 'qidahen-raid-intent', position: 'left', avoidOverlapSelectors, allowedCommands: [RESPONSE] },
        { id: 'battle-roll-followup', content: `${TEXT}battle-roll-dynamic`, requireAction: true, hideActionHint: true,
            highlightTarget: 'qidahen-raid-intent', position: 'left', avoidOverlapSelectors,
            allowedCommands: BATTLE_COMMANDS, advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'fight' } }, { type: 'QIDAHEN_BATTLE_ROLLED' }], waitForAnimation: true },
        { id: 'opponent-retreat-followup', content: `${TEXT}opponent-retreat-dynamic`, infoStep: true, highlightTarget: 'qidahen-raid-intent',
            position: 'left', avoidOverlapSelectors, autoAdvanceAfterAi: false },
        { id: 'player-retreat-followup', content: `${TEXT}player-retreat`, requireAction: true, hideActionHint: true,
            highlightTarget: 'qidahen-raid-intent', position: 'left', avoidOverlapSelectors, allowedCommands: [RESPONSE] },
        { id: 'occupy', content: `${TEXT}post-battle-dynamic`, requireAction: true, hideActionHint: true,
            highlightTarget: 'qidahen-post-battle-selection', position: 'left', compactTooltipWidth: 260,
            avoidOverlapSelectors, allowedCommands: [RESPONSE, 'SELECT_REGION'] },
    ];
}

/** 只使用正式 frame 和战斗状态；不将推荐对象变成唯一本轮合法输入。 */
export function resolveAnnualDispatchTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): TutorialStepSnapshot {
    const frame = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn;
    if (['dispatch-source', 'dispatch-troops', 'dispatch-target'].includes(step.id) && frame
        && ['dispatch-source', 'dispatch-troops', 'dispatch-target'].includes(frame.step)) {
        const choice = buildQidahenTurnChoice(state.core, frame);
        if (!choice) return step;
        const candidates = choice.candidates.filter(candidate => !candidate.disabled);
        if (frame.step === 'dispatch-source') {
            const regionId = candidates.find(candidate => candidate.id === 'city-region-15')?.id ?? candidates[0]?.id;
            return { ...step, content: `${TEXT}dispatch-source-dynamic`, allowedTargets: undefined,
                highlightTarget: regionId ? `qidahen-map-region-focus-${regionId}` : undefined,
                tooltipAnchorTarget: regionId ? 'qidahen-map-region-focus-name' : undefined };
        }
        if (frame.step === 'dispatch-troops') {
            const regionId = frame.sourceRegionId;
            const piece = candidates.find(candidate => regionId && getQidahenDispatchDraftTargets(state.core, frame.factionId, regionId, [candidate.id]).length > 0);
            const token = piece && state.core.mapTokens.find(item => item.pieceId === piece.id && item.regionId === regionId);
            return { ...step, content: `${TEXT}dispatch-troops-dynamic`, allowedTargets: undefined, recommendedTargets: piece ? [piece.id] : undefined,
                highlightTarget: regionId ? `qidahen-map-region-focus-${regionId}` : undefined,
                tooltipAnchorTarget: token ? `qidahen-map-token-${token.id}` : 'qidahen-map-region-focus-name',
                ...(step.id === 'dispatch-target' ? { advanceOnEvents: undefined } : {}) };
        }
        const regionId = candidates.find(candidate => candidate.id === 'city-region-7')?.id
            ?? candidates.find(candidate => candidate.id !== 'back')?.id;
        return { ...step, content: `${TEXT}dispatch-target-dynamic`, allowedTargets: undefined, advanceOnEvents: undefined,
            highlightTarget: regionId ? `qidahen-map-region-focus-${regionId}` : undefined,
            tooltipAnchorTarget: regionId ? 'qidahen-map-region-focus-name' : undefined };
    }

    const pending = pendingBattle(state);
    if (step.id === 'defender-response') return { ...step,
        aiActions: pending?.battleStep === 'defender-declaration' ? opponentResponse(state, pending, ['defender-fight']) : undefined };
    if (step.id === 'opponent-retreat' || step.id === 'opponent-retreat-followup') return { ...step,
        aiActions: pending?.battleStep === 'retreat' ? opponentResponse(state, pending, ['rear-guard', 'rout']) : undefined };
    if ((step.id === 'battle-roll' || step.id === 'battle-roll-followup') && pending) {
        const playableTactic = state.core.handCards.find(card => card.faction === pending.attackerFactionId && card.cardKind === 'tactic'
            && card.status !== 'disabled' && isQidahenTacticCardPlayableForPendingBattle(state.core, card, pending, 'attacker'));
        return { ...step, content: `${TEXT}${playableTactic ? 'battle-roll-dynamic' : 'battle-roll-no-tactic'}`,
            ...(playableTactic ? { highlightTarget: `qidahen-hand-card-${playableTactic.id}`,
                tooltipAnchorTarget: `qidahen-hand-guide-${playableTactic.id}`, tooltipArrow: 'anchor' as const, position: 'top' as const } : {}),
            allowedTargets: undefined, allowedCommands: BATTLE_COMMANDS };
    }
    if (step.id === 'player-retreat' || step.id === 'player-retreat-followup' || step.id === 'occupy') return { ...step, allowedTargets: undefined };
    return step;
}
