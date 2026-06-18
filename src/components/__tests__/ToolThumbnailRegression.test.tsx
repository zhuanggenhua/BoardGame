import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GAME_CLIENT_MANIFEST_BY_ID } from '../../games/manifest.client.generated';

describe('工具缩略图回归保护', () => {
    it.each(['archview', 'assetslicer', 'audiobrowser', 'fxpreview'])('%s 继续使用专属缩略图组件', (toolId) => {
        const entry = GAME_CLIENT_MANIFEST_BY_ID[toolId];
        expect(entry).toBeDefined();

        const html = renderToStaticMarkup(<>{entry.thumbnail}</>);
        expect(html).toContain('<svg');
        expect(html).not.toContain(toolId);
    });
});
