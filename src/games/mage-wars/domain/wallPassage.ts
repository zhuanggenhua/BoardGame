import type { PlayerId } from '../../../engine/types';
import { MAGE_WARS_EVENTS } from './events';
import type { ArenaZoneId } from './ids';
import type { MageWarsArenaObjectState, MageWarsCore, MageWarsEvent } from './types';
import { getMageWarsWallBetweenZones } from './utils';
import { getMageWarsSpellCardFromConfig } from '../data/configPackage';

export function requiresMageWarsStandardWallPassage(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
    toZoneId: ArenaZoneId,
): boolean {
    const wall = getMageWarsWallBetweenZones(core, object.zoneId, toZoneId);
    const level = getMageWarsSpellCardFromConfig(object.sourceSpellCardId)?.level;
    return wall?.passageDamage?.kind === 'level-based-attack' && level !== undefined && level >= 2;
}

export function createMageWarsWallPassageDamageAvailableEvents(
    core: MageWarsCore,
    sourceCommandType: string,
    timestamp: number,
    target: { objectId?: string; playerId?: PlayerId },
    fromZoneId: ArenaZoneId,
    toZoneId: ArenaZoneId,
): MageWarsEvent[] {
    const wall = getMageWarsWallBetweenZones(core, fromZoneId, toZoneId);
    if (!wall?.passageDamage || wall.passageDamage.amount <= 0) return [];
    return [{
        type: MAGE_WARS_EVENTS.WALL_PASSAGE_DAMAGE_AVAILABLE,
        payload: {
            wallId: wall.id, edgeId: wall.edgeId, sourceSpellCardId: wall.sourceSpellCardId,
            sourceAbilityId: `mw.wall.${wall.sourceSpellCardId}.passage`, fromZoneId, toZoneId,
            amount: wall.passageDamage.amount, damageTypes: [...wall.passageDamage.damageTypes],
            ...(target.objectId ? { objectId: target.objectId } : {}),
            ...(target.playerId ? { playerId: target.playerId } : {}),
        },
        sourceCommandType,
        timestamp,
    }];
}
