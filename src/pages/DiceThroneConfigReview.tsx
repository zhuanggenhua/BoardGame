import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImageOff, LoaderCircle, Maximize2, MoveHorizontal, Search, Send, Square, Trash2, Volume2 } from 'lucide-react';
import { CardPreview } from '../components/common/media/CardPreview';
import { MagnifyOverlay } from '../components/common/overlays/MagnifyOverlay';
import { FeedbackModal } from '../components/system/FeedbackModal';
import type { FeedbackConfigProposal } from '../lib/feedback/feedbackPayload';
import { AudioManager } from '../lib/audio/AudioManager';
import {
  COMMON_AUDIO_BASE_PATH,
  loadCommonAudioRegistry,
  type AudioRegistryEntry,
} from '../lib/audio/commonRegistry';
import {
  buildDiceThroneConfigReviewTable,
  DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS,
  DICETHRONE_CONFIG_REVIEW_TABLE_ID,
  getDiceThroneConfigReviewCellValue,
  getDiceThroneConfigReviewFieldDefinition,
  isDiceThroneConfigReviewFieldApplicable,
  type DiceThroneConfigReviewFieldKey,
  type DiceThroneConfigReviewRow,
  type DiceThroneConfigReviewType,
} from '../games/dicethrone/config/configReviewAdapter';
import { initDiceThroneCardAtlases } from '../games/dicethrone/ui/cardAtlas';
import { formatDiceThroneConfigReviewDiceFaceName } from './diceThroneConfigReviewDisplay';
import phraseMappingsData from '../assets/audio/phrase-mappings.zh-CN.json';

const TYPE_FILTERS: Array<'all' | DiceThroneConfigReviewType> = [
  'all',
  'character',
  'diceFace',
  'ability',
  'card',
  'token',
];

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

const BOOLEAN_FIELD_KEYS = new Set<DiceThroneConfigReviewFieldKey>(['isAttackModifier']);

const AUDIO_PHRASES = (phraseMappingsData as { phrases?: Record<string, string> }).phrases ?? {};

const CONFIG_REVIEW_ENUM_VALUES: Partial<Record<DiceThroneConfigReviewFieldKey, readonly string[]>> = {
  cardType: ['action', 'upgrade'],
  timing: ['main', 'roll', 'instant'],
  abilityType: ['offensive', 'defensive', 'utility', 'passive'],
  tokenCategory: ['buff', 'debuff', 'consumable'],
  tags: ['defensive', 'ultimate', 'unblockable', 'uninterruptible'],
};

interface PendingConfigEdit {
  row: DiceThroneConfigReviewRow;
  fieldKey: DiceThroneConfigReviewFieldKey;
  rawValue: string;
  parsedValue: unknown;
  error?: string;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function tr(translate: TranslateFn, key: string, defaultValue: string, options: Record<string, unknown> = {}): string {
  return translate(key, { ...options, defaultValue });
}

function getEditKey(row: DiceThroneConfigReviewRow, fieldKey: DiceThroneConfigReviewFieldKey): string {
  return `${row.rowId}:${fieldKey}`;
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function extractAudioStem(name: string): string {
  return name.replace(/\s+\d+[A-Za-z]?$/, '').replace(/\s+[A-Za-z]$/, '').trim();
}

function audioFriendlyNameBase(key: string): string {
  const parts = key.split('.');
  const last = parts[parts.length - 1] ?? key;
  const cleaned = last.replace(/(_(?:krst|none))+$/i, '');
  return cleaned.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}

function audioKeyDisplayNumber(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(index);
    hash |= 0;
  }
  return String(Math.abs(hash) % 10000).padStart(4, '0');
}

function formatAudioVariantSuffix(suffix: string): string {
  const normalized = suffix.trim();
  if (!normalized) return '';
  const alphabetIndex = /^[a-z]$/i.test(normalized)
    ? normalized.toUpperCase().charCodeAt(0) - 64
    : 0;
  if (alphabetIndex > 0) return `变体 ${alphabetIndex}`;
  if (/^\d+$/.test(normalized)) return `第 ${Number(normalized)} 版`;
  return `变体 ${audioKeyDisplayNumber(normalized)}`;
}

function formatAudioDisplayName(value: unknown): string {
  const key = String(value ?? '');
  if (!key) return '';
  const base = audioFriendlyNameBase(key);
  const stem = extractAudioStem(base);
  const translated = AUDIO_PHRASES[stem];
  if (!translated) return `音效 ${audioKeyDisplayNumber(key)}`;
  const suffix = base.slice(stem.length).trim();
  const displaySuffix = formatAudioVariantSuffix(suffix);
  return displaySuffix ? `${translated} ${displaySuffix}` : translated;
}

function normalizeEditToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function addEditAlias<T>(aliases: Map<string, T>, label: string | undefined, value: T) {
  if (!label) return;
  aliases.set(normalizeEditToken(label), value);
}

function buildTranslatedAliasMap(
  translate: TranslateFn,
  namespace: string,
  values: readonly string[],
): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const value of values) {
    addEditAlias(aliases, value, value);
    addEditAlias(aliases, tr(translate, `${namespace}.${value}`, value), value);
  }
  return aliases;
}

