import { expect, it } from 'vitest';
import type { QidahenMapToken } from '../domain/types';
import { buildQidahenPopulationSites } from '../ui/populationLayout';
import { getArmyScreenScale, layoutQidahenFieldArmies, packExpandedArmiesWithinRegions } from '../ui/fieldArmyLayout';
import { getQidahenPopulationPlacements, QIDAHEN_MAP_REGION_GEOMETRY } from '../ui/QidahenMapPopulationLayer';
import { layoutQidahenControlMarkers } from '../ui/controlMarkerLayout';
import { compactCrowdedArmies, groupCrowdedArmies, layoutOverflowArmyStacks } from '../ui/armyGroupLayout';
import { routeArmyGroupConnector } from '../ui/armyGroupConnector';
import sharp from 'sharp';
import { createInitialCore } from '../domain/initialCoreSetup';
import { syncQidahenMapTokensFromRegions } from '../domain/mapTokens';
import { buildQidahenRuntimeRegionIdByPixel } from '../ui/runtimeRegionOwnership';
import { QIDAHEN_MAP_NAMEPLATE_OBSTACLES, QIDAHEN_PRINTED_NAMEPLATE_BOUNDS, QIDAHEN_RUNTIME_REGION_BY_ID } from '../ui/mapGraph';

const width = 220, height = 220, regionId = 'city-region-15';
const region = { id: regionId, x: .5, y: .5, population: 0, isLogicalRegion: false };
const ownership = (left: number, top: number, right: number, bottom: number) => Array.from({ length: width * height }, (_, i) => {
    const x = i % width, y = Math.floor(i / width);
    return x >= left && x < right && y >= top && y < bottom ? regionId : null;
});
const army = (id: string): QidahenMapToken => ({ id, type: 'army', faction: 'ming', location: 'field', regionId, x: .5, y: .5, size: 26, pieceId: id });

it('逐兵选择地图缩放过基准时兵牌屏幕尺寸连续，且不低于原图', () => {
    expect(getArmyScreenScale(1.719999, 1.72)).toBe(1);
    expect(getArmyScreenScale(1.72, 1.72)).toBe(1);
    expect(1.720001 * getArmyScreenScale(1.720001, 1.72)).toBeCloseTo(1.72, 7);
    expect(3.35 * getArmyScreenScale(3.35, 1.72)).toBeCloseTo(1.72, 7);
    expect(4.5 * getArmyScreenScale(4.5, 3.5)).toBeCloseTo(3.5, 7);
});

it('辽北十支展开兵牌和人口可以同时留在真实地区', async () => {
    const w = 1265, h = 893;
    const data = await sharp('src/games/qidahen/data/region-mask.png').ensureAlpha().raw().toBuffer();
    const owners = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), w, h);
    const core = createInitialCore(['0', '1', '2']);
    const regions = core.regions.map(item => item.id === regionId ? { ...item, troops: 10, specialTroops: [] } : item);
    const scale = 1.72 / 3.35;
    const tokens = syncQidahenMapTokensFromRegions(regions).filter(token => token.type !== 'control')
        .map(token => token.type === 'army' ? { ...token, size: token.size! * scale } : token);
    const sites = buildQidahenPopulationSites(owners, w, h, QIDAHEN_MAP_REGION_GEOMETRY);
    const initial = layoutQidahenFieldArmies(tokens, sites, w, h);
    const result = packExpandedArmiesWithinRegions(initial.tokens, initial.callouts, sites, w, h,
        new Set([regionId]), new Set(regions.filter(item => item.population > 0).map(item => item.id)));
    expect(result.unresolvedRegionIds).toEqual([]);
    const armies = result.tokens.filter(token => token.type === 'army' && token.regionId === regionId && token.location === 'field');
    expect(armies).toHaveLength(10);
    for (const [i, token] of armies.entries()) {
        const x = token.x * w, y = token.y * h, half = token.size! / 2;
        for (const dx of [-half, half]) for (const dy of [-half, half]) expect(owners[Math.round(y + dy) * w + Math.round(x + dx)]).toBe(regionId);
        for (const other of armies.slice(i + 1)) expect(Math.abs((token.x - other.x) * w) >= 38 * scale - 1e-9 || Math.abs((token.y - other.y) * h) >= 38 * scale - 1e-9).toBe(true);
        // 地图放大时牌和角标同步保持屏幕尺寸，检查四种旋转均不被邻牌覆盖。
        for (const [badgeX, badgeY] of [[x - half + 3 * scale, y - half + 3 * scale], [x + half - 15 * scale, y - half + 3 * scale],
            [x - half + 3 * scale, y + half - 15 * scale], [x + half - 15 * scale, y + half - 15 * scale]]) {
            for (const other of armies.filter(item => item.id !== token.id)) {
                const otherX = other.x * w, otherY = other.y * h, otherHalf = other.size! / 2;
                expect(badgeX + 12 * scale <= otherX - otherHalf + 1e-9 || badgeX >= otherX + otherHalf - 1e-9
                    || badgeY + 12 * scale <= otherY - otherHalf + 1e-9 || badgeY >= otherY + otherHalf - 1e-9).toBe(true);
            }
        }
    }
    const population = getQidahenPopulationPlacements(regions, owners, result.tokens, sites).find(item => item.regionId === regionId);
    expect(population?.callout).toBe(false);
});

