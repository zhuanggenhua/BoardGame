import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ongoingEffects mirror parity', () => {
    it('ongoingEffects 应保持 borrowed controller-aware source 与 restriction consumer', () => {
        const source = readFileSync(resolve(__dirname, '../domain/ongoingEffects.ts'), 'utf-8');

        expect(source).toContain('controllerId: metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? ongoing.ownerId');
        expect(source).toContain('controllerId: metadata?.sourceControllerId ?? metadata?.sourcePlayerId ?? attached.ownerId');
        expect(source).toContain("(o.metadata?.sourceControllerId ?? o.ownerId) === playerId && o.defId === 'ninja_infiltrate'");
        expect(source).toContain("const blockActions = base.ongoingActions.filter(o => matchesDefId(o.defId, 'trickster_block_the_path'));");

        expect(source).not.toContain('controllerId: ongoing.ownerId');
        expect(source).not.toContain('controllerId: attached.ownerId');
        expect(source).not.toContain("o.ownerId === playerId && o.defId === 'ninja_infiltrate'");
        expect(source).not.toContain("const blockAction = base.ongoingActions.find(o => matchesDefId(o.defId, 'trickster_block_the_path'));");
    });
});
