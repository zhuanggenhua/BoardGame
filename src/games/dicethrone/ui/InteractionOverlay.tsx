/**
 * 状态选择交互覆盖层
 * 用于状态效果选择、玩家选择等交互
 * 
 * 已适配新的 InteractionSystem（从 sys.interaction.current 读取）
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
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
                {(isStatusSelection || isPlayerSelection) && (
                    <div className="flex flex-wrap gap-4 justify-center">
                        {targetPlayerIds.map(pid => {
                            const player = players[pid];
                            if (!player) return null;

                            const isSelf = pid === currentPlayerId;
                            const playerLabel = isSelf ? t('common.self') : t('common.opponent');
                            const hasStatus = playersWithStatus.includes(pid);
                            const isSelected = selectedItems.includes(pid);

                            // 玩家选择模式
                            if (isPlayerSelection) {
                                // 不要求目标有状态时，所有玩家都可选
                                const canSelect = requiresTargetWithStatus ? hasStatus : true;
                                return (
                                    <div key={pid} className="relative flex items-center gap-3">
                                        <div
                                            onClick={() => canSelect && onSelectPlayer(pid)}
                                            className={`
                                                p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
                                                ${canSelect ? 'cursor-pointer hover:scale-105' : 'opacity-50 cursor-not-allowed'}
                                                ${isSelected
                                                    ? 'border-green-500 bg-green-900/30 ring-2 ring-green-400'
                                                    : canSelect
                                                        ? 'border-amber-500/50 bg-slate-800/50 hover:border-amber-400'
                                                        : 'border-slate-700 bg-slate-800/30'}
                                            `}
                                        >
                                            <div className="text-center mb-2">
                                                <div className={`font-bold text-lg ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
                                                    {playerLabel}
                                                </div>
                                                {player.nickname && (
                                                    <div className="text-slate-400 text-sm mt-1">
                                                        {player.nickname}
                                                    </div>
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
                                            {!hasStatus && requiresTargetWithStatus && (
                                                <div className="text-slate-500 text-sm text-center mt-2">
                                                    {t('interaction.noStatus')}
                                                </div>
                                            )}
                                        </div>
                                        {/* 打勾图标绝对定位在卡片右侧 */}
                                        {isSelected && (
                                            <div className="absolute -right-10 top-1/2 -translate-y-1/2">
                                                <div className="bg-green-500 rounded-full p-1">
                                                    <Check size={20} className="text-white" strokeWidth={3} />
                                                </div>
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
                                        p-4 rounded-xl border-2 transition-all duration-200 min-w-[200px]
                                        ${hasStatus
                                            ? 'border-amber-500/50 bg-slate-800/50'
                                            : 'border-slate-700 bg-slate-800/30 opacity-50'}
                                    `}
                                >
                                    <div className="text-center mb-2">
                                        <span className={`font-bold text-lg ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
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
                    <div className="flex flex-wrap gap-4 justify-center">
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
                                            p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 min-w-[150px]
                                            hover:scale-105
                                            ${isSelected
                                                ? 'border-green-500 bg-green-900/30 ring-2 ring-green-400'
                                                : 'border-amber-500/50 bg-slate-800/50 hover:border-amber-400'}
                                        `}
                                    >
                                        <div className="text-center">
                                            <span className={`font-bold text-lg ${isSelf ? 'text-cyan-400' : 'text-red-400'}`}>
                                                {playerLabel}
                                            </span>
                                            {isSelected && (
                                                <Check size={16} className="ml-2 text-green-400" strokeWidth={3} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        </GameModal>
    );
};
