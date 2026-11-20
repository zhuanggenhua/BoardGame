import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initContext } from '../helpers/common';
import { expectFateHandArtLoaded } from './handVisibility';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });
test.beforeEach(async ({ context, baseURL }) => {
    await initContext(context, { skipImageGate: false });
    await startSourceSession(context, baseURL!);
});
test.afterEach(async ({ context }) => releaseSourceSession(context));

function prepareHands({ core }: FateState, dense = false) {
    core.phase = 'action';
    core.round = 4;
    core.turnOrder = ['0', '1', '2'];
    core.currentPlayerId = '0';
    core.currentTurnIndex = 0;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama.eventCards = [];
    core.battlefield.shinto.eventCards = [];
    const seats = [
        ['0', 'm_waver', 'servant-rider', 'miyama'],
        ['1', 'm_shinji', 'servant-medusa', 'shinto'],
        ['2', 'm_shirou_emiya', 'servant-saber', 'workshop'],
    ] as const;
    for (const [id, masterId, servantId, locationId] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const servant = FATE_SERVANT_BY_ID[servantId];
        const deck = createFateAttackDeck(id, servantId);
        const displayAll = dense && id === '0';
        const hand = deck.splice(0, displayAll ? deck.length : 5);
        Object.assign(core.players[id], {
            masterId, servantId, locationId, deploymentSlot: 0, hand, deck,
            mana: id === '0' ? 10 : master.initMana ?? 4,
            normalAttackPlayed: displayAll,
            activeAttackIds: displayAll ? hand.map(card => card.id) : [],
            skills: [...(master.skills ?? []), ...(servant.skillCards ?? [])]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })),
        });
        core.battlefield[locationId].playerIds = [id];
    }
}

test('在线手牌暂存和撤回不写入游戏服，混合暗置草稿断线后仍可一次确认', async ({ page, context }, testInfo) => {
    test.setTimeout(180_000);
    const assetRequests = new Map<string, number>();
    page.on('response', response => {
        if (/\/fate-domination\/(?:cards|skills|assets-manifest\.json)/i.test(response.url())) {
            assetRequests.set(new URL(response.url()).pathname, response.status());
        }
    });
    const { read, connectPeer } = await openFateRepresentativeBoard(page, context, prepareHands);
    const peer = connectPeer('1');
    try {
        await expect.poll(() => (peer.latestState as FateState | undefined)?.core.currentPlayerId).toBe('0');
        const source = await read();
        const actor = source.core.players['0'];
        const basic = actor.hand[0].id;
        const riding = actor.skills.find(skill => skill.id.startsWith('sc_iskandar_1:'))!.id;
        const card = (id: string, zone = 'hand') => page.locator(`button[data-card-zone="${zone}"][data-card-id="${id}"]`);
        const primary = page.getByTestId('fate-domination-primary-action');
        const faceMode = page.getByRole('button', { name: '暗置选牌', exact: true });
        const mana = page.getByTestId('fate-self-mana').locator('b');
        const map = page.locator('.fd-runtime-map-overlay');
        const ownServerState = async () => (await read()).core.players['0'];
        const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const capture = (name: string) => page.screenshot({
            path: getEvidenceScreenshotPathInDirectory(run.stagingDir, name, { requireChineseName: true }),
        });
        await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45_000 });
        await expectFateHandArtLoaded(page);
        await expect(page.locator('[data-tutorial-id="fate-player-2"] .fd-seat-power')).toHaveCount(0);
        await expect(page.locator('[data-tutorial-id="fate-player-1"] .fd-seat-power')).toBeVisible();
        const mapTransform = await map.evaluate(node => getComputedStyle(node).transform);

        await faceMode.click();
        const skill = page.getByRole('button', { name: '选择 骑乘', exact: true });
        await expect(skill).toHaveAttribute('aria-disabled', 'true');
        const bounds = (await skill.boundingBox())!;
        await page.mouse.click(bounds.x + 12, bounds.y + 60);
        await expect(page.getByText('技能牌不能暗置，请切回明置选牌。', { exact: true })).toBeVisible();
        await card(basic).click({ position: { x: 12, y: 60 } });
        await expect(card(basic, 'staged')).toBeVisible();
        expect((await ownServerState()).selectedAttackIds).toEqual([]);
        expect((await ownServerState()).selectedFaceDownIds).toEqual([]);
        await card(basic, 'staged').click();
        await expect(card(basic)).toBeVisible();
        expect(await ownServerState()).toEqual(actor);

        await card(basic).click({ position: { x: 12, y: 60 } });
        await faceMode.click();
        await skill.click();
        await expect(primary).toHaveAccessibleName('确认攻击');
        await expect(primary).toBeEnabled();
        await expect(mana).toHaveText('7');
        expect(await ownServerState()).toEqual(actor);
        expect((peer.latestState as FateState).core.players['0'].publicView?.playedCards).toEqual([]);
        await page.mouse.move(12, 12);
        await capture('01-明暗混选与预计扣费');

        await context.setOffline(true);
        await expect(primary).toBeDisabled({ timeout: 40_000 });
        await expect(card(basic, 'staged')).toBeVisible();
        await expect(page.locator(`[data-tutorial-id="fate-card-${riding}"][data-card-zone="staged-skill"]`)).toBeVisible();
        expect(await ownServerState()).toEqual(actor);
        await capture('02-断线草稿保留');
        await context.setOffline(false);
        await expect(primary).toBeEnabled({ timeout: 40_000 });
        await expect(card(basic, 'staged')).toBeVisible();
        await expect(mana).toHaveText('7');
        expect(await map.evaluate(node => getComputedStyle(node).transform)).toBe(mapTransform);
        await primary.click();
        await expect(primary).toHaveAccessibleName('结束行动');
        const settled = await read();
        expect(settled.core.players['0']).toMatchObject({
            mana: 7, activeAttackIds: [basic], faceDownAttackIds: [basic], activeSkills: [riding],
            selectedAttackIds: [], selectedFaceDownIds: [],
        });
        const confirmed = settled.sys.eventStream.entries.filter(({ event }) => event.type === 'ATTACKS_CONFIRMED');
        expect(confirmed).toHaveLength(1);
        expect(confirmed[0].event.payload).toMatchObject({ playerId: '0', cardIds: [basic, riding], faceDownIds: [basic], manaSpent: 3 });
        const peerCards = () => (peer.latestState as FateState).core.players['0'].publicView?.playedCards;
        await expect.poll(peerCards).toEqual([{ id: 'hidden-played-0', definitionId: 'hidden' }]);
        await capture('03-重连后应用攻击结果');
        expect([...assetRequests].some(([path, status]) => /\/cards\//.test(path) && status >= 200 && status < 400)).toBe(true);
        await writeFile(join(run.stagingDir, '在线手牌与资源核对.json'), JSON.stringify({
            sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
            round: settled.core.round, confirmation: confirmed[0].event.payload, peerCards: peerCards(),
            assetRequests: Object.fromEntries(assetRequests),
        }, null, 2), 'utf8');
    } finally {
        await context.setOffline(false);
        peer.disconnect();
    }
});

