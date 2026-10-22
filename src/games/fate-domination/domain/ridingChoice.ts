import { INTERACTION_EVENTS, type InteractionDescriptor, type SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { completeResolutionFrame, getResolutionFrameById } from '../../../engine/systems/resolutionStack';
import { createSimpleChoiceFromTimingOpportunity } from '../../../engine/systems/TimingOpportunitySystem';
import type { EngineSystem } from '../../../engine/systems/types';
import type { Opportunity, TimingPoint } from '../../../engine/TimingOpportunity';
import type { Command, GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { FATE_ATTACK_BY_ID, FATE_SERVANTS } from '../data';
import { canUseFateAbility } from './mechanics';
import { fateAbilityUsageKey } from './abilitySource';
import { resolveFatePlayerAbility } from './abilityRegistry';
import { projectFateHand } from './handView';
import { resolveFateAttack } from './attackSelection';
import { canPlayAttack } from './movement';
import { drawFateCards } from './cardDraw';
import type {
    FateDominationCore,
    FateDominationEvent,
    FateRidingChoiceRequestedEvent,
    PlayerState,
} from './types';

export const FATE_RIDING_CHOICE_SOURCE = 'fate:riding-choice';
export const FATE_RIDING_FRAME_KIND = 'fate:riding-choice';
const RIDING_SKILL_BASE_ID = 'sc_iskandar_1';
const VERIFIED_SPECIAL_BASIC_TYPES: Record<string, string> = {
    cardPreparation: '远隔操作',
    cardSurveil: '疾行',
    cardluck: '幸运',
};
const AI_UNSUPPORTED = { status: 'unsupported' as const, reason: 'Fate 尚未接入自动玩家；骑乘选择由当前玩家完成。' };

export interface FateRidingChoiceContext {
    playerId: string;
    skillId: string;
    round: number;
    generation: string;
    frameId: string;
}

export interface FateRidingChoiceData extends SimpleChoiceData<string> {
    fateContext: FateRidingChoiceContext;
}

type RidingCandidate = { id: string; label: string; value: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export function fateRidingGeneration(nextEventId: number, rollbackRevision: number): string {
    if (!Number.isSafeInteger(nextEventId) || nextEventId < 1
        || !Number.isSafeInteger(rollbackRevision) || rollbackRevision < 0) {
        throw new Error('Fate Riding requires authoritative event and undo generations');
    }
    return `e${nextEventId}-u${rollbackRevision}`;
}

export const fateRidingFrameId = (round: number, playerId: string, skillId: string, generation: string) =>
    `fate:riding-frame:${round}:${playerId}:${skillId}:${generation}`;

export const fateRidingInteractionId = (round: number, playerId: string, skillId: string, generation: string) =>
    `${FATE_RIDING_CHOICE_SOURCE}:${round}:${playerId}:${skillId}:${generation}`;

function parseContext(value: unknown): FateRidingChoiceContext | undefined {
    const source = record(value);
    if (typeof source.playerId !== 'string' || typeof source.skillId !== 'string'
        || typeof source.round !== 'number' || typeof source.generation !== 'string'
        || !/^e\d+-u\d+$/.test(source.generation) || typeof source.frameId !== 'string') return undefined;
    return {
        playerId: source.playerId, skillId: source.skillId, round: source.round,
        generation: source.generation, frameId: source.frameId,
    };
}

function choiceContext(data: unknown): FateRidingChoiceContext | undefined {
    const source = record(data);
    return source.sourceId === FATE_RIDING_CHOICE_SOURCE ? parseContext(source.fateContext) : undefined;
}

export function isFateRidingChoice(interaction: InteractionDescriptor | undefined): interaction is InteractionDescriptor<FateRidingChoiceData> {
    return interaction?.kind === 'simple-choice' && record(interaction.data).sourceId === FATE_RIDING_CHOICE_SOURCE;
}

function printedBasicType(definition: { id: string; type?: string }): string | undefined {
    // These three cards are printed as the Basic Attack categories named by the CHM.
    // Their runtime type field is the broad "特殊" family, so use the intake-verified card IDs.
    const byDefinitionId = VERIFIED_SPECIAL_BASIC_TYPES[definition.id];
    if (byDefinitionId) return byDefinitionId;
    // The migrated ordinary attack catalog uses “魔法” for the Basic category
    // called “魔术” in the CHM and intake catalog.
    if (definition.type === '魔法') return '魔术';
    // The current Q-card mapping says "迅捷"; the CHM Basic Attack overview calls
    // the same green attribute "敏捷". Preserve the card alias as the same category.
    if (definition.type === '迅捷') return '敏捷';
    return definition.type;
}

const BASIC_ATTACK_TYPES = new Set(['力量', '敏捷', '魔术', '远隔操作', '疾行', '幸运']);

export function isFateBasicAttackDefinition(definition: { id: string; type?: string; desc?: string }): boolean {
    if (Object.hasOwn(VERIFIED_SPECIAL_BASIC_TYPES, definition.id)) return true;
    return definition.desc === '基础攻击卡牌' && BASIC_ATTACK_TYPES.has(printedBasicType(definition) ?? '');
}

function ridingSkillId(player: PlayerState): string | undefined {
    if (FATE_SERVANTS.find(servant => servant.id === player.servantId)?.trueName !== '伊斯坎达尔') return undefined;
    return player.skills.find(skill => skill.id.split(':')[0] === RIDING_SKILL_BASE_ID)?.id;
}

function isRidingDefinition(core: FateDominationCore, playerId: string, skillId: string): boolean {
    return resolveFatePlayerAbility(core, playerId, skillId)?.effects.some(effect => effect.type === 'riding') === true;
}

function liveRidingContext(core: FateDominationCore, context: FateRidingChoiceContext): boolean {
    const player = core.players[context.playerId];
    if (!player || player.eliminated || core.currentPlayerId !== context.playerId || core.phase !== 'action'
        || core.round !== context.round || !player.activeSkills.includes(context.skillId)
        || ridingSkillId(player) !== context.skillId || !isRidingDefinition(core, context.playerId, context.skillId)) return false;
    const usageKey = fateAbilityUsageKey(context.skillId, 'action');
    return !player.usedAbilityIds.includes(context.skillId)
        && !player.usedAbilityIds.includes(usageKey)
        && canUseFateAbility(core, context.playerId, 'action').valid;
}

export function fateRidingCandidates(core: FateDominationCore, playerId: string): RidingCandidate[] {
    const player = core.players[playerId];
    if (!player) return [];
    return projectFateHand(player).available.flatMap(card => {
        const definition = FATE_ATTACK_BY_ID[card.definitionId];
        if (!definition || !Number.isFinite(definition.basePower) || definition.basePower > 3
            || !canPlayAttack(core, playerId, definition).valid) return [];
        return [{ id: card.id, label: definition.name, value: card.id }];
    });
}

export function calculateFateRidingSelectionCost(core: FateDominationCore, playerId: string, cardIds: readonly string[]): number | undefined {
    const player = core.players[playerId];
    if (!player) return undefined;
    let cost = 0;
    for (const id of cardIds) {
        const card = player.hand.find(candidate => candidate.id === id);
        const definition = card ? FATE_ATTACK_BY_ID[card.definitionId] : undefined;
        if (!definition || !Number.isFinite(definition.manaCost) || definition.manaCost < 0
            || !Number.isFinite(definition.basePower) || definition.basePower > 3
            || !projectFateHand(player).available.some(candidate => candidate.id === id)
            || !canPlayAttack(core, playerId, definition).valid) return undefined;
        cost += definition.manaCost;
    }
    return cost;
}

function validRidingSelection(
    core: FateDominationCore,
    context: FateRidingChoiceContext,
    ids: unknown,
    data: unknown,
): ids is string[] {
    if (!liveRidingContext(core, context) || !Array.isArray(ids) || ids.length > 3
        || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) return false;
    const choice = record(data);
    if (choice.sourceId !== FATE_RIDING_CHOICE_SOURCE || !Array.isArray(choice.options)) return false;
    const optionIds = new Set((choice.options as Array<{ id?: unknown; disabled?: unknown }>).filter(option => option?.disabled !== true)
        .map(option => option.id).filter((id): id is string => typeof id === 'string'));
    if (ids.some(id => !optionIds.has(id))) return false;
    const cost = calculateFateRidingSelectionCost(core, context.playerId, ids);
    return cost !== undefined && cost <= core.players[context.playerId].mana;
}

function currentFrame(state: MatchState<FateDominationCore>, context: FateRidingChoiceContext) {
    return getResolutionFrameById(state, context.frameId);
}

function hasBoundRidingFrame(state: MatchState<FateDominationCore>, interaction: InteractionDescriptor, context: FateRidingChoiceContext): boolean {
    const frame = currentFrame(state, context);
    return !!frame && frame.kind === FATE_RIDING_FRAME_KIND
        && frame.phase === 'action' && frame.metadata?.round === context.round
        && frame.metadata?.playerId === context.playerId && frame.metadata?.skillId === context.skillId
        && frame.metadata?.generation === context.generation
        && interaction.id === fateRidingInteractionId(context.round, context.playerId, context.skillId, context.generation)
        && interaction.resolutionFrameId === context.frameId
        && state.sys.resolution?.activeFrameId === context.frameId;
}

function exactPayloadKeys(payload: unknown, keys: string[]): payload is Record<string, unknown> {
    const values = Object.keys(record(payload)).sort();
    return values.length === keys.length && values.every((key, index) => key === [...keys].sort()[index]);
}

export function fateRidingChoiceOpportunities(
    event: FateRidingChoiceRequestedEvent,
    timing: TimingPoint,
    core: FateDominationCore,
): Opportunity<string>[] {
    const { playerId, skillId, round, generation, frameId } = event.payload;
    const player = core.players[playerId];
    const context: FateRidingChoiceContext = { playerId, skillId, round, generation, frameId };
    if (!player || !liveRidingContext(core, context) || frameId !== fateRidingFrameId(round, playerId, skillId, generation)) return [];
    const interactionId = fateRidingInteractionId(round, playerId, skillId, generation);
    const sourceRef = { kind: 'event' as const, id: FATE_RIDING_CHOICE_SOURCE, ownerId: playerId, controllerId: playerId };
    const lifecycle = { round, playerId, skillId, generation, frameId };
    const candidates = fateRidingCandidates(core, playerId);
    return [
        {
            id: `${interactionId}:frame`, timing, sourceRef, controllerId: playerId,
            class: 'mandatory', condition: true,
            resolution: {
                type: 'child-frame', frameId, frameKind: FATE_RIDING_FRAME_KIND,
                phase: 'action', phaseGate: 'block-advance-when-blocked', metadata: lifecycle,
            },
            visibility: { scope: 'controller' },
            metadata: { ...lifecycle, priority: 100 },
        },
        {
            id: interactionId, timing, sourceRef, controllerId: playerId,
            class: 'mandatory', condition: true, resolution: { type: 'choice-request' },
            visibility: { scope: 'controller' },
            choice: {
                requestId: interactionId,
                playerId,
                ownerFrameId: frameId,
                kind: 'select-card',
                candidates,
                selection: { min: 0, max: 3 },
                skipPolicy: 'cancel-only',
                recoveryAction: {
                    id: 'cancel-riding-intent', label: '取消选择', kind: 'choice-request-cancel',
                    commands: [{ type: 'SYS_INTERACTION_CANCEL', payload: { interactionId } }],
                },
                resolution: { type: 'interaction-response' },
                ai: AI_UNSUPPORTED,
                metadata: lifecycle,
            },
        },
    ];
}

export function fateRidingDrawOpportunities(
    event: GameEvent,
    timing: TimingPoint,
    core: FateDominationCore,
    random: RandomFn | undefined,
): Opportunity[] {
    if (event.type !== 'ATTACKS_CONFIRMED') return [];
    const payload = record(event.payload);
    const playerId = typeof payload.playerId === 'string' ? payload.playerId : undefined;
    const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.filter((id): id is string => typeof id === 'string') : [];
    if (!playerId || !cardIds.length) return [];
    const player = core.players[playerId];
    const skillId = player && ridingSkillId(player);
    if (!player || !skillId || !player.activeSkills.includes(skillId) || !cardIds.includes(skillId)) return [];
    const faceDown = new Set(Array.isArray(payload.faceDownIds) ? payload.faceDownIds : []);
    const pairedBasic = cardIds.some(cardId => cardId !== skillId && !faceDown.has(cardId)
        && isFateBasicAttackDefinition(resolveFateAttack(player, cardId)?.definition ?? { id: '', type: undefined }));
    if (!pairedBasic) return [];
    if (!random) throw new Error('Fate Riding trigger requires the authoritative random source');
    const drawn = drawFateCards(player.deck, player.discard, 1, random);
    const timestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
    const drawEvent: FateDominationEvent = {
        type: 'FATE_CARDS_DRAWN',
        payload: { playerId, ...drawn },
        sourceCommandType: 'CONFIRM_ATTACK',
        timestamp,
    };
    return [{
        id: `fate:riding-draw:${core.round}:${playerId}:${skillId}`,
        timing, sourceRef: { kind: 'ability', id: skillId, ownerId: playerId, controllerId: playerId },
        controllerId: playerId, class: 'mandatory', condition: true,
        resolution: { type: 'events', events: [drawEvent] },
        visibility: { scope: 'public' },
    }];
}

export function createFateRidingInteraction(opportunity: Opportunity): InteractionDescriptor<FateRidingChoiceData> | undefined {
    if (opportunity.sourceRef.id !== FATE_RIDING_CHOICE_SOURCE) return undefined;
    const interaction = createSimpleChoiceFromTimingOpportunity<string>(opportunity as Opportunity<string>, {
        title: '坐骑召唤',
        subtitle: '选择 0–3 张基本威力不超过 3 的手牌；所选牌会明置打出。',
        targetType: 'hand',
        autoResolveIfSingle: false,
        responseValidationMode: 'snapshot',
    });
    const context = parseContext(opportunity.choice?.metadata);
    if (!context) throw new Error('Fate Riding opportunity is missing its rule context');
    return {
        ...interaction,
        ai: AI_UNSUPPORTED,
        data: { ...interaction.data, ai: AI_UNSUPPORTED, fateContext: context },
    };
}

function isCurrentRidingChoice(state: MatchState<FateDominationCore>) {
    const interaction = state.sys.interaction.current;
    return interaction && isFateRidingChoice(interaction) ? { interaction, context: choiceContext(interaction.data) } : undefined;
}

function cancelMatches(command: Command, interaction: InteractionDescriptor): boolean {
    const payload = record(command.payload);
    return command.type === 'SYS_INTERACTION_CANCEL'
        && command.playerId === interaction.playerId
        && exactPayloadKeys(payload, ['interactionId']) && payload.interactionId === interaction.id;
}

function matchingQueuedRidingChoice(state: MatchState<FateDominationCore>) {
    return state.sys.interaction.queue.find(interaction => isFateRidingChoice(interaction));
}

export function createFateRidingChoiceSystems(): EngineSystem<FateDominationCore>[] {
    return [{
        id: 'fate-riding-choice-guard', name: 'Fate 骑乘选择权限', priority: 9,
        beforeCommand: ({ state, command }) => {
            const current = isCurrentRidingChoice(state);
            if (!current) {
                if (!matchingQueuedRidingChoice(state)) return;
                if (command.type === 'SYS_INTERACTION_RESPOND' || command.type === 'SYS_INTERACTION_CANCEL') return;
                return { halt: true, error: '请先完成当前交互队列中的骑乘选择。' };
            }
            const { interaction, context } = current;
            if (command.type === 'SYS_INTERACTION_CANCEL') {
                if (!context || !hasBoundRidingFrame(state, interaction, context) || !cancelMatches(command, interaction)) {
                    return { halt: true, error: '只能由当前玩家取消当前代际的骑乘选择。' };
                }
                return;
            }
            if (command.type !== 'SYS_INTERACTION_RESPOND') return { halt: true, error: '请先完成当前骑乘选择。' };
            if (!context || !hasBoundRidingFrame(state, interaction, context)) return { halt: true, error: '骑乘选择上下文已失效，请取消本次选择。' };
            const payload = record(command.payload);
            const data = interaction.data;
            const valid = command.playerId === interaction.playerId && command.playerId === context.playerId
                && payload.interactionId === interaction.id && exactPayloadKeys(payload, ['interactionId', 'optionIds'])
                && validRidingSelection(state.core, context, payload.optionIds, data);
            if (!valid) return { halt: true, error: '骑乘选择包含无效、重复、过期或无法支付的手牌。' };
        },
    }, {
        id: 'fate-riding-choice-resolution', name: 'Fate 骑乘选择结算', priority: 32,
        beforeCommand: ({ state, command }) => {
            const frame = state.sys.resolution?.frames?.find(candidate => candidate.kind === FATE_RIDING_FRAME_KIND
                && candidate.id === state.sys.resolution?.activeFrameId);
            const metadata = frame?.metadata ?? {};
            const expectedInteractionId = typeof metadata.round === 'number' && typeof metadata.playerId === 'string'
                && typeof metadata.skillId === 'string' && typeof metadata.generation === 'string'
                ? fateRidingInteractionId(metadata.round, metadata.playerId, metadata.skillId, metadata.generation)
                : undefined;
            if (frame && expectedInteractionId && ['SYS_INTERACTION_RESPOND', 'SYS_INTERACTION_CANCEL'].includes(command.type)
                && record(command.payload).interactionId === expectedInteractionId && command.playerId === metadata.playerId) return { halt: true };
        },
        afterEvents: ({ state, events }) => {
            const resolved = events.filter(event => event.type === INTERACTION_EVENTS.RESOLVED
                && record(event.payload).sourceId === FATE_RIDING_CHOICE_SOURCE);
            if (resolved.length) {
                const generated: FateDominationEvent[] = [];
                const completedFrames: string[] = [];
                for (const event of resolved) {
                    const payload = record(event.payload);
                    const data = record(payload.interactionData);
                    const context = choiceContext(data);
                    const ids = payload.optionIds;
                    if (!context || payload.playerId !== context.playerId
                        || payload.interactionId !== fateRidingInteractionId(context.round, context.playerId, context.skillId, context.generation)
                        || !validRidingSelection(state.core, context, ids, data)) throw new Error('Invalid committed Fate Riding choice');
                    const cardIds = ids as string[];
                    const manaSpent = calculateFateRidingSelectionCost(state.core, context.playerId, cardIds);
                    if (manaSpent === undefined) throw new Error('Fate Riding selection lost its live card cost');
                    const usageKey = fateAbilityUsageKey(context.skillId, 'action');
                    const timestamp = typeof event.timestamp === 'number' ? event.timestamp : 0;
                    generated.push(
                        { type: 'FATE_ABILITY_USED', payload: { playerId: context.playerId, skillId: context.skillId, usageKey, manaSpent: 0 }, sourceCommandType: 'SYS_INTERACTION_RESPOND', timestamp },
                        { type: 'FATE_RIDING_CARDS_PLAYED', payload: { playerId: context.playerId, skillId: context.skillId, cardIds: [...cardIds], manaSpent }, sourceCommandType: 'SYS_INTERACTION_RESPOND', timestamp },
                    );
                    completedFrames.push(context.frameId);
                }
                let nextState = state;
                for (const frameId of completedFrames) nextState = completeResolutionFrame(nextState, frameId);
                return { state: nextState, events: generated };
            }

            const cancelled = events.filter(event => event.type === INTERACTION_EVENTS.CANCELLED
                && record(event.payload).sourceId === FATE_RIDING_CHOICE_SOURCE);
            if (!cancelled.length) return;
            let nextState = state;
            for (const event of cancelled) {
                const payload = record(event.payload);
                const context = choiceContext(payload.interactionData);
                if (context && (payload.playerId !== context.playerId
                    || payload.interactionId !== fateRidingInteractionId(context.round, context.playerId, context.skillId, context.generation))) {
                    throw new Error('Invalid cancelled Fate Riding choice');
                }
                const frame = context ? currentFrame(nextState, context) : nextState.sys.resolution?.frames?.find(candidate => (
                    candidate.kind === FATE_RIDING_FRAME_KIND
                    && candidate.metadata?.playerId === payload.playerId
                    && typeof candidate.metadata?.round === 'number' && typeof candidate.metadata?.skillId === 'string'
                    && typeof candidate.metadata?.generation === 'string'
                    && fateRidingInteractionId(candidate.metadata.round, String(candidate.metadata.playerId), candidate.metadata.skillId, candidate.metadata.generation) === payload.interactionId
                ));
                if (frame && frame.kind === FATE_RIDING_FRAME_KIND) nextState = completeResolutionFrame(nextState, frame.id);
            }
            return { state: nextState };
        },
    }];
}

