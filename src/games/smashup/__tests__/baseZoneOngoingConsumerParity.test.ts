import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BaseZone ongoing consumer parity', () => {
    it('主 BaseZone 应按 sourceControllerId ?? ownerId 识别 ongoing 控制者', () => {
        const baseZoneSource = readFileSync(resolve(__dirname, '../ui/BaseZone.tsx'), 'utf-8');

        expect(baseZoneSource).toContain('sourceControllerId');
        expect(baseZoneSource).toContain('?? oa.ownerId');
        expect(baseZoneSource).not.toContain('PLAYER_CONFIG[parseInt(oa.ownerId) % PLAYER_CONFIG.length]');
        expect(baseZoneSource).not.toContain('}, oa.ownerId);');
    });
});
