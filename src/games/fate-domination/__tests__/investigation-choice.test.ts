import {expect,it} from 'vitest';
import {createInitialSystemState,createSeededRandom,executePipeline} from '../../../engine';
import {applyPlayerViewToState} from '../../../engine/ai/playerView';
import {FATE_MASTERS} from '../data';
import {FateDominationDomain} from '../domain';
import {FATE_INVESTIGATION_KEEP} from '../domain/investigationChoice';
import {engineConfig} from '../game';
import {buildFateAiLegalActions} from '../ai';

function game(){
 const ids=['0','1','2'],random=createSeededRandom('investigation');
 const state={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'investigation')};
 const waver=FATE_MASTERS.find(master=>master.id==='m_waver')!;
 const actor=state.core.players['0'];actor.masterId=waver.id;actor.skills=waver.skills!.map((skill,index)=>({...skill,id:`${skill.id}:${index}`}));
 state.core.phase='outpost';state.core.currentPlayerId='0';
 const target=state.core.players['1'];target.hand=[{id:'private-1',definitionId:'cardB1'},{id:'private-2',definitionId:'cardQ1'}];target.deck=[{id:'deck-1',definitionId:'cardB2'}];
 const skill=actor.skills.find(item=>item.id.startsWith('s3:'))!;
 const run=(input:typeof state,playerId:string,type:string,payload:object)=>executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},input,{type,playerId,payload},random,ids);
 return {state,skill,run};
}
it('调查查看目标手牌，选牌置于拥有者牌库顶并限制下一回合',()=>{
 const {state,skill,run}=game();
 expect(run(state,'0','PLAY_SKILL',{skillId:skill.id}).success).toBe(false);
 const started=run(state,'0','PLAY_SKILL',{skillId:skill.id,targetPlayerId:'1'});
 expect(started.success,started.error).toBe(true);
 const interaction=started.state.sys.interaction.current!;
 expect(interaction.data.sourceId).toBe('fate:investigation-choice');
 expect(interaction.data.options.map(option=>option.id)).toEqual(['private-1','private-2',FATE_INVESTIGATION_KEEP]);
 const ownerView=applyPlayerViewToState(engineConfig,started.state,'0');
 expect(buildFateAiLegalActions({playerId:'0',state:ownerView}).filter(action=>action.kind==='investigation-choice')).toHaveLength(3);
 expect(started.state.sys.undo.snapshots).toEqual([]);
 const other=applyPlayerViewToState(engineConfig,started.state,'2');
 expect(JSON.stringify(other)).not.toContain('private-1');
 expect(run(started.state,'2','SYS_INTERACTION_RESPOND',{interactionId:interaction.id,optionId:'private-1'}).success).toBe(false);
 const done=run(started.state,'0','SYS_INTERACTION_RESPOND',{interactionId:interaction.id,optionId:'private-1'});
 expect(done.success,done.error).toBe(true);
 expect(done.state.core.players['1'].hand.map(card=>card.id)).toEqual(['private-2']);
 expect(done.state.core.players['1'].deck.map(card=>card.id)).toEqual(['private-1','deck-1']);
 expect(done.state.core.players['0'].investigationBlockedRound).toBe(state.core.round+1);
 expect(done.state.sys.interaction.current).toBeUndefined();
 expect(run(done.state,'0','SYS_INTERACTION_RESPOND',{interactionId:interaction.id,optionId:'private-1'}).success).toBe(false);
 const next=structuredClone(done.state);next.core.round++;next.core.players['0'].usedAbilityIds=[];
 expect(run(next,'0','PLAY_SKILL',{skillId:skill.id,targetPlayerId:'1'}).success).toBe(false);
});
it('调查可以不调整手牌，不触发下回合限制',()=>{
 const {state,skill,run}=game();const started=run(state,'0','PLAY_SKILL',{skillId:skill.id,targetPlayerId:'1'});
 expect(started.success,started.error).toBe(true);const interaction=started.state.sys.interaction.current!;
 const done=run(started.state,'0','SYS_INTERACTION_RESPOND',{interactionId:interaction.id,optionId:FATE_INVESTIGATION_KEEP});
 expect(done.success,done.error).toBe(true);
 expect(done.state.core.players['1'].hand).toEqual(state.core.players['1'].hand);
 expect(done.state.core.players['0'].investigationBlockedRound).toBeUndefined();
});
it('调查自己时放回本人牌库顶，手牌与牌库均正确更新',()=>{
 const {state,skill,run}=game();
 state.core.players['0'].hand=[{id:'own-private-1',definitionId:'cardB1'}];
 const card=state.core.players['0'].hand[0];
 const started=run(state,'0','PLAY_SKILL',{skillId:skill.id,targetPlayerId:'0'});
 expect(started.success,started.error).toBe(true);
 const interaction=started.state.sys.interaction.current!;
 const done=run(started.state,'0','SYS_INTERACTION_RESPOND',{interactionId:interaction.id,optionId:card.id});
 expect(done.success,done.error).toBe(true);
 expect(done.state.core.players['0'].hand.some(item=>item.id===card.id)).toBe(false);
 expect(done.state.core.players['0'].deck[0].id).toBe(card.id);
 expect(done.state.core.players['0'].investigationBlockedRound).toBe(state.core.round+1);
});
it('调查空手牌仍可保留，淘汰玩家不可被调查',()=>{
 const {state,skill,run}=game();state.core.players['1'].hand=[];
 const started=run(state,'0','PLAY_SKILL',{skillId:skill.id,targetPlayerId:'1'});
 expect(started.success,started.error).toBe(true);
 const interaction=started.state.sys.interaction.current!;
 expect(interaction.data.options.map(option=>option.id)).toEqual([FATE_INVESTIGATION_KEEP]);
 const done=run(started.state,'0','SYS_INTERACTION_RESPOND',{interactionId:interaction.id,optionId:FATE_INVESTIGATION_KEEP});
 expect(done.success,done.error).toBe(true);
 expect(done.state.core.players['0'].investigationBlockedRound).toBeUndefined();
 const eliminated=structuredClone(state);eliminated.core.players['1'].eliminated=true;
 expect(run(eliminated,'0','PLAY_SKILL',{skillId:skill.id,targetPlayerId:'1'}).success).toBe(false);
});
