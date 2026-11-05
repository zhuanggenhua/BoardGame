import {
    createBaseSystems,
    createCheatSystem,
    createFlowSystem,
    createGameEngine,
    createTimingOpportunitySystem,
} from '../../engine';
import { MageWarsDomain, MAGE_WARS_COMMANDS } from './domain';
import type { MageWarsCommand, MageWarsCore, MageWarsEvent } from './domain';
import { mageWarsFlowHooks } from './domain/flowHooks';
import { MAGE_WARS_AUDIO_CONFIG } from './audio.config';
import { registerGameAiRuntime } from '../../engine/ai';
import { mageWarsAiRuntime } from './ai';
import { ACTION_ALLOWLIST, UNDO_ALLOWLIST, formatMageWarsActionEntry } from './actionLog';
import { createMageWarsInteractionSystem } from './domain/systems';
import { createMageWarsTimingOpportunitySystemConfig } from './domain/timingOpportunities';

const systems = [
    createFlowSystem<MageWarsCore>({ hooks: mageWarsFlowHooks }),
    ...createBaseSystems<MageWarsCore>({
        actionLog: {
            commandAllowlist: ACTION_ALLOWLIST,
            formatEntry: formatMageWarsActionEntry,
        },
        undo: {
            snapshotCommandAllowlist: UNDO_ALLOWLIST,
        },
    }),
    createCheatSystem<MageWarsCore>(),
    createTimingOpportunitySystem(MageWarsDomain, createMageWarsTimingOpportunitySystemConfig()),
    createMageWarsInteractionSystem(),
];

export const engineConfig = createGameEngine<MageWarsCore, MageWarsCommand, MageWarsEvent>({
    domain: MageWarsDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2,
    commandTypes: Object.values(MAGE_WARS_COMMANDS),
    postSetupAutoFlow: {
        maxRounds: 10,
    },
});
registerGameAiRuntime(mageWarsAiRuntime);

export default engineConfig;
export { MAGE_WARS_AUDIO_CONFIG as audioConfig };
export type { MageWarsCore as MageWarsState } from './domain';
