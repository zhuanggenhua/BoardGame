import { describe, expect, it } from 'vitest';
import { BETRAYAL_EXPLORER_CATALOG } from '../../games/betrayal/scenarioConfig';
import { buildManifestAssetCandidates } from '../BetrayalConfigReview';

describe('BetrayalConfigReview asset candidates', () => {
    it('only offers the twelve catalog-owned map tokens while keeping unpaired panel assets available', () => {
        const tokenAssets = buildManifestAssetCandidates('tokens/explorers/').map(({ asset }) => asset).sort();
        const catalogTokenAssets = BETRAYAL_EXPLORER_CATALOG
            .map(({ tokenAsset }) => tokenAsset)
            .filter((asset): asset is string => Boolean(asset))
            .sort();

        expect(tokenAssets).toHaveLength(12);
        expect(tokenAssets).toEqual(catalogTokenAssets);
        expect(tokenAssets.some((asset) => /httpssteamusercontent/i.test(asset))).toBe(false);
        expect(tokenAssets).not.toContain('betrayal/tokens/explorers/darryl-highla');
        expect(tokenAssets).not.toContain('betrayal/tokens/explorers/rebecca-allen');

        const panelAssets = buildManifestAssetCandidates('explorers/').map(({ asset }) => asset);
        expect(panelAssets).toContain('betrayal/explorers/sera-nguyen');
    });
});
