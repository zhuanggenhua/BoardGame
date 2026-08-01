import type { CardPreviewRef } from '../../../core';
import type { Card, EventCard, FactionId, StructureCard, UnitCard } from '../domain/types';
import { getBaseCardId } from '../domain/ids';
import { getSummonerWarsCardPreviewRef } from '../ui/cardPreviewHelper';
import { createDeckByFactionId, FACTION_CATALOG } from './factions';

export const SUMMONER_WARS_CONFIG_REVIEW_VERSION = 'legacy-ts-config-v1';
export const SUMMONER_WARS_CONFIG_REVIEW_TABLE_ID = 'summonerwars:legacy-config-review';

export type SummonerWarsConfigReviewType =
  | 'summoner'
  | 'champion'
  | 'common'
  | 'event'
  | 'gate'
  | 'structure';

export type SummonerWarsConfigMaterialStatus =
  | 'ready'
  | 'missing-sprite';

export const SUMMONER_WARS_CONFIG_REVIEW_FIELD_KEYS = [
  'name',
  'id',
  'faction',
  'deckSymbols',
  'cardType',
  'unitClass',
  'quantity',
  'setupPositions',
  'attack',
  'life',
  'cost',
  'attackType',
  'attackRange',
  'playPhase',
  'eventType',
  'isActive',
  'charges',
  'targetUnitId',
  'entanglementTargets',
  'abilities',
  'effect',
  'isGate',
  'isStartingGate',
  'spriteAtlas',
  'spriteIndex',
  'sourceContexts',
] as const;

export type SummonerWarsConfigReviewFieldKey = typeof SUMMONER_WARS_CONFIG_REVIEW_FIELD_KEYS[number];

export const SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS = [
  'image',
  ...SUMMONER_WARS_CONFIG_REVIEW_FIELD_KEYS,
] as const;

export type SummonerWarsConfigReviewColumnKey = typeof SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS[number];

export type SummonerWarsConfigReviewFieldValueKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string-array';

export type SummonerWarsConfigReviewFieldApplicability =
  | 'all'
  | 'unit'
  | 'event'
  | 'structure'
  | 'unit-or-structure';

export interface SummonerWarsConfigReviewFieldDefinition {
  key: SummonerWarsConfigReviewFieldKey;
  valueKind: SummonerWarsConfigReviewFieldValueKind;
  applicability: SummonerWarsConfigReviewFieldApplicability;
  requiredForAudit: boolean;
  meaning: string;
  evidence: string[];
  fieldPath: (objectId: string) => string;
  getValue: (row: SummonerWarsConfigReviewRow) => unknown;
}

export type SummonerWarsConfigReviewFieldPaths = Record<SummonerWarsConfigReviewFieldKey, string> & {
  sprite: string;
};

export interface SummonerWarsConfigReviewRow {
  rowId: string;
  objectId: string;
  objectType: SummonerWarsConfigReviewType;
  cardType: Card['cardType'];
  unitClass?: UnitCard['unitClass'];
  factionId: FactionId;
  factionNameKey: string;
  name: string;
  quantity: number;
  setupPositions: string[];
  attack?: number;
  life?: number;
  cost?: number;
  attackType?: UnitCard['attackType'];
  attackRange?: UnitCard['attackRange'];
  playPhase?: EventCard['playPhase'];
  eventType?: EventCard['eventType'];
  isActive?: EventCard['isActive'];
  charges?: EventCard['charges'];
  targetUnitId?: EventCard['targetUnitId'];
  entanglementTargets?: EventCard['entanglementTargets'];
  abilityIds: string[];
  effectText?: string;
  deckSymbols: string[];
  isGate?: StructureCard['isGate'];
  isStartingGate?: StructureCard['isStartingGate'];
  spriteAtlas?: Card['spriteAtlas'];
  spriteIndex?: number;
  previewRef: CardPreviewRef | null;
  materialStatus: SummonerWarsConfigMaterialStatus;
  sourceContexts: string[];
  fieldPaths: SummonerWarsConfigReviewFieldPaths;
}

export interface SummonerWarsConfigReviewTable {
  tableId: string;
  gameId: 'summonerwars';
  configVersion: string;
  rows: SummonerWarsConfigReviewRow[];
}

type ReviewRowDraft = Omit<SummonerWarsConfigReviewRow, 'sourceContexts' | 'setupPositions'> & {
  sourceContexts: Set<string>;
  setupPositions: Set<string>;
};

