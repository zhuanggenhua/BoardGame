import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, MoreHorizontal, X } from 'lucide-react';
import { useDocumentScrollLock } from '../../hooks/ui/useDocumentScrollLock';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import './platform-navigation.css';

interface PlatformNavigationProps {
    items: readonly { id: string; label: string }[];
    selected: string;
    onSelect: (id: string) => void;
    menuLabel: string;
    moreLabel?: string;
    closeLabel: string;
    utility: ReactNode;
    account?: ReactNode;
    mobileUtility?: (close: () => void, included?: ReadonlySet<string>) => ReactNode;
    drawerContent?: (close: () => void) => ReactNode;
}

/** One navigation list; CSS anchors it to the header or mobile bottom edge. */
export function PlatformNavigation({ items, selected, onSelect, menuLabel, moreLabel = menuLabel, closeLabel, utility, account, mobileUtility, drawerContent }: PlatformNavigationProps) {
    const mobile = useMobileViewport();
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const actions = useRef<HTMLDivElement>(null);
    const utilities = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [instantMotion, setInstantMotion] = useState(false);
    const [overflowIds, setOverflowIds] = useState<ReadonlySet<string>>(() => new Set());
    useDocumentScrollLock(open && mobile);
    useLayoutEffect(() => {
        const menu = dialog.current;
        if (!menu) return;
        if (open) {
            if (!menu.open) {
                menu.showModal();
                if (!mobile) menu.focus();
            }
        } else if (menu.open) {
            menu.close();
            trigger.current?.focus();
        }
    }, [open, mobile]);
    useLayoutEffect(() => {
        const group = actions.current;
        const tools = utilities.current;
        if (!group || !tools) return;
        // 逐项收纳，隐藏项仍保留固有宽度供测量，避免显示/隐藏导致断点抖动。
        const measure = () => {
            if (!group.clientWidth) return;
            const children = [...group.children] as HTMLElement[];
            const gap = Number.parseFloat(getComputedStyle(group).columnGap) || 0;
            const others = children.filter(child => child !== tools);
            const budget = group.clientWidth - others.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) - gap * others.length;
            const toolGap = Number.parseFloat(getComputedStyle(tools).columnGap) || 0;
            const items = [...tools.children] as HTMLElement[];
            const prioritized = [...items].sort((a, b) => Number(a.dataset.platformUtilityPriority ?? 0) - Number(b.dataset.platformUtilityPriority ?? 0));
            let used = 0;
            let visible = 0;
            const overflowIds = new Set<string>();
            for (const item of prioritized) {
                const needed = item.getBoundingClientRect().width + (visible ? toolGap : 0);
                const overflow = used + needed > budget + 1;
                item.toggleAttribute('data-overflow', overflow);
                item.inert = overflow;
                if (overflow && item.dataset.platformUtilityId) overflowIds.add(item.dataset.platformUtilityId);
                if (!overflow) { used += needed; visible++; }
            }
            setOverflowIds(previous => previous.size === overflowIds.size && [...previous].every(id => overflowIds.has(id)) ? previous : overflowIds);
            tools.toggleAttribute('data-empty', visible === 0);
            group.toggleAttribute('data-utilities-collapsed', visible < items.length);
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(group);
        for (const child of group.children) observer.observe(child);
        for (const child of tools.children) observer.observe(child);
        return () => observer.disconnect();
    }, [account, utility]);
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
        <div ref={actions} className="platform-header-actions">
        <div ref={utilities} className="platform-desktop-utility">{utility}</div>
        {account}
        <button ref={trigger} type="button" className="platform-menu-trigger" aria-label={mobile ? menuLabel : moreLabel}
            aria-haspopup="dialog" aria-expanded={open} onClick={event => {
                setInstantMotion(event.detail === 0);
                setOpen(true);
            }}>{mobile ? <Menu aria-hidden="true" size={22} /> : <MoreHorizontal aria-hidden="true" size={22} />}</button>
        </div>
        <dialog ref={dialog} className="platform-menu-dialog" data-motion={instantMotion ? 'instant' : 'pointer'} aria-label={mobile ? menuLabel : moreLabel}
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
                <div className="platform-menu-utilities">{mobileUtility ? mobileUtility(() => close(true), mobile ? undefined : overflowIds) : utility}</div>
                {drawerContent?.(close)}
            </section>
        </dialog>
    </>;
}
