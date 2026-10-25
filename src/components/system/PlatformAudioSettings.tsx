import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
const AudioProvider = lazy(() => import('../../contexts/AudioContext').then(m => ({ default: m.AudioProvider })));
const AudioControlSection = lazy(() => import('../game/framework/widgets/AudioControlSection').then(m => ({ default: m.AudioControlSection })));

/** 音频仍由共享 Provider 持有；浮窗开合与焦点交还浮球。 */
export function PlatformAudioSettings({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
    const { t } = useTranslation(['game', 'common']);
    return <div className="platform-settings-content space-y-4">
        <Suspense fallback={<p role="status">{t('common:loading')}</p>}><AudioProvider><AudioControlSection isDark={isDark}/></AudioProvider></Suspense>
        <button type="button" className="platform-settings-close" onClick={onClose}>{t('hud.actions.close')}</button>
    </div>;
}
