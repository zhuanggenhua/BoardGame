import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion, type Variants } from 'framer-motion';
import { ModalBase } from '../common/overlays/ModalBase';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { resolveHomeEntryStyle } from '../../lib/homeV2Routing';

interface HomeGameDetailsPresentationProps {
    presentation: 'modal' | 'inline';
    children: ReactNode;
    onClose: () => void;
    closeOnBackdrop?: boolean;
    containerClassName: string;
    skipEnterAnimation?: boolean;
}

/** 详情承载沿用原弹窗；只有现代入口选择短促的桌面浮现 / 手机底部进退。 */
export function HomeGameDetailsPresentation({ presentation, children, skipEnterAnimation, ...modalProps }: HomeGameDetailsPresentationProps) {
    const mobile = useMobileViewport();
    const reduced = useReducedMotion();
    const modern = resolveHomeEntryStyle() === 'modern';
    const [keyboardOpened] = useState(() => Boolean(document.activeElement?.matches(':focus-visible')));
    const keyboardInput = useRef(keyboardOpened);
    useEffect(() => {
        const keyboard = () => { keyboardInput.current = true; };
        const pointer = () => { keyboardInput.current = false; };
        document.addEventListener('keydown', keyboard, true);
        document.addEventListener('pointerdown', pointer, true);
        return () => {
            document.removeEventListener('keydown', keyboard, true);
            document.removeEventListener('pointerdown', pointer, true);
        };
    }, []);
    if (presentation === 'inline') return <>{children}</>;
    const rest = 'translateY(0%) scale(1)';
    const displaced = reduced ? rest : mobile ? 'translateY(100%) scale(1)' : 'translateY(18px) scale(.94)';
    const contentMotion: Variants = {
        initial: { opacity: 0, transform: displaced },
        animate: { opacity: 1, transform: rest, transition: { duration: reduced ? .12 : .22, ease: [.23, 1, .32, 1] } },
        exit: () => ({ opacity: 0, transform: displaced, transition: { duration: keyboardInput.current ? 0 : reduced ? .12 : .16, ease: [.23, 1, .32, 1] } }),
    };
    const overlayMotion: Variants = {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: reduced ? .12 : .16 } },
        exit: () => ({ opacity: 0, transition: { duration: keyboardInput.current ? 0 : .12 } }),
    };
    return <ModalBase {...modalProps}
        skipEnterAnimation={skipEnterAnimation || (modern && keyboardOpened)}
        contentMotion={modern ? contentMotion : undefined} overlayMotion={modern ? overlayMotion : undefined}>
        {children}
    </ModalBase>;
}
