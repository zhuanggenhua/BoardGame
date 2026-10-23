import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = () =>
    readFileSync(resolve(TEST_DIR, '..', 'GameDetailsModal.tsx'), 'utf8');

describe('GameDetailsModal compatibility source guards', () => {
    it('移动端详情头部应使用紧凑 tab 标签，避免最后一个 tab 在窄屏下被截断', () => {
        const source = readSource();
        const presentation = readFileSync(resolve(TEST_DIR, '../../home/PlatformGameDetails.tsx'), 'utf8');
        const styles = readFileSync(resolve(TEST_DIR, '../../home/platform-details.css'), 'utf8');

        expect(source).toContain("mobileLabel: t('tabs.leaderboardCompact'");
        expect(source).toContain('tabs={detailTabs}');
        expect(presentation).toContain("data-testid={`game-details-tab-${tab.id}`}");
        expect(presentation).toContain('data-testid="game-details-close-button"');
        expect(presentation).toContain('{tab.mobileLabel ?? tab.label}');
        expect(styles).toContain('.platform-details-tab-desktop { display: none; }');
        expect(styles).toContain('.platform-details-tab-mobile { display: inline; }');
        expect(styles).toContain('overflow-x: auto');
    });
});
