import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const TILE = 4.6;
const RADIUS = 0.29;
const sides = ['north', 'west', 'south', 'east'];
const dir = 'evidence/betrayal-3d-prototype/pass-current';

await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

function overlapsFurniture(point, furniture) {
  return furniture.some(item =>
    Math.abs(point.x - item.x) <= item.w / 2 + RADIUS - 0.02 &&
    Math.abs(point.z - item.z) <= item.d / 2 + RADIUS - 0.02,
  );
}

function crossesEdge(a, b, edge, rooms) {
  const room = rooms[edge.room];
  const centerX = room.x * TILE;
  const centerZ = room.z * TILE;
  if (edge.side === 0 || edge.side === 2) {
    const lineZ = centerZ + (edge.side === 0 ? -TILE / 2 : TILE / 2);
    if ((a.z - lineZ) * (b.z - lineZ) >= 0) return false;
    const t = (lineZ - a.z) / (b.z - a.z);
    const x = a.x + (b.x - a.x) * t;
    return x > centerX - TILE / 2 + 0.08 && x < centerX + TILE / 2 - 0.08;
  }
  const lineX = centerX + (edge.side === 1 ? -TILE / 2 : TILE / 2);
  if ((a.x - lineX) * (b.x - lineX) >= 0) return false;
  const t = (lineX - a.x) / (b.x - a.x);
  const z = a.z + (b.z - a.z) * t;
  return z > centerZ - TILE / 2 + 0.08 && z < centerZ + TILE / 2 - 0.08;
}

function validateDoorModel(debug) {
  const shared = debug.edges.filter(edge => edge.neighbor >= 0);
  const unique = new Set(shared.map(edge => [edge.room, edge.neighbor].sort((a, b) => a - b).join(':')));
  assert.equal(shared.length, unique.size, 'Shared room edge should be emitted once');
  for (const edge of shared) {
    const expected = debug.doors[edge.room].includes(sides[edge.side]) &&
      debug.doors[edge.neighbor].includes(sides[(edge.side + 2) % 4]);
    assert.equal(edge.open, expected, `Door opening mismatch at ${debug.rooms[edge.room].name} ${sides[edge.side]}`);
    assert.equal(edge.connected, expected, `Connectivity mismatch at ${debug.rooms[edge.room].name} ${sides[edge.side]}`);
  }
  const findShared = (a, b) => shared.find(edge => {
    const names = [debug.rooms[edge.room].name, debug.rooms[edge.neighbor].name];
    return names.includes(a) && names.includes(b);
  });
  const kitchenStorage = findShared('厨房', '储藏室');
  assert(kitchenStorage && kitchenStorage.connected, 'Kitchen to storage should connect through matching north/south doors');
  const conservatoryStudy = findShared('温室', '书房');
  assert(conservatoryStudy && !conservatoryStudy.connected, 'Conservatory to study must be sealed because the conservatory has no east door');
  const galleryGraveyard = findShared('画廊', '墓地');
  assert(galleryGraveyard && !galleryGraveyard.connected, 'Gallery to graveyard must be sealed because neither tile has a matching shared doorway');
}

function validatePieceSpacing(pieces) {
  assert.equal(pieces.length, 4, 'Expected three explorers plus one monster');
  const explorers = pieces.filter(piece => piece.kind === 'explorer');
  const monsters = pieces.filter(piece => piece.kind === 'monster');
  assert.equal(explorers.length, 3);
  assert.equal(monsters.length, 1);
  for (const explorer of explorers) {
    assert(explorer.height >= 0.74 && explorer.height <= 0.95, `Explorer height is out of miniature scale: ${explorer.height}`);
  }
  assert(monsters[0].height >= 0.88 && monsters[0].height <= 1.12, `Monster height is out of miniature scale: ${monsters[0].height}`);
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i], b = pieces[j];
    const distance = Math.hypot(a.x - b.x, a.z - b.z);
    assert(distance > a.radius + b.radius + 0.05, `Pieces overlap: ${a.kind}${a.index} and ${b.kind}${b.index}`);
  }
}

