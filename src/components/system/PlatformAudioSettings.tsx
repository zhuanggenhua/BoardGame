import { lazy, Suspense, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';

const AudioProvider = lazy(() => import('../../contexts/AudioContext').then(m => ({ default: m.AudioProvider })));
const AudioControlSection = lazy(() => import('../game/framework/widgets/AudioControlSection').then(m => ({ default: m.AudioControlSection })));

/** Platform-only settings presentation; the shared audio provider still owns playback. */
export function PlatformAudioSettings({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
    const { t } = useTranslation('game');
    const mobile = useMobileViewport();
    const root = useRef<HTMLDivElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useLayoutEffect(() => {
        if (!mobile || !root.current) return;
        const previous = document.activeElement;
        const node = root.current;
        closeButton.current?.focus({ preventScroll: true });
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); close.current(); return;
            }
            if (event.key !== 'Tab') return;
            const controls = Array.from(node.querySelectorAll<HTMLElement>('*')).filter(element => element.matches('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        node.addEventListener('keydown', keyboard);
        return () => {
            node.removeEventListener('keydown', keyboard);
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
        };
    }, [mobile]);
    return <div ref={root} className="platform-settings-content space-y-4">
        <Suspense fallback={null}><AudioProvider><AudioControlSection isDark={isDark}/></AudioProvider></Suspense>
        <button ref={closeButton} type="button" className="platform-settings-close" onClick={onClose}>{t('hud.actions.close')}</button>
    </div>;
}
