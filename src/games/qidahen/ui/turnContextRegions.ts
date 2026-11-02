import type { QidahenCore } from '../domain/types';
import { resolveQidahenRuleRegionConfig } from '../domain/regionConfig';
import { QIDAHEN_REGION_GRAPH_EDGES } from './mapGraph';

/** 维护对象只提供取景上下文，不成为可点击地区候选。 */
export function getQidahenMaintenanceContextRegionIds(core: { regions: readonly Pick<QidahenCore['regions'][number], 'id' | 'isLogicalRegion'>[] }, fortificationId: string | null): string[] {
    if (!fortificationId) return [];
    const cities = core.regions.filter(region => !region.isLogicalRegion
        && resolveQidahenRuleRegionConfig(region.id).maintenanceFortificationId === fortificationId).map(region => region.id);
    const boundaries = QIDAHEN_REGION_GRAPH_EDGES.filter(edge => edge.fortificationId === fortificationId).flatMap(edge => [edge.from, edge.to]);
    return [...new Set([...cities, ...boundaries])];
}
