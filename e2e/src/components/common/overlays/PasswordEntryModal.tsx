import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { ModalBase } from './ModalBase';
import { PasswordField } from '../PasswordField';

interface PasswordEntryModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
    closeOnBackdrop?: boolean;
}

export const PasswordEntryModal = ({
    open,
    onClose,
    onConfirm,
    closeOnBackdrop = true,
}: PasswordEntryModalProps) => {
    const { t } = useTranslation('lobby');
    const [password, setPassword] = useState('');

    const handleClose = () => {
        setPassword('');
        onClose();
    };

    const handleConfirm = () => {
        if (!password.trim()) return;
        onConfirm(password.trim());
        setPassword('');
    };

    return (
        <AnimatePresence>
            {open && (
                <ModalBase
                    onClose={handleClose}
                    closeOnBackdrop={closeOnBackdrop}
                    overlayClassName="bg-[#2b2114]/30"
                    containerClassName="p-4 sm:p-6"
                    containerStyle={{
                        paddingTop: 'max(1rem, var(--safe-area-top))',
                        paddingRight: 'max(1rem, var(--safe-area-right))',
                        paddingBottom: 'max(1rem, var(--runtime-modal-bottom-inset))',
                        paddingLeft: 'max(1rem, var(--safe-area-left))',
                    }}
                >
                    <div
                        data-testid="room-password-modal"
                        className="bg-parchment-card-bg border border-parchment-card-border/50 shadow-parchment-card-hover rounded-sm w-full max-w-[20rem] sm:max-w-sm max-h-[var(--runtime-modal-max-height)] overflow-hidden text-center font-serif pointer-events-auto flex flex-col"
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto p-6">
                            <div className="text-xs sm:text-sm text-parchment-light-text font-bold uppercase tracking-wider mb-2">
                                {t('password.modalTitle', 'Private Room')}
                            </div>
                            <div className="text-parchment-base-text font-bold text-sm sm:text-base mb-5">
                                {t('password.modalDesc', 'This room requires a password.')}
                            </div>

                            <PasswordField
                                data-testid="room-password-input"
                                autoFocus
                                name="roomPassword"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirm();
                                }}
                                placeholder={t('password.placeholder', 'Enter password...')}
                                autoComplete="new-password"
                                className="w-full px-4 py-2 mb-2 rounded-[4px] text-base sm:text-sm border border-parchment-card-border/30 bg-parchment-base-bg/30 text-parchment-base-text placeholder:text-parchment-light-text/50 focus:outline-none focus:border-parchment-base-text transition-colors"
                                toggleButtonTestId="room-password-toggle"
                                toggleButtonClassName="text-parchment-light-text hover:text-parchment-base-text"
                            />
                        </div>

                        <div className="shrink-0 flex items-center justify-center gap-3 border-t border-parchment-card-border/20 px-6 py-4 bg-parchment-card-bg">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider border border-parchment-card-border/50 text-parchment-base-text bg-parchment-card-bg hover:bg-parchment-base-bg transition-colors rounded-[4px]"
                            >
                                {t('actions.cancel', 'Cancel')}
                            </button>
                            <button
                                data-testid="room-password-confirm"
                                onClick={handleConfirm}
                                disabled={!password.trim()}
                                className="px-4 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown transition-colors rounded-[4px] disabled:opacity-50"
                            >
                                {t('actions.confirm', 'Confirm')}
                            </button>
                        </div>
                    </div>
                </ModalBase>
            )}
        </AnimatePresence>
    );
};
