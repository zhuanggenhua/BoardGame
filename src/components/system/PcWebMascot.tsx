import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { OptimizedImage } from '../common/media/OptimizedImage';
import { isAndroidShellBuildMode, isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { copyToClipboard } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { isConfigReviewPath } from '../../config/gameConfigReviewRoutes';
import { UI_Z_INDEX } from '../../core';

const MASCOT_SRC = 'common/images/mascot/easyboardgame-kanban-girl.png';
const COMMUNITY_QQ_GROUP = '1081373485';
const MASCOT_BUBBLE_AUTO_HIDE_MS = 5000;
export const PC_WEB_MASCOT_Z_INDEX = UI_Z_INDEX.tooltip - 1;

const shouldHideOnRoute = (pathname: string) => (
    pathname === '/play'
    || pathname.startsWith('/play/')
    || isConfigReviewPath(pathname)
    || pathname.startsWith('/admin')
    || pathname.startsWith('/dev')
);

export const PcWebMascot = () => {
    const { t } = useTranslation('lobby');
    const toast = useToast();
    const location = useLocation();
    const [pulseKey, setPulseKey] = React.useState(0);
    const [bubbleVisible, setBubbleVisible] = React.useState(false);
    const [tipIndex, setTipIndex] = React.useState(0);
    const shouldHide = isAndroidShellBuildMode() || isNativeAndroidRuntime() || shouldHideOnRoute(location.pathname);

    const handleGroupCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const success = await copyToClipboard(COMMUNITY_QQ_GROUP);

        if (success) {
            toast.success(t('mascot.copy_success'));
        } else {
            toast.error(t('mascot.copy_failed'));
        }
    };

    const mascotTips = [
        { id: 'community', text: t('mascot.community_welcome') },
        { id: 'force-end-phase', text: t('mascot.force_end_phase_tip') },
        { id: 'switch-view', text: t('mascot.switch_view_tip') },
    ];

    const handleMascotClick = () => {
        setPulseKey((value) => value + 1);
        if (bubbleVisible) {
            setTipIndex((value) => (value + 1) % mascotTips.length);
            return;
        }

        setTipIndex(0);
        setBubbleVisible(true);
    };

    React.useEffect(() => {
        if (!bubbleVisible || shouldHide) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setBubbleVisible(false);
        }, MASCOT_BUBBLE_AUTO_HIDE_MS);

        return () => window.clearTimeout(timeoutId);
    }, [bubbleVisible, shouldHide, tipIndex]);

    const activeTip = mascotTips[tipIndex] ?? mascotTips[0];

    if (shouldHide) {
        return null;
    }

    return (
        <aside
            className="pc-web-mascot"
            data-testid="pc-web-mascot"
            aria-label={t('mascot.container_label')}
            style={{ zIndex: PC_WEB_MASCOT_Z_INDEX }}
        >
            {bubbleVisible ? (
                <div className="pc-web-mascot__bubble" data-testid="pc-web-mascot-bubble" role="status" aria-live="polite">
                    <span className="pc-web-mascot__bubble-text" data-testid="pc-web-mascot-tip">
                        {activeTip.text}
                    </span>
                    {activeTip.id === 'community' ? (
                        <button
                            type="button"
                            className="pc-web-mascot__group-button"
                            onClick={handleGroupCopy}
                            data-testid="pc-web-mascot-group-copy"
                        >
                            {COMMUNITY_QQ_GROUP}
                        </button>
                    ) : null}
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
