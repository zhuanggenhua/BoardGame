import {
  applyEffectSpecToHost,
  createEffectRuntimeHostState,
  createEffectSpec,
  createEffectHandlerRegistry,
  hasTag,
  type EffectDef,
  type EffectSpec,
  type EffectRuntimeHostState,
  type TagContainer,
  type TagEntry,
} from '../../../engine/primitives';
import type { CardiaCore, OngoingAbility } from './core-types';
import type { PlayerId } from '../../../engine/types';

type CardiaOngoingMarkerEffectDef = EffectDef & {
  type: 'cardia_ongoing_marker';
};

const CARDIA_ONGOING_MARKER_REGISTRY = createEffectHandlerRegistry<null, never>();

export const CARDIA_ONGOING_EFFECT_TAGS = {
  forceTie: 'Cardia.Ongoing.forceTie',
  winTies: 'Cardia.Ongoing.winTies',
  extraSignet: 'Cardia.Ongoing.extraSignet',
  conditionalVictory: 'Cardia.Ongoing.conditionalVictory',
} as const;

export interface CardiaEncounterOutcome {
  baseWinner: PlayerId | 'tie';
  baseLoser: PlayerId | null;
  winner: PlayerId | 'tie';
  loser: PlayerId | null;
}

function getCardiaOngoingAbilityTag(abilityId: string): string {
  return `Cardia.Ongoing.Ability.${abilityId}`;
}

function normalizeLegacyTagEntry(entry: unknown): TagEntry {
  if (!entry || typeof entry !== 'object') {
    return { stacks: 1 };
  }

  const candidate = entry as Record<string, unknown>;
  const stacks = typeof candidate.stacks === 'number' && Number.isFinite(candidate.stacks)
    ? Math.max(1, Math.floor(candidate.stacks))
    : 1;

  return {
    stacks,
    ...(typeof candidate.duration === 'number' ? { duration: candidate.duration } : {}),
    ...(typeof candidate.source === 'string' ? { source: candidate.source } : {}),
    ...(typeof candidate.removable === 'boolean' ? { removable: candidate.removable } : {}),
  };
}

export function normalizeCardiaTagContainer(input: unknown): TagContainer {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const candidate = input as Record<string, unknown>;
  const raw = candidate.tags && typeof candidate.tags === 'object'
    ? candidate.tags as Record<string, unknown>
    : candidate;

  const normalized: Record<string, TagEntry> = {};
  for (const [tagId, entry] of Object.entries(raw)) {
    normalized[tagId] = normalizeLegacyTagEntry(entry);
  }
  return normalized;
}

function getCardiaOngoingEffectTag(effectType: OngoingAbility['effectType']): string | undefined {
  if (effectType === 'forceTie') return CARDIA_ONGOING_EFFECT_TAGS.forceTie;
  if (effectType === 'winTies') return CARDIA_ONGOING_EFFECT_TAGS.winTies;
  if (effectType === 'extraSignet') return CARDIA_ONGOING_EFFECT_TAGS.extraSignet;
  if (effectType === 'conditionalVictory') return CARDIA_ONGOING_EFFECT_TAGS.conditionalVictory;
  return undefined;
}

function isOngoingAbilityRelevantInContext(
  ability: OngoingAbility,
  encounterIndex: number,
): boolean {
  if (ability.effectType !== 'forceTie') {
    return true;
  }
  return ability.encounterIndex === encounterIndex;
}

function createCardiaOngoingEffectSpec(
  playerId: PlayerId,
  ability: OngoingAbility,
): EffectSpec<CardiaOngoingMarkerEffectDef> | undefined {
  const effectTag = getCardiaOngoingEffectTag(ability.effectType);
  if (!effectTag) return undefined;

  return createEffectSpec({
    id: getCardiaOngoingEffectSpecId(playerId, ability),
    effect: { type: 'cardia_ongoing_marker' },
    source: {
      id: ability.cardId,
      ownerId: ability.playerId,
      controllerId: ability.playerId,
      metadata: {
        abilityId: ability.abilityId,
        effectType: ability.effectType,
      },
    },
    target: {
      id: playerId,
      ownerId: playerId,
      controllerId: playerId,
    },
    lifecycle: 'persistent',
    rules: {
      grantedTags: [
        { tagId: effectTag, options: { source: ability.abilityId } },
        { tagId: getCardiaOngoingAbilityTag(ability.abilityId), options: { source: ability.abilityId } },
      ],
    },
  });
}

