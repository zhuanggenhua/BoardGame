import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { X, MessageSquareWarning, Send, Loader2, AlertTriangle, Lightbulb, HelpCircle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { cn } from '../../lib/utils';
import { FEEDBACK_API_URL as API_URL, IS_DEV_API_DISABLED } from '../../config/server';
import { UI_Z_INDEX } from '../../core';
import { buildFeedbackClientContext } from '../../lib/feedback/clientFeedbackContext';
import { getLastErrorContext } from '../../lib/feedback/errorContext';
import type { FeedbackConfigProposalDraft } from '../../lib/feedback/feedbackPayload';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';

const FEEDBACK_MODAL_DEBUG = true;
const FEEDBACK_DRAFT_STORAGE_PREFIX = 'feedback-modal:draft:v1';

type ModalViewportCssVars = {
    '--modal-active-viewport-height': string;
    '--modal-active-bottom-inset': string;
    '--modal-max-height': string;
};

const readRectSnapshot = (element: Element | null) => {
    if (!(element instanceof HTMLElement)) {
        return null;
    }
    const rect = element.getBoundingClientRect();
    return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
    };
};

const debugFeedbackModalEvent = (phase: string, details: Record<string, unknown> = {}) => {
    if (!FEEDBACK_MODAL_DEBUG || typeof console === 'undefined') {
        return;
    }
    try {
        console.warn('[feedback-modal-debug]', JSON.stringify({ phase, ...details }));
    } catch {
        console.warn('[feedback-modal-debug]', phase, details);
    }
};

interface FeedbackRuntimeContext {
    mode?: 'online' | 'local' | 'tutorial';
    matchId?: string;
    playerId?: string | null;
    gameId?: string;
}

interface FeedbackModalProps {
    onClose: () => void;
    onSubmitted?: () => void;
    /** 游戏内操作日志（纯文本，由 GameHUD 传入） */
    actionLogText?: string;
    /** 完整游戏状态 JSON（用于精确复现问题） */
    stateSnapshot?: string;
    runtimeContext?: FeedbackRuntimeContext;
    /** 配置审查表字段级修正提案；reason 使用用户填写的反馈正文 */
    configProposal?: FeedbackConfigProposalDraft;
    /** 配置审查表字段级修正提案批量提交；reason 使用用户填写的反馈正文 */
    configProposals?: FeedbackConfigProposalDraft[];
    initialContent?: string;
    /** 调用方注入可供用户选择的游戏清单，系统弹窗不直接读取游戏 manifest。 */
    selectableGames?: readonly GameManifestEntry[];
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

interface FeedbackDraft {
    content: string;
    type: FeedbackType;
    severity: FeedbackSeverity;
    contactInfo: string;
    pastedImage: string | null;
    attachLog: boolean;
    attachState: boolean;
    gameName: string;
}

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

const isFeedbackType = (value: unknown): value is FeedbackType => (
    value === FeedbackType.BUG || value === FeedbackType.SUGGESTION || value === FeedbackType.OTHER
);

const isFeedbackSeverity = (value: unknown): value is FeedbackSeverity => (
    value === FeedbackSeverity.LOW
    || value === FeedbackSeverity.MEDIUM
    || value === FeedbackSeverity.HIGH
    || value === FeedbackSeverity.CRITICAL
);

const formatConfigProposalValue = (value: unknown): string => {
    if (value === undefined || value === null) return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

const getConfigProposalObjectLabel = (proposal: FeedbackConfigProposalDraft): string => (
    proposal.objectDisplayName || proposal.objectId
);

const getConfigProposalFieldLabel = (proposal: FeedbackConfigProposalDraft): string => (
    proposal.fieldDisplayName || proposal.fieldPath
);

const getConfigProposalCurrentDisplayValue = (proposal: FeedbackConfigProposalDraft): string => (
    proposal.currentDisplayValue ?? formatConfigProposalValue(proposal.currentValue)
);

const getConfigProposalUpdatedDisplayValue = (proposal: FeedbackConfigProposalDraft): string => (
    proposal.updatedDisplayValue ?? formatConfigProposalValue(proposal.suggestedValue)
);

const hashConfigProposalDraftKey = (value: string): string => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
};

const buildFeedbackDraftStorageKey = (params: {
    gameId?: string;
    matchId?: string;
    mode?: FeedbackRuntimeContext['mode'];
}) => {
    if (!params.gameId) {
        return `${FEEDBACK_DRAFT_STORAGE_PREFIX}:outside`;
    }

    const scope = params.matchId || params.mode || 'game';
    return `${FEEDBACK_DRAFT_STORAGE_PREFIX}:game:${params.gameId}:${scope}`;
};

const readFeedbackDraft = (storageKey: string): FeedbackDraft | null => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<FeedbackDraft> | null;
        if (!parsed || typeof parsed !== 'object') return null;