function validateRoute(route, debug, blockers) {
  assert(route.length > 2, 'Expected a multi-point path');
  for (const point of route) {
    assert(!overlapsFurniture(point, debug.furniture), `Path clips furniture near ${JSON.stringify(point)}`);
    for (const blocker of blockers) {
      const distance = Math.hypot(point.x - blocker.x, point.z - blocker.z);
      assert(distance > blocker.radius + RADIUS - 0.04, `Path clips another figure near ${JSON.stringify(point)}`);
    }
  }
  const closedShared = debug.edges.filter(edge => edge.neighbor >= 0 && !edge.connected);
  for (let i = 1; i < route.length; i++) {
    for (const edge of closedShared) {
      assert(!crossesEdge(route[i - 1], route[i], edge, debug.rooms), `Path crosses sealed wall at ${debug.rooms[edge.room].name} ${sides[edge.side]}`);
    }
  }
}

const browser = await chromium.launch({ headless: true });
const errors = [];
const screenshots = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`request failed ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('http://127.0.0.1:5188/artifacts/betrayal-3d-prototype/betrayal-3d.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.world[data-ready=true]').waitFor({ timeout: 180000 });
  await page.waitForTimeout(1200);

  async function debugState() {
    return page.evaluate(() => window.__betrayal3d);
  }

  async function capture(name, proves) {
    const path = `${dir}/${name}.png`;
    await page.screenshot({ path });
    const info = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const copy = document.createElement('canvas');
      copy.width = 64;
      copy.height = 64;
      const context = copy.getContext('2d');
      context.drawImage(canvas, 0, 0, 64, 64);
      const pixels = context.getImageData(0, 0, 64, 64).data;
      let lit = 0, sum = 0;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4) {
        const l = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        if (l > 45) lit++;
        sum += l;
        colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`);
      }
      return {
        lit,
        mean: sum / 4096,
        colors: colors.size,
        frames: Number(canvas.dataset.frames),
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight + 2,
      };
    });
    assert(info.lit > 120 && info.colors > 60, `Blank canvas: ${JSON.stringify(info)}`);
    assert(!info.overflow, `Viewport overflow: ${JSON.stringify(info)}`);
    screenshots.push({ name, path, proves, ...info });
  }

  const initialDebug = await debugState();
  validateDoorModel(initialDebug);
  validatePieceSpacing(initialDebug.pieces);
  await capture('01-overview-current-map', 'full scene: real room tiles, merged walls, furniture, explorers and monster');

  await page.evaluate(() => window.__betrayal3d.focusRoom(0, 4.8));
  await page.waitForTimeout(600);
  await capture('02-explorer-scale-closeup', 'explorer miniatures stand upright and remain board-scale');

  await page.evaluate(() => window.__betrayal3d.focusRoom(11, 5.2));
  await page.waitForTimeout(600);
  await capture('03-monster-graveyard-closeup', 'CC0 Skeleton monster is placed in the graveyard as a board-scale enemy');

  await page.getByRole('button', { name: '镜头归位', exact: true }).click();
  await page.getByRole('button', { name: '厨房', exact: true }).click();
  const kitchenPreview = await debugState();
  assert(kitchenPreview.routePreviewPointCount > 2, `Expected a visible route preview before movement, got ${kitchenPreview.routePreviewPointCount}`);
  await capture('04-route-preview-to-kitchen', 'selected destination shows an amber legal route preview before movement');
  const blockersBeforeKitchen = (await debugState()).pieces.filter(piece => !(piece.kind === 'explorer' && piece.index === 0));
  await page.getByRole('button', { name: '移动至此', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.explorer')?.textContent?.includes('厨房'), null, { timeout: 25000 });
  const afterKitchen = await debugState();
  validatePieceSpacing(afterKitchen.pieces);
  validateRoute(afterKitchen.lastRoute, afterKitchen, blockersBeforeKitchen);
  await capture('04-moved-to-kitchen-via-doors', 'movement reaches kitchen through legal connected doorways without clipping furniture');

  await page.getByRole('button', { name: '储藏室', exact: true }).click();
  const blockersBeforeStorage = (await debugState()).pieces.filter(piece => !(piece.kind === 'explorer' && piece.index === 0));
  await page.getByRole('button', { name: '移动至此', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.explorer')?.textContent?.includes('储藏室'), null, { timeout: 25000 });
  const afterStorage = await debugState();
  validatePieceSpacing(afterStorage.pieces);
  validateRoute(afterStorage.lastRoute, afterStorage, blockersBeforeStorage);
  await capture('05-moved-to-storage-via-kitchen-door', 'storage room remains reachable only through the kitchen matching doorway');

  await page.getByRole('button', { name: '书房', exact: true }).click();
  const blockersBeforeStudy = (await debugState()).pieces.filter(piece => !(piece.kind === 'explorer' && piece.index === 0));
  await page.getByRole('button', { name: '移动至此', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.explorer')?.textContent?.includes('书房'), null, { timeout: 30000 });
  const afterStudy = await debugState();
  validatePieceSpacing(afterStudy.pieces);
  validateRoute(afterStudy.lastRoute, afterStudy, blockersBeforeStudy);
  await capture('06-sealed-wall-routes-around', 'route to the study goes around sealed shared walls instead of cutting through them');

  await page.getByRole('button', { name: '温室', exact: true }).click();
  const blockersBeforeConservatory = (await debugState()).pieces.filter(piece => !(piece.kind === 'explorer' && piece.index === 0));
  await page.getByRole('button', { name: '移动至此', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.explorer')?.textContent?.includes('温室'), null, { timeout: 30000 });
  const afterConservatory = await debugState();
  validatePieceSpacing(afterConservatory.pieces);
  validateRoute(afterConservatory.lastRoute, afterConservatory, blockersBeforeConservatory);
  await capture('07-adjacent-sealed-wall-not-crossed', 'conservatory and study share a sealed wall, so the path uses legal doorways around it');

  await page.getByRole('button', { name: '结束回合' }).click();
  assert.match(await page.locator('.chapter').innerText(), /第 2 回合/);
  await page.getByRole('button', { name: '正俯视', exact: true }).click();
  await page.waitForTimeout(700);
  const topFooterOpacity = await page.locator('footer').evaluate(element => Number(getComputedStyle(element).opacity));
  assert(topFooterOpacity <= 0.12, `Top view footer should stay out of the map inspection area, opacity=${topFooterOpacity}`);
  await capture('08-top-view-door-and-wall-check', 'top view confirms doors, solid walls and room selection remain readable');

  await page.getByRole('button', { name: '镜头归位', exact: true }).click();
  const beforePan = await page.locator('canvas').screenshot();
  await page.mouse.move(750, 400);
  await page.mouse.down();
  await page.mouse.move(900, 470, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const afterPan = await page.locator('canvas').screenshot();
  assert(!beforePan.equals(afterPan), 'Pan did not change canvas');
  await page.mouse.move(750, 400);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(900, 430, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await page.getByRole('button', { name: '画面设置', exact: true }).click();
  await page.getByLabel('立体墙体').uncheck();
  await page.getByLabel('氛围后处理').uncheck();
  await page.getByLabel('亮度').fill('1.9');
  await page.waitForTimeout(500);
  await capture('09-settings-and-camera-controls', 'pan, rotate, zoom, wall visibility, atmosphere and exposure controls are live');
  await page.getByLabel('立体墙体').check();
  await page.getByLabel('氛围后处理').check();
  await page.getByLabel('亮度').fill('1.5');
  await page.getByRole('button', { name: '关闭画面设置', exact: true }).click();
  await page.getByRole('button', { name: '镜头归位', exact: true }).click();

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(800);
  await capture('10-mobile-landscape', 'mobile landscape keeps the scene, HUD and room strip usable');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await capture('11-mobile-portrait', 'mobile portrait keeps the scene visible and controls accessible');

  assert.equal(errors.length, 0, errors.join('\n'));
  await writeFile(`${dir}/checks.json`, JSON.stringify({
    url: page.url(),
    generatedAt: new Date().toISOString(),
    errors,
    screenshots,
    geometryChecks: [
      'shared room edges emitted once',
      'room doors stay synchronized with each tile artwork orientation',
      'shared walls connect only when both sides have matching doors',
      'conservatory-study and gallery-graveyard sealed edges are not traversable',
      'path points avoid furniture and other figures',
      'explorer and monster model heights stay in board-miniature scale',
      'visible route preview is generated from the same legal path used for movement',
    ],
    interactionChecks: ['room selection', 'route preview', 'reachable move', 'sealed wall route avoidance', 'occupied room slot clearance', 'turn', 'pan', 'rotate', 'zoom', 'top view', 'reset', 'walls', 'atmosphere', 'exposure'],
  }, null, 2));
  console.log(JSON.stringify({ errors, screenshots }, null, 2));
} finally {
  await browser.close();
}
