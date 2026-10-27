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
 const [target,setTarget]=useState<LocationId|null>(null);
 const cancel=()=>{setIntent(null);setTarget(null);};
 useEffect(cancel,[playerId,state.core.currentPlayerId,state.core.phase,state.sys.tutorial.active ? `${state.sys.tutorial.step?.id}:${state.sys.undo.rollbackRevision}` : undefined]);
 const legalTargets=(candidate:FateMovementIntent)=>playerId?FATE_LOCATION_ORDER.filter(id=>validate(state,movementCommand(candidate,playerId,id)).valid):[];
 const begin=(candidate:FateMovementIntent)=>{if(legalTargets(candidate).length){setIntent(candidate);setTarget(null);}};
 const targets=intent?legalTargets(intent):[];
 const targetKey=targets.join('|');
 useEffect(()=>{
  if(!intent)return;
  if(!targetKey){setIntent(null);setTarget(null);return;}
  if(target&&!targetKey.split('|').includes(target))setTarget(null);
 },[intent,target,targetKey]);
 const command=intent&&playerId&&target&&targets.includes(target)?movementCommand(intent,playerId,target):null;
 return {intent,target,targets,command,begin,cancel,normalAvailable:legalTargets({kind:'normal'}).length>0,
  select:(id:LocationId)=>{if(targets.includes(id))setTarget(id);},legalTargets};
}
