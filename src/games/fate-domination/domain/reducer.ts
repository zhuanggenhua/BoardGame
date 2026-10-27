import { prepareFatePostBattleEvents } from './postBattleChoice';
import { resolveFateAbilitySource, fateAbilityUsageKey } from './abilitySource';
import { reduceFateRound } from './roundLifecycle';
import { fateLocationResults } from './battleAwards';
import {nextFateDeploymentSlot,fateDeploymentManaGain} from './deployment';
import {resolveFateAttack,resolveFateAttackConfirmation,selectedFateAttackCost} from './attackSelection';
import { FATE_DEFAULT_HAND_LIMIT, capFateMana } from './rules';
import { calculateFatePower } from './power';
import type { RandomFn, MatchState } from '../../../engine/types';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID } from '../data';
import { FATE_BATTLE_LOCATION_ORDER } from './types';
import type { FateDominationCommand, FateDominationCore, FateDominationEvent, LocationId } from './types';
import { resolveFateMovement } from './movement';
import { executeFateAbility, resolveFatePlayerAbility } from './abilityRegistry';
import { fateRidingFrameId, fateRidingGeneration } from './ridingChoice';
import { createFateAttackDeck } from './setup';
import {
    addFateRuleModifier,
    canSufferFateDefeat,
    createFateDefeatMarker,
    fateEliminationOutcome,
    normalizeFateRuleState,
    removeFateRuleModifier,
} from './mechanics';

const eventMeta = (command: FateDominationCommand) => ({ sourceCommandType: command.type, timestamp: typeof command.timestamp === 'number' ? command.timestamp : 0 });

const removePlayerFromBattlefield = (
    battlefield: FateDominationCore['battlefield'],
    playerId: string,
): FateDominationCore['battlefield'] => Object.fromEntries(
    Object.entries(battlefield).map(([locationId, location]) => [
        locationId,
        { ...location, playerIds: location.playerIds.filter((id) => id !== playerId) },
    ]),
) as FateDominationCore['battlefield'];


