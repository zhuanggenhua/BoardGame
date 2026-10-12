import {
  createCopyExecutionContext,
  expandCopyContext,
  type CopyExecutionContext,
  type CopySourceRef,
  type MovementMode,
} from '../../../engine/primitives';
import type { FateDominationCore, FatePhase, LocationId, PlayerId } from './types';

export type FateAbilityPhase = Extract<FatePhase, 'preparation' | 'outpost' | 'action' | 'battle'>;
export type FateRuleDuration = 'turn-end' | 'round-end' | 'game-end';

export interface FateDefeatMarker {
  id: string;
  sourceId?: string;
  direct: boolean;
  duration: 'turn-end' | 'round-end';
}

export interface FateRuleSourceRef {
  sourceId: string;
  sourceKind: 'card' | 'ability' | 'event' | 'situation' | 'master' | 'servant' | 'rule';
  ownerId: PlayerId;
  controllerId: PlayerId;
  holderId?: PlayerId;
  sourceControllerId?: PlayerId;
  zoneId?: string;
}

interface FateRuleModifierBase {
  id: string;
  source: FateRuleSourceRef;
  priority?: number;
  duration?: FateRuleDuration;
}

export type FateRuleModifier =
  | (FateRuleModifierBase & {
      kind: 'movement';
      mode: MovementMode | 'all';
      fromLocations?: readonly LocationId[];
      toLocations?: readonly LocationId[];
      route?: readonly LocationId[];
      allowAnyDestination?: boolean;
      ignoreEngagement?: boolean;
      free?: boolean;
      excludedLocations?: readonly LocationId[];
      extraCostPerStep?: number;
      extraCost?: number;
    })
  | (FateRuleModifierBase & {
      kind: 'location-lock';
      locationId: LocationId;
      playerIds?: readonly PlayerId[];
      denyEnter?: boolean;
      denyLeave?: boolean;
      denySpecialAttack?: boolean;
      bypassModes?: readonly MovementMode[];
    })
  | (FateRuleModifierBase & {
      kind: 'ability-suppression';
      phases: readonly FateAbilityPhase[];
      playerIds?: readonly PlayerId[];
      locationId?: LocationId;
      scope: 'players' | 'location';
    })
  | (FateRuleModifierBase & {
      kind: 'power-transform';
      selector: 'attack' | 'terrain' | 'total';
      target: 'self' | 'opponents-at-location' | 'all-at-location' | 'player';
      playerId?: PlayerId;
      locationId?: LocationId;
      attackTypes?: readonly string[];
      operation: 'add' | 'multiply' | 'set';
      value: number;
    })
  | (FateRuleModifierBase & {
      kind: 'direct-defeat-protection';
      playerId: PlayerId;
      scope: 'battle' | 'round';
      protectedSources?: readonly string[];
    });

export interface FateDelayedRule {
  id: string;
  trigger: 'round-start' | 'phase-end' | 'battle-end' | 'player-eliminated';
  source: FateRuleSourceRef;
  duration?: FateRuleDuration;
  payload: Record<string, unknown>;
}

export interface FateCopyRecord {
  id: string;
  sourceCardId?: string;
  proxyCardId: string;
  printedDefinitionId: string;
  context: CopyExecutionContext;
  duration?: FateRuleDuration;
}

export interface FateRuleState {
  modifiers: FateRuleModifier[];
  delayed: FateDelayedRule[];
  copies: FateCopyRecord[];
}

export const createInitialFateRuleState = (): FateRuleState => ({
  modifiers: [],
  delayed: [],
  copies: [],
});

/**
 * 兼容旧快照：机制框架上线前的 Fate 快照没有 ruleState，
 * 不能让查询层在读取 modifiers 时直接崩溃。
 */
export function normalizeFateRuleState(value: Partial<FateRuleState> | undefined): FateRuleState {
  return {
    modifiers: Array.isArray(value?.modifiers) ? value.modifiers : [],
    delayed: Array.isArray(value?.delayed) ? value.delayed : [],
    copies: Array.isArray(value?.copies) ? value.copies : [],
  };
}

