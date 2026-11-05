import { mkdtemp, mkdir, readdir, writeFile, readFile, rm } from 'node:fs/promises';import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    getEvidenceScreenshotPath,
    promoteEvidenceScreenshotRun,
    clearEvidenceScreenshotsForTest,
} from '../../../e2e/framework/evidenceScreenshots';

const testInfo = {
    file: 'D:/gongzuo/webgame/BoardGame/e2e/dicethrone/example.e2e.ts',
    title: '蜘蛛侠截图格式合同',
} as any;

describe('evidence screenshot format contract', () => {
    it('同一用例并发截图的清理只能作用于当前 session', async () => {
        const root = await mkdtemp(join(tmpdir(), 'boardgame-evidence-session-'));
        const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
        const previous = process.env.PW_E2E_SESSION_ID;
        try {
            process.env.PW_E2E_SESSION_ID = 'session-first';
            const first = getEvidenceScreenshotPath(testInfo, '首个现场.png');
            await mkdir(dirname(first), { recursive: true });
            await writeFile(first, 'first-current-media');
            process.env.PW_E2E_SESSION_ID = 'session-second';
            const second = getEvidenceScreenshotPath(testInfo, '第二现场.png');
            expect(second).not.toBe(first);
            await clearEvidenceScreenshotsForTest(testInfo);
            await mkdir(dirname(second), { recursive: true });
            await writeFile(second, 'second-current-media');
            await expect(readFile(first, 'utf8')).resolves.toBe('first-current-media');
            await expect(readFile(second, 'utf8')).resolves.toBe('second-current-media');
        } finally {
            if (previous === undefined) delete process.env.PW_E2E_SESSION_ID; else process.env.PW_E2E_SESSION_ID = previous;
            cwd.mockRestore();
            await rm(root, { recursive: true, force: true });
        }
    });
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

it('Fate新采集策略保留独特界面与行为步骤关联，不补三阶段图片',async()=>{
 const root=await mkdtemp(join(tmpdir(),'fate-distinct-index-'));const stagingDir=join(root,'staging');await mkdir(stagingDir);
 await writeFile(join(stagingDir,'并排手牌.png'),'fixture');
 const stableDir=join(root,'stable');
 await promoteEvidenceScreenshotRun({runId:'run-current',stableDir,stagingDir,historyDir:join(root,'history')},{gameId:'fate-domination',evidenceCategory:'independent',capturePolicy:'distinct-ui-state',media:[{path:'并排手牌.png',chainId:'hand',chainStep:1,stage:'独特界面态',description:'并排手牌与按钮无遮挡',uiStateId:'hand-parallel',uiChange:'layout',uiChangeReason:'手牌并排布局',behaviorStepId:'select',sourceRevision:'test-revision',requirements:['手牌布局']}]});
 const index=JSON.parse(await readFile(join(stableDir,'.e2e-image-index.json'),'utf8'));
 expect(index.capturePolicy).toBe('distinct-ui-state');expect(index.media).toHaveLength(1);expect(index.media[0]).toMatchObject({sourceRun:'run-current',behaviorStepId:'select',uiStateId:'hand-parallel'});
});