it('拥挤地区兵堆保留阵营与数量，展开后仍可逐枚选择原始兵牌', () => {
    const troops = [army('a'), army('b'), army('c'), { ...army('d'), faction: 'jin' as const }, { ...army('e'), faction: 'jin' as const }];
    const before = structuredClone(troops);
    const compact = compactCrowdedArmies(troops, new Set([regionId]), new Set(), () => null);
    expect(compact.tokens.map(token => token.id)).toEqual(['a', 'd']);
    expect([...compact.stackSizes.values()]).toEqual([3, 2]);
    expect(troops).toEqual(before);
    const expanded = compactCrowdedArmies(troops, new Set([regionId]), new Set([regionId]), () => null);
    expect(expanded.tokens).toEqual(troops);
    expect(expanded.tokens.map(token => token.pieceId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(expanded.tokens.every(token => token.size === 26)).toBe(true);
});

it('公开不同兵种和等级标为混编，隐藏对手兵种等级不泄露，展开保留每枚牌', () => {
    const troops = [
        { ...army('infantry-lv2-a'), troopKind: 'infantry' as const, rotationDeg: 0 },
        { ...army('infantry-lv2-b'), troopKind: 'infantry' as const, rotationDeg: 0 },
        { ...army('infantry-lv3'), troopKind: 'infantry' as const, rotationDeg: 270 },
        { ...army('artillery-lv2'), troopKind: 'artillery' as const, rotationDeg: 0 },
        { ...army('hidden-infantry'), faction: 'jin' as const, troopKind: 'infantry' as const, rotationDeg: 0 },
        { ...army('hidden-artillery'), faction: 'jin' as const, troopKind: 'artillery' as const, rotationDeg: 270 },
    ];
    const face = (token: QidahenMapToken) => token.faction === 'ming'
        ? JSON.stringify([token.troopKind, token.rotationDeg]) : null;
    const compact = compactCrowdedArmies(troops, new Set([regionId]), new Set(), face);
    expect(compact.tokens.map(token => token.id)).toEqual(['infantry-lv2-a', 'hidden-infantry']);
    expect(compact.stackSizes.get('infantry-lv2-a')).toBe(4);
    expect(compact.stackSizes.get('hidden-infantry')).toBe(2);
    expect([...compact.mixedStacks]).toEqual(['infantry-lv2-a']);
    const changedHidden = troops.map(token => token.faction === 'jin' ? { ...token, troopKind: 'cavalry' as const, rotationDeg: 180 } : token);
    const hiddenAgain = compactCrowdedArmies(changedHidden, new Set([regionId]), new Set(), face);
    expect(hiddenAgain.tokens.map(token => token.id)).toEqual(compact.tokens.map(token => token.id));
    expect([...hiddenAgain.stackSizes]).toEqual([...compact.stackSizes]);
    expect([...hiddenAgain.mixedStacks]).toEqual([...compact.mixedStacks]);
    const mixedVisibility = compactCrowdedArmies(troops, new Set([regionId]), new Set(), token => token.id === 'infantry-lv2-a' ? null : face(token));
    expect(mixedVisibility.mixedStacks.has('infantry-lv2-a')).toBe(false);
    const expanded = compactCrowdedArmies(troops, new Set([regionId]), new Set([regionId]), face);
    expect(expanded.tokens.map(token => token.id)).toEqual(troops.map(token => token.id));
});

it('已选部队保持本体，未参战部队合堆；显式检视仍能展开全部', () => {
    const troops = Array.from({ length: 10 }, (_, index) => army(`unit-${index}`));
    const selected = new Set(['unit-1', 'unit-2', 'unit-9']);
    const result = compactCrowdedArmies(troops, new Set([regionId]), new Set([regionId]), () => 'visible',
        new Set([regionId]), selected);
    expect(result.tokens.map(token => token.pieceId)).toEqual(['unit-0', 'unit-1', 'unit-2', 'unit-9']);
    expect(result.stackSizes.get('unit-0')).toBe(7);
    const inspected = compactCrowdedArmies(troops, new Set([regionId]), new Set([regionId]), () => 'visible');
    expect(inspected.tokens.map(token => token.pieceId)).toEqual(troops.map(token => token.pieceId));
});

it('真实地图地区的不同阵营兵堆稳定、独立地位于区内', async () => {
    const w = 1265, h = 893;
    const data = await sharp('src/games/qidahen/data/region-mask.png').ensureAlpha().raw().toBuffer();
    const owners = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), w, h);
    const core = createInitialCore(['0', '1', '2']);
    const sites = buildQidahenPopulationSites(owners, w, h, QIDAHEN_MAP_REGION_GEOMETRY);
    const tokens = [army('ming-stack'), { ...army('jin-stack'), faction: 'jin' as const }];
    const ids = new Set(tokens.map(token => token.id));
    const result = layoutOverflowArmyStacks(tokens, ids, sites, w, h);
    expect(result.unresolvedRegionIds).toEqual([]);
    for (const token of result.tokens) {
        const x = token.x * w, y = token.y * h;
        for (const dx of [-13, 13]) for (const dy of [-13, 13]) expect(owners[Math.round(y + dy) * w + Math.round(x + dx)]).toBe(regionId);
    }
    const [a, b] = result.tokens;
    expect(Math.abs((a.x - b.x) * w) >= 30 - 1e-9 || Math.abs((a.y - b.y) * h) >= 30 - 1e-9).toBe(true);
    const reversed = layoutOverflowArmyStacks([...tokens].reverse(), ids, sites, w, h);
    expect(Object.fromEntries(result.tokens.map(token => [token.id, [token.x, token.y]])))
        .toEqual(Object.fromEntries(reversed.tokens.map(token => [token.id, [token.x, token.y]])));
});

