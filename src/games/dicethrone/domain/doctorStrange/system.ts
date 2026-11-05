/** 奇异博士法术事务宿主：程序只保存在ResolutionFrame，卡牌与资源只由领域事件归约。 */
import type { GameEvent, MatchState, ResolutionFrame } from '../../../../engine/types';
import { isSpectatorPlayerId } from '../../../../engine/playerView';
import type { EngineSystem, HookResult } from '../../../../engine/systems/types';
import { completeResolutionFrame, getActiveResolutionFrame, pushResolutionFrame, updateResolutionFrame } from '../../../../engine/systems/resolutionStack';
import type { AbilityEffect } from '../combat';
import { CP_MAX, type DiceThroneCore } from '../core-types';
import type { ChoiceRequestedEvent, DiceThroneEvent } from '../events';
import { buildDrawEvents } from '../deckEvents';
import { resolveEffectsToEvents, createDisplayOnlySettlement } from '../effects';
import { getActiveDice, getOpponents, getPlayerDieFace, isSkirmishMode, isTeamMode } from '../rules';
import { getPendingAttackSettlementStage } from '../utils';
import { playerAbilityHasDamage, playerAbilityNeedsSingleOpponentTarget } from '../abilityLookup';
import { DOCTOR_STRANGE_FACE as FACE, DOCTOR_STRANGE_TOKEN as TOKEN } from '../../heroes/doctor_strange/constants';
import type { DoctorStrangeEvent, SpellCandidate, SpellProgram, SpellTask, SpellZone } from './types';
import { isSpell } from './types';

const FRAME_KIND = 'dicethrone:doctor-strange-spell';
export const STRANGE_CHOICE_ID = 'doctor-strange-choice';
const TARGET_BOUND_OPERATIONS = new Set(['astral', 'binding', 'tendrils', 'tendrils-results', 'wand']);

function needsDeferredTarget(core: DiceThroneCore, playerId: string): boolean {
    const attack = core.pendingAttack;
    const abilityId = attack?.sourceAbilityId;
    if (!attack || attack.attackerId !== playerId || attack.defenderId || !abilityId
        || (!isTeamMode(core) && !isSkirmishMode(core))) return false;
    return playerAbilityHasDamage(core, playerId, abilityId)
        || playerAbilityNeedsSingleOpponentTarget(core, playerId, abilityId);
}

const zoneOf = (core: DiceThroneCore, playerId: string, cardId: string): SpellZone | undefined => (
    (['hand', 'deck', 'discard', 'preparedSpells'] as const).find(zone => core.players[playerId][zone]?.some(card => card.id === cardId))
);
const effect = (name: Extract<SpellTask, { kind: 'effect' }>['effect'], amount: number, targetId?: string): SpellTask => ({ kind: 'effect', effect: name, amount, targetId });
const castChoice = (remaining = 1, zone: SpellZone = 'preparedSpells', exclude?: string[]): SpellTask => ({ kind: 'cast-choice', zone, remaining, exclude });
const prepareChoice = (remaining = 1, zone: SpellZone = 'discard'): SpellTask => ({ kind: 'prepare-choice', zone, remaining });

function getProgram(frame: ResolutionFrame): SpellProgram {
    if (frame.kind !== FRAME_KIND || !frame.metadata?.program) throw new Error('奇异博士法术帧缺少程序');
    return frame.metadata.program as unknown as SpellProgram;
}

function writeProgram(state: MatchState<DiceThroneCore>, frame: ResolutionFrame, program: SpellProgram): MatchState<DiceThroneCore> {
    return updateResolutionFrame(state, frame.id, current => ({ ...current, metadata: { program },
        status: 'blocked', blockedBy: { type: 'post-reduce', id: frame.id, reason: '法术尚未结算完成' },
    }));
}

