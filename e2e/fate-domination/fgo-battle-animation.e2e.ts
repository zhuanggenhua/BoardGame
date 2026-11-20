import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';
import { initContext } from '../helpers/common';
import { FATE_EVENTS, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID, FATE_SITUATIONS } from '../../src/games/fate-domination/data';
import type { FateDominationCore } from '../../src/games/fate-domination/domain';
import { fateAbilityUsageKey } from '../../src/games/fate-domination/domain/abilitySource';
import { createFateAttackDeck } from '../../src/games/fate-domination/domain/setup';
import { releaseSourceSession, startSourceSession } from '../framework/sourceIdentity';
import { fgoEvidenceSnapshot, writeFgoEvidence } from './fgoEvidence';
import { openFateRepresentativeBoard, type FateState } from './onlineRepresentativeBoard';
import { initFateAudioContext, trackFateAbilitySounds } from './fateAbilityAudio';

test.use({ viewport: { width: 1366, height: 768 }, video: 'on' });
test.beforeAll(() => {
  if (process.env.PW_RECORD_VIDEO !== 'true') throw new Error('动效证据必须设置 PW_RECORD_VIDEO=true，才能保留通过用例的录屏');
});
test.beforeEach(async ({ context, baseURL }) => { await startSourceSession(context, baseURL!); });
test.afterEach(async ({ context }) => { await releaseSourceSession(context); });

type SceneWindow = Window & { __FGO_SOURCE_SCENE__?: { snapshot: () => { time: number } } };

async function openBoard(page: Page, context: BrowserContext, prepare: (state: FateState) => void) {
  page.on('console', message => {
    if (!/Fate /.test(message.text())) return;
    console.log('浏览器诊断:', message.text());
  });
  page.on('pageerror', error => console.log('浏览器错误:', error.stack));
  return openFateRepresentativeBoard(page, context, prepare);
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

async function waitForNobleTime(page: Page, time: number) {
  await expect.poll(() => page.evaluate(() => (window as SceneWindow).__FGO_SOURCE_SCENE__?.snapshot().time ?? 0),
    { timeout: 60000, intervals: [100] }).toBeGreaterThan(time);
}

async function expectBattleAligned(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const anchor = document.querySelector('[data-testid="fate-fgo-anchor-miyama"]')?.getBoundingClientRect();
    const battle = document.querySelector('[data-testid="fate-fgo-battle"]')?.getBoundingClientRect();
    if (!anchor || !battle || !anchor.width || !battle.width) return Infinity;
    return Math.max(Math.abs(anchor.left - battle.left), Math.abs(anchor.top - battle.top),
      Math.abs(anchor.width - battle.width), Math.abs(anchor.height - battle.height));
  }), { intervals: [50] }).toBeLessThan(2);
}

function prepareSeatedPlayers(core: FateDominationCore, opponentId: string) {
  core.turnOrder = ['0', '1', '2'];
  core.currentPlayerId = '0';
  core.currentTurnIndex = 0;
  core.situation = FATE_SITUATIONS.find(item => item.id === 'sit1')!;
  const event = FATE_EVENTS.find(item => item.id === 'fuyuki_E3')!;
  core.miyamaEvent = event;
  core.currentEvents = { ...core.currentEvents, miyama: [event] };
  core.battlefield.miyama = { ...core.battlefield.miyama, playerIds: ['0', '1'], eventCards: [event] };
  core.battlefield.workshop = { ...core.battlefield.workshop, playerIds: ['2'] };
  core.pendingChoice = { kind: null };
  for (const [seat, masterId, servantId] of [['0', 'm_shirou_emiya', 'servant-saber'], ['1', 'm_shinji', opponentId], ['2', 'm_waver', 'servant-rider']]) {
    const player = core.players[seat];
    const master = FATE_MASTER_BY_ID[masterId];
    player.masterId = masterId;
    player.servantId = servantId;
    player.mana = master.initMana ?? 4;
    player.commandSpells = master.initialCommandSpells ?? 3;
    player.skills = [...(master.skills ?? []), ...FATE_SERVANT_BY_ID[servantId].skillCards!]
      .map((skill, index) => ({ ...skill, id: `${skill.id}:${seat}-${index}` }));
    player.locationId = seat === '2' ? 'workshop' : 'miyama';
    player.deploymentSlot = seat === '2' ? 0 : null;
    player.isRevealed = seat !== '2';
    player.hand = [];
    player.deck = createFateAttackDeck(seat, servantId);
    player.activeAttackIds = [];
    player.activeSkills = [];
  }
}

