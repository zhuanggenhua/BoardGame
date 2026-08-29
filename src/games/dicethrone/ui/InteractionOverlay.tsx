/**
 * 状态选择交互覆盖层
 * 用于状态效果选择、玩家选择等交互
 * 
 * 已适配新的 InteractionSystem（从 sys.interaction.current 读取）
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { InteractionDescriptor, HeroState } from '../domain/types';
import type { TokenDef } from '../domain/tokenTypes';
import type { PlayerId } from '../../../engine/types';
import { SelectableEffectsContainer, type StatusAtlases } from './statusEffects';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';

type TeamTone = 'self' | 'ally' | 'enemy';

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
    // 手牌选择模式（由手牌持有者自行选择）
    const isHandCardSelection = interactionType === 'selectHandCard';
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

    // Derived presence
    const isOpen = true; // Controlled by BoardOverlays

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

                {/* 手牌选择区域 */}
                {isHandCardSelection && (
                    <div className="flex flex-wrap gap-3 justify-center">
                        {(players[interaction.playerId]?.hand ?? []).map(card => {
                            const rawCardName = card.i18n?.[locale ?? 'zh-CN']?.name
                                ?? card.i18n?.['zh-CN']?.name
                                ?? card.name
                                ?? card.id;
                            const cardName = typeof rawCardName === 'string'
                                && rawCardName.startsWith('cards.')
                                && i18n.exists(rawCardName, { ns: 'game-dicethrone' })
                                ? t(rawCardName)
                                : rawCardName;
                            const isSelected = selectedItems.includes(card.id);
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    data-testid={`dt-hand-card-option-${card.id}`}
                                    data-selected={isSelected ? 'true' : 'false'}
                                    onClick={() => onSelectHandCard(card.id)}
                                    className={`
                                        min-w-[180px] rounded-xl border-2 p-4 text-left transition-all duration-200
                                        ${isSelected
                                            ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-300/80'
                                            : 'border-slate-600 bg-slate-800/70 hover:border-amber-300 hover:bg-slate-700'}
                                    `}
                                >
                                    <div className="text-sm font-bold text-slate-100">{cardName}</div>
                                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                                        {card.type} · {card.cpCost} CP
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </GameModal>
    );
};
