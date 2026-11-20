import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { fateAbilityUsageKey } from '../../src/games/fate-domination/domain/abilitySource';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initFateAudioContext, trackFateAbilitySounds } from './fateAbilityAudio';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });

function prepareSaberSuppression({ core }: FateState) {
    core.phase = 'action';
    core.round = 4;
    core.turnOrder = ['1', '2', '0'];
    core.currentPlayerId = '0';
    core.currentTurnIndex = 2;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama.eventCards = [];
    const seats = [
        ['0', 'm_shirou_emiya', 'servant-saber', 'cardA2', null],
        ['1', 'm_shinji', 'servant-medusa', 'cardA2', 0],
        ['2', 'm_waver', 'servant-cu-chulainn', 'cardA1', 1],
    ] as const;
    for (const [id, masterId, servantId, magic, deploymentSlot] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const servant = FATE_SERVANT_BY_ID[servantId];
        const deck = createFateAttackDeck(id, servantId);
        const hand = ['cardB1', magic].map(definitionId => deck.find(card => card.definitionId === definitionId)!);
        Object.assign(core.players[id], {
            masterId, servantId, locationId: 'miyama', deploymentSlot, hand, deck: deck.filter(card => !hand.includes(card)),
            mana: id === '0' ? 9 : master.initMana ?? 4,
            isRevealed: false, hasPassedAction: id !== '0', normalAttackPlayed: id !== '0',
            activeAttackIds: id === '0' ? [] : hand.map(card => card.id),
            skills: [...(master.skills ?? []), ...(servant.skillCards ?? [])]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })),
        });
    }
    core.battlefield.miyama.playerIds = ['0', '1', '2'];
}

test('在线实付风王结界折扣，依次发动对魔力和风王结界，同场两个对手威力分别降低', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(150_000);
    await initFateAudioContext(context);
    await startSourceSession(context, baseURL!);
    try {
        const { read, connectPeer } = await openFateRepresentativeBoard(page, context, prepareSaberSuppression);
        const actor = async () => (await read()).core.players['0'];
        const primary = page.getByTestId('fate-domination-primary-action');
        const mana = page.getByTestId('fate-self-mana').locator('b');
        const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const screenshot = (name: string) => page.screenshot({
            path: getEvidenceScreenshotPathInDirectory(run.stagingDir, name, { requireChineseName: true }),
        });
        const wind = page.getByRole('button', { name: '选择 风王结界', exact: true });
        await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45_000 });
        await expect(wind.locator('[data-cost-change="decrease"]')).toHaveText('↓2');
        await screenshot('01-风王结界显示隐藏真名费用');
        await wind.click();
        await page.getByRole('button', { name: '选择 对魔力', exact: true }).click();
        await expect(mana).toHaveText('4');
        expect((await actor()).mana).toBe(9);
        await expect(primary).toHaveAccessibleName('确认攻击');
        await primary.click();
        await expect.poll(async () => (await actor()).mana).toBe(4);
        expect((await actor()).isRevealed).toBe(false);
        await expect(primary).toHaveAccessibleName('结束行动');
        await primary.click();
        await expect.poll(async () => (await read()).core.phase).toBe('battle');

        const peers = ['1', '2'].map(connectPeer);
        try {
            for (const [index, peer] of peers.entries()) {
                const id = String(index + 1);
                await expect.poll(() => (peer.latestState as FateState | undefined)?.core.currentPlayerId).toBe(id);
                expect(peer.sendCommand('ADVANCE_PHASE', {})).toBe(true);
            }
            const useMagic = page.getByRole('button', { name: '发动 对魔力', exact: true });
            const useWind = page.getByRole('button', { name: '发动 风王结界', exact: true });
            const railPowers = () => page.locator('[data-tutorial-id="fate-player-1"], [data-tutorial-id="fate-player-2"]')
                .locator('[aria-label$="合计威力"]').allTextContents()
                .then(values => values.map(value => Number(value.match(/\d+$/)?.[0])));
            await expect(useMagic).toBeEnabled();
            await expect(useWind).toBeEnabled();
            const initial = await railPowers();
            expect(initial).toHaveLength(2);
            const active = await actor();
            const counterId = active.skills.find(skill => skill.id.startsWith('sc_saber_1:'))!.id;
            const windId = active.skills.find(skill => skill.id.startsWith('sc_saber_2:'))!.id;
            const sounds = ['Holy Ward.ogg', 'Wind_Magic_Buff_01.ogg'];
            const actualAbilitySounds = await trackFateAbilitySounds(page, sounds);
            expect(await actualAbilitySounds()).toEqual([]);
            await useMagic.click();
            await expect.poll(async () => (await actor()).usedAbilityIds).toContain(fateAbilityUsageKey(counterId, 'battle'));
            await expect.poll(actualAbilitySounds).toEqual([sounds[0]]);
            const afterMagic = [initial[0] - 3, initial[1] - 2];
            await expect.poll(railPowers).toEqual(afterMagic);
            await page.mouse.move(12, 12);
            await screenshot('02-对魔力压低两名对手威力');
            await useWind.click();
            await expect.poll(async () => (await actor()).usedAbilityIds).toContain(fateAbilityUsageKey(windId, 'battle'));
            await expect.poll(actualAbilitySounds).toEqual(sounds);
            const afterWind = afterMagic.map(power => power - 2);
            await expect.poll(railPowers).toEqual(afterWind);
            expect((await actor()).mana).toBe(4);
            expect((await actor()).isRevealed).toBe(false);
            await page.mouse.move(12, 12);
            await screenshot('03-风王结界再压低两名对手威力');
            await writeFile(join(run.stagingDir, '效果和权威结果.json'), JSON.stringify({
                source: [
                    { text: '战斗阶段：将同一战场所有对手的〔魔术图标〕属性威力变为0。', reference: '中文卡图 sc_saber_1.png' },
                    { text: '若你的真名隐藏，此牌的魔力消耗-2。\n战斗阶段：将与你进行战斗对手的〔力量图标〕力量攻击威力变为0。', reference: '中文卡图 sc_saber_2.png' },
                ], sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
                paidMana: 5, opposingPower: { before: initial, afterMagic, afterWind },
                playedAbilitySounds: await actualAbilitySounds(),
            }, null, 2), 'utf8');
        } finally {
            peers.forEach(peer => peer.disconnect());
        }
    } finally {
        await releaseSourceSession(context);
    }
});