const CARD_TYPE_ORDER: Record<SummonerWarsConfigReviewType, number> = {
  summoner: 0,
  gate: 1,
  champion: 2,
  common: 3,
  structure: 4,
  event: 5,
};

const SOURCE_LABELS = {
  summoner: '召唤师',
  startingGate: '起始城门',
  startingUnit: '起始单位',
  deck: '抽牌堆',
} as const;

const RULE_EVIDENCE = {
  cardPrintedFields: 'src/games/summonerwars/rule/召唤师战争规则.md:30-45',
  deckRestriction: 'src/games/summonerwars/rule/召唤师战争规则.md:306-309',
  deckValidation: 'src/games/summonerwars/config/deckValidation.ts:144-178',
  symbolMatch: 'src/games/summonerwars/config/deckValidation.ts:231-246',
  setupData: 'src/games/summonerwars/config/factions/index.ts createDeckByFactionId',
  materialPreview: 'src/games/summonerwars/ui/cardPreviewHelper.ts',
} as const;

function cardRoot(objectId: string): string {
  return `legacy.summonerwars.cardRegistry.${objectId}`;
}

function deckSourceRoot(objectId: string): string {
  return `legacy.summonerwars.deckSources.${objectId}`;
}

function cardFieldPath(objectId: string, field: string): string {
  return `${cardRoot(objectId)}.${field}`;
}

