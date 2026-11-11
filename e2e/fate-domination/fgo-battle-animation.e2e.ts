import { expect, test, type Page, type Route } from '@playwright/test';
import { initContext } from '../helpers/common';
import { FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import { releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { fgoEvidenceSnapshot, writeFgoEvidence } from './fgoEvidence';

test.use({ viewport: { width: 1366, height: 768 }, video: 'on' });
test.beforeAll(() => {
  if (process.env.PW_RECORD_VIDEO !== 'true') throw new Error('动效证据必须设置 PW_RECORD_VIDEO=true，才能保留通过用例的录屏');
});
test.beforeEach(async ({ context, baseURL }) => { await startSourceSession(context, baseURL!); });
test.afterEach(async ({ context }) => { await releaseSourceSession(context); });

async function openBoard(page: Page) {
  page.on('console', message => {
    if (!/Fate /.test(message.text())) return;
    console.log('浏览器诊断:', message.text());
  });
  page.on('pageerror', error => console.log('浏览器错误:', error.stack));
  await page.goto('/play/fate-domination?players=3&playerID=0&seed=fgo-evidence', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.(), undefined, { timeout: 45000 });
  await expect(page.getByTestId('fate-domination-board')).toBeVisible();
}

async function waitForAssets(page: Page, noble = false, servants = ['servant-saber', 'servant-medusa']) {
  await expect.poll(() => page.evaluate(async ({ needNoble, ids }) => {
    const url = '/src/games/fate-domination/fgo-runtime/fgoPreload.ts';
    const assets = await import(/* @vite-ignore */ url);
    return Boolean(ids.every(id => assets.loadedFgoCharacter(id)) && (!needNoble || assets.loadedFgoNoble()));
  }, { needNoble: noble, ids: servants }), { timeout: 120000, intervals: [500] }).toBe(true);
}

async function waitForBoardArtwork(page: Page) {
  await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status', 'ready', { timeout: 45000 });
  await expect.poll(() => page.locator('.fd-runtime-avatar img').evaluateAll(images =>
    images.length > 0 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
  ), { timeout: 45000 }).toBe(true);
}

async function prepareBattle(page: Page) {
  await page.evaluate(async () => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness.state.get();
    const saber = state.core.players['0'];
    const nobleId = saber.skills.find((skill: any) => skill.id.startsWith('sc_saber_np:')).id;
    await harness.state.patch({ core: {
      phase: 'battle', currentPlayerId: '0', currentTurnIndex: 0,
      battleResolution: { frameId: 'fate-fgo-evidence', round: state.core.round, locationIds: ['miyama', 'shinto', 'recon'], resolvedLocationIds: [], step: 'locations' },
      resolvedLocations: [], resolvedResults: [], pendingChoice: { kind: null },
      battlefield: { miyama: { ...state.core.battlefield.miyama, playerIds: ['0', '1'], eventCards: [] } },
      players: {
        '0': { ...saber, locationId: 'miyama', isRevealed: true, activeSkills: [nobleId], activeAttackIds: [] },
        '1': { ...state.core.players['1'], servantId: 'servant-medusa', locationId: 'miyama', isRevealed: true, activeSkills: [], activeAttackIds: [] },
      },
    } });
  });
}

test('代表态真实地点结算播放胜者攻击和对手受击，结算不等待演出', async ({ page, context }, testInfo) => {
  test.setTimeout(240000);
  await initContext(context, { skipImageGate: false });
  await openBoard(page);
  await waitForAssets(page);
  await prepareBattle(page);
  await waitForBoardArtwork(page);
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('战斗前.png') });
  const before = await fgoEvidenceSnapshot(page);
  await action.click();
  const battle = page.getByTestId('fate-fgo-battle');
  await expect(battle).toBeVisible({ timeout: 15000 });
  const during = await fgoEvidenceSnapshot(page);
  await expect(battle.locator('canvas')).toHaveCount(1);
  await expect(page.getByTestId('fate-fgo-anchor-miyama').getByTestId('fate-fgo-battle')).toBeVisible();
  await expect(action).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('战斗过程.png') });
  await expect(battle).toBeHidden({ timeout: 15000 });
  await page.screenshot({ path: testInfo.outputPath('战斗后.png') });
  const after = await fgoEvidenceSnapshot(page);
  expect(after.authoritative.resolvedLocations).toContain('miyama');
  await writeFgoEvidence(page, testInfo, { chainId: 'saber-medusa', action: '点击牌桌主操作结算深山町',
    outcome: '胜者攻击与对手受击演出播放后退场，行动入口保持可用', before, after,
    assertions: [{ name: '演出出现', actual: during.visible.battleVisible, expected: true },
      { name: '演出退场', actual: after.visible.battleVisible, expected: false },
      { name: '行动仍可用', actual: during.visible.actionEnabled, expected: true },
      { name: '地点已结算', actual: after.authoritative.resolvedLocations.includes('miyama'), expected: true }],
    screenshots: [{ file: '战斗前.png', id: 'saber-medusa-before', change: 'interaction-mode' },
      { file: '战斗过程.png', id: 'saber-medusa-motion', change: 'animation-phase' },
      { file: '战斗后.png', id: 'saber-medusa-after', change: 'interaction-mode' }] });
});

