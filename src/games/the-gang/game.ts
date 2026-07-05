import { createBaseSystems } from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { registerGameAiRuntime } from '../../engine/ai';
import {
    formatTheGangActionEntry,
    THE_GANG_ACTION_ALLOWLIST,
    THE_GANG_UNDO_ALLOWLIST,
} from './actionLog';
import { theGangAiRuntime } from './ai';
import { TheGangDomain } from './domain';
import {
    THE_GANG_COMMANDS,
    type TheGangCommand,
    type TheGangCore,
    type TheGangEvent,
} from './domain/types';

const systems = createBaseSystems<TheGangCore>({
    actionLog: {
        commandAllowlist: THE_GANG_ACTION_ALLOWLIST,
        formatEntry: formatTheGangActionEntry,
    },
    undo: {
        snapshotCommandAllowlist: THE_GANG_UNDO_ALLOWLIST,
    },
});

export const engineConfig = createGameEngine<TheGangCore, TheGangCommand, TheGangEvent>({
    domain: TheGangDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 6,
    commandTypes: Object.values(THE_GANG_COMMANDS),
});

export default engineConfig;
export type { TheGangCore as TheGangState } from './domain';

registerGameAiRuntime(theGangAiRuntime);
