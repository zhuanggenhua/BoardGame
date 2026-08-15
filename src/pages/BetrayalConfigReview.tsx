import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ImageOff, Maximize2, X } from 'lucide-react';
import { OptimizedImage } from '../components/common/media/OptimizedImage';
import { MagnifyOverlay } from '../components/common/overlays/MagnifyOverlay';
import { ConfigReviewTable, type ConfigReviewColumn } from '../components/config/ConfigReviewTable';
import betrayalAssetManifest from '../../public/assets/i18n/zh-CN/betrayal/assets-manifest.json';
import {
  BETRAYAL_CONFIG_REVIEW_COLUMN_KEYS,
  BETRAYAL_CONFIG_REVIEW_FIELD_DEFINITIONS,
  BETRAYAL_CONFIG_REVIEW_TABLE_ID,
  buildBetrayalConfigReviewTable,
  getBetrayalConfigReviewCellValue,
  getBetrayalConfigReviewFieldDefinition,
  isBetrayalConfigReviewFieldApplicable,
  type BetrayalConfigReviewFieldKey,
  type BetrayalConfigReviewRow,
  type BetrayalConfigReviewType,
} from '../games/betrayal/config/configReviewAdapter';
import {
  buildRoomAtlasImageStyle,
  resolveBetrayalRoomTileVisual,
  type BetrayalRoomTileVisual,
} from '../games/betrayal/roomAtlas';

type RoomPreviewTarget = {
  visual: BetrayalRoomTileVisual;
  visualId: string;
  name: string;
};

type ManifestFileEntry = {
  variants?: Record<string, unknown>;
};

type BetrayalAssetManifest = {
  files?: Record<string, ManifestFileEntry>;
};

type AssetCandidate = {
  asset: string;
  sourceFile: string;
  label: string;
};

type ExplorerAssetFieldKey = 'panelAsset' | 'mapTokenAsset';
type ExplorerAssetTraceFieldKey = 'panelSourceFile' | 'mapTokenSourceFile' | 'mapTokenCompressedAsset';

type AssetPickerState = {
  rowDisplayName: string;
  fieldKey: ExplorerAssetFieldKey;
  fieldLabel: string;
  currentValue: string;
  candidates: readonly AssetCandidate[];
  commitRawValue: (rawValue: string) => void;
};

type BetrayalConfigTranslate = ReturnType<typeof useTranslation>['t'];

const ASSET_VARIANT_ORDER = ['png', 'jpg', 'jpeg', 'webp'] as const;
const betrayalManifestFiles = (betrayalAssetManifest as BetrayalAssetManifest).files ?? {};

function resolveManifestExtension(entry: ManifestFileEntry | undefined): string {
  const variants = entry?.variants ?? {};
  return ASSET_VARIANT_ORDER.find((extension) => variants[extension]) ?? 'png';
}

function formatReadableNameFromSlug(slug: string): string {
  return slug
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.toLocaleLowerCase() === 'md') return 'MD';
      return word.charAt(0).toLocaleUpperCase() + word.slice(1);
    })
    .join(' ');
}

function isTechnicalAssetSlug(slug: string): boolean {
  const normalized = slug.toLocaleLowerCase();
  return normalized.startsWith('http')
    || normalized.length > 48
    || /[0-9a-f]{24,}/i.test(slug);
}

function formatAssetCandidateLabel(assetKey: string, prefix: string, candidateIndex: number): string {
  const slug = assetKey.slice(prefix.length);
  if (isTechnicalAssetSlug(slug)) {
    const candidateType = prefix.includes('tokens/') ? 'Token' : '素材';
    return `${candidateType} 候选 ${String(candidateIndex + 1).padStart(2, '0')}`;
  }
  return formatReadableNameFromSlug(slug);
}

