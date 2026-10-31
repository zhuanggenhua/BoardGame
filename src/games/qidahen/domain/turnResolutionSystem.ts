import type { EngineSystem } from '../../../engine/systems/types';
import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { updateResolutionFrame, completeResolutionFrame } from '../../../engine/systems/resolutionStack';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { createQidahenChoiceRequestInteraction } from './choiceRequestInteractionBuilder';
import { buildQidahenTurnChoice, isQidahenTurnChoiceSelectionValid } from './turnResolutionChoices';
import { advanceQidahenTurnResolutionData, getQidahenAutomaticTurnFact, normalizeQidahenTurnResolutionData } from './turnResolutionProgress';
import { getQidahenDispatchDraftTargets } from './wheelDispatchDraft';
import { getQidahenCharacterJudgementOutcome } from './characterJudgement';
import { QIDAHEN_TURN_RESOLUTION_CHOICE, QIDAHEN_TURN_RESOLUTION_FRAME, type QidahenTurnResolutionAppliedEvent, type QidahenTurnResolutionData, type QidahenTurnResolutionFact, type QidahenTurnResolutionFrame } from './turnResolutionTypes';
import type { QidahenCore } from './types';
import { getQidahenTurnResolutionFrame } from './turnResolutionOpportunities';

function updateData(state: MatchState<QidahenCore>, frameId: string, data: QidahenTurnResolutionData): MatchState<QidahenCore> {
    return updateResolutionFrame(state, frameId, frame => ({ ...frame, metadata: { ...frame.metadata, qidahenTurn: data } }));
}

function selectedIds(payload: { optionId?: string; optionIds?: string[] }): string[] {
    return payload.optionIds ?? (payload.optionId ? [payload.optionId] : []);
}

function buildFactEvent(state: MatchState<QidahenCore>, frame: QidahenTurnResolutionFrame, fact: QidahenTurnResolutionFact, random: RandomFn, timestamp: number): QidahenTurnResolutionAppliedEvent {
    if (fact.kind === 'judgement') {
        const task = fact.task;
        const character = state.core.factions[task.factionId].characters.find(item => item.id === task.characterId)!;
        if (character.number === 'X') throw new Error('An X character cannot enter a dice judgement');
        const rawRoll = random.d(character.number);
        fact = { ...fact, rawRoll, outcome: getQidahenCharacterJudgementOutcome(state.core, fact.task, rawRoll).outcome };
    }
    return { type: 'TURN_RESOLUTION_APPLIED', timestamp, payload: { frameId: frame.id, factionId: frame.metadata.qidahenTurn.factionId, fromStep: frame.metadata.qidahenTurn.step, fact } };
}

export function createQidahenTurnResolutionSystem(): EngineSystem<QidahenCore> {
    return {
        id: 'qidahen-turn-resolution', name: '七大恨轮盘与季节结算', priority: 19,
        beforeCommand: ({ state, command }) => {
            const frame = getQidahenTurnResolutionFrame(state);
            if (command.type !== INTERACTION_COMMANDS.RESPOND) return;
            const current = state.sys.interaction?.current;
            if ((current?.data as { sourceId?: string } | undefined)?.sourceId !== QIDAHEN_TURN_RESOLUTION_CHOICE) return;
            if (!frame) return { halt: true, error: 'missingTurnResolutionFrame' };
            const ids = selectedIds(command.payload as { optionId?: string; optionIds?: string[] });
            if (!isQidahenTurnChoiceSelectionValid(state.core, frame.metadata.qidahenTurn, command.playerId, ids)) return { halt: true, error: 'invalidTurnResolutionChoice' };
        },
        afterEvents: ({ state, events, command, random, pendingAfterEventsToReduceCount }) => {
            if ((pendingAfterEventsToReduceCount ?? 0) > 0) return;
            let next = state;
            let frame = getQidahenTurnResolutionFrame(next);
            if (!frame) return;
            for (const event of events) {
                if (event.type === 'PREVIEW_ACTION_CANCELLED' && frame.metadata.qidahenTurn.step === 'await-hand') {
                    const data = frame.metadata.qidahenTurn;
                    next = updateData(next, frame.id, { ...data, step: data.handReturnStep === 'complete' ? 'finish-hand' : 'menu' });
                    frame = getQidahenTurnResolutionFrame(next)!;
                }
                if (event.type === 'TURN_RESOLUTION_APPLIED' && (event as QidahenTurnResolutionAppliedEvent).payload.frameId === frame.id) {
                    const applied = event as QidahenTurnResolutionAppliedEvent;
                    if (applied.payload.fact.kind === 'finish-wheel') return { state: completeResolutionFrame(next, frame.id) };
                    next = updateData(next, frame.id, advanceQidahenTurnResolutionData(next.core, frame.metadata.qidahenTurn, applied));
                    frame = getQidahenTurnResolutionFrame(next)!;
                }
                if (event.type !== INTERACTION_EVENTS.RESOLVED) continue;
                const payload = event.payload as { sourceId?: string; optionId?: string; optionIds?: string[] };
                if (payload.sourceId !== QIDAHEN_TURN_RESOLUTION_CHOICE) continue;
                const choice = buildQidahenTurnChoice(next.core, frame.metadata.qidahenTurn);
                if (!choice) throw new Error('Resolved turn interaction lost its choice owner');
                const fact = choice.resolve(selectedIds(payload));
                const applied = buildFactEvent(next, frame, fact, random, event.timestamp);
                return { state: updateData(next, frame.id, { ...frame.metadata.qidahenTurn, step: 'await-fact' }), events: [applied] };
            }
            if (next.sys.interaction?.current) return next === state ? undefined : { state: next };
            let data = frame.metadata.qidahenTurn;
            for (;;) {
                const normalized = normalizeQidahenTurnResolutionData(next.core, data);
                if (normalized === data) break;
                data = normalized;
            }
            if (data !== frame.metadata.qidahenTurn) {
                next = updateData(next, frame.id, data);
                frame = getQidahenTurnResolutionFrame(next)!;
            }
            const automatic = getQidahenAutomaticTurnFact(next.core, data);
            if (automatic) return { state: updateData(next, frame.id, { ...data, step: 'await-fact' }), events: [buildFactEvent(next, frame, automatic, random, command.timestamp ?? 0)] };
            const choice = buildQidahenTurnChoice(next.core, data);
            if (choice) {
                const min = choice.min ?? 1;
                const max = Math.min(choice.max ?? 1, choice.candidates.length);
                const interaction = createQidahenChoiceRequestInteraction({
                    requestId: `${frame.id}:${data.step}:${next.sys.decisionEpoch ?? 0}`, ownerFrameId: frame.id,
                    playerId: next.core.factions[choice.factionId].playerId, title: choice.title,
                    sourceId: QIDAHEN_TURN_RESOLUTION_CHOICE, candidates: choice.candidates,
                    multi: choice.min !== undefined || choice.max !== undefined ? { min, max } : undefined,
                });
                next = queueInteraction(next, interaction);
            }
            return next === state ? undefined : { state: next };
        },
    };
}