test('在线手牌满载时同一牌组的已出区仍可检视，相机独立于牌区', async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1169, height: 719 });
    const { read } = await openFateRepresentativeBoard(page, context, state => prepareHands(state, true));
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const actor = (await read()).core.players['0'];
    expect(new Set(actor.activeAttackIds).size).toBe(actor.activeAttackIds.length);
    await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45_000 });
    const played = page.getByTestId('fate-played-cards').locator('[data-card-zone="active"]');
    await expect(played).toHaveCount(actor.activeAttackIds.length);
    await expect(page.getByText('暂无攻击手牌', { exact: true })).toBeVisible();
    await expectFateHandArtLoaded(page);
    const world = page.locator('.fd-runtime-map-overlay');
    const before = await world.evaluate(node => getComputedStyle(node).transform);
    await page.screenshot({
        path: getEvidenceScreenshotPathInDirectory(run.stagingDir, '01-出牌区满载与常驻技能区', { requireChineseName: true }),
    });
    for (const index of [0, 1, 5, 11]) {
        const card = played.nth(index);
        if (index > 0) await played.nth(index - 1).hover({ position: { x: 8, y: 60 }, timeout: 8_000 });
        if (index === 5) {
            await card.hover({ position: { x: 8, y: 60 }, timeout: 8_000 });
            await card.locator('..').getByTestId('card-inspect-button').click({ timeout: 8_000 });
        } else {
            await card.click({ position: { x: 8, y: 60 }, button: 'right', timeout: 8_000 });
        }
        const pinned = page.getByTestId('fate-runtime-inspection').and(page.locator('.is-pinned'));
        await expect(pinned).toBeVisible();
        if (index === 5) await page.screenshot({
            path: getEvidenceScreenshotPathInDirectory(run.stagingDir, '02-叠放中段可单独检视', { requireChineseName: true }),
        });
        await page.mouse.move(12, 12);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('fate-runtime-inspection')).toHaveCount(0);
        expect((await read()).core.players['0']).toEqual(actor);
    }
    expect(await world.evaluate(node => getComputedStyle(node).transform)).toBe(before);
    await writeFile(join(run.stagingDir, '在线满载牌区.json'), JSON.stringify({
        scope: '同一真实牌组的十二张作为布局压力代表态，牌实例不重复。',
        sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
        activeAttackIds: actor.activeAttackIds,
    }, null, 2), 'utf8');
});
