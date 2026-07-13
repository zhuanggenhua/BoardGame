import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('playConstraint UI parity', () => {
    it('主 Board 不应在 UI 层私自解释 playConstraint', () => {
        const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8');

        expect(boardSource).toContain('collectLegalActionPlayTargets');
        expect(boardSource).not.toContain('checkPlayConstraintUI');
        expect(boardSource).not.toContain("constraint === 'requireOwnMinion'");
        expect(boardSource).not.toContain('m.owner === playerId');
    });
});
