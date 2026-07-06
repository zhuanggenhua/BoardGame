import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorialBridge } from '../../contexts/TutorialContext';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { formatCard } from './domain/cards';
import { TEXAS_HOLDEM_HAND_RANK_RULES, type PokerHandRankRule } from './domain/poker';
import {
    THE_GANG_COMMANDS,
    type PlayingCard,
    type TheGangCommandMap,
    type TheGangCore,
    type TheGangProgressKind,
} from './domain/types';

type Props = GameBoardProps<TheGangCore, TheGangCommandMap>;

const ROUND_LABELS = {
    1: '白筹码',
    2: '黄筹码',
    3: '橙筹码',
    4: '红筹码',
};

const CHIP_ASSET_COLORS = {
    1: 'white',
    2: 'yellow',
    3: 'orange',
    4: 'red',
};

const getChipAssetPath = (round: number, value: number) => {
    const color = CHIP_ASSET_COLORS[round as keyof typeof CHIP_ASSET_COLORS] ?? 'white';
    return `the-gang/chips/round-${round}-${color}-${value}`;
};

const CARD_BACK_ASSET_PATH = 'the-gang/cards/card-back';

const CARD_RANK_ASSET_NAMES: Record<PlayingCard['rank'], string> = {
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    J: 'jack',
    Q: 'queen',
    K: 'king',
    A: 'ace',
};

const getCardAssetPath = (card: PlayingCard) =>
    `the-gang/cards/${CARD_RANK_ASSET_NAMES[card.rank]}-${card.suit}`;

const BGG_LAYOUT_CONTRACT = {
    source: 'BGG electronic DOM/CSS',
    topZone: 'top_zone / plboard',
    middleZone: 'middle_zone / token_pile / card_river',
    bottomZone: 'bottom_zone / vaults_alarms_zone / hand_groupzone',
};

const DEFAULT_HAND_RANK_RULES = TEXAS_HOLDEM_HAND_RANK_RULES;

type TFunction = ReturnType<typeof useTranslation>['t'];

type CardFaceEmphasis = 'table' | 'river' | 'hand' | 'showdown';

interface ProgressButtonState {
    approvals: string[];
    hasApproved: boolean;
    label: string;
    status: string;
}

function ProgressVoteDots({
    playerIds,
    approvals,
    label,
}: {
    playerIds: string[];
    approvals: string[];
    label: string;
}) {
    return (
        <div
            aria-label={label}
            className="flex items-center justify-center gap-1.5"
            data-testid="the-gang-progress-vote-dots"
        >
            {playerIds.map((playerId) => {
                const approved = approvals.includes(playerId);
                return (
                    <span
                        key={playerId}
                        aria-label={approved ? `${playerId} approved` : `${playerId} pending`}
                        data-approved={approved ? 'true' : 'false'}
                        className={[
                            'h-2.5 w-2.5 rounded-full transition',
                            approved
                                ? 'bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.68)]'
                                : 'bg-white/28 ring-1 ring-white/18',
                        ].join(' ')}
                    />
                );
            })}
        </div>
    );
}

const getProgressButtonState = (
    core: TheGangCore,
    kind: TheGangProgressKind,
    localPlayerId: string,
    baseLabel: string,
    t: TFunction,
): ProgressButtonState => {
    const approvals = core.pendingProgress?.kind === kind ? core.pendingProgress.approvals : [];
    const hasApproved = approvals.includes(localPlayerId);
    return {
        approvals,
        hasApproved,
        label: hasApproved ? t('board.progressWaiting') : baseLabel,
        status: approvals.length > 0
            ? t('board.progressApprovedCount', { approved: approvals.length, total: core.playerIds.length })
            : t('board.progressNeedsAll'),
    };
};

