import { drawFateCards } from './cardDraw';
import type { RandomFn } from '../../../engine/types';
import { resolveFateAbilitySource } from './abilitySource';
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
import { FATE_MASTERS, FATE_SERVANTS, FATE_ATTACK_BY_ID } from '../data';

export type FateAbilityTrigger = 'preparation' | 'outpost' | 'action' | 'battle' | 'round-start' | 'round-end';

export type FateAbilityEffect =
  | { type: 'draw-cards'; count: number }
  | { type: 'riding' }
  | { type: 'battle-win-reward'; victoryPoints: number }
  | {
      type: 'movement';
      mode: 'effect';
      allowAnyDestination?: boolean;
      excludedLocations?: readonly LocationId[];
      ignoreEngagement?: boolean;
      nextOnly?: boolean;
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
  activationCost?: number;
  masterForm?: 'supervisor' | 'executor';
  sourceStatus: 'locked' | 'authority-summary';
  mechanicFamily: 'movement' | 'restriction' | 'power' | 'protection' | 'copy' | 'draw';
}

export interface FateAbilityContext extends AbilityContext {
  core: FateDominationCore;
  random?: RandomFn;
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
export const fateAbilityExecutorRegistry = createAbilityExecutorRegistry<FateAbilityContext & { definition: FateAbilityDefinition }, FateDominationEvent>('fate-domination-executors');

function findSkillDefinition(skillId: string): SkillDefinition | undefined {
  const baseId = skillId.split(':')[0];
  for (const master of FATE_MASTERS) {
    const skill = master.skills?.find(candidate => `${master.id}_${candidate.id}` === baseId);
    if (skill) return skill;
  }
  for (const servant of FATE_SERVANTS) {
    const skill = servant.skillCards?.find((candidate) => candidate.id === baseId);
    if (skill) return skill;
  }
  const card=FATE_ATTACK_BY_ID[baseId];
  return card ? {id:card.id,name:card.name,type:card.type,cost:card.manaCost,power:card.basePower,desc:card.desc} : undefined;
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
    activationCost: skill.isMasterSkill ? skill.cost ?? 0 : 0,
    ...(id === 'm_kirei_s2' ? {masterForm:'supervisor' as const} : id === 'm_kirei_s3' ? {masterForm:'executor' as const} : {}),
    mechanicFamily,
    tags: [mechanicFamily],
  };
}

