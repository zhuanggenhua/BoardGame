import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { projectFatePlayerView } from '../domain/playerView';
const setupWithInitialHands = (seed: string) => {
 const adapter=createReplayAdapter(FateDominationDomain,seed);
 let state=adapter.setup(['0','1','2']);
 for(const playerId of ['0','1','2']){
  const identity=state.core.players[playerId];
  state=adapter.execute(state,{type:'SELECT_MASTER',playerId,payload:{masterId:identity.masterId}}).state;
  state=adapter.execute(state,{type:'SELECT_SERVANT',playerId,payload:{servantId:identity.servantId}}).state;
  state=adapter.execute(state,{type:'ADVANCE_PHASE',playerId,payload:{}}).state;
  expect(state.core.players[playerId].hand).toHaveLength(3);
 }
 expect(state.core.phase).toBe('outpost');
 return state.core;
};
it('对手只投影公开出牌和数量，不泄露剩余手牌、弃牌、牌库或未解放从者', () => {
 const core = setupWithInitialHands('fate-public-view');
 core.players['1'].activeAttackIds = [core.players['1'].hand[0].id];
 const view = projectFatePlayerView(core, '0');
 expect(view.players['0']).toBe(core.players['0']);
 expect(view.players['1'].hand).toEqual([]);
 expect(view.players['1'].deck).toEqual([]);
 expect(view.players['1'].discard).toEqual([]);
 expect(view.players['1'].servantId).toBe('');
 expect(view.players['1'].skills).toEqual([]);
 expect(view.players['1'].publicView?.playedCards).toEqual([core.players['1'].hand[0]]);
 expect(view.players['1'].publicView?.handCount).toBe(core.players['1'].hand.length-1);
 expect(core.players['1'].servantId).not.toBe('');
});
it('真名解放后可看从者；观战仍不得看任何人的私有手牌', () => {
 const core = setupWithInitialHands('fate-public-view');
 core.players['1'].isRevealed = true;
 const view = projectFatePlayerView(core, undefined);
 expect(view.players['1'].servantId).toBe(core.players['1'].servantId);
 expect(view.players['0'].hand).toEqual([]);
});
it('对手抽屉沿用正式打出顺序，暂选不提前泄露或减少公开手牌数', () => {
 const core=setupWithInitialHands('public-order');
 const player=core.players['1'];player.activeAttackIds=[player.hand[1].id,player.hand[0].id];player.selectedAttackIds=[player.hand[2].id];
 const view=projectFatePlayerView(core,'0').players['1'];
 expect(view.publicView?.playedCards?.map(card=>card.id)).toEqual(player.activeAttackIds);
 expect(view.publicView?.handCount).toBe(player.hand.length-2);
 expect(view.selectedAttackIds).toEqual([]);
});
it('基础暗置事件遮罩、额外明置事件公开，普通视角拿不到事件库牌序', () => {
 const core=createReplayAdapter(FateDominationDomain,'hidden-event-zones').setup(['0','1','2']).core;
 core.battlefield.shinto.eventCards=[...core.currentEvents.shinto];
 for(const viewer of ['0','1',null]) {
  const view=projectFatePlayerView(core,viewer);
  expect(view.eventDeck).toEqual([]);
  expect(view.eventDeckCount).toBe(core.eventDeckCount);
  expect(view.currentEvents.shinto[0].id).toBe('hidden-shinto-event');
  expect(view.currentEvents.shinto.slice(1)).toEqual(core.currentEvents.shinto.slice(1));
  expect(view.battlefield.shinto.eventCards).toEqual(view.currentEvents.shinto);
  expect(view.publicView?.shintoEventCount).toBe(core.currentEvents.shinto.length);
 }
 expect(core.eventDeck.length).toBeGreaterThan(0);
 expect(core.currentEvents.shinto.length).toBeGreaterThan(0);
 core.shintoEventFaceDown=false;
 const revealed=projectFatePlayerView(core,'0');
 expect(revealed.currentEvents.shinto).toEqual(core.currentEvents.shinto);
 expect(revealed.battlefield.shinto.eventCards).toEqual(core.battlefield.shinto.eventCards);
 expect(revealed.eventDeck).toEqual([]);
});
it('已明置技能独立于从者真名公开，公开出牌包含激活技能且不泄露另外两张',()=>{
 const core=createReplayAdapter(FateDominationDomain,'public-active-skill').setup(['0','1','2']).core;
 const player=core.players['1'];const skill=player.skills.find(skill=>skill.id.startsWith('sc_'))!;
 player.activeSkills=[skill.id];player.revealedSkillIds=[skill.id];player.isRevealed=false;
 const projected=projectFatePlayerView(core,'0').players['1'];
 expect(projected.servantId).toBe('');
 expect(projected.publicView?.playedSkills.map(card=>card.id)).toEqual([skill.id]);
 expect(projected.publicView?.skillCards.filter(Boolean)).toHaveLength(1);
 expect(projected.publicView?.skillCards.find(Boolean)?.name).toBe(skill.name);
 player.activeSkills=[];
 const returned=projectFatePlayerView(core,'0').players['1'];
 expect(returned.publicView?.playedSkills).toEqual([]);
 expect(returned.publicView?.skillCards.filter(Boolean)).toHaveLength(1);
});
