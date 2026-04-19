import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Home } from './Home';
import { isHomeV2DraftEnabled } from '../lib/homeV2Routing';

const LazyHomeV2 = React.lazy(() => import('./HomeV2').then((module) => ({ default: module.HomeV2 })));

export const HomeEntry = () => {
    const [searchParams] = useSearchParams();

    if (isHomeV2DraftEnabled(searchParams)) {
        return (
            <React.Suspense fallback={null}>
                <LazyHomeV2 />
            </React.Suspense>
        );
    }

    return <Home />;
};
