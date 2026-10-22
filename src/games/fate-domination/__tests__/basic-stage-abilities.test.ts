import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { calculateFatePower } from '../domain/power';
import { hasDirectDefeatProtection } from '../domain/mechanics';
const adapter=createReplayAdapter(FateDominationDomain,'basic-abilities');
function fixture(){const state=adapter.setup(['0','1','2']);state.core.phase='action';const player=state.core.players['0'];player.locationId='miyama';player.deploymentSlot=0;player.hand=[{id:'remote',definitionId:'cardPreparation'},{id:'rush',definitionId:'cardSurveil'},{id:'luck',definitionId:'cardluck'}];player.activeAttackIds=player.hand.map(card=>card.id);for(const location of Object.values(state.core.battlefield)){location.eventCards=[];location.playerIds=[];}state.core.battlefield.miyama.playerIds=['0'];state.core.currentEvents={miyama:[],shinto:[]};return state;}
it('基础远隔操作行动地利翻倍和战斗获胜奖励分开使用，各阶段一次',()=>{
 let state=fixture();const before=calculateFatePower(state.core,'0',state.core.players['0'].activeAttackIds);
 const command={type:'PLAY_SKILL',playerId:'0',payload:{skillId:'remote'}} as const;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);state=adapter.execute(state,command).state;
 expect(calculateFatePower(state.core,'0',state.core.players['0'].activeAttackIds)).toBe(before+3);
 expect(FateDominationDomain.validate(state,command).valid).toBe(false);
 state.core.phase='battle';expect(FateDominationDomain.validate(state,command).valid).toBe(true);state=adapter.execute(state,command).state;
 expect(state.core.ruleState.modifiers.some(mod=>mod.kind==='battle-win-reward'&&mod.victoryPoints===2)).toBe(true);
});
it('急行只能沿箭头移到下一地点，不是任意免费终点',()=>{
 let state=fixture();
 expect(FateDominationDomain.validate(state,{type:'PLAY_SKILL',playerId:'0',payload:{skillId:'rush',targetLocationId:'recon'}}).valid).toBe(false);
 const command={type:'PLAY_SKILL',playerId:'0',payload:{skillId:'rush',targetLocationId:'shinto'}} as const;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);const mana=state.core.players['0'].mana;state=adapter.execute(state,command).state;
 expect(state.core.players['0'].locationId).toBe('shinto');expect(state.core.players['0'].mana).toBe(mana);
});
it('幸运战斗能力从真实已打出手牌发动；暗置牌不能发动',()=>{
 let state=fixture();state.core.phase='battle';const command={type:'PLAY_SKILL',playerId:'0',payload:{skillId:'luck'}} as const;
 expect(FateDominationDomain.validate(state,command).valid).toBe(true);state=adapter.execute(state,command).state;
 expect(hasDirectDefeatProtection(state.core,'0')).toBe(true);
 state=fixture();state.core.phase='battle';state.core.players['0'].faceDownAttackIds=['luck'];
 expect(FateDominationDomain.validate(state,command).valid).toBe(false);
});
