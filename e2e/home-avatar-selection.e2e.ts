import sharp from 'sharp';
import type { CDPSession, Locator, Page } from '@playwright/test';
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
async function imageTransform(image: Locator) {
    return image.evaluate(node => getComputedStyle(node).transform);
}
async function mouseDragCrop(page: Page, cropper: Locator, image: Locator) {
    const box = await cropper.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
    const before = await imageTransform(image);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 36, y + 24, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => imageTransform(image)).not.toBe(before);
}
async function expectPanRoom(cropper: Locator, image: Locator) {
    const [frame, photo] = await Promise.all([cropper.boundingBox(), image.boundingBox()]);
    expect(frame).not.toBeNull();
    expect(photo).not.toBeNull();
    expect(photo!.width > frame!.width || photo!.height > frame!.height).toBe(true);
}
async function mouseWheelZoom(page: Page, cropper: Locator, image: Locator, zoom: Locator) {
    const box = await cropper.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
    const beforeTransform = await imageTransform(image);
    const beforeZoom = Number(await zoom.inputValue());
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -120);
    await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(beforeZoom);
    await expect.poll(() => imageTransform(image)).not.toBe(beforeTransform);
}
function touchPoint(id: number, x: number, y: number) {
    return { id, x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1 };
}
async function touchDragCrop(page: Page, input: CDPSession, cropper: Locator, image: Locator) {
    const box = await cropper.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
    const before = await imageTransform(image);
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(1, x, y)] });
    for (let step = 1; step <= 6; step++) {
        await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(1, x + 28 * step / 6, y + 18 * step / 6)] });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    }
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => imageTransform(image)).not.toBe(before);
}
async function pinchZoomCrop(page: Page, input: CDPSession, cropper: Locator, image: Locator, zoom: Locator) {
    const box = await cropper.boundingBox();
    expect(box).not.toBeNull();
    const centerX = box!.x + box!.width / 2, centerY = box!.y + box!.height / 2;
    const beforeTransform = await imageTransform(image);
    const beforeZoom = Number(await zoom.inputValue());
    const startHalfWidth = 20, endHalfWidth = 42;
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        touchPoint(1, centerX - startHalfWidth, centerY), touchPoint(2, centerX + startHalfWidth, centerY),
    ] });
    for (let step = 1; step <= 6; step++) {
        const halfWidth = startHalfWidth + (endHalfWidth - startHalfWidth) * step / 6;
        await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
            touchPoint(1, centerX - halfWidth, centerY), touchPoint(2, centerX + halfWidth, centerY),
        ] });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    }
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(beforeZoom);
    await expect.poll(() => imageTransform(image)).not.toBe(beforeTransform);
}
for (const { label, viewport, mobile, captureStates } of [
    { label: '桌面', viewport: { width: 1920, height: 1080 }, mobile: false, captureStates: true },
    { label: '手机', viewport: { width: 375, height: 812 }, mobile: true, captureStates: true },
    { label: '宽屏', viewport: { width: 2560, height: 1304 }, mobile: false, captureStates: false },
]) test(`${label}现代头像默认、预设及上传共用保存链并隔离账户`, async ({ browser, accounts }, info) => {
    info.setTimeout(120_000);
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport, isMobile: mobile, hasTouch: mobile });
    try {
        const page = await context.newPage(); await initHome(page); await login(page, accounts.alice); await profile(page);
        const touchInput = mobile ? await context.newCDPSession(page) : null;
        const activate = async (button: Locator) => mobile ? button.tap() : button.click();
        const chooser = page.locator('[data-platform-dialog="avatar"]');
        const avatar = page.locator('.platform-profile-avatar img');
        const uploadedRequests: string[] = [];
        page.on('request', request => {
            if (request.url().endsWith('/auth/upload-avatar') && request.method() === 'POST') uploadedRequests.push(request.url());
        });
        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        await expect(chooser.locator('.avatar-modal-title')).toHaveCSS('font-size','24px');
        await activate(chooser.getByRole('button', { name: '选择预设头像', exact: true }));
        await expect(chooser.getByRole('button', { name: '默认', exact: true })).toBeVisible();
        await expect(chooser.getByRole('button', { name: '使用默认头像', exact: true })).toHaveCount(0);
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
        const presets = chooser.locator('.avatar-presets img');
        await expect(presets).toHaveCount(7);
        await expect.poll(() => presets.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
        if(captureStates)await capture(page,`${label}-头像预设选择`);
        await activate(chooser.getByRole('button', { name: '骰子', exact: true }));
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
        if (captureStates) await capture(page, `${label}-头像上传入口`);
        const image = await sharp('public/avatars/planet.svg').resize(240, 240).png().toBuffer();
        await expect(chooser).not.toContainText('拖拽');
        const pickerOpened = page.waitForEvent('filechooser');
        await activate(chooser.getByRole('button', { name: '上传头像', exact: true }));
        const fileChooser = await pickerOpened;
        await fileChooser.setFiles({ name: '不支持的文本.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic invalid upload') });
        await expect(chooser.getByRole('alert')).toBeVisible();
        if (captureStates) await capture(page, `${label}-头像格式错误`);
        const retryPicker = page.waitForEvent('filechooser');
        await activate(chooser.getByRole('button', { name: '上传头像', exact: true }));
        await (await retryPicker).setFiles({ name: '合成星球头像.png', mimeType: 'image/png', buffer: image });
        const upload = chooser.getByRole('button', { name: '保存', exact: true });
        await expect(upload).toBeEnabled();
        const zoom = chooser.getByRole('slider', { name: '缩放', exact: true });
        const cropper = chooser.locator('[data-testid="avatar-crop-frame"] .reactEasyCrop_Container');
        const cropImage = cropper.locator('.reactEasyCrop_Image');
        await expect(chooser).toHaveAttribute('data-avatar-step', 'crop');
        await expect(chooser.locator('.avatar-sources')).toHaveCount(0);
        await expect(chooser.getByText(mobile ? '拖动照片调整位置，双指缩放；滑块精调' : '拖动照片调整位置，滚轮或滑块缩放', { exact: true })).toBeVisible();
        await expect(chooser.getByRole('button', { name: '关闭', exact: true })).toBeVisible();
        const avatarBeforeCancel = await avatar.evaluateAll(images => images.map(node => node.getAttribute('src')));
        if (mobile) {
            await pinchZoomCrop(page, touchInput!, cropper, cropImage, zoom);
            await expectPanRoom(cropper, cropImage);
            await touchDragCrop(page, touchInput!, cropper, cropImage);
        } else {
            await mouseWheelZoom(page, cropper, cropImage, zoom);
            await expectPanRoom(cropper, cropImage);
            await mouseDragCrop(page, cropper, cropImage);
        }
        await zoom.focus(); await page.keyboard.press('ArrowRight');
        await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(1);
        if (captureStates) await capture(page, `${label}-头像裁剪`);

        const reselectOpened=page.waitForEvent('filechooser');
        await activate(chooser.getByRole('button', {name:'重新选择',exact:true}));
        await (await reselectOpened).setFiles({name:'合成星球头像.png',mimeType:'image/png',buffer:image});
        await expect(chooser.locator('.avatar-sources')).toHaveCount(0);
        await activate(chooser.getByRole('button', {name:'关闭',exact:true}));
        await expect(chooser).toHaveCount(0);
        expect(uploadedRequests).toHaveLength(0);
        await expect.poll(() => avatar.evaluateAll(images => images.map(node => node.getAttribute('src')))).toEqual(avatarBeforeCancel);

        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        const savePickerOpened = page.waitForEvent('filechooser');
        await activate(chooser.getByRole('button', { name: '上传头像', exact: true }));
        await (await savePickerOpened).setFiles({ name: '合成星球头像.png', mimeType: 'image/png', buffer: image });
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
        const uploaded = page.waitForResponse(response => response.url().endsWith('/auth/upload-avatar') && response.request().method() === 'POST');
        await activate(upload);
        const response = await uploaded; expect(response.ok()).toBe(true);
        expect(uploadedRequests).toHaveLength(1);
        const uploadedUrl = (await response.json()).user.avatar as string; rememberAvatarUpload(uploadedUrl);
        await expect(chooser).toHaveCount(0);
        await expect(avatar).toHaveAttribute('src', uploadedUrl);
        await page.reload(); await expect(avatar).toHaveAttribute('src', uploadedUrl);
        await expect.poll(() => avatar.evaluate(node => (node as HTMLImageElement).naturalWidth > 0)).toBe(true);

        // 恢复默认必须覆盖刚上传的头像，刷新和重新登录都不能再显示旧上传图。
        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        await activate(chooser.getByRole('button', { name: '选择预设头像', exact: true }));
        await activate(chooser.getByRole('button', { name: '默认', exact: true }));
        await expect(chooser.getByRole('button', { name: '使用默认头像', exact: true })).toHaveCount(0);
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toBeVisible();
        const defaultSaving = page.waitForResponse(r => r.url().endsWith('/auth/update-avatar') && r.request().method() === 'POST');
        await activate(chooser.getByRole('button', { name: '保存', exact: true }));
        expect((await defaultSaving).ok()).toBe(true);
        await expect(chooser).toHaveCount(0); await expect(avatar).toHaveAttribute('src', '/avatars/default.svg');
        await page.reload(); await expect(avatar).toHaveAttribute('src', '/avatars/default.svg');
        await activate(page.getByRole('button', { name: '修改头像', exact: true }));
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
        await activate(chooser.getByRole('button', { name: '选择预设头像', exact: true }));
        await activate(chooser.getByRole('button', { name: '星球', exact: true }));
        await expect(chooser.getByRole('button', { name: '保存', exact: true })).toBeVisible();
        await activate(chooser.getByRole('button', { name: '关闭', exact: true }));
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
