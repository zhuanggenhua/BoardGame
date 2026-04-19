import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { ModalBase } from '../common/overlays/ModalBase';
import { LoadingArcaneAether } from '../system/LoadingVariants';
import { AnimatePresence } from 'framer-motion';
import { PasswordField } from '../common/PasswordField';

const AUTH_REMEMBERED_FIELDS_STORAGE_KEY = 'auth_modal_remembered_fields_v1';

interface AuthRememberedFields {
    account: string;
    username: string;
    email: string;
    resetEmail: string;
}

const EMPTY_REMEMBERED_FIELDS: AuthRememberedFields = {
    account: '',
    username: '',
    email: '',
    resetEmail: '',
};
let inMemoryRememberedFields: AuthRememberedFields = { ...EMPTY_REMEMBERED_FIELDS };

function mergeRememberedFields(
    previous: AuthRememberedFields,
    incoming: Partial<AuthRememberedFields>
): AuthRememberedFields {
    const nextAccount = typeof incoming.account === 'string' ? incoming.account.trim() : '';
    const nextUsername = typeof incoming.username === 'string' ? incoming.username.trim() : '';
    const nextEmail = typeof incoming.email === 'string' ? incoming.email.trim() : '';
    const nextResetEmail = typeof incoming.resetEmail === 'string' ? incoming.resetEmail.trim() : '';

    return {
        account: nextAccount || previous.account,
        username: nextUsername || previous.username,
        email: nextEmail || previous.email,
        resetEmail: nextResetEmail || previous.resetEmail || nextEmail || nextAccount,
    };
}

function readRememberedFields(): AuthRememberedFields {
    if (typeof window === 'undefined') return inMemoryRememberedFields;

    try {
        const raw = window.localStorage.getItem(AUTH_REMEMBERED_FIELDS_STORAGE_KEY);
        if (!raw) return inMemoryRememberedFields;
        const parsed = JSON.parse(raw) as Partial<AuthRememberedFields>;
        const merged = {
            account: inMemoryRememberedFields.account,
            username: inMemoryRememberedFields.username,
            email: inMemoryRememberedFields.email,
            resetEmail: inMemoryRememberedFields.resetEmail,
        };
        const nextFields = {
            ...merged,
            account: typeof parsed.account === 'string' && parsed.account.length > 0 ? parsed.account : merged.account,
            username: typeof parsed.username === 'string' && parsed.username.length > 0 ? parsed.username : merged.username,
            email: typeof parsed.email === 'string' && parsed.email.length > 0 ? parsed.email : merged.email,
            resetEmail: typeof parsed.resetEmail === 'string' && parsed.resetEmail.length > 0 ? parsed.resetEmail : merged.resetEmail,
        };
        inMemoryRememberedFields = nextFields;
        return nextFields;
    } catch {
        return inMemoryRememberedFields;
    }
}

function writeRememberedFields(fields: AuthRememberedFields): void {
    const nextFields = mergeRememberedFields(inMemoryRememberedFields, fields);
    inMemoryRememberedFields = nextFields;
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(AUTH_REMEMBERED_FIELDS_STORAGE_KEY, JSON.stringify(nextFields));
    } catch {
        // 忽略本地存储不可用的运行环境。
    }
}

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'login' | 'register' | 'reset';
    closeOnBackdrop?: boolean;
}