it('大地区超过 1000 个候选时仍可原位展开而不误判放不下', () => {
    const sites = buildQidahenPopulationSites(ownership(12, 12, 208, 208), width, height, [region]);
    expect(sites.get(regionId)!.candidates.length).toBeGreaterThan(1000);
    const tokens = Array.from({ length: 10 }, (_, index) => army(`large-${index}`));
    const anchor = sites.get(regionId)!.anchor;
    const result = packExpandedArmiesWithinRegions(tokens, tokens.map(token => ({ tokenId: token.id, point: anchor, anchor })),
        sites, width, height, new Set([regionId]), new Set([regionId]));
    expect(result.unresolvedRegionIds).toEqual([]);
    expect(result.callouts).toEqual([]);
    expect(result.tokens.map(token => token.pieceId)).toEqual(tokens.map(token => token.pieceId));
});

it('开局朵颜、山海关和宁远控制章互不重叠，城市章紧邻各自城名', async () => {
    const w = 1265, h = 893;
    const data = await sharp('src/games/qidahen/data/region-mask.png').ensureAlpha().raw().toBuffer();
    const owners = buildQidahenRuntimeRegionIdByPixel(new Uint8ClampedArray(data), w, h);
    const core = createInitialCore(['0', '1', '2']);
    const before = structuredClone(core.mapTokens);
    const layout = layoutQidahenControlMarkers(core.mapTokens, buildQidahenPopulationSites(owners, w, h, core.regions), w, h);
    const result = layout.tokens;
    expect(core.mapTokens).toEqual(before);
    const chosen = result.filter(token => token.type === 'control' && !token.id.startsWith('diplomacy-marker-')
        && ['duoyan', 'city-region-25', 'city-region-24', 'city-region-19-liaoxi'].includes(token.regionId ?? ''));
    expect(chosen).toHaveLength(4);
    expect(result.find(token => token.id === 'diplomacy-marker-duoyan')).toBeDefined();
    for (const [i, token] of chosen.entries()) for (const other of chosen.slice(i + 1)) {
        expect(Math.hypot((token.x - other.x) * w, (token.y - other.y) * h)).toBeGreaterThanOrEqual((token.size! + other.size!) / 2 + 4);
    }
    for (const cityId of ['city-region-25', 'city-region-24']) {
        const token = chosen.find(item => item.regionId === cityId)!;
        const label = QIDAHEN_RUNTIME_REGION_BY_ID.get(cityId)!.markerBounds!;
        const x = token.x * w, y = token.y * h, radius = token.size! / 2;
        const owner = owners[Math.round(y) * w + Math.round(x)];
        expect(QIDAHEN_RUNTIME_REGION_BY_ID.get(owner ?? '')?.mapRole).toBe('land');
        const dx = Math.max(label.left - x - radius, x - radius - label.left - label.width, 0);
        const dy = Math.max(label.top - y - radius, y - radius - label.top - label.height, 0);
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(15);
    }
    const land = chosen.find(item => item.regionId === 'duoyan')!;
    expect(owners[Math.round(land.y * h) * w + Math.round(land.x * w)]).toBe('duoyan');
    expect(land.x * w + land.size! / 2).toBeLessThanOrEqual(590);
    const liaoxi = chosen.find(item => item.regionId === 'city-region-19-liaoxi')!;
    expect(liaoxi.x * w + liaoxi.size! / 2 < 697 || liaoxi.x * w - liaoxi.size! / 2 > 720
        || liaoxi.y * h + liaoxi.size! / 2 < 432 || liaoxi.y * h - liaoxi.size! / 2 > 472).toBe(true);
    expect(owners[Math.round(liaoxi.y * h) * w + Math.round(liaoxi.x * w)]).toBe('city-region-19-liaoxi');
    expect(liaoxi.size).toBeGreaterThanOrEqual(20);
});