export function execute(state: MatchState<FateDominationCore>, command: FateDominationCommand, random: RandomFn): FateDominationEvent[] {
    const core = state.core;
    const meta = eventMeta(command);
    switch (command.type) {
        case 'USE_COMMAND_SPELL': {
            const player = core.players[command.playerId];
            const events: FateDominationEvent[] = [{ type: 'COMMAND_SPELL_USED', payload: { playerId: player.id, effect: command.payload.effect }, ...meta }];
            if (command.payload.effect === 'battle') {
                const source = { sourceId: 'command-spell', sourceKind: 'rule' as const, ownerId: player.id, controllerId: player.id };
                const id = `command-spell:${core.round}:${player.id}:${player.commandSpells}`;
                events.push({ type: 'FATE_RULE_MODIFIER_ATTACHED', payload: { modifier: { id: `${id}:power`, source, duration: 'round-end', kind: 'power-transform', selector: 'total', target: 'self', operation: 'add', value: 2 } }, ...meta });
                events.push({ type: 'FATE_RULE_MODIFIER_ATTACHED', payload: { modifier: { id: `${id}:win`, source, duration: 'round-end', kind: 'battle-win-reward', playerId: player.id, victoryPoints: 2 } }, ...meta });
            }
            if (command.payload.effect === 'move' && command.payload.targetLocationId && player.locationId) {
                // Preserve rule-owned context through EventCommit revalidation.
                const context = { allowAnyDestination: true, ignoreEngagement: true, free: true };
                const resolution = resolveFateMovement(core, player.id, command.payload.targetLocationId, 'effect', context);
                if (resolution.valid && resolution.path) events.push({ type: 'PLAYER_MOVED', payload: { playerId: player.id, from: player.locationId, to: command.payload.targetLocationId, path: [...resolution.path], mode: 'effect', manaSpent: 0, context }, ...meta });
            }
            return events;
        }
        case 'SELECT_MASTER': return [{ type: 'MASTER_SELECTED', payload: { playerId: command.playerId, masterId: command.payload.masterId }, ...meta }];
        case 'SELECT_SERVANT': { const servant = FATE_SERVANT_BY_ID[command.payload.servantId]; return [{ type: 'SERVANT_SELECTED', payload: { playerId: command.playerId, servantId: servant.id }, ...meta }]; }
        case 'DEPLOY_MASTER': { const deploymentSlot = command.payload.deploymentSlot === undefined ? nextFateDeploymentSlot(core, command.payload.locationId) : command.payload.deploymentSlot; return [{ type: 'MASTER_DEPLOYED', payload: { playerId: command.playerId, locationId: command.payload.locationId, deploymentSlot, manaGain: fateDeploymentManaGain(command.payload.locationId, deploymentSlot) }, ...meta }]; }
        case 'MOVE_PLAYER': {
            const from = core.players[command.playerId].locationId!;
            const resolution = resolveFateMovement(core, command.playerId, command.payload.locationId, 'normal');
            if (!resolution.valid || !resolution.path || resolution.cost === null) return [];
            return [{ type: 'PLAYER_MOVED', payload: { playerId: command.playerId, from, to: command.payload.locationId, path: [...resolution.path], mode: resolution.mode, manaSpent: resolution.cost }, ...meta }];
        }
        case 'PASS_ACTION': return [{ type: 'ACTION_PASSED', payload: { playerId: command.playerId }, ...meta }];
        case 'PLAY_SKILL': {
            const skill = resolveFateAbilitySource(core.players[command.playerId],command.payload.skillId)!.skill;
            const definition = resolveFatePlayerAbility(core,command.playerId,skill.id);
            if (!definition) {
                return [{ type: 'FATE_ABILITY_UNIMPLEMENTED', payload: { playerId: command.playerId, skillId: skill.id }, ...meta }];
            }
            if (definition.effects.some(effect => effect.type === 'riding')) {
                const generation = fateRidingGeneration(state.sys.eventStream.nextId, state.sys.undo.rollbackRevision ?? 0);
                return [{
                    type: 'FATE_RIDING_CHOICE_REQUESTED',
                    payload: {
                        playerId: command.playerId, skillId: skill.id, round: core.round, generation,
                        frameId: fateRidingFrameId(core.round, command.playerId, skill.id, generation),
                    },
                    ...meta,
                }];
            }
            const skillEvent: FateDominationEvent = { type: 'FATE_ABILITY_USED', payload: { playerId: command.playerId, skillId: skill.id, usageKey:fateAbilityUsageKey(skill.id,core.phase), manaSpent:resolveFatePlayerAbility(core,command.playerId,skill.id)?.activationCost??0 }, ...meta };
            const abilityEvents = executeFateAbility({
                sourceId: skill.id,
                ownerId: command.playerId,
                playerId: command.playerId,
                timestamp: typeof command.timestamp === 'number' ? command.timestamp : 0,
                core,
                random,
                skill,
                targetPlayerId: command.payload.targetPlayerId,
                targetLocationId: command.payload.targetLocationId,
                targetCardId: command.payload.targetCardId,
            }).events;
            return [skillEvent, ...abilityEvents];
        }
        case 'SELECT_ATTACK_CARD': { const selected = core.players[command.playerId].selectedAttackIds.includes(command.payload.cardId); return [{ type: 'ATTACK_CARD_SELECTED', payload: { playerId: command.playerId, cardId: command.payload.cardId, selected: !selected, faceDown: command.payload.faceDown }, ...meta }]; }
        case 'CONFIRM_ATTACK': {
            const attackCore=resolveFateAttackConfirmation(core,command.playerId,command.payload);
            if(!attackCore)throw new Error('CONFIRM_ATTACK reached execute without a valid selection');
            const player=attackCore.players[command.playerId];
            const cardIds=[...player.selectedAttackIds];
            const faceDownIds=[...(player.selectedFaceDownIds??[])];
            return [{type:'ATTACKS_CONFIRMED',payload:{playerId:player.id,cardIds,faceDownIds,
                revealHand:['miyama','shinto'].includes(player.locationId??'')&&cardIds.every(id=>faceDownIds.includes(id)),
                power:calculateFatePower(attackCore,player.id,cardIds),manaSpent:selectedFateAttackCost(player),
            },...meta}];
        }
        case 'INSPECT_CARD': return [{ type: 'CARD_INSPECTED', payload: { playerId: command.playerId, cardId: command.payload.cardId }, ...meta }];
        case 'RESOLVE_LOCATION': {
            const locationId = command.payload.locationId;
            const results = fateLocationResults(core, locationId);
            const events: FateDominationEvent[] = [{ type: 'LOCATION_RESOLVED', payload: { locationId, results }, ...meta }];
            const projectedResults = [...core.resolvedResults, ...results];
            const resolvedCount = core.resolvedLocations.includes(locationId)
                ? core.resolvedLocations.length
                : core.resolvedLocations.length + 1;
            const battleLocationCount = core.battleResolution?.locationIds.length ?? FATE_BATTLE_LOCATION_ORDER.length;
            if (resolvedCount < battleLocationCount) return events;
            return [...events,...prepareFatePostBattleEvents(core,projectedResults,random,meta)];
        }
        case 'ADVANCE_PHASE': {
            const events: FateDominationEvent[] = [];
            if (core.phase === 'preparation' && core.round === 1 && !(core.phaseCompletedPlayerIds ?? []).includes(command.playerId)) {
                const player = core.players[command.playerId];
                const initialHandAlreadyDealt = (core.initialAttackHandDealtPlayerIds ?? []).includes(command.playerId)
                    || (Array.isArray(player?.hand) && player.hand.length > 0);
                if (!initialHandAlreadyDealt) {
                    events.push({
                        type: 'INITIAL_ATTACK_HAND_DEALT',
                        payload: { playerId: command.playerId, deck: random.shuffle(createFateAttackDeck(command.playerId, player.servantId)) },
                        ...meta,
                    });
                }
            }
            if (core.phase === 'preparation' || core.phase === 'outpost' || (core.phase === 'battle' && !core.battleResolution)) {
                const nextPlayerId = core.turnOrder.find(id => !core.players[id].eliminated && id !== command.playerId && !(core.phaseCompletedPlayerIds ?? []).includes(id));
                if (nextPlayerId) return [...events, { type: 'FATE_PHASE_PLAYER_FINISHED', payload: { playerId: command.playerId, nextPlayerId }, ...meta }];
            }
            if (core.phase === 'battle') {
                if (!core.battleResolution) {
                    return [{
                        type: 'FATE_BATTLE_RESOLUTION_STARTED',
                        payload: {
                            frameId: `fate:battle:${core.round}`,
                            round: core.round,
                            locationIds: [...FATE_BATTLE_LOCATION_ORDER],
                        },
                        ...meta,
                    }];
                }
                if (core.battleResolution.step !== 'awards') return [];
                return prepareFatePostBattleEvents(core,core.resolvedResults,random,meta);
            }
            return [...events, { type: 'PHASE_ADVANCED', payload: { phase: core.phase === 'preparation' ? 'outpost' : 'action', round: core.round, currentPlayerId: core.turnOrder.find(id => !core.players[id].eliminated) ?? core.currentPlayerId }, ...meta }];
        }
        default: return [];
    }
}

