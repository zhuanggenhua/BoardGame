import { describe, expect, it } from 'vitest';
import {
    getEntityRelationHighlightTone,
    resolveEntityRelation,
} from '../factionRelations';

describe('factionRelations', () => {
    it('resolves self before side relation', () => {
        expect(resolveEntityRelation({
            actorEntityId: 'unit:1',
            actorSideId: 'blue',
            targetEntityId: 'unit:1',
            targetSideId: 'red',
        })).toBe('self');
    });

    it('resolves same side and configured allies as friendly', () => {
        expect(resolveEntityRelation({
            actorEntityId: 'unit:1',
            actorSideId: 'blue',
            targetEntityId: 'unit:2',
            targetSideId: 'blue',
        })).toBe('ally');

        expect(resolveEntityRelation({
            actorSideId: 'blue',
            targetSideId: 'green',
            alliedSidePairs: [['blue', 'green']],
        })).toBe('ally');
    });

    it('keeps different known sides unknown unless a default relation is supplied', () => {
        expect(resolveEntityRelation({
            actorSideId: 'heroes',
            targetSideId: 'traitor',
        })).toBe('unknown');

        expect(resolveEntityRelation({
            actorSideId: 'heroes',
            targetSideId: 'traitor',
            defaultRelation: 'enemy',
        })).toBe('enemy');
    });

    it('supports neutral and unknown sides', () => {
        expect(resolveEntityRelation({
            actorSideId: 'heroes',
            targetSideId: 'bystanders',
            neutralSideIds: ['bystanders'],
        })).toBe('neutral');

        expect(resolveEntityRelation({
            actorSideId: 'heroes',
            targetSideId: null,
        })).toBe('unknown');
    });

    it('maps relations to highlight tones', () => {
        expect(getEntityRelationHighlightTone('enemy')).toBe('hostile');
        expect(getEntityRelationHighlightTone('ally')).toBe('friendly');
        expect(getEntityRelationHighlightTone('self')).toBe('friendly');
        expect(getEntityRelationHighlightTone('neutral')).toBe('neutral');
        expect(getEntityRelationHighlightTone('unknown')).toBe('unknown');
    });
});