export function addFateRuleModifier(state: FateRuleState, modifier: FateRuleModifier): FateRuleState {
  return {
    ...state,
    modifiers: [...state.modifiers.filter((entry) => entry.id !== modifier.id), modifier],
  };
}

export function removeFateRuleModifier(state: FateRuleState, modifierId: string): FateRuleState {
  const modifiers = state.modifiers.filter((entry) => entry.id !== modifierId);
  return modifiers.length === state.modifiers.length ? state : { ...state, modifiers };
}

export function removeFateRuleModifiersBySource(state: FateRuleState, sourceId: string): FateRuleState {
  const modifiers = state.modifiers.filter((entry) => entry.source.sourceId !== sourceId);
  return modifiers.length === state.modifiers.length ? state : { ...state, modifiers };
}

export function expireFateRuleModifiers(state: FateRuleState, duration: FateRuleDuration): FateRuleState {
  const modifiers = state.modifiers.filter((entry) => entry.duration !== duration);
  const delayed = state.delayed.filter((entry) => entry.duration !== duration);
  const copies = state.copies.filter((entry) => entry.duration !== duration);
  return modifiers.length === state.modifiers.length
    && delayed.length === state.delayed.length
    && copies.length === state.copies.length
    ? state
    : { ...state, modifiers, delayed, copies };
}

function appliesToPlayer(
  modifier: FateRuleModifier,
  core: FateDominationCore,
  playerId: PlayerId,
): boolean {
  if (modifier.kind === 'ability-suppression') {
    if (modifier.scope === 'players' && modifier.playerIds && !modifier.playerIds.includes(playerId)) return false;
    if (modifier.scope === 'location' && modifier.locationId !== core.players[playerId]?.locationId) return false;
  }
  if (modifier.kind === 'power-transform' && modifier.target === 'player' && modifier.playerId !== playerId) return false;
  if (modifier.kind === 'power-transform' && modifier.target === 'self' && modifier.source.controllerId !== playerId) return false;
  return true;
}

export interface FateAbilityLegalityResult {
  valid: boolean;
  reasons: string[];
  appliedModifierIds: string[];
}

export function canUseFateAbility(
  core: FateDominationCore,
  playerId: PlayerId,
  phase: FateAbilityPhase,
): FateAbilityLegalityResult {
  const blockers = normalizeFateRuleState(core.ruleState).modifiers.filter((modifier) => {
    if (modifier.kind !== 'ability-suppression' || !modifier.phases.includes(phase)) return false;
    return appliesToPlayer(modifier, core, playerId);
  });
  return {
    valid: blockers.length === 0,
    reasons: blockers.map((modifier) => `ability:${phase} blocked by ${modifier.source.sourceId}`),
    appliedModifierIds: blockers.map((modifier) => modifier.id),
  };
}

export function hasDirectDefeatProtection(
  core: FateDominationCore,
  playerId: PlayerId,
  sourceId?: string,
): boolean {
  return normalizeFateRuleState(core.ruleState).modifiers.some((modifier) => {
    if (modifier.kind !== 'direct-defeat-protection' || modifier.playerId !== playerId) return false;
    return !sourceId || !modifier.protectedSources || modifier.protectedSources.includes(sourceId);
  });
}

export function hasFateDefeat(core: FateDominationCore, playerId: PlayerId): boolean {
  return (core.players[playerId]?.defeatMarkers?.length ?? 0) > 0;
}

export function canSufferFateDefeat(
  core: FateDominationCore,
  playerId: PlayerId,
  sourceId: string | undefined,
  direct: boolean,
  unpreventable = false,
): { allowed: boolean; reason?: string } {
  if (!direct || unpreventable) return { allowed: true };
  if (hasDirectDefeatProtection(core, playerId, sourceId)) {
    return { allowed: false, reason: 'directDefeatProtected' };
  }
  return { allowed: true };
}

