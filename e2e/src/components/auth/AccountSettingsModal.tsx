import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { ModalBase } from '../common/overlays/ModalBase';
import { AvatarUpdateModal } from './AvatarUpdateModal';
import { EmailBindModal } from './EmailBindModal';
import { User, Image, Mail, Lock, Pencil, Check, X } from 'lucide-react';
import { PasswordField } from '../common/PasswordField';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    closeOnBackdrop?: boolean;
}

export const AccountSettingsModal = ({ isOpen, onClose, closeOnBackdrop }: AccountSettingsModalProps) => {
    const { t } = useTranslation('auth');
    const { user, updateUsername, changePassword } = useAuth();
    const { openModal, closeModal } = useModalStack();

    // 昵称编辑状态
    const [isEditingName, setIsEditingName] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [nameError, setNameError] = useState('');
    const [nameSaving, setNameSaving] = useState(false);

    // 密码编辑状态
    const [isEditingPassword, setIsEditingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // 昵称修改成功提示
    const [nameSuccess, setNameSuccess] = useState(false);

    const avatarModalIdRef = useRef<string | null>(null);
    const emailModalIdRef = useRef<string | null>(null);

    // 重置状态
    useEffect(() => {
        if (isOpen) {
            setIsEditingName(false);
            setNewUsername('');
            setNameError('');
            setNameSuccess(false);
            setIsEditingPassword(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordError('');
            setPasswordSuccess(false);
        }
    }, [isOpen]);

    const handleStartEditName = useCallback(() => {
        setIsEditingName(true);
        setNewUsername(user?.username ?? '');
        setNameError('');
        setNameSuccess(false);
    }, [user]);

    const handleCancelEditName = useCallback(() => {
        setIsEditingName(false);
        setNewUsername('');
        setNameError('');
    }, []);

    const handleSaveName = useCallback(async () => {
        const trimmed = newUsername.trim();
        if (trimmed.length < 2 || trimmed.length > 20) {
            setNameError(t('account.nickname.error.length'));
            return;
        }
        if (trimmed === user?.username) {
            setIsEditingName(false);
            return;
        }

        setNameSaving(true);
        setNameError('');
        try {
            await updateUsername(trimmed);
            setIsEditingName(false);
            setNameSuccess(true);
            setTimeout(() => setNameSuccess(false), 2000);
        } catch (err) {
            setNameError(err instanceof Error ? err.message : t('account.nickname.error.failed'));
        } finally {
            setNameSaving(false);
        }
    }, [newUsername, user, updateUsername, t]);

    const handleStartEditPassword = useCallback(() => {
        setIsEditingPassword(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        setPasswordSuccess(false);
    }, []);

    const handleCancelEditPassword = useCallback(() => {
        setIsEditingPassword(false);
        setPasswordError('');
    }, []);

    const handleSavePassword = useCallback(async () => {
        if (!currentPassword) {
            setPasswordError(t('account.password.error.currentRequired'));
            return;
        }
        if (!newPassword) {
            setPasswordError(t('account.password.error.newRequired'));
            return;
        }
        if (newPassword.length < 4) {
            setPasswordError(t('account.password.error.tooShort'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError(t('account.password.error.mismatch'));
            return;
        }

        setPasswordSaving(true);
        setPasswordError('');
        try {
            await changePassword(currentPassword, newPassword);
            setIsEditingPassword(false);
            setPasswordSuccess(true);
            setTimeout(() => setPasswordSuccess(false), 2000);
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : t('account.password.error.failed'));
        } finally {
            setPasswordSaving(false);
        }
    }, [currentPassword, newPassword, confirmPassword, changePassword, t]);

    const handleOpenAvatar = useCallback(() => {
        if (avatarModalIdRef.current) {
            closeModal(avatarModalIdRef.current);
            avatarModalIdRef.current = null;
        }
        avatarModalIdRef.current = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => { avatarModalIdRef.current = null; },
            render: ({ close, closeOnBackdrop: cbd }) => (
                <AvatarUpdateModal isOpen onClose={close} closeOnBackdrop={cbd} />
            ),
        });
    }, [openModal, closeModal]);

    const handleOpenEmail = useCallback(() => {
        if (emailModalIdRef.current) {
            closeModal(emailModalIdRef.current);
            emailModalIdRef.current = null;
        }
        emailModalIdRef.current = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => { emailModalIdRef.current = null; },
            render: ({ close, closeOnBackdrop: cbd }) => (
                <EmailBindModal isOpen onClose={close} closeOnBackdrop={cbd} />
            ),
        });
    }, [openModal, closeModal]);

    if (!user) return null;

    // 通用行样式
    const rowClass = 'flex items-center justify-between py-3 px-1';
    const labelClass = 'flex items-center gap-2 text-xs font-bold text-parchment-light-text uppercase tracking-wider min-w-[80px]';
    const valueClass = 'text-sm text-parchment-base-text font-serif';
    const actionBtnClass = 'text-xs font-bold text-parchment-light-text hover:text-parchment-base-text transition-colors cursor-pointer uppercase tracking-wider';
    const dividerClass = 'h-px bg-parchment-card-border/30 mx-1';

    return (
        <ModalBase
            onClose={onClose}
            closeOnBackdrop={closeOnBackdrop}
            containerClassName="p-4 sm:p-6"
            containerStyle={{
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: 'max(1rem, var(--runtime-modal-bottom-inset))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            }}
        >
            <div
                className="bg-parchment-card-bg pointer-events-auto w-full max-w-[420px] max-h-[var(--runtime-modal-max-height)] overflow-y-auto shadow-parchment-card-hover border border-parchment-card-border/50 p-6 sm:p-8 relative rounded-sm font-serif"
                data-testid="account-settings-modal"
            >
                {/* 标题 */}
                <div className="text-center mb-5">
                    <div className="text-xs sm:text-sm text-parchment-light-text font-bold uppercase tracking-wider">
                        {t('account.title')}
                    </div>
                    <div className="h-px w-10 bg-parchment-card-border/70 mx-auto mt-2" />
                </div>

                {/* 头像行 */}
                <div className={rowClass}>
                    <span className={labelClass}>
                        <Image size={14} />
                        {t('account.section.avatar')}
                    </span>
                    <div className="flex items-center gap-3">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full object-cover border border-parchment-card-border/50" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-parchment-base-bg border border-parchment-card-border/50 flex items-center justify-center">
                                <User size={14} className="text-parchment-light-text" />
                            </div>
                        )}
                            <button onClick={handleOpenAvatar} className={actionBtnClass}>
                                {t('account.nickname.edit')}
                            </button>
                    </div>
                </div>

                <div className={dividerClass} />

                {/* 昵称行 */}
                <div className={`${rowClass} flex-wrap gap-2`}>
                    <span className={labelClass}>
                        <Pencil size={14} />
                        {t('account.section.nickname')}
                    </span>
                    {!isEditingName ? (
                        <div className="flex w-full items-center gap-3 sm:w-auto">
                            <span className={valueClass}>{user.username}</span>
                            {nameSuccess && (
                                <span className="text-xs text-green-600">
                                    <Check size={14} />
                                </span>
                            )}
                            <button onClick={handleStartEditName} className={actionBtnClass} data-testid="account-settings-edit-nickname">
                                {t('account.nickname.edit')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex w-full items-center gap-2 sm:w-auto">
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                maxLength={20}
                                className="auth-form-input min-w-0 flex-1 sm:w-32 px-2 py-1 text-base sm:text-sm bg-transparent border-b-2 border-parchment-card-border/30 text-parchment-base-text caret-parchment-base-text outline-none focus:border-parchment-base-text transition-colors"
                                placeholder={t('account.nickname.placeholder')}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveName(); if (e.key === 'Escape') handleCancelEditName(); }}
                                data-testid="account-settings-nickname-input"
                            />
                            <button
                                onClick={() => void handleSaveName()}
                                disabled={nameSaving}
                                className="p-1 text-green-600 hover:text-green-700 transition-colors cursor-pointer disabled:opacity-50"
                                aria-label={t('account.nickname.save')}
                                data-testid="account-settings-save-nickname"
                            >
                                <Check size={16} />
                            </button>
                            <button
                                onClick={handleCancelEditName}
                                className="p-1 text-parchment-light-text hover:text-red-500 transition-colors cursor-pointer"
                                aria-label={t('account.nickname.cancel')}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}
                </div>
                {nameError && (
                    <div className="text-xs text-red-500 px-1 -mt-1 mb-1">{nameError}</div>
                )}

                <div className={dividerClass} />

                {/* 邮箱行 */}
                <div className={rowClass}>
                    <span className={labelClass}>
                        <Mail size={14} />
                        {t('account.section.email')}
                    </span>
                    <div className="flex items-center gap-3">
                        {user.email ? (
                            <>
                                <span className={`${valueClass} text-xs`}>{user.email}</span>
                                {user.emailVerified && (
                                    <span className="text-xs text-green-600 flex items-center gap-0.5">
                                        <Check size={12} />
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-xs text-parchment-light-text italic">{t('account.email.unbound')}</span>
                        )}
                        <button onClick={handleOpenEmail} className={actionBtnClass} data-testid="account-settings-open-email">
                            {user.email ? t('account.email.change') : t('account.email.bind')}
                        </button>
                    </div>
                </div>

                <div className={dividerClass} />

                {/* 密码行 */}
                <div className={`${rowClass} flex-wrap`}>
                    <span className={labelClass}>
                        <Lock size={14} />
                        {t('account.section.password')}
                    </span>
                    {!isEditingPassword ? (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-parchment-light-text">••••••</span>
                            {passwordSuccess && (
                                <span className="text-xs text-green-600">
                                    <Check size={14} />
                                </span>
                            )}
                            <button onClick={handleStartEditPassword} className={actionBtnClass} data-testid="account-settings-edit-password">
                                {t('account.password.change')}
                            </button>
                        </div>
                    ) : (
                        <div className="w-full mt-3 space-y-3">
                            <PasswordField
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="auth-form-input w-full px-2 py-1.5 text-base sm:text-sm bg-transparent border-b-2 border-parchment-card-border/30 text-parchment-base-text caret-parchment-base-text outline-none focus:border-parchment-base-text transition-colors"
                                placeholder={t('account.password.current')}
                                autoFocus
                                autoComplete="current-password"
                                data-testid="account-settings-current-password-input"
                                toggleButtonTestId="account-settings-current-password-toggle"
                                toggleButtonClassName="text-parchment-light-text hover:text-parchment-base-text"
                            />
                            <PasswordField
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="auth-form-input w-full px-2 py-1.5 text-base sm:text-sm bg-transparent border-b-2 border-parchment-card-border/30 text-parchment-base-text caret-parchment-base-text outline-none focus:border-parchment-base-text transition-colors"
                                placeholder={t('account.password.new')}
                                autoComplete="new-password"
                                data-testid="account-settings-new-password-input"
                                toggleButtonTestId="account-settings-new-password-toggle"
                                toggleButtonClassName="text-parchment-light-text hover:text-parchment-base-text"
                            />
                            <PasswordField
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="auth-form-input w-full px-2 py-1.5 text-base sm:text-sm bg-transparent border-b-2 border-parchment-card-border/30 text-parchment-base-text caret-parchment-base-text outline-none focus:border-parchment-base-text transition-colors"
                                placeholder={t('account.password.confirm')}
                                onKeyDown={(e) => { if (e.key === 'Enter') void handleSavePassword(); }}
                                autoComplete="new-password"
                                data-testid="account-settings-confirm-password-input"
                                toggleButtonTestId="account-settings-confirm-password-toggle"
                                toggleButtonClassName="text-parchment-light-text hover:text-parchment-base-text"
                            />
                            {passwordError && (
                                <div className="text-xs text-red-500">{passwordError}</div>
                            )}
                            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                                <button
                                    onClick={handleCancelEditPassword}
                                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-parchment-card-border/50 text-parchment-base-text bg-parchment-card-bg hover:bg-parchment-base-bg transition-colors rounded-[4px] cursor-pointer"
                                >
                                    {t('account.password.cancel')}
                                </button>
                                <button
                                    onClick={() => void handleSavePassword()}
                                    disabled={passwordSaving}
                                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown transition-colors rounded-[4px] cursor-pointer disabled:opacity-50"
                                >
                                    {passwordSaving ? t('account.password.saving') : t('account.password.save')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 关闭按钮 */}
                <div className="mt-6 text-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-xs font-bold uppercase tracking-wider border border-parchment-card-border/50 text-parchment-base-text bg-parchment-card-bg hover:bg-parchment-base-bg transition-colors rounded-[4px] cursor-pointer"
                    >
                        {t('account.close')}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
};
