import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FATE_EVENTS, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { fateDeploymentTerrain } from '../../src/games/fate-domination/domain/deployment';
import { distributeFateRoundEvents, fateSituationEventCounts } from '../../src/games/fate-domination/domain/environmentRules';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import type { LocationId } from '../../src/games/fate-domination/domain/types';
import { initContext } from '../helpers/common';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';
import { initFateAudioContext, trackFateAbilitySounds } from './fateAbilityAudio';

test.use({ viewport: { width: 1366, height: 768 } });

function prepareMovement({ core }: FateState, servantId: string, target: LocationId | null, climax?: 10 | 11) {
    core.phase = 'action';
    core.turnOrder = ['0', '1', '2'];
    core.currentPlayerId = '0';
    core.currentTurnIndex = 0;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === (climax === 10 ? 'sit12' : climax === 11 ? 'sit13' : 'sit1'))!;
    core.shintoEventFaceDown = false;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama.eventCards = [];
    core.battlefield.shinto.eventCards = [];
    const medusa = servantId === 'servant-medusa';
    const reconOccupied = !medusa && target !== 'recon';
    const seats = climax ? [
        ['0', 'm_shirou_emiya', servantId, 'miyama', 0],
        ['1', 'm_shinji', 'servant-saber', 'miyama', 1],
        ['2', 'm_waver', 'servant-rider', 'miyama', null],
    ] as const : [
        ['0', 'm_shirou_emiya', servantId, 'miyama', 0],
        ['1', 'm_shinji', 'servant-saber', medusa ? 'shinto' : 'miyama', medusa ? 0 : 1],
        ['2', 'm_waver', 'servant-rider', reconOccupied ? 'recon' : 'shinto', reconOccupied ? null : 1],
    ] as const;
    if (climax) {
        core.round = climax;
        const counts = fateSituationEventCounts(core.situation);
        const dealt = ['fuyuki_E3', 'fuyuki_E4', 'fuyuki_E5', 'fuyuki_E10']
            .slice(0, counts.miyama + counts.shinto).map(id => FATE_EVENTS.find(event => event.id === id)!);
        core.currentEvents = distributeFateRoundEvents(dealt, core.situation);
        core.miyamaEvent = core.currentEvents.miyama[0];
        core.battlefield.miyama.eventCards = core.currentEvents.miyama;
        core.battlefield.shinto.eventCards = core.currentEvents.shinto;
        core.eventDeck = core.eventDeck.filter(event => !dealt.some(card => card.id === event.id));
        core.eventDeckCount = core.eventDeck.length;
    }
    for (const [id, masterId, servant, locationId, deploymentSlot] of seats) {
        const player = core.players[id];
        const master = FATE_MASTER_BY_ID[masterId];
        const deck = createFateAttackDeck(id, servant);
        const hand = deck.slice(0, 3);
        Object.assign(player, {
            masterId, servantId: servant, locationId, deploymentSlot, hand, deck: deck.slice(hand.length),
            mana: id === '0' ? 12 : master.initMana ?? 4, isRevealed: false,
            skills: [...(master.skills ?? []), ...FATE_SERVANT_BY_ID[servant].skillCards!]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })),
        });
        core.battlefield[locationId].playerIds.push(id);
    }
}

const cases = [
    { name: '骑英之缰绳', servant: 'servant-medusa', cost: 9,
        destinations: [['shinto', '新都'], ['workshop', '魔术工房'], ['recon', '侦察']],
        source: '行动阶段：移动到任一地点，若为战场，重新部署于该地点的2个地利，原地利的占领者失去该地利。' },
    { name: '战斗续行', servant: 'servant-cu-chulainn', cost: 3,
        destinations: [['shinto', '新都'], ['recon', '侦察']],
        source: '行动阶段：移动至除魔术工房外的任意地点。' },
] as const;
const scenarios = [
    ...cases.flatMap(({ destinations, ...ability }) =>
        destinations.map(([target, label]) => ({ ...ability, target, label, climax: undefined }))),
    { ...cases[0], target: 'workshop', label: '魔术工房', climax: 11 },
    { ...cases[1], target: null, label: '无可移动地点', climax: 10 },
] as const;