function buildManifestAssetCandidates(prefix: string): AssetCandidate[] {
  return Object.entries(betrayalManifestFiles)
    .filter(([assetKey]) => assetKey.startsWith(prefix) && !assetKey.slice(prefix.length).startsWith('compressed/'))
    .sort(([leftAssetKey], [rightAssetKey]) => leftAssetKey.localeCompare(rightAssetKey))
    .map(([assetKey, entry], candidateIndex) => {
      const extension = resolveManifestExtension(entry);
      return {
        asset: `betrayal/${assetKey}`,
        sourceFile: `public/assets/i18n/zh-CN/betrayal/${assetKey}.${extension}`,
        label: formatAssetCandidateLabel(assetKey, prefix, candidateIndex),
      };
    });
}

const PANEL_ASSET_CANDIDATES = buildManifestAssetCandidates('explorers/');
const MAP_TOKEN_ASSET_CANDIDATES = buildManifestAssetCandidates('tokens/explorers/');

function getAssetCandidatesForField(fieldKey: ExplorerAssetFieldKey): readonly AssetCandidate[] {
  return fieldKey === 'panelAsset' ? PANEL_ASSET_CANDIDATES : MAP_TOKEN_ASSET_CANDIDATES;
}

function formatReadableAssetName(rawValue: string): string {
  const normalized = rawValue.trim();
  if (!normalized) return '未配置';
  const lastPathSegment = normalized.split(/[\\/]/).filter(Boolean).pop() ?? normalized;
  return formatReadableNameFromSlug(lastPathSegment) || normalized;
}

function resolveAssetCandidate(rawValue: string, candidates: readonly AssetCandidate[]): AssetCandidate | undefined {
  return candidates.find((candidate) => candidate.asset === rawValue);
}

function formatAssetDisplayName(rawValue: string, candidates: readonly AssetCandidate[]): string {
  if (!rawValue) return '未配置';
  return resolveAssetCandidate(rawValue, candidates)?.label ?? formatReadableAssetName(rawValue);
}

function formatExplorerAssetDisplayValue(fieldKey: ExplorerAssetFieldKey, value: unknown): string {
  return formatAssetDisplayName(formatCellValue(value), getAssetCandidatesForField(fieldKey));
}

function formatAssetTraceDisplayValue(fieldKey: ExplorerAssetTraceFieldKey, value: unknown): string {
  const rawValue = formatCellValue(value);
  if (!rawValue) return '未配置';
  const extensionMatch = rawValue.match(/\.([a-z0-9]+)$/i);
  const extensionLabel = extensionMatch ? `${extensionMatch[1]!.toLocaleUpperCase()} · ` : '';
  const assetName = formatReadableAssetName(rawValue);
  const statusLabel: Record<ExplorerAssetTraceFieldKey, string> = {
    panelSourceFile: '面板源图已索引',
    mapTokenSourceFile: '地图 Token 源图已索引',
    mapTokenCompressedAsset: '地图 Token 运行压缩图已索引',
  };
  return `${assetName} · ${extensionLabel}${statusLabel[fieldKey]}`;
}

function formatBetrayalConfigReviewDisplayValue(
  row: BetrayalConfigReviewRow,
  fieldKey: BetrayalConfigReviewFieldKey,
  value: unknown,
): string {
  if (row.objectType === 'explorer' && (fieldKey === 'panelAsset' || fieldKey === 'mapTokenAsset')) {
    return formatExplorerAssetDisplayValue(fieldKey, value);
  }
  if (row.objectType === 'explorer' && (fieldKey === 'panelSourceFile' || fieldKey === 'mapTokenSourceFile' || fieldKey === 'mapTokenCompressedAsset')) {
    return formatAssetTraceDisplayValue(fieldKey, value);
  }
  return formatCellValue(value);
}

