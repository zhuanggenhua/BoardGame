import type { BetrayalUponReflectionRuntimeState, BetrayalDustRuntimeState, BetrayalCore } from './types';
import type { PlayerId } from '../../../engine/types';
import { cloneUponReflectionRuntimeState } from '../hauntRuntimeSetupModel';
import { cloneCore } from './stateFactory';

export function maskUponReflectionRuntimeForPlayer(
    uponReflection: BetrayalUponReflectionRuntimeState,
    viewingPlayerId: PlayerId,
): BetrayalUponReflectionRuntimeState {
    return {
        ...cloneUponReflectionRuntimeState(uponReflection),
        secretCombination:
            uponReflection.revealerPlayerId === viewingPlayerId
                ? uponReflection.secretCombination
                    ? { ...uponReflection.secretCombination }
                    : null
                : null,
    };
}

export function maskDustRuntimeForPlayer(
    dust: BetrayalDustRuntimeState,
    viewingPlayerId: PlayerId,
): BetrayalDustRuntimeState {
    return {
        sicknessTokensByPlayerId: Object.fromEntries(
            Object.entries(dust.sicknessTokensByPlayerId).map(([playerId, tokens]) => [
                playerId,
                tokens.map((token) => (playerId === viewingPlayerId ? { ...token } : { ...token, value: null })),
            ]),
        ),
        permanentTraitorPlayerIds: dust.permanentTraitorPlayerIds.includes(viewingPlayerId) ? [viewingPlayerId] : [],
        researchRoomIds: [...dust.researchRoomIds],
        exchangedSicknessThisTurnPlayerIds: [...dust.exchangedSicknessThisTurnPlayerIds],
        feverishPlayerIds: [...dust.feverishPlayerIds],
        pendingSicknessExchange: dust.pendingSicknessExchange ? { ...dust.pendingSicknessExchange } : undefined,
    };
}

export function createBetrayalPlayerView(state: BetrayalCore, viewingPlayerId: PlayerId): BetrayalCore {
    const view = cloneCore(state);
    if (view.scenarioRuntime.dust) {
        view.scenarioRuntime.dust = maskDustRuntimeForPlayer(view.scenarioRuntime.dust, viewingPlayerId);
    }
    if (view.scenarioRuntime.uponReflection) {
        view.scenarioRuntime.uponReflection = maskUponReflectionRuntimeForPlayer(
            view.scenarioRuntime.uponReflection,
            viewingPlayerId,
        );
    }
    const deathPreventionRuntime = view.recentRoll?.deathPrevention?.scenarioRuntimeBeforeDefeat;
    if (deathPreventionRuntime?.dust) {
        deathPreventionRuntime.dust = maskDustRuntimeForPlayer(deathPreventionRuntime.dust, viewingPlayerId);
    }
    if (deathPreventionRuntime?.uponReflection) {
        deathPreventionRuntime.uponReflection = maskUponReflectionRuntimeForPlayer(
            deathPreventionRuntime.uponReflection,
            viewingPlayerId,
        );
    }
    return view;
}
