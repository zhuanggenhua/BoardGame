import { projectFateHand } from '../domain/handView';
import { visibleFatePower, visibleFateServantClass } from '../domain/playerView';
import type { FateDominationCore, PlayerState } from '../domain/types';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID } from '../data';

/** UI reads identities and resource counts from the selected player, never from a demo persona. */
export function projectFatePlayer(core: FateDominationCore, playerId: string, viewerId: string | null) {
    const player = core.players[playerId];
    const hand = projectFateHand(player);
    const own = playerId === viewerId;
    const servantVisible = own || player.isRevealed;
    return {
        player,
        power: player.publicView?.power ?? visibleFatePower(core, playerId, viewerId),
        own,
        master: FATE_MASTER_BY_ID[player.masterId],
        servant: servantVisible ? FATE_SERVANT_BY_ID[player.servantId] : undefined,
        servantVisible,
        servantClass: visibleFateServantClass(core, playerId, viewerId),
        location: player.eliminated ? '已淘汰' : player.locationId ? core.battlefield[player.locationId].label : '未部署',
        handCount: player.publicView?.handCount ?? hand.available.length + hand.staged.length,
        deckCount: player.publicView?.deckCount ?? player.deck.length,
        discardCount: player.publicView?.discardCount ?? player.discard.length,
    };
}

/** Only the registered servant's skill cards belong to the card row; master abilities stay in details. */
export function servantSkillsFor(player: PlayerState) {
    const servant = FATE_SERVANT_BY_ID[player.servantId];
    return (servant?.skillCards ?? []).flatMap((definition, index) => {
        const skill = player.skills.find(item => item.id.split(':')[0] === definition.id);
        return skill ? [{ skill, index }] : [];
    });
}
