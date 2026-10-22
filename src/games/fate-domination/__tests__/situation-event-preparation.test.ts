import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FATE_SITUATIONS } from '../data';
import { projectFatePlayerView } from '../domain/playerView';
import { execute } from '../domain/reducer';
import type { RandomFn } from '../../../engine/types';
const random:RandomFn={random:()=>.5,d:()=>1,range:min=>min,shuffle:cards=>[...cards]};
it('转机额外明置事件与基础新都暗置事件分开，韦伯私看不全局翻明',()=>{
 const state=createReplayAdapter(FateDominationDomain,'extra-events').setup(['0','1','2']);
 state.core.phase='battle';state.core.battleResolution={frameId:'test',round:1,locationIds:[],resolvedLocationIds:[],step:'awards'};
 state.core.situationDeck=[FATE_SITUATIONS.find(s=>s.id==='sit1')!];
 const events=execute(state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}},random);
 const next=events.reduce(FateDominationDomain.reduce,state.core);
 expect(next.currentEvents.miyama).toHaveLength(2);expect(next.currentEvents.shinto).toHaveLength(2);
 const publicView=projectFatePlayerView(next,'1');
 expect(publicView.currentEvents.shinto).toHaveLength(2);
 expect(publicView.currentEvents.shinto[0].id).toBe('hidden-shinto-event');
 expect(publicView.currentEvents.shinto[1]).toEqual(next.currentEvents.shinto[1]);
 next.players['1'].masterId='m_waver';expect(projectFatePlayerView(next,'1').currentEvents.shinto).toEqual(next.currentEvents.shinto);
 expect(next.shintoEventFaceDown).toBe(true);
});
it('后两高潮封闭新都侦察并限制工房部署一人',()=>{
 const state=createReplayAdapter(FateDominationDomain,'late-climax').setup(['0','1','2']);state.core.phase='outpost';state.core.situation=FATE_SITUATIONS.find(s=>s.id==='sit12')!;
 expect(FateDominationDomain.validate(state,{type:'DEPLOY_MASTER',playerId:'0',payload:{locationId:'shinto'}}).valid).toBe(false);
 state.core.battlefield.workshop.playerIds=['1'];state.core.players['1'].locationId='workshop';
 expect(FateDominationDomain.validate(state,{type:'DEPLOY_MASTER',playerId:'0',payload:{locationId:'workshop'}}).valid).toBe(false);
 state.core.phase='action';state.core.players['0'].locationId='miyama';
 expect(FateDominationDomain.validate(state,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'move',targetLocationId:'recon'}}).valid).toBe(false);
});
it('暗置事件不能通过前哨公开威力侧漏，韦伯仍可私下看到完整效果',()=>{
 const core=createReplayAdapter(FateDominationDomain,'private-power').setup(['0','1','2']).core;
 core.phase='outpost';core.players['0'].locationId='shinto';core.players['0'].deploymentSlot=0;
 const hidden={id:'fuyuki_E13',name:'偷袭',assetPath:'test',victoryPoints:2,sourceStatus:'verified' as const};
 core.currentEvents.shinto=[hidden];core.battlefield.shinto.eventCards=[hidden];
 expect(projectFatePlayerView(core,'1').players['0'].publicView?.power).toBe(3);
 core.players['1'].masterId='m_waver';expect(projectFatePlayerView(core,'1').players['0'].publicView?.power).toBe(8);
});
