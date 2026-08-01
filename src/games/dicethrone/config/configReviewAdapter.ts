import type { CardPreviewRef } from '../../../core';
import type { RandomFn } from '../../../engine/types';
import type { AbilityDef } from '../domain/combat';
import {
  CHARACTER_DATA_MAP,
  type CharacterData,
} from '../domain/characters';
import {
  DICETHRONE_CHARACTER_CATALOG,
  HAND_LIMIT,
  INITIAL_CP,
  INITIAL_HEALTH,
  CP_MAX,
  IMPLEMENTED_DICETHRONE_CHARACTER_IDS,
  type AbilityCard,
  type HeroState,
  type SelectableCharacterId,
} from '../domain/types';
import { getDiceDefinition } from '../domain/diceRegistry';
import { getDiceThroneCardPreviewRef } from '../ui/cardPreviewHelper';
import '../domain';

export const DICETHRONE_CONFIG_REVIEW_VERSION = 'legacy-ts-config-v1';
export const DICETHRONE_CONFIG_REVIEW_TABLE_ID = 'dicethrone:legacy-config-review';

export type DiceThroneConfigReviewType =
  | 'character'
  | 'card'
  | 'ability'
  | 'diceFace'
  | 'token';

export type DiceThroneConfigMaterialStatus =
  | 'ready'
  | 'not-applicable'
  | 'missing-card-art';

export const DICETHRONE_CONFIG_REVIEW_FIELD_KEYS = [
  'name',
  'id',
  'character',
  'rowType',
  'sourceContexts',
  'startingCp',
  'startingHealth',
  'cpMax',
  'handLimit',
  'startingHandSize',
  'diceDefinitionId',
  'diceValue',
  'diceSymbols',
  'diceSprite',
  'abilityType',
  'trigger',
  'tags',
  'effects',
  'variants',
  'initialAbilityLevel',
  'passiveAbilities',
  'cardType',
  'cpCost',
  'timing',
  'description',
  'playCondition',
  'isAttackModifier',
  'previewAtlas',
  'previewIndex',
  'sourceAtlasIndex',
  'tokenCategory',
  'stackLimit',
  'initialTokenAmount',
  'initialStatusAmount',
  'passiveTrigger',
  'activeUse',
  'frameId',
  'tokenAtlasId',
  'statusAtlasId',
  'statusAtlasPath',
  'sfxKey',
] as const;

export type DiceThroneConfigReviewFieldKey = typeof DICETHRONE_CONFIG_REVIEW_FIELD_KEYS[number];

export const DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS = [
  'image',
  ...DICETHRONE_CONFIG_REVIEW_FIELD_KEYS,
] as const;

export type DiceThroneConfigReviewColumnKey = typeof DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS[number];

export type DiceThroneConfigReviewFieldValueKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string-array';

export type DiceThroneConfigReviewFieldApplicability =
  | 'all'
  | 'character'
  | 'card'
  | 'ability'
  | 'diceFace'
  | 'token';

export interface DiceThroneConfigReviewFieldDefinition {
  key: DiceThroneConfigReviewFieldKey;
  valueKind: DiceThroneConfigReviewFieldValueKind;
  applicability: DiceThroneConfigReviewFieldApplicability;
  requiredForAudit: boolean;
  meaning: string;
  evidence: string[];
  fieldPath: (row: DiceThroneConfigReviewRow) => string;
  getValue: (row: DiceThroneConfigReviewRow) => unknown;
}

export type DiceThroneConfigReviewFieldPaths = Record<DiceThroneConfigReviewFieldKey, string>;

