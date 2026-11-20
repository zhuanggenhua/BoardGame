import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildFateAiLegalActions } from '../../src/games/fate-domination/ai';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, initContext } from '../helpers/common';
import { chooseFateIdentity } from './identitySelection';
import { createFateLobbyMatch } from './onlineFateLobby';

test.use({ viewport: { width: 1366, height: 768 } });
test.afterEach(async ({ context }) => releaseSourceSession(context));

test('在线房两席 AI 独立出牌并交还真人，换轮后继续准备', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    await initContext(context, { skipImageGate: false });
    await startSourceSession(context, baseURL!);
    const diagnostics = attachPageDiagnostics(page, 'fate-online-ai');
    await page.goto('/?game=fate-domination', { waitUntil: 'domcontentloaded' });
    const { read } = await createFateLobbyMatch(page);
    const primary = page.getByTestId('fate-domination-primary-action');
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const capture = (name: string) => page.screenshot({
        path: getEvidenceScreenshotPathInDirectory(run.stagingDir, name, { requireChineseName: true }),
    });
    await chooseFateIdentity(page, 'master', 'm_waver');
    await chooseFateIdentity(page, 'servant', 'servant-rider');
    await primary.click();
    await expect.poll(async () => (await read()).core.phase, { timeout: 30_000 }).toBe('outpost');
    const prepared = (await read()).core.players;
    expect(prepared['0']).toMatchObject({ masterId: 'm_waver', servantId: 'servant-rider' });
    expect(new Set(Object.values(prepared).map(player => player.masterId)).size).toBe(3);
    expect(new Set(Object.values(prepared).map(player => player.servantId)).size).toBe(3);
    await page.getByTestId('fate-domination-location-workshop').click();
    await expect.poll(async () => (await read()).core.players['0'].locationId).toBe('workshop');
    await primary.click();
    await expect.poll(async () => (await read()).core.phase, { timeout: 30_000 }).toBe('action');
    const actionState = await read();
    expect(actionState.core.currentPlayerId).toBe('0');
    const pair = buildFateAiLegalActions({ state: actionState, playerId: '0' }).find(({ commands: [command] }) =>
        command.type === 'CONFIRM_ATTACK' && (command.payload as { faceDownIds: string[] }).faceDownIds.length === 2);
    expect(pair).toBeDefined();
    const selection = pair!.commands[0].payload as { cardIds: string[]; faceDownIds: string[] };
    const faceMode = page.getByRole('button', { name: '暗置选牌', exact: true });
    for (const id of selection.cardIds) {
        const down = selection.faceDownIds.includes(id);
        if ((await faceMode.getAttribute('aria-pressed') === 'true') !== down) await faceMode.click();
        const card = page.locator(`[data-card-id="${id}"][data-card-zone="hand"], [data-focus-card="skill-0-${id}"][data-card-zone="skill"]`);
        await card.click({ position: { x: 12, y: 60 } });
    }
    expect((await read()).core.players['0'].selectedAttackIds).toEqual([]);
    await expect(page.getByTestId('fate-play-summary').locator('.fd-play-power')).toHaveCount(0);
    await expect(faceMode).toBeVisible();
    await expect(page.getByTestId('fate-played-cards').getByText('暗置', { exact: true })).toHaveCount(2);
    await expect(primary).toHaveAccessibleName('确认攻击');
    await page.mouse.move(12, 12);
    await capture('01-工房暗置草稿保留选牌入口');
    await primary.click();
    await expect(primary).toHaveAccessibleName('结束行动');
    const confirmed = (await read()).core.players['0'];
    expect(confirmed.faceDownAttackIds).toEqual(selection.faceDownIds);
    expect(confirmed.mana).toBe(actionState.core.players['0'].mana);
    await primary.click();
    await expect.poll(async () => (await read()).core.phase, { timeout: 45_000 }).toBe('battle');
    const afterAction = await read();
    expect(afterAction.core.currentPlayerId).toBe('0');
    for (const id of ['1', '2']) {
        const player = afterAction.core.players[id];
        expect(player.normalAttackPlayed).toBe(true);
        expect(player.selectedAttackIds).toEqual([]);
        expect(player.activeAttackIds.length + player.activeSkills.length).toBeGreaterThanOrEqual(2);
    }

    const opponent = page.locator('[data-tutorial-id="fate-player-1"] .fd-runtime-avatar');
    await opponent.hover();
    const row = page.locator('.fd-runtime-opponent-cards');
    await expect(row).toBeVisible();
    await row.hover();
    await capture('02-服务端电脑已出牌并交还真人');
    await page.mouse.move(12, 12);
    await expect(row).toBeHidden({ timeout: 8000 });
    await primary.click();

    for (let steps = 0; steps < 8; steps++) {
        await expect.poll(async () => {
            const { core, sys } = await read();
            return core.round > 1 || (sys.interaction.current?.playerId ?? core.currentPlayerId) === '0';
        }, { timeout: 30_000 }).toBe(true);
        const current = await read();
        if (current.core.round > 1) break;
        if (current.sys.interaction.current?.playerId === '0') {
            await page.getByRole('button', { name: '不恢复', exact: true }).click();
            await page.getByRole('button', { name: '确认选择', exact: true }).click();
        } else {
            expect(current.core.phase).toBe('battle');
            await expect(primary).toBeEnabled();
            await primary.click();
        }
    }
    await expect.poll(async () => {
        const { core } = await read();
        return [core.round, core.phase, core.currentPlayerId];
    }, { timeout: 30_000 }).toEqual([2, 'preparation', '0']);
    await expect(primary).toBeEnabled();
    await capture('03-新一轮真人准备');
    await assertNoFatalFrontendErrors([{ label: 'fate-online-ai', diagnostics }]);
    await writeFile(join(run.stagingDir, '在线自动玩家换轮结果.json'), JSON.stringify({
        sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
        afterAction: Object.fromEntries(['1', '2'].map(id => [id, afterAction.core.players[id].activeAttackIds.length])),
        terminal: { round: 2, phase: 'preparation', currentPlayerId: '0' },
    }, null, 2), 'utf8');
});
