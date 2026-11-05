import { createAiLegalActionId, isAiActionOutcomeNoBenefit } from '../../engine/ai';
import type { AiDecisionContext, AiLegalAction, GameAiRuntime } from '../../engine/ai';
import type { AiActionOutcome } from '../../engine/ai/actionOutcome';
import type { Command, MatchState } from '../../engine/types';
import { createSeededRandom } from '../../engine/pipeline';
import { FATE_MASTERS, FATE_SERVANTS } from './data';
import { FateDominationDomain } from './domain';
import type { FateDominationCommand, FateDominationCore } from './domain';
import { FATE_LOCATION_ORDER } from './domain';
import { legalFateDeploymentSlots } from './domain/deployment';
import { resolveFateAttack } from './domain/attackSelection';
import { resolveFatePlayerAbility } from './domain/abilityRegistry';
import { visibleFatePower } from './domain/playerView';
import { isFateRidingChoice, validateFateRidingChoiceCommand } from './domain/ridingChoice';
import { isFatePostBattleChoice, isValidFatePostBattleResponse } from './domain/postBattleChoice';

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
    // 首轮选身份允许非当前席操作，不能用统一回合过滤将其删掉。
    if (core.round === 1 && core.phase === 'preparation') {
        for (const master of FATE_MASTERS) add('SELECT_MASTER', { masterId: master.id }, `选择${master.name}`, 'setup-select-character');
        for (const servant of FATE_SERVANTS) add('SELECT_SERVANT', { servantId: servant.id }, `召唤${servant.name}`, 'setup-select-character');
    }
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
    }
    return candidates;
}

/** 基础策略只读取当前席可见状态。该估值不是完整角色打法或隐藏信息搜索。 */
function utility(core: FateDominationCore, playerId: string): number {
    const player = core.players[playerId];
    const opponents = Object.values(core.players).filter(other => other.id !== playerId && other.locationId === player.locationId);
    const power = visibleFatePower(core, playerId, playerId);
    const opposition = Math.max(0, ...opponents.map(other => other.publicView?.power ?? visibleFatePower(core, other.id, playerId)));
    const competing = player.locationId === 'miyama' || player.locationId === 'shinto';
    return player.victoryPoints * 100 + player.mana * .8 + player.commandSpells * 6
        + (player.hand.length - player.activeAttackIds.length) * 1.2 + power * 2
        + (competing ? Math.max(-8, Math.min(8, power - opposition)) * 2 + 8 : 0);
}

export function projectFateAiActionOutcome({ context, action: candidate }: { context: AiDecisionContext; action: AiLegalAction }): AiActionOutcome | undefined {
    const state = context.visibleState as State;
    const command = { ...candidate.commands[0], playerId: context.playerId } as FateDominationCommand;
    if (command.type.startsWith('SYS_')) return undefined;
    if (!FateDominationDomain.validate(state, command).valid) return { status: 'rejected' };
    const events = FateDominationDomain.execute(state, command, createSeededRandom('fate-ai-visible-preview'));
    const next = events.reduce((core, event) => FateDominationDomain.reduce(core, event), state.core);
    const utilityDelta = utility(next, context.playerId) - utility(state.core, context.playerId);
    const hasOwnedFollowUp = events.some(event => event.type === 'FATE_RIDING_CHOICE_REQUESTED');
    // 使用次数本身不计收益，防止把空目标、无变化能力排在结束操作之前。
    const meaningful = events.some(event => event.type !== 'FATE_ABILITY_USED') && utilityDelta > 0;
    return { status: 'succeeded', utilityDelta, hasOwnedFollowUp, hasMeaningfulEffect: meaningful, eventTypes: events.map(event => event.type) };
}

export function chooseFateAiAction(context: AiDecisionContext) {
    const score = (candidate: AiLegalAction) => {
        if (candidate.kind === 'setup-select-character') return -100;
        if (candidate.kind === 'riding-cancel') return -200;
        if (candidate.kind === 'riding-confirm') {
            const payload = candidate.commands[0].payload as { optionIds: string[] };
            const player = (context.visibleState as State).core.players[context.playerId];
            return payload.optionIds.reduce((sum, id) => { const card = resolveFateAttack(player, id)?.definition; return sum + (card ? card.basePower * 2 - card.manaCost : 0); }, 0);
        }
        if (candidate.kind === 'post-battle-choice') return (candidate.commands[0].payload as { optionId: string }).optionId === 'restore' ? 10 : 0;
        if (['advance_phase', 'pass_action', 'resolve_location'].includes(candidate.kind)) return 0;
        const outcome = projectFateAiActionOutcome({ context, action: candidate });
        if (!outcome) return -120;
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