test('素材下载尚未响应时，代表态地点结算仍能继续', async ({ page, context }) => {
  test.setTimeout(120000);
  await initContext(context, { skipImageGate: false });
  const pending: Route[] = [];
  await context.route('**/assets/fate-domination/fgo/v2/**', route => { pending.push(route); });
  await openBoard(page);
  await expect.poll(() => pending.length, { timeout: 15000 }).toBeGreaterThan(0);
  await prepareBattle(page);
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  await action.click();
  await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.resolvedLocations.includes('miyama'))).toBe(true);
  await expect(action).toBeEnabled();
  await expect(page.getByTestId('fate-fgo-battle')).toHaveCount(0);
  await Promise.all(pending.map(route => route.abort().catch(() => {})));
});

test('地图缩放后攻击演出跟随地点大小', async ({ page, context }) => {
  test.setTimeout(240000);
  await initContext(context, { skipImageGate: false });
  await openBoard(page);
  await waitForAssets(page);
  await prepareBattle(page);
  await waitForBoardArtwork(page);
  const anchor = page.getByTestId('fate-fgo-anchor-miyama');
  const initial = await anchor.boundingBox();
  const map = page.getByTestId('fate-pixi-map-canvas');
  const mapBox = await map.boundingBox();
  expect(initial).not.toBeNull();
  expect(mapBox).not.toBeNull();
  await page.mouse.move(mapBox!.x + mapBox!.width / 2, mapBox!.y + mapBox!.height / 2);
  await page.mouse.wheel(0, -450);
  await expect.poll(async () => (await anchor.boundingBox())?.width ?? 0).toBeGreaterThan(initial!.width * 1.05);
  await page.getByTestId('fate-domination-primary-action').click();
  const battle = anchor.getByTestId('fate-fgo-battle');
  await expect(battle).toBeVisible({ timeout: 15000 });
  const dimensions = await battle.evaluate(element => {
    const rendered = element.getBoundingClientRect();
    const region = element.parentElement!.getBoundingClientRect();
    return { renderedWidth: rendered.width, renderedHeight: rendered.height, regionWidth: region.width, regionHeight: region.height };
  });
  expect(dimensions.renderedWidth).toBeCloseTo(dimensions.regionWidth, 0);
  expect(dimensions.renderedHeight).toBeCloseTo(dimensions.regionHeight, 0);
  await expect(battle).toBeHidden({ timeout: 15000 });
});

for (const attacker of [
  { name: '库丘林', servantId: 'servant-cu-chulainn', chainId: 'cu-saber' },
  { name: '美杜莎', servantId: 'servant-medusa', chainId: 'medusa-saber' },
]) test(`代表态地点结算中${attacker.name}胜出时攻击 Saber`, async ({ page, context }, testInfo) => {
  test.setTimeout(240000);
  await initContext(context, { skipImageGate: false });
  await openBoard(page);
  await waitForAssets(page, false, ['servant-saber', attacker.servantId]);
  await prepareBattle(page);
  await page.evaluate(async servantId => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness.state.get();
    const saber = state.core.players['0'];
    const card = saber.deck.find((item: any) => item.definitionId === 'cardB1');
    await harness.state.patch({ core: { players: {
      '0': { ...saber, activeSkills: [], activeAttackIds: [] },
      '1': { ...state.core.players['1'], servantId, hand: [card], activeSkills: [], activeAttackIds: [card.id] },
    } } });
  }, attacker.servantId);
  await waitForBoardArtwork(page);
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  const before = await fgoEvidenceSnapshot(page);
  await action.click();
  const battle = page.getByTestId('fate-fgo-battle');
  await expect(battle).toBeVisible({ timeout: 15000 });
  const during = await fgoEvidenceSnapshot(page);
  await expect(battle.locator('canvas')).toHaveCount(1);
  await expect(page.getByTestId('fate-fgo-anchor-miyama').getByTestId('fate-fgo-battle')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__BG_TEST_HARNESS__.state.get().core.resolvedResults
    .find((result: any) => result.playerId === '1' && result.locationId === 'miyama')?.status)).toBe('representative-win');
  await page.screenshot({ path: testInfo.outputPath(`${attacker.name}攻击过程.png`) });
  await expect(action).toBeEnabled();
  await expect(battle).toBeHidden({ timeout: 15000 });
  await page.screenshot({ path: testInfo.outputPath(`${attacker.name}战斗后.png`) });
  const after = await fgoEvidenceSnapshot(page);
  await writeFgoEvidence(page, testInfo, { chainId: attacker.chainId, action: `点击牌桌主操作结算${attacker.name}胜出的地点`,
    outcome: `${attacker.name}攻击与对手受击演出播放后退场`, before, after,
    assertions: [{ name: '演出出现', actual: during.visible.battleVisible, expected: true },
      { name: '演出退场', actual: after.visible.battleVisible, expected: false },
      { name: '地点已结算', actual: after.authoritative.resolvedLocations.includes('miyama'), expected: true }],
    screenshots: [{ file: `${attacker.name}攻击过程.png`, id: `${attacker.chainId}-motion`, change: 'animation-phase' },
      { file: `${attacker.name}战斗后.png`, id: `${attacker.chainId}-after`, change: 'interaction-mode' }] });
});

