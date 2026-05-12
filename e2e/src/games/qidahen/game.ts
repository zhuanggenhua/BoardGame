import {
    createActionLogSystem,
    createInteractionSystem,
    createRematchSystem,
    createUndoSystem,
} from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { QidahenDomain } from './domain';
import { QIDAHEN_COMMANDS } from './domain/commands';

const systems = [
    createActionLogSystem({
        commandAllowlist: Object.values(QIDAHEN_COMMANDS),
        formatEntry: ({ command }) => ({
            id: `${command.type}-${command.playerId}-${command.timestamp ?? Date.now()}`,
            timestamp: command.timestamp ?? Date.now(),
            actorId: command.playerId,
            kind: command.type,
            segments: [{ type: 'text', text: command.type === QIDAHEN_COMMANDS.SELECT_REGION ? '选择地图区域' : '确认预览行动' }],
        }),
    }),
    createUndoSystem({
        snapshotCommandAllowlist: Object.values(QIDAHEN_COMMANDS),
    }),
    createInteractionSystem(),
    createRematchSystem(),
];

export const engineConfig = createGameEngine({
    domain: QidahenDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 3,
    commandTypes: Object.values(QIDAHEN_COMMANDS),
});

export default engineConfig;
