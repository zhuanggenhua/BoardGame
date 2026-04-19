import { useEffect, useMemo, useRef, useState } from 'react';
import { X, MessageSquareWarning, Send, Loader2, AlertTriangle, Lightbulb, HelpCircle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { cn } from '../../lib/utils';
import { FEEDBACK_API_URL as API_URL } from '../../config/server';
import { UI_Z_INDEX } from '../../core';
import { GAME_MANIFEST } from '../../games/manifest.generated';
import { getLastErrorContext } from '../../lib/feedback/errorContext';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';

interface FeedbackRuntimeContext {
    mode?: 'online' | 'local' | 'tutorial';
    matchId?: string;
    playerId?: string | null;
    gameId?: string;
}
interface FeedbackModalProps {
    onClose: () => void;
    /** 游戏内操作日志（纯文本，由 GameHUD 传入） */
    actionLogText?: string;
    /** 完整游戏状态 JSON（用于精确复现问题） */
    stateSnapshot?: string;
    runtimeContext?: FeedbackRuntimeContext;
}

const FeedbackType = {
    BUG: 'bug',
    SUGGESTION: 'suggestion',
    OTHER: 'other'
} as const;

type FeedbackType = typeof FeedbackType[keyof typeof FeedbackType];

const FeedbackSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const;

type FeedbackSeverity = typeof FeedbackSeverity[keyof typeof FeedbackSeverity];

const FEEDBACK_TYPE_LABEL_KEYS: Record<FeedbackType, string> = {
    [FeedbackType.BUG]: 'hud.feedback.type.bug',
    [FeedbackType.SUGGESTION]: 'hud.feedback.type.suggestion',
    [FeedbackType.OTHER]: 'hud.feedback.type.other',
};

const FEEDBACK_SEVERITY_LABEL_KEYS: Record<FeedbackSeverity, string> = {
    [FeedbackSeverity.LOW]: 'hud.feedback.severity.low',
    [FeedbackSeverity.MEDIUM]: 'hud.feedback.severity.medium',
    [FeedbackSeverity.HIGH]: 'hud.feedback.severity.high',
    [FeedbackSeverity.CRITICAL]: 'hud.feedback.severity.critical',
};

export const FeedbackModal = ({ onClose, actionLogText, stateSnapshot, runtimeContext }: FeedbackModalProps) => {
    const { t } = useTranslation(['game', 'common']);
    const { token } = useAuth();
    const { success, error } = useToast();
    const location = useLocation();
    const backdropRef = useRef<HTMLDivElement>(null);
    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root') ?? document.body;
    }, []);

    const [content, setContent] = useState('');
    const [type, setType] = useState<FeedbackType>(FeedbackType.BUG);
    const [severity, setSeverity] = useState<FeedbackSeverity>(FeedbackSeverity.LOW);
    const [contactInfo, setContactInfo] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [pastedImage, setPastedImage] = useState<string | null>(null);
    const [attachLog, setAttachLog] = useState(!!actionLogText);
    const [attachState, setAttachState] = useState(!!stateSnapshot);
    const [isCompactLandscape, setIsCompactLandscape] = useState(false);
    const shouldShowGameSelector = !runtimeContext?.gameId;
    const fieldLabelClassName = cn(
        'font-bold text-parchment-light-text uppercase tracking-wider',
        isCompactLandscape ? 'text-[11px]' : 'text-xs',
    );
    const fieldGroupClassName = isCompactLandscape ? 'space-y-1.5' : 'space-y-2';
    const formControlClassName = cn(
        'w-full bg-parchment-card-bg border border-parchment-brown/20 text-parchment-base-text text-base sm:text-sm rounded-lg focus:ring-parchment-gold focus:border-parchment-gold block transition-colors outline-none placeholder:text-parchment-light-text/50',
        isCompactLandscape ? 'p-2' : 'p-2.5',
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncCompactLandscape = () => {
            setIsCompactLandscape(window.innerWidth > window.innerHeight && window.innerHeight <= 430);
        };

        syncCompactLandscape();
        window.addEventListener('resize', syncCompactLandscape);
        window.addEventListener('orientationchange', syncCompactLandscape);
        return () => {
            window.removeEventListener('resize', syncCompactLandscape);
            window.removeEventListener('orientationchange', syncCompactLandscape);
        };
    }, []);

    // 游戏内自动注入 gameId，非游戏页面允许手动选择
    const isInGame = location.pathname.startsWith('/play/');
    const autoGameId = isInGame ? (location.pathname.split('/')[2] || '') : '';
    const [gameName, setGameName] = useState(autoGameId);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (backdropRef.current === e.target) {
            onClose();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) {
                    compressImage(blob).then((dataUrl) => {
                        setPastedImage(dataUrl);
                    });
                }
                return;
            }
        }
    };

    const clearImage = () => setPastedImage(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && !pastedImage) return;

        setSubmitting(true);
        try {
            // Append image to content as Markdown if present
            let finalContent = content;
            if (pastedImage) {
                finalContent += `\n\n![Screenshot](${pastedImage})`;
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            
            // 如果用户已登录，附带 Authorization header
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const lastErrorContext = getLastErrorContext();
            const route = `${location.pathname}${location.search}${location.hash}`;
            const fallbackMode = (typeof window !== 'undefined'
                ? ((window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__)
                : undefined);
            const clientContext = {
                route: route || undefined,
                mode: runtimeContext?.mode ?? (fallbackMode as 'online' | 'local' | 'tutorial' | undefined),
                matchId: runtimeContext?.matchId,
                playerId: runtimeContext?.playerId ?? undefined,
                gameId: (runtimeContext?.gameId ?? gameName) || undefined,
                appVersion: import.meta.env.VITE_APP_VERSION || import.meta.env.MODE || undefined,
                userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
                viewport: (typeof window !== 'undefined')
                    ? { width: window.innerWidth, height: window.innerHeight }
                    : undefined,
                language: (typeof navigator !== 'undefined' ? navigator.language : undefined),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
            };

            const errorContext = lastErrorContext
                ? {
                    message: lastErrorContext.message,
                    name: lastErrorContext.name,
                    stack: lastErrorContext.stack,
                    source: lastErrorContext.source,
                }
                : undefined;

            const res = await fetch(`${API_URL}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    content: finalContent,
                    type,
                    severity,
                    gameName: gameName || undefined,
                    contactInfo: contactInfo || undefined,
                    actionLog: (attachLog && actionLogText) ? actionLogText : undefined,
                    stateSnapshot: (attachState && stateSnapshot) ? stateSnapshot : undefined,
                    clientContext,
                    errorContext,
                })
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => null) as { error?: string; message?: string } | null;
                throw new Error(
                    payload?.error
                    || payload?.message
                    || t('hud.feedback.errors.submitFailed')
                );
            }

            success(t('hud.feedback.success'));
            onClose();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : t('hud.feedback.errors.submitFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    const getTypeIcon = (typeValue: FeedbackType) => {
        switch (typeValue) {
            case FeedbackType.BUG: return <AlertTriangle size={16} />;
            case FeedbackType.SUGGESTION: return <Lightbulb size={16} />;
            default: return <HelpCircle size={16} />;
        }
    };

    const modal = (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className={cn(
                'modal-base-container fixed inset-0 flex justify-center bg-black/60 backdrop-blur-sm p-4 font-serif',
                isCompactLandscape ? 'items-start' : 'items-center',
            )}
            data-testid="feedback-modal"
            style={{
                zIndex: UI_Z_INDEX.modalContent,
                paddingTop: isCompactLandscape ? 'max(0.5rem, var(--safe-area-top))' : 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: isCompactLandscape ? 'max(0.5rem, var(--runtime-modal-bottom-inset))' : 'max(1rem, var(--runtime-modal-bottom-inset))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            }}
            role="dialog"
            aria-modal="true"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={cn(
                    'bg-parchment-base-bg rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border-2 border-parchment-brown/30',
                    isCompactLandscape && 'max-w-[40rem]',
                )}
                style={{ maxHeight: 'var(--runtime-modal-max-height)' }}
            >
                {/* Header */}
                <div className={cn(
                    'bg-parchment-brown flex items-center justify-between shrink-0 border-b border-parchment-gold/20',
                    isCompactLandscape ? 'px-4 py-2.5' : 'px-6 py-4',
                )}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-parchment-gold/20 rounded-lg text-parchment-cream">
                            <MessageSquareWarning size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-parchment-cream tracking-wide">{t('hud.feedback.title')}</h2>
                            <p className="text-xs text-parchment-cream/70">{t('hud.feedback.subtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-parchment-cream/60 hover:text-parchment-cream hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                    <div className={cn(
                        'overflow-y-auto scrollbar-thin flex-1 min-h-0',
                        isCompactLandscape ? 'p-3 space-y-2.5' : 'p-6 space-y-4',
                    )}>
                    {/* Game Selection */}
                    {shouldShowGameSelector && (
                        <div className={fieldGroupClassName}>
                            <label className={fieldLabelClassName}>{t('hud.feedback.gameLabel')}</label>
                            <select
                                value={gameName}
                                onChange={(e) => setGameName(e.target.value)}
                                className={formControlClassName}
                            >
                                <option value="">{t('hud.feedback.gameAll')}</option>
                                {GAME_MANIFEST
                                    .filter(g => g.type === 'game' && g.enabled)
                                    .map(g => (
                                        <option key={g.id} value={g.id}>{resolveGameDisplayName(g, t, g.id)}</option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    <div className={cn('grid grid-cols-2', isCompactLandscape ? 'gap-3' : 'gap-4')} data-testid="feedback-mobile-fields-grid">
                        {/* Type Selection */}
                        <div className={fieldGroupClassName}>
                            <label className={fieldLabelClassName}>{t('hud.feedback.typeLabel')}</label>
                            <div className="flex bg-parchment-card-bg p-1 rounded-lg border border-parchment-brown/20" data-testid="feedback-type-group">
                                {Object.values(FeedbackType).map((typeValue) => (
                                    <button
                                        key={typeValue}
                                        type="button"
                                        onClick={() => setType(typeValue)}
                                        className={cn(
                                            'flex-1 flex items-center justify-center rounded-md font-bold transition-all',
                                            isCompactLandscape ? 'py-1.5 gap-1 text-[11px]' : 'py-2 gap-1.5 text-xs',
                                            type === typeValue
                                                ? 'bg-parchment-brown text-parchment-cream shadow-sm'
                                                : 'text-parchment-light-text hover:text-parchment-base-text hover:bg-parchment-brown/10'
                                        )}
                                    >
                                        {getTypeIcon(typeValue)}
                                        <span>{t(FEEDBACK_TYPE_LABEL_KEYS[typeValue])}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Severity Selection */}
                        <div className={fieldGroupClassName}>
                            <label className={fieldLabelClassName}>{t('hud.feedback.severityLabel')}</label>
                            <select
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)}
                                className={formControlClassName}
                            >
                                {Object.values(FeedbackSeverity).map((severityValue) => (
                                    <option key={severityValue} value={severityValue}>{t(FEEDBACK_SEVERITY_LABEL_KEYS[severityValue])}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Content */}
                    <div className={fieldGroupClassName}>
                        <label className={fieldLabelClassName}>{t('hud.feedback.contentLabel')}</label>
                        <div className="relative">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onPaste={handlePaste}
                                rows={isCompactLandscape ? 2 : 4}
                                className={cn(
                                    'block w-full text-base sm:text-sm text-parchment-base-text bg-parchment-card-bg rounded-lg border border-parchment-brown/20 focus:ring-parchment-gold focus:border-parchment-gold resize-none outline-none placeholder:text-parchment-light-text/50',
                                    isCompactLandscape ? 'p-2.5' : 'p-3',
                                )}
                                placeholder={t('hud.feedback.contentPlaceholder')}
                                required={!pastedImage}
                            ></textarea>
                            {/* Paste Hint */}
                            {!pastedImage && !content && (
                                <div className="absolute bottom-3 right-3 text-[10px] text-parchment-light-text/60 pointer-events-none flex items-center gap-1">
                                    <ImageIcon size={12} />
                                    <span>{t('hud.feedback.pasteHint')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Image Preview */}
                    <AnimatePresence>
                        {pastedImage && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="relative group rounded-lg overflow-hidden border border-parchment-brown/20 bg-parchment-card-bg"
                            >
                                <img src={pastedImage} alt={t('hud.feedback.imageAlt')} className="w-full h-auto max-h-48 object-contain bg-black/5" />
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                                    title={t('hud.feedback.deleteImage')}
                                >
                                    <Trash2 size={14} />
                                </button>
                                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded backdrop-blur-sm">
                                    {t('hud.feedback.imageAdded')}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 附带操作日志 */}
                    {actionLogText && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={attachLog}
                                onChange={(e) => setAttachLog(e.target.checked)}
                                className="rounded border-parchment-brown/30 text-parchment-brown focus:ring-parchment-gold"
                            />
                            <span className="text-xs font-bold text-parchment-light-text uppercase tracking-wider">
                                {t('hud.feedback.attachLog')}
                            </span>
                        </label>
                    )}

                    {/* 附带状态快照 */}
                    {stateSnapshot && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={attachState}
                                onChange={(e) => setAttachState(e.target.checked)}
                                className="rounded border-parchment-brown/30 text-parchment-brown focus:ring-parchment-gold"
                            />
                            <span className="text-xs font-bold text-parchment-light-text uppercase tracking-wider">
                                {t('hud.feedback.attachState')}
                            </span>
                        </label>
                    )}

                    {/* Contact Info */}
                    <div className={fieldGroupClassName}>
                        <label className={fieldLabelClassName}>{t('hud.feedback.contactLabel')}</label>
                        <input
                            type="text"
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            className={formControlClassName}
                            placeholder={t('hud.feedback.contactPlaceholder')}
                        />
                    </div>

                    </div>

                    {/* 提交按钮固定在底部，不随内容滚动 */}
                    <div className={cn(
                        'border-t border-parchment-brown/10 flex justify-end shrink-0 bg-parchment-base-bg',
                        isCompactLandscape ? 'px-4 py-2.5' : 'px-6 py-4',
                    )}>
                        <button
                            type="submit"
                            disabled={submitting || (!content.trim() && !pastedImage)}
                            className="flex items-center gap-2 px-6 py-2 bg-parchment-brown hover:bg-parchment-brown/90 text-parchment-cream rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            {t('hud.feedback.submit')}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );

    return portalRoot ? createPortal(modal, portalRoot) : modal;
};


// 图片压缩工具

/** 最大 base64 体积约 500KB（压缩后） */
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 960;
const JPEG_QUALITY = 0.7;

function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;

            // 等比缩放
            if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas not available'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // 输出 JPEG（体积远小于 PNG base64）
            const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            resolve(dataUrl);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };
        img.src = url;
    });
}