function splitEditableListInput(rawValue: string): string[] {
  const trimmed = rawValue.trim();
  if (!trimmed) return [];
  const separator = trimmed.includes('、') ? /、/ : /[,\n;，；]+/;
  return trimmed.split(separator).map((part) => part.trim()).filter(Boolean);
}

function parseBooleanDisplayValue(rawValue: string, translate: TranslateFn): boolean | string {
  const aliases = new Map<string, boolean>([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['是', true],
    [normalizeEditToken(tr(translate, 'configReview.values.boolean.true', '是')), true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['否', false],
    [normalizeEditToken(tr(translate, 'configReview.values.boolean.false', '否')), false],
  ]);
  return aliases.get(normalizeEditToken(rawValue)) ?? rawValue.trim();
}

function parseLocalizedScalarValue(
  fieldKey: DiceThroneConfigReviewFieldKey,
  rawValue: string,
  translate: TranslateFn,
  sfxKeyByDisplayName: Map<string, string>,
): unknown {
  const trimmed = rawValue.trim();
  if (BOOLEAN_FIELD_KEYS.has(fieldKey)) return parseBooleanDisplayValue(trimmed, translate);
  if (fieldKey === 'sfxKey') return sfxKeyByDisplayName.get(normalizeEditToken(trimmed)) ?? (trimmed || undefined);

  const enumValues = CONFIG_REVIEW_ENUM_VALUES[fieldKey];
  if (enumValues) {
    const aliases = buildTranslatedAliasMap(translate, `configReview.values.${fieldKey}`, enumValues);
    return aliases.get(normalizeEditToken(trimmed)) ?? (trimmed || undefined);
  }

  return trimmed || undefined;
}

function parseSuggestedValue(
  fieldKey: DiceThroneConfigReviewFieldKey,
  rawValue: string,
  translate: TranslateFn,
  sfxKeyByDisplayName: Map<string, string>,
): unknown {
  const trimmed = rawValue.trim();
  const { valueKind } = getDiceThroneConfigReviewFieldDefinition(fieldKey);
  if (valueKind === 'string-array') {
    return splitEditableListInput(trimmed).map((part) => parseLocalizedScalarValue(
      fieldKey,
      part,
      translate,
      sfxKeyByDisplayName,
    ));
  }
  if (valueKind === 'number') return trimmed === '' ? undefined : Number(trimmed);
  return parseLocalizedScalarValue(fieldKey, trimmed, translate, sfxKeyByDisplayName);
}

function areConfigValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function formatLocalizedKey(value: unknown, translate: TranslateFn): string {
  const key = String(value);
  if (!key) return '';
  return tr(translate, key, key);
}

function formatCellDisplayValue(
  row: DiceThroneConfigReviewRow,
  fieldKey: DiceThroneConfigReviewFieldKey,
  value: unknown,
  translate: TranslateFn,
): string {
  if (value === undefined || value === null) return '';

  switch (fieldKey) {
    case 'name':
      if (row.objectType === 'diceFace' && value === row.name) {
        return formatDiceThroneConfigReviewDiceFaceName(row, translate);
      }
      return formatLocalizedKey(value, translate);
    case 'description':
      return formatLocalizedKey(value, translate);
    case 'character':
      return tr(translate, `characters.${String(value)}`, String(value));
    case 'cardType':
      return tr(translate, `configReview.values.cardType.${String(value)}`, String(value));
    case 'timing':
      return tr(translate, `configReview.values.timing.${String(value)}`, String(value));
    case 'abilityType':
      return tr(translate, `configReview.values.abilityType.${String(value)}`, String(value));
    case 'tokenCategory':
      return tr(translate, `configReview.values.tokenCategory.${String(value)}`, String(value));
    case 'diceSymbols':
      return Array.isArray(value)
        ? value.map((symbol) => tr(translate, `dice.face.${String(symbol)}`, String(symbol))).join('、')
        : tr(translate, `dice.face.${String(value)}`, String(value));
    case 'tags':
      return Array.isArray(value)
        ? value.map((tag) => tr(translate, `configReview.values.tags.${String(tag)}`, String(tag))).join('、')
        : tr(translate, `configReview.values.tags.${String(value)}`, String(value));
    case 'isAttackModifier':
      return tr(translate, `configReview.values.boolean.${String(value)}`, String(value));
    case 'sfxKey':
      return formatAudioDisplayName(value);
    default:
      return formatCellValue(value);
  }
}

function fieldWidthClass(fieldKey: DiceThroneConfigReviewFieldKey): string {
  switch (fieldKey) {
    case 'name':
      return 'w-[168px]';
    case 'description':
      return 'w-[300px]';
    case 'sfxKey':
      return 'w-[220px]';
    case 'character':
    case 'diceSymbols':
    case 'tags':
      return 'w-[150px]';
    default:
      return 'w-[96px]';
  }
}

function stickyColumnClass(columnKey: 'image' | DiceThroneConfigReviewFieldKey): string {
  switch (columnKey) {
    case 'image':
      return 'sticky left-0 z-[2] w-[70px] shadow-[2px_0_0_rgba(143,102,66,0.18)]';
    default:
      return '';
  }
}

function stickyHeaderClass(columnKey: 'image' | DiceThroneConfigReviewFieldKey): string {
  const stickyClass = stickyColumnClass(columnKey);
  return stickyClass ? `${stickyClass.replace('z-[2]', 'z-[12]')} bg-[#3f2718]` : '';
}

function buildConfigProposal(
  row: DiceThroneConfigReviewRow,
  fieldKey: DiceThroneConfigReviewFieldKey,
  suggestedValue: unknown,
  language: string,
  configVersion: string,
  objectDisplayName: string,
  fieldDisplayName: string,
  currentDisplayValue: string,
  updatedDisplayValue: string,
): Omit<FeedbackConfigProposal, 'reason'> & { reason?: string } {
  return {
    gameId: 'dicethrone',
    configVersion,
    objectId: row.objectId,
    objectDisplayName,
    objectType: row.objectType,
    fieldPath: row.fieldPaths[fieldKey],
    fieldDisplayName,
    currentValue: getDiceThroneConfigReviewCellValue(row, fieldKey),
    suggestedValue,
    currentDisplayValue,
    updatedDisplayValue,
    sourceContext: {
      route: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}${window.location.hash}` : undefined,
      tableId: DICETHRONE_CONFIG_REVIEW_TABLE_ID,
      rowId: row.rowId,
      cellKey: fieldKey,
      language,
      objectContext: {
        name: row.name,
        characterId: row.characterId,
        objectType: row.objectType,
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
  row: DiceThroneConfigReviewRow;
  fieldKey: DiceThroneConfigReviewFieldKey;
  label: string;
  placeholder: string;
  editHint: string;
  rawValueLabel: string;
  pendingEdit?: PendingConfigEdit;
  formatDisplayValue: (value: unknown) => string;
  onCommit: (params: { row: DiceThroneConfigReviewRow; fieldKey: DiceThroneConfigReviewFieldKey; rawValue: string }) => void;
}) {
  const applicable = isDiceThroneConfigReviewFieldApplicable(row, fieldKey);
  const currentValue = getDiceThroneConfigReviewCellValue(row, fieldKey);
  const currentDisplayText = applicable ? formatDisplayValue(currentValue) : '';
  const pendingDisplayText = pendingEdit ? (pendingEdit.error ? pendingEdit.rawValue : formatDisplayValue(pendingEdit.parsedValue)) : undefined;
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

  const commit = () => {
    if (!applicable) return;
    setIsEditing(false);
    if (draft.trim() === editText.trim()) return;
    onCommit({ row, fieldKey, rawValue: draft });
  };

  if (!applicable) {
    return <span className="block min-h-[30px] text-[#9b7a5e]/45">—</span>;
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label={label}
        className="h-8 w-full rounded-[4px] border border-[#7a4f31]/55 bg-[#fffaf0] px-2 text-xs font-semibold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setDraft(editText);
            setIsEditing(false);
          }
        }}
        data-testid={`dicethrone-config-cell-editor-${fieldKey}`}
      />
    );
  }

  return (
    <button
      type="button"
      className={[
        'group flex min-h-[30px] w-full items-center rounded-[4px] px-1.5 text-left transition',
        pendingEdit?.error ? 'bg-red-100 text-red-800' : pendingEdit ? 'bg-[#e4c27d]/45 text-[#301a0e]' : 'text-[#3f2718]',
        'hover:bg-[#efe0bd]',
      ].join(' ')}
      title={`${editHint}\n${rawValueLabel}: ${currentDisplayText || placeholder}`}
      onDoubleClick={() => {
        setDraft(editText);
        setIsEditing(true);
      }}
      data-testid={`dicethrone-config-cell-${fieldKey}`}
    >
      <span className="line-clamp-2 break-words text-[11px] leading-[1.28]">
        {displayText || <span className="text-[#9b7a5e]/58">{placeholder}</span>}
      </span>
    </button>
  );
}

function ConfigCardPreviewButton({
  row,
  onMagnify,
  missingLabel,
  magnifyLabel,
}: {
  row: DiceThroneConfigReviewRow;
  onMagnify: (row: DiceThroneConfigReviewRow) => void;
  missingLabel: string;
  magnifyLabel: string;
}) {
  if (!row.previewRef) {
    return (
      <div
        className="flex h-[42px] w-[42px] items-center justify-center rounded-[5px] border border-[#8f6642]/24 bg-[#ead8b8]/70 text-[#7b5a40]"
        title={missingLabel}
      >
        <ImageOff aria-hidden="true" className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group relative h-[42px] w-[42px] overflow-hidden rounded-[5px] border border-[#6f4b32]/30 bg-[#ead8b8] shadow-[0_2px_5px_rgba(63,39,24,0.12)]"
      onClick={() => onMagnify(row)}
      aria-label={magnifyLabel}
      data-testid="dicethrone-config-card-preview"
    >
      <CardPreview previewRef={row.previewRef} className="h-full w-full object-cover" title={row.name} />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
        <Maximize2 aria-hidden="true" className="h-4 w-4" />
      </span>
    </button>
  );
}

function AudioPreviewButton({
  sfxKey,
  entry,
  isPlaying,
  isLoading,
  previewLabel,
  stopLabel,
  loadingLabel,
  missingLabel,
  onPreview,
}: {
  sfxKey: string;
  entry?: AudioRegistryEntry;
  isPlaying: boolean;
  isLoading: boolean;
  previewLabel: string;
  stopLabel: string;
  loadingLabel: string;
  missingLabel: string;
  onPreview: (sfxKey: string) => void;
}) {
  const disabled = !entry;
  const title = disabled
    ? missingLabel
    : isLoading
      ? loadingLabel
      : isPlaying
        ? stopLabel
        : previewLabel;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPreview(sfxKey)}
      className={[
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border text-[#4b2c18] transition',
        disabled
          ? 'cursor-not-allowed border-[#8f6642]/18 bg-[#ead8b8]/60 opacity-45'
          : 'border-[#8f6642]/38 bg-[#fff7df] hover:bg-[#f5dfaf]',
        isPlaying ? 'border-[#3f2718]/45 bg-[#4b2c18] text-[#f5ddb4] hover:bg-[#321c0e]' : '',
      ].join(' ')}
      title={title}
      aria-label={title}
      data-testid="dicethrone-config-audio-preview"
    >
      {isLoading ? (
        <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <Square aria-hidden="true" className="h-3.5 w-3.5" />
      ) : (
        <Volume2 aria-hidden="true" className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export const DiceThroneConfigReview = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('game-dicethrone');
  const translate = useCallback<TranslateFn>(
    (key, options = {}) => String(t(key, { ...options, defaultValue: String(options.defaultValue ?? key) })),
    [t],
  );
  const table = useMemo(() => {
    initDiceThroneCardAtlases();
    return buildDiceThroneConfigReviewTable();
  }, []);

  const characterOptions = useMemo(() => Array.from(new Set(table.rows.map((row) => row.characterId))), [table.rows]);
  const [query, setQuery] = useState('');
  const [characterFilter, setCharacterFilter] = useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DiceThroneConfigReviewType>('all');
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingEdits, setPendingEdits] = useState<Record<string, PendingConfigEdit>>({});
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [magnifiedRow, setMagnifiedRow] = useState<DiceThroneConfigReviewRow | null>(null);
  const tableScrollerRef = useRef<HTMLDivElement>(null);
  const [audioEntriesByKey, setAudioEntriesByKey] = useState<Map<string, AudioRegistryEntry>>(() => new Map());
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState<string | null>(null);
  const playingAudioKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadCommonAudioRegistry()
      .then((payload) => {
        if (cancelled) return;
        AudioManager.registerRegistryEntries(payload.entries, COMMON_AUDIO_BASE_PATH);
        AudioManager.initialize();
        setAudioEntriesByKey(new Map(payload.entries.map((entry) => [entry.key, entry])));
        setAudioLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setAudioLoadError(String(error?.message ?? error));
      });

    return () => {
      cancelled = true;
      if (playingAudioKeyRef.current) {
        AudioManager.stopSfx(playingAudioKeyRef.current);
        playingAudioKeyRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!loadingAudioKey) return undefined;

    const syncLoadingState = () => {
      const state = AudioManager.getSfxLoadState(loadingAudioKey);
      if (state === 'loading') return;
      setLoadingAudioKey((current) => (current === loadingAudioKey ? null : current));
      if (state === 'failed' || state === 'missing') {
        setPlayingAudioKey((current) => (current === loadingAudioKey ? null : current));
        if (playingAudioKeyRef.current === loadingAudioKey) {
          playingAudioKeyRef.current = null;
        }
      }
    };

    syncLoadingState();
    const timer = window.setInterval(syncLoadingState, 120);
    return () => window.clearInterval(timer);
  }, [loadingAudioKey]);

  const sfxKeyByDisplayName = useMemo(() => {
    const aliases = new Map<string, string>();
    for (const key of audioEntriesByKey.keys()) {
      addEditAlias(aliases, key, key);
      addEditAlias(aliases, formatAudioDisplayName(key), key);
    }
    for (const row of table.rows) {
      if (!row.sfxKey) continue;
      addEditAlias(aliases, row.sfxKey, row.sfxKey);
      addEditAlias(aliases, formatAudioDisplayName(row.sfxKey), row.sfxKey);
    }
    return aliases;
  }, [audioEntriesByKey, table.rows]);

  const handleAudioPreview = useCallback((sfxKey: string) => {
    const entry = audioEntriesByKey.get(sfxKey);
    if (!entry) return;

    if (playingAudioKeyRef.current === sfxKey) {
      AudioManager.stopSfx(sfxKey);
      playingAudioKeyRef.current = null;
      setPlayingAudioKey(null);
      setLoadingAudioKey(null);
      return;
    }

    if (playingAudioKeyRef.current) {
      AudioManager.stopSfx(playingAudioKeyRef.current);
    }

    playingAudioKeyRef.current = sfxKey;
    setPlayingAudioKey(sfxKey);
    AudioManager.play(sfxKey, undefined, () => {
      if (playingAudioKeyRef.current !== sfxKey) return;
      playingAudioKeyRef.current = null;
      setPlayingAudioKey(null);
      setLoadingAudioKey(null);
    });

    const state = AudioManager.getSfxLoadState(sfxKey);
    if (state === 'missing' || state === 'failed') {
      playingAudioKeyRef.current = null;
      setPlayingAudioKey(null);
      setLoadingAudioKey(null);
      return;
    }
    setLoadingAudioKey(state === 'loading' ? sfxKey : null);
  }, [audioEntriesByKey]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return table.rows.filter((row) => {
      if (characterFilter !== 'all' && row.characterId !== characterFilter) return false;
      if (typeFilter !== 'all' && row.objectType !== typeFilter) return false;
      if (!normalizedQuery) return true;
      return row.searchText.includes(normalizedQuery)
        || formatCellDisplayValue(row, 'name', row.name, translate).toLowerCase().includes(normalizedQuery)
        || formatCellDisplayValue(row, 'character', row.characterId, translate).toLowerCase().includes(normalizedQuery);
    });
  }, [characterFilter, query, table.rows, translate, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = visibleRows.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const pageRangeStart = visibleRows.length === 0 ? 0 : pageStartIndex + 1;
  const pageRangeEnd = visibleRows.length === 0 ? 0 : Math.min(pageStartIndex + pageSize, visibleRows.length);
  const pagedRows = useMemo(() => visibleRows.slice(pageStartIndex, pageStartIndex + pageSize), [pageSize, pageStartIndex, visibleRows]);

  const pendingEditList = useMemo(() => Object.values(pendingEdits), [pendingEdits]);
  const invalidEditCount = pendingEditList.filter((edit) => edit.error).length;
  const validPendingEdits = pendingEditList.filter((edit) => !edit.error);
  const feedbackProposals = useMemo(() => validPendingEdits.map((edit) => {
    const currentValue = getDiceThroneConfigReviewCellValue(edit.row, edit.fieldKey);
    return buildConfigProposal(
      edit.row,
      edit.fieldKey,
      edit.parsedValue,
      i18n.language || 'zh-CN',
      table.configVersion,
      formatCellDisplayValue(edit.row, 'name', edit.row.name, translate),
      t(`configReview.fields.${edit.fieldKey}`),
      formatCellDisplayValue(edit.row, edit.fieldKey, currentValue, translate),
      formatCellDisplayValue(edit.row, edit.fieldKey, edit.parsedValue, translate),
    );
  }), [i18n.language, table.configVersion, t, translate, validPendingEdits]);

  useEffect(() => {
    tableScrollerRef.current?.scrollTo({ left: 0, top: 0 });
  }, [characterFilter, pageSize, query, safeCurrentPage, typeFilter]);

  const handleCellCommit = ({ row, fieldKey, rawValue }: {
    row: DiceThroneConfigReviewRow;
    fieldKey: DiceThroneConfigReviewFieldKey;
    rawValue: string;
  }) => {
    const editKey = getEditKey(row, fieldKey);
    const currentValue = getDiceThroneConfigReviewCellValue(row, fieldKey);
    const parsedValue = parseSuggestedValue(fieldKey, rawValue, translate, sfxKeyByDisplayName);
    const trimmed = rawValue.trim();
    const { valueKind } = getDiceThroneConfigReviewFieldDefinition(fieldKey);

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
      [editKey]: { row, fieldKey, rawValue, parsedValue, error: errorMessage },
    }));
  };

  const selectedPreviewRef = magnifiedRow?.previewRef ?? null;
  const selectedAspectRatio = selectedPreviewRef && 'aspectRatio' in selectedPreviewRef
    ? selectedPreviewRef.aspectRatio
    : 700 / 980;

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
                data-testid="dicethrone-config-back-button"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t('configReview.actions.back')}
              </button>
              <h1 className="text-[clamp(24px,2.8vw,38px)] font-bold leading-none text-[#301a0e]">
                {t('configReview.title')}
              </h1>
            </div>
            <div className="text-right text-xs font-semibold leading-5 text-[#6d4d34]" title={table.configVersion}>
              {t('configReview.stats.compactStatus', {
                version: table.configVersion,
                visible: visibleRows.length,
                total: table.rows.length,
                pageRows: pagedRows.length,
              })}
            </div>
          </div>

          <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(260px,1fr)_180px_160px_auto]">
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
                data-testid="dicethrone-config-search"
              />
            </label>
            <select
              value={characterFilter}
              onChange={(event) => {
                setCharacterFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20"
              data-testid="dicethrone-config-character-filter"
            >
              <option value="all">{t('configReview.filters.allCharacters')}</option>
              {characterOptions.map((characterId) => (
                <option key={characterId} value={characterId}>
                  {t(`characters.${characterId}`)}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as 'all' | DiceThroneConfigReviewType);
                setCurrentPage(1);
              }}
              className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20"
              data-testid="dicethrone-config-type-filter"
            >
              {TYPE_FILTERS.map((type) => (
                <option key={type} value={type}>
                  {t(`configReview.types.${type}`)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="whitespace-nowrap px-1 text-xs font-semibold text-[#4b2c18]" data-testid="dicethrone-config-pending-count">
                {t('configReview.feedback.pendingCount', { count: pendingEditList.length })}
              </span>
              {invalidEditCount > 0 ? (
                <span className="rounded-[4px] border border-red-700/35 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800" data-testid="dicethrone-config-invalid-count">
                  {t('configReview.feedback.invalidCount', { count: invalidEditCount })}
                </span>
              ) : null}
              <button
                type="button"
                disabled={pendingEditList.length === 0}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-xs font-bold text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setPendingEdits({})}
                data-testid="dicethrone-config-clear-edits"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                {t('configReview.actions.clearEdits')}
              </button>
              <button
                type="button"
                disabled={validPendingEdits.length === 0 || invalidEditCount > 0}
                className="inline-flex min-h-[34px] items-center gap-2 rounded-[4px] border border-[#3f2718]/45 bg-[#4b2c18] px-3 text-xs font-bold text-[#f5ddb4] shadow-[0_3px_8px_rgba(75,44,24,0.18)] transition hover:bg-[#321c0e] disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => setIsFeedbackOpen(true)}
                data-testid="dicethrone-config-submit-edits"
              >
                <Send aria-hidden="true" className="h-4 w-4" />
                {t('configReview.actions.submitBatch', { count: validPendingEdits.length })}
              </button>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-[clamp(8px,1.2vw,16px)]">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] bg-[#fff1cf]/62 px-3 py-1.5 text-xs font-semibold text-[#5e3d27]">
            <span className="inline-flex items-center gap-2 text-[#4b2c18]" data-testid="dicethrone-config-horizontal-scroll-hint">
              <MoveHorizontal aria-hidden="true" className="h-4 w-4" />
              {t('configReview.tableScroll.primaryHint')}
            </span>
            <span className="text-[#7b5a40]">{t('configReview.tableScroll.secondaryHint')}</span>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={tableScrollerRef}
              style={{ scrollbarGutter: 'stable both-edges', scrollbarWidth: 'auto', scrollbarColor: '#6b4328 #ead8b8' }}
              className="h-full min-h-0 overflow-x-scroll overflow-y-auto rounded-[8px] border border-[#8f6642]/35 bg-[#fff3d7] shadow-inner"
              data-testid="dicethrone-config-table"
            >
              <table className="w-full min-w-[2600px] border-separate border-spacing-0 text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#3f2718] text-[#f3e3c3] shadow-[0_2px_0_rgba(0,0,0,0.12)]">
                  <tr>
                    {DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS.map((columnKey) => (
                      <th
                        key={columnKey}
                        className={[
                          'whitespace-nowrap px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em]',
                          stickyHeaderClass(columnKey),
                          columnKey !== 'image' ? fieldWidthClass(columnKey) : '',
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
                        {DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS.map((columnKey) => (
                          <td
                            key={`${row.rowId}:${columnKey}`}
                            className={[
                              'border-t border-[#8f6642]/18 px-2 py-0.5 align-middle',
                              rowBackgroundClass,
                              stickyColumnClass(columnKey),
                              columnKey !== 'image' ? fieldWidthClass(columnKey) : '',
                            ].join(' ')}
                          >
                            {columnKey === 'image' ? (
                              <ConfigCardPreviewButton
                                row={row}
                                onMagnify={setMagnifiedRow}
                                missingLabel={t('configReview.material.noPreview')}
                                magnifyLabel={t('configReview.actions.magnify', { name: formatCellDisplayValue(row, 'name', row.name, translate) })}
                              />
                            ) : columnKey === 'sfxKey' ? (
                              <div className="flex min-h-[30px] items-center gap-1.5">
                                <ConfigProposalCell
                                  row={row}
                                  fieldKey={columnKey}
                                  label={t(`configReview.fields.${columnKey}`)}
                                  placeholder={t('configReview.feedback.emptyCell')}
                                  editHint={t('configReview.feedback.cellEditHint')}
                                  rawValueLabel={t('configReview.feedback.rawValueLabel')}
                                  pendingEdit={pendingEdits[getEditKey(row, columnKey)]}
                                  formatDisplayValue={(value) => formatCellDisplayValue(row, columnKey, value, translate)}
                                  onCommit={handleCellCommit}
                                />
                                {(() => {
                                  const pendingEdit = pendingEdits[getEditKey(row, columnKey)];
                                  const previewValue = pendingEdit && !pendingEdit.error
                                    ? pendingEdit.parsedValue
                                    : getDiceThroneConfigReviewCellValue(row, columnKey);
                                  const sfxKey = typeof previewValue === 'string' ? previewValue : '';
                                  return sfxKey ? (
                                    <AudioPreviewButton
                                      sfxKey={sfxKey}
                                      entry={audioEntriesByKey.get(sfxKey)}
                                      isPlaying={playingAudioKey === sfxKey}
                                      isLoading={loadingAudioKey === sfxKey}
                                      previewLabel={t('configReview.audio.preview', { name: formatAudioDisplayName(sfxKey) })}
                                      stopLabel={t('configReview.audio.stop', { name: formatAudioDisplayName(sfxKey) })}
                                      loadingLabel={t('configReview.audio.loading', { name: formatAudioDisplayName(sfxKey) })}
                                      missingLabel={audioLoadError
                                        ? t('configReview.audio.loadFailed')
                                        : t('configReview.audio.missing')}
                                      onPreview={handleAudioPreview}
                                    />
                                  ) : null;
                                })()}
                              </div>
                            ) : (
                              <ConfigProposalCell
                                row={row}
                                fieldKey={columnKey}
                                label={t(`configReview.fields.${columnKey}`)}
                                placeholder={t('configReview.feedback.emptyCell')}
                                editHint={t('configReview.feedback.cellEditHint')}
                                rawValueLabel={t('configReview.feedback.rawValueLabel')}
                                pendingEdit={pendingEdits[getEditKey(row, columnKey)]}
                                formatDisplayValue={(value) => formatCellDisplayValue(row, columnKey, value, translate)}
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
            data-testid="dicethrone-config-pagination"
          >
            <span data-testid="dicethrone-config-visible-range">
              {t('configReview.pagination.visibleRange', { start: pageRangeStart, end: pageRangeEnd, total: visibleRows.length })}
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
                  data-testid="dicethrone-config-page-size"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <span className="rounded-[4px] border border-[#8f6642]/22 bg-[#fff6df] px-2 py-1 text-[#301a0e]" data-testid="dicethrone-config-page-status">
                {t('configReview.pagination.pageStatus', { page: safeCurrentPage, total: totalPages })}
              </span>
              <button
                type="button"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="min-h-[32px] rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                data-testid="dicethrone-config-prev-page"
              >
                {t('configReview.actions.previousPage')}
              </button>
              <button
                type="button"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="min-h-[32px] rounded-[4px] border border-[#8f6642]/38 bg-[#fff7df] px-2.5 text-[#4b2c18] transition hover:bg-[#f9edcf] disabled:cursor-not-allowed disabled:opacity-45"
                data-testid="dicethrone-config-next-page"
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
        overlayTestId="dicethrone-config-card-magnify"
      >
        {selectedPreviewRef && magnifiedRow ? (
          <div
            className="relative bg-transparent"
            style={{
              width: 'min(66vw, 520px)',
              height: `calc(min(66vw, 520px) / ${selectedAspectRatio})`,
              maxHeight: '82vh',
              aspectRatio: selectedAspectRatio,
            }}
          >
            <CardPreview
              previewRef={selectedPreviewRef}
              className="h-full w-full rounded-xl shadow-2xl"
              title={formatCellDisplayValue(magnifiedRow, 'name', magnifiedRow.name, translate)}
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
          runtimeContext={{ mode: 'local', gameId: 'dicethrone' }}
          configProposals={feedbackProposals}
          initialContent={t('configReview.feedback.initialBatchContent', { count: feedbackProposals.length })}
        />
      ) : null}
    </main>
  );
};

export default DiceThroneConfigReview;
