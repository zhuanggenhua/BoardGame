import { createFateInformationBoundarySystem } from './domain/informationBoundarySystem';
import type { LocalRuntimeControlResolver } from '../../engine/transport/followCurrentTurnPlayer';
import { createFatePostBattleChoiceSystems, createFatePostBattleInteraction, isFatePostBattleChoice } from './domain/postBattleChoice';
import { createFateRidingChoiceSystems, createFateRidingInteraction } from './domain/ridingChoice';
import { resolveFatePlayerAbility } from './domain/abilityRegistry';
import { createFatePrivacySystem } from './domain/privacySystem';
import type { ActionLogEntry, Command, GameEvent, MatchState } from '../../engine/types';
import { createBaseSystems, createGameEngine, createResolutionFrameSystem, createTimingOpportunitySystem } from '../../engine';
import { registerCriticalImageResolver } from '../../core';
import { FateDominationDomain } from './domain';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent } from './domain';
import { FATE_DOMINATION_AUDIO_CONFIG } from './audio.config';
import { fateDominationCriticalImageResolver } from './criticalImageResolver';
import { registerGameAiRuntime } from '../../engine/ai';
import { fateDominationAiRuntime } from './ai';

const ACTION_ALLOWLIST = [
    'SELECT_MASTER',
    'SELECT_SERVANT',
    'DEPLOY_MASTER',
    'SELECT_ATTACK_CARD',
    'CONFIRM_ATTACK',
    'INSPECT_CARD',
    'ADVANCE_PHASE',
    'MOVE_PLAYER',
    'PASS_ACTION',
    'RESOLVE_LOCATION',
    'PLAY_SKILL',
    'USE_COMMAND_SPELL',
] as const;

function formatActionLog({ command, state }: { command: Command; state: MatchState<unknown>; events: GameEvent[]; afterEventsRound: number }): ActionLogEntry | null {
    const core = state.core as FateDominationCore;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const actionSequence = state.sys.eventStream?.nextId ?? 0;
    const payload = command.payload as Record<string, unknown>;
    const skillId = typeof payload.skillId === 'string' ? payload.skillId : '';
    const isRidingChoice = command.type === 'PLAY_SKILL'
        && resolveFatePlayerAbility(core, command.playerId, skillId)?.effects.some(effect => effect.type === 'riding') === true;
    const labels: Record<string, string> = {
        SELECT_MASTER: `选择御主：${String(payload.masterId ?? '')}`,
        SELECT_SERVANT: '召唤从者',
        DEPLOY_MASTER: `部署至：${String(payload.locationId ?? '')}`,
        SELECT_ATTACK_CARD: '调整出牌选择',
        CONFIRM_ATTACK: '确认两张攻击牌',
        INSPECT_CARD: `查看卡牌：${String(payload.cardId ?? '')}`,
        ADVANCE_PHASE: `推进阶段：${core.phase}`,
        MOVE_PLAYER: `移动至：${String(payload.locationId ?? '')}`,
        PASS_ACTION: '结束行动',
        RESOLVE_LOCATION: `结算地点：${String(payload.locationId ?? '')}`,
        PLAY_SKILL: isRidingChoice ? '选择坐骑召唤手牌' : `发动技能：${String(payload.skillId ?? '')}`,
        USE_COMMAND_SPELL: '使用一枚令咒',
    };
    const text = labels[command.type];
    return text ? { id: `${command.type}-${command.playerId}-${timestamp}-${actionSequence}`, timestamp, actorId: command.playerId, kind: command.type, segments: [{ type: 'text', text }] } : null;
}

const [fateRidingChoiceGuard, fateRidingChoiceResolution] = createFateRidingChoiceSystems();
const systems = [
    fateRidingChoiceGuard,
    ...createBaseSystems<FateDominationCore>({
    actionLog: { commandAllowlist: ACTION_ALLOWLIST, formatEntry: formatActionLog },
    undo: { snapshotCommandAllowlist: ACTION_ALLOWLIST },
    }),
    ...createFatePostBattleChoiceSystems(),
    fateRidingChoiceResolution,
    createTimingOpportunitySystem(FateDominationDomain, { choiceRequestInteraction: ({opportunity}) => createFateRidingInteraction(opportunity) ?? createFatePostBattleInteraction(opportunity) }),
    createFatePrivacySystem(),
    createFateInformationBoundarySystem(),
    createResolutionFrameSystem<FateDominationCore>({
        shouldAutoCompleteFrame: ({ state, frame }) => frame.kind === 'fate:battle-resolution' && state.core.phase !== 'battle',
    }),
];

const resolveFateLocalRuntimeControlledPlayerId:LocalRuntimeControlResolver = ({state,fallbackPlayerId}) => isFatePostBattleChoice(state.sys.interaction.current) ? state.sys.interaction.current.playerId : fallbackPlayerId;

export const engineConfig = { ...createGameEngine<FateDominationCore, FateDominationCommand, FateDominationEvent>({
    domain: FateDominationDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 7,
    commandTypes: [...ACTION_ALLOWLIST],
}), resolveLocalRuntimeControlledPlayerId:resolveFateLocalRuntimeControlledPlayerId };

registerCriticalImageResolver('fate-domination', fateDominationCriticalImageResolver);
registerGameAiRuntime(fateDominationAiRuntime);

export default engineConfig;
export { FATE_DOMINATION_AUDIO_CONFIG as audioConfig };
