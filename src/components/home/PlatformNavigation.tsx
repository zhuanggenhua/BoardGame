import { useRef, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { useDocumentScrollLock } from '../../hooks/ui/useDocumentScrollLock';
import './platform-navigation.css';

interface PlatformNavigationProps {
    items: readonly { id: string; label: string }[];
    selected: string;
    onSelect: (id: string) => void;
    menuLabel: string;
    closeLabel: string;
    utility: ReactNode;
    mobileUtility?: (close: () => void) => ReactNode;
    drawerContent?: (close: () => void) => ReactNode;
}

/** One navigation list; CSS anchors it to the header or mobile bottom edge. */
export function PlatformNavigation({ items, selected, onSelect, menuLabel, closeLabel, utility, mobileUtility, drawerContent }: PlatformNavigationProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    useDocumentScrollLock(open);
    const close = () => {
        dialog.current?.close();
        setOpen(false);
        trigger.current?.focus();
    };
    return <>
        <nav className="platform-navigation" aria-label={menuLabel}>
            {items.map(item => <button key={item.id} type="button"
                aria-current={selected === item.id ? 'page' : undefined}
                onClick={() => onSelect(item.id)}>{item.label}</button>)}
        </nav>
        <div className="platform-desktop-utility">{utility}</div>
        <button ref={trigger} type="button" className="platform-menu-trigger" aria-label={menuLabel}
            aria-haspopup="dialog" aria-expanded={open} onClick={() => {
                dialog.current?.showModal();
                setOpen(true);
            }}><Menu aria-hidden="true" size={22} /></button>
        <dialog ref={dialog} className="platform-menu-dialog" aria-label={menuLabel}
            onCancel={event => { event.preventDefault(); close(); }}
            onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}
            onClick={event => { if (event.target === event.currentTarget) close(); }}>
            <section className="platform-menu-content">
                <header className="platform-menu-header">
                    <h2 className="platform-menu-title">{menuLabel}</h2>
                    <button type="button" className="platform-menu-close" aria-label={closeLabel} onClick={close}>
                        <X aria-hidden="true" size={22} />
                    </button>
                </header>
                <div className="platform-menu-utilities">{open && (mobileUtility ? mobileUtility(close) : utility)}</div>
                {open && drawerContent?.(close)}
            </section>
        </dialog>
    </>;
}
