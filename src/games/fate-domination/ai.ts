import { createAiLegalActionId, isAiActionOutcomeNoBenefit } from '../../engine/ai';
import type { AiDecisionContext, AiLegalAction, GameAiRuntime } from '../../engine/ai';
import type { AiActionOutcome } from '../../engine/ai/actionOutcome';
import type { Command, MatchState } from '../../engine/types';
import { createSeededRandom } from '../../engine/pipeline';
import { FateDominationDomain } from './domain';
import type { FateDominationCommand, FateDominationCore } from './domain';
import { FATE_LOCATION_ORDER } from './domain';
import { legalFateDeploymentSlots } from './domain/deployment';
import { resolveFatePlayerAbility } from './domain/abilityRegistry';
import { applyFateBattleScoreAdjustment, fateBattleOpponents, fatePostBattleScoreEvents } from './domain/battleAwards';
import { fatePreBattleDefeatEvents } from './domain/preBattleEffects';
import { visibleFatePower } from './domain/playerView';
import { calculateFateRidingSelectionCost, fateRidingCandidates, isFateRidingChoice, validateFateRidingChoiceCommand } from './domain/ridingChoice';
import { isFatePostBattleChoice, isValidFatePostBattleResponse } from './domain/postBattleChoice';
import { isFateChariotChoice, validFateChariotResponse } from './domain/chariotChoice';
import { isFateFieldAttackChoice, validFateFieldAttackResponse } from './domain/battlefieldAttacks';
import { fateChariotTargets } from './domain/chariotEvents';
import { FATE_INVESTIGATION_KEEP, isFateInvestigationChoice, validFateInvestigationResponse } from './domain/investigationChoice';
import { FATE_SERVANTS } from './data';
import type { FateDominationEvent, PlayerState } from './domain/types';
import { canPlanFateFinalBattle, fatePenultimateBattleUtility } from './aiEndgame';

type State = MatchState<FateDominationCore>;
const action = (type: string, payload: object, label: string, kind = type.toLowerCase()): AiLegalAction => ({
    actionId: createAiLegalActionId(kind, JSON.stringify(payload)), kind, label, commands: [{ type, payload }],
});

/** 枚举组合，不截掉策略不喜欢的合法候选；上限来自骑乘正式规则。 */
function subsets(ids: string[], max: number): string[][] {
    const result: string[][] = [[]];
    for (const id of ids) for (const prior of [...result]) if (prior.length < max) result.push([...prior, id]);
    return result;
}

