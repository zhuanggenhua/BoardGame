import {
    createActionLogSystem,
    createEventStreamSystem,
    createInteractionSystem,
    createTutorialSystem,
    createSimpleChoiceSystem,
    createRematchSystem,
    createUndoSystem,
} from '../../engine';
import type { ActionLogEntry, Command, GameEvent, MatchState } from '../../engine/types';
import { registerGameAiRuntime } from '../../engine/ai';
import { createGameEngine } from '../../engine/adapter';
import { qidahenAiRuntime } from './ai';
import { QIDAHEN_AUDIO_CONFIG } from './audio.config';
import { QidahenDomain } from './domain';
import type { QidahenCore } from './domain';
import { QIDAHEN_COMMANDS } from './domain/commands';
import { createQidahenInteractionSystem } from './domain/interactionSystem';
import { QIDAHEN_MAX_PLAYERS, QIDAHEN_MIN_PLAYERS } from './roomSetup';

const ACTION_ALLOWLIST = Object.values(QIDAHEN_COMMANDS);

const findFactionPlayerId = (core: QidahenCore, factionId?: string): string | undefined => {
    if (!factionId || !(factionId in core.factions)) return undefined;
    return core.factions[factionId as keyof QidahenCore['factions']]?.playerId;
};

const getPayloadValue = (command: Command, key: string): unknown => (
    command.payload && typeof command.payload === 'object'
        ? (command.payload as Record<string, unknown>)[key]
        : undefined
);

const formatQidahenFallbackLogText = (core: QidahenCore, command: Command): string => {
    switch (command.type) {
        case QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE:
            return getPayloadValue(command, 'scenarioId') ? '房主选择剧本' : '清空剧本选择';
        case QIDAHEN_COMMANDS.SELECT_FACTION:
            return '确认阵营';
        case QIDAHEN_COMMANDS.SELECT_REGION: {
            const regionId = getPayloadValue(command, 'regionId');
            const regionName = typeof regionId === 'string'
                ? core.regions.find((region) => region.id === regionId)?.name
                : undefined;
            return regionName ? `选择地图区域：${regionName}` : '选择地图区域';
        }
        case QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION:
        case QIDAHEN_COMMANDS.EXECUTE_ACTION: {
            const actionId = getPayloadValue(command, 'actionId');
            const actionLabel = typeof actionId === 'string'
                ? core.actionChoices.find((action) => action.id === actionId)?.label
                : undefined;
            return `${command.type === QIDAHEN_COMMANDS.EXECUTE_ACTION ? '执行行动' : '选择行动'}${actionLabel ? `：${actionLabel}` : ''}`;
        }
        case QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE:
        case QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE: {
            const moveId = getPayloadValue(command, 'moveId');
            const moveLabel = typeof moveId === 'string'
                ? core.wheelMoveChoices.find((move) => move.id === moveId)?.label
                : undefined;
            return `${command.type === QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE ? '执行轮盘移动' : '选择轮盘移动'}${moveLabel ? `：${moveLabel}` : ''}`;
        }
        case QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD:
            return '选择支付手牌';
        case QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD:
            return '选择超限弃牌';
        case QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD:
            return '选择孙元化弃牌';
        case QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD:
            return '选择高第调度手牌';
        case QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD:
            return '确认超限弃牌';
        case QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH:
            return '结算孙元化';
        case QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH:
            return '结算高第调度';
        case QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH:
            return '确认调度选择';
        case QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION:
            return '执行已选行动';
        case QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION:
            return '结算待决行动';
        case QIDAHEN_COMMANDS.PLAY_TACTIC_CARD:
            return '打出战术牌';
        case QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION:
            return '结算战后选择';
        case QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE:
            return '结算大汗令箭';
        case QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE:
            return '确认外交选择';
        case QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE:
            return '确认马市贸易';
        case QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT:
            return '确认驱虎吞狼回应';
        case QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE:
            return '确认征召军队';
        case QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE:
            return '确认城防维护';
        case QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE:
            return '确认剧本人物';
        case QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE:
            return '确认剧本军备';
        default:
            return command.type;
    }
};

const findQidahenDomainLog = (core: QidahenCore, events: GameEvent[]) => {
    const timestampByLogId: ReadonlyMap<string, number> = new Map(events.map((event) => [`log-${event.timestamp}`, event.timestamp] as const));
    const entry = core.actionLog.find((item) => timestampByLogId.has(item.id)) ?? null;
    return entry ? { entry, timestamp: timestampByLogId.get(entry.id) ?? null } : null;
};

function formatQidahenActionEntry({
    command,
    state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    const core = state.core as QidahenCore;
    const domainLog = findQidahenDomainLog(core, events);
    const timestamp = domainLog?.timestamp ?? events[0]?.timestamp ?? command.timestamp ?? 0;
    const text = domainLog?.entry.text ?? formatQidahenFallbackLogText(core, command);

    return {
        id: domainLog?.entry.id ? `qidahen-${domainLog.entry.id}` : `${command.type}-${command.playerId}-${timestamp}`,
        timestamp,
        actorId: findFactionPlayerId(core, domainLog?.entry.faction) ?? command.playerId,
        kind: command.type,
        segments: [{ type: 'text', text }],
    };
}

const systems = [
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatQidahenActionEntry,
    }),
    createUndoSystem({
        snapshotCommandAllowlist: ACTION_ALLOWLIST,
    }),
    createInteractionSystem(),
    createTutorialSystem(),
    createEventStreamSystem(),
    createSimpleChoiceSystem(),
    createQidahenInteractionSystem(),
    createRematchSystem(),
];

export const engineConfig = createGameEngine({
    domain: QidahenDomain,
    systems,
    minPlayers: QIDAHEN_MIN_PLAYERS,
    maxPlayers: QIDAHEN_MAX_PLAYERS,
    commandTypes: Object.values(QIDAHEN_COMMANDS),
});

registerGameAiRuntime(qidahenAiRuntime);

export { QIDAHEN_AUDIO_CONFIG as audioConfig };
export default engineConfig;
