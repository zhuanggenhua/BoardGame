import { resolveQidahenPrimaryRuntimeRegionId } from './regionConfig';

export const QIDAHEN_HAN_RUNTIME_REGION_IDS = new Set([
    'city-region-19-liaoxi',
    'city-region-15',
    'city-region-15-liaodong',
    'city-region-22',
    'city-region-24',
    'city-region-25',
    'city-region-27',
    'city-region-28-jizhen',
    'city-region-28',
    'city-region-30',
    'city-region-31',
    'city-region-32',
    'city-region-33',
    'jinzhou',
    'song-jin',
]);

export const QIDAHEN_NON_HAN_RUNTIME_REGION_IDS = new Set([
    'city-region-2',
    'city-region-3',
    'city-region-4',
    'city-region-5',
    'city-region-6',
    'city-region-7',
    'city-region-8',
    'city-region-9',
    'city-region-10',
    'city-region-11',
    'city-region-13',
    'city-region-14',
    'city-region-16',
    'city-region-17',
    'city-region-19',
    'city-region-20',
    'city-region-21',
    'city-region-26',
    'xian-xing',
    'city-region-18',
    'city-region-29',
]);

export const QIDAHEN_JURCHEN_RUNTIME_REGION_IDS = new Set([
    'city-region-4',
    'city-region-5',
    'city-region-7',
    'city-region-9',
    'city-region-11',
    'city-region-13',
]);

export const QIDAHEN_MONGOL_RUNTIME_REGION_IDS = new Set([
    'city-region-2',
    'city-region-3',
    'city-region-6',
    'city-region-8',
    'city-region-10',
    'city-region-14',
    'city-region-16',
    'city-region-17',
    'city-region-19',
    'city-region-20',
    'city-region-21',
    'city-region-26',
]);

export const isQidahenHanRuntimeRegionId = (regionId: string): boolean => (
    QIDAHEN_HAN_RUNTIME_REGION_IDS.has(resolveQidahenPrimaryRuntimeRegionId(regionId))
);

export const isQidahenNonHanRuntimeRegionId = (regionId: string): boolean => (
    QIDAHEN_NON_HAN_RUNTIME_REGION_IDS.has(resolveQidahenPrimaryRuntimeRegionId(regionId))
);

export const isQidahenJurchenRuntimeRegionId = (regionId: string): boolean => (
    QIDAHEN_JURCHEN_RUNTIME_REGION_IDS.has(resolveQidahenPrimaryRuntimeRegionId(regionId))
);

export const isQidahenMongolRuntimeRegionId = (regionId: string): boolean => (
    QIDAHEN_MONGOL_RUNTIME_REGION_IDS.has(resolveQidahenPrimaryRuntimeRegionId(regionId))
);