/** 技能/行动牌绑定同一操作表；同一效果族仅参数和来源不同。 */
function operationTasks(operation: string, core: DiceThroneCore, program: SpellProgram, values?: number[]): SpellTask[] {
    switch (operation) {
        case 'prepare-card': return [{ kind: 'prepare', cardId: program.sourceId, zone: 'hand', passive: true }];
        case 'prepare-hand': return [prepareChoice(1, 'hand')];
        case 'omen': return [effect('deja-vu', 1)];
        case 'awareness': return [{ kind: 'draw', amount: 1 }, effect('deja-vu', 1), effect('premonition', 2), prepareChoice()];
        case 'binding': return [effect('crimson-bands', 1, program.targetId)];
        case 'wand': return [effect('crimson-bands', 1, program.targetId)];
        case 'wand-after-damage': return [prepareChoice(), castChoice(2)];
        case 'cast-one': return [castChoice()];
        case 'premonition-two': return [effect('premonition', 2)];
        case 'grant-deja-vu': return [{ kind: 'target', effect: 'deja-vu', amount: 1 }];
        case 'ultimate': return [{ kind: 'ultimate' }];
        case 'ultimate-cast': return [castChoice(2)];
        case 'income': return [{ kind: 'income' }];
        case 'astral': case 'tendrils': case 'shield': return [{ kind: 'roll', operation }];
        case 'defense': {
            const faces = getActiveDice(core, 'defensiveRoll').map(die => die.symbol ?? getPlayerDieFace(core, program.playerId, die.value));
            return faces.map(face => face === FACE.MANDALA ? effect('damage', 1, program.targetId)
                : face === FACE.BOOK ? effect('premonition', 1)
                    : face === FACE.CLOAK ? effect('prevent', 2) : effect('damage', 3, program.targetId));
        }
        case 'astral-results': case 'tendrils-results': case 'shield-results': {
            return (values ?? []).flatMap(value => {
                const face = getPlayerDieFace(core, program.playerId, value);
                if (operation === 'shield-results') return [face === FACE.AMULET ? effect('premonition', 1)
                    : effect('prevent', face === FACE.MANDALA ? 1 : face === FACE.BOOK ? 2 : 3)];
                if (operation === 'astral-results') return [face === FACE.MANDALA ? effect('bonus', 3)
                    : face === FACE.BOOK ? effect('premonition', 1)
                        : face === FACE.CLOAK ? effect('crimson-bands', 1, program.targetId) : castChoice()];
                return [face === FACE.MANDALA ? effect('bonus', 1) : face === FACE.BOOK ? castChoice()
                    : face === FACE.CLOAK ? effect('bonus', 2) : effect('crimson-bands', 1, program.targetId)];
            });
        }
        default: throw new Error(`未登记的奇异博士操作：${operation}`);
    }
}

function getTargetChoiceTitleKey(task: Extract<SpellTask, { kind: 'target' }>): string {
    switch (task.effect) {
        case 'damage':
            return task.amount === 1 ? 'doctorStrange.selectOpponentToTakeOneDamage'
                : task.amount === 3 ? 'doctorStrange.selectOpponentToTakeThreeDamage'
                    : 'doctorStrange.selectOpponentToTakeDamage';
        case 'heal':
            return task.amount === 1 ? 'doctorStrange.selectHeroToHealOne'
                : task.amount === 3 ? 'doctorStrange.selectHeroToHealThree'
                    : 'doctorStrange.selectHeroToHeal';
        case 'deja-vu': return 'doctorStrange.selectPlayerToGainDejaVu';
        case 'crimson-bands': return 'doctorStrange.selectOpponentToReceiveCrimsonBands';
        case 'cp':
            return task.amount < 0 ? 'doctorStrange.selectOpponentToLoseOneCp'
                : 'doctorStrange.selectPlayerToGainCp';
    }
}

function getPrepareChoiceTitleKey(task: Extract<SpellTask, { kind: 'prepare-choice' }>): string {
    if (task.zone === 'deck') return 'doctorStrange.prepareFromDeckTop';
    if (task.zone === 'hand') return 'doctorStrange.prepareFromHand';
    return 'doctorStrange.prepareFromDiscard';
}