export interface DiceThroneConfigReviewRow {
  rowId: string;
  objectId: string;
  objectType: DiceThroneConfigReviewType;
  characterId: SelectableCharacterId;
  playerBoardFace?: HeroState['playerBoardFace'] | 'default';
  name: string;
  description?: string;
  sourceContexts: string[];
  startingCp?: number;
  startingHealth?: number;
  cpMax?: number;
  handLimit?: number;
  startingHandSize?: number;
  diceDefinitionId?: string;
  diceValue?: number;
  diceSymbols?: string[];
  diceSprite?: string;
  abilityType?: string;
  trigger?: string;
  tags?: string[];
  effects?: string;
  variants?: string;
  initialAbilityLevel?: number;
  passiveAbilities?: string;
  cardType?: AbilityCard['type'];
  cpCost?: number;
  timing?: AbilityCard['timing'];
  playCondition?: string;
  isAttackModifier?: boolean;
  previewRef: CardPreviewRef | null;
  previewAtlas?: string;
  previewIndex?: number;
  sourceAtlasIndex?: number;
  tokenCategory?: string;
  stackLimit?: number;
  initialTokenAmount?: number;
  initialStatusAmount?: number;
  passiveTrigger?: string;
  activeUse?: string;
  frameId?: string;
  tokenAtlasId?: string;
  statusAtlasId?: string;
  statusAtlasPath?: string;
  sfxKey?: string;
  materialStatus: DiceThroneConfigMaterialStatus;
  searchText: string;
  fieldPaths: DiceThroneConfigReviewFieldPaths;
}

export interface DiceThroneConfigReviewTable {
  tableId: string;
  gameId: 'dicethrone';
  configVersion: string;
  rows: DiceThroneConfigReviewRow[];
}

const DUMMY_RANDOM: RandomFn = {
  random: () => 0.5,
  d: (_max: number) => 1,
  range: (min: number) => min,
  shuffle: <T>(arr: T[]) => arr,
};

const TYPE_ORDER: Record<DiceThroneConfigReviewType, number> = {
  character: 0,
  diceFace: 1,
  ability: 2,
  card: 3,
  token: 4,
};

const RULE_EVIDENCE = {
  characterCatalog: 'src/games/dicethrone/domain/core-types.ts IMPLEMENTED_DICETHRONE_CHARACTER_IDS',
  characterData: 'src/games/dicethrone/domain/characters.ts CHARACTER_DATA_MAP',
  heroInit: 'src/games/dicethrone/domain/characters.ts initHeroState',
  diceRegistry: 'src/games/dicethrone/domain/index.ts registerDiceDefinition',
  diceLookup: 'src/games/dicethrone/domain/diceRegistry.ts getDiceDefinition',
  cards: 'src/games/dicethrone/heroes/*/cards.ts getStartingDeck',
  abilities: 'src/games/dicethrone/heroes/*/abilities.ts *_ABILITIES',
  tokens: 'src/games/dicethrone/heroes/*/tokens.ts *_TOKENS',
  materials: 'src/games/dicethrone/ui/cardPreviewHelper.ts getDiceThroneCardPreviewRef',
} as const;

function characterRoot(characterId: SelectableCharacterId): string {
  return `legacy.dicethrone.characters.${characterId}`;
}

function cardRoot(characterId: SelectableCharacterId, objectId: string): string {
  return `legacy.dicethrone.cards.${characterId}.${objectId}`;
}

function abilityRoot(characterId: SelectableCharacterId, objectId: string, face?: string): string {
  const faceSegment = face && face !== 'default' ? `.faces.${face}` : '';
  return `legacy.dicethrone.abilities.${characterId}${faceSegment}.${objectId}`;
}

function diceFaceRoot(characterId: SelectableCharacterId, definitionId: string, diceValue: number): string {
  return `legacy.dicethrone.dice.${characterId}.${definitionId}.faces.${diceValue}`;
}

function tokenRoot(characterId: SelectableCharacterId, objectId: string): string {
  return `legacy.dicethrone.tokens.${characterId}.${objectId}`;
}

function rootForRow(row: DiceThroneConfigReviewRow): string {
  if (row.objectType === 'card') return cardRoot(row.characterId, row.objectId);
  if (row.objectType === 'ability') return abilityRoot(row.characterId, row.objectId, row.playerBoardFace);
  if (row.objectType === 'diceFace') return diceFaceRoot(row.characterId, row.diceDefinitionId ?? 'unknown-dice', row.diceValue ?? 0);
  if (row.objectType === 'token') return tokenRoot(row.characterId, row.objectId);
  return characterRoot(row.characterId);
}

function fieldPath(row: DiceThroneConfigReviewRow, field: string): string {
  return `${rootForRow(row)}.${field}`;
}

function stableJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

function stableList(value: readonly string[] | undefined): string[] {
  return value ? [...value] : [];
}