export const SUMMONER_WARS_CONFIG_REVIEW_FIELD_DEFINITIONS: readonly SummonerWarsConfigReviewFieldDefinition[] = [
  {
    key: 'id',
    valueKind: 'string',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '配置对象唯一编号',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'id'),
    getValue: (row) => row.objectId,
  },
  {
    key: 'name',
    valueKind: 'string',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '玩家看到的卡牌名称',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'name'),
    getValue: (row) => row.name,
  },
  {
    key: 'faction',
    valueKind: 'string',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '卡牌所属阵营，不等于牌组构筑符号',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'faction'),
    getValue: (row) => row.factionId,
  },
  {
    key: 'deckSymbols',
    valueKind: 'string-array',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '牌组构筑用牌组符号',
    evidence: [RULE_EVIDENCE.deckRestriction, RULE_EVIDENCE.deckValidation, RULE_EVIDENCE.symbolMatch],
    fieldPath: (objectId) => cardFieldPath(objectId, 'deckSymbols'),
    getValue: (row) => row.deckSymbols,
  },
  {
    key: 'cardType',
    valueKind: 'string',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '卡牌大类，用于运行时分支',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'cardType'),
    getValue: (row) => row.cardType,
  },
  {
    key: 'unitClass',
    valueKind: 'string',
    applicability: 'unit',
    requiredForAudit: true,
    meaning: '单位级别：召唤师、冠军或普通单位',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'unitClass'),
    getValue: (row) => row.unitClass,
  },
  {
    key: 'quantity',
    valueKind: 'number',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '牌组或起始配置中的数量',
    evidence: [RULE_EVIDENCE.setupData],
    fieldPath: (objectId) => cardFieldPath(objectId, 'quantity'),
    getValue: (row) => row.quantity,
  },
  {
    key: 'setupPositions',
    valueKind: 'string-array',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '起始部署坐标',
    evidence: [RULE_EVIDENCE.setupData],
    fieldPath: (objectId) => `${deckSourceRoot(objectId)}.setupPositions`,
    getValue: (row) => row.setupPositions,
  },
  {
    key: 'attack',
    valueKind: 'number',
    applicability: 'unit',
    requiredForAudit: true,
    meaning: '单位攻击骰数',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'strength'),
    getValue: (row) => row.attack,
  },
  {
    key: 'life',
    valueKind: 'number',
    applicability: 'unit-or-structure',
    requiredForAudit: true,
    meaning: '单位或建筑生命值',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'life'),
    getValue: (row) => row.life,
  },
  {
    key: 'cost',
    valueKind: 'number',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '召唤或施放费用',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'cost'),
    getValue: (row) => row.cost,
  },
  {
    key: 'attackType',
    valueKind: 'string',
    applicability: 'unit',
    requiredForAudit: true,
    meaning: '攻击类型：近战或远程',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'attackType'),
    getValue: (row) => row.attackType,
  },
  {
    key: 'attackRange',
    valueKind: 'number',
    applicability: 'unit',
    requiredForAudit: true,
    meaning: '远程攻击距离',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'attackRange'),
    getValue: (row) => row.attackRange,
  },
  {
    key: 'playPhase',
    valueKind: 'string',
    applicability: 'event',
    requiredForAudit: true,
    meaning: '事件卡可施放阶段',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'playPhase'),
    getValue: (row) => row.playPhase,
  },
  {
    key: 'eventType',
    valueKind: 'string',
    applicability: 'event',
    requiredForAudit: true,
    meaning: '事件类型',
    evidence: [RULE_EVIDENCE.cardPrintedFields, RULE_EVIDENCE.symbolMatch],
    fieldPath: (objectId) => cardFieldPath(objectId, 'eventType'),
    getValue: (row) => row.eventType,
  },
  {
    key: 'isActive',
    valueKind: 'boolean',
    applicability: 'event',
    requiredForAudit: true,
    meaning: '事件是否为持续激活效果',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'isActive'),
    getValue: (row) => row.isActive,
  },
  {
    key: 'charges',
    valueKind: 'number',
    applicability: 'event',
    requiredForAudit: true,
    meaning: '持续事件使用次数',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'charges'),
    getValue: (row) => row.charges,
  },
  {
    key: 'targetUnitId',
    valueKind: 'string',
    applicability: 'event',
    requiredForAudit: true,
    meaning: '事件绑定的目标单位',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'targetUnitId'),
    getValue: (row) => row.targetUnitId,
  },
  {
    key: 'entanglementTargets',
    valueKind: 'string-array',
    applicability: 'event',
    requiredForAudit: true,
    meaning: '事件绑定的多目标单位',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'entanglementTargets'),
    getValue: (row) => row.entanglementTargets,
  },
  {
    key: 'abilities',
    valueKind: 'string-array',
    applicability: 'unit',
    requiredForAudit: true,
    meaning: '单位能力编号',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'abilities'),
    getValue: (row) => row.abilityIds,
  },
  {
    key: 'effect',
    valueKind: 'string',
    applicability: 'event',
    requiredForAudit: true,
    meaning: '事件效果文本',
    evidence: [RULE_EVIDENCE.cardPrintedFields],
    fieldPath: (objectId) => cardFieldPath(objectId, 'effect'),
    getValue: (row) => row.effectText,
  },
  {
    key: 'isGate',
    valueKind: 'boolean',
    applicability: 'structure',
    requiredForAudit: true,
    meaning: '是否为城门建筑',
    evidence: [RULE_EVIDENCE.setupData, RULE_EVIDENCE.symbolMatch],
    fieldPath: (objectId) => cardFieldPath(objectId, 'isGate'),
    getValue: (row) => row.isGate,
  },
  {
    key: 'isStartingGate',
    valueKind: 'boolean',
    applicability: 'structure',
    requiredForAudit: true,
    meaning: '是否为起始城门',
    evidence: [RULE_EVIDENCE.setupData],
    fieldPath: (objectId) => cardFieldPath(objectId, 'isStartingGate'),
    getValue: (row) => row.isStartingGate,
  },
  {
    key: 'spriteAtlas',
    valueKind: 'string',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '卡图图集',
    evidence: [RULE_EVIDENCE.materialPreview],
    fieldPath: (objectId) => cardFieldPath(objectId, 'spriteAtlas'),
    getValue: (row) => row.spriteAtlas,
  },
  {
    key: 'spriteIndex',
    valueKind: 'number',
    applicability: 'all',
    requiredForAudit: true,
    meaning: '卡图在图集里的编号',
    evidence: [RULE_EVIDENCE.materialPreview],
    fieldPath: (objectId) => cardFieldPath(objectId, 'spriteIndex'),
    getValue: (row) => row.spriteIndex,
  },
  {
    key: 'sourceContexts',
    valueKind: 'string-array',
    applicability: 'all',
    requiredForAudit: false,
    meaning: '对象来自召唤师、起始城门、起始单位或抽牌堆的配置源上下文',
    evidence: [RULE_EVIDENCE.setupData],
    fieldPath: (objectId) => deckSourceRoot(objectId),
    getValue: (row) => row.sourceContexts,
  },
];

