import type { ActionLogEntry, Command, GameEvent, MatchState } from '../../engine/types';
import { createBaseSystems, createGameEngine } from '../../engine';
import { registerCriticalImageResolver } from '../../core';
import { FateDominationDomain } from './domain';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent } from './domain';
import { FATE_DOMINATION_AUDIO_CONFIG } from './audio.config';
import { fateDominationCriticalImageResolver } from './criticalImageResolver';

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
] as const;

function formatActionLog({ command, state }: { command: Command; state: MatchState<unknown>; events: GameEvent[]; afterEventsRound: number }): ActionLogEntry | null {
    const core = state.core as FateDominationCore;
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;
    const actionSequence = state.sys.eventStream?.nextId ?? 0;
    const payload = command.payload as Record<string, unknown>;
    const labels: Record<string, string> = {
        SELECT_MASTER: `选择御主：${String(payload.masterId ?? '')}`,
        SELECT_SERVANT: `选择从者：${String(payload.servantId ?? '')}`,
        DEPLOY_MASTER: `部署至：${String(payload.locationId ?? '')}`,
        SELECT_ATTACK_CARD: `选择攻击牌：${String(payload.cardId ?? '')}`,
        CONFIRM_ATTACK: '确认两张攻击牌',
        INSPECT_CARD: `查看卡牌：${String(payload.cardId ?? '')}`,
        ADVANCE_PHASE: `推进阶段：${core.phase}`,
        MOVE_PLAYER: `移动至：${String(payload.locationId ?? '')}`,
        PASS_ACTION: '结束行动',
        RESOLVE_LOCATION: `结算地点：${String(payload.locationId ?? '')}`,
        PLAY_SKILL: `发动技能：${String(payload.skillId ?? '')}`,
    };
    const text = labels[command.type];
    return text ? { id: `${command.type}-${command.playerId}-${timestamp}-${actionSequence}`, timestamp, actorId: command.playerId, kind: command.type, segments: [{ type: 'text', text }] } : null;
}

const systems = createBaseSystems<FateDominationCore>({
    actionLog: { commandAllowlist: ACTION_ALLOWLIST, formatEntry: formatActionLog },
    undo: { snapshotCommandAllowlist: ACTION_ALLOWLIST },
});

export const engineConfig = createGameEngine<FateDominationCore, FateDominationCommand, FateDominationEvent>({
    domain: FateDominationDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 7,
    commandTypes: [...ACTION_ALLOWLIST],
});

registerCriticalImageResolver('fate-domination', fateDominationCriticalImageResolver);

export default engineConfig;
export { FATE_DOMINATION_AUDIO_CONFIG as audioConfig };
