import { describe, expect, it } from 'vitest';

import {
    DIST_I18N_JSON_RETAIN_RELATIVE_PATHS,
    isRetainedDistI18nFile,
} from '../../../scripts/deploy/prune-web-dist-assets.mjs';

describe('Android embedded 资源裁剪', () => {
    it('只为王权骰铸首页保留压缩缩略图，不回塞大图资源', () => {
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/thumbnails/compressed/fengm.webp')).toBe(true);

        expect(isRetainedDistI18nFile('zh-CN/dicethrone/thumbnails/fengm.png')).toBe(false);
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/images/pyromancer/player-board.png')).toBe(false);
        expect(isRetainedDistI18nFile('zh-CN/dicethrone/images/pyromancer/compressed/player-board.webp')).toBe(false);
    });

    it('DiceThrone 内置保留清单不包含未压缩图片', () => {
        const diceThroneRetainedImages = DIST_I18N_JSON_RETAIN_RELATIVE_PATHS
            .filter((relativePath) => relativePath.startsWith('zh-CN/dicethrone/'))
            .filter((relativePath) => /\.(?:png|jpe?g|webp)$/i.test(relativePath));

        expect(diceThroneRetainedImages).toEqual([
            'zh-CN/dicethrone/thumbnails/compressed/fengm.webp',
        ]);
    });
});