it('密集地区保留每个正式兵牌及所属地区，不再为每支兵牌画放射线', () => {
    const tokens = [army('a'), army('b'), army('c')];
    const anchor = { x: 110, y: 110 };
    const sites = new Map([[regionId, { anchor, candidates: [], clearance: 0 }]]);
    const callouts = tokens.map(token => ({ tokenId: token.id, point: anchor, anchor }));
    const result = groupCrowdedArmies(tokens, callouts, sites, width, height);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].regionId).toBe(regionId);
    expect(result.callouts).toEqual([]);
    expect(result.tokens.map(token => [token.id, token.pieceId, token.regionId])).toEqual(tokens.map(token => [token.id, token.pieceId, token.regionId]));
    expect(new Set(result.tokens.map(token => `${token.x},${token.y}`)).size).toBe(3);
});

it('密集兵牌面板避开底图上印刷的叶赫山城地名', () => {
    const tokens = Array.from({ length: 10 }, (_, i) => ({ ...army(`unit-${i}`), x: 0.69, y: 0.32 }));
    const anchor = { x: 873, y: 286 };
    const sites = new Map([[regionId, { anchor, candidates: [], clearance: 0 }]]);
    const grouped = groupCrowdedArmies(tokens, tokens.map(token => ({ tokenId: token.id, point: anchor, anchor })), sites, 1265, 893);
    expect(grouped.groups).toHaveLength(1);
    const panel = grouped.groups[0], label = QIDAHEN_PRINTED_NAMEPLATE_BOUNDS[0];
    expect(panel.left + panel.width <= label.left || panel.left >= label.left + label.width
        || panel.top + panel.height <= label.top || panel.top >= label.top + label.height).toBe(true);
});

