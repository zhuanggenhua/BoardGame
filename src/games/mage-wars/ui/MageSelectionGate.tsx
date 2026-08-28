import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { GameRuntimeLocalSetupGateProps } from '../../gameRuntimeAdapter';
import {
    getPresetMageSetupFromConfig,
    getPresetSpellbookCountFromConfig,
} from '../data/configPackage';
import type { MageId } from '../domain/ids';
import {
    buildMageWarsMageSetupData,
    buildMageWarsMageSetupSelections,
    getMageWarsDefaultSpellbookEntries,
    getMageWarsSelectableMageIds,
    resolveMageWarsSelectedMageIdForSeat,
    resolveMageWarsSpellbookEntriesForSeat,
} from '../roomSetup';
import type { MageWarsPlayerSpellbookEntry } from '../domain/spellbook';
import {
    deleteMageWarsSavedSpellbook,
    loadMageWarsSavedSpellbooks,
    type MageWarsSavedSpellbook,
} from '../domain/savedSpellbooks';
import {
    getMageWarsMagePreviewAspectRatio,
    getMageWarsMagePreviewRef,
} from './cardAtlas';
import { MageWarsSpellbookBuilderPanel } from './SpellbookBuilderPanel';

type SeatId = '0' | '1';

const SEAT_IDS = ['0', '1'] as const satisfies readonly SeatId[];

type StandardSpellbookOption = {
    kind: 'standard';
    mageId: MageId;
    displayName: string;
    spellbookCount: number;
};

function cx(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}

function getMageSelectionSetupKey(initialSetup: GameRuntimeLocalSetupGateProps['initialSetup']): string {
    return JSON.stringify(initialSetup.setupData);
}

export function MageWarsMageSelectionGate(props: GameRuntimeLocalSetupGateProps) {
    return <MageWarsMageSelectionGateContent key={getMageSelectionSetupKey(props.initialSetup)} {...props} />;
}

