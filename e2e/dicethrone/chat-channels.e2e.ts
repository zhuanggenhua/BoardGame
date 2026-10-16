import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../framework';
import { cleanupDTMatch, setupOnlineMatch, selectCharacter, readyAndStartGame, waitForGameBoard } from '../helpers/dicethrone';
import { initContext } from '../helpers/common';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

async function capture(page: Page, info: TestInfo, name: string) {
    const path = getEvidenceScreenshotPath(info, name, { requireChineseName: true });
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, fullPage: false });
}
async function send(page: Page, text: string) {
    await page.getByTestId('chat-message-input').fill(text);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await expect(page.getByTestId('chat-message-input')).toHaveValue('');
    await expect(page.getByRole('log').getByText(text, { exact: true })).toBeVisible();
}

async function expectCompactChat(page: Page) {
    const panel = page.getByTestId('match-chat-panel');
    const bounds = await panel.boundingBox();
    const messages = await panel.getByRole('log').boundingBox();
    expect(bounds).not.toBeNull();
    expect(messages).not.toBeNull();
    expect(messages!.height / bounds!.height).toBeGreaterThan(0.6);
    for (const tab of await panel.getByRole('tab').all()) {
        const tabBounds = await tab.boundingBox();
        expect(tabBounds!.height).toBeLessThanOrEqual(30);
        expect(tabBounds!.width / bounds!.width).toBeLessThan(0.3);
    }
}

test('玩家与观战席统一数字未读角标并切换频道', async ({ browser, baseURL }, info) => {
    test.setTimeout(240000);
    const setup = await setupOnlineMatch(browser, baseURL, { blockLobbySocket: false, skipImageGate: false });
    if (!setup) throw new Error('无法创建真实联机房间');
    const audience = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } });
    await initContext(audience, { blockLobbySocket: false, skipImageGate: false });
    try {
        const { hostPage: host, guestPage: guest, matchId } = setup;
        await host.setViewportSize({ width: 1920, height: 1080 });
        await guest.setViewportSize({ width: 1920, height: 1080 });
        await selectCharacter(host, 'barbarian'); await selectCharacter(guest, 'moon_elf');
        await readyAndStartGame(host, guest);
        await Promise.all([waitForGameBoard(host), waitForGameBoard(guest)]);
        const spectator = await audience.newPage();
        await spectator.goto(`/play/dicethrone/match/${matchId}?spectate=1`);
        await waitForGameBoard(spectator);
        for (const page of [host, guest, spectator]) {
            await page.locator('[data-fab-id="chat"]').click();
            await expect(page.getByTestId('match-chat-panel')).toBeVisible();
        }
        await expect(host.getByRole('tab', { name: '玩家', exact: true })).toHaveAttribute('aria-selected', 'true');
        await expect(host.getByRole('tab', { name: '观战席', exact: true })).toBeVisible();
        await expect(spectator.getByTestId('chat-channel-players')).toHaveCount(0);
        await expect(spectator.getByTestId('chat-channel-room')).toHaveAttribute('aria-selected', 'true');
        await host.getByTestId('hud-chat-emote-toggle').click();
        await expect(host.getByTestId('hud-chat-emote-panel')).toBeVisible();
        await host.getByTestId('hud-chat-emote-toggle').click();
        await expect(host.getByTestId('hud-chat-emote-panel')).toHaveCount(0);
        await send(host, '准备好了，我们开始吧！');
        await expect(guest.getByRole('log').getByText('准备好了，我们开始吧！')).toBeVisible();
        await send(guest, '好，这回合我先看看技能。');
        await expectCompactChat(host);
        await capture(host, info, '01-玩家频道-双方交流与仅玩家可见提示');
        await host.getByTestId('chat-message-input').fill('玩家频道未发出的草稿');
        await host.getByTestId('chat-channel-room').click();
        await expect(host.getByTestId('chat-message-input')).toHaveValue('');
        await send(spectator, '大家好，我来围观学习一下！');
        await expect(host.getByRole('log').getByText('大家好，我来围观学习一下！')).toBeVisible();
        await expect(guest.getByTestId('chat-unread-room')).toBeVisible();
        await expect(guest.getByTestId('chat-unread-room')).toHaveAccessibleName('观战席：1 条未读消息');
        await expect(guest.getByTestId('chat-unread-room')).toHaveText('1');
        await send(host, '欢迎，有规则问题可以在这里问。');
        await expect(spectator.getByRole('log').getByText('欢迎，有规则问题可以在这里问。')).toBeVisible();
        await expect(spectator.getByRole('log').getByText('准备好了，我们开始吧！')).toHaveCount(0);
        await capture(host, info, '02-观战席-玩家与观众公开交流');
        await capture(spectator, info, '03-观众视角-默认可发言且无玩家频道');
        await host.getByTestId('chat-channel-players').click();
        await expect(host.getByTestId('chat-message-input')).toHaveValue('玩家频道未发出的草稿');
        await expect(host.getByRole('log').getByText('大家好，我来围观学习一下！')).toHaveCount(0);
        await host.getByTestId('chat-message-input').fill('');
        await expect(guest.getByTestId('chat-unread-room')).toHaveAccessibleName('观战席：2 条未读消息');
        await expect(guest.getByTestId('chat-unread-room')).toHaveText('2');
        await capture(guest, info, '04-玩家频道-观战席未读数字角标');
        await guest.getByTestId('chat-channel-room').click();
        await expect(guest.getByTestId('chat-unread-room')).toHaveCount(0);
        await spectator.reload();
        await waitForGameBoard(spectator);
        await spectator.locator('[data-fab-id="chat"]').click();
        await expect(spectator.getByRole('log').getByText('欢迎，有规则问题可以在这里问。')).toBeVisible();
        await expect(spectator.getByRole('log').getByText('准备好了，我们开始吧！')).toHaveCount(0);
        await host.setViewportSize({ width: 2560, height: 1304 });
        await capture(host, info, '05-宽屏玩家频道-保留当前窗口设计');
        await spectator.setViewportSize({ width: 812, height: 375 });
        await expect(spectator.getByTestId('chat-message-input')).toBeVisible();
        await expect.poll(async () => {
            const bounds = await spectator.getByTestId('match-chat-panel').boundingBox();
            return bounds ? bounds.y >= 0 && bounds.y + bounds.height <= 375 : false;
        }).toBe(true);
        const panel = await spectator.getByTestId('match-chat-panel').boundingBox();
        expect(panel).not.toBeNull();
        expect(panel!.y).toBeGreaterThanOrEqual(0);
        expect(panel!.y + panel!.height).toBeLessThanOrEqual(375);
        await expectCompactChat(spectator);
        await capture(spectator, info, '06-手机横屏观众频道-输入与发送可见');
        await send(host, '玩家频道也有独立的未读提示。');
        await expect(guest.getByTestId('chat-unread-players')).toHaveText('1');
        await expect(guest.getByTestId('chat-unread-players')).toHaveAccessibleName('玩家：1 条未读消息');
        await capture(guest, info, '07-观战席-玩家频道未读数字角标');
        await guest.getByTestId('chat-channel-players').click();
        await expect(guest.getByTestId('chat-unread-players')).toHaveCount(0);
        await expect(guest.getByRole('log').getByText('玩家频道也有独立的未读提示。')).toBeVisible();
        await capture(guest, info, '08-玩家频道-切入后清除未读数字角标');
    } finally { await audience.close(); await cleanupDTMatch(setup); }
});
