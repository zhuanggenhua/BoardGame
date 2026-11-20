import { writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { expect, test } from '@playwright/test';
import { FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { fateAttackManaCost } from '../../src/games/fate-domination/domain/attackSelection';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { initContext } from '../helpers/common';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory, promoteEvidenceScreenshotRun } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });

const cases = [
    { servant: 'servant-saber', master: 'm_shirou_emiya', skill: 'sc_saber_2',
        name: '风王结界', companion: '誓约胜利之剑', firstCost: 10, secondCost: 4 },
    { servant: 'servant-cu-chulainn', master: 'm_kirei', skill: 'sc_cu_1',
        name: '穿刺死棘之枪', companion: null, firstCost: 3, secondCost: 5 },
] as const;

function prepareCostLifecycle({ core }: FateState, scenario: typeof cases[number]) {
    core.phase = 'action';
    core.round = 4;
    core.turnOrder = ['1', '2', '0'];
    core.currentPlayerId = '0';
    core.currentTurnIndex = 2;
    core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit1')!;
    const nextSituation = FATE_SITUATIONS.find(situation => situation.id === 'sit2')!;
    core.situationDeck = [nextSituation, ...(core.situationDeck ?? [])
        .filter(situation => situation.id !== nextSituation.id && situation.id !== core.situation.id)];
    core.currentEvents = { miyama: [], shinto: [] };
    for (const location of Object.values(core.battlefield)) {
        location.eventCards = [];
        location.playerIds = [];
    }
    const seats = [
        ['0', scenario.master, scenario.servant, 'miyama', 0],
        ['1', 'm_shinji', 'servant-medusa', 'miyama', 1],
        ['2', 'm_waver', scenario.companion ? 'servant-cu-chulainn' : 'servant-saber', 'workshop', 0],
    ] as const;
    for (const [id, masterId, servantId, locationId, deploymentSlot] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const servant = FATE_SERVANT_BY_ID[servantId];
        const deck = createFateAttackDeck(id, servantId);
        const hand = ['cardB1', 'cardB2'].map(definitionId => deck.find(card => card.definitionId === definitionId)!);
        hand.push(deck.find(card => !hand.includes(card))!);
        const played = id === '0' ? [] : hand.slice(0, 2).map(card => card.id);
        Object.assign(core.players[id], {
            masterId, servantId, locationId, deploymentSlot, hand, deck: deck.filter(card => !hand.includes(card)),
            victoryPoints: 10, mana: id === '0' ? 12 : 6, isRevealed: false,
            hasPassedAction: id !== '0', normalAttackPlayed: id !== '0', activeAttackIds: played,
            faceDownAttackIds: id === '2' ? played : [],
            skills: [...(master.skills ?? []), ...(servant.skillCards ?? [])]
                .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` })),
        });
        core.battlefield[locationId].playerIds.push(id);
    }
}

for (const scenario of cases) {
    test(`在线同局验证${scenario.name}的跨轮实付费用`, async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        await initContext(context, { skipImageGate: false });
        await startSourceSession(context, baseURL!);
        try {
            const { read, connectPeer } = await openFateRepresentativeBoard(page, context, state => prepareCostLifecycle(state, scenario));
            const peers = { '1': connectPeer('1'), '2': connectPeer('2') };
            try {
                const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
                const screenshot = async (filename: string) => {
                    const path = getEvidenceScreenshotPathInDirectory(run.stagingDir, filename, { requireChineseName: true });
                    await page.mouse.move(12, 12);
                    await page.screenshot({ path });
                    return relative(process.cwd(), join(run.stableDir, basename(path))).replace(/\\/g, '/');
                };
                const primary = page.getByTestId('fate-domination-primary-action');
                const mana = page.getByTestId('fate-self-mana').locator('b');
                const skillCard = page.getByRole('button', { name: `选择 ${scenario.name}`, exact: true });
                const publicServant = () => (peers['1'].latestState as FateState | undefined)?.core.players['0'].servantId;
                await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45_000 });
                await expect.poll(publicServant).toBe('');
                const initial = await read();
                const skill = initial.core.players['0'].skills.find(item => item.id.startsWith(`${scenario.skill}:`))!;

                const selectFreeHandCard = async () => {
                    const { core } = await read();
                    const player = core.players['0'];
                    const free = player.hand.find(card => fateAttackManaCost(player, card.id, false, core.round) === 0)!;
                    expect(free, '当前手牌有真实的零费用实例').toBeDefined();
                    await page.locator(`button[data-card-zone="hand"][data-card-id="${free.id}"]`).click({ position: { x: 12, y: 70 } });
                    return free.id;
                };
                const confirmPair = async (companionId: string, before: number, cost: number, round: number) => {
                    await expect(mana).toHaveText(String(before - cost));
                    const draft = (await read()).core.players['0'];
                    expect(draft).toMatchObject({ mana: before, selectedAttackIds: [], selectedFaceDownIds: [], normalAttackPlayed: false });
                    await expect(primary).toHaveAccessibleName('确认攻击');
                    await primary.click();
                    await expect.poll(async () => (await read()).core.players['0'].normalAttackPlayed).toBe(true);
                    const confirmed = await read();
                    expect(confirmed.core.round).toBe(round);
                    expect(confirmed.core.players['0']).toMatchObject({ mana: before - cost, isRevealed: true });
                    const events = confirmed.sys.eventStream.entries.filter(({ event }) => event.type === 'ATTACKS_CONFIRMED'
                        && (event.payload as { playerId?: string }).playerId === '0');
                    expect(events.at(-1)?.event.payload).toMatchObject({
                        playerId: '0', manaSpent: cost, cardIds: [skill.id, companionId], faceDownIds: [],
                    });
                };

                if (scenario.companion) await expect(skillCard.locator('[data-cost-change="decrease"]')).toHaveText('↓2');
                else await expect(skillCard.locator('[data-cost-change]')).toHaveCount(0);
                await skillCard.click();
                let companionId;
                if (scenario.companion) {
                    companionId = initial.core.players['0'].skills.find(item => item.name === scenario.companion)!.id;
                    await page.getByRole('button', { name: `选择 ${scenario.companion}`, exact: true }).click();
                } else {
                    companionId = await selectFreeHandCard();
                }
                await expect(mana).toHaveText(String(12 - scenario.firstCost));
                expect(publicServant()).toBe('');
                const firstShot = await screenshot('01-第一次确认前的费用和预计魔力');
                await confirmPair(companionId, 12, scenario.firstCost, 4);
                await expect.poll(publicServant).toBe(scenario.servant);
                if (!scenario.companion) expect((await read()).core.players['0'].piercingSpearPlays).toBe(1);

                const advancePeer = async (id: keyof typeof peers, command: string, payload: unknown = {}) => {
                    const peer = peers[id];
                    const authoritative = (await read()).core;
                    expect(authoritative.currentPlayerId).toBe(id);
                    await expect.poll(() => {
                        const core = (peer.latestState as FateState | undefined)?.core;
                        return core && [core.round, core.phase, core.currentPlayerId];
                    }).toEqual([authoritative.round, authoritative.phase, id]);
                    const version = peer.lastReceivedStateID!;
                    expect(peer.sendCommand(command, payload)).toBe(true);
                    await expect.poll(() => peer.lastReceivedStateID, { message: `玩家 ${id} 执行 ${command}` }).toBeGreaterThan(version);
                };
                await expect(primary).toHaveAccessibleName('结束行动');
                await primary.click();
                await expect.poll(async () => (await read()).core.phase).toBe('battle');
                await advancePeer('1', 'ADVANCE_PHASE');
                await advancePeer('2', 'ADVANCE_PHASE');
                if (!scenario.companion) {
                    await page.getByRole('button', { name: `发动 ${scenario.name}`, exact: true }).click();
                    await expect.poll(async () => (await read()).core.players['1'].defeatMarkers).toEqual([
                        expect.objectContaining({ sourceId: skill.id, direct: true }),
                    ]);
                }
                await primary.click();
                for (const label of ['结算深山町', '结算新都', '结算侦察']) {
                    await expect(primary).toHaveAccessibleName(label);
                    await primary.click();
                }
                await expect.poll(async () => {
                    const { core } = await read();
                    return [core.round, core.phase, core.currentPlayerId];
                }).toEqual([5, 'preparation', '2']);
                const nextRound = (await read()).core;
                expect(nextRound.players['1'].defeatMarkers).toEqual([]);
                expect(nextRound.players['0']).toMatchObject({ isRevealed: true, activeSkills: [], usedAbilityIds: [] });

                await advancePeer('2', 'ADVANCE_PHASE');
                await primary.click();
                await expect.poll(async () => (await read()).core.currentPlayerId).toBe('1');
                await advancePeer('1', 'ADVANCE_PHASE');
                await advancePeer('2', 'DEPLOY_MASTER', { locationId: 'workshop' });
                await advancePeer('2', 'ADVANCE_PHASE');
                const destination = page.locator('button[data-fate-destination="miyama"]:enabled').first();
                await destination.click();
                await expect.poll(async () => (await read()).core.players['0'].locationId).toBe('miyama');
                await primary.click();
                await expect.poll(async () => (await read()).core.currentPlayerId).toBe('1');
                await advancePeer('1', 'DEPLOY_MASTER', { locationId: 'miyama' });
                await advancePeer('1', 'ADVANCE_PHASE');
                const workshopAttack = (await read()).core.players['2'].hand.slice(0, 2).map(card => card.id);
                await advancePeer('2', 'CONFIRM_ATTACK', { cardIds: workshopAttack, faceDownIds: workshopAttack, round: 5 });
                await expect.poll(async () => (await read()).core.players['2'].normalAttackPlayed).toBe(true);
                await advancePeer('2', 'PASS_ACTION');
                await expect.poll(async () => (await read()).core.currentPlayerId).toBe('0');

                let secondMana = (await read()).core.players['0'].mana;
                if (secondMana < 8) {
                    await page.getByRole('button', { name: '使用令咒', exact: true }).click();
                    await page.getByRole('button', { name: /恢复魔力/ }).click();
                    await page.getByRole('button', { name: '确认使用', exact: true }).click();
                    secondMana += 4;
                    const recovered = secondMana;
                    await expect.poll(async () => (await read()).core.players['0'].mana).toBe(recovered);
                }
                await expect(skillCard).toBeEnabled();
                if (scenario.companion) await expect(skillCard.locator('[data-cost-change]')).toHaveCount(0);
                else await expect(skillCard.locator('[data-cost-change="increase"]')).toHaveText('↑5');
                await skillCard.click();
                const freeId = await selectFreeHandCard();
                await expect(mana).toHaveText(String(secondMana - scenario.secondCost));
                const secondShot = await screenshot('02-同一技能跨轮后的费用和预计魔力');
                await confirmPair(freeId, secondMana, scenario.secondCost, 5);
                const confirmed = (await read()).core.players['0'];
                if (!scenario.companion) expect(confirmed.piercingSpearPlays).toBe(2);
                const nextPrice = fateAttackManaCost(confirmed, skill.id, false, 6);
                expect(nextPrice).toBe(scenario.companion ? 4 : 7);
                const source = { reference: `中文卡图 ${scenario.skill}.png`, text: skill.desc };
                const sourceIdentity = await captureEvidenceSourceIdentity(page, 'fate-domination');
                await writeFile(join(run.stagingDir, '规则原文及跨轮权威结果.json'), JSON.stringify({
                    source, sourceIdentity,
                    room: '正式在线房间。仅入场前设置第 4 回合代表态，确认出牌、结算与换轮均为正式操作。',
                    committed: [{ round: 4, paid: scenario.firstCost }, { round: 5, paid: scenario.secondCost }],
                    nextPrice,
                }, null, 2), 'utf8');
                const firstChange = scenario.companion
                    ? '真名隐藏，风王结界的费用格显示下降箭头和 2；同批选择誓约胜利之剑，左下魔力预计扣 10。'
                    : '首次选择穿刺死棘之枪，费用格显示 3；左下魔力预计扣 3。';
                const secondChange = scenario.companion
                    ? '同一房间进入第 5 回合。真名已揭示，风王结界回到印刷费用 4，左下魔力预计扣 4。'
                    : '同一技能跨轮返回右侧。再次选择时费用格显示红色上涨箭头和 5，左下魔力预计扣 5。';
                await promoteEvidenceScreenshotRun(run, {
                    version: 2, gameId: 'fate-domination', evidenceCategory: 'independent', capturePolicy: 'distinct-ui-state',
                    media: [
                        { path: firstShot, change: firstChange, description: `${source.text}\n\n${firstChange}` },
                        { path: secondShot, change: secondChange, description: secondChange },
                    ].map(({ path, change, description }, index) => ({
                        path, description, chainId: `${scenario.skill}-cost-lifecycle`, chainStep: index + 1,
                        stage: '独特界面态', role: 'main-flow', viewport: 'desktop', viewportSize: '1366×768',
                        uiStateId: `${scenario.skill}-cost-round-${4 + index}`, uiChange: 'interaction-mode',
                        uiChangeReason: change, effectReference: source.reference, sourceRevision: sourceIdentity.sourceRevision,
                    })),
                });
            } finally {
                Object.values(peers).forEach(peer => peer.disconnect());
            }
        } finally {
            await releaseSourceSession(context);
        }
    });
}
