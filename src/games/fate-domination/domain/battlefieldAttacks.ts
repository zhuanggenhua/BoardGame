import type { Command, MatchState } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import { INTERACTION_EVENTS, type InteractionDescriptor, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { createSimpleChoiceFromTimingOpportunity } from '../../../engine/systems/TimingOpportunitySystem';
import type { Opportunity, TimingPoint } from '../../../engine/TimingOpportunity';
import { completeResolutionFrame, getResolutionFrameById } from '../../../engine/systems/resolutionStack';
import type { AttacksConfirmedEvent, FateBattlefieldAttack, FateDominationCore, LocationResolvedEvent, PlayerState } from './types';

const PLACE_ON_PLAY = new Set(['sc_gilles_np']);
const TERRITORY_CREATION = new Set(['sc_gilles_2', 'sc_medea_2']);
const definitionId = (instanceId: string) => instanceId.split(':')[0];
export const isFateFieldAttack = (id: string) => PLACE_ON_PLAY.has(definitionId(id));
export const isFateTerritoryCreation = (id: string) => TERRITORY_CREATION.has(definitionId(id));
export const isFateResidualSkill = isFateTerritoryCreation;
export const fateResidualDeploymentRewards = (player: PlayerState) => player.activeSkills.filter(isFateTerritoryCreation).length;
export const fateBattlefieldSkillIds = (core: FateDominationCore, playerId: string) =>
    (core.battlefieldAttacks ?? []).filter(card => card.playerId === playerId).map(card => card.skillId);

export function afterFateLocationResolved(core: FateDominationCore, { locationId, results }: LocationResolvedEvent['payload']) {
    return core.battlefieldAttacks?.filter(card => card.locationId !== locationId
        || !core.battlefield[locationId].playerIds.includes(card.playerId)
        || results.some(result => result.playerId === card.playerId && result.status === 'representative-win'));
}

export const FATE_FIELD_ATTACK_CHOICE = 'fate:field-attack';
const place = 'place';
const close = 'close';
type FieldContext = FateBattlefieldAttack & Record<string, unknown> & { round: number; frameId: string };
type FieldChoice = SimpleChoiceData & { field: FieldContext };
const choiceId = ({ playerId, skillId, round }: FieldContext) => `${FATE_FIELD_ATTACK_CHOICE}:${round}:${playerId}:${skillId}`;
const record = (value: unknown) => (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
export const isFateFieldAttackChoice = (interaction: InteractionDescriptor | undefined): interaction is InteractionDescriptor<FieldChoice> =>
    interaction?.kind === 'simple-choice' && record(interaction.data).sourceId === FATE_FIELD_ATTACK_CHOICE;

export function fateFieldAttackOpportunities(event: AttacksConfirmedEvent, timing: TimingPoint, core: FateDominationCore): Opportunity[] {
    const player = core.players[event.payload.playerId];
    const skillId = event.payload.cardIds.find(id => PLACE_ON_PLAY.has(definitionId(id)) && player.activeSkills.includes(id));
    if (!skillId || (player.locationId !== 'miyama' && player.locationId !== 'shinto')) return [];
    const field: FieldContext = { playerId: player.id, skillId, locationId: player.locationId, round: core.round, frameId: `${FATE_FIELD_ATTACK_CHOICE}:frame:${timing.id}` };
    const id = choiceId(field);
    const base = { timing, sourceRef: { kind: 'event' as const, id: FATE_FIELD_ATTACK_CHOICE, ownerId: player.id, controllerId: player.id }, controllerId: player.id, class: 'mandatory' as const, condition: true, visibility: { scope: 'controller' as const } };
    return [
        { ...base, id: `${id}:frame`, resolution: { type: 'child-frame', frameId: field.frameId, frameKind: FATE_FIELD_ATTACK_CHOICE, phase: 'action', phaseGate: 'block-advance-when-blocked', metadata: field }, metadata: { priority: 100 } },
        { ...base, id, resolution: { type: 'choice-request' }, choice: {
            requestId: id, playerId: player.id, ownerFrameId: field.frameId, kind: 'choose-option',
            candidates: [{ id: place, label: '放置在战场', value: place }, { id: close, label: '关闭此牌', value: close }],
            selection: { min: 1, max: 1 }, skipPolicy: 'forbidden', resolution: { type: 'interaction-response' },
            ai: { status: 'game-policy', policyId: 'baseline', reason: '在自己的战场放置攻击。' }, metadata: field,
        } },
    ];
}

export function createFateFieldAttackInteraction(opportunity: Opportunity) {
    if (opportunity.sourceRef.id !== FATE_FIELD_ATTACK_CHOICE) return;
    const interaction = createSimpleChoiceFromTimingOpportunity(opportunity, { title: '放置战场攻击', targetType: 'generic', autoResolveIfSingle: false, responseValidationMode: 'snapshot' });
    const ai = { status: 'adapter' as const, adapterId: FATE_FIELD_ATTACK_CHOICE, reason: '从当前两个选项中决定是否放置。' };
    return { ...interaction, ai, data: { ...interaction.data, ai, field: opportunity.choice?.metadata as FieldContext } };
}

export function validFateFieldAttackResponse(state: MatchState<FateDominationCore>, command: Command) {
    const interaction = state.sys.interaction.current;
    if (!isFateFieldAttackChoice(interaction)) return false;
    const { field } = interaction.data;
    const payload = record(command.payload);
    const player = state.core.players[field.playerId];
    const frame = getResolutionFrameById(state, field.frameId);
    return command.type === 'SYS_INTERACTION_RESPOND' && command.playerId === field.playerId
        && state.core.phase === 'action' && state.core.round === field.round && state.core.currentPlayerId === field.playerId
        && player?.locationId === field.locationId && player.activeSkills.includes(field.skillId)
        && interaction.id === choiceId(field) && payload.interactionId === interaction.id
        && Object.keys(payload).sort().join(',') === 'interactionId,optionId' && (payload.optionId === place || payload.optionId === close)
        && frame?.id === state.sys.resolution?.activeFrameId && frame?.kind === FATE_FIELD_ATTACK_CHOICE;
}

export function createFateFieldAttackSystems(): EngineSystem<FateDominationCore>[] {
    return [{ id: 'fate-field-attack-guard', name: '战场攻击选择权限', priority: 9, beforeCommand: ({ state, command }) => {
        if (isFateFieldAttackChoice(state.sys.interaction.current) && !validFateFieldAttackResponse(state, command)) return { halt: true, error: '请先决定放置或关闭这张攻击牌。' };
    } }, { id: 'fate-field-attack-resolution', name: '战场攻击选择结算', priority: 32,
        beforeCommand: ({ state, command }) => {
            const frame = getResolutionFrameById(state, state.sys.resolution?.activeFrameId ?? '');
            if (frame?.kind !== FATE_FIELD_ATTACK_CHOICE || command.type !== 'SYS_INTERACTION_RESPOND') return;
            const field = frame.metadata as FieldContext;
            if (record(command.payload).interactionId === choiceId(field)) return { halt: true };
        },
        afterEvents: ({ state, events }) => {
            const resolved = events.find(event => event.type === INTERACTION_EVENTS.RESOLVED && record(event.payload).sourceId === FATE_FIELD_ATTACK_CHOICE);
            if (!resolved) return;
            const { optionId, interactionData } = record(resolved.payload);
            const { field } = interactionData as FieldChoice;
            const { playerId, skillId, locationId } = field;
            return {
                state: completeResolutionFrame(state, field.frameId),
                events: [{ type: 'FATE_BATTLEFIELD_ATTACK_DECIDED', payload: { playerId, skillId, locationId, placed: optionId === place }, timestamp: resolved.timestamp }],
            };
        } }];
}
