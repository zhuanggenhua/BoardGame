import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('borrowed talent consumer parity', () => {
    it('AI 与 Board consumer 都应按 sourceControllerId ?? ownerId 识别 borrowed ongoing talent', () => {
        const aiSource = readFileSync(resolve(__dirname, '../ai.ts'), 'utf-8');
        const e2eAiSource = readFileSync(resolve(__dirname, '../../../../e2e/src/games/smashup/ai.ts'), 'utf-8');
        const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8');
        const e2eBoardSource = readFileSync(resolve(__dirname, '../../../../e2e/src/games/smashup/Board.tsx'), 'utf-8');

        expect(aiSource).toContain('sourceControllerId?: string');
        expect(aiSource).toContain('?? ongoing.ownerId');
        expect(aiSource).toContain('?? attached.ownerId');
        expect(aiSource).not.toContain('if (ongoing.ownerId !== playerId) continue;');
        expect(aiSource).not.toContain('if (attached.ownerId !== playerId) continue;');

        expect(e2eAiSource).toContain('sourceControllerId?: string');
        expect(e2eAiSource).toContain('?? ongoing.ownerId');
        expect(e2eAiSource).toContain('?? attached.ownerId');
        expect(e2eAiSource).not.toContain('if (ongoing.ownerId !== playerId) continue;');
        expect(e2eAiSource).not.toContain('if (attached.ownerId !== playerId) continue;');

        expect(boardSource).toContain('sourceControllerId?: string');
        expect(boardSource).toContain('?? ongoing.ownerId');
        expect(boardSource).toContain('?? attachedAction.ownerId');
        expect(boardSource).not.toContain('if (ongoing.ownerId !== playerID) continue;');
        expect(boardSource).not.toContain('if (attachedAction.ownerId !== playerID) continue;');

        expect(e2eBoardSource).toContain('sourceControllerId?: string');
        expect(e2eBoardSource).toContain('?? ongoing.ownerId');
        expect(e2eBoardSource).toContain('?? attachedAction.ownerId');
        expect(e2eBoardSource).not.toContain('if (ongoing.ownerId !== playerID) continue;');
        expect(e2eBoardSource).not.toContain('if (attachedAction.ownerId !== playerID) continue;');
    });
});