it('密集兵牌面板连接所属地区的控制标记', () => {
    const tokens = [...Array.from({ length: 5 }, (_, i) => army(`unit-${i}`)),
        { id: 'control', type: 'control', faction: 'ming', regionId, x: .4, y: .6, size: 29 } as QidahenMapToken];
    const siteAnchor = { x: 110, y: 110 };
    const sites = new Map([[regionId, { anchor: siteAnchor, candidates: [], clearance: 0 }]]);
    const grouped = groupCrowdedArmies(tokens, tokens.slice(0, 5).map(token => ({ tokenId: token.id, point: siteAnchor, anchor: siteAnchor })), sites, 400, 400);
    expect(grouped.groups).toHaveLength(1);
    expect(grouped.groups[0].anchor).toEqual({ x: 160, y: 240 });
});

it('部分可见的兵牌面板标题被视口裁切时，移动整个面板保持归属可读', () => {
    const tokens = Array.from({ length: 10 }, (_, i) => ({ ...army(`unit-${i}`), x: .5, y: .5 }));
    const anchor = { x: 632, y: 446 };
    const sites = new Map([[regionId, { anchor, candidates: [], clearance: 0 }]]);
    const callouts = tokens.map(token => ({ tokenId: token.id, point: anchor, anchor }));
    const before = groupCrowdedArmies(tokens, callouts, sites, 1265, 893).groups[0];
    const visible = { left: 0, top: before.top + 10, width: 1265, height: 893 - before.top - 10 };
    const after = groupCrowdedArmies(tokens, callouts, sites, 1265, 893, { visible, overlays: [] }).groups[0];
    expect(after.top).toBeGreaterThanOrEqual(visible.top);
    expect(after.top + after.height).toBeLessThanOrEqual(visible.top + visible.height);
});

it('覆盖物只挡住兵牌而未挡住标题时，整个兵组仍避开覆盖物', () => {
    const tokens = Array.from({ length: 7 }, (_, i) => army(`unit-${i}`));
    const anchor = { x: 632, y: 446 };
    const sites = new Map([[regionId, { anchor, candidates: [], clearance: 0 }]]);
    const callouts = tokens.map(token => ({ tokenId: token.id, point: anchor, anchor }));
    const before = groupCrowdedArmies(tokens, callouts, sites, 1265, 893).groups[0];
    const overlay = { left: before.left, top: before.top + 30, width: before.width, height: before.height - 30 };
    const after = groupCrowdedArmies(tokens, callouts, sites, 1265, 893, {
        visible: { left: 0, top: 0, width: 1265, height: 893 }, overlays: [overlay],
    }).groups[0];
    expect(after.left + after.width <= overlay.left || after.left >= overlay.left + overlay.width
        || after.top + after.height <= overlay.top || after.top >= overlay.top + overlay.height).toBe(true);
});

it('视口不能容纳宽面板时换列，保留完整兵牌并使整组可见', () => {
    const tokens = Array.from({ length: 7 }, (_, i) => army(`unit-${i}`));
    const anchor = { x: 300, y: 300 };
    const sites = new Map([[regionId, { anchor, candidates: [], clearance: 0 }]]);
    const callouts = tokens.map(token => ({ tokenId: token.id, point: anchor, anchor }));
    const before = groupCrowdedArmies(tokens, callouts, sites, 1265, 893).groups[0];
    const visible = { left: before.left + 6, top: 0, width: 100, height: 893 };
    const result = groupCrowdedArmies(tokens, callouts, sites, 1265, 893, { visible, overlays: [] });
    const panel = result.groups[0];
    expect(panel.width).toBeLessThanOrEqual(visible.width);
    expect(panel.left).toBeGreaterThanOrEqual(visible.left);
    expect(panel.left + panel.width).toBeLessThanOrEqual(visible.left + visible.width);
    expect(result.tokens.map(token => token.id)).toEqual(tokens.map(token => token.id));
    expect(new Set(result.tokens.map(token => `${token.x},${token.y}`)).size).toBe(tokens.length);
});

