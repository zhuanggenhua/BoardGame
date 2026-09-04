import {
    type BetrayalCore,
} from './game';
import {
    resolveExplorableRoomSlots,
    resolveNextRoomDiscoveryDeckKind,
} from './roomDiscoveryModel';
import {
    canUseBetrayalTraitorPowers,
    isBetrayalDamagingRoomEndTurnEffect,
    isBetrayalMandatoryRoomEffect,
    type BetrayalRoomEndTurnEffect,
} from './traitorPowerRules';

export type BetrayalTraitorPowerCurrentTrigger =
    | 'none'
    | 'damaging-room-effect'
    | 'mandatory-room-effect'
    | 'event-symbol';

export interface BetrayalTraitorPowerStatus {
    playerId: string;
    active: boolean;
    isTraitor: boolean;
    currentRoomId: string | null;
    currentRoomName: string | null;
    currentRoomEndTurnEffect: BetrayalRoomEndTurnEffect | null;
    canIgnoreDamagingTileEffects: boolean;
    canIgnoreEventSymbols: boolean;
    mustResolveMandatoryTileEffects: boolean;
    currentTrigger: BetrayalTraitorPowerCurrentTrigger;
    reason: string | null;
}

function findExplorerByPlayerId(core: BetrayalCore, playerId: string) {
    if (core.currentExplorer.playerId === playerId) {
        return core.currentExplorer;
    }
    return core.otherExplorers.find((explorer) => explorer.playerId === playerId) ?? null;
}

export function resolveBetrayalTraitorPowerStatus(
    core: BetrayalCore,
    playerId = core.currentExplorer.playerId,
): BetrayalTraitorPowerStatus {
    const actor = findExplorerByPlayerId(core, playerId);
    const currentRoomId = actor?.roomId ?? null;
    const currentRoom = currentRoomId
        ? core.rooms.find((room) => room.id === currentRoomId)
        : undefined;
    const isTraitor = core.scenarioRuntime.traitorPlayerId === playerId;
    const active = canUseBetrayalTraitorPowers(core, playerId);
    const currentRoomEndTurnEffect = currentRoom?.endTurnEffect ?? null;
    const damagingRoomEffect = isBetrayalDamagingRoomEndTurnEffect(currentRoom?.endTurnEffect);
    const mandatoryRoomEffect = isBetrayalMandatoryRoomEffect(currentRoom);
    const nextDeckKind = resolveNextRoomDiscoveryDeckKind(core);
    const eventSymbolTrigger = active
        && nextDeckKind === 'event'
        && resolveExplorableRoomSlots(core).length > 0;
    const currentTrigger: BetrayalTraitorPowerCurrentTrigger = !active
        ? 'none'
        : damagingRoomEffect
            ? 'damaging-room-effect'
            : mandatoryRoomEffect
                ? 'mandatory-room-effect'
                : eventSymbolTrigger
                    ? 'event-symbol'
                    : 'none';
    const reason = active
        ? null
        : !isTraitor
            ? '当前探索者不是叛徒。'
            : core.phase !== 'haunt' || !core.scenarioRuntime.hauntTriggered
                ? '叛徒能力只在作祟开始后生效。'
                : '叛徒已经死亡，不能使用叛徒能力。';

    return {
        playerId,
        active,
        isTraitor,
        currentRoomId,
        currentRoomName: currentRoom?.name ?? null,
        currentRoomEndTurnEffect,
        canIgnoreDamagingTileEffects: active,
        canIgnoreEventSymbols: active,
        mustResolveMandatoryTileEffects: active && mandatoryRoomEffect,
        currentTrigger,
        reason,
    };
}
