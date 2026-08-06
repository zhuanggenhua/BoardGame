import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useHomeV2CompactLandscape } from '../../hooks/ui/useHomeV2CompactLandscape';
import { ModalBase } from '../common/overlays/ModalBase';
import { HomeV2PaperModalFrame } from '../common/overlays/HomeV2PaperModalFrame';
import {
    getHomeV2PaperFooterTabClassName,
    homeV2PaperCompactHintClassName,
    homeV2PaperCompactInputClassName,
    homeV2PaperCompactLabelClassName,
    homeV2PaperCompactPrimaryButtonClassName,
    homeV2PaperCompactSendCodeButtonClassName,
    homeV2PaperCompactTextButtonClassName,
    homeV2PaperHintClassName,
    homeV2PaperInputClassName,
    homeV2PaperLabelClassName,
    homeV2PaperPrimaryButtonClassName,
    homeV2PaperSendCodeButtonClassName,
    homeV2PaperTextButtonClassName,
} from '../common/overlays/homeV2PaperModalTheme';
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
    const readField = (key: keyof AuthRememberedFields) => {
        if (!Object.prototype.hasOwnProperty.call(incoming, key)) {
            return previous[key];
        }
        const value = incoming[key];
        return typeof value === 'string' ? value.trim() : '';
    };

    const nextAccount = readField('account');
    const nextUsername = readField('username');
    const nextEmail = readField('email');
    const nextResetEmail = readField('resetEmail');

    return {
        account: nextAccount,
        username: nextUsername,
        email: nextEmail,
        resetEmail: nextResetEmail,
    };
}

