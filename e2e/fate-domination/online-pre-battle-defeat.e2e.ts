import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createRespondToPromptCommand, getPromptOption } from '../../src/engine/testing/interactionTestFacade';
import type { GameTransportClient } from '../../src/engine/transport/client';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { fateAbilityUsageKey } from '../../src/games/fate-domination/domain/abilitySource';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { initContext } from '../helpers/common';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initFateAudioContext, trackFateAbilitySounds } from './fateAbilityAudio';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

const eyesSource = {
    text: '【真名解放】\n行动阶段：在战斗阶段开始前，若与你进行战斗的对手本回合没有打出/加入〔特殊属性图标〕属性攻击，则其【败北】。',
    reference: 'FD全卡图鉴V1.0.chm 美杜莎.htm ScreenShot_2025-11-01_163755_566.png',
};

function preparePetrification({ core }: FateState, againstRiding = false) {
    core.phase = 'action';
    core.turnOrder = againstRiding ? ['0', '1', '2'] : ['1', '2', '0'];
    core.currentTurnIndex = againstRiding ? 0 : 2;
    core.currentPlayerId = '0';
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    core.currentEvents = { miyama: [], shinto: [] };
    for (const location of Object.values(core.battlefield)) {
        location.eventCards = [];
        location.playerIds = [];
    }
    const seats = [
        ['0', 'm_shinji', 'servant-medusa', null],
        ['1', 'm_waver', againstRiding ? 'servant-rider' : 'servant-saber', 0],
        ['2', 'm_shirou_emiya', 'servant-cu-chulainn', 1],
    ] as const;
    for (const [id, masterId, servantId, deploymentSlot] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const player = core.players[id];
        const deck = createFateAttackDeck(id, servantId);
        const strength = deck.find(card => card.definitionId === 'cardB1')!;
        const special = deck.find(card => card.definitionId === 'cardSurveil')!;
        const hand = [strength, special];
        const committed = !againstRiding && id !== '0';
        Object.assign(player, {
            masterId, servantId, locationId: 'miyama', deploymentSlot, hand, deck: deck.filter(card => !hand.includes(card)),
            mana: id === '0' || (againstRiding && id === '1') ? 12 : (master.initMana ?? 4) - Number(id === '1'),
            skills: [...(master.skills ?? []), ...FATE_SERVANT_BY_ID[servantId].skillCards!]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })),
            normalAttackPlayed: committed, hasPassedAction: committed,
            activeAttackIds: committed ? hand.map(card => card.id) : [],
            faceDownAttackIds: committed && id === '2' ? [special.id] : [],
            playedSpecialAttackThisRound: committed && id === '1',
        });
    }
    core.battlefield.miyama.playerIds = ['0', '1', '2'];
}

test('在线发动石化之魔眼，行动结束才显示败北，明置特殊攻击者保留参战', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(150_000);
    await initContext(context, { skipImageGate: false });
    await startSourceSession(context, baseURL!);
    try {
        const { read } = await openFateRepresentativeBoard(page, context, preparePetrification);
        const primary = page.getByTestId('fate-domination-primary-action');
        const pawn = (seat: number) => page.getByRole('button', { name: `玩家${seat}位于深山町`, exact: true });
        const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const screenshot = (filename: string) => page.screenshot({
            path: getEvidenceScreenshotPathInDirectory(run.stagingDir, filename, { requireChineseName: true }),
        });
        await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45000 });
        await page.getByRole('button', { name: '选择 石化之魔眼', exact: true }).click();
        await page.locator('button[data-card-zone="hand"]').first().click();
        await expect(primary).toHaveAccessibleName('确认攻击');
        await primary.click();
        const ability = page.getByRole('button', { name: '发动 石化之魔眼', exact: true });
        await expect(ability).toBeEnabled();
        await screenshot('01-石化之魔眼已打出');
        await ability.click();
        await expect(ability).toBeDisabled();
        expect((await read()).core.players['2'].defeatMarkers).toHaveLength(0);
        await expect(primary).toHaveAccessibleName('结束行动');
        await primary.click();
        await expect.poll(async () => (await read()).core.phase).toBe('battle');
        const { core, sys } = await read();
        expect(core.players['1'].defeatMarkers).toHaveLength(0);
        expect(core.players['2'].defeatMarkers).toHaveLength(1);
        expect(core.players['2'].eliminated).toBe(false);
        expect(sys.actionLog.entries.some(entry => entry.actorId === '2' && entry.kind === 'FATE_DEFEAT_DECLARED')).toBe(true);
        await expect(pawn(3).getByText('败北', { exact: true })).toBeVisible();
        await expect(pawn(2).getByText('败北', { exact: true })).toHaveCount(0);
        const defeatedSeat = page.locator('[data-tutorial-id="fate-player-2"]');
        await expect(defeatedSeat.getByText('败北', { exact: true })).toBeVisible();
        await expect(defeatedSeat.getByLabel(/合计威力/)).toHaveCount(0);
        await screenshot('02-战斗开始时的败北反馈');
        await writeFile(join(run.stagingDir, '效果和权威结果.json'), JSON.stringify({
            source: eyesSource,
            sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
            phase: core.phase,
            defender: { publicSpecial: core.players['1'].playedSpecialAttackThisRound, defeated: false },
            other: { publicSpecial: core.players['2'].playedSpecialAttackThisRound, defeated: true, eliminated: false },
        }, null, 2), 'utf8');
    } finally {
        await releaseSourceSession(context);
    }
});

