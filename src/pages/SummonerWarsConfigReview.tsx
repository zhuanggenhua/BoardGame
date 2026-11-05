import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ImageOff, Maximize2 } from 'lucide-react';
import { CardPreview } from '../components/common/media/CardPreview';
import { MagnifyOverlay } from '../components/common/overlays/MagnifyOverlay';
import { ConfigReviewTable, type ConfigReviewColumn } from '../components/config/ConfigReviewTable';
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

const CONFIG_REVIEW_ENUM_VALUES: Partial<Record<SummonerWarsConfigReviewFieldKey, readonly string[]>> = {
  cardType: ['unit', 'event', 'structure'],
  unitClass: ['summoner', 'champion', 'common'],
  unitTags: ['undead', 'carrier', 'citadel'],
  attackType: ['melee', 'ranged'],
  playPhase: ['factionSelect', 'summon', 'move', 'build', 'attack', 'magic', 'draw', 'any'],
  eventType: ['legendary', 'common'],
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

type TranslateConfigValue = (key: string, options?: Record<string, unknown>) => string;

function translateConfigValue(
  translate: TranslateConfigValue,
  key: string,
  defaultValue: string,
  options: Record<string, unknown> = {},
): string {
  return translate(key, { ...options, defaultValue });
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
    case 'faction':
      return translateConfigValue(translate, `factions.${String(value)}`, String(value));
    case 'cardType':
    case 'unitClass':
    case 'unitTags':
    case 'attackType':
    case 'playPhase':
    case 'eventType':
      return Array.isArray(value)
        ? formatDisplayList(value, (item) => translateConfigValue(translate, `configReview.values.${fieldKey}.${String(item)}`, String(item)))
        : translateConfigValue(translate, `configReview.values.${fieldKey}.${String(value)}`, String(value));
    case 'isActive':
    case 'isGate':
    case 'isStartingGate':
      return translateConfigValue(translate, `configReview.values.boolean.${String(value)}`, String(value));
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
    default:
      return formatCellValue(value);
  }
}

function normalizeConfigEditToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function addEditAlias<T>(aliases: Map<string, T>, label: string | undefined, value: T) {
  if (label) aliases.set(normalizeConfigEditToken(label), value);
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
  for (const [label, value] of [
    ['true', true], ['1', true], ['yes', true], ['是', true],
    ['false', false], ['0', false], ['no', false], ['否', false],
  ] as const) addEditAlias(aliases, label, value);
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.boolean.true', '是'), true);
  addEditAlias(aliases, translateConfigValue(translate, 'configReview.values.boolean.false', '否'), false);
  return aliases.get(normalizeConfigEditToken(rawValue)) ?? rawValue.trim();
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
  if (BOOLEAN_FIELD_KEYS.has(fieldKey)) return parseBooleanDisplayValue(trimmed, translate);
  if (fieldKey === 'targetUnitId' || fieldKey === 'entanglementTargets') {
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
): { value: unknown } {
  const trimmed = rawValue.trim();
  const { valueKind } = getSummonerWarsConfigReviewFieldDefinition(fieldKey);
  if (valueKind === 'string-array') {
    return { value: splitEditableListInput(trimmed).map((part) => parseLocalizedScalarValue(fieldKey, part, translate, rowNameByObjectId, abilityNameById)) };
  }
  if (valueKind === 'number') return { value: trimmed === '' ? undefined : Number(trimmed) };
  if (valueKind === 'boolean') return { value: parseBooleanDisplayValue(trimmed, translate) };
  return { value: parseLocalizedScalarValue(fieldKey, trimmed, translate, rowNameByObjectId, abilityNameById) };
}

function fieldWidthClass(fieldKey: SummonerWarsConfigReviewFieldKey): string {
  switch (fieldKey) {
    case 'name': return 'w-[148px]';
    case 'deckSymbols': return 'w-[150px]';
    case 'abilities': return 'w-[190px]';
    case 'effect': return 'w-[280px]';
    case 'targetUnitId':
    case 'entanglementTargets':
    case 'setupPositions': return 'w-[180px]';
    case 'cardType':
    case 'unitClass':
    case 'faction': return 'w-[108px]';
    default: return 'w-[82px]';
  }
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
    return <div className="flex h-[36px] w-[56px] items-center justify-center rounded-[3px] border border-red-700/45 bg-red-950/20 text-red-900" title={missingLabel}><ImageOff aria-hidden="true" className="h-4 w-4" /></div>;
  }
  return (
    <button type="button" className="group relative h-[36px] w-[56px] overflow-hidden rounded-[3px] border border-[#8f6642]/42 bg-[#2c1d14] shadow-[0_3px_8px_rgba(63,38,20,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f2718]/40" onClick={() => onMagnify(row)} data-testid="summonerwars-config-card-preview" aria-label={magnifyLabel} title={magnifyLabel}>
      <CardPreview previewRef={row.previewRef} className="h-full w-full" title={row.name} />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100"><Maximize2 aria-hidden="true" className="h-4 w-4" /></span>
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
  const rowNameByObjectId = useMemo(() => new Map(table.rows.map((row) => [row.objectId, row.name])), [table.rows]);
  const abilityNameById = useMemo(() => {
    const abilityIds = new Set(table.rows.flatMap((row) => row.abilityIds));
    return new Map(Array.from(abilityIds).map((abilityId) => [abilityId, String(t(`abilities.${abilityId}.name`, { defaultValue: abilityId }))]));
  }, [t, table.rows]);
  const translate = useCallback<TranslateConfigValue>((key, options = {}) => String(t(key, { ...options, defaultValue: String(options.defaultValue ?? key) })), [t]);
  const [factionFilter, setFactionFilter] = useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | SummonerWarsConfigReviewType>('all');
  const [magnifiedRow, setMagnifiedRow] = useState<SummonerWarsConfigReviewRow | null>(null);

  const filteredRows = useMemo(
    () => table.rows.filter((row) => (factionFilter === 'all' || row.factionId === factionFilter) && (typeFilter === 'all' || row.objectType === typeFilter)),
    [factionFilter, table.rows, typeFilter],
  );
  const formatValue = useCallback((row: SummonerWarsConfigReviewRow, fieldKey: SummonerWarsConfigReviewFieldKey, value: unknown) => formatCellDisplayValue(row, fieldKey, value, translate, rowNameByObjectId), [rowNameByObjectId, translate]);
  const columns = useMemo<ConfigReviewColumn<SummonerWarsConfigReviewFieldKey>[]>(
    () => SUMMONER_WARS_CONFIG_REVIEW_COLUMN_KEYS.map((key) => ({
      key,
      label: t(`configReview.columns.${key}`),
      widthClass: key === 'image' ? 'w-[70px]' : fieldWidthClass(key),
      minWidth: key === 'image' ? 70 : undefined,
      sticky: key === 'image',
    })),
    [t],
  );

  return (
    <>
      <ConfigReviewTable
        gameId="summonerwars"
        tableId={SUMMONER_WARS_CONFIG_REVIEW_TABLE_ID}
        configVersion={table.configVersion}
        rows={filteredRows}
        columns={columns}
        labels={{
          back: t('configReview.actions.back'),
          searchPlaceholder: t('configReview.filters.searchPlaceholder'),
          pendingCount: (count) => t('configReview.feedback.pendingCount', { count }),
          invalidCount: (count) => t('configReview.feedback.invalidCount', { count }),
          clearEdits: t('configReview.actions.clearEdits'),
          submitBatch: (count) => t('configReview.actions.submitBatch', { count }),
          emptyCell: t('configReview.feedback.emptyCell'),
          cellEditHint: t('configReview.feedback.cellEditHint'),
          rawValueLabel: t('configReview.feedback.rawValueLabel'),
          invalidNumber: t('configReview.feedback.invalidNumber'),
          invalidBoolean: t('configReview.feedback.invalidBoolean'),
          horizontalScrollPrimary: t('configReview.tableScroll.primaryHint'),
          horizontalScrollSecondary: t('configReview.tableScroll.secondaryHint'),
          visibleRange: (start, end, total) => t('configReview.pagination.visibleRange', { start, end, total }),
          pageSize: t('configReview.pagination.pageSize'),
          pageStatus: (page, total) => t('configReview.pagination.pageStatus', { page, total }),
          previousPage: t('configReview.actions.previousPage'),
          nextPage: t('configReview.actions.nextPage'),
        }}
        title={t('configReview.title')}
        onBack={() => navigate('/')}
        filters={(
          <>
            <select value={factionFilter} onChange={(event) => setFactionFilter(event.target.value)} className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20" data-testid="summonerwars-config-faction-filter">
              <option value="all">{t('configReview.filters.allFactions')}</option>
              {FACTION_CATALOG.filter((faction) => faction.selectable !== false).map((faction) => <option key={faction.id} value={faction.id}>{t(`factions.${faction.id}`)}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | SummonerWarsConfigReviewType)} className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20" data-testid="summonerwars-config-type-filter">
              {TYPE_FILTERS.map((type) => <option key={type} value={type}>{t(`configReview.types.${type}`)}</option>)}
            </select>
          </>
        )}
        filterKey={`${factionFilter}:${typeFilter}`}
        getSearchText={(row) => [row.name, row.objectId, row.factionId, row.cardType, row.unitClass, row.objectType, row.deckSymbols.join(' '), row.abilityIds.join(' '), row.effectText, row.setupPositions.join(' '), row.sourceContexts.join(' '), formatValue(row, 'faction', row.factionId), formatValue(row, 'abilities', row.abilityIds)].filter(Boolean).join(' ')}
        getCellValue={getSummonerWarsConfigReviewCellValue}
        getFieldDefinition={getSummonerWarsConfigReviewFieldDefinition}
        isFieldApplicable={isSummonerWarsConfigReviewFieldApplicable}
        formatCellValue={formatValue}
        parseSuggestedValue={(row, fieldKey, rawValue) => parseSuggestedValue(fieldKey, rawValue, translate, rowNameByObjectId, abilityNameById)}
        buildProposal={({ row, fieldKey, suggestedValue, currentValue, currentDisplayValue, updatedDisplayValue, language, tableId, configVersion }) => ({
          gameId: 'summonerwars',
          configVersion,
          objectId: row.objectId,
          objectDisplayName: row.name,
          objectType: row.objectType,
          fieldPath: row.fieldPaths[fieldKey],
          fieldDisplayName: t(`configReview.fields.${fieldKey}`),
          currentValue,
          suggestedValue,
          currentDisplayValue,
          updatedDisplayValue,
          sourceContext: { route: window.location.href, tableId, rowId: row.rowId, cellKey: fieldKey, language, objectContext: { name: row.name, factionId: row.factionId, objectType: row.objectType, sourceContexts: row.sourceContexts } },
          status: 'pending_ai_review',
        })}
        renderCell={({ row, columnKey }) => {
          if (columnKey !== 'image') return undefined;
          if (!row.previewRef) return <div className="flex h-[36px] w-[56px] items-center justify-center rounded-[3px] border border-red-700/45 bg-red-950/20 text-red-900" title={t('configReview.material.noPreview')}><ImageOff aria-hidden="true" className="h-4 w-4" /></div>;
          const label = t('configReview.actions.magnify', { name: formatValue(row, 'name', row.name) });
          return <ConfigCardPreviewButton row={row} onMagnify={setMagnifiedRow} missingLabel={t('configReview.material.noPreview')} magnifyLabel={label} />;
        }}
        initialFeedbackContent={(count) => t('configReview.feedback.initialBatchContent', { count })}
        runtimeContext={{ mode: 'local', gameId: 'summonerwars' }}
        testIdPrefix="summonerwars-config"
        formatVersion={(version) => t(`configReview.values.configVersion.${version}`, { defaultValue: version })}
      />
      <MagnifyOverlay isOpen={Boolean(magnifiedRow?.previewRef)} onClose={() => setMagnifiedRow(null)} closeLabel={t('configReview.actions.closePreview')} overlayClassName="bg-black/50" overlayTestId="summonerwars-config-card-magnify">
        {magnifiedRow?.previewRef ? <div className="relative h-[82vh] w-[min(66vw,720px)]"><CardPreview previewRef={magnifiedRow.previewRef} className="h-full w-full rounded-xl shadow-2xl" title={magnifiedRow.name} /></div> : null}
      </MagnifyOverlay>
    </>
  );
};

export default SummonerWarsConfigReview;
