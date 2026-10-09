import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { test, expect } from './framework';
import {
    createEvidenceScreenshotRun,
    getEvidenceScreenshotPathInDirectory,
    promoteEvidenceScreenshotRun,
} from './framework/evidenceScreenshots';

const VIEWPORT = { width: 1920, height: 1080 };
const PASSWORD = 'ClearView42';

test('经典首页桌面网页登录与注册密码眼睛显隐', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const evidenceRun = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const screenshots = [
        { name: '01-登录密码遮蔽状态.png', stage: '前态', description: '网页登录框输入密码后眼睛图标清晰可见，密码仍为圆点' },
        { name: '02-登录眼睛展开密码.png', stage: '中态', description: '点击网页登录眼睛后输入的密码文字清楚可读' },
        { name: '03-注册双密码遮蔽状态.png', stage: '中态', description: '网页注册密码和确认密码均已输入且仍被圆点遮蔽' },
        { name: '04-注册眼睛展开双密码.png', stage: '后态', description: '点击网页注册两只眼睛后两项密码文字清楚可读' },
    ] as const;

    await page.setViewportSize(VIEWPORT);
    await page.addInitScript(() => {
        localStorage.setItem('i18nextLng', 'zh-CN');
    });
    await page.route('**/auth/me', async (route) => {
        await route.fulfill({
            status: 401,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({ error: 'unauthorized' }),
        });
    });

    await page.goto('/?homeStyle=classic', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toHaveAttribute('data-home-entry-style', 'classic');
    const loginEntry = page.locator('header button:has-text("登录")').first();
    await expect(loginEntry).toBeVisible({ timeout: 15000 });
    await page.addStyleTag({
        content: `
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
                scroll-behavior: auto !important;
            }
        `,
    });
    await loginEntry.click({ force: true });

    const modal = page.getByTestId('auth-modal').first();
    await expect(modal).toBeVisible({ timeout: 10000 });
    const waitForModalAnimations = async () => {
        await expect.poll(() => modal.evaluate((element) => {
            const content = element.closest('.modal-base-container');
            const overlay = content?.previousElementSibling;
            if (!content || !overlay) return false;

            return [content, overlay].every((surface) =>
                surface.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running'),
            );
        })).toBe(true);
    };
    await waitForModalAnimations();

    const saveScreenshot = async (screenshotIndex: number) => {
        const screenshot = screenshots[screenshotIndex];
        const screenshotPath = getEvidenceScreenshotPathInDirectory(
            evidenceRun.stagingDir,
            screenshot.name,
            { filename: screenshot.name, format: 'png', requireChineseName: true },
        );
        await page.screenshot({ path: screenshotPath, type: 'png', fullPage: false });
        return screenshotPath;
    };

    const expectPasswordToggleVisible = async (testId: string) => {
        const toggle = modal.getByTestId(testId);
        await expect(toggle).toBeVisible();
        const geometry = await toggle.evaluate((button) => {
            const rect = button.getBoundingClientRect();
            const icon = button.querySelector('svg')?.getBoundingClientRect();
            return {
                buttonInsideViewport: rect.left >= 0
                    && rect.top >= 0
                    && rect.right <= window.innerWidth
                    && rect.bottom <= window.innerHeight,
                iconWidth: icon?.width ?? 0,
                iconHeight: icon?.height ?? 0,
                iconSourceWidth: Number(button.querySelector('svg')?.getAttribute('width') ?? 0),
                iconSourceHeight: Number(button.querySelector('svg')?.getAttribute('height') ?? 0),
            };
        });
        expect(geometry.buttonInsideViewport).toBe(true);
        expect(geometry.iconSourceWidth).toBe(18);
        expect(geometry.iconSourceHeight).toBe(18);
        expect(geometry.iconWidth).toBeGreaterThanOrEqual(16);
        expect(geometry.iconHeight).toBeGreaterThanOrEqual(16);
        return toggle;
    };

    const loginPassword = modal.getByTestId('auth-login-password-input');
    await loginPassword.fill(PASSWORD);
    const loginToggle = await expectPasswordToggleVisible('auth-login-password-toggle');
    await expect(loginPassword).toHaveAttribute('type', 'password');
    const screenshotPaths = [await saveScreenshot(0)];

    await loginToggle.click();
    await expect(loginPassword).toHaveAttribute('type', 'text');
    await expect(loginPassword).toHaveValue(PASSWORD);
    await expect(loginToggle).toHaveAttribute('aria-pressed', 'true');
    screenshotPaths.push(await saveScreenshot(1));
    await loginToggle.click();
    await expect(loginPassword).toHaveAttribute('type', 'password');

    await modal.getByTestId('auth-switch-register').click();
    const registerPassword = modal.getByTestId('auth-register-password-input');
    const confirmPassword = modal.getByTestId('auth-register-confirm-password-input');
    await expect(registerPassword).toBeVisible();
    await expect(confirmPassword).toBeVisible();
    await waitForModalAnimations();
    await registerPassword.fill(PASSWORD);
    await confirmPassword.fill(PASSWORD);
    const registerToggle = await expectPasswordToggleVisible('auth-register-password-toggle');
    const confirmToggle = await expectPasswordToggleVisible('auth-register-confirm-password-toggle');
    await expect(registerPassword).toHaveAttribute('type', 'password');
    await expect(confirmPassword).toHaveAttribute('type', 'password');
    screenshotPaths.push(await saveScreenshot(2));

    await registerToggle.click();
    await confirmToggle.click();
    await expect(registerPassword).toHaveAttribute('type', 'text');
    await expect(confirmPassword).toHaveAttribute('type', 'text');
    await expect(registerPassword).toHaveValue(PASSWORD);
    await expect(confirmPassword).toHaveValue(PASSWORD);
    screenshotPaths.push(await saveScreenshot(3));
    await registerToggle.click();
    await confirmToggle.click();
    await expect(registerPassword).toHaveAttribute('type', 'password');
    await expect(confirmPassword).toHaveAttribute('type', 'password');

    const media = screenshots.map((screenshot, index) => ({
        path: screenshot.name,
        chainId: '登录与注册密码显隐',
        chainStep: String(index + 1),
        sourceRun: evidenceRun.runId,
        sourceDir: basename(evidenceRun.stableDir),
        stage: screenshot.stage,
        description: screenshot.description,
    }));
    await writeFile(
        join(evidenceRun.stagingDir, '.e2e-image-index.json'),
        `${JSON.stringify({ media }, null, 2)}\n`,
        'utf8',
    );

    const loginRequirement = '登录密码眼睛可见，点击后能显示密码，再次点击可重新遮蔽';
    const registerRequirement = '注册密码和确认密码的眼睛均可见，点击后能显示各自密码，再次点击可重新遮蔽';
    const manifest = {
        verdict: 'PASS',
        scope: 'current-user-request',
        gameId: '_shared',
        evidenceCategory: 'independent',
        generatedAt: new Date().toISOString(),
        sourceRun: evidenceRun.runId,
        sourceEntry: '/?homeStyle=classic',
        viewport: VIEWPORT,
        evidenceIndex: '.e2e-image-index.json',
        requirements: [
            {
                requirement: loginRequirement,
                status: 'PASS',
                evidence: [screenshots[0].name, screenshots[1].name],
            },
            {
                requirement: registerRequirement,
                status: 'PASS',
                evidence: [screenshots[2].name, screenshots[3].name],
            },
        ],
        coverageMatrix: [
            {
                requirement: loginRequirement,
                playerAction: '在登录框输入密码并点击眼睛按钮',
                directAssertion: '输入框从 password 切换为 text，再次点击后恢复 password，眼睛图标源尺寸为 18 CSS px 且变换后不小于 16 CSS px',
                visibleResult: '登录密码由圆点变为可读文字，按钮始终留在视口内',
                media: [screenshots[0].name, screenshots[1].name],
                uncoveredScope: '未覆盖找回密码模式和移动视口',
            },
            {
                requirement: registerRequirement,
                playerAction: '在注册框分别点击密码和确认密码旁的眼睛按钮',
                directAssertion: '两个输入框都能独立切换为 text 并再次恢复 password，眼睛图标源尺寸均为 18 CSS px 且变换后不小于 16 CSS px',
                visibleResult: '密码和确认密码都由圆点变为可读文字，两个按钮均留在视口内',
                media: [screenshots[2].name, screenshots[3].name],
                uncoveredScope: '未覆盖验证码、找回密码模式和移动视口',
            },
        ],
        media: screenshots.map((screenshot) => join(evidenceRun.stableDir, screenshot.name)),
        display: {
            purpose: 'final-user-visible-delivery',
            trigger: 'user-requested-evidence',
            viewer: 'web',
            finalPassBeforeOpen: true,
        },
    };
    await writeFile(
        join(evidenceRun.stagingDir, '密码显隐-PASS.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
    );

    const stableDir = await promoteEvidenceScreenshotRun(evidenceRun);
    console.log(`[auth-password-evidence] runId=${evidenceRun.runId} stableDir=${stableDir} screenshots=${screenshotPaths.length}`);
});