function prepareBattle({ core }: FateState, attacker = '0', opponentId = 'servant-medusa') {
  prepareSeatedPlayers(core, opponentId);
  core.phase = 'battle';
  core.battleResolution = { frameId: 'fate-fgo-evidence', round: core.round, locationIds: ['miyama', 'shinto', 'recon'], resolvedLocationIds: [], step: 'locations' };
  const player = core.players[attacker];
  const card = player.deck.find(item => item.definitionId === 'cardB1')!;
  player.hand = [card];
  player.deck = player.deck.filter(item => item.id !== card.id);
  player.activeAttackIds = [card.id];
}

test('代表态真实地点结算播放胜者攻击和对手受击，结算不等待演出', async ({ page, context }, testInfo) => {
  test.setTimeout(240000);
  await initContext(context, { skipImageGate: false });
  const { read } = await openBoard(page, context, prepareBattle);
  await waitForAssets(page);
  await waitForBoardArtwork(page);
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('战斗前.png') });
  const before = await fgoEvidenceSnapshot(page, read);
  await action.click();
  const battle = page.getByTestId('fate-fgo-battle');
  await expect(battle).toBeVisible({ timeout: 90000 });
  const during = await fgoEvidenceSnapshot(page, read);
  await expect(battle.locator('.fd-fgo-battle-canvas canvas')).toHaveCount(1);
  await expectBattleAligned(page);
  await expect(action).toBeEnabled();
  await expect(battle.locator('canvas[data-fgo-fx="hit-spark"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('战斗过程.png') });
  await expect(battle).toBeHidden({ timeout: 15000 });
  await page.screenshot({ path: testInfo.outputPath('战斗后.png') });
  const after = await fgoEvidenceSnapshot(page, read);
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
  const { read } = await openBoard(page, context, prepareBattle);
  await expect.poll(() => pending.length, { timeout: 15000 }).toBeGreaterThan(0);
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  await action.click();
  await expect.poll(async () => (await read()).core.resolvedLocations.includes('miyama')).toBe(true);
  await expect(action).toBeEnabled();
  await expect(page.getByTestId('fate-fgo-battle')).toHaveCount(0);
  await Promise.all(pending.map(route => route.abort().catch(() => {})));
});

test('地图缩放后攻击演出跟随地点大小', async ({ page, context }) => {
  test.setTimeout(240000);
  await initContext(context, { skipImageGate: false });
  await openBoard(page, context, prepareBattle);
  await waitForAssets(page);
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
  const battle = page.getByTestId('fate-fgo-battle');
  await expect(battle).toBeVisible({ timeout: 15000 });
  await expectBattleAligned(page);
  await expect(battle).toBeHidden({ timeout: 15000 });
});