export function buildFateAiLegalActions({ playerId, state: raw }: { playerId: string; state: MatchState<unknown> }): AiLegalAction[] {
    const state = raw as State;
    const { core } = state;
    const player = core.players[playerId];
    if (!player || player.eliminated || state.sys.gameover || core.phase === 'complete') return [];
    const current = state.sys.interaction.current;
    if (current) {
        if (current.playerId !== playerId) return [];
        if (isFateFieldAttackChoice(current)) return current.data.options.map(option =>
            action('SYS_INTERACTION_RESPOND', { interactionId: current.id, optionId: option.id }, option.label, 'field-attack-choice'),
        ).filter(candidate => validFateFieldAttackResponse(state, { ...candidate.commands[0], playerId } as Command));
        if(isFateInvestigationChoice(current))return current.data.options.filter(option=>!option.disabled).map(option=>
            action('SYS_INTERACTION_RESPOND',{interactionId:current.id,optionId:option.id},option.label,'investigation-choice')
        ).filter(candidate=>validFateInvestigationResponse(state,{...candidate.commands[0],playerId} as Command));
        if (isFateChariotChoice(current)) return current.data.options.filter(option=>!option.disabled).map(option=>
            action('SYS_INTERACTION_RESPOND',{interactionId:current.id,optionId:option.id},`选择事件：${option.label}`,'chariot-choice')
        ).filter(candidate=>validFateChariotResponse(state,{...candidate.commands[0],playerId} as Command));
        if (isFateRidingChoice(current)) {
            const ids = current.data.options.filter(option => !option.disabled).map(option => option.id);
            const choices = subsets(ids, 3).map(optionIds => action('SYS_INTERACTION_RESPOND', { interactionId: current.id, optionIds }, `骑乘打出${optionIds.length}张`, 'riding-confirm'));
            choices.push(action('SYS_INTERACTION_CANCEL', { interactionId: current.id }, '取消骑乘', 'riding-cancel'));
            return choices.filter(candidate => !validateFateRidingChoiceCommand(state, { ...candidate.commands[0], playerId } as Command));
        }
        if (isFatePostBattleChoice(current)) return current.data.options.filter(option => !option.disabled).map(option =>
            action('SYS_INTERACTION_RESPOND', { interactionId: current.id, optionId: option.id }, option.label, 'post-battle-choice'),
        ).filter(candidate => isValidFatePostBattleResponse(state, { ...candidate.commands[0], playerId } as Command));
        return [];
    }
    if (state.sys.interaction.queue.length || core.battleResolution?.step === 'after-battle') return [];
    const candidates: AiLegalAction[] = [];
    const add = (type: FateDominationCommand['type'], payload: object, label: string, kind?: string) => {
        const candidate = action(type, payload, label, kind);
        if (FateDominationDomain.validate(state, { ...candidate.commands[0], playerId } as FateDominationCommand).valid) candidates.push(candidate);
    };
    // 电脑沿用开局分配的身份，等轮到自己时再完成准备。
    add('ADVANCE_PHASE', {}, '推进阶段');
    add('PASS_ACTION', {}, '结束行动');
    for (const locationId of FATE_LOCATION_ORDER) {
        for(const deploymentSlot of legalFateDeploymentSlots(core,locationId))add('DEPLOY_MASTER', { locationId, deploymentSlot }, `部署至${core.battlefield[locationId].label}`);
        add('MOVE_PLAYER', { locationId }, `移动至${core.battlefield[locationId].label}`);
        add('RESOLVE_LOCATION', { locationId }, `结算${core.battlefield[locationId].label}`);
        add('USE_COMMAND_SPELL', { effect: 'move', targetLocationId: locationId }, '令咒移动');
    }
    for (const effect of ['mana', 'battle']) add('USE_COMMAND_SPELL', { effect }, effect === 'mana' ? '令咒恢复魔力' : '令咒强化战斗');
    const ids = [...player.hand.map(card => card.id), ...player.skills.map(skill => skill.id)];
    if (core.phase === 'action' && core.currentPlayerId === playerId && !player.normalAttackPlayed) {
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
            const cardIds = [ids[i], ids[j]];
            for (let mask = 0; mask < 4; mask++) add('CONFIRM_ATTACK', {
                cardIds, faceDownIds: cardIds.filter((_, index) => Boolean(mask & (1 << index))), round: core.round,
            }, '原子确认两张攻击');
        }
    }
    const sources = [...player.skills.map(skill => skill.id), ...player.activeAttackIds];
    for (const skillId of new Set(sources)) {
        add('PLAY_SKILL', { skillId }, '发动能力');
        if (resolveFatePlayerAbility(core, playerId, skillId)?.effects.some(effect => effect.type === 'movement'))
            for (const targetLocationId of FATE_LOCATION_ORDER) add('PLAY_SKILL', { skillId, targetLocationId }, '发动移动能力');
        if (resolveFatePlayerAbility(core, playerId, skillId)?.effects.some(effect => effect.type === 'replace-event'))
            for (const targetCardId of fateChariotTargets(core,playerId)) add('PLAY_SKILL',{skillId,targetCardId},'替换事件牌');
        if (resolveFatePlayerAbility(core, playerId, skillId)?.effects.some(effect => effect.type === 'investigate-hand'))
            for (const targetPlayerId of core.playerIds) add('PLAY_SKILL',{skillId,targetPlayerId},'调查手牌');
    }
    return candidates;
}

function visibleOppositionPower(core: FateDominationCore, playerId: string, floor = 0): number {
    const location = core.players[playerId].locationId;
    return Math.max(floor, ...Object.values(core.players)
        .filter(other => other.id !== playerId && other.locationId === location && !other.eliminated && !other.defeatMarkers?.length)
        .map(other => other.publicView?.power ?? visibleFatePower(core, other.id, playerId)));
}

