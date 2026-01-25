import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../../components/common/overlays/ConfirmModal';

/** DiceThrone 主题配置 */
const diceThroneTone = {
    overlay: 'bg-black/60',
    panel: 'bg-slate-900/90 border border-white/20 backdrop-blur-xl p-[2vw] rounded-[1.5vw] shadow-2xl max-w-[30vw] flex flex-col items-center text-center gap-[1.5vw] pointer-events-auto',
    title: 'text-[1.2vw] font-black text-white mb-0',
    description: 'text-[0.9vw] text-slate-400 leading-relaxed px-[1vw] mb-0',
    actions: 'flex gap-[1vw] w-full pt-[0.5vw]',
    confirmButton: 'flex-1 py-[0.8vw] rounded-[0.8vw] bg-amber-600 hover:bg-amber-500 text-white font-bold text-[0.85vw] shadow-lg shadow-amber-900/40',
    cancelButton: 'flex-1 py-[0.8vw] rounded-[0.8vw] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[0.85vw] border border-slate-700',
};

export const ConfirmSkipModal = ({
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
            title={t('confirmSkip.title')}
            description={t('confirmSkip.description')}
            confirmText={t('confirmSkip.confirm')}
            cancelText={t('confirmSkip.cancel')}
            onConfirm={onConfirm}
            onCancel={onCancel}
            theme={diceThroneTone}
            closeOnBackdrop={false}
            overlayClassName="z-[1000]"
            containerClassName="z-[1001]"
        />
    );
};