function getCardiaOngoingEffectSpecId(
  playerId: PlayerId,
  ability: OngoingAbility,
): string {
  return `cardia:ongoing:${playerId}:${ability.abilityId}:${ability.cardId}:${ability.timestamp}`;
}

function getCardiaPlayerActiveStoredOngoingAbilities(
  core: CardiaCore,
  playerId: PlayerId,
  options?: { encounterIndex?: number },
): OngoingAbility[] {
  const host = createCardiaPlayerEffectHost(core, playerId, options);
  const activeInstanceIds = new Set(
    host.runtime.activeInstances
      .filter((instance) => instance.active)
      .map((instance) => instance.spec.id),
  );

  if (activeInstanceIds.size === 0) {
    return [];
  }

  return core.ongoingAbilities.filter((ability) => (
    ability.playerId === playerId
    && activeInstanceIds.has(getCardiaOngoingEffectSpecId(playerId, ability))
  ));
}

export function getCardiaPlayerActiveOngoingAbilities(
  core: CardiaCore,
  playerId: PlayerId,
  options?: { encounterIndex?: number },
): OngoingAbility[] {
  return getCardiaPlayerActiveStoredOngoingAbilities(core, playerId, options);
}

export function getCardiaPlayerActiveOngoingAbilitiesByAbilityId(
  core: CardiaCore,
  playerId: PlayerId,
  abilityId: string,
  options?: { encounterIndex?: number },
): OngoingAbility[] {
  return getCardiaPlayerActiveStoredOngoingAbilities(core, playerId, options)
    .filter((ability) => ability.abilityId === abilityId);
}

export function getCardiaPlayerActiveOngoingAbilitiesByEffectType(
  core: CardiaCore,
  playerId: PlayerId,
  effectType: string,
  options?: { encounterIndex?: number },
): OngoingAbility[] {
  return getCardiaPlayerActiveStoredOngoingAbilities(core, playerId, options)
    .filter((ability) => ability.effectType === effectType);
}

export function createCardiaPlayerEffectHost(
  core: CardiaCore,
  playerId: PlayerId,
  options?: { encounterIndex?: number },
): EffectRuntimeHostState<CardiaOngoingMarkerEffectDef> {
  const player = core.players[playerId];
  let host = createEffectRuntimeHostState<CardiaOngoingMarkerEffectDef>({
    baseTargetTags: normalizeCardiaTagContainer(player?.tags),
  });

  if (!player) {
    return host;
  }

  const encounterIndex = options?.encounterIndex ?? core.turnNumber;
  for (const ability of core.ongoingAbilities) {
    if (ability.playerId !== playerId) continue;
    if (!isOngoingAbilityRelevantInContext(ability, encounterIndex)) continue;

    const spec = createCardiaOngoingEffectSpec(playerId, ability);
    if (!spec) continue;

    host = applyEffectSpecToHost(spec, {
      state: null,
      registry: CARDIA_ONGOING_MARKER_REGISTRY,
      host,
    }).host;
  }

  return host;
}

export function hasCardiaPlayerOngoingEffectTag(
  core: CardiaCore,
  playerId: PlayerId,
  effectType: OngoingAbility['effectType'],
  options?: { encounterIndex?: number },
): boolean {
  const tagId = getCardiaOngoingEffectTag(effectType);
  if (!tagId) return false;

  const host = createCardiaPlayerEffectHost(core, playerId, options);
  return hasTag(host.runtime.targetTags, tagId);
}

