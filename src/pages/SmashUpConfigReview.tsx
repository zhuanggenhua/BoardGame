import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ImageOff, Layers3, Maximize2 } from 'lucide-react';
import { CardPreview } from '../components/common/media/CardPreview';
import { MagnifyOverlay } from '../components/common/overlays/MagnifyOverlay';
import { ConfigReviewTable, type ConfigReviewColumn } from '../components/config/ConfigReviewTable';
import { getRuntimeImageCandidateUrls, markImageCandidateFailed, markImageLoaded } from '../core';
import {
  buildSmashUpConfigReviewTable,
  getSmashUpConfigReviewCellValue,
  getSmashUpConfigReviewFieldDefinition,
  isSmashUpConfigReviewFieldApplicable,
  SMASHUP_CONFIG_REVIEW_COLUMN_KEYS,
  SMASHUP_CONFIG_REVIEW_FIELD_DEFINITIONS,
  SMASHUP_CONFIG_REVIEW_TABLE_ID,
  type SmashUpConfigReviewColumnKey,
  type SmashUpConfigReviewFieldKey,
  type SmashUpConfigReviewRow,
  type SmashUpConfigReviewType,
} from '../games/smashup/config/configReviewAdapter';
import { FACTION_METADATA, type FactionMeta } from '../games/smashup/ui/factionMeta';
import { initSmashUpAtlases } from '../games/smashup/ui/cardAtlas';
import zhSmashUpLocale from '@locales/zh-CN/game-smashup.json';
import enSmashUpLocale from '@locales/en/game-smashup.json';

const ALL_CONTENT_FILTER = '__all_smashup_content__';
const CONTENT_TYPE_FILTERS = ['all', 'minion', 'action', 'fusion', 'titan', 'base'] as const;

type FactionSelection = string | typeof ALL_CONTENT_FILTER | null;
type ContentTypeFilter = typeof CONTENT_TYPE_FILTERS[number];
type FactionIconComponent = React.ComponentType<{
  'aria-hidden'?: boolean;
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
}>;
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type SmashUpLocalePack = typeof zhSmashUpLocale;

const FIELD_LABEL_FALLBACKS = new Map<SmashUpConfigReviewColumnKey, string>([
  ['image', '预览'],
  ['name', '名称'],
  ['englishName', '英文名'],
  ['faction', '派系'],
  ['nameKey', '名称 Key'],
  ['descriptionKey', '描述 Key'],
  ['color', '主题色'],
  ['locales', '语言'],
  ['expansion', '扩展'],
  ['implementationStatus', '实现状态'],
  ['cardType', '卡牌类型'],
  ['subtype', '子类型'],
  ['quantity', '数量'],
  ['power', '力量'],
  ['minionPower', '随从面力量'],
  ['abilityTags', '能力标签'],
  ['activationWindows', '激活窗口'],
  ['playRequirements', '出牌限制'],
  ['breakpoint', '基地临界点'],
  ['vpAwards', 'VP'],
  ['baseRestrictions', '基地限制'],
  ['previewStatus', '预览状态'],
]);

const TYPE_LABEL_FALLBACKS = {
  all: '全部类型',
  faction: '派系',
  minion: '随从',
  action: '战术',
  fusion: '融合',
  titan: '泰坦',
  base: '基地',
} as const satisfies Record<'all' | SmashUpConfigReviewType, string>;

const STATUS_LABEL_FALLBACKS = {
  configured: '已配置',
  in_progress: '实现中',
  ready: '可预览',
  'missing-preview': '缺少预览',
  'missing-atlas': '缺少图集',
} as const;

function tr(
  translate: TranslateFn,
  key: string,
  defaultValue: string,
  options: Record<string, unknown> = {},
): string {
  return translate(key, { ...options, defaultValue });
}

