import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { attachPageDiagnostics, assertNoFatalFrontendErrors, initContext } from '../helpers/common';
import { getMatchState } from '../helpers/state-injection';
import { createEvidenceScreenshotRun, promoteEvidenceScreenshotRun, type EvidenceScreenshotIndexEntry } from '../framework/evidenceScreenshots';
import { captureEvidenceSourceIdentity, startSourceSession } from '../framework/sourceIdentity';
import type { MatchState } from '../../src/engine/types';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';
import { buildFateAiLegalActions } from '../../src/games/fate-domination/ai';
import { fateAttackManaCost } from '../../src/games/fate-domination/domain/attackSelection';
import { validate } from '../../src/games/fate-domination/domain/commands';

type State = MatchState<FateDominationCore>;
type Pair = { cardIds: string[]; faceDownIds: string[] };

const chainId = 'fate-natural-online-field-effects';
const water = 'sc_gilles_np:';
const territory = 'sc_gilles_2:';
const waterText = '吉尔·德·雷《螺湮城教本》：打出时：将此牌放置于你所在的战场或关闭此牌。古神的呼唤—此牌失去宝具属性。当你位于被放置的此牌所在的战场时，将此牌加入攻击。当你于此战场战败、该战场关闭或其不（再）为战场时，关闭此牌。出处：中文 CHM 吉尔·德·雷卡图。';
const territoryText = '吉尔·德·雷《阵地建造》：X为16-（当前回合数×2）。残留：当你部署于魔术工房时，获得1点魔力和2点战果。出处：中文 CHM 吉尔·德·雷卡图。';
const captureStates = {
    'unusable-inspection': '不可打出的技能置灰且仍可放大',
    'field-choice': '打出海魔后选择放置或关闭',
    'field-placed': '海魔在地图上成为可检视对象',
    'field-inspection': '检视战场上的海魔原卡',
    'field-retained': '换日后海魔仍留在原战场',
    'field-closed': '战败后战场牌退场',
    'residual-active': '阵地建造在攻击区标记残留',
    'residual-workshop': '阵地建造跨回合保留并触发部署收益',
};
type Assertion = { name: string; actual: unknown; expected: unknown };
const check = (name: string, actual: unknown, expected: unknown = true): Assertion => ({ name, actual, expected });

test.use({ viewport: { width: 1600, height: 900 }, actionTimeout: 15000, trace: 'retain-on-failure' });

