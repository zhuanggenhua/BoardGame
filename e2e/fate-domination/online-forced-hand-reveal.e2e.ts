import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FATE_ATTACK_BY_ID } from '../../src/games/fate-domination/data';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initContext } from '../helpers/common';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });

test('在线战场无法出牌时对手可检视展示手牌，暗置确认后保留牌背并关闭旧撤回点', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    await initContext(context, { skipImageGate: false });
    await startSourceSession(context, baseURL!);
    try {
        const { read, connectPeer } = await openFateRepresentativeBoard(page, context, ({ core }) => {
            core.phase = 'action';
            core.round = 4;
            core.turnOrder = ['1', '0', '2'];
            core.currentPlayerId = '1';
            Object.assign(core.battlefield.miyama, { playerIds: ['1', '0'], eventCards: [] });
            core.currentEvents.miyama = [];
            for (const [id, servantId, count, slot] of [['0', 'servant-saber', 2, 0], ['1', 'servant-cu-chulainn', 1, 1]] as const) {
                const deck = createFateAttackDeck(id, servantId);
                const expensiveCards = deck.filter(card => FATE_ATTACK_BY_ID[card.definitionId].manaCost > 0).slice(0, count);
                expect(expensiveCards).toHaveLength(count);
                Object.assign(core.players[id], {
                    servantId, locationId: 'miyama', deploymentSlot: slot, mana: 0, commandSpells: 3,
                    hand: expensiveCards, deck: deck.filter(card => !expensiveCards.includes(card)),
                });
            }
        });
        const { stagingDir } = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const capture = (name: string) => page.screenshot({ path: getEvidenceScreenshotPathInDirectory(stagingDir, name, { format: 'png', requireChineseName: true }) });
        const peer = connectPeer('1');
        try {
            const peerView = () => peer.latestState as FateState | undefined;
            await expect.poll(() => peerView()?.core.currentPlayerId).toBe('1');
            const { core } = await read();
            const [unplayable] = core.players['1'].hand;
            const ownHand = core.players['0'].hand;
            expect(peer.sendCommand('PASS_ACTION', {})).toBe(true);
            await expect.poll(async () => (await read()).core.currentPlayerId).toBe('0');
            expect((await read()).sys.actionLog.entries.flatMap(entry => entry.segments)).toContainEqual(expect.objectContaining({ key: 'log.passWithRevealedHand' }));
            const avatar = page.locator('[data-tutorial-id="fate-player-1"]').getByRole('button', { name: /查看.*详情/ });
            await avatar.hover();
            const revealed = page.getByRole('region', { name: /展示的手牌$/ });
            const cardName = FATE_ATTACK_BY_ID[unplayable.definitionId].name;
            const inspect = revealed.getByRole('button', { name: `检视${cardName}` });
            await expect(inspect).toBeVisible();
            await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready');
            await capture('01-战场无合法出牌时展示的手牌');
            await inspect.click();
            const inspection = page.getByRole('dialog', { name: `${cardName}卡牌检视` });
            await expect(inspection.getByRole('img', { name: cardName, exact: true })).toBeVisible();
            await capture('02-对手放大检视规则展示的手牌');
            await page.keyboard.press('Escape');
            await expect(inspection).toBeHidden();

            await page.getByRole('button', { name: '使用令咒', exact: true }).click();
            await page.getByRole('button', { name: /^强化战斗/ }).click();
            await page.getByRole('button', { name: '确认使用' }).click();
            await expect.poll(() => peerView()?.sys.undo.snapshotCount).toBeGreaterThan(0);
            await page.getByRole('button', { name: '暗置选牌', exact: true }).click();
            for (const card of ownHand) await page.locator(`button[data-card-zone="hand"][data-card-id="${card.id}"]`).click();
            const confirm = page.getByTestId('fate-domination-primary-action');
            await expect(confirm).toHaveAccessibleName('确认攻击');
            await confirm.click();
            await expect.poll(() => peerView()?.core.players['0'].publicView?.playedCards.map(card => card.definitionId)).toEqual(['hidden', 'hidden']);
            const shown = peerView()?.core.players['0'].forcedRevealedHand ?? [];
            expect(shown.map(card => card.definitionId)).toEqual(ownHand.map(card => card.definitionId));
            expect(shown.map(card => card.id)).not.toEqual(ownHand.map(card => card.id));
            expect(peerView()?.sys.actionLog.entries.flatMap(entry => entry.segments)).toContainEqual(expect.objectContaining({ key: 'log.confirmAttackWithRevealedHand' }));
            await expect.poll(() => peerView()?.sys.undo.snapshotCount).toBe(0);
            const source = await captureEvidenceSourceIdentity(page, 'fate-domination');
            await writeFile(join(stagingDir, 'source-identity.json'), JSON.stringify(source, null, 2));
        } finally { peer.disconnect(); }
    } finally { await releaseSourceSession(context); }
});