function getPreviewAtlas(previewRef: CardPreviewRef | null): string | undefined {
  return previewRef?.type === 'atlas' ? previewRef.atlasId : undefined;
}

function getPreviewIndex(previewRef: CardPreviewRef | null): number | undefined {
  return previewRef?.type === 'atlas' ? previewRef.index : undefined;
}

function createFieldPaths(row: Omit<DiceThroneConfigReviewRow, 'fieldPaths'>): DiceThroneConfigReviewFieldPaths {
  return Object.fromEntries(
    DICETHRONE_CONFIG_REVIEW_FIELD_KEYS.map((key) => [key, fieldPath(row as DiceThroneConfigReviewRow, key)]),
  ) as DiceThroneConfigReviewFieldPaths;
}

function finalizeRow(row: Omit<DiceThroneConfigReviewRow, 'fieldPaths' | 'searchText'>): DiceThroneConfigReviewRow {
  const withPaths = {
    ...row,
    searchText: [
      row.objectId,
      row.objectType,
      row.characterId,
      row.name,
      row.description ?? '',
      row.sourceContexts.join(' '),
      row.diceDefinitionId ?? '',
      row.diceSymbols?.join(' ') ?? '',
      row.cardType ?? '',
      row.timing ?? '',
      row.abilityType ?? '',
      row.tags?.join(' ') ?? '',
      row.tokenCategory ?? '',
    ].join(' ').toLowerCase(),
  };

  return {
    ...withPaths,
    fieldPaths: createFieldPaths(withPaths),
  };
}

function getCharacterNameKey(characterId: SelectableCharacterId): string {
  return DICETHRONE_CHARACTER_CATALOG.find((character) => character.id === characterId)?.nameKey
    ?? `characters.${characterId}`;
}

function buildCharacterRow(characterId: SelectableCharacterId, data: CharacterData): DiceThroneConfigReviewRow {
  const initialStatusEffects = data.initialStatusEffects ?? {};
  return finalizeRow({
    rowId: `dicethrone:${characterId}:character:${characterId}`,
    objectId: characterId,
    objectType: 'character',
    characterId,
    playerBoardFace: data.initialPlayerBoardFace ?? 'default',
    name: getCharacterNameKey(characterId),
    sourceContexts: ['角色配置', '开局初始化'],
    startingCp: INITIAL_CP,
    startingHealth: INITIAL_HEALTH,
    cpMax: CP_MAX,
    handLimit: HAND_LIMIT,
    startingHandSize: 4,
    diceDefinitionId: data.diceDefinitionId,
    initialTokenAmount: Object.values(data.initialTokens).reduce((sum, amount) => sum + amount, 0),
    initialStatusAmount: Object.values(initialStatusEffects).reduce((sum, amount) => sum + amount, 0),
    initialAbilityLevel: Object.keys(data.initialAbilityLevels).length,
    passiveAbilities: stableJson(data.passiveAbilities),
    statusAtlasId: data.statusAtlasId,
    statusAtlasPath: data.statusAtlasPath,
    previewRef: null,
    materialStatus: 'not-applicable',
  });
}

function getAbilitySets(characterId: SelectableCharacterId, data: CharacterData): Array<{
  face: HeroState['playerBoardFace'] | 'default';
  abilities: AbilityDef[];
}> {
  if (data.getAbilitiesForFace) {
    return [
      { face: 'normal', abilities: data.getAbilitiesForFace('normal') as AbilityDef[] },
      { face: 'cursed', abilities: data.getAbilitiesForFace('cursed') as AbilityDef[] },
    ];
  }
  return [{ face: data.initialPlayerBoardFace ?? 'default', abilities: data.abilities as AbilityDef[] }];
}

