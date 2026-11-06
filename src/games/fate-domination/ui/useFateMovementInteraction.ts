import {useEffect,useState} from 'react';
import type {MatchState} from '../../../engine/types';
import {FATE_LOCATION_ORDER} from '../domain/movement';
import {validate} from '../domain/commands';
import type {FateDominationCore,FateDominationCommand,LocationId} from '../domain/types';
export type FateMovementIntent={kind:'normal'}|{kind:'skill';skillId:string}|{kind:'seal'};
const movementCommand=(intent:FateMovementIntent,playerId:string,target:LocationId):FateDominationCommand=>
 intent.kind==='normal'?{type:'MOVE_PLAYER',playerId,payload:{locationId:target}}:
 intent.kind==='seal'?{type:'USE_COMMAND_SPELL',playerId,payload:{effect:'move',targetLocationId:target}}:
 {type:'PLAY_SKILL',playerId,payload:{skillId:intent.skillId,targetLocationId:target}};
/** Local choice only. All destinations and final submission are checked by the domain validator. */
export function useFateMovementInteraction(state:MatchState<FateDominationCore>,playerId:string|null){
 const [intent,setIntent]=useState<FateMovementIntent|null>(null);
 const cancel=()=>setIntent(null);
 useEffect(cancel,[playerId,state.core.currentPlayerId,state.core.phase,state.sys.tutorial.active ? `${state.sys.tutorial.step?.id}:${state.sys.undo.rollbackRevision}` : undefined]);
 const legalTargets=(candidate:FateMovementIntent)=>playerId?FATE_LOCATION_ORDER.filter(id=>validate(state,movementCommand(candidate,playerId,id)).valid):[];
 const begin=(candidate:FateMovementIntent)=>{if(legalTargets(candidate).length)setIntent(candidate);};
 const targets=intent?legalTargets(intent):[];
 const targetKey=targets.join('|');
 useEffect(()=>{
  if(!intent)return;
  if(!targetKey)setIntent(null);
 },[intent,targetKey]);
 const commandFor=(id:LocationId)=>intent&&playerId?movementCommand(intent,playerId,id):null;
 return {intent,targets,commandFor,begin,cancel,normalAvailable:legalTargets({kind:'normal'}).length>0,legalTargets};
}
