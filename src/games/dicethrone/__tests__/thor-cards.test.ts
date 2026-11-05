import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import { DiceThroneDomain } from '../domain';
import { reduce } from '../domain/reducer';
import { getCustomActionHandler, type CustomActionContext } from '../domain/effects';
import { getBonusDiceSettlementHandler } from '../domain/bonusDiceSettlement';
import { maybeCreateDamageResponseEvent } from '../domain/tokenResponse';
import { RESOURCE_IDS as R } from '../domain/resources';
import { TOKEN_IDS as T } from '../domain/ids';
import { COMMON_CARDS } from '../domain/commonCards';
import { THOR_CARDS, getThorStartingDeck } from '../heroes/thor/cards';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import { createHeroMatchup, createQueuedRandom, fixedRandom, testSystems } from './test-utils';

const scene=()=>createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
const cfg={domain:DiceThroneDomain,systems:testSystems};
const act=(state:DiceThroneCore,id:string,params:Record<string,number|boolean>={})=>getCustomActionHandler(id)!({state,attackerId:'0',targetId:'1',sourceAbilityId:id,timestamp:10,random:fixedRandom,action:{type:'custom',target:'self',customActionId:id,params},ctx:{state,attackerId:'0',defenderId:'1',sourceAbilityId:id,damageDealt:0}} as CustomActionContext);
const apply=(state:DiceThroneCore,events:DiceThroneEvent[])=>events.reduce(reduce,state);

