import type { Command, GameEvent, MatchState } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import type { Opportunity, TimingPoint } from '../../../engine/TimingOpportunity';
import { INTERACTION_EVENTS, type InteractionDescriptor, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { createSimpleChoiceFromTimingOpportunity } from '../../../engine/systems/TimingOpportunitySystem';
import { completeResolutionFrame, getResolutionFrameById } from '../../../engine/systems/resolutionStack';
import type { EventCardDefinition, FateChariotDrawnEvent, FateDominationCore, FateDominationEvent } from './types';

export const FATE_CHARIOT_CHOICE = 'fate:chariot-choice';
const AI_SUPPORT = { status: 'game-policy' as const, policyId: 'baseline', reason: '从服务端发出的候选中选择事件。' };
const INTERACTION_AI = { status: 'adapter' as const, adapterId: 'fate-chariot', reason: AI_SUPPORT.reason };
interface Context extends Record<string,unknown> { playerId:string; skillId:string; round:number; generation:string; frameId:string; locationId:'miyama'|'shinto'; offered:EventCardDefinition[] }
export interface FateChariotChoiceData extends SimpleChoiceData { fateContext:Context }
const record = (value:unknown):Record<string,unknown> => value && typeof value==='object' ? value as Record<string,unknown> : {};
export const fateChariotFrameId = (round:number,playerId:string,skillId:string,generation:string) => `fate:chariot-frame:${round}:${playerId}:${skillId}:${generation}`;
export const fateChariotInteractionId = (round:number,playerId:string,skillId:string,generation:string) => `${FATE_CHARIOT_CHOICE}:${round}:${playerId}:${skillId}:${generation}`;
export function isFateChariotChoice(interaction:InteractionDescriptor|undefined):interaction is InteractionDescriptor<FateChariotChoiceData> {
    return interaction?.kind==='simple-choice' && record(interaction.data).sourceId===FATE_CHARIOT_CHOICE;
}
function contextFor(value:unknown):Context|undefined {
    const data=record(value), ctx=record(data.fateContext);
    if(data.sourceId!==FATE_CHARIOT_CHOICE || typeof ctx.playerId!=='string' || typeof ctx.skillId!=='string' || typeof ctx.round!=='number'
        || typeof ctx.generation!=='string' || typeof ctx.frameId!=='string' || !['miyama','shinto'].includes(String(ctx.locationId))
        || !Array.isArray(ctx.offered) || ctx.offered.length!==2 || ctx.offered.some(card=>typeof record(card).id!=='string')) return undefined;
    return ctx as unknown as Context;
}
export function fateChariotOpportunities(event:FateChariotDrawnEvent,timing:TimingPoint):Opportunity<string>[] {
    const {playerId,skillId,round,generation,frameId,locationId,offered}=event.payload;
    const metadata:Context={playerId,skillId,round,generation,frameId,locationId,offered};
    const id=fateChariotInteractionId(round,playerId,skillId,generation);
    const sourceRef={kind:'event' as const,id:FATE_CHARIOT_CHOICE,ownerId:playerId,controllerId:playerId};
    return [
        {id:`${id}:frame`,timing,sourceRef,controllerId:playerId,class:'mandatory',condition:true,
            resolution:{type:'child-frame',frameId,frameKind:FATE_CHARIOT_CHOICE,phase:'action',phaseGate:'block-advance-when-blocked',metadata:{playerId,skillId,round,generation,frameId,locationId}},visibility:{scope:'controller'},metadata:{priority:100}},
        {id,timing,sourceRef,controllerId:playerId,class:'mandatory',condition:true,resolution:{type:'choice-request'},visibility:{scope:'controller'},
            choice:{requestId:id,playerId,ownerFrameId:frameId,kind:'select-card',candidates:offered.map(card=>({id:card.id,label:card.name,value:card.id})),
                selection:{min:1,max:1},skipPolicy:'forbidden',resolution:{type:'interaction-response'},ai:AI_SUPPORT,metadata}},
    ];
}
export function createFateChariotInteraction(opportunity:Opportunity):InteractionDescriptor<FateChariotChoiceData>|undefined {
    if(opportunity.sourceRef.id!==FATE_CHARIOT_CHOICE)return undefined;
    const interaction=createSimpleChoiceFromTimingOpportunity<string>(opportunity as Opportunity<string>,{title:'神威车轮',targetType:'generic',autoResolveIfSingle:false,responseValidationMode:'snapshot'});
    const fateContext=opportunity.choice?.metadata as unknown as Context;
    if(!fateContext || fateContext.offered?.length!==2)throw new Error('Fate chariot choice is missing its draw facts');
    return {...interaction,ai:INTERACTION_AI,data:{...interaction.data,ai:INTERACTION_AI,fateContext}};
}
export function validFateChariotResponse(state:MatchState<FateDominationCore>,command:Command):boolean {
    const interaction=state.sys.interaction.current;
    if(!isFateChariotChoice(interaction))return false;
    const context=contextFor(interaction.data),payload=record(command.payload);
    if(!context)return false;
    const frame=getResolutionFrameById(state,context.frameId);
    return command.type==='SYS_INTERACTION_RESPOND' && command.playerId===context.playerId && interaction.playerId===context.playerId
        && state.core.phase==='action' && state.core.round===context.round && state.core.currentPlayerId===context.playerId
        && state.core.players[context.playerId]?.locationId===context.locationId
        && interaction.id===fateChariotInteractionId(context.round,context.playerId,context.skillId,context.generation)
        && payload.interactionId===interaction.id && Object.keys(payload).sort().join(',')==='interactionId,optionId'
        && typeof payload.optionId==='string' && new Set(context.offered.map(card=>card.id)).size===2
        && context.offered.some(card=>card.id===payload.optionId) && interaction.data.options.some(option=>option.id===payload.optionId && !option.disabled)
        && frame?.id===state.sys.resolution?.activeFrameId && frame?.kind===FATE_CHARIOT_CHOICE && interaction.resolutionFrameId===frame.id;
}
export function createFateChariotChoiceSystems():EngineSystem<FateDominationCore>[] {
    return [{id:'fate-chariot-guard',name:'Fate 神威车轮权限',priority:9,beforeCommand:({state,command})=>{
        if(state.sys.tutorial.active && command.type.startsWith('SYS_TUTORIAL_'))return;
        if(!isFateChariotChoice(state.sys.interaction.current))return;
        if(!validFateChariotResponse(state,command))return {halt:true,error:'请选择当前神威车轮展示的事件牌。'};
    }},{id:'fate-chariot-resolution',name:'Fate 神威车轮结算',priority:32,
        beforeCommand:({state,command})=>{
            const frame=state.sys.resolution?.frames?.find(item=>item.id===state.sys.resolution?.activeFrameId && item.kind===FATE_CHARIOT_CHOICE);
            const meta=frame?.metadata;
            if(frame && meta && typeof meta.round==='number' && typeof meta.playerId==='string' && typeof meta.skillId==='string' && typeof meta.generation==='string'
                && command.type==='SYS_INTERACTION_RESPOND' && command.playerId===meta.playerId
                && record(command.payload).interactionId===fateChariotInteractionId(meta.round,meta.playerId,meta.skillId,meta.generation))return {halt:true};
        },
        afterEvents:({state,events,random})=>{
            const resolved=events.filter(event=>event.type===INTERACTION_EVENTS.RESOLVED && record(event.payload).sourceId===FATE_CHARIOT_CHOICE);
            if(!resolved.length)return;
            let nextState=state;const generated:FateDominationEvent[]=[];
            for(const event of resolved){
                const payload=record(event.payload),context=contextFor(payload.interactionData);
                if(!context || payload.playerId!==context.playerId || typeof payload.optionId!=='string')throw new Error('Invalid committed chariot choice');
                const chosen=context.offered.find(card=>card.id===payload.optionId),other=context.offered.find(card=>card.id!==payload.optionId);
                if(!chosen || !other || !random)throw new Error('Invalid chariot event cards or random source');
                generated.push({type:'FATE_CHARIOT_RESOLVED',payload:{playerId:context.playerId,locationId:context.locationId,selected:chosen,deck:random.shuffle([...state.core.eventDeck,other]),discard:state.core.eventDiscard},timestamp:event.timestamp} as FateDominationEvent);
                nextState=completeResolutionFrame(nextState,context.frameId);
            }
            return {state:nextState,events:generated as GameEvent[]};
        }}];
}
