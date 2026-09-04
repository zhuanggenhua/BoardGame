import {
    resolveEntityRelation,
    type EntityRelation,
    type EntitySideId,
} from '../../engine/primitives';
import type { BetrayalCore } from './game';

export type BetrayalExplorerSide = 'traitor' | 'hero' | `free-for-all:${string}` | null;
export type BetrayalEntityRelation = EntityRelation;
export type BetrayalEntitySideId = EntitySideId;

export type BetrayalEntityRef =
    | { kind: 'explorer'; playerId: string }
    | { kind: 'monster'; monsterId: string }
    | { kind: 'side'; sideId: BetrayalEntitySideId | null | undefined };

export function isBetrayalHauntRuntimeStarted(core: BetrayalCore): boolean {
    return core.phase === 'haunt'
        || core.scenarioRuntime.hauntTriggered
        || core.scenarioRuntime.hauntCardNumber !== null;
}

export function resolveBetrayalExplorerSide(core: BetrayalCore, playerId: string): BetrayalExplorerSide {
    const teamModel = core.scenarioRuntime.hauntTraitorResolution?.teamModel;
    if (teamModel === 'free-for-all') {
        return `free-for-all:${playerId}`;
    }
    if (teamModel === 'no-traitor') {
        return 'hero';
    }
    const dustTraitors = core.scenarioRuntime.dust?.permanentTraitorPlayerIds ?? [];
    if (dustTraitors.length > 0) {
        return dustTraitors.includes(playerId) ? 'traitor' : 'hero';
    }
    if (!core.scenarioRuntime.traitorPlayerId) {
        return null;
    }
    return core.scenarioRuntime.traitorPlayerId === playerId ? 'traitor' : 'hero';
}

function toBetrayalEntitySideId(side: BetrayalExplorerSide): BetrayalEntitySideId | null {
    if (side === 'hero') {
        return 'heroes';
    }
    return side;
}

export function resolveBetrayalExplorerSideId(
    core: BetrayalCore,
    playerId: string,
): BetrayalEntitySideId | null {
    return toBetrayalEntitySideId(resolveBetrayalExplorerSide(core, playerId));
}

export function resolveBetrayalMonsterSideId(
    core: BetrayalCore,
    monsterId: string,
): BetrayalEntitySideId | null {
    if (!isBetrayalHauntRuntimeStarted(core)) {
        return null;
    }
    const monster = core.monsters.find((item) => item.id === monsterId);
    if (!monster) {
        return null;
    }
    const traitorPlayerId = core.scenarioRuntime.traitorPlayerId;
    if (traitorPlayerId && resolveBetrayalExplorerSide(core, traitorPlayerId) === 'traitor') {
        return 'traitor';
    }
    return 'monsters';
}

export function resolveBetrayalEntitySideId(
    core: BetrayalCore,
    entity: BetrayalEntityRef,
): BetrayalEntitySideId | null {
    switch (entity.kind) {
        case 'explorer':
            return resolveBetrayalExplorerSideId(core, entity.playerId);
        case 'monster':
            return resolveBetrayalMonsterSideId(core, entity.monsterId);
        case 'side':
            return entity.sideId ?? null;
        default:
            return null;
    }
}

function getBetrayalEntityId(entity: BetrayalEntityRef): string | null {
    switch (entity.kind) {
        case 'explorer':
            return `explorer:${entity.playerId}`;
        case 'monster':
            return `monster:${entity.monsterId}`;
        case 'side':
            return entity.sideId ? `side:${entity.sideId}` : null;
        default:
            return null;
    }
}

export function resolveBetrayalEntityRelation(
    core: BetrayalCore,
    actor: BetrayalEntityRef,
    target: BetrayalEntityRef,
): BetrayalEntityRelation {
    return resolveEntityRelation({
        actorEntityId: getBetrayalEntityId(actor),
        actorSideId: resolveBetrayalEntitySideId(core, actor),
        targetEntityId: getBetrayalEntityId(target),
        targetSideId: resolveBetrayalEntitySideId(core, target),
        defaultRelation: 'enemy',
    });
}

export function resolveBetrayalMonsterRelationToExplorer(
    core: BetrayalCore,
    monsterId: string,
    explorerPlayerId: string,
): BetrayalEntityRelation {
    return resolveBetrayalEntityRelation(
        core,
        { kind: 'monster', monsterId },
        { kind: 'explorer', playerId: explorerPlayerId },
    );
}