for (const { name, servant, cost, target, label, source, climax } of scenarios) {
    const scenario = climax ? `第${climax}回合高潮禁入：${name}／${label}` : `使用${name}到${label}，核对地图和地利`;
    test(`在线代表态${scenario}`, async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(150_000);
        const medusa = servant === 'servant-medusa';
        if (!medusa && target === 'recon') await page.setViewportSize({ width: 1280, height: 720 });
        await initContext(context, { skipImageGate: false });
        const checkAudio = target === 'shinto' && !climax;
        if (checkAudio) await initFateAudioContext(context);
        await startSourceSession(context, baseURL!);
        try {
            const { read } = await openFateRepresentativeBoard(page, context, state => prepareMovement(state, servant, target, climax));
            const actor = async () => (await read()).core.players['0'];
            const primary = page.getByTestId('fate-domination-primary-action');
            const manaReadout = page.getByTestId('fate-self-mana').locator('b');
            const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            const screenshot = (filename: string) => page.screenshot({
                path: getEvidenceScreenshotPathInDirectory(run.stagingDir, filename, { requireChineseName: true }),
            });
            const board = page.getByTestId('fate-pixi-map-canvas-host');
            await expect(board).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45000 });
            await expect(manaReadout).toHaveText('12');
            await page.getByRole('button', { name: `选择 ${name}`, exact: true }).click();
            await page.locator('button[data-card-zone="hand"]').first().click();
            await expect(primary).toHaveAccessibleName('确认攻击');
            await primary.click();
            await expect.poll(async () => (await actor()).mana).toBe(12 - cost);
            const ability = page.getByRole('button', { name: `发动 ${name}`, exact: true });
            const startingPawn = page.getByRole('button', { name: '玩家1位于深山町', exact: true });
            const initial = (await read()).core;
            if (climax) await expect(page.getByRole('button', { name: `检视${initial.situation.name}`, exact: true })).toBeVisible();
            const starting = initial.players['0'];
            expect(starting.locationId).toBe('miyama');
            expect(fateDeploymentTerrain(starting)).toBe(3);
            await expect(startingPawn.getByLabel(/^威力 /)).toBeVisible();
            await screenshot('01-深山町地利上已打出能力');

            if (!medusa) {
                await expect(startingPawn).toBeDisabled();
            }
            if (target === null) {
                await expect(ability).toHaveAttribute('aria-disabled', 'true');
                const bounds = (await ability.boundingBox())!;
                await page.mouse.click(bounds.x + 12, bounds.y + 60);
                await page.mouse.move(12, 12);
                await expect(page.getByText('新都与侦察已关闭，无处可移。', { exact: true })).toBeVisible();
                await expect(page.getByTestId('fate-runtime-inspection')).toHaveCount(0);
                await expect(page.locator('[data-fate-destination]')).toHaveCount(0);
                await expect(primary).toHaveAccessibleName('结束行动');
                await expect(primary).toBeEnabled();
                expect(await actor()).toMatchObject({
                    locationId: 'miyama', deploymentSlot: starting.deploymentSlot,
                    mana: 12 - cost, usedAbilityIds: starting.usedAbilityIds,
                });
                await screenshot('02-局势关闭目的地后的拒绝原因');
                await primary.click();
                await expect.poll(async () => (await read()).core.currentPlayerId).toBe('1');
                await writeFile(join(run.stagingDir, '效果和权威结果.json'), JSON.stringify({
                    source: { text: source, reference: 'FD全卡图鉴V1.0.chm 从者技能卡' },
                    sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
                    situation: initial.situation.name, location: starting.locationId,
                    mana: starting.mana, usedAbilityIds: (await actor()).usedAbilityIds,
                    nextPlayerId: (await read()).core.currentPlayerId,
                }, null, 2), 'utf8');
                return;
            }
            await expect(ability).toBeEnabled();
            const movementCue = medusa ? 'Echoing Gust Cast.ogg' : 'WHSH_Cloth_Whoosh_04.ogg';
            const playedSounds = checkAudio ? await trackFateAbilitySounds(page, [movementCue, 'Lightning Bolt Cast A.ogg']) : undefined;
            await ability.click();
            const destination = page.getByTestId(`fate-domination-location-${target}`);
            await expect(destination).toBeVisible();
            if (climax) {
                await expect(page.getByTestId('fate-domination-location-shinto')).toHaveCount(0);
                await expect(page.getByTestId('fate-domination-location-recon')).toHaveCount(0);
                await expect(page.locator('[data-fate-destination]')).toHaveCount(1);
            }
            if (!medusa) {
                await expect(page.getByTestId('fate-domination-location-workshop')).toHaveCount(0);
                if (target !== 'recon') await expect(page.getByTestId('fate-domination-location-recon')).toHaveCount(0);
            }
            expect((await actor()).locationId).toBe('miyama');
            if (playedSounds) expect(await playedSounds()).toEqual([]);
            await screenshot('02-选择移动目标');
            const targetControl = target === 'recon' ? destination.getByText(label, { exact: true }) : destination;
            await targetControl.click({ timeout: 8000 });

            await expect.poll(async () => (await actor()).locationId).toBe(target);
            if (playedSounds) await expect.poll(playedSounds).toEqual([movementCue]);
            await expect(destination).toHaveCount(0);
            await expect(startingPawn).toHaveCount(0);
            await expect(primary).toBeEnabled();
            await expect(ability).toHaveAttribute('aria-disabled', 'true');
            await expect(manaReadout).toHaveText(String(12 - cost));
            const { core } = await read();
            expect(core.players['0'].mana).toBe(12 - cost);
            expect(core.battlefield.miyama.playerIds).not.toContain('0');
            expect(core.battlefield[target].playerIds).toContain('0');
            const movedPawn = page.getByRole('button', { name: `玩家1位于${label}`, exact: true });
            await expect(movedPawn).toBeVisible();
            if (target === 'recon') {
                await expect.poll(async () => {
                    const pawn = await movedPawn.boundingBox();
                    const abilities = await page.getByRole('region', { name: '御主能力' }).boundingBox();
                    return pawn && abilities ? pawn.y - abilities.y - abilities.height : -1;
                }).toBeGreaterThanOrEqual(2);
            }
            if (medusa && target === 'shinto') {
                expect(core.battlefield.shinto.playerIds).toEqual(['1', '2', '0']);
                expect(['0', '1', '2'].map(id => fateDeploymentTerrain(core.players[id]))).toEqual([4, 0, 0]);
                await expect(page.getByRole('button', { name: '玩家2位于新都' })).toBeVisible();
                await expect(page.getByRole('button', { name: '玩家3位于新都' })).toBeVisible();
                await expect(page.getByRole('img', { name: '玩家 1 占领了新都的另一处地利' })).toBeVisible();
            } else if (!medusa) {
                expect(core.battlefield.miyama.playerIds).toEqual(['1']);
                await expect(page.getByRole('button', { name: '玩家2位于深山町' })).toBeVisible();
            }
            if (target !== 'shinto') {
                expect(core.players['0'].deploymentSlot).toBeNull();
                expect(core.players['0'].secondaryDeploymentSlot).toBeUndefined();
                expect(fateDeploymentTerrain(core.players['0'])).toBe(0);
                await expect(movedPawn.getByLabel(/^威力 /)).toHaveCount(0);
                await expect(page.getByRole('img', { name: /玩家 1 占领了.*的另一处地利/ })).toHaveCount(0);
                if (medusa) {
                    const terrainBefore = ['1', '2'].map(id => fateDeploymentTerrain(initial.players[id]));
                    expect(['1', '2'].map(id => fateDeploymentTerrain(core.players[id]))).toEqual(terrainBefore);
                }
            }
            // 相机投影和 DOM 棋子由同一个显示帧更新。
            await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
            await screenshot(`03-已移动至${label}`);
            const sourceIdentity = await captureEvidenceSourceIdentity(page, 'fate-domination');
            await writeFile(join(run.stagingDir, '效果和权威结果.json'), JSON.stringify({
                source: { text: source, reference: 'FD全卡图鉴V1.0.chm 从者技能卡' }, sourceIdentity,
                situation: initial.situation.name,
                location: core.players['0'].locationId, mana: core.players['0'].mana,
                occupants: core.battlefield[target].playerIds,
                previousTerrain: fateDeploymentTerrain(starting),
                terrain: ['0', '1', '2'].map(id => fateDeploymentTerrain(core.players[id])),
                playedAbilitySounds: await playedSounds?.(),
            }, null, 2), 'utf8');
        } finally {
            await releaseSourceSession(context);
        }
    });
}
