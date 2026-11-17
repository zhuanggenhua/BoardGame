import type { PlayerId } from '../../../engine/types';
import { MAGE_WARS_COMMANDS, type MageWarsCommand } from './commands';
import { MAGE_WARS_EVENTS, type MageWarsEvent } from './events';
import type { MageWarsCore } from './types';
import { isMageWarsBanishedArenaObject, resolveMageWarsObjectEffectiveLife } from './spellRules';
import { getOpponentId } from './utils';

/** 活动状态由行动标记决定；昏迷等状态不改变是否需要激活。 */
export function countMageWarsActiveCreatures(core: MageWarsCore, playerId: PlayerId): number {
    const mage = core.players[playerId];
    const activeMage = mage && mage.actionReady && mage.damage < mage.life ? 1 : 0;
    const activeCreatures = Object.values(core.objects).filter((object) => (
        object.ownerId === playerId
        && object.kind === 'creature'
        && object.actionReady
        && !isMageWarsBanishedArenaObject(object)
        && object.damage < resolveMageWarsObjectEffectiveLife(core, object)
    )).length;
    return activeMage + activeCreatures;
}

export function canMageWarsSkipCreatureAction(core: MageWarsCore, playerId: PlayerId): boolean {
    return countMageWarsActiveCreatures(core, playerId)
        < countMageWarsActiveCreatures(core, getOpponentId(core, playerId));
}

export function canMageWarsAdvanceCreatureAction(core: MageWarsCore, playerId: PlayerId): boolean {
    return core.activeCreatureAction?.playerId === playerId
        || countMageWarsActiveCreatures(core, playerId) === 0
        || canMageWarsSkipCreatureAction(core, playerId);
}

/** 从已接受的普通行动解析生物身份；法师额外快速施法不占用生物行动。 */
export function resolveMageWarsCreatureActionActor(
    core: MageWarsCore,
    command: MageWarsCommand,
    events: readonly MageWarsEvent[],
): { playerId: PlayerId; objectId?: string } | undefined {
    const playerId = command.playerId;
    switch (command.type) {
        case MAGE_WARS_COMMANDS.MOVE_MAGE:
        case MAGE_WARS_COMMANDS.DECLARE_ATTACK:
        case MAGE_WARS_COMMANDS.DECLARE_EQUIPMENT_ATTACK:
            return { playerId };
        case MAGE_WARS_COMMANDS.MOVE_ARENA_OBJECT:
            return { playerId, objectId: command.payload.objectId };
        case MAGE_WARS_COMMANDS.GUARD:
        case MAGE_WARS_COMMANDS.CREATURE_NO_ACTION:
            return { playerId, ...(command.payload.objectId ? { objectId: command.payload.objectId } : {}) };
        case MAGE_WARS_COMMANDS.DECLARE_OBJECT_ATTACK:
            return { playerId, objectId: command.payload.attackerObjectId };
        case MAGE_WARS_COMMANDS.CAST_SPELL: {
            const cast = events.find((event) => (
                (event.type === MAGE_WARS_EVENTS.SPELL_CAST_STARTED
                    || event.type === MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED)
                && event.payload.castMode === 'action'
            ));
            if (!cast || (cast.type !== MAGE_WARS_EVENTS.SPELL_CAST_STARTED
                && cast.type !== MAGE_WARS_EVENTS.SPELL_CAST_RESOLVED)) return undefined;
            return cast.payload.caster.kind === 'arena-object'
                ? { playerId, objectId: cast.payload.caster.objectId }
                : { playerId };
        }
        case MAGE_WARS_COMMANDS.USE_ARENA_OBJECT_ABILITY: {
            const resolved = events.find((event) => event.type === MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED);
            if (!resolved || resolved.type !== MAGE_WARS_EVENTS.ARENA_OBJECT_ABILITY_RESOLVED) return undefined;
            if (resolved.payload.targetActionCost === 'normal' && resolved.payload.targetObjectId) {
                return { playerId, objectId: resolved.payload.targetObjectId };
            }
            if (core.objects[command.payload.objectId]?.kind === 'creature') {
                return { playerId, objectId: command.payload.objectId };
            }
            return resolved.payload.actionTrack === 'action' && resolved.payload.actionCost === 'normal'
                ? { playerId }
                : undefined;
        }
        case MAGE_WARS_COMMANDS.USE_MAGE_ABILITY:
            return events.some((event) => event.type === MAGE_WARS_EVENTS.MAGE_ABILITY_RESOLVED
                && event.payload.actionTrack === 'action') ? { playerId } : undefined;
        default:
            return undefined;
    }
}
