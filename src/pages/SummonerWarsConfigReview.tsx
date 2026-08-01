import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImageOff, Maximize2, MoveHorizontal, PencilLine, Search, Send, Trash2 } from 'lucide-react';
import { CardPreview } from '../components/common/media/CardPreview';
import { MagnifyOverlay } from '../components/common/overlays/MagnifyOverlay';
import { FeedbackModal } from '../components/system/FeedbackModal';
import type { FeedbackConfigProposal } from '../lib/feedback/feedbackPayload';
import {
  buildSummonerWarsConfigReviewTable,
  getSummonerWarsConfigReviewCellValue,
  getSummonerWarsConfigReviewFieldDefinition,
  isSummonerWarsConfigReviewFieldApplicable,
  SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS,
  SUMMONER_WARS_CONFIG_REVIEW_TABLE_ID,
  type SummonerWarsConfigReviewFieldKey,
  type SummonerWarsConfigReviewRow,
  type SummonerWarsConfigReviewType,
} from '../games/summonerwars/config/configReviewAdapter';
import { FACTION_CATALOG } from '../games/summonerwars/config/factions';
import { initSpriteAtlases } from '../games/summonerwars/ui/cardAtlas';

const TYPE_FILTERS: Array<'all' | SummonerWarsConfigReviewType> = [
  'all',
  'summoner',
  'champion',
  'common',
  'event',
  'gate',
  'structure',
];

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type PageSize = typeof PAGE_SIZE_OPTIONS[number];

const CONFIG_REVIEW_ENUM_VALUES: Partial<Record<SummonerWarsConfigReviewFieldKey, readonly string[]>> = {
  cardType: ['unit', 'event', 'structure'],
  unitClass: ['summoner', 'champion', 'common'],
  attackType: ['melee', 'ranged'],
  playPhase: ['factionSelect', 'summon', 'move', 'build', 'attack', 'magic', 'draw', 'any'],
  eventType: ['legendary', 'common'],
  spriteAtlas: ['hero', 'cards', 'portal'],
  deckSymbols: [
    'double_axe',
    'flame',
    'moon',
    'eye',
    'wave',
    'shield',
    'diamond',
    'claw',
    'mask',
    'snowflake',
    'droplet',
    'star',
    'rhombus',
    'spore',
    'mycelium',
    'ember',
    'phoenix',
    'tundra',
    'council',
  ],
};

const BOOLEAN_FIELD_KEYS = new Set<SummonerWarsConfigReviewFieldKey>([
  'isActive',
  'isGate',
  'isStartingGate',
]);

interface PendingConfigEdit {
  row: SummonerWarsConfigReviewRow;
  fieldKey: SummonerWarsConfigReviewFieldKey;
  rawValue: string;
  parsedValue: unknown;
  error?: string;
}

type TranslateConfigValue = (key: string, options?: Record<string, unknown>) => string;

function translateConfigValue(
  translate: TranslateConfigValue,
  key: string,
  defaultValue: string,
  options: Record<string, unknown> = {},
): string {
  return translate(key, { ...options, defaultValue });
}

