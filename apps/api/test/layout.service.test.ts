import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { LayoutService } from '../src/modules/layout/layout.service';

const TEST_DIR = 'uploads-test-layout';

describe('LayoutService', () => {
    afterEach(() => {
        const fullPath = join(process.cwd(), TEST_DIR);
        if (existsSync(fullPath)) {
            rmSync(fullPath, { recursive: true, force: true });
        }
        delete process.env.LAYOUT_DATA_DIR;
    });

    it('应保存布局到指定目录', async () => {
        process.env.LAYOUT_DATA_DIR = TEST_DIR;
        const service = new LayoutService();
        const config = {
            version: '1.0.0',
            grid: {
                rows: 6,
                cols: 8,
                bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
            },
            zones: [],
            tracks: [],
            stackPoints: [],
        };

        const result = await service.saveSummonerWarsLayout(config);
        const expectedPath = join(process.cwd(), TEST_DIR, 'summonerwars.layout.json');

        expect(result.filePath).toBe(expectedPath);
        expect(result.relativePath.endsWith('summonerwars.layout.json')).toBe(true);
        expect(existsSync(expectedPath)).toBe(true);

        const saved = JSON.parse(readFileSync(expectedPath, 'utf8')) as Record<string, unknown>;
        expect(saved.version).toBe('1.0.0');
        expect(saved.grid).toBeTruthy();
    });
});
