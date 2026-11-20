import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { fateAbilityUsageKey } from '../../src/games/fate-domination/domain/abilitySource';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initContext } from '../helpers/common';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });

function prepareBattle({ core }: FateState) {
    core.round = 4;
    core.phase = 'battle';
    core.currentPlayerId = '0';
    core.currentTurnIndex = 0;
    core.turnOrder = ['0', '1', '2'];
    core.situation = FATE_SITUATIONS.find(card => card.id === 'sit1')!;
    core.battlefield.miyama.playerIds = ['0', '1'];
    core.battlefield.shinto.playerIds = ['2'];
    for (const [id, servantId, locationId, deploymentSlot] of [
        ['0', 'servant-saber', 'miyama', 0], ['1', 'servant-cu-chulainn', 'miyama', 1], ['2', 'servant-medusa', 'shinto', 0],
    ] as const) {
        const fakeFreeCards = createFateAttackDeck(id, servantId);
        const skills = FATE_SERVANT_BY_ID[servantId].skillCards!.map((card, i) => ({ ...card, id: `${card.id}:${i}` }));
        const attack = fakeFreeCards.find(card => card.definitionId === (id === '0' ? 'cardluck' : 'cardB1'))!;
        Object.assign(core.players[id], {
            servantId, locationId, deploymentSlot, hand: [attack], deck: fakeFreeCards.filter(card => card.id !== attack.id),
            activeAttackIds: [attack.id], skills, activeSkills: id === '2' ? [] : [skills[0].id],
            isRevealed: id === '1', normalAttackPlayed: true, hasPassedAction: true,
        });
    }
}

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
