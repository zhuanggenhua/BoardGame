import { useTranslation } from 'react-i18next';

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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900/90 border border-white/20 backdrop-blur-xl p-[2vw] rounded-[1.5vw] shadow-2xl max-w-[30vw] flex flex-col items-center text-center gap-[1.5vw] animate-in zoom-in-95 duration-300">
                <div className="w-[4vw] h-[4vw] bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/50">⚠️</div>
                <div className="flex flex-col gap-[0.5vw]">
                    <h3 className="text-[1.2vw] font-black text-white">{t('confirmSkip.title')}</h3>
                    <p className="text-[0.9vw] text-slate-400 leading-relaxed px-[1vw]">{t('confirmSkip.description')}</p>
                </div>
                <div className="flex gap-[1vw] w-full pt-[0.5vw]">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-[0.8vw] rounded-[0.8vw] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[0.85vw] border border-slate-700"
                    >
                        {t('confirmSkip.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-[0.8vw] rounded-[0.8vw] bg-amber-600 hover:bg-amber-500 text-white font-bold text-[0.85vw] shadow-lg shadow-amber-900/40"
                    >
                        {t('confirmSkip.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
