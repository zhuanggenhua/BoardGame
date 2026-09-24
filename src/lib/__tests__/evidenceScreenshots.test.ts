import { mkdtemp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    getEvidenceScreenshotPath,
    promoteEvidenceScreenshotRun,
} from '../../../e2e/framework/evidenceScreenshots';

const testInfo = {
    file: 'D:/gongzuo/webgame/BoardGame/e2e/dicethrone/example.e2e.ts',
    title: '蜘蛛侠截图格式合同',
} as any;

describe('evidence screenshot format contract', () => {
    it('preserves a png filename when format is omitted', () => {
        expect(getEvidenceScreenshotPath(testInfo, '蜘蛛侠-牌桌', {
            filename: '蜘蛛侠-牌桌.png',
        })).toMatch(/蜘蛛侠-牌桌\.png$/);
    });

    it('uses png when the caller explicitly requests png without a filename', () => {
        expect(getEvidenceScreenshotPath(testInfo, '蜘蛛侠-牌桌', {
            format: 'png',
        })).toMatch(/蜘蛛侠-牌桌\.png$/);
    });

    it('rejects mismatched filename and requested format', () => {
        expect(() => getEvidenceScreenshotPath(testInfo, '蜘蛛侠-牌桌', {
            filename: '蜘蛛侠-牌桌.jpg',
            format: 'png',
        })).toThrow('文件名扩展名与 format 不一致');
    });

    it('archives the previous stable run instead of deleting it during promotion', async () => {
        const root = await mkdtemp(join(tmpdir(), 'boardgame-evidence-'));
        const stableDir = join(root, 'stable');
        const stagingDir = join(root, 'temporary', 'run-2');
        const historyDir = join(root, 'history', 'run-1');
        await mkdir(stableDir, { recursive: true });
        await mkdir(stagingDir, { recursive: true });
        await writeFile(join(stableDir, 'old.png'), 'old');
        await writeFile(join(stagingDir, 'new.png'), 'new');

        await promoteEvidenceScreenshotRun({
            runId: 'run-2',
            stableDir,
            stagingDir,
            historyDir,
        });

        await expect(readdir(stableDir)).resolves.toEqual(['new.png']);
        await expect(readdir(historyDir)).resolves.toEqual(['old.png']);
    });
});
