import type { ComponentType } from 'react';
import type { GameBoardProps } from '../transport/protocol';
import type { ReactBoardRenderer } from './types';

export function createReactBoardRenderer<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
>(
    component: ComponentType<GameBoardProps<TCore, TCommandMap>>,
): ReactBoardRenderer<TCore, TCommandMap> {
    return {
        kind: 'react',
        component,
    };
}
