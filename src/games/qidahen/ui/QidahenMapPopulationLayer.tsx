import React from 'react';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from './mapRegions';
import { buildQidahenPopulationSites, layoutQidahenPopulation, QIDAHEN_POPULATION_SIZE, type PopulationSite, type PopulationPlacement } from './populationLayout';
import { QIDAHEN_RUNTIME_REGION_DEFINITIONS, QIDAHEN_MAP_NAMEPLATE_OBSTACLES } from './mapGraph';

export const QIDAHEN_MAP_REGION_GEOMETRY = QIDAHEN_RUNTIME_REGION_DEFINITIONS.map(region => ({
    id: region.id, x: region.center!.x / QIDAHEN_MAP_WIDTH, y: region.center!.y / QIDAHEN_MAP_HEIGHT,
    isLogicalRegion: false, population: 0,
}));

const nameplateObstacles = QIDAHEN_MAP_NAMEPLATE_OBSTACLES.map(obstacle => ({
    ...obstacle, x: obstacle.x / QIDAHEN_MAP_WIDTH, y: obstacle.y / QIDAHEN_MAP_HEIGHT,
}));

export type QidahenMapPopulationRegion = {
    id: string;
    x: number;
    y: number;
    population: number;
    isLogicalRegion: boolean;
    controller?: string;
};

export function getQidahenPopulationPlacements(regions: readonly QidahenMapPopulationRegion[], ownership: readonly (string | null)[] | null,
    tokens: readonly { x: number; y: number; size?: number }[], interiorSites?: ReadonlyMap<string, PopulationSite>,
    reservedAreas: readonly { left: number; top: number; width: number; height: number }[] = []): PopulationPlacement[] {
    const result = interiorSites ? new Map(interiorSites) : ownership
        ? buildQidahenPopulationSites(ownership, QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_REGION_GEOMETRY)
        : new Map<string, PopulationSite>();
    for (const definition of QIDAHEN_RUNTIME_REGION_DEFINITIONS) {
        if (definition.mapRole === 'point' && definition.markerBounds) {
            const site = result.get(definition.id);
            if (site) result.set(definition.id, { ...site, anchor: {
                x: definition.markerBounds.left + definition.markerBounds.width / 2,
                y: definition.markerBounds.top + definition.markerBounds.height - 1,
            } });
        }
        if (definition.mapRole !== 'city' || !definition.parentRegionId || !definition.markerBounds) continue;
        const parent = result.get(definition.parentRegionId);
        if (!parent) continue;
        result.set(definition.id, {
            ...parent,
            anchor: { x: definition.markerBounds.left, y: definition.markerBounds.top + definition.markerBounds.height / 2 },
        });
    }
    return layoutQidahenPopulation(result, regions, [...tokens, ...nameplateObstacles], QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT, reservedAreas);
}

export const QidahenMapPopulationLayer: React.FC<{
    regions: readonly QidahenMapPopulationRegion[];
    placements: readonly PopulationPlacement[];
    protectedRegionIds?: readonly string[];
    candidateRegionIds?: readonly string[];
    reservedAreas?: readonly { left: number; top: number; width: number; height: number }[];
}> = ({ regions, placements, protectedRegionIds = [], candidateRegionIds = [], reservedAreas = [] }) => {
    const populationMaskId = React.useId().replace(/:/g, '');
    const regionById = new Map(regions.map(region => [region.id, region]));
    return (
    <>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${QIDAHEN_MAP_WIDTH} ${QIDAHEN_MAP_HEIGHT}`} aria-hidden="true" style={{ zIndex: 13 }}>
            <defs><mask id={populationMaskId} maskUnits="userSpaceOnUse"><rect width={QIDAHEN_MAP_WIDTH} height={QIDAHEN_MAP_HEIGHT} fill="white" />
                {reservedAreas.map((area, index) => <rect key={index} x={area.left} y={area.top} width={area.width} height={area.height} fill="black" />)}
            </mask></defs>
            {placements.filter(placement => placement.callout).map(({ regionId, point, anchor }) => (
                <g key={regionId} stroke="#1a1208" strokeWidth={2} mask={`url(#${populationMaskId})`}>
                    <path d={`M ${anchor.x} ${anchor.y} L ${point.x} ${point.y}`} />
                    <circle cx={anchor.x} cy={anchor.y} r={3} fill="#ffe566" />
                </g>
            ))}
        </svg>
        {placements.map(({ regionId, point, anchor, callout }) => {
            const region = regionById.get(regionId)!;
            return (
                <div
                    key={region.id}
                    className="pointer-events-none absolute grid place-items-center font-black tabular-nums"
                    data-testid={`qidahen-map-population-${region.id}`}
                    data-qidahen-map-population="true"
                    data-qidahen-map-population-faction={region.controller}
                    data-qidahen-map-population-region={region.id}
                    data-qidahen-map-protected-population={protectedRegionIds.includes(region.id) ? 'true' : undefined}
                    data-qidahen-candidate-object={candidateRegionIds.includes(region.id) ? 'true' : undefined}
                    data-population={String(region.population)}
                    data-population-placement={callout ? 'callout' : 'interior'}
                    data-population-anchor-x={anchor.x}
                    data-population-anchor-y={anchor.y}
                    aria-label={`人口 ${region.population}`}
                    style={{
                        left: point.x,
                        top: point.y,
                        width: QIDAHEN_POPULATION_SIZE,
                        height: QIDAHEN_POPULATION_SIZE,
                        transform: 'translate(-50%, -50%)',
                        border: '2.5px solid #1a1208',
                        borderRadius: 3,
                        background: 'linear-gradient(180deg, #ffe566 0%, #f0b21a 58%, #c47d0c 100%)',
                        color: '#1a1208',
                        fontSize: 15,
                        lineHeight: 1,
                        boxShadow: 'inset 0 2px 0 #fff3a8, inset 0 -3px 0 rgba(120,60,0,0.38), 0 0 0 2px #fff6d0, 0 3px 7px rgba(20,12,4,0.55)',
                        zIndex: 14,
                    }}
                >
                    {region.population}
                </div>
            );
        })}
    </>
    );
};
