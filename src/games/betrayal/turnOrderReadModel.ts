import type { BetrayalCore } from './game';
import { getExplorersInTurnOrder } from './explorerReadModel';
import { isBetrayalPlayerControllingMonster, shouldDeadPlayerControlFeverish } from './hauntScenarioReadModel';

export function rotateToNextLivingPlayer(core: BetrayalCore, currentPlayerId: string): string {
    const explorers = getExplorersInTurnOrder(core);
    const eligibleExplorers = explorers.filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        || isBetrayalPlayerControllingMonster(core, explorer.playerId)
    ));
    const revealerId = core.scenarioRuntime.hauntRevealerPlayerId;
    const feverish = eligibleExplorers.filter((explorer) => shouldDeadPlayerControlFeverish(core, explorer.playerId));
    const turnEligibleExplorers = feverish.length > 0 && revealerId && explorers.some((explorer) => explorer.playerId === revealerId)
        ? explorers.flatMap((explorer) => [
            ...eligibleExplorers.filter((candidate) => candidate.playerId === explorer.playerId && !shouldDeadPlayerControlFeverish(core, candidate.playerId)),
            ...(explorer.playerId === revealerId ? feverish : []),
        ])
        : eligibleExplorers;
    if (turnEligibleExplorers.length === 0) {
        return currentPlayerId;
    }
    const currentIndex = turnEligibleExplorers.findIndex((explorer) => explorer.playerId === currentPlayerId);
    const nextExplorer = turnEligibleExplorers[
        (currentIndex + 1 + turnEligibleExplorers.length) % turnEligibleExplorers.length
    ] ?? turnEligibleExplorers[0]!;
    return nextExplorer.playerId;
}

export function resolveNextLivingPlayerIdInTurnOrder(
    core: BetrayalCore,
    fromPlayerId: string,
): string | null {
    const livingExplorers = getExplorersInTurnOrder(core).filter((explorer) => (
        !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
    ));
    if (livingExplorers.length <= 1) {
        return null;
    }
    const currentIndex = livingExplorers.findIndex((explorer) => explorer.playerId === fromPlayerId);
    const nextExplorer = livingExplorers[(currentIndex + 1 + livingExplorers.length) % livingExplorers.length]
        ?? livingExplorers[0]!;
    return nextExplorer.playerId === fromPlayerId ? null : nextExplorer.playerId;
}