test('石化发动后，伊斯坎达尔在线实付骑乘，战斗开始时仅暗置特殊牌的一方败北', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(150_000);
    await initFateAudioContext(context);
    await startSourceSession(context, baseURL!);
    try {
        const { read, connectPeer } = await openFateRepresentativeBoard(page, context, state => preparePetrification(state, true));
        const rider = connectPeer('1');
        const other = connectPeer('2');
        try {
            const view = (client: GameTransportClient) => client.latestState as FateState | undefined;
            const send = async (client: GameTransportClient, type: string, payload: unknown = {}) => {
                const version = client.lastReceivedStateID!;
                expect(client.sendCommand(type, payload)).toBe(true);
                await expect.poll(() => client.lastReceivedStateID, { message: type }).toBeGreaterThan(version);
            };
            const primary = page.getByTestId('fate-domination-primary-action');
            const pawns = [2, 3].map(seat => page.getByRole('button', { name: `玩家${seat}位于深山町`, exact: true }));
            const defeats = () => read().then(({ core }) => ['1', '2'].map(id => core.players[id].defeatMarkers.length));
            const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            const screenshot = async (filename: string) => {
                await page.mouse.move(12, 12);
                await page.screenshot({ path: getEvidenceScreenshotPathInDirectory(run.stagingDir, filename, { requireChineseName: true }) });
            };
            await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45_000 });
            const { core } = await read();
            const eyes = core.players['0'].skills.find(skill => skill.id.startsWith('sc_medusa_2:'))!;
            const riding = core.players['1'].skills.find(skill => skill.id.startsWith('sc_iskandar_1:'))!;
            const ridingSpecial = core.players['1'].hand[1];
            const hiddenSpecial = core.players['2'].hand[1];
            await page.getByRole('button', { name: '选择 石化之魔眼', exact: true }).click();
            await page.locator('button[data-card-zone="hand"]').first().click();
            await expect(primary).toHaveAccessibleName('确认攻击');
            await primary.click();
            await expect(page.getByTestId('fate-self-mana').locator('b')).toHaveText('8');
            const stoneSound = 'Earthen Grasp.ogg';
            const playedSounds = await trackFateAbilitySounds(page, [stoneSound]);
            expect(await playedSounds()).toEqual([]);
            await page.getByRole('button', { name: '发动 石化之魔眼', exact: true }).click();
            await expect.poll(async () => (await read()).core.players['0'].usedAbilityIds).toContain(fateAbilityUsageKey(eyes.id, 'action'));
            await expect.poll(playedSounds).toEqual([stoneSound]);
            expect(await defeats()).toEqual([0, 0]);
            await primary.click();

            await expect.poll(() => view(rider)?.core.currentPlayerId).toBe('1');
            await send(rider, 'CONFIRM_ATTACK', { cardIds: [riding.id, core.players['1'].hand[0].id], faceDownIds: [], round: core.round });
            expect((await read()).core.players['1'].mana).toBe(9);
            await send(rider, 'PLAY_SKILL', { skillId: riding.id });
            const selection = view(rider)!;
            const option = getPromptOption(selection, item => item.id === ridingSpecial.id, '选择急行追加攻击');
            await expect.poll(() => view(other)?.core.players['1'].publicView?.playedCards.map(card => card.id)).toEqual([core.players['1'].hand[0].id]);
            const beforeRiding = (await read()).core.players['1'];
            expect(beforeRiding).toMatchObject({ mana: 9, selectedAttackIds: [], selectedFaceDownIds: [] });
            const response = createRespondToPromptCommand(selection, { playerId: '1', optionIds: [option.id] });
            await send(rider, response.type, response.payload);
            const added = (await read()).core.players['1'];
            expect(added).toMatchObject({ mana: 8, activeAttackIds: [...beforeRiding.activeAttackIds, ridingSpecial.id], selectedAttackIds: [] });
            await expect.poll(() => view(other)?.core.players['1'].publicView?.playedCards.map(card => card.id)).toEqual(added.activeAttackIds);
            await send(rider, 'PASS_ACTION');

            await expect.poll(() => view(other)?.core.currentPlayerId).toBe('2');
            await send(other, 'CONFIRM_ATTACK', { cardIds: core.players['2'].hand.map(card => card.id), faceDownIds: [hiddenSpecial.id], round: core.round });
            expect((await read()).core.players['2']).toMatchObject({ mana: core.players['2'].mana, playedSpecialAttackThisRound: false });
            await expect.poll(() => view(rider)?.core.players['2'].publicView?.playedCards.map(card => card.definitionId)).toEqual(['cardB1', 'hidden']);
            expect(await defeats()).toEqual([0, 0]);
            for (const pawn of pawns) await expect(pawn.getByText('败北', { exact: true })).toHaveCount(0);
            await screenshot('01-最后一席结束行动前两人仍在战场');
            await send(other, 'PASS_ACTION');
            await expect.poll(async () => (await read()).core.phase).toBe('battle');
            expect(await defeats()).toEqual([0, 1]);
            const atBattle = await read();
            expect(atBattle.core.players['2'].eliminated).toBe(false);
            expect(atBattle.sys.actionLog.entries.filter(entry => entry.kind === 'FATE_DEFEAT_DECLARED').map(entry => entry.actorId)).toEqual(['2']);
            await expect(pawns[0].getByText('败北', { exact: true })).toHaveCount(0);
            await expect(pawns[1].getByText('败北', { exact: true })).toBeVisible();
            await screenshot('02-战斗开始伊斯坎达尔仍参战第三席败北');

            await expect(primary).toHaveAccessibleName('完成战斗操作');
            await primary.click();
            await expect.poll(() => view(rider)?.core.currentPlayerId).toBe('1');
            await send(rider, 'ADVANCE_PHASE');
            await expect.poll(() => view(other)?.core.currentPlayerId).toBe('2');
            await send(other, 'ADVANCE_PHASE');
            const resolver = (await read()).core.currentPlayerId;
            if (resolver === '0') {
                await expect(primary).toHaveAccessibleName('结算深山町');
                await primary.click();
            } else {
                await send(resolver === '1' ? rider : other, 'RESOLVE_LOCATION', { locationId: 'miyama' });
            }
            const results = (await read()).core.resolvedResults.filter(result => result.locationId === 'miyama');
            expect(results.map(result => result.playerId).sort()).toEqual(['0', '1']);
            expect(results.find(result => result.playerId === '1')?.status).toBe('representative-win');
            expect(await playedSounds()).toEqual([stoneSound]);
            await writeFile(join(run.stagingDir, '石化与骑乘在线结果.json'), JSON.stringify({
                sources: [eyesSource, { reference: '中文卡图 sc_iskandar_1.png', text: riding.desc }],
                sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
                setup: '仅入场前设置三席同在深山町，本轮出牌、发动、骑乘响应及结算均走正式在线命令。',
                ridingCost: { initial: 3, added: beforeRiding.mana - added.mana },
                battle: { beforeLastPass: [0, 0], afterLastPass: [0, 1], results },
                playedAbilitySounds: await playedSounds(),
            }, null, 2), 'utf8');
        } finally {
            rider.disconnect();
            other.disconnect();
        }
    } finally {
        await releaseSourceSession(context);
    }
});
