import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { MageWarsConfigSpellCard } from '../data/configPackage';
import { getPresetMageSetupFromConfig } from '../data/configPackage';
import type { MageId } from '../domain/ids';
import type { MageWarsPlayerSpellbookEntry } from '../domain/spellbook';
import {
    deleteMageWarsSavedSpellbook,
    listMageWarsSavedSpellbooksForMage,
    normalizeMageWarsSavedSpellbookEntries,
    saveMageWarsSpellbookDraft,
    updateMageWarsSavedSpellbookDraft,
    type MageWarsSavedSpellbook,
} from '../domain/savedSpellbooks';
import {
    calculateMageWarsSpellbookBuildSummary,
    getMageWarsSpellbookCandidateCards,
    getMageWarsSpellbookCardCost,
    getMageWarsSpellbookCopyLimitForCard,
    getMageWarsSpellbookTrainingProfile,
    getMageWarsSpellSchools,
} from '../domain/spellbookBuilder';
import { getMageWarsDefaultSpellbookEntries } from '../roomSetup';
import {
    getMageWarsMagePreviewRef,
    getMageWarsSpellCardAspectRatio,
    getMageWarsSpellCardPreviewRef,
} from './cardAtlas';

type SpellbookBuilderPanelProps = {
    mageId: MageId;
    entries: readonly MageWarsPlayerSpellbookEntry[];
    activeSavedSpellbookId?: string | null;
    onEntriesChange: (entries: readonly MageWarsPlayerSpellbookEntry[]) => void;
    onSavedLibraryChange?: () => void;
    onSavedSpellbookChange?: (saved: MageWarsSavedSpellbook | null) => void;
    onClose: () => void;
};

type TypeFilter = 'all' | '攻击' | '结界' | '生物' | '魔物' | '咒语' | '装备';
type LevelFilter = 'all' | '0-1' | '2' | '3' | '4' | '5' | '6+';
type LegalityFilter = 'all' | 'addable' | 'inBook' | 'restricted';
type ScopeFilter = 'all' | 'inBook' | 'addable' | 'wall';

const TYPE_FILTERS = ['all', '攻击', '结界', '生物', '魔物', '咒语', '装备'] as const satisfies readonly TypeFilter[];
const LEVEL_FILTERS = ['all', '0-1', '2', '3', '4', '5', '6+'] as const satisfies readonly LevelFilter[];
const TYPE_FILTER_LABEL_KEYS: Record<Exclude<TypeFilter, 'all'>, string> = {
    '攻击': 'spellbookBuilder.type.attack',
    '结界': 'spellbookBuilder.type.enchantment',
    '生物': 'spellbookBuilder.type.creature',
    '魔物': 'spellbookBuilder.type.conjuration',
    '咒语': 'spellbookBuilder.type.incantation',
    '装备': 'spellbookBuilder.type.equipment',
};
const SCOPE_FILTER_OPTIONS = [
    ['all', 'spellbookBuilder.scope.all'],
    ['inBook', 'spellbookBuilder.scope.inBook'],
    ['addable', 'spellbookBuilder.scope.addable'],
    ['wall', 'spellbookBuilder.scope.wall'],
] as const satisfies readonly Array<readonly [ScopeFilter, string]>;

const SPELL_CARD_BACK_PATH = 'mage-wars/cards/backs/spell-card-back';
const WALL_CARD_BACK_PATH = 'mage-wars/cards/backs/wall-card-back';
const SPELL_CARD_BACK_RATIO = 992 / 1391;
const WALL_CARD_BACK_RATIO = 1386 / 992;

function cx(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}

function getSpellCardLevel(spell: MageWarsConfigSpellCard): number {
    const level = spell.level ?? 1;
    return Number.isFinite(level) && level > 0 ? Math.ceil(level) : 1;
}

function isWallSpell(spell: MageWarsConfigSpellCard): boolean {
    return spell.tags?.includes('墙体') === true
        || spell.typeLine?.includes('墙体') === true
        || spell.targetRule === '墙体边界';
}

function getCardAspectRatio(spell: MageWarsConfigSpellCard): number {
    return getMageWarsSpellCardAspectRatio(spell.spellCardId)
        ?? (isWallSpell(spell) ? WALL_CARD_BACK_RATIO : SPELL_CARD_BACK_RATIO);
}

function getFallbackBackPath(spell: MageWarsConfigSpellCard): string {
    return isWallSpell(spell) ? WALL_CARD_BACK_PATH : SPELL_CARD_BACK_PATH;
}

function getEntryCount(entries: readonly MageWarsPlayerSpellbookEntry[], spellCardId: number): number {
    return entries.find((entry) => entry.spellCardId === spellCardId)?.count ?? 0;
}

function setEntryCount(
    entries: readonly MageWarsPlayerSpellbookEntry[],
    spellCardId: number,
    nextCount: number,
): MageWarsPlayerSpellbookEntry[] {
    const limit = getMageWarsSpellbookCopyLimitForCard(spellCardId);
    const clamped = Math.max(0, Math.min(limit, nextCount));
    const remaining = entries.filter((entry) => entry.spellCardId !== spellCardId);
    if (clamped <= 0) return normalizeMageWarsSavedSpellbookEntries(remaining);
    return normalizeMageWarsSavedSpellbookEntries([...remaining, { spellCardId, count: clamped }]);
}

function matchesLevelFilter(spell: MageWarsConfigSpellCard, filter: LevelFilter): boolean {
    if (filter === 'all') return true;
    const level = getSpellCardLevel(spell);
    if (filter === '0-1') return level <= 1;
    if (filter === '6+') return level >= 6;
    return level === Number(filter);
}

function formatSchools(spell: MageWarsConfigSpellCard): string {
    const schools = getMageWarsSpellSchools(spell);
    if (schools.length === 0) return spell.spellType;
    return schools.slice(0, 2).join(' / ');
}