export function createFateDefeatMarker(input: {
  id: string;
  sourceId?: string;
  direct: boolean;
  duration?: 'turn-end' | 'round-end';
}): FateDefeatMarker {
  return {
    id: input.id,
    sourceId: input.sourceId,
    direct: input.direct,
    duration: input.duration ?? 'turn-end',
  };
}

export function fateEliminationOutcome(
  core: FateDominationCore,
  playerId: PlayerId,
): 'prevent' | 'eliminate' {
  const player = core.players[playerId];
  if (!player || player.eliminated) return 'eliminate';
  const hasFirstEliminationProtection = player.masterId === 'm_shirou_emiya'
    || player.masterId === 'master-shirou';
  return hasFirstEliminationProtection && !player.eliminationProtectionUsed ? 'prevent' : 'eliminate';
}

export interface FatePowerQuery {
  selector: 'attack' | 'terrain' | 'total';
  actorId: PlayerId;
  locationId: LocationId;
  attackTypes?: readonly string[];
}

export function resolveFatePowerValue(
  core: FateDominationCore,
  baseValue: number,
  query: FatePowerQuery,
): { value: number; appliedModifierIds: string[] } {
  let value = baseValue;
  const appliedModifierIds: string[] = [];
  const modifiers = [...normalizeFateRuleState(core.ruleState).modifiers]
    .filter((modifier) => modifier.kind === 'power-transform')
    .filter((modifier) => modifier.selector === query.selector)
    .filter((modifier) => {
      if (modifier.locationId && modifier.locationId !== query.locationId) return false;
      if (modifier.target === 'player' && modifier.playerId !== query.actorId) return false;
      if (modifier.target === 'self' && modifier.source.controllerId !== query.actorId) return false;
      if (modifier.target === 'opponents-at-location') {
        const sourceLocation = core.players[modifier.source.controllerId]?.locationId;
        if (sourceLocation !== query.locationId || modifier.source.controllerId === query.actorId) return false;
      }
      if (modifier.target === 'all-at-location' && core.players[query.actorId]?.locationId !== query.locationId) return false;
      if (modifier.attackTypes && query.attackTypes && !modifier.attackTypes.some((type) => query.attackTypes?.some((candidate) => candidate.includes(type)))) return false;
      return true;
    })
    .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));

  for (const modifier of modifiers) {
    if (modifier.kind !== 'power-transform') continue;
    if (modifier.operation === 'add') value += modifier.value;
    if (modifier.operation === 'multiply') value *= modifier.value;
    if (modifier.operation === 'set') value = modifier.value;
    appliedModifierIds.push(modifier.id);
  }
  return { value, appliedModifierIds };
}

export function createFateCopyRecord(input: {
  id: string;
  sourceCardId?: string;
  proxyCardId: string;
  printedDefinitionId: string;
  source: CopySourceRef;
  copierId: PlayerId;
  executorId: PlayerId;
  ownerId: PlayerId;
  controllerId: PlayerId;
  holderId?: PlayerId;
  sourceControllerId?: PlayerId;
  parentFrameId?: string;
  originEventId?: string;
  duration?: FateRuleDuration;
}): FateCopyRecord {
  return {
    id: input.id,
    sourceCardId: input.sourceCardId,
    proxyCardId: input.proxyCardId,
    printedDefinitionId: input.printedDefinitionId,
    duration: input.duration,
    context: createCopyExecutionContext({
      mode: 'printed-card-proxy',
      source: input.source,
      copierId: input.copierId,
      executorId: input.executorId,
      ownerId: input.ownerId,
      controllerId: input.controllerId,
      holderId: input.holderId,
      sourceControllerId: input.sourceControllerId,
      targetPolicy: 'rebind',
      costPolicy: 'inherit',
      oncePolicy: 'reset',
      visibilityPolicy: 'inherit',
      maxDepth: 2,
      parentFrameId: input.parentFrameId,
      originEventId: input.originEventId,
    }),
  };
}

export function expandFateCopyRecord(record: FateCopyRecord, source: CopySourceRef) {
  return expandCopyContext(record.context, source);
}
