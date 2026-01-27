/**
 * 卡牌交互覆盖层
 * 用于状态效果选择、玩家选择等交互
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PendingInteraction, HeroState } from '../types';
import type { PlayerId } from '../../../engine/types';
import { SelectableEffectsContainer, type StatusIconAtlasConfig } from './statusEffects';

export interface InteractionOverlayProps {
    /** 当前交互 */
    interaction: PendingInteraction;
    /** 所有玩家状态 */
    players: Record<PlayerId, HeroState>;
    /** 当前玩家 ID */
    currentPlayerId: PlayerId;
    /** 选择状态效果回调 */
    onSelectStatus: (playerId: PlayerId, statusId: string) => void;
    /** 选择玩家回调 */
    onSelectPlayer: (playerId: PlayerId) => void;
    /** 确认交互 */
    onConfirm: () => void;
    /** 取消交互 */
    onCancel: () => void;
    /** 状态图标图集 */
    statusIconAtlas?: StatusIconAtlasConfig | null;
    /** 语言 */
    locale?: string;
}

export const InteractionOverlay: React.FC<InteractionOverlayProps> = ({
    interaction,
    players,
    currentPlayerId,
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
    // 玩家选择模式（移除所有状态）
    const isPlayerSelection = interactionType === 'selectPlayer';
    // 转移模式的第二阶段：选择目标玩家
    const isTransferTargetSelection = interactionType === 'selectTargetStatus' && interaction.transferConfig?.statusId;

    // 获取已选择的状态信息（用于显示）
    const selectedStatusId = isStatusSelection ? selectedItems[0] : undefined;

    // 检查是否有任何玩家有可移除的状态
    const playersWithStatus = targetPlayerIds.filter(pid => {
        const p = players[pid];
        if (!p) return false;
        const hasEffects = Object.values(p.statusEffects ?? {}).some(v => v > 0);
        const hasTokens = Object.values(p.tokens ?? {}).some(v => v > 0);
        return hasEffects || hasTokens;
    });

    const canConfirm = selectedItems.length >= interaction.selectCount
        || (isPlayerSelection && selectedItems.length > 0)
        || (isTransferTargetSelection && selectedItems.length > 0);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-auto">
            {/* 背景遮罩 */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* 交互面板 */}
            <div className="relative bg-slate-900/95 border-2 border-amber-500 rounded-2xl p-[1.5vw] max-w-[60vw] max-h-[80vh] overflow-auto shadow-2xl">
                {/* 标题 */}
                <div className="text-center mb-[1vw]">
                    <h2 className="text-amber-300 font-bold text-[1.2vw] uppercase tracking-wider">
                        {t(interaction.titleKey, { count: interaction.selectCount })}
                    </h2>
                    {interaction.transferConfig?.statusId && (
                        <p className="text-slate-400 text-[0.8vw] mt-[0.3vw]">
                            {t('interaction.transferSelectTarget')}
                        </p>
                    )}
                </div>

                {/* 玩家选择区域 */}
                {(isStatusSelection || isPlayerSelection) && (
                    <div className="flex flex-wrap gap-[1.5vw] justify-center">
                        {targetPlayerIds.map(pid => {
                            const player = players[pid];
                            if (!player) return null;

                            const isSelf = pid === currentPlayerId;
                            const playerLabel = isSelf ? t('common.self') : t('common.opponent');
                            const hasStatus = playersWithStatus.includes(pid);
                            const isSelected = selectedItems.includes(pid);

                            // 玩家选择模式
                            if (isPlayerSelection) {
                                return (
                                    <div
                                        key={pid}
                                        onClick={() => hasStatus && onSelectPlayer(pid)}
                                        className={`
                                            p-[1vw] rounded-xl border-2 transition-all duration-200 min-w-[15vw]
                                            ${hasStatus ? 'cursor-pointer hover:scale-105' : 'opacity-50 cursor-not-allowed'}
                                            ${isSelected 
                                                ? 'border-green-500 bg-green-900/30 ring-2 ring-green-400' 
                                                : hasStatus 
                                                    ? 'border-amber-500/50 bg-slate-800/50 hover:border-amber-400' 
                                                    : 'border-slate-700 bg-slate-800/30'}
                                        `}
                                    >
                                        <div className="text-center mb-[0.5vw]">
                                            <span className={`font-bold text-[0.9vw] ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
                                                {playerLabel}
                                            </span>
                                            {isSelected && (
                                                <span className="ml-[0.5vw] text-green-400">✓</span>
                                            )}
                                        </div>
                                        {/* 显示玩家的状态效果（仅供参考） */}
                                        <SelectableEffectsContainer
                                            effects={player.statusEffects ?? {}}
                                            tokens={player.tokens}
                                            highlightAll={false}
                                            size="small"
                                            className="justify-center"
                                            locale={locale}
                                            atlas={statusIconAtlas}
                                        />
                                        {!hasStatus && (
                                            <div className="text-slate-500 text-[0.7vw] text-center mt-[0.3vw]">
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
                                    className={`
                                        p-[1vw] rounded-xl border-2 transition-all duration-200 min-w-[15vw]
                                        ${hasStatus 
                                            ? 'border-amber-500/50 bg-slate-800/50' 
                                            : 'border-slate-700 bg-slate-800/30 opacity-50'}
                                    `}
                                >
                                    <div className="text-center mb-[0.5vw]">
                                        <span className={`font-bold text-[0.9vw] ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
                                            {playerLabel}
                                        </span>
                                    </div>
                                    {hasStatus ? (
                                        <SelectableEffectsContainer
                                            effects={player.statusEffects ?? {}}
                                            tokens={player.tokens}
                                            selectedId={selectedStatusId}
                                            highlightAll={true}
                                            onSelectEffect={(statusId) => onSelectStatus(pid, statusId)}
                                            size="normal"
                                            className="justify-center"
                                            locale={locale}
                                            atlas={statusIconAtlas}
                                        />
                                    ) : (
                                        <div className="text-slate-500 text-[0.7vw] text-center">
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
                    <div className="flex flex-wrap gap-[1vw] justify-center">
                        {targetPlayerIds
                            .filter(pid => pid !== interaction.transferConfig?.sourcePlayerId)
                            .map(pid => {
                                const player = players[pid];
                                if (!player) return null;
                                const isSelf = pid === currentPlayerId;
                                const playerLabel = isSelf ? t('common.self') : t('common.opponent');
                                const isSelected = selectedItems.includes(pid);

                                return (
                                    <div
                                        key={pid}
                                        onClick={() => onSelectPlayer(pid)}
                                        className={`
                                            p-[1vw] rounded-xl border-2 cursor-pointer transition-all duration-200 min-w-[12vw]
                                            hover:scale-105
                                            ${isSelected 
                                                ? 'border-green-500 bg-green-900/30 ring-2 ring-green-400' 
                                                : 'border-amber-500/50 bg-slate-800/50 hover:border-amber-400'}
                                        `}
                                    >
                                        <div className="text-center">
                                            <span className={`font-bold text-[1vw] ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
                                                {playerLabel}
                                            </span>
                                            {isSelected && (
                                                <span className="ml-[0.5vw] text-green-400">✓</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex justify-center gap-[1vw] mt-[1.5vw]">
                    <button
                        onClick={onCancel}
                        className="px-[2vw] py-[0.6vw] rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-[0.8vw] uppercase tracking-wider transition-colors"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        className={`px-[2vw] py-[0.6vw] rounded-lg font-bold text-[0.8vw] uppercase tracking-wider transition-colors ${
                            canConfirm
                                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
