import { createFateInformationBoundarySystem } from './domain/informationBoundarySystem';
import type { LocalRuntimeControlResolver } from '../../engine/transport/followCurrentTurnPlayer';
import { createFatePostBattleChoiceSystems, createFatePostBattleInteraction, isFatePostBattleChoice } from './domain/postBattleChoice';
import { createFateRidingChoiceSystems, createFateRidingInteraction } from './domain/ridingChoice';
import { createFateChariotChoiceSystems, createFateChariotInteraction } from './domain/chariotChoice';
import { createFateInvestigationChoiceSystems, createFateInvestigationInteraction } from './domain/investigationChoice';
import { createFateFieldAttackSystems, createFateFieldAttackInteraction } from './domain/battlefieldAttacks';
import { createFatePrivacySystem } from './domain/privacySystem';
import { createBaseSystems, createGameEngine, createResolutionFrameSystem, createTimingOpportunitySystem } from '../../engine';
import { registerCriticalImageResolver } from '../../core';
import { FateDominationDomain } from './domain';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent } from './domain';
import { FATE_DOMINATION_AUDIO_CONFIG } from './audio.config';
import { fateDominationCriticalImageResolver } from './criticalImageResolver';
import { registerGameAiRuntime } from '../../engine/ai';
import { fateDominationAiRuntime } from './ai';
import { FATE_DOMINATION_COMMANDS } from './domain/types';
import { FATE_LOG_COMMANDS, FATE_UNDO_COMMANDS, formatFateActionLog } from './actionLog';

const [fateRidingChoiceGuard, fateRidingChoiceResolution] = createFateRidingChoiceSystems();
const [fateChariotGuard, fateChariotResolution] = createFateChariotChoiceSystems();
const [fateInvestigationGuard, fateInvestigationResolution] = createFateInvestigationChoiceSystems();
const systems = [
    ...createFateFieldAttackSystems(),
    fateRidingChoiceGuard,
    fateChariotGuard,
    fateInvestigationGuard,
    ...createBaseSystems<FateDominationCore>({
        actionLog: { commandAllowlist: FATE_LOG_COMMANDS, formatEntry: formatFateActionLog },
        undo: { snapshotCommandAllowlist: FATE_UNDO_COMMANDS },
    }),
    ...createFatePostBattleChoiceSystems(),
    fateRidingChoiceResolution,
    fateChariotResolution,
    fateInvestigationResolution,
    createTimingOpportunitySystem(FateDominationDomain, { choiceRequestInteraction: ({opportunity}) => createFateRidingInteraction(opportunity) ?? createFateChariotInteraction(opportunity) ?? createFateInvestigationInteraction(opportunity) ?? createFateFieldAttackInteraction(opportunity) ?? createFatePostBattleInteraction(opportunity) }),
    createFatePrivacySystem(),
    createFateInformationBoundarySystem(),
    createResolutionFrameSystem<FateDominationCore>({
        shouldAutoCompleteFrame: ({ state, frame }) => frame.kind === 'fate:battle-resolution' && state.core.phase !== 'battle',
    }),
];

const resolveFateLocalRuntimeControlledPlayerId: LocalRuntimeControlResolver = ({state, fallbackPlayerId, seatControllers = {}, localPlayerId}) => {
    const activeSeat = isFatePostBattleChoice(state.sys.interaction.current) ? state.sys.interaction.current.playerId : fallbackPlayerId;
    if (!activeSeat || (seatControllers[activeSeat]?.type ?? 'human') === 'human') return activeSeat;
    return localPlayerId ?? (state.core as FateDominationCore).playerIds.find(id => (seatControllers[id]?.type ?? 'human') === 'human');
};

export const engineConfig = { ...createGameEngine<FateDominationCore, FateDominationCommand, FateDominationEvent>({
    domain: FateDominationDomain,
    systems,
    minPlayers: 3,
    maxPlayers: 7,
    commandTypes: Object.values(FATE_DOMINATION_COMMANDS),
}), randomSeedVisibility:'server-only' as const, resolveLocalRuntimeControlledPlayerId:resolveFateLocalRuntimeControlledPlayerId };

registerCriticalImageResolver('fate-domination', fateDominationCriticalImageResolver);
registerGameAiRuntime(fateDominationAiRuntime);

export default engineConfig;
export { FATE_DOMINATION_AUDIO_CONFIG as audioConfig };