function visibleRivalPowerDelta(before: FateDominationCore, after: FateDominationCore, rivalId: string, viewerId: string): number {
    const player = after.players[rivalId];
    const { playedCards, playedSkills } = player.publicView!;
    const hand = playedCards.filter(card => card.definitionId !== 'hidden');
    const servant = FATE_SERVANTS.find(item => playedSkills.some(card => item.skillCards?.some(skill => skill.id === card.id.split(':')[0])));
    const skills = playedSkills.flatMap(card => {
        const definition = servant?.skillCards?.find(skill => skill.id === card.id.split(':')[0]);
        return definition ? [{ ...definition, id: card.id }] : [];
    });
    const activeAttackIds = hand.map(card => card.id);
    const calculate = (core: FateDominationCore) => visibleFatePower({ ...core, players: { ...core.players, [rivalId]: {
        ...core.players[rivalId], hand, activeAttackIds, skills, activeSkills: skills.map(skill => skill.id),
        servantId: servant?.id ?? player.servantId, faceDownAttackIds: [],
    } } }, rivalId, viewerId);
    // 增量沿用战斗计算。对手只重建已明置的牌，不读取手牌或暗置实例。
    return calculate(after) - calculate(before);
}

// 并列首位的玩家平分战果，单改事件战果不会拉开并列双方差距。
function chariotRewardDirection(core: FateDominationCore, playerId: string): number {
    return Math.sign(visibleFatePower(core, playerId, playerId) - visibleOppositionPower(core, playerId, -Infinity));
}

function fateAiResourceUtility(player: PlayerState) {
    return player.mana * .8 + player.commandSpells * 6 + (player.hand.length - player.activeAttackIds.length) * 1.2;
}

/** 基础策略只读取当前席可见状态。 */
function utility(core: FateDominationCore, playerId: string): number {
    const player = core.players[playerId];
    const competing = player.locationId === 'miyama' || player.locationId === 'shinto';
    const power = competing ? visibleFatePower(core, playerId, playerId) : 0;
    const opposition = competing ? visibleOppositionPower(core, playerId) : 0;
    return player.victoryPoints * 100 + fateAiResourceUtility(player) + power * 2
        + (competing ? Math.max(-8, Math.min(8, power - opposition)) * 2 + 8 : 0);
}

function ridingAttackUtility(context: AiDecisionContext, core: FateDominationCore, skillId: string, cardIds: string[]): number {
    const { playerId } = context;
    const manaSpent = calculateFateRidingSelectionCost(core, playerId, cardIds);
    if (manaSpent === undefined || manaSpent > core.players[playerId].mana) return -Infinity;
    const after = FateDominationDomain.reduce(core, {
        type: 'FATE_RIDING_CARDS_PLAYED', timestamp: 0,
        payload: { playerId, skillId, cardIds, manaSpent },
    });
    return utility(after, playerId) - utility(core, playerId) + bestAttackMovementUtility(context, after, cardIds);
}

function bestRidingAttackUtility(context: AiDecisionContext, core: FateDominationCore, skillId: string): number {
    const selectable = fateRidingCandidates(core, context.playerId).map(card => card.id);
    return subsets(selectable, 3).reduce((best, cardIds) => Math.max(best, ridingAttackUtility(context, core, skillId, cardIds)), 0);
}

function bestAttackMovementUtility(context: AiDecisionContext, next: FateDominationCore, cardIds: string[]): number {
    const { playerId } = context;
    const location = next.players[playerId].locationId;
    // 工房和侦察不按攻击威力结算，只为能合法进入战斗的后续移动计分。
    if (location !== 'workshop' && location !== 'recon') return 0;
    const visibleState = { ...context.visibleState, core: next };
    let best = 0;
    for (const skillId of cardIds) {
        const ability = resolveFatePlayerAbility(next, playerId, skillId);
        if (!ability?.effects.some(effect => effect.type === 'movement')) continue;
        for (const targetLocationId of FATE_LOCATION_ORDER) {
            const candidate = action('PLAY_SKILL', { skillId, targetLocationId }, '发动移动能力');
            const outcome = projectFateAiActionOutcome({ context: { ...context, visibleState }, action: candidate });
            if (outcome?.status === 'succeeded') best = Math.max(best, outcome.utilityDelta ?? 0);
        }
    }
    return best;
}

function bestFateAttackUtility(context: AiDecisionContext): number {
    let best = 0;
    for (const action of context.legalActions) {
        if (action.commands[0].type !== 'CONFIRM_ATTACK') continue;
        const outcome = projectFateAiActionOutcome({ context, action });
        if (outcome?.status === 'succeeded') best = Math.max(best, outcome.utilityDelta ?? 0);
    }
    return best;
}

