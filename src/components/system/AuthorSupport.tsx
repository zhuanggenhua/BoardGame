import { useEffect, useId, useRef, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { versionedPublicFileUrl } from '../../lib/publicFileUrl';
import './author-support.css';

/** Shared payment artwork and copy; both entry points consume the same content. */
export function AuthorSupportContent() {
    const { t } = useTranslation('game');
    return <div className="author-support-content">
        <p className="author-support-description">{t('hud.about.supportTitle')}</p>
        <p className="author-support-note">{t('hud.about.supportSubtitle')}</p>
        <div className="author-support-codes">
            {[
                { path: '/logos/weixin.jpg', label: t('hud.about.wechatLabel') },
                { path: '/logos/zhifubao.jpg', label: t('hud.about.alipayLabel') },
            ].map(code => <figure key={code.path}>
                <img src={versionedPublicFileUrl(code.path)} alt={`${code.label}二维码`} width="128" height="128" />
                <figcaption>{code.label}</figcaption>
            </figure>)}
        </div>
    </div>;
}

export function AuthorSupportButton() {
    const { t } = useTranslation('game');
    const id = useId();
    const root = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const close = () => { setOpen(false); setPinned(false); };
    useEffect(() => {
        if (!pinned) return;
        const onOutsidePress = (event: PointerEvent) => {
            if (event.target instanceof Node && !root.current?.contains(event.target)) {
                setOpen(false);
                setPinned(false);
            }
        };
        document.addEventListener('pointerdown', onOutsidePress);
        return () => document.removeEventListener('pointerdown', onOutsidePress);
    }, [pinned]);
    return <div ref={root} className="author-support" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}
        onBlur={event => { if (!pinned && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
        onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
        <button type="button" className="author-support-trigger" aria-expanded={open} aria-controls={id}
            onFocus={() => setOpen(true)} onClick={() => { setOpen(true); setPinned(true); }}><Heart size={16} aria-hidden="true" />{t('hud.about.supportAuthor')}</button>
        {open && <section id={id} className="author-support-popover" aria-label={t('hud.about.supportAuthor')}>
            <button type="button" className="author-support-close" aria-label={t('hud.about.closeSupport')} onClick={close}><X size={18} /></button>
            <h2 className="author-support-heading">{t('hud.about.supportAuthor')}</h2>
            <AuthorSupportContent />
        </section>}
    </div>;
}
