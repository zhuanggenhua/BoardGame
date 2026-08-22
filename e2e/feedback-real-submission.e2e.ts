import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { setChineseLocale } from './helpers/common';

const SCREENSHOT_DIR = 'test-results/evidence-screenshots/feedback-real-submission';
const HTML_NAVIGATION_HEADERS = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

async function waitForFrontendRoute(page: Page, targetPath: string) {
    await expect.poll(async () => {
        try {
            const readyResponse = await page.request.get('/__ready', { failOnStatusCode: false });
            if (readyResponse.status() !== 200) return `ready:${readyResponse.status()}`;

            const response = await page.request.get(targetPath, {
                failOnStatusCode: false,
                headers: HTML_NAVIGATION_HEADERS,
            });
            if (response.status() !== 200) return `status:${response.status()}`;

            const body = await response.text();
            return body.includes('<!doctype html>') ? 'ready' : 'not-html';
        } catch (error) {
            return `network:${error instanceof Error ? error.name : 'unknown'}`;
        }
    }, {
        timeout: 60_000,
        intervals: [500, 1000, 2000],
        message: `等待前端路由可访问: ${targetPath}`,
    }).toBe('ready');
}

test.describe('反馈真实提交链路 E2E', () => {
    test.describe.configure({ timeout: 180_000 });

    test.beforeEach(async ({ context }) => {
        await setChineseLocale(context);
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    test('匿名用户从反馈弹窗提交后，应能在后台反馈列表看到同一条记录', async ({ page }) => {
        const probeId = `feedback-real-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const probeContent = `E2E真实反馈链路探针 ${probeId}`;
        const probeContact = `${probeId}@example.test`;

        await waitForFrontendRoute(page, '/');
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-game-id]').first()).toBeVisible({ timeout: 30_000 });

        await page.locator('[data-fab-id="settings"]').click();
        await expect(page.locator('[data-fab-id="feedback"]')).toBeVisible({ timeout: 10_000 });
        await page.locator('[data-fab-id="feedback"]').click();

        const feedbackModal = page.getByTestId('feedback-modal');
        await expect(feedbackModal).toBeVisible({ timeout: 10_000 });
        await expect(feedbackModal.getByRole('heading', { name: '反馈' })).toBeVisible();

        await feedbackModal.getByPlaceholder(/请描述问题或建议/).fill(probeContent);
        await feedbackModal.getByPlaceholder(/邮箱或 QQ/).fill(probeContact);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/01-feedback-modal-before-submit.png`,
            fullPage: true,
        });

        const submitResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return url.pathname === '/feedback' && response.request().method() === 'POST';
        }, { timeout: 30_000 });
        await feedbackModal.getByRole('button', { name: '提交反馈' }).click();
        const submitResponse = await submitResponsePromise;
        expect(submitResponse.status(), '反馈弹窗 POST /feedback 应成功').toBeLessThan(300);

        const submittedPayload = await submitResponse.json() as {
            _id?: string;
            content?: string;
            reporterType?: string;
            source?: string;
            status?: string;
            contactInfo?: string;
        };
        expect(submittedPayload._id).toBeTruthy();
        expect(submittedPayload.content).toContain(probeContent);
        expect(submittedPayload.reporterType).toBe('user');
        expect(submittedPayload.source).toBe('feedback-modal');
        expect(submittedPayload.status).toBe('open');
        expect(submittedPayload.contactInfo).toBe(probeContact.toLowerCase());

        await expect(feedbackModal).toHaveCount(0, { timeout: 10_000 });

        await expect.poll(async () => {
            const response = await page.request.get('/admin-api/feedback?status=open&reporterType=user&limit=20&sort=newest', {
                failOnStatusCode: false,
            });
            if (!response.ok()) return false;
            const payload = await response.json() as { items?: Array<{ _id?: string; content?: string }> };
            return Boolean(payload.items?.some((item) => item._id === submittedPayload._id && item.content?.includes(probeContent)));
        }, {
            timeout: 30_000,
            intervals: [500, 1000, 2000],
            message: '等待新提交的匿名反馈出现在真实后台反馈 API 中',
        }).toBe(true);

        const apiListResponse = await page.request.get('/admin-api/feedback?status=open&reporterType=user&limit=20&sort=newest');
        const apiListPayload = await apiListResponse.json() as { items?: Array<{ _id?: string; content?: string }> };
        expect(apiListPayload?.items?.some((item) => item._id === submittedPayload._id)).toBeTruthy();

        await waitForFrontendRoute(page, '/admin/feedback');
        await page.goto('/admin/feedback', { waitUntil: 'domcontentloaded' });

        const row = page.locator(`[data-testid="feedback-row"][data-feedback-id="${submittedPayload._id}"]`);
        await expect(row).toBeVisible({ timeout: 60_000 });
        await expect(row).toContainText(probeContent);

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/02-admin-feedback-list-after-submit.png`,
            fullPage: true,
        });

        await row.click();
        await expect(page.getByText(probeContent).last()).toBeVisible();
        await expect(page.getByText(probeContact.toLowerCase()).last()).toBeVisible();

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/03-admin-feedback-detail-after-submit.png`,
            fullPage: true,
        });
    });
});
