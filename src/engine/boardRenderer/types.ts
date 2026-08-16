import type { ComponentType } from 'react';
import type { GameBoardProps } from '../transport/protocol';
import type { RenderBackendCapabilities } from '../renderPipeline/types';

export interface BoardRendererHost {
    element: HTMLElement;
}

export interface BoardRendererInstance<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
> {
    update: (props: GameBoardProps<TCore, TCommandMap>) => void;
    destroy: () => void;
}

export interface ReactBoardRenderer<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
> {
    kind: 'react';
    capabilities?: RenderBackendCapabilities;
    component: ComponentType<GameBoardProps<TCore, TCommandMap>>;
}

export interface ImperativeBoardRenderer<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
> {
    kind: 'imperative';
    engine?: 'pixi' | 'phaser' | 'cocos' | 'custom';
    capabilities?: RenderBackendCapabilities;
    mount: (
        host: BoardRendererHost,
        props: GameBoardProps<TCore, TCommandMap>,
    ) => BoardRendererInstance<TCore, TCommandMap>;
}

export type GameBoardRenderer<
    TCore = unknown,
    TCommandMap extends Record<string, unknown> = Record<string, unknown>,
> =
    | ReactBoardRenderer<TCore, TCommandMap>
    | ImperativeBoardRenderer<TCore, TCommandMap>;
