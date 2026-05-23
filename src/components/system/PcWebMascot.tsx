import React from 'react';
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
    const location = useLocation();
    const [pulseKey, setPulseKey] = React.useState(0);

    if (isAndroidShellBuildMode() || isNativeAndroidRuntime() || shouldHideOnRoute(location.pathname)) {
        return null;
    }

    return (
        <aside className="pc-web-mascot" data-testid="pc-web-mascot" aria-label="易桌游看板娘">
            <button
                type="button"
                className="pc-web-mascot__button"
                aria-label="点击看板娘"
                data-testid="pc-web-mascot-button"
                onClick={() => setPulseKey((value) => value + 1)}
            >
                <span key={pulseKey} className="pc-web-mascot__scale">
                    <OptimizedImage
                        src={MASCOT_SRC}
                        alt="易桌游看板娘"
                        className="pc-web-mascot__image"
                        placeholder={false}
                        draggable={false}
                    />
                </span>
            </button>
        </aside>
    );
};
