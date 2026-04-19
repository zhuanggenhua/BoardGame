import { useTranslation } from 'react-i18next';
import { GameModal } from './components/GameModal';
import { GameButton } from './components/GameButton';

export const ConfirmRemoveKnockdownModal = ({
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
            title={t('confirmRemoveKnockdown.title')}
            width="sm"
            footer={
                <>
                    <GameButton
                        variant="secondary"
                        onClick={onCancel}
                        className="flex-1"
                    >
                        {t('confirmRemoveKnockdown.cancel')}
                    </GameButton>
                    <GameButton
                        variant="primary"
                        onClick={onConfirm}
                        className="flex-1"
                    >
                        {t('confirmRemoveKnockdown.confirm')}
                    </GameButton>
                </>
            }
        >
            <p className="text-lg text-slate-200">
                {t('confirmRemoveKnockdown.description')}
            </p>
        </GameModal>
    );
};
