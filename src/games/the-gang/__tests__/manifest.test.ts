import { describe, expect, test } from 'vitest';
import { THE_GANG_MANIFEST } from '../manifest';
import { audioConfig, engineConfig } from '../game';
import { THE_GANG_AUDIO_CONFIG } from '../audio.config';

describe('The Gang manifest', () => {
    test('声明注册表必需字段', () => {
        expect(THE_GANG_MANIFEST.id).toBe('the-gang');
        expect(THE_GANG_MANIFEST.enabled).toBe(true);
        expect(THE_GANG_MANIFEST.mobileProfile).toBe('landscape-adapted');
        expect(THE_GANG_MANIFEST.shellTargets).toContain('pwa');
        expect(THE_GANG_MANIFEST.ai).toEqual({
            capture: true,
            localAi: true,
            remoteAi: false,
        });
        expect(engineConfig.gameId).toBe('the-gang');
        expect(audioConfig).toBe(THE_GANG_AUDIO_CONFIG);
    });
});
