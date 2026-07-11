import type { QidahenCore } from './types';

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