function getTrainingMultiplierLabelKey(multiplier: 1 | 2 | 3 | undefined): string {
    if (multiplier === 1) return 'spellbookBuilder.training.trained';
    if (multiplier === 3) return 'spellbookBuilder.training.opposed';
    return 'spellbookBuilder.training.untrained';
}

function parseImportedEntries(value: string): MageWarsPlayerSpellbookEntry[] {
    const counts = new Map<number, number>();
    value
        .split(/\r?\n|,/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
            const [idText, countText] = line.split(/\s*[xX*×:：]\s*|\s+/).filter(Boolean);
            const spellCardId = Number(idText);
            if (!Number.isInteger(spellCardId)) return;
            const count = Number.isInteger(Number(countText)) ? Math.max(1, Number(countText)) : 1;
            const limit = getMageWarsSpellbookCopyLimitForCard(spellCardId);
            if (limit <= 0) return;
            counts.set(spellCardId, Math.min(limit, (counts.get(spellCardId) ?? 0) + count));
        });
    return [...counts.entries()]
        .sort(([left], [right]) => left - right)
        .map(([spellCardId, count]) => ({ spellCardId, count }));
}

function SpellCardArt({
    spell,
    className,
}: {
    spell: MageWarsConfigSpellCard;
    className?: string;
}) {
    const { t } = useTranslation('game-mage-wars');
    const previewRef = getMageWarsSpellCardPreviewRef(spell.spellCardId);
    const aspectRatio = getCardAspectRatio(spell);
    const baseClassName = cx('block h-full w-full object-contain', className);
    if (previewRef) {
        return (
            <CardPreview
                previewRef={previewRef}
                className={baseClassName}
                style={{ aspectRatio }}
                title={spell.name}
                alt={spell.name}
            />
        );
    }
    return (
        <OptimizedImage
            src={getFallbackBackPath(spell)}
            className={baseClassName}
            style={{ aspectRatio }}
            alt={t('spellbookBuilder.spellCardFallbackAlt')}
            title={spell.name}
            data-card-fallback={isWallSpell(spell) ? 'wall-card-back' : 'spell-card-back'}
        />
    );
}

