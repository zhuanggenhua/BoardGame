import {
    createActionLogSystem,
    createInteractionSystem,
    createSimpleChoiceSystem,
    createRematchSystem,
    createUndoSystem,
} from '../../engine';
import { registerGameAiRuntime } from '../../engine/ai';
import { createGameEngine } from '../../engine/adapter';
import { qidahenAiRuntime } from './ai';
import { QidahenDomain } from './domain';
import { QIDAHEN_COMMANDS } from './domain/commands';
import { createQidahenInteractionSystem } from './domain/interactionSystem';
import { QIDAHEN_MAX_PLAYERS, QIDAHEN_MIN_PLAYERS } from './roomSetup';

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

export default engineConfig;