function buildAbilityRows(characterId: SelectableCharacterId, data: CharacterData): DiceThroneConfigReviewRow[] {
  const rows: DiceThroneConfigReviewRow[] = [];
  for (const { face, abilities } of getAbilitySets(characterId, data)) {
    for (const ability of abilities) {
      rows.push(finalizeRow({
        rowId: `dicethrone:${characterId}:ability:${face}:${ability.id}`,
        objectId: ability.id,
        objectType: 'ability',
        characterId,
        playerBoardFace: face,
        name: ability.name,
        description: ability.description,
        sourceContexts: face === 'default' ? ['技能配置'] : [`技能配置:${face}`],
        abilityType: ability.type,
        trigger: stableJson(ability.trigger),
        tags: stableList(ability.tags),
        effects: stableJson(ability.effects),
        variants: stableJson(ability.variants),
        initialAbilityLevel: data.initialAbilityLevels[ability.id],
        sfxKey: ability.sfxKey,
        previewRef: null,
        materialStatus: 'not-applicable',
      }));
    }
  }
  return rows;
}

function buildCardRows(characterId: SelectableCharacterId, data: CharacterData): DiceThroneConfigReviewRow[] {
  return data.getStartingDeck(DUMMY_RANDOM).map((card) => {
    const previewRef = card.previewRef ?? getDiceThroneCardPreviewRef(card.id, characterId);
    return finalizeRow({
      rowId: `dicethrone:${characterId}:card:${card.id}`,
      objectId: card.id,
      objectType: 'card',
      characterId,
      name: card.name,
      description: card.description,
      sourceContexts: ['起手牌库', card.type === 'upgrade' ? '升级牌' : '行动牌'],
      cardType: card.type,
      cpCost: card.cpCost,
      timing: card.timing,
      playCondition: stableJson(card.playCondition),
      isAttackModifier: card.isAttackModifier,
      effects: stableJson(card.effects),
      previewRef,
      previewAtlas: getPreviewAtlas(previewRef),
      previewIndex: getPreviewIndex(previewRef),
      sourceAtlasIndex: card.sourceAtlasIndex,
      sfxKey: card.sfxKey,
      materialStatus: previewRef ? 'ready' : 'missing-card-art',
    });
  });
}

function buildDiceRows(characterId: SelectableCharacterId, data: CharacterData): DiceThroneConfigReviewRow[] {
  const definition = getDiceDefinition(data.diceDefinitionId);
  return (definition?.faces ?? []).map((face) => finalizeRow({
    rowId: `dicethrone:${characterId}:diceFace:${data.diceDefinitionId}:${face.value}`,
    objectId: `${data.diceDefinitionId}:${face.value}`,
    objectType: 'diceFace',
    characterId,
    name: `${data.diceDefinitionId}#${face.value}`,
    sourceContexts: ['骰子定义'],
    diceDefinitionId: data.diceDefinitionId,
    diceValue: face.value,
    diceSymbols: stableList(face.symbols),
    diceSprite: definition?.assets?.spriteSheet,
    previewRef: null,
    materialStatus: 'not-applicable',
  }));
}

function buildTokenRows(characterId: SelectableCharacterId, data: CharacterData): DiceThroneConfigReviewRow[] {
  return data.tokens.map((token) => finalizeRow({
    rowId: `dicethrone:${characterId}:token:${token.id}`,
    objectId: token.id,
    objectType: 'token',
    characterId,
    name: token.name,
    description: Array.isArray(token.description) ? token.description.join('\n') : String(token.description),
    sourceContexts: ['标记/状态配置'],
    tokenCategory: token.category,
    stackLimit: token.stackLimit,
    initialTokenAmount: data.initialTokens[token.id],
    initialStatusAmount: data.initialStatusEffects?.[token.id],
    passiveTrigger: stableJson(token.passiveTrigger),
    activeUse: stableJson(token.activeUse),
    frameId: token.frameId,
    tokenAtlasId: token.atlasId,
    statusAtlasId: data.statusAtlasId,
    statusAtlasPath: data.statusAtlasPath,
    sfxKey: token.sfxKey,
    previewRef: null,
    materialStatus: 'not-applicable',
  }));
}