function applyFateAiPreview(before: FateDominationCore, events: readonly FateDominationEvent[], playerId: string) {
    const next = events.reduce((core, event) => FateDominationDomain.reduce(core, event), before);
    const affectsRivalPower = events.some(event =>
        (event.type === 'PLAYER_MOVED' && event.payload.claimBattlefieldTerrain)
        || (event.type === 'FATE_RULE_MODIFIER_ATTACHED' && event.payload.modifier.kind === 'power-transform'
            && event.payload.modifier.target === 'opponents-at-location'));
    if (!affectsRivalPower) return next;

    const players = { ...next.players };
    for (const rivalId of fateBattleOpponents(next, playerId)) {
        const rival = players[rivalId];
        if (!rival.publicView) continue;
        const delta = visibleRivalPowerDelta(before, next, rivalId, playerId);
        players[rivalId] = { ...rival, publicView: { ...rival.publicView, power: rival.publicView.power + delta } };
    }
    return { ...next, players };
}

function previewFateBattleBuffs(state: State, core: FateDominationCore, playerId: string) {
    const player = core.players[playerId];
    const defeats = fatePreBattleDefeatEvents(core, { timestamp: 0, sourceCommandType: 'PASS_ACTION' });
    let battle: FateDominationCore = { ...applyFateAiPreview(core, defeats, playerId), phase: 'battle' };
    const random = createSeededRandom('fate-ai-battle-preview');
    for (const skillId of [...player.activeSkills, ...player.activeAttackIds]) {
        const ability = resolveFatePlayerAbility(battle, playerId, skillId);
        if (ability?.trigger !== 'battle' || ability.activationCost || !ability.effects.every(effect =>
            effect.type === 'power-transform' || effect.type === 'battle-win-reward')) continue;
        const command = { type: 'PLAY_SKILL' as const, playerId, payload: { skillId } };
        const snapshot = { ...state, core: battle };
        if (!FateDominationDomain.validate(snapshot, command).valid) continue;
        battle = applyFateAiPreview(battle, FateDominationDomain.execute(snapshot, command, random), playerId);
    }
    return battle;
}

