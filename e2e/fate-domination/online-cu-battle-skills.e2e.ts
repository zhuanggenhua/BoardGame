import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { fateAbilityUsageKey } from '../../src/games/fate-domination/domain/abilitySource';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { initContext } from '../helpers/common';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { initFateAudioContext, trackFateAbilitySounds } from './fateAbilityAudio';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });

function prepareCuBattle({ core }: FateState, againstTwo: boolean, protectedTarget = false, verifyTrack = false) {
    core.phase = 'action';
    core.round = againstTwo && !verifyTrack ? 11 : 4;
    core.turnOrder = ['1', '2', '0'];
    core.currentPlayerId = '0';
    core.currentTurnIndex = 2;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === (core.round === 11 ? 'sit13' : 'sit1'))!;
    core.currentEvents = { miyama: [], shinto: [] };
    core.battlefield.miyama.eventCards = [];
    core.battlefield.shinto.eventCards = [];
    const seats = [
        ['0', 'm_kirei', 'servant-cu-chulainn', 'miyama', 0],
        ['1', 'm_shinji', protectedTarget ? 'servant-saber' : 'servant-medusa', 'miyama', 1],
        ['2', 'm_shirou_emiya', protectedTarget ? 'servant-medusa' : 'servant-saber', againstTwo ? 'miyama' : 'shinto', againstTwo ? null : 0],
    ] as const;
    for (const [id, masterId, servantId, locationId, deploymentSlot] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const servant = FATE_SERVANT_BY_ID[servantId];
        const deck = createFateAttackDeck(id, servantId);
        const secondCard = id === '1' && protectedTarget ? 'cardluck' : 'cardB2';
        const hand = ['cardB1', secondCard].map(definitionId => deck.find(card => card.definitionId === definitionId)!);
        Object.assign(core.players[id], {
            masterId, servantId, locationId, deploymentSlot, hand, deck: deck.filter(card => !hand.includes(card)),
            victoryPoints: 12, mana: id === '0' ? 10 : master.initMana ?? 4,
            isRevealed: id === '0' && !againstTwo, piercingSpearPlays: id === '0' && !againstTwo ? 1 : 0,
            hasPassedAction: id !== '0', normalAttackPlayed: id !== '0',
            activeAttackIds: id === '0' ? [] : hand.map(card => card.id),
            skills: [...(master.skills ?? []), ...(servant.skillCards ?? [])]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })),
        });
        core.battlefield[locationId].playerIds.push(id);
    }
}

const piercingHeartText = '【真名解放】\n打出时：此牌+2魔力消耗（可叠加）直至游戏结束。\n贯穿心脏-战斗阶段：若仅有一名对手与你位于同一战场，令其【败北】。';
const soaringSpear = { name: '突穿死翔之枪', skill: 'sc_cu_np', cost: 7, againstTwo: true, protectedTarget: false,
    source: '【真名解放】\n战斗阶段：战斗阶段结束后，每与一名对手进行了战斗便获得1点战果。若你获得胜利，每名交战对手失去该数量的战果。' } as const;
const cases = [
    { name: '穿刺死棘之枪', skill: 'sc_cu_1', cost: 5, againstTwo: false, protectedTarget: false,
        source: piercingHeartText, verifyTrack: false },
    { name: '穿刺死棘之枪', skill: 'sc_cu_1', cost: 5, againstTwo: false, protectedTarget: true,
        source: piercingHeartText, verifyTrack: false },
    { ...soaringSpear, verifyTrack: false },
    { ...soaringSpear, verifyTrack: true },
] as const;

