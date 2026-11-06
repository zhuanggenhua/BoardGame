import { expect, it } from 'vitest';
import type { QidahenMapToken } from '../domain/types';
import { buildQidahenPopulationSites } from '../ui/populationLayout';
import { layoutQidahenFieldArmies } from '../ui/fieldArmyLayout';
import sharp from 'sharp';
import { createInitialCore } from '../domain/initialCoreSetup';
import { syncQidahenMapTokensFromRegions } from '../domain/mapTokens';
import { buildQidahenRuntimeRegionIdByPixel } from '../ui/runtimeRegionOwnership';
import { QIDAHEN_MAP_NAMEPLATE_OBSTACLES, QIDAHEN_RUNTIME_REGION_BY_ID } from '../ui/mapGraph';

const width = 220, height = 220, regionId = 'city-region-15';
const region = { id: regionId, x: .5, y: .5, population: 0, isLogicalRegion: false };
const ownership = (left: number, top: number, right: number, bottom: number) => Array.from({ length: width * height }, (_, i) => {
    const x = i % width, y = Math.floor(i / width);
    return x >= left && x < right && y >= top && y < bottom ? regionId : null;
});
const army = (id: string): QidahenMapToken => ({ id, type: 'army', faction: 'ming', location: 'field', regionId, x: .5, y: .5, size: 26, pieceId: id });

it('十支兵牌沿正式像素归属完整落区，避开控制章且不改变规则身份', () => {
    const owners = ownership(12, 12, 208, 208);
    const tokens = [...Array.from({ length: 10 }, (_, i) => army(`unit-${i}`)), {
        id: 'control', type: 'control', faction: 'ming', regionId, x: .5, y: .5, size: 29,
    } as QidahenMapToken];
    const original = structuredClone(tokens);
    const sites = buildQidahenPopulationSites(owners, width, height, [region]);
    const result = layoutQidahenFieldArmies(tokens, sites, width, height);
    expect(result.callouts).toEqual([]);
    expect(tokens).toEqual(original);
    const boxes = result.tokens.map(token => ({ x: token.x * width, y: token.y * height, half: token.size! / 2 }));
    for (const [i, token] of result.tokens.entries()) {
        expect(token.id).toBe(tokens[i].id);
        expect(token.pieceId).toBe(tokens[i].pieceId);
        if (token.type !== 'army') continue;
        const box = boxes[i];
        for (const dx of [-box.half, box.half]) for (const dy of [-box.half, box.half]) {
            expect(owners[Math.round(box.y + dy) * width + Math.round(box.x + dx)]).toBe(regionId);
        }
        for (const other of boxes.slice(i + 1)) expect(Math.abs(box.x - other.x) >= box.half + other.half + 4
            || Math.abs(box.y - other.y) >= box.half + other.half + 4).toBe(true);
    }
});

it('窄区无法容纳整张兵牌时明确连接区内锚点，围城兵牌保留原位置', () => {
    const owners = ownership(100, 100, 111, 111);
    const sites = buildQidahenPopulationSites(owners, width, height, [region]);
    const siege = { ...army('siege'), location: 'siege-attacker' as const, x: .8, y: .8 };
    const result = layoutQidahenFieldArmies([army('field'), siege], sites, width, height);
    expect(result.callouts).toHaveLength(1);
    const anchor = result.callouts[0].anchor;
    expect(owners[anchor.y * width + anchor.x]).toBe(regionId);
    expect(result.tokens[1]).toBe(siege);
});

it('正式地图辽北十支部队不压控制章，所有外置兵牌均有指回本区的引线', async () => {
    const w = 1265, h = 893;
    const data = await sharp('src/games/qidahen/data/region-mask.png').ensureAlpha().raw().toBuffer();
    const owners = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), w, h);
    const core = createInitialCore(['0', '1', '2']);
    const regions = core.regions.map(r => r.id === regionId ? { ...r, troops: 10, specialTroops: [] } : r);
    const tokens = syncQidahenMapTokensFromRegions(regions);
    const sites = buildQidahenPopulationSites(owners, w, h, regions);
    const result = layoutQidahenFieldArmies(tokens, sites, w, h);
    const units = result.tokens.filter(token => token.type === 'army' && token.regionId === regionId && token.location === 'field');
    const control = result.tokens.find(token => token.type === 'control' && token.regionId === regionId)!;
    expect(units).toHaveLength(10);
    for (const token of result.tokens.filter(token => token.type === 'army' && token.location === 'field'
        && QIDAHEN_RUNTIME_REGION_BY_ID.get(token.regionId ?? '')?.mapRole === 'land')) {
        for (const nameplate of QIDAHEN_MAP_NAMEPLATE_OBSTACLES) expect(Math.abs(token.x * w - nameplate.x) >= token.size! / 2 + nameplate.size / 2 + 4
            || Math.abs(token.y * h - nameplate.y) >= token.size! / 2 + nameplate.size / 2 + 4, token.id).toBe(true);
    }
    for (const unit of units) {
        const x = unit.x * w, y = unit.y * h, half = unit.size! / 2;
        const callout = result.callouts.find(item => item.tokenId === unit.id);
        if (callout) expect(owners[callout.anchor.y * w + callout.anchor.x]).toBe(regionId);
        else for (const dx of [-half, half]) for (const dy of [-half, half]) {
            expect(owners[Math.round(y + dy) * w + Math.round(x + dx)], unit.id).toBe(regionId);
        }
        expect(Math.abs(x - control.x * w) >= half + control.size! / 2 + 4
            || Math.abs(y - control.y * h) >= half + control.size! / 2 + 4).toBe(true);
    }
});
