import {expect,it} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {FATE_SERVANTS} from '../data';
import {calculateFatePower} from '../domain/power';
import type {FateDominationCommand} from '../domain';
const adapter=createReplayAdapter(FateDominationDomain,'normal-attack-contract');
const fixture=()=>{
 const state=adapter.setup(['0','1','2']);
 state.core.phase='action';state.core.currentPlayerId='0';
 const player=state.core.players['0'];player.locationId='miyama';player.mana=12;
 state.core.battlefield.miyama.playerIds=['0'];state.core.battlefield.miyama.terrainPower=0;
 const servant=FATE_SERVANTS.find(s=>(s.skillCards??[]).some(c=>c.id==='sc_cu_2'))!;
 player.servantId=servant.id;player.skills=servant.skillCards!.map(s=>({...s}));
 player.hand=[{id:'basic','definitionId':'cardB1'},{id:'other','definitionId':'cardB2'}];
 return state;
};
const command=(type:string,payload:unknown):FateDominationCommand=>({type,playerId:'0',payload,timestamp:1} as FateDominationCommand);
it('普通攻击与技能攻击共同占常规两张，激活不自动发动阶段能力或结束行动',()=>{
 let state=fixture();
 state=adapter.execute(state,command('SELECT_ATTACK_CARD',{cardId:'basic'})).state;
 const select=command('SELECT_ATTACK_CARD',{cardId:'sc_cu_2'});
 expect(FateDominationDomain.validate(state,select).valid).toBe(true);
 state=adapter.execute(state,select).state;
 const before=state.core.players['0'].mana;
 state=adapter.execute(state,command('CONFIRM_ATTACK',{})).state;
 expect(state.core.players['0'].activeSkills).toContain('sc_cu_2');
 expect(state.core.players['0'].activeAttackIds).toEqual(['basic']);
 expect(state.core.players['0'].mana).toBe(before-3);
 expect(state.core.players['0'].locationId).toBe('miyama');
 expect(state.core.currentPlayerId).toBe('0');expect(state.core.phase).toBe('action');
 const use=command('PLAY_SKILL',{skillId:'sc_cu_2',targetLocationId:'shinto'});
 expect(FateDominationDomain.validate(state,use).valid).toBe(true);
 const moved=adapter.execute(state,use).state;
 expect(moved.core.players['0'].locationId).toBe('shinto');
 expect(moved.core.players['0'].mana).toBe(before-3);
 expect(FateDominationDomain.validate(moved,command('PLAY_SKILL',{skillId:'sc_cu_2',targetLocationId:'recon'})).valid).toBe(false);
});
it('未激活的非被动技能不能直接发动，技能区攻击要求出牌前至少八魔力',()=>{
 const state=fixture();
 expect(FateDominationDomain.validate(state,command('PLAY_SKILL',{skillId:'sc_cu_2',targetLocationId:'shinto'})).valid).toBe(false);
 state.core.players['0'].mana=7;
 expect(FateDominationDomain.validate(state,command('SELECT_ATTACK_CARD',{cardId:'sc_cu_2'})).valid).toBe(false);
});
it('狂化兰斯洛特的被动允许低于8魔力打出从者技能，但仍须支付牌面魔耗',()=>{
 const state=fixture();const player=state.core.players['0'];const berserker=FATE_SERVANTS.find(servant=>servant.id==='servant-berserker')!;
 player.servantId=berserker.id;player.skills=berserker.skillCards!.map(skill=>({...skill}));player.mana=7;
 const select=command('SELECT_ATTACK_CARD',{cardId:'sc_lance_1'});
 expect(FateDominationDomain.validate(state,select).valid).toBe(true);
 expect(FateDominationDomain.validate(state,command('SELECT_ATTACK_CARD',{cardId:'sc_lance_2'}))).toMatchObject({valid:false,error:'staleCard'});
 player.mana=3;
 expect(FateDominationDomain.validate(state,select)).toMatchObject({valid:false,error:'notEnoughMana'});
 player.mana=8;
 expect(FateDominationDomain.validate(state,command('SELECT_ATTACK_CARD',{cardId:'sc_lance_2'}))).toMatchObject({valid:false,error:'staleCard'});
});
it('激活技能的印刷威力计入合计威力',()=>{
 const state=fixture();const before=calculateFatePower(state.core,'0',[]);
 state.core.players['0'].activeSkills=['sc_cu_2'];
 expect(calculateFatePower(state.core,'0',[])-before).toBe(5);
});
it('有合法常规两张时不能直接结束行动；打出后由玩家主动结束',()=>{
 let state=fixture();
 expect(FateDominationDomain.validate(state,command('PASS_ACTION',{})).valid).toBe(false);
 state=adapter.execute(state,command('SELECT_ATTACK_CARD',{cardId:'basic'})).state;
 state=adapter.execute(state,command('SELECT_ATTACK_CARD',{cardId:'other'})).state;
 state=adapter.execute(state,command('CONFIRM_ATTACK',{})).state;
 expect(FateDominationDomain.validate(state,command('PASS_ACTION',{})).valid).toBe(true);
});
it('历史技能事件仍按原合同扣费并激活，旧快照不会重复发动已用能力',()=>{
 const state=fixture();state.core.players['0'].mana=12;
 const core=FateDominationDomain.reduce(state.core,{type:'SKILL_PLAYED',payload:{playerId:'0',skillId:'sc_cu_2',manaSpent:3},timestamp:1});
 expect(core.players['0'].mana).toBe(9);expect(core.players['0'].activeSkills).toContain('sc_cu_2');
 const old=structuredClone({...state,core});delete (old.core.players['0'] as Partial<typeof old.core.players['0']>).usedAbilityIds;
 const migrated=FateDominationDomain.normalizeRuntimeState!(old);
 expect(migrated.core.players['0'].usedAbilityIds).toContain('sc_cu_2');
 expect(FateDominationDomain.validate(migrated,command('PLAY_SKILL',{skillId:'sc_cu_2',targetLocationId:'shinto'})).valid).toBe(false);
});

