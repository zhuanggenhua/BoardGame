import { expect,it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { calculateFatePower } from '../domain/power';
import { projectFatePlayerView } from '../domain/playerView';
const adapter=createReplayAdapter(FateDominationDomain,'master-stage');
function fixture(masterId:string){let state=adapter.setup(['0','1','2']);state=adapter.execute(state,{type:'SELECT_MASTER',playerId:'0',payload:{masterId}}).state;state.core.phase='outpost';state.core.players['0'].locationId='miyama';state.core.players['0'].mana=8;state.core.battlefield.miyama.playerIds=['0'];for(const location of Object.values(state.core.battlefield))location.eventCards=[];state.core.currentEvents={miyama:[],shinto:[]};return state;}
it('韦伯战略部署在前哨花1魔力抽2，一轮仅一次',()=>{
 let state=fixture('m_waver');const skillId=state.core.players['0'].skills.find(skill=>skill.name==='战略部署')!.id;
 const command={type:'PLAY_SKILL',playerId:'0',payload:{skillId}} as const;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);const count=state.core.players['0'].hand.length;state=adapter.execute(state,command).state;
 expect(state.core.players['0'].hand).toHaveLength(count+2);expect(state.core.players['0'].mana).toBe(7);expect(FateDominationDomain.validate(state,command).valid).toBe(false);
});
it('绮礼随真名切换，监督者支付2至侦察，执行者战斗加2',()=>{
 let state=fixture('m_kirei');state.core.phase='action';
 const supervisor=state.core.players['0'].skills.find(skill=>skill.name==='监督者')!.id;
 const command={type:'PLAY_SKILL',playerId:'0',payload:{skillId:supervisor,targetLocationId:'recon'}} as const;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);state=adapter.execute(state,command).state;
 expect(state.core.players['0'].locationId).toBe('recon');expect(state.core.players['0'].mana).toBe(6);
 state.core.players['0'].isRevealed=true;expect(FateDominationDomain.validate(state,command).valid).toBe(false);
 state.core.phase='battle';const skillId=state.core.players['0'].skills.find(skill=>skill.name==='执行者')!.id;const before=calculateFatePower(state.core,'0',[]);
 expect(FateDominationDomain.validate(state,{type:'PLAY_SKILL',playerId:'0',payload:{skillId}}).valid).toBe(true);
 state=adapter.execute(state,{type:'PLAY_SKILL',playerId:'0',payload:{skillId}}).state;expect(calculateFatePower(state.core,'0',[])).toBe(before+2);
});
it('只有监督者获知他人隐藏职阶，不因此获知真名或技能',()=>{
 const state=fixture('m_kirei');const view=projectFatePlayerView(state.core,'0');
 expect(view.players['1'].publicView?.servantClass).toBeTruthy();expect(view.players['1'].servantId).toBe('');
 expect(projectFatePlayerView(state.core,'2').players['1'].publicView?.servantClass).toBeUndefined();
 state.core.players['0'].isRevealed=true;expect(projectFatePlayerView(state.core,'0').players['1'].publicView?.servantClass).toBeUndefined();
});
it('御主费用与阶段校验不会借同名s2让其他御主发动',()=>{
 for(const masterId of ['m_waver','m_kirei']){
  const state=fixture(masterId);state.core.phase=masterId==='m_waver'?'outpost':'action';state.core.players['0'].mana=0;
  const skillId=state.core.players['0'].skills.find(skill=>skill.id.startsWith('s2:'))!.id;
  const command={type:'PLAY_SKILL',playerId:'0',payload:{skillId,targetLocationId:'recon'}} as const;
  expect(FateDominationDomain.validate(state,command).valid).toBe(false);
 }
 const other=fixture('m_shirou_emiya');const skillId=other.core.players['0'].skills.find(skill=>skill.id.startsWith('s2:'))!.id;
 expect(FateDominationDomain.validate(other,{type:'PLAY_SKILL',playerId:'0',payload:{skillId}}).valid).toBe(false);
});
it('没有从者的绮礼是执行者，不继续获知其他隐藏职阶',()=>{
 const state=fixture('m_kirei');state.core.players['0'].servantId='';
 expect(projectFatePlayerView(state.core,'0').players['1'].publicView?.servantClass).toBeUndefined();
 state.core.phase='battle';const skillId=state.core.players['0'].skills.find(skill=>skill.name==='执行者')!.id;
 expect(FateDominationDomain.validate(state,{type:'PLAY_SKILL',playerId:'0',payload:{skillId}}).valid).toBe(true);
});
it('前哨部署不会结束个人阶段，韦伯可用部署所得魔力抽牌后明确结束',()=>{
 let state=adapter.setup(['0','1','2']);state=adapter.execute(state,{type:'SELECT_MASTER',playerId:'0',payload:{masterId:'m_waver'}}).state;
 for(const playerId of ['0','1','2'])state=adapter.execute(state,{type:'ADVANCE_PHASE',playerId,payload:{}}).state;
 state.core.players['0'].mana=0;
 expect(FateDominationDomain.validate(state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}}).valid).toBe(false);
 state=adapter.execute(state,{type:'DEPLOY_MASTER',playerId:'0',payload:{locationId:'workshop'}}).state;
 expect(state.core.currentPlayerId).toBe('0');expect(state.core.phase).toBe('outpost');
 const skillId=state.core.players['0'].skills.find(skill=>skill.name==='战略部署')!.id;const command={type:'PLAY_SKILL',playerId:'0',payload:{skillId}} as const;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);state=adapter.execute(state,command).state;
 expect(FateDominationDomain.validate(state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}}).valid).toBe(true);
 state=adapter.execute(state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}}).state;expect(state.core.currentPlayerId).toBe('1');
});
it('同御主能力的实例属于各自玩家，不会覆盖另一人的威力修正',()=>{
 let state=adapter.setup(['0','1','2']);for(const playerId of ['0','1'])state=adapter.execute(state,{type:'SELECT_MASTER',playerId,payload:{masterId:'m_kirei'}}).state;
 state.core.phase='battle';for(const playerId of ['0','1']){state.core.players[playerId].isRevealed=true;state.core.players[playerId].locationId='miyama';}
 state.core.battlefield.miyama.playerIds=['0','1'];
 const before=['0','1'].map(id=>calculateFatePower(state.core,id,[]));
 for(const playerId of ['0','1']){state.core.currentPlayerId=playerId;const skillId=state.core.players[playerId].skills.find(skill=>skill.name==='执行者')!.id;state=adapter.execute(state,{type:'PLAY_SKILL',playerId,payload:{skillId}}).state;}
 for(const [index,id] of ['0','1'].entries())expect(calculateFatePower(state.core,id,[])).toBe(before[index]+2);
});