export function reduce(state: FateDominationCore, event: FateDominationEvent): FateDominationCore {
    switch (event.type) {
        case 'COMMAND_SPELL_USED': {
            const player = state.players[event.payload.playerId];
            const commandSpells = Math.max(0, player.commandSpells - 1);
            const releasesLancelotName = commandSpells === 0 && player.commandSpells > 0
                && player.skills.some(skill => skill.id.split(':')[0] === 'sc_lance_2');
            const servantSkillIds = releasesLancelotName
                ? (FATE_SERVANT_BY_ID[player.servantId]?.skillCards ?? []).flatMap(definition => player.skills
                    .filter(skill => skill.id.split(':')[0] === definition.id)
                    .map(skill => skill.id))
                : [];
            return { ...state, players: { ...state.players, [player.id]: {
                ...player,
                commandSpells,
                mana: capFateMana(player.masterId, player.mana + (event.payload.effect === 'mana' ? 4 : 0)),
                isRevealed: player.isRevealed || releasesLancelotName,
                revealedSkillIds: releasesLancelotName
                    ? [...new Set([...player.revealedSkillIds, ...servantSkillIds])]
                    : player.revealedSkillIds,
            } } };
        }
        case 'MASTER_SELECTED': { const player = state.players[event.payload.playerId]; const master = FATE_MASTER_BY_ID[event.payload.masterId]; if (!master) return state; const skills = [...(master.skills ?? []), ...(FATE_SERVANT_BY_ID[player.servantId]?.skillCards ?? [])].map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })); return { ...state, players: { ...state.players, [event.payload.playerId]: { ...player, masterId: event.payload.masterId, mana: capFateMana(master.id, (master.initMana ?? 4) + state.situation.printedMana), commandSpells: master.initialCommandSpells ?? 3, skills, activeSkills: [] } } }; }
        case 'SERVANT_SELECTED': {
            const player = state.players[event.payload.playerId];
            const servant = FATE_SERVANT_BY_ID[event.payload.servantId];
            if (!servant) return state;
            const hasLegacyDeck = Array.isArray(event.payload.deck);
            const deck = hasLegacyDeck ? event.payload.deck! : createFateAttackDeck(player.id, servant.id);
            const skills = [...(FATE_MASTER_BY_ID[player.masterId]?.skills ?? []), ...(servant.skillCards ?? [])]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` }));
            const initialAttackHandDealtPlayerIds = new Set(state.initialAttackHandDealtPlayerIds ?? []);
            if (hasLegacyDeck) initialAttackHandDealtPlayerIds.add(player.id);
            return {
                ...state,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        servantId: event.payload.servantId,
                        hand: hasLegacyDeck ? deck.slice(0, FATE_DEFAULT_HAND_LIMIT) : [],
                        deck: hasLegacyDeck ? deck.slice(FATE_DEFAULT_HAND_LIMIT) : deck,
                        skills,
                        activeSkills: [],
                    },
                },
                initialAttackHandDealtPlayerIds: [...initialAttackHandDealtPlayerIds],
                pendingChoice: { kind: null },
                actionNotice: hasLegacyDeck ? '身份已确认，可以开始本轮准备。' : '身份已更新，完成准备时抽取起手牌。',
            };
        }
        case 'INITIAL_ATTACK_HAND_DEALT': {
            const player = state.players[event.payload.playerId];
            const initialAttackHandDealtPlayerIds = new Set(state.initialAttackHandDealtPlayerIds ?? []);
            initialAttackHandDealtPlayerIds.add(player.id);
            return {
                ...state,
                players: {
                    ...state.players,
                    [player.id]: {
                        ...player,
                        hand: event.payload.deck.slice(0, FATE_DEFAULT_HAND_LIMIT),
                        deck: event.payload.deck.slice(FATE_DEFAULT_HAND_LIMIT),
                    },
                },
                initialAttackHandDealtPlayerIds: [...initialAttackHandDealtPlayerIds],
            };
        }
        case 'MASTER_DEPLOYED': {
            const player = state.players[event.payload.playerId];
            const battlefield = { ...state.battlefield };
            Object.keys(battlefield).forEach((id) => {
                battlefield[id as LocationId] = {
                    ...battlefield[id as LocationId],
                    playerIds: battlefield[id as LocationId].playerIds.filter((pid) => pid !== event.payload.playerId),
                };
            });
            battlefield[event.payload.locationId] = {
                ...battlefield[event.payload.locationId],
                playerIds: [...battlefield[event.payload.locationId].playerIds, event.payload.playerId],
            };
            const players = {
                ...state.players,
                [event.payload.playerId]: {
                    ...player,
                    locationId: event.payload.locationId,
                    deploymentSlot: event.payload.deploymentSlot,
                    mana: capFateMana(player.masterId, player.mana + event.payload.manaGain),
                },
            };
            return {
                ...state,
                battlefield,
                players,
                pendingChoice: { kind: null },
                actionNotice: '已部署，仍可使用前哨能力；完成后结束本人的前哨阶段。',
            };
        }
        case 'PLAYER_MOVED': { const player = state.players[event.payload.playerId]; const battlefield = { ...state.battlefield }; battlefield[event.payload.from] = { ...battlefield[event.payload.from], playerIds: battlefield[event.payload.from].playerIds.filter((id) => id !== event.payload.playerId) }; battlefield[event.payload.to] = { ...battlefield[event.payload.to], playerIds: [...battlefield[event.payload.to].playerIds, event.payload.playerId] }; return { ...state, battlefield, players: { ...state.players, [event.payload.playerId]: { ...player, locationId: event.payload.to, deploymentSlot: null, normalMoveCompleted: player.normalMoveCompleted || event.payload.mode === 'normal', mana: player.mana - event.payload.manaSpent } }, actionCount: state.actionCount + 1, actionNotice: `已移动至${battlefield[event.payload.to].label}。` }; }
        case 'ACTION_PASSED': {
            const players = { ...state.players, [event.payload.playerId]: { ...state.players[event.payload.playerId], hasPassedAction: true, selectedAttackIds: [], selectedFaceDownIds: [] } };
            const activeIds = state.turnOrder.filter((id) => players[id].locationId && !players[id].eliminated);
            const nextPlayerId = activeIds.find((id) => !players[id].hasPassedAction);
            const allPassed = !nextPlayerId;
            return { ...state, players, phase: allPassed ? 'battle' : state.phase, currentPlayerId: nextPlayerId ?? activeIds[0] ?? state.currentPlayerId, phaseCompletedPlayerIds: allPassed ? [] : state.phaseCompletedPlayerIds, currentTurnIndex: state.turnOrder.indexOf(nextPlayerId ?? activeIds[0] ?? state.currentPlayerId), pendingChoice: allPassed ? { kind: 'battle' } : { kind: 'attack-cards', playerId: nextPlayerId, minimum: 2, maximum: 2 }, actionNotice: allPassed ? '所有玩家结束行动，进入战斗阶段。' : '已结束行动，轮到下一位玩家。' };
        }
        case 'FATE_POST_BATTLE_STARTED':
            if(!state.battleResolution)throw new Error('Post-battle choice requires an active battle resolution');
            return {...state,battleResolution:{...state.battleResolution,step:'after-battle'}};
        case 'FATE_POST_BATTLE_SEAL_CHOSEN': {
            const player=state.players[event.payload.playerId];
            return {...state,players:{...state.players,[player.id]:{...player,commandSpells:player.commandSpells+(event.payload.restore?1:0)}}};
        }
        case 'FATE_MANA_GAINED': {
            const player=state.players[event.payload.playerId];
            return {...state,players:{...state.players,[player.id]:{...player,mana:capFateMana(player.masterId,player.mana+event.payload.amount)}}};
        }
        case 'FATE_CARDS_DRAWN': {
            const player=state.players[event.payload.playerId];
            return {...state,players:{...state.players,[player.id]:{...player,hand:[...player.hand,...event.payload.drawn],deck:event.payload.deck,discard:event.payload.discard}}};
        }
        case 'FATE_ABILITY_USED': {
            const player=state.players[event.payload.playerId];
            return {...state,players:{...state.players,[player.id]:{...player,mana:player.mana-(event.payload.manaSpent??0),usedAbilityIds:[...player.usedAbilityIds,event.payload.usageKey??event.payload.skillId]}}};
        }
        case 'FATE_RIDING_CHOICE_REQUESTED': return state;
        case 'FATE_RIDING_CARDS_PLAYED': {
            const player = state.players[event.payload.playerId];
            return {
                ...state,
                players: {
                    ...state.players,
                    [player.id]: {
                        ...player,
                        mana: player.mana - event.payload.manaSpent,
                        activeAttackIds: [...player.activeAttackIds, ...event.payload.cardIds],
                    },
                },
                actionNotice: `坐骑召唤：明置打出${event.payload.cardIds.length}张手牌。`,
            };
        }
        // Historical events meant pay + activate + use. Keep replay semantics while new uses emit FATE_ABILITY_USED.
        case 'SKILL_PLAYED': {
            const player = state.players[event.payload.playerId];
            const skill = player.skills.find((item) => item.id === event.payload.skillId);
            const players = {
                ...state.players,
                [event.payload.playerId]: {
                    ...player,
                    mana: player.mana - event.payload.manaSpent,
                    activeSkills: [...player.activeSkills, event.payload.skillId],
                    usedAbilityIds: [...player.usedAbilityIds, event.payload.skillId],
                },
            };
            return { ...state, players, actionNotice: `已发动技能【${skill?.name ?? event.payload.skillId}】。` };
        }
        case 'FATE_ABILITY_UNIMPLEMENTED':
            return { ...state, actionNotice: `技能【${event.payload.skillId}】尚未接入权威效果，未扣除资源。` };
        case 'FATE_RULE_MODIFIER_ATTACHED':
            return { ...state, ruleState: addFateRuleModifier(normalizeFateRuleState(state.ruleState), event.payload.modifier) };
        case 'FATE_RULE_MODIFIER_REMOVED':
            return { ...state, ruleState: removeFateRuleModifier(normalizeFateRuleState(state.ruleState), event.payload.modifierId) };
        case 'FATE_COPY_PROXY_CREATED':
            return { ...state, ruleState: { ...normalizeFateRuleState(state.ruleState), copies: [...normalizeFateRuleState(state.ruleState).copies.filter((record) => record.id !== event.payload.record.id), event.payload.record] } };
        case 'FATE_BATTLE_RESOLUTION_STARTED':
            return {
                ...state,
                battleResolution: {
                    frameId: event.payload.frameId,
                    round: event.payload.round,
                    locationIds: [...event.payload.locationIds],
                    resolvedLocationIds: [],
                    step: 'locations',
                },
            };
        case 'FATE_DEFEAT_DECLARED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated || player.defeatMarkers.some((marker) => marker.id === event.payload.markerId)) return state;
            if (!canSufferFateDefeat(state, event.payload.playerId, event.payload.sourceId, event.payload.direct, event.payload.unpreventable).allowed) return state;
            const marker = createFateDefeatMarker({
                id: event.payload.markerId,
                sourceId: event.payload.sourceId,
                direct: event.payload.direct,
            });
            return {
                ...state,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        defeatMarkers: [...player.defeatMarkers, marker],
                    },
                },
            };
        }
        case 'FATE_DEFEAT_APPLIED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated || player.defeatMarkers.some((marker) => marker.id === event.payload.marker.id)) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        defeatMarkers: [...player.defeatMarkers, event.payload.marker],
                    },
                },
            };
        }
        case 'FATE_DEFEAT_PREVENTED':
            return state;
        case 'FATE_ELIMINATION_REQUESTED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated) return state;
            if (fateEliminationOutcome(state, event.payload.playerId) === 'prevent') {
                return {
                    ...state,
                    players: {
                        ...state.players,
                        [event.payload.playerId]: {
                            ...player,
                            mana: 0,
                            eliminationProtectionUsed: true,
                            defeatMarkers: [],
                        },
                    },
                };
            }
            const battlefield = removePlayerFromBattlefield(state.battlefield, event.payload.playerId);
            return {
                ...state,
                battlefield,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        eliminated: true,
                        locationId: null,
                        defeatMarkers: [],
                    },
                },
            };
        }
        case 'FATE_ELIMINATION_PREVENTED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated) return state;
            return {
                ...state,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        mana: 0,
                        eliminationProtectionUsed: true,
                        defeatMarkers: [],
                    },
                },
            };
        }
        case 'FATE_PLAYER_ELIMINATED': {
            const player = state.players[event.payload.playerId];
            if (!player || player.eliminated) return state;
            const battlefield = removePlayerFromBattlefield(state.battlefield, event.payload.playerId);
            const nextPlayerId = state.currentPlayerId === player.id ? state.turnOrder.find(id => id !== player.id && !state.players[id].eliminated) ?? state.currentPlayerId : state.currentPlayerId;
            return {
                ...state,
                battlefield,
                currentPlayerId: nextPlayerId,
                currentTurnIndex: state.turnOrder.indexOf(nextPlayerId),
                pendingChoice: state.pendingChoice.playerId === player.id ? { kind: null } : state.pendingChoice,
                players: {
                    ...state.players,
                    [event.payload.playerId]: {
                        ...player,
                        eliminated: true,
                        locationId: null,
                        defeatMarkers: [],
                    },
                },
            };
        }
        case 'ATTACK_CARD_SELECTED': {
            const player=state.players[event.payload.playerId];
            const selectedAttackIds=event.payload.selected?[...player.selectedAttackIds,event.payload.cardId]:player.selectedAttackIds.filter(id=>id!==event.payload.cardId);
            const selectedFaceDownIds=(player.selectedFaceDownIds??[]).filter(id=>id!==event.payload.cardId);
            if(event.payload.selected&&event.payload.faceDown)selectedFaceDownIds.push(event.payload.cardId);
            return {...state,players:{...state.players,[player.id]:{...player,selectedAttackIds,selectedFaceDownIds}},pendingChoice:{kind:'attack-cards',playerId:player.id,minimum:2,maximum:2}};
        }
        case 'ATTACKS_CONFIRMED': {
            const player = state.players[event.payload.playerId];
            const attacks=event.payload.cardIds.filter(id=>resolveFateAttack(player,id)?.kind==='hand');
            const skills=event.payload.cardIds.filter(id=>resolveFateAttack(player,id)?.kind==='skill');
            const revealsName=skills.some(id=>player.skills.find(skill=>skill.id===id)?.desc?.includes('【真名解放】'));
            const updatedPlayer = { ...player, mana: player.mana - event.payload.manaSpent, selectedAttackIds: [], selectedFaceDownIds: [],
                faceDownAttackIds: [...(player.faceDownAttackIds ?? []), ...(event.payload.faceDownIds ?? [])],
                forcedRevealedHand: event.payload.revealHand ? [...player.hand] : player.forcedRevealedHand,
                activeAttackIds: [...player.activeAttackIds,...attacks], activeSkills:[...player.activeSkills,...skills], revealedSkillIds:[...new Set([...player.revealedSkillIds,...(revealsName ? player.skills.filter(skill=>resolveFateAttack(player,skill.id)?.kind==='skill').map(skill=>skill.id) : skills)])], isRevealed:player.isRevealed||revealsName, normalAttackPlayed:true };
            return { ...state, players:{...state.players,[player.id]:updatedPlayer}, pendingChoice:{kind:null},
                actionNotice:'已完成常规出牌，可使用已激活的行动能力或结束行动。' };
        }
        case 'LOCATION_RESOLVED': {
            const resolvedLocations = [...new Set([...state.resolvedLocations, event.payload.locationId])];
            const battleResolution = state.battleResolution
                ? {
                    ...state.battleResolution,
                    resolvedLocationIds: [...new Set([...state.battleResolution.resolvedLocationIds, event.payload.locationId])],
                    step: resolvedLocations.length >= state.battleResolution.locationIds.length ? 'awards' as const : 'locations' as const,
                }
                : state.battleResolution;
            return {
                ...state,
                resolvedLocations,
                resolvedResults: [...state.resolvedResults, ...event.payload.results],
                battleResult: event.payload.results[0] ?? state.battleResult,
                battleResolution,
                actionNotice: `${state.battlefield[event.payload.locationId].label}战斗已结算。`,
            };
        }
        case 'CARD_INSPECTED': return state;
        case 'FATE_PHASE_PLAYER_FINISHED': return { ...state, phaseCompletedPlayerIds: [...(state.phaseCompletedPlayerIds ?? []), event.payload.playerId], currentPlayerId: event.payload.nextPlayerId, currentTurnIndex: state.turnOrder.indexOf(event.payload.nextPlayerId), pendingChoice: { kind: state.phase === 'preparation' && state.round === 1 ? 'identity' : state.phase === 'battle' ? 'battle' : state.phase === 'outpost' ? 'location' : null, playerId: event.payload.nextPlayerId }, actionNotice: '本阶段操作已完成，轮到下一位玩家。' };
        case 'PHASE_ADVANCED': return { ...state, phaseCompletedPlayerIds: [], phase: event.payload.phase, shintoEventFaceDown: event.payload.phase === 'action' ? false : state.shintoEventFaceDown, currentPlayerId: event.payload.currentPlayerId, currentTurnIndex: state.turnOrder.indexOf(event.payload.currentPlayerId), actionCount: 0, pendingChoice: event.payload.phase === 'outpost' ? { kind: 'location', playerId: event.payload.currentPlayerId } : { kind: 'attack-cards', playerId: event.payload.currentPlayerId, minimum: 2, maximum: 2 }, actionNotice: event.payload.phase === 'outpost' ? '部署阶段：选择一个地点。' : '行动阶段：可移动或出牌。' };
        case 'BATTLE_RESOLVED': return reduceFateRound(state, event);
        default: return state;
    }
}
