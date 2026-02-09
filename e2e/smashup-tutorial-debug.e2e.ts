import { test, expect } from '@playwright/test';

test.describe('SmashUp Tutorial 诊断', () => {
    test('AI setup 步骤执行 — 无崩溃且推进到 welcome', async ({ page }) => {
        // 收集浏览器日志
        const errors: string[] = [];
        const keyLogs: string[] = [];

        page.on('console', msg => {
            const text = msg.text();
            if (msg.type() === 'error') {
                errors.push(text);
            }
            if (
                text.includes('TutorialSystem') ||
                text.includes('TutorialContext') ||
                text.includes('startTutorial') ||
                text.includes('useTutorialBridge') ||
                text.includes('ADVANCE_PHASE') ||
                text.includes('MERGE_STATE') ||
                text.includes('Cannot read properties')
            ) {
                keyLogs.push(`[${msg.type()}] ${text}`);
            }
        });

        page.on('pageerror', err => {
            errors.push(`PAGE_ERROR: ${err.message}`);
        });

        // 导航到教学页面
        await page.goto('/play/smashup/tutorial');
        await page.waitForLoadState('networkidle');

        // 等待教学步骤推进到 welcome（最多 30s）
        let welcomeAppeared = false;
        try {
            await page.waitForFunction(
                () => {
                    const el = document.querySelector('[data-tutorial-step-id]');
                    return el?.getAttribute('data-tutorial-step-id') === 'welcome';
                },
                { timeout: 30000 },
            );
            welcomeAppeared = true;
        } catch {
            // 超时
        }

        // 输出诊断信息
        console.log('=== Welcome appeared:', welcomeAppeared, '===');
        if (errors.length > 0) {
            console.log('=== ERRORS ===');
            errors.forEach(e => console.log(e));
        }
        if (keyLogs.length > 0) {
            console.log('=== Key logs ===');
            keyLogs.forEach(l => console.log(l));
        }

        // 检查无 React 崩溃
        const hasCrash = errors.some(e => e.includes('Cannot read properties'));
        expect(hasCrash).toBe(false);

        // 检查 welcome 步骤出现
        expect(welcomeAppeared).toBe(true);
    });
});
