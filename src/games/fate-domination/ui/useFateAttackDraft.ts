import {useRef,useState} from 'react';
import type {MatchState} from '../../../engine/types';
import type {ConfirmAttackCommand,FateDominationCore} from '../domain/types';
import {projectFateAttackSelection,resolveFateAttack,type FateAttackSelection} from '../domain/attackSelection';
import {validate} from '../domain/commands';

type Draft={scope:string;selection:FateAttackSelection};
const EMPTY:FateAttackSelection={cardIds:[],faceDownIds:[]};

/** A private client draft, not an optimistic transport command or authoritative state. */
export function useFateAttackDraft(
    authoritative:MatchState<FateDominationCore>,playerId:string|null,
    dispatch:(type:'CONFIRM_ATTACK',payload:ConfirmAttackCommand['payload'])=>void,
    connected=true,
){
    const core=authoritative.core;
    const player=playerId ? core.players[playerId] : undefined;
    const interaction=authoritative.sys.interaction;
    const eligible=Boolean(player && playerId===core.currentPlayerId && core.phase==='action'
        && !player.eliminated && !player.normalAttackPlayed && !authoritative.sys.gameover
        && !interaction.current && !interaction.queue.length);
    const scope=JSON.stringify([playerId,core.currentPlayerId,core.round,core.phase,eligible,
        interaction.current?.id,interaction.queue[0]?.id,authoritative.sys.tutorial.active ? `${authoritative.sys.tutorial.step?.id}:${authoritative.sys.undo.rollbackRevision}` : undefined]);
    const legacy:FateAttackSelection=eligible && player
        ? {cardIds:player.selectedAttackIds,faceDownIds:player.selectedFaceDownIds??[]}:EMPTY;
    const [draft,setDraft]=useState<Draft>(()=>({scope,selection:legacy}));
    const submitting=useRef(false);
    const live=(selection:FateAttackSelection):FateAttackSelection=>{
        if(!eligible || !player)return EMPTY;
        const cardIds=selection.cardIds.filter(id=>resolveFateAttack(player,id)
            && !player.activeAttackIds.includes(id) && !player.activeSkills.includes(id));
        return {cardIds,faceDownIds:selection.faceDownIds.filter(id=>cardIds.includes(id))};
    };
    const stored=draft.scope===scope ? draft.selection : EMPTY;
    const selection=live(stored);
    // Retire a departed scope, rather than hiding a draft that could revive
    // when an interaction closes or a viewer returns to the same seat.
    if(draft.scope!==scope || selection.cardIds.length!==stored.cardIds.length
        || selection.faceDownIds.length!==stored.faceDownIds.length)setDraft({scope,selection});
    const state=playerId && player
        ? {...authoritative,core:projectFateAttackSelection(core,playerId,selection)}:authoritative;
    const payload:ConfirmAttackCommand['payload']={cardIds:[...selection.cardIds],faceDownIds:[...selection.faceDownIds],round:core.round};
    const canSelect=(cardId:string,faceDown=false)=>Boolean(eligible && playerId
        && validate(state,{type:'SELECT_ATTACK_CARD',playerId,payload:{cardId,faceDown}}).valid);
    const toggle=(cardId:string,faceDown=false)=>{
        if(!eligible || !playerId)return;
        setDraft(previous=>{
            const before=live(previous.scope===scope ? previous.selection : EMPTY);
            const projected={...authoritative,core:projectFateAttackSelection(core,playerId,before)};
            if(!before.cardIds.includes(cardId)
                && !validate(projected,{type:'SELECT_ATTACK_CARD',playerId,payload:{cardId,faceDown}}).valid)return previous;
            const removing=before.cardIds.includes(cardId);
            return {scope,selection:{
                cardIds:removing ? before.cardIds.filter(id=>id!==cardId):[...before.cardIds,cardId],
                faceDownIds:removing ? before.faceDownIds.filter(id=>id!==cardId)
                    : faceDown ? [...before.faceDownIds,cardId]:before.faceDownIds,
            }};
        });
    };
    const canConfirm=Boolean(eligible && connected && playerId
        && validate(authoritative,{type:'CONFIRM_ATTACK',playerId,payload}).valid);
    const confirm=()=>{
        if(!canConfirm || submitting.current)return;
        // Only protect synchronous re-entry. Without a command receipt, never
        // invent a permanent pending lock or clear an unacknowledged draft.
        submitting.current=true;
        try {dispatch('CONFIRM_ATTACK',payload);}
        finally {queueMicrotask(()=>{submitting.current=false;});}
    };
    return {state,selection,payload,eligible,canSelect,toggle,canConfirm,confirm};
}
