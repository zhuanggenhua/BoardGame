import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../../components/common/overlays/ConfirmModal';

/** DiceThrone 主题配置 */
const diceThroneTone = {
    overlay: 'bg-[#0a0a0f]/85',
    panel: 'bg-slate-900 border border-white/10 p-[2vw] rounded-[1.5vw] shadow-lg max-w-[28vw] flex flex-col items-center text-center gap-[1.5vw] pointer-events-auto',
    title: 'text-[1.3vw] font-bold text-white mb-0',
    description: 'text-[0.95vw] text-slate-300 leading-relaxed px-[0.5vw] mb-0',
    actions: 'flex gap-[1vw] w-full pt-[0.5vw]',
    confirmButton: 'flex-1 py-[1vw] rounded-[1vw] bg-amber-500 hover:bg-amber-400 text-white font-bold text-[1vw] transition-[background-color] duration-150',
    cancelButton: 'flex-1 py-[1vw] rounded-[1vw] bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[1vw] transition-[background-color] duration-150',
};

export const ConfirmRemoveStunModal = ({
    isOpen,
    onCancel,
    onConfirm,
}: {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) => {
    const { t } = useTranslation('game-dicethrone');

    if (!isOpen) return null;

    return (
        <ConfirmModal
            open={isOpen}
            title={t('confirmRemoveStun.title')}
            description={t('confirmRemoveStun.description')}
            confirmText={t('confirmRemoveStun.confirm')}
            cancelText={t('confirmRemoveStun.cancel')}
            onConfirm={onConfirm}
            onCancel={onCancel}
            theme={diceThroneTone}
            closeOnBackdrop={true}
            overlayClassName="z-[1000]"
            containerClassName="z-[1001]"
        />
    );
};
