import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapSceneSprite } from '../types';

const capture = vi.hoisted(() => ({ motionSprites: [] as MapSceneSprite[] }));

vi.mock('@pixi/react', () => ({ extend: vi.fn(), useApplication: () => ({ isInitialised: false }) }));
vi.mock('pixi.js', () => {
    class Rectangle { constructor(..._args: number[]) {} }
    class Texture {
        source: { width: number; height: number };
        width = 256;
        height = 256;
        constructor(options: { source: { width: number; height: number } }) { this.source = options.source; }
        destroy() {}
    }
    return {
        Assets: { load: vi.fn(async () => ({ source: { width: 256, height: 256 }, width: 256, height: 256 })) },
        Container: class {},
        Graphics: class {},
        Rectangle,
        Sprite: class {},
        Texture,
    };
});
vi.mock('../PixiSpriteMotion', async () => {
    const ReactModule = await import('react');
    return {
        PixiSpriteMotion: ({ sprite, children }: { sprite: MapSceneSprite; children: React.ReactNode }) => {
            capture.motionSprites.push(sprite);
            return ReactModule.createElement(ReactModule.Fragment, null, children);
        },
    };
});

import { PixiSceneSpriteLayer } from '../PixiSceneSpriteLayer';

describe('Pixi scene room reveal renderer', () => {
    afterEach(() => { capture.motionSprites.length = 0; vi.restoreAllMocks(); });

    it('preserves an unclipped room tile’s size, rotation, alpha and centered reveal motion', async () => {
        const sprite: MapSceneSprite = {
            id: 'room-library',
            textureUrls: ['/tiles/library.png'],
            x: 120,
            y: 80,
            width: 96,
            height: 64,
            rotation: Math.PI / 2,
            alpha: 0.65,
            motion: {
                id: 'reveal:12',
                kind: 'reveal',
                from: { x: 168, y: 96 },
                durationMs: 360,
                startScale: 0.96,
            },
        };
        const onResourceStateChange = vi.fn();
        const view = render(<PixiSceneSpriteLayer sprites={[sprite]} onResourceStateChange={onResourceStateChange} />);

        await waitFor(() => expect(capture.motionSprites.length).toBeGreaterThan(0));
        const renderedMotion = capture.motionSprites.at(-1)!;
        expect(renderedMotion).toMatchObject({
            x: 168,
            y: 112,
            width: 96,
            height: 64,
            rotation: Math.PI / 2,
            alpha: 0.65,
            motion: { id: 'reveal:12', kind: 'reveal', from: { x: 168, y: 96 } },
        });
        const tileNode = view.container.querySelector('[label="room-library"]');
        expect(tileNode).not.toBeNull();
        expect(tileNode).toHaveAttribute('x', '0');
        expect(tileNode).toHaveAttribute('y', '0');
        expect(tileNode).toHaveAttribute('width', '96');
        expect(tileNode).toHaveAttribute('height', '64');
        expect(tileNode).toHaveAttribute('rotation', String(Math.PI / 2));
    });
});
