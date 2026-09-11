/**
 * 状态选择交互覆盖层
 * 用于状态效果选择、玩家选择等交互
 * 
 * 已适配新的 InteractionSystem（从 sys.interaction.current 读取）
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import type { AbilityCard, InteractionDescriptor, HeroState } from '../domain/types';
import type { TokenDef } from '../domain/tokenTypes';
import type { PlayerId } from '../../../engine/types';
import { UI_Z_INDEX } from '../../../core';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { SelectableEffectsContainer, type StatusAtlases } from './statusEffects';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';
import { getDiceThroneCardPreviewRef } from './cardPreviewHelper';

type TeamTone = 'self' | 'ally' | 'enemy';

const CARD_POOL_CARD_WIDTH = 'clamp(88px, min(7.2vw, 12.5vh), 132px)';
const CARD_POOL_CARD_MAX_WIDTH_PX = 132;
const CARD_POOL_PANEL_MAX_WIDTH_PX = 1120;
const CARD_POOL_PANEL_SAFE_PADDING_PX = 96;
const CARD_POOL_GRID_GAP_PX = 16;

const normalizeCardPoolSearchText = (value: unknown): string => (
    String(value ?? '')
        .normalize('NFKC')
        .trim()
        .toLocaleLowerCase()
);

const getCardPoolViewportWidth = (): number => {
    if (typeof window === 'undefined') return 1024;
    return Math.max(320, window.innerWidth);
};

const getCardPoolSingleRowCapacity = (): number => {
    const viewportWidth = getCardPoolViewportWidth();
    const panelWidth = Math.min(CARD_POOL_PANEL_MAX_WIDTH_PX, viewportWidth - 32);
    const usableWidth = Math.max(CARD_POOL_CARD_MAX_WIDTH_PX, panelWidth - CARD_POOL_PANEL_SAFE_PADDING_PX);
    return Math.max(1, Math.floor((usableWidth + CARD_POOL_GRID_GAP_PX) / (CARD_POOL_CARD_MAX_WIDTH_PX + CARD_POOL_GRID_GAP_PX)));
};

interface ToneClasses {
    idleBorderClassName: string;
    passiveBorderClassName: string;
    titleClassName: string;
    badgeClassName: string;
}

const PlayerCardShell = ({
    testId,
    playerId,
    teamTone,
    titleClassName,
    badgeClassName,
    displayName,
    relationLabel,
    seatLabel,
    containerClassName,
    onClick,
    locked,
    selected,
    footer,
    children,
}: {
    testId: string;
    playerId: PlayerId;
    teamTone: TeamTone;
    titleClassName: string;
    badgeClassName: string;
    displayName: string;
    relationLabel: string;
    seatLabel: string;
    containerClassName: string;
    onClick?: () => void;
    locked?: boolean;
    selected?: boolean;
    footer?: React.ReactNode;
    children: React.ReactNode;
}) => (
    <div
        onClick={onClick}
        data-testid={testId}
        data-player-id={playerId}
        data-team-tone={teamTone}
        data-locked={locked ? 'true' : 'false'}
        data-selected={selected ? 'true' : 'false'}
        className={containerClassName}
    >
        <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className={`font-bold text-lg leading-tight ${titleClassName}`}>
                    {displayName}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {relationLabel}
                </div>
            </div>
            <div className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
                {seatLabel}
            </div>
        </div>
        {children}
        {footer ? (
            <div className="mt-3 text-center text-xs font-semibold tracking-[0.18em] uppercase text-slate-300/85">
                {footer}
            </div>
        ) : null}
    </div>
);

export interface InteractionOverlayProps {
    /** 当前交互（从 sys.interaction.current 获取） */
    interaction: InteractionDescriptor;
    /** 所有玩家状态 */
    players: Record<PlayerId, HeroState>;
    /** 状态 / token 定义，用于过滤不可移除效果 */
    tokenDefinitions?: TokenDef[];
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 玩家显示名 */
    playerNames?: Record<PlayerId, string>;
    /** 当前 4 人站位顺序 */
    seatingOrder?: PlayerId[];
    /** 队伍映射（4 人 / 2v2 用于区分友敌） */
    teamIdByPlayerId?: Record<PlayerId, string>;
    /** 选择状态效果回调 */
    onSelectStatus: (playerId: PlayerId, statusId: string) => void;
    /** 选择玩家回调 */
    onSelectPlayer: (playerId: PlayerId) => void;
    /** 选择手牌回调 */
    onSelectHandCard?: (cardId: string) => void;
    /** 确认交互 */
    onConfirm: () => void;
    /** 取消交互 */
    onCancel: () => void;
    /** 状态图标图集 */
    statusIconAtlas?: StatusAtlases | null;
    /** 语言 */
    locale?: string;
}

