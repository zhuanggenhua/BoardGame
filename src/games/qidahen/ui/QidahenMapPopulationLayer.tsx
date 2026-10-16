import React from 'react';
import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from './mapRegions';

const POPULATION_OFFSET_PX = { x: 20, y: 22 };
const CUBE_SIZE = 26;

const clampMapCoordinate = (value: number): number => Math.max(0.02, Math.min(0.98, value));

export type QidahenMapPopulationRegion = {
    id: string;
    x: number;
    y: number;
    population: number;
    isLogicalRegion: boolean;
};

const getPopulationPoint = (region: QidahenMapPopulationRegion) => ({
    x: clampMapCoordinate(region.x + POPULATION_OFFSET_PX.x / QIDAHEN_MAP_WIDTH),
    y: clampMapCoordinate(region.y + POPULATION_OFFSET_PX.y / QIDAHEN_MAP_HEIGHT),
});

export const QidahenMapPopulationLayer: React.FC<{
    regions: readonly QidahenMapPopulationRegion[];
}> = ({ regions }) => (
    <>
        {regions.map((region) => {
            if (region.isLogicalRegion || region.population <= 0) {
                return null;
            }
            const point = getPopulationPoint(region);
            return (
                <div
                    key={region.id}
                    className="pointer-events-none absolute grid place-items-center font-black tabular-nums"
                    data-testid={`qidahen-map-population-${region.id}`}
                    data-qidahen-map-population="true"
                    data-population={String(region.population)}
                    aria-label={`人口 ${region.population}`}
                    style={{
                        left: point.x * QIDAHEN_MAP_WIDTH,
                        top: point.y * QIDAHEN_MAP_HEIGHT,
                        width: CUBE_SIZE,
                        height: CUBE_SIZE,
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
