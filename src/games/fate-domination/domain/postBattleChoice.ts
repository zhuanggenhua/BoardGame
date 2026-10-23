import type { GameEvent, RandomFn } from '../../../engine/types';
import type { Opportunity, TimingPoint } from '../../../engine/TimingOpportunity';
import { createSimpleChoiceFromTimingOpportunity } from '../../../engine/systems/TimingOpportunitySystem';
import type { EngineSystem } from '../../../engine/systems/types';
import type { InteractionDescriptor, SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { FATE_MASTER_BY_ID } from '../data';
import { fateAfterBattleManaAwards } from './environmentRules';
import { finishFateRoundEvents } from './roundLifecycle';
import type { BattleResult, FateDominationCore, FateDominationEvent, FatePostBattleStartedEvent } from './types';

export const FATE_SEAL_RESTORE_CHOICE = 'fate:post-battle-seal';
export function isFatePostBattleChoice(interaction:InteractionDescriptor|undefined):interaction is InteractionDescriptor<SimpleChoiceData> {
    return interaction?.kind==='simple-choice' && record(interaction.data).sourceId===FATE_SEAL_RESTORE_CHOICE;
}
const AI_UNSUPPORTED = { status: 'unsupported' as const, reason: 'Fate 尚未接入自动玩家；候选合同仅供真人选择。' };
interface ChoiceContext { round: number; frameId: string; recipient: string }
export interface FatePostBattleChoiceData extends SimpleChoiceData { fateContext: ChoiceContext }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
function parseChoiceContext(value: unknown): ChoiceContext | undefined {
    const metadata = record(value);
    return typeof metadata.round === 'number' && typeof metadata.frameId === 'string' && typeof metadata.recipient === 'string'
        ? { round: metadata.round, frameId: metadata.frameId, recipient: metadata.recipient } : undefined;
}
function choiceContext(data: unknown): ChoiceContext | undefined {
    const source = record(data);
    return source.sourceId === FATE_SEAL_RESTORE_CHOICE ? parseChoiceContext(source.fateContext) : undefined;
}
const matchesBattle = (core: FateDominationCore, context: ChoiceContext) => core.phase === 'battle'
    && core.battleResolution?.step === 'after-battle' && core.round === context.round && core.battleResolution.frameId === context.frameId;
/** Restore a spent seal from this master's printed starting supply, not a new fourth seal. */
const canRestoreSeal = (core: FateDominationCore, playerId: string) => core.players[playerId].commandSpells < (FATE_MASTER_BY_ID[core.players[playerId].masterId]?.initialCommandSpells ?? 3);

export function prepareFatePostBattleEvents(core: FateDominationCore, results: BattleResult[], random: RandomFn, meta: { timestamp: number; sourceCommandType?: string }): FateDominationEvent[] {
    const gains: FateDominationEvent[] = fateAfterBattleManaAwards(core).map(payload => ({ type: 'FATE_MANA_GAINED', payload, ...meta }));
    const recipients = core.turnOrder.filter(playerId => canRestoreSeal(core, playerId) && results.some(result => result.playerId === playerId
        && result.status === 'representative-win' && core.battlefield[result.locationId].eventCards.some(card => card.id === 'fuyuki_E12')));
    if (!recipients.length) return [...gains, ...finishFateRoundEvents(core, results, random, meta)];
    if (!core.battleResolution) throw new Error('Post-battle rewards require a battle frame');
    return [...gains, { type: 'FATE_POST_BATTLE_STARTED', payload: { round: core.round, frameId: core.battleResolution.frameId, recipients }, ...meta }];
}

export function fatePostBattleOpportunities(event: FatePostBattleStartedEvent, timing: TimingPoint): Opportunity[] {
    return event.payload.recipients.map((recipient, index) => ({
        id: `${FATE_SEAL_RESTORE_CHOICE}:${event.payload.round}:${recipient}`,
        timing, sourceRef: { kind: 'event', id: FATE_SEAL_RESTORE_CHOICE, ownerId: recipient, controllerId: recipient },
        controllerId: recipient, class: 'mandatory', condition: true,
        resolution: { type: 'choice-request' }, visibility: { scope: 'controller' },
        metadata: { priority: -index },
        choice: {
            ownerFrameId: event.payload.frameId, kind: 'choose-option', selection: { min: 1, max: 1 }, skipPolicy: 'forbidden',
            candidates: [{ id: 'restore', label: '恢复一枚令咒', value: 'restore' }, { id: 'decline', label: '不恢复', value: 'decline' }],
            resolution: { type: 'interaction-response' }, ai: AI_UNSUPPORTED,
            metadata: { round: event.payload.round, frameId: event.payload.frameId, recipient },
        },
    }));
}

export function createFatePostBattleInteraction(opportunity: Opportunity):InteractionDescriptor<FatePostBattleChoiceData>|undefined {
    if (opportunity.sourceRef.id !== FATE_SEAL_RESTORE_CHOICE) return undefined;
    const interaction = createSimpleChoiceFromTimingOpportunity(opportunity, {
        title: '战后恢复令咒', targetType: 'generic', autoResolveIfSingle: false, responseValidationMode: 'snapshot',
    });
    const fateContext=parseChoiceContext(opportunity.choice?.metadata);
    if(!fateContext)throw new Error('Fate post-battle opportunity is missing its rule context');
    return {...interaction,data:{...interaction.data,ai:AI_UNSUPPORTED,fateContext}};
}

/** Guard precedes Undo. Handler follows SimpleChoice and Timing, but precedes ResolutionFrame. */
export function createFatePostBattleChoiceSystems(): EngineSystem<FateDominationCore>[] {
    return [{
        id: 'fate-post-battle-choice-guard', name: 'Fate 战后选择权限', priority: 9,
        beforeCommand: ({ state, command }) => {
            if (state.core.battleResolution?.step !== 'after-battle') return;
            const current = state.sys.interaction.current;
            const context = choiceContext(current?.data);
            const payload = record(command.payload);
            const data = current?.data as SimpleChoiceData | undefined;
            const valid = command.type === 'SYS_INTERACTION_RESPOND' && current?.kind === 'simple-choice' && context
                && matchesBattle(state.core, context) && current.resolutionFrameId === context.frameId
                && state.sys.resolution?.activeFrameId === context.frameId && context.recipient === current.playerId
                && command.playerId === current.playerId && payload.interactionId === current.id
                && payload.mergedValue === undefined && payload.optionIds === undefined
                && (payload.optionId === 'restore' || payload.optionId === 'decline')
                && data?.options.some(option => option.id === payload.optionId && !option.disabled)
                && (payload.optionId !== 'restore' || canRestoreSeal(state.core, command.playerId));
            if (!valid) return { halt: true, error: '请由当前玩家确认战后选择，不能取消或绕过结算。' };
        },
    }, {
        id: 'fate-post-battle-choice-resolution', name: 'Fate 战后选择结算', priority: 32,
        beforeCommand: ({ state, command }) => {
            // The earlier guard and SimpleChoice own validation. preCommandEvents are not exposed in ctx.events here.
            if (state.core.battleResolution?.step === 'after-battle' && command.type === 'SYS_INTERACTION_RESPOND') return { halt: true };
        },
        afterEvents: ({ state, events, random, pendingAfterEventsToReduceCount }) => {
            const resolved = events.filter(event => event.type === 'SYS_INTERACTION_RESOLVED' && record(event.payload).sourceId === FATE_SEAL_RESTORE_CHOICE);
            if (resolved.length) return { events: resolved.map(event => {
                const payload = record(event.payload); const context = choiceContext(payload.interactionData);
                if (!context || !matchesBattle(state.core, context) || payload.playerId !== context.recipient || !['restore', 'decline'].includes(String(payload.optionId))) throw new Error('Invalid committed Fate post-battle choice');
                return { type: 'FATE_POST_BATTLE_SEAL_CHOSEN', payload: { playerId: context.recipient, restore: payload.optionId === 'restore' }, timestamp: event.timestamp } satisfies GameEvent;
            }) };
            if (!events.some(event => event.type === 'FATE_POST_BATTLE_SEAL_CHOSEN') || pendingAfterEventsToReduceCount
                || state.sys.interaction.current || state.sys.interaction.queue.length || state.core.battleResolution?.step !== 'after-battle') return;
            return { events: finishFateRoundEvents(state.core, state.core.resolvedResults, random, { timestamp: events.at(-1)?.timestamp ?? 0 }) };
        },
    }];
}