const TYPE_FILTERS: Array<'all' | BetrayalConfigReviewType> = ['all', 'explorer', 'starting-room', 'room-template', 'scenario-card', 'scenario-config', 'haunt-static'];
const TYPE_FILTER_LABELS: Record<'all' | BetrayalConfigReviewType, string> = {
  all: '全部配置',
  explorer: '探索者角色',
  'starting-room': '起始布局',
  'room-template': '可探索房间',
  'scenario-card': '剧本候选',
  'scenario-config': '剧本运行配置',
  'haunt-static': '作祟静态元数据',
};
const FIELD_LABELS: Record<BetrayalConfigReviewFieldKey, string> = {
  category: '分组',
  name: '名称',
  explorerId: '角色 ID',
  panelAsset: '玩家面板资源',
  panelSourceFile: '面板源图',
  mapTokenAsset: '地图 Token',
  mapTokenSourceFile: 'Token 源图',
  mapTokenCompressedAsset: 'Token 压缩图',
  assetUsageContract: '素材职责',
  floor: '楼层',
  coordinates: '坐标',
  state: '状态',
  visualId: '正面图',
  atlasFrame: '图集帧',
  discoverySymbol: '发现符号',
  doorways: '原始门位 / 固定门',
  orientationTurns: '旋转',
  rotatedDoorways: '旋转后门位',
  connectionStatus: '门连通校验',
  scenarioCardLabel: '剧本卡标签',
  triggerOmenLabel: '触发预兆',
  hauntNumber: '作祟编号',
  implementationStatus: '实现状态',
  implementedScenarioId: '运行剧本',
  runtimeSupport: '运行支持边界',
  runtimeObjective: '作祟前目标',
  hauntObjective: '作祟后目标',
  hauntId: '作祟 ID',
  reward: '奖励',
  sourcePath: '规则来源',
  reviewStatus: '审查状态',
};
const COLUMN_WIDTHS: Record<BetrayalConfigReviewFieldKey, number> = {
  category: 112,
  name: 200,
  explorerId: 180,
  panelAsset: 250,
  panelSourceFile: 420,
  mapTokenAsset: 260,
  mapTokenSourceFile: 430,
  mapTokenCompressedAsset: 460,
  assetUsageContract: 420,
  floor: 96,
  coordinates: 88,
  state: 132,
  visualId: 170,
  atlasFrame: 88,
  discoverySymbol: 180,
  doorways: 360,
  orientationTurns: 120,
  rotatedDoorways: 260,
  connectionStatus: 240,
  scenarioCardLabel: 190,
  triggerOmenLabel: 190,
  hauntNumber: 96,
  implementationStatus: 160,
  implementedScenarioId: 190,
  runtimeSupport: 230,
  runtimeObjective: 320,
  hauntObjective: 320,
  hauntId: 180,
  reward: 240,
  sourcePath: 360,
  reviewStatus: 160,
};

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

function parseSuggestedValue(fieldKey: BetrayalConfigReviewFieldKey, rawValue: string): { value: unknown; error?: string } {
  const definition = getBetrayalConfigReviewFieldDefinition(fieldKey);
  const trimmed = rawValue.trim();
  if (trimmed === '') return { value: '' };
  if (definition.valueKind === 'number') {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? { value: parsed } : { value: trimmed, error: '请输入数字' };
  }
  if (definition.valueKind === 'boolean') {
    if (['true', '是', 'yes', '1'].includes(trimmed.toLocaleLowerCase())) return { value: true };
    if (['false', '否', 'no', '0'].includes(trimmed.toLocaleLowerCase())) return { value: false };
    return { value: trimmed, error: '请输入 true/false 或 是/否' };
  }
  if (definition.valueKind === 'string-array') {
    return { value: trimmed.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean) };
  }
  return { value: trimmed };
}

function resolveRoomPreviewTarget(row: BetrayalConfigReviewRow): RoomPreviewTarget | null {
  const visualId = row.values.visualId;
  if (typeof visualId !== 'string' || visualId.length === 0) return null;
  const visual = resolveBetrayalRoomTileVisual(visualId);
  if (!visual) return null;
  return { visual, visualId, name: row.displayName };
}

