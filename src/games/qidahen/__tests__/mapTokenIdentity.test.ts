import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../engine';
import { QidahenDomain } from '../domain';
import { syncQidahenMapTokensFromRegions } from '../domain/mapTokens';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';

const opening = () => QidahenDomain.setup(['0', '1', '2'], createSeededRandom(81), buildQidahenTutorialSetupData('basic-opening', true)!.setupData);

describe('地图标记的正式地区身份', () => {
    it('所有控制章都保留所属地区，平壤控制章可参加焦点避让', () => {
        const core = opening();
        const regionsById = new Map(core.regions.map(region => [region.id, region]));
        const controls = core.mapTokens.filter(token => token.type === 'control');
        expect(controls.length).toBeGreaterThan(0);
        for (const token of controls) {
            expect(token.regionId, token.id).toBeDefined();
            expect(regionsById.has(token.regionId!), token.id).toBe(true);
        }
        expect(core.mapTokens.find(token => token.id === 'city-region-18-control')?.regionId).toBe('city-region-18');
    });

    it('外交和事件标记沿用同一所属地区，不从图像或坐标猜归属', () => {
        const core = opening();
        const regions = core.regions.map(region => region.id === 'city-region-18' ? {
            ...region, diplomacyMarkerFaction: 'mongol' as const, diplomacyMarkerSide: 'friendly' as const,
            eventMarkers: [{ id: 'test-drought', kind: 'drought' as const, label: '旱灾', sourceCardDefId: 'test-card', mapLabel: '旱' }],
        } : region);
        const tokens = syncQidahenMapTokensFromRegions(regions, core.pieces);
        expect(tokens.find(token => token.id === 'diplomacy-marker-city-region-18')?.regionId).toBe('city-region-18');
        expect(tokens.find(token => token.id === 'test-drought')?.regionId).toBe('city-region-18');
    });
});
