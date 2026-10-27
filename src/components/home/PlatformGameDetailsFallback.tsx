import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './platform-details.css';

/** 冷加载仅占用真实详情的布局，不借用经典大厅的骨架。 */
export function PlatformGameDetailsFallback({ onClose, closeOnBackdrop }: { onClose: () => void; closeOnBackdrop: boolean }) {
    const { t } = useTranslation('common');
    return <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeOnBackdrop ? onClose : undefined} />
        <div className="home-game-details-layer platform-details-loading-layer" data-testid="home-game-details-loading-fallback">
            <section className="platform-game-details platform-details-loading" data-testid="home-game-details-loading-fallback-root" aria-busy="true" aria-label={t('loading')}>
                <button type="button" className="platform-details-close" aria-label={t('close')} onClick={onClose}><X size={22} /></button>
                <div className="platform-details-summary" aria-hidden="true">
                    <div className="platform-details-cover platform-details-skeleton" />
                    <div className="platform-details-copy"><div className="platform-details-skeleton platform-details-skeleton-title" /><div className="platform-details-skeleton platform-details-skeleton-description" /></div>
                    <div className="platform-details-actions platform-details-skeleton" />
                </div>
                <div className="platform-details-main"><p role="status">{t('loading')}</p></div>
            </section>
        </div>
    </>;
}
