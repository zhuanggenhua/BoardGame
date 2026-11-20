import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { FATE_ATTACK_BY_ID, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { fateAbilityUsageKey } from '../../src/games/fate-domination/domain/abilitySource';
import { FATE_RIDING_FRAME_KIND, isFateRidingChoice } from '../../src/games/fate-domination/domain/ridingChoice';
import { createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { assertNoFatalFrontendErrors, attachPageDiagnostics, initContext } from '../helpers/common';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';

test.use({ viewport: { width: 1366, height: 768 } });

function prepareRider({ core }: FateState, alreadyPaid: boolean) {
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
        ['0', 'm_waver', 'servant-rider', 'miyama'],
        ['1', 'm_shinji', 'servant-medusa', 'shinto'],
        ['2', 'm_shirou_emiya', 'servant-saber', 'workshop'],
    ] as const;
    for (const [id, masterId, servantId, locationId] of seats) {
        const master = FATE_MASTER_BY_ID[masterId];
        const servant = FATE_SERVANT_BY_ID[servantId];
        const deck = createFateAttackDeck(id, servantId);
        const hand = id === '0' ? ['cardB2', 'cardSurveil', 'cardB1', 'cardB1', 'cardQ1', 'cardB4'].map(definitionId => {
            const index = deck.findIndex(card => card.definitionId === definitionId);
            expect(index, definitionId).toBeGreaterThanOrEqual(0);
            return deck.splice(index, 1)[0];
        }) : deck.splice(0, 3);
        const skills = [...(master.skills ?? []), ...(servant.skillCards ?? [])]
            .map((skill, index) => ({ ...skill, id: `${skill.id ?? skill.name}:${index}` }));
        const ready = id === '0' && alreadyPaid;
        Object.assign(core.players[id], {
            masterId, servantId, locationId, deploymentSlot: 0, hand, deck, skills,
            mana: ready ? 0 : id === '0' ? 9 : master.initMana ?? 4,
            normalAttackPlayed: ready,
            activeAttackIds: ready ? [hand[0].id] : [],
            activeSkills: ready ? [skills.find(skill => skill.id.startsWith('sc_iskandar_1:'))!.id] : [],
            playedSpecialAttackThisRound: ready,
        });
        core.battlefield[locationId].playerIds = [id];
    }
}

const exposed = { x: 12, y: 60 };

async function clickUnavailableCard(page: Page, card: Locator, id: string) {
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    const box = (await card.boundingBox())!;
    const point = { x: box.x + exposed.x, y: box.y + exposed.y };
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-card-id]')?.getAttribute('data-card-id'), point);
    expect(hit).toBe(id);
    await page.mouse.click(point.x, point.y);
    await expect(card).toHaveAttribute('aria-pressed', 'false');
}

const scenarios = [
    { mode: 'zero', name: '取消清除暂存，重开后可确认零张' },
    { mode: 'one', name: '单张实付且高威力牌不可追加' },
    { mode: 'three', name: '三张上限，拒绝第四张且确认后只扣实际费用' },
    { mode: 'unaffordable', name: '魔力不足给出拒绝提示，取消保留发动机会' },
    { mode: 'no-candidate', name: '没有可追加手牌时直接结算，仍可结束行动' },
] as const;

