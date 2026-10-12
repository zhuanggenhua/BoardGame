import {
  createAbilityExecutorRegistry,
  createAbilityRegistry,
  createAbilityChoiceContract,
  createAbilityOpportunity,
  type AbilityContext,
  type AbilityDef,
  type AbilityResult,
} from '../../../engine/primitives/ability';
import type { Opportunity, TimingPoint } from '../../../engine/TimingOpportunity';
import type { FateDominationCore, FateDominationEvent, LocationId, SkillDefinition } from './types';
import type { FateAbilityPhase, FateRuleModifier } from './mechanics';
import { createFateCopyRecord } from './mechanics';
import { resolveFateMovement } from './movement';
import { FATE_SERVANTS } from '../data';

export type FateAbilityTrigger = 'preparation' | 'outpost' | 'action' | 'battle' | 'round-start' | 'round-end';

export type FateAbilityEffect =
  | {
      type: 'movement';
      mode: 'effect';
      allowAnyDestination?: boolean;
      excludedLocations?: readonly LocationId[];
      ignoreEngagement?: boolean;
    }
  | {
      type: 'ability-suppression';
      phases: readonly FateAbilityPhase[];
      scope: 'same-battlefield';
    }
  | {
      type: 'power-transform';
      selector: 'attack' | 'terrain' | 'total';
      target: 'self' | 'opponents-at-location';
      attackTypes?: readonly string[];
      operation: 'add' | 'multiply' | 'set';
      value: number;
    }
  | {
      type: 'direct-defeat-protection';
      scope: 'battle' | 'round';
    }
  | {
      type: 'copy-proxy';
      mode: 'effect-only' | 'ability-with-choice' | 'printed-card-proxy' | 'borrowed-ongoing';
      requiresCardChoice: boolean;
    };

export interface FateAbilityDefinition extends AbilityDef<FateAbilityEffect, FateAbilityTrigger> {
  sourceStatus: 'locked' | 'authority-summary';
  mechanicFamily: 'movement' | 'restriction' | 'power' | 'protection' | 'copy';
}

export interface FateAbilityContext extends AbilityContext {
  core: FateDominationCore;
  playerId: string;
  skill: SkillDefinition;
  targetLocationId?: LocationId;
  targetPlayerId?: string;
  targetCardId?: string;
}

export type FateAbilityExecutor = (
  context: FateAbilityContext,
  definition: FateAbilityDefinition,
) => AbilityResult<FateDominationEvent>;

export const fateAbilityRegistry = createAbilityRegistry<FateAbilityDefinition>('fate-domination-abilities');
export const fateAbilityExecutorRegistry = createAbilityExecutorRegistry<FateAbilityContext, FateDominationEvent>('fate-domination-executors');

function findSkillDefinition(skillId: string): SkillDefinition | undefined {
  const baseId = skillId.split(':')[0];
  for (const servant of FATE_SERVANTS) {
    const skill = servant.skillCards?.find((candidate) => candidate.id === baseId);
    if (skill) return skill;
  }
  return undefined;
}

function buildDefinition(
  id: string,
  trigger: FateAbilityTrigger,
  mechanicFamily: FateAbilityDefinition['mechanicFamily'],
  effects: FateAbilityEffect[],
): FateAbilityDefinition | undefined {
  const skill = findSkillDefinition(id);
  if (!skill) return undefined;
  return {
    id,
    name: skill.name,
    description: skill.desc,
    trigger,
    effects,
    sourceStatus: 'locked',
    mechanicFamily,
    tags: [mechanicFamily],
  };
}

const knownDefinitions: Array<FateAbilityDefinition | undefined> = [
  buildDefinition('sc_sasaki_2', 'action', 'restriction', [{
    type: 'ability-suppression',
    phases: ['action', 'battle'],
    scope: 'same-battlefield',
  }]),
  buildDefinition('sc_saber_1', 'battle', 'power', [{
    type: 'power-transform',
    selector: 'attack',
    target: 'opponents-at-location',
    attackTypes: ['魔术', '魔法'],
    operation: 'set',
    value: 0,
  }]),
  buildDefinition('sc_saber_2', 'battle', 'power', [{
    type: 'power-transform',
    selector: 'attack',
    target: 'opponents-at-location',
    attackTypes: ['力量'],
    operation: 'set',
    value: 0,
  }]),
  buildDefinition('sc_emiya_1', 'battle', 'power', [{
    type: 'power-transform',
    selector: 'attack',
    target: 'opponents-at-location',
    attackTypes: ['迅捷'],
    operation: 'set',
    value: 0,
  }]),
  buildDefinition('sc_gil_2', 'action', 'power', [{
    type: 'power-transform',
    selector: 'terrain',
    target: 'self',
    operation: 'multiply',
    value: 2,
  }]),
  buildDefinition('sc_diarmuid_3', 'action', 'movement', [{
    type: 'movement',
    mode: 'effect',
    allowAnyDestination: true,
    excludedLocations: ['workshop'],
  }]),
  buildDefinition('sc_cu_2', 'action', 'movement', [{
    type: 'movement',
    mode: 'effect',
    allowAnyDestination: true,
    excludedLocations: ['workshop'],
  }]),
  buildDefinition('sc_medusa_np', 'action', 'movement', [{
    type: 'movement',
    mode: 'effect',
    allowAnyDestination: true,
  }]),
  buildDefinition('sc_lance_3', 'action', 'copy', [{
    type: 'copy-proxy',
    mode: 'printed-card-proxy',
    requiresCardChoice: true,
  }]),
  buildDefinition('sc_lance_1', 'battle', 'copy', [{
    type: 'copy-proxy',
    mode: 'printed-card-proxy',
    requiresCardChoice: true,
  }]),
];