function MageWarsMageSelectionGateContent({
    initialSetup,
    onConfirm,
}: GameRuntimeLocalSetupGateProps) {
    const { t } = useTranslation('game-mage-wars');
    const initialSeatMageIds = useMemo(() => [
        resolveMageWarsSelectedMageIdForSeat(initialSetup.setupData, 0),
        resolveMageWarsSelectedMageIdForSeat(initialSetup.setupData, 1),
    ] as [MageId, MageId], [initialSetup.setupData]);
    const initialSeatSpellbookEntries = useMemo(() => [
        resolveMageWarsSpellbookEntriesForSeat(initialSetup.setupData, 0, initialSeatMageIds[0]),
        resolveMageWarsSpellbookEntriesForSeat(initialSetup.setupData, 1, initialSeatMageIds[1]),
    ] as [MageWarsPlayerSpellbookEntry[], MageWarsPlayerSpellbookEntry[]], [initialSetup.setupData, initialSeatMageIds]);
    const [seatMageIds, setSeatMageIds] = useState<[MageId, MageId]>(initialSeatMageIds);
    const [seatSpellbookEntries, setSeatSpellbookEntries] = useState<
        [MageWarsPlayerSpellbookEntry[], MageWarsPlayerSpellbookEntry[]]
    >(initialSeatSpellbookEntries);
    const [seatSavedSpellbookIds, setSeatSavedSpellbookIds] = useState<[string | null, string | null]>([null, null]);
    const [activeSeatId, setActiveSeatId] = useState<SeatId>('0');
    const [builderOpen, setBuilderOpen] = useState(false);
    const [savedLibraryRevision, setSavedLibraryRevision] = useState(0);

    const standardSpellbookOptions = useMemo<StandardSpellbookOption[]>(() => getMageWarsSelectableMageIds()
        .map((mageId) => ({
            kind: 'standard',
            mageId,
            displayName: getPresetMageSetupFromConfig(mageId).displayName,
            spellbookCount: getPresetSpellbookCountFromConfig(mageId),
        })), []);

    const activeSeatIndex = activeSeatId === '0' ? 0 : 1;
    const activeMageId = seatMageIds[activeSeatIndex];
    const magePreviewAspectRatio = getMageWarsMagePreviewAspectRatio();
    const savedSpellbooks = useMemo(() => {
        void savedLibraryRevision;
        return loadMageWarsSavedSpellbooks();
    }, [savedLibraryRevision]);
    const activeSavedSpellbookId = seatSavedSpellbookIds[activeSeatIndex];

    const applyStandardSpellbookToActiveSeat = (mageId: MageId) => {
        setSeatMageIds((current) => {
            const next: [MageId, MageId] = [...current];
            next[activeSeatIndex] = mageId;
            return next;
        });
        setSeatSpellbookEntries((current) => {
            const next: [MageWarsPlayerSpellbookEntry[], MageWarsPlayerSpellbookEntry[]] = [
                [...current[0]],
                [...current[1]],
            ];
            next[activeSeatIndex] = getMageWarsDefaultSpellbookEntries(mageId);
            return next;
        });
        setSeatSavedSpellbookIds((current) => {
            const next: [string | null, string | null] = [...current];
            next[activeSeatIndex] = null;
            return next;
        });
    };

    const applySavedSpellbookToActiveSeat = (saved: MageWarsSavedSpellbook) => {
        setSeatMageIds((current) => {
            const next: [MageId, MageId] = [...current];
            next[activeSeatIndex] = saved.mageId;
            return next;
        });
        setSeatSpellbookEntries((current) => {
            const next: [MageWarsPlayerSpellbookEntry[], MageWarsPlayerSpellbookEntry[]] = [
                [...current[0]],
                [...current[1]],
            ];
            next[activeSeatIndex] = saved.entries.map((entry) => ({ ...entry }));
            return next;
        });
        setSeatSavedSpellbookIds((current) => {
            const next: [string | null, string | null] = [...current];
            next[activeSeatIndex] = saved.id;
            return next;
        });
    };

    const updateActiveSpellbookEntries = (entries: readonly MageWarsPlayerSpellbookEntry[]) => {
        setSeatSpellbookEntries((current) => {
            const next: [MageWarsPlayerSpellbookEntry[], MageWarsPlayerSpellbookEntry[]] = [
                [...current[0]],
                [...current[1]],
            ];
            next[activeSeatIndex] = entries.map((entry) => ({ ...entry }));
            return next;
        });
    };

    const updateActiveSavedSpellbook = (saved: MageWarsSavedSpellbook | null) => {
        if (saved) {
            setSeatMageIds((current) => {
                const next: [MageId, MageId] = [...current];
                next[activeSeatIndex] = saved.mageId;
                return next;
            });
        }
        setSeatSavedSpellbookIds((current) => {
            const next: [string | null, string | null] = [...current];
            next[activeSeatIndex] = saved?.id ?? null;
            return next;
        });
        if (saved) {
            updateActiveSpellbookEntries(saved.entries);
        }
    };

    const refreshSavedLibrary = () => {
        setSavedLibraryRevision((value) => value + 1);
    };

    const selectSavedSpellbook = (saved: MageWarsSavedSpellbook) => {
        applySavedSpellbookToActiveSeat(saved);
    };

    const selectStandardSpellbook = (mageId: MageId = activeMageId) => {
        setSeatMageIds((current) => {
            const next: [MageId, MageId] = [...current];
            next[activeSeatIndex] = mageId;
            return next;
        });
        setSeatSpellbookEntries((current) => {
            const next: [MageWarsPlayerSpellbookEntry[], MageWarsPlayerSpellbookEntry[]] = [
                [...current[0]],
                [...current[1]],
            ];
            next[activeSeatIndex] = getMageWarsDefaultSpellbookEntries(mageId);
            return next;
        });
        setSeatSavedSpellbookIds((current) => {
            const next: [string | null, string | null] = [...current];
            next[activeSeatIndex] = null;
            return next;
        });
    };

    const editSavedSpellbook = (saved: MageWarsSavedSpellbook) => {
        applySavedSpellbookToActiveSeat(saved);
        setBuilderOpen(true);
    };

    const removeSavedSpellbook = (saved: MageWarsSavedSpellbook) => {
        deleteMageWarsSavedSpellbook(saved.id);
        refreshSavedLibrary();
        const affectedSeatIndexes = seatSavedSpellbookIds
            .map((savedSpellbookId, index) => savedSpellbookId === saved.id ? index : -1)
            .filter((index) => index >= 0);
        if (affectedSeatIndexes.length > 0) {
            setSeatSpellbookEntries((current) => {
                const next: [MageWarsPlayerSpellbookEntry[], MageWarsPlayerSpellbookEntry[]] = [
                    [...current[0]],
                    [...current[1]],
                ];
                affectedSeatIndexes.forEach((seatIndex) => {
                    next[seatIndex] = getMageWarsDefaultSpellbookEntries(saved.mageId);
                });
                return next;
            });
            setSeatSavedSpellbookIds((current) => {
                const next: [string | null, string | null] = [...current];
                affectedSeatIndexes.forEach((seatIndex) => {
                    next[seatIndex] = null;
                });
                return next;
            });
        }
    };

    const handleConfirm = () => {
        onConfirm({
            numPlayers: 2,
            setupSelections: buildMageWarsMageSetupSelections(seatMageIds),
            setupData: buildMageWarsMageSetupData(seatMageIds, seatSpellbookEntries),
        });
    };

    return (
        <div
            className="absolute inset-0 overflow-hidden bg-[#140604] text-stone-100"
            data-testid="mage-wars-mage-selection-gate"
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(245,158,11,0.24),transparent_34%),radial-gradient(circle_at_12%_84%,rgba(22,163,74,0.2),transparent_28%),linear-gradient(135deg,#180604_0%,#3b1409_55%,#070201_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.08)_42%,rgba(0,0,0,0.62)_100%)]" />

            <div className="relative z-10 flex h-full min-h-0 flex-col px-12 py-8">
                <header className="flex shrink-0 items-start justify-between gap-8">
                    <div>
                        <div className="text-sm font-black uppercase tracking-[0.24em] text-amber-200/70">
                            {t('setup.mageSelection.eyebrow')}
                        </div>
                        <h1 className="mt-2 text-4xl font-black leading-none text-amber-100 drop-shadow-[0_4px_18px_rgba(0,0,0,0.62)]">
                            {t('setup.mageSelection.title')}
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-stone-200/75">
                            {t('setup.mageSelection.description')}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rounded-[0.35rem] border border-amber-200/50 bg-amber-400 px-7 py-3 text-base font-black text-stone-950 shadow-[0_12px_28px_rgba(0,0,0,0.42)] transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                        data-testid="mage-wars-mage-selection-confirm"
                        onClick={handleConfirm}
                    >
                        {t('setup.mageSelection.confirm')}
                    </button>
                </header>

                <main className="mt-8 grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_20rem] gap-6">
                    <section
                        className="min-h-0 rounded-[0.55rem] border border-amber-100/10 bg-black/40 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.34)]"
                        aria-label={t('setup.mageSelection.seats')}
                    >
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/60">
                            {t('setup.mageSelection.seats')}
                        </div>
                        <div className="mt-4 space-y-3">
                            {SEAT_IDS.map((seatId) => {
                                const seatIndex = seatId === '0' ? 0 : 1;
                                const mageId = seatMageIds[seatIndex];
                                const mageSetup = getPresetMageSetupFromConfig(mageId);
                                const selectedSavedSpellbook = seatSavedSpellbookIds[seatIndex]
                                    ? savedSpellbooks.find((saved) => saved.id === seatSavedSpellbookIds[seatIndex]) ?? null
                                    : null;
                                const active = activeSeatId === seatId;
                                return (
                                    <button
                                        key={seatId}
                                        type="button"
                                        className={cx(
                                            'w-full rounded-[0.45rem] border p-3 text-left transition',
                                            active
                                                ? 'border-amber-300/75 bg-amber-400/20 shadow-[0_0_20px_rgba(245,158,11,0.22)]'
                                                : 'border-white/10 bg-white/5 hover:border-amber-200/30 hover:bg-white/10',
                                        )}
                                        data-testid={`mage-wars-mage-selection-seat-${seatId}`}
                                        aria-pressed={active}
                                        onClick={() => setActiveSeatId(seatId)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={cx(
                                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black',
                                                seatId === '0'
                                                    ? 'bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.42)]'
                                                    : 'bg-sky-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.42)]',
                                            )}>
                                                P{seatIndex + 1}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-black text-white">
                                                    {seatIndex === 0
                                                        ? t('setup.seat0Mage.label')
                                                        : t('setup.seat1Mage.label')}
                                                </span>
                                                <span className="block truncate text-xs font-semibold text-amber-100/75">
                                                    {mageSetup.displayName}
                                                </span>
                                                <span className="mt-1 block truncate text-[0.68rem] font-semibold text-stone-200/62">
                                                    {selectedSavedSpellbook?.name ?? t('setup.mageSelection.standardSpellbook')}
                                                </span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section
                        className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[0.55rem] border border-amber-100/10 bg-black/30 p-4 shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
                        aria-label={t('setup.mageSelection.spellbookLibrary')}
                        data-testid="mage-wars-mage-selection-spellbook-library"
                    >
                        <div className="flex min-h-0 items-end justify-between gap-4 border-b border-white/10 pb-3">
                            <div>
                                <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/60">
                                    {t('setup.mageSelection.spellbookLibrary')}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-stone-200/70">
                                    {t('setup.mageSelection.spellbookLibraryHelp')}
                                </div>
                            </div>
                        </div>

                        <div
                            className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] content-start gap-4 overflow-auto pt-4 pr-1 scrollbar-thin"
                            data-testid="mage-wars-mage-selection-saved-spellbook-list"
                        >
                            {standardSpellbookOptions.map((option) => {
                                const selectedForActiveSeat = activeSavedSpellbookId === null && activeMageId === option.mageId;
                                const selectedSeatIndexes = seatMageIds
                                    .map((selectedMageId, index) => (
                                        selectedMageId === option.mageId && seatSavedSpellbookIds[index] === null ? index : -1
                                    ))
                                    .filter((index) => index >= 0);
                                return (
                                    <article
                                        key={`standard-${option.mageId}`}
                                        className={cx(
                                            'min-h-0 rounded-[0.5rem] border bg-black/40 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.32)] transition',
                                            selectedForActiveSeat
                                                ? 'border-amber-300 shadow-[0_0_28px_rgba(245,158,11,0.28)]'
                                                : 'border-white/10 hover:border-amber-200/50',
                                        )}
                                        data-testid="mage-wars-mage-selection-standard-spellbook"
                                        data-library-kind="standard"
                                        data-mage-id={option.mageId}
                                        data-active={String(selectedForActiveSeat)}
                                    >
                                        <button
                                            type="button"
                                            className="group block min-h-0 w-full text-left"
                                            data-testid={`mage-wars-mage-selection-standard-spellbook-${option.mageId}`}
                                            aria-pressed={selectedForActiveSeat}
                                            onClick={() => selectStandardSpellbook(option.mageId)}
                                        >
                                            <div
                                                className="relative mx-auto w-full max-w-[12.5rem] overflow-hidden rounded-[0.28rem] bg-black/50"
                                                data-testid={`mage-wars-mage-selection-standard-spellbook-${option.mageId}-preview`}
                                                style={{ aspectRatio: magePreviewAspectRatio }}
                                            >
                                                <CardPreview
                                                    previewRef={getMageWarsMagePreviewRef(option.mageId, 'portrait')}
                                                    className="h-full w-full rounded-[0.28rem] object-contain transition duration-200 group-hover:scale-[1.025]"
                                                    title={option.displayName}
                                                    alt={option.displayName}
                                                />
                                                {selectedSeatIndexes.length > 0 ? (
                                                    <div className="absolute left-2 top-2 flex gap-1">
                                                        {selectedSeatIndexes.map((seatIndex) => (
                                                            <span
                                                                key={seatIndex}
                                                                className={cx(
                                                                    'rounded-full px-2 py-1 text-[0.65rem] font-black leading-none text-white shadow-[0_4px_10px_rgba(0,0,0,0.46)]',
                                                                    seatIndex === 0 ? 'bg-rose-500' : 'bg-sky-500',
                                                                )}
                                                            >
                                                                P{seatIndex + 1}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="mt-3">
                                                <strong className="block truncate text-base font-black leading-tight text-amber-100">
                                                    {t('setup.mageSelection.standardSpellbook')}
                                                </strong>
                                                <span className="mt-1 block truncate text-sm font-black text-stone-50">
                                                    {option.displayName}
                                                </span>
                                                <span className="mt-2 block text-[0.72rem] font-semibold text-stone-200/70">
                                                    {t('setup.mageSelection.spellbookCardSummary', {
                                                        count: option.spellbookCount,
                                                    })}
                                                </span>
                                            </div>
                                        </button>
                                    </article>
                                );
                            })}

                            {savedSpellbooks.length === 0 ? (
                                <div className="rounded-[0.45rem] border border-dashed border-white/10 bg-black/24 px-4 py-5 text-sm font-semibold text-stone-200/58">
                                    {t('setup.mageSelection.noNamedCopies')}
                                </div>
                            ) : savedSpellbooks.map((saved) => {
                                const setup = getPresetMageSetupFromConfig(saved.mageId);
                                const cardCount = saved.entries.reduce((total, entry) => total + entry.count, 0);
                                const selected = activeSavedSpellbookId === saved.id;
                                const selectedSeatIndexes = seatSavedSpellbookIds
                                    .map((savedSpellbookId, index) => savedSpellbookId === saved.id ? index : -1)
                                    .filter((index) => index >= 0);
                                return (
                                    <article
                                        key={saved.id}
                                        className={cx(
                                            'grid min-h-0 grid-rows-[minmax(0,1fr)_auto] rounded-[0.5rem] border bg-black/40 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.32)] transition',
                                            selected
                                                ? 'border-amber-300 shadow-[0_0_28px_rgba(245,158,11,0.28)]'
                                                : 'border-white/10 hover:border-amber-200/50',
                                        )}
                                        data-testid="mage-wars-mage-selection-saved-spellbook"
                                        data-library-kind="saved"
                                        data-saved-spellbook-id={saved.id}
                                        data-mage-id={saved.mageId}
                                        data-active={String(selected)}
                                    >
                                        <button
                                            type="button"
                                            className="group block min-h-0 w-full text-left"
                                            data-testid="mage-wars-mage-selection-use-saved-spellbook"
                                            aria-pressed={selected}
                                            onClick={() => selectSavedSpellbook(saved)}
                                        >
                                            <div
                                                className="relative mx-auto w-full max-w-[12.5rem] overflow-hidden rounded-[0.28rem] bg-black/50"
                                                data-testid="mage-wars-mage-selection-saved-spellbook-preview"
                                                style={{ aspectRatio: magePreviewAspectRatio }}
                                            >
                                                <CardPreview
                                                    previewRef={getMageWarsMagePreviewRef(saved.mageId, 'portrait')}
                                                    className="h-full w-full rounded-[0.28rem] object-contain transition duration-200 group-hover:scale-[1.025]"
                                                    title={setup.displayName}
                                                    alt={setup.displayName}
                                                />
                                                <span
                                                    className="absolute right-2 top-2 border border-fuchsia-300/40 bg-fuchsia-400/22 px-2 py-1 text-[0.65rem] font-black uppercase leading-none tracking-[0.12em] text-fuchsia-100 shadow-[0_4px_10px_rgba(0,0,0,0.46)]"
                                                    data-testid="mage-wars-mage-selection-saved-spellbook-diy-badge"
                                                >
                                                    {t('setup.mageSelection.diyBadge')}
                                                </span>
                                                {selectedSeatIndexes.length > 0 ? (
                                                    <div className="absolute left-2 top-2 flex gap-1">
                                                        {selectedSeatIndexes.map((seatIndex) => (
                                                            <span
                                                                key={seatIndex}
                                                                className={cx(
                                                                    'rounded-full px-2 py-1 text-[0.65rem] font-black leading-none text-white shadow-[0_4px_10px_rgba(0,0,0,0.46)]',
                                                                    seatIndex === 0 ? 'bg-rose-500' : 'bg-sky-500',
                                                                )}
                                                            >
                                                                P{seatIndex + 1}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="mt-3">
                                                <strong className="block truncate text-base font-black leading-tight text-amber-100">
                                                    {saved.name}
                                                </strong>
                                                <span className="mt-1 block truncate text-sm font-black text-stone-50">
                                                    {setup.displayName}
                                                </span>
                                                <span className="mt-2 block text-[0.72rem] font-semibold text-stone-200/70">
                                                    {t('setup.mageSelection.spellbookCardSummary', {
                                                        count: cardCount,
                                                    })}
                                                </span>
                                            </div>
                                        </button>
                                        <div className="mt-3 grid grid-cols-2 gap-1.5">
                                            <button
                                                type="button"
                                                className="rounded-[0.25rem] border border-white/15 bg-black/24 px-2 py-1.5 text-[0.68rem] font-black text-stone-100 hover:border-amber-200/55"
                                                data-testid="mage-wars-mage-selection-edit-saved-spellbook"
                                                onClick={() => editSavedSpellbook(saved)}
                                            >
                                                {t('setup.mageSelection.edit')}
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-[0.25rem] border border-white/15 bg-black/24 px-2 py-1.5 text-[0.68rem] font-black text-stone-100 hover:border-red-200/55 hover:text-red-200"
                                                data-testid="mage-wars-mage-selection-delete-saved-spellbook"
                                                onClick={() => removeSavedSpellbook(saved)}
                                            >
                                                {t('setup.mageSelection.delete')}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-[0.55rem] border border-amber-100/10 bg-black/40 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/60">
                            {t('setup.mageSelection.summary')}
                        </div>
                        <div className="mt-5 min-h-0 space-y-3 overflow-auto pr-1 scrollbar-thin">
                            {SEAT_IDS.map((seatId) => {
                                const seatIndex = seatId === '0' ? 0 : 1;
                                const mageId = seatMageIds[seatIndex];
                                const setup = getPresetMageSetupFromConfig(mageId);
                                const selectedSavedSpellbook = seatSavedSpellbookIds[seatIndex]
                                    ? savedSpellbooks.find((saved) => saved.id === seatSavedSpellbookIds[seatIndex]) ?? null
                                    : null;
                                const spellbookCount = seatSpellbookEntries[seatIndex]
                                    .reduce((total, entry) => total + entry.count, 0);
                                return (
                                    <div
                                        key={seatId}
                                        className={cx(
                                            'grid grid-cols-[4.4rem_minmax(0,1fr)] gap-3 rounded-[0.45rem] border bg-white/[0.06] p-3',
                                            activeSeatId === seatId ? 'border-amber-200/55' : 'border-white/10',
                                        )}
                                        data-testid={`mage-wars-mage-selection-summary-${seatId}`}
                                        data-mage-id={mageId}
                                        data-saved-spellbook-id={seatSavedSpellbookIds[seatIndex] ?? ''}
                                    >
                                        <div
                                            className="w-[4.4rem] overflow-hidden rounded-[0.18rem] shadow-[0_8px_18px_rgba(0,0,0,0.42)]"
                                            data-testid={`mage-wars-mage-selection-summary-${seatId}-preview`}
                                            style={{ aspectRatio: magePreviewAspectRatio }}
                                        >
                                            <CardPreview
                                                previewRef={getMageWarsMagePreviewRef(mageId, 'card')}
                                                className="h-full w-full rounded-[0.18rem]"
                                                title={setup.displayName}
                                                alt={setup.displayName}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-stone-300">
                                                {seatIndex === 0
                                                    ? t('setup.seat0Mage.label')
                                                    : t('setup.seat1Mage.label')}
                                            </div>
                                            <div className="mt-1 truncate text-lg font-black text-white">
                                                {selectedSavedSpellbook?.name ?? t('setup.mageSelection.standardSpellbook')}
                                            </div>
                                            <div className="mt-1 truncate text-xs font-black text-amber-100/75">
                                                {setup.displayName}
                                            </div>
                                            <div className="mt-2 text-xs font-semibold leading-relaxed text-stone-200/75">
                                                {t('setup.mageSelection.summaryLine', {
                                                    spellbook: spellbookCount,
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            className="mt-5 rounded-[0.35rem] border border-amber-200/60 bg-amber-300 px-3 py-2.5 text-sm font-black text-stone-950 shadow-[0_10px_20px_rgba(0,0,0,0.32)] transition hover:bg-amber-200"
                            data-testid="mage-wars-open-spellbook-builder"
                            onClick={() => setBuilderOpen(true)}
                        >
                            {t('setup.mageSelection.editCurrentSpellbook')}
                        </button>
                    </aside>
                </main>
            </div>
            {builderOpen ? (
                <MageWarsSpellbookBuilderPanel
                    mageId={activeMageId}
                    entries={seatSpellbookEntries[activeSeatIndex]}
                    activeSavedSpellbookId={activeSavedSpellbookId}
                    onEntriesChange={updateActiveSpellbookEntries}
                    onSavedLibraryChange={refreshSavedLibrary}
                    onSavedSpellbookChange={updateActiveSavedSpellbook}
                    onClose={() => setBuilderOpen(false)}
                />
            ) : null}
        </div>
    );
}
