import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home } from './Home';
import { resolveHomeEntryStyle, subscribeHomeEntryStyleChange } from '../lib/homeV2Routing';

const LazyHomeV2 = React.lazy(() => import('./HomeV2').then((module) => ({ default: module.HomeV2 })));

export const HomeEntry = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [styleRevision, setStyleRevision] = React.useState(0);

    React.useEffect(() => {
        return subscribeHomeEntryStyleChange(() => {
            setStyleRevision((value) => value + 1);
        });
    }, []);

    void styleRevision;
    const homeEntryStyle = resolveHomeEntryStyle(searchParams);
    const currentQueryStyle = searchParams.get('homeStyle');

    React.useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        document.documentElement.dataset.homeEntryStyle = homeEntryStyle;
        document.body.dataset.homeEntryStyle = homeEntryStyle;

        return () => {
            delete document.documentElement.dataset.homeEntryStyle;
            delete document.body.dataset.homeEntryStyle;
        };
    }, [homeEntryStyle]);

    React.useEffect(() => {
        if (currentQueryStyle === homeEntryStyle) {
            return;
        }

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set('homeStyle', homeEntryStyle);
        if (homeEntryStyle === 'classic') {
            nextSearchParams.delete('homeV2Draft');
        }

        navigate(
            {
                pathname: '/',
                search: `?${nextSearchParams.toString()}`,
            },
            { replace: true },
        );
    }, [currentQueryStyle, homeEntryStyle, navigate, searchParams]);

    if (homeEntryStyle === 'book') {
        return (
            <React.Suspense fallback={null}>
                <LazyHomeV2 />
            </React.Suspense>
        );
    }

    return <Home />;
};
