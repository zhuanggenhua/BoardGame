import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { OptimizedImage } from '../common/media/OptimizedImage';
import { isAndroidShellBuildMode, isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { copyToClipboard } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';

const MASCOT_SRC = 'common/images/mascot/easyboardgame-kanban-girl.png';
const COMMUNITY_QQ_GROUP = '1081373485';

const shouldHideOnRoute = (pathname: string) => (
    pathname === '/play'
    || pathname.startsWith('/play/')
    || pathname === '/games/summonerwars/config'
    || pathname.startsWith('/games/summonerwars/config/')
    || pathname === '/games/dicethrone/config'
    || pathname.startsWith('/games/dicethrone/config/')
    || pathname.startsWith('/admin')
    || pathname.startsWith('/dev')
);

export const PcWebMascot = () => {
    const { t } = useTranslation('lobby');
    const toast = useToast();
    const location = useLocation();
    const [pulseKey, setPulseKey] = React.useState(0);
    const [bubbleVisible, setBubbleVisible] = React.useState(false);

    if (isAndroidShellBuildMode() || isNativeAndroidRuntime() || shouldHideOnRoute(location.pathname)) {
        return null;
    }

    const handleMascotClick = () => {
        setPulseKey((value) => value + 1);
        setBubbleVisible((value) => !value);
    };

    const handleGroupCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const success = await copyToClipboard(COMMUNITY_QQ_GROUP);

        if (success) {
            toast.success(t('mascot.copy_success'));
        } else {
            toast.error(t('mascot.copy_failed'));
        }
    };

    return (
        <aside className="pc-web-mascot" data-testid="pc-web-mascot" aria-label={t('mascot.container_label')}>
            {bubbleVisible ? (
                <div className="pc-web-mascot__bubble" data-testid="pc-web-mascot-bubble" role="status">
                    <span className="pc-web-mascot__bubble-text">
                        {t('mascot.community_welcome')}
                    </span>
                    <button
                        type="button"
                        className="pc-web-mascot__group-button"
                        onClick={handleGroupCopy}
                        data-testid="pc-web-mascot-group-copy"
                    >
                        {COMMUNITY_QQ_GROUP}
                    </button>
                </div>
            ) : null}
            <button
                type="button"
                className="pc-web-mascot__button"
                aria-label={t('mascot.button_label')}
                data-testid="pc-web-mascot-button"
                aria-expanded={bubbleVisible}
                onClick={handleMascotClick}
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