function spellTasks(index: number, mode: 'prepare' | 'cast', program: SpellProgram, core: DiceThroneCore, cardId: string): SpellTask[] {
    if (mode === 'prepare') {
        switch (index) {
            case 0: return [{ kind: 'target', effect: 'damage', amount: 1, opponents: true }];
            case 1: return [effect('premonition', 1)];
            case 2: return [{ kind: 'target', effect: 'heal', amount: 1 }];
            case 3: return [effect('cp', 1)];
            case 4: return [{ kind: 'remove-status' }];
            case 5: return [{ kind: 'target', effect: 'deja-vu', amount: 1 }];
            case 6: return [{ kind: 'target', effect: 'crimson-bands', amount: 1, opponents: true }];
            case 7: return [{ kind: 'target', effect: 'cp', amount: -1, opponents: true }];
            case 8: return [];
            default: throw new Error(`非法法术索引：${index}`);
        }
    }
    switch (index) {
        case 0: return [effect('bonus', 1)];
        case 1: return [castChoice(2, 'discard', [cardId])];
        case 2: return [effect('premonition', 3)];
        case 3: return [{ kind: 'target', effect: 'damage', amount: 3, opponents: true }];
        // 瓦图姆之风必须先进入弃牌堆，才能把自身列为准备候选；施放末尾
        // 的通用 dispose 会在准备效果完成后再次将自身弃置（若未被准备则为空操作）。
        case 4: return [{ kind: 'dispose', cardId, destination: 'discard' }, prepareChoice()];
        case 5: return [{ kind: 'target', effect: 'heal', amount: 3 }];
        case 6: return [effect('unblockable', 0)];
        case 7: return [effect('bonus', 3)];
        case 8: return [effect('bonus', Math.min(core.players[program.playerId].hand.length, 4))];
        default: throw new Error(`非法法术索引：${index}`);
    }
}

function buildEffectEvents(core: DiceThroneCore, program: SpellProgram, task: Extract<SpellTask, { kind: 'effect' }>, timestamp: number): DiceThroneEvent[] {
    const playerId = program.playerId;
    const targetId = task.targetId ?? playerId;
    const sourceAbilityId = task.sourceId ?? program.sourceId;
    const sourceCommandType = 'ABILITY_EFFECT';
    if (task.effect === 'cp') {
        const cp = core.players[targetId].resources.cp ?? 0;
        const newValue = Math.max(0, Math.min(CP_MAX, cp + task.amount));
        return [{ type: 'CP_CHANGED', payload: { playerId: targetId, delta: newValue - cp, newValue }, sourceCommandType, timestamp }];
    }
    if (task.effect === 'bonus') return [{
        type: 'BONUS_DAMAGE_ADDED',
        payload: {
            playerId,
            amount: task.amount,
            sourceCardId: sourceAbilityId,
            ...(['postDamagePending', 'readyToResolve'].includes(getPendingAttackSettlementStage(core.pendingAttack) ?? '')
                ? { applyToResolvedAttack: true }
                : {}),
        },
        sourceCommandType,
        timestamp,
    }];
    if (task.effect === 'prevent') return [{ type: 'PREVENT_DAMAGE', payload: { targetId, amount: task.amount, sourceAbilityId }, sourceCommandType, timestamp }];
    if (task.effect === 'unblockable') return [{ type: 'ATTACK_MADE_UNDEFENDABLE', payload: { attackerId: playerId }, sourceCommandType, timestamp }];
    const action: NonNullable<AbilityEffect['action']> = task.effect === 'damage'
        ? { type: 'damage', target: 'opponent', value: task.amount, damageScope: 'direct', unblockable: true }
        : task.effect === 'heal' ? { type: 'heal', target: 'opponent', value: task.amount }
            : task.effect === 'crimson-bands' ? { type: 'grantStatus', target: 'opponent', statusId: TOKEN.CRIMSON_BANDS, value: task.amount }
                : { type: 'grantToken', target: 'opponent', tokenId: task.effect === 'premonition' ? TOKEN.PREMONITION : TOKEN.DEJA_VU, value: task.amount };
    return resolveEffectsToEvents([{ action, timing: 'immediate', description: `doctorStrange.effects.${task.effect}` }], 'immediate', {
        state: core, attackerId: playerId, defenderId: targetId, sourceAbilityId, damageDealt: 0, timestamp,
        damageOrigin: 'card',
    });
}

