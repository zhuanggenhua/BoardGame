import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home } from './Home';
import { HOME_ENTRY_STYLE_QUERY_VERSION_KEY } from '../lib/homeV2Routing';

/** Every existing home link now reaches the same production platform. */
export const HomeEntry = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    React.useEffect(() => {
        document.documentElement.dataset.homeEntryStyle = 'platform';
        document.body.dataset.homeEntryStyle = 'platform';
        return () => {
            delete document.documentElement.dataset.homeEntryStyle;
            delete document.body.dataset.homeEntryStyle;
        };
    }, []);
    React.useEffect(() => {
        const obsoleteKeys = ['homeStyle', 'homeV2Draft', HOME_ENTRY_STYLE_QUERY_VERSION_KEY];
        if (!obsoleteKeys.some(key => searchParams.has(key))) return;
        const next = new URLSearchParams(searchParams);
        for (const key of obsoleteKeys) next.delete(key);
        navigate({ pathname: '/', search: next.size ? `?${next}` : '' }, { replace: true });
    }, [navigate, searchParams]);
    return <Home />;
};
export default HomeEntry;
