import { useMemo, useState, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import { BrowserCompatibilityPage } from '../../pages/BrowserCompatibility';
import {
    detectBrowserCompatibility,
    readBrowserCompatibilityBypass,
    writeBrowserCompatibilityBypass,
} from '../../lib/browserCompatibility';

export const BrowserCompatibilityGate = ({ children }: PropsWithChildren) => {
    const location = useLocation();
    const report = useMemo(() => detectBrowserCompatibility(location.pathname), [location.pathname]);
    const [isBypassed, setIsBypassed] = useState(() => readBrowserCompatibilityBypass());
    const isQueryBypassed = useMemo(
        () => new URLSearchParams(location.search).get('compat') === 'ignore',
        [location.search],
    );

    if (report.isCompatible || isBypassed || isQueryBypassed) {
        return <>{children}</>;
    }

    return (
        <BrowserCompatibilityPage
            report={report}
            onContinueAnyway={() => {
                writeBrowserCompatibilityBypass(true);
                setIsBypassed(true);
            }}
            onRetry={() => {
                writeBrowserCompatibilityBypass(false);
                window.location.reload();
            }}
        />
    );
};

export default BrowserCompatibilityGate;