export function createDoctorStrangeSpellSystem(): EngineSystem<DiceThroneCore> {
    return {
        id: 'dicethrone-doctor-strange-spells', name: '奇异博士法术结算', priority: 23,
        afterEvents: ({ state, events, command, random, pendingAfterEventsToReduceCount }): HookResult<DiceThroneCore> | void => {
            if ((pendingAfterEventsToReduceCount ?? 0) > 0) return;
            const phaseChanged = events.find(event => event.type === 'SYS_PHASE_CHANGED') as (GameEvent<'SYS_PHASE_CHANGED', { to?: string }> | undefined);
            if (phaseChanged?.payload.to === 'offensiveRoll' || phaseChanged?.payload.to === 'main2') {
                const playerId = state.core.activePlayerId;
                const player = state.core.players[playerId];
                if (phaseChanged.payload.to === 'offensiveRoll'
                    && (player?.statusEffects[TOKEN.CRIMSON_BANDS] ?? 0) > 0
                    && (player.crimsonBandsReceivedTurn ?? -1) < state.core.turnNumber
                    && player.crimsonBandsActiveTurn !== state.core.turnNumber) {
                    return { events: [{ type: 'STRANGE_BANDS_ACTIVATED', payload: { playerId }, timestamp: command.timestamp ?? 0, sourceCommandType: command.type }] };
                }
                if (phaseChanged.payload.to === 'main2'
                    && (player?.statusEffects[TOKEN.CRIMSON_BANDS] ?? 0) > 0
                    && player.crimsonBandsActiveTurn === state.core.turnNumber) {
                    return { events: [{ type: 'STATUS_REMOVED', payload: { targetId: playerId, statusId: TOKEN.CRIMSON_BANDS, stacks: 1 }, timestamp: command.timestamp ?? 0, sourceCommandType: command.type }] };
                }
            }
            let next = state;
            const timestamp = command.timestamp ?? events.at(-1)?.timestamp ?? 0;
            const requested = events.filter((event): event is Extract<DoctorStrangeEvent, { type: 'STRANGE_OPERATION_REQUESTED' }> => event.type === 'STRANGE_OPERATION_REQUESTED');
            const deferredRequests = requested.filter(request => TARGET_BOUND_OPERATIONS.has(request.payload.operation));
            if (deferredRequests.length === requested.length && deferredRequests.length > 0
                && needsDeferredTarget(state.core, deferredRequests[0].payload.playerId)) {
                const attack = state.core.pendingAttack!;
                const alreadyQueued = attack.deferredDoctorStrangeOperations ?? [];
                return { events: [{ type: 'PENDING_ATTACK_UPDATED', payload: {
                    attackerId: attack.attackerId,
                    patch: { deferredDoctorStrangeOperations: [...alreadyQueued, ...deferredRequests.map(request => ({
                        sourceId: request.payload.sourceId,
                        operation: request.payload.operation,
                        ...(request.payload.values ? { values: request.payload.values } : {}),
                    }))] },
                }, sourceCommandType: command.type, timestamp: deferredRequests[0].timestamp } as DiceThroneEvent] };
            }
            for (const request of requested) {
                const { playerId, targetId, sourceId, operation, values } = request.payload;
                const active = getActiveResolutionFrame(next);
                const existing = active?.kind === FRAME_KIND ? getProgram(active) : undefined;
                if (existing && existing.playerId === playerId) {
                    next = writeProgram(next, active!, { ...existing, tasks: [{ kind: 'operation', operation, values }, ...existing.tasks] });
                } else {
                    const frame: ResolutionFrame = {
                        id: `strange:${playerId}:${sourceId}:${request.timestamp}`, kind: FRAME_KIND,
                        ownerGame: 'dicethrone', ownerSystem: 'dicethrone-doctor-strange-spells', ordering: 'nested-body',
                        status: 'blocked', phase: next.sys.phase, phaseGate: 'block-advance-when-blocked',
                        blockedBy: { type: 'post-reduce', reason: '法术尚未结算完成' },
                        metadata: { program: { playerId, targetId: targetId ?? getOpponents(next.core, playerId)[0] ?? playerId,
                            sourceId, parentResponseWindowId: next.sys.responseWindow?.current?.id,
                            parentDamageId: next.core.pendingDamage?.id,
                            tasks: [{ kind: 'operation', operation, values }] } satisfies SpellProgram },
                    };
                    next = pushResolutionFrame(next, frame);
                }
            }
            let frame = getActiveResolutionFrame(next);
            if (frame?.kind !== FRAME_KIND) return next !== state ? { state: next } : undefined;
            let program = getProgram(frame);
            const resolved = events.find(event => event.type === 'CHOICE_RESOLVED' && (event.payload as { customId?: string }).customId === STRANGE_CHOICE_ID) as Extract<DiceThroneEvent, { type: 'CHOICE_RESOLVED' }> | undefined;
            if (resolved) {
                if (resolved.payload.playerId !== program.playerId || !program.choices) throw new Error('奇异博士选择来源与法术帧不匹配');
                const selected = program.choices[resolved.payload.value];
                if (!selected) throw new Error('奇异博士选择索引无效');
                program = { ...program, choices: undefined, tasks: [...selected.tasks, ...program.tasks] };
                next = writeProgram(next, frame, program);
            }
            if (program.choices || next.sys.interaction.current
                || (next.sys.responseWindow?.current && next.sys.responseWindow.current.id !== program.parentResponseWindowId)
                || (next.core.pendingDamage && next.core.pendingDamage.id !== program.parentDamageId)
                || next.core.pendingBonusDiceSettlement) return next !== state ? { state: next } : undefined;

            const emit = (generated: GameEvent[]): HookResult<DiceThroneCore> => ({ state: writeProgram(next, frame!, program), events: generated });
            const choose = (choices: SpellCandidate[], titleKey: string): HookResult<DiceThroneCore> => {
                program = { ...program, choices };
                const request: ChoiceRequestedEvent = { type: 'CHOICE_REQUESTED', sourceCommandType: 'ABILITY_EFFECT', timestamp,
                    payload: { playerId: program.playerId, sourceAbilityId: program.sourceId, titleKey,
                        choiceContext: { frameId: frame!.id },
                        options: choices.map((candidate, index) => ({
                            value: index,
                            customId: STRANGE_CHOICE_ID,
                            labelKey: candidate.labelKey,
                            labelParams: candidate.labelParams,
                            previewRef: candidate.previewRef,
                            targetPlayerId: candidate.targetPlayerId,
                            choiceKind: candidate.choiceKind,
                            cardId: candidate.cardId,
                            cardSourceZone: candidate.cardSourceZone,
                            candidateStatusId: candidate.statusId,
                        })),
                    },
                };
                return emit([request]);
            };
            // 无效果的程序节点可在同一次规则计算中展开；遇到真实事件或玩家决策立即让出。
            while (program.tasks.length) {
                const [task, ...rest] = program.tasks;
                program = { ...program, tasks: rest };
                const prepend = (...tasks: SpellTask[]) => { program = { ...program, tasks: [...tasks, ...program.tasks] }; };
                const core = next.core;
                const player = core.players[program.playerId];
                if (task.kind === 'operation') { prepend(...operationTasks(task.operation, core, program, task.values)); continue; }
                if (task.kind === 'effect') {
                    const generated = buildEffectEvents(core, program, task, timestamp);
                    if (generated.length) return emit(generated);
                    continue;
                }
                if (task.kind === 'consume') {
                    const available = player.tokens[task.tokenId] ?? 0;
                    if (available < task.amount) throw new Error('法术结算资源不足');
                    return emit([{ type: 'TOKEN_CONSUMED', payload: { playerId: program.playerId, tokenId: task.tokenId, amount: task.amount, newTotal: available - task.amount, sourceAbilityId: program.sourceId }, sourceCommandType: 'ABILITY_EFFECT', timestamp }]);
                }
                if (task.kind === 'prepare-choice' || task.kind === 'cast-choice') {
                    const cards = (player[task.zone] ?? []).filter(card => isSpell(card)
                        && (task.kind !== 'prepare-choice' || !task.eligible || task.eligible.includes(card.id))
                        && (task.kind !== 'cast-choice' || (!task.used?.includes(card.id) && !task.exclude?.includes(card.id))));
                    if (!cards.length || task.remaining <= 0) continue;
                    const choices: SpellCandidate[] = cards.map(card => ({ labelKey: card.name, previewRef: card.previewRef,
                        choiceKind: 'card', cardId: card.id, cardSourceZone: task.zone,
                        tasks: [task.kind === 'prepare-choice' ? { kind: 'prepare', cardId: card.id, zone: task.zone, passive: task.zone === 'hand' }
                            : { kind: 'cast', cardId: card.id, zone: task.zone },
                        ...(task.remaining > 1 ? [{ ...task, remaining: task.remaining - 1,
                            ...(task.kind === 'cast-choice' ? { used: [...(task.used ?? []), card.id] } : {}) } as SpellTask] : [])],
                    }));
                    // 通用FAQ：施放永远可放弃；准备仅“至多/可以”可放弃。
                    if (task.kind === 'cast-choice' || task.optional) choices.push({ labelKey: 'doctorStrange.skip', choiceKind: 'skip', tasks: [] });
                    return choose(choices, task.kind === 'cast-choice'
                        ? 'doctorStrange.cast'
                        : getPrepareChoiceTitleKey(task));
                }
                if (task.kind === 'prepare' || task.kind === 'cast') {
                    const card = player[task.zone]?.find(candidate => candidate.id === task.cardId);
                    if (!card?.spell) throw new Error('施法选择的卡牌已不在授权来源区');
                    const actions = spellTasks(card.spell.index, task.kind, program, core, card.id).map(action =>
                        action.kind === 'effect' || action.kind === 'target' ? { ...action, sourceId: card.id } : action);
                    prepend(...actions, ...(task.kind === 'cast' ? [{ kind: 'dispose', cardId: card.id, destination: card.spell.destination } as SpellTask] : []));
                    if (task.kind === 'prepare') return emit([{ type: 'STRANGE_CARD_MOVED', payload: { playerId: program.playerId, cardId: card.id,
                        from: task.zone, to: 'preparedSpells', passive: task.passive }, timestamp, sourceCommandType: 'ABILITY_EFFECT' }]);
                    continue;
                }
                if (task.kind === 'dispose') {
                    const from = zoneOf(core, program.playerId, task.cardId);
                    if (!from) throw new Error('法术完成后找不到原卡');
                    if (from === task.destination) continue;
                    return emit([{ type: 'STRANGE_CARD_MOVED', payload: { playerId: program.playerId, cardId: task.cardId, from, to: task.destination }, timestamp, sourceCommandType: 'ABILITY_EFFECT' }]);
                }
                if (task.kind === 'target') {
                    const targets = task.opponents ? getOpponents(core, program.playerId) : Object.keys(core.players);
                    return choose(targets.map(targetId => ({ labelKey: 'doctorStrange.target', choiceKind: 'player', targetPlayerId: targetId,
                        tasks: [{ ...effect(task.effect, task.amount, targetId), sourceId: task.sourceId } as SpellTask] })), getTargetChoiceTitleKey(task));
                }
                if (task.kind === 'remove-status') {
                    const choices: SpellCandidate[] = [];
                    for (const [targetId, target] of Object.entries(core.players)) {
                        for (const definition of core.tokenDefinitions) {
                            if (definition.category !== 'debuff' && definition.category !== 'buff') continue;
                            const stacks = target.statusEffects[definition.id] ?? 0;
                            if (stacks <= 0) continue;
                            choices.push({ labelKey: 'doctorStrange.removeStatus', labelParams: { status: definition.name }, choiceKind: 'status', statusId: definition.id, targetPlayerId: targetId,
                                tasks: [{ kind: 'remove-status-target', targetId, statusId: definition.id, token: false }] });
                        }
                    }
                    choices.push({ labelKey: 'doctorStrange.skip', choiceKind: 'skip', tasks: [] });
                    return choose(choices, 'doctorStrange.removeStatusTitle');
                }
                if (task.kind === 'remove-status-target') return emit([task.token
                    ? { type: 'TOKEN_CONSUMED', payload: { playerId: task.targetId, tokenId: task.statusId, amount: 1, newTotal: Math.max(0, (core.players[task.targetId].tokens[task.statusId] ?? 0) - 1), sourceAbilityId: program.sourceId }, timestamp, sourceCommandType: 'ABILITY_EFFECT' }
                    : { type: 'STATUS_REMOVED', payload: { targetId: task.targetId, statusId: task.statusId, stacks: 1 }, timestamp, sourceCommandType: 'ABILITY_EFFECT' }]);
                if (task.kind === 'income') {
                    const choices: SpellCandidate[] = [{ labelKey: 'doctorStrange.incomeNormal', tasks: [{ kind: 'draw', amount: 1 }] }];
                    for (const amount of [1, 3]) if ((player.tokens[TOKEN.PREMONITION] ?? 0) >= amount) choices.push({
                        labelKey: `doctorStrange.income${amount}`, tasks: [{ kind: 'consume', tokenId: TOKEN.PREMONITION, amount }, { kind: 'draw', amount: amount === 1 ? 2 : 3, returnOne: true }],
                    });
                    return choose(choices, 'doctorStrange.premonition');
                }
                if (task.kind === 'draw') {
                    const drawEvents = buildDrawEvents(core, program.playerId, task.amount, random, 'ABILITY_EFFECT', timestamp);
                    if (task.returnOne) prepend({ kind: 'income-return', cardIds: drawEvents.flatMap(event => event.type === 'CARD_DRAWN' ? [event.payload.cardId] : []) });
                    if (drawEvents.length) return emit(drawEvents);
                    continue;
                }
                if (task.kind === 'income-return') {
                    const cards = player.hand.filter(card => task.cardIds.includes(card.id));
                    if (!cards.length) continue;
                    return choose(cards.map(card => ({ labelKey: card.name, previewRef: card.previewRef, choiceKind: 'card', cardId: card.id, cardSourceZone: 'hand', tasks: [{ kind: 'return-position', cardId: card.id }] })), 'doctorStrange.returnCard');
                }
                if (task.kind === 'return-position') return choose((['top', 'bottom'] as const).map(position => ({
                    labelKey: `doctorStrange.${position}`, tasks: [{ kind: 'return', cardId: task.cardId, position }],
                })), 'doctorStrange.returnPosition');
                if (task.kind === 'return') return emit([{ type: 'STRANGE_CARD_MOVED', payload: { playerId: program.playerId, cardId: task.cardId, from: 'hand', to: 'deck', position: task.position }, sourceCommandType: 'ABILITY_EFFECT', timestamp }]);
                if (task.kind === 'ultimate') {
                    const ids = player.deck.slice(0, 5).map(card => card.id);
                    prepend({ kind: 'prepare-choice', zone: 'deck', remaining: 2, eligible: ids, optional: true }, { kind: 'reorder', cardIds: ids });
                    continue;
                }
                if (task.kind === 'reorder') {
                    const remaining = task.cardIds.filter(id => player.deck.some(card => card.id === id) && !task.ordered?.includes(id));
                    if (!remaining.length) {
                        if (task.ordered?.length) return emit([{ type: 'STRANGE_DECK_ORDERED', payload: { playerId: program.playerId, cardIds: task.ordered }, sourceCommandType: 'ABILITY_EFFECT', timestamp }]);
                        continue;
                    }
                    return choose(remaining.map(id => ({ labelKey: player.deck.find(card => card.id === id)!.name, previewRef: player.deck.find(card => card.id === id)!.previewRef,
                        choiceKind: 'card', cardId: id, cardSourceZone: 'deck',
                        tasks: [{ ...task, ordered: [...(task.ordered ?? []), id] }],
                    })), 'doctorStrange.orderNext');
                }
                if (task.kind === 'roll') {
                    const dice = [0, 1].map(index => {
                        const value = random.d(6);
                        const face = getPlayerDieFace(core, program.playerId, value);
                        if (!face) throw new Error('奇异博士奖励骰缺少已注册骰面');
                        return { index, value, face, effectKey: 'doctorStrange.bonusDie' };
                    });
                    const rolled: DiceThroneEvent[] = dice.map(die => ({ type: 'BONUS_DIE_ROLLED', payload: { value: die.value, face: die.face, playerId: program.playerId, targetPlayerId: program.targetId, effectKey: die.effectKey }, sourceCommandType: 'ABILITY_EFFECT', timestamp }));
                    rolled.push(createDisplayOnlySettlement(program.sourceId, program.playerId, program.targetId, dice, timestamp, {
                        customResolutionId: `strange-${task.operation}`,
                        continuation: { kind: 'attack', settlementStage: core.pendingAttack?.settlementStage ?? 'preDamage', markBonusDiceResolved: true },
                    }));
                    return emit(rolled);
                }
            }
            frame = getActiveResolutionFrame(next)!;
            const completed = completeResolutionFrame(writeProgram(next, frame, program), frame.id);
            if (!next.core.pendingAttack) return { state: completed };
            return {
                state: completed,
                events: [{
                    type: 'STRANGE_OPERATION_RESOLVED',
                    payload: { playerId: program.playerId, sourceId: program.sourceId },
                    sourceCommandType: 'ABILITY_EFFECT',
                    timestamp,
                }],
            };
        },
        playerView: (state, playerId) => {
            const isHiddenOpponent = (ownerId: unknown) => !isSpectatorPlayerId(playerId)
                && typeof ownerId === 'string'
                && ownerId !== playerId
                && state.core.players[ownerId]?.characterId === 'doctor_strange';
            const filterPrivateEvent = (event: GameEvent): GameEvent => {
                const payload = event.payload as Record<string, unknown> | undefined;
                if (!payload || !isHiddenOpponent(payload.playerId)) return event;
                if (event.type === 'CARD_DRAWN' || event.type === 'CARD_REORDERED') {
                    const { cardId: _cardId, ...safePayload } = payload;
                    return { ...event, payload: safePayload } as GameEvent;
                }
                if (event.type === 'STRANGE_OPERATION_REQUESTED') {
                    return { ...event, payload: { ...payload, sourceId: 'doctor-strange-private' } } as GameEvent;
                }
                if (event.type === 'STRANGE_OPERATION_RESOLVED') {
                    return { ...event, payload: { ...payload, sourceId: 'doctor-strange-private' } } as GameEvent;
                }
                if (event.type === 'CHOICE_REQUESTED') {
                    return { ...event, payload: { ...payload, titleKey: 'doctorStrange.privateChoice', choiceContext: undefined, options: [] } } as GameEvent;
                }
                if (event.type === 'STRANGE_DECK_ORDERED') {
                    return { ...event, payload: { ...payload, cardIds: [] } } as GameEvent;
                }
                if (event.type === 'STRANGE_CARD_MOVED') {
                    const isPrivateMove = payload.to === 'deck'
                        || (payload.from === 'deck' && payload.to !== 'preparedSpells')
                        || (payload.to === 'hand' && payload.from !== 'preparedSpells');
                    if (isPrivateMove) {
                        const { cardId: _cardId, position: _position, ...safePayload } = payload;
                        return { ...event, payload: safePayload } as GameEvent;
                    }
                }
                return event;
            };
            const eventStream = state.sys.eventStream;
            return {
                ...(state.sys.resolution ? { resolution: { ...state.sys.resolution, frames: state.sys.resolution.frames.map(frame => frame.kind === FRAME_KIND && getProgram(frame).playerId !== playerId
                    ? { ...frame, metadata: undefined, deferredActions: undefined, deferredEvents: undefined } : frame) } } : {}),
                ...(eventStream ? { eventStream: { ...eventStream, entries: eventStream.entries.map(entry => ({ ...entry, event: filterPrivateEvent(entry.event) })) } } : {}),
            };
        },
    };
}
