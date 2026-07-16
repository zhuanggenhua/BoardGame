import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered, SlidersHorizontal, Wrench, X } from 'lucide-react';
import type { GameBoardProps, MatchPlayerInfo } from '../../engine/transport/protocol';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorialBridge } from '../../contexts/TutorialContext';
import { useToast } from '../../contexts/ToastContext';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { EndgameOverlay, type ContentSlotProps } from '../../components/game/framework/widgets/EndgameOverlay';
import { buildPlayerDisplayNameMap } from '../../components/game/framework/playerDisplay';
import { HudPortal } from '../../core';
import { useEndgame } from '../../hooks/game/useEndgame';
import { useGameAudio } from '../../lib/audio/useGameAudio';
import { THE_GANG_AUDIO_CONFIG } from './audio.config';
import { formatCard } from './domain/cards';
import {
    THE_GANG_EXPANDED_HAND_RANK_RULES,
    TEXAS_HOLDEM_HAND_RANK_RULES,
    type PokerHandRankRule,
} from './domain/poker';
import {
    THE_GANG_CHALLENGES,
    THE_GANG_EXIT_CHIP_MODES,
    THE_GANG_GAME_MODES,
    THE_GANG_SPECIALISTS,
    THE_GANG_TOOLS,
    getActiveChallengeLabels,
    isChallengeActive,
    normalizeRulesConfig,
} from './domain/expansions';
import { getChipValues } from './domain/setup';
import {
    THE_GANG_COMMANDS,
    type PlayingCard,
    type TheGangChallengeId,
    type TheGangCommandMap,
    type TheGangCore,
    type TheGangExitChipMode,
    type TheGangGameMode,
    type TheGangProgressKind,
    type TheGangRulesConfig,
    type TheGangSpecialistId,
    type TheGangToolId,
} from './domain/types';
import { THE_GANG_MANIFEST } from './manifest';

type Props = GameBoardProps<TheGangCore, TheGangCommandMap>;

const resolveCanConfigureRules = (
    matchData: MatchPlayerInfo[] | undefined,
    playerID: string | null | undefined,
    fallbackOwnerPlayerId: string,
) => {
    const localPlayerId = playerID ?? fallbackOwnerPlayerId;
    const ownerSeat = matchData?.find((player) => player.isOwner === true);
    if (!ownerSeat) return localPlayerId === fallbackOwnerPlayerId;
    return String(ownerSeat.id) === localPlayerId;
};

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

const COMMUNITY_CARD_FRAME_CLASSES = [
    'border-yellow-300 bg-yellow-300/18 ring-yellow-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(253,224,71,0.9)]',
    'border-yellow-300 bg-yellow-300/18 ring-yellow-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(253,224,71,0.9)]',
    'border-yellow-300 bg-yellow-300/18 ring-yellow-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(253,224,71,0.9)]',
    'border-orange-400 bg-orange-400/18 ring-orange-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(251,146,60,0.92)]',
    'border-red-500 bg-red-500/18 ring-red-950/80 shadow-[0_0_0_0.12rem_rgba(0,0,0,0.78),0_0_1.35rem_rgba(239,68,68,0.94)]',
] as const;

const getChallengeAssetPath = (challengeId: TheGangChallengeId) =>
    `the-gang/rule-assets/challenges/${challengeId}`;

const getToolAssetPath = (tool: TheGangToolId) =>
    `the-gang/rule-assets/tools/${tool}`;

const getSpecialistAssetPath = (specialist: TheGangSpecialistId) =>
    `the-gang/rule-assets/specialists/${specialist}`;

const RULE_SURFACE_ASSETS = {
    challengeZone: 'the-gang/rule-assets/surfaces/challenge-zone',
    toolsZone: 'the-gang/rule-assets/surfaces/tools-zone',
    toolsDiscardZone: 'the-gang/rule-assets/surfaces/tools-discard-zone',
    specialistsZone: 'the-gang/rule-assets/surfaces/specialists-zone',
    specialistsDiscardZone: 'the-gang/rule-assets/surfaces/specialists-discard-zone',
} as const;

const TTS_SETUP_TOGGLE_KEYS = ['omaha', 'twoHand', 'automode', 'antiTroll'] as const;
type TtsSetupToggleKey = typeof TTS_SETUP_TOGGLE_KEYS[number];
const TABLE_REMINDER_CHALLENGES = ['retina-scan', 'fingerprint-scan', 'blackout'] as const;

