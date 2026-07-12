import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import { UndoProvider } from '../../contexts/UndoContext';
import { useTutorialBridge } from '../../contexts/TutorialContext';
import { OptimizedImage } from '../../components/common/media/OptimizedImage';
import { EndgameOverlay, type ContentSlotProps } from '../../components/game/framework/widgets/EndgameOverlay';
import { buildPlayerDisplayNameMap } from '../../components/game/framework/playerDisplay';
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
    THE_GANG_GAME_MODES,
    THE_GANG_SPECIALISTS,
    THE_GANG_TOOLS,
    getActiveChallengeLabels,
    isChallengeActive,
    normalizeRulesConfig,
} from './domain/expansions';
import {
    THE_GANG_COMMANDS,
    type PlayingCard,
    type TheGangChallengeId,
    type TheGangCommandMap,
    type TheGangCore,
    type TheGangGameMode,
    type TheGangProgressKind,
    type TheGangRulesConfig,
    type TheGangToolId,
} from './domain/types';
import { THE_GANG_MANIFEST } from './manifest';

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

    if (card.kind === 'joker' || card.kind === 'wild' || card.kind === 'blank' || card.suit === 'special') {
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

function RulesConfigPanel({
    config,
    locked,
    canConfigure,
    onChange,
}: {
    config: TheGangRulesConfig;
    locked: boolean;
    canConfigure: boolean;
    onChange: (config: TheGangRulesConfig) => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const [isOpen, setIsOpen] = useState(false);
    const normalized = normalizeRulesConfig(config);
    const activeLabels = getActiveChallengeLabels(normalized);
    const challengeIds = Object.keys(THE_GANG_CHALLENGES)
        .filter((challengeId) => THE_GANG_CHALLENGES[challengeId as TheGangChallengeId].runtimeStatus === 'implemented') as TheGangChallengeId[];

    const updateMode = (gameMode: TheGangGameMode) => {
        onChange(normalizeRulesConfig({ ...normalized, gameMode }));
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

    return (
        <div
            className="absolute bottom-1 right-48 z-50 max-w-[22rem] text-[0.62rem] font-black text-amber-50/94 lg:bottom-2 lg:right-64 lg:text-xs"
            data-bgg-zone="rules-config"
            data-testid="the-gang-rules-config"
        >
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-emerald-950/82 px-3 py-1.5 text-amber-100 shadow-[0_0.18rem_0.8rem_rgba(0,0,0,0.28)] ring-1 ring-amber-200/24 transition hover:bg-emerald-900/88 hover:text-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100"
            >
                <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-200/45 text-[0.62rem] leading-none">⚙</span>
                {t('board.rulesConfig')}
            </button>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/62 px-4 py-5 backdrop-blur-sm"
                    data-testid="the-gang-rules-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('board.rulesDialogTitle')}
                >
                    <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-200/30 bg-[#102319] text-amber-50 shadow-[0_1.5rem_4rem_rgba(0,0,0,0.62)]">
                        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-amber-200/18 bg-[radial-gradient(circle_at_18%_0%,rgba(245,214,132,0.16),transparent_32%),linear-gradient(135deg,rgba(16,35,25,0.96),rgba(6,14,10,0.98))] px-5 py-4 lg:px-7">
                            <div className="min-w-0">
                                <div className="text-[0.68rem] uppercase tracking-[0.24em] text-amber-200/72">
                                    {t('board.rulesDialogEyebrow')}
                                </div>
                                <h2 className="mt-1 text-xl font-black tracking-[0.12em] text-amber-100 lg:text-2xl">
                                    {t('board.rulesDialogTitle')}
                                </h2>
                                <p className="mt-2 max-w-3xl text-xs font-bold leading-relaxed text-amber-50/72 lg:text-sm">
                                    {t(canConfigure ? 'board.rulesDialogHostHint' : 'board.rulesDialogGuestHint')}
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
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:px-7 lg:py-5">
                            <section className="grid gap-3 lg:grid-cols-3" aria-label={t('board.gameMode')}>
                                {(Object.keys(THE_GANG_GAME_MODES) as TheGangGameMode[]).map((modeId) => {
                                    const mode = THE_GANG_GAME_MODES[modeId];
                                    return (
                                        <button
                                            key={modeId}
                                            type="button"
                                            disabled={!canEdit}
                                            onClick={() => updateMode(modeId)}
                                            aria-pressed={normalized.gameMode === modeId}
                                            className={[
                                                'min-h-[7rem] rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55',
                                                normalized.gameMode === modeId
                                                    ? 'border-amber-200 bg-amber-200 text-emerald-950 shadow-[0_0_1.5rem_rgba(245,214,132,0.24)]'
                                                    : 'border-amber-200/22 bg-black/20 text-amber-50 hover:border-amber-200/55 hover:bg-emerald-900/55',
                                            ].join(' ')}
                                            data-testid={`the-gang-mode-${modeId}`}
                                        >
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
                                        {t('board.challengeSettings')}
                                    </h3>
                                    <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[0.62rem] text-amber-100/76">
                                        {activeLabels.length > 0 ? activeLabels.join(' / ') : t('board.noChallenges')}
                                    </span>
                                </div>
                                {locked && (
                                    <div className="mb-3 rounded-lg border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-xs text-amber-100/88">
                                        {t('board.rulesLocked')}
                                    </div>
                                )}
                                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                    {challengeIds.map((challengeId) => {
                                        const challenge = THE_GANG_CHALLENGES[challengeId];
                                        const active = isChallengeActive(normalized, challengeId);
                                        return (
                                            <button
                                                key={challengeId}
                                                type="button"
                                                disabled={!canEdit}
                                                onClick={() => toggleChallenge(challengeId)}
                                                aria-pressed={active}
                                                className={[
                                                    'min-h-[4.4rem] rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-55',
                                                    active
                                                        ? 'border-amber-200 bg-amber-200 text-emerald-950'
                                                        : 'border-amber-200/16 bg-black/18 text-amber-100 hover:border-amber-200/48 hover:bg-emerald-900/60',
                                                ].join(' ')}
                                                data-testid={`the-gang-challenge-${challengeId}`}
                                            >
                                                <span className="block text-xs font-black tracking-[0.08em]">{challenge.label}</span>
                                                <span className="mt-1 block text-[0.62rem] font-bold leading-snug opacity-78">{challenge.summary}</span>
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
}: {
    tool: TheGangToolId;
    active?: boolean;
    onUse?: (tool: TheGangToolId) => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const rule = THE_GANG_TOOLS[tool];
    const canUse = rule.runtimeStatus === 'implemented' && !active && !!onUse;
    const className = [
        'flex min-h-[5.2rem] flex-col justify-between rounded-lg border px-2.5 py-2 text-left text-[0.62rem] font-black tracking-[0.04em] shadow-[0_0.35rem_0.9rem_rgba(0,0,0,0.22)] transition lg:min-h-[6rem] lg:text-[0.7rem]',
        active
            ? 'border-emerald-200/55 bg-emerald-300/18 text-emerald-100'
            : 'border-amber-200/28 bg-[linear-gradient(145deg,rgba(245,214,132,0.14),rgba(7,22,14,0.92))] text-amber-100',
        canUse ? 'hover:border-amber-100 hover:bg-amber-200 hover:text-emerald-950' : 'opacity-78',
    ].join(' ');
    const content = (
        <>
            <span className="block text-[0.58rem] uppercase tracking-[0.18em] opacity-70">{active ? t('board.toolActiveBadge') : t('board.toolBadge')}</span>
            <span className="block text-sm leading-tight">{rule.label}</span>
            <span className="line-clamp-2 text-[0.58rem] leading-snug opacity-72">{rule.summary}</span>
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
        <button type="button" className={className} onClick={() => onUse(tool)} title={rule.summary}>
            {content}
        </button>
    );
}

function SpecialistCardBadge({ specialist }: { specialist: keyof typeof THE_GANG_SPECIALISTS }) {
    const { t } = useTranslation('game-the-gang');
    const rule = THE_GANG_SPECIALISTS[specialist];
    return (
        <span
            className="flex min-h-[5.2rem] flex-col justify-between rounded-lg border border-sky-200/30 bg-[linear-gradient(145deg,rgba(125,211,252,0.16),rgba(8,20,32,0.92))] px-2.5 py-2 text-left text-[0.62rem] font-black tracking-[0.04em] text-sky-100 shadow-[0_0.35rem_0.9rem_rgba(0,0,0,0.22)] lg:min-h-[6rem] lg:text-[0.7rem]"
            title={rule.summary}
        >
            <span className="block text-[0.58rem] uppercase tracking-[0.18em] opacity-70">{t('board.specialistBadge')}</span>
            <span className="block text-sm leading-tight">{rule.label}</span>
            <span className="line-clamp-2 text-[0.58rem] leading-snug opacity-72">{rule.summary}</span>
        </span>
    );
}

function ToolsPanel({
    core,
    localPlayerId,
    onDealTools,
    onUseTool,
}: {
    core: TheGangCore;
    localPlayerId: string;
    onDealTools: () => void;
    onUseTool: (tool: TheGangToolId) => void;
}) {
    const { t } = useTranslation('game-the-gang');
    const localPlayer = core.players[localPlayerId];
    const toolsDealt = core.playerIds.some((id) => core.players[id].toolCards.length > 0);
    const activeToolLabels = localPlayer.activeTools.map((tool) => THE_GANG_TOOLS[tool].label);

    return (
        <div
            className="absolute bottom-20 left-2 z-30 w-[18rem] max-w-[32vw] rounded-xl border border-amber-200/24 bg-emerald-950/88 p-2 text-[0.62rem] font-black text-amber-50/94 shadow-[0_0.5rem_1.6rem_rgba(0,0,0,0.35)] backdrop-blur-sm lg:bottom-24 lg:left-4 lg:w-[22rem] lg:text-xs"
            data-bgg-zone="tools-panel"
            data-testid="the-gang-tools-panel"
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                    <div className="text-[0.58rem] uppercase tracking-[0.18em] text-amber-200/62">{t('board.toolsPanel')}</div>
                    <div className="text-amber-100">{t('board.toolDeck', { count: core.toolDeck.length })}</div>
                </div>
                <button
                    type="button"
                    disabled={toolsDealt || core.toolDeck.length < core.playerIds.length}
                    onClick={onDealTools}
                    className="rounded-full border border-amber-200/55 bg-amber-300 px-2.5 py-1 text-[0.62rem] font-black text-emerald-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:border-stone-600/70 disabled:bg-stone-700/75 disabled:text-stone-400"
                >
                    {t('board.dealTools')}
                </button>
            </div>
            <div className="mb-2 rounded-md bg-black/18 px-2 py-1 text-amber-100">
                {activeToolLabels.length > 0
                    ? t('board.activeTools', { tools: activeToolLabels.join(' / ') })
                    : t('board.noActiveTools')}
            </div>
            <div className="max-h-[15rem] overflow-y-auto pr-1 lg:max-h-[19rem]">
                <div className="mb-2 grid grid-cols-2 gap-1.5" data-testid="the-gang-local-tools">
                    {localPlayer.toolCards.length > 0
                        ? localPlayer.toolCards.map((tool, index) => (
                            <ToolCardBadge
                                key={`${tool}-${index}`}
                                tool={tool}
                                active={localPlayer.activeTools.includes(tool)}
                                onUse={onUseTool}
                            />
                        ))
                        : (
                            <span className="col-span-2 rounded-md border border-amber-200/18 bg-black/16 px-2 py-3 text-center text-amber-100/72">
                                {t('board.noTools')}
                            </span>
                        )}
                </div>
                <div data-testid="the-gang-local-specialists">
                    <div className="mb-1 text-[0.58rem] uppercase tracking-[0.18em] text-sky-100/72">
                        {t('board.specialistZone')}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {localPlayer.specialistCards.length > 0
                            ? localPlayer.specialistCards.map((specialist, index) => (
                                <SpecialistCardBadge key={`${specialist}-${index}`} specialist={specialist} />
                            ))
                            : (
                                <span className="col-span-2 rounded-md border border-sky-200/18 bg-black/16 px-2 py-3 text-center text-sky-100/72">
                                    {t('board.noSpecialists')}
                                </span>
                            )}
                    </div>
                </div>
            </div>
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
                                    <span className="text-xs font-black tracking-[0.08em] text-amber-100 md:text-sm">{result.strength.label}</span>
                                </div>
                            </div>
                            <div
                                className="flex justify-center gap-2 overflow-visible md:gap-3"
                                data-bgg-zone="reveal-pocket-cards"
                                aria-label={`${playerName(result.playerId)} ${result.strength.label}`}
                            >
                                {result.pocketCards.map((card, index) => (
                                    <CardFace
                                key={`${result.playerId}-${card.rank}-${card.suit}-${index}`}
                                card={card}
                                emphasis="showdown"
                                        revealOrder={(playerResultIndex.get(result.playerId) ?? 0) * 2 + index}
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
    const allPlayersHaveChip = core.playerIds.every((id) => core.currentRoundChips[id] !== undefined);
    const nextRoundProgress = getProgressButtonState(core, 'end-round', localPlayerId, t('board.nextRound'), t);
    const revealShowdownProgress = getProgressButtonState(core, 'reveal-showdown', localPlayerId, t('board.revealShowdown'), t);
    const nextHeistProgress = getProgressButtonState(core, 'start-next-heist', localPlayerId, t('board.nextHeist'), t);
    const chipValues = Array.from({ length: core.playerIds.length }, (_, index) => index + 1);
    const ownerByChip = Object.fromEntries(
        Object.entries(core.currentRoundChips).map(([owner, chip]) => [chip, owner]),
    ) as Record<number, string | undefined>;
    const rulesLocked = core.heistNumber !== 1
        || core.round !== 1
        || core.phase !== 'chip-selection'
        || Object.keys(core.currentRoundChips).length > 0
        || core.roundHistory.length > 0;
    const handRankRules = isChallengeActive(core.rules.config, 'grinding-gears') || isChallengeActive(core.rules.config, 'the-joker') || isChallengeActive(core.rules.config, 'master-key')
        ? THE_GANG_EXPANDED_HAND_RANK_RULES
        : TEXAS_HOLDEM_HAND_RANK_RULES;

    const playerNames = buildPlayerDisplayNameMap(
        core.playerIds,
        matchData,
        (id) => t('board.playerFallback', { player: Number(id) + 1 }),
    );
    const playerName = (id: string) => playerNames[id] ?? t('board.playerFallback', { player: Number(id) + 1 });

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

    const setRulesConfig = (config: TheGangRulesConfig) => {
        dispatchForPlayer(THE_GANG_COMMANDS.SET_RULES_CONFIG, { config });
    };

    const dealTools = () => {
        dispatchForPlayer(THE_GANG_COMMANDS.DEAL_TOOLS, {});
    };

    const useTool = (tool: TheGangToolId) => {
        dispatchForPlayer(THE_GANG_COMMANDS.USE_TOOL, {
            tool,
            ...(tool === 'night-vision-goggles' ? { cardIndex: 0 } : {}),
        });
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
                        className="flex shrink-0 justify-evenly gap-3 overflow-visible lg:gap-6"
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
                                        localPlayerId={localPlayerId}
                                        onTakeCurrentChip={core.phase === 'chip-selection' ? takeChip : undefined}
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
                        className="relative z-20 flex min-h-0 flex-[0.82] items-center justify-center overflow-visible"
                        data-tutorial-id="the-gang-round-panel"
                        data-bgg-zone="middle-zone"
                    >
                        <div className="relative z-20 flex min-h-0 flex-col items-center gap-3 overflow-visible lg:gap-6" data-bgg-zone="middle-center">
                            <div
                                className="relative z-30 flex w-full max-w-[29rem] flex-wrap items-center justify-center gap-3 overflow-visible lg:max-w-[44rem] lg:gap-5"
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

                    <section className="relative z-40 flex shrink-0 items-end justify-center overflow-visible pb-1 lg:pb-2" data-bgg-zone="bottom-zone">
                        <VaultsAlarmsZone successes={core.successes} failures={core.failures} />
                        <HandRankReference rules={handRankRules} />
                        <RulesConfigPanel
                            config={core.rules.config}
                            locked={rulesLocked}
                            canConfigure={localPlayerId === core.playerIds[0]}
                            onChange={setRulesConfig}
                        />
                        <ToolsPanel
                            core={core}
                            localPlayerId={localPlayerId}
                            onDealTools={dealTools}
                            onUseTool={useTool}
                        />

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

                        <div className="absolute bottom-1 right-24 flex min-w-[7rem] flex-col items-center gap-1 lg:bottom-2 lg:right-28" data-bgg-zone="action-dock">
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
