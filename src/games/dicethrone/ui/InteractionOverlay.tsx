/**
 * 状态选择交互覆盖层
 * 用于状态效果选择、玩家选择等交互
 * 
 * 已适配新的 InteractionSystem（从 sys.interaction.current 读取）
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { InteractionDescriptor, HeroState } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import { SelectableEffectsContainer, type StatusAtlases } from './statusEffects';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';

export interface InteractionOverlayProps {
    /** 当前交互（从 sys.interaction.current 获取） */
    interaction: InteractionDescriptor;
    /** 所有玩家状态 */
    players: Record<PlayerId, HeroState>;
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
    currentPlayerId,
    playerNames,
    seatingOrder,
    teamIdByPlayerId,
    onSelectStatus,
    onSelectPlayer,
    onConfirm,
    onCancel,
    statusIconAtlas,
    locale,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const interactionType = interaction.type;
    const selectedItems = interaction.selected ?? [];
    const targetPlayerIds = interaction.targetPlayerIds ?? Object.keys(players);

    // 状态效果选择模式
    const isStatusSelection = interactionType === 'selectStatus' || interactionType === 'selectTargetStatus';
    // 玩家选择模式（选择目标玩家：授予 token / 移除所有状态等）
    const isPlayerSelection = interactionType === 'selectPlayer';
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
        const hasEffects = Object.values(p.statusEffects ?? {}).some(v => v > 0);
        const hasTokens = Object.values(p.tokens ?? {}).some(v => v > 0);
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

    const getToneClasses = React.useCallback((teamTone: 'self' | 'ally' | 'enemy') => {
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
            effects: effectStacks > 0 ? { [statusId]: effectStacks } : {},
            tokens: tokenStacks > 0 ? { [statusId]: tokenStacks } : {},
        };
    }, [interaction.transferConfig?.sourcePlayerId, interaction.transferConfig?.statusId, isTransferTargetSelection, players]);

    const canConfirm = selectedItems.length >= interaction.selectCount
        || (isPlayerSelection && selectedItems.length > 0)
        || (isTransferTargetSelection && selectedItems.length > 0);

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
                        className="px-8"
                    >
                        {t('common.cancel')}
                    </GameButton>
                    <GameButton
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        variant="primary"
                        className="px-8"
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
                                    <div
                                        key={pid}
                                        onClick={() => canSelect && onSelectPlayer(pid)}
                                        data-testid={`dt-player-target-${pid}`}
                                        data-player-id={pid}
                                        data-team-tone={teamTone}
                                        className={`
                                            p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
                                            ${canSelect ? 'cursor-pointer hover:scale-[1.03]' : 'opacity-50 cursor-not-allowed'}
                                            ${isSelected
                                                ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-300/80'
                                                : canSelect
                                                    ? idleBorderClassName
                                                    : 'border-slate-700 bg-slate-800/30'}
                                        `}
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
                                        {/* 显示玩家的状态效果（仅供参考） */}
                                        <SelectableEffectsContainer
                                            effects={player.statusEffects ?? {}}
                                            tokens={player.tokens}
                                            highlightAll={false}
                                            getItemTestId={(statusId) => `dt-status-effect-${pid}-${statusId}`}
                                            size="small"
                                            className="justify-center"
                                            locale={locale}
                                            atlas={statusIconAtlas}
                                        />
                                        {!hasStatus && requiresTargetWithStatus && (
                                            <div className="text-slate-500 text-sm text-center mt-2">
                                                {t('interaction.noStatus')}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // 状态效果选择模式
                            return (
                                <div
                                    key={pid}
                                    data-testid={`dt-status-owner-${pid}`}
                                    data-player-id={pid}
                                    data-team-tone={teamTone}
                                    className={`
                                        p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
                                        ${hasStatus
                                            ? passiveBorderClassName
                                            : 'border-slate-700 bg-slate-800/30 opacity-50'}
                                    `}
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
                                    {hasStatus ? (
                                        <SelectableEffectsContainer
                                            effects={player.statusEffects ?? {}}
                                            tokens={player.tokens}
                                            selectedId={selectedStatusId}
                                            highlightAll={true}
                                            onSelectEffect={(statusId) => onSelectStatus(pid, statusId)}
                                            getItemTestId={(statusId) => `dt-status-effect-${pid}-${statusId}`}
                                            size="normal"
                                            className="justify-center"
                                            locale={locale}
                                            atlas={statusIconAtlas}
                                        />
                                    ) : (
                                        <div className="text-slate-500 text-sm text-center">
                                            {t('interaction.noStatus')}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 转移目标选择（第二阶段） */}
                {isTransferTargetSelection && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {targetPlayerIds.map(pid => {
                            const player = players[pid];
                            if (!player) return null;

                            const isSourcePlayer = pid === interaction.transferConfig?.sourcePlayerId;
                            const { teamTone, seatLabel, displayName, relationLabel } = getPlayerMeta(pid);
                            const { idleBorderClassName, passiveBorderClassName, titleClassName, badgeClassName } = getToneClasses(teamTone);
                            const isSelected = selectedItems.includes(pid);
                            const canSelect = !isSourcePlayer;

                            return (
                                <div
                                    key={pid}
                                    onClick={() => canSelect && onSelectPlayer(pid)}
                                    data-testid={isSourcePlayer ? `dt-transfer-source-locked-${pid}` : `dt-transfer-target-${pid}`}
                                    data-player-id={pid}
                                    data-team-tone={teamTone}
                                    data-locked={isSourcePlayer ? 'true' : 'false'}
                                    className={`
                                        p-4 rounded-xl border-2 transition-all duration-200 min-w-0
                                        ${canSelect ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-not-allowed opacity-75'}
                                        ${isSourcePlayer
                                            ? 'border-slate-500/70 bg-slate-900/80'
                                            : isSelected
                                                ? 'border-amber-400 bg-amber-950/30 ring-2 ring-amber-300/80'
                                                : idleBorderClassName}
                                    `}
                                >
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className={`font-bold text-lg leading-tight ${titleClassName}`}>
                                                {displayName}
                                            </div>
                                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                                                {isSourcePlayer ? `${relationLabel} / 已选来源` : relationLabel}
                                            </div>
                                        </div>
                                        <div className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
                                            {seatLabel}
                                        </div>
                                    </div>
                                    {isSourcePlayer && transferSourceCard ? (
                                        Object.keys(transferSourceCard.effects).length > 0 || Object.keys(transferSourceCard.tokens).length > 0 ? (
                                            <SelectableEffectsContainer
                                                effects={transferSourceCard.effects}
                                                tokens={transferSourceCard.tokens}
                                                highlightAll={false}
                                                selectedId={transferSourceCard.statusId}
                                                getItemTestId={(statusId) => `dt-transfer-source-effect-${statusId}`}
                                                size="small"
                                                className="justify-center"
                                                locale={locale}
                                                atlas={statusIconAtlas}
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
                                                size="small"
                                                className="justify-center"
                                                locale={locale}
                                                atlas={statusIconAtlas}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </GameModal>
    );
};
