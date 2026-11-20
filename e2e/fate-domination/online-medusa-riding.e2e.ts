import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { isFateRidingChoice } from '../../src/games/fate-domination/domain/ridingChoice';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initContext } from '../helpers/common';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';
import { initFateAudioContext, trackFateAbilitySounds } from './fateAbilityAudio';

test.use({ viewport: { width: 1366, height: 768 } });

function prepareMedusaRiding({ core }: FateState) {
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
        ['0', 'm_shinji', 'servant-medusa', 'miyama'],
        ['1', 'm_waver', 'servant-rider', 'shinto'],
        ['2', 'm_shirou_emiya', 'servant-saber', 'workshop'],
    ] as const;
    for (const [id, masterId, servantId, locationId] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const servant = FATE_SERVANT_BY_ID[servantId];
        const pool = createFateAttackDeck(id, servantId);
        const hand = id === '0' ? ['cardB1', 'cardSurveil', 'cardQ2', 'cardA2', 'cardPreparation'].map(definitionId => {
            const index = pool.findIndex(card => card.definitionId === definitionId);
            expect(index, definitionId).toBeGreaterThanOrEqual(0);
            return pool.splice(index, 1)[0];
        }) : pool.splice(0, 3);
        Object.assign(core.players[id], {
            masterId, servantId, locationId, deploymentSlot: 0, hand, deck: pool,
            mana: id === '0' ? 9 : master.initMana ?? 4,
            skills: [...(master.skills ?? []), ...(servant.skillCards ?? [])]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })),
        });
        core.battlefield[locationId].playerIds = [id];
    }
}

test('在线美杜莎骑乘先抽一张，再在手牌内追加并结算费用', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(150_000);
    await initContext(context, { skipImageGate: false });
    await initFateAudioContext(context);
    await startSourceSession(context, baseURL!);
    try {
        const { read, connectPeer } = await openFateRepresentativeBoard(page, context, prepareMedusaRiding);
        const opponent = connectPeer('1');
        try {
            const opponentView = () => opponent.latestState as FateState | undefined;
            const opponentSeenAttacks = () => opponentView()?.core.players['0'].publicView?.playedCards.map(card => card.id);
            await expect.poll(() => opponentView()?.core.currentPlayerId).toBe('0');
            const { core } = await read();
            const { hand, deck } = core.players['0'];
            const [base, paid, agility, magic, fourth] = hand;
            const drawn = deck[0];
            const handCard = (id: string) => page.locator(`button[data-card-zone="hand"][data-card-id="${id}"]`);
            const activeCard = (id: string) => page.locator(`button[data-card-zone="active"][data-card-id="${id}"]`);
            const primary = page.getByTestId('fate-domination-primary-action');
            const mana = page.getByTestId('fate-self-mana').locator('b');
            const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            const screenshot = (name: string) => page.screenshot({
                path: getEvidenceScreenshotPathInDirectory(run.stagingDir, name, { requireChineseName: true }),
            });
            await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45000 });
            await page.getByRole('button', { name: '选择 骑乘', exact: true }).click();
            await handCard(base.id).click({ position: { x: 12, y: 60 } });
            await expect(mana).toHaveText('6');
            expect((await read()).core.players['0'].mana).toBe(9);
            await primary.click();
            await expect(handCard(drawn.id)).toBeVisible();
            const before = await read();
            expect(before.core.players['0'].hand).toHaveLength(hand.length + 1);
            expect(before.core.players['0'].mana).toBe(6);
            await expect.poll(opponentSeenAttacks).toEqual([base.id]);
            expect(JSON.stringify(opponentView())).not.toContain(drawn.id);
            await page.mouse.move(12, 12);
            await screenshot('01-同批攻击触发抽牌');

            await handCard(paid.id).hover({ position: { x: 12, y: 60 } });
            const inspect = handCard(paid.id).locator('..').getByTestId('card-inspect-button');
            await expect(inspect).toHaveCSS('opacity', '1');
            await screenshot('02-叠牌仍可悬浮和检视');
            await inspect.click({ timeout: 8000 });
            await expect(page.getByTestId('fate-runtime-inspection')).toBeVisible();
            await page.keyboard.press('Escape');

            const ridingCue = 'SFX_Card_Play_3.ogg';
            const playedSounds = await trackFateAbilitySounds(page, [ridingCue, 'SFX_Card_Play_1.ogg']);
            await page.getByRole('button', { name: '发动 骑乘', exact: true }).click();
            const selected = [paid.id, agility.id, magic.id];
            for (const id of selected) {
                await handCard(id).click({ position: { x: 12, y: 60 }, timeout: 8000 });
                await expect(handCard(id)).toHaveAttribute('aria-pressed', 'true');
            }
            await expect(handCard(fourth.id)).toHaveAttribute('aria-disabled', 'true');
            const fourthBox = (await handCard(fourth.id).boundingBox())!;
            const fourthPoint = { x: fourthBox.x + 12, y: fourthBox.y + 60 };
            expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-card-id]')?.getAttribute('data-card-id'), fourthPoint)).toBe(fourth.id);
            await page.mouse.click(fourthPoint.x, fourthPoint.y);
            const upperLimit = page.getByText('骑乘最多选择三张牌，请先撤回一张。', { exact: true });
            await expect(upperLimit).toBeVisible();
            await expect(handCard(fourth.id)).toHaveAttribute('aria-pressed', 'false');
            const during = await read();
            expect(isFateRidingChoice(during.sys.interaction.current)).toBe(true);
            expect(during.core.players['0'].selectedAttackIds).toEqual([]);
            expect(during.core.players['0'].mana).toBe(6);
            expect(JSON.stringify(opponentView())).not.toContain(paid.id);
            await expect(mana).toHaveText('5');
            await page.mouse.move(12, 12);
            await screenshot('03-骑乘三张预计扣费');

            expect(await playedSounds()).toEqual([]);
            await primary.click();
            await expect.poll(playedSounds).toEqual([ridingCue]);
            await expect(primary).toHaveAccessibleName('结束行动');
            await expect(mana).toHaveText('5');
            const after = await read();
            const actor = after.core.players['0'];
            expect(actor.activeAttackIds).toEqual([base.id, ...selected]);
            expect(actor.selectedAttackIds).toEqual([]);
            expect(actor.normalAttackPlayed).toBe(true);
            expect(actor.mana).toBe(5);
            expect(after.core.currentPlayerId).toBe('0');
            for (const id of selected) await expect(activeCard(id)).toBeVisible();
            await expect.poll(opponentSeenAttacks).toEqual(actor.activeAttackIds);
            await expect(upperLimit).toBeHidden({ timeout: 12_000 });
            await screenshot('04-追加牌公开并恢复行动');
            await writeFile(join(run.stagingDir, '效果和权威结果.json'), JSON.stringify({
                source: { text: '打出时：若此牌与一张基础攻击一同打出，抽一张牌。\n坐骑召唤－行动阶段：打出至多3张基本威力为3或更低的手牌。',
                    reference: 'FD全卡图鉴V1.0.chm 美杜莎.htm；中文卡图 sc_medusa_1.png' },
                sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
                cardsDrawn: 1, paidMana: before.core.players['0'].mana - actor.mana, publiclyPlayed: actor.activeAttackIds,
                playedAbilitySounds: await playedSounds(),
            }, null, 2), 'utf8');
        } finally {
            opponent.disconnect();
        }
    } finally {
        await releaseSourceSession(context);
    }
});
