import type { CardPreviewRef } from '../../../core';
import {
  getAllBaseDefs,
  getAllCardDefs,
} from '../data/cards';
import {
  getSmashUpFactionImplementationStatus,
} from '../domain/ids';
import type {
  ActionCardDef,
  BaseCardDef,
  CardDef,
  FusionCardDef,
  PlayConstraint,
  SmashUpActivatableAbility,
} from '../domain/types';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { FACTION_METADATA, type FactionMeta } from '../ui/factionMeta';

export const SMASHUP_CONFIG_REVIEW_VERSION = 'legacy-ts-config-v1';
export const SMASHUP_CONFIG_REVIEW_TABLE_ID = 'smashup:legacy-config-review';

export type SmashUpConfigReviewType =
  | 'faction'
  | 'minion'
  | 'action'
  | 'fusion'
  | 'titan'
  | 'base';

export type SmashUpConfigReviewMaterialStatus =
  | 'ready'
  | 'missing-preview'
  | 'missing-atlas';

export type SmashUpConfigReviewImplementationStatus =
  | 'configured'
  | 'in_progress';

export const SMASHUP_CONFIG_REVIEW_FIELD_KEYS = [
  'name',
  'englishName',
  'faction',
  'nameKey',
  'descriptionKey',
  'color',
  'locales',
  'expansion',
  'implementationStatus',
  'cardType',
  'subtype',
  'quantity',
  'power',
  'minionPower',
  'abilityTags',
  'activationWindows',
  'playRequirements',
  'breakpoint',
  'vpAwards',
  'baseRestrictions',
  'previewStatus',
] as const;

export type SmashUpConfigReviewFieldKey = typeof SMASHUP_CONFIG_REVIEW_FIELD_KEYS[number];

export const SMASHUP_CONFIG_REVIEW_COLUMN_KEYS = [
  'image',
  ...SMASHUP_CONFIG_REVIEW_FIELD_KEYS,
] as const;

export type SmashUpConfigReviewColumnKey = typeof SMASHUP_CONFIG_REVIEW_COLUMN_KEYS[number];

export type SmashUpConfigReviewFieldValueKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string-array';

export type SmashUpConfigReviewFieldApplicability =
  | 'all'
  | 'faction'
  | 'card'
  | 'base'
  | 'minion-or-fusion'
  | 'action-or-fusion'
  | 'card-or-base';

export interface SmashUpConfigReviewFieldDefinition {
  key: SmashUpConfigReviewFieldKey;
  valueKind: SmashUpConfigReviewFieldValueKind;
  applicability: SmashUpConfigReviewFieldApplicability;
  editable: boolean;
  requiredForAudit: boolean;
  meaning: string;
  evidence: string[];
  getValue: (row: SmashUpConfigReviewRow) => unknown;
}

export type SmashUpConfigReviewFieldPaths = Record<SmashUpConfigReviewFieldKey, string> & {
  previewRef: string;
};

export interface SmashUpConfigReviewRow {
  rowId: string;
  objectId: string;
  objectType: SmashUpConfigReviewType;
  groupName: string;
  displayName: string;
  name: string;
  englishName?: string;
  factionId?: string;
  factionNameKey?: string;
  nameKey?: string;
  descriptionKey?: string;
  color?: string;
  locales: string[];
  expansion?: string;
  implementationStatus: SmashUpConfigReviewImplementationStatus;
  cardType?: CardDef['type'];
  subtype?: ActionCardDef['subtype'] | FusionCardDef['actionSubtype'];
  quantity?: number;
  power?: number;
  minionPower?: number;
  abilityTags: string[];
  activationWindows: string[];
  playRequirements: string[];
  breakpoint?: number;
  vpAwards?: string[];
  baseRestrictions: string[];
  previewRef: CardPreviewRef | null;
  previewImage?: string;
  materialStatus: SmashUpConfigReviewMaterialStatus;
  sourceContexts: string[];
  fieldPaths: SmashUpConfigReviewFieldPaths;
  searchText: string;
}

export interface SmashUpConfigReviewTable {
  tableId: string;
  gameId: 'smashup';
  configVersion: string;
  rows: SmashUpConfigReviewRow[];
}