it('客户端一次确认提交两张实例，无需提前写入选择事件',()=>{
 const state=fixture();const before=structuredClone(state);
 const confirm=command('CONFIRM_ATTACK',{cardIds:['basic','other'],faceDownIds:[],round:state.core.round});
 expect(FateDominationDomain.validate(state,confirm).valid).toBe(true);
 const result=adapter.execute(state,confirm);
 expect(result.events.filter(event=>event.type==='ATTACK_CARD_SELECTED')).toHaveLength(0);
 expect(result.events.filter(event=>event.type==='ATTACKS_CONFIRMED')).toHaveLength(1);
 expect(result.state.core.players['0'].activeAttackIds).toEqual(['basic','other']);
 expect(result.state.core.players['0'].normalAttackPlayed).toBe(true);
 expect(state).toEqual(before);
 expect(FateDominationDomain.validate(result.state,confirm).valid).toBe(false);
});
it('原子确认拒绝重复实例、越界暗置和过期回合，不能回退到旧选择',()=>{
 let state=fixture();
 state=adapter.execute(state,command('SELECT_ATTACK_CARD',{cardId:'basic'})).state;
 state=adapter.execute(state,command('SELECT_ATTACK_CARD',{cardId:'other'})).state;
 for(const payload of [
  {cardIds:['basic','basic'],faceDownIds:[],round:state.core.round},
  {cardIds:['basic','other'],faceDownIds:['missing'],round:state.core.round},
  {cardIds:['basic','other'],faceDownIds:['basic','basic'],round:state.core.round},
  {cardIds:['basic','other'],faceDownIds:[],round:state.core.round+1},
  {cardIds:['basic','other']},
 ]) expect(FateDominationDomain.validate(state,command('CONFIRM_ATTACK',payload)).valid,JSON.stringify(payload)).toBe(false);
 expect(FateDominationDomain.validate(state,command('CONFIRM_ATTACK',{})).valid).toBe(true);
});
it('原子混合出牌与旧选择路径等价，费用变化后重验，旧失效选择不会阻止结束',()=>{
 const initial=fixture();
 const atomic=command('CONFIRM_ATTACK',{cardIds:['basic','sc_cu_2'],faceDownIds:[],round:initial.core.round});
 expect(FateDominationDomain.validate(initial,atomic).valid).toBe(true);
 const direct=adapter.execute(initial,atomic).state;
 let legacy=adapter.execute(initial,command('SELECT_ATTACK_CARD',{cardId:'basic'})).state;
 legacy=adapter.execute(legacy,command('SELECT_ATTACK_CARD',{cardId:'sc_cu_2'})).state;
 legacy=adapter.execute(legacy,command('CONFIRM_ATTACK',{})).state;
 expect(direct.core).toEqual(legacy.core);
 const changed=structuredClone(initial);changed.core.players['0'].mana=0;
 expect(FateDominationDomain.validate(changed,atomic).valid).toBe(false);
 // Old saved drafts are UI intent, not a reason to trap a player with no legal normal play.
 changed.core.players['0'].hand=[];changed.core.players['0'].skills=[];
 changed.core.players['0'].selectedAttackIds=['removed'];
 changed.core.players['0'].selectedFaceDownIds=['removed'];
 const pass=command('PASS_ACTION',{});
 expect(FateDominationDomain.validate(changed,pass).valid).toBe(true);
 const passed=adapter.execute(changed,pass).state;
 expect(passed.core.players['0'].selectedAttackIds).toEqual([]);
 expect(passed.core.players['0'].selectedFaceDownIds).toEqual([]);
});