export function MageWarsSpellbookBuilderPanel({
    mageId,
    entries,
    activeSavedSpellbookId = null,
    onEntriesChange,
    onSavedLibraryChange,
    onSavedSpellbookChange,
    onClose,
}: SpellbookBuilderPanelProps) {
    const { t } = useTranslation('game-mage-wars');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [schoolFilter, setSchoolFilter] = useState('all');
    const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
    const [legalityFilter, setLegalityFilter] = useState<LegalityFilter>('all');
    const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
    const [detailOpen, setDetailOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [saveName, setSaveName] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [editingSavedSpellbookId, setEditingSavedSpellbookId] = useState<string | null>(activeSavedSpellbookId);
    const [savedSpellbooks, setSavedSpellbooks] = useState<MageWarsSavedSpellbook[]>(() => (
        listMageWarsSavedSpellbooksForMage(mageId)
    ));
    const allCards = useMemo(() => [...getMageWarsSpellbookCandidateCards()], []);
    const currentSetup = getPresetMageSetupFromConfig(mageId);
    const trainingProfile = getMageWarsSpellbookTrainingProfile(mageId);
    const summary = calculateMageWarsSpellbookBuildSummary(mageId, entries);
    const schools = useMemo(() => {
        const values = new Set<string>();
        allCards.forEach((spell) => getMageWarsSpellSchools(spell).forEach((school) => values.add(school)));
        return [...values].sort((left, right) => left.localeCompare(right, 'zh-CN'));
    }, [allCards]);
    const filteredCards = useMemo(() => {
        const query = search.trim().toLowerCase();
        return allCards.filter((spell) => {
            const selectedCount = getEntryCount(entries, spell.spellCardId);
            const cost = getMageWarsSpellbookCardCost(mageId, spell.spellCardId);
            const limit = getMageWarsSpellbookCopyLimitForCard(spell.spellCardId);
            const restricted = Boolean(cost?.restrictionReason);
            const canAdd = selectedCount < limit
                && !restricted
                && summary.pointsUsed + (cost?.points ?? 0) <= summary.pointLimit;

            if (query && !`${spell.name} ${spell.spellCardId}`.toLowerCase().includes(query)) return false;
            if (typeFilter !== 'all') {
                if (typeFilter === '生物' && spell.spellType !== '生物') return false;
                if (typeFilter !== '生物' && spell.spellType !== typeFilter) return false;
            }
            if (schoolFilter !== 'all' && !getMageWarsSpellSchools(spell).includes(schoolFilter)) return false;
            if (!matchesLevelFilter(spell, levelFilter)) return false;
            if (legalityFilter === 'addable' && !canAdd) return false;
            if (legalityFilter === 'inBook' && selectedCount <= 0) return false;
            if (legalityFilter === 'restricted' && !restricted) return false;
            if (scopeFilter === 'inBook' && selectedCount <= 0) return false;
            if (scopeFilter === 'addable' && !canAdd) return false;
            if (scopeFilter === 'wall' && !isWallSpell(spell)) return false;
            return true;
        });
    }, [allCards, entries, legalityFilter, levelFilter, mageId, schoolFilter, scopeFilter, search, summary.pointLimit, summary.pointsUsed, typeFilter]);
    const selectedRows = useMemo(() => entries
        .map((entry) => {
            const spell = allCards.find((candidate) => candidate.spellCardId === entry.spellCardId);
            if (!spell) return null;
            return { entry, spell, cost: getMageWarsSpellbookCardCost(mageId, entry.spellCardId) };
        })
        .filter((row): row is {
            entry: MageWarsPlayerSpellbookEntry;
            spell: MageWarsConfigSpellCard;
            cost: NonNullable<ReturnType<typeof getMageWarsSpellbookCardCost>> | undefined;
        } => row !== null)
        .sort((left, right) => {
            const typeOrder = left.spell.spellType.localeCompare(right.spell.spellType, 'zh-CN');
            return typeOrder || left.spell.spellCardId - right.spell.spellCardId;
        }), [allCards, entries, mageId]);

    useEffect(() => {
        const nextSavedSpellbooks = listMageWarsSavedSpellbooksForMage(mageId);
        const activeSavedSpellbook = activeSavedSpellbookId
            ? nextSavedSpellbooks.find((spellbook) => spellbook.id === activeSavedSpellbookId) ?? null
            : null;
        setSavedSpellbooks(nextSavedSpellbooks);
        setEditingSavedSpellbookId(activeSavedSpellbook?.id ?? null);
        setSaveName(activeSavedSpellbook?.name ?? '');
        setDetailOpen(false);
        setImportOpen(false);
    }, [activeSavedSpellbookId, mageId]);

    const applyEntries = (nextEntries: readonly MageWarsPlayerSpellbookEntry[]) => {
        onEntriesChange(normalizeMageWarsSavedSpellbookEntries(nextEntries));
    };

    const refreshSavedSpellbooks = () => {
        setSavedSpellbooks(listMageWarsSavedSpellbooksForMage(mageId));
    };

    const addSpell = (spell: MageWarsConfigSpellCard) => {
        const cost = getMageWarsSpellbookCardCost(mageId, spell.spellCardId);
        if (cost?.restrictionReason) return;
        const currentCount = getEntryCount(entries, spell.spellCardId);
        const limit = getMageWarsSpellbookCopyLimitForCard(spell.spellCardId);
        if (currentCount >= limit) return;
        if (summary.pointsUsed + (cost?.points ?? 0) > summary.pointLimit) return;
        applyEntries(setEntryCount(entries, spell.spellCardId, currentCount + 1));
    };

    const resetToStandard = () => {
        applyEntries(getMageWarsDefaultSpellbookEntries(mageId));
        setEditingSavedSpellbookId(null);
        setSaveName('');
        setImportOpen(false);
        setSaveStatus(t('spellbookBuilder.status.loadedStandard'));
        onSavedSpellbookChange?.(null);
    };

    const importEntries = () => {
        applyEntries(parseImportedEntries(importText));
        setEditingSavedSpellbookId(null);
        setImportOpen(false);
        onSavedSpellbookChange?.(null);
    };

    const saveAsNewSpellbook = () => {
        try {
            const saved = saveMageWarsSpellbookDraft({
                mageId,
                name: saveName,
                entries,
            });
            refreshSavedSpellbooks();
            onSavedLibraryChange?.();
            setEditingSavedSpellbookId(saved.id);
            setSaveName(saved.name);
            setSaveStatus(t('spellbookBuilder.status.saved', { name: saved.name }));
            onSavedSpellbookChange?.(saved);
        } catch (error) {
            setSaveStatus(error instanceof Error ? error.message : t('spellbookBuilder.status.saveFailed'));
        }
    };

    const updateSavedSpellbook = () => {
        if (!editingSavedSpellbookId) return;
        try {
            const saved = updateMageWarsSavedSpellbookDraft({
                id: editingSavedSpellbookId,
                mageId,
                name: saveName,
                entries,
            });
            refreshSavedSpellbooks();
            onSavedLibraryChange?.();
            setSaveName(saved.name);
            setSaveStatus(t('spellbookBuilder.status.updated', { name: saved.name }));
            onSavedSpellbookChange?.(saved);
        } catch (error) {
            setSaveStatus(error instanceof Error ? error.message : t('spellbookBuilder.status.updateFailed'));
        }
    };

    const loadSavedSpellbook = (saved: MageWarsSavedSpellbook) => {
        applyEntries(saved.entries);
        setEditingSavedSpellbookId(saved.id);
        setSaveName(saved.name);
        setImportOpen(false);
        setSaveStatus(t('spellbookBuilder.status.loadedSaved', { name: saved.name }));
        onSavedSpellbookChange?.(saved);
    };

    const removeSavedSpellbook = (saved: MageWarsSavedSpellbook) => {
        deleteMageWarsSavedSpellbook(saved.id);
        refreshSavedSpellbooks();
        onSavedLibraryChange?.();
        if (editingSavedSpellbookId === saved.id) {
            setEditingSavedSpellbookId(null);
            setSaveName('');
            onSavedSpellbookChange?.(null);
        }
        setSaveStatus(t('spellbookBuilder.status.deleted', { name: saved.name }));
    };

    const shownEnd = Math.min(selectedRows.length, Math.max(0, selectedRows.length));
    const budgetRatio = Math.min(1, Math.max(0, summary.pointsUsed / summary.pointLimit));
    const canSaveAsNew = saveName.trim().length > 0 && entries.length > 0;
    const canUpdateSaved = Boolean(editingSavedSpellbookId) && canSaveAsNew;

    return (
        <div
            className="absolute inset-0 z-30 overflow-hidden bg-[#14100d] text-stone-100"
            data-testid="mage-wars-spellbook-builder"
            data-mage-id={mageId}
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(146,98,38,0.25),transparent_30%),radial-gradient(circle_at_76%_16%,rgba(69,105,119,0.19),transparent_29%),linear-gradient(135deg,#211712_0%,#2b211b_52%,#111414_100%)]" />
            <div className="relative z-10 grid h-full min-h-0 grid-rows-[4.625rem_minmax(0,1fr)] gap-2.5 px-5 pb-5 pt-3">
                <header
                    className="builder-topbar grid min-h-0 grid-cols-[15.25rem_minmax(0,1fr)_21rem_auto] items-stretch gap-2.5"
                    data-hearthstone-comparison="card-pool-deck-list"
                >
                    <section className="border border-stone-100/15 bg-black/25 px-2.5 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.32)]">
                        <button
                            type="button"
                            className="mage-context grid h-full w-full min-w-0 grid-cols-[2.3rem_minmax(0,1fr)] items-center gap-2 border border-amber-200/55 bg-amber-300/12 p-1.5 text-left shadow-[0_0_0_2px_rgba(232,187,102,0.1)] transition hover:border-amber-200/85"
                            data-testid="mage-wars-spellbook-builder-mage-context"
                            data-mage-detail-open="true"
                            aria-label={t('spellbookBuilder.mageContextAria', { mage: currentSetup.displayName })}
                            onClick={() => setDetailOpen(true)}
                        >
                            <span className="block w-9 overflow-hidden bg-black/35" style={{ aspectRatio: 744 / 1040 }}>
                                <CardPreview
                                    previewRef={getMageWarsMagePreviewRef(mageId, 'portrait')}
                                    className="h-full w-full object-contain"
                                    title={currentSetup.displayName}
                                    alt={currentSetup.displayName}
                                />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-[0.58rem] font-black uppercase tracking-[0.12em] text-amber-200/72">
                                    {t('spellbookBuilder.title')}
                                </span>
                                <strong className="mt-1 block truncate text-sm font-black leading-none text-stone-50">
                                    {currentSetup.displayName}
                                </strong>
                                <span className="mt-1 block truncate text-[0.61rem] font-semibold leading-none text-stone-200/65">
                                    {t('spellbookBuilder.viewMageAbilityCard')}
                                </span>
                            </span>
                        </button>
                    </section>

                    <section
                        className="relative grid min-h-0 grid-cols-[11rem_minmax(8rem,1fr)_auto_auto_auto] items-center gap-2 border border-stone-100/15 bg-black/25 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.32)]"
                        data-testid="mage-wars-spellbook-builder-saved-library"
                        aria-label={t('spellbookBuilder.libraryAria')}
                    >
                        <button
                            type="button"
                            className="grid h-full min-w-0 content-center border border-white/15 bg-white/[0.045] px-2 text-left hover:border-amber-200/45"
                            data-testid="mage-wars-spellbook-builder-saved-library-toggle"
                            aria-expanded={libraryOpen}
                            onClick={() => {
                                setLibraryOpen((value) => !value);
                                setImportOpen(false);
                            }}
                        >
                            <span className="truncate text-[0.58rem] font-black uppercase tracking-[0.12em] text-amber-200/72">
                                {t('spellbookBuilder.libraryTitle')}
                            </span>
                            <strong className="mt-1 truncate text-xs font-black leading-none text-stone-50">
                                {selectedBookLabel}
                            </strong>
                        </button>
                        <label className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)] border border-white/15 bg-white/[0.045] px-2">
                            <span className="sr-only">{t('spellbookBuilder.saveNameLabel')}</span>
                            <input
                                className="min-w-0 bg-transparent text-xs font-semibold outline-none placeholder:text-stone-300/45"
                                value={saveName}
                                placeholder={t('spellbookBuilder.saveNamePlaceholder')}
                                aria-label={t('spellbookBuilder.saveNameLabel')}
                                data-testid="mage-wars-spellbook-builder-save-name"
                                onChange={(event) => setSaveName(event.currentTarget.value)}
                            />
                        </label>
                        <button
                            type="button"
                            className="h-full border border-amber-200/60 bg-amber-300 px-3 text-xs font-black text-stone-950 disabled:border-white/10 disabled:bg-white/10 disabled:text-stone-400"
                            data-testid="mage-wars-spellbook-builder-save-new"
                            disabled={!canSaveAsNew}
                            onClick={saveAsNewSpellbook}
                        >
                            {t('spellbookBuilder.saveAsNew')}
                        </button>
                        <button
                            type="button"
                            className="h-full border border-white/20 bg-white/[0.07] px-3 text-xs font-black text-stone-100 disabled:border-white/10 disabled:bg-white/10 disabled:text-stone-400"
                            data-testid="mage-wars-spellbook-builder-update-saved"
                            disabled={!canUpdateSaved}
                            onClick={updateSavedSpellbook}
                        >
                            {t('spellbookBuilder.updateSaved')}
                        </button>
                        <button
                            type="button"
                            className="h-full border border-white/15 bg-white/[0.045] px-3 text-left text-xs font-black hover:border-amber-200/40"
                            data-testid="mage-wars-spellbook-builder-import-open"
                            onClick={() => {
                                setImportOpen((value) => !value);
                                setLibraryOpen(false);
                            }}
                        >
                            {t('spellbookBuilder.importList')}
                        </button>
                        {saveStatus ? (
                            <div
                                className="pointer-events-none absolute -bottom-4 right-2 max-w-[18rem] truncate text-[0.58rem] font-bold text-emerald-200/90"
                                data-testid="mage-wars-spellbook-builder-save-status"
                            >
                                {saveStatus}
                            </div>
                        ) : null}
                    </section>

                    <section
                        className="capacity grid content-center gap-1.5 border border-stone-100/15 bg-black/25 px-2.5 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.32)]"
                        aria-label={t('spellbookBuilder.capacityAria')}
                        data-testid="mage-wars-spellbook-builder-capacity"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <strong className={cx('block text-sm leading-none', summary.overPointLimit ? 'text-red-300' : 'text-stone-50')}>
                                {t('spellbookBuilder.pointsUsed', {
                                    used: summary.pointsUsed,
                                    limit: summary.pointLimit,
                                })}
                            </strong>
                            <span className="text-[0.68rem] font-black leading-none text-stone-200/78">
                                {t('spellbookBuilder.currentComposition', {
                                    cards: summary.cardCount,
                                    entries: summary.entryCount,
                                })}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden bg-black/45">
                            <div
                                className={cx('h-full', summary.overPointLimit ? 'bg-red-400' : 'bg-emerald-400')}
                                style={{ width: `${budgetRatio * 100}%` }}
                            />
                        </div>
                    </section>

                    <div className="grid min-w-[10rem] grid-cols-2 gap-2">
                        <button
                            type="button"
                            className="border border-white/15 bg-white/[0.05] px-3 text-xs font-bold"
                            onClick={onClose}
                        >
                            {t('spellbookBuilder.back')}
                        </button>
                        <button
                            type="button"
                            className="border border-amber-200/60 bg-amber-300 px-4 text-xs font-black text-stone-950 shadow-[0_10px_22px_rgba(0,0,0,0.36)]"
                            data-testid="mage-wars-spellbook-builder-confirm"
                            onClick={onClose}
                        >
                            {t('spellbookBuilder.confirm')}
                        </button>
                    </div>
                </header>

                {libraryOpen ? (
                    <section
                        className="builder-library-panel absolute left-[20.5rem] top-[4.95rem] z-40 w-[26rem] border border-amber-200/35 bg-[#19130f] p-2.5 shadow-[0_22px_60px_rgba(0,0,0,0.62)]"
                        data-testid="mage-wars-spellbook-builder-saved-list"
                        aria-label={t('spellbookBuilder.savedListAria')}
                    >
                        <div className="grid max-h-[18rem] gap-2 overflow-auto pr-1 scrollbar-thin">
                            <button
                                type="button"
                                className={cx(
                                    'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border px-2.5 py-2 text-left hover:border-amber-200/45',
                                    editingSavedSpellbookId === null ? 'border-amber-200/70 bg-amber-300/12' : 'border-white/15 bg-white/[0.045]',
                                )}
                                data-testid="mage-wars-spellbook-builder-standard"
                                data-library-kind="standard"
                                data-active={String(editingSavedSpellbookId === null)}
                                onClick={resetToStandard}
                            >
                                <strong className="block truncate text-sm font-black leading-none text-stone-50">
                                    {t('spellbookBuilder.libraryTitle')}
                                </strong>
                                <span className="text-xs font-black text-stone-200/70">
                                    {t('spellbookBuilder.standardPresetSummary', {
                                        count: getMageWarsDefaultSpellbookEntries(mageId)
                                            .reduce((total, entry) => total + entry.count, 0),
                                    })}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={cx(
                                    'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border px-2.5 py-2 text-left hover:border-amber-200/45',
                                    editingSavedSpellbookId === null ? 'border-amber-200/70 bg-amber-300/12' : 'border-white/15 bg-white/[0.045]',
                                )}
                                data-testid="mage-wars-spellbook-builder-standard"
                                data-library-kind="standard"
                                data-active={String(editingSavedSpellbookId === null)}
                                onClick={resetToStandard}
                            >
                                <strong className="block truncate text-sm font-black leading-none text-stone-50">
                                    {t('spellbookBuilder.standardSpellbook')}
                                </strong>
                                <span className="text-xs font-black text-stone-200/70">
                                    {t('spellbookBuilder.standardPresetSummary', {
                                        count: getMageWarsDefaultSpellbookEntries(mageId)
                                            .reduce((total, entry) => total + entry.count, 0),
                                    })}
                                </span>
                            </button>
                            {savedSpellbooks.length === 0 ? (
                                <span className="grid min-h-10 place-items-center border border-dashed border-white/12 bg-black/20 px-2 text-xs font-semibold text-stone-200/60">
                                    {t('spellbookBuilder.noNamedCopies')}
                                </span>
                            ) : savedSpellbooks.map((saved) => {
                                const savedCardCount = saved.entries.reduce((total, entry) => total + entry.count, 0);
                                const active = editingSavedSpellbookId === saved.id;
                                return (
                                    <div
                                        key={saved.id}
                                        role="button"
                                        tabIndex={0}
                                        className={cx(
                                            'grid min-h-10 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border bg-white/[0.045] px-2.5 py-2 text-left hover:border-amber-200/45',
                                            active ? 'border-amber-200/70 bg-amber-300/12' : 'border-white/15',
                                        )}
                                        data-testid="mage-wars-spellbook-builder-saved-spellbook"
                                        data-library-kind="saved"
                                        data-saved-spellbook-id={saved.id}
                                        data-mage-id={saved.mageId}
                                        aria-label={t('spellbookBuilder.loadSavedAria', { name: saved.name })}
                                        onClick={() => loadSavedSpellbook(saved)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                loadSavedSpellbook(saved);
                                            }
                                        }}
                                    >
                                        <span className="min-w-0">
                                            <strong className="block truncate text-sm font-black leading-none text-stone-50">
                                                {saved.name}
                                            </strong>
                                            <span className="mt-1 block truncate text-[0.62rem] font-semibold leading-none text-stone-200/62">
                                                {t('spellbookBuilder.savedCopySummary', { count: savedCardCount })}
                                            </span>
                                        </span>
                                        <span className="text-[0.62rem] font-black text-amber-100/70">
                                            {active ? t('spellbookBuilder.selectedBookStatus') : t('spellbookBuilder.selectBookStatus')}
                                        </span>
                                        <button
                                            type="button"
                                            className="grid h-6 w-6 place-items-center border border-white/15 bg-black/35 text-xs font-black text-stone-200/70 hover:border-red-200/70 hover:text-red-200"
                                            aria-label={t('spellbookBuilder.deleteSavedAria', { name: saved.name })}
                                            data-testid="mage-wars-spellbook-builder-delete-saved"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeSavedSpellbook(saved);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {importOpen ? (
                    <section
                        className="absolute left-[39rem] top-[4.95rem] z-40 grid w-[31rem] gap-2 border border-amber-200/30 bg-[#19130f] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.55)]"
                        data-testid="mage-wars-spellbook-builder-import-panel"
                    >
                        <textarea
                            className="h-28 resize-none border border-white/15 bg-black/45 p-2 text-xs outline-none focus:border-amber-200/70"
                            value={importText}
                            placeholder={t('spellbookBuilder.importPlaceholder')}
                            aria-label={t('spellbookBuilder.importAria')}
                            onChange={(event) => setImportText(event.currentTarget.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                className="border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-bold"
                                onClick={() => setImportOpen(false)}
                            >
                                {t('spellbookBuilder.cancel')}
                            </button>
                            <button
                                type="button"
                                className="border border-amber-200/60 bg-amber-300 px-3 py-1.5 text-xs font-black text-stone-950"
                                data-testid="mage-wars-spellbook-builder-import-apply"
                                onClick={importEntries}
                            >
                                {t('spellbookBuilder.import')}
                            </button>
                        </div>
                    </section>
                ) : null}

                <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_24rem] gap-3">
                    <section className="grid min-h-0 grid-rows-[2.55rem_2.55rem_minmax(0,1fr)] border border-stone-100/15 bg-black/24 shadow-[0_18px_44px_rgba(0,0,0,0.32)]" aria-label={t('spellbookBuilder.poolAria')}>
                        <div className="flex min-h-0 items-center justify-between gap-3 border-b border-stone-100/15 bg-black/20 px-3">
                            <div>
                                <h2 className="m-0 text-base font-black leading-tight">
                                    {t('spellbookBuilder.poolTitle')}
                                </h2>
                            </div>
                            <span className="inline-flex min-h-[1.35rem] items-center border border-white/15 bg-black/20 px-2 text-[0.63rem] font-black text-stone-100/85">
                                {t('spellbookBuilder.filteredCount', {
                                    filtered: filteredCards.length,
                                    total: allCards.length,
                                })}
                            </span>
                        </div>

                        <div className="grid grid-cols-[9.5rem_6.25rem_8.25rem_5.75rem_6.25rem_minmax(0,1fr)] items-center gap-1.5 border-b border-stone-100/15 bg-black/15 px-2 py-1.5" aria-label={t('spellbookBuilder.filterAria')}>
                            <label className="grid h-7 grid-cols-[1rem_minmax(0,1fr)] items-center gap-1.5 border border-stone-100/15 bg-white/[0.045] px-2">
                                <span aria-hidden="true" className="relative h-3.5 w-3.5 opacity-75 before:absolute before:left-0 before:top-0 before:h-2.5 before:w-2.5 before:rounded-full before:border-2 before:border-current after:absolute after:bottom-0 after:right-0 after:h-0.5 after:w-1.5 after:rotate-45 after:bg-current" />
                                <input
                                    className="min-w-0 bg-transparent text-xs outline-none placeholder:text-stone-300/50"
                                    value={search}
                                    placeholder={t('spellbookBuilder.searchPlaceholder')}
                                    aria-label={t('spellbookBuilder.searchAria')}
                                    data-testid="mage-wars-spellbook-builder-search"
                                    onChange={(event) => setSearch(event.currentTarget.value)}
                                />
                            </label>
                            <select
                                className="h-7 border border-stone-100/15 bg-[#211712] px-2 text-[0.66rem] font-bold"
                                value={typeFilter}
                                aria-label={t('spellbookBuilder.typeFilterAria')}
                                data-testid="mage-wars-spellbook-builder-filter-type"
                                onChange={(event) => setTypeFilter(event.currentTarget.value as TypeFilter)}
                            >
                                {TYPE_FILTERS.map((value) => (
                                    <option key={value} value={value}>
                                        {value === 'all'
                                            ? t('spellbookBuilder.type.all')
                                            : t(TYPE_FILTER_LABEL_KEYS[value as Exclude<TypeFilter, 'all'>])}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="h-7 border border-stone-100/15 bg-[#211712] px-2 text-[0.66rem] font-bold"
                                value={schoolFilter}
                                aria-label={t('spellbookBuilder.schoolFilterAria')}
                                data-testid="mage-wars-spellbook-builder-filter-school"
                                onChange={(event) => setSchoolFilter(event.currentTarget.value)}
                            >
                                <option value="all">{t('spellbookBuilder.schoolAll')}</option>
                                {schools.map((school) => <option key={school} value={school}>{school}</option>)}
                            </select>
                            <select
                                className="h-7 border border-stone-100/15 bg-[#211712] px-2 text-[0.66rem] font-bold"
                                value={levelFilter}
                                aria-label={t('spellbookBuilder.levelFilterAria')}
                                data-testid="mage-wars-spellbook-builder-filter-level"
                                onChange={(event) => setLevelFilter(event.currentTarget.value as LevelFilter)}
                            >
                                {LEVEL_FILTERS.map((value) => (
                                    <option key={value} value={value}>
                                        {value === 'all'
                                            ? t('spellbookBuilder.level.all')
                                            : t('spellbookBuilder.level.value', { value })}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="h-7 border border-stone-100/15 bg-[#211712] px-2 text-[0.66rem] font-bold"
                                value={legalityFilter}
                                aria-label={t('spellbookBuilder.statusFilterAria')}
                                data-testid="mage-wars-spellbook-builder-filter-legality"
                                onChange={(event) => setLegalityFilter(event.currentTarget.value as LegalityFilter)}
                            >
                                <option value="all">{t('spellbookBuilder.legality.all')}</option>
                                <option value="addable">{t('spellbookBuilder.legality.addable')}</option>
                                <option value="inBook">{t('spellbookBuilder.legality.inBook')}</option>
                                <option value="restricted">{t('spellbookBuilder.legality.restricted')}</option>
                            </select>
                            <div className="flex min-w-0 gap-1.5 overflow-hidden" data-testid="mage-wars-spellbook-builder-scope-filters">
                                {SCOPE_FILTER_OPTIONS.map(([value, labelKey]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={cx(
                                            'h-7 min-w-[3.9rem] border px-2 text-[0.6rem] font-black leading-none',
                                            scopeFilter === value
                                                ? 'border-amber-200/70 bg-amber-300/15 text-stone-50'
                                                : 'border-white/15 bg-white/[0.045] text-stone-200/75',
                                        )}
                                        data-testid={`mage-wars-spellbook-builder-scope-${value}`}
                                        aria-pressed={scopeFilter === value}
                                        onClick={() => setScopeFilter(value)}
                                    >
                                        {t(labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="min-h-0 overflow-auto p-2 scrollbar-thin" data-testid="mage-wars-spellbook-builder-card-pool">
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(7.75rem,1fr))] items-start gap-2" data-testid="mage-wars-spellbook-builder-card-pool-grid">
                                {filteredCards.map((spell) => {
                                    const cost = getMageWarsSpellbookCardCost(mageId, spell.spellCardId);
                                    const currentCount = getEntryCount(entries, spell.spellCardId);
                                    const limit = getMageWarsSpellbookCopyLimitForCard(spell.spellCardId);
                                    const restricted = Boolean(cost?.restrictionReason);
                                    const atLimit = currentCount >= limit;
                                    const pointBlocked = !restricted
                                        && !atLimit
                                        && summary.pointsUsed + (cost?.points ?? 0) > summary.pointLimit;
                                    const canAdd = !restricted && !atLimit && !pointBlocked;
                                    const status = restricted
                                        ? cost?.restrictionReason ?? t('spellbookBuilder.cardStatusRestricted')
                                        : atLimit
                                            ? t('spellbookBuilder.cardStatusAtLimit')
                                            : pointBlocked
                                                ? t('spellbookBuilder.cardStatusPointBlocked', { points: cost?.points ?? 0 })
                                                : currentCount > 0
                                                    ? t('spellbookBuilder.cardStatusInBook')
                                                    : t('spellbookBuilder.cardStatusAdd');
                                    return (
                                        <button
                                            key={spell.spellCardId}
                                            type="button"
                                            className={cx(
                                                'group relative min-w-0 border bg-black/20 p-1 transition',
                                                currentCount > 0 ? 'border-amber-200/80 shadow-[0_0_0_2px_rgba(232,187,102,0.14)]' : 'border-white/15 hover:border-amber-200/65',
                                                restricted && 'opacity-55 saturate-50',
                                                isWallSpell(spell) && 'col-span-2',
                                            )}
                                            data-testid="mage-wars-spellbook-builder-card"
                                            data-source-card-id={spell.spellCardId}
                                            data-in-current-book={String(currentCount > 0)}
                                            data-can-add={String(canAdd)}
                                            data-wall-card={String(isWallSpell(spell))}
                                            title={t('spellbookBuilder.cardTitle', { name: spell.name, status })}
                                            aria-label={t('spellbookBuilder.cardAria', { name: spell.name, status })}
                                            onClick={() => addSpell(spell)}
                                        >
                                            <div className="mx-auto w-full overflow-hidden bg-black/45" style={{ aspectRatio: getCardAspectRatio(spell) }}>
                                                <SpellCardArt spell={spell} className="transition duration-150 group-hover:scale-[1.018]" />
                                            </div>
                                            <span
                                                className={cx(
                                                    'absolute bottom-2 left-1/2 min-w-[4.6rem] -translate-x-1/2 border px-2 py-1 text-center text-[0.63rem] font-black leading-none opacity-0 shadow-[0_6px_16px_rgba(0,0,0,0.42)] transition-opacity group-active:opacity-100 group-focus-visible:opacity-100 group-hover:opacity-100',
                                                    canAdd
                                                        ? 'border-emerald-200/70 bg-emerald-200 text-stone-950'
                                                        : 'border-stone-200/25 bg-black/75 text-stone-100',
                                                )}
                                                data-testid="mage-wars-spellbook-builder-card-action"
                                            >
                                                {status}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    <aside
                        className="grid min-h-0 grid-rows-[2.55rem_minmax(0,1fr)_3.25rem] border border-stone-100/15 bg-black/24 shadow-[0_18px_44px_rgba(0,0,0,0.32)]"
                        aria-label={t('spellbookBuilder.currentListAria')}
                        data-testid="mage-wars-spellbook-builder-current-list"
                    >
                        <div className="flex min-h-0 items-center justify-between gap-3 border-b border-stone-100/15 bg-black/20 px-3">
                            <div>
                                <h2 className="m-0 text-base font-black leading-tight">
                                    {t('spellbookBuilder.currentListTitle')}
                                </h2>
                            </div>
                            <div className="grid justify-items-end gap-1 text-right" data-testid="mage-wars-spellbook-builder-visible-range">
                                <strong className="text-xs font-black leading-none text-stone-50">
                                    {t('spellbookBuilder.visibleRange', {
                                        range: selectedRows.length === 0 ? '0' : `1-${shownEnd}`,
                                        total: selectedRows.length,
                                    })}
                                </strong>
                            </div>
                        </div>
                        <div className="grid min-h-0 content-start gap-1.5 overflow-auto p-2.5" data-testid="mage-wars-spellbook-builder-deck-rows">
                            {selectedRows.map(({ entry, spell, cost }) => {
                                const limit = getMageWarsSpellbookCopyLimitForCard(entry.spellCardId);
                                const rowPoints = (cost?.points ?? 0) * entry.count;
                                const restricted = Boolean(cost?.restrictionReason);
                                return (
                                    <article
                                        key={entry.spellCardId}
                                        className={cx(
                                            'grid min-h-12 grid-cols-[2.25rem_minmax(0,1fr)_3rem_3.75rem_2.75rem] items-center gap-2 border bg-white/[0.045] p-1.5',
                                            restricted ? 'border-red-300/50 bg-red-400/10' : 'border-white/12',
                                        )}
                                        data-testid="mage-wars-spellbook-builder-deck-row"
                                        data-source-card-id={entry.spellCardId}
                                    >
                                        <div
                                            className={cx('overflow-hidden bg-black/45', isWallSpell(spell) ? 'h-6 w-[2.1rem]' : 'h-11 w-[2.1rem]')}
                                            style={{ aspectRatio: getCardAspectRatio(spell) }}
                                        >
                                            <SpellCardArt spell={spell} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-[0.69rem] font-black leading-tight text-stone-50">{spell.name}</div>
                                            <div className="mt-1 truncate text-[0.58rem] font-semibold leading-none text-stone-200/55">
                                                {cost?.restrictionReason ?? t('spellbookBuilder.schoolTrainingSummary', {
                                                    schools: formatSchools(spell),
                                                    training: t(getTrainingMultiplierLabelKey(cost?.multiplier)),
                                                })}
                                            </div>
                                        </div>
                                        <span className="text-center text-[0.64rem] font-black leading-none text-stone-100/85">
                                            {entry.count} / {limit}
                                        </span>
                                        <span className="text-center text-[0.64rem] font-black leading-none text-stone-100/75">
                                            {t('spellbookBuilder.pointsCompact', { points: rowPoints })}
                                        </span>
                                        <span className="grid grid-cols-2 gap-1">
                                            <button
                                                type="button"
                                                className="grid h-6 place-items-center border border-white/15 bg-black/32 text-xs font-black"
                                                aria-label={t('spellbookBuilder.removeCardAria', { name: spell.name })}
                                                data-testid="mage-wars-spellbook-builder-remove-card"
                                                onClick={() => applyEntries(setEntryCount(entries, entry.spellCardId, entry.count - 1))}
                                            >
                                                -
                                            </button>
                                            <button
                                                type="button"
                                                className="grid h-6 place-items-center border border-white/15 bg-black/32 text-xs font-black disabled:opacity-35"
                                                aria-label={t('spellbookBuilder.addCardAria', { name: spell.name })}
                                                data-testid="mage-wars-spellbook-builder-add-card"
                                                disabled={entry.count >= limit || restricted}
                                                onClick={() => addSpell(spell)}
                                            >
                                                +
                                            </button>
                                        </span>
                                    </article>
                                );
                            })}
                        </div>
                        <footer className="grid border-t border-stone-100/15 bg-black/20 p-2.5">
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    className="border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-bold"
                                    onClick={onClose}
                                >
                                    {t('spellbookBuilder.back')}
                                </button>
                                <button
                                    type="button"
                                    className="border border-amber-200/60 bg-amber-300 px-5 py-2 text-xs font-black text-stone-950 shadow-[0_10px_22px_rgba(0,0,0,0.36)]"
                                    data-testid="mage-wars-spellbook-builder-confirm"
                                    onClick={onClose}
                                >
                                    {t('spellbookBuilder.confirm')}
                                </button>
                            </div>
                        </footer>
                    </aside>
                </section>
            </div>

            {detailOpen ? (
                <section
                    className="mage-detail-layer fixed inset-0 z-50 grid place-items-center bg-black/70 p-10 backdrop-blur-[3px]"
                    data-testid="mage-wars-spellbook-builder-mage-detail"
                    aria-label={t('spellbookBuilder.mageDetailAria')}
                >
                    <div className="grid max-h-[calc(100vh-5rem)] w-[min(63rem,calc(100vw-5rem))] grid-cols-[22.5rem_minmax(0,1fr)] gap-5 overflow-auto border border-amber-200/45 bg-[#18110c] p-4 shadow-[0_38px_90px_rgba(0,0,0,0.64)]">
                        <div className="overflow-hidden border border-white/20 bg-black/40" style={{ aspectRatio: 744 / 1040 }}>
                            <CardPreview
                                previewRef={getMageWarsMagePreviewRef(mageId, 'card')}
                                className="h-full w-full object-contain"
                                title={currentSetup.displayName}
                                alt={currentSetup.displayName}
                            />
                        </div>
                        <div className="grid content-start gap-3">
                            <h2 className="m-0 text-2xl font-black leading-tight">{currentSetup.displayName}</h2>
                            <p className="m-0 text-sm font-semibold leading-relaxed text-stone-200/72">
                                {t('spellbookBuilder.mageDetailDescription')}
                            </p>
                            <div className="grid gap-2">
                                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] border border-white/12 bg-white/[0.045] p-2 text-sm">
                                    <span className="font-black text-stone-100/70">
                                        {t('spellbookBuilder.trainedDirection')}
                                    </span>
                                    <strong>{trainingProfile.trainedSchools.join(' / ') || t('spellbookBuilder.none')}</strong>
                                </div>
                                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] border border-white/12 bg-white/[0.045] p-2 text-sm">
                                    <span className="font-black text-stone-100/70">
                                        {t('spellbookBuilder.opposedDirection')}
                                    </span>
                                    <strong>{trainingProfile.opposedSchools.join(' / ') || t('spellbookBuilder.none')}</strong>
                                </div>
                                <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] border border-white/12 bg-white/[0.045] p-2 text-sm">
                                    <span className="font-black text-stone-100/70">
                                        {t('spellbookBuilder.currentListLabel')}
                                    </span>
                                    <strong>
                                        {t('spellbookBuilder.currentComposition', {
                                            cards: summary.cardCount,
                                            entries: summary.entryCount,
                                        })}
                                    </strong>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="mt-2 w-max border border-amber-200/60 bg-amber-300 px-5 py-2 text-sm font-black text-stone-950"
                                data-testid="mage-wars-spellbook-builder-mage-detail-close"
                                onClick={() => setDetailOpen(false)}
                            >
                                {t('spellbookBuilder.close')}
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