function CardFace({
    card,
    hidden = false,
    emphasis = 'table',
    t,
}: {
    card?: PlayingCard;
    hidden?: boolean;
    emphasis?: CardFaceEmphasis;
    t: TFunction;
}) {
    const sizeClassByEmphasis: Record<CardFaceEmphasis, string> = {
        table: 'h-14 w-10 md:h-16 md:w-11 lg:h-24 lg:w-[4.25rem] xl:h-28 xl:w-20',
        river: 'h-20 w-14 md:h-24 md:w-16 lg:h-32 lg:w-[5.5rem] xl:h-40 xl:w-28',
        hand: 'h-20 w-14 md:h-24 md:w-16 lg:h-32 lg:w-[5.5rem] xl:h-40 xl:w-28',
        showdown: 'h-16 w-11 md:h-20 md:w-14 lg:h-24 lg:w-[4.25rem] xl:h-28 xl:w-20',
    };
    const sizeClass = sizeClassByEmphasis[emphasis];

    if (hidden || !card) {
        return (
            <div className={`${sizeClass} overflow-hidden rounded-md bg-slate-800 shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/70`}>
                <OptimizedImage
                    src={CARD_BACK_ASSET_PATH}
                    alt={t('board.cardBackAlt')}
                    className="h-full w-full object-cover"
                    draggable={false}
                    placeholder={false}
                />
            </div>
        );
    }

    return (
        <div className={`${sizeClass} overflow-hidden rounded-md bg-white shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/75`}>
            <OptimizedImage
                src={getCardAssetPath(card)}
                alt={formatCard(card)}
                className="h-full w-full object-cover"
                draggable={false}
                placeholder={false}
            />
        </div>
    );
}

function LayoutContractBadge() {
    const { t } = useTranslation('game-the-gang');

    return (
        <span className="sr-only" data-testid="the-gang-layout-contract">
            {t('board.layoutContract')}
        </span>
    );
}

function HandRankReference({ rules = DEFAULT_HAND_RANK_RULES }: { rules?: readonly PokerHandRankRule[] }) {
    const { t } = useTranslation('game-the-gang');
    const orderedRules = [...rules].sort((left, right) => left.category - right.category);

    return (
        <details
            className="group absolute bottom-1 left-1 z-20 max-w-[20rem] text-[0.62rem] font-black text-amber-50/94 lg:bottom-2 lg:left-2 lg:text-xs"
            data-tutorial-id="the-gang-hand-rank-reference"
            data-bgg-zone="hand-rank-reference"
        >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-emerald-950/82 px-3 py-1.5 text-amber-100 shadow-[0_0.18rem_0.8rem_rgba(0,0,0,0.28)] ring-1 ring-amber-200/24 transition marker:hidden hover:bg-emerald-900/88 hover:text-amber-50 group-open:bg-amber-200 group-open:text-emerald-950 [&::-webkit-details-marker]:hidden" aria-label={t('board.handRankReferenceAria')}>
                <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-200/45 text-[0.62rem] leading-none">?</span>
                {t('board.handRankReference')}
            </summary>
            <div className="mt-1 rounded-lg bg-emerald-950/92 p-2 shadow-[0_0.25rem_1rem_rgba(0,0,0,0.35)] ring-1 ring-amber-200/22">
                <div className="mb-1 flex items-center justify-between gap-3 text-[0.58rem] tracking-[0.12em] text-amber-200/72 lg:text-[0.66rem]">
                    <span>{t('board.handRankWeak')}</span>
                    <span>{t('board.handRankStrong')}</span>
                </div>
                <ol className="grid grid-cols-2 gap-x-4 gap-y-0.5" aria-label={t('board.handRankListAria')}>
                {orderedRules.map((rule, index) => (
                    <li key={rule.category} className="flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1 py-0.5 leading-tight odd:bg-amber-50/[0.04]">
                        <span className="w-3 text-right text-amber-200/70 tabular-nums">{index + 1}</span>
                        <span className="text-amber-50">{rule.label}</span>
                    </li>
                ))}
                </ol>
            </div>
        </details>
    );
}

