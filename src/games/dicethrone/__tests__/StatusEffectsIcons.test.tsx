import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { getStatusEffectIconNode, type StatusIconAtlasConfig } from '../ui/statusEffects';
import { DICETHRONE_STATUS_ATLAS_IDS } from '../domain/ids';

describe('StatusEffectsIcons', () => {
    it('渲染精灵图标时应包含 status-icons-atlas 的背景图路径', () => {
        const atlas: StatusIconAtlasConfig = {
            imageW: 1314,
            imageH: 400,
            frames: {
                purify: { x: 0, y: 0, w: 400, h: 400 },
            },
            imagePath: 'dicethrone/images/monk/status-icons-atlas.png',
        };

        const html = renderToStaticMarkup(
            getStatusEffectIconNode(
                { frameId: 'purify', atlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK },
                undefined,
                'normal',
                { [DICETHRONE_STATUS_ATLAS_IDS.MONK]: atlas }
            )
        );

        expect(html).toContain('/assets/dicethrone/images/monk/compressed/status-icons-atlas.avif');
    });
});

