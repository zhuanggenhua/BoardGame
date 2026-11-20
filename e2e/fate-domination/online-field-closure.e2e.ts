import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Locator } from '@playwright/test';
import { FATE_ATTACK_BY_ID, FATE_EVENTS, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { fateDeploymentTerrain } from '../../src/games/fate-domination/domain/deployment';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initContext } from '../helpers/common';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

function prepareDayNine({ core }: FateState, terrainEventId: string) {
    const event = (id: string) => FATE_EVENTS.find(card => card.id === id)!;
    core.phase = 'action';
    core.round = 9;
    core.situation = FATE_SITUATIONS.find(card => card.id === 'sit11')!;
    core.currentPlayerId = '0';
    core.turnOrder = ['1', '2', '0'];
    core.currentTurnIndex = 2;
    core.shintoEventFaceDown = false;
    core.currentEvents = {
        miyama: [event('fuyuki_E3'), event('fuyuki_E4')],
        shinto: [event(terrainEventId), event('fuyuki_E18')],
    };
    core.miyamaEvent = core.currentEvents.miyama[0];
    const dealt = new Set(Object.values(core.currentEvents).flat().map(card => card.id));
    core.eventDeck = core.eventDeck.filter(card => !dealt.has(card.id));
    core.eventDeckCount = core.eventDeck.length;
    core.battlefield.miyama = { ...core.battlefield.miyama, playerIds: ['0', '1'], eventCards: core.currentEvents.miyama };
    core.battlefield.shinto = { ...core.battlefield.shinto, playerIds: ['2'], eventCards: core.currentEvents.shinto };

    const seats = [
        ['0', 'm_shirou_emiya', 'servant-medusa', 'miyama', 0],
        ['1', 'm_waver', 'servant-gilles', 'miyama', 1],
        ['2', 'm_shinji', 'servant-saber', 'shinto', 0],
    ] as const;
    for (const [id, masterId, servantId, locationId, deploymentSlot] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const servant = FATE_SERVANT_BY_ID[servantId];
        const deck = createFateAttackDeck(id, servantId);
        const hand = deck.splice(0, 3);
        const skills = [...(master.skills ?? []), ...servant.skillCards!]
            .map((skill, index) => ({ ...skill, id: `${skill.id}:${index}` }));
        const alreadyPlayed = id !== '0';
        Object.assign(core.players[id], {
            masterId, servantId, locationId, deploymentSlot, hand, deck, skills,
            isRevealed: id === '1',
            mana: alreadyPlayed ? 6 - FATE_ATTACK_BY_ID[hand[0].definitionId].manaCost : 12,
            activeAttackIds: alreadyPlayed ? [hand[0].id, hand[1].id] : [],
            faceDownAttackIds: alreadyPlayed ? [hand[1].id] : [],
            normalAttackPlayed: alreadyPlayed,
            hasPassedAction: alreadyPlayed,
        });
    }
    const tome = core.players['1'].skills.find(skill => skill.id.startsWith('sc_gilles_np:'))!;
    core.battlefieldAttacks = [{ playerId: '1', skillId: tome.id, locationId: 'shinto' }];
}

const foregroundCards = '.fd-runtime-hand-grid [data-card-zone]';

function overlappingObjects(object: Locator, selector: string) {
    return object.evaluate((element, competitors) => {
        const area = element.getBoundingClientRect();
        return Array.from(document.querySelectorAll(competitors))
            .filter(control => {
                const bounds = control.getBoundingClientRect();
                return bounds.left < area.right && bounds.right > area.left
                    && bounds.top < area.bottom && bounds.bottom > area.top;
            })
            .map(control => control.getAttribute('aria-label') ?? control.tagName);
    }, selector);
}

const scenarios = [
    { terrainEventId: 'fuyuki_E7', eventName: '占领高地', terrainPower: 8, width: 1366, height: 768 },
    { terrainEventId: 'fuyuki_E8', eventName: '归零地', terrainPower: 0, width: 1280, height: 720 },
];

