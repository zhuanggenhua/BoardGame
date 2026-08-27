import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ImageOff, LoaderCircle, Maximize2, Square, Volume2 } from 'lucide-react';
import { CardPreview } from '../components/common/media/CardPreview';
import { MagnifyOverlay } from '../components/common/overlays/MagnifyOverlay';
import { ConfigReviewTable, type ConfigReviewColumn } from '../components/config/ConfigReviewTable';
import { AudioManager } from '../lib/audio/AudioManager';
import { COMMON_AUDIO_BASE_PATH, loadCommonAudioRegistry, type AudioRegistryEntry } from '../lib/audio/commonRegistry';
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
import {
  formatDiceThroneConfigReviewCardType,
  formatDiceThroneConfigReviewDiceFaceName,
} from './diceThroneConfigReviewDisplay';
import phraseMappingsData from '../assets/audio/phrase-mappings.zh-CN.json';

const TYPE_FILTERS: Array<'all' | DiceThroneConfigReviewType> = ['all', 'character', 'diceFace', 'ability', 'card', 'token'];
const BOOLEAN_FIELD_KEYS = new Set<DiceThroneConfigReviewFieldKey>(['isAttackModifier']);
const AUDIO_PHRASES = (phraseMappingsData as { phrases?: Record<string, string> }).phrases ?? {};
const CONFIG_REVIEW_ENUM_VALUES: Partial<Record<DiceThroneConfigReviewFieldKey, readonly string[]>> = {
  cardType: ['action', 'upgrade'],
  timing: ['main', 'roll', 'instant'],
  abilityType: ['offensive', 'defensive', 'utility', 'passive'],
  tokenCategory: ['buff', 'debuff', 'consumable'],
  tags: ['defensive', 'ultimate', 'unblockable', 'uninterruptible'],
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function tr(translate: TranslateFn, key: string, defaultValue: string, options: Record<string, unknown> = {}): string {
  return translate(key, { ...options, defaultValue });
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
  const alphabetIndex = /^[a-z]$/i.test(normalized) ? normalized.toUpperCase().charCodeAt(0) - 64 : 0;
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
  if (label) aliases.set(normalizeEditToken(label), value);
}

function buildTranslatedAliasMap(translate: TranslateFn, namespace: string, values: readonly string[]): Map<string, string> {
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
  const aliases = new Map<string, boolean>();
  for (const [label, value] of [['true', true], ['1', true], ['yes', true], ['是', true], ['false', false], ['0', false], ['no', false], ['否', false]] as const) addEditAlias(aliases, label, value);
  addEditAlias(aliases, tr(translate, 'configReview.values.boolean.true', '是'), true);
  addEditAlias(aliases, tr(translate, 'configReview.values.boolean.false', '否'), false);
  return aliases.get(normalizeEditToken(rawValue)) ?? rawValue.trim();
}

function parseLocalizedScalarValue(fieldKey: DiceThroneConfigReviewFieldKey, rawValue: string, translate: TranslateFn, sfxKeyByDisplayName: Map<string, string>): unknown {
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

function parseSuggestedValue(fieldKey: DiceThroneConfigReviewFieldKey, rawValue: string, translate: TranslateFn, sfxKeyByDisplayName: Map<string, string>): { value: unknown } {
  const trimmed = rawValue.trim();
  const { valueKind } = getDiceThroneConfigReviewFieldDefinition(fieldKey);
  if (valueKind === 'string-array') return { value: splitEditableListInput(trimmed).map((part) => parseLocalizedScalarValue(fieldKey, part, translate, sfxKeyByDisplayName)) };
  if (valueKind === 'number') return { value: trimmed === '' ? undefined : Number(trimmed) };
  return { value: parseLocalizedScalarValue(fieldKey, trimmed, translate, sfxKeyByDisplayName) };
}

function formatLocalizedKey(value: unknown, translate: TranslateFn): string {
  const key = String(value ?? '');
  return key ? tr(translate, key, key) : '';
}

function formatCellDisplayValue(row: DiceThroneConfigReviewRow, fieldKey: DiceThroneConfigReviewFieldKey, value: unknown, translate: TranslateFn): string {
  if (value === undefined || value === null) return '';
  switch (fieldKey) {
    case 'name': return row.objectType === 'diceFace' && value === row.name ? formatDiceThroneConfigReviewDiceFaceName(row, translate) : formatLocalizedKey(value, translate);
    case 'description': return formatLocalizedKey(value, translate);
    case 'character': return tr(translate, `characters.${String(value)}`, String(value));
    case 'cardType': return formatDiceThroneConfigReviewCardType(row, value, translate);
    case 'timing':
    case 'abilityType':
    case 'tokenCategory': return tr(translate, `configReview.values.${fieldKey}.${String(value)}`, String(value));
    case 'diceSymbols': return Array.isArray(value) ? value.map((symbol) => tr(translate, `dice.face.${String(symbol)}`, String(symbol))).join('、') : tr(translate, `dice.face.${String(value)}`, String(value));
    case 'tags': return Array.isArray(value) ? value.map((tag) => tr(translate, `configReview.values.tags.${String(tag)}`, String(tag))).join('、') : tr(translate, `configReview.values.tags.${String(value)}`, String(value));
    case 'isAttackModifier': return tr(translate, `configReview.values.boolean.${String(value)}`, String(value));
    case 'sfxKey': return formatAudioDisplayName(value);
    default: return formatCellValue(value);
  }
}

function fieldWidthClass(fieldKey: DiceThroneConfigReviewFieldKey): string {
  switch (fieldKey) {
    case 'name': return 'w-[168px]';
    case 'description': return 'w-[300px]';
    case 'sfxKey': return 'w-[220px]';
    case 'character':
    case 'diceSymbols':
    case 'tags': return 'w-[150px]';
    default: return 'w-[96px]';
  }
}

function ConfigCardPreviewButton({ row, onMagnify, missingLabel, magnifyLabel }: { row: DiceThroneConfigReviewRow; onMagnify: (row: DiceThroneConfigReviewRow) => void; missingLabel: string; magnifyLabel: string }) {
  if (!row.previewRef) return <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[5px] border border-[#8f6642]/24 bg-[#ead8b8]/70 text-[#7b5a40]" title={missingLabel}><ImageOff aria-hidden="true" className="h-4 w-4" /></div>;
  return <button type="button" className="group relative h-[42px] w-[42px] overflow-hidden rounded-[5px] border border-[#6f4b32]/30 bg-[#ead8b8] shadow-[0_2px_5px_rgba(63,39,24,0.12)]" onClick={() => onMagnify(row)} aria-label={magnifyLabel} data-testid="dicethrone-config-card-preview"><CardPreview previewRef={row.previewRef} className="h-full w-full object-cover" title={row.name} /><span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100"><Maximize2 aria-hidden="true" className="h-4 w-4" /></span></button>;
}

function AudioPreviewButton({ sfxKey, entry, isPlaying, isLoading, previewLabel, stopLabel, loadingLabel, missingLabel, onPreview }: { sfxKey: string; entry?: AudioRegistryEntry; isPlaying: boolean; isLoading: boolean; previewLabel: string; stopLabel: string; loadingLabel: string; missingLabel: string; onPreview: (sfxKey: string) => void }) {
  const disabled = !entry;
  const title = disabled ? missingLabel : isLoading ? loadingLabel : isPlaying ? stopLabel : previewLabel;
  return <button type="button" disabled={disabled} onClick={() => onPreview(sfxKey)} className={['inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border text-[#4b2c18] transition', disabled ? 'cursor-not-allowed border-[#8f6642]/18 bg-[#ead8b8]/60 opacity-45' : 'border-[#8f6642]/38 bg-[#fff7df] hover:bg-[#f5dfaf]', isPlaying ? 'border-[#3f2718]/45 bg-[#4b2c18] text-[#f5ddb4] hover:bg-[#321c0e]' : ''].join(' ')} title={title} aria-label={title} data-testid="dicethrone-config-audio-preview">{isLoading ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : isPlaying ? <Square aria-hidden="true" className="h-3.5 w-3.5" /> : <Volume2 aria-hidden="true" className="h-3.5 w-3.5" />}</button>;
}

export const DiceThroneConfigReview = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('game-dicethrone');
  const translate = useCallback<TranslateFn>((key, options = {}) => String(t(key, { ...options, defaultValue: String(options.defaultValue ?? key) })), [t]);
  const table = useMemo(() => {
    initDiceThroneCardAtlases();
    return buildDiceThroneConfigReviewTable();
  }, []);
  const [characterFilter, setCharacterFilter] = useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | DiceThroneConfigReviewType>('all');
  const [magnifiedRow, setMagnifiedRow] = useState<DiceThroneConfigReviewRow | null>(null);
  const [audioEntriesByKey, setAudioEntriesByKey] = useState<Map<string, AudioRegistryEntry>>(() => new Map());
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null);
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState<string | null>(null);
  const playingAudioKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCommonAudioRegistry().then((payload) => {
      if (cancelled) return;
      AudioManager.registerRegistryEntries(payload.entries, COMMON_AUDIO_BASE_PATH);
      AudioManager.initialize();
      setAudioEntriesByKey(new Map(payload.entries.map((entry) => [entry.key, entry])));
      setAudioLoadError(null);
    }).catch((error) => {
      if (!cancelled) setAudioLoadError(String(error?.message ?? error));
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
        if (playingAudioKeyRef.current === loadingAudioKey) playingAudioKeyRef.current = null;
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
      if (row.sfxKey) {
        addEditAlias(aliases, row.sfxKey, row.sfxKey);
        addEditAlias(aliases, formatAudioDisplayName(row.sfxKey), row.sfxKey);
      }
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
    if (playingAudioKeyRef.current) AudioManager.stopSfx(playingAudioKeyRef.current);
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

  const characterOptions = useMemo(() => Array.from(new Set(table.rows.map((row) => row.characterId))), [table.rows]);
  const filteredRows = useMemo(() => table.rows.filter((row) => (characterFilter === 'all' || row.characterId === characterFilter) && (typeFilter === 'all' || row.objectType === typeFilter)), [characterFilter, table.rows, typeFilter]);
  const formatValue = useCallback((row: DiceThroneConfigReviewRow, fieldKey: DiceThroneConfigReviewFieldKey, value: unknown) => formatCellDisplayValue(row, fieldKey, value, translate), [translate]);
  const columns = useMemo<ConfigReviewColumn<DiceThroneConfigReviewFieldKey>[]>(() => DICETHRONE_CONFIG_REVIEW_COLUMN_KEYS.map((key) => ({ key, label: t(`configReview.columns.${key}`), widthClass: key === 'image' ? 'w-[70px]' : fieldWidthClass(key), minWidth: key === 'image' ? 70 : undefined, sticky: key === 'image' })), [t]);

  return (
    <>
      <ConfigReviewTable
        gameId="dicethrone"
        tableId={DICETHRONE_CONFIG_REVIEW_TABLE_ID}
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
            <select value={characterFilter} onChange={(event) => setCharacterFilter(event.target.value)} className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20" data-testid="dicethrone-config-character-filter">
              <option value="all">{t('configReview.filters.allCharacters')}</option>
              {characterOptions.map((characterId) => <option key={characterId} value={characterId}>{t(`characters.${characterId}`)}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | DiceThroneConfigReviewType)} className="h-10 rounded-[4px] border border-[#8f6642]/40 bg-[#fff6df] px-3 text-sm font-bold text-[#301a0e] outline-none focus:ring-2 focus:ring-[#6b4328]/20" data-testid="dicethrone-config-type-filter">
              {TYPE_FILTERS.map((type) => <option key={type} value={type}>{t(`configReview.types.${type}`)}</option>)}
            </select>
          </>
        )}
        filterKey={`${characterFilter}:${typeFilter}`}
        getSearchText={(row) => [row.searchText, row.name, row.objectId, formatValue(row, 'name', row.name), formatValue(row, 'character', row.characterId)].filter(Boolean).join(' ')}
        getCellValue={getDiceThroneConfigReviewCellValue}
        getFieldDefinition={getDiceThroneConfigReviewFieldDefinition}
        isFieldApplicable={isDiceThroneConfigReviewFieldApplicable}
        formatCellValue={formatValue}
        parseSuggestedValue={(row, fieldKey, rawValue) => parseSuggestedValue(fieldKey, rawValue, translate, sfxKeyByDisplayName)}
        buildProposal={({ row, fieldKey, suggestedValue, currentValue, currentDisplayValue, updatedDisplayValue, language, tableId, configVersion }) => ({
          gameId: 'dicethrone',
          configVersion,
          objectId: row.objectId,
          objectDisplayName: formatValue(row, 'name', row.name),
          objectType: row.objectType,
          fieldPath: row.fieldPaths[fieldKey],
          fieldDisplayName: t(`configReview.fields.${fieldKey}`),
          currentValue,
          suggestedValue,
          currentDisplayValue,
          updatedDisplayValue,
          sourceContext: { route: window.location.href, tableId, rowId: row.rowId, cellKey: fieldKey, language, objectContext: { name: row.name, characterId: row.characterId, objectType: row.objectType, sourceContexts: row.sourceContexts } },
          status: 'pending_ai_review',
        })}
        renderCell={({ row, columnKey, fieldKey, pendingEdit, defaultContent }) => {
          if (columnKey === 'image') {
            const label = t('configReview.actions.magnify', { name: formatValue(row, 'name', row.name) });
            return <ConfigCardPreviewButton row={row} onMagnify={setMagnifiedRow} missingLabel={t('configReview.material.noPreview')} magnifyLabel={label} />;
          }
          if (columnKey !== 'sfxKey' || !fieldKey) return undefined;
          const previewValue = pendingEdit && !pendingEdit.error ? pendingEdit.parsedValue : getDiceThroneConfigReviewCellValue(row, fieldKey);
          const sfxKey = typeof previewValue === 'string' ? previewValue : '';
          return <div className="flex min-h-[30px] items-center gap-1.5">{defaultContent}{sfxKey ? <AudioPreviewButton sfxKey={sfxKey} entry={audioEntriesByKey.get(sfxKey)} isPlaying={playingAudioKey === sfxKey} isLoading={loadingAudioKey === sfxKey} previewLabel={t('configReview.audio.preview', { name: formatAudioDisplayName(sfxKey) })} stopLabel={t('configReview.audio.stop', { name: formatAudioDisplayName(sfxKey) })} loadingLabel={t('configReview.audio.loading', { name: formatAudioDisplayName(sfxKey) })} missingLabel={audioLoadError ? t('configReview.audio.loadFailed') : t('configReview.audio.missing')} onPreview={handleAudioPreview} /> : null}</div>;
        }}
        initialFeedbackContent={(count) => t('configReview.feedback.initialBatchContent', { count })}
        runtimeContext={{ mode: 'local', gameId: 'dicethrone' }}
        testIdPrefix="dicethrone-config"
      />
      <MagnifyOverlay isOpen={Boolean(magnifiedRow?.previewRef)} onClose={() => setMagnifiedRow(null)} closeLabel={t('configReview.actions.closePreview')} overlayClassName="bg-black/50" overlayTestId="dicethrone-config-card-magnify">
        {magnifiedRow?.previewRef ? <div className="relative h-[82vh] w-[min(66vw,520px)]"><CardPreview previewRef={magnifiedRow.previewRef} className="h-full w-full rounded-xl shadow-2xl" title={formatValue(magnifiedRow, 'name', magnifiedRow.name)} /></div> : null}
      </MagnifyOverlay>
    </>
  );
};

export default DiceThroneConfigReview;
