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

        expect(source).toContain("mobileLabel: t('tabs.leaderboardCompact'");
        expect(source).toContain("data-testid={`game-details-tab-${tab.id}`}");
        expect(source).toContain('data-testid="game-details-close-button"');
        expect(source).toContain('className="sm:hidden"');
        expect(source).toContain('className="hidden sm:inline"');
        expect(source).toContain('justify-between gap-1.5');
        expect(source).toContain('hidden h-4 w-px shrink-0 bg-[#e5e0d0] sm:block sm:h-6');
    });
});