export function hasCardiaPlayerOngoingAbilityTag(
  core: CardiaCore,
  playerId: PlayerId,
  abilityId: string,
  options?: { encounterIndex?: number },
): boolean {
  const host = createCardiaPlayerEffectHost(core, playerId, options);
  return hasTag(host.runtime.targetTags, getCardiaOngoingAbilityTag(abilityId));
}

export function getCardiaStoredOngoingAbilitiesOnCard(
  core: CardiaCore,
  cardId: string,
): OngoingAbility[] {
  return core.ongoingAbilities.filter((ability) => ability.cardId === cardId);
}

export function findCardiaStoredOngoingAbility(
  core: CardiaCore,
  params: {
    abilityId: string;
    cardId: string;
    playerId?: PlayerId;
  },
): OngoingAbility | undefined {
  return core.ongoingAbilities.find((ability) => (
    ability.abilityId === params.abilityId
    && ability.cardId === params.cardId
    && (params.playerId === undefined || ability.playerId === params.playerId)
  ));
}

export function removeCardiaStoredOngoingAbility(
  core: CardiaCore,
  params: {
    abilityId: string;
    cardId: string;
    playerId?: PlayerId;
  },
): OngoingAbility[] {
  return core.ongoingAbilities.filter((ability) => !(
    ability.abilityId === params.abilityId
    && ability.cardId === params.cardId
    && (params.playerId === undefined || ability.playerId === params.playerId)
  ));
}

export function getCardiaStoredOngoingAbilityCardIds(
  core: CardiaCore,
): string[] {
  return [...new Set(core.ongoingAbilities.map((ability) => ability.cardId))];
}

export function hasCardiaStoredOngoingAbilitiesOnCard(
  core: CardiaCore,
  cardId: string,
): boolean {
  return getCardiaStoredOngoingAbilitiesOnCard(core, cardId).length > 0;
}

export function getCardiaActiveOngoingAbilities(
  core: CardiaCore,
  effectType: string,
  options?: { encounterIndex?: number },
): OngoingAbility[] {
  const activeAbilities: OngoingAbility[] = [];
  for (const playerId of core.playerOrder) {
    activeAbilities.push(
      ...getCardiaPlayerActiveOngoingAbilitiesByEffectType(core, playerId, effectType, options),
    );
  }
  return activeAbilities;
}

export function getCardiaActiveOngoingAbilitiesByAbilityId(
  core: CardiaCore,
  abilityId: string,
  options?: { encounterIndex?: number },
): OngoingAbility[] {
  const activeAbilities: OngoingAbility[] = [];
  for (const playerId of core.playerOrder) {
    activeAbilities.push(
      ...getCardiaPlayerActiveOngoingAbilitiesByAbilityId(core, playerId, abilityId, options),
    );
  }
  return activeAbilities;
}

export function resolveCardiaEncounterOutcome(
  core: CardiaCore,
  params: {
    player1Id: PlayerId;
    player1Influence: number;
    player2Id: PlayerId;
    player2Influence: number;
    encounterIndex: number;
  },
): CardiaEncounterOutcome {
  let baseWinner: PlayerId | 'tie';
  let baseLoser: PlayerId | null;

  if (params.player1Influence > params.player2Influence) {
    baseWinner = params.player1Id;
    baseLoser = params.player2Id;
  } else if (params.player2Influence > params.player1Influence) {
    baseWinner = params.player2Id;
    baseLoser = params.player1Id;
  } else {
    baseWinner = 'tie';
    baseLoser = null;
  }

  let winner: PlayerId | 'tie' = baseWinner;
  let loser: PlayerId | null = baseLoser;

  if (getCardiaActiveOngoingAbilities(core, 'forceTie', { encounterIndex: params.encounterIndex }).length > 0) {
    winner = 'tie';
    loser = null;
  }

  if (winner === 'tie') {
    const winTiesAbility = getCardiaActiveOngoingAbilities(core, 'winTies')[0];
    if (winTiesAbility) {
      winner = winTiesAbility.playerId;
      loser = winTiesAbility.playerId === params.player1Id ? params.player2Id : params.player1Id;
    }
  }

  return {
    baseWinner,
    baseLoser,
    winner,
    loser,
  };
}