export const AuthModal = ({ isOpen, onClose, initialMode = 'login', closeOnBackdrop }: AuthModalProps) => {
    const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
    const [account, setAccount] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetConfirmPassword, setResetConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [isSendingResetCode, setIsSendingResetCode] = useState(false);
    const [resetCodeSent, setResetCodeSent] = useState(false);
    const [resetCountdown, setResetCountdown] = useState(0);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const resetCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const rememberedFieldsRef = useRef<AuthRememberedFields>(EMPTY_REMEMBERED_FIELDS);
    const draftHydratedRef = useRef(false);

    const { t } = useTranslation('auth');
    const { login, register, sendRegisterCode, sendResetCode, resetPassword: resetPasswordAction } = useAuth();
    const fieldLabelClassName = 'block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2';
    const textInputClassName = 'auth-form-input w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] caret-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-base sm:text-lg';
    const codeActionButtonClassName = 'px-3 py-1.5 bg-[#8c7b64] hover:bg-[#6b5d4a] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer';
    const secondaryTextButtonClassName = 'text-xs text-[#8c7b64] hover:text-[#433422] transition-colors';
    const persistRememberedField = useCallback((key: keyof AuthRememberedFields, value: string) => {
        rememberedFieldsRef.current = {
            ...rememberedFieldsRef.current,
            [key]: value.trim(),
        };
        writeRememberedFields(rememberedFieldsRef.current);
    }, []);
    const handleAccountChange = (value: string) => {
        setAccount(value);
        persistRememberedField('account', value);
    };
    const handleUsernameChange = (value: string) => {
        setUsername(value);
        persistRememberedField('username', value);
    };
    const handleEmailChange = (value: string) => {
        setEmail(value);
        persistRememberedField('email', value);
    };
    const handleResetEmailChange = (value: string) => {
        setResetEmail(value);
        persistRememberedField('resetEmail', value);
    };

    const clearSensitiveFields = useCallback(() => {
        setError('');
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setCodeSent(false);
        setCountdown(0);
        setResetCode('');
        setResetNewPassword('');
        setResetConfirmPassword('');
        setResetCodeSent(false);
        setResetCountdown(0);
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        if (resetCountdownRef.current) {
            clearInterval(resetCountdownRef.current);
            resetCountdownRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            const remembered = readRememberedFields();
            rememberedFieldsRef.current = remembered;
            draftHydratedRef.current = false;
            setMode(initialMode);
            setAccount(remembered.account);
            setUsername(remembered.username);
            setEmail(remembered.email);
            setResetEmail(remembered.resetEmail || remembered.email || remembered.account);
            clearSensitiveFields();
            draftHydratedRef.current = true;
        }
    }, [clearSensitiveFields, isOpen, initialMode]);

    useEffect(() => {
        if (!draftHydratedRef.current) return;
        rememberedFieldsRef.current = {
            account: account.trim(),
            username: username.trim(),
            email: email.trim(),
            resetEmail: resetEmail.trim(),
        };
        writeRememberedFields(rememberedFieldsRef.current);
    }, [account, username, email, resetEmail]);

    useEffect(() => {
        if (!isOpen) return;

        const remembered = readRememberedFields();
        rememberedFieldsRef.current = remembered;

        if (mode === 'login') {
            const preferredAccount = remembered.account || remembered.email || remembered.resetEmail;
            if (!account.trim() && preferredAccount) {
                setAccount(preferredAccount);
            }
            return;
        }

        if (mode === 'register') {
            const preferredEmail = remembered.email || remembered.account || remembered.resetEmail;
            if (!email.trim() && preferredEmail) {
                setEmail(preferredEmail);
            }
            if (!username.trim() && remembered.username) {
                setUsername(remembered.username);
            }
            return;
        }

        const preferredResetEmail = remembered.resetEmail || remembered.email || remembered.account;
        if (!resetEmail.trim() && preferredResetEmail) {
            setResetEmail(preferredResetEmail);
        }
    }, [isOpen, mode, account, email, username, resetEmail]);

    useEffect(() => {
        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
            if (resetCountdownRef.current) {
                clearInterval(resetCountdownRef.current);
            }
        };
    }, []);

    const handleSendCode = async () => {
        if (!email) {
            setError(t('email.error.missingEmail'));
            return;
        }
        setError('');
        setIsSendingCode(true);
        try {
            await sendRegisterCode(email);
            setCodeSent(true);
            setCountdown(60);
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            const error = err as Error & { suggestLogin?: boolean };
            setError(error.message || t('email.error.sendFailed'));
            
            // 如果邮箱已注册，延迟后自动切换到登录页面
            if (error.suggestLogin) {
                setTimeout(() => {
                    switchMode('login');
                    setAccount(email); // 预填邮箱
                }, 1500);
            }
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleSendResetCode = async () => {
        if (!resetEmail) {
            setError(t('email.error.missingEmail'));
            return;
        }
        setError('');
        setIsSendingResetCode(true);
        try {
            await sendResetCode(resetEmail);
            setResetCodeSent(true);
            setResetCountdown(60);
            resetCountdownRef.current = setInterval(() => {
                setResetCountdown(prev => {
                    if (prev <= 1) {
                        if (resetCountdownRef.current) clearInterval(resetCountdownRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('email.error.sendFailed'));
        } finally {
            setIsSendingResetCode(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (mode === 'login') {
                await login(account, password);
                onClose();
            } else if (mode === 'register') {
                if (password !== confirmPassword) {
                    throw new Error(t('error.passwordMismatch'));
                }
                if (!code) {
                    throw new Error(t('email.error.missingCode'));
                }
                await register(username, email, code, password);
                onClose();
            } else {
                if (resetNewPassword !== resetConfirmPassword) {
                    throw new Error(t('error.passwordMismatch'));
                }
                if (!resetCode) {
                    throw new Error(t('email.error.missingCode'));
                }
                await resetPasswordAction(resetEmail, resetCode, resetNewPassword);
                onClose();
            }
        } catch (err) {
            const error = err as Error & { code?: string; suggestRegister?: boolean; suggestLogin?: boolean };
            
            // 登录时邮箱未注册，提供注册引导
            if (mode === 'login' && error.code === 'AUTH_EMAIL_NOT_REGISTERED') {
                setError(error.message);
                // 延迟 1.5 秒后自动切换到注册页面
                setTimeout(() => {
                    switchMode('register');
                    setEmail(account); // 预填邮箱
                }, 1500);
                return;
            }
            
            // 注册时邮箱已存在，提供登录引导
            if (mode === 'register' && error.suggestLogin) {
                setError(error.message);
                // 延迟 1.5 秒后自动切换到登录页面
                setTimeout(() => {
                    switchMode('login');
                    setAccount(email); // 预填邮箱
                }, 1500);
                return;
            }
            
            setError(error.message || t('error.operationFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = (nextMode: 'login' | 'register' | 'reset') => {
        const remembered = rememberedFieldsRef.current;
        const preferredEmail = email.trim() || account.trim() || resetEmail.trim() || remembered.email || remembered.account || remembered.resetEmail;
        const preferredAccount = account.trim() || email.trim() || resetEmail.trim() || remembered.account || remembered.email || remembered.resetEmail;
        const preferredResetEmail = resetEmail.trim() || email.trim() || account.trim() || remembered.resetEmail || remembered.email || remembered.account;
        const nextRememberedFields: AuthRememberedFields = {
            account: nextMode === 'login' ? preferredAccount : preferredAccount || remembered.account,
            email: nextMode === 'register' ? preferredEmail : preferredEmail || remembered.email,
            resetEmail: nextMode === 'reset' ? preferredResetEmail : preferredResetEmail || remembered.resetEmail,
            username: username.trim() || remembered.username,
        };

        setMode(nextMode);
        setAccount(nextRememberedFields.account);
        setEmail(nextRememberedFields.email);
        setResetEmail(nextRememberedFields.resetEmail);
        setUsername(nextRememberedFields.username);
        rememberedFieldsRef.current = nextRememberedFields;
        writeRememberedFields(nextRememberedFields);
        clearSensitiveFields();
    };

    return (
        <ModalBase
            onClose={onClose}
            closeOnBackdrop={closeOnBackdrop}
            // 让弹窗容器跟随 --runtime-viewport-height，移动端键盘弹出时保持可滚动可见。
            containerClassName="modal-base-container p-0"
            containerStyle={{
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: 'max(1rem, var(--runtime-modal-bottom-inset))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            }}
        >
            <div
                className="bg-[#fcfbf9] pointer-events-auto relative mx-4 flex w-[calc(100vw-2rem)] max-w-[400px] max-h-[var(--runtime-modal-max-height)] flex-col overflow-hidden rounded-sm border border-[#e5e0d0] shadow-[0_10px_40px_rgba(67,52,34,0.1)]"
                data-testid="auth-modal"
            >
                {/* 装饰边角 */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#c0a080]" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#c0a080]" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#c0a080]" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#c0a080]" />

                <AnimatePresence>
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-[#fcfbf9]/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center"
                        >
                            <div className="scale-50 mb-4">
                                <LoadingArcaneAether />
                            </div>
                            <motion.p
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="text-[#433422] font-bold text-sm tracking-widest uppercase"
                            >
                                {t('button.processing')}
                            </motion.p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="shrink-0 px-6 pt-6 pb-4 sm:px-10 sm:pt-10 sm:pb-6 text-center">
                    <h2 className="text-2xl font-serif font-bold text-[#433422] tracking-wide mb-2">
                        {t(mode === 'login' ? 'login.title' : mode === 'register' ? 'register.title' : 'reset.title')}
                    </h2>
                    <div className="h-px w-12 bg-[#c0a080] mx-auto opacity-50" />
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col font-serif">
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 sm:px-10 sm:pb-6">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-2 mb-6 font-serif text-center"
                            >
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-5">
                            {mode === 'register' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label className={fieldLabelClassName}>
                                            {t('email.label.address')}
                                        </label>
                                        <div className="flex flex-wrap gap-2 items-end" data-testid="auth-register-email-row">
                                            <div className="min-w-0 flex-1">
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => handleEmailChange(e.target.value)}
                                                    className={textInputClassName}
                                                    placeholder={t('email.placeholder.address')}
                                                    required
                                                    autoComplete="email"
                                                    autoFocus
                                                    data-testid="auth-register-email-input"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendCode}
                                                disabled={isSendingCode || countdown > 0}
                                                className={codeActionButtonClassName}
                                                data-testid="auth-register-send-code"
                                            >
                                                {isSendingCode
                                                    ? t('email.button.sending')
                                                    : countdown > 0
                                                        ? t('email.button.resendCountdown', { count: countdown })
                                                        : codeSent
                                                            ? t('email.button.resend')
                                                            : t('email.button.sendCode')}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={fieldLabelClassName}>
                                            {t('email.label.code')}
                                        </label>
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className={textInputClassName}
                                            placeholder={t('email.placeholder.code')}
                                            required
                                            maxLength={6}
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            data-testid="auth-register-code-input"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {mode === 'reset' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label className={fieldLabelClassName}>
                                            {t('email.label.address')}
                                        </label>
                                        <div className="flex flex-wrap gap-2 items-end" data-testid="auth-reset-email-row">
                                            <div className="min-w-0 flex-1">
                                                <input
                                                    type="email"
                                                    value={resetEmail}
                                                    onChange={(e) => handleResetEmailChange(e.target.value)}
                                                    className={textInputClassName}
                                                    placeholder={t('email.placeholder.address')}
                                                    required
                                                    autoComplete="email"
                                                    autoFocus
                                                    data-testid="auth-reset-email-input"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendResetCode}
                                                disabled={isSendingResetCode || resetCountdown > 0}
                                                className={codeActionButtonClassName}
                                                data-testid="auth-reset-send-code"
                                            >
                                                {isSendingResetCode
                                                    ? t('email.button.sending')
                                                    : resetCountdown > 0
                                                        ? t('email.button.resendCountdown', { count: resetCountdown })
                                                        : resetCodeSent
                                                            ? t('email.button.resend')
                                                            : t('email.button.sendCode')}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={fieldLabelClassName}>
                                            {t('email.label.code')}
                                        </label>
                                        <input
                                            type="text"
                                            value={resetCode}
                                            onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className={textInputClassName}
                                            placeholder={t('email.placeholder.code')}
                                            required
                                            maxLength={6}
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            data-testid="auth-reset-code-input"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {mode === 'login' ? (
                                <div>
                                    <label className={fieldLabelClassName}>
                                        {t('label.account')}
                                    </label>
                                    <input
                                        type="text"
                                        value={account}
                                        onChange={(e) => handleAccountChange(e.target.value)}
                                        className={textInputClassName}
                                        placeholder={t('placeholder.account')}
                                        required
                                        autoComplete="username"
                                        autoFocus
                                        data-testid="auth-login-account-input"
                                    />
                                </div>
                            ) : mode === 'register' ? (
                                <div>
                                    <label className={fieldLabelClassName}>
                                        {t('label.username')}
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => handleUsernameChange(e.target.value)}
                                        className={textInputClassName}
                                        placeholder={t('placeholder.username')}
                                        required
                                        autoComplete="nickname"
                                        data-testid="auth-register-username-input"
                                    />
                                </div>
                            ) : null}

                            {mode === 'login' && (
                                <div>
                                    <label className={fieldLabelClassName}>
                                        {t('label.password')}
                                    </label>
                                    <PasswordField
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={textInputClassName}
                                        placeholder={t('placeholder.password')}
                                        required
                                        minLength={4}
                                        autoComplete="current-password"
                                        data-testid="auth-login-password-input"
                                        toggleButtonTestId="auth-login-password-toggle"
                                    />
                                </div>
                            )}

                            {mode === 'register' && (
                                <div>
                                    <label className={fieldLabelClassName}>
                                        {t('label.password')}
                                    </label>
                                    <PasswordField
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={textInputClassName}
                                        placeholder={t('placeholder.password')}
                                        required
                                        minLength={4}
                                        autoComplete="new-password"
                                        data-testid="auth-register-password-input"
                                        toggleButtonTestId="auth-register-password-toggle"
                                    />
                                </div>
                            )}

                            {mode === 'reset' && (
                                <div>
                                    <label className={fieldLabelClassName}>
                                        {t('label.newPassword')}
                                    </label>
                                    <PasswordField
                                        value={resetNewPassword}
                                        onChange={(e) => setResetNewPassword(e.target.value)}
                                        className={textInputClassName}
                                        placeholder={t('placeholder.password')}
                                        required
                                        minLength={4}
                                        autoComplete="new-password"
                                        data-testid="auth-reset-new-password-input"
                                        toggleButtonTestId="auth-reset-new-password-toggle"
                                    />
                                </div>
                            )}

                            {mode === 'register' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                >
                                    <label className={fieldLabelClassName}>
                                        {t('label.confirmPassword')}
                                    </label>
                                    <PasswordField
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={textInputClassName}
                                        placeholder={t('placeholder.password')}
                                        required
                                        minLength={4}
                                        autoComplete="new-password"
                                        data-testid="auth-register-confirm-password-input"
                                        toggleButtonTestId="auth-register-confirm-password-toggle"
                                    />
                                </motion.div>
                            )}

                            {mode === 'reset' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                >
                                    <label className={fieldLabelClassName}>
                                        {t('label.confirmPassword')}
                                    </label>
                                    <PasswordField
                                        value={resetConfirmPassword}
                                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                                        className={textInputClassName}
                                        placeholder={t('placeholder.password')}
                                        required
                                        minLength={4}
                                        autoComplete="new-password"
                                        data-testid="auth-reset-confirm-password-input"
                                        toggleButtonTestId="auth-reset-confirm-password-toggle"
                                    />
                                </motion.div>
                            )}

                            {mode === 'login' && (
                                <div className="text-right">
                                    <button
                                        type="button"
                                        onClick={() => switchMode('reset')}
                                        className={secondaryTextButtonClassName}
                                    >
                                        {t('login.forgot')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-[#e5e0d0] bg-[#fcfbf9] px-6 py-4 sm:px-10 sm:py-6">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-[#433422] hover:bg-[#2b2114] text-[#fcfbf9] font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                            data-testid="auth-submit-button"
                        >
                            {isLoading
                                ? t('button.processing')
                                : t(mode === 'login' ? 'login.submit' : mode === 'register' ? 'register.submit' : 'reset.submit')}
                        </button>

                        <div className="mt-4 flex items-center justify-center gap-4 text-sm font-serif italic">
                            <button
                                type="button"
                                onClick={() => mode !== 'login' && switchMode('login')}
                                className={clsx(
                                    "group relative cursor-pointer transition-colors px-1 py-1",
                                    mode === 'login' ? "text-[#433422] font-bold" : "text-[#8c7b64] hover:text-[#433422]"
                                )}
                                data-testid="auth-switch-login"
                            >
                                <span className="relative z-10">{t('menu.login')}</span>
                                <span className="underline-center h-[1px] opacity-60" />
                            </button>
                            <div className="w-px h-3 bg-[#c0a080] opacity-40" />
                            <button
                                type="button"
                                onClick={() => mode !== 'register' && switchMode('register')}
                                className={clsx(
                                    "group relative cursor-pointer transition-colors px-1 py-1",
                                    mode === 'register' ? "text-[#433422] font-bold" : "text-[#8c7b64] hover:text-[#433422]"
                                )}
                                data-testid="auth-switch-register"
                            >
                                <span className="relative z-10">{t('menu.register')}</span>
                                <span className="underline-center h-[1px] opacity-60" />
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </ModalBase>
    );
};