export const DICETHRONE_CONFIG_REVIEW_FIELD_DEFINITIONS: readonly DiceThroneConfigReviewFieldDefinition[] = [
  { key: 'id', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '配置对象唯一编号', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'id'), getValue: (row) => row.objectId },
  { key: 'name', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '玩家可见名称或多语言 key', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'name'), getValue: (row) => row.name },
  { key: 'character', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '所属英雄', evidence: [RULE_EVIDENCE.characterCatalog], fieldPath: (row) => fieldPath(row, 'characterId'), getValue: (row) => row.characterId },
  { key: 'rowType', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '审查对象类型', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'objectType'), getValue: (row) => row.objectType },
  { key: 'sourceContexts', valueKind: 'string-array', applicability: 'all', requiredForAudit: true, meaning: '该对象来自哪些静态配置入口', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'sourceContexts'), getValue: (row) => row.sourceContexts },
  { key: 'startingCp', valueKind: 'number', applicability: 'character', requiredForAudit: true, meaning: '开局 CP', evidence: [RULE_EVIDENCE.heroInit], fieldPath: (row) => fieldPath(row, 'startingCp'), getValue: (row) => row.startingCp },
  { key: 'startingHealth', valueKind: 'number', applicability: 'character', requiredForAudit: true, meaning: '开局生命', evidence: [RULE_EVIDENCE.heroInit], fieldPath: (row) => fieldPath(row, 'startingHealth'), getValue: (row) => row.startingHealth },
  { key: 'cpMax', valueKind: 'number', applicability: 'character', requiredForAudit: true, meaning: 'CP 上限', evidence: [RULE_EVIDENCE.heroInit], fieldPath: (row) => fieldPath(row, 'cpMax'), getValue: (row) => row.cpMax },
  { key: 'handLimit', valueKind: 'number', applicability: 'character', requiredForAudit: true, meaning: '手牌上限', evidence: [RULE_EVIDENCE.heroInit], fieldPath: (row) => fieldPath(row, 'handLimit'), getValue: (row) => row.handLimit },
  { key: 'startingHandSize', valueKind: 'number', applicability: 'character', requiredForAudit: true, meaning: '起手抽牌数量', evidence: [RULE_EVIDENCE.heroInit], fieldPath: (row) => fieldPath(row, 'startingHandSize'), getValue: (row) => row.startingHandSize },
  { key: 'diceDefinitionId', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '骰子定义编号', evidence: [RULE_EVIDENCE.diceRegistry], fieldPath: (row) => fieldPath(row, 'diceDefinitionId'), getValue: (row) => row.diceDefinitionId },
  { key: 'diceValue', valueKind: 'number', applicability: 'diceFace', requiredForAudit: true, meaning: '骰面点数', evidence: [RULE_EVIDENCE.diceLookup], fieldPath: (row) => fieldPath(row, 'diceValue'), getValue: (row) => row.diceValue },
  { key: 'diceSymbols', valueKind: 'string-array', applicability: 'diceFace', requiredForAudit: true, meaning: '点数对应的英雄骰面符号', evidence: [RULE_EVIDENCE.diceLookup], fieldPath: (row) => fieldPath(row, 'diceSymbols'), getValue: (row) => row.diceSymbols },
  { key: 'diceSprite', valueKind: 'string', applicability: 'diceFace', requiredForAudit: true, meaning: '骰子素材路径', evidence: [RULE_EVIDENCE.diceRegistry], fieldPath: (row) => fieldPath(row, 'diceSprite'), getValue: (row) => row.diceSprite },
  { key: 'abilityType', valueKind: 'string', applicability: 'ability', requiredForAudit: true, meaning: '技能类型', evidence: [RULE_EVIDENCE.abilities], fieldPath: (row) => fieldPath(row, 'abilityType'), getValue: (row) => row.abilityType },
  { key: 'trigger', valueKind: 'string', applicability: 'ability', requiredForAudit: true, meaning: '技能触发条件', evidence: [RULE_EVIDENCE.abilities], fieldPath: (row) => fieldPath(row, 'trigger'), getValue: (row) => row.trigger },
  { key: 'tags', valueKind: 'string-array', applicability: 'ability', requiredForAudit: true, meaning: '技能标签', evidence: [RULE_EVIDENCE.abilities], fieldPath: (row) => fieldPath(row, 'tags'), getValue: (row) => row.tags },
  { key: 'effects', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '技能、卡牌或标记的程序化效果配置', evidence: [RULE_EVIDENCE.abilities, RULE_EVIDENCE.cards, RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'effects'), getValue: (row) => row.effects },
  { key: 'variants', valueKind: 'string', applicability: 'ability', requiredForAudit: true, meaning: '技能变体与优先级', evidence: [RULE_EVIDENCE.abilities], fieldPath: (row) => fieldPath(row, 'variants'), getValue: (row) => row.variants },
  { key: 'initialAbilityLevel', valueKind: 'number', applicability: 'all', requiredForAudit: true, meaning: '开局技能等级或技能数量', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'initialAbilityLevel'), getValue: (row) => row.initialAbilityLevel },
  { key: 'passiveAbilities', valueKind: 'string', applicability: 'character', requiredForAudit: true, meaning: '英雄被动能力配置', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'passiveAbilities'), getValue: (row) => row.passiveAbilities },
  { key: 'cardType', valueKind: 'string', applicability: 'card', requiredForAudit: true, meaning: '卡牌类型', evidence: [RULE_EVIDENCE.cards], fieldPath: (row) => fieldPath(row, 'cardType'), getValue: (row) => row.cardType },
  { key: 'cpCost', valueKind: 'number', applicability: 'card', requiredForAudit: true, meaning: '卡牌 CP 费用', evidence: [RULE_EVIDENCE.cards], fieldPath: (row) => fieldPath(row, 'cpCost'), getValue: (row) => row.cpCost },
  { key: 'timing', valueKind: 'string', applicability: 'card', requiredForAudit: true, meaning: '卡牌可打出时机', evidence: [RULE_EVIDENCE.cards], fieldPath: (row) => fieldPath(row, 'timing'), getValue: (row) => row.timing },
  { key: 'description', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '玩家可见描述或多语言 key', evidence: [RULE_EVIDENCE.cards, RULE_EVIDENCE.abilities, RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'description'), getValue: (row) => row.description },
  { key: 'playCondition', valueKind: 'string', applicability: 'card', requiredForAudit: true, meaning: '卡牌使用条件', evidence: [RULE_EVIDENCE.cards], fieldPath: (row) => fieldPath(row, 'playCondition'), getValue: (row) => row.playCondition },
  { key: 'isAttackModifier', valueKind: 'boolean', applicability: 'card', requiredForAudit: true, meaning: '是否攻击修正卡', evidence: [RULE_EVIDENCE.cards], fieldPath: (row) => fieldPath(row, 'isAttackModifier'), getValue: (row) => row.isAttackModifier },
  { key: 'previewAtlas', valueKind: 'string', applicability: 'card', requiredForAudit: true, meaning: '卡图图集', evidence: [RULE_EVIDENCE.materials], fieldPath: (row) => fieldPath(row, 'previewAtlas'), getValue: (row) => row.previewAtlas },
  { key: 'previewIndex', valueKind: 'number', applicability: 'card', requiredForAudit: true, meaning: '卡图图集索引', evidence: [RULE_EVIDENCE.materials], fieldPath: (row) => fieldPath(row, 'previewIndex'), getValue: (row) => row.previewIndex },
  { key: 'sourceAtlasIndex', valueKind: 'number', applicability: 'card', requiredForAudit: true, meaning: '源图审计索引', evidence: [RULE_EVIDENCE.cards], fieldPath: (row) => fieldPath(row, 'sourceAtlasIndex'), getValue: (row) => row.sourceAtlasIndex },
  { key: 'tokenCategory', valueKind: 'string', applicability: 'token', requiredForAudit: true, meaning: '标记或状态分类', evidence: [RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'tokenCategory'), getValue: (row) => row.tokenCategory },
  { key: 'stackLimit', valueKind: 'number', applicability: 'token', requiredForAudit: true, meaning: '标记堆叠上限', evidence: [RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'stackLimit'), getValue: (row) => row.stackLimit },
  { key: 'initialTokenAmount', valueKind: 'number', applicability: 'all', requiredForAudit: true, meaning: '开局持有的标记数量', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'initialTokenAmount'), getValue: (row) => row.initialTokenAmount },
  { key: 'initialStatusAmount', valueKind: 'number', applicability: 'all', requiredForAudit: true, meaning: '开局状态数量', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'initialStatusAmount'), getValue: (row) => row.initialStatusAmount },
  { key: 'passiveTrigger', valueKind: 'string', applicability: 'token', requiredForAudit: true, meaning: '状态/标记被动触发配置', evidence: [RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'passiveTrigger'), getValue: (row) => row.passiveTrigger },
  { key: 'activeUse', valueKind: 'string', applicability: 'token', requiredForAudit: true, meaning: '标记主动使用配置', evidence: [RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'activeUse'), getValue: (row) => row.activeUse },
  { key: 'frameId', valueKind: 'string', applicability: 'token', requiredForAudit: true, meaning: '标记图集帧编号', evidence: [RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'frameId'), getValue: (row) => row.frameId },
  { key: 'tokenAtlasId', valueKind: 'string', applicability: 'token', requiredForAudit: true, meaning: '标记图集编号', evidence: [RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'tokenAtlasId'), getValue: (row) => row.tokenAtlasId },
  { key: 'statusAtlasId', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '状态图集编号', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'statusAtlasId'), getValue: (row) => row.statusAtlasId },
  { key: 'statusAtlasPath', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '状态图集路径', evidence: [RULE_EVIDENCE.characterData], fieldPath: (row) => fieldPath(row, 'statusAtlasPath'), getValue: (row) => row.statusAtlasPath },
  { key: 'sfxKey', valueKind: 'string', applicability: 'all', requiredForAudit: true, meaning: '音效 key', evidence: [RULE_EVIDENCE.cards, RULE_EVIDENCE.abilities, RULE_EVIDENCE.tokens], fieldPath: (row) => fieldPath(row, 'sfxKey'), getValue: (row) => row.sfxKey },
];