const knownDefinitions: Array<FateAbilityDefinition | undefined> = [
  buildDefinition('sc_iskandar_1', 'action', 'draw', [{ type: 'riding' }]),
  buildDefinition('m_waver_s2','outpost','draw',[{type:'draw-cards',count:2}]),
  buildDefinition('m_kirei_s2','action','movement',[{type:'movement',mode:'effect',ignoreEngagement:true,allowAnyDestination:true,excludedLocations:['workshop','miyama','shinto']}]),
  buildDefinition('m_kirei_s3','battle','power',[{type:'power-transform',selector:'total',target:'self',operation:'add',value:2}]),
  buildDefinition('cardPreparation:action','action','power',[{type:'power-transform',selector:'terrain',target:'self',operation:'multiply',value:2}]),
  buildDefinition('cardPreparation:battle','battle','power',[{type:'battle-win-reward',victoryPoints:2}]),
  buildDefinition('cardSurveil','action','movement',[{type:'movement',mode:'effect',ignoreEngagement:true,nextOnly:true}]),
  buildDefinition('cardluck','battle','protection',[{type:'direct-defeat-protection',scope:'round'}]),
  buildDefinition('sc_emiya_2:action','action','power',[{type:'power-transform',selector:'terrain',target:'self',operation:'multiply',value:3}]),
  buildDefinition('sc_emiya_2:battle','battle','power',[{type:'battle-win-reward',victoryPoints:4}]),
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
  if(effect.type==='battle-win-reward')return {id:`${context.playerId}:${context.sourceId}:battle-win-reward`,kind:'battle-win-reward',source,playerId:context.playerId,victoryPoints:effect.victoryPoints,duration:'round-end'};
  if (effect.type === 'ability-suppression') {
    const locationId = context.core.players[context.playerId]?.locationId;
    if (!locationId) return undefined;
    return {
      id: `${context.playerId}:${context.sourceId}:ability-suppression`,
      kind: 'ability-suppression',
      source,
      phases: effect.phases,
      locationId,
      scope: 'location',
      excludeController: true,
      duration: 'round-end',
    };
  }
  if (effect.type === 'power-transform') {
    return {
      id: `${context.playerId}:${context.sourceId}:power-transform`,
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
      id: `${context.playerId}:${context.sourceId}:direct-defeat-protection`,
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

fateAbilityExecutorRegistry.register('sc_sasaki_2', (context) => ({
  events: context.definition.effects.map((effect) => createModifierFromEffect(context, effect)).filter((modifier): modifier is FateRuleModifier => Boolean(modifier)).map((modifier) => ({
    type: 'FATE_RULE_MODIFIER_ATTACHED',
    payload: { modifier },
    sourceCommandType: 'PLAY_SKILL',
    timestamp: context.timestamp,
  })),
}));

for (const id of ['m_kirei_s3', 'sc_saber_1', 'sc_saber_2', 'sc_emiya_1', 'sc_gil_2', 'cardPreparation:action', 'cardPreparation:battle', 'cardluck', 'sc_emiya_2:action', 'sc_emiya_2:battle']) {
  fateAbilityExecutorRegistry.register(id, (context) => ({
    events: context.definition.effects.map((effect) => createModifierFromEffect(context, effect)).filter((modifier): modifier is FateRuleModifier => Boolean(modifier)).map((modifier) => ({
      type: 'FATE_RULE_MODIFIER_ATTACHED',
      payload: { modifier },
      sourceCommandType: 'PLAY_SKILL',
      timestamp: context.timestamp,
    })),
  }));
}

for (const id of ['m_kirei_s2', 'sc_diarmuid_3', 'sc_cu_2', 'sc_medusa_np', 'cardSurveil']) {
  fateAbilityExecutorRegistry.register(id, (context) => {
    const effect = context.definition.effects.find((candidate): candidate is Extract<FateAbilityEffect, { type: 'movement' }> => candidate.type === 'movement');
    if (!effect || !context.targetLocationId) return { events: [] };
    const resolution = resolveFateMovement(context.core, context.playerId, context.targetLocationId, effect.mode, {
      allowAnyDestination: effect.allowAnyDestination,
      ignoreEngagement: effect.ignoreEngagement,
      excludedLocations: effect.excludedLocations,
    });
    const from = context.core.players[context.playerId]?.locationId;
    if (!resolution.valid || !resolution.path || resolution.cost === null || !from || (effect.nextOnly && resolution.path.length !== 2)) return { events: [] };
    return {
      events: [{
        type: 'PLAYER_MOVED',
        payload: {
          playerId: context.playerId,
          from,
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

fateAbilityExecutorRegistry.register('m_waver_s2', context => {
  const effect=context.definition.effects.find(effect=>effect.type==='draw-cards');
  if(!effect || effect.type!=='draw-cards')return {events:[]};
  if(!context.random)throw new Error('Fate draw ability requires the authoritative random source');
  const player=context.core.players[context.playerId];
  return {events:[{type:'FATE_CARDS_DRAWN',payload:{playerId:player.id,...drawFateCards(player.deck,player.discard,effect.count,context.random)},sourceCommandType:'PLAY_SKILL',timestamp:context.timestamp}]};
});

for (const id of ['sc_lance_1', 'sc_lance_3']) {
  fateAbilityExecutorRegistry.register(id, (context) => {
    const effect = context.definition.effects.find((candidate): candidate is Extract<FateAbilityEffect, { type: 'copy-proxy' }> => candidate.type === 'copy-proxy');
    if (!effect) return { events: [] };
    if (!context.targetCardId) return { events: [], interaction: { kind: 'fate-copy-source', sourceId: context.sourceId, mode: effect.mode } };
    const found = findCardInstance(context.core, context.targetCardId);
    if (!found) return { events: [] };
    const record = createFateCopyRecord({
      id: `${context.playerId}:${context.sourceId}:proxy:${context.targetCardId}`,
      sourceCardId: found.card.id,
      proxyCardId: `${context.playerId}:proxy:${context.sourceId}:${found.card.id}`,
      printedDefinitionId: found.card.definitionId,
      source: { sourceId: found.card.id, effectId: context.definition.id },
      copierId: context.playerId,
      executorId: context.playerId,
      ownerId: found.playerId,
      controllerId: context.playerId,
      holderId: context.playerId,
      sourceControllerId: found.playerId,
      originEventId: `${context.playerId}:${context.sourceId}:copy`,
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

export function resolveFateAbilityDefinition(skillId: string, phase?: string): FateAbilityDefinition | undefined {
  const base=skillId.split(':')[0];
  return (phase?fateAbilityRegistry.get(`${base}:${phase}`):undefined) ?? fateAbilityRegistry.get(base);
}
export function resolveFatePlayerAbility(core:FateDominationCore,playerId:string,sourceId:string):FateAbilityDefinition|undefined {
  const source=resolveFateAbilitySource(core.players[playerId],sourceId);
  return source?resolveFateAbilityDefinition(source.definitionId,core.phase):undefined;
}

export function executeFateAbility(context: FateAbilityContext): AbilityResult<FateDominationEvent> {
  const definition = resolveFatePlayerAbility(context.core,context.playerId,context.sourceId) ?? resolveFateAbilityDefinition(context.skill.id,context.core.phase);
  if (!definition) return { events: [] };
  const executor = fateAbilityExecutorRegistry.resolve(definition.id);
  return executor ? executor({ ...context, definition }) : { events: [] };
}
