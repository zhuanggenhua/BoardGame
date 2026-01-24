import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ModalBase } from '../common/overlays/ModalBase';

interface EmailBindModalProps {
    isOpen: boolean;
    onClose: () => void;
    closeOnBackdrop?: boolean;
}

export const EmailBindModal = ({ isOpen, onClose, closeOnBackdrop }: EmailBindModalProps) => {
    const { user, sendEmailCode, verifyEmail } = useAuth();
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'input' | 'verify'>('input');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const { t } = useTranslation(['auth', 'common']);

    // 模态框打开时重置状态
    useEffect(() => {
        if (isOpen) {
            setEmail(user?.email || '');
            setCode('');
            setStep('input');
            setError('');
            setCountdown(0);
        }
    }, [isOpen, user]);

    // 倒计时定时器
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendCode = async () => {
        if (!email) {
            setError(t('email.error.missingEmail'));
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            await sendEmailCode(email);
            setStep('verify');
            setCountdown(60);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('email.error.sendFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!code) {
            setError(t('email.error.missingCode'));
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            await verifyEmail(email, code);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('email.error.verifyFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0) return;
        await handleSendCode();
    };

    return (
        <ModalBase
            open={isOpen}
            onClose={onClose}
            closeOnBackdrop={closeOnBackdrop}
            containerClassName="p-4 sm:p-6"
        >
            <div className="bg-[#fcfbf9] pointer-events-auto w-full max-w-[340px] sm:max-w-sm shadow-[0_10px_40px_rgba(67,52,34,0.1)] border border-[#e5e0d0] p-6 sm:p-8 relative rounded-sm">
                {/* 装饰性边角 */}
                <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#c0a080]" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#c0a080]" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#c0a080]" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#c0a080]" />

                {/* 页眉 */}
                <div className="text-center mb-6">
                    <h2 className="text-xl font-serif font-bold text-[#433422] tracking-wide mb-2">
                        {user?.emailVerified ? t('email.title.change') : t('email.title.bind')}
                    </h2>
                    <div className="h-px w-12 bg-[#c0a080] mx-auto opacity-50" />
                    {user?.email && user?.emailVerified && (
                        <p className="text-xs text-[#8c7b64] mt-3">
                            {t('email.current', { email: user.email })}
                        </p>
                    )}
                </div>

                {/* 错误提示 */}
                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-2 mb-6 font-serif text-center rounded-sm">
                        {error}
                    </div>
                )}

                {/* 步骤 1：邮箱输入 */}
                {step === 'input' && (
                    <div className="space-y-5 font-serif">
                        <div>
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('email.label.address')}
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-base sm:text-lg"
                                placeholder={t('email.placeholder.address')}
                                required
                                autoFocus
                            />
                        </div>

                        <button
                            onClick={handleSendCode}
                            disabled={isLoading}
                            className="w-full py-3 bg-[#433422] hover:bg-[#2b2114] text-[#fcfbf9] font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4 cursor-pointer"
                        >
                            {isLoading ? t('email.button.sending') : t('email.button.sendCode')}
                        </button>
                    </div>
                )}

                {/* 步骤 2：验证码验证 */}
                {step === 'verify' && (
                    <div className="space-y-5 font-serif">
                        <p className="text-sm text-[#8c7b64] text-center">
                            {t('email.message.sentTo', { email })}
                        </p>

                        <div>
                            <label className="block text-xs font-bold text-[#8c7b64] uppercase tracking-wider mb-2">
                                {t('email.label.code')}
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full px-0 py-2 bg-transparent border-b-2 border-[#e5e0d0] text-[#433422] placeholder-[#c0a080]/50 outline-none focus:border-[#433422] transition-colors text-2xl text-center tracking-[0.5em] font-mono"
                                placeholder={t('email.placeholder.code')}
                                maxLength={6}
                                required
                                autoFocus
                            />
                        </div>

                        <button
                            onClick={handleVerify}
                            disabled={isLoading || code.length !== 6}
                            className="w-full py-3 bg-[#433422] hover:bg-[#2b2114] text-[#fcfbf9] font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4 cursor-pointer"
                        >
                            {isLoading ? t('email.button.verifying') : t('email.button.confirm')}
                        </button>

                        <div className="text-center">
                            <button
                                onClick={handleResend}
                                disabled={countdown > 0}
                                className="text-sm text-[#8c7b64] hover:text-[#433422] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {countdown > 0
                                    ? t('email.button.resendCountdown', { count: countdown })
                                    : t('email.button.resend')}
                            </button>
                        </div>
                    </div>
                )}

                {/* 取消按钮 */}
                <div className="mt-6 text-center">
                    <button
                        onClick={onClose}
                        className="text-sm text-[#8c7b64] hover:text-[#433422] underline decoration-1 underline-offset-4 transition-colors cursor-pointer font-serif italic"
                    >
                        {t('common:button.cancel')}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
};