for (const { name, skill, cost, againstTwo, protectedTarget, source, verifyTrack } of cases) {
    const resultExpectation = verifyTrack ? '并查看棋盘战果' : protectedTarget ? '并查看幸运抵挡日志' : '并查看结果';
    test(`在线库·丘林发动${name}${resultExpectation}`, async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(150_000);
        if (againstTwo) await initContext(context, { skipImageGate: false });
        await initFateAudioContext(context);
        await startSourceSession(context, baseURL!);
        try {
            const { read, connectPeer } = await openFateRepresentativeBoard(page, context, state => prepareCuBattle(state, againstTwo, protectedTarget, verifyTrack));
            const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            const screenshot = (filename: string) => page.screenshot({
                path: getEvidenceScreenshotPathInDirectory(run.stagingDir, filename, { requireChineseName: true }),
            });
            const primary = page.getByTestId('fate-domination-primary-action');
            const mana = page.getByTestId('fate-self-mana').locator('b');
            await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45_000 });
            const card = page.getByRole('button', { name: `选择 ${name}`, exact: true });
            if (!againstTwo) await expect(card.locator('[data-cost-change="increase"]')).toHaveText('↑5');
            await card.click();
            await page.locator('button[data-card-zone="hand"]').first().click();
            await expect(mana).toHaveText(String(10 - cost));
            expect((await read()).core.players['0'].mana).toBe(10);
            await page.mouse.move(12, 12);
            if (!protectedTarget && !verifyTrack) await screenshot('01-攻击确认前的预计扣费');
            await primary.click();
            await expect.poll(async () => (await read()).core.players['0'].mana).toBe(10 - cost);
            const { skills, piercingSpearPlays } = (await read()).core.players['0'];
            const skillId = skills.find(item => item.id.startsWith(`${skill}:`))!.id;
            if (!againstTwo) expect(piercingSpearPlays).toBe(2);
            await expect(primary).toHaveAccessibleName('结束行动');
            await primary.click();
            await expect.poll(async () => (await read()).core.phase).toBe('battle');

            const peers = ['1', '2'].map(connectPeer);
            try {
                for (const [index, peer] of peers.entries()) {
                    const id = String(index + 1);
                    await expect.poll(() => (peer.latestState as FateState | undefined)?.core.currentPlayerId).toBe(id);
                    if (protectedTarget && id === '1') {
                        const lucky = (await read()).core.players[id].hand.find(card => card.definitionId === 'cardluck')!;
                        expect(peer.sendCommand('PLAY_SKILL', { skillId: lucky.id })).toBe(true);
                        await expect.poll(() => (peer.latestState as FateState | undefined)?.core.players[id].usedAbilityIds)
                            .toContain(fateAbilityUsageKey(lucky.id, 'battle'));
                    }
                    expect(peer.sendCommand('ADVANCE_PHASE', {})).toBe(true);
                }
                const activate = page.getByRole('button', { name: `发动 ${name}`, exact: true });
                await expect(activate).toBeEnabled();
                const spearSound = againstTwo ? 'Spear Whoosh B.ogg' : 'WEAPPole_Whoosh Metal Spear 01_KRST.ogg';
                const playedSounds = await trackFateAbilitySounds(page, [spearSound]);
                expect(await playedSounds()).toEqual([]);
                if (!protectedTarget && !verifyTrack) await screenshot('02-战斗阶段可发动宝具');
                await activate.click();
                await expect.poll(async () => (await read()).core.players['0'].usedAbilityIds).toContain(fateAbilityUsageKey(skillId, 'battle'));
                await expect.poll(playedSounds).toEqual([spearSound]);
                await expect(activate).toBeDisabled();
                const afterActivation = await read();
                let result;
                if (againstTwo) {
                    expect(Object.values(afterActivation.core.players).map(player => player.victoryPoints)).toEqual([12, 12, 12]);
                    const marks = page.locator('[data-fate-victory-seat]');
                    if (verifyTrack) {
                        await expect(marks).toHaveCount(3);
                        await expect(page.locator('[data-fate-victory-points="12"]')).toHaveCount(3);
                        await page.mouse.move(642, 54);
                        await page.mouse.wheel(0, 290);
                        await expect(page.locator('.fd-runtime-camera-controls > span')).toHaveText('46%');
                        await screenshot('01-发动后等待战果结算，三人仍同分');
                    }
                    await primary.click();
                    for (const label of ['结算深山町', '结算新都', '结算侦察']) {
                        await expect(primary).toHaveAccessibleName(label);
                        await primary.click();
                    }
                    await expect.poll(async () => (await read()).core.phase).toBe(verifyTrack ? 'preparation' : 'complete');
                    const { core, sys } = await read();
                    const adjustment = sys.eventStream.entries.find(entry => entry.event.type === 'FATE_BATTLE_SCORE_ADJUSTED')?.event.payload;
                    expect(adjustment).toMatchObject({ sourceId: skillId, changes: [
                        { playerId: '0', amount: 2 }, { playerId: '1', amount: -2 }, { playerId: '2', amount: -2 },
                    ] });
                    expect(sys.actionLog.entries.filter(entry => entry.kind === 'FATE_BATTLE_SCORE_ADJUSTED')).toHaveLength(3);
                    if (verifyTrack) {
                        const scores = core.playerIds.map(id => core.players[id].victoryPoints);
                        expect(scores).toEqual([16, 10, 10]);
                        for (const [index, score] of scores.entries()) {
                            const marker = page.locator(`[data-fate-victory-seat="${index}"]`);
                            await expect(marker).toHaveAttribute('data-fate-victory-points', String(score));
                            await expect.poll(() => marker.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
                            await expect.poll(() => marker.evaluate(node => {
                                const mark = node.getBoundingClientRect();
                                return Array.from(document.querySelectorAll('.fd-runtime-hand-grid .fd-runtime-card-shell, .fd-runtime-seat-row, .fd-phase-control'))
                                    .some(control => {
                                        const bounds = control.getBoundingClientRect();
                                        return mark.left < bounds.right && mark.right > bounds.left && mark.top < bounds.bottom && mark.bottom > bounds.top;
                                    });
                            })).toBe(false);
                        }
                        result = { adjustment, scores };
                    } else {
                        await expect(page.getByRole('region', { name: '圣杯战争结果' })).toBeVisible();
                        result = { adjustment, scores: core.gameResult?.scores };
                    }
                } else if (protectedTarget) {
                    expect(afterActivation.core.players['1'].defeatMarkers).toEqual([]);
                    const log = afterActivation.sys.actionLog.entries.filter(entry => entry.kind === 'FATE_DEFEAT_PREVENTED');
                    expect(log).toEqual([expect.objectContaining({ actorId: '1' })]);
                    const logButton = page.locator('button[data-fab-id="action-log"]');
                    if (!await logButton.isVisible()) await page.getByTestId('fab-menu').locator('button').first().click();
                    await logButton.click();
                    const logPanel = page.getByTestId('fab-panel-action-log');
                    await expect(logPanel.getByText('抵挡了本次败北', { exact: true })).toBeVisible();
                    result = { protected: '1', log };
                } else {
                    expect(afterActivation.core.players['1'].defeatMarkers).toEqual([expect.objectContaining({ sourceId: skillId, direct: true })]);
                    expect(afterActivation.core.players['2'].defeatMarkers).toEqual([]);
                    await expect(page.getByRole('button', { name: '玩家2位于深山町', exact: true }).getByText('败北', { exact: true })).toBeVisible();
                    await expect(page.locator('[data-tutorial-id="fate-player-1"]').getByText('败北', { exact: true })).toBeVisible();
                    result = { defeated: '1', futurePrintedCostIncrease: 4 };
                }
                await page.mouse.move(12, 12);
                if (verifyTrack) await screenshot('02-结算后圆位分开，两个对手继续同分');
                else if (protectedTarget) await screenshot('01-幸运抵挡败北的公开日志');
                else await screenshot(againstTwo ? '03-战后战果进入终局' : '03-唯一同场对手显示败北');
                await writeFile(join(run.stagingDir, '效果和权威结果.json'), JSON.stringify({
                    source: { text: source, reference: `中文卡图 ${skill}.png` },
                    sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'), paidMana: cost, result,
                    playedAbilitySounds: await playedSounds(),
                }, null, 2), 'utf8');
            } finally {
                peers.forEach(peer => peer.disconnect());
            }
        } finally {
            await releaseSourceSession(context);
        }
    });
}
