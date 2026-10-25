import { test, expect, initHome, login, switchStyle, openGame, capture, record, rememberAvatarUpload } from './helpers/homeAcceptance';
import sharp from 'sharp';

for (const mobile of [false, true]) {
    test(`${mobile ? '手机' : '桌面'}个人资料经服务端保存、刷新与重新登录恢复`, async ({ browser, accounts }, info) => {
        info.setTimeout(60_000);
        const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: mobile ? { width: 375, height: 812 } : { width: 1920, height: 1080 }, hasTouch: mobile, isMobile: mobile });
        try {
            const page = await context.newPage(); await initHome(page); await login(page, accounts.alice);
            await page.getByTestId('user-menu-trigger').click(); await page.getByTestId('user-menu-profile').click();
            await page.getByRole('button', { name: '编辑个人资料', exact: true }).click();
            const name = `验收昵称${mobile ? '手机' : '桌面'}`;
            await page.getByRole('textbox', { name: '昵称', exact: true }).fill(name);
            const avatar = await sharp('public/avatars/planet.svg').resize(240, 240).png().toBuffer();
            await page.getByRole('button', { name: '修改头像', exact: true }).click();
            const chooser = page.locator('[data-platform-dialog="avatar"]');
            await chooser.getByRole('button', { name: '自行上传', exact: true }).click();
            const fileChooserOpened = page.waitForEvent('filechooser');
            const chooseImage = chooser.getByRole('button', { name: '选择图片', exact: true });
            if (mobile) await chooseImage.tap(); else await chooseImage.click();
            await (await fileChooserOpened).setFiles({ name: '合成星球头像.png', mimeType: 'image/png', buffer: avatar });
            const avatarUpload = page.waitForResponse(r => r.url().endsWith('/auth/upload-avatar') && r.request().method() === 'POST');
            await expect(chooser.getByRole('button', { name: '上传头像', exact: true })).toBeEnabled();
            await chooser.getByRole('button', { name: '上传头像', exact: true }).click();
            const avatarResponse = await avatarUpload; expect(avatarResponse.ok()).toBe(true);
            await expect(chooser).toHaveCount(0);
            await capture(page, `${mobile ? '手机' : '桌面'}-个人资料编辑`);
            const update = page.waitForResponse(r => r.url().endsWith('/auth/update-username') && r.request().method() === 'POST');
            await page.getByRole('button', { name: '保存资料', exact: true }).click();
            expect((await update).ok()).toBe(true);
            const savedAvatar = (await avatarResponse.json()).user.avatar as string; rememberAvatarUpload(savedAvatar);
            expect(savedAvatar).toMatch(new RegExp(`^/assets/avatars/${accounts.alice.id}-\\d+\\.webp$`));
            await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
            await page.reload(); await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
            await expect(page.getByTestId('profile-page').getByRole('img', { name, exact: true })).toHaveAttribute('src', savedAvatar);
            await expect.poll(() => page.getByTestId('profile-page').getByRole('img', { name, exact: true }).evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
            await page.getByTestId('user-menu-trigger').click(); await page.locator('[data-user-menu-panel] > button').last().click();
            await login(page, accounts.alice);
            await page.getByTestId('user-menu-trigger').click(); await page.getByTestId('user-menu-profile').click();
            await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
            await expect(page.getByTestId('profile-page').getByRole('img', { name, exact: true })).toHaveAttribute('src', savedAvatar);
            // 同一份资料必须能从经典既有账户设置读回，并能从该入口继续修改。
            await page.goto('/'); await switchStyle(page, 'classic');
            await page.getByTestId('user-menu-trigger').click();
            await page.getByTestId('user-menu-account-settings').click();
            const accountSettings = page.getByTestId('account-settings-modal');
            await expect(accountSettings.getByText(name, { exact: true })).toBeVisible();
            await expect(accountSettings.getByRole('img', { name, exact: true })).toHaveAttribute('src', savedAvatar);
            await page.getByTestId('account-settings-edit-nickname').click();
            const classicName = `${name}经典`;
            await page.getByTestId('account-settings-nickname-input').fill(classicName);
            const classicUpdate = page.waitForResponse(r => r.url().endsWith('/auth/update-username') && r.request().method() === 'POST');
            await page.getByTestId('account-settings-save-nickname').click();
            expect((await classicUpdate).ok()).toBe(true);
            await expect(accountSettings.getByText(classicName, { exact: true })).toBeVisible();
            await page.reload();
            await page.getByTestId('user-menu-trigger').click();
            await page.getByTestId('user-menu-account-settings').click();
            await expect(accountSettings.getByText(classicName, { exact: true })).toBeVisible();
            await expect(accountSettings.getByRole('img', { name: classicName, exact: true })).toHaveAttribute('src', savedAvatar);
            await record(`${mobile ? '手机' : '桌面'}-经典资料读写`, { classicName, nicknameServerSave: true, reload: true, sharedAvatarReadback: savedAvatar });
            await record(`${mobile ? '手机' : '桌面'}-资料`, { name, serverSave: true, avatarUploadStatus: avatarResponse.status(), avatarReadback: savedAvatar, reload: true, relogin: true });
        } finally { await context.close(); }
    });
}

for (const style of ['modern', 'classic'] as const) {
    test(`${style}首页详情的教程与配置入口到达真实可操作页面`, async ({ page }) => {
        test.setTimeout(75_000);
        await initHome(page); if (style === 'classic') await switchStyle(page, style);
        await openGame(page, style, 'smashup', '大杀四方');
        await page.getByTestId('game-details-config-review-button').click();
        await expect(page).toHaveURL(/\/games\/smashup\/config/);
        await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 30_000 });
        await capture(page, `${style}-配置入口`);
        await page.goto('/'); await openGame(page, style, 'smashup', '大杀四方');
        await page.getByRole('button', { name: '教程模式', exact: true }).click();
        await expect(page).toHaveURL(/\/play\/smashup\/tutorial/);
        // 目录页必须能进入实际教程，不能只证明路由变化。
        const entry = page.getByRole('button', { name: /基础.*教程|开始学习|开始教程/ }).first();
        if (await entry.count()) await entry.click();
        await expect(page.locator('[data-game-page][data-game-id="smashup"]').first()).toBeVisible({ timeout: 45_000 });
        await record(`${style}-教程配置`, { configurationLoaded: true, tutorialMounted: true, boundary: '仅验证入口与实际教程挂载，不声称教程完整内容验收' });
    });
}