const FIELD_EVIDENCE = {
  cardRegistry: 'src/games/smashup/data/cards.ts',
  factionMetadata: 'src/games/smashup/ui/factionMeta.ts',
  factionIds: 'src/games/smashup/domain/ids.ts',
  cardTypes: 'src/games/smashup/domain/types.ts',
  atlasCatalog: 'src/games/smashup/domain/atlasCatalog.ts',
  zhLocale: 'public/locales/zh-CN/game-smashup.json',
  enLocale: 'public/locales/en/game-smashup.json',
  assetManifest: 'public/assets/i18n/zh-CN/smashup/assets-manifest.json',
} as const;

const CARD_TYPE_ORDER: Record<SmashUpConfigReviewType, number> = {
  faction: 0,
  minion: 1,
  fusion: 2,
  action: 3,
  titan: 4,
  base: 5,
};

function unique(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function isCardRow(row: SmashUpConfigReviewRow): boolean {
  return row.objectType === 'minion'
    || row.objectType === 'action'
    || row.objectType === 'fusion'
    || row.objectType === 'titan';
}

function isAtlasPreviewRef(previewRef: CardPreviewRef | undefined): previewRef is Extract<CardPreviewRef, { type: 'atlas' }> {
  return previewRef?.type === 'atlas';
}

function getPreviewImage(previewRef: CardPreviewRef | undefined): string | undefined {
  if (!previewRef) return undefined;
  if (previewRef.type === 'image') return previewRef.src;
  if (isAtlasPreviewRef(previewRef)) return getSmashUpAtlasImageById(previewRef.atlasId);
  return undefined;
}

function getMaterialStatus(previewRef: CardPreviewRef | undefined): SmashUpConfigReviewMaterialStatus {
  if (!previewRef) return 'missing-preview';
  if (isAtlasPreviewRef(previewRef) && !getSmashUpAtlasImageById(previewRef.atlasId)) {
    return 'missing-atlas';
  }
  return 'ready';
}

function getFactionImplementationStatus(factionId: string | undefined): SmashUpConfigReviewImplementationStatus {
  return getSmashUpFactionImplementationStatus(factionId) === 'in_progress'
    ? 'in_progress'
    : 'configured';
}

function getFactionNameKey(factionId: string | undefined): string | undefined {
  if (!factionId) return undefined;
  return FACTION_METADATA.find((faction) => faction.id === factionId)?.nameKey
    ?? `factions.${factionId}.name`;
}

function getObjectRoot(objectType: SmashUpConfigReviewType, objectId: string): string {
  if (objectType === 'faction') return `legacy.smashup.factionMetadata.${objectId}`;
  if (objectType === 'base') return `legacy.smashup.baseRegistry.${objectId}`;
  return `legacy.smashup.cardRegistry.${objectId}`;
}

function fieldPathFor(root: string, fieldKey: SmashUpConfigReviewFieldKey): string {
  if (fieldKey === 'quantity') return `${root}.count`;
  if (fieldKey === 'previewStatus') return `${root}.previewRef`;
  return `${root}.${fieldKey}`;
}

function buildFieldPaths(
  objectType: SmashUpConfigReviewType,
  objectId: string,
  overrides: Partial<SmashUpConfigReviewFieldPaths> = {},
): SmashUpConfigReviewFieldPaths {
  const root = getObjectRoot(objectType, objectId);
  return {
    ...Object.fromEntries(
      SMASHUP_CONFIG_REVIEW_FIELD_KEYS.map((fieldKey) => [fieldKey, fieldPathFor(root, fieldKey)]),
    ),
    previewRef: `${root}.previewRef`,
    ...overrides,
  } as SmashUpConfigReviewFieldPaths;
}

function formatPlayConstraint(constraint: PlayConstraint | undefined): string | undefined {
  if (!constraint) return undefined;
  if (typeof constraint === 'string') return constraint;
  if (constraint.type === 'requireOwnPower') return `requireOwnPower:${constraint.minPower}`;
  return constraint.type;
}

function formatActivation(activation: SmashUpActivatableAbility): string {
  return [
    activation.kind,
    activation.zone,
    activation.window,
    activation.sourceScope,
    activation.useRequirement ? `requires:${activation.useRequirement}` : undefined,
  ].filter(Boolean).join(':');
}

function getCardAbilityTags(card: CardDef): string[] {
  if (card.type === 'fusion') {
    return unique([
      ...(card.minionAbilityTags ?? []),
      ...(card.actionAbilityTags ?? []),
    ]);
  }
  return [...(card.abilityTags ?? [])];
}

function getCardActivationWindows(card: CardDef): string[] {
  if (card.type === 'fusion') {
    return unique([
      ...(card.minionActivatableAbilities ?? []).map(formatActivation),
      ...(card.actionActivatableAbilities ?? []).map(formatActivation),
    ]);
  }
  return [...(card.activatableAbilities ?? []).map(formatActivation)];
}

function getCardPlayRequirements(card: CardDef): string[] {
  if (card.type === 'minion') {
    return unique([
      formatPlayConstraint(card.playConstraint),
      card.beforeScoringPlayable ? 'beforeScoringPlayable' : undefined,
      card.playAsAction ? 'playAsAction' : undefined,
    ]);
  }
  if (card.type === 'action') {
    return unique([
      formatPlayConstraint(card.playConstraint),
      card.playNeedsBase ? 'playNeedsBase' : undefined,
      card.playNeedsMinion ? `playNeedsMinion:${card.playTargetMinionController ?? 'any'}` : undefined,
      card.specialNeedsBase ? 'specialNeedsBase' : undefined,
      card.specialTiming ? `specialTiming:${card.specialTiming}` : undefined,
      card.responseWindowTiming ? `responseWindow:${card.responseWindowTiming}` : undefined,
      card.responseWindowNeedsBase ? 'responseWindowNeedsBase' : undefined,
      card.ongoingTarget ? `ongoingTarget:${card.ongoingTarget}` : undefined,
      card.lifecycle ? `lifecycle:${card.lifecycle.expires.timing}:${card.lifecycle.expires.actor}:${card.lifecycle.expires.effect}${card.lifecycle.expires.destination ? `:destination=${card.lifecycle.expires.destination}` : ''}${card.lifecycle.expires.condition?.talentUsed !== undefined ? `:talentUsed=${card.lifecycle.expires.condition.talentUsed}` : ''}` : undefined,
    ]);
  }
  if (card.type === 'fusion') {
    return unique([
      formatPlayConstraint(card.minionPlayConstraint),
      formatPlayConstraint(card.actionPlayConstraint),
      card.minionBeforeScoringPlayable ? 'minionBeforeScoringPlayable' : undefined,
      card.actionPlayNeedsBase ? 'actionPlayNeedsBase' : undefined,
      card.actionPlayNeedsMinion ? `actionPlayNeedsMinion:${card.actionPlayTargetMinionController ?? 'any'}` : undefined,
      card.actionSpecialNeedsBase ? 'actionSpecialNeedsBase' : undefined,
      card.actionSpecialTiming ? `actionSpecialTiming:${card.actionSpecialTiming}` : undefined,
      card.actionResponseWindowTiming ? `actionResponseWindow:${card.actionResponseWindowTiming}` : undefined,
      card.actionResponseWindowNeedsBase ? 'actionResponseWindowNeedsBase' : undefined,
      card.actionOngoingTarget ? `actionOngoingTarget:${card.actionOngoingTarget}` : undefined,
    ]);
  }
  return unique([
    card.summonMode ? `summonMode:${card.summonMode}` : undefined,
    ...(card.playAsKinds ?? []).map((kind) => `playAs:${kind}`),
  ]);
}

function getCardPower(card: CardDef): number | undefined {
  if (card.type === 'minion') return card.power;
  if (card.type === 'fusion') return card.minionPower;
  return undefined;
}

function getEnglishName(def: CardDef | BaseCardDef): string | undefined {
  return 'nameEn' in def ? def.nameEn : undefined;
}

function getActionSubtype(card: CardDef): ActionCardDef['subtype'] | FusionCardDef['actionSubtype'] | undefined {
  if (card.type === 'action') return card.subtype;
  if (card.type === 'fusion') return card.actionSubtype;
  return undefined;
}

function formatBaseRestrictions(base: BaseCardDef): string[] {
  return (base.restrictions ?? []).map((restriction) => {
    const conditionParts = unique([
      restriction.condition?.maxPower !== undefined ? `maxPower<=${restriction.condition.maxPower}` : undefined,
      restriction.condition?.extraPlayMinionPowerMax !== undefined
        ? `extraPlayMinionPowerMax<=${restriction.condition.extraPlayMinionPowerMax}`
        : undefined,
      restriction.condition?.minionPlayLimitPerTurn !== undefined
        ? `minionPlayLimitPerTurn=${restriction.condition.minionPlayLimitPerTurn}`
        : undefined,
      restriction.condition?.sameNameAlreadyAtBase ? 'sameNameAlreadyAtBase' : undefined,
    ]);
    return conditionParts.length > 0
      ? `${restriction.type}:${conditionParts.join(',')}`
      : restriction.type;
  });
}

function buildSearchText(row: Omit<SmashUpConfigReviewRow, 'searchText'>): string {
  return [
    row.objectType,
    row.objectId,
    row.groupName,
    row.displayName,
    row.englishName,
    row.factionId,
    row.factionNameKey,
    row.nameKey,
    row.descriptionKey,
    row.cardType,
    row.subtype,
    row.implementationStatus,
    row.materialStatus,
    ...row.locales,
    ...row.abilityTags,
    ...row.activationWindows,
    ...row.playRequirements,
    ...row.baseRestrictions,
    ...row.sourceContexts,
  ].filter((value): value is string => Boolean(value)).join(' ').toLocaleLowerCase();
}

function finalizeRow(row: Omit<SmashUpConfigReviewRow, 'searchText'>): SmashUpConfigReviewRow {
  return {
    ...row,
    searchText: buildSearchText(row),
  };
}

function buildFactionRow(faction: FactionMeta): SmashUpConfigReviewRow {
  const implementationStatus = getFactionImplementationStatus(faction.id);
  return finalizeRow({
    rowId: `smashup:faction:${faction.id}`,
    objectId: faction.id,
    objectType: 'faction',
    groupName: '派系',
    displayName: faction.nameKey,
    name: faction.nameKey,
    factionId: faction.id,
    factionNameKey: faction.nameKey,
    nameKey: faction.nameKey,
    descriptionKey: faction.descriptionKey,
    color: faction.color,
    locales: [...(faction.locales ?? [])],
    expansion: faction.expansion,
    implementationStatus,
    abilityTags: [],
    activationWindows: [],
    playRequirements: [],
    baseRestrictions: [],
    previewRef: null,
    materialStatus: 'missing-preview',
    sourceContexts: [
      FIELD_EVIDENCE.factionMetadata,
      FIELD_EVIDENCE.factionIds,
      FIELD_EVIDENCE.zhLocale,
      FIELD_EVIDENCE.enLocale,
    ],
    fieldPaths: buildFieldPaths('faction', faction.id, {
      implementationStatus: `legacy.smashup.domain.ids.SMASHUP_FACTION_IMPLEMENTATION_STATUS.${faction.id}`,
    }),
  });
}

function buildCardRow(card: CardDef): SmashUpConfigReviewRow {
  const objectType = card.type;
  const previewImage = getPreviewImage(card.previewRef);
  const cardRoot = `legacy.smashup.cardRegistry.${card.id}`;
  return finalizeRow({
    rowId: `smashup:${objectType}:${card.id}`,
    objectId: card.id,
    objectType,
    groupName: getFactionNameKey(card.faction) ?? card.faction,
    displayName: card.name,
    name: card.name,
    englishName: getEnglishName(card),
    factionId: card.faction,
    factionNameKey: getFactionNameKey(card.faction),
    implementationStatus: getFactionImplementationStatus(card.faction),
    cardType: card.type,
    subtype: getActionSubtype(card),
    quantity: card.type === 'titan' ? 1 : card.count,
    power: getCardPower(card),
    minionPower: card.type === 'fusion'
      ? card.minionPower
      : card.type === 'minion'
        ? card.power
        : undefined,
    abilityTags: getCardAbilityTags(card),
    activationWindows: getCardActivationWindows(card),
    playRequirements: getCardPlayRequirements(card),
    locales: [],
    baseRestrictions: [],
    previewRef: card.previewRef ?? null,
    previewImage,
    materialStatus: getMaterialStatus(card.previewRef),
    sourceContexts: [
      FIELD_EVIDENCE.cardRegistry,
      FIELD_EVIDENCE.cardTypes,
      FIELD_EVIDENCE.atlasCatalog,
      FIELD_EVIDENCE.zhLocale,
      FIELD_EVIDENCE.enLocale,
      FIELD_EVIDENCE.assetManifest,
    ],
    fieldPaths: buildFieldPaths(objectType, card.id, {
      cardType: `${cardRoot}.type`,
      quantity: card.type === 'titan' ? `${cardRoot}.implicitTitanCount` : `${cardRoot}.count`,
      power: card.type === 'fusion' ? `${cardRoot}.minionPower` : `${cardRoot}.power`,
      minionPower: card.type === 'fusion' ? `${cardRoot}.minionPower` : `${cardRoot}.power`,
      subtype: card.type === 'fusion' ? `${cardRoot}.actionSubtype` : `${cardRoot}.subtype`,
      previewRef: `${cardRoot}.previewRef`,
      previewStatus: `${cardRoot}.previewRef`,
      implementationStatus: `legacy.smashup.domain.ids.SMASHUP_FACTION_IMPLEMENTATION_STATUS.${card.faction}`,
    }),
  });
}

function buildBaseRow(base: BaseCardDef): SmashUpConfigReviewRow {
  const previewImage = getPreviewImage(base.previewRef);
  return finalizeRow({
    rowId: `smashup:base:${base.id}`,
    objectId: base.id,
    objectType: 'base',
    groupName: getFactionNameKey(base.faction) ?? base.faction ?? '公共基地',
    displayName: base.name,
    name: base.name,
    englishName: getEnglishName(base),
    factionId: base.faction,
    factionNameKey: getFactionNameKey(base.faction),
    implementationStatus: getFactionImplementationStatus(base.faction),
    quantity: 1,
    abilityTags: [],
    activationWindows: [],
    playRequirements: unique([
      base.replaceOnSetup ? 'replaceOnSetup' : undefined,
      base.allowMultipleTitans ? 'allowMultipleTitans' : undefined,
      base.monsterCount !== undefined ? `monsterCount:${base.monsterCount}` : undefined,
      base.minionPowerBonus !== undefined ? `minionPowerBonus:${base.minionPowerBonus}` : undefined,
    ]),
    breakpoint: base.breakpoint,
    vpAwards: base.vpAwards.map(String),
    baseRestrictions: formatBaseRestrictions(base),
    locales: [],
    previewRef: base.previewRef ?? null,
    previewImage,
    materialStatus: getMaterialStatus(base.previewRef),
    sourceContexts: [
      FIELD_EVIDENCE.cardRegistry,
      FIELD_EVIDENCE.cardTypes,
      FIELD_EVIDENCE.atlasCatalog,
      FIELD_EVIDENCE.zhLocale,
      FIELD_EVIDENCE.enLocale,
      FIELD_EVIDENCE.assetManifest,
    ],
    fieldPaths: buildFieldPaths('base', base.id, {
      previewRef: `legacy.smashup.baseRegistry.${base.id}.previewRef`,
      previewStatus: `legacy.smashup.baseRegistry.${base.id}.previewRef`,
      implementationStatus: `legacy.smashup.domain.ids.SMASHUP_FACTION_IMPLEMENTATION_STATUS.${base.faction ?? 'unassigned'}`,
    }),
  });
}

export const SMASHUP_CONFIG_REVIEW_FIELD_DEFINITIONS: readonly SmashUpConfigReviewFieldDefinition[] = [
  {
    key: 'name',
    valueKind: 'string',
    applicability: 'all',
    editable: true,
    requiredForAudit: true,
    meaning: '玩家可见对象名称；卡牌和基地来自运行时注册表，派系来自派系元数据',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.factionMetadata, FIELD_EVIDENCE.zhLocale],
    getValue: (row) => row.name,
  },
  {
    key: 'englishName',
    valueKind: 'string',
    applicability: 'card-or-base',
    editable: true,
    requiredForAudit: true,
    meaning: '英文卡名或基地名，用于核对英文素材和本地化',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.enLocale],
    getValue: (row) => row.englishName,
  },
  {
    key: 'faction',
    valueKind: 'string',
    applicability: 'all',
    editable: true,
    requiredForAudit: true,
    meaning: '对象归属派系，决定选派系、牌库构筑和基地池',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.factionIds, FIELD_EVIDENCE.factionMetadata],
    getValue: (row) => row.factionId,
  },
  {
    key: 'nameKey',
    valueKind: 'string',
    applicability: 'faction',
    editable: true,
    requiredForAudit: true,
    meaning: '派系名称本地化 key',
    evidence: [FIELD_EVIDENCE.factionMetadata, FIELD_EVIDENCE.zhLocale, FIELD_EVIDENCE.enLocale],
    getValue: (row) => row.nameKey,
  },
  {
    key: 'descriptionKey',
    valueKind: 'string',
    applicability: 'faction',
    editable: true,
    requiredForAudit: true,
    meaning: '派系描述本地化 key',
    evidence: [FIELD_EVIDENCE.factionMetadata, FIELD_EVIDENCE.zhLocale, FIELD_EVIDENCE.enLocale],
    getValue: (row) => row.descriptionKey,
  },
  {
    key: 'color',
    valueKind: 'string',
    applicability: 'faction',
    editable: true,
    requiredForAudit: true,
    meaning: '派系 UI 主题色',
    evidence: [FIELD_EVIDENCE.factionMetadata],
    getValue: (row) => row.color,
  },
  {
    key: 'locales',
    valueKind: 'string-array',
    applicability: 'faction',
    editable: true,
    requiredForAudit: true,
    meaning: '派系在哪些语言中显示；空数组表示全语言显示',
    evidence: [FIELD_EVIDENCE.factionMetadata],
    getValue: (row) => row.locales,
  },
  {
    key: 'expansion',
    valueKind: 'string',
    applicability: 'faction',
    editable: true,
    requiredForAudit: true,
    meaning: '派系扩展开关；DIY 派系由这里控制可见性',
    evidence: [FIELD_EVIDENCE.factionMetadata],
    getValue: (row) => row.expansion,
  },
  {
    key: 'implementationStatus',
    valueKind: 'string',
    applicability: 'all',
    editable: false,
    requiredForAudit: true,
    meaning: '派系实现状态；来自 domain/ids，不由 UI 元数据重复维护',
    evidence: [FIELD_EVIDENCE.factionIds, FIELD_EVIDENCE.factionMetadata],
    getValue: (row) => row.implementationStatus,
  },
  {
    key: 'cardType',
    valueKind: 'string',
    applicability: 'card',
    editable: true,
    requiredForAudit: true,
    meaning: '卡牌大类，决定运行时按随从、行动、融合或泰坦处理',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.cardType,
  },
  {
    key: 'subtype',
    valueKind: 'string',
    applicability: 'action-or-fusion',
    editable: true,
    requiredForAudit: true,
    meaning: '行动面类型：普通、持续或特殊',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.subtype,
  },
  {
    key: 'quantity',
    valueKind: 'number',
    applicability: 'card-or-base',
    editable: true,
    requiredForAudit: true,
    meaning: '牌库中卡牌张数；基地表中固定为 1，用于表格统一显示',
    evidence: [FIELD_EVIDENCE.cardRegistry],
    getValue: (row) => row.quantity,
  },
  {
    key: 'power',
    valueKind: 'number',
    applicability: 'minion-or-fusion',
    editable: true,
    requiredForAudit: true,
    meaning: '随从印制力量；融合牌为随从面力量',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.power,
  },
  {
    key: 'minionPower',
    valueKind: 'number',
    applicability: 'minion-or-fusion',
    editable: true,
    requiredForAudit: true,
    meaning: '融合牌随从面力量；普通随从同 power 字段核对',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.minionPower,
  },
  {
    key: 'abilityTags',
    valueKind: 'string-array',
    applicability: 'card',
    editable: true,
    requiredForAudit: true,
    meaning: '静态能力标签，决定打出、响应、持续和天赋入口的运行时分支',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.abilityTags,
  },
  {
    key: 'activationWindows',
    valueKind: 'string-array',
    applicability: 'card',
    editable: true,
    requiredForAudit: true,
    meaning: '显式可点击能力入口和时机',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.activationWindows,
  },
  {
    key: 'playRequirements',
    valueKind: 'string-array',
    applicability: 'card-or-base',
    editable: true,
    requiredForAudit: true,
    meaning: '卡牌打出限制、响应窗口或基地额外设置等运行时会读取的静态条件',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.playRequirements,
  },
  {
    key: 'breakpoint',
    valueKind: 'number',
    applicability: 'base',
    editable: true,
    requiredForAudit: true,
    meaning: '基地记分临界点',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.breakpoint,
  },
  {
    key: 'vpAwards',
    valueKind: 'string-array',
    applicability: 'base',
    editable: true,
    requiredForAudit: true,
    meaning: '基地前三名 VP 奖励',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.vpAwards,
  },
  {
    key: 'baseRestrictions',
    valueKind: 'string-array',
    applicability: 'base',
    editable: true,
    requiredForAudit: true,
    meaning: '基地限制规则，例如禁止打出特定随从或行动',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.cardTypes],
    getValue: (row) => row.baseRestrictions,
  },
  {
    key: 'previewStatus',
    valueKind: 'string',
    applicability: 'card-or-base',
    editable: false,
    requiredForAudit: true,
    meaning: '卡图或基地图是否能从现有预览引用和图集定义解析',
    evidence: [FIELD_EVIDENCE.cardRegistry, FIELD_EVIDENCE.atlasCatalog, FIELD_EVIDENCE.assetManifest],
    getValue: (row) => row.materialStatus,
  },
];