        return {
            content: typeof parsed.content === 'string' ? parsed.content : '',
            type: isFeedbackType(parsed.type) ? parsed.type : FeedbackType.BUG,
            severity: isFeedbackSeverity(parsed.severity) ? parsed.severity : FeedbackSeverity.LOW,
            contactInfo: typeof parsed.contactInfo === 'string' ? parsed.contactInfo : '',
            pastedImage: typeof parsed.pastedImage === 'string' ? parsed.pastedImage : null,
            attachLog: typeof parsed.attachLog === 'boolean' ? parsed.attachLog : false,
            attachState: typeof parsed.attachState === 'boolean' ? parsed.attachState : false,
            gameName: typeof parsed.gameName === 'string' ? parsed.gameName : '',
        };
    } catch {
        return null;
    }
};

const writeFeedbackDraft = (storageKey: string, draft: FeedbackDraft) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
        // ignore storage failures
    }
};

const clearFeedbackDraft = (storageKey: string) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(storageKey);
    } catch {
        // ignore storage failures
    }
};

export const FeedbackModal = ({
    onClose,
    onSubmitted,
    actionLogText,
    stateSnapshot,
    runtimeContext,
    configProposal,
    configProposals,
    initialContent,
    selectableGames = [],
}: FeedbackModalProps) => {
    const { t } = useTranslation(['game', 'common']);
    const { user, token, addFeedbackPoints } = useAuth();
    const { success, error } = useToast();
    const location = useLocation();
    const backdropRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const portalRoot = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.getElementById('modal-root') ?? document.body;
    }, []);

    const isInGame = location.pathname.startsWith('/play/');
    const autoGameId = isInGame ? (location.pathname.split('/')[2] || '') : '';
    const baseDraftStorageKey = useMemo(() => buildFeedbackDraftStorageKey({
        gameId: (runtimeContext?.gameId ?? autoGameId) || undefined,
        matchId: runtimeContext?.matchId,
        mode: runtimeContext?.mode,
    }), [autoGameId, runtimeContext?.gameId, runtimeContext?.matchId, runtimeContext?.mode]);
    const configProposalList = useMemo(() => {
        if (configProposals?.length) return configProposals;
        return configProposal ? [configProposal] : [];
    }, [configProposal, configProposals]);
    const hasConfigProposal = configProposalList.length > 0;
    const draftStorageKey = useMemo(() => {
        if (configProposalList.length === 0) return baseDraftStorageKey;
        if (configProposalList.length > 1) {
            const batchSignature = configProposalList
                .map((proposal) => `${proposal.gameId}:${proposal.objectId}:${proposal.fieldPath}`)
                .join('|');
            return [
                baseDraftStorageKey,
                'config-proposals',
                configProposalList.length,
                hashConfigProposalDraftKey(batchSignature),
            ].join(':');
        }
        const [singleProposal] = configProposalList;
        return [
            baseDraftStorageKey,
            'config-proposal',
            singleProposal.gameId,
            singleProposal.objectId,
            singleProposal.fieldPath,
        ].join(':');
    }, [baseDraftStorageKey, configProposalList]);
    const initialDraft = useMemo(() => readFeedbackDraft(draftStorageKey), [draftStorageKey]);

    const [content, setContent] = useState(() => initialDraft?.content ?? initialContent ?? '');
    const [type, setType] = useState<FeedbackType>(() => initialDraft?.type ?? (hasConfigProposal ? FeedbackType.SUGGESTION : FeedbackType.BUG));
    const [severity, setSeverity] = useState<FeedbackSeverity>(() => initialDraft?.severity ?? FeedbackSeverity.LOW);
    const [contactInfo, setContactInfo] = useState(() => initialDraft?.contactInfo ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [pastedImage, setPastedImage] = useState<string | null>(() => initialDraft?.pastedImage ?? null);
    const [attachLog, setAttachLog] = useState(() => initialDraft?.attachLog ?? !!actionLogText);
    const [attachState, setAttachState] = useState(() => initialDraft?.attachState ?? !!stateSnapshot);
    const [isCompactLandscape, setIsCompactLandscape] = useState(false);
    const [gameName, setGameName] = useState(() => initialDraft?.gameName ?? runtimeContext?.gameId ?? autoGameId);
    const shouldShowGameSelector = !runtimeContext?.gameId;
    const requiresTextContent = hasConfigProposal;
    const canSubmit = !submitting
        && !IS_DEV_API_DISABLED
        && (requiresTextContent ? Boolean(content.trim()) : Boolean(content.trim() || pastedImage));
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

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }

        const emitLayoutSnapshot = (phase: string) => {
            const rootStyles = window.getComputedStyle(document.documentElement);
            const proxy = document.querySelector('[data-testid="mobile-text-entry-proxy"]');
            const proxyInput = document.querySelector('[data-testid="mobile-text-entry-proxy-input"], [data-testid="mobile-text-entry-proxy-textarea"]');
            debugFeedbackModalEvent(phase, {
                activeTag: document.activeElement instanceof HTMLElement ? document.activeElement.tagName : null,
                activeTestId: document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute('data-testid') : null,
                keyboardInset: rootStyles.getPropertyValue('--keyboard-inset-height').trim(),
                runtimeViewportHeight: rootStyles.getPropertyValue('--runtime-viewport-height').trim(),
                layoutViewportHeight: rootStyles.getPropertyValue('--layout-viewport-height').trim(),
                modalMaxHeight: rootStyles.getPropertyValue('--modal-max-height').trim(),
                modalBottomInset: rootStyles.getPropertyValue('--modal-active-bottom-inset').trim(),
                keyboardVisible: document.documentElement.dataset.keyboardVisible ?? null,
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                visualViewportWidth: Math.round(window.visualViewport?.width ?? 0),
                visualViewportHeight: Math.round(window.visualViewport?.height ?? 0),
                visualViewportOffsetTop: Math.round(window.visualViewport?.offsetTop ?? 0),
                panelRect: readRectSnapshot(panelRef.current),
                textareaRect: readRectSnapshot(contentTextareaRef.current),
                proxyRect: readRectSnapshot(proxy),
                proxyInputRect: readRectSnapshot(proxyInput),
            });
        };

        const handleFocusIn = () => {
            window.setTimeout(() => emitLayoutSnapshot('focusin'), 40);
        };
        const handleInput = () => {
            window.setTimeout(() => emitLayoutSnapshot('input'), 0);
        };
        const handleViewportResize = () => emitLayoutSnapshot('visualViewport-resize');
        const handleWindowResize = () => emitLayoutSnapshot('window-resize');
        const contentTextarea = contentTextareaRef.current;

        emitLayoutSnapshot('mount');
        window.setTimeout(() => emitLayoutSnapshot('mount+120ms'), 120);
        document.addEventListener('focusin', handleFocusIn, true);
        contentTextarea?.addEventListener('input', handleInput);
        window.visualViewport?.addEventListener('resize', handleViewportResize);
        window.addEventListener('resize', handleWindowResize);

        return () => {
            document.removeEventListener('focusin', handleFocusIn, true);
            contentTextarea?.removeEventListener('input', handleInput);
            window.visualViewport?.removeEventListener('resize', handleViewportResize);
            window.removeEventListener('resize', handleWindowResize);
        };
    }, [isCompactLandscape]);

    useEffect(() => {
        writeFeedbackDraft(draftStorageKey, {
            content,
            type,
            severity,
            contactInfo,
            pastedImage,
            attachLog,
            attachState,
            gameName,
        });
    }, [attachLog, attachState, contactInfo, content, draftStorageKey, gameName, pastedImage, severity, type]);

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
        if (requiresTextContent ? !content.trim() : (!content.trim() && !pastedImage)) return;

        if (IS_DEV_API_DISABLED) {
            return;
        }

        setSubmitting(true);
        try {
            // Append image to content as Markdown if present
            let finalContent = content;
            if (pastedImage) {
                finalContent += `\n\n![Screenshot](${pastedImage})`;
            }

            const lastErrorContext = getLastErrorContext();
            const fallbackMode = (typeof window !== 'undefined'
                ? ((window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__)
                : undefined);
            const clientContext = buildFeedbackClientContext({
                mode: runtimeContext?.mode ?? (fallbackMode as 'online' | 'local' | 'tutorial' | undefined),
                matchId: runtimeContext?.matchId,
                playerId: runtimeContext?.playerId ?? undefined,
                gameId: (runtimeContext?.gameId ?? gameName) || undefined,
            });

            const errorContext = lastErrorContext
                ? {
                    message: lastErrorContext.message,
                    name: lastErrorContext.name,
                    stack: lastErrorContext.stack,
                    source: lastErrorContext.source,
                    jsStack: lastErrorContext.jsStack,
                    componentStack: lastErrorContext.componentStack,
                }
                : undefined;

            const normalizedConfigProposals = configProposalList.length > 0
                ? configProposalList.map((proposal) => ({
                    ...proposal,
                    reason: content.trim(),
                    evidence: proposal.evidence,
                    status: proposal.status ?? 'pending_ai_review',
                }))
                : undefined;
            const normalizedConfigProposal = normalizedConfigProposals?.length === 1
                ? normalizedConfigProposals[0]
                : undefined;

            const requestBody = JSON.stringify({
                content: finalContent,
                type,
                severity,
                gameName: gameName || undefined,
                source: hasConfigProposal ? 'config-review' : undefined,
                contactInfo: contactInfo || undefined,
                actionLog: (attachLog && actionLogText) ? actionLogText : undefined,
                stateSnapshot: (attachState && stateSnapshot) ? stateSnapshot : undefined,
                clientContext,
                errorContext,
                configProposal: normalizedConfigProposal,
                configProposals: normalizedConfigProposals && normalizedConfigProposals.length > 1
                    ? normalizedConfigProposals
                    : undefined,
            });

            const buildHeaders = (includeAuth: boolean): Record<string, string> => ({
                'Content-Type': 'application/json',
                ...(includeAuth && token ? { Authorization: `Bearer ${token}` } : {}),
            });
            const shouldAttachAuth = Boolean(user && token);

            let res = await fetch(`${API_URL}`, {
                method: 'POST',
                headers: buildHeaders(shouldAttachAuth),
                body: requestBody,
            });
            if (res.status === 401 && shouldAttachAuth) {
                res = await fetch(`${API_URL}`, {
                    method: 'POST',
                    headers: buildHeaders(false),
                    body: requestBody,
                });
            }

            if (!res.ok) {
                const payload = await res.json().catch(() => null) as { error?: string; message?: string } | null;
                throw new Error(
                    payload?.error
                    || payload?.message
                    || t('hud.feedback.errors.submitFailed')
                );
            }

            const payload = await res.json().catch(() => null) as { rewardPoints?: number } | null;
            const rewardPoints = typeof payload?.rewardPoints === 'number' ? payload.rewardPoints : 0;
            clearFeedbackDraft(draftStorageKey);
            if (rewardPoints > 0) {
                addFeedbackPoints(rewardPoints);
                success({
                    kind: 'reward-points',
                    text: t('hud.feedback.success'),
                    points: rewardPoints,
                });
            } else {
                success(t('hud.feedback.success'));
            }
            onSubmitted?.();
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
            data-lock-layout-viewport="true"
            style={({
                zIndex: UI_Z_INDEX.modalContent,
                '--modal-active-viewport-height': 'var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))',
                '--modal-active-bottom-inset': 'var(--runtime-modal-bottom-inset)',
                '--modal-max-height': 'calc(var(--layout-viewport-height, var(--runtime-viewport-height, 100vh)) - max(1rem, var(--safe-area-top)) - max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset))))',
                paddingTop: isCompactLandscape ? 'max(0.5rem, var(--safe-area-top))' : 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: isCompactLandscape
                    ? 'max(0.5rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))'
                    : 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            } as CSSProperties & ModalViewportCssVars)}
            role="dialog"
            aria-modal="true"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                ref={panelRef}
                className={cn(
                    'bg-parchment-base-bg rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border-2 border-parchment-brown/30',
                    isCompactLandscape && 'max-w-[40rem]',
                )}
                style={{ maxHeight: 'var(--modal-max-height, var(--runtime-modal-max-height))' }}
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
                                {selectableGames
                                    .filter(g => g.type === 'game' && g.enabled)
                                    .map(g => (
                                        <option key={g.id} value={g.id}>{resolveGameDisplayName(g, t, g.id)}</option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    {hasConfigProposal ? (
                        <div
                            className="rounded-lg border border-parchment-gold/35 bg-parchment-gold/10 px-3 py-2 text-xs leading-5 text-parchment-base-text"
                            data-testid="feedback-config-proposal-context"
                        >
                            <div className="font-bold text-parchment-brown">
                                {configProposalList.length > 1
                                    ? t('hud.feedback.configProposal.batchTitle')
                                    : t('hud.feedback.configProposal.title')}
                            </div>
                            {configProposalList.length > 1 ? (
                                <div className="mt-1 space-y-1.5">
                                    <div className="break-words text-parchment-light-text">
                                        {t('hud.feedback.configProposal.batchSummary', {
                                            count: configProposalList.length,
                                        })}
                                    </div>
                                    <div className="space-y-1" data-testid="feedback-config-proposal-batch-list">
                                        {configProposalList.slice(0, 5).map((proposal, index) => (
                                            <div
                                                key={`${proposal.objectId}:${proposal.fieldPath}:${index}`}
                                                className="break-words font-semibold text-parchment-brown"
                                            >
                                                {t('hud.feedback.configProposal.batchItem', {
                                                    index: index + 1,
                                                    objectName: getConfigProposalObjectLabel(proposal),
                                                    fieldName: getConfigProposalFieldLabel(proposal),
                                                    currentValue: getConfigProposalCurrentDisplayValue(proposal),
                                                    updatedValue: getConfigProposalUpdatedDisplayValue(proposal),
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                    {configProposalList.length > 5 ? (
                                        <div className="text-parchment-light-text">
                                            {t('hud.feedback.configProposal.batchMore', {
                                                count: configProposalList.length - 5,
                                            })}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    <div className="mt-1 break-words text-parchment-light-text">
                                        {t('hud.feedback.configProposal.target', {
                                            objectName: getConfigProposalObjectLabel(configProposalList[0]),
                                            fieldName: getConfigProposalFieldLabel(configProposalList[0]),
                                        })}
                                    </div>
                                    {'currentValue' in configProposalList[0] || 'suggestedValue' in configProposalList[0] ? (
                                        <div
                                            className="mt-1 break-words font-semibold text-parchment-brown"
                                            data-testid="feedback-config-proposal-change"
                                        >
                                            {t('hud.feedback.configProposal.change', {
                                                currentValue: getConfigProposalCurrentDisplayValue(configProposalList[0]),
                                                updatedValue: getConfigProposalUpdatedDisplayValue(configProposalList[0]),
                                            })}
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    ) : null}

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
                                ref={contentTextareaRef}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onPaste={handlePaste}
                                rows={isCompactLandscape ? 2 : 4}
                                className={cn(
                                    'block w-full text-base sm:text-sm text-parchment-base-text bg-parchment-card-bg rounded-lg border border-parchment-brown/20 focus:ring-parchment-gold focus:border-parchment-gold resize-none outline-none placeholder:text-parchment-light-text/50',
                                    isCompactLandscape ? 'p-2.5' : 'p-3',
                                )}
                                placeholder={t('hud.feedback.contentPlaceholder')}
                                required={requiresTextContent || !pastedImage}
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

                    {IS_DEV_API_DISABLED ? (
                        <div
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-900"
                            data-testid="feedback-api-disabled-banner"
                        >
                            {t('hud.feedback.errors.apiDisabled')}
                        </div>
                    ) : null}

                    </div>

                    {/* 提交按钮固定在底部，不随内容滚动 */}
                    <div className={cn(
                        'border-t border-parchment-brown/10 flex justify-end shrink-0 bg-parchment-base-bg',
                        isCompactLandscape ? 'px-4 py-2.5' : 'px-6 py-4',
                    )}>
                        <button
                            type="submit"
                            disabled={!canSubmit}
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