export function projectFateAiActionOutcome({ context, action: candidate }: { context: AiDecisionContext; action: AiLegalAction }): AiActionOutcome | undefined {
    const state = context.visibleState as State;
    const command = { ...candidate.commands[0], playerId: context.playerId } as FateDominationCommand;
    if (command.type.startsWith('SYS_')) return undefined;
    if (!FateDominationDomain.validate(state, command).valid) return { status: 'rejected' };
    const ability = command.type === 'PLAY_SKILL' ? resolveFatePlayerAbility(state.core, context.playerId, command.payload.skillId) : undefined;
    if(command.type==='PLAY_SKILL'){
        if (ability?.effects.some(effect => effect.type === 'replace-event')) {
            const location = state.core.players[context.playerId].locationId;
            const discarded = location === 'miyama' || location === 'shinto'
                ? state.core.currentEvents[location].find(card => card.id === command.payload.targetCardId) : undefined;
            if (!discarded) return { status: 'rejected' };
            // 只按当前公开事件估值。实际抽取由权威端在提交后处理。
            const rewardDirection = chariotRewardDirection(state.core, context.playerId);
            return { status: 'succeeded', utilityDelta: rewardDirection * (3 - discarded.victoryPoints) - 3,
                hasOwnedFollowUp: true, eventTypes: ['FATE_CHARIOT_DRAWN'] };
        }
        const draw=ability?.effects.find(effect=>effect.type==='draw-cards');
        if(draw?.type==='draw-cards'){
            const player=state.core.players[context.playerId];
            const drawable=(player.publicView?.deckCount??player.deck.length)+player.discard.length;
            const count=Math.min(draw.count,drawable),cost=ability?.activationCost??0;
            return {status:'succeeded',utilityDelta:count*1.2-cost*.8,hasMeaningfulEffect:count>0,eventTypes:['FATE_CARDS_DRAWN']};
        }
    }
    if(command.type==='PLAY_SKILL' && ability?.effects.some(effect=>effect.type==='investigate-hand')){
        const target=command.payload.targetPlayerId ? state.core.players[command.payload.targetPlayerId] : undefined;
        const count=target?.publicView?.handCount ?? (target ? target.hand.length-target.activeAttackIds.length : 0);
        const useful=Boolean(target && target.id!==context.playerId && count>0);
        return {status:'succeeded',utilityDelta:useful?1:0,hasOwnedFollowUp:true,hasMeaningfulEffect:useful,eventTypes:['FATE_INVESTIGATION_VIEWED']};
    }
    const events = FateDominationDomain.execute(state, command, createSeededRandom('fate-ai-visible-preview'));
    const next = applyFateAiPreview(state.core, events, context.playerId);
    if (command.type === 'PLAY_SKILL' && ability) {
        const { playerId } = context;
        const { skillId } = command.payload;
        const meta = { timestamp: 0, sourceCommandType: command.type };
        if (ability.effects.some(effect => effect.type === 'pre-battle-defeat-without-special')) {
            // 以已公开的特殊属性做当前局面预测。其他席还可能在行动结束前出牌或移动。
            const predictions = fatePreBattleDefeatEvents(next, meta).filter(event => event.payload.sourceId === skillId);
            const afterBattleStart = predictions.reduce((core, event) => FateDominationDomain.reduce(core, event), next);
            const newlyDefeated = Object.values(afterBattleStart.players).filter(player =>
                player.defeatMarkers.length > 0 && next.players[player.id].defeatMarkers.length === 0).length;
            return { status: 'succeeded', utilityDelta: utility(afterBattleStart, playerId) - utility(state.core, playerId) + newlyDefeated * 4,
                hasMeaningfulEffect: newlyDefeated > 0, eventTypes: events.map(event => event.type) };
        }
        if (ability.effects.some(effect => effect.type === 'post-battle-score-per-opponent')) {
            const won = !next.players[playerId].defeatMarkers.length && chariotRewardDirection(next, playerId) >= 0;
            const predictions = fatePostBattleScoreEvents(next, won ? [{ playerId, status: 'representative-win' }] : [], meta)
                .filter(event => event.payload.sourceId === skillId);
            const afterBattle = predictions.reduce(applyFateBattleScoreAdjustment, next);
            const bestRivalScore = (core: FateDominationCore) => Math.max(0, ...Object.values(core.players)
                .filter(player => playerId !== player.id && !player.eliminated).map(player => player.victoryPoints));
            const rivalDelta = bestRivalScore(state.core) - bestRivalScore(afterBattle);
            return { status: 'succeeded', utilityDelta: utility(afterBattle, playerId) - utility(state.core, playerId) + rivalDelta * 100,
                hasMeaningfulEffect: predictions.length > 0, eventTypes: events.map(event => event.type) };
        }
    }
    const actingPlayer = state.core.players[context.playerId];
    const eventTypes = events.map(event => event.type);
    let utilityDelta = utility(next, context.playerId) - utility(state.core, context.playerId);
    const planFinalBattle = (command.type === 'CONFIRM_ATTACK' || command.type === 'USE_COMMAND_SPELL')
        && canPlanFateFinalBattle(state.core, context.playerId);
    if (planFinalBattle) {
        const value = (core: FateDominationCore) => fatePenultimateBattleUtility(previewFateBattleBuffs(state, core, context.playerId), context.playerId)
            + fateAiResourceUtility(core.players[context.playerId]);
        utilityDelta = value(next) - value(state.core);
    }
    if (command.type === 'CONFIRM_ATTACK') {
        const confirmed = events.find(event => event.type === 'ATTACKS_CONFIRMED');
        const movement = confirmed ? bestAttackMovementUtility(context, next, confirmed.payload.cardIds) : 0;
        const rider = next.players[context.playerId];
        const riding = rider.activeSkills.find(skillId => !actingPlayer.activeSkills.includes(skillId)
            && resolveFatePlayerAbility(next, rider.id, skillId)?.effects.some(effect => effect.type === 'riding'));
        const canRide = riding && FateDominationDomain.validate({ ...state, core: next }, {
            type: 'PLAY_SKILL', playerId: rider.id, payload: { skillId: riding },
        }).valid;
        // 只估已看见且付得起的手牌，同一次入场收益不重复计入。
        utilityDelta += Math.max(movement, canRide ? bestRidingAttackUtility(context, next, riding) : 0);
    }
    if (command.type === 'PLAY_SKILL' && eventTypes.includes('FATE_RIDING_CHOICE_REQUESTED')) {
        const followUp = bestRidingAttackUtility(context, next, command.payload.skillId);
        return { status: 'succeeded', utilityDelta: utilityDelta + followUp,
            hasOwnedFollowUp: followUp > 0, hasMeaningfulEffect: followUp > 0, eventTypes };
    }
    if (command.type === 'USE_COMMAND_SPELL' && command.payload.effect === 'mana'
        && (state.core.round === 11 || planFinalBattle) && !actingPlayer.normalAttackPlayed
        && (actingPlayer.locationId === 'miyama' || actingPlayer.locationId === 'shinto')
        && next.players[context.playerId].mana > actingPlayer.mana) {
        // 收官时把付出令咒与紧接着能打出的合法攻击一起估值。
        const visibleState = { ...state, core: next };
        const legalActions = buildFateAiLegalActions({ state: visibleState, playerId: context.playerId });
        const fundedUtility = utilityDelta + bestFateAttackUtility({ ...context, visibleState, legalActions });
        if (fundedUtility > bestFateAttackUtility(context)) {
            return { status: 'succeeded', utilityDelta: fundedUtility, hasMeaningfulEffect: true, eventTypes };
        }
    }
    // 使用次数本身不计收益，防止把空目标、无变化能力排在结束操作之前。
    const meaningful = events.some(event => event.type !== 'FATE_ABILITY_USED') && utilityDelta > 0;
    return { status: 'succeeded', utilityDelta, hasMeaningfulEffect: meaningful, eventTypes };
}

