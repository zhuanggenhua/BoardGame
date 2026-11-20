import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { calculateFatePower } from '../domain/power';
import { projectFatePlayerView } from '../domain/playerView';
import type { FateDominationCommand } from '../domain';
import { engineConfig } from '../game';
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

it.each(['workshop', 'miyama'] as const)('手牌不足以完成常规出牌，在 %s 合法结束行动', location => {
    const state = fixture(location);
    state.core.players['0'].hand.pop();
    const pass = { type: 'PASS_ACTION', playerId: '0', payload: {} } as const;
    expect(FateDominationDomain.validate(state, pass).valid).toBe(true);
    const result = adapter.execute(state, pass);
    const opponentView = projectFatePlayerView(result.state.core, '1').players['0'];
    expect(opponentView.hasPassedAction).toBe(true);
    expect(opponentView.forcedRevealedHand.map(card => card.definitionId)).toEqual(location === 'miyama' ? ['cardB4'] : []);
    expect(opponentView.forcedRevealedHand.every(card => card.id !== 'expensive-a')).toBe(true);
    expect(opponentView.publicView?.playedCards).toEqual([]);
    expect(opponentView.hand).toEqual([]);
});

it('战场全暗置公开手牌后，不能申请撤回到公开前', () => {
    const { core } = fixture('miyama');
    const ids = core.playerIds;
    const random = createSeededRandom('reveal-before-undo');
    const config = { domain: FateDominationDomain, systems: engineConfig.systems };
    const state = { core, sys: createInitialSystemState(ids, engineConfig.systems, 'reveal-before-undo') };
    const spell = executePipeline(config, state, { type: 'USE_COMMAND_SPELL', playerId: '0', payload: { effect: 'battle' } }, random, ids);
    expect(spell.success, spell.error).toBe(true);
    expect(spell.state.sys.undo.snapshots).toHaveLength(1);
    const cardIds = ['expensive-a', 'expensive-b'];
    const confirm = executePipeline(config, spell.state, { type: 'CONFIRM_ATTACK', playerId: '0', payload: { cardIds, faceDownIds: cardIds, round: core.round } }, random, ids);
    expect(confirm.success, confirm.error).toBe(true);
    expect(confirm.state.core.players['0'].forcedRevealedHand).toHaveLength(2);
    const undo = executePipeline(config, confirm.state, { type: 'SYS_REQUEST_UNDO', playerId: '0', payload: { localAutoApprove: true } }, random, ids);
    expect(undo.success).toBe(false);
    expect(undo.state.sys.undo.snapshots).toHaveLength(0);
    expect(undo.state.core.players['0'].forcedRevealedHand).toHaveLength(2);
});
