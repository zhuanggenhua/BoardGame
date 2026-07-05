import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorialBridge } from '../../contexts/TutorialContext';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { formatCard } from './domain/cards';
import {
    THE_GANG_COMMANDS,
    type PlayingCard,
    type TheGangCommandMap,
    type TheGangCore,
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

type TFunction = ReturnType<typeof useTranslation>['t'];

function CardFace({
    card,
    hidden = false,
    emphasis = 'table',
    t,
}: {
    card?: PlayingCard;
    hidden?: boolean;
    emphasis?: 'table' | 'hand';
    t: TFunction;
}) {
    const sizeClass = emphasis === 'hand'
        ? 'h-20 w-14 md:h-24 md:w-16 lg:h-32 lg:w-[5.5rem] xl:h-40 xl:w-28'
        : 'h-10 w-7 md:h-12 md:w-8 lg:h-20 lg:w-14';

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
    playerName,
    onNextHeist,
}: {
    lastShowdown: NonNullable<TheGangCore['lastShowdown']>;
    playerName: (id: string) => string;
    onNextHeist: () => void;
}) {
    const success = lastShowdown.outcome === 'success';
    const { t } = useTranslation('game-the-gang');

    return (
        <section
            className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_50%_44%,rgba(17,24,39,0.78),rgba(5,9,8,0.42)_48%,rgba(5,9,8,0.22)_72%,rgba(5,9,8,0.08))] px-6 py-8 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]"
            data-bgg-zone="reveal-zone"
            aria-label={t('board.showdownSettlement')}
        >
            <div
                className="relative flex flex-col items-center justify-center gap-5 px-8 py-7"
                data-bgg-zone="reveal-action"
            >
                <div className="flex items-center justify-center gap-3" data-bgg-zone="reveal-more-holder">
                    <span className={['text-5xl font-black leading-none md:text-7xl', success ? 'text-amber-300' : 'text-rose-400'].join(' ')}>
                        {success ? '✓' : '!'}
                    </span>
                    <h2 className="whitespace-nowrap text-3xl font-black tracking-tight md:text-5xl" data-bgg-zone="reveal-currentrank">
                        {success ? t('board.heistSuccess') : t('board.heistFailure')}
                    </h2>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-bold md:text-base" data-bgg-zone="reveal-players">
                    {lastShowdown.results.map((result) => (
                        <div
                            key={result.playerId}
                            className="flex items-center gap-2"
                        >
                            <span className="text-stone-100">{playerName(result.playerId)}</span>
                            <ChipDisc round={4} value={result.chip} size="md" zone="plreveal-token" />
                            <span className="text-stone-100">{result.strength.label}</span>
                        </div>
                    ))}
                </div>

                <div className="sr-only" data-bgg-zone="safe-zone">
                    {t('board.safeSettlement')}
                </div>

                <button
                    type="button"
                    onClick={onNextHeist}
                    className="text-sm font-black text-emerald-100/85 underline decoration-amber-300/45 underline-offset-4 transition hover:text-emerald-100 md:text-base"
                >
                    {t('board.nextHeist')}
                </button>
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
            <style>
                {`
                    body:has(.the-gang-desktop-table) [data-testid="fab-menu"] {
                        opacity: 0;
                        pointer-events: none;
                    }
                `}
            </style>
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

                            <div className="flex w-full max-w-[34rem] flex-nowrap justify-center gap-2 lg:max-w-[52rem] lg:gap-4" data-bgg-zone="card-river" aria-label={t('board.communityCardsSlot')}>
                                {core.communityCards.map((card, index) => (
                                    <CardFace key={index} card={card} t={t} />
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="relative z-10 flex shrink-0 items-end justify-center pb-1 lg:pb-2" data-bgg-zone="bottom-zone">
                        <VaultsAlarmsZone successes={core.successes} failures={core.failures} />

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

                        <div className="absolute bottom-1 right-1 flex min-w-[5rem] justify-end lg:bottom-2 lg:right-2">
                            {core.phase === 'chip-selection' && core.round < 4 && (
                                <button
                                    type="button"
                                    disabled={!allPlayersHaveChip}
                                    onClick={endRound}
                                    data-tutorial-id="the-gang-next-round"
                                    className="text-xs font-black tracking-[0.08em] text-amber-100/82 underline decoration-amber-300/45 underline-offset-4 transition hover:text-amber-100 disabled:cursor-not-allowed disabled:text-stone-500 disabled:no-underline lg:text-sm"
                                >
                                    {t('board.nextRound')}
                                </button>
                            )}
                            {core.phase === 'chip-selection' && core.round === 4 && (
                                <button
                                    type="button"
                                    disabled={!allPlayersHaveChip}
                                    onClick={revealShowdown}
                                    data-tutorial-id="the-gang-reveal-showdown"
                                    className="text-xs font-black tracking-[0.08em] text-rose-100/82 underline decoration-rose-300/45 underline-offset-4 transition hover:text-rose-100 disabled:cursor-not-allowed disabled:text-stone-500 disabled:no-underline lg:text-sm"
                                >
                                    {t('board.revealShowdown')}
                                </button>
                            )}
                        </div>

                    </section>

                    <div data-tutorial-id="the-gang-showdown-area">
                        {core.lastShowdown && (
                            <ShowdownResultPanel
                                lastShowdown={core.lastShowdown}
                                playerName={playerName}
                                onNextHeist={startNextHeist}
                            />
                        )}
                    </div>

                    <aside className="pointer-events-none absolute bottom-2 right-2 z-20 hidden max-w-[32rem] flex-wrap items-end justify-end gap-2 opacity-0 xl:flex" data-bgg-zone="helper-zone">
                        {!isMultiplayer && (
                            <div className="pointer-events-auto" data-testid="the-gang-hotseat-switcher">
                                <h2 className="sr-only">{t('board.localSeat')}</h2>
                                <div className="flex flex-wrap gap-2">
                                    {core.playerIds.map((id) => {
                                        const selected = id === localPlayerId;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => setHotseatPlayerId(id)}
                                                className={[
                                                    'px-2 py-1 text-[0.68rem] font-black transition',
                                                    selected ? 'text-amber-200' : 'text-stone-100/60 hover:text-stone-100',
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
