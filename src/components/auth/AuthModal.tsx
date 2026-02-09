import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { ModalBase } from '../common/overlays/ModalBase';
import { LoadingArcaneAether } from '../system/LoadingVariants';
import { AnimatePresence } from 'framer-motion';

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

    const { t } = useTranslation('auth');
    const { login, register, sendRegisterCode, sendResetCode, resetPassword: resetPasswordAction } = useAuth();

    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
            setError('');
            setAccount('');
            setUsername('');
            setEmail('');
            setCode('');
            setPassword('');
            setConfirmPassword('');
            setCodeSent(false);
            setCountdown(0);
            setResetEmail('');
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
        }
    }, [isOpen, initialMode]);

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
            setError(err instanceof Error ? err.message : t('email.error.sendFailed'));
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
            setError(err instanceof Error ? err.message : t('error.operationFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = (nextMode: 'login' | 'register' | 'reset') => {
        setMode(nextMode);
        setError('');
        setCodeSent(false);
        setCountdown(0);
        setResetCodeSent(false);
        setResetCountdown(0);
        setAccount('');
        setUsername('');
        setEmail('');
        setCode('');
        setPassword('');
        setConfirmPassword('');
        setResetEmail('');
        setResetCode('');
        setResetNewPassword('');
        setResetConfirmPassword('');
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        if (resetCountdownRef.current) {
            clearInterval(resetCountdownRef.current);
            resetCountdownRef.current = null;
        }
    };

    return (
        <ModalBase
            onClose={onClose}
            closeOnBackdrop={closeOnBackdrop}
            containerClassName="p-0"
        >
            <div className="bg-[#fcfbf9] pointer-events-auto w-[calc(100vw-2rem)] max-w-[400px] shadow-[0_10px_40px_rgba(67,52,34,0.1)] border border-[#e5e0d0] p-6 sm:p-10 relative rounded-sm mx-4 overflow-hidden">
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

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-serif font-bold text-[#433422] tracking-wide mb-2">
                        {t(mode === 'login' ? 'login.title' : mode === 'register' ? 'register.title' : 'reset.title')}
                    </h2>
                    <div className="h-px w-12 bg-[#c0a080] mx-auto opacity-50" />
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-2 mb-6 font-serif text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 font-serif">
                    {mode === 'register' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-5"
                        >
                            <div>
                                <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                    {t('email.label.address')}
                                </label>
                                <div className="flex gap-2 items-end">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="flex-1 px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                        placeholder={t('email.placeholder.address')}
                                        required
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendCode}
                                        disabled={isSendingCode || countdown > 0}
                                        className="px-3 py-1.5 bg-[#8c7b64] hover:bg-[#6b5d4a] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
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
                                <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                    {t('email.label.code')}
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                    placeholder={t('email.placeholder.code')}
                                    required
                                    maxLength={6}
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
                                <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                    {t('email.label.address')}
                                </label>
                                <div className="flex gap-2 items-end">
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        className="flex-1 px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                        placeholder={t('email.placeholder.address')}
                                        required
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendResetCode}
                                        disabled={isSendingResetCode || resetCountdown > 0}
                                        className="px-3 py-1.5 bg-[#8c7b64] hover:bg-[#6b5d4a] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
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
                                <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                    {t('email.label.code')}
                                </label>
                                <input
                                    type="text"
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                    className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                    placeholder={t('email.placeholder.code')}
                                    required
                                    maxLength={6}
                                />
                            </div>
                        </motion.div>
                    )}

                    {mode === 'login' ? (
                        <div>
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('label.account')}
                            </label>
                            <input
                                type="text"
                                value={account}
                                onChange={(e) => setAccount(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                placeholder={t('placeholder.account')}
                                required
                                autoFocus
                            />
                        </div>
                    ) : mode === 'register' ? (
                        <div>
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('label.username')}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                placeholder={t('placeholder.username')}
                                required
                            />
                        </div>
                    ) : null}

                    {mode === 'login' && (
                        <div>
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('label.password')}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                placeholder={t('placeholder.password')}
                                required
                                minLength={4}
                            />
                        </div>
                    )}

                    {mode === 'register' && (
                        <div>
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('label.password')}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                placeholder={t('placeholder.password')}
                                required
                                minLength={4}
                            />
                        </div>
                    )}

                    {mode === 'reset' && (
                        <div>
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('label.newPassword')}
                            </label>
                            <input
                                type="password"
                                value={resetNewPassword}
                                onChange={(e) => setResetNewPassword(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-sm sm:text-lg"
                                placeholder={t('placeholder.password')}
                                required
                                minLength={4}
                            />
                        </div>
                    )}

                    {mode === 'register' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                        >
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('label.confirmPassword')}
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-lg"
                                placeholder={t('placeholder.password')}
                                required
                                minLength={4}
                            />
                        </motion.div>
                    )}

                    {mode === 'reset' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                        >
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('label.confirmPassword')}
                            </label>
                            <input
                                type="password"
                                value={resetConfirmPassword}
                                onChange={(e) => setResetConfirmPassword(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-lg"
                                placeholder={t('placeholder.password')}
                                required
                                minLength={4}
                            />
                        </motion.div>
                    )}

                    {mode === 'login' && (
                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => switchMode('reset')}
                                className="text-xs text-[#8c7b64] hover:text-[#433422] transition-colors"
                            >
                                {t('login.forgot')}
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-[#433422] hover:bg-[#2b2114] text-[#fcfbf9] font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4 cursor-pointer"
                    >
                        {isLoading
                            ? t('button.processing')
                            : t(mode === 'login' ? 'login.submit' : mode === 'register' ? 'register.submit' : 'reset.submit')}
                    </button>
                </form>

                <div className="mt-6 flex items-center justify-center gap-4 text-sm font-serif italic pb-2">
                    <button
                        type="button"
                        onClick={() => mode !== 'login' && switchMode('login')}
                        className={clsx(
                            "group relative cursor-pointer transition-colors px-1 py-1",
                            mode === 'login' ? "text-[#433422] font-bold" : "text-[#8c7b64] hover:text-[#433422]"
                        )}
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
                    >
                        <span className="relative z-10">{t('menu.register')}</span>
                        <span className="underline-center h-[1px] opacity-60" />
                    </button>
                </div>
            </div>
        </ModalBase>
    );
};
