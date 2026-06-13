import { resolveQidahenPrimaryRuntimeRegionId } from './regionConfig';
import type { QidahenCore } from './types';

export const resolvePreferredRegionDisplayAnchor = (
    region: Pick<QidahenCore['regions'][number], 'id'>,
    preferredRegionId?: string | null,
): string => (
    preferredRegionId && resolveQidahenPrimaryRuntimeRegionId(preferredRegionId) === region.id
        ? preferredRegionId
        : region.id
);
