import { useEffect, useMemo, useState } from 'react';
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
    getMageWarsSelectableMageIds,
    resolveMageWarsSelectedMageIdForSeat,
} from '../roomSetup';
import {
    getMageWarsMagePreviewAspectRatio,
    getMageWarsMagePreviewRef,
} from './cardAtlas';

type SeatId = '0' | '1';

const SEAT_IDS = ['0', '1'] as const satisfies readonly SeatId[];

function cx(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}

export function MageWarsMageSelectionGate({
    initialSetup,
    onConfirm,
}: GameRuntimeLocalSetupGateProps) {
    const { t } = useTranslation('game-mage-wars');
    const initialSeatMageIds = useMemo(() => [
        resolveMageWarsSelectedMageIdForSeat(initialSetup.setupData, 0),
        resolveMageWarsSelectedMageIdForSeat(initialSetup.setupData, 1),
    ] as [MageId, MageId], [initialSetup.setupData]);
    const [seatMageIds, setSeatMageIds] = useState<[MageId, MageId]>(initialSeatMageIds);
    const [activeSeatId, setActiveSeatId] = useState<SeatId>('0');

    useEffect(() => {
        setSeatMageIds(initialSeatMageIds);
    }, [initialSeatMageIds]);

    const mageCards = useMemo(() => getMageWarsSelectableMageIds().map((mageId) => ({
        mageId,
        setup: getPresetMageSetupFromConfig(mageId),
        spellbookCount: getPresetSpellbookCountFromConfig(mageId),
    })), []);

    const activeSeatIndex = activeSeatId === '0' ? 0 : 1;
    const activeMageId = seatMageIds[activeSeatIndex];
    const magePreviewAspectRatio = getMageWarsMagePreviewAspectRatio();

    const updateActiveSeatMage = (mageId: MageId) => {
        setSeatMageIds((current) => {
            const next: [MageId, MageId] = [...current];
            next[activeSeatIndex] = mageId;
            return next;
        });
    };

    const handleConfirm = () => {
        onConfirm({
            numPlayers: 2,
            setupSelections: buildMageWarsMageSetupSelections(seatMageIds),
            setupData: buildMageWarsMageSetupData(seatMageIds),
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

                <main className="mt-8 grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)_22rem] gap-8">
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
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section
                        className="grid min-h-0 content-start items-start grid-cols-4 gap-5"
                        aria-label={t('setup.mageSelection.mageGrid')}
                    >
                        {mageCards.map(({ mageId, setup, spellbookCount }) => {
                            const selectedForActiveSeat = mageId === activeMageId;
                            const selectedSeatIndexes = seatMageIds
                                .map((selectedMageId, index) => selectedMageId === mageId ? index : -1)
                                .filter((index) => index >= 0);
                            return (
                                <button
                                    key={mageId}
                                    type="button"
                                    className={cx(
                                        'group relative flex h-auto flex-col rounded-[0.5rem] border bg-black/40 p-3 text-left shadow-[0_18px_42px_rgba(0,0,0,0.38)] transition',
                                        selectedForActiveSeat
                                            ? 'border-amber-300 shadow-[0_0_28px_rgba(245,158,11,0.34)]'
                                            : 'border-white/10 hover:border-amber-200/50 hover:bg-black/50',
                                    )}
                                    data-testid={`mage-wars-mage-selection-card-${mageId}`}
                                    data-mage-id={mageId}
                                    aria-pressed={selectedForActiveSeat}
                                    onClick={() => updateActiveSeatMage(mageId)}
                                >
                                    <div
                                        className="relative mx-auto w-full max-w-[15.25rem] overflow-hidden rounded-[0.28rem] bg-black/50"
                                        data-testid={`mage-wars-mage-selection-card-${mageId}-preview`}
                                        style={{ aspectRatio: magePreviewAspectRatio }}
                                    >
                                        <CardPreview
                                            previewRef={getMageWarsMagePreviewRef(mageId, 'portrait')}
                                            className="h-full w-full rounded-[0.28rem] transition duration-200 group-hover:scale-[1.025]"
                                            title={setup.displayName}
                                            alt={setup.displayName}
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
                                        <div className="truncate text-lg font-black leading-none text-amber-100">
                                            {setup.displayName}
                                        </div>
                                        <div className="mt-2 text-[0.72rem] font-bold text-stone-200/80">
                                            <span>{t('setup.mageSelection.spellbookCount', { count: spellbookCount })}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </section>

                    <aside className="min-h-0 rounded-[0.55rem] border border-amber-100/10 bg-black/40 p-5 shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/60">
                            {t('setup.mageSelection.summary')}
                        </div>
                        <div className="mt-5 space-y-4">
                            {SEAT_IDS.map((seatId) => {
                                const seatIndex = seatId === '0' ? 0 : 1;
                                const mageId = seatMageIds[seatIndex];
                                const setup = getPresetMageSetupFromConfig(mageId);
                                return (
                                    <div
                                        key={seatId}
                                        className="grid grid-cols-[4.4rem_minmax(0,1fr)] gap-3 rounded-[0.45rem] border border-white/10 bg-white/[0.06] p-3"
                                        data-testid={`mage-wars-mage-selection-summary-${seatId}`}
                                        data-mage-id={mageId}
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
                                                {setup.displayName}
                                            </div>
                                            <div className="mt-2 text-xs font-semibold leading-relaxed text-stone-200/75">
                                                {t('setup.mageSelection.summaryLine', {
                                                    spellbook: getPresetSpellbookCountFromConfig(mageId),
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
}
