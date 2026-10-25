import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import { test, expect, initHome, login, capture, record, rememberAvatarUpload } from './helpers/homeAcceptance';

async function profile(page: Page) {
    await page.getByTestId('user-menu-trigger').click();
    await page.getByTestId('user-menu-profile').click();
    await expect(page.getByTestId('profile-page')).toBeVisible();
}
async function logout(page: Page) {
    await page.getByTestId('user-menu-trigger').click();
    await page.locator('[data-user-menu-panel] > button').last().click();
    await expect(page.getByTestId('user-menu-trigger')).toHaveCount(0);
}
for (const { label, viewport, mobile } of [
    { label: '桌面', viewport: { width: 1920, height: 1080 }, mobile: false },
    { label: '手机', viewport: { width: 375, height: 812 }, mobile: true },
    { label: '宽屏', viewport: { width: 2560, height: 1304 }, mobile: false },
]) test(`${label}现代头像默认、预设及上传共用保存链并隔离账户`, async ({ browser, accounts }, info) => {
    info.setTimeout(120_000);
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, isMobile: mobile, hasTouch: mobile });
    try {
        const page = await context.newPage(); await initHome(page); await login(page, accounts.alice); await profile(page);
        const activate = async (button: Locator) => mobile ? button.tap() : button.click();
        const chooser = page.locator('[data-platform-dialog="avatar"]');
        const avatar = page.locator('.platform-profile-avatar img');
        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        await activate(chooser.getByRole('button', { name: '默认', exact: true }));
        await expect(chooser.getByRole('img', { name: '默认', exact: true })).toBeVisible();
        await expect(chooser.getByRole('button', { name: '使用默认头像', exact: true })).toHaveCount(0);
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
        await capture(page, `${label}-头像默认选择`);
        await activate(chooser.getByRole('button', { name: '预设', exact: true }));
        const presets = chooser.locator('.avatar-presets img');
        await expect(presets).toHaveCount(6);
        await expect.poll(() => presets.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
        await activate(chooser.getByRole('button', { name: '骰子', exact: true }));
        await capture(page, `${label}-头像预设选择`);
        const presetSaving = page.waitForResponse(response => response.url().endsWith('/auth/update-avatar') && response.request().method() === 'POST');
        await activate(chooser.getByRole('button', { name: '保存', exact: true }));
        expect((await presetSaving).ok()).toBe(true);
        await expect(chooser).toHaveCount(0);
        await expect(avatar).toHaveAttribute('src', '/avatars/dice.svg');
        await page.reload(); await expect(avatar).toHaveAttribute('src', '/avatars/dice.svg');
        // 已保存后的资料屏未改；本轮只重拍头像弹窗实际改写的状态。
        await logout(page); await login(page, accounts.alice); await profile(page);
        await expect(avatar).toHaveAttribute('src', '/avatars/dice.svg');

        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        await activate(chooser.getByRole('button', { name: '自行上传', exact: true }));
        await capture(page, `${label}-头像上传入口`);
        const image = await sharp('public/avatars/planet.svg').resize(240, 240).png().toBuffer();
        await expect(chooser).not.toContainText('拖拽');
        const pickerOpened = page.waitForEvent('filechooser');
        await activate(chooser.getByRole('button', { name: '选择图片', exact: true }));
        const fileChooser = await pickerOpened;
        await fileChooser.setFiles({ name: '不支持的文本.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic invalid upload') });
        await expect(chooser.getByRole('alert')).toBeVisible();
        await capture(page, `${label}-头像格式错误`);
        const retryPicker = page.waitForEvent('filechooser');
        await activate(chooser.getByRole('button', { name: '选择图片', exact: true }));
        await (await retryPicker).setFiles({ name: '合成星球头像.png', mimeType: 'image/png', buffer: image });
        const upload = chooser.getByRole('button', { name: '上传头像', exact: true });
        await expect(upload).toBeEnabled();
        const zoom = chooser.getByRole('slider', { name: '缩放', exact: true });
        await zoom.focus(); await page.keyboard.press('ArrowRight');
        await expect(zoom).toHaveValue('1.05');
        await capture(page, `${label}-头像裁剪`);
        const uploaded = page.waitForResponse(response => response.url().endsWith('/auth/upload-avatar') && response.request().method() === 'POST');
        await activate(upload);
        const response = await uploaded; expect(response.ok()).toBe(true);
        const uploadedUrl = (await response.json()).user.avatar as string; rememberAvatarUpload(uploadedUrl);
        await expect(chooser).toHaveCount(0);
        await expect(avatar).toHaveAttribute('src', uploadedUrl);
        await page.reload(); await expect(avatar).toHaveAttribute('src', uploadedUrl);
        await expect.poll(() => avatar.evaluate(node => (node as HTMLImageElement).naturalWidth > 0)).toBe(true);

        // 恢复默认必须覆盖刚上传的头像，刷新和重新登录都不能再显示旧上传图。
        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        await activate(chooser.getByRole('button', { name: '默认', exact: true }));
        await expect(chooser.getByRole('button', { name: '使用默认头像', exact: true })).toHaveCount(0);
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toBeVisible();
        await capture(page, `${label}-头像恢复默认待保存`);
        const defaultSaving = page.waitForResponse(r => r.url().endsWith('/auth/update-avatar') && r.request().method() === 'POST');
        await activate(chooser.getByRole('button', { name: '保存', exact: true }));
        expect((await defaultSaving).ok()).toBe(true);
        await expect(chooser).toHaveCount(0); await expect(avatar).toHaveAttribute('src', '/avatars/default.svg');
        await page.reload(); await expect(avatar).toHaveAttribute('src', '/avatars/default.svg');
        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
        await activate(chooser.getByRole('button', { name: '预设', exact: true }));
        await activate(chooser.getByRole('button', { name: '星球', exact: true }));
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toBeVisible();
        await activate(chooser.getByRole('button', { name: '取消', exact: true }));
        await expect(avatar).toHaveAttribute('src', '/avatars/default.svg');
        await page.reload(); await expect(avatar).toHaveAttribute('src', '/avatars/default.svg');
        await logout(page); await login(page, accounts.alice); await profile(page);
        await expect(avatar).toHaveAttribute('src', '/avatars/default.svg');
        await logout(page); await login(page, accounts.bob); await profile(page);
        await expect(avatar).toHaveCount(0);
        await record(`${label}-头像持久化`, { preset: '/avatars/dice.svg', upload: uploadedUrl, restoredDefault: '/avatars/default.svg',
            reload: true, relogin: true, otherAccountUnchanged: true, fileChooserOpenedFromVisibleButton: true,
            unchangedDefaultHasNoSave: true, sharedSaveOnlyForChangedAvatar: true, canceledPresetNotSaved: true,
            uploadFixture: '项目星球图标转为PNG作为合成上传输入',
            boundary: '实际接口、存储、裁剪和读回验证；不重复拍摄纯头像数据变化后的相同界面' });
    } finally { await context.close(); }
});
