import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home } from './Home';
import {
    HOME_ENTRY_STYLE_QUERY_VERSION_KEY,
    persistHomeEntryStyle,
    resolveHomeEntryStyle,
    subscribeHomeEntryStyleChange,
} from '../lib/homeV2Routing';

const LEGACY_HOME_QUERY_KEYS = ['homeStyle', 'homeV2Draft', HOME_ENTRY_STYLE_QUERY_VERSION_KEY];

export const HomeEntry = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [styleRevision, setStyleRevision] = React.useState(0);
    const homeStyle = resolveHomeEntryStyle(searchParams);
    void styleRevision;

    React.useEffect(() => subscribeHomeEntryStyleChange(() => {
        setStyleRevision((value) => value + 1);
    }), []);

    React.useEffect(() => {
        document.documentElement.dataset.homeEntryStyle = homeStyle;
        document.body.dataset.homeEntryStyle = homeStyle;
        return () => {
            delete document.documentElement.dataset.homeEntryStyle;
            delete document.body.dataset.homeEntryStyle;
        };
    }, [homeStyle]);

    React.useEffect(() => {
        const queryStyle = searchParams.get('homeStyle');
        if (queryStyle === 'modern' || queryStyle === 'classic') {
            persistHomeEntryStyle(queryStyle);
        } else if (queryStyle === 'book') {
            persistHomeEntryStyle('modern');
        }

        if (!LEGACY_HOME_QUERY_KEYS.some((key) => searchParams.has(key))) {
            return;
        }

        const next = new URLSearchParams(searchParams);
        for (const key of LEGACY_HOME_QUERY_KEYS) {
            next.delete(key);
        }
        navigate({ pathname: '/', search: next.size ? `?${next}` : '' }, { replace: true });
    }, [navigate, searchParams]);

    return <Home homeStyle={homeStyle} />;
};

export default HomeEntry;