function readRememberedFields(): AuthRememberedFields {
    if (typeof window === 'undefined') return inMemoryRememberedFields;

    try {
        const raw = window.localStorage.getItem(AUTH_REMEMBERED_FIELDS_STORAGE_KEY);
        if (!raw) return inMemoryRememberedFields;
        const parsed = JSON.parse(raw) as Partial<AuthRememberedFields>;
        const nextFields = mergeRememberedFields(inMemoryRememberedFields, parsed);
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

type AuthMode = 'login' | 'register' | 'reset';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: AuthMode;
    closeOnBackdrop?: boolean;
    placement?: 'center' | 'right';
    embedded?: boolean;
    showModeSwitchFooter?: boolean;
    showTitle?: boolean;
    onModeChange?: (mode: AuthMode) => void;
    visualStyle?: 'default' | 'home-v2';
}

export const AuthModal = ({
    isOpen,
    onClose,
    initialMode = 'login',
    closeOnBackdrop,
    placement = 'center',
    embedded = false,
    showModeSwitchFooter = true,
    showTitle = true,
    onModeChange,
    visualStyle = 'default',
}: AuthModalProps) => {
    const [mode, setMode] = useState<AuthMode>(initialMode);
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

    const isCompactLandscape = useHomeV2CompactLandscape();
    const { t } = useTranslation('auth');
    const { login, register, sendRegisterCode, sendResetCode, resetPassword: resetPasswordAction } = useAuth();
    const isRightPlacement = placement === 'right';
    const isHomeV2Style = visualStyle === 'home-v2';
    const isCompactHomeV2Layout = !embedded && isHomeV2Style && isCompactLandscape;
    const isClassicStandalone = !embedded && !isHomeV2Style;
    const shouldAutoFocusInitialField = !isHomeV2Style;
    const homeV2FieldLabelClassName = isCompactHomeV2Layout ? homeV2PaperCompactLabelClassName : homeV2PaperLabelClassName;
    const homeV2FieldHintClassName = isCompactHomeV2Layout ? homeV2PaperCompactHintClassName : homeV2PaperHintClassName;
    const homeV2TextInputClassName = isCompactHomeV2Layout ? homeV2PaperCompactInputClassName : homeV2PaperInputClassName;
    const homeV2CodeButtonClassName = isCompactHomeV2Layout ? homeV2PaperCompactSendCodeButtonClassName : homeV2PaperSendCodeButtonClassName;
    const homeV2SecondaryTextButtonClassName = isCompactHomeV2Layout ? homeV2PaperCompactTextButtonClassName : homeV2PaperTextButtonClassName;
    const homeV2PrimaryButtonClassName = isCompactHomeV2Layout ? homeV2PaperCompactPrimaryButtonClassName : homeV2PaperPrimaryButtonClassName;
    const fieldLabelClassName = clsx(
        'block',
        embedded
            ? 'text-[12px] font-semibold tracking-[0.16em] text-[#6b452d]'
            : isHomeV2Style
                ? homeV2FieldLabelClassName
                : 'mb-2 text-xs font-bold uppercase tracking-wider text-[#8c7b64]',
    );
    const textInputClassName = clsx(
        'auth-form-input w-full outline-none transition-colors',
        embedded
            ? 'rounded-[10px] border-[1.5px] border-[#8e6140] bg-[rgba(252,245,230,0.78)] px-[16px] py-[11px] text-[16px] text-[#4b3020] caret-[#4b3020] placeholder-[#7e5f44] shadow-[0_4px_12px_rgba(91,63,41,0.08)] focus:border-[#6f4b32] focus:bg-[rgba(252,245,230,0.9)]'
            : isHomeV2Style
                ? homeV2TextInputClassName
                : 'border-b-2 border-[#e5e0d0] bg-transparent px-0 py-2 text-base text-[#433422] caret-[#433422] placeholder-[#c0a080]/50 focus:border-[#433422] sm:text-lg',
    );
    const codeActionButtonClassName = clsx(
        'cursor-pointer whitespace-nowrap uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        embedded
            ? 'rounded-[8px] bg-[#7d5738] px-3.5 py-[9px] text-[10px] font-semibold tracking-[0.12em] text-[#f8ead0] hover:bg-[#65432a]'
            : isHomeV2Style
                ? homeV2CodeButtonClassName
                : 'bg-[#8c7b64] px-3 py-1.5 text-xs tracking-wider text-white hover:bg-[#6b5d4a]',
    );
    const secondaryTextButtonClassName = clsx(
        'transition-colors hover:text-[#433422]',
        embedded
            ? 'text-[11px] text-[#8a674a]'
            : isHomeV2Style
                ? homeV2SecondaryTextButtonClassName
                : 'text-xs text-[#8c7b64]',
    );
    const passwordToggleButtonClassName = embedded
        ? undefined
        : isHomeV2Style
            ? 'text-[#8b6646] hover:text-[#5a3923]'
            : 'text-[#8c7b64] hover:text-[#433422]';
    const passwordInputClassName = clsx(
        textInputClassName,
        isHomeV2Style && !embedded ? (isCompactHomeV2Layout ? 'pr-10' : 'pr-11') : undefined,
    );
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
            setMode(initialMode);
            onModeChange?.(initialMode);
            setAccount(remembered.account);
            setUsername(remembered.username);
            setEmail(remembered.email);
            setResetEmail(remembered.resetEmail || remembered.email || remembered.account);
            clearSensitiveFields();
        }
    }, [clearSensitiveFields, isOpen, initialMode, onModeChange]);

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

    const switchMode = (nextMode: AuthMode) => {
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
        onModeChange?.(nextMode);
        setAccount(nextRememberedFields.account);
        setEmail(nextRememberedFields.email);
        setResetEmail(nextRememberedFields.resetEmail);
        setUsername(nextRememberedFields.username);
        rememberedFieldsRef.current = nextRememberedFields;
        writeRememberedFields(nextRememberedFields);
        clearSensitiveFields();
    };

    const modalTitle = t(mode === 'login' ? 'login.title' : mode === 'register' ? 'register.title' : 'reset.title');
    const compactModalTitle = isCompactHomeV2Layout
        ? t(mode === 'login' ? 'login.title' : mode === 'register' ? 'register.title' : 'reset.title')
        : modalTitle;

    const homeV2AuthSurface = !embedded && isHomeV2Style ? (
        <HomeV2PaperModalFrame
            title={compactModalTitle}
            showHeader={showTitle}
            onClick={(event) => event.stopPropagation()}
            dataTestId="auth-modal"
            dataTextEntryAutoscroll="off"
            surfaceClassName={clsx(
                'font-serif',
                isCompactHomeV2Layout && 'home-v2-paper-modal-compact',
                isCompactHomeV2Layout ? 'w-[min(13.9rem,calc(100vw-1rem))]' : 'w-[min(32rem,calc(100vw-2rem))]',
            )}
            surfaceStyle={{
                height: isCompactHomeV2Layout
                    ? `min(calc(var(--modal-max-height, var(--runtime-modal-max-height)) - 0.5rem), ${mode === 'login' ? '14.6rem' : '16.8rem'})`
                    : undefined,
                maxHeight: isCompactHomeV2Layout
                    ? undefined
                    : 'min(var(--modal-max-height, var(--runtime-modal-max-height)), 42rem)',
            }}
            headerClassName={isCompactHomeV2Layout ? '!px-[18px] !pb-[8px] !pt-[13px]' : 'px-7 pb-3 pt-6'}
            titleClassName={isCompactHomeV2Layout ? '!text-[11.8px] !leading-[1.08] tracking-[0.075em]' : undefined}
            dividerClassName={isCompactHomeV2Layout ? '!mt-[7px] !w-[72%] gap-1.5' : undefined}
        >
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(244,228,194,0.78)] p-6 text-center backdrop-blur-[2px]"
                    >
                        <div className="mb-4 scale-50">
                            <LoadingArcaneAether />
                        </div>
                        <motion.p
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-sm font-bold tracking-[0.22em] text-[#433422]"
                        >
                            {t('button.processing')}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="relative z-10 flex min-h-0 flex-1 flex-col">
                <div
                    className={clsx(
                        'scrollbar-thin scrollbar-thumb-[#b48a63]/45 scrollbar-track-transparent',
                        isCompactHomeV2Layout && mode === 'login'
                            ? 'px-[18px] pb-0'
                            : 'min-h-0 flex-1 overflow-y-auto',
                        isCompactHomeV2Layout ? 'px-[18px] pb-0' : 'px-7 pb-0',
                    )}
                >
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 rounded-[8px] border border-[#b8785a]/50 bg-[rgba(155,58,35,0.08)] px-4 py-2 text-center text-[13px] text-[#7e3b27]"
                        >
                            {error}
                        </motion.div>
                    )}

                    <div className={clsx(mode === 'login' ? (isCompactHomeV2Layout ? 'space-y-[4.5px]' : 'space-y-4') : (isCompactHomeV2Layout ? 'space-y-[5px]' : 'space-y-3'))}>
                        {mode === 'register' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3"
                            >
                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <label className={fieldLabelClassName}>{t('email.label.address')}</label>
                                        <span className={homeV2FieldHintClassName}>{t('email.button.sendCode')}</span>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2" data-testid="auth-register-email-row">
                                        <div className="min-w-0 flex-1">
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => handleEmailChange(e.target.value)}
                                                className={textInputClassName}
                                                placeholder={t('email.placeholder.address')}
                                                required
                                                autoComplete="email"
                                                autoFocus={shouldAutoFocusInitialField}
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
                                    <label className={fieldLabelClassName}>{t('email.label.code')}</label>
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
                                className="space-y-3"
                            >
                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <label className={fieldLabelClassName}>{t('email.label.address')}</label>
                                        <span className={homeV2FieldHintClassName}>{t('email.button.sendCode')}</span>
                                    </div>
                                    <div className="flex flex-wrap items-end gap-2" data-testid="auth-reset-email-row">
                                        <div className="min-w-0 flex-1">
                                            <input
                                                type="email"
                                                value={resetEmail}
                                                onChange={(e) => handleResetEmailChange(e.target.value)}
                                                className={textInputClassName}
                                                placeholder={t('email.placeholder.address')}
                                                required
                                                autoComplete="email"
                                                autoFocus={shouldAutoFocusInitialField}
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
                                    <label className={fieldLabelClassName}>{t('email.label.code')}</label>
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
                                <label className={fieldLabelClassName}>{t('label.account')}</label>
                                <input
                                    type="text"
                                    value={account}
                                    onChange={(e) => handleAccountChange(e.target.value)}
                                    className={textInputClassName}
                                    placeholder={t('placeholder.account')}
                                    required
                                    autoComplete="username"
                                    autoFocus={shouldAutoFocusInitialField}
                                    data-testid="auth-login-account-input"
                                />
                            </div>
                        ) : mode === 'register' ? (
                            <div>
                                <label className={fieldLabelClassName}>{t('label.username')}</label>
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
                                <label className={fieldLabelClassName}>{t('label.password')}</label>
                                <PasswordField
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={passwordInputClassName}
                                    placeholder={t('placeholder.password')}
                                    required
                                    minLength={4}
                                    autoComplete="current-password"
                                    data-testid="auth-login-password-input"
                                    toggleButtonTestId="auth-login-password-toggle"
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                    iconSize={isCompactHomeV2Layout ? 9 : undefined}
                                />
                            </div>
                        )}

                        {mode === 'register' && (
                            <div>
                                <label className={fieldLabelClassName}>{t('label.password')}</label>
                                <PasswordField
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={passwordInputClassName}
                                    placeholder={t('placeholder.password')}
                                    required
                                    minLength={4}
                                    autoComplete="new-password"
                                    data-testid="auth-register-password-input"
                                    toggleButtonTestId="auth-register-password-toggle"
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                    iconSize={isCompactHomeV2Layout ? 9 : undefined}
                                />
                            </div>
                        )}

                        {mode === 'reset' && (
                            <div>
                                <label className={fieldLabelClassName}>{t('label.newPassword')}</label>
                                <PasswordField
                                    value={resetNewPassword}
                                    onChange={(e) => setResetNewPassword(e.target.value)}
                                    className={passwordInputClassName}
                                    placeholder={t('placeholder.password')}
                                    required
                                    minLength={4}
                                    autoComplete="new-password"
                                    data-testid="auth-reset-new-password-input"
                                    toggleButtonTestId="auth-reset-new-password-toggle"
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                    iconSize={isCompactHomeV2Layout ? 9 : undefined}
                                />
                            </div>
                        )}

                        {mode === 'register' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                <label className={fieldLabelClassName}>{t('label.confirmPassword')}</label>
                                <PasswordField
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={passwordInputClassName}
                                    placeholder={t('placeholder.password')}
                                    required
                                    minLength={4}
                                    autoComplete="new-password"
                                    data-testid="auth-register-confirm-password-input"
                                    toggleButtonTestId="auth-register-confirm-password-toggle"
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                    iconSize={isCompactHomeV2Layout ? 9 : undefined}
                                />
                            </motion.div>
                        )}

                        {mode === 'reset' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                <label className={fieldLabelClassName}>{t('label.confirmPassword')}</label>
                                <PasswordField
                                    value={resetConfirmPassword}
                                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                                    className={passwordInputClassName}
                                    placeholder={t('placeholder.password')}
                                    required
                                    minLength={4}
                                    autoComplete="new-password"
                                    data-testid="auth-reset-confirm-password-input"
                                    toggleButtonTestId="auth-reset-confirm-password-toggle"
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                    iconSize={isCompactHomeV2Layout ? 9 : undefined}
                                />
                            </motion.div>
                        )}

                        {mode === 'login' && !isCompactHomeV2Layout && (
                            <div className="text-right">
                                <button
                                    type="button"
                                    onClick={() => switchMode('reset')}
                                    className={secondaryTextButtonClassName}
                                    data-testid="auth-login-forgot-button"
                                >
                                    {t('login.forgot')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className={clsx(
                    'shrink-0',
                    isCompactHomeV2Layout ? 'px-[18px] pb-[10px] pt-[3px]' : 'border-t border-[#8c5f3e]/24 px-7 pb-6 pt-4',
                )}>
                    {mode === 'login' && isCompactHomeV2Layout ? (
                        <div className="mb-[6px] text-right leading-none">
                            <button
                                type="button"
                                onClick={() => switchMode('reset')}
                                className={secondaryTextButtonClassName}
                                data-testid="auth-login-forgot-button"
                            >
                                {t('login.forgot')}
                            </button>
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={clsx('w-full', homeV2PrimaryButtonClassName)}
                        data-testid="auth-submit-button"
                        >
                            {isLoading
                                ? t('button.processing')
                                : t(mode === 'login' ? 'login.submit' : mode === 'register' ? 'register.submit' : 'reset.submit')}
                    </button>

                    {showModeSwitchFooter ? (
                        <div className={clsx('flex flex-col items-center', isCompactHomeV2Layout ? 'mt-[7px] gap-[4px]' : 'mt-4 gap-3')}>
                            <div className={clsx('flex items-center justify-center', isCompactHomeV2Layout ? 'gap-2 text-[8px] leading-none' : 'gap-4')}>
                                <button
                                    type="button"
                                    onClick={() => mode !== 'login' && switchMode('login')}
                                    className={getHomeV2PaperFooterTabClassName(mode === 'login')}
                                    data-testid="auth-switch-login"
                                >
                                    <span className="relative z-10">{t('menu.login')}</span>
                                    <span className="underline-center h-[1px] opacity-60" />
                                </button>
                                <div className="h-3 w-px bg-[#c0a080] opacity-40" />
                                <button
                                    type="button"
                                    onClick={() => mode !== 'register' && switchMode('register')}
                                    className={getHomeV2PaperFooterTabClassName(mode === 'register')}
                                    data-testid="auth-switch-register"
                                >
                                    <span className="relative z-10">{t('menu.register')}</span>
                                    <span className="underline-center h-[1px] opacity-60" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </form>
        </HomeV2PaperModalFrame>
    ) : null;

    const legacyAuthSurface = (
        <div
            className={clsx(
                'pointer-events-auto relative flex flex-col overflow-hidden border',
                embedded
                    ? 'mx-auto h-full w-full max-h-full max-w-[560px] rounded-none border-transparent bg-transparent shadow-none'
                    : 'mx-4 w-[calc(100vw-2rem)] max-w-[400px] max-h-[var(--modal-max-height,var(--runtime-modal-max-height))] rounded-sm border-[#e5e0d0] bg-[#fcfbf9] shadow-[0_10px_40px_rgba(67,52,34,0.1)]',
                !embedded && (isRightPlacement ? 'ml-4 mr-2 md:mr-4' : 'mx-4'),
            )}
            style={undefined}
            data-testid={embedded ? 'auth-embedded-panel' : 'auth-modal'}
        >
            {isClassicStandalone ? (
                <>
                    <div className="absolute left-2 top-2 h-3 w-3 border-l border-t border-[#c0a080]" />
                    <div className="absolute right-2 top-2 h-3 w-3 border-r border-t border-[#c0a080]" />
                    <div className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[#c0a080]" />
                    <div className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[#c0a080]" />
                </>
            ) : null}
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={clsx(
                            'absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center backdrop-blur-[2px]',
                            embedded ? 'bg-[#fcfbf9]/80' : 'bg-[#f0dfb8]/82',
                        )}
                    >
                        <div className="mb-4 scale-50">
                            <LoadingArcaneAether />
                        </div>
                        <motion.p
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-sm font-bold tracking-widest text-[#433422]"
                        >
                            {t('button.processing')}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {showTitle ? (
                <div className={clsx('shrink-0 text-center', embedded ? 'px-0 pb-3 pt-0' : 'px-6 pb-4 pt-6 sm:px-10 sm:pb-6 sm:pt-10')}>
                    <h2 className={clsx('font-serif font-bold tracking-wide text-[#433422]', embedded ? 'mb-0 text-[15px]' : 'mb-2 text-2xl')}>
                        {modalTitle}
                    </h2>
                    {!embedded ? (
                        <div className="mx-auto h-px w-12 bg-[#c0a080] opacity-50" />
                    ) : null}
                </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col font-serif">
                <div className={clsx('scrollbar-thin scrollbar-thumb-[#b48a63]/45 scrollbar-track-transparent min-h-0', embedded ? 'flex-1 overflow-y-auto px-0 pb-1' : 'flex-1 overflow-y-auto px-6 pb-4 sm:px-10 sm:pb-6')}>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={clsx('font-serif text-center', embedded ? 'mb-4 rounded-[10px] border border-[#d4ab90] bg-[rgba(164,78,48,0.08)] px-3 py-2 text-[11px] text-[#8d4f35]' : 'mb-6 border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600')}
                        >
                            {error}
                        </motion.div>
                    )}

                    <div className={embedded ? 'space-y-[18px]' : 'space-y-5'}>
                        {mode === 'register' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={clsx(embedded ? 'space-y-[14px]' : 'space-y-5')}>
                                <div>
                                    <label className={fieldLabelClassName}>{t('email.label.address')}</label>
                                    <div className="flex flex-wrap items-end gap-2" data-testid="auth-register-email-row">
                                        <div className="min-w-0 flex-1">
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => handleEmailChange(e.target.value)}
                                                className={textInputClassName}
                                                placeholder={t('email.placeholder.address')}
                                                required
                                                autoComplete="email"
                                                autoFocus={!embedded}
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
                                    <label className={fieldLabelClassName}>{t('email.label.code')}</label>
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
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={clsx(embedded ? 'space-y-[14px]' : 'space-y-5')}>
                                <div>
                                    <label className={fieldLabelClassName}>{t('email.label.address')}</label>
                                    <div className="flex flex-wrap items-end gap-2" data-testid="auth-reset-email-row">
                                        <div className="min-w-0 flex-1">
                                            <input
                                                type="email"
                                                value={resetEmail}
                                                onChange={(e) => handleResetEmailChange(e.target.value)}
                                                className={textInputClassName}
                                                placeholder={t('email.placeholder.address')}
                                                required
                                                autoComplete="email"
                                                autoFocus={!embedded}
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
                                    <label className={fieldLabelClassName}>{t('email.label.code')}</label>
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
                                <label className={fieldLabelClassName}>{t('label.account')}</label>
                                <input
                                    type="text"
                                    value={account}
                                    onChange={(e) => handleAccountChange(e.target.value)}
                                    className={textInputClassName}
                                    placeholder={t('placeholder.account')}
                                    required
                                    autoComplete="username"
                                    autoFocus={!embedded}
                                    data-testid="auth-login-account-input"
                                />
                            </div>
                        ) : mode === 'register' ? (
                            <div>
                                <label className={fieldLabelClassName}>{t('label.username')}</label>
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
                                <label className={fieldLabelClassName}>{t('label.password')}</label>
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
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                />
                            </div>
                        )}

                        {mode === 'register' && (
                            <div>
                                <label className={fieldLabelClassName}>{t('label.password')}</label>
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
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                />
                            </div>
                        )}

                        {mode === 'reset' && (
                            <div>
                                <label className={fieldLabelClassName}>{t('label.newPassword')}</label>
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
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                />
                            </div>
                        )}

                        {mode === 'register' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                <label className={fieldLabelClassName}>{t('label.confirmPassword')}</label>
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
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                />
                            </motion.div>
                        )}

                        {mode === 'reset' && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                <label className={fieldLabelClassName}>{t('label.confirmPassword')}</label>
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
                                    toggleButtonClassName={passwordToggleButtonClassName}
                                />
                            </motion.div>
                        )}

                        {mode === 'login' && (
                            <div className="text-right">
                                <button
                                    type="button"
                                    onClick={() => switchMode('reset')}
                                    className={secondaryTextButtonClassName}
                                    data-testid="auth-login-forgot-button"
                                >
                                    {t('login.forgot')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className={clsx('shrink-0', embedded ? 'border-t-0 bg-transparent px-0 py-4' : 'bg-transparent px-6 pb-6 pt-4 sm:px-10 sm:pb-8')}>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={clsx(
                            'cursor-pointer font-bold uppercase tracking-widest text-[#fcfbf9] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70',
                            embedded
                                ? 'rounded-[10px] bg-[#433422] py-3 text-[12px] shadow-[0_8px_18px_rgba(67,52,34,0.16)] hover:bg-[#2b2114]'
                                : 'w-full rounded-[5px] bg-[#433422] py-3 text-[13px] tracking-[0.2em] shadow-[0_8px_20px_rgba(67,52,34,0.18)] hover:bg-[#2b2114]',
                        )}
                        data-testid="auth-submit-button"
                    >
                        {isLoading
                            ? t('button.processing')
                            : t(mode === 'login' ? 'login.submit' : mode === 'register' ? 'register.submit' : 'reset.submit')}
                    </button>

                    {showModeSwitchFooter ? (
                        <div className="mt-5 flex flex-col items-center gap-4 text-sm font-serif italic">
                            {!embedded ? (
                                <div className="mx-auto h-px w-12 bg-[#c0a080] opacity-35" />
                            ) : null}
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => mode !== 'login' && switchMode('login')}
                                    className={clsx('group relative cursor-pointer px-1 py-1 transition-colors', mode === 'login' ? 'font-bold text-[#433422]' : 'text-[#8c7b64] hover:text-[#433422]')}
                                    data-testid="auth-switch-login"
                                >
                                    <span className="relative z-10">{t('menu.login')}</span>
                                    <span className="underline-center h-[1px] opacity-60" />
                                </button>
                                <div className="h-3 w-px bg-[#c0a080] opacity-40" />
                                <button
                                    type="button"
                                    onClick={() => mode !== 'register' && switchMode('register')}
                                    className={clsx('group relative cursor-pointer px-1 py-1 transition-colors', mode === 'register' ? 'font-bold text-[#433422]' : 'text-[#8c7b64] hover:text-[#433422]')}
                                    data-testid="auth-switch-register"
                                >
                                    <span className="relative z-10">{t('menu.register')}</span>
                                    <span className="underline-center h-[1px] opacity-60" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </form>
        </div>
    );

    const authSurface = homeV2AuthSurface ?? legacyAuthSurface;

    if (embedded) {
        return authSurface;
    }

    const modalElement = (
        <ModalBase
            onClose={onClose}
            closeOnBackdrop={closeOnBackdrop}
            preserveKeyboardLayout
            disableTextEntryAutoscroll={!isHomeV2Style}
            containerClassName="p-0"
            overlayClassName={isHomeV2Style ? '!bg-[rgba(18,13,9,0.56)] !backdrop-blur-[2px]' : 'bg-[rgba(18,13,9,0.50)] backdrop-blur-[3px]'}
            overlayStyle={isHomeV2Style ? { backgroundColor: 'rgba(18, 13, 9, 0.56)', backdropFilter: 'blur(2px)' } : undefined}
            containerStyle={{
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: isHomeV2Style
                    ? 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))'
                    : 'max(1rem, var(--runtime-modal-bottom-inset))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            }}
            contentWrapperClassName={isRightPlacement ? 'justify-end' : undefined}
            visualStyle={isHomeV2Style ? 'home-v2' : 'default'}
        >
            {authSurface}
        </ModalBase>
    );

    return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};