function getEditKey(row: SummonerWarsConfigReviewRow, fieldKey: SummonerWarsConfigReviewFieldKey): string {
  return `${row.rowId}:${fieldKey}`;
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function formatDisplayList(values: unknown[], formatter: (value: unknown) => string): string {
  return values.map(formatter).filter(Boolean).join('、');
}

function formatReferencedCardName(value: unknown, rowNameByObjectId: Map<string, string>, translate: TranslateConfigValue): string {
  const objectId = String(value);
  return rowNameByObjectId.get(objectId)
    ?? translateConfigValue(translate, 'configReview.values.referenceFallback', '未知对象');
}

function formatSourceContext(value: unknown, translate: TranslateConfigValue): string {
  const text = String(value);
  if (text === '召唤师') {
    return translateConfigValue(translate, 'configReview.values.sourceContexts.summoner', '召唤师');
  }
  if (text === '起始城门') {
    return translateConfigValue(translate, 'configReview.values.sourceContexts.startingGate', '起始城门');
  }
  if (text === '起始单位') {
    return translateConfigValue(translate, 'configReview.values.sourceContexts.startingUnit', '起始单位');
  }
  if (text === '抽牌堆') {
    return translateConfigValue(translate, 'configReview.values.sourceContexts.deck', '抽牌堆');
  }

  const startingGateMatch = text.match(/^起始城门: (\d+),(\d+)$/);
  if (startingGateMatch) {
    return translateConfigValue(translate, 'configReview.values.sourceContexts.startingGatePosition', '起始城门：第 {{row}} 行第 {{col}} 列', {
      row: startingGateMatch[1],
      col: startingGateMatch[2],
    });
  }

  const startingUnitMatch = text.match(/^起始单位: (\d+)@(\d+),(\d+)$/);
  if (startingUnitMatch) {
    return translateConfigValue(translate, 'configReview.values.sourceContexts.startingUnitPosition', '起始单位：第 {{index}} 张，第 {{row}} 行第 {{col}} 列', {
      index: startingUnitMatch[1],
      row: startingUnitMatch[2],
      col: startingUnitMatch[3],
    });
  }

  return text;
}

function formatSetupPosition(value: unknown, translate: TranslateConfigValue): string {
  const text = String(value);

  const summonerMatch = text.match(/^summoner@(\d+):(\d+)$/);
  if (summonerMatch) {
    return translateConfigValue(translate, 'configReview.values.setupPositions.summoner', '召唤师：第 {{row}} 行第 {{col}} 列', {
      row: summonerMatch[1],
      col: summonerMatch[2],
    });
  }

  const startingGateMatch = text.match(/^startingGate@(\d+):(\d+)$/);
  if (startingGateMatch) {
    return translateConfigValue(translate, 'configReview.values.setupPositions.startingGate', '起始城门：第 {{row}} 行第 {{col}} 列', {
      row: startingGateMatch[1],
      col: startingGateMatch[2],
    });
  }

  const startingUnitMatch = text.match(/^startingUnit#(\d+)@(\d+):(\d+)$/);
  if (startingUnitMatch) {
    return translateConfigValue(translate, 'configReview.values.setupPositions.startingUnit', '起始单位：第 {{index}} 张，第 {{row}} 行第 {{col}} 列', {
      index: startingUnitMatch[1],
      row: startingUnitMatch[2],
      col: startingUnitMatch[3],
    });
  }

  return text;
}

function formatCellDisplayValue(
  row: SummonerWarsConfigReviewRow,
  fieldKey: SummonerWarsConfigReviewFieldKey,
  value: unknown,
  translate: TranslateConfigValue,
  rowNameByObjectId: Map<string, string>,
): string {
  if (value === undefined || value === null) return '';

  switch (fieldKey) {
    case 'id':
      return row.name;
    case 'faction':
      return translateConfigValue(translate, `factions.${String(value)}`, String(value));
    case 'cardType':
      return translateConfigValue(translate, `configReview.values.cardType.${String(value)}`, String(value));
    case 'unitClass':
      return translateConfigValue(translate, `configReview.values.unitClass.${String(value)}`, String(value));
    case 'attackType':
      return translateConfigValue(translate, `configReview.values.attackType.${String(value)}`, String(value));
    case 'playPhase':
      return translateConfigValue(translate, `configReview.values.playPhase.${String(value)}`, String(value));
    case 'eventType':
      return translateConfigValue(translate, `configReview.values.eventType.${String(value)}`, String(value));
    case 'isActive':
    case 'isGate':
    case 'isStartingGate':
      return translateConfigValue(translate, `configReview.values.boolean.${String(value)}`, String(value));
    case 'spriteAtlas':
      return translateConfigValue(translate, `configReview.values.spriteAtlas.${String(value)}`, String(value));
    case 'deckSymbols':
      return Array.isArray(value)
        ? formatDisplayList(value, (symbol) => translateConfigValue(translate, `configReview.values.deckSymbols.${String(symbol)}`, String(symbol)))
        : translateConfigValue(translate, `configReview.values.deckSymbols.${String(value)}`, String(value));
    case 'abilities':
      return Array.isArray(value)
        ? formatDisplayList(value, (abilityId) => translateConfigValue(translate, `abilities.${String(abilityId)}.name`, String(abilityId)))
        : translateConfigValue(translate, `abilities.${String(value)}.name`, String(value));
    case 'targetUnitId':
      return formatReferencedCardName(value, rowNameByObjectId, translate);
    case 'entanglementTargets':
      return Array.isArray(value)
        ? formatDisplayList(value, (target) => formatReferencedCardName(target, rowNameByObjectId, translate))
        : formatReferencedCardName(value, rowNameByObjectId, translate);
    case 'setupPositions':
      return Array.isArray(value)
        ? formatDisplayList(value, (setupPosition) => formatSetupPosition(setupPosition, translate))
        : formatSetupPosition(value, translate);
    case 'sourceContexts':
      return Array.isArray(value)
        ? formatDisplayList(value, (sourceContext) => formatSourceContext(sourceContext, translate))
        : formatSourceContext(value, translate);
    default:
      return formatCellValue(value);
  }
}

function formatConfigVersionDisplay(configVersion: string, translate: TranslateConfigValue): string {
  return translateConfigValue(translate, `configReview.values.configVersion.${configVersion}`, configVersion);
}

function normalizeConfigEditToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function addEditAlias<T>(aliases: Map<string, T>, label: string | undefined, value: T) {
  if (!label) return;
  aliases.set(normalizeConfigEditToken(label), value);
}

function buildTranslatedAliasMap(
  translate: TranslateConfigValue,
  namespace: string,
  values: readonly string[],
): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const value of values) {
    addEditAlias(aliases, value, value);
    addEditAlias(aliases, translateConfigValue(translate, `${namespace}.${value}`, value), value);
  }
  return aliases;
}