for (const attacker of [
  { name: '库丘林', servantId: 'servant-cu-chulainn', chainId: 'cu-saber' },
  { name: '美杜莎', servantId: 'servant-medusa', chainId: 'medusa-saber' },
]) test(`代表态地点结算中${attacker.name}胜出时攻击 Saber`, async ({ page, context }, testInfo) => {
  test.setTimeout(240000);
  await initContext(context, { skipImageGate: false });
  const { read } = await openBoard(page, context, state => prepareBattle(state, '1', attacker.servantId));
  await waitForAssets(page, false, ['servant-saber', attacker.servantId]);
  await waitForBoardArtwork(page);
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  const before = await fgoEvidenceSnapshot(page, read);
  await action.click();
  const battle = page.getByTestId('fate-fgo-battle');
  await expect(battle).toBeVisible({ timeout: 15000 });
  const during = await fgoEvidenceSnapshot(page, read);
  await expect(battle.locator('.fd-fgo-battle-canvas canvas')).toHaveCount(1);
  await expectBattleAligned(page);
  await expect.poll(async () => (await read()).core.resolvedResults
    .find(result => result.playerId === '1' && result.locationId === 'miyama')?.status).toBe('representative-win');
  await expect(battle.locator('canvas[data-fgo-fx="hit-spark"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`${attacker.name}攻击过程.png`) });
  await expect(action).toBeEnabled();
  await expect(battle).toBeHidden({ timeout: 15000 });
  await page.screenshot({ path: testInfo.outputPath(`${attacker.name}战斗后.png`) });
  const after = await fgoEvidenceSnapshot(page, read);
  await writeFgoEvidence(page, testInfo, { chainId: attacker.chainId, action: `点击牌桌主操作结算${attacker.name}胜出的地点`,
    outcome: `${attacker.name}攻击与对手受击演出播放后退场`, before, after,
    assertions: [{ name: '演出出现', actual: during.visible.battleVisible, expected: true },
      { name: '演出退场', actual: after.visible.battleVisible, expected: false },
      { name: '地点已结算', actual: after.authoritative.resolvedLocations.includes('miyama'), expected: true }],
    screenshots: [{ file: `${attacker.name}攻击过程.png`, id: `${attacker.chainId}-motion`, change: 'animation-phase' },
      { file: `${attacker.name}战斗后.png`, id: `${attacker.chainId}-after`, change: 'interaction-mode' }] });
});

for (const skip of [false, true]) test(skip ? '代表态可跳过宝具并继续行动' : '代表态真实出牌确认释放誓约胜利之剑，宝具演出不拦截行动', async ({ page, context }, testInfo) => {
  test.setTimeout(240000);
  if (!skip) await page.setViewportSize({ width: 1280, height: 800 });
  await initContext(context, { skipImageGate: false });
  await initFateAudioContext(context);
  const { read, connectPeer } = await openBoard(page, context, ({ core }) => {
    prepareSeatedPlayers(core, 'servant-medusa');
    core.phase = 'action';
    core.round = skip ? 11 : 9;
    core.turnOrder = ['1', '2', '0'];
    core.currentTurnIndex = 2;
    core.situation = FATE_SITUATIONS.find(item => item.id === (skip ? 'sit13' : 'sit11'))!;
    const saber = core.players['0'];
    const card = saber.deck.find(item => item.definitionId === 'cardB1')!;
    saber.hand = [card];
    saber.deck = saber.deck.filter(item => item.id !== card.id);
    saber.isRevealed = false;
    saber.mana = 12;
    const medusa = core.players['1'];
    const attacks = medusa.deck.filter(item => item.definitionId === 'cardB1' || item.definitionId === 'cardB2');
    medusa.hand = attacks;
    medusa.deck = medusa.deck.filter(item => !attacks.includes(item));
    medusa.activeAttackIds = attacks.map(item => item.id);
    medusa.normalAttackPlayed = true;
    medusa.hasPassedAction = true;
    core.players['2'].hasPassedAction = true;
    if (skip) {
      medusa.victoryPoints = 27;
      core.players['2'].eliminated = true;
      core.players['2'].locationId = null;
      core.players['2'].deploymentSlot = null;
      core.battlefield.workshop.playerIds = [];
    }
  });
  await waitForAssets(page, true);
  const beamCue = 'Divine Magic Hallowed Beam 001.ogg';
  const playedSounds = await trackFateAbilitySounds(page, [beamCue]);
  const initial = (await read()).core;
  const cardId = initial.players['0'].hand[0].id;
  const nobleId = initial.players['0'].skills.find(item => item.id.startsWith('sc_saber_np:'))!.id;
  const skill = page.locator(`[data-focus-card=${JSON.stringify(`skill-0-${nobleId}`)}]`);
  await expect(skill).toBeVisible();
  await skill.click();
  await page.locator(`[data-card-id=${JSON.stringify(cardId)}]`).click();
  const action = page.getByTestId('fate-domination-primary-action');
  await expect(action).toBeEnabled();
  await waitForBoardArtwork(page);
  await page.screenshot({ path: testInfo.outputPath('宝具确认前.png') });
  const before = await fgoEvidenceSnapshot(page, read);
  await action.click();
  const noble = page.getByTestId('fate-fgo-noble');
  await expect.poll(async () => (await read()).core.players['0'].activeSkills).toContain(nobleId);
  await expect(noble).toHaveCount(0);
  await expect(action).toHaveAccessibleName(/结束行动|End action/i);
  await action.click();
  await expect.poll(async () => (await read()).core.phase).toBe('battle');
  const battlePeerIds = skip ? ['1'] : ['1', '2'];
  const peers = battlePeerIds.map(connectPeer);
  try {
    for (const [index, playerID] of battlePeerIds.entries()) {
      const client = peers[index];
      await expect.poll(() => client.isConnected && Boolean(client.latestState)).toBe(true);
      await expect.poll(() => (client.latestState as FateState | undefined)?.core.currentPlayerId).toBe(playerID);
      expect(client.sendCommand('ADVANCE_PHASE', {})).toBe(true);
    }
    const activeNoble = skill.and(page.locator('[data-card-zone="active-skill"]'));
    await activeNoble.click();
    await expect.poll(async () => (await read()).core.players['0'].usedAbilityIds).toContain(fateAbilityUsageKey(nobleId, 'battle'));
    await expect(activeNoble).toBeDisabled();
    await action.click();
    await expect.poll(async () => (await read()).core.battleResolution?.step).toBe('locations');
  } finally {
    peers.forEach(client => client.disconnect());
  }
  await expect(action).toBeEnabled();
  await action.click();
  await expect(noble).toBeVisible({ timeout: 15000 });
  await expect(noble.locator('canvas')).toHaveCount(1);
  if (skip) {
    await waitForNobleTime(page, 2.5);
    expect(await playedSounds()).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('宝具跳过入口.png') });
    await noble.getByRole('button', { name: /^(跳过|Skip)$/ }).click();
    await expect(noble).toBeHidden();
    await expect(action).toBeEnabled();
    await expect(action).toHaveAccessibleName(/结算新都|Resolve Shinto/i);
    await action.click();
    await expect(action).toHaveAccessibleName(/结算侦察|Resolve Recon/i);
    await action.click();
    await expect.poll(async () => (await read()).core.gameResult?.winner).toBe('0');
    const final = (await read()).core.gameResult!;
    expect(final.scores?.['0']).toBeLessThan(final.scores?.['1'] ?? 0);
    expect(final.victoryCondition).toBe('excalibur');
    const result = page.getByRole('region', { name: '圣杯战争结果' });
    await expect(result.getByText('「誓约胜利之剑」生效，赢得第 11 天的战斗即可获胜。', { exact: true })).toBeVisible();
    expect(await playedSounds()).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('第十一天宝具获胜终局.png') });
    return;
  }
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
  await waitForNobleTime(page, 2.5);
  expect(await playedSounds()).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('宝具释放过程.png') });
  const during = await fgoEvidenceSnapshot(page, read);
  await waitForNobleTime(page, 14);
  await expect.poll(playedSounds).toEqual([beamCue]);
  await page.screenshot({ path: testInfo.outputPath('宝具光束过程.png') });
  await expect(noble).toBeHidden({ timeout: 45000 });
  const battle = page.getByTestId('fate-fgo-battle');
  await expect(battle).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('宝具退场后接续地点战斗.png') });
  await expect(battle).toBeHidden({ timeout: 15000 });
  expect(await playedSounds()).toEqual([beamCue]);
  await page.screenshot({ path: testInfo.outputPath('宝具演出后.png') });
  const after = await fgoEvidenceSnapshot(page, read);
  await writeFgoEvidence(page, testInfo, { chainId: 'saber-noble', action: '确认攻击，战斗阶段发动誓约胜利之剑并结算深山町',
    outcome: '誓约胜利之剑演出播放后退场，行动入口保持可用', before, after,
    assertions: [{ name: '宝具出现', actual: during.visible.nobleVisible, expected: true },
      { name: '宝具退场', actual: after.visible.nobleVisible, expected: false },
      { name: '地点演出退场', actual: after.visible.battleVisible, expected: false },
      { name: '行动仍可用', actual: during.visible.actionEnabled, expected: true }],
    screenshots: [{ file: '宝具确认前.png', id: 'saber-noble-before', change: 'interaction-mode' },
      { file: '宝具释放过程.png', id: 'saber-noble-release', change: 'animation-phase' },
      { file: '宝具光束过程.png', id: 'saber-noble-beam', change: 'animation-phase' },
      { file: '宝具退场后接续地点战斗.png', id: 'saber-noble-handoff', change: 'animation-phase' },
      { file: '宝具演出后.png', id: 'saber-noble-after', change: 'interaction-mode' }] });
});