describe('索尔物理牌、升级和最终效果',()=>{
 it('当之无愧原卡slot27只允许将自己一骰设为固定结果4或5',()=>{
   const state=scene().core;
   const ctx:CustomActionContext={state,attackerId:'0',targetId:'1',sourceAbilityId:'card-thor-worthy',timestamp:10,random:fixedRandom,action:{type:'custom',target:'self',customActionId:'thor-worthy'},ctx:{state,attackerId:'0',defenderId:'1',sourceAbilityId:'card-thor-worthy',damageDealt:0}};
   const actual=getCustomActionHandler('thor-worthy')!(ctx);
   const request=actual.find(event=>event.type==='INTERACTION_REQUESTED');
   expect(request?.type==='INTERACTION_REQUESTED'&&request.payload.interaction).toMatchObject({
     type:'modifyDie',selectCount:1,playerId:'0',diceOwnerId:'0',targetOpponentDice:false,
     dieModifyConfig:{mode:'set',allowedValues:[4,5]},
   });
 });
 it.each(COMMON_CARDS)('公共卡$id仅换正式卡图，费用/阶段/效果/条件保留共享合同',common=>{
   const actual=THOR_CARDS.find(card=>card.id===common.id)!;
   expect(actual).toEqual({...common,previewRef:actual.previewRef});
 });
 it.each([{away:false,heal:2,collateral:3},{away:true,heal:2,collateral:3},{away:false,heal:3,collateral:4},{away:true,heal:3,collateral:4}])('驭雷策电治疗$heal，附属$collateral，持锤在外=$away',({away,heal,collateral})=>{
   const state=scene().core;state.players['0'].resources[R.HP]=40;
   if(away){state.players['0'].tokens[T.MJOLNIR]=0;state.players['1'].tokens[T.MJOLNIR]=1;}
   const next=apply(state,act(state,'thor-mighty-summon',{heal,collateral}));
   expect(next.players['0'].resources[R.HP]).toBe(40+heal);
   expect(next.players['0'].tokens[T.GUARD_BREAK]).toBe(2);
   expect(next.players['0'].tokens[T.ELECTROKINESIS]).toBe(away?1:3);
   expect(next.players['1'].resources[R.HP]).toBe(away?50-collateral:50);
   expect(next.players['0'].tokens[T.MJOLNIR]).toBe(1);
 });
 it('常规牌库33张唯一牌，推广卡独立，34个图集槽位完整且不引用空槽',()=>{
   expect(getThorStartingDeck(fixedRandom)).toHaveLength(33);
   expect(new Set(THOR_CARDS.map(c=>c.id)).size).toBe(34);
   expect(THOR_CARDS.map(c=>c.previewRef?.type === 'atlas' ? c.previewRef.index : undefined).sort((a,b)=>a!-b!)).toEqual(Array.from({length:34},(_,i)=>i));
   expect(getThorStartingDeck(fixedRandom).some(c=>c.id==='card-thor-bifrost')).toBe(false);
 });
 it.each(THOR_CARDS.filter(c=>c.type==='upgrade').map(card=>({card})))('$card.id通过正式升级命令替换目标能力并扣对应费用',({card})=>{
   const state=scene(); state.core.players['0'].hand=[card];state.core.players['0'].resources[R.CP]=10;
   const replacement=card.effects!.find(e=>e.action?.type==='replaceAbility')!.action!;
   if(replacement.type!=='replaceAbility')throw Error('missing upgrade');
   const result=executePipeline(cfg,state,{type:'PLAY_UPGRADE_CARD',playerId:'0',payload:{cardId:card.id,targetAbilityId:replacement.targetAbilityId},timestamp:10} as DiceThroneCommand,fixedRandom,['0','1']);
   expect(result.success,result.error).toBe(true);
   expect(result.state.core.players['0'].abilityLevels[replacement.targetAbilityId!]).toBe(replacement.newAbilityLevel);
   expect(result.state.core.players['0'].resources[R.CP]).toBe(10-card.cpCost);
   expect(result.state.core.players['0'].hand).toHaveLength(0);
 });
 it.each([{id:'thor-thunderous',electro:2,cp:0,guard:0},{id:'thor-storm-brewing',electro:1,cp:1,guard:1}])('$id的抽牌和资源全部落地',({id,electro,cp,guard})=>{
   const state=scene().core,before=state.players['0'];
   const next=apply(state,act(state,id));
   expect(next.players['0'].hand).toHaveLength(1);
   expect(next.players['0'].deck).toHaveLength(before.deck.length-1);
   expect(next.players['0'].tokens[T.ELECTROKINESIS]).toBe(electro);
   expect(next.players['0'].tokens[T.GUARD_BREAK]).toBe(guard);
   expect(next.players['0'].resources[R.CP]).toBe(2+cp);
 });
 it.each([{away:false,expected:1},{away:true,expected:2}])('挥锤时刻持锤在外=$away，同时获得正确总数驭电',({away,expected})=>{
   const state=scene().core;
   if(away){state.players['0'].tokens[T.MJOLNIR]=0;state.players['1'].tokens[T.MJOLNIR]=1;}
   const next=apply(state,act(state,'thor-hammer-time'));
   expect(next.players['0'].tokens[T.ELECTROKINESIS]).toBe(expected);
   expect(next.players['0'].tokens[T.MJOLNIR]).toBe(1);
   expect(next.players['0'].resources[R.CP]).toBe(3);
 });
 it.each([{value:1,electro:0,guard:0},{value:6,electro:2,guard:1}])('彩虹桥按最终骰值$value结算且始终抽一牌',({value,electro,guard})=>{
   const state=scene().core;
   const roll=act(state,'thor-bifrost');
   const request=roll.find(e=>e.type==='BONUS_DICE_REROLL_REQUESTED')!;
   if(request.type!=='BONUS_DICE_REROLL_REQUESTED')throw Error('missing dice');
   request.payload.settlement.dice[0]={...request.payload.settlement.dice[0],value,face:value===6?'thor_thunder':'thor_hammer'};
   const events=getBonusDiceSettlementHandler('thor-bifrost-settle')!({state,settlement:request.payload.settlement,timestamp:11,random:fixedRandom})!.followupEvents!;
   const next=apply(state,events);
   expect(next.players['0'].hand).toHaveLength(1);
   expect(next.players['0'].tokens[T.ELECTROKINESIS]).toBe(electro);
   expect(next.players['0'].tokens[T.GUARD_BREAK]).toBe(guard);
 });
 it('风暴来袭的正式出牌要求本回合两次飞掷，召回不算',()=>{
   const state=scene(),card=THOR_CARDS.find(c=>c.id==='card-thor-storm-brewing')!;
   state.core.players['0'].hand=[card];state.core.mjolnirThrowsThisTurn={'0':1};
   const command={type:'PLAY_CARD',playerId:'0',payload:{cardId:card.id},timestamp:10} as DiceThroneCommand;
   expect(executePipeline(cfg,state,command,fixedRandom,['0','1']).success).toBe(false);
   state.core.mjolnirThrowsThisTurn['0']=2;
   const result=executePipeline(cfg,state,command,fixedRandom,['0','1']);
   expect(result.success,result.error).toBe(true);
   expect(result.state.core.players['0'].resources[R.CP]).toBe(3);
   expect(result.state.core.players['0'].tokens[T.GUARD_BREAK]).toBe(1);
 });
 it.each([{cardId:'card-thor-impenetrable',hp:5,roll:1,expected:5},{cardId:'card-thor-undaunted',hp:5,roll:4,expected:1},{cardId:'card-thor-undaunted',hp:5,roll:1,expected:0}])('$cardId面对真实致命攻击，骰值$roll后生命=$expected',({cardId,hp,roll,expected})=>{
   let state=scene();state.core.players['0'].hand=[THOR_CARDS.find(c=>c.id===cardId)!];state.core.players['0'].tokens[T.ELECTROKINESIS]=2;state.core.players['0'].resources[R.HP]=hp;
   state.sys.phase='defensiveRoll';state.core.turnPhase='defensiveRoll';state.core.activePlayerId='1';
   state.core.pendingAttack={attackerId:'1',defenderId:'0',sourceAbilityId:'fist-technique-5',isDefendable:false,settlementStage:'preDamage',preDefenseResolved:true} as DiceThroneCore['pendingAttack'];
   const damage={type:'DAMAGE_DEALT',timestamp:10,payload:{targetId:'0',amount:10,actualDamage:5,sourcePlayerId:'1',sourceAbilityId:'fist-technique-5',damageScope:'attack',damageOrigin:'ability',unblockable:true}} as DiceThroneEvent;
   const response=maybeCreateDamageResponseEvent({state:state.core,damageEvent:damage as Extract<DiceThroneEvent,{type:'DAMAGE_DEALT'}>,attackerId:'1',sourceAbilityId:'fist-technique-5',timestamp:10,allowAttackerBoost:false});
   expect(response).not.toBeNull();
   if (!response) throw new Error(`${cardId} 的真实受伤响应窗口没有打开`);
   expect(response.payload.pendingDamage).toMatchObject({
     targetPlayerId:'0',responseType:'beforeDamageReceived',originalDamage:10,currentDamage:10,
   });
   state.core=reduce(state.core,response);
   const played=executePipeline(cfg,state,{type:'PLAY_CARD',playerId:'0',payload:{cardId},timestamp:11} as DiceThroneCommand,createQueuedRandom([roll]),['0','1']);
   expect(played.success,played.error).toBe(true);state=played.state;
   if(cardId==='card-thor-undaunted'){
     const earlySkip=executePipeline(cfg,state,{type:'SKIP_TOKEN_RESPONSE',playerId:'0',payload:{pendingDamageId:state.core.pendingDamage!.id},timestamp:12},fixedRandom,['0','1']);
     expect(earlySkip.success).toBe(false);
     expect(earlySkip.state.core.pendingBonusDiceSettlement?.dice[0].value).toBe(roll);
     expect(earlySkip.state.core.players['0'].resources[R.HP]).toBe(hp);
     const confirmed=executePipeline(cfg,state,{type:'CONFIRM_ROLL',playerId:'0',payload:{},timestamp:12},fixedRandom,['0','1']);
     expect(confirmed.success,confirmed.error).toBe(true);state=confirmed.state;
   }
   if(state.core.pendingDamage){
     const skipped=executePipeline(cfg,state,{type:'SKIP_TOKEN_RESPONSE',playerId:'0',payload:{pendingDamageId:state.core.pendingDamage.id},timestamp:13},fixedRandom,['0','1']);
     expect(skipped.success,skipped.error).toBe(true);state=skipped.state;
   }
   expect(state.core.players['0'].resources[R.HP]).toBe(expected);
   expect(state.core.players['0'].resources[R.CP]).toBe(0);
 });
});
