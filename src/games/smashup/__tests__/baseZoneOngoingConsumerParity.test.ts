import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BaseZone ongoing consumer parity', () => {
    it('主 BaseZone 与 e2e BaseZone 都应按 sourceControllerId ?? ownerId 识别 ongoing 控制者', () => {
        const baseZoneSource = readFileSync(resolve(__dirname, '../ui/BaseZone.tsx'), 'utf-8');
        const e2eBaseZoneSource = readFileSync(resolve(__dirname, '../../../../e2e/src/games/smashup/ui/BaseZone.tsx'), 'utf-8');

        for (const source of [baseZoneSource, e2eBaseZoneSource]) {
            expect(source).toContain('sourceControllerId');
            expect(source).toContain('?? oa.ownerId');
            expect(source).not.toContain('PLAYER_CONFIG[parseInt(oa.ownerId) % PLAYER_CONFIG.length]');
            expect(source).not.toContain('}, oa.ownerId);');
        }
    });
});
