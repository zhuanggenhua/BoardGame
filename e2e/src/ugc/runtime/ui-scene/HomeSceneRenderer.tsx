import React from 'react';
import { UISceneRenderer, type UISceneRendererProps } from './UISceneRenderer';
import { HOME_V2_BOOK_SCENE, type HomeV2SceneState } from './scenes/homeV2BookScene';
import type { UISceneNodeEvent } from './types';

export interface HomeSceneRendererProps extends Omit<UISceneRendererProps, 'scene' | 'activeState' | 'onNodeEvent'> {
    sceneState: HomeV2SceneState;
    sceneContext?: Record<string, unknown>;
    onIntroOpenComplete: () => void;
    onIntroTabsComplete: () => void;
    onSceneEvent?: (event: UISceneNodeEvent) => void;
}

export const HomeSceneRenderer = ({
    sceneState,
    sceneContext,
    onIntroOpenComplete,
    onIntroTabsComplete,
    onSceneEvent,
    ...rendererProps
}: HomeSceneRendererProps) => {
    const handleNodeEvent = React.useCallback(
        (event: UISceneNodeEvent) => {
            onSceneEvent?.(event);

            if (event.eventId === 'intro.open.complete') {
                onIntroOpenComplete();
                return;
            }

            if (event.eventId === 'intro.tabs.complete') {
                onIntroTabsComplete();
            }
        },
        [onIntroOpenComplete, onIntroTabsComplete, onSceneEvent],
    );

    return (
        <UISceneRenderer
            {...rendererProps}
            scene={HOME_V2_BOOK_SCENE}
            activeState={sceneState}
            sceneContext={sceneContext}
            onNodeEvent={handleNodeEvent}
        >
            {rendererProps.children}
        </UISceneRenderer>
    );
};