const FIELD_DEFINITION_BY_KEY = new Map(
  DICETHRONE_CONFIG_REVIEW_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function getDiceThroneConfigReviewFieldDefinition(
  fieldKey: DiceThroneConfigReviewFieldKey,
): DiceThroneConfigReviewFieldDefinition {
  const definition = FIELD_DEFINITION_BY_KEY.get(fieldKey);
  if (!definition) {
    throw new Error(`unknown DiceThrone config review field "${fieldKey}"`);
  }
  return definition;
}

export function getDiceThroneConfigReviewCellValue(
  row: DiceThroneConfigReviewRow,
  fieldKey: DiceThroneConfigReviewFieldKey,
): unknown {
  return getDiceThroneConfigReviewFieldDefinition(fieldKey).getValue(row);
}

export function isDiceThroneConfigReviewFieldApplicable(
  row: DiceThroneConfigReviewRow,
  fieldKey: DiceThroneConfigReviewFieldKey,
): boolean {
  const definition = getDiceThroneConfigReviewFieldDefinition(fieldKey);
  return definition.applicability === 'all' || definition.applicability === row.objectType;
}

function compareRows(a: DiceThroneConfigReviewRow, b: DiceThroneConfigReviewRow): number {
  const characterOrder = IMPLEMENTED_DICETHRONE_CHARACTER_IDS.indexOf(a.characterId)
    - IMPLEMENTED_DICETHRONE_CHARACTER_IDS.indexOf(b.characterId);
  if (characterOrder !== 0) return characterOrder;

  const typeOrder = TYPE_ORDER[a.objectType] - TYPE_ORDER[b.objectType];
  if (typeOrder !== 0) return typeOrder;

  const faceOrder = String(a.playerBoardFace ?? '').localeCompare(String(b.playerBoardFace ?? ''), 'zh-CN');
  if (faceOrder !== 0) return faceOrder;

  return a.objectId.localeCompare(b.objectId, 'zh-CN');
}

export function buildDiceThroneConfigReviewTable(): DiceThroneConfigReviewTable {
  const rows: DiceThroneConfigReviewRow[] = [];

  for (const characterId of IMPLEMENTED_DICETHRONE_CHARACTER_IDS) {
    const data = CHARACTER_DATA_MAP[characterId];
    rows.push(buildCharacterRow(characterId, data));
    rows.push(...buildDiceRows(characterId, data));
    rows.push(...buildAbilityRows(characterId, data));
    rows.push(...buildCardRows(characterId, data));
    rows.push(...buildTokenRows(characterId, data));
  }

  return {
    tableId: DICETHRONE_CONFIG_REVIEW_TABLE_ID,
    gameId: 'dicethrone',
    configVersion: DICETHRONE_CONFIG_REVIEW_VERSION,
    rows: rows.sort(compareRows),
  };
}
