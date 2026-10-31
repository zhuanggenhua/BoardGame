import type { QidahenCore } from './types';
import { isQidahenKoreaRuntimeRegionId, resolveQidahenRuleRegionConfig } from './regionConfig';

/** 正式地图马匹符号数；无马一般区域上限5，朝鲜不放人口。 */
const QIDAHEN_HORSE_POPULATION_CAP_BY_REGION_NAME: Record<string, number> = {
    '外喀尔喀部': 3, '科尔沁部': 2, '乌喇部': 2, '辉发部': 1, '扎鲁特部': 2,
    '叶赫部': 2, '巴林部': 1, '哈达部': 1, '内喀尔喀部': 2, '长白': 2, '建州': 2,
    '察哈尔': 3, '辽北': 3, '克什克腾部': 2, '奈曼部': 1, '敖汉部': 1, '土默特部': 3,
    '喀喇沁部': 2, '朵颜部': 1,
};

export function getQidahenPopulationCap(regionId: string): number {
    if (isQidahenKoreaRuntimeRegionId(regionId)) return 0;
    return QIDAHEN_HORSE_POPULATION_CAP_BY_REGION_NAME[resolveQidahenRuleRegionConfig(regionId).name] ?? 5;
}

type QidahenPopulationRegion = Pick<
    QidahenCore['regions'][number],
    'population' | 'cityState' | 'eventMarkers'
>;

export const hasQidahenDroughtMarker = (
    region: Pick<QidahenPopulationRegion, 'eventMarkers'>,
): boolean => region.eventMarkers.some((marker) => marker.kind === 'drought');

export const getQidahenEffectivePopulation = (
    region: Pick<QidahenPopulationRegion, 'population' | 'eventMarkers'>,
    rawPopulation: number = region.population,
): number => (
    hasQidahenDroughtMarker(region)
        ? 0
        : Math.max(0, rawPopulation)
);

export const getQidahenEffectiveCityPopulation = (
    region: QidahenPopulationRegion,
): number => getQidahenEffectivePopulation(region, region.cityState?.population ?? 0);

export const getQidahenEffectiveTotalPopulation = (
    region: QidahenPopulationRegion,
): number => (
    getQidahenEffectivePopulation(region)
    + getQidahenEffectiveCityPopulation(region)
);
