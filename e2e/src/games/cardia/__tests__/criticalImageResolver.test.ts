import { describe, expect, it } from 'vitest';
import { cardiaCriticalImageResolver } from '../criticalImageResolver';
import { CARDIA_IMAGE_PATHS } from '../imagePaths';

describe('cardiaCriticalImageResolver', () => {
    it('教程 setup 步骤返回空关键图，快速通过门禁', () => {
        const result = cardiaCriticalImageResolver({
            core: { deckVariant: 'I' },
            sys: {
                tutorial: { active: true, stepIndex: 0 },
            },
        });

        expect(result.phaseKey).toBe('tutorial-setup');
        expect(result.critical).toEqual([]);
        expect(result.warm).toEqual([]);
    });

    it('playing 阶段仅加载 I 牌组关键图', () => {
        const result = cardiaCriticalImageResolver({
            core: { deckVariant: 'I' },
            sys: { tutorial: { active: false } },
        });

        expect(result.phaseKey).toBe('playing:I');
        expect(result.critical).toContain(CARDIA_IMAGE_PATHS.DECK1_BACK);
        expect(result.critical).toContain('cardia/cards/deck1/1');
        expect(result.critical).toContain('cardia/cards/deck1/16');
        expect(result.critical).not.toContain('cardia/cards/deck2/1');
        expect(result.warm).toContain('cardia/cards/locations/1');
        expect(result.warm).toContain('cardia/cards/locations/8');
        expect(result.critical).toHaveLength(17);
        expect(result.warm).toHaveLength(8);
    });

    it('playing 阶段仅加载 II 牌组关键图', () => {
        const result = cardiaCriticalImageResolver({
            core: { deckVariant: 'II' },
            sys: { tutorial: { active: false } },
        });

        expect(result.phaseKey).toBe('playing:II');
        expect(result.critical).toContain(CARDIA_IMAGE_PATHS.DECK1_BACK);
        expect(result.critical).toContain('cardia/cards/deck2/1');
        expect(result.critical).toContain('cardia/cards/deck2/16');
        expect(result.critical).not.toContain('cardia/cards/deck1/1');
        expect(result.warm).toContain('cardia/cards/locations/1');
        expect(result.warm).toContain('cardia/cards/locations/8');
        expect(result.critical).toHaveLength(17);
        expect(result.warm).toHaveLength(8);
    });
});