it('换列重排时不覆盖其他地区的控制章', () => {
    const troops = Array.from({ length: 7 }, (_, i) => army(`unit-${i}`));
    const anchor = { x: 300, y: 300 };
    const control = { id: 'other-control', type: 'control', faction: 'jin', regionId: 'other-region', x: 324 / 1265, y: 138 / 893, size: 20 } as QidahenMapToken;
    const sites = new Map([[regionId, { anchor, candidates: [], clearance: 0 }]]);
    const callouts = troops.map(token => ({ tokenId: token.id, point: anchor, anchor }));
    const result = groupCrowdedArmies([...troops, control], callouts, sites, 1265, 893,
        { visible: { left: 314, top: 0, width: 100, height: 893 }, overlays: [] });
    const panel = result.groups[0];
    expect(panel.left + panel.width <= 314 || panel.left >= 334 || panel.top + panel.height <= 128 || panel.top >= 148).toBe(true);
    expect(result.tokens.find(token => token.id === control.id)).toEqual(control);
});

it('兵组重排避开其他地区当前决策兵牌，同时不把自己的兵牌当障碍', () => {
    const troops = Array.from({ length: 7 }, (_, i) => army(`unit-${i}`));
    const anchor = { x: 300, y: 300 };
    const sites = new Map([[regionId, { anchor, candidates: [], clearance: 0 }]]);
    const callouts = troops.map(token => ({ tokenId: token.id, point: anchor, anchor }));
    const initial = groupCrowdedArmies(troops, callouts, sites, 1265, 893).groups[0];
    const foreign = { left: initial.left, top: initial.top, width: 24, height: 24, excludeRegionId: 'other-region' };
    const own = { ...foreign, excludeRegionId: regionId };
    const visible = { left: 0, top: 0, width: 1265, height: 893 };
    const unchanged = groupCrowdedArmies(troops, callouts, sites, 1265, 893, { visible, overlays: [own] }).groups[0];
    expect(unchanged).toEqual(initial);
    const moved = groupCrowdedArmies(troops, callouts, sites, 1265, 893, { visible, overlays: [foreign] }).groups[0];
    expect(moved.left + moved.width <= foreign.left || moved.left >= foreign.left + foreign.width
        || moved.top + moved.height <= foreign.top || moved.top >= foreign.top + foreign.height).toBe(true);
});

it('归属线绕开沿途兵牌而非被兵牌遮断', () => {
    const route = routeArmyGroupConnector({ x: 0, y: 50 }, { x: 120, y: 50 }, [{ left: 45, top: 35, width: 30, height: 30 }]);
    expect(route?.[0]).toEqual({ x: 0, y: 50 });
    expect(route?.at(-1)).toEqual({ x: 120, y: 50 });
    expect(route?.length).toBeGreaterThan(2);
    expect(route?.some(point => point.y < 29 || point.y > 71)).toBe(true);
});

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
        for (const other of boxes.slice(i + 1)) expect(Math.abs(box.x - other.x) >= box.half + other.half + 10
            || Math.abs(box.y - other.y) >= box.half + other.half + 10).toBe(true);
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

it('窄区放不下逐枚兵牌时返回待检视地区，不丢失兵牌', () => {
    const owners = ownership(100, 100, 111, 111);
    const sites = buildQidahenPopulationSites(owners, width, height, [region]);
    const before = [army('a'), army('b')];
    const initial = layoutQidahenFieldArmies(before, sites, width, height);
    const packed = packExpandedArmiesWithinRegions(initial.tokens, initial.callouts, sites, width, height,
        new Set([regionId]), new Set());
    expect(packed.unresolvedRegionIds).toEqual([regionId]);
    expect(packed.tokens.map(token => token.pieceId)).toEqual(['a', 'b']);
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
