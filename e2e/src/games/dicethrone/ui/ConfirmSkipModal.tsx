import { useTranslation } from 'react-i18next';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';

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

    return (
        <GameModal
            isOpen={isOpen}
            onClose={onCancel}
            title={t('confirmSkip.title')}
            width="sm"
            footer={
                <>
                    <GameButton
                        variant="secondary"
                        onClick={onCancel}
                        className="flex-1"
                    >
                        {t('confirmSkip.cancel')}
                    </GameButton>
                    <GameButton
                        variant="primary"
                        onClick={onConfirm}
                        className="flex-1"
                    >
                        {t('confirmSkip.confirm')}
                    </GameButton>
                </>
            }
        >
            <p className="text-lg text-slate-200">
                {t('confirmSkip.description')}
            </p>
        </GameModal>
    );
};
