import { fateKireiForm } from './abilitySource';
import { projectFateHand } from './handView';
import {FATE_SERVANT_BY_ID} from '../data';
import { calculateFatePower } from './power';
import type { FateDominationCore, PlayerState } from './types';
import { normalizeFateRuleState } from './mechanics';

/** The same visibility contract serves transport and local/spectator UI. */
export function projectFateSkillCards(player:PlayerState,viewerId:string|null|undefined):NonNullable<PlayerState['publicView']>['skillCards'] {
    if(player.publicView) return player.publicView.skillCards;
    const servant=FATE_SERVANT_BY_ID[player.servantId];
    return (servant?.skillCards??[]).flatMap((definition,index)=>{
        const skill=player.skills.find(skill=>skill.id.split(':')[0]===definition.id);
        if(!skill)return [];
        return [(player.id===viewerId || player.isRevealed || player.revealedSkillIds.includes(skill.id) || player.activeSkills.includes(skill.id))
            ? {id:skill.id,name:skill.name,assetPath:servant.skillAssetPaths[index]} : null];
    });
}


/** Face-down identities must not leak through instance IDs either. */
export function projectFatePlayedCards(player: PlayerState, viewerId: string | null | undefined) {
    return projectFateHand(player).active.map((card,index) => player.id !== viewerId && (player.faceDownAttackIds ?? []).includes(card.id) ? {id:`hidden-played-${index}`,definitionId:'hidden'} : card);
}

export const canViewFateHiddenShinto = (state:FateDominationCore,viewerId:string|null|undefined) => state.publicView ? state.publicView.canViewHiddenShinto === true : Boolean(viewerId && state.players[viewerId]?.masterId === 'm_waver');

/** Preview only uses information visible to this viewer; battle settlement uses the authoritative core. */
export function visibleFatePower(state:FateDominationCore,playerId:string,viewerId:string|null|undefined,cardIds=state.players[playerId].activeAttackIds):number {
    if(!state.shintoEventFaceDown||canViewFateHiddenShinto(state,viewerId)||state.players[playerId].locationId!=='shinto')return calculateFatePower(state,playerId,cardIds);
    const eventCards=state.publicView?state.battlefield.shinto.eventCards:state.battlefield.shinto.eventCards.slice(1);
    return calculateFatePower({...state,battlefield:{...state.battlefield,shinto:{...state.battlefield.shinto,eventCards}}},playerId,cardIds);
}

export function visibleFateServantClass(state:FateDominationCore,playerId:string,viewerId:string|null|undefined):string|undefined {
    const player=state.players[playerId];
    if(player.publicView)return player.publicView.servantClass;
    const viewer=viewerId ? state.players[viewerId] : undefined;
    return player.isRevealed || playerId===viewerId || (viewer?.masterId==='m_kirei' && fateKireiForm(viewer)==='supervisor') ? FATE_SERVANT_BY_ID[player.servantId]?.class : undefined;
}

/** Public projection retains counts and public played objects, not another player's private hand/deck. */
export function projectFatePlayerView(state: FateDominationCore, viewerId: string | null | undefined): FateDominationCore {
    const ruleState = normalizeFateRuleState(state.ruleState);
    const canViewHiddenShinto=canViewFateHiddenShinto(state,viewerId);
    const shinto=state.currentEvents.shinto.map((card,index)=>state.shintoEventFaceDown&&index===0&&!canViewHiddenShinto?{id:'hidden-shinto-event',name:'新都暗置事件',assetPath:'fate-domination/events/back',victoryPoints:0,sourceStatus:'unverified' as const}:card);
    return {
        ...state,
        eventDeck: [],
        situationDeck: [],
        publicView: { shintoEventCount: state.currentEvents.shinto.length, canViewHiddenShinto },
        currentEvents: { ...state.currentEvents, shinto },
        battlefield: { ...state.battlefield, shinto: { ...state.battlefield.shinto, eventCards: shinto } },
        ruleState: { ...ruleState, copies: ruleState.copies.filter(record => record.context.controllerId === viewerId || record.context.ownerId === viewerId) },
        players: Object.fromEntries(state.playerIds.map(id => {
            const player = state.players[id];
            if (id === viewerId) return [id, player];
            const hand = projectFateHand(player);
            const skillCards=projectFateSkillCards(player,viewerId);
            const publicView: NonNullable<PlayerState['publicView']> = {
                servantClass: visibleFateServantClass(state,id,viewerId),
                power: visibleFatePower(state, id, viewerId),
                handCount: hand.available.length + hand.staged.length,
                deckCount: player.deck.length,
                discardCount: player.discard.length,
                playedCards: projectFatePlayedCards(player, viewerId),
                skillCards,
                playedSkills: skillCards.flatMap(card=>card && player.activeSkills.includes(card.id) ? [card] : []),
            };
            return [id, { ...player, publicView, hand: [], deck: [], discard: [], selectedAttackIds: [], selectedFaceDownIds: [], faceDownAttackIds: [], activeAttackIds: [],
                servantId: player.isRevealed ? player.servantId : '', skills: player.isRevealed ? player.skills : [], activeSkills: player.isRevealed ? player.activeSkills : [],
            }];
        })),
    };
}