function ChipDisc({
    round,
    value,
    size = 'md',
    className = '',
    zone,
}: {
    round: number;
    value: number;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
    zone?: string;
}) {
    const sizeClass = {
        xs: 'h-5 w-5 lg:h-6 lg:w-6',
        sm: 'h-7 w-7 lg:h-8 lg:w-8',
        md: 'h-8 w-8 md:h-9 md:w-9 lg:h-12 lg:w-12',
        lg: 'h-10 w-10 md:h-12 md:w-12 lg:h-16 lg:w-16',
    }[size];
    const { t } = useTranslation('game-the-gang');
    const roundLabel = t(`board.roundLabels.${round}`, { defaultValue: ROUND_LABELS[round as keyof typeof ROUND_LABELS] ?? t('board.chip') });
    const label = t('board.chipLabel', { round: roundLabel, value });

    return (
        <span
            className={['relative inline-flex rounded-full', sizeClass, className].join(' ')}
            aria-label={label}
            data-bgg-zone={zone}
        >
            <OptimizedImage
                src={getChipAssetPath(round, value)}
                alt={label}
                className="h-full w-full rounded-full object-contain drop-shadow-[0.12rem_0.16rem_0_rgba(0,0,0,0.5)]"
                draggable={false}
                placeholder={false}
            />
        </span>
    );
}

function ChipButton({
    round,
    value,
    owner,
    selected,
    onClick,
    disabled: forceDisabled = false,
}: {
    round: number;
    value: number;
    owner?: string;
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
}) {
    const disabled = forceDisabled || (!!owner && !selected);
    const { t } = useTranslation('game-the-gang');
    const roundLabel = t(`board.roundLabels.${round}`, { defaultValue: ROUND_LABELS[round as keyof typeof ROUND_LABELS] ?? t('board.chip') });
    const label = t('board.chipLabel', { round: roundLabel, value });
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            title={owner && !selected ? t('board.chipTakenByPlayer', { label, player: Number(owner) + 1 }) : label}
            className={[
                'relative rounded-full p-0 transition',
                selected ? 'scale-110 drop-shadow-[0_0_20px_rgba(252,211,77,0.8)]' : '',
                !selected && !disabled ? 'hover:scale-105 hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.55)]' : '',
                disabled ? 'cursor-not-allowed opacity-35 grayscale' : '',
            ].join(' ')}
        >
            <ChipDisc round={round} value={value} />
        </button>
    );
}

function AlarmTrack({ failures }: { failures: number }) {
    const { t } = useTranslation('game-the-gang');

    return (
        <span
            className="text-rose-100"
            aria-label={t('board.failuresLabel', { failures })}
        >
            <span className="sr-only">{t('board.failures')}</span>
            <span className="font-bold">{t('board.alarmTrack', { failures })}</span>
        </span>
    );
}

function SuccessTrack({ successes }: { successes: number }) {
    const { t } = useTranslation('game-the-gang');

    return (
        <span
            className="text-amber-100"
            aria-label={t('board.successesLabel', { successes })}
        >
            <span className="sr-only">{t('board.successes')}</span>
            <span className="font-bold">{t('board.vaultTrack', { successes })}</span>
        </span>
    );
}

function RoundChipColumn({
    round,
    chipValues,
    ownerByChip,
    selectedChip,
    onTakeChip,
    active,
}: {
    round: number;
    chipValues: number[];
    ownerByChip: Record<number, string | undefined>;
    selectedChip?: number;
    onTakeChip: (chip: number) => void;
    active: boolean;
}) {
    if (!active) {
        return null;
    }

    return (
        <>
            {chipValues.map((chip) => (
                <ChipButton
                    key={`${round}-${chip}`}
                    round={round}
                    value={chip}
                    owner={ownerByChip[chip]}
                    selected={selectedChip === chip}
                    onClick={() => onTakeChip(chip)}
                />
            ))}
        </>
    );
}

function VaultsAlarmsZone({ successes, failures }: { successes: number; failures: number }) {
    const { t } = useTranslation('game-the-gang');
    const label = t('board.vaultsAlarmsLabel', { successes, failures });

    return (
        <section
            className="sr-only"
            data-bgg-zone="vaults-alarms-zone"
            aria-label={label}
        >
            {label}
        </section>
    );
}

