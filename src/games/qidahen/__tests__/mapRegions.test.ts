import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    QIDAHEN_MAP_REGIONS,
    QIDAHEN_MOVEMENT_EDGES,
    type QidahenMapRegionData,
} from '../config/mapRegions';

describe('qidahen map region data', () => {
    it('移动边、邻接表与区域移动代价保持一致', () => {
        const regionById = new Map(QIDAHEN_MAP_REGIONS.map((region) => [region.id, region]));

        for (const region of QIDAHEN_MAP_REGIONS) {
            expect(region.polygon.length, `${region.id} polygon`).toBeGreaterThanOrEqual(3);
            expect(region.labelPoint.x).toBeGreaterThanOrEqual(0);
            expect(region.labelPoint.x).toBeLessThanOrEqual(1);
            expect(region.labelPoint.y).toBeGreaterThanOrEqual(0);
            expect(region.labelPoint.y).toBeLessThanOrEqual(1);

            for (const adjacentRegionId of region.adjacentRegionIds) {
                const adjacent = regionById.get(adjacentRegionId);
                expect(adjacent, `${region.id} adjacent ${adjacentRegionId}`).toBeTruthy();
                expect(region.movementCostByRegionId[adjacentRegionId], `${region.id}->${adjacentRegionId} cost`).toBeGreaterThan(0);
                expect(adjacent?.adjacentRegionIds, `${adjacentRegionId}->${region.id} adjacency`).toContain(region.id);
                expect(adjacent?.movementCostByRegionId[region.id], `${adjacentRegionId}->${region.id} cost`).toBe(region.movementCostByRegionId[adjacentRegionId]);
            }
        }

        for (const edge of QIDAHEN_MOVEMENT_EDGES) {
            const from = regionById.get(edge.fromRegionId);
            const to = regionById.get(edge.toRegionId);
            const canonicalEdgeId = [edge.fromRegionId, edge.toRegionId].sort().join('__');
            expect(edge.id).toBe(canonicalEdgeId);
            expect(from, edge.fromRegionId).toBeTruthy();
            expect(to, edge.toRegionId).toBeTruthy();
            expect(from?.adjacentRegionIds).toContain(edge.toRegionId);
            expect(to?.adjacentRegionIds).toContain(edge.fromRegionId);
            expect(from?.movementCostByRegionId[edge.toRegionId]).toBe(edge.cost);
            expect(to?.movementCostByRegionId[edge.fromRegionId]).toBe(edge.cost);
        }
    });

    it('public JSON 导出与运行时配置使用同一批区域和移动边', () => {
        const raw = readFileSync(resolve(process.cwd(), 'public/game-data/qidahen.map-regions.json'), 'utf-8');
        const data = JSON.parse(raw) as QidahenMapRegionData;

        expect(data.image.width).toBe(1265);
        expect(data.image.height).toBe(893);
        expect(data.regions.map((region) => region.id)).toEqual(QIDAHEN_MAP_REGIONS.map((region) => region.id));
        expect(data.movementEdges.map((edge) => edge.id)).toEqual(QIDAHEN_MOVEMENT_EDGES.map((edge) => edge.id));
        expect(data.movementEdges.map((edge) => edge.cost)).toEqual(QIDAHEN_MOVEMENT_EDGES.map((edge) => edge.cost));
    });
});