const FIELD_DEFINITION_BY_KEY = new Map(
  SMASHUP_CONFIG_REVIEW_FIELD_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function getSmashUpConfigReviewFieldDefinition(
  fieldKey: SmashUpConfigReviewFieldKey,
): SmashUpConfigReviewFieldDefinition {
  const definition = FIELD_DEFINITION_BY_KEY.get(fieldKey);
  if (!definition) {
    throw new Error(`unknown SmashUp config review field "${fieldKey}"`);
  }
  return definition;
}

export function getSmashUpConfigReviewCellValue(
  row: SmashUpConfigReviewRow,
  fieldKey: SmashUpConfigReviewFieldKey,
): unknown {
  return getSmashUpConfigReviewFieldDefinition(fieldKey).getValue(row);
}

export function isSmashUpConfigReviewFieldApplicable(
  row: SmashUpConfigReviewRow,
  fieldKey: SmashUpConfigReviewFieldKey,
): boolean {
  const applicability = getSmashUpConfigReviewFieldDefinition(fieldKey).applicability;
  switch (applicability) {
    case 'faction':
      return row.objectType === 'faction';
    case 'card':
      return isCardRow(row);
    case 'base':
      return row.objectType === 'base';
    case 'minion-or-fusion':
      return row.objectType === 'minion' || row.objectType === 'fusion';
    case 'action-or-fusion':
      return row.objectType === 'action' || row.objectType === 'fusion';
    case 'card-or-base':
      return isCardRow(row) || row.objectType === 'base';
    case 'all':
    default:
      return true;
  }
}

function compareRows(left: SmashUpConfigReviewRow, right: SmashUpConfigReviewRow): number {
  const groupCompare = left.groupName.localeCompare(right.groupName, 'zh-CN');
  if (groupCompare !== 0) return groupCompare;

  const typeCompare = CARD_TYPE_ORDER[left.objectType] - CARD_TYPE_ORDER[right.objectType];
  if (typeCompare !== 0) return typeCompare;

  return left.objectId.localeCompare(right.objectId, 'zh-CN');
}

export function buildSmashUpConfigReviewTable(): SmashUpConfigReviewTable {
  const rows = [
    ...FACTION_METADATA.map(buildFactionRow),
    ...getAllCardDefs().map(buildCardRow),
    ...getAllBaseDefs().map(buildBaseRow),
  ].sort(compareRows);

  return {
    tableId: SMASHUP_CONFIG_REVIEW_TABLE_ID,
    gameId: 'smashup',
    configVersion: SMASHUP_CONFIG_REVIEW_VERSION,
    rows,
  };
}
