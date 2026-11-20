import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { fateAbilityUsageKey } from '../../src/games/fate-domination/domain/abilitySource';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initContext } from '../helpers/common';
import { patchMatchState } from '../helpers/state-injection';
import { createFateLobbyMatch } from './onlineFateLobby';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });

function prepareBattle({ core }: FateState, luckySeat = '0') {
    core.round = 4;
    core.phase = 'battle';
    core.currentPlayerId = '0';
    core.currentTurnIndex = 0;
    core.turnOrder = ['0', '1', '2'];
    core.situation = FATE_SITUATIONS.find(card => card.id === 'sit1')!;
    core.battlefield.miyama.playerIds = ['0', '1'];
    core.battlefield.shinto.playerIds = ['2'];
    for (const [id, servantId, locationId, deploymentSlot] of [
        [luckySeat, 'servant-saber', 'miyama', 0], [luckySeat === '0' ? '1' : '0', 'servant-cu-chulainn', 'miyama', 1], ['2', 'servant-medusa', 'shinto', 0],
    ] as const) {
        const deck = createFateAttackDeck(id, servantId);
        const skills = FATE_SERVANT_BY_ID[servantId].skillCards!.map((card, i) => ({ ...card, id: `${card.id}:${i}` }));
        const attack = deck.find(card => card.definitionId === (id === luckySeat ? 'cardluck' : 'cardB1'))!;
        Object.assign(core.players[id], {
            servantId, locationId, deploymentSlot, hand: [attack], deck: deck.filter(card => card.id !== attack.id),
            activeAttackIds: [attack.id], skills, activeSkills: id === '2' ? [] : [skills[0].id],
            isRevealed: servantId === 'servant-cu-chulainn', normalAttackPlayed: true, hasPassedAction: true,
        });
    }
}

test('真实服务器 AI 面对已明置的穿刺死棘之枪，先发动幸运再交还真人', async ({ page, context }) => {
    test.setTimeout(120_000);
    await initContext(context);
    await page.goto('/?game=fate-domination', { waitUntil: 'domcontentloaded' });
    const { matchId, read } = await createFateLobbyMatch(page);
    const state = await read();
    prepareBattle(state, '1');
    state.core.phase = 'action';
    state.core.players['0'].hasPassedAction = false;
    state.core.turnOrder = ['1', '2', '0'];
    state.core.currentTurnIndex = 2;
    state.core.shintoEventFaceDown = false;
    await patchMatchState(matchId, { core: state.core, sys: { ...state.sys, turnOrder: state.core.turnOrder, currentPlayerIndex: 2 } }, page);

    const primary = page.getByTestId('fate-domination-primary-action');
    await expect(primary).toHaveAccessibleName('结束行动');
    await primary.click();
    await expect.poll(async () => (await read()).core.phase).toBe('battle');
    const spear = page.getByRole('button', { name: '发动 穿刺死棘之枪', exact: true });
    await expect(primary).toBeEnabled({ timeout: 30_000 });
    const ready = await read();
    expect(ready.core.currentPlayerId).toBe('0');
    const luckyId = state.core.players['1'].activeAttackIds[0];
    expect(ready.core.players['1'].usedAbilityIds).toContain(fateAbilityUsageKey(luckyId, 'battle'));
    expect(ready.core.phaseCompletedPlayerIds).toEqual(['1', '2']);
    await expect(spear).toBeEnabled();
    await spear.click();
    await expect.poll(async () => (await read()).sys.eventStream.entries.some(({ event }) => event.type === 'FATE_DEFEAT_PREVENTED')).toBe(true);
    expect((await read()).core.players['1'].defeatMarkers).toEqual([]);
    await expect(primary).toBeEnabled();
});

test('在线战斗已完成操作的席位可发动幸运，战力结算开始后关闭战斗能力', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    await initContext(context, { skipImageGate: false });
    await startSourceSession(context, baseURL!);
    try {
        const { read, connectPeer } = await openFateRepresentativeBoard(page, context, prepareBattle);
        const [opponent, other] = ['1', '2'].map(connectPeer);
        const { stagingDir } = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
        const capture = (name: string) => page.screenshot({ path: getEvidenceScreenshotPathInDirectory(stagingDir, name, { format: 'png', requireChineseName: true }) });
        try {
            const primary = page.getByTestId('fate-domination-primary-action');
            await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready');
            const initial = await read();
            const luckyId = initial.core.players['0'].activeAttackIds[0];
            const spearId = initial.core.players['1'].activeSkills[0];
            await expect(primary).toHaveAccessibleName('完成战斗操作');
            await primary.click();
            await expect.poll(() => (opponent.latestState as FateState | undefined)?.core.currentPlayerId).toBe('1');
            await expect(primary).toBeDisabled();

            const luck = page.getByRole('button', { name: '发动 幸运', exact: true });
            await expect(luck).toBeEnabled();
            await capture('01-已完成战斗操作仍可发动幸运');
            await luck.click();
            await expect.poll(async () => (await read()).core.players['0'].usedAbilityIds).toContain(fateAbilityUsageKey(luckyId, 'battle'));
            expect((await read()).core.currentPlayerId).toBe('1');
            expect(opponent.sendCommand('PLAY_SKILL', { skillId: spearId })).toBe(true);
            await expect.poll(async () => (await read()).sys.eventStream.entries.some(({ event }) => event.type === 'FATE_DEFEAT_PREVENTED')).toBe(true);
            expect((await read()).core.players['0'].defeatMarkers).toEqual([]);

            const counterMagic = page.getByRole('button', { name: '发动 对魔力', exact: true });
            await expect(counterMagic).toBeEnabled();
            expect(opponent.sendCommand('ADVANCE_PHASE', {})).toBe(true);
            await expect.poll(() => (other.latestState as FateState | undefined)?.core.currentPlayerId).toBe('2');
            expect(other.sendCommand('ADVANCE_PHASE', {})).toBe(true);
            await expect.poll(async () => (await read()).core.battleResolution?.step).toBe('locations');
            await expect(counterMagic).toBeDisabled();
            await counterMagic.click({ force: true });
            await expect(page.getByText('已开始结算战力，不能再发动战斗能力。', { exact: true })).toBeVisible();
            expect((await read()).core.players['0'].usedAbilityIds).toEqual([fateAbilityUsageKey(luckyId, 'battle')]);
            await capture('02-战力结算开始后不可发动');
            const source = await captureEvidenceSourceIdentity(page, 'fate-domination');
            await writeFile(join(stagingDir, 'source-identity.json'), JSON.stringify(source, null, 2));
        } finally {
            opponent.disconnect();
            other.disconnect();
        }
    } finally { await releaseSourceSession(context); }
});