export function chooseFateAiAction(context: AiDecisionContext) {
    const attackRequired = !context.legalActions.some(candidate => candidate.kind === 'pass_action');
    const score = (candidate: AiLegalAction) => {
        if (candidate.kind === 'riding-cancel') return -200;
        if (candidate.kind === 'riding-confirm') {
            const payload = candidate.commands[0].payload as { optionIds: string[] };
            const { core, sys } = context.visibleState as State;
            const choice = sys.interaction.current;
            if (!isFateRidingChoice(choice)) return -120;
            return ridingAttackUtility(context, core, choice.data.fateContext.skillId, payload.optionIds);
        }
        if (candidate.kind === 'post-battle-choice') return (candidate.commands[0].payload as { optionId: string }).optionId === 'restore' ? 10 : 0;
        if (candidate.kind === 'field-attack-choice') return (candidate.commands[0].payload as { optionId: string }).optionId === 'place' ? 10 : 0;
        if (candidate.kind === 'chariot-choice') {
            const { core, sys } = context.visibleState as State;
            const choice = sys.interaction.current;
            if (!isFateChariotChoice(choice)) return -120;
            const { optionId } = candidate.commands[0].payload as { optionId: string };
            const card = choice.data.fateContext.offered.find(event => event.id === optionId);
            if (!card) return -120;
            return chariotRewardDirection(core, context.playerId) * card.victoryPoints;
        }
        if(candidate.kind==='investigation-choice'){
            const choice=(context.visibleState as State).sys.interaction.current;
            if(!isFateInvestigationChoice(choice))return -120;
            const selected=(candidate.commands[0].payload as {optionId:string}).optionId;
            return selected===FATE_INVESTIGATION_KEEP?0:choice.data.fateContext.targetPlayerId===context.playerId?-1:3;
        }
        if (['advance_phase', 'pass_action', 'resolve_location'].includes(candidate.kind)) return 0;
        const outcome = projectFateAiActionOutcome({ context, action: candidate });
        if (!outcome) return -120;
        if (attackRequired && candidate.kind === 'confirm_attack' && outcome.status === 'succeeded') {
            // 必须出牌且所有组合都消耗资源时，仍按实际代价在合法组合间比较。
            return outcome.utilityDelta ?? 0;
        }
        if (isAiActionOutcomeNoBenefit(outcome, { treatNonPositiveUtilityAsNoBenefit: true })) return -120;
        return (outcome.utilityDelta ?? 0) + (outcome.hasOwnedFollowUp ? 3 : 0);
    };
    const best = context.legalActions.map(candidate => ({ candidate, score: score(candidate) })).sort((a, b) => b.score - a.score)[0];
    return best ? { actionId: best.candidate.actionId } : null;
}

export const fateDominationAiRuntime: GameAiRuntime = {
    gameId: 'fate-domination', buildLegalActions: buildFateAiLegalActions,
    projectActionOutcome: projectFateAiActionOutcome,
    resolveOnlineDecisionVisibility: () => 'private-required',
    resolveCurrentDecisionPlayerId: ({ state, fallbackPlayerId }) => state.sys.interaction.current?.playerId ?? fallbackPlayerId,
    localPolicies: { baseline: { id: 'baseline', decide: chooseFateAiAction } }, defaultLocalPolicyId: 'baseline', defaultMinimumActionDelayMs: 850,
};
