import {expect,it} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {calculateFatePower} from '../domain/power';
import {projectFateSkillCards} from '../domain/playerView';
const adapter=createReplayAdapter(FateDominationDomain,'command-spell-contract');
function start(){const state=adapter.setup(['0','1','2']);state.core.phase='action';state.core.players['0'].locationId='miyama';state.core.battlefield.miyama.playerIds=['0','1'];state.core.players['1'].locationId='miyama';return state;}
it('一枚令咒只消耗一次并获得四点魔力，令咒不足时拒绝',()=>{
 const state=start(),before=state.core.players['0'].mana;
 const command={type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'mana'}} as const;
 const next=adapter.execute(state,command).state;
 expect(next.core.players['0'].mana).toBe(before+4);expect(next.core.players['0'].commandSpells).toBe(2);
 next.core.players['0'].commandSpells=0;
 expect(FateDominationDomain.validate(next,command)).toEqual({valid:false,error:'noCommandSpells'});
});
it('狂化兰斯洛特失去最后一枚令咒时自动解放真名并公开从者技能',()=>{
 let state=start();
 state=adapter.execute(state,{type:'SELECT_SERVANT',playerId:'0',payload:{servantId:'servant-berserker'}}).state;
 state.core.players['0'].commandSpells=2;
 state=adapter.execute(state,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'mana'}}).state;
 expect(state.core.players['0'].isRevealed).toBe(false);
 expect(projectFateSkillCards(state.core.players['0'],'1').every(skill=>skill===null)).toBe(true);
 state=adapter.execute(state,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'mana'}}).state;
 expect(state.core.players['0'].commandSpells).toBe(0);
 expect(state.core.players['0'].isRevealed).toBe(true);
 expect(projectFateSkillCards(state.core.players['0'],'1').every(skill=>skill!==null)).toBe(true);
});
it('战斗令咒提升威力并登记本回合胜利奖励，不立即发战果',()=>{
 const state=start(),before=calculateFatePower(state.core,'0',[]);
 const next=adapter.execute(state,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'battle'}}).state;
 expect(calculateFatePower(next.core,'0',[])).toBe(before+2);
 expect(next.core.players['0'].victoryPoints).toBe(0);
 expect(next.core.ruleState.modifiers.some(item=>item.kind==='battle-win-reward' && item.victoryPoints===2 && item.duration==='round-end')).toBe(true);
});
it('移动令咒无视交战可返回工房，仍遵守地点容量且不扣魔力',()=>{
 const state=start(),before=state.core.players['0'].mana;
 state.core.currentEvents={miyama:[],shinto:[]};
 state.core.battlefield.miyama.eventCards=[];state.core.battlefield.shinto.eventCards=[];
 const next=adapter.execute(state,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'move',targetLocationId:'workshop'}}).state;
 expect(next.core.players['0'].locationId).toBe('workshop');expect(next.core.players['0'].mana).toBe(before);expect(next.core.players['0'].commandSpells).toBe(2);
 expect(FateDominationDomain.validate(next,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'move',targetLocationId:'shinto'}}).error).toBe('commandSpellMoveOrigin');
});
it('胜利奖励进入结算总分且回合结束清除，不把侦察算战斗胜利',()=>{
 let state=start();
 state=adapter.execute(state,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'battle'}}).state;
 state.core.phase='battle';
 state=adapter.execute(state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}}).state;
 state=adapter.execute(state,{type:'RESOLVE_LOCATION',playerId:'0',payload:{locationId:'miyama'}}).state;
 const result=state.core.resolvedResults.find(item=>item.playerId==='0')!;
 expect(result.commandSpellVictoryPoints).toBe(2);
 expect(result.totalVictoryPoints).toBe(result.eventVictoryPoints+result.competitionVictoryPoints+2);
 state=adapter.execute(state,{type:'RESOLVE_LOCATION',playerId:'0',payload:{locationId:'shinto'}}).state;
 state=adapter.execute(state,{type:'RESOLVE_LOCATION',playerId:'0',payload:{locationId:'recon'}}).state;
 expect(state.core.ruleState.modifiers.some(item=>item.source.sourceId==='command-spell')).toBe(false);
 expect(state.core.players['0'].victoryPoints).toBe(result.totalVictoryPoints);
});

it.each(['miyama','workshop'] as const)('正式提交令咒新都到%s保留效果移动上下文，不出现扣令咒却未移动', async targetLocationId=>{
 const {createInitialSystemState,createSeededRandom,executePipeline}=await import('../../../engine');
 const {engineConfig}=await import('../game');
 const state=start();
 state.core.currentEvents={miyama:[],shinto:[]};
 for(const location of Object.values(state.core.battlefield)){location.playerIds=[];location.eventCards=[];}
 state.core.players['0'].locationId='shinto';state.core.battlefield.shinto.playerIds=['0'];
 state.core.players['1'].locationId='miyama';state.core.battlefield.miyama.playerIds=['1'];
 state.sys=createInitialSystemState(state.core.playerIds,engineConfig.systems,'seal-event-commit');
 const before=state.core.players['0'];
 const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,
  {type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'move',targetLocationId},timestamp:1},
  createSeededRandom('seal-event-commit'),state.core.playerIds);
 expect(result.success).toBe(true);
 expect(result.state.core.players['0'].locationId).toBe(targetLocationId);
 expect(result.state.core.players['0'].commandSpells).toBe(before.commandSpells-1);
 expect(result.state.core.players['0'].mana).toBe(before.mana);
 expect(result.state.core.battlefield.shinto.playerIds).not.toContain('0');
 expect(result.state.core.battlefield[targetLocationId].playerIds.filter(id=>id==='0')).toHaveLength(1);
 expect(result.events.filter(event=>event.type==='PLAYER_MOVED')).toHaveLength(1);
});

it.each(['capacity','entry-lock','exit-lock'] as const)('正式提交仍拒绝%s且不扣令咒',async blocker=>{
 const {createInitialSystemState,createSeededRandom,executePipeline}=await import('../../../engine');
 const {engineConfig}=await import('../game');
 const state=start();state.core.currentEvents={miyama:[],shinto:[]};
 for(const location of Object.values(state.core.battlefield)){location.playerIds=[];location.eventCards=[];}
 state.core.players['0'].locationId='shinto';state.core.battlefield.shinto.playerIds=['0'];
 if(blocker==='capacity'){state.core.battlefield.miyama.capacity=1;state.core.battlefield.miyama.playerIds=['1'];state.core.players['1'].locationId='miyama';}
 else state.core.battlefield[blocker==='entry-lock'?'miyama':'shinto'].eventCards=[{id:'fuyuki_E16',name:'固有结界',assetPath:'test',victoryPoints:2,sourceStatus:'verified'}];
 state.sys=createInitialSystemState(state.core.playerIds,engineConfig.systems,'seal-blocked');
 const before=state.core.players['0'];
 const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,
 {type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'move',targetLocationId:'miyama'},timestamp:1},createSeededRandom('seal-blocked'),state.core.playerIds);
 expect(result.success).toBe(false);
 expect(result.state.core.players['0'].locationId).toBe('shinto');
 expect(result.state.core.players['0'].commandSpells).toBe(before.commandSpells);
 expect(result.state.core.players['0'].mana).toBe(before.mana);
});
