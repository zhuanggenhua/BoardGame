import { expect, test } from '@playwright/test';
import path from 'node:path';
import { createEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { disableTutorial, enableTestMode, injectDirectApiServerUrl, injectDirectGameServerUrl, setChineseLocale } from '../helpers/common';
import { chooseFateIdentity } from './identitySelection';

test('正式在线房标记未完角色，并播放背景音乐和实际部署音效', async ({ page, context }, testInfo) => {
    test.setTimeout(150000);
    const evidence = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    await enableTestMode(context);
    await injectDirectGameServerUrl(context);
    await injectDirectApiServerUrl(context);
    await setChineseLocale(context);
    await disableTutorial(context);
    await context.addInitScript(() => {
        localStorage.setItem('audio_muted', 'false');
        localStorage.setItem('audio_master_volume', '1');
        const playback = { bgm: [] as string[], sfx: 0 };
        Object.assign(window, { fateAudioPlayback: playback });
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
            return play.call(this).then(() => { playback.bgm.push(this.currentSrc); });
        };
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
            start.apply(this, args);
            if (this.buffer && this.context.state === 'running') playback.sfx++;
        };
    });
    const readAudio = () => page.evaluate(() => (window as unknown as { fateAudioPlayback: { bgm: string[]; sfx: number } }).fateAudioPlayback);
    const loadedAudio = new Set<string>();
    page.on('response', response => { if (response.ok()) loadedAudio.add(response.url()); });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click();
    await page.getByTestId('game-details-open-create-room').first().click();
    const create = page.getByTestId('create-room-modal').last();
    await create.getByRole('button', { name: '3人', exact: true }).click();
    await create.getByRole('button', { name: /^加入 AI/ }).click();
    await create.getByTestId('create-room-confirm-button').click();
    await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/);
    const incompleteMaster = page.getByTestId('fate-setup-master-m_rin');
    await expect(incompleteMaster.getByTestId('fate-identity-status-m_rin-label')).toHaveText('实施中');
    await expect(incompleteMaster).toBeEnabled();
    await expect(page.getByTestId('fate-identity-status-m_waver-label')).toHaveText('实施中');
    await expect(page.getByTestId('fate-identity-status-m_kirei-label')).toHaveText('实施中');
    await incompleteMaster.click();
    await page.screenshot({ path: path.join(evidence.stagingDir, '01-御主实施状态.png') });
    const moonveil = /Fantasy(?:%20| )Vol8(?:%20| )Moonveil(?:%20| )Main\.ogg/i;
    await expect.poll(async () => (await readAudio()).bgm.some(url => moonveil.test(url)), { timeout: 30000 }).toBe(true);
    await chooseFateIdentity(page, 'master', 'm_waver');
    await chooseFateIdentity(page, 'servant', 'servant-berserker');
    const incompleteServant = page.getByTestId('fate-setup-servant-servant-berserker');
    await expect(incompleteServant.getByTestId('fate-identity-status-servant-berserker-label')).toHaveText('实施中');
    await expect(incompleteServant).toBeEnabled();
    await page.screenshot({ path: path.join(evidence.stagingDir, '02-从者实施状态.png') });
    await page.getByTestId('fate-domination-primary-action').click();

    const point = page.getByRole('button', { name: '部署到魔术工房第1点位' });
    await expect(point).toBeEnabled({ timeout: 30000 });
    const before = (await readAudio()).sfx;
    await point.click();
    await expect.poll(() => [...loadedAudio].some(url => url.includes('footstep_concrete_000.ogg')), { timeout: 15000 }).toBe(true);
    await expect.poll(async () => (await readAudio()).sfx, { timeout: 10000 }).toBeGreaterThan(before);
    console.log('[Fate setup and audio]', evidence.stagingDir);
});