fateAbilityRegistry.registerAll(knownDefinitions.filter((definition): definition is FateAbilityDefinition => Boolean(definition)));

function sourceFor(context: FateAbilityContext): FateRuleModifier['source'] {
  return {
    sourceId: context.sourceId,
    sourceKind: 'ability',
    ownerId: context.ownerId,
    controllerId: context.playerId,
    holderId: context.playerId,
  };
}

function createModifierFromEffect(
  context: FateAbilityContext,
  effect: FateAbilityEffect,
): FateRuleModifier | undefined {
  const source = sourceFor(context);
  if (effect.type === 'ability-suppression') {
    const locationId = context.core.players[context.playerId]?.locationId;
    if (!locationId) return undefined;
    return {
      id: `${context.sourceId}:ability-suppression`,
      kind: 'ability-suppression',
      source,
      phases: effect.phases,
      locationId,
      scope: 'location',
      duration: 'round-end',
    };
  }
  if (effect.type === 'power-transform') {
    return {
      id: `${context.sourceId}:power-transform`,
      kind: 'power-transform',
      source,
      selector: effect.selector,
      target: effect.target,
      locationId: context.core.players[context.playerId]?.locationId ?? undefined,
      attackTypes: effect.attackTypes,
      operation: effect.operation,
      value: effect.value,
      duration: 'round-end',
    };
  }
  if (effect.type === 'direct-defeat-protection') {
    return {
      id: `${context.sourceId}:direct-defeat-protection`,
      kind: 'direct-defeat-protection',
      source,
      playerId: context.playerId,
      scope: effect.scope,
      duration: effect.scope === 'battle' ? 'turn-end' : 'round-end',
    };
  }
  return undefined;
}

function findCardInstance(core: FateDominationCore, cardId: string) {
  for (const playerId of core.playerIds) {
    const player = core.players[playerId];
    const card = [...player.hand, ...player.discard].find((candidate) => candidate.id === cardId);
    if (card) return { playerId, card };
  }
  return undefined;
}

fateAbilityExecutorRegistry.register('sc_sasaki_2', (context, definition) => ({
  events: definition.effects.map((effect) => createModifierFromEffect(context, effect)).filter((modifier): modifier is FateRuleModifier => Boolean(modifier)).map((modifier) => ({
    type: 'FATE_RULE_MODIFIER_ATTACHED',
    payload: { modifier },
    sourceCommandType: 'PLAY_SKILL',
    timestamp: context.timestamp,
  })),
}));

for (const id of ['sc_saber_1', 'sc_saber_2', 'sc_emiya_1', 'sc_gil_2']) {
  fateAbilityExecutorRegistry.register(id, (context, definition) => ({
    events: definition.effects.map((effect) => createModifierFromEffect(context, effect)).filter((modifier): modifier is FateRuleModifier => Boolean(modifier)).map((modifier) => ({
      type: 'FATE_RULE_MODIFIER_ATTACHED',
      payload: { modifier },
      sourceCommandType: 'PLAY_SKILL',
      timestamp: context.timestamp,
    })),
  }));
}

