import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { getStatusEffectIconNode, type StatusIconAtlasConfig } from '../ui/statusEffects';

describe('StatusEffectsIcons', () => {
    it('渲染精灵图标时应包含 status-icons-atlas 的背景图路径', () => {
        const atlas: StatusIconAtlasConfig = {
            imageW: 1314,
            imageH: 400,
            frames: {
                purify: { x: 0, y: 0, w: 400, h: 400 },
            },
        };

        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { frameId: 'purify' },
                undefined,
                'normal',
                atlas
            )
        );

        expect(html).toContain('/assets/dicethrone/images/monk/status-icons-atlas.avif');
    });
});