for (const { mode, name } of scenarios) {
    test(`在线伊斯坎达尔骑乘：${name}`, async ({ page, context, baseURL }, testInfo) => {
        test.setTimeout(150_000);
        await initContext(context, { skipImageGate: false });
        await startSourceSession(context, baseURL!);
        const diagnostics = attachPageDiagnostics(page, name);
        try {
            const alreadyPaid = mode === 'unaffordable' || mode === 'no-candidate';
            const { read } = await openFateRepresentativeBoard(page, context, state => {
                prepareRider(state, alreadyPaid);
                if (mode === 'no-candidate') {
                    const rider = state.core.players['0'];
                    const [played, ...available] = rider.hand;
                    const highPower = available.find(card => card.definitionId === 'cardB4')!;
                    rider.hand = [played, highPower];
                    rider.deck.push(...available.filter(card => card !== highPower));
                }
            });
            const initial = (await read()).core.players['0'];
            const [base, paid, strength, duplicateStrength, agility, highPower] = initial.hand;
            const skillId = initial.skills.find(skill => skill.id.startsWith('sc_iskandar_1:'))!.id;
            const usage = fateAbilityUsageKey(skillId, 'action');
            const projectedMana = page.getByTestId('fate-self-mana').locator('b');
            const primary = page.getByTestId('fate-domination-primary-action');
            const activate = page.getByRole('button', { name: '发动 骑乘', exact: true });
            const card = (id: string) => page.locator(`button[data-card-zone="hand"][data-card-id="${id}"]`);
            const choiceSurface = page.locator('[data-riding-choice="true"]');
            const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
            const capture = (filename: string) => page.screenshot({
                path: getEvidenceScreenshotPathInDirectory(run.stagingDir, filename, { requireChineseName: true }),
            });
            const open = async () => {
                await activate.click();
                await expect(choiceSurface).toBeVisible();
                const choice = (await read()).sys.interaction.current;
                expect(isFateRidingChoice(choice)).toBe(true);
                return choice!.id;
            };
            const cancel = async () => {
                await page.getByRole('button', { name: '取消骑乘', exact: true }).click();
                await expect(choiceSurface).toHaveCount(0);
                await expect(activate).toBeEnabled();
            };
            await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45_000 });
            if (!alreadyPaid) {
                await page.getByRole('button', { name: '选择 骑乘', exact: true }).click();
                await card(base.id).click({ position: exposed });
                await expect(primary).toHaveAccessibleName('确认攻击');
                await primary.click();
                await expect(activate).toBeEnabled();
                await expect(card(initial.deck[0].id)).toBeVisible();
                expect((await read()).core.players['0'].deck).toHaveLength(initial.deck.length - 1);
            }

            const before = (await read()).core.players['0'];
            let selected: string[] = [];
            if (mode === 'no-candidate') {
                await expect(activate).toHaveAttribute('aria-disabled', 'false');
                await activate.click();
                await expect(activate).toHaveAttribute('aria-disabled', 'true');
                await expect(choiceSurface).toHaveCount(0);
                await expect(primary).toHaveAccessibleName('结束行动');
                await expect(projectedMana).toHaveText(String(before.mana));
                await capture('骑乘无可追加手牌后可结束行动');
            } else if (mode === 'unaffordable') {
                await open();
                await clickUnavailableCard(page, card(paid.id), paid.id);
                await expect(page.getByText('魔力不足', { exact: true })).toBeVisible();
                await capture('骑乘魔力不足');
                await cancel();
            } else {
                const firstChoice = await open();
                if (mode === 'one') {
                    await clickUnavailableCard(page, card(highPower.id), highPower.id);
                    await expect(page.getByText('骑乘只能选择当前手牌中的普通攻击牌。', { exact: true })).toBeVisible();
                }
                selected = mode === 'three' ? [paid.id, strength.id, duplicateStrength.id] : [paid.id];
                for (const id of selected) {
                    await card(id).click({ position: exposed, timeout: 8000 });
                    await expect(card(id)).toHaveAttribute('aria-pressed', 'true');
                }
                const during = (await read()).core.players['0'];
                expect(during.mana).toBe(before.mana);
                expect(during.activeAttackIds).toEqual(before.activeAttackIds);
                expect(during.selectedAttackIds).toEqual([]);
                const fee = FATE_ATTACK_BY_ID.cardSurveil.manaCost;
                await expect(projectedMana).toHaveText(String(before.mana - fee));
                if (mode === 'three') {
                    await clickUnavailableCard(page, card(agility.id), agility.id);
                    await expect(page.getByText('骑乘最多选择三张牌，请先撤回一张。', { exact: true })).toBeVisible();
                    await capture('骑乘拒绝第四张');
                } else if (mode === 'zero') {
                    await cancel();
                    expect((await read()).core.players['0'].usedAbilityIds).not.toContain(usage);
                    expect((await read()).core.players['0'].mana).toBe(before.mana);
                    expect(await open()).not.toBe(firstChoice);
                    await expect(card(paid.id)).toHaveAttribute('aria-pressed', 'false');
                    await expect(projectedMana).toHaveText(String(before.mana));
                    selected = [];
                    await capture('骑乘重开后无暂存');
                } else {
                    await capture('骑乘预计支付一张牌费用');
                }
                await primary.click();
                await expect(choiceSurface).toHaveCount(0);
                await expect(activate).toHaveAttribute('aria-disabled', 'true');
            }

            await expect(primary).toHaveAccessibleName('结束行动');
            const after = await read();
            const actor = after.core.players['0'];
            expect(after.core.phase).toBe('action');
            expect(after.core.currentPlayerId).toBe('0');
            expect(actor.normalAttackPlayed).toBe(true);
            expect(actor.activeAttackIds).toEqual([...before.activeAttackIds, ...selected]);
            expect(actor.selectedAttackIds).toEqual([]);
            expect(actor.mana).toBe(before.mana - (selected.length ? FATE_ATTACK_BY_ID.cardSurveil.manaCost : 0));
            expect(actor.usedAbilityIds.filter(id => id === usage)).toHaveLength(mode === 'unaffordable' ? 0 : 1);
            expect(isFateRidingChoice(after.sys.interaction.current)).toBe(false);
            expect(after.sys.resolution?.frames.some(frame => frame.kind === FATE_RIDING_FRAME_KIND)).not.toBe(true);
            if (mode === 'no-candidate') {
                await primary.click();
                await expect.poll(async () => (await read()).core.currentPlayerId).toBe('1');
            }
            await writeFile(join(run.stagingDir, '在线骑乘结果.json'), JSON.stringify({
                mode, sourceIdentity: await captureEvidenceSourceIdentity(page, 'fate-domination'),
                fixture: alreadyPaid ? '已打出骑乘、本人魔力为零的代表态' : '使用牌组内正式实例的行动阶段代表态',
                manaBefore: before.mana, manaAfter: actor.mana, selected, activeAttackIds: actor.activeAttackIds,
                phase: after.core.phase, currentPlayerId: after.core.currentPlayerId,
            }, null, 2), 'utf8');
            await assertNoFatalFrontendErrors([{ label: name, diagnostics }]);
        } finally {
            await releaseSourceSession(context);
        }
    });
}