for (const id of ['sc_diarmuid_3', 'sc_cu_2', 'sc_medusa_np']) {
  fateAbilityExecutorRegistry.register(id, (context, definition) => {
    const effect = definition.effects.find((candidate): candidate is Extract<FateAbilityEffect, { type: 'movement' }> => candidate.type === 'movement');
    if (!effect || !context.targetLocationId) return { events: [] };
    const resolution = resolveFateMovement(context.core, context.playerId, context.targetLocationId, effect.mode, {
      allowAnyDestination: effect.allowAnyDestination,
      ignoreEngagement: effect.ignoreEngagement,
      excludedLocations: effect.excludedLocations,
    });
    if (!resolution.valid || !resolution.path || resolution.cost === null || !context.core.players[context.playerId]?.locationId) return { events: [] };
    return {
      events: [{
        type: 'PLAYER_MOVED',
        payload: {
          playerId: context.playerId,
          from: context.core.players[context.playerId].locationId,
          to: context.targetLocationId,
          path: [...resolution.path],
          mode: resolution.mode,
          manaSpent: resolution.cost,
          context: {
            allowAnyDestination: effect.allowAnyDestination,
            ignoreEngagement: effect.ignoreEngagement,
            excludedLocations: effect.excludedLocations ? [...effect.excludedLocations] : undefined,
          },
        },
        sourceCommandType: 'PLAY_SKILL',
        timestamp: context.timestamp,
      }],
    };
  });
}

for (const id of ['sc_lance_1', 'sc_lance_3']) {
  fateAbilityExecutorRegistry.register(id, (context, definition) => {
    const effect = definition.effects.find((candidate): candidate is Extract<FateAbilityEffect, { type: 'copy-proxy' }> => candidate.type === 'copy-proxy');
    if (!effect || !context.targetCardId) return { events: [], interaction: { kind: 'fate-copy-source', sourceId: context.sourceId, mode: effect.mode } };
    const found = findCardInstance(context.core, context.targetCardId);
    if (!found) return { events: [] };
    const record = createFateCopyRecord({
      id: `${context.sourceId}:proxy:${context.targetCardId}`,
      sourceCardId: found.card.id,
      proxyCardId: `${context.playerId}:proxy:${context.sourceId}:${found.card.id}`,
      printedDefinitionId: found.card.definitionId,
      source: { sourceId: found.card.id, effectId: definition.id },
      copierId: context.playerId,
      executorId: context.playerId,
      ownerId: found.playerId,
      controllerId: context.playerId,
      holderId: context.playerId,
      sourceControllerId: found.playerId,
      originEventId: `${context.sourceId}:copy`,
      duration: 'turn-end',
    });
    return {
      events: [{
        type: 'FATE_COPY_PROXY_CREATED',
        payload: { record },
        sourceCommandType: 'PLAY_SKILL',
        timestamp: context.timestamp,
      }],
    };
  });
}

export function createFateCopyChoiceOpportunity(args: {
  core: FateDominationCore;
  playerId: string;
  skillId: string;
  timing: TimingPoint;
  candidateCardIds: readonly string[];
}): Opportunity<string> | undefined {
  const definition = resolveFateAbilityDefinition(args.skillId);
  const effect = definition?.effects.find((candidate): candidate is Extract<FateAbilityEffect, { type: 'copy-proxy' }> => candidate.type === 'copy-proxy');
  if (!definition || !effect || !effect.requiresCardChoice) return undefined;
  const candidates = args.candidateCardIds.map((cardId) => ({
    id: cardId,
    label: cardId,
    value: cardId,
    commands: [{ type: 'PLAY_SKILL', playerId: args.playerId, payload: { skillId: args.skillId, targetCardId: cardId } }],
  }));
  const lifecycle = {
    sourceId: args.skillId,
    sourceKind: 'card' as const,
    controllerId: args.playerId,
    ownerId: args.playerId,
    phase: 'activation' as const,
    trigger: definition.trigger,
  };
  const choice = createAbilityChoiceContract<FateAbilityEffect, FateAbilityTrigger, string>({
    def: definition,
    lifecycle,
    kind: 'select-card',
    candidates,
    selection: { min: 1, max: 1 },
    skipPolicy: 'forbidden',
    resolution: { type: 'candidate-commands' },
    ai: { status: 'game-policy', policyId: 'fate-copy-source-card' },
  });
  return createAbilityOpportunity({
    def: definition,
    timing: args.timing,
    lifecycle,
    class: 'optional',
    targetRequest: { kind: 'select-card', min: 1, max: 1, description: '选择要复制的已展示卡牌' },
    resolution: { type: 'child-frame', frameKind: 'fate:copy-resolution', metadata: { copyMode: effect.mode } },
    choice,
    visibility: { scope: 'controller' },
  });
}

export function resolveFateAbilityDefinition(skillId: string): FateAbilityDefinition | undefined {
  return fateAbilityRegistry.get(skillId.split(':')[0]);
}

export function executeFateAbility(context: FateAbilityContext): AbilityResult<FateDominationEvent> {
  const definition = resolveFateAbilityDefinition(context.skill.id);
  if (!definition) return { events: [] };
  const executor = fateAbilityExecutorRegistry.resolve(definition.id);
  return executor ? executor(context, definition) : { events: [] };
}