function splitEditableListInput(rawValue: string): string[] {
  const trimmed = rawValue.trim();
  if (!trimmed) return [];
  const separator = trimmed.includes('、') ? /、/ : /[,\n;，；]+/;
  return trimmed.split(separator).map((part) => part.trim()).filter(Boolean);
}

function parseBooleanDisplayValue(rawValue: string, translate: TranslateConfigValue): boolean | string {
  const aliases = new Map<string, boolean>();
  addEditAlias(aliases, 'true', true);
  addEditAlias(aliases, '1', true);
  addEditAlias(aliases, 'yes', true);
  addEditAlias(aliases, 'y', true);
  addEditAlias(aliases, '是', true);
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.boolean.true', '是'), true);
  addEditAlias(aliases, 'false', false);
  addEditAlias(aliases, '0', false);
  addEditAlias(aliases, 'no', false);
  addEditAlias(aliases, 'n', false);
  addEditAlias(aliases, '否', false);
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.boolean.false', '否'), false);
  return aliases.get(normalizeConfigEditToken(rawValue)) ?? rawValue.trim();
}

function parseSetupPositionDisplayValue(rawValue: string): string {
  const text = rawValue.trim();
  const summonerMatch = text.match(/^召唤师[:：]\s*第\s*(\d+)\s*行第\s*(\d+)\s*列$/);
  if (summonerMatch) return `summoner@${summonerMatch[1]}:${summonerMatch[2]}`;

  const startingGateMatch = text.match(/^起始城门[:：]\s*第\s*(\d+)\s*行第\s*(\d+)\s*列$/);
  if (startingGateMatch) return `startingGate@${startingGateMatch[1]}:${startingGateMatch[2]}`;

  const startingUnitMatch = text.match(/^起始单位[:：]\s*第\s*(\d+)\s*张[，,]\s*第\s*(\d+)\s*行第\s*(\d+)\s*列$/);
  if (startingUnitMatch) return `startingUnit#${startingUnitMatch[1]}@${startingUnitMatch[2]}:${startingUnitMatch[3]}`;

  return text;
}

function parseSourceContextDisplayValue(rawValue: string, translate: TranslateConfigValue): string {
  const text = rawValue.trim();
  const aliases = new Map<string, string>();
  addEditAlias(aliases, '召唤师', '召唤师');
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.sourceContexts.summoner', '召唤师'), '召唤师');
  addEditAlias(aliases, '起始城门', '起始城门');
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.sourceContexts.startingGate', '起始城门'), '起始城门');
  addEditAlias(aliases, '起始单位', '起始单位');
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.sourceContexts.startingUnit', '起始单位'), '起始单位');
  addEditAlias(aliases, '抽牌堆', '抽牌堆');
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.sourceContexts.deck', '抽牌堆'), '抽牌堆');

  const staticValue = aliases.get(normalizeConfigEditToken(text));
  if (staticValue) return staticValue;

  const startingGateMatch = text.match(/^起始城门[:：]\s*第\s*(\d+)\s*行第\s*(\d+)\s*列$/);
  if (startingGateMatch) return `起始城门: ${startingGateMatch[1]},${startingGateMatch[2]}`;

  const startingUnitMatch = text.match(/^起始单位[:：]\s*第\s*(\d+)\s*张[，,]\s*第\s*(\d+)\s*行第\s*(\d+)\s*列$/);
  if (startingUnitMatch) return `起始单位: ${startingUnitMatch[1]}@${startingUnitMatch[2]},${startingUnitMatch[3]}`;

  return text;
}

function parseLocalizedScalarValue(
  fieldKey: SummonerWarsConfigReviewFieldKey,
  rawValue: string,
  translate: TranslateConfigValue,
  rowNameByObjectId: Map<string, string>,
  abilityNameById: Map<string, string>,
): unknown {
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;

  if (BOOLEAN_FIELD_KEYS.has(fieldKey)) {
    return parseBooleanDisplayValue(trimmed, translate);
  }

  if (fieldKey === 'id' || fieldKey === 'targetUnitId' || fieldKey === 'entanglementTargets') {
    const aliases = new Map<string, string>();
    rowNameByObjectId.forEach((name, objectId) => {
      addEditAlias(aliases, objectId, objectId);
      addEditAlias(aliases, name, objectId);
    });
    return aliases.get(normalizeConfigEditToken(trimmed)) ?? trimmed;
  }

  if (fieldKey === 'faction') {
    const aliases = new Map<string, string>();
    for (const faction of FACTION_CATALOG) {
      addEditAlias(aliases, faction.id, faction.id);
      addEditAlias(aliases, translateConfigValue(translate, `factions.${faction.id}`, faction.id), faction.id);
    }
    return aliases.get(normalizeConfigEditToken(trimmed)) ?? trimmed;
  }

  if (fieldKey === 'abilities') {
    const aliases = new Map<string, string>();
    abilityNameById.forEach((name, abilityId) => {
      addEditAlias(aliases, abilityId, abilityId);
      addEditAlias(aliases, name, abilityId);
    });
    return aliases.get(normalizeConfigEditToken(trimmed)) ?? trimmed;
  }

  if (fieldKey === 'setupPositions') {
    return parseSetupPositionDisplayValue(trimmed);
  }

  if (fieldKey === 'sourceContexts') {
    return parseSourceContextDisplayValue(trimmed, translate);
  }

  const enumValues = CONFIG_REVIEW_ENUM_VALUES[fieldKey];
  if (enumValues) {
    const aliases = buildTranslatedAliasMap(translate, `configReview.values.${fieldKey}`, enumValues);
    return aliases.get(normalizeConfigEditToken(trimmed)) ?? trimmed;
  }

  return trimmed;
}

