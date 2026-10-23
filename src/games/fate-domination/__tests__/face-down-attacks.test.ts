import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { calculateFatePower } from '../domain/power';
import { projectFatePlayerView } from '../domain/playerView';
import type { FateDominationCommand } from '../domain';
const adapter=createReplayAdapter(FateDominationDomain,'face-down');
function fixture(location:'workshop'|'miyama'='workshop'){
 const state=adapter.setup(['0','1','2']);state.core.phase='action';
 const player=state.core.players['0'];player.locationId=location;player.mana=0;
 player.hand=[{id:'expensive-a',definitionId:'cardB4'},{id:'expensive-b',definitionId:'cardQ4'}];
 for(const area of Object.values(state.core.battlefield)){area.eventCards=[];area.playerIds=[];}
 state.core.battlefield[location].playerIds=['0'];state.core.currentEvents={miyama:[],shinto:[]};
 return state;
}
function play(state:ReturnType<typeof fixture>,cardId:string,faceDown:boolean){
 const command={type:'SELECT_ATTACK_CARD',playerId:'0',payload:{cardId,faceDown}} as FateDominationCommand;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);return adapter.execute(state,command).state;
}
it('非战场允许两张暗置，不付费用、不贡献攻击威力且不向对手泄露',()=>{
 let state=fixture();state=play(state,'expensive-a',true);state=play(state,'expensive-b',true);
 const command={type:'CONFIRM_ATTACK',playerId:'0',payload:{}} as const;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);
 state=adapter.execute(state,command).state;
 expect(state.core.players['0'].mana).toBe(0);expect(calculateFatePower(state.core,'0',state.core.players['0'].activeAttackIds)).toBe(0);
 const publicPlayer=projectFatePlayerView(state.core,'1').players['0'];
 expect(publicPlayer.publicView?.playedCards).toHaveLength(2);
 expect(JSON.stringify(publicPlayer)).not.toContain('cardB4');
 expect(publicPlayer.publicView?.playedCards.every(card=>card.definitionId==='hidden')).toBe(true);
});
it('战场有可明置牌时拒绝全暗置；确实无法明置才公开手牌并允许',()=>{
 let state=fixture('miyama');state.core.players['0'].mana=8;
 state=play(state,'expensive-a',true);state=play(state,'expensive-b',true);
 expect(FateDominationDomain.validate(state,{type:'CONFIRM_ATTACK',playerId:'0',payload:{}}).valid).toBe(false);
 state.core.players['0'].mana=0;
 expect(FateDominationDomain.validate(state,{type:'CONFIRM_ATTACK',playerId:'0',payload:{}}).valid).toBe(true);
 state=adapter.execute(state,{type:'CONFIRM_ATTACK',playerId:'0',payload:{}}).state;
 expect(state.core.players['0'].forcedRevealedHand).toHaveLength(2);
});
it('暗置技能被拒绝，暗置手牌可撤回且取消无费用',()=>{
 let state=fixture();const player=state.core.players['0'];
 expect(FateDominationDomain.validate(state,{type:'SELECT_ATTACK_CARD',playerId:'0',payload:{cardId:player.skills.at(-1)!.id,faceDown:true}}).valid).toBe(false);
 state=play(state,'expensive-a',true);state=play(state,'expensive-a',true);
 expect(state.core.players['0'].selectedAttackIds).toEqual([]);expect(state.core.players['0'].selectedFaceDownIds).toEqual([]);expect(state.core.players['0'].mana).toBe(0);
});
it('一次确认携带暗置子集，服务器从规则重算费用与威力且不公开身份',()=>{
 const state=fixture();
 const confirm={type:'CONFIRM_ATTACK',playerId:'0',payload:{cardIds:['expensive-a','expensive-b'],faceDownIds:['expensive-a','expensive-b'],round:state.core.round}} as const;
 expect(FateDominationDomain.validate(state,confirm as unknown as FateDominationCommand).valid).toBe(true);
 const result=adapter.execute(state,confirm as unknown as FateDominationCommand);
 expect(result.events.filter(event=>event.type==='ATTACK_CARD_SELECTED')).toHaveLength(0);
 expect(result.state.core.players['0'].mana).toBe(0);
 expect(calculateFatePower(result.state.core,'0',result.state.core.players['0'].activeAttackIds)).toBe(0);
 const publicPlayer=projectFatePlayerView(result.state.core,'1').players['0'];
 expect(JSON.stringify(publicPlayer.publicView?.playedCards)).not.toContain('expensive-a');
 expect(publicPlayer.publicView?.playedCards.every(card=>card.definitionId==='hidden')).toBe(true);
});