export const InteractionOverlay: React.FC<InteractionOverlayProps> = ({
    interaction,
    players,
    tokenDefinitions,
    currentPlayerId,
    playerNames,
    seatingOrder,
    teamIdByPlayerId,
    onSelectStatus,
    onSelectPlayer,
    onSelectHandCard = () => undefined,
    onConfirm,
    onCancel,
    statusIconAtlas,
    locale,
}) => {
    const { t, i18n } = useTranslation('game-dicethrone');
    const interactionType = interaction.type;
    const selectedItems = interaction.selected ?? [];
    const targetPlayerIds = interaction.targetPlayerIds ?? Object.keys(players);
    const isRemovableEffect = React.useCallback((effectId: string) => {
        const definition = tokenDefinitions?.find(def => def.id === effectId);
        return definition?.passiveTrigger?.removable ?? true;
    }, [tokenDefinitions]);
    const getRemovableEntries = React.useCallback((entries: Record<string, number> | undefined) => {
        return Object.fromEntries(
            Object.entries(entries ?? {}).filter(([effectId, stacks]) => stacks > 0 && isRemovableEffect(effectId)),
        );
    }, [isRemovableEffect]);

    // 状态效果选择模式
    const isStatusSelection = interactionType === 'selectStatus' || interactionType === 'selectTargetStatus';
    // 玩家选择模式（选择目标玩家：授予 token / 移除所有状态等）
    const isPlayerSelection = interactionType === 'selectPlayer';
    // 卡牌选择模式（由持有者从手牌或抽牌堆自行选择）
    const isHandCardSelection = interactionType === 'selectHandCard';
    const isDeckCardSelection = interactionType === 'selectDeckCard';
    const isCardSelection = isHandCardSelection || isDeckCardSelection;
    // 转移模式的第二阶段：选择目标玩家
    const isTransferTargetSelection = interactionType === 'selectTargetStatus' && interaction.transferConfig?.statusId;
    const shouldRenderStatusOwners = isStatusSelection && !isTransferTargetSelection;

    // 获取已选择的状态信息（用于显示）
    const selectedStatusId = isStatusSelection ? selectedItems[0] : undefined;

    // 是否要求目标已有状态（如"移除所有状态"），默认不要求
    const requiresTargetWithStatus = interaction.requiresTargetWithStatus ?? false;

    // 检查是否有任何玩家有可移除的状态
    const playersWithStatus = targetPlayerIds.filter(pid => {
        const p = players[pid];
        if (!p) return false;
        const hasEffects = Object.keys(getRemovableEntries(p.statusEffects)).length > 0;
        const hasTokens = Object.keys(getRemovableEntries(p.tokens)).length > 0;
        return hasEffects || hasTokens;
    });

    const currentTeamId = teamIdByPlayerId?.[currentPlayerId];
    const fallbackSeatOrder = React.useMemo(() => Object.keys(players) as PlayerId[], [players]);
    const resolvedSeatingOrder = seatingOrder && seatingOrder.length > 0 ? seatingOrder : fallbackSeatOrder;

    const getPlayerMeta = React.useCallback((pid: PlayerId) => {
        const isSelf = pid === currentPlayerId;
        const isAlly = !isSelf && !!currentTeamId && teamIdByPlayerId?.[pid] === currentTeamId;
        const teamTone = isSelf ? 'self' : isAlly ? 'ally' : 'enemy';
        const seatIndex = resolvedSeatingOrder.indexOf(pid);
        const seatNumber = seatIndex >= 0 ? seatIndex + 1 : Number.parseInt(String(pid), 10) + 1;
        const seatLabel = Number.isFinite(seatNumber) ? `P${seatNumber}` : `P${String(pid)}`;
        const displayName = playerNames?.[pid] || (isSelf ? t('common.self') : t('common.opponent'));
        const relationLabel = isSelf ? t('common.self') : isAlly ? t('common.ally') : t('common.enemy');
        return { isSelf, isAlly, teamTone, seatLabel, displayName, relationLabel };
    }, [currentPlayerId, currentTeamId, playerNames, resolvedSeatingOrder, t, teamIdByPlayerId]);

    const getToneClasses = React.useCallback((teamTone: TeamTone): ToneClasses => {
        if (teamTone === 'self') {
            return {
                idleBorderClassName: 'border-cyan-500/60 bg-cyan-950/20 hover:border-cyan-400',
                passiveBorderClassName: 'border-cyan-500/60 bg-cyan-950/20',
                titleClassName: 'text-cyan-300',
                badgeClassName: 'border-cyan-400/60 text-cyan-200 bg-cyan-950/50',
            };
        }
        if (teamTone === 'ally') {
            return {
                idleBorderClassName: 'border-emerald-500/60 bg-emerald-950/20 hover:border-emerald-400',
                passiveBorderClassName: 'border-emerald-500/60 bg-emerald-950/20',
                titleClassName: 'text-emerald-300',
                badgeClassName: 'border-emerald-400/60 text-emerald-200 bg-emerald-950/50',
            };
        }
        return {
            idleBorderClassName: 'border-rose-500/60 bg-slate-800/50 hover:border-rose-400',
            passiveBorderClassName: 'border-rose-500/60 bg-slate-800/50',
            titleClassName: 'text-rose-300',
            badgeClassName: 'border-rose-400/60 text-rose-200 bg-rose-950/50',
        };
    }, []);

    const transferSourceCard = React.useMemo(() => {
        if (!isTransferTargetSelection) return null;
        const sourcePlayerId = interaction.transferConfig?.sourcePlayerId;
        const statusId = interaction.transferConfig?.statusId;
        if (!sourcePlayerId || !statusId) return null;

        const sourcePlayer = players[sourcePlayerId];
        if (!sourcePlayer) return null;

        const effectStacks = sourcePlayer.statusEffects?.[statusId] ?? 0;
        const tokenStacks = sourcePlayer.tokens?.[statusId] ?? 0;
        return {
            playerId: sourcePlayerId,
            statusId,
            characterId: sourcePlayer.characterId,
            effects: effectStacks > 0 ? { [statusId]: effectStacks } : {},
            tokens: tokenStacks > 0 ? { [statusId]: tokenStacks } : {},
        };
    }, [interaction.transferConfig?.sourcePlayerId, interaction.transferConfig?.statusId, isTransferTargetSelection, players]);

    const minSelectCount = interaction.minSelectCount ?? (
        isPlayerSelection || isHandCardSelection || isTransferTargetSelection ? 1 : interaction.selectCount
    );
    const canConfirm = selectedItems.length >= minSelectCount;
    const [cardPoolSearch, setCardPoolSearch] = React.useState('');
    const cardSelectionCards = React.useMemo(() => {
        if (!isCardSelection) return [] as AbilityCard[];
        return (isDeckCardSelection
            ? players[interaction.playerId]?.deck
            : players[interaction.playerId]?.hand) ?? [];
    }, [interaction.playerId, isCardSelection, isDeckCardSelection, players]);
    const cardPoolSearchSignature = React.useMemo(() => (
        [
            interaction.id,
            interaction.playerId,
            interactionType,
            cardSelectionCards.map(card => card.id).join('|'),
        ].join('::')
    ), [cardSelectionCards, interaction.id, interaction.playerId, interactionType]);

    React.useEffect(() => {
        setCardPoolSearch('');
    }, [cardPoolSearchSignature]);

    const resolveCardName = React.useCallback((card: AbilityCard): string => {
        const rawCardName = card.i18n?.[locale ?? 'zh-CN']?.name
            ?? card.i18n?.['zh-CN']?.name
            ?? card.name
            ?? card.id;
        if (
            typeof rawCardName === 'string'
            && rawCardName.startsWith('cards.')
            && i18n.exists(rawCardName, { ns: 'game-dicethrone' })
        ) {
            return t(rawCardName);
        }
        return String(rawCardName);
    }, [i18n, locale, t]);

    const normalizedCardPoolSearch = normalizeCardPoolSearchText(cardPoolSearch);
    const shouldShowCardPoolSearch = cardSelectionCards.length > getCardPoolSingleRowCapacity();
    const visibleCardSelectionCards = React.useMemo(() => {
        if (!shouldShowCardPoolSearch || normalizedCardPoolSearch.length === 0) {
            return cardSelectionCards;
        }

        return cardSelectionCards.filter((card) => {
            const localizedNames = Object.values(card.i18n ?? {})
                .flatMap(entry => [entry.name, entry.description]);
            const haystack = [
                resolveCardName(card),
                card.name,
                card.description,
                card.id,
                card.type,
                card.timing,
                card.cpCost,
                ...localizedNames,
            ].map(normalizeCardPoolSearchText).join(' ');
            return haystack.includes(normalizedCardPoolSearch);
        });
    }, [cardSelectionCards, normalizedCardPoolSearch, resolveCardName, shouldShowCardPoolSearch]);

    // Derived presence
    const isOpen = true; // Controlled by BoardOverlays

    if (isCardSelection) {
        const cardPoolCardStyle: React.CSSProperties = {
            backgroundColor: '#0f172a',
            borderRadius: '0.25rem',
            width: CARD_POOL_CARD_WIDTH,
        };

        return (
            <div
                data-testid="dt-card-pool-overlay"
                data-card-pool-layout="center-stage"
                data-card-pool-hand-protection="preserve-visible-hand"
                data-card-pool-browse-mode="grid-scroll"
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: UI_Z_INDEX.overlay }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    data-testid="dt-card-pool-panel"
                    className="pointer-events-auto absolute inset-x-0 top-[clamp(4.25rem,9vh,6.25rem)] px-4"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
                >
                    <div
                        data-testid="dt-card-pool-surface"
                        className="relative isolate mx-auto w-full max-w-[70rem] px-3 py-3"
                    >
                        <div
                            aria-hidden="true"
                            data-testid="dt-card-pool-backdrop"
                            className="pointer-events-none absolute inset-x-[2%] inset-y-0 -z-10 border-y border-red-300/20 bg-[linear-gradient(90deg,transparent_0%,rgba(10,3,7,0.82)_12%,rgba(24,4,11,0.94)_50%,rgba(10,3,7,0.82)_88%,transparent_100%)] shadow-[0_18px_42px_rgba(0,0,0,0.34)] backdrop-blur-[1px]"
                        />
                        <h2
                            data-testid="dt-card-pool-title"
                            className="mb-2 text-center text-base font-black uppercase tracking-[0.12em] text-amber-100 drop-shadow-[0_2px_9px_rgba(127,29,29,0.78)] sm:text-lg"
                        >
                            {t(interaction.titleKey, { count: interaction.selectCount })}
                        </h2>
                        {shouldShowCardPoolSearch ? (
                            <div
                                data-testid="dt-card-pool-search"
                                className="mx-auto mb-1 max-w-[min(100%,30rem)]"
                            >
                                <div className="relative">
                                    <span
                                        data-testid="dt-card-pool-search-leading-icon"
                                        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-red-100/70"
                                    >
                                        <Search className="h-4 w-4" strokeWidth={2.1} />
                                    </span>
                                    <input
                                        type="search"
                                        value={cardPoolSearch}
                                        onChange={(event) => setCardPoolSearch(event.target.value)}
                                        placeholder={t('interaction.cardPoolSearchPlaceholder')}
                                        data-testid="dt-card-pool-search-input"
                                        className="h-9 w-full rounded-full border border-red-200/25 bg-[#1a0509]/72 pl-10 pr-10 text-sm font-bold text-amber-50 outline-none placeholder:text-red-100/38 focus:border-red-200/60 focus:ring-2 focus:ring-red-300/20"
                                    />
                                    {normalizedCardPoolSearch.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => setCardPoolSearch('')}
                                            data-testid="dt-card-pool-search-clear"
                                            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-red-100/10 text-amber-50 transition-colors hover:bg-red-100/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                                            aria-label={t('interaction.cardPoolSearchClear')}
                                        >
                                            <X size={14} strokeWidth={2.2} />
                                        </button>
                                    ) : null}
                                </div>
                                <div
                                    data-testid="dt-card-pool-result-count"
                                    className="mt-1.5 text-center text-[11px] font-bold tracking-[0.08em] text-amber-100/68"
                                >
                                    {t('interaction.cardPoolFilterResultCount', {
                                        visible: visibleCardSelectionCards.length,
                                        total: cardSelectionCards.length,
                                    })}
                                </div>
                            </div>
                        ) : null}
                        <div
                            data-testid="dt-card-pool-selection"
                            data-card-pool-kind={isDeckCardSelection ? 'deck' : 'hand'}
                            className="scrollbar-thin mx-auto max-h-[min(34vh,22rem)] w-full overflow-y-auto overflow-x-hidden px-1 py-3 [scrollbar-color:rgba(248,113,113,0.42)_transparent]"
                        >
                            <div
                                data-testid="dt-card-pool-track"
                                className="mx-auto flex min-w-full flex-wrap items-start justify-center gap-[clamp(0.65rem,1vw,1rem)] px-3"
                            >
                                {visibleCardSelectionCards.length === 0 ? (
                                    <div
                                        data-testid="dt-card-pool-empty"
                                        className="flex min-h-[9rem] min-w-[min(22rem,76vw)] items-center justify-center rounded-[0.35rem] border border-dashed border-red-200/22 bg-[#120407]/58 px-6 text-center text-sm font-bold tracking-[0.08em] text-amber-100/72"
                                    >
                                        {t('interaction.cardPoolSearchEmpty')}
                                    </div>
                                ) : visibleCardSelectionCards.map(card => {
                                    const ownerCharacterId = players[interaction.playerId]?.characterId;
                                    const previewRef = card.previewRef ?? getDiceThroneCardPreviewRef(card.id, ownerCharacterId);
                                    const cardName = resolveCardName(card);
                                    const isSelected = selectedItems.includes(card.id);
                                    return (
                                        <button
                                            key={card.id}
                                            type="button"
                                            data-testid={`dt-${isDeckCardSelection ? 'deck' : 'hand'}-card-option-${card.id}`}
                                            data-selected={isSelected ? 'true' : 'false'}
                                            data-card-pool-mode="preview"
                                            data-card-preview-ready={previewRef ? 'true' : 'false'}
                                            aria-label={`${cardName} ${card.type} ${card.cpCost} CP`}
                                            aria-pressed={isSelected}
                                            onClick={() => onSelectHandCard(card.id)}
                                            className={`
                                                group relative flex flex-shrink-0 cursor-pointer flex-col items-center border-0 bg-transparent p-0 text-left transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200
                                                ${isSelected ? '-translate-y-2 z-10' : 'hover:-translate-y-1 hover:z-10'}
                                            `}
                                        >
                                            <div
                                                data-testid={`dt-card-choice-preview-${card.id}`}
                                                className={`
                                                    overflow-hidden rounded-[0.3rem] transition-[box-shadow,filter] duration-200
                                                    ${isSelected
                                                        ? 'ring-2 ring-amber-200 shadow-[0_0_0_1px_rgba(127,29,29,0.86),0_0_24px_rgba(248,113,113,0.52),0_14px_24px_rgba(0,0,0,0.48)]'
                                                        : 'shadow-[0_12px_22px_rgba(0,0,0,0.42)] group-hover:ring-1 group-hover:ring-red-200/75 group-hover:shadow-[0_0_16px_rgba(185,28,28,0.42),0_14px_24px_rgba(0,0,0,0.46)]'}
                                                `}
                                            >
                                                <CardPreview
                                                    previewRef={previewRef}
                                                    locale={locale}
                                                    className="rounded-[0.3rem] bg-[#150609]"
                                                    style={cardPoolCardStyle}
                                                    alt={cardName}
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div
                            data-testid="dt-card-pool-actions"
                            className="mt-2 flex items-center justify-center gap-3"
                        >
                            <GameButton
                                onClick={onCancel}
                                variant="secondary"
                                size="sm"
                            >
                                {t('common.cancel')}
                            </GameButton>
                            <GameButton
                                onClick={onConfirm}
                                disabled={!canConfirm}
                                variant="primary"
                                size="sm"
                            >
                                {t('common.confirm')}
                            </GameButton>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <GameModal
            isOpen={isOpen}
            title={
                <div>
                    <div>{t(interaction.titleKey, { count: interaction.selectCount })}</div>
                    {interaction.transferConfig?.statusId && (
                        <div className="text-slate-400 text-sm mt-1 font-normal normal-case">
                            {t('interaction.transferSelectTarget')}
                        </div>
                    )}
                </div>
            }
            width="xl"
            closeOnBackdrop={false} // Force interaction
            footer={
                <>
                    <GameButton
                        onClick={onCancel}
                        variant="secondary"
                        className="px-8 -translate-y-0.5 shadow-[0_6px_0_#334155] active:translate-y-[3px] active:shadow-[0_2px_0_#334155]"
                    >
                        {t('common.cancel')}
                    </GameButton>
                    <GameButton
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        variant="primary"
                        className="px-8 -translate-y-0.5 shadow-[0_6px_0_#b45309] active:translate-y-[3px] active:shadow-[0_2px_0_#b45309]"
                    >
                        {t('common.confirm')}
                    </GameButton>
                </>
            }
        >
            <div className="flex flex-col w-full p-2">
                {/* 玩家选择区域 */}
                {(shouldRenderStatusOwners || isPlayerSelection) && (
                    <div className="flex flex-wrap gap-4 justify-center">
                        {targetPlayerIds.map(pid => {
                            const player = players[pid];
                            if (!player) return null;

                            const { teamTone, seatLabel, displayName, relationLabel } = getPlayerMeta(pid);
                            const { idleBorderClassName, passiveBorderClassName, titleClassName, badgeClassName } = getToneClasses(teamTone);
                            const hasStatus = playersWithStatus.includes(pid);
                            const isSelected = selectedItems.includes(pid);

                            // 玩家选择模式
                            if (isPlayerSelection) {
                                // 不要求目标有状态时，所有玩家都可选
                                const canSelect = requiresTargetWithStatus ? hasStatus : true;
                                return (
                                    <PlayerCardShell
                                        key={pid}
                                        testId={`dt-player-target-${pid}`}
                                        playerId={pid}
                                        teamTone={teamTone}
                                        titleClassName={titleClassName}
                                        badgeClassName={badgeClassName}
                                        displayName={displayName}
                                        relationLabel={relationLabel}
                                        seatLabel={seatLabel}
                                        onClick={canSelect ? () => onSelectPlayer(pid) : undefined}
                                        containerClassName={`
                                            p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
                                            ${canSelect ? 'cursor-pointer hover:scale-[1.03]' : 'opacity-50 cursor-not-allowed'}
                                            ${isSelected
                                                ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-300/80'
                                                : canSelect
                                                    ? idleBorderClassName
                                                    : 'border-slate-700 bg-slate-800/30'}
                                        `}
                                    >
                                        {/* 显示玩家的状态效果（仅供参考） */}
                                        <SelectableEffectsContainer
                                            effects={requiresTargetWithStatus ? getRemovableEntries(player.statusEffects) : (player.statusEffects ?? {})}
                                            tokens={requiresTargetWithStatus ? getRemovableEntries(player.tokens) : player.tokens}
                                            highlightAll={false}
                                            getItemTestId={(statusId) => `dt-status-effect-${pid}-${statusId}`}
                                            size="small"
                                            className="justify-center"
                                            locale={locale}
                                            atlas={statusIconAtlas}
                                            characterId={player.characterId}
                                        />
                                        {!hasStatus && requiresTargetWithStatus && (
                                            <div className="text-slate-500 text-sm text-center mt-2">
                                                {t('interaction.noStatus')}
                                            </div>
                                        )}
                                    </PlayerCardShell>
                                );
                            }

                            // 状态效果选择模式
                            return (
                                <PlayerCardShell
                                    key={pid}
                                    testId={`dt-status-owner-${pid}`}
                                    playerId={pid}
                                    teamTone={teamTone}
                                    titleClassName={titleClassName}
                                    badgeClassName={badgeClassName}
                                    displayName={displayName}
                                    relationLabel={relationLabel}
                                    seatLabel={seatLabel}
                                    containerClassName={`
                                        p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
                                        ${hasStatus
                                            ? passiveBorderClassName
                                            : 'border-slate-700 bg-slate-800/30 opacity-50'}
                                    `}
                                >
                                    {hasStatus ? (
                                        <SelectableEffectsContainer
                                            effects={getRemovableEntries(player.statusEffects)}
                                            tokens={getRemovableEntries(player.tokens)}
                                            selectedId={selectedStatusId}
                                            highlightAll={true}
                                            onSelectEffect={(statusId) => onSelectStatus(pid, statusId)}
                                            getItemTestId={(statusId) => `dt-status-effect-${pid}-${statusId}`}
                                            size="normal"
                                            className="justify-center"
                                            locale={locale}
                                            atlas={statusIconAtlas}
                                            characterId={player.characterId}
                                        />
                                    ) : (
                                        <div className="text-slate-500 text-sm text-center">
                                            {t('interaction.noStatus')}
                                        </div>
                                    )}
                                </PlayerCardShell>
                            );
                        })}
                    </div>
                )}

                {/* 转移目标选择（第二阶段） */}
                {isTransferTargetSelection && (
                    <div className="flex flex-wrap gap-4 justify-center">
                        {targetPlayerIds.map(pid => {
                            const player = players[pid];
                            if (!player) return null;

                            const isSourcePlayer = pid === interaction.transferConfig?.sourcePlayerId;
                            const { teamTone, seatLabel, displayName, relationLabel } = getPlayerMeta(pid);
                            const { idleBorderClassName, passiveBorderClassName, titleClassName, badgeClassName } = getToneClasses(teamTone);
                            const isSelected = selectedItems.includes(pid);
                            const canSelect = !isSourcePlayer;

                            return (
                                <PlayerCardShell
                                    key={pid}
                                    testId={isSourcePlayer ? `dt-transfer-source-locked-${pid}` : `dt-transfer-target-${pid}`}
                                    playerId={pid}
                                    teamTone={teamTone}
                                    titleClassName={titleClassName}
                                    badgeClassName={badgeClassName}
                                    displayName={displayName}
                                    relationLabel={isSourcePlayer ? `${relationLabel} / 已选来源` : relationLabel}
                                    seatLabel={seatLabel}
                                    onClick={canSelect ? () => onSelectPlayer(pid) : undefined}
                                    locked={isSourcePlayer}
                                    selected={isSelected}
                                    footer={
                                        isSourcePlayer
                                            ? '已选来源'
                                            : isSelected
                                                ? '已选目标'
                                                : '点击作为接收目标'
                                    }
                                    containerClassName={`
                                        p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
                                        ${canSelect ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-not-allowed opacity-75'}
                                        ${isSourcePlayer
                                            ? `${passiveBorderClassName} ring-2 ring-white/10`
                                            : isSelected
                                                ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-300/80'
                                                : idleBorderClassName}
                                    `}
                                >
                                    {isSourcePlayer && transferSourceCard ? (
                                        Object.keys(transferSourceCard.effects).length > 0 || Object.keys(transferSourceCard.tokens).length > 0 ? (
                                            <SelectableEffectsContainer
                                                effects={transferSourceCard.effects}
                                                tokens={transferSourceCard.tokens}
                                                highlightAll={false}
                                                selectedId={transferSourceCard.statusId}
                                                getItemTestId={(statusId) => `dt-transfer-source-effect-${statusId}`}
                                                size="normal"
                                                className="justify-center"
                                                locale={locale}
                                                atlas={statusIconAtlas}
                                                characterId={transferSourceCard.characterId}
                                            />
                                        ) : (
                                            <div className="text-sm text-slate-400">
                                                {transferSourceCard.statusId}
                                            </div>
                                        )
                                    ) : (
                                        <div className={`${canSelect ? '' : passiveBorderClassName} rounded-lg`}>
                                            <SelectableEffectsContainer
                                                effects={player.statusEffects ?? {}}
                                                tokens={player.tokens}
                                                highlightAll={false}
                                                size="normal"
                                                className="justify-center"
                                                locale={locale}
                                                atlas={statusIconAtlas}
                                                characterId={player.characterId}
                                            />
                                        </div>
                                    )}
                                </PlayerCardShell>
                            );
                        })}
                    </div>
                )}

            </div>
        </GameModal>
    );
};
