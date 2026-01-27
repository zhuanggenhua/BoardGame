import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../../../components/common/overlays/ModalBase';
import type { HeroState } from '../domain/types';
import { SelectableStatusBadge, type StatusIconAtlasConfig } from './statusEffects';

interface PurifyModalProps {
    /** 可被净化移除的负面状态 ID 列表（由外部派生，支持扩展） */
    purifiableStatusIds: string[];
    /** 玩家状态 */
    playerState: HeroState;
    /** 确认使用净化 */
    onConfirm: (statusId: string) => void;
    /** 取消 */
    onCancel: () => void;
    /** 语言 */
    locale?: string;
    /** 状态图标图集配置 */
    statusIconAtlas?: StatusIconAtlasConfig | null;
}

/**
 * 净化 Token 使用弹窗
 * 选择要移除的负面状态
 */
export const PurifyModal: React.FC<PurifyModalProps> = ({
    playerState,
    purifiableStatusIds,
    onConfirm,
    onCancel,
    locale,
    statusIconAtlas,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [selectedStatusId, setSelectedStatusId] = React.useState<string | undefined>(undefined);

    // 获取玩家当前的负面状态
    const debuffs = Object.entries(playerState.statusEffects)
        .filter(([id, stacks]) => purifiableStatusIds.includes(id) && stacks > 0);

    const canConfirm = selectedStatusId !== undefined;

    const handleConfirm = () => {
        if (selectedStatusId) {
            onConfirm(selectedStatusId);
        }
    };

    return (
        <ModalBase
            closeOnBackdrop={false}
            overlayClassName="z-[1100] bg-black/70"
            containerClassName="z-[1101]"
        >
            <div className="bg-slate-900/95 border border-emerald-500/40 backdrop-blur-xl p-[2vw] rounded-[1.6vw] shadow-2xl w-[30vw] flex flex-col gap-[1.5vw] pointer-events-auto">
                {/* 标题 */}
                <div className="text-center">
                    <h3 className="text-[1.3vw] font-black text-white mb-[0.5vw]">
                        {t('purify.title')}
                    </h3>
                    <p className="text-[0.9vw] text-slate-400">
                        {t('purify.desc')}
                    </p>
                </div>

                {/* 负面状态列表 */}
                {debuffs.length > 0 ? (
                    <div className="flex justify-center gap-[1vw] py-[1vw]">
                        {debuffs.map(([statusId, stacks]) => (
                            <SelectableStatusBadge
                                key={statusId}
                                effectId={statusId}
                                stacks={stacks}
                                isSelected={selectedStatusId === statusId}
                                isHighlighted
                                onSelect={() => setSelectedStatusId(statusId)}
                                size="normal"
                                locale={locale}
                                atlas={statusIconAtlas}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-[2vw] text-slate-500 text-[0.9vw]">
                        {t('purify.noDebuffs')}
                    </div>
                )}

                {/* 按钮区 */}
                <div className="flex gap-[1vw]">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-[0.8vw] rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-[0.9vw] transition-colors border border-slate-600"
                    >
                        {t('purify.cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className={`flex-1 py-[0.8vw] rounded-xl font-bold text-[0.9vw] transition-colors ${
                            canConfirm
                                ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                    >
                        {t('purify.confirm')}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
};