test('代表态真实出牌确认释放誓约胜利之剑，宝具演出不拦截行动', async ({ page, context }, testInfo) => {
  test.setTimeout(240000);
  await initContext(context, { skipImageGate: false });
  await openBoard(page);
  await waitForAssets(page, true);
  const situation = FATE_SITUATIONS.find(item => !['sit7', 'sit8', 'sit9'].includes(item.id))!;
  const cardId = await page.evaluate(async situation => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    const state = harness.state.get();
    const player = state.core.players['0'];
    const card = player.deck.find((item: any) => item.definitionId === 'cardB1');
    await harness.state.patch({ core: {
      phase: 'action', round: 2, currentPlayerId: '0', currentTurnIndex: 0,
      situation, pendingChoice: { kind: null },
      battlefield: { miyama: { ...state.core.battlefield.miyama, playerIds: ['0', '1'], eventCards: [] } },
      players: { '0': { ...player, locationId: 'miyama', mana: 12, isRevealed: false,
        hand: [card], deck: player.deck.filter((item: any) => item.id !== card.id),
        selectedAttackIds: [], selectedFaceDownIds: [], faceDownAttackIds: [], activeAttackIds: [], activeSkills: [], normalAttackPlayed: false } },
    } });
    return card.id as string;
  }, situation);
  const skill = page.locator('[data-focus-card^="skill-0-sc_saber_np:"]').first();
  await expect(skill).toBeVisible();
  await skill.click();
  await page.locator(`[data-card-id=${JSON.stringify(cardId)}]`).click();
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  await waitForBoardArtwork(page);
  await page.screenshot({ path: testInfo.outputPath('宝具确认前.png') });
  const before = await fgoEvidenceSnapshot(page);
  await action.click();
  const noble = page.getByTestId('fate-fgo-noble');
  await expect(noble).toBeVisible({ timeout: 15000 });
  await expect(noble.locator('canvas')).toHaveCount(1);
  const presentation = await noble.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const canvas = element.querySelector('canvas')!;
    return { body: element.parentElement === document.body, width: bounds.width, height: bounds.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight, pointerEvents: getComputedStyle(element).pointerEvents,
      alpha: canvas.getContext('webgl2')?.getContextAttributes()?.alpha };
  });
  expect(presentation.body).toBe(true);
  expect(presentation.width / presentation.viewportWidth).toBeGreaterThan(0.95);
  expect(presentation.height / presentation.viewportHeight).toBeGreaterThan(0.95);
  expect(presentation.pointerEvents).toBe('none');
  expect(presentation.alpha).toBe(true);
  await expect(action).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as any).__FGO_SOURCE_SCENE__?.snapshot().time ?? 0), { timeout: 20000 }).toBeGreaterThan(2.5);
  await page.screenshot({ path: testInfo.outputPath('宝具释放过程.png') });
  const during = await fgoEvidenceSnapshot(page);
  await expect.poll(() => page.evaluate(() => (window as any).__FGO_SOURCE_SCENE__?.snapshot().time ?? 0), { timeout: 60000, intervals: [100] }).toBeGreaterThan(14);
  await page.screenshot({ path: testInfo.outputPath('宝具光束过程.png') });
  await expect(noble).toBeHidden({ timeout: 45000 });
  await page.screenshot({ path: testInfo.outputPath('宝具演出后.png') });
  const after = await fgoEvidenceSnapshot(page);
  await writeFgoEvidence(page, testInfo, { chainId: 'saber-noble', action: '选择宝具及攻击牌后点击牌桌主操作确认',
    outcome: '誓约胜利之剑演出播放后退场，行动入口保持可用', before, after,
    assertions: [{ name: '宝具出现', actual: during.visible.nobleVisible, expected: true },
      { name: '宝具退场', actual: after.visible.nobleVisible, expected: false },
      { name: '行动仍可用', actual: during.visible.actionEnabled, expected: true }],
    screenshots: [{ file: '宝具确认前.png', id: 'saber-noble-before', change: 'interaction-mode' },
      { file: '宝具释放过程.png', id: 'saber-noble-release', change: 'animation-phase' },
      { file: '宝具光束过程.png', id: 'saber-noble-beam', change: 'animation-phase' },
      { file: '宝具演出后.png', id: 'saber-noble-after', change: 'interaction-mode' }] });
});