function parseSuggestedValue(
  fieldKey: SummonerWarsConfigReviewFieldKey,
  rawValue: string,
  translate: TranslateConfigValue,
  rowNameByObjectId: Map<string, string>,
  abilityNameById: Map<string, string>,
): unknown {
  const trimmed = rawValue.trim();
  const { valueKind } = getSummonerWarsConfigReviewFieldDefinition(fieldKey);
  if (valueKind === 'string-array') {
    return splitEditableListInput(trimmed).map((part) => parseLocalizedScalarValue(
      fieldKey,
      part,
      translate,
      rowNameByObjectId,
      abilityNameById,
    ));
  }
  if (valueKind === 'number') {
    return trimmed === '' ? undefined : Number(trimmed);
  }
  if (valueKind === 'boolean') {
    return parseBooleanDisplayValue(trimmed, translate);
  }
  return parseLocalizedScalarValue(fieldKey, trimmed, translate, rowNameByObjectId, abilityNameById);
}

function areConfigValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function cellWidthClass(fieldKey: SummonerWarsConfigReviewFieldKey): string {
  switch (fieldKey) {
    case 'id':
      return 'w-[158px]';
    case 'name':
      return 'w-[148px]';
    case 'deckSymbols':
      return 'w-[150px]';
    case 'abilities':
      return 'w-[190px]';
    case 'effect':
      return 'w-[280px]';
    case 'targetUnitId':
    case 'entanglementTargets':
    case 'setupPositions':
    case 'sourceContexts':
      return 'w-[180px]';
    case 'cardType':
    case 'unitClass':
    case 'faction':
    case 'spriteAtlas':
      return 'w-[108px]';
    default:
      return 'w-[82px]';
  }
}

function stickyColumnClass(columnKey: 'image' | SummonerWarsConfigReviewFieldKey): string {
  switch (columnKey) {
    case 'image':
      return 'sticky left-0 z-[2] w-[70px] shadow-[2px_0_0_rgba(143,102,66,0.18)]';
    case 'name':
      return 'sticky left-[72px] z-[2] shadow-[2px_0_0_rgba(143,102,66,0.14)]';
    default:
      return '';
  }
}

function stickyHeaderClass(columnKey: 'image' | SummonerWarsConfigReviewFieldKey): string {
  const stickyClass = stickyColumnClass(columnKey);
  return stickyClass
    ? `${stickyClass.replace('z-[2]', 'z-[12]')} bg-[#3f2718]`
    : '';
}

