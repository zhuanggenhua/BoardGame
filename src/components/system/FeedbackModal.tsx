import { useRef, useState } from 'react';
import { X, MessageSquareWarning, Send, Loader2, AlertTriangle, Lightbulb, HelpCircle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { cn } from '../../lib/utils';
import { FEEDBACK_API_URL as API_URL } from '../../config/server';
import { UI_Z_INDEX } from '../../core';
import { GAME_MANIFEST } from '../../games/manifest.generated';

interface FeedbackModalProps {
    onClose: () => void;
    /** 游戏内操作日志（纯文本，由 GameHUD 传入） */
    actionLogText?: string;
    /** 完整游戏状态 JSON（用于精确复现问题） */
    stateSnapshot?: string;
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

export const FeedbackModal = ({ onClose, actionLogText, stateSnapshot }: FeedbackModalProps) => {
    const { t } = useTranslation(['game', 'common']);
    const { token } = useAuth();
    const { success, error } = useToast();
    const location = useLocation();
    const backdropRef = useRef<HTMLDivElement>(null);

    const [content, setContent] = useState('');
    const [type, setType] = useState<FeedbackType>(FeedbackType.BUG);
    const [severity, setSeverity] = useState<FeedbackSeverity>(FeedbackSeverity.LOW);
    const [contactInfo, setContactInfo] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [pastedImage, setPastedImage] = useState<string | null>(null);
    const [attachLog, setAttachLog] = useState(!!actionLogText);
    const [attachState, setAttachState] = useState(!!stateSnapshot);

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
            
            // 如果用户已登录，添加 Authorization header
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

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
                })
            });

            if (!res.ok) throw new Error(t('hud.feedback.errors.submitFailed'));

            success(t('hud.feedback.success'));
            onClose();
        } catch (err) {
            console.error(err);
            error(t('hud.feedback.errors.submitFailed'));
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

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-serif"
            style={{ zIndex: UI_Z_INDEX.modalContent }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-parchment-base-bg rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border-2 border-parchment-brown/30"
            >
                {/* Header */}
                <div className="bg-parchment-brown px-6 py-4 flex items-center justify-between shrink-0 border-b border-parchment-gold/20">
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
                    <div className="p-6 overflow-y-auto space-y-4 scrollbar-thin flex-1 min-h-0">
                    {/* Game Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-parchment-light-text uppercase tracking-wider">{t('hud.feedback.gameLabel')}</label>
                        <select
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            className="w-full bg-parchment-card-bg border border-parchment-brown/20 text-parchment-base-text text-sm rounded-lg focus:ring-parchment-gold focus:border-parchment-gold block p-2.5 transition-colors outline-none"
                        >
                            <option value="">{t('hud.feedback.gameAll')}</option>
                            {GAME_MANIFEST
                                .filter(g => g.type === 'game' && g.enabled)
                                .map(g => (
                                    <option key={g.id} value={g.id}>{t(`common:game_names.${g.id}`, g.id)}</option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Type Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-parchment-light-text uppercase tracking-wider">{t('hud.feedback.typeLabel')}</label>
                            <div className="flex bg-parchment-card-bg p-1 rounded-lg border border-parchment-brown/20">
                                {Object.values(FeedbackType).map((typeValue) => (
                                    <button
                                        key={typeValue}
                                        type="button"
                                        onClick={() => setType(typeValue)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center py-2 rounded-md text-xs font-bold transition-all gap-1.5",
                                            type === typeValue
                                                ? "bg-parchment-brown text-parchment-cream shadow-sm"
                                                : "text-parchment-light-text hover:text-parchment-base-text hover:bg-parchment-brown/10"
                                        )}
                                    >
                                        {getTypeIcon(typeValue)}
                                        <span>{t(FEEDBACK_TYPE_LABEL_KEYS[typeValue])}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Severity Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-parchment-light-text uppercase tracking-wider">{t('hud.feedback.severityLabel')}</label>
                            <select
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)}
                                className="w-full bg-parchment-card-bg border border-parchment-brown/20 text-parchment-base-text text-sm rounded-lg focus:ring-parchment-gold focus:border-parchment-gold block p-2.5 transition-colors outline-none"
                            >
                                {Object.values(FeedbackSeverity).map((severityValue) => (
                                    <option key={severityValue} value={severityValue}>{t(FEEDBACK_SEVERITY_LABEL_KEYS[severityValue])}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-parchment-light-text uppercase tracking-wider">{t('hud.feedback.contentLabel')}</label>
                        <div className="relative">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onPaste={handlePaste}
                                rows={4}
                                className="block p-3 w-full text-sm text-parchment-base-text bg-parchment-card-bg rounded-lg border border-parchment-brown/20 focus:ring-parchment-gold focus:border-parchment-gold resize-none outline-none placeholder:text-parchment-light-text/50"
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
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-parchment-light-text uppercase tracking-wider">{t('hud.feedback.contactLabel')}</label>
                        <input
                            type="text"
                            value={contactInfo}
                            onChange={(e) => setContactInfo(e.target.value)}
                            className="bg-parchment-card-bg border border-parchment-brown/20 text-parchment-base-text text-sm rounded-lg focus:ring-parchment-gold focus:border-parchment-gold block w-full p-2.5 outline-none placeholder:text-parchment-light-text/50"
                            placeholder={t('hud.feedback.contactPlaceholder')}
                        />
                    </div>

                    </div>

                    {/* 提交按钮固定在底部，不随内容滚动 */}
                    <div className="px-6 py-4 border-t border-parchment-brown/10 flex justify-end shrink-0 bg-parchment-base-bg">
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
};


// ── 图片压缩工具 ──

/** 最大 base64 大小约 500KB（压缩后） */
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
                reject(new Error('Canvas 不可用'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // 输出为 JPEG（体积远小于 PNG base64）
            const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            resolve(dataUrl);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('图片加载失败'));
        };
        img.src = url;
    });
}
