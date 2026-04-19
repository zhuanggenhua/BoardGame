import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCcw, Smartphone } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/common/SEO';
import type { BrowserCompatibilityReason, BrowserCompatibilityReport } from '../lib/browserCompatibility';

interface BrowserCompatibilityPageProps {
    report: BrowserCompatibilityReport;
    onContinueAnyway: () => void;
    onRetry: () => void;
}

const PAGE_COLORS = {
    panel: 'rgba(252, 251, 249, 0.92)',
    panelBorder: '#c8b69e',
    text: '#433422',
    muted: '#7e6d58',
    accent: '#4a3b2a',
    danger: '#8b0000',
};

const pageStyle: CSSProperties = {
    minHeight: '100dvh',
    padding: 'calc(env(safe-area-inset-top) + 24px) 20px calc(env(safe-area-inset-bottom) + 24px)',
    background:
        'radial-gradient(circle at top, rgba(212, 175, 55, 0.18), transparent 32%), linear-gradient(180deg, #fbf7ee 0%, #f4ecd8 100%)',
    color: PAGE_COLORS.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
};

const panelStyle: CSSProperties = {
    width: '100%',
    maxWidth: '760px',
    padding: '28px',
    borderRadius: '24px',
    border: `1px solid ${PAGE_COLORS.panelBorder}`,
    background: PAGE_COLORS.panel,
    boxShadow: '0 24px 60px rgba(67, 52, 34, 0.12)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    position: 'relative',
    zIndex: 1,
    boxSizing: 'border-box',
};

const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(74, 59, 42, 0.14)',
    background: 'rgba(74, 59, 42, 0.06)',
    color: PAGE_COLORS.accent,
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.02em',
};

const buttonBaseStyle: CSSProperties = {
    minHeight: '44px',
    borderRadius: '14px',
    border: '1px solid transparent',
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
};

const primaryButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: PAGE_COLORS.accent,
    color: '#f4ecd8',
};

const secondaryButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: '#ffffff',
    color: PAGE_COLORS.text,
    borderColor: 'rgba(74, 59, 42, 0.18)',
};

const ghostButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: 'transparent',
    color: PAGE_COLORS.muted,
    borderColor: 'rgba(74, 59, 42, 0.12)',
};

const reasonKeyMap: Record<BrowserCompatibilityReason, string> = {
    'runtime-core': 'compatibility.reasonRuntimeCore',
    'game-resize-observer': 'compatibility.reasonResizeObserver',
};

export const BrowserCompatibilityPage = ({
    report,
    onContinueAnyway,
    onRetry,
}: BrowserCompatibilityPageProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation('common');

    const contextLabel = report.isAndroidWebView
        ? t('compatibility.contextWebView')
        : t('compatibility.contextBrowser');
    const currentBrowserLabel = report.browserVersion
        ? `${report.browserName} ${report.browserVersion}`
        : report.browserName;

    return (
        <div data-bg-friendly-screen="true" style={pageStyle}>
            <SEO
                title={t('compatibility.seoTitle')}
                description={t('compatibility.seoDescription')}
                noIndex
            />

            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                        'radial-gradient(circle at center, rgba(212, 175, 55, 0.12) 1px, transparent 1px)',
                    backgroundSize: '26px 26px',
                    opacity: 0.45,
                }}
            />

            <section style={panelStyle}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                    <span style={badgeStyle}>
                        <Smartphone size={14} />
                        {contextLabel}
                    </span>
                    <span style={{ ...badgeStyle, color: PAGE_COLORS.danger, background: 'rgba(139, 0, 0, 0.06)' }}>
                        <AlertTriangle size={14} />
                        {t('compatibility.badge')}
                    </span>
                </div>

                <div
                    style={{
                        marginBottom: '18px',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: 'rgba(74, 59, 42, 0.05)',
                        border: '1px solid rgba(74, 59, 42, 0.08)',
                        display: 'grid',
                        gap: '6px',
                    }}
                >
                    <div style={{ fontSize: '13px', color: PAGE_COLORS.muted }}>
                        {t('compatibility.currentBrowser', { browser: currentBrowserLabel })}
                    </div>
                    <div style={{ fontSize: '13px', color: PAGE_COLORS.muted }}>
                        {t('compatibility.requiredVersions')}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
                    <div
                        style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '18px',
                            background: 'rgba(212, 175, 55, 0.18)',
                            color: PAGE_COLORS.accent,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <AlertTriangle size={28} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 42px)', lineHeight: 1.1, color: PAGE_COLORS.accent }}>
                            {t('compatibility.title')}
                        </h1>
                        <p style={{ margin: '10px 0 0', fontSize: '16px', lineHeight: 1.7, color: PAGE_COLORS.muted }}>
                            {t('compatibility.description')}
                        </p>
                    </div>
                </div>

                <div
                    style={{
                        marginBottom: '18px',
                        padding: '16px 18px',
                        borderRadius: '18px',
                        background: 'rgba(255, 255, 255, 0.72)',
                        border: '1px solid rgba(200, 182, 158, 0.9)',
                    }}
                >
                    <div style={{ fontSize: '14px', fontWeight: 700, color: PAGE_COLORS.accent, marginBottom: '8px' }}>
                        {t('compatibility.reasonTitle')}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: PAGE_COLORS.text, lineHeight: 1.7 }}>
                        {report.reasons.map((reason) => (
                            <li key={reason}>{t(reasonKeyMap[reason])}</li>
                        ))}
                    </ul>
                </div>

                <div
                    style={{
                        marginBottom: '22px',
                        padding: '16px 18px',
                        borderRadius: '18px',
                        background: 'rgba(74, 59, 42, 0.05)',
                        border: '1px solid rgba(74, 59, 42, 0.1)',
                    }}
                >
                    <div style={{ fontSize: '14px', fontWeight: 700, color: PAGE_COLORS.accent, marginBottom: '8px' }}>
                        {t('compatibility.recommendationTitle')}
                    </div>
                    <div style={{ display: 'grid', gap: '8px', color: PAGE_COLORS.text, lineHeight: 1.7 }}>
                        <div>{t('compatibility.recommendationChrome')}</div>
                        <div>{t('compatibility.recommendationWebView')}</div>
                        <div>{t('compatibility.recommendationRetry')}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {location.pathname !== '/' ? (
                        <button type="button" style={secondaryButtonStyle} onClick={() => navigate('/')}>
                            <ArrowLeft size={16} />
                            {t('compatibility.backHome')}
                        </button>
                    ) : null}

                    <button type="button" style={primaryButtonStyle} onClick={onContinueAnyway}>
                        {t('compatibility.continueAnyway')}
                    </button>

                    <button type="button" style={ghostButtonStyle} onClick={onRetry}>
                        <RefreshCcw size={16} />
                        {t('compatibility.retry')}
                    </button>
                </div>

                <p style={{ margin: '18px 0 0', fontSize: '13px', lineHeight: 1.6, color: PAGE_COLORS.muted }}>
                    {t('compatibility.note')}
                </p>
            </section>
        </div>
    );
};

export default BrowserCompatibilityPage;