function buildConfigProposal(
  row: SummonerWarsConfigReviewRow,
  fieldKey: SummonerWarsConfigReviewFieldKey,
  suggestedValue: unknown,
  language: string,
  configVersion: string,
): Omit<FeedbackConfigProposal, 'reason'> & { reason?: string } {
  return {
    gameId: 'summonerwars',
    configVersion,
    objectId: row.objectId,
    objectType: row.objectType,
    fieldPath: row.fieldPaths[fieldKey],
    currentValue: getSummonerWarsConfigReviewCellValue(row, fieldKey),
    suggestedValue,
    sourceContext: {
      route: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}${window.location.hash}` : undefined,
      tableId: SUMMONER_WARS_CONFIG_REVIEW_TABLE_ID,
      rowId: row.rowId,
      cellKey: fieldKey,
      language,
      objectContext: {
        name: row.name,
        factionId: row.factionId,
        cardType: row.cardType,
        objectType: row.objectType,
        deckSymbols: row.deckSymbols,
        setupPositions: row.setupPositions,
        sourceContexts: row.sourceContexts,
      },
    },
    status: 'pending_ai_review',
  };
}

function ConfigProposalCell({
  row,
  fieldKey,
  label,
  placeholder,
  editHint,
  rawValueLabel,
  pendingEdit,
  formatDisplayValue,
  onCommit,
}: {
  row: SummonerWarsConfigReviewRow;
  fieldKey: SummonerWarsConfigReviewFieldKey;
  label: string;
  placeholder: string;
  editHint: string;
  rawValueLabel: string;
  pendingEdit?: PendingConfigEdit;
  formatDisplayValue: (value: unknown) => string;
  onCommit: (params: {
    row: SummonerWarsConfigReviewRow;
    fieldKey: SummonerWarsConfigReviewFieldKey;
    rawValue: string;
  }) => void;
}) {
  const applicable = isSummonerWarsConfigReviewFieldApplicable(row, fieldKey);
  const currentValue = getSummonerWarsConfigReviewCellValue(row, fieldKey);
  const currentText = applicable ? formatCellValue(currentValue) : '';
  const currentDisplayText = applicable ? formatDisplayValue(currentValue) : '';
  const pendingDisplayText = pendingEdit
    ? pendingEdit.error
      ? pendingEdit.rawValue
      : formatDisplayValue(pendingEdit.parsedValue)
    : undefined;
  const displayText = pendingDisplayText ?? currentDisplayText;
  const editText = pendingDisplayText ?? currentDisplayText;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(editText);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    if (!applicable) return;
    setDraft(editText);
    setIsEditing(true);
  };

  const commitDraft = () => {
    if (!applicable) return;
    setIsEditing(false);
    if (draft.trim() === editText.trim()) return;
    onCommit({ row, fieldKey, rawValue: draft });
  };

  return (
    <div className="flex min-h-[30px] items-center">
      {isEditing ? (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitDraft();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(editText);
            setIsEditing(false);
          }
        }}
        className={[
          'h-7 rounded-[3px] border px-2 text-[11px] font-semibold outline-none transition',
          'bg-[#fffaf0] text-[#301a0e] placeholder:text-[#8a6444]/60',
          pendingEdit ? 'border-[#a45c18] ring-1 ring-[#a45c18]/25' : 'border-[#8f6642]/28',
          pendingEdit?.error ? 'border-red-700 text-red-800 ring-1 ring-red-700/25' : '',
          cellWidthClass(fieldKey),
        ].join(' ')}
        placeholder={placeholder}
        aria-label={label}
        title={editText || placeholder}
        data-testid={`summonerwars-config-cell-${fieldKey}`}
      />
      ) : (
        <button
          type="button"
          disabled={!applicable}
          onDoubleClick={startEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              startEditing();
            }
          }}
          className={[
            'group flex h-[30px] items-center justify-between gap-1 rounded-[3px] border px-2 text-left text-[11px] font-semibold outline-none transition',
            'focus-visible:ring-2 focus-visible:ring-[#6b4328]/25',
            applicable ? 'cursor-text hover:border-[#7b4d2d] hover:bg-[#fff0ca]' : 'cursor-not-allowed opacity-55',
            pendingEdit ? 'border-[#a45c18] bg-[#ffe6a7] text-[#2b180d] ring-1 ring-[#a45c18]/20' : 'border-transparent text-[#301a0e]',
            pendingEdit?.error ? 'border-red-700 bg-red-50 text-red-800 ring-1 ring-red-700/20' : '',
            cellWidthClass(fieldKey),
          ].join(' ')}
          aria-label={`${label}：${editHint}`}
          title={pendingEdit?.error ?? `${displayText || placeholder} · ${rawValueLabel}：${currentText || placeholder} · ${editHint}`}
          data-testid={`summonerwars-config-cell-${fieldKey}`}
        >
          <span className={['block min-w-0 truncate', displayText ? '' : 'text-[#8a6444]/62'].join(' ')}>
            {displayText || placeholder}
          </span>
          {pendingEdit ? (
            <PencilLine aria-hidden="true" className="h-3 w-3 shrink-0 opacity-70" />
          ) : null}
        </button>
      )}
    </div>
  );
}

function ConfigCardPreviewButton({
  row,
  onMagnify,
  missingLabel,
  magnifyLabel,
}: {
  row: SummonerWarsConfigReviewRow;
  onMagnify: (row: SummonerWarsConfigReviewRow) => void;
  missingLabel: string;
  magnifyLabel: string;
}) {
  if (!row.previewRef) {
    return (
      <div
        className="flex h-[36px] w-[56px] items-center justify-center rounded-[3px] border border-red-700/45 bg-red-950/20 text-red-900"
        data-testid="summonerwars-config-card-missing"
        title={missingLabel}
      >
        <ImageOff aria-hidden="true" className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group relative h-[36px] w-[56px] overflow-hidden rounded-[3px] border border-[#8f6642]/42 bg-[#2c1d14] shadow-[0_3px_8px_rgba(63,38,20,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f2718]/40"
      onClick={() => onMagnify(row)}
      data-testid="summonerwars-config-card-preview"
      aria-label={magnifyLabel}
      title={magnifyLabel}
    >
      <CardPreview
        previewRef={row.previewRef}
        className="h-full w-full"
        title={row.name}
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
        <Maximize2 aria-hidden="true" className="h-4 w-4" />
      </span>
    </button>
  );
}

export const SummonerWarsConfigReview = () => {
  const { t, i18n } = useTranslation(['game-summonerwars', 'lobby', 'common', 'game']);
  const navigate = useNavigate();
  const table = useMemo(() => {
    initSpriteAtlases(i18n.language || 'zh-CN');
    return buildSummonerWarsConfigReviewTable();
  }, [i18n.language]);
  const rowNameByObjectId = useMemo(
    () => new Map(table.rows.map((row) => [row.objectId, row.name])),
    [table.rows],
  );
  const abilityNameById = useMemo(() => {
    const abilityIds = new Set(table.rows.flatMap((row) => row.abilityIds));
    return new Map(Array.from(abilityIds).map((abilityId) => [
      abilityId,
      translateConfigValue(
        (key, options = {}) => String(t(key, { ...options, defaultValue: String(options.defaultValue ?? key) })),
        `abilities.${abilityId}.name`,
        abilityId,
      ),
    ]));
  }, [t, table.rows]);
  const translateDisplayValue = useCallback<TranslateConfigValue>(
    (key, options = {}) => String(t(key, { ...options, defaultValue: String(options.defaultValue ?? key) })),
    [t],
  );
  const [query, setQuery] = useState('');
  const [factionFilter, setFactionFilter] = useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | SummonerWarsConfigReviewType>('all');
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingEdits, setPendingEdits] = useState<Record<string, PendingConfigEdit>>({});
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [magnifiedRow, setMagnifiedRow] = useState<SummonerWarsConfigReviewRow | null>(null);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return table.rows.filter((row) => {
      if (factionFilter !== 'all' && row.factionId !== factionFilter) return false;
      if (typeFilter !== 'all' && row.objectType !== typeFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        row.name,
        row.objectId,
        formatCellDisplayValue(row, 'faction', row.factionId, translateDisplayValue, rowNameByObjectId),
        formatCellDisplayValue(row, 'deckSymbols', row.deckSymbols, translateDisplayValue, rowNameByObjectId),
        formatCellDisplayValue(row, 'abilities', row.abilityIds, translateDisplayValue, rowNameByObjectId),
        row.factionId,
        row.cardType,
        row.unitClass ?? '',
        row.objectType,
        row.deckSymbols.join(' '),
        row.abilityIds.join(' '),
        row.effectText ?? '',
        row.setupPositions.join(' '),
        row.sourceContexts.join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [factionFilter, query, rowNameByObjectId, table.rows, translateDisplayValue, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = visibleRows.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageRangeStart = visibleRows.length === 0 ? 0 : pageStartIndex + 1;
  const pageRangeEnd = visibleRows.length === 0 ? 0 : Math.min(pageStartIndex + pageSize, visibleRows.length);
  const pagedRows = useMemo(
    () => visibleRows.slice(pageStartIndex, pageStartIndex + pageSize),
    [pageSize, pageStartIndex, visibleRows],
  );

  const selectedPreviewRef = magnifiedRow?.previewRef ?? null;
  const selectedAspectRatio = selectedPreviewRef && 'aspectRatio' in selectedPreviewRef
    ? selectedPreviewRef.aspectRatio
    : 1044 / 729;

  const pendingEditList = useMemo(() => Object.values(pendingEdits), [pendingEdits]);
  const invalidEditCount = pendingEditList.filter((edit) => edit.error).length;
  const validPendingEdits = pendingEditList.filter((edit) => !edit.error);
  const feedbackProposals = useMemo(() => validPendingEdits.map((edit) => buildConfigProposal(
    edit.row,
    edit.fieldKey,
    edit.parsedValue,
    i18n.language || 'zh-CN',
    table.configVersion,
  )), [i18n.language, table.configVersion, validPendingEdits]);

  const handleCellCommit = ({
    row,
    fieldKey,
    rawValue,
  }: {
    row: SummonerWarsConfigReviewRow;
    fieldKey: SummonerWarsConfigReviewFieldKey;
    rawValue: string;
  }) => {
    const editKey = getEditKey(row, fieldKey);
    const currentValue = getSummonerWarsConfigReviewCellValue(row, fieldKey);
    const parsedValue = parseSuggestedValue(fieldKey, rawValue, translateDisplayValue, rowNameByObjectId, abilityNameById);
    const trimmed = rawValue.trim();
    const { valueKind } = getSummonerWarsConfigReviewFieldDefinition(fieldKey);

    if (areConfigValuesEqual(parsedValue, currentValue)) {
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[editKey];
        return next;
      });
      return;
    }

    let errorMessage: string | undefined;
    if (valueKind === 'number' && trimmed !== '' && Number.isNaN(parsedValue)) {
      errorMessage = t('configReview.feedback.invalidNumber');
    }
    if (valueKind === 'boolean' && trimmed !== '' && typeof parsedValue === 'string') {
      errorMessage = t('configReview.feedback.invalidBoolean');
    }

    setPendingEdits((prev) => ({
      ...prev,
      [editKey]: {
        row,
        fieldKey,
        rawValue,
        parsedValue,
        error: errorMessage,
      },
    }));
  };

  return (
    <main className="h-screen overflow-hidden bg-[#1d130c] bg-[radial-gradient(circle_at_top_left,_rgba(190,137,75,0.24),_transparent_34%),linear-gradient(180deg,_#2b1b11_0%,_#120c08_100%)] px-[clamp(12px,2.1vw,30px)] py-[clamp(12px,1.8vw,24px)] font-serif text-[#3f2718]">
      <div className="mx-auto flex h-[calc(100vh-48px)] max-w-[1760px] flex-col rounded-[10px] border border-[#8f6642]/52 bg-[#ead8b8] shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
        <header className="border-b border-[#8f6642]/32 bg-[#f3e5ca] px-[clamp(14px,2vw,28px)] py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex min-h-[34px] items-center gap-2 rounded-[4px] border border-[#8f6642]/42 bg-[#4b2c18] px-3 text-xs font-bold text-[#f1dab3] transition hover:text-[#fff0ce]"
                onClick={() => navigate('/')}
                data-testid="summonerwars-config-back-button"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t('configReview.actions.back')}
              </button>
              <div className="min-w-0">
                <h1 className="text-[clamp(24px,2.8vw,38px)] font-bold leading-none text-[#301a0e]">
                  {t('configReview.title')}
                </h1>
              </div>
            </div>
            <div className="text-right text-xs font-semibold leading-5 text-[#6d4d34]" title={table.configVersion}>
              {t('configReview.stats.compactStatus', {
                version: formatConfigVersionDisplay(table.configVersion, translateDisplayValue),
                visible: visibleRows.length,
                total: table.rows.length,
                pageRows: pagedRows.length,
              })}
            </div>
          </div>
          <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(260px,1fr)_190px_160px_auto]">
            <label className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b5a40]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] pl-10 pr-3 text-sm font-semibold text-[#301a0e] outline-none placeholder:text-[#8a6444]/70 focus:ring-2 focus:ring-[#6b4328]/20"
                placeholder={t('configReview.filters.searchPlaceholder')}
                data-testid="summonerwars-config-search"
              />
            </label>
            <select
              value={factionFilter}
              onChange={(event) => {
                setFactionFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20"
              data-testid="summonerwars-config-faction-filter"
            >
              <option value="all">{t('configReview.filters.allFactions')}</option>
              {FACTION_CATALOG.filter((faction) => faction.selectable !== false).map((faction) => (
                <option key={faction.id} value={faction.id}>
                  {t(`factions.${faction.id}`)}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as 'all' | SummonerWarsConfigReviewType);
                setCurrentPage(1);
              }}
              className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20"
              data-testid="summonerwars-config-type-filter"
            >
              {TYPE_FILTERS.map((type) => (
                <option key={type} value={type}>
                  {t(`configReview.types.${type}`)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={[
                  'whitespace-nowrap px-1 text-xs font-semibold',
                  pendingEditList.length > 0 ? 'text-[#4b2c18]' : 'text-[#7b5a40]',
                ].join(' ')}
                data-testid="summonerwars-config-pending-count"
              >
                {t('configReview.feedback.pendingCount', { count: pendingEditList.length })}
              </span>
              {invalidEditCount > 0 ? (
                <span className="rounded-[4px] border border-red-700/35 bg-red-50 px-2 py-1 text-red-800" data-testid="summonerwars-config-invalid-count">
                  {t('configReview.feedback.invalidCount', { count: invalidEditCount })}
                </span>
              ) : null}
              <button
                type="button"
                disabled={pendingEditList.length === 0}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setPendingEdits({})}
                data-testid="summonerwars-config-clear-edits"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {t('configReview.actions.clearEdits')}
              </button>
              <button
                type="button"
                disabled={validPendingEdits.length === 0 || invalidEditCount > 0}
                className="inline-flex min-h-[34px] items-center gap-2 rounded-[4px] border border-[#3f2718]/45 bg-[#4b2c18] px-3 text-[#f5ddb4] shadow-[0_3px_8px_rgba(75,44,24,0.18)] transition hover:bg-[#321c0e] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setIsFeedbackOpen(true)}
                data-testid="summonerwars-config-submit-edits"
              >
                <Send aria-hidden="true" className="h-4 w-4" />
                {t('configReview.actions.submitBatch', { count: validPendingEdits.length })}
              </button>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-[clamp(8px,1.2vw,16px)]">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[#fff1cf]/62 px-3 py-1.5 text-xs font-semibold text-[#5e3d27]">
            <span className="inline-flex items-center gap-2 text-[#4b2c18]" data-testid="summonerwars-config-horizontal-scroll-hint">
              <MoveHorizontal aria-hidden="true" className="h-4 w-4" />
              {t('configReview.tableScroll.primaryHint')}
            </span>
            <span className="text-[#7b5a40]">
              {t('configReview.tableScroll.secondaryHint')}
            </span>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              style={{ scrollbarGutter: 'stable both-edges', scrollbarWidth: 'auto', scrollbarColor: '#6b4328 #ead8b8' }}
              className="h-full min-h-0 overflow-x-scroll overflow-y-auto rounded-[8px] border border-[#8f6642]/35 bg-[#fff3d7] shadow-inner"
              data-testid="summonerwars-config-table"
            >
              <table className="w-full min-w-[3000px] border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#3f2718] text-[#f3e3c3] shadow-[0_2px_0_rgba(0,0,0,0.12)]">
                  <tr>
                    {SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS.map((columnKey) => (
                      <th
                        key={columnKey}
                        className={[
                          'whitespace-nowrap px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em]',
                          stickyHeaderClass(columnKey),
                        ].join(' ')}
                      >
                        {t(`configReview.columns.${columnKey}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, rowIndex) => {
                    const rowBackgroundClass = (pageStartIndex + rowIndex) % 2 === 0 ? 'bg-[#fff9e9]' : 'bg-[#f7e6c6]';

                    return (
                    <tr key={row.rowId}>
                      {SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS.map((columnKey) => (
                        <td
                          key={`${row.rowId}:${columnKey}`}
                          className={[
                            'border-t border-[#8f6642]/18 px-2 py-0.5 align-middle',
                            rowBackgroundClass,
                            stickyColumnClass(columnKey),
                          ].join(' ')}
                        >
                          {columnKey === 'image' ? (
                            <ConfigCardPreviewButton
                              row={row}
                              onMagnify={setMagnifiedRow}
                              missingLabel={t('configReview.material.missing-sprite')}
                              magnifyLabel={t('configReview.actions.magnify', { name: row.name })}
                            />
                          ) : (
                            <ConfigProposalCell
                              row={row}
                              fieldKey={columnKey}
                              label={t(`configReview.fields.${columnKey}`)}
                              placeholder={t('configReview.feedback.emptyCell')}
                              editHint={t('configReview.feedback.cellEditHint')}
                              rawValueLabel={t('configReview.feedback.rawValueLabel')}
                              pendingEdit={pendingEdits[getEditKey(row, columnKey)]}
                              formatDisplayValue={(value) => formatCellDisplayValue(row, columnKey, value, translateDisplayValue, rowNameByObjectId)}
                              onCommit={handleCellCommit}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2 right-[1px] top-2 w-10 rounded-r-[8px] bg-gradient-to-l from-[#fff3d7] via-[#fff3d7]/80 to-transparent"
            />
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#8f6642]/24 bg-[#f8e8c3]/82 px-3 py-2 text-xs font-semibold text-[#5e3d27]"
            data-testid="summonerwars-config-pagination"
          >
            <span data-testid="summonerwars-config-visible-range">
              {t('configReview.pagination.visibleRange', {
                start: pageRangeStart,
                end: pageRangeEnd,
                total: visibleRows.length,
              })}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1">
                <span>{t('configReview.pagination.pageSize')}</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value) as PageSize);
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded-[4px] border border-[#8f6642]/35 bg-[#fff6df] px-2 text-xs font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20"
                  data-testid="summonerwars-config-page-size"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <span className="rounded-[4px] border border-[#8f6642]/22 bg-[#fff6df] px-2 py-1 text-[#301a0e]" data-testid="summonerwars-config-page-status">
                {t('configReview.pagination.pageStatus', {
                  page: safeCurrentPage,
                  total: totalPages,
                })}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="min-h-[32px] rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                data-testid="summonerwars-config-prev-page"
              >
                {t('configReview.actions.previousPage')}
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="min-h-[32px] rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                data-testid="summonerwars-config-next-page"
              >
                {t('configReview.actions.nextPage')}
              </button>
            </div>
          </div>
        </section>
      </div>

      <MagnifyOverlay
        isOpen={Boolean(selectedPreviewRef && magnifiedRow)}
        onClose={() => setMagnifiedRow(null)}
        closeLabel={t('configReview.actions.closePreview')}
        overlayClassName="bg-black/50"
        closeButtonClassName="border border-[#f1dab3]/50 bg-[#4b2c18]/95 text-[#fff0ce] shadow-lg hover:bg-[#3a2112] hover:text-white"
        overlayTestId="summonerwars-config-card-magnify"
      >
        {selectedPreviewRef && magnifiedRow ? (
          <div
            className="relative bg-transparent"
            style={{
              width: 'min(82vw, 980px)',
              height: `calc(min(82vw, 980px) / ${selectedAspectRatio})`,
              maxHeight: '82vh',
              aspectRatio: selectedAspectRatio,
            }}
          >
            <CardPreview
              previewRef={selectedPreviewRef}
              className="h-full w-full rounded-xl shadow-2xl"
              title={magnifiedRow.name}
            />
          </div>
        ) : null}
      </MagnifyOverlay>

      {isFeedbackOpen ? (
        <FeedbackModal
          onClose={() => setIsFeedbackOpen(false)}
          onSubmitted={() => {
            setPendingEdits({});
            setIsFeedbackOpen(false);
          }}
          runtimeContext={{ mode: 'local', gameId: 'summonerwars' }}
          configProposals={feedbackProposals}
          initialContent={t('configReview.feedback.initialBatchContent', {
            count: feedbackProposals.length,
          })}
        />
      ) : null}
    </main>
  );
};

export default SummonerWarsConfigReview;