function RoomTilePreviewImage({ visual, name, visualId, locale, className = '' }: RoomPreviewTarget & { locale: string; className?: string }) {
  const imageStyle = useMemo(() => buildRoomAtlasImageStyle(visual), [visual]);
  return (
    <div
      role="img"
      aria-label={`${name} 房间图`}
      data-asset-src={visual.image}
      data-atlas-frame-index={visual.frameIndex}
      data-visual-id={visualId}
      className={`relative overflow-hidden rounded-[6px] border border-[#5a3720]/35 bg-[#1d130c] shadow-inner ${className}`}
      style={{ aspectRatio: imageStyle.aspectRatio }}
    >
      <OptimizedImage
        src={visual.image}
        locale={locale}
        alt={`${name} 房间图`}
        draggable={false}
        className="absolute left-0 top-0 max-w-none select-none"
        style={imageStyle}
      />
    </div>
  );
}

function ExplorerAssetPreview({
  row,
  locale,
  panelAsset,
  tokenAsset,
  t,
  onSelectPanel,
  onSelectToken,
}: {
  row: BetrayalConfigReviewRow;
  locale: string;
  panelAsset: string;
  tokenAsset: string;
  t: BetrayalConfigTranslate;
  onSelectPanel: () => void;
  onSelectToken: () => void;
}) {
  if (!panelAsset && !tokenAsset) {
    return (
      <div className="flex h-[64px] w-[152px] items-center justify-center rounded-[6px] border border-[#8f6642]/30 bg-[#ead8b8]/60 text-[#8f6642]">
        <ImageOff aria-hidden="true" className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className="grid h-[64px] w-[152px] grid-cols-2 gap-1"
      data-testid="betrayal-config-explorer-asset-preview"
      data-panel-asset={panelAsset}
      data-map-token-asset={tokenAsset}
    >
      <button
        type="button"
        className="group relative overflow-hidden rounded-[6px] border border-[#5a3720]/35 bg-[#1d130c] text-left outline-none transition hover:ring-2 hover:ring-[#c08a45] focus-visible:ring-2 focus-visible:ring-[#c08a45]"
        title={t('configReview.assets.selectPanelTitle', { asset: panelAsset })}
        aria-label={t('configReview.assets.selectPanelAria', { explorer: row.displayName })}
        data-testid="betrayal-config-explorer-asset-panel-button"
        onClick={onSelectPanel}
      >
        {panelAsset ? (
          <OptimizedImage
            src={panelAsset}
            locale={locale}
            alt={t('configReview.assets.panelAlt', { explorer: row.displayName })}
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : <ImageOff aria-hidden="true" className="m-auto h-4 w-4 text-[#8f6642]" />}
        <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-bold text-[#f6deb4]">
          {t('configReview.assets.panelShortLabel')}
        </span>
      </button>
      <button
        type="button"
        className="group relative overflow-hidden rounded-[6px] border border-[#5a3720]/35 bg-[#1d130c] text-left outline-none transition hover:ring-2 hover:ring-[#c08a45] focus-visible:ring-2 focus-visible:ring-[#c08a45]"
        title={t('configReview.assets.selectTokenTitle', { asset: tokenAsset })}
        aria-label={t('configReview.assets.selectTokenAria', { explorer: row.displayName })}
        data-testid="betrayal-config-explorer-asset-token-button"
        onClick={onSelectToken}
      >
        {tokenAsset ? (
          <OptimizedImage
            src={tokenAsset}
            locale={locale}
            alt={t('configReview.assets.tokenAlt', { explorer: row.displayName })}
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : <ImageOff aria-hidden="true" className="m-auto h-4 w-4 text-[#8f6642]" />}
        <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-bold text-[#f6deb4]">
          {t('configReview.assets.tokenShortLabel')}
        </span>
      </button>
    </div>
  );
}

function AssetPickerFieldCell({
  row,
  fieldKey,
  fieldLabel,
  value,
  displayValue,
  locale,
  t,
  onOpen,
}: {
  row: BetrayalConfigReviewRow;
  fieldKey: ExplorerAssetFieldKey;
  fieldLabel: string;
  value: string;
  displayValue: string;
  locale: string;
  t: BetrayalConfigTranslate;
  onOpen: () => void;
}) {
  const assetPathSuffix = value ? t('configReview.assets.assetPathSuffix', { asset: value }) : '';
  return (
    <button
      type="button"
      className="group flex min-h-[42px] w-full items-center gap-2 rounded-[5px] px-1.5 py-1 text-left text-[11px] font-semibold text-[#3f2718] transition hover:bg-[#efe0bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/25"
      title={t('configReview.assets.pickerCellTitle', { label: fieldLabel, displayValue, assetPath: assetPathSuffix })}
      aria-label={t('configReview.assets.pickerCellAria', { explorer: row.displayName, label: fieldLabel })}
      data-testid={`betrayal-config-asset-picker-cell-${fieldKey}`}
      data-asset={value}
      data-display-value={displayValue}
      onClick={onOpen}
    >
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[4px] border border-[#5a3720]/30 bg-[#1d130c]">
        {value ? (
          <OptimizedImage
            src={value}
            locale={locale}
            alt={t('configReview.assets.pickerCellAlt', { explorer: row.displayName, label: fieldLabel })}
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : <ImageOff aria-hidden="true" className="m-auto h-4 w-4 text-[#8f6642]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold text-[#7b5a40]">{t('configReview.assets.pickerCellLabel', { label: fieldLabel })}</span>
        <span className="block break-words">{displayValue}</span>
      </span>
    </button>
  );
}

function AssetTraceCell({
  rawValue,
  displayValue,
  t,
}: {
  rawValue: string;
  displayValue: string;
  t: BetrayalConfigTranslate;
}) {
  return (
    <span
      className="block min-h-[34px] rounded-[5px] px-1.5 py-1 text-[11px] font-semibold leading-4 text-[#3f2718]"
      title={rawValue || t('configReview.assets.unconfigured')}
      data-asset={rawValue}
    >
      <span className="block text-[10px] font-bold text-[#7b5a40]">{t('configReview.assets.traceLabel')}</span>
      <span className="block break-words">{displayValue}</span>
    </span>
  );
}

function AssetPickerOverlay({
  picker,
  locale,
  t,
  onClose,
}: {
  picker: AssetPickerState | null;
  locale: string;
  t: BetrayalConfigTranslate;
  onClose: () => void;
}) {
  if (!picker) return null;
  const isTokenPicker = picker.fieldKey === 'mapTokenAsset';
  const currentDisplayName = formatAssetDisplayName(picker.currentValue, picker.candidates);
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 px-5 py-6 font-serif"
      role="dialog"
      aria-modal="true"
      data-testid="betrayal-config-asset-picker"
    >
      <div className="flex max-h-[86vh] w-[min(92vw,1120px)] flex-col overflow-hidden rounded-[12px] border border-[#8f6642]/55 bg-[#f2dfb8] text-[#301a0e] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#8f6642]/35 bg-[#3f2718] px-4 py-3 text-[#f3e3c3]">
          <div>
            <div className="text-lg font-bold" data-testid="betrayal-config-asset-picker-title">
              {t('configReview.assets.overlayTitle', { explorer: picker.rowDisplayName, label: picker.fieldLabel })}
            </div>
            <div className="mt-2 flex min-h-[34px] items-center gap-2 text-xs text-[#d9bd8c]">
              {picker.currentValue ? (
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[4px] border border-[#d9bd8c]/45 bg-[#1d130c]">
                  <OptimizedImage
                    src={picker.currentValue}
                    locale={locale}
                    alt={t('configReview.assets.currentAssetAlt', { label: picker.fieldLabel, displayName: currentDisplayName })}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                </span>
              ) : null}
              <span className="font-bold text-[#fff1cf]">
                {isTokenPicker
                  ? t('configReview.assets.currentToken')
                  : t('configReview.assets.currentSelection', { displayName: currentDisplayName })}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-[#f3e3c3]/70 transition hover:bg-white/10 hover:text-[#fff7df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3e3c3]/45"
            aria-label={t('configReview.assets.closePicker')}
            data-testid="betrayal-config-asset-picker-close"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-[#8f6642]/20 bg-[#fff1cf] px-4 py-2 text-xs font-semibold text-[#5e3d27]">
          {isTokenPicker ? t('configReview.assets.tokenPickerHint') : t('configReview.assets.assetPickerHint')}
        </div>
        <div
          className={[
            'grid min-h-0 flex-1 overflow-y-auto p-4',
            isTokenPicker
              ? 'grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2'
              : 'grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-3',
          ].join(' ')}
          data-testid="betrayal-config-asset-picker-options"
        >
          {picker.candidates.map((candidate) => {
            const isSelected = candidate.asset === picker.currentValue;
            return (
              <button
                key={candidate.asset}
                type="button"
                className={[
                  isTokenPicker
                    ? 'relative flex aspect-square items-center justify-center rounded-[8px] border bg-[#1d130c] p-2 shadow-sm transition hover:border-[#d19b58] hover:bg-[#25170e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/35'
                    : 'flex min-h-[164px] flex-col gap-2 rounded-[8px] border bg-[#fff8e6] p-2 text-left shadow-sm transition hover:border-[#9d6a35] hover:bg-[#fff1cf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/35',
                  isSelected ? 'border-[#5f351a] ring-2 ring-[#5f351a]/25' : 'border-[#8f6642]/28',
                ].join(' ')}
                title={t('configReview.assets.candidateTitle', { label: candidate.label, asset: candidate.asset, sourceFile: candidate.sourceFile })}
                aria-label={t('configReview.assets.candidateAria', { fieldLabel: picker.fieldLabel, label: candidate.label })}
                data-testid="betrayal-config-asset-picker-option"
                data-asset={candidate.asset}
                data-source-file={candidate.sourceFile}
                onClick={() => {
                  picker.commitRawValue(candidate.asset);
                  onClose();
                }}
              >
                <span className={[
                  'flex items-center justify-center rounded-[6px] border border-[#5a3720]/25 bg-[#1d130c]',
                  isTokenPicker ? 'h-full w-full' : 'h-20',
                ].join(' ')}>
                  <OptimizedImage
                    src={candidate.asset}
                    locale={locale}
                    alt={t('configReview.assets.candidateAlt', { fieldLabel: picker.fieldLabel, label: candidate.label })}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                </span>
                {!isTokenPicker ? (
                  <>
                    <span className="text-xs font-bold text-[#3f2718]">{candidate.label}</span>
                    {isSelected ? <span className="mt-auto rounded-[4px] bg-[#5f351a] px-2 py-1 text-center text-[10px] font-bold text-[#fff4d5]">{t('configReview.assets.currentSelectionBadge')}</span> : null}
                  </>
                ) : null}
                {isTokenPicker && isSelected ? (
                  <span className="pointer-events-none absolute bottom-1 left-1 right-1 rounded-[4px] bg-[#5f351a]/92 px-1 py-0.5 text-center text-[10px] font-bold text-[#fff4d5]">
                    {t('configReview.assets.currentBadge')}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const BetrayalConfigReview = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('game-betrayal');
  const table = useMemo(() => buildBetrayalConfigReviewTable(), []);
  const [typeFilter, setTypeFilter] = useState<'all' | BetrayalConfigReviewType>('all');
  const [magnifiedRoom, setMagnifiedRoom] = useState<RoomPreviewTarget | null>(null);
  const [assetPicker, setAssetPicker] = useState<AssetPickerState | null>(null);
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'zh-CN';
  const filteredRows = useMemo(() => table.rows.filter((row) => typeFilter === 'all' || row.objectType === typeFilter), [table.rows, typeFilter]);
  const columns = useMemo<ConfigReviewColumn<BetrayalConfigReviewFieldKey>[]>(() => [
    { key: 'image', label: '素材预览', minWidth: 178, sticky: true },
    ...BETRAYAL_CONFIG_REVIEW_COLUMN_KEYS.map((key) => ({
      key,
      label: FIELD_LABELS[key],
      minWidth: COLUMN_WIDTHS[key],
    })),
  ], []);
  const openAssetPicker = (
    row: BetrayalConfigReviewRow,
    fieldKey: ExplorerAssetFieldKey,
    currentValue: string,
    commitRawValue: (rawValue: string) => void,
  ) => {
    setAssetPicker({
      rowDisplayName: row.displayName,
      fieldKey,
      fieldLabel: FIELD_LABELS[fieldKey],
      currentValue,
      candidates: getAssetCandidatesForField(fieldKey),
      commitRawValue,
    });
  };

  return (
    <>
    <ConfigReviewTable
      gameId="betrayal"
      tableId={BETRAYAL_CONFIG_REVIEW_TABLE_ID}
      configVersion={table.configVersion}
      rows={filteredRows}
      columns={columns}
      labels={{
        back: t('configReview.back'),
        searchPlaceholder: t('configReview.searchPlaceholder'),
        pendingCount: (count) => t('configReview.pendingEdits', { count }),
        invalidCount: (count) => `有 ${count} 项输入无效`,
        clearEdits: t('configReview.clearDrafts'),
        submitBatch: (count) => t('configReview.submitEdits', { count }),
        emptyCell: '—',
        cellEditHint: '双击单元格编辑',
        rawValueLabel: '当前值',
        invalidNumber: '请输入数字',
        invalidBoolean: '请输入 true/false 或 是/否',
        horizontalScrollPrimary: '表格可横向滚动查看全部字段',
        horizontalScrollSecondary: '普通滚轮上下滚动，底部滚动条左右浏览',
        visibleRange: (start, end, total) => `显示 ${start}-${end} / ${total}`,
        pageSize: '每页',
        pageStatus: (page, total) => `第 ${page} / ${total} 页`,
        previousPage: '上一页',
        nextPage: '下一页',
      }}
      title={t('configReview.title')}
      description={t('configReview.description', { source: 'scenarioConfig.ts' })}
      onBack={() => navigate(-1)}
      filters={(
        <select className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | BetrayalConfigReviewType)} data-testid="betrayal-config-type-filter">
          {TYPE_FILTERS.map((filter) => <option key={filter} value={filter}>{TYPE_FILTER_LABELS[filter]}</option>)}
        </select>
      )}
      filterKey={typeFilter}
      getSearchText={(row) => row.searchText}
      getCellValue={getBetrayalConfigReviewCellValue}
      getFieldDefinition={getBetrayalConfigReviewFieldDefinition}
      isFieldApplicable={isBetrayalConfigReviewFieldApplicable}
      formatCellValue={(row, fieldKey, value) => formatBetrayalConfigReviewDisplayValue(row, fieldKey, value)}
      parseSuggestedValue={(_row, fieldKey, rawValue) => parseSuggestedValue(fieldKey, rawValue)}
      renderCell={({ row, columnKey, fieldKey, commitRawValue, getEffectiveCellValue }) => {
        if (row.objectType === 'explorer' && fieldKey && (fieldKey === 'panelAsset' || fieldKey === 'mapTokenAsset')) {
          const value = formatCellValue(getEffectiveCellValue(fieldKey));
          const displayValue = formatExplorerAssetDisplayValue(fieldKey, value);
          return (
            <AssetPickerFieldCell
              row={row}
              fieldKey={fieldKey}
              fieldLabel={FIELD_LABELS[fieldKey]}
              value={value}
              displayValue={displayValue}
              locale={locale}
              t={t}
              onOpen={() => openAssetPicker(row, fieldKey, value, (rawValue) => commitRawValue(fieldKey, rawValue))}
            />
          );
        }
        if (row.objectType === 'explorer' && fieldKey && (fieldKey === 'panelSourceFile' || fieldKey === 'mapTokenSourceFile' || fieldKey === 'mapTokenCompressedAsset')) {
          const rawValue = formatCellValue(getEffectiveCellValue(fieldKey));
          return (
            <AssetTraceCell
              rawValue={rawValue}
              displayValue={formatAssetTraceDisplayValue(fieldKey, rawValue)}
              t={t}
            />
          );
        }
        if (columnKey !== 'image') return undefined;
        if (row.objectType === 'explorer') {
          const panelAsset = formatCellValue(getEffectiveCellValue('panelAsset'));
          const tokenAsset = formatCellValue(getEffectiveCellValue('mapTokenAsset'));
          return (
            <ExplorerAssetPreview
              row={row}
              locale={locale}
              panelAsset={panelAsset}
              tokenAsset={tokenAsset}
              t={t}
              onSelectPanel={() => openAssetPicker(row, 'panelAsset', panelAsset, (rawValue) => commitRawValue('panelAsset', rawValue))}
              onSelectToken={() => openAssetPicker(row, 'mapTokenAsset', tokenAsset, (rawValue) => commitRawValue('mapTokenAsset', rawValue))}
            />
          );
        }
        const target = resolveRoomPreviewTarget(row);
        if (!target) {
          return <div className="flex h-[58px] w-[74px] items-center justify-center rounded-[6px] border border-[#8f6642]/30 bg-[#ead8b8]/60 text-[#8f6642]" title={t('configReview.material.noPreview')}><ImageOff aria-hidden="true" className="h-4 w-4" /></div>;
        }
        return (
          <button
            type="button"
            className="group relative block h-[58px] w-[74px] overflow-hidden rounded-[6px] outline-none ring-1 ring-[#5a3720]/30 transition hover:ring-2 hover:ring-[#c08a45] focus-visible:ring-2 focus-visible:ring-[#c08a45]"
            title={`放大查看 ${target.name} 房间图`}
            aria-label={`放大查看 ${target.name} 房间图`}
            data-testid="betrayal-config-room-preview-button"
            onClick={() => setMagnifiedRoom(target)}
          >
            <RoomTilePreviewImage {...target} locale={locale} className="h-full w-full" />
            <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl-[5px] bg-[#2c1a10]/85 p-0.5 text-[#f6deb4] opacity-90 transition group-hover:opacity-100">
              <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
          </button>
        );
      }}
      buildProposal={({ row, fieldKey, suggestedValue, currentValue, currentDisplayValue, updatedDisplayValue, tableId, configVersion, language }) => ({
        gameId: 'betrayal',
        configVersion,
        objectId: row.objectId,
        objectDisplayName: row.displayName,
        objectType: row.objectType,
        fieldPath: row.fieldPaths[fieldKey],
        fieldDisplayName: FIELD_LABELS[fieldKey],
        currentValue,
        suggestedValue,
        currentDisplayValue,
        updatedDisplayValue,
        sourceContext: { route: window.location.href, tableId, rowId: row.rowId, cellKey: fieldKey, language, objectContext: { groupName: row.groupName, sourceContexts: row.sourceContexts } },
        status: 'pending_ai_review',
      })}
      footerNotice={t('configReview.auditCoverage', { count: BETRAYAL_CONFIG_REVIEW_FIELD_DEFINITIONS.filter((field) => field.requiredForAudit).length })}
      initialFeedbackContent={t('configReview.feedbackInitialContent')}
      runtimeContext={{ mode: 'local', gameId: 'betrayal' }}
      testIdPrefix="betrayal-config"
    />
    <AssetPickerOverlay picker={assetPicker} locale={locale} t={t} onClose={() => setAssetPicker(null)} />
    <MagnifyOverlay isOpen={Boolean(magnifiedRoom)} onClose={() => setMagnifiedRoom(null)} closeLabel={t('configReview.material.closePreview')} overlayClassName="bg-black/55" overlayTestId="betrayal-config-room-magnify">
      {magnifiedRoom ? (
        <div className="flex max-h-[88vh] w-[min(88vw,760px)] flex-col gap-3 rounded-[14px] bg-[#2a1a10] p-4 text-[#f7e6c6] shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xl font-bold">{magnifiedRoom.name}</div>
              <div className="text-xs text-[#d9bd8c]">{t('configReview.material.previewMetadata', { visualId: magnifiedRoom.visualId, frameIndex: magnifiedRoom.visual.frameIndex })}</div>
            </div>
          </div>
          <RoomTilePreviewImage {...magnifiedRoom} locale={locale} className="mx-auto max-h-[76vh] w-full" />
        </div>
      ) : null}
    </MagnifyOverlay>
    </>
  );
};

export default BetrayalConfigReview;
