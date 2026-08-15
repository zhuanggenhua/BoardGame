import { describe, expect, it } from 'vitest';
import { QIDAHEN_MANIFEST } from '../manifest';

describe('七大恨游戏清单', () => {
    it('未经用户明确允许不得关闭实施中标签', () => {
        expect(QIDAHEN_MANIFEST.statusTag).toBe('under_construction');
    });

    it('教程目录外观由游戏清单声明，页面层不写死七大恨游戏名', () => {
        expect(QIDAHEN_MANIFEST.pageShell?.tutorialCatalogTheme?.className)
            .toBe('tutorial-catalog-stage--qidahen');
        expect(QIDAHEN_MANIFEST.pageShell?.tutorialCatalogTheme?.chapterAccents).toContain('#9f3426');
    });
});