test('由正式在线房选择吉尔，实付打出场地牌和残留攻击', async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(540000);
    await initContext(context);
    const release = await startSourceSession(context, baseURL!);
    const diagnostics = attachPageDiagnostics(page);
    const run = await createEvidenceScreenshotRun(testInfo, { requireChineseName: true });
    const browserContextId = randomUUID();
    const board = page.getByTestId('fate-domination-board');
    const primary = page.getByTestId('fate-domination-primary-action');
    const media: EvidenceScreenshotIndexEntry[] = [];
    const steps: object[] = [];
    const uiStates: object[] = [];
    const victory = page.getByRole('region', { name: '圣杯战争结果' });
    let matchId = '';
    const snapshot = async ({ core, sys }: State) => {
        const actor = core.players['0'];
        return { authoritative: { matchId, phase: core.phase, round: core.round, gameOver: Boolean(sys.gameover), activeSkills: actor.activeSkills, mana: actor.mana,
            battlefieldAttacks: core.battlefieldAttacks ?? [], locationId: actor.locationId, victoryPoints: actor.victoryPoints },
            visible: { url: page.url(), gameOver: await victory.isVisible(), fieldCards: await board.locator('[data-fate-field-attack]').count(),
                inspection: await page.getByTestId('fate-runtime-inspection').isVisible(), residual: await board.locator('.fd-card-residual').count() } };
    };
    let previous: Awaited<ReturnType<typeof snapshot>> | undefined;
    const mark = async (id: string, action: string, state: State, assertions: Assertion[]) => {
        assertions.forEach(({ name, actual, expected }) => expect(actual, name).toEqual(expected));
        const after = await snapshot(state);
        steps.push({ id, action, before: previous ?? after, after, assertions });
        previous = after;
    };
    async function capture(id: keyof typeof captureStates, action: string, state: State, assertions: Assertion[], uiChange: NonNullable<EvidenceScreenshotIndexEntry['uiChange']>, effectReference?: string) {
        const name = captureStates[id];
        await mark(id, action, state, assertions);
        await page.mouse.move(12, 12);
        const file = `${String(media.length + 1).padStart(2, '0')}-${name}.png`;
        const destination = path.join(run.stagingDir, file);
        await page.screenshot({ path: destination, animations: 'disabled' });
        const sha256 = createHash('sha256').update(await readFile(destination)).digest('hex');
        uiStates.push({ id, stepId: id, change: uiChange, viewport: 'desktop', viewportSize: '1600x900', sha256 });
        media.push({ path: path.relative(process.cwd(), path.join(run.stableDir, file)).replace(/\\/g, '/'), chainId, chainStep: media.length + 1,
            stage: '独特界面态', role: 'main-flow', transition: action, viewport: 'desktop', viewportSize: '1600x900', description: `图片表达：${action}`,
            uiStateId: id, uiChange, uiChangeReason: name, behaviorStepId: id, requirements: [name], effectReference });
    }
    const contract = JSON.stringify({ version: 1, gameId: 'fate-domination', evidenceCategory: 'golden', reviewFile: 'visual-review.json', reviewerKind: 'primary-agent',
        requiredStates: Object.entries(captureStates).map(([uiStateId, reason]) => ({ chainId, uiStateId, reason, viewport: 'desktop' })) }, null, 2);
    await writeFile(path.join(run.stagingDir, 'capture-contract.json'), contract);

    try {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-game-id="fate-domination"] .platform-game-open').first().click({ timeout: 45000 });
        await page.getByTestId('game-details-open-create-room').first().click();
        const room = page.getByTestId('create-room-modal').last();
        await room.getByRole('button', { name: '3人', exact: true }).click();
        await room.getByRole('button', { name: /^加入 AI/ }).click();
        await room.getByTestId('create-room-confirm-button').click();
        await page.waitForURL(/\/play\/fate-domination\/match\/[^/?]+\?playerID=0/, { timeout: 45000 });
        matchId = decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)!);
        const read = async () => await getMatchState(matchId, page) as State;
        await page.getByTestId('fate-setup-master-m_waver').click({ timeout: 45000 });
        await page.getByRole('button', { name: '从者', exact: true }).click();
        await page.getByTestId('fate-setup-servant-servant-gilles').click();
        await primary.click();
        await expect.poll(async () => (await read()).core.players['0'].servantId).toBe('servant-gilles');
        const afterSetup = await read();
        await mark('setup', '创建在线房并确认韦伯与吉尔', afterSetup,
            [check('自选身份', [afterSetup.core.players['0'].masterId, afterSetup.core.players['0'].servantId], ['m_waver', 'servant-gilles'])]);
        let placedRound = 0;
        let residualRound = 0;
        let fieldSurvived = false;
        let fieldRemoved = false;
        let residualPaid = false;
        let inspectedUnusable = false;
        let inspectedField = false;
        const placement = board.locator('[data-fate-field-attack]');
        const residual = board.locator('[data-card-zone="active-skill"] .fd-card-residual');
        const hasWater = (state: State) => state.core.battlefieldAttacks?.some(card => card.playerId === '0' && card.skillId.startsWith(water)) ?? false;
        for (let turn = 0; turn < 175; turn++) {
            await expect.poll(async () => {
                const { core, sys } = await read();
                return Boolean(sys.gameover || (sys.interaction.current?.playerId ?? core.currentPlayerId) === '0');
            }, { timeout: 45000 }).toBe(true);
            const state = await read();
            const { core, sys } = state;
            const actor = core.players['0'];
            if (sys.gameover) break;
            if (core.round > placedRound && placedRound && hasWater(state) && !fieldSurvived) {
                await expect(placement).toBeVisible();
                const fieldLocation = core.battlefieldAttacks!.find(card => card.playerId === '0' && card.skillId.startsWith(water))!.locationId;
                const empty = core.battlefield[fieldLocation].playerIds.length === 0;
                const slot = await placement.getAttribute('data-fate-field-slot');
                await capture('field-retained', '换日后角色归位，海魔在原战场优先使用空点位', state, [check('已经换日', core.round > placedRound), check('同一场地仍有海魔', hasWater(state)), check('没有棋子时使用空点位', !empty || slot !== null)], 'layout');
                fieldSurvived = true;
            }
            if (placedRound && !hasWater(state) && !fieldRemoved) {
                await expect(placement).toHaveCount(0);
                await capture('field-closed', '战斗结算后海魔退场，战场不再显示该牌', state, [check('海魔已离开战场', hasWater(state), false), check('地图没有海魔命中区域', await placement.count(), 0)], 'layout');
                fieldRemoved = true;
            }
            if (sys.interaction.current) {
                const choice = page.getByTestId('fate-field-attack-choice');
                if (sys.interaction.current.id.startsWith('fate:field-attack:')) {
                    await expect(choice).toBeVisible();
                    if (!placedRound) await capture('field-choice', '打出螺湮城教本后可以在当前战场放置，或关闭此牌', state, [check('实际有两个选项', await choice.getByRole('button').count(), 2)], 'interaction-mode', waterText);
                    await choice.getByRole('button', { name: /^放置到/ }).click();
                    await expect.poll(async () => hasWater(await read())).toBe(true);
                    await expect(placement).toBeVisible();
                    await expect.poll(() => placement.evaluate(node => {
                        const { x, y, width, height } = node.getBoundingClientRect();
                        return node.contains(document.elementFromPoint(x + width / 2, y + height / 2));
                    }), { message: '场地牌图面不能被战场事件或手牌挡住' }).toBe(true);
                    const placed = await read();
                    if (!placedRound) await capture('field-placed', '海魔离开攻击区，进入战场并显示所属席位', placed, [check('地图已登记海魔', hasWater(placed)), check('未在攻击区重复', placed.core.players['0'].activeSkills.some(id => id.startsWith(water)), false)], 'layout');
                    placedRound = core.round;
                    if (!inspectedField) {
                        await placement.click();
                        const preview = page.getByTestId('fate-inspection-card-face');
                        await expect(preview.locator('img')).toBeVisible();
                        await expect.poll(() => preview.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
                        await capture('field-inspection', '点击战场上的海魔即可检视完整卡面', await read(), [check('海魔原图已显示', await preview.locator('img').isVisible())], 'panel');
                        await page.keyboard.press('Escape');
                        inspectedField = true;
                    }
                } else {
                    const dialog = page.getByRole('dialog', { name: '战后恢复令咒' });
                    await dialog.getByRole('button', { name: '不恢复', exact: true }).click();
                    await dialog.getByRole('button', { name: '确认选择', exact: true }).click();
                }
                continue;
            }
            if (core.phase === 'outpost' && !actor.locationId) {
                const field = core.battlefieldAttacks?.find(card => card.playerId === '0');
                const destination = residualRound && !residualPaid ? 'workshop' : field?.locationId ?? 'miyama';
                const targets = board.locator(`button[data-fate-destination="${destination}"]:enabled`);
                const target = await targets.count() ? (fieldSurvived && field && destination === field.locationId ? targets.last() : targets.first()) : board.locator('button[data-fate-destination]:enabled').first();
                const location = await target.getAttribute('data-fate-destination');
                if (!inspectedUnusable) {
                    const unavailable = board.locator('[data-card-zone="skill"][data-focus-card*="sc_gilles_2:"]');
                    await expect(unavailable).toHaveAttribute('aria-disabled', 'true');
                    await expect(unavailable.locator('.fd-runtime-card-art')).toHaveCSS('filter', 'none');
                    await unavailable.hover();
                    await page.getByRole('button', { name: '放大阵地建造', exact: true }).click();
                    const preview = page.getByTestId('fate-inspection-card-face');
                    await expect(preview.locator('img')).toBeVisible();
                    await expect.poll(() => preview.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
                    await expect(preview.locator('img')).toHaveCSS('filter', 'none');
                    await capture('unusable-inspection', '前哨阶段可以检视阵地建造', state, [check('卡面仍为彩色', await preview.locator('img').evaluate(node => getComputedStyle(node).filter), 'none')], 'panel', territoryText);
                    await page.keyboard.press('Escape');
                    inspectedUnusable = true;
                }
                await target.click();
                await expect.poll(async () => (await read()).core.players['0'].locationId).toBe(location);
                if (location === 'workshop' && residualRound && !residualPaid) {
                    const paid = await read();
                    expect(paid.core.players['0'].victoryPoints - actor.victoryPoints).toBe(2);
                    await expect(residual).toBeVisible();
                    await capture('residual-workshop', '次回合部署魔术工房，阵地建造仍在攻击区并立即增加战果', paid, [check('部署立即增加两点战果', paid.core.players['0'].victoryPoints - actor.victoryPoints, 2), check('攻击区仍有残留', await residual.isVisible())], 'layout');
                    residualPaid = true;
                }
                await primary.click();
                continue;
            }
            if (core.phase === 'action' && !actor.normalAttackPlayed) {
                const available = buildFateAiLegalActions({ playerId: '0', state }).flatMap(action => action.commands)
                    .filter(command => command.type === 'CONFIRM_ATTACK').map(command => command.payload as Pair);
                const sea = available.find(pair => pair.cardIds.some(id => id.startsWith(water)));
                const structure = available.find(pair => pair.cardIds.some(id => id.startsWith(territory)));
                const wanted = !fieldSurvived && !hasWater(state) && sea ? sea : !residualRound && structure ? structure : undefined;
                if (!wanted && !hasWater(state) && actor.commandSpells && actor.mana < 8 && (actor.locationId === 'shinto' || actor.locationId === 'miyama')) {
                    await page.getByRole('button', { name: '使用令咒', exact: true }).click();
                    await page.getByRole('button', { name: /恢复魔力/ }).click();
                    await page.getByRole('button', { name: /确认使用/ }).click();
                    await expect.poll(async () => (await read()).core.players['0'].commandSpells).toBe(actor.commandSpells - 1);
                    continue;
                }
                const handPairs = available.filter(pair => pair.cardIds.every(id => actor.hand.some(card => card.id === id)));
                const pair = wanted ?? (fieldSurvived && hasWater(state) ? handPairs.find(pair => pair.faceDownIds.length === 1) : undefined) ?? handPairs[0] ?? available[0];
                if (pair) {
                    for (const id of pair.cardIds) {
                        const mode = page.getByRole('button', { name: '暗置选牌', exact: true });
                        if ((await mode.getAttribute('aria-pressed') === 'true') !== pair.faceDownIds.includes(id)) await mode.click();
                        const card = board.locator(`[data-card-zone="skill"][data-focus-card$="-${id}"], [data-card-zone="hand"][data-card-id="${id}"]`);
                        await card.click({ position: { x: 12, y: 70 } });
                    }
                    await expect(primary).toHaveText('确认攻击');
                    const cost = pair.cardIds.reduce((sum, id) => sum + (fateAttackManaCost(actor, id, pair.faceDownIds.includes(id), core.round) ?? 0), 0);
                    await primary.click();
                    await expect.poll(async () => (await read()).core.players['0'].normalAttackPlayed).toBe(true);
                    expect((await read()).core.players['0'].mana).toBe(actor.mana - cost);
                    if (!residualRound && pair.cardIds.some(id => id.startsWith(territory))) {
                        await expect(residual).toBeVisible();
                        residualRound = core.round;
                        const confirmed = await read();
                        await capture('residual-active', '阵地建造打出后停在攻击区，并标记为残留', confirmed, [check('权威实付符合动态费用', confirmed.core.players['0'].mana, actor.mana - cost), check('残留标记可见', await residual.isVisible())], 'layout');
                    }
                    continue;
                }
            }
            if (core.phase === 'action' && core.round === placedRound && !fieldSurvived && hasWater(state)
                && validate(state, { type: 'USE_COMMAND_SPELL', playerId: '0', payload: { effect: 'move', targetLocationId: 'recon' } }).valid) {
                await page.getByRole('button', { name: '使用令咒', exact: true }).click();
                await page.getByRole('button', { name: /^令咒移动/ }).click();
                await page.getByTestId('fate-domination-location-recon').click();
                await expect.poll(async () => (await read()).core.players['0'].locationId).toBe('recon');
                continue;
            }
            await primary.click();
        }
        expect(inspectedField).toBe(true);
        expect(fieldSurvived, '需要自然见到海魔跨回合保留').toBe(true);
        expect(fieldRemoved, '需要自然见到海魔因结算退场').toBe(true);
        expect(residualPaid, '需要自然见到阵地建造跨回合触发').toBe(true);
        await expect(victory).toBeVisible();
        const last = await read();
        await mark('terminal', '在同一线上房间推进至正式终局', last, [check('terminal-gameover', Boolean(last.sys.gameover) && await victory.isVisible())]);
        await assertNoFatalFrontendErrors([{ label: 'Fate 在线场地效果', diagnostics }]);
        const identity = await captureEvidenceSourceIdentity(page, 'fate-domination');
        await writeFile(path.join(run.stagingDir, 'behavior-trace.json'), JSON.stringify({ gameId: 'fate-domination', evidenceCategory: 'golden', chainId, sourceRun: run.runId, ...identity,
            browserContextId, matchId, status: 'PASS', visualStatus: 'pending', fixtureBoundary: { kind: 'natural-flow', injections: [] },
            outcome: '实际完成海魔的放置、跨回合保留和战败退场，触发阵地建造跨回合的工房收益，并推进同一房间到终局。',
            captureContract: { sha256: createHash('sha256').update(contract).digest('hex') }, steps, uiStates, terminalStepId: 'terminal' }, null, 2));
        await promoteEvidenceScreenshotRun(run, { version: 2, gameId: 'fate-domination', evidenceCategory: 'golden', capturePolicy: 'distinct-ui-state',
            media: media.map(shot => ({ ...shot, sourceRevision: identity.sourceRevision })) });
        console.log('[Fate field effects]', run.stableDir);
    } finally {
        await testInfo.attach('场地与残留步骤', { body: JSON.stringify(steps, null, 2), contentType: 'application/json' });
        await release();
    }
});
