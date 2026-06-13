import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { OptimizedImage } from '../common/media/OptimizedImage';
import { isAndroidShellBuildMode, isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';

const MASCOT_SRC = 'common/images/mascot/easyboardgame-kanban-girl.png';

const shouldHideOnRoute = (pathname: string) => (
    pathname === '/play'
    || pathname.startsWith('/play/')
    || pathname.startsWith('/admin')
    || pathname.startsWith('/dev')
);

export const PcWebMascot = () => {
    const { t } = useTranslation('lobby');
    const location = useLocation();
    const [pulseKey, setPulseKey] = React.useState(0);

    if (isAndroidShellBuildMode() || isNativeAndroidRuntime() || shouldHideOnRoute(location.pathname)) {
        return null;
    }

    return (
        <aside className="pc-web-mascot" data-testid="pc-web-mascot" aria-label={t('mascot.container_label')}>
            <button
                type="button"
                className="pc-web-mascot__button"
                aria-label={t('mascot.button_label')}
                data-testid="pc-web-mascot-button"
                onClick={() => setPulseKey((value) => value + 1)}
            >
                <span key={pulseKey} className="pc-web-mascot__scale">
                    <OptimizedImage
                        src={MASCOT_SRC}
                        alt={t('mascot.image_alt')}
                        className="pc-web-mascot__image"
                        placeholder={false}
                        draggable={false}
                    />
                </span>
            </button>
        </aside>
    );
};