function resolveSmashUpAssetLocale(language: string | undefined): 'zh-CN' | 'en' {
  return language?.toLocaleLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function getSmashUpLocalePack(language: string | undefined): SmashUpLocalePack {
  return resolveSmashUpAssetLocale(language) === 'en'
    ? enSmashUpLocale as SmashUpLocalePack
    : zhSmashUpLocale;
}

function resolveLocalePath(locale: unknown, key: string): string | undefined {
  let current: unknown = locale;
  for (const part of key.split('.')) {
    if (!part || typeof current !== 'object' || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' && current.trim() ? current : undefined;
}

function resolveLocaleObjectName(
  objectType: SmashUpConfigReviewType,
  objectId: string,
  language: string | undefined,
): string | undefined {
  const locale = getSmashUpLocalePack(language) as {
    factions?: Record<string, { name?: string }>;
    cards?: Record<string, { name?: string }>;
  };
  if (objectType === 'faction') return locale.factions?.[objectId]?.name;
  return locale.cards?.[objectId]?.name;
}

function preloadConfigReviewImage(sourceImage: string, locale: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false);
  const candidateUrls = getRuntimeImageCandidateUrls(sourceImage, locale);
  if (candidateUrls.length === 0) return Promise.resolve(false);

  return new Promise((resolve) => {
    let index = 0;

    const tryNextCandidate = () => {
      const candidateUrl = candidateUrls[index];
      index += 1;
      if (!candidateUrl) {
        resolve(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
          markImageCandidateFailed(sourceImage, locale, candidateUrl);
          tryNextCandidate();
          return;
        }
        markImageLoaded(sourceImage, locale, img, candidateUrl);
        markImageLoaded(candidateUrl, undefined, img, candidateUrl);
        resolve(true);
      };
      img.onerror = () => {
        markImageCandidateFailed(sourceImage, locale, candidateUrl);
        tryNextCandidate();
      };
      img.src = candidateUrl;
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        markImageLoaded(sourceImage, locale, img, candidateUrl);
        markImageLoaded(candidateUrl, undefined, img, candidateUrl);
        resolve(true);
      }
    };

    tryNextCandidate();
  });
}

function formatGenericCellValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function splitEditableListInput(rawValue: string): string[] {
  const trimmed = rawValue.trim();
  if (!trimmed) return [];
  const separator = trimmed.includes('、') ? /、/ : /[,\n;，；]+/;
  return trimmed.split(separator).map((part) => part.trim()).filter(Boolean);
}

function parseBooleanDisplayValue(rawValue: string): boolean | string {
  const normalized = rawValue.trim().toLowerCase();
  if (['true', '1', 'yes', '是'].includes(normalized)) return true;
  if (['false', '0', 'no', '否'].includes(normalized)) return false;
  return rawValue.trim();
}

function parseSuggestedValue(
  fieldKey: SmashUpConfigReviewFieldKey,
  rawValue: string,
): { value: unknown } {
  const trimmed = rawValue.trim();
  const { valueKind } = getSmashUpConfigReviewFieldDefinition(fieldKey);
  if (valueKind === 'string-array') return { value: splitEditableListInput(trimmed) };
  if (valueKind === 'number') return { value: trimmed === '' ? undefined : Number(trimmed) };
  if (valueKind === 'boolean') return { value: parseBooleanDisplayValue(trimmed) };
  return { value: trimmed || undefined };
}

function getFactionDisplayName(
  factionId: string | undefined,
  factionMetaById: Map<string, FactionMeta>,
  translate: TranslateFn,
  language: string | undefined,
): string {
  if (!factionId) return '';
  const faction = factionMetaById.get(factionId);
  const nameKey = faction?.nameKey ?? `factions.${factionId}.name`;
  return resolveLocalePath(getSmashUpLocalePack(language), nameKey)
    ?? tr(translate, nameKey, factionId);
}

function formatCellDisplayValue(
  row: SmashUpConfigReviewRow,
  fieldKey: SmashUpConfigReviewFieldKey,
  value: unknown,
  factionMetaById: Map<string, FactionMeta>,
  translate: TranslateFn,
  language: string | undefined,
): string {
  if (value === undefined || value === null) return '';

  switch (fieldKey) {
    case 'name':
      return resolveLocaleObjectName(row.objectType, row.objectId, language)
        ?? (row.objectType === 'faction'
          ? getFactionDisplayName(row.objectId, factionMetaById, translate, language)
          : String(value));
    case 'faction':
      return getFactionDisplayName(String(value), factionMetaById, translate, language);
    case 'implementationStatus':
      return tr(
        translate,
        `configReview.values.implementationStatus.${String(value)}`,
        STATUS_LABEL_FALLBACKS[String(value) as keyof typeof STATUS_LABEL_FALLBACKS] ?? String(value),
      );
    case 'previewStatus':
      return tr(
        translate,
        `configReview.values.previewStatus.${String(value)}`,
        STATUS_LABEL_FALLBACKS[String(value) as keyof typeof STATUS_LABEL_FALLBACKS] ?? String(value),
      );
    case 'cardType':
    case 'subtype':
      return tr(translate, `configReview.values.${fieldKey}.${String(value)}`, String(value));
    case 'vpAwards':
      return Array.isArray(value) ? value.join(' / ') : String(value);
    default:
      return formatGenericCellValue(value);
  }
}

function fieldWidthClass(fieldKey: SmashUpConfigReviewFieldKey): string {
  switch (fieldKey) {
    case 'name':
    case 'englishName':
      return 'w-[150px]';
    case 'nameKey':
    case 'descriptionKey':
      return 'w-[220px]';
    case 'abilityTags':
    case 'activationWindows':
    case 'playRequirements':
    case 'baseRestrictions':
      return 'w-[190px]';
    case 'implementationStatus':
    case 'previewStatus':
      return 'w-[108px]';
    default:
      return 'w-[96px]';
  }
}

function FactionIcon({ faction, className, size = 22 }: { faction: FactionMeta; className?: string; size?: number }) {
  const Icon = faction.icon as FactionIconComponent;
  return <Icon aria-hidden={true} className={className} size={size} strokeWidth={2.15} />;
}

function ConfigPreviewButton({
  row,
  onMagnify,
  missingLabel,
  magnifyLabel,
  previewWarmVersion,
}: {
  row: SmashUpConfigReviewRow;
  onMagnify: (row: SmashUpConfigReviewRow) => void;
  missingLabel: string;
  magnifyLabel: string;
  previewWarmVersion: number;
}) {
  if (!row.previewRef) {
    return (
      <div
        className="flex h-[42px] w-[56px] items-center justify-center rounded-[5px] border border-[#8f6642]/24 bg-[#ead8b8]/70 text-[#7b5a40]"
        title={missingLabel}
      >
        <ImageOff aria-hidden="true" className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group relative h-[42px] w-[56px] overflow-hidden rounded-[5px] border border-[#6f4b32]/30 bg-[#ead8b8] shadow-[0_2px_5px_rgba(63,39,24,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f2718]/40"
      onClick={() => onMagnify(row)}
      aria-label={magnifyLabel}
      title={magnifyLabel}
      data-testid="smashup-config-card-preview"
    >
      <CardPreview
        key={`${row.rowId}:${previewWarmVersion}`}
        previewRef={row.previewRef}
        className="h-full w-full"
        title={magnifyLabel}
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
        <Maximize2 aria-hidden="true" className="h-4 w-4" />
      </span>
    </button>
  );
}

function ConfigFactionIconButton({
  row,
  faction,
  label,
  onSelect,
}: {
  row: SmashUpConfigReviewRow;
  faction?: FactionMeta;
  label: string;
  onSelect: (factionId: string) => void;
}) {
  if (!faction) {
    return (
      <div
        className="flex h-[42px] w-[56px] items-center justify-center rounded-[5px] border border-[#8f6642]/24 bg-[#ead8b8]/70 text-[#7b5a40]"
        title={label}
      >
        <Layers3 aria-hidden="true" className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex h-[42px] w-[56px] items-center justify-center rounded-[5px] border bg-[#fff6df] shadow-[0_2px_5px_rgba(63,39,24,0.12)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f2718]/40"
      style={{ borderColor: `${faction.color}66`, color: faction.color }}
      onClick={() => onSelect(row.objectId)}
      aria-label={label}
      title={label}
      data-testid="smashup-config-faction-icon"
    >
      <FactionIcon faction={faction} className="h-6 w-6" size={26} />
    </button>
  );
}

function FactionGrid({
  factionRows,
  factionMetaById,
  factionStatsById,
  selectedFactionId,
  translate,
  language,
  onSelectFaction,
}: {
  factionRows: readonly SmashUpConfigReviewRow[];
  factionMetaById: Map<string, FactionMeta>;
  factionStatsById: Map<string, { cards: number; bases: number }>;
  selectedFactionId: FactionSelection;
  translate: TranslateFn;
  language: string | undefined;
  onSelectFaction: (factionId: string) => void;
}) {
  return (
    <div className="max-h-[202px] overflow-y-auto rounded-[8px] border border-[#8f6642]/28 bg-[#fff0cd]/72 p-2" data-testid="smashup-config-faction-grid">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(154px,1fr))] gap-2">
        {factionRows.map((row) => {
          const faction = factionMetaById.get(row.objectId);
          const stats = factionStatsById.get(row.objectId) ?? { cards: 0, bases: 0 };
          const displayName = formatCellDisplayValue(row, 'name', row.name, factionMetaById, translate, language);
          const selected = selectedFactionId === row.objectId;

          return (
            <button
              key={row.rowId}
              type="button"
              className={[
                'group flex min-h-[64px] items-center gap-2 rounded-[6px] border bg-[#fff8e8] px-2.5 py-2 text-left shadow-[0_2px_7px_rgba(63,39,24,0.08)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3f2718]/35',
                selected ? 'ring-2 ring-[#3f2718]/28' : '',
              ].join(' ')}
              style={{ borderColor: faction ? `${faction.color}${selected ? 'cc' : '55'}` : undefined }}
              onClick={() => onSelectFaction(row.objectId)}
              data-testid="smashup-config-faction-card"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] border bg-white"
                style={{ borderColor: faction ? `${faction.color}66` : undefined, color: faction?.color }}
              >
                {faction ? <FactionIcon faction={faction} className="h-7 w-7" size={30} /> : <Layers3 aria-hidden="true" className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold text-[#301a0e]">{displayName}</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-[#6d4d34]">
                  {tr(translate, 'configReview.factionGrid.stats', '{{cards}} 张卡牌 · {{bases}} 个基地', stats)}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-[#8a6444]">
                  {formatCellDisplayValue(row, 'implementationStatus', row.implementationStatus, factionMetaById, translate, language)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildRouteHref(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.href;
}

export const SmashUpConfigReview = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('game-smashup');
  const translate = useCallback<TranslateFn>(
    (key, options = {}) => String(t(key, { ...options, defaultValue: String(options.defaultValue ?? key) })),
    [t],
  );
  const language = i18n.language || 'zh-CN';
  const assetLocale = resolveSmashUpAssetLocale(language);
  const table = useMemo(() => {
    initSmashUpAtlases();
    return buildSmashUpConfigReviewTable();
  }, []);
  const factionMetaById = useMemo(
    () => new Map(FACTION_METADATA.map((faction) => [faction.id, faction])),
    [],
  );
  const factionRows = useMemo(
    () => table.rows.filter((row) => row.objectType === 'faction'),
    [table.rows],
  );
  const factionStatsById = useMemo(() => {
    const stats = new Map<string, { cards: number; bases: number }>();
    for (const row of table.rows) {
      if (!row.factionId || row.objectType === 'faction') continue;
      const current = stats.get(row.factionId) ?? { cards: 0, bases: 0 };
      if (row.objectType === 'base') {
        current.bases += 1;
      } else {
        current.cards += typeof row.quantity === 'number' ? row.quantity : 1;
      }
      stats.set(row.factionId, current);
    }
    return stats;
  }, [table.rows]);
  const [selectedFactionId, setSelectedFactionId] = useState<FactionSelection>(null);
  const [typeFilter, setTypeFilter] = useState<ContentTypeFilter>('all');
  const [magnifiedRow, setMagnifiedRow] = useState<SmashUpConfigReviewRow | null>(null);
  const [previewWarmVersion, setPreviewWarmVersion] = useState(0);

  const formatValue = useCallback(
    (row: SmashUpConfigReviewRow, fieldKey: SmashUpConfigReviewFieldKey, value: unknown) => (
      formatCellDisplayValue(row, fieldKey, value, factionMetaById, translate, language)
    ),
    [factionMetaById, language, translate],
  );
  const selectedFactionName = selectedFactionId && selectedFactionId !== ALL_CONTENT_FILTER
    ? getFactionDisplayName(selectedFactionId, factionMetaById, translate, language)
    : '';

  const visibleRows = useMemo(() => {
    if (!selectedFactionId) return factionRows;

    return table.rows.filter((row) => {
      if (row.objectType === 'faction') return false;
      if (selectedFactionId !== ALL_CONTENT_FILTER && row.factionId !== selectedFactionId) return false;
      return typeFilter === 'all' || row.objectType === typeFilter;
    });
  }, [factionRows, selectedFactionId, table.rows, typeFilter]);
  const visiblePreviewImages = useMemo(
    () => [...new Set(visibleRows.map((row) => row.previewImage).filter((value): value is string => Boolean(value)))],
    [visibleRows],
  );

  useEffect(() => {
    if (visiblePreviewImages.length === 0) return;
    let cancelled = false;

    void Promise.all(
      visiblePreviewImages.map((previewImage) => preloadConfigReviewImage(previewImage, assetLocale)),
    ).then((results) => {
      if (!cancelled && results.some(Boolean)) {
        setPreviewWarmVersion((version) => version + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [assetLocale, visiblePreviewImages]);

  const columns = useMemo<ConfigReviewColumn<SmashUpConfigReviewFieldKey>[]>(
    () => SMASHUP_CONFIG_REVIEW_COLUMN_KEYS.map((key) => ({
      key,
      label: tr(translate, `configReview.columns.${key}`, FIELD_LABEL_FALLBACKS.get(key) ?? key),
      widthClass: key === 'image' ? 'w-[70px]' : fieldWidthClass(key),
      minWidth: key === 'image' ? 70 : undefined,
      sticky: key === 'image',
    })),
    [translate],
  );

  return (
    <>
      <ConfigReviewTable
        gameId="smashup"
        tableId={SMASHUP_CONFIG_REVIEW_TABLE_ID}
        configVersion={table.configVersion}
        rows={visibleRows}
        columns={columns}
        labels={{
          back: tr(translate, 'configReview.actions.back', '返回首页'),
          searchPlaceholder: tr(translate, 'configReview.filters.searchPlaceholder', '搜索派系、卡牌、基地或字段'),
          pendingCount: (count) => tr(translate, 'configReview.feedback.pendingCount', '待提交 {{count}} 项', { count }),
          invalidCount: (count) => tr(translate, 'configReview.feedback.invalidCount', '{{count}} 项格式错误', { count }),
          clearEdits: tr(translate, 'configReview.actions.clearEdits', '清空草稿'),
          submitBatch: (count) => tr(translate, 'configReview.actions.submitBatch', '提交 {{count}} 项修正', { count }),
          emptyCell: tr(translate, 'configReview.feedback.emptyCell', '空'),
          cellEditHint: tr(translate, 'configReview.feedback.cellEditHint', '双击编辑为修正提案'),
          rawValueLabel: tr(translate, 'configReview.feedback.rawValueLabel', '当前值'),
          invalidNumber: tr(translate, 'configReview.feedback.invalidNumber', '请输入数字'),
          invalidBoolean: tr(translate, 'configReview.feedback.invalidBoolean', '请输入 true/false 或 是/否'),
          horizontalScrollPrimary: tr(translate, 'configReview.tableScroll.primaryHint', '表格可横向滚动'),
          horizontalScrollSecondary: tr(translate, 'configReview.tableScroll.secondaryHint', '双击单元格只生成修正提案，不直接改正式配置'),
          visibleRange: (start, end, total) => tr(translate, 'configReview.pagination.visibleRange', '显示 {{start}}-{{end}} / {{total}}', { start, end, total }),
          pageSize: tr(translate, 'configReview.pagination.pageSize', '每页'),
          pageStatus: (page, total) => tr(translate, 'configReview.pagination.pageStatus', '第 {{page}} / {{total}} 页', { page, total }),
          previousPage: tr(translate, 'configReview.actions.previousPage', '上一页'),
          nextPage: tr(translate, 'configReview.actions.nextPage', '下一页'),
        }}
        title={selectedFactionName
          ? tr(translate, 'configReview.titleWithFaction', '大杀四方配置表：{{faction}}', { faction: selectedFactionName })
          : tr(translate, 'configReview.title', '大杀四方配置表')}
        description={selectedFactionId
          ? tr(translate, 'configReview.description.selected', '当前表格显示所选派系的卡牌和基地；上方派系卡片仍可切换。')
          : tr(translate, 'configReview.description.factions', '默认显示派系配置和 SVG 图标；点击派系后进入该派系的卡牌/基地列表。')}
        onBack={() => navigate('/')}
        leadingContent={(
          <FactionGrid
            factionRows={factionRows}
            factionMetaById={factionMetaById}
            factionStatsById={factionStatsById}
            selectedFactionId={selectedFactionId}
            translate={translate}
            language={language}
            onSelectFaction={(factionId) => {
              setSelectedFactionId(factionId);
              setTypeFilter('all');
            }}
          />
        )}
        filters={(
          <>
            <button
              type="button"
              className={[
                'h-10 rounded-[4px] border px-3 text-sm font-bold transition',
                !selectedFactionId ? 'border-[#3f2718]/45 bg-[#4b2c18] text-[#f5ddb4]' : 'border-[#8f6642]/40 bg-[#fff6df] text-[#301a0e] hover:bg-[#fffdf4]',
              ].join(' ')}
              onClick={() => {
                setSelectedFactionId(null);
                setTypeFilter('all');
              }}
              data-testid="smashup-config-show-factions"
            >
              {tr(translate, 'configReview.filters.factionList', '派系列表')}
            </button>
            <button
              type="button"
              className={[
                'h-10 rounded-[4px] border px-3 text-sm font-bold transition',
                selectedFactionId === ALL_CONTENT_FILTER ? 'border-[#3f2718]/45 bg-[#4b2c18] text-[#f5ddb4]' : 'border-[#8f6642]/40 bg-[#fff6df] text-[#301a0e] hover:bg-[#fffdf4]',
              ].join(' ')}
              onClick={() => setSelectedFactionId(ALL_CONTENT_FILTER)}
              data-testid="smashup-config-show-all-content"
            >
              {tr(translate, 'configReview.filters.allContent', '全部卡牌/基地')}
            </button>
            <select
              value={typeFilter}
              disabled={!selectedFactionId}
              onChange={(event) => setTypeFilter(event.target.value as ContentTypeFilter)}
              className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none transition focus:ring-2 focus:ring-[#6b4328]/20 disabled:cursor-not-allowed disabled:opacity-55"
              data-testid="smashup-config-type-filter"
            >
              {CONTENT_TYPE_FILTERS.map((type) => (
                <option key={type} value={type}>
                  {tr(translate, `configReview.types.${type}`, TYPE_LABEL_FALLBACKS[type])}
                </option>
              ))}
            </select>
          </>
        )}
        filterKey={`${selectedFactionId ?? 'factions'}:${typeFilter}`}
        getSearchText={(row) => [
          row.searchText,
          row.name,
          row.objectId,
          row.factionId,
          row.factionNameKey,
          formatValue(row, 'name', row.name),
          row.factionId ? getFactionDisplayName(row.factionId, factionMetaById, translate, language) : '',
        ].filter(Boolean).join(' ')}
        getCellValue={getSmashUpConfigReviewCellValue}
        getFieldDefinition={getSmashUpConfigReviewFieldDefinition}
        isFieldApplicable={isSmashUpConfigReviewFieldApplicable}
        formatCellValue={formatValue}
        parseSuggestedValue={(row, fieldKey, rawValue) => parseSuggestedValue(fieldKey, rawValue)}
        buildProposal={({ row, fieldKey, suggestedValue, currentValue, currentDisplayValue, updatedDisplayValue, language, tableId, configVersion }) => ({
          gameId: 'smashup',
          configVersion,
          objectId: row.objectId,
          objectDisplayName: formatValue(row, 'name', row.name),
          objectType: row.objectType,
          fieldPath: row.fieldPaths[fieldKey],
          fieldDisplayName: tr(translate, `configReview.fields.${fieldKey}`, FIELD_LABEL_FALLBACKS.get(fieldKey) ?? fieldKey),
          currentValue,
          suggestedValue,
          currentDisplayValue,
          updatedDisplayValue,
          sourceContext: {
            route: buildRouteHref(),
            tableId,
            rowId: row.rowId,
            cellKey: fieldKey,
            language,
            objectContext: {
              name: row.name,
              factionId: row.factionId,
              objectType: row.objectType,
              sourceContexts: row.sourceContexts,
            },
          },
          status: 'pending_ai_review',
        })}
        renderCell={({ row, columnKey }) => {
          if (columnKey !== 'image') return undefined;
          if (row.objectType === 'faction') {
            const label = tr(translate, 'configReview.actions.openFactionCards', '查看 {{name}} 的卡牌/基地', {
              name: formatValue(row, 'name', row.name),
            });
            return (
              <ConfigFactionIconButton
                row={row}
                faction={factionMetaById.get(row.objectId)}
                label={label}
                onSelect={(factionId) => {
                  setSelectedFactionId(factionId);
                  setTypeFilter('all');
                }}
              />
            );
          }

          const label = tr(translate, 'configReview.actions.magnify', '放大查看 {{name}}', {
            name: formatValue(row, 'name', row.name),
          });
          return (
            <ConfigPreviewButton
              row={row}
              onMagnify={setMagnifiedRow}
              missingLabel={tr(translate, 'configReview.material.noPreview', '缺少可预览素材')}
              magnifyLabel={label}
              previewWarmVersion={previewWarmVersion}
            />
          );
        }}
        footerNotice={tr(
          translate,
          'configReview.auditCoverage',
          '审查字段 {{count}} 项；配置表只生成修正提案，不直接写入运行时配置。',
          { count: SMASHUP_CONFIG_REVIEW_FIELD_DEFINITIONS.filter((field) => field.requiredForAudit).length },
        )}
        initialFeedbackContent={(count) => tr(translate, 'configReview.feedback.initialBatchContent', '大杀四方配置表提交 {{count}} 项修正建议。', { count })}
        runtimeContext={{ mode: 'local', gameId: 'smashup' }}
        testIdPrefix="smashup-config"
        formatVersion={(version) => tr(translate, `configReview.values.configVersion.${version}`, version)}
      />
      <MagnifyOverlay
        isOpen={Boolean(magnifiedRow?.previewRef)}
        onClose={() => setMagnifiedRow(null)}
        closeLabel={tr(translate, 'configReview.actions.closePreview', '关闭预览')}
        overlayClassName="bg-black/50"
        overlayTestId="smashup-config-card-magnify"
      >
        {magnifiedRow?.previewRef ? (
          <div className="relative h-[82vh] w-[min(70vw,620px)]">
            <CardPreview
              key={`${magnifiedRow.rowId}:${previewWarmVersion}`}
              previewRef={magnifiedRow.previewRef}
              className="h-full w-full rounded-xl shadow-2xl"
              title={formatValue(magnifiedRow, 'name', magnifiedRow.name)}
            />
          </div>
        ) : null}
      </MagnifyOverlay>
    </>
  );
};

export default SmashUpConfigReview;
