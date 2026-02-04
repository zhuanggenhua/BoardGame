import React from 'react';
import { useTranslation } from 'react-i18next';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';
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
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

    // 获取玩家当前的负面状态
    const debuffs = Object.entries(playerState.statusEffects)
        .filter(([id, stacks]) => purifiableStatusIds.includes(id) && stacks > 0);

    const canConfirm = debuffs.length > 0 && selectedStatusId !== undefined;

    React.useEffect(() => {
        if (debuffs.length === 0) {
            setSelectedStatusId(undefined);
            return;
        }
        const [firstId] = debuffs[0];
        if (!selectedStatusId || !debuffs.some(([id]) => id === selectedStatusId)) {
            setSelectedStatusId(firstId);
        }
    }, [debuffs, selectedStatusId]);

    const handleConfirm = () => {
        if (!selectedStatusId) {
            setErrorMessage(t('purify.selectHint', { defaultValue: '请先选择要移除的负面状态。' }));
            return;
        }
        setErrorMessage(null);
        onConfirm(selectedStatusId);
    };

    // Derived presence since BoardOverlays conditionally renders this
    const isOpen = true;

    return (
        <GameModal
            isOpen={isOpen}
            title={t('purify.title')}
            width="md"
            closeOnBackdrop={false}
            footer={
                <>
                    <GameButton
                        onClick={onCancel}
                        variant="secondary"
                        className="flex-1"
                    >
                        {t('purify.cancel')}
                    </GameButton>
                    <GameButton
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        variant="primary"
                        className="flex-1"
                    >
                        {t('purify.confirm')}
                    </GameButton>
                </>
            }
        >
            <div className="flex flex-col gap-6 w-full items-center">
                <p className="text-sm sm:text-base text-slate-400 text-center">
                    {t('purify.desc')}
                </p>

                {/* 负面状态列表 */}
                {debuffs.length > 0 ? (
                    <div className="flex justify-center flex-wrap gap-4 py-4">
                        {debuffs.map(([statusId, stacks]) => (
                            <div
                                key={statusId}
                                className="transition-transform hover:scale-110 cursor-pointer"
                                onClick={() => {
                                    setSelectedStatusId(statusId);
                                    setErrorMessage(null);
                                }}
                            >
                                <SelectableStatusBadge
                                    effectId={statusId}
                                    stacks={stacks}
                                    isSelected={selectedStatusId === statusId}
                                    isHighlighted
                                    onSelect={() => {
                                        setSelectedStatusId(statusId);
                                        setErrorMessage(null);
                                    }}
                                    size="normal"
                                    locale={locale}
                                    atlas={statusIconAtlas}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 font-medium">
                        {t('purify.noDebuffs')}
                    </div>
                )}
                {errorMessage && (
                    <div className="text-sm text-amber-300/90">
                        {errorMessage}
                    </div>
                )}
            </div>
        </GameModal>
    );
};