const CARD_RANK_ASSET_NAMES: Partial<Record<PlayingCard['rank'], string>> = {
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

const hasStandardCardAsset = (card: PlayingCard) =>
    card.suit !== 'gear'
    && card.suit !== 'special'
    && CARD_RANK_ASSET_NAMES[card.rank] !== undefined;

const BGG_LAYOUT_CONTRACT = {
    source: 'BGG electronic DOM/CSS',
    topZone: 'top_zone / plboard',
    middleZone: 'middle_zone / token_pile / card_river',
    bottomZone: 'bottom_zone / vaults_alarms_zone / hand_groupzone',
};

const DEFAULT_HAND_RANK_RULES = TEXAS_HOLDEM_HAND_RANK_RULES;

const UTILITY_BUTTON_CLASS = [
    'flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-amber-200/35',
    'bg-emerald-950/90 px-2.5 text-xs font-black text-amber-100 shadow-[0_0.25rem_0.9rem_rgba(0,0,0,0.34)] backdrop-blur-sm',
    'transition-[transform,background-color,border-color,color] hover:-translate-y-0.5 hover:border-amber-100/65 hover:bg-emerald-900 hover:text-amber-50',
    'active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100',
    'min-[901px]:h-12 min-[901px]:min-w-[5.75rem] min-[901px]:gap-2 min-[901px]:px-4 min-[901px]:text-sm',
].join(' ');

const UTILITY_ICON_CLASS = 'h-4 w-4 shrink-0 min-[901px]:h-5 min-[901px]:w-5';

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
    revealOrder,
    t,
}: {
    card?: PlayingCard;
    hidden?: boolean;
    emphasis?: CardFaceEmphasis;
    revealOrder?: number;
    t: TFunction;
}) {
    const sizeClassByEmphasis: Record<CardFaceEmphasis, string> = {
        table: 'h-14 w-10 md:h-16 md:w-11 lg:h-24 lg:w-[4.25rem] xl:h-28 xl:w-20',
        river: 'h-20 w-14 md:h-24 md:w-16 lg:h-32 lg:w-[5.5rem] xl:h-40 xl:w-28',
        hand: 'h-20 w-14 md:h-24 md:w-16 lg:h-32 lg:w-[5.5rem] xl:h-40 xl:w-28',
        showdown: 'h-16 w-11 md:h-20 md:w-14 lg:h-24 lg:w-[4.25rem] xl:h-28 xl:w-20',
    };
    const sizeClass = sizeClassByEmphasis[emphasis];

    const revealDelayMs = revealOrder === undefined ? undefined : `${Math.min(revealOrder, 32) * 90}ms`;
    const revealClass = revealOrder === undefined
        ? ''
        : ' motion-safe:animate-[the-gang-card-reveal_520ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none';
    const revealStyle = revealDelayMs === undefined ? undefined : { animationDelay: revealDelayMs };
    const revealProps = revealOrder === undefined
        ? {}
        : {
            'data-bgg-zone': 'reveal-card',
            'data-reveal-order': String(revealOrder),
            style: revealStyle,
        };

    if (hidden || !card) {
        return (
            <div
                className={`${sizeClass} overflow-hidden rounded-md bg-slate-800 shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/70${revealClass}`}
                {...revealProps}
            >
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

    if (
        card.kind === 'joker'
        || card.kind === 'wild'
        || card.kind === 'blank'
        || card.suit === 'special'
        || !hasStandardCardAsset(card)
    ) {
        const label = formatCard(card);
        return (
            <div
                className={`${sizeClass} flex items-center justify-center overflow-hidden rounded-md border border-amber-200/45 bg-[radial-gradient(circle_at_50%_24%,rgba(251,191,36,0.34),transparent_42%),linear-gradient(160deg,#111827,#312e18)] px-1 text-center text-[0.62rem] font-black tracking-[0.08em] text-amber-100 shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/75 lg:text-xs${revealClass}`}
                aria-label={label}
                {...revealProps}
            >
                {label}
            </div>
        );
    }

    return (
        <div
            className={`${sizeClass} overflow-hidden rounded-md bg-white shadow-[0.2rem_0.24rem_0_rgba(0,0,0,0.45)] ring-1 ring-black/75${revealClass}`}
            {...revealProps}
        >
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

function HandCardRows({
    primaryCards,
    secondaryCards = [],
    emphasis = 'table',
    t,
    testIdPrefix,
    revealOrderBase,
    winningHandSlot,
    showLabels = false,
}: {
    primaryCards: PlayingCard[];
    secondaryCards?: PlayingCard[];
    emphasis?: CardFaceEmphasis;
    t: TFunction;
    testIdPrefix: string;
    revealOrderBase?: number;
    winningHandSlot?: 'top' | 'bottom';
    showLabels?: boolean;
}) {
    const rows = [
        { slot: 'top' as const, cards: primaryCards, label: t('board.topHand') },
        ...(secondaryCards.length > 0
            ? [{ slot: 'bottom' as const, cards: secondaryCards, label: t('board.bottomHand') }]
            : []),
    ];
    let revealOffset = 0;

    return (
        <div className="flex flex-col items-center justify-center gap-1.5 lg:gap-2" data-testid={`${testIdPrefix}-rows`}>
            {rows.map((row) => {
                const startOffset = revealOffset;
                revealOffset += row.cards.length;
                const isWinning = winningHandSlot === row.slot;
                return (
                    <div
                        key={row.slot}
                        className="flex items-center justify-center gap-2 overflow-visible lg:gap-3 xl:gap-4"
                        data-testid={`${testIdPrefix}-${row.slot}`}
                        data-hand-slot={row.slot}
                        data-winning-hand={isWinning ? 'true' : undefined}
                    >
                        {showLabels ? (
                            <span className={[
                                'min-w-10 rounded-full border px-2 py-0.5 text-center text-[0.58rem] font-black tracking-[0.1em]',
                                isWinning
                                    ? 'border-amber-200 bg-amber-300 text-emerald-950'
                                    : 'border-amber-200/24 bg-black/20 text-amber-100/78',
                            ].join(' ')}
                            >
                                {row.label}
                            </span>
                        ) : (
                            <span className="sr-only">{row.label}</span>
                        )}
                        <div className="flex items-center justify-center gap-2 overflow-visible md:gap-3">
                            {row.cards.map((card, index) => (
                                <CardFace
                                    key={`${row.slot}-${card.rank}-${card.suit}-${index}`}
                                    card={card}
                                    emphasis={emphasis}
                                    revealOrder={revealOrderBase === undefined ? undefined : revealOrderBase + startOffset + index}
                                    t={t}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
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

function TableReminderBadges({ config }: { config: TheGangRulesConfig }) {
    const reminders = TABLE_REMINDER_CHALLENGES.filter((challengeId) => isChallengeActive(config, challengeId));
    if (reminders.length === 0) return null;

    return (
        <div className="flex flex-wrap justify-end gap-1.5" data-testid="the-gang-table-reminders" data-bgg-zone="table-reminders">
            {reminders.map((challengeId) => (
                <span
                    key={challengeId}
                    className="rounded-full border border-amber-200/28 bg-black/24 px-2 py-0.5 text-[0.62rem] font-black tracking-[0.08em] text-amber-100/88"
                    title={THE_GANG_CHALLENGES[challengeId].summary}
                >
                    {THE_GANG_CHALLENGES[challengeId].label}
                </span>
            ))}
        </div>
    );
}

function HandRankReference({ rules = DEFAULT_HAND_RANK_RULES }: { rules?: readonly PokerHandRankRule[] }) {
    const { t } = useTranslation('game-the-gang');
    const orderedRules = [...rules].sort((left, right) => left.category - right.category);

    return (
        <details
            className="pointer-events-auto group relative z-30 text-xs font-black text-amber-50/94 lg:text-sm"
            data-tutorial-id="the-gang-hand-rank-reference"
            data-bgg-zone="hand-rank-reference"
        >
            <summary className={`${UTILITY_BUTTON_CLASS} list-none marker:hidden group-open:border-amber-100 group-open:bg-amber-200 group-open:text-emerald-950 [&::-webkit-details-marker]:hidden`} aria-label={t('board.handRankReferenceAria')}>
                <ListOrdered aria-hidden="true" className={UTILITY_ICON_CLASS} strokeWidth={2.25} />
                <span className="hidden sm:inline">{t('board.handRankReference')}</span>
            </summary>
            <div className="absolute bottom-full left-0 mb-2 w-[20rem] max-w-[calc(100vw-1rem)] rounded-lg bg-emerald-950/94 p-2 shadow-[0_0.35rem_1.2rem_rgba(0,0,0,0.42)] ring-1 ring-amber-200/28">
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

function RulesConfigPanel({
    config,
    locked,
    canConfigure,
    playerCount,
    onChange,
    onBlockedEdit,
}: {
    config: TheGangRulesConfig;
    locked: boolean;
    canConfigure: boolean;
    playerCount: number;
    onChange: (config: TheGangRulesConfig) => void;
    onBlockedEdit: () => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const [isOpen, setIsOpen] = useState(false);
    const normalized = normalizeRulesConfig(config);
    const activeLabels = getActiveChallengeLabels(normalized);
    const challengeIds = Object.keys(THE_GANG_CHALLENGES)
        .filter((challengeId) => THE_GANG_CHALLENGES[challengeId as TheGangChallengeId].runtimeStatus === 'implemented') as TheGangChallengeId[];
    const rulesDialogHint = !canConfigure
        ? 'board.rulesDialogGuestHint'
        : locked ? 'board.rulesDialogLockedHostHint' : 'board.rulesDialogHostHint';

    const updateMode = (gameMode: TheGangGameMode) => {
        onChange(normalizeRulesConfig({ ...normalized, gameMode }));
    };

    const updateExitChipMode = (exitChipMode: TheGangExitChipMode) => {
        onChange(normalizeRulesConfig({ ...normalized, exitChipMode }));
    };

    const toggleSetupOption = (option: TtsSetupToggleKey) => {
        onChange(normalizeRulesConfig({ ...normalized, [option]: !normalized[option] }));
    };

    const toggleChallenge = (challengeId: TheGangChallengeId) => {
        const current = normalized.challenges[challengeId] ?? 0;
        onChange(normalizeRulesConfig({
            ...normalized,
            challenges: {
                ...normalized.challenges,
                [challengeId]: current > 0 ? 0 : 1,
            },
        }));
    };

    const canEdit = canConfigure && !locked;

    const tryEdit = (action: () => void) => {
        if (!canEdit) {
            onBlockedEdit();
            return;
        }
        action();
    };

    return (
        <div
            className="pointer-events-auto relative z-50 max-w-[22rem] text-xs font-black text-amber-50/94 lg:text-sm"
            data-bgg-zone="rules-config"
            data-testid="the-gang-rules-config"
        >
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={UTILITY_BUTTON_CLASS}
                aria-label={t('board.rulesConfig')}
                aria-haspopup="dialog"
            >
                <SlidersHorizontal aria-hidden="true" className={UTILITY_ICON_CLASS} strokeWidth={2.25} />
                <span className="hidden sm:inline">{t('board.rulesConfig')}</span>
            </button>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/62 px-2 py-2 backdrop-blur-sm min-[901px]:px-4 min-[901px]:py-5"
                    data-testid="the-gang-rules-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('board.rulesDialogTitle')}
                >
                    <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-amber-200/30 bg-[#102319] text-amber-50 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.62)] min-[901px]:max-h-[88vh] min-[901px]:rounded-2xl">
                        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-200/18 bg-[radial-gradient(circle_at_18%_0%,rgba(245,214,132,0.16),transparent_32%),linear-gradient(135deg,rgba(16,35,25,0.96),rgba(6,14,10,0.98))] px-3 py-2.5 min-[901px]:gap-4 min-[901px]:px-5 min-[901px]:py-4 lg:px-7">
                            <div className="min-w-0">
                                <div className="text-[0.68rem] uppercase tracking-[0.24em] text-amber-200/72">
                                    {t('board.rulesDialogEyebrow')}
                                </div>
                                <h2 className="mt-0.5 text-base font-black tracking-[0.12em] text-amber-100 min-[901px]:mt-1 min-[901px]:text-xl lg:text-2xl">
                                    {t('board.rulesDialogTitle')}
                                </h2>
                                <p className="mt-1 max-w-3xl text-[0.68rem] font-bold leading-snug text-amber-50/72 min-[901px]:mt-2 min-[901px]:text-xs min-[901px]:leading-relaxed lg:text-sm">
                                    {t(rulesDialogHint)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-black/24 text-lg text-amber-100 transition hover:bg-amber-200 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                                aria-label={t('board.closeRulesDialog')}
                            >
                                ×
                            </button>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 min-[901px]:px-5 min-[901px]:py-4 lg:px-7 lg:py-5">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-[0.68rem] font-black tracking-[0.08em] text-amber-100">
                                    {t('board.activeGameMode', { mode: THE_GANG_GAME_MODES[normalized.gameMode].label })}
                                </span>
                                <span className="inline-flex rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-[0.68rem] font-black tracking-[0.08em] text-amber-100">
                                    {t('board.activeExitChipMode', { mode: THE_GANG_EXIT_CHIP_MODES[normalized.exitChipMode].label })}
                                </span>
                            </div>
                            {locked && (
                                <div className="mb-4 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs font-bold leading-relaxed text-amber-100/88">
                                    {t('board.rulesLocked')}
                                </div>
                            )}
                            <section className="grid gap-3 lg:grid-cols-3" aria-label={t('board.gameMode')}>
                                {(Object.keys(THE_GANG_GAME_MODES) as TheGangGameMode[]).map((modeId) => {
                                    const mode = THE_GANG_GAME_MODES[modeId];
                                    const active = normalized.gameMode === modeId;
                                    return (
                                        <button
                                            key={modeId}
                                            type="button"
                                            aria-disabled={!canEdit}
                                            onClick={() => tryEdit(() => updateMode(modeId))}
                                            aria-pressed={active}
                                            className={[
                                                'relative min-h-[7rem] rounded-xl border p-4 text-left transition',
                                                canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                active
                                                    ? 'border-amber-200 bg-emerald-900/78 text-amber-50 shadow-[0_0_1.5rem_rgba(245,214,132,0.20)] ring-2 ring-amber-200/80'
                                                    : 'border-amber-200/22 bg-black/20 text-amber-50 hover:border-amber-200/55 hover:bg-emerald-900/55',
                                            ].join(' ')}
                                            data-state={active ? 'selected' : 'idle'}
                                            data-testid={`the-gang-mode-${modeId}`}
                                        >
                                            {active && (
                                                <span className="absolute right-3 top-3 rounded-full bg-emerald-950 px-2 py-0.5 text-[0.58rem] font-black tracking-[0.12em] text-amber-100">
                                                    {t('board.rulesSelected')}
                                                </span>
                                            )}
                                            <span className="block text-base font-black tracking-[0.08em]">{mode.label}</span>
                                            <span className="mt-2 block text-[0.68rem] font-bold leading-relaxed opacity-78 lg:text-xs">
                                                {t(`board.gameModeDescriptions.${modeId}`)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </section>

                            <section className="mt-5 rounded-xl border border-amber-200/18 bg-black/16 p-3 lg:p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-black tracking-[0.14em] text-amber-100 lg:text-base">
                                        {t('board.ttsSetupOptions')}
                                    </h3>
                                    <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[0.62rem] text-amber-100/76">
                                        {t('board.ttsSetupOptionsSource')}
                                    </span>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    {TTS_SETUP_TOGGLE_KEYS.map((option) => {
                                        const active = normalized[option];
                                        const disabledByRule = option === 'twoHand' && (
                                            normalized.gameMode !== 'texas-holdem'
                                            || playerCount > 5
                                        );
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                disabled={disabledByRule}
                                                aria-disabled={!canEdit || disabledByRule}
                                                onClick={() => tryEdit(() => toggleSetupOption(option))}
                                                aria-pressed={active}
                                                className={[
                                                    'relative min-h-[5.8rem] rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55',
                                                    canEdit && !disabledByRule ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                    active
                                                        ? 'border-amber-200 bg-emerald-900/78 text-amber-50 shadow-[0_0_1.2rem_rgba(245,214,132,0.18)] ring-2 ring-amber-200/70'
                                                        : 'border-amber-200/22 bg-black/20 text-amber-50 hover:border-amber-200/55 hover:bg-emerald-900/55',
                                                ].join(' ')}
                                                data-state={active ? 'selected' : 'idle'}
                                                data-testid={`the-gang-rule-toggle-${option}`}
                                            >
                                                <span className="block text-sm font-black tracking-[0.08em]">
                                                    {t(active ? 'board.ttsSetupOptionSelectedPrefix' : 'board.ttsSetupOptionIdlePrefix')}
                                                    {t(`board.ttsSetupOptionLabels.${option}`)}
                                                </span>
                                                <span className="mt-2 block text-[0.66rem] font-bold leading-relaxed opacity-78 lg:text-xs">
                                                    {t(`board.ttsSetupOptionDescriptions.${option}`)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="mt-5 rounded-xl border border-amber-200/18 bg-black/16 p-3 lg:p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-black tracking-[0.14em] text-amber-100 lg:text-base">
                                        {t('board.exitChipMode')}
                                    </h3>
                                    <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[0.62rem] text-amber-100/76">
                                        {t(`board.exitChipModeSummaries.${normalized.exitChipMode}`)}
                                    </span>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    {(Object.keys(THE_GANG_EXIT_CHIP_MODES) as TheGangExitChipMode[]).map((modeId) => {
                                        const mode = THE_GANG_EXIT_CHIP_MODES[modeId];
                                        const active = normalized.exitChipMode === modeId;
                                        return (
                                            <button
                                                key={modeId}
                                                type="button"
                                                aria-disabled={!canEdit}
                                                onClick={() => tryEdit(() => updateExitChipMode(modeId))}
                                                aria-pressed={active}
                                                className={[
                                                    'relative min-h-[5.8rem] rounded-xl border p-3 text-left transition',
                                                    canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                    active
                                                        ? 'border-amber-200 bg-emerald-900/78 text-amber-50 shadow-[0_0_1.2rem_rgba(245,214,132,0.18)] ring-2 ring-amber-200/70'
                                                        : 'border-amber-200/22 bg-black/20 text-amber-50 hover:border-amber-200/55 hover:bg-emerald-900/55',
                                                ].join(' ')}
                                                data-state={active ? 'selected' : 'idle'}
                                                data-testid={`the-gang-exit-mode-${modeId}`}
                                            >
                                                {active && (
                                                    <span className="absolute right-3 top-3 rounded-full bg-emerald-950 px-2 py-0.5 text-[0.58rem] font-black tracking-[0.12em] text-amber-100">
                                                        {t('board.rulesSelected')}
                                                    </span>
                                                )}
                                                <span className="block text-sm font-black tracking-[0.08em]">{mode.label}</span>
                                                <span className="mt-2 block text-[0.66rem] font-bold leading-relaxed opacity-78 lg:text-xs">
                                                    {t(`board.exitChipModeDescriptions.${modeId}`)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="mt-5 rounded-xl border border-amber-200/18 bg-black/16 p-3 lg:p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-black tracking-[0.14em] text-amber-100 lg:text-base">
                                        {t('board.challengeSettings')}
                                    </h3>
                                    <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[0.62rem] text-amber-100/76">
                                        {activeLabels.length > 0 ? activeLabels.join(' / ') : t('board.noChallenges')}
                                    </span>
                                </div>
                                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                                    {challengeIds.map((challengeId) => {
                                        const challenge = THE_GANG_CHALLENGES[challengeId];
                                        const active = isChallengeActive(normalized, challengeId);
                                        return (
                                            <button
                                                key={challengeId}
                                                type="button"
                                                aria-disabled={!canEdit}
                                                onClick={() => tryEdit(() => toggleChallenge(challengeId))}
                                                aria-pressed={active}
                                                className={[
                                                    'group relative overflow-hidden rounded-xl border bg-black/28 p-1.5 text-left transition',
                                                    canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
                                                    active
                                                        ? 'border-amber-200 shadow-[0_0_0_0.18rem_rgba(251,191,36,0.42),0_0.75rem_1.6rem_rgba(0,0,0,0.36)]'
                                                        : 'border-amber-200/18 hover:border-amber-200/62 hover:shadow-[0_0.55rem_1.25rem_rgba(0,0,0,0.36)]',
                                                ].join(' ')}
                                                data-state={active ? 'selected' : 'idle'}
                                                data-testid={`the-gang-challenge-${challengeId}`}
                                            >
                                                <OptimizedImage
                                                    src={getChallengeAssetPath(challengeId)}
                                                    alt={challenge.label}
                                                    className={[
                                                        'aspect-[3/4] w-full rounded-lg bg-stone-950 object-contain transition',
                                                        active ? 'brightness-110' : 'group-hover:brightness-110',
                                                    ].join(' ')}
                                                    draggable={false}
                                                    placeholder={false}
                                                />
                                                {active && (
                                                    <span className="absolute right-3 top-3 rounded-full bg-emerald-950/92 px-2 py-0.5 text-[0.55rem] font-black tracking-[0.1em] text-amber-100 shadow-[0_0.35rem_0.8rem_rgba(0,0,0,0.35)]">
                                                        {t('board.challengeEnabled')}
                                                    </span>
                                                )}
                                                <span className="sr-only">{challenge.summary}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-amber-200/18 bg-black/20 px-5 py-3 lg:px-7">
                            <div className="text-[0.68rem] font-black tracking-[0.08em] text-amber-100/72">
                                {t('board.rulesDialogSource')}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-full border border-amber-200/55 bg-amber-300 px-5 py-2 text-sm font-black text-emerald-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                            >
                                {t('board.confirmRulesDialog')}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToolCardBadge({
    tool,
    active = false,
    onUse,
    actionLabel,
}: {
    tool: TheGangToolId;
    active?: boolean;
    onUse?: (tool: TheGangToolId) => void;
    actionLabel?: string;
}) {
    const { t } = useTranslation('game-the-gang');
    const rule = THE_GANG_TOOLS[tool];
    const implemented = rule.runtimeStatus === 'implemented';
    const canUse = implemented && !active && !!onUse;
    const statusLabel = active
        ? t('board.toolActiveBadge')
        : (implemented ? t('board.toolUsableBadge') : t('board.toolDrawOnlyBadge'));
    const className = [
        'group relative block w-full max-w-[9.5rem] rounded-lg border bg-transparent p-0 shadow-[0_0.55rem_1.25rem_rgba(0,0,0,0.34)] transition',
        active
            ? 'border-emerald-200/80 shadow-[0_0_0_0.15rem_rgba(110,231,183,0.3),0_0.55rem_1.25rem_rgba(0,0,0,0.36)]'
            : implemented ? 'border-amber-200/34' : 'border-stone-400/28 grayscale-[0.25]',
        canUse ? 'hover:border-amber-100 hover:brightness-110' : 'cursor-default',
    ].join(' ');
    const content = (
        <>
            <OptimizedImage
                src={getToolAssetPath(tool)}
                alt={rule.label}
                className="aspect-[3/4] w-full min-w-[7.5rem] rounded-lg object-contain brightness-110 contrast-110"
                data-testid={`the-gang-tool-card-image-${tool}`}
                draggable={false}
                placeholder={false}
            />
            <span className="absolute bottom-1 left-1 right-1 rounded bg-black/78 px-1.5 py-1 text-center text-[0.58rem] font-black tracking-[0.08em] text-amber-50 ring-1 ring-white/10">
                {statusLabel}
            </span>
            <span className="sr-only">{active ? t('board.toolActiveBadge') : t('board.toolBadge')}</span>
            <span className="sr-only">{rule.summary}</span>
        </>
    );

    if (!canUse) {
        return (
            <span className={className} title={rule.summary}>
                {content}
            </span>
        );
    }

    return (
        <button
            type="button"
            className={className}
            onClick={() => onUse(tool)}
            title={rule.summary}
            aria-label={`${rule.label}，${actionLabel ?? t('board.useTool')}`}
        >
            {content}
        </button>
    );
}

function NightVisionCardPicker({
    cards,
    onSelect,
    onCancel,
}: {
    cards: PlayingCard[];
    onSelect: (cardIndex: number) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation('game-the-gang');

    return (
        <section
            className="mb-3 rounded-lg border border-amber-200/28 bg-amber-200/10 p-3"
            data-testid="the-gang-night-vision-picker"
            aria-label={t('board.nightVisionPickerTitle')}
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-black tracking-[0.12em] text-amber-100">
                        {t('board.nightVisionPickerTitle')}
                    </h3>
                    <p className="mt-1 text-[0.68rem] font-bold leading-relaxed text-amber-50/72">
                        {t('board.nightVisionPickerHint')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-full border border-amber-100/32 bg-black/24 px-3 py-1.5 text-[0.68rem] font-black text-amber-100 transition hover:border-amber-100/70 hover:bg-emerald-900"
                >
                    {t('board.cancelNightVisionPicker')}
                </button>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
                {cards.map((card, index) => (
                    <button
                        key={`${card.rank}-${card.suit}-${index}`}
                        type="button"
                        onClick={() => onSelect(index)}
                        className="rounded-lg border border-amber-200/38 bg-black/18 p-2 transition hover:border-amber-100 hover:bg-emerald-900/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                        aria-label={t('board.chooseNightVisionCard', { card: formatCard(card), index: index + 1 })}
                    >
                        <CardFace card={card} emphasis="showdown" t={t} />
                    </button>
                ))}
            </div>
        </section>
    );
}

function SpecialistCardBadge({ specialist }: { specialist: TheGangSpecialistId }) {
    const rule = THE_GANG_SPECIALISTS[specialist];
    return (
        <span
            className="relative block w-full max-w-[9.5rem] rounded-lg border border-sky-200/34 bg-transparent p-0 shadow-[0_0.55rem_1.25rem_rgba(0,0,0,0.34)]"
            title={rule.summary}
        >
            <OptimizedImage
                src={getSpecialistAssetPath(specialist)}
                alt={rule.label}
                className="aspect-[3/4] w-full min-w-[7.5rem] rounded-lg object-contain brightness-110 contrast-110"
                data-testid={`the-gang-specialist-card-image-${specialist}`}
                draggable={false}
                placeholder={false}
            />
            <span className="sr-only">{rule.summary}</span>
        </span>
    );
}

function ToolsPanel({
    core,
    localPlayerId,
    canConfigure,
    onDealTools,
    onResetTools,
    onResetSpecialists,
    onUseTool,
    onBlockedHostAction,
    onToolsAlreadyDealt,
}: {
    core: TheGangCore;
    localPlayerId: string;
    canConfigure: boolean;
    onDealTools: () => void;
    onResetTools: () => void;
    onResetSpecialists: () => void;
    onUseTool: (tool: TheGangToolId, cardIndex?: number) => void;
    onBlockedHostAction: () => void;
    onToolsAlreadyDealt: () => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const [isOpen, setIsOpen] = useState(false);
    const [nightVisionPickerOpen, setNightVisionPickerOpen] = useState(false);
    const localPlayer = core.players[localPlayerId];
    const toolsDealt = core.playerIds.some((id) => core.players[id].toolCards.length > 0);
    const activeToolLabels = localPlayer.activeTools.map((tool) => THE_GANG_TOOLS[tool].label);
    const localToolCount = localPlayer.toolCards.length;
    const localSpecialistCount = localPlayer.specialistCards.length;
    const canDealTools = canConfigure && !toolsDealt && core.toolDeck.length >= core.playerIds.length;

    const handleDealTools = () => {
        if (!canConfigure) {
            onBlockedHostAction();
            return;
        }
        if (toolsDealt) {
            onToolsAlreadyDealt();
            return;
        }
        onDealTools();
    };

    const handleResetTools = () => {
        if (!canConfigure) {
            onBlockedHostAction();
            return;
        }
        onResetTools();
    };

    const handleResetSpecialists = () => {
        if (!canConfigure) {
            onBlockedHostAction();
            return;
        }
        onResetSpecialists();
    };

    const handleUseTool = (tool: TheGangToolId) => {
        if (tool === 'night-vision-goggles') {
            setNightVisionPickerOpen(true);
            return;
        }
        onUseTool(tool);
    };

    return (
        <div
            className="pointer-events-auto relative z-50 text-xs font-black text-amber-50/94 lg:text-sm"
            data-bgg-zone="tools-panel"
            data-testid="the-gang-tools-panel"
        >
            <button
                type="button"
                aria-expanded={isOpen}
                aria-label={t('board.toolPanelSummary', { tools: localToolCount, specialists: localSpecialistCount })}
                aria-haspopup="dialog"
                onClick={() => setIsOpen(true)}
                className={UTILITY_BUTTON_CLASS}
            >
                <Wrench aria-hidden="true" className={UTILITY_ICON_CLASS} strokeWidth={2.25} />
                <span className="hidden sm:inline">{t('board.toolsPanel')}</span>
                <span aria-hidden="true" className="hidden rounded bg-black/24 px-1.5 py-0.5 text-[0.62rem] tabular-nums text-amber-100/88 lg:inline-flex">
                    {localToolCount}/{localSpecialistCount}
                </span>
                <span className="sr-only">
                    {t('board.toolPanelSummary', { tools: localToolCount, specialists: localSpecialistCount })}
                </span>
            </button>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/62 px-2 py-2 backdrop-blur-sm min-[901px]:px-5 min-[901px]:py-4"
                    data-testid="the-gang-tools-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('board.toolsPanel')}
                >
                    <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-amber-200/30 bg-[#102319] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.62)] min-[901px]:max-h-[90dvh]">
                        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200/18 bg-black/18 px-3 py-2.5 min-[901px]:gap-4 min-[901px]:px-5 min-[901px]:py-3">
                            <div className="min-w-0">
                                <h2 className="text-base font-black text-amber-100 min-[901px]:text-xl">{t('board.toolsPanel')}</h2>
                                <div className="truncate text-[0.68rem] text-amber-100/72">
                                    {t('board.toolPanelSummary', { tools: localToolCount, specialists: localSpecialistCount })}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-black/24 text-amber-100 transition hover:bg-amber-200 hover:text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                                aria-label={t('board.closeToolsPanel')}
                            >
                                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                            </button>
                        </header>
                        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 min-[901px]:gap-4 min-[901px]:p-4 lg:p-5">
                            <section className="min-w-0 rounded-lg border border-amber-200/16 bg-black/12 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <div className="text-[0.58rem] uppercase tracking-[0.18em] text-amber-200/62">{t('board.toolsPanel')}</div>
                            <div className="text-amber-100">{t('board.toolDeck', { count: core.toolDeck.length })}</div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                            <button
                                type="button"
                                aria-disabled={!canDealTools}
                                onClick={handleDealTools}
                                className={[
                                    'rounded-full border px-2.5 py-1 text-[0.62rem] font-black transition',
                                    canDealTools
                                        ? 'cursor-pointer border-amber-200/55 bg-amber-300 text-emerald-950 hover:bg-amber-200'
                                        : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400',
                                ].join(' ')}
                            >
                                {toolsDealt ? t('board.toolsDealt') : t('board.dealTools')}
                            </button>
                            <button
                                type="button"
                                aria-disabled={!canConfigure}
                                onClick={handleResetTools}
                                className={[
                                    'rounded-full border px-2.5 py-1 text-[0.62rem] font-black transition',
                                    canConfigure
                                        ? 'cursor-pointer border-amber-100/32 bg-emerald-900/82 text-amber-100 hover:border-amber-100/70 hover:bg-emerald-800'
                                        : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400',
                                ].join(' ')}
                            >
                                {t('board.resetTools')}
                            </button>
                        </div>
                    </div>
                    <div className="mb-2 rounded-md bg-black/18 px-2 py-1 text-amber-100">
                        {activeToolLabels.length > 0
                            ? t('board.activeTools', { tools: activeToolLabels.join(' / ') })
                            : t('board.noActiveTools')}
                    </div>
                    <div className="mb-3 rounded-md border border-amber-200/16 bg-black/16 px-2 py-1.5 text-[0.68rem] font-bold leading-relaxed text-amber-50/72" data-testid="the-gang-tools-deal-status">
                        {toolsDealt
                            ? t('board.toolsDealtStatus', { players: core.playerIds.length })
                            : t(canConfigure ? 'board.toolsReadyToDealStatus' : 'board.toolsGuestStatus')}
                    </div>
                    {nightVisionPickerOpen && localPlayer.toolCards.includes('night-vision-goggles') && (
                        <NightVisionCardPicker
                            cards={localPlayer.pocketCards}
                            onCancel={() => setNightVisionPickerOpen(false)}
                            onSelect={(cardIndex) => {
                                onUseTool('night-vision-goggles', cardIndex);
                                setNightVisionPickerOpen(false);
                            }}
                        />
                    )}
                        <div
                            className="relative rounded-lg border border-amber-200/18 bg-black/12 p-2"
                            data-testid="the-gang-local-tools"
                        >
                            {localPlayer.toolCards.length === 0 ? (
                                <OptimizedImage
                                    src={RULE_SURFACE_ASSETS.toolsZone}
                                    alt=""
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75"
                                    draggable={false}
                                    placeholder={false}
                                />
                            ) : (
                                <OptimizedImage
                                    src={RULE_SURFACE_ASSETS.toolsZone}
                                    alt=""
                                    aria-hidden="true"
                                    className="pointer-events-none absolute right-2 top-2 h-14 w-10 rounded opacity-18"
                                    draggable={false}
                                    placeholder={false}
                                />
                            )}
                            <div className="relative z-10">
                                {localPlayer.toolCards.length > 0 ? (
                                    <div className="flex flex-wrap justify-center gap-2 lg:gap-3" data-testid="the-gang-tool-card-grid">
                                        {localPlayer.toolCards.map((tool, index) => (
                                            <ToolCardBadge
                                                key={`${tool}-${index}`}
                                                tool={tool}
                                                active={localPlayer.activeTools.includes(tool)}
                                                onUse={handleUseTool}
                                                actionLabel={tool === 'night-vision-goggles' ? t('board.chooseHandCardForTool') : t('board.useTool')}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex min-h-[8.5rem] items-end justify-center rounded-md border border-amber-200/18 bg-black/8 px-2 pb-2 text-center text-amber-100/88 lg:min-h-[10.5rem]">
                                        {t('board.noTools')}
                                    </div>
                                )}
                            </div>
                        </div>
                            </section>
                        <section className="min-w-0 rounded-lg border border-sky-200/16 bg-black/12 p-3" data-testid="the-gang-local-specialists">
                            <div className="mb-1 flex items-center justify-between gap-2">
                                <div>
                                    <div className="text-[0.58rem] uppercase tracking-[0.18em] text-sky-100/72">
                                        {t('board.specialistZone')}
                                    </div>
                                    <div className="text-[0.58rem] text-sky-100/82">
                                        {t('board.specialistDeck', { count: core.specialistDeck.length })}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    aria-disabled={!canConfigure}
                                    onClick={handleResetSpecialists}
                                    className={[
                                        'rounded-full border px-2.5 py-1 text-[0.62rem] font-black transition',
                                        canConfigure
                                            ? 'cursor-pointer border-sky-100/32 bg-sky-950/72 text-sky-100 hover:border-sky-100/70 hover:bg-sky-900'
                                            : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400',
                                    ].join(' ')}
                                >
                                    {t('board.resetSpecialists')}
                                </button>
                            </div>
                            <div className="relative rounded-lg border border-sky-200/18 bg-black/12 p-2">
                                {localPlayer.specialistCards.length === 0 ? (
                                    <OptimizedImage
                                        src={RULE_SURFACE_ASSETS.specialistsZone}
                                        alt=""
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75"
                                        draggable={false}
                                        placeholder={false}
                                    />
                                ) : (
                                    <OptimizedImage
                                        src={RULE_SURFACE_ASSETS.specialistsZone}
                                        alt=""
                                        aria-hidden="true"
                                        className="pointer-events-none absolute right-2 top-2 h-14 w-10 rounded opacity-18"
                                        draggable={false}
                                        placeholder={false}
                                    />
                                )}
                                <div className="relative z-10">
                                    {localPlayer.specialistCards.length > 0 ? (
                                        <div className="flex flex-wrap justify-center gap-2 lg:gap-3" data-testid="the-gang-specialist-card-grid">
                                            {localPlayer.specialistCards.map((specialist, index) => (
                                                <SpecialistCardBadge key={`${specialist}-${index}`} specialist={specialist} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[8.5rem] items-end justify-center rounded-md border border-sky-200/18 bg-black/8 px-2 pb-2 text-center text-sky-100/88 lg:min-h-[10.5rem]">
                                            {t('board.noSpecialists')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
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
            {chipValues.map((chip) => {
                const owner = ownerByChip[chip];
                if (owner !== undefined) {
                    return null;
                }

                return (
                    <ChipButton
                        key={`${round}-${chip}`}
                        round={round}
                        value={chip}
                        onClick={() => onTakeChip(chip)}
                        selected={selectedChip === chip}
                    />
                );
            })}
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
    communityCards,
    playerName,
    onNextHeist,
    nextHeistProgress,
    playerIds,
}: {
    lastShowdown: NonNullable<TheGangCore['lastShowdown']>;
    communityCards: TheGangCore['communityCards'];
    playerName: (id: string) => string;
    onNextHeist: () => void;
    nextHeistProgress: ProgressButtonState;
    playerIds: string[];
}) {
    const success = lastShowdown.outcome === 'success';
    const { t } = useTranslation('game-the-gang');
    const playerResultIndex = new Map(lastShowdown.results.map((result, index) => [result.playerId, index]));

    return (
        <section
            className="pointer-events-auto fixed inset-0 z-[80] h-dvh overflow-y-auto overscroll-contain bg-[#06110d] bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_50%_58%,rgba(6,78,59,0.72),rgba(6,17,13,0.98)_62%,#06110d_100%)] px-3 py-4 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)] md:px-6 md:py-6"
            data-bgg-zone="reveal-zone"
            aria-label={t('board.showdownSettlement')}
        >
            <div
                className="relative mx-auto flex min-h-full w-full max-w-[104rem] flex-col items-center justify-start gap-4 overflow-visible px-1 py-4 md:gap-5 md:px-3 md:py-6"
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
                    className="flex w-full flex-col items-center gap-2 overflow-visible px-2 py-2"
                    data-bgg-zone="reveal-community-cards"
                    data-tutorial-id="the-gang-showdown-community-cards"
                    aria-label={t('board.communityCards')}
                >
                    <span className="text-xs font-black tracking-[0.12em] text-amber-100 md:text-sm">
                        {t('board.communityCards')}
                    </span>
                    <div className="flex justify-center gap-2 md:gap-3">
                        {communityCards.map((card, index) => (
                            <CardFace
                                key={`${card.rank}-${card.suit}-${index}`}
                                card={card}
                                emphasis="showdown"
                                t={t}
                            />
                        ))}
                    </div>
                </div>

                <div
                    className="grid w-full max-w-[72rem] grid-cols-1 gap-4 overflow-visible md:grid-cols-2"
                    data-bgg-zone="reveal-players"
                    data-tutorial-id="the-gang-showdown-hole-cards"
                >
                    {lastShowdown.results.map((result) => (
                        <div
                            key={result.playerId}
                            className="flex min-w-0 flex-col gap-3 overflow-visible rounded-[1.25rem] bg-emerald-950/34 px-3 py-3 outline outline-1 outline-amber-100/10 shadow-[0_0_34px_rgba(251,191,36,0.14),0_14px_34px_rgba(0,0,0,0.28)] md:px-4 md:py-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-black text-stone-100 md:text-base">{playerName(result.playerId)}</span>
                                <div className="flex items-center gap-2">
                                    <ChipDisc round={4} value={result.chip} size="md" zone="plreveal-token" />
                                    <span className="text-xs font-black tracking-[0.08em] text-amber-100 md:text-sm">
                                        {result.strength.label}
                                        {result.winningHandSlot === 'bottom' && ` · ${t('board.winningBottomHand')}`}
                                        {result.winningHandSlot === 'top' && ` · ${t('board.winningTopHand')}`}
                                    </span>
                                </div>
                            </div>
                            <div
                                className="flex justify-center overflow-visible"
                                data-bgg-zone="reveal-pocket-cards"
                                aria-label={`${playerName(result.playerId)} ${result.strength.label}`}
                            >
                                <HandCardRows
                                    primaryCards={result.pocketCards}
                                    secondaryCards={result.secondaryPocketCards}
                                    emphasis="showdown"
                                    t={t}
                                    testIdPrefix={`the-gang-showdown-hand-${result.playerId}`}
                                    revealOrderBase={(playerResultIndex.get(result.playerId) ?? 0) * 4}
                                    winningHandSlot={result.winningHandSlot}
                                    showLabels={!!result.secondaryPocketCards?.length}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="sr-only" data-bgg-zone="safe-zone">
                    {t('board.safeSettlement')}
                </div>

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
    localPlayerId,
    onTakeCurrentChip,
}: {
    roundHistory: TheGangCore['roundHistory'];
    currentRound: number;
    currentChip?: number;
    playerId: string;
    localPlayerId: string;
    onTakeCurrentChip?: (chip: number) => void;
}) {
    const canTakeCurrentChip = currentChip !== undefined && playerId !== localPlayerId && !!onTakeCurrentChip;

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
                canTakeCurrentChip ? (
                    <button
                        type="button"
                        className="rounded-full transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
                        data-testid={`the-gang-take-player-chip-${playerId}`}
                        onClick={() => onTakeCurrentChip(currentChip)}
                    >
                        <ChipDisc
                            round={currentRound}
                            value={currentChip}
                            size="lg"
                            className="scale-110 drop-shadow-[0_0_22px_rgba(252,211,77,0.82)]"
                            zone="player-current-token"
                        />
                    </button>
                ) : (
                    <ChipDisc
                        round={currentRound}
                        value={currentChip}
                        size="lg"
                        className="scale-110 drop-shadow-[0_0_22px_rgba(252,211,77,0.82)]"
                        zone="player-current-token"
                    />
                )
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

function TheGangEndgameContent({
    result,
    successes,
    failures,
}: ContentSlotProps & {
    successes: number;
    failures: number;
}) {
    const { t } = useTranslation('game-the-gang');
    const clearedAllCases = Array.isArray(result?.winners) && result.winners.length > 0;
    const title = clearedAllCases
        ? t('board.endgame.winTitle')
        : t('board.endgame.loseTitle');
    const subtitle = clearedAllCases
        ? t('board.endgame.winSubtitle')
        : t('board.endgame.loseSubtitle');

    return (
        <div className="mb-6 text-center">
            <div className="mb-3 inline-flex rounded-full border border-amber-200/40 bg-amber-200/12 px-4 py-1 text-xs font-black tracking-[0.18em] text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.28)]">
                {t('title.primary')}
            </div>
            <h2
                data-testid="the-gang-endgame-title"
                className={[
                    'text-4xl font-black tracking-[0.2em] drop-shadow-[0_5px_18px_rgba(0,0,0,0.85)] md:text-5xl',
                    clearedAllCases ? 'text-emerald-300' : 'text-rose-300',
                ].join(' ')}
            >
                {title}
            </h2>
            <p className="mt-3 text-base font-bold text-stone-100 drop-shadow-lg md:text-lg">
                {subtitle}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 text-sm font-black tracking-[0.12em]">
                <span className="rounded-full border border-emerald-300/40 bg-emerald-300/12 px-4 py-2 text-emerald-100">
                    {t('board.endgame.casesClosed', { successes })}
                </span>
                <span className="rounded-full border border-rose-300/40 bg-rose-300/12 px-4 py-2 text-rose-100">
                    {t('board.endgame.alarms', { failures })}
                </span>
            </div>
        </div>
    );
}

export default function TheGangBoard({ G, dispatch, playerID, reset, matchData, seatControllers, isMultiplayer }: Props) {
    const core = G.core;
    const { t } = useTranslation('game-the-gang');
    const toast = useToast();
    useTutorialBridge(G.sys.tutorial, dispatch);
    useGameAudio({
        config: THE_GANG_AUDIO_CONFIG,
        gameId: THE_GANG_MANIFEST.id,
        G: core,
        ctx: {
            isGameOver: !!G.sys.gameover || !!core.gameResult,
        },
        eventEntries: G.sys.eventStream?.entries,
        meta: {
            playerID,
            isMultiplayer: isMultiplayer === true,
        },
    });
    const { overlayProps: endgameProps } = useEndgame({
        result: G.sys.gameover || undefined,
        playerID,
        reset,
        matchData,
        isMultiplayer,
    });

    const hasAiSeat = Object.values(seatControllers ?? {}).some((controller) => controller.type !== 'human');
    const localHumanPlayerId = core.playerIds.find((id) => (seatControllers?.[id]?.type ?? 'human') === 'human')
        ?? core.playerIds[0];
    const localPlayerId = isMultiplayer
        ? (playerID ?? core.playerIds[0])
        : (hasAiSeat ? (playerID ?? localHumanPlayerId) : (playerID ?? core.playerIds[0]));
    const localPlayer = core.players[localPlayerId];
    const heistStarted = core.heistStarted === true;
    const setupOpen = core.phase === 'chip-selection' && !heistStarted;
    const allPlayersHaveChip = core.playerIds.every((id) => core.currentRoundChips[id] !== undefined);
    const nextRoundProgress = getProgressButtonState(core, 'end-round', localPlayerId, t('board.nextRound'), t);
    const revealShowdownProgress = getProgressButtonState(core, 'reveal-showdown', localPlayerId, t('board.revealShowdown'), t);
    const nextHeistProgress = getProgressButtonState(core, 'start-next-heist', localPlayerId, t('board.nextHeist'), t);
    const chipValues = getChipValues(core.playerIds.length, core.rules.config, core.round);
    const ownerByChip = Object.fromEntries(
        Object.entries(core.currentRoundChips).map(([owner, chip]) => [chip, owner]),
    ) as Record<number, string | undefined>;
    const rulesLocked = core.heistNumber !== 1
        || core.round !== 1
        || core.phase !== 'chip-selection'
        || heistStarted
        || core.roundHistory.length > 0;
    const canConfigureRules = resolveCanConfigureRules(matchData, playerID, core.playerIds[0]);
    const handRankRules = isChallengeActive(core.rules.config, 'grinding-gears') || isChallengeActive(core.rules.config, 'the-joker') || isChallengeActive(core.rules.config, 'master-key')
        ? THE_GANG_EXPANDED_HAND_RANK_RULES
        : TEXAS_HOLDEM_HAND_RANK_RULES;

    const playerNames = buildPlayerDisplayNameMap(
        core.playerIds,
        matchData,
        (id) => t('board.playerFallback', { player: Number(id) + 1 }),
    );
    const playerName = (id: string) => playerNames[id] ?? t('board.playerFallback', { player: Number(id) + 1 });
    const tutorialOpponentTargetId = core.playerIds.find((id) => id !== localPlayerId);
    const showWarning = (key: string, dedupeKey: string) => {
        toast.warning({ kind: 'i18n', ns: 'game-the-gang', key }, undefined, {
            dedupeKey: `the-gang.${dedupeKey}`,
        });
    };
    const showRulesBlockedToast = () => {
        if (canConfigureRules) {
            toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastRulesLocked' }, undefined, {
                dedupeKey: 'the-gang.rules-locked',
            });
            return;
        }
        toast.warning({ kind: 'i18n', ns: 'game-the-gang', key: 'board.toastHostOnlySetup' }, undefined, {
            dedupeKey: 'the-gang.host-only-setup',
        });
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
        if (!heistStarted) {
            showWarning('board.toastStartBeforeChip', 'start-before-chip');
            return;
        }
        dispatchForPlayer(THE_GANG_COMMANDS.TAKE_CHIP, { chip });
    };

    const setRulesConfig = (config: TheGangRulesConfig) => {
        dispatchForPlayer(THE_GANG_COMMANDS.SET_RULES_CONFIG, { config });
    };

    const dealTools = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.DEAL_TOOLS, {});
    };

    const resetTools = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.RESET_TOOLS, {});
    };

    const resetSpecialists = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.RESET_SPECIALISTS, {});
    };

    const useTool = (tool: TheGangToolId, cardIndex?: number) => {
        dispatchForPlayer(THE_GANG_COMMANDS.USE_TOOL, {
            tool,
            ...(typeof cardIndex === 'number' ? { cardIndex } : {}),
        });
    };

    const endRound = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.END_ROUND, {});
    };

    const revealShowdown = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.REVEAL_SHOWDOWN, {});
    };

    const startHeist = () => {
        if (!canConfigureRules) {
            showWarning('board.toastHostOnlyStart', 'host-only-start');
            return;
        }
        dispatchForPlayer(THE_GANG_COMMANDS.START_HEIST, {});
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
                className="relative flex h-full min-h-0 w-full flex-col gap-1 overflow-hidden bg-[#203b23] px-4 pb-0 pt-3 lg:gap-2 lg:px-8 lg:pb-0 lg:pt-5 xl:gap-3 xl:px-12 xl:pb-0 xl:pt-7"
                data-layout-contract="bgg-electronic"
                data-layout-source={BGG_LAYOUT_CONTRACT.source}
                data-bgg-top-zone={BGG_LAYOUT_CONTRACT.topZone}
                data-bgg-middle-zone={BGG_LAYOUT_CONTRACT.middleZone}
                data-bgg-bottom-zone={BGG_LAYOUT_CONTRACT.bottomZone}
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(245,214,132,0.16),transparent_36%),radial-gradient(circle_at_50%_112%,rgba(5,8,5,0.55),transparent_42%),linear-gradient(90deg,rgba(245,214,132,0.06),transparent_18%,transparent_82%,rgba(245,214,132,0.06)),repeating-linear-gradient(135deg,rgba(255,255,255,0.028)_0,rgba(255,255,255,0.028)_1px,transparent_1px,transparent_20px)] opacity-80" />

                <HudPortal>
                    <div
                        className="pointer-events-none fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] z-50 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end min-[901px]:gap-2 lg:bottom-[max(1rem,env(safe-area-inset-bottom))] lg:left-[max(1rem,env(safe-area-inset-left))]"
                        data-bgg-zone="utility-dock"
                        data-testid="the-gang-utility-dock"
                    >
                        <HandRankReference rules={handRankRules} />
                        <RulesConfigPanel
                            config={core.rules.config}
                            locked={rulesLocked}
                            canConfigure={canConfigureRules}
                            playerCount={core.playerIds.length}
                            onChange={setRulesConfig}
                            onBlockedEdit={showRulesBlockedToast}
                        />
                        <ToolsPanel
                            core={core}
                            localPlayerId={localPlayerId}
                            canConfigure={canConfigureRules}
                            onDealTools={dealTools}
                            onResetTools={resetTools}
                            onResetSpecialists={resetSpecialists}
                            onUseTool={useTool}
                            onBlockedHostAction={() => showWarning('board.toastToolsHostOnly', 'tools-host-only')}
                            onToolsAlreadyDealt={() => showWarning('board.toastToolsAlreadyDealt', 'tools-already-dealt')}
                        />
                    </div>
                </HudPortal>

                <header className="relative z-10 flex shrink-0 items-center justify-end gap-2 lg:gap-3">
                    <div className="sr-only" data-tutorial-id="the-gang-title">
                        <p>{t('title.secondary')}</p>
                        <h1>{t('title.primary')}</h1>
                    </div>
                    <div className="flex flex-wrap justify-end gap-3 text-[0.7rem] font-black tracking-[0.08em] lg:gap-4 lg:text-sm xl:text-base" data-tutorial-id="the-gang-score-track">
                        <span className="text-amber-100">{t('board.heistNumber', { heist: core.heistNumber })}</span>
                        <SuccessTrack successes={core.successes} />
                        <AlarmTrack failures={core.failures} />
                        <TableReminderBadges config={core.rules.config} />
                    </div>
                </header>

                <section className="pointer-events-none relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-visible pb-[clamp(5.5rem,22vh,9rem)] lg:gap-2 lg:pb-[clamp(8.5rem,20vh,13.5rem)] xl:gap-3" data-testid="the-gang-bgg-board">
                    <section
                        className="pointer-events-auto flex shrink-0 justify-evenly gap-3 overflow-visible lg:gap-6"
                        data-bgg-zone="top-zone"
                        data-tutorial-id="the-gang-player-list"
                    >
                        {core.playerIds.map((id) => {
                            const player = core.players[id];
                            const isSelf = id === localPlayerId;
                            const visible = core.phase !== 'chip-selection' && !isSelf;
                            return (
                                <div
                                    key={id}
                                    className="flex min-w-0 basis-[12rem] flex-col items-center gap-1 lg:basis-[26rem] lg:gap-2"
                                    data-bgg-zone="plboard"
                                    data-tutorial-id={id === tutorialOpponentTargetId ? 'the-gang-opponent-state' : undefined}
                                >
                                    <span className={`truncate text-xs font-black tracking-[0.08em] lg:text-sm ${isSelf ? 'text-amber-200' : 'text-stone-100/72'}`}>
                                        {playerName(id)}
                                    </span>
                                    <PlayerChipStrip
                                        roundHistory={core.roundHistory}
                                        currentRound={core.round}
                                        currentChip={core.currentRoundChips[id]}
                                        playerId={id}
                                        localPlayerId={localPlayerId}
                                        onTakeCurrentChip={heistStarted && core.phase === 'chip-selection' ? takeChip : undefined}
                                    />
                                    <div className="flex justify-center overflow-visible">
                                        {visible && (
                                            <HandCardRows
                                                primaryCards={player.pocketCards}
                                                secondaryCards={player.secondaryPocketCards}
                                                t={t}
                                                testIdPrefix={`the-gang-opponent-hand-${id}`}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    <section
                        className="pointer-events-none relative z-20 flex min-h-0 flex-1 items-center justify-center overflow-visible"
                        data-tutorial-id="the-gang-round-panel"
                        data-bgg-zone="middle-zone"
                    >
                        <div className="pointer-events-none relative z-20 flex min-h-0 flex-col items-center gap-3 overflow-visible lg:gap-6 min-[1180px]:flex-row min-[1180px]:gap-8" data-bgg-zone="middle-center">
                            <div
                                className="pointer-events-auto relative z-30 flex w-full max-w-[29rem] flex-wrap items-center justify-center gap-3 overflow-visible lg:max-w-[44rem] lg:gap-5"
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

                            <div className="pointer-events-none flex w-full max-w-[48rem] flex-nowrap justify-center gap-3 lg:max-w-[72rem] lg:gap-5 min-[1180px]:max-w-[40rem] xl:max-w-[80rem]" data-bgg-zone="card-river" aria-label={t('board.communityCardsSlot')}>
                                {core.communityCards.map((card, index) => (
                                    <div
                                        key={index}
                                        className={[
                                            'rounded-xl border-[0.35rem] p-1 ring-2 transition-colors',
                                            COMMUNITY_CARD_FRAME_CLASSES[index] ?? COMMUNITY_CARD_FRAME_CLASSES[4],
                                        ].join(' ')}
                                        data-community-card-frame={index < 3 ? 'yellow' : index === 3 ? 'orange' : 'red'}
                                    >
                                        <CardFace card={card} emphasis="river" t={t} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-end justify-center overflow-visible pb-0" data-bgg-zone="bottom-zone">
                        <VaultsAlarmsZone successes={core.successes} failures={core.failures} />

                        <div className="pointer-events-auto flex flex-col items-center gap-1.5 lg:gap-2" data-bgg-zone="hand-groupzone" data-tutorial-id="the-gang-hand">
                            <span className="sr-only">{t('board.myHand')}</span>
                            <HandChipStrip
                                roundHistory={core.roundHistory}
                                currentRound={core.round}
                                currentChip={core.currentRoundChips[localPlayerId]}
                                playerId={localPlayerId}
                            />
                            <div className="flex items-center justify-center overflow-visible" data-bgg-zone="hand-cards">
                                <HandCardRows
                                    primaryCards={localPlayer?.pocketCards ?? []}
                                    secondaryCards={localPlayer?.secondaryPocketCards}
                                    emphasis="hand"
                                    t={t}
                                    testIdPrefix="the-gang-local-hand"
                                    showLabels={(localPlayer?.secondaryPocketCards?.length ?? 0) > 0}
                                />
                            </div>
                            {(localPlayer?.flashlightCards.length ?? 0) + (localPlayer?.nightVisionCards.length ?? 0) > 0 && (
                                <div className="flex items-center justify-center gap-2" data-bgg-zone="tool-cards" data-testid="the-gang-tool-cards">
                                    {localPlayer?.flashlightCards.map((card, index) => (
                                        <CardFace key={`flashlight-${card.rank}-${card.suit}-${index}`} card={card} t={t} />
                                    ))}
                                    {localPlayer?.nightVisionCards.map((card, index) => (
                                        <CardFace key={`night-vision-${card.rank}-${card.suit}-${index}`} card={card} t={t} />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pointer-events-auto absolute bottom-0 right-24 flex min-w-[7rem] flex-col items-center gap-1 lg:right-28" data-bgg-zone="action-dock">
                            {setupOpen && (
                                <button
                                    type="button"
                                    aria-disabled={!canConfigureRules}
                                    onClick={startHeist}
                                    data-testid="the-gang-start-heist"
                                    data-tutorial-id="the-gang-start-heist"
                                    className={[
                                        'min-w-[5.75rem] rounded-full border px-5 py-2.5 text-base font-black tracking-[0.08em] shadow-[0_12px_28px_rgba(245,158,11,0.36)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100 lg:min-w-[7rem] lg:px-7 lg:py-3.5 lg:text-lg',
                                        canConfigureRules
                                            ? 'cursor-pointer border-amber-200/75 bg-amber-300 text-stone-950 hover:-translate-y-0.5 hover:bg-amber-200'
                                            : 'cursor-not-allowed border-stone-600/70 bg-stone-700/75 text-stone-400 shadow-none',
                                    ].join(' ')}
                                >
                                    {t(canConfigureRules ? 'board.startHeist' : 'board.setupWaitingHost')}
                                </button>
                            )}
                            {heistStarted && core.phase === 'chip-selection' && core.round < 4 && (
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
                            {heistStarted && core.phase === 'chip-selection' && core.round === 4 && (
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
                            {heistStarted && allPlayersHaveChip && core.phase === 'chip-selection' && (
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
                                communityCards={core.communityCards}
                                playerName={playerName}
                                onNextHeist={startNextHeist}
                                nextHeistProgress={nextHeistProgress}
                                playerIds={core.playerIds}
                            />
                        )}
                    </div>
                </section>
            </section>
            <EndgameOverlay
                {...endgameProps}
                renderContent={(props) => (
                    <TheGangEndgameContent
                        {...props}
                        successes={core.successes}
                        failures={core.failures}
                    />
                )}
            />
        </main>
        <style>{`
            @keyframes the-gang-card-reveal {
                0% {
                    opacity: 0;
                    transform: perspective(42rem) rotateY(78deg) translateY(0.65rem) scale(0.94);
                    filter: brightness(0.72) saturate(0.85);
                }
                54% {
                    opacity: 1;
                    transform: perspective(42rem) rotateY(-8deg) translateY(-0.1rem) scale(1.03);
                    filter: brightness(1.12) saturate(1.08);
                }
                100% {
                    opacity: 1;
                    transform: perspective(42rem) rotateY(0deg) translateY(0) scale(1);
                    filter: brightness(1) saturate(1);
                }
            }
        `}</style>
        </UndoProvider>
    );
}