for (const { terrainEventId, eventName, terrainPower, width, height } of scenarios) {
    test(`在线代表态验证${eventName}、双地利和新都场地牌退场`, async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(150_000);
        await page.setViewportSize({ width, height });
        await initContext(context, { skipImageGate: false });
        await startSourceSession(context, baseURL!);
        try {
            const { read, connectPeer } = await openFateRepresentativeBoard(page, context, state => prepareDayNine(state, terrainEventId));
            const primary = page.getByTestId('fate-domination-primary-action');
            const fieldCard = page.locator('[data-fate-field-attack]');
            const secondClaim = page.getByRole('img', { name: '玩家 1 占领了新都的另一处地利' });
            const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            const capture = (name: string) => page.screenshot({
                path: getEvidenceScreenshotPathInDirectory(run.stagingDir, name, { requireChineseName: true }),
            });
            await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45000 });
            await expect(fieldCard).toBeVisible();
            await expect(page.getByRole('button', { name: `检视${eventName}`, exact: true })).toBeVisible();
            const initial = (await read()).core;
            const placed = initial.battlefieldAttacks!;
            const oldTerrain = fateDeploymentTerrain(initial.players['2']);
            expect([oldTerrain, fateDeploymentTerrain(initial.players['0'])]).toEqual([3, 3]);
            const base = FATE_ATTACK_BY_ID[initial.players['0'].hand[0].definitionId];

            await page.getByRole('button', { name: '选择 骑英之缰绳', exact: true }).click();
            await page.locator('[data-card-zone="hand"]').first().click();
            await expect(primary).toHaveAccessibleName('确认攻击');
            await primary.click();
            const expectedMana = 12 - 9 - base.manaCost;
            await expect.poll(async () => (await read()).core.players['0'].mana).toBe(expectedMana);
            await capture('01-骑英之缰绳已打出且教本留场');
            await page.getByRole('button', { name: '发动 骑英之缰绳', exact: true }).click();
            await page.getByTestId('fate-domination-location-shinto').click({ timeout: 8000 });

            await expect.poll(async () => (await read()).core.players['0'].locationId).toBe('shinto');
            const afterMove = (await read()).core;
            expect(afterMove.battlefieldAttacks).toEqual(placed);
            expect([fateDeploymentTerrain(afterMove.players['0']), fateDeploymentTerrain(afterMove.players['2'])]).toEqual([4, 0]);
            expect(afterMove.players['0'].mana).toBe(expectedMana);
            const power = base.basePower + 8 + terrainPower;
            const pawn = page.getByRole('button', { name: '玩家1位于新都', exact: true });
            await expect(pawn.getByLabel(`威力 ${power}`, { exact: true })).toBeVisible();
            await expect(secondClaim).toBeVisible();
            await expect(fieldCard).toBeVisible();
            await expect(fieldCard).not.toHaveAttribute('data-fate-field-slot', /.+/);
            const displacedPawn = page.getByRole('button', { name: '玩家3位于新都', exact: true });
            const displacedPower = displacedPawn.getByLabel(/^威力 /);
            await expect(displacedPawn).toBeVisible();
            await expect(displacedPower).toBeVisible();
            await expect.poll(() => overlappingObjects(displacedPawn, foregroundCards), {
                message: '失去地利的棋子不能被已打出牌或手牌遮住',
            }).toEqual([]);
            await expect.poll(() => overlappingObjects(displacedPower, foregroundCards), {
                message: '失去地利的棋子旁仍应能读到威力',
            }).toEqual([]);
            await expect.poll(() => overlappingObjects(fieldCard, `${foregroundCards}, .fd-runtime-pawn`)).toEqual([]);
            await capture(`02-${eventName}时双地利和场地攻击`);
            await fieldCard.click({ timeout: 8000 });
            await expect(page.getByTestId('fate-inspection-card-face')).toBeVisible();
            await page.keyboard.press('Escape');

            await primary.click();
            for (const [seat, next] of [['1', '2'], ['2', '0']] as const) {
                const peer = connectPeer(seat);
                try {
                    await expect.poll(() => (peer.latestState as FateState | undefined)?.core.currentPlayerId).toBe(seat);
                    expect(peer.sendCommand('ADVANCE_PHASE', {})).toBe(true);
                    await expect.poll(async () => (await read()).core.currentPlayerId).toBe(next);
                } finally {
                    peer.disconnect();
                }
            }
            await primary.click();
            await expect.poll(async () => (await read()).core.battleResolution?.step).toBe('locations');
            for (const location of ['miyama', 'shinto'] as const) {
                await expect(primary).toBeEnabled();
                await primary.click();
                await expect.poll(async () => (await read()).core.resolvedLocations).toContain(location);
            }
            const scored = (await read()).core;
            expect(scored.resolvedResults).toContainEqual(expect.objectContaining({
                playerId: '0', locationId: 'shinto', power, status: 'representative-win',
            }));
            expect(scored.battlefieldAttacks).toEqual(placed);
            await expect(fieldCard).toBeVisible();
            await primary.click();
            await expect.poll(async () => (await read()).core.round).toBe(10);
            const closed = (await read()).core;
            expect(closed.situation.id).toBe('sit12');
            expect(closed.battlefieldAttacks).toEqual([]);
            expect(closed.players['1'].skills.map(skill => skill.id)).toContain(placed[0].skillId);
            expect(closed.players['0'].mana).toBe(expectedMana + 2 + 4);
            await expect(fieldCard).toHaveCount(0);
            await expect(page.getByRole('button', { name: '检视身处地狱之门', exact: true })).toBeVisible();
            if (width === 1280) {
                await expect(page.locator('.fd-runtime-camera-controls > span')).toHaveText('61%', {
                    timeout: 5000,
                });
            }
            await capture('03-新都关闭后教本退场');
            await writeFile(join(run.stagingDir, '场地交互结果.json'), JSON.stringify({
                sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
                source: `骑英之缰绳重新部署于该战场的两处地利；${eventName}决定地利实计数；螺湮城教本在所在战场关闭时关闭。来源为中文 CHM 卡面。`,
                verified: { power, terrainPower, roundBefore: 9, roundAfter: closed.round, fieldBefore: placed, fieldAfter: closed.battlefieldAttacks },
            }, null, 2), 'utf8');
        } finally {
            await releaseSourceSession(context);
        }
    });
}
