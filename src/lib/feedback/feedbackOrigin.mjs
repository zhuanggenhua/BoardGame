export const PUBLIC_AUTO_FEEDBACK_SOURCES = new Set([
    'client-auto-report',
    'client-runtime-guard',
    'client-window-error',
    'client-unhandled-rejection',
    'react-error-boundary',
    'board-render-error',
    'home-modal-error-boundary',
]);

// 旧记录在持久化时可能被标记为玩家，但来源仍能确定是自动上报。
export function normalizeFeedbackOrigin(raw) {
    if (PUBLIC_AUTO_FEEDBACK_SOURCES.has(raw.source) && raw.reporterType !== 'system') {
        return { ...raw, reporterType: 'system' };
    }
    const watchdog = raw.contactInfo === 'system:online-ai-watchdog'
        || raw.errorContext?.source === 'online-ai-watchdog'
        || /^\[system\]\[online-ai-watchdog\]\s+/.test(raw.content);
    if (!watchdog) return raw;
    return {
        ...raw,
        reporterType: 'system',
        source: 'online-ai-watchdog',
        autoReportKind: raw.errorContext?.name || raw.autoReportKind,
    };
}
