import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { isHomeEntryRoute, resolveHomeEntryStyle } from '../../lib/homeV2Routing';
import './author-support.css';

const LazyAboutModal = lazy(() => import('./AboutModal').then(module => ({ default: module.AboutModal })));

export function AboutButton() {
    const { t } = useTranslation('game');
    const location = useLocation();
    const showSponsors = !(isHomeEntryRoute(location.pathname) && resolveHomeEntryStyle(location.search) === 'modern');
    const id = useId();
    const root = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const close = () => { setOpen(false); setPinned(false); };

    useEffect(() => {
        if (!pinned) return;
        const onOutsidePress = (event: PointerEvent) => {
            if (event.target instanceof Node && !root.current?.contains(event.target)) close();
        };
        document.addEventListener('pointerdown', onOutsidePress);
        return () => document.removeEventListener('pointerdown', onOutsidePress);
    }, [pinned]);

    return <div ref={root} className="about-entry" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}
        onBlur={event => { if (!pinned && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
        onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
        <button type="button" className="author-support-trigger" aria-expanded={open} aria-controls={id}
            onFocus={() => setOpen(true)} onClick={() => { if (pinned) close(); else { setOpen(true); setPinned(true); } }}>
            <Info size={16} aria-hidden="true" />{t('hud.actions.about')}
        </button>
        {open && <Suspense fallback={<div className="about-popover about-popover-loading" role="status">{t('common:loading', { defaultValue: '加载中…' })}</div>}>
            <LazyAboutModal id={id} presentation="popover" onClose={close} showSponsors={showSponsors} />
        </Suspense>}
    </div>;
}
