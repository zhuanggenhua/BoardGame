import { SPECTATOR_PLAYER_ID } from '../../../engine/playerView';
import type { GameEvent } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import type { FateDominationCore } from './types';

/** The public core is not enough: deterministic replay events also contain private pile facts. */
export function projectFateEvent(event:GameEvent,core:FateDominationCore,viewerId:string):GameEvent {
 const payload={...(event.payload as Record<string,unknown>)};
 for(const key of ['deck','discard','eventDraw','recycledAttackDecks','recycledEventDeck'])delete payload[key];
 const owner=payload.playerId===viewerId;
 if(event.type==='FATE_CARDS_DRAWN'&&!owner)delete payload.drawn;
 if(event.type==='SERVANT_SELECTED'&&!owner&&!core.players[String(payload.playerId)]?.isRevealed)delete payload.servantId;
 if(event.type==='ATTACK_CARD_SELECTED'&&!owner)delete payload.cardId;
 if(event.type==='ATTACKS_CONFIRMED'&&!owner){
  const hidden=Array.isArray(payload.faceDownIds)?payload.faceDownIds:[];
  if(Array.isArray(payload.cardIds))payload.cardIds=payload.cardIds.map((id,index)=>hidden.includes(id)?`hidden-played-${index}`:id);
  delete payload.faceDownIds;
 }
 if(event.type.startsWith('SYS_INTERACTION_')){
  delete payload.interactionData;
  if(!owner){delete payload.value;delete payload.optionId;delete payload.optionIds;}
 }
 return {...event,payload};
}
export function createFatePrivacySystem():EngineSystem<FateDominationCore>{
 return {id:'fate-private-view',name:'Fate 隐藏信息投影',priority:100,
  playerView:(state,viewerId)=>({
   eventStream:{...state.sys.eventStream,entries:state.sys.eventStream.entries.map(entry=>({...entry,event:projectFateEvent(entry.event,state.core,viewerId)}))},
   actionLog:{...state.sys.actionLog,entries:state.sys.actionLog.entries.map(entry=>['SELECT_SERVANT','SELECT_ATTACK_CARD'].includes(entry.kind)?{...entry,segments:[{type:'text' as const,text:entry.kind==='SELECT_SERVANT'?'召唤从者':'调整出牌选择'}]}:entry)},
   undo:{...state.sys.undo,snapshots:[],snapshotCursors:[],restoredRandomCursor:undefined,snapshotCount:state.sys.undo.snapshots.length},
   refereeTrace:undefined,
   ...(viewerId===SPECTATOR_PLAYER_ID?{interaction:{queue:[],isBlocked:Boolean(state.sys.interaction.current)}}:{}),
  }),
 };
}