const FIELD_DEFINITION_BY_KEY = new Map(
  SUMMONER_WARS_CONFIG_REVIEW_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function getSummonerWarsConfigReviewFieldDefinition(
  fieldKey: SummonerWarsConfigReviewFieldKey,
): SummonerWarsConfigReviewFieldDefinition {
  const definition = FIELD_DEFINITION_BY_KEY.get(fieldKey);
  if (!definition) {
    throw new Error(`unknown Summoner Wars config review field "${fieldKey}"`);
  }
  return definition;
}

export function getSummonerWarsConfigReviewCellValue(
  row: SummonerWarsConfigReviewRow,
  fieldKey: SummonerWarsConfigReviewFieldKey,
): unknown {
  return getSummonerWarsConfigReviewFieldDefinition(fieldKey).getValue(row);
}

export function isSummonerWarsConfigReviewFieldApplicable(
  row: SummonerWarsConfigReviewRow,
  fieldKey: SummonerWarsConfigReviewFieldKey,
): boolean {
  const definition = getSummonerWarsConfigReviewFieldDefinition(fieldKey);
  switch (definition.applicability) {
    case 'unit':
      return row.cardType === 'unit';
    case 'event':
      return row.cardType === 'event';
    case 'structure':
      return row.cardType === 'structure';
    case 'unit-or-structure':
      return row.cardType === 'unit' || row.cardType === 'structure' || row.life !== undefined;
    case 'all':
    default:
      return true;
  }
}

function getCardReviewType(card: Card): SummonerWarsConfigReviewType {
  if (card.cardType === 'unit') {
    return card.unitClass;
  }
  if (card.cardType === 'structure') {
    return card.isGate || card.isStartingGate ? 'gate' : 'structure';
  }
  return 'event';
}

function getReviewObjectType(card: Card): SummonerWarsConfigReviewType {
  const reviewType = getCardReviewType(card);
  return reviewType === 'summoner' || reviewType === 'champion' || reviewType === 'common'
    ? reviewType
    : reviewType;
}

function getReviewFieldPaths(objectId: string): SummonerWarsConfigReviewFieldPaths {
  const fieldPaths = Object.fromEntries(
    SUMMONER_WARS_CONFIG_REVIEW_FIELD_DEFINITIONS.map((definition) => [
      definition.key,
      definition.fieldPath(objectId),
    ]),
  ) as Record<SummonerWarsConfigReviewFieldKey, string>;

  return {
    ...fieldPaths,
    sprite: cardFieldPath(objectId, 'sprite'),
  };
}

function buildCanonicalMap(cards: Card[]) {
  const byStableId = new Map<string, Card>();
  const byVisualKey = new Map<string, Card>();

  for (const card of cards) {
    const stableId = getBaseCardId(card.id);
    const canonicalCard = { ...card, id: stableId } as Card;
    byStableId.set(stableId, canonicalCard);
    byVisualKey.set(getVisualKey(canonicalCard), canonicalCard);
  }

  return { byStableId, byVisualKey };
}

function getVisualKey(card: Card): string {
  return [
    card.cardType,
    card.name,
    card.faction,
    card.spriteAtlas ?? 'cards',
    card.spriteIndex ?? 'no-sprite',
  ].join('|');
}

function getCanonicalCard(card: Card, canonicalMap: ReturnType<typeof buildCanonicalMap>): Card {
  const stableId = getBaseCardId(card.id);
  return canonicalMap.byStableId.get(stableId)
    ?? canonicalMap.byVisualKey.get(getVisualKey(card))
    ?? { ...card, id: stableId };
}

function sourceLabel(source: keyof typeof SOURCE_LABELS, detail?: string): string {
  return detail ? `${SOURCE_LABELS[source]}: ${detail}` : SOURCE_LABELS[source];
}

function setupPositionToken(
  source: 'summoner' | 'startingGate' | 'startingUnit',
  position: { row: number; col: number },
  index?: number,
): string {
  if (source === 'startingUnit') {
    return `startingUnit#${index ?? 1}@${position.row}:${position.col}`;
  }
  return `${source}@${position.row}:${position.col}`;
}

function createReviewRowDraft(
  card: Card,
  quantity: number,
  sourceContext: string,
  factionNameKey: string,
  setupPosition?: string,
): ReviewRowDraft {
  const objectId = getBaseCardId(card.id);
  const previewRef = getSummonerWarsCardPreviewRef(objectId);
  const objectType = getReviewObjectType(card);
  const base = {
    rowId: `summonerwars:${card.faction}:${objectType}:${objectId}`,
    objectId,
    objectType,
    cardType: card.cardType,
    factionId: card.faction,
    factionNameKey,
    name: card.name,
    quantity,
    cost: 'cost' in card ? card.cost : undefined,
    deckSymbols: [...card.deckSymbols],
    spriteAtlas: card.spriteAtlas,
    spriteIndex: card.spriteIndex,
    previewRef,
    materialStatus: previewRef ? 'ready' as const : 'missing-sprite' as const,
    sourceContexts: new Set([sourceContext]),
    setupPositions: new Set(setupPosition ? [setupPosition] : []),
    fieldPaths: getReviewFieldPaths(objectId),
  };

  if (card.cardType === 'unit') {
    return {
      ...base,
      unitClass: card.unitClass,
      attack: card.strength,
      life: card.life,
      attackType: card.attackType,
      attackRange: card.attackRange,
      abilityIds: [...(card.abilities ?? [])],
    };
  }

  if (card.cardType === 'structure') {
    return {
      ...base,
      life: card.life,
      isGate: card.isGate,
      isStartingGate: card.isStartingGate,
      abilityIds: [],
    };
  }

  return {
    ...base,
    playPhase: card.playPhase,
    eventType: card.eventType,
    isActive: card.isActive,
    charges: card.charges,
    targetUnitId: card.targetUnitId,
    entanglementTargets: card.entanglementTargets,
    abilityIds: [],
    effectText: card.effect,
  };
}

function addCardRow(
  rowsById: Map<string, ReviewRowDraft>,
  card: Card,
  quantity: number,
  sourceContext: string,
  factionNameKey: string,
  setupPosition?: string,
) {
  const objectId = getBaseCardId(card.id);
  const existing = rowsById.get(objectId);
  if (existing) {
    existing.quantity += quantity;
    existing.sourceContexts.add(sourceContext);
    if (setupPosition) {
      existing.setupPositions.add(setupPosition);
    }
    return;
  }
  rowsById.set(objectId, createReviewRowDraft(card, quantity, sourceContext, factionNameKey, setupPosition));
}

function compareRows(a: SummonerWarsConfigReviewRow, b: SummonerWarsConfigReviewRow): number {
  const factionOrder = FACTION_CATALOG.findIndex((faction) => faction.id === a.factionId)
    - FACTION_CATALOG.findIndex((faction) => faction.id === b.factionId);
  if (factionOrder !== 0) return factionOrder;

  const typeOrder = CARD_TYPE_ORDER[a.objectType] - CARD_TYPE_ORDER[b.objectType];
  if (typeOrder !== 0) return typeOrder;

  return a.name.localeCompare(b.name, 'zh-CN');
}

export function buildSummonerWarsConfigReviewTable(): SummonerWarsConfigReviewTable {
  const rowsById = new Map<string, ReviewRowDraft>();

  for (const faction of FACTION_CATALOG) {
    if (faction.selectable === false) continue;

    const deckData = createDeckByFactionId(faction.id);
    const canonicalMap = buildCanonicalMap([
      deckData.summoner,
      deckData.startingGate,
      ...deckData.startingUnits.map((entry) => entry.unit),
      ...deckData.deck,
    ]);

    addCardRow(
      rowsById,
      getCanonicalCard(deckData.summoner, canonicalMap),
      1,
      sourceLabel('summoner'),
      faction.nameKey,
      setupPositionToken('summoner', deckData.summonerPosition),
    );
    addCardRow(
      rowsById,
      getCanonicalCard(deckData.startingGate, canonicalMap),
      1,
      sourceLabel('startingGate'),
      faction.nameKey,
      setupPositionToken('startingGate', deckData.startingGatePosition),
    );

    deckData.startingUnits.forEach((entry, index) => {
      addCardRow(
        rowsById,
        getCanonicalCard(entry.unit, canonicalMap),
        1,
        sourceLabel('startingUnit'),
        faction.nameKey,
        setupPositionToken('startingUnit', entry.position, index + 1),
      );
    });

    deckData.deck.forEach((card) => {
      addCardRow(
        rowsById,
        getCanonicalCard(card, canonicalMap),
        1,
        sourceLabel('deck'),
        faction.nameKey,
      );
    });
  }

  const rows = Array.from(rowsById.values())
    .map((row) => ({
      ...row,
      setupPositions: Array.from(row.setupPositions),
      sourceContexts: Array.from(row.sourceContexts),
    }))
    .sort(compareRows);

  return {
    tableId: SUMMONER_WARS_CONFIG_REVIEW_TABLE_ID,
    gameId: 'summonerwars',
    configVersion: SUMMONER_WARS_CONFIG_REVIEW_VERSION,
    rows,
  };
}
