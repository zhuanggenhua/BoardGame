import type { Command, GameEvent, MatchState } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import type { Opportunity, TimingPoint } from '../../../engine/TimingOpportunity';
import { INTERACTION_EVENTS, type InteractionDescriptor, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { createSimpleChoiceFromTimingOpportunity } from '../../../engine/systems/TimingOpportunitySystem';
import { completeResolutionFrame, getResolutionFrameById } from '../../../engine/systems/resolutionStack';
import type { CardInstance, FateDominationCore, FateDominationEvent, FateInvestigationViewedEvent } from './types';

export const FATE_INVESTIGATION_CHOICE='fate:investigation-choice';
export const FATE_INVESTIGATION_KEEP='fate:investigation-keep';
interface InvestigationContext extends Record<string,unknown> {playerId:string;targetPlayerId:string;skillId:string;round:number;generation:string;frameId:string;offered:CardInstance[]}
export interface FateInvestigationChoiceData extends SimpleChoiceData {fateContext:InvestigationContext}
const record=(value:unknown):Record<string,unknown>=>value && typeof value==='object'?value as Record<string,unknown>:{};
export const fateInvestigationFrameId=(round:number,playerId:string,skillId:string,generation:string)=>`fate:investigation-frame:${round}:${playerId}:${skillId}:${generation}`;
const interactionId=(context:InvestigationContext)=>`${FATE_INVESTIGATION_CHOICE}:${context.round}:${context.playerId}:${context.skillId}:${context.generation}`;
export const isFateInvestigationChoice=(value:InteractionDescriptor|undefined):value is InteractionDescriptor<FateInvestigationChoiceData>=>value?.kind==='simple-choice' && record(value.data).sourceId===FATE_INVESTIGATION_CHOICE;
function contextFor(value:unknown):InvestigationContext|undefined {
    const data=record(value),ctx=record(data.fateContext);
    if(data.sourceId!==FATE_INVESTIGATION_CHOICE || typeof ctx.playerId!=='string' || typeof ctx.targetPlayerId!=='string' || typeof ctx.skillId!=='string'
        || typeof ctx.round!=='number' || typeof ctx.generation!=='string' || typeof ctx.frameId!=='string' || !Array.isArray(ctx.offered)
        || ctx.offered.some(card=>typeof record(card).id!=='string' || typeof record(card).definitionId!=='string'))return undefined;
    return ctx as unknown as InvestigationContext;
}
export function fateInvestigationOpportunities(event:FateInvestigationViewedEvent,timing:TimingPoint):Opportunity<string>[] {
    const context:InvestigationContext={...event.payload};
    const id=interactionId(context),sourceRef={kind:'event' as const,id:FATE_INVESTIGATION_CHOICE,ownerId:context.playerId,controllerId:context.playerId};
    return [
        {id:`${id}:frame`,timing,sourceRef,controllerId:context.playerId,class:'mandatory',condition:true,
            resolution:{type:'child-frame',frameId:context.frameId,frameKind:FATE_INVESTIGATION_CHOICE,phase:'outpost',phaseGate:'block-advance-when-blocked',metadata:{playerId:context.playerId,targetPlayerId:context.targetPlayerId,skillId:context.skillId,round:context.round,generation:context.generation,frameId:context.frameId}},visibility:{scope:'controller'},metadata:{priority:100}},
        {id,timing,sourceRef,controllerId:context.playerId,class:'mandatory',condition:true,resolution:{type:'choice-request'},visibility:{scope:'controller'},
            choice:{requestId:id,playerId:context.playerId,ownerFrameId:context.frameId,kind:'select-card',candidates:[
                ...context.offered.map(card=>({id:card.id,label:card.id,value:card.id})),{id:FATE_INVESTIGATION_KEEP,label:'不调整手牌',labelKey:'game-fate-domination:ui.investigationChoice.keep',value:FATE_INVESTIGATION_KEEP}],
                selection:{min:1,max:1},skipPolicy:'forbidden',resolution:{type:'interaction-response'},ai:{status:'game-policy',policyId:'baseline',reason:'从可见手牌选择或保留原样。'},metadata:context}},
    ];
}
export function createFateInvestigationInteraction(opportunity:Opportunity):InteractionDescriptor<FateInvestigationChoiceData>|undefined {
    if(opportunity.sourceRef.id!==FATE_INVESTIGATION_CHOICE)return undefined;
    const interaction=createSimpleChoiceFromTimingOpportunity<string>(opportunity as Opportunity<string>,{title:'调查',targetType:'generic',autoResolveIfSingle:false,responseValidationMode:'snapshot'});
    const fateContext=opportunity.choice?.metadata as unknown as InvestigationContext;
    if(!fateContext || !Array.isArray(fateContext.offered))throw new Error('Fate investigation is missing its viewed hand');
    const ai={status:'adapter' as const,adapterId:'fate-investigation',reason:'选择一张已查看的牌或保留原样。'};
    return {...interaction,ai,data:{...interaction.data,ai,fateContext}};
}
export function validFateInvestigationResponse(state:MatchState<FateDominationCore>,command:Command):boolean {
    const interaction=state.sys.interaction.current;
    if(!isFateInvestigationChoice(interaction))return false;
    const ctx=contextFor(interaction.data),payload=record(command.payload);
    if(!ctx)return false;
    const frame=getResolutionFrameById(state,ctx.frameId),option=payload.optionId;
    const target=state.core.players[ctx.targetPlayerId];
    return command.type==='SYS_INTERACTION_RESPOND' && command.playerId===ctx.playerId && interaction.playerId===ctx.playerId
        && state.core.phase==='outpost' && state.core.round===ctx.round && state.core.currentPlayerId===ctx.playerId && Boolean(target && !target.eliminated)
        && interaction.id===interactionId(ctx) && payload.interactionId===interaction.id && Object.keys(payload).sort().join(',')==='interactionId,optionId'
        && typeof option==='string' && (option===FATE_INVESTIGATION_KEEP || (ctx.offered.some(card=>card.id===option) && (Boolean(target.publicView) || target.hand.some(card=>card.id===option))))
        && interaction.data.options.some(candidate=>candidate.id===option && !candidate.disabled)
        && frame?.id===state.sys.resolution?.activeFrameId && frame?.kind===FATE_INVESTIGATION_CHOICE && interaction.resolutionFrameId===frame.id;
}
export function createFateInvestigationChoiceSystems():EngineSystem<FateDominationCore>[] {
    return [{id:'fate-investigation-guard',name:'Fate 调查权限',priority:9,beforeCommand:({state,command})=>{
        if(state.sys.tutorial.active && command.type.startsWith('SYS_TUTORIAL_'))return;
        if(isFateInvestigationChoice(state.sys.interaction.current) && !validFateInvestigationResponse(state,command))return {halt:true,error:'请选择当前调查的手牌或保留原样。'};
    }},{id:'fate-investigation-resolution',name:'Fate 调查结算',priority:32,beforeCommand:({state,command})=>{
        const frame=state.sys.resolution?.frames?.find(item=>item.id===state.sys.resolution?.activeFrameId && item.kind===FATE_INVESTIGATION_CHOICE);
        const meta=frame?.metadata;
        if(frame && meta && typeof meta.round==='number' && typeof meta.playerId==='string' && typeof meta.skillId==='string' && typeof meta.generation==='string'
            && command.type==='SYS_INTERACTION_RESPOND' && command.playerId===meta.playerId
            && record(command.payload).interactionId===`${FATE_INVESTIGATION_CHOICE}:${meta.round}:${meta.playerId}:${meta.skillId}:${meta.generation}`)return {halt:true};
    },afterEvents:({state,events})=>{
        const resolved=events.filter(event=>event.type===INTERACTION_EVENTS.RESOLVED && record(event.payload).sourceId===FATE_INVESTIGATION_CHOICE);
        if(!resolved.length)return;
        let nextState=state;const generated:FateDominationEvent[]=[];
        for(const event of resolved){
            const payload=record(event.payload),ctx=contextFor(payload.interactionData);
            if(!ctx || payload.playerId!==ctx.playerId || typeof payload.optionId!=='string')throw new Error('Invalid committed investigation choice');
            const cardId=payload.optionId===FATE_INVESTIGATION_KEEP?undefined:payload.optionId;
            if(cardId && !ctx.offered.some(card=>card.id===cardId))throw new Error('Investigation card was not offered');
            generated.push({type:'FATE_INVESTIGATION_RESOLVED',payload:{playerId:ctx.playerId,targetPlayerId:ctx.targetPlayerId,round:ctx.round,...(cardId?{cardId}:{})},timestamp:event.timestamp});
            nextState=completeResolutionFrame(nextState,ctx.frameId);
        }
        return {state:nextState,events:generated as GameEvent[]};
    }}];
}