function ShowdownResultPanel({
    lastShowdown,
    localPlayerId,
    isMultiplayer,
    onSelectHotseatPlayer,
    playerName,
    onNextHeist,
    nextHeistProgress,
    playerIds,
}: {
    lastShowdown: NonNullable<TheGangCore['lastShowdown']>;
    localPlayerId: string;
    isMultiplayer?: boolean;
    onSelectHotseatPlayer: (playerId: string) => void;
    playerName: (id: string) => string;
    onNextHeist: () => void;
    nextHeistProgress: ProgressButtonState;
    playerIds: string[];
}) {
    const success = lastShowdown.outcome === 'success';
    const { t } = useTranslation('game-the-gang');

    return (
        <section
            className="pointer-events-auto fixed inset-0 z-[80] flex min-h-dvh items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_44%,rgba(17,24,39,0.92),rgba(5,9,8,0.86)_50%,rgba(5,9,8,0.78)_100%)] px-4 py-6 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)] backdrop-blur-md md:px-6 md:py-8"
            data-bgg-zone="reveal-zone"
            aria-label={t('board.showdownSettlement')}
        >
            <div
                className="relative flex w-full max-w-[82rem] flex-col items-center justify-center gap-5 rounded-[2rem] border border-amber-100/18 bg-emerald-950/42 px-3 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] md:px-6 md:py-7"
                data-bgg-zone="reveal-action"
                data-tutorial-id="the-gang-showdown-result"
            >
                <div className="flex items-center justify-center gap-3" data-bgg-zone="reveal-more-holder">
                    <span className={['text-5xl font-black leading-none md:text-7xl', success ? 'text-amber-300' : 'text-rose-400'].join(' ')}>
                        {success ? '✓' : '!'}
                    </span>
                    <h2 className="whitespace-nowrap text-3xl font-black tracking-tight md:text-5xl" data-bgg-zone="reveal-currentrank">
                        {success ? t('board.heistSuccess') : t('board.heistFailure')}
                    </h2>
                </div>

                <div
                    className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                    data-bgg-zone="reveal-players"
                    data-tutorial-id="the-gang-showdown-best-cards"
                >
                    {lastShowdown.results.map((result) => (
                        <div
                            key={result.playerId}
                            className="flex min-w-0 flex-col gap-3 rounded-2xl bg-emerald-950/62 px-3 py-3 shadow-[0_14px_34px_rgba(0,0,0,0.32)] ring-1 ring-amber-100/14 md:px-4 md:py-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-black text-stone-100 md:text-base">{playerName(result.playerId)}</span>
                                <div className="flex items-center gap-2">
                                    <ChipDisc round={4} value={result.chip} size="md" zone="plreveal-token" />
                                    <span className="text-xs font-black tracking-[0.08em] text-amber-100 md:text-sm">{result.strength.label}</span>
                                </div>
                            </div>
                            <div
                                className="flex justify-center gap-2 md:gap-3"
                                data-bgg-zone="reveal-best-cards"
                                aria-label={`${playerName(result.playerId)} ${result.strength.label}`}
                            >
                                {result.bestCards.map((card, index) => (
                                    <CardFace
                                        key={`${result.playerId}-${card.rank}-${card.suit}-${index}`}
                                        card={card}
                                        emphasis="showdown"
                                        t={t}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="sr-only" data-bgg-zone="safe-zone">
                    {t('board.safeSettlement')}
                </div>

                {!isMultiplayer && (
                    <div
                        className="flex flex-wrap justify-center gap-2"
                        data-testid="the-gang-showdown-hotseat-switcher"
                    >
                        {lastShowdown.results.map((result) => {
                            const selected = result.playerId === localPlayerId;
                            const approved = nextHeistProgress.approvals.includes(result.playerId);
                            return (
                                <button
                                    key={result.playerId}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => onSelectHotseatPlayer(result.playerId)}
                                    className={[
                                        'rounded-full border px-3 py-1 text-xs font-black tracking-[0.08em] transition',
                                        selected
                                            ? 'border-amber-200 bg-amber-200 text-emerald-950'
                                            : 'border-emerald-100/30 bg-emerald-950/62 text-emerald-50 hover:border-amber-200/70',
                                    ].join(' ')}
                                >
                                    {playerName(result.playerId)}
                                    {approved ? ` · ${t('board.progressWaiting')}` : ''}
                                </button>
                            );
                        })}
                    </div>
                )}

                <button
                    type="button"
                    onClick={onNextHeist}
                    disabled={nextHeistProgress.hasApproved}
                    className="rounded-full border border-emerald-100/60 bg-emerald-300 px-6 py-3 text-base font-black tracking-[0.08em] text-emerald-950 shadow-[0_12px_28px_rgba(16,185,129,0.32)] transition hover:-translate-y-0.5 hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 disabled:cursor-not-allowed disabled:border-stone-600/70 disabled:bg-stone-700/75 disabled:text-stone-400 disabled:shadow-none disabled:hover:translate-y-0 md:px-8 md:text-lg"
                >
                    {nextHeistProgress.label}
                </button>
                <ProgressVoteDots
                    approvals={nextHeistProgress.approvals}
                    label={nextHeistProgress.status}
                    playerIds={playerIds}
                />
            </div>
        </section>
    );
}

function PlayerChipStrip({
    roundHistory,
    currentRound,
    currentChip,
    playerId,
}: {
    roundHistory: TheGangCore['roundHistory'];
    currentRound: number;
    currentChip?: number;
    playerId: string;
}) {
    return (
        <div className="flex min-h-8 items-center justify-center gap-1.5 lg:min-h-12 lg:gap-2" data-bgg-zone="player-tokens">
            {roundHistory.map((entry) => {
                const chip = entry.chipsByPlayer[playerId];
                if (chip === undefined) return null;
                return (
                    <ChipDisc
                        key={`${entry.round}-${chip}`}
                        round={entry.round}
                        value={chip}
                        size="sm"
                        className="transition hover:scale-150"
                        zone="player-token"
                    />
                );
            })}
            {currentChip !== undefined && (
                <ChipDisc
                    round={currentRound}
                    value={currentChip}
                    size="lg"
                    className="scale-110 drop-shadow-[0_0_22px_rgba(252,211,77,0.82)]"
                    zone="player-current-token"
                />
            )}
        </div>
    );
}

function HandChipStrip({
    roundHistory,
    currentRound,
    currentChip,
    playerId,
}: {
    roundHistory: TheGangCore['roundHistory'];
    currentRound: number;
    currentChip?: number;
    playerId: string;
}) {
    return (
        <div className="flex min-h-8 items-center justify-center gap-1.5 lg:min-h-11 lg:gap-2" data-bgg-zone="hand-chips">
            {roundHistory.map((entry) => {
                const chip = entry.chipsByPlayer[playerId];
                if (chip === undefined) return null;
                return (
                    <ChipDisc
                        key={`${entry.round}-${chip}`}
                        round={entry.round}
                        value={chip}
                        size="sm"
                        zone="hand-chips-previous"
                    />
                );
            })}
            {currentChip !== undefined && (
                <ChipDisc
                    round={currentRound}
                    value={currentChip}
                    size="lg"
                    className="drop-shadow-[0_0_18px_rgba(252,211,77,0.55)]"
                    zone="hand-current-chip"
                />
            )}
        </div>
    );
}

export default function TheGangBoard({ G, dispatch, playerID, matchData, isMultiplayer }: Props) {
    const core = G.core;
    const { t } = useTranslation('game-the-gang');
    useTutorialBridge(G.sys.tutorial, dispatch);

    const [hotseatPlayerId, setHotseatPlayerId] = useState(core.playerIds[0]);
    const resolvedHotseatPlayerId = core.playerIds.includes(hotseatPlayerId)
        ? hotseatPlayerId
        : core.playerIds[0];
    const localPlayerId = !isMultiplayer ? resolvedHotseatPlayerId : (playerID ?? core.playerIds[0]);
    const localPlayer = core.players[localPlayerId];
    const allPlayersHaveChip = core.playerIds.every((id) => core.currentRoundChips[id] !== undefined);
    const nextRoundProgress = getProgressButtonState(core, 'end-round', localPlayerId, t('board.nextRound'), t);
    const revealShowdownProgress = getProgressButtonState(core, 'reveal-showdown', localPlayerId, t('board.revealShowdown'), t);
    const nextHeistProgress = getProgressButtonState(core, 'start-next-heist', localPlayerId, t('board.nextHeist'), t);
    const chipValues = Array.from({ length: core.playerIds.length }, (_, index) => index + 1);
    const ownerByChip = Object.fromEntries(
        Object.entries(core.currentRoundChips).map(([owner, chip]) => [chip, owner]),
    ) as Record<number, string | undefined>;

    const playerName = (id: string) => {
        const seat = matchData?.find((player) => String(player.id) === id);
        return seat?.name ?? t('board.playerFallback', { player: Number(id) + 1 });
    };

    const dispatchForPlayer = <K extends string & keyof TheGangCommandMap>(
        type: K,
        payload: TheGangCommandMap[K],
        commandPlayerId = localPlayerId,
    ) => {
        if (isMultiplayer) {
            dispatch(type, payload);
            return;
        }

        dispatch(type, {
            ...(payload as Record<string, unknown>),
            __internalPlayerId: commandPlayerId,
        } as TheGangCommandMap[K]);
    };

    const takeChip = (chip: number) => {
        dispatchForPlayer(THE_GANG_COMMANDS.TAKE_CHIP, { chip });
    };

    const endRound = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.END_ROUND, {});
    };

    const revealShowdown = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.REVEAL_SHOWDOWN, {});
    };

    const startNextHeist = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.START_NEXT_HEIST, {});
    };

    return (
        <UndoProvider value={{ G, dispatch, playerID, isGameOver: !!G.sys.gameover, isLocalMode: !isMultiplayer }}>
        <main
            className="the-gang-desktop-table h-full min-h-0 overflow-hidden bg-[#203b23] text-stone-50"
            data-game-ui="the-gang"
        >
            <section
                className="relative flex h-full min-h-0 w-full flex-col gap-1 overflow-hidden bg-[#203b23] px-4 py-3 lg:gap-2 lg:px-8 lg:py-5 xl:gap-3 xl:px-12 xl:py-7"
                data-layout-contract="bgg-electronic"
                data-layout-source={BGG_LAYOUT_CONTRACT.source}
                data-bgg-top-zone={BGG_LAYOUT_CONTRACT.topZone}
                data-bgg-middle-zone={BGG_LAYOUT_CONTRACT.middleZone}
                data-bgg-bottom-zone={BGG_LAYOUT_CONTRACT.bottomZone}
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(245,214,132,0.16),transparent_36%),radial-gradient(circle_at_50%_112%,rgba(5,8,5,0.55),transparent_42%),linear-gradient(90deg,rgba(245,214,132,0.06),transparent_18%,transparent_82%,rgba(245,214,132,0.06)),repeating-linear-gradient(135deg,rgba(255,255,255,0.028)_0,rgba(255,255,255,0.028)_1px,transparent_1px,transparent_20px)] opacity-80" />

                <header className="relative z-10 flex shrink-0 items-center justify-end gap-2 lg:gap-3">
                    <div className="sr-only" data-tutorial-id="the-gang-title">
                        <p>{t('title.secondary')}</p>
                        <h1>{t('title.primary')}</h1>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3 text-[0.7rem] font-black tracking-[0.08em] lg:gap-4 lg:text-sm xl:text-base" data-tutorial-id="the-gang-score-track">
                        <span className="text-amber-100">{t('board.heistNumber', { heist: core.heistNumber })}</span>
                        <SuccessTrack successes={core.successes} />
                        <AlarmTrack failures={core.failures} />
                    </div>
                </header>

                <section className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 lg:gap-2 xl:gap-3" data-testid="the-gang-bgg-board">
                    <section
                        className="flex shrink-0 justify-evenly gap-3 lg:gap-6"
                        data-bgg-zone="top-zone"
                        data-tutorial-id="the-gang-player-list"
                    >
                        {core.playerIds.map((id) => {
                            const player = core.players[id];
                            const isSelf = id === localPlayerId;
                            const visible = core.phase !== 'chip-selection' || isSelf;
                            return (
                                <div
                                    key={id}
                                    className="flex min-w-0 basis-[12rem] flex-col items-center gap-1 lg:basis-[26rem] lg:gap-2"
                                    data-bgg-zone="plboard"
                                >
                                    <span
                                        className={['truncate text-xs font-black tracking-[0.08em] lg:text-sm', isSelf ? 'text-amber-200' : 'text-stone-100/72'].join(' ')}
                                    >
                                        {playerName(id)}
                                    </span>
                                    <PlayerChipStrip
                                        roundHistory={core.roundHistory}
                                        currentRound={core.round}
                                        currentChip={core.currentRoundChips[id]}
                                        playerId={id}
                                    />
                                    <div className="flex justify-center gap-1 lg:gap-1.5">
                                        {visible && player.pocketCards.map((card, index) => (
                                            <CardFace key={index} card={card} t={t} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    <section
                        className="flex min-h-0 flex-[0.82] items-center justify-center overflow-hidden"
                        data-tutorial-id="the-gang-round-panel"
                        data-bgg-zone="middle-zone"
                    >
                        <div className="flex min-h-0 flex-col items-center gap-3 lg:gap-6" data-bgg-zone="middle-center">
                            <div
                                className="flex w-full max-w-[29rem] flex-wrap items-center justify-center gap-3 lg:max-w-[44rem] lg:gap-5"
                                data-tutorial-id="the-gang-chip-row"
                                data-bgg-zone="token-pile"
                            >
                                <LayoutContractBadge />
                                {[1, 2, 3, 4].map((round) => (
                                    <RoundChipColumn
                                        key={round}
                                        round={round}
                                        chipValues={chipValues}
                                        ownerByChip={ownerByChip}
                                        selectedChip={core.currentRoundChips[localPlayerId]}
                                        onTakeChip={takeChip}
                                        active={core.phase === 'chip-selection' && core.round === round}
                                    />
                                ))}
                            </div>

                            <div className="flex w-full max-w-[48rem] flex-nowrap justify-center gap-3 lg:max-w-[72rem] lg:gap-5 xl:max-w-[80rem]" data-bgg-zone="card-river" aria-label={t('board.communityCardsSlot')}>
                                {core.communityCards.map((card, index) => (
                                    <CardFace key={index} card={card} emphasis="river" t={t} />
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="relative z-10 flex shrink-0 items-end justify-center pb-1 lg:pb-2" data-bgg-zone="bottom-zone">
                        <VaultsAlarmsZone successes={core.successes} failures={core.failures} />
                        <HandRankReference />

                        <div className="flex flex-col items-center gap-1.5 lg:gap-2" data-bgg-zone="hand-groupzone" data-tutorial-id="the-gang-hand">
                            <span className="sr-only">{t('board.myHand')}</span>
                            <div className="min-h-4 text-[0.7rem] font-black tracking-[0.08em] text-amber-100 lg:min-h-5 lg:text-sm">
                                {localPlayer?.bestHand?.label ?? ''}
                            </div>
                            <HandChipStrip
                                roundHistory={core.roundHistory}
                                currentRound={core.round}
                                currentChip={core.currentRoundChips[localPlayerId]}
                                playerId={localPlayerId}
                            />
                            <div className="flex items-center justify-center gap-3 lg:gap-5 xl:gap-7" data-bgg-zone="hand-cards">
                                {(localPlayer?.pocketCards ?? []).map((card, index) => (
                                    <CardFace key={`${card.rank}-${card.suit}-${index}`} card={card} emphasis="hand" t={t} />
                                ))}
                            </div>
                        </div>

                        <div className="absolute bottom-1 right-1 flex min-w-[5rem] flex-col items-end gap-1 lg:bottom-2 lg:right-2">
                            {core.phase === 'chip-selection' && core.round < 4 && (
                                <button
                                    type="button"
                                    disabled={!allPlayersHaveChip || nextRoundProgress.hasApproved}
                                    onClick={endRound}
                                    data-tutorial-id="the-gang-next-round"
                                    className="min-w-[5.75rem] rounded-full border border-amber-200/75 bg-amber-300 px-5 py-2.5 text-base font-black tracking-[0.08em] text-stone-950 shadow-[0_12px_28px_rgba(245,158,11,0.36)] transition hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 disabled:cursor-not-allowed disabled:border-stone-600/70 disabled:bg-stone-700/75 disabled:text-stone-400 disabled:shadow-none disabled:hover:translate-y-0 lg:min-w-[7rem] lg:px-7 lg:py-3.5 lg:text-lg"
                                >
                                    {nextRoundProgress.label}
                                </button>
                            )}
                            {core.phase === 'chip-selection' && core.round === 4 && (
                                <button
                                    type="button"
                                    disabled={!allPlayersHaveChip || revealShowdownProgress.hasApproved}
                                    onClick={revealShowdown}
                                    data-tutorial-id="the-gang-reveal-showdown"
                                    className="min-w-[5.75rem] rounded-full border border-rose-200/80 bg-rose-400 px-5 py-2.5 text-base font-black tracking-[0.08em] text-stone-950 shadow-[0_12px_30px_rgba(244,63,94,0.38)] transition hover:-translate-y-0.5 hover:bg-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-100 disabled:cursor-not-allowed disabled:border-stone-600/70 disabled:bg-stone-700/75 disabled:text-stone-400 disabled:shadow-none disabled:hover:translate-y-0 lg:min-w-[7rem] lg:px-7 lg:py-3.5 lg:text-lg"
                                >
                                    {revealShowdownProgress.label}
                                </button>
                            )}
                            {allPlayersHaveChip && core.phase === 'chip-selection' && (
                                <ProgressVoteDots
                                    approvals={core.round < 4 ? nextRoundProgress.approvals : revealShowdownProgress.approvals}
                                    label={core.round < 4 ? nextRoundProgress.status : revealShowdownProgress.status}
                                    playerIds={core.playerIds}
                                />
                            )}
                        </div>

                    </section>

                    <div data-tutorial-id="the-gang-showdown-area">
                        {core.lastShowdown && (
                            <ShowdownResultPanel
                                lastShowdown={core.lastShowdown}
                                localPlayerId={localPlayerId}
                                isMultiplayer={isMultiplayer}
                                onSelectHotseatPlayer={setHotseatPlayerId}
                                playerName={playerName}
                                onNextHeist={startNextHeist}
                                nextHeistProgress={nextHeistProgress}
                                playerIds={core.playerIds}
                            />
                        )}
                    </div>

                    <aside className="pointer-events-none absolute left-2 top-2 z-30 flex max-w-[min(28rem,calc(100%-1rem))] flex-wrap items-start justify-start gap-1.5 lg:left-3 lg:top-3 lg:gap-2" data-bgg-zone="helper-zone">
                        {!isMultiplayer && (
                            <div className="pointer-events-auto" data-testid="the-gang-hotseat-switcher">
                                <h2 className="sr-only">{t('board.localSeat')}</h2>
                                <div className="flex flex-wrap gap-1.5 rounded-full border border-amber-100/16 bg-emerald-950/48 px-2 py-1 shadow-[0_0.3rem_1rem_rgba(0,0,0,0.22)] backdrop-blur-sm lg:gap-2 lg:px-3">
                                    {core.playerIds.map((id) => {
                                        const selected = id === localPlayerId;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => setHotseatPlayerId(id)}
                                                className={[
                                                    'rounded-full px-2.5 py-1 text-[0.68rem] font-black tracking-[0.05em] transition lg:px-3 lg:text-xs',
                                                    selected
                                                        ? 'bg-amber-200 text-emerald-950 shadow-[0_0_0.7rem_rgba(251,191,36,0.35)]'
                                                        : 'text-stone-100/70 hover:bg-white/10 hover:text-stone-100',
                                                ].join(' ')}
                                            >
                                                {playerName(id)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </aside>
                </section>
            </section>
        </main>
        </UndoProvider>
    );
}
