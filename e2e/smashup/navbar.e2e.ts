import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Page, TestInfo } from '@playwright/test';

import { expect, test } from '../framework';

import {
    clearEvidenceScreenshotsForTest,
    getEvidenceScreenshotPath,
} from '../framework/evidenceScreenshots';

const FLOWISE_UI_BASE_URL = process.env.FLOWISE_UI_BASE_URL || 'http://127.0.0.1:3101';
const MAIN_FLOW_ID = '0f1e2d3c-4b5a-6789-8abc-def012345670';
const WORKFLOW_SMOKE_TIMEOUT_MS = 10 * 60 * 1000;
const PROJECT_PATH_STORAGE_KEY = 'ai-repo-workbench:chatbot-project-path';

function getWorkbenchApiBaseUrl(apiPort?: number): string {
    if (process.env.AI_REPO_WORKBENCH_API_BASE_URL) {
        return process.env.AI_REPO_WORKBENCH_API_BASE_URL;
    }

    const resolvedPort = apiPort
        || Number(process.env.PW_API_SERVER_PORT || process.env.API_SERVER_PORT || '18001');

    return `http://127.0.0.1:${resolvedPort}/devtools/ai-repo-workbench`;
}

async function saveEvidence(page: Page, testInfo: TestInfo, name: string) {
    const targetPath = getEvidenceScreenshotPath(testInfo, name, {
        subdir: 'flowise-ai-repo-workbench',
    });
    await mkdir(dirname(targetPath), { recursive: true });
    await page.screenshot({ path: targetPath, fullPage: true });
}

test.describe('Flowise AI Repo Workbench 导航', () => {
    test('左侧页签应直达 AI Repo Workbench 官方聊天页并支持 projectPath + reset', async ({ page }, testInfo) => {
        await clearEvidenceScreenshotsForTest(testInfo);

        await page.goto(`${FLOWISE_UI_BASE_URL}/agentflows`, { waitUntil: 'networkidle' });

        const sidebarEntry = page.getByText('AI 仓库工作台', { exact: true });
        await expect(sidebarEntry).toBeVisible({ timeout: 15000 });
        await saveEvidence(page, testInfo, '01-sidebar-entry-visible');

        await sidebarEntry.click();

        await expect(page).toHaveURL(
            new RegExp(`${FLOWISE_UI_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/chatbot/${MAIN_FLOW_ID}`),
        );
        await expect(page.getByLabel('目标项目目录')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('当前聊天页会在发送时自动附带目标项目目录')).toBeVisible();
        await saveEvidence(page, testInfo, '02-chatbot-entry-visible');

        const targetProjectPath = 'D:\\gongzuo\\webgame\\BoardGame';
        const marker = `FINAL_RESET_MARKER_${Date.now()}`;
        let capturedQuestion = '';

        await page.route(`**/api/v1/prediction/${MAIN_FLOW_ID}`, async (route) => {
            const body = route.request().postDataJSON() as { question?: string } | null;
            capturedQuestion = body?.question || '';
            await route.continue();
        });

        await page.getByLabel('目标项目目录').fill(targetProjectPath);
        await expect
            .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), PROJECT_PATH_STORAGE_KEY))
            .toBe(targetProjectPath);

        const composer = page.locator('flowise-fullchatbot textarea').first();
        await expect(composer).toBeVisible({ timeout: 15000 });
        await composer.fill(marker);
        await composer.press('Enter');

        await expect
            .poll(() => capturedQuestion, { timeout: 15000 })
            .toContain(`项目目录: ${targetProjectPath}`);
        await expect
            .poll(() => capturedQuestion, { timeout: 15000 })
            .toContain(marker);

        await expect(page.getByText(marker)).toBeVisible({ timeout: 15000 });
        await saveEvidence(page, testInfo, '03-chatbot-after-send');

        const resetButton = page.locator('flowise-fullchatbot button[title="Reset Chat"]').first();
        await expect(resetButton).toBeEnabled({ timeout: 15000 });
        await resetButton.click();

        await expect(page.getByText(marker)).toHaveCount(0, { timeout: 15000 });
        await expect(composer).toHaveValue('');
        await expect(composer).toHaveAttribute(
            'placeholder',
            '例如：为大杀四方新增一个海盗主题派系，并说明希望参考的派系风格。',
        );
        await expect(page.getByLabel('目标项目目录')).toHaveValue(targetProjectPath);
        await saveEvidence(page, testInfo, '04-chatbot-after-reset');
    });

    test('AI Repo Workbench 工作流 API 可完成最小闭环 smoke', async ({ request, workerPorts }) => {
        test.setTimeout(WORKFLOW_SMOKE_TIMEOUT_MS);
        const workbenchApiBaseUrl = getWorkbenchApiBaseUrl(workerPorts.apiServer);

        const resetResponse = await request.post(`${workbenchApiBaseUrl}/reset`, {
            timeout: WORKFLOW_SMOKE_TIMEOUT_MS,
        });
        expect(resetResponse.ok()).toBeTruthy();

        const startResponse = await request.post(`${workbenchApiBaseUrl}/runs/start`, {
            timeout: WORKFLOW_SMOKE_TIMEOUT_MS,
            data: {
                workflowId: 'new-faction',
                subject: '流程烟测任务',
                prompt: '创建派系：流程烟测任务',
                nodeToggles: {
                    'run-e2e-validation': false,
                },
            },
        });
        expect(startResponse.ok()).toBeTruthy();
        const startJournal = await startResponse.json();

        const activeRunId = startJournal.activeRunId;
        expect(activeRunId).toBeTruthy();

        const activeRun = startJournal.runs.find((run) => run.id === activeRunId);
        expect(activeRun?.status).toBe('waiting_decision');

        const pendingDecision = startJournal.decisions.find((decision) => decision.runId === activeRunId && !decision.resolution);
        expect(pendingDecision?.id).toBeTruthy();

        const submitResponse = await request.post(`${workbenchApiBaseUrl}/decisions/submit`, {
            timeout: WORKFLOW_SMOKE_TIMEOUT_MS,
            data: {
                decisionId: pendingDecision.id,
                action: 'proceed',
                optionId: pendingDecision.recommendedOptionId || 'wiki',
            },
        });
        expect(submitResponse.ok()).toBeTruthy();
        const finalJournal = await submitResponse.json();

        const finalRun = finalJournal.runs.find((run) => run.id === activeRunId);
        expect(finalRun?.status).toBe('completed');
        expect(finalJournal.artifactBundles.some((bundle) => bundle.runId === activeRunId)).toBeTruthy();
    });
});
