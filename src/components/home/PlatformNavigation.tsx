import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useDocumentScrollLock } from '../../hooks/ui/useDocumentScrollLock';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import './platform-navigation.css';

interface PlatformNavigationProps {
    items: readonly { id: string; label: string }[];
    selected: string;
    onSelect: (id: string) => void;
    menuLabel: string;
    closeLabel: string;
    utility: ReactNode;
    account?: ReactNode;
    mobileUtility?: (close: () => void, included?: ReadonlySet<string>) => ReactNode;
    drawerContent?: (close: () => void) => ReactNode;
}

/** Desktop keeps the nav list only; the menu trigger is a mobile utility drawer. */
export function PlatformNavigation({ items, selected, onSelect, menuLabel, closeLabel, utility, account, mobileUtility, drawerContent }: PlatformNavigationProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const mobile = useMobileViewport();
    const [open, setOpen] = useState(false);
    const [instantMotion, setInstantMotion] = useState(false);
    useDocumentScrollLock(open && mobile);
    useLayoutEffect(() => {
        if (!mobile) {
            if (open) setOpen(false);
            return;
        }
        const menu = dialog.current;
        if (!menu) return;
        if (open && !menu.open) menu.showModal();
        else if (!open && menu.open) {
            menu.close();
            trigger.current?.focus();
        }
    }, [mobile, open]);
    const close = (instant = false) => {
        setInstantMotion(instant);
        setOpen(false);
    };
    return <>
        <nav className="platform-navigation" aria-label={menuLabel}>
            {items.map(item => <button key={item.id} type="button"
                aria-current={selected === item.id ? 'page' : undefined}
                onClick={() => onSelect(item.id)}>{item.label}</button>)}
        </nav>
        <div className="platform-header-actions">
            <div className="platform-desktop-utility">{utility}</div>
            {account}
            {mobile && <button ref={trigger} type="button" className="platform-menu-trigger" aria-label={menuLabel}
                aria-haspopup="dialog" aria-expanded={open} onClick={event => {
                    setInstantMotion(event.detail === 0);
                    setOpen(true);
                }}><Menu aria-hidden="true" size={22} /></button>}
        </div>
        {mobile && <dialog ref={dialog} className="platform-menu-dialog" data-motion={instantMotion ? 'instant' : 'pointer'} aria-label={menuLabel}
            onCancel={event => { event.preventDefault(); close(true); }}
            onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } }}
            onClick={event => { if (event.target === event.currentTarget) close(); }}>
            <section className="platform-menu-content">
                <header className="platform-menu-header">
                    <h2 className="platform-menu-title">{menuLabel}</h2>
                    <button type="button" className="platform-menu-close" aria-label={closeLabel} onClick={event => close(event.detail === 0)}>
                        <X aria-hidden="true" size={22} />
                    </button>
                </header>
                <div className="platform-menu-utilities">{open && (mobileUtility ? mobileUtility(() => close(true)) : utility)}</div>
                {open && drawerContent?.(close)}
            </section>
        </dialog>}
    </>;
}
