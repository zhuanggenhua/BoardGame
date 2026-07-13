import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
    getAudioSettings,
    getLocalMatchPreferences,
    updateAudioSettings,
    updateLocalMatchPreferences,
} from '../user-settings';
import { AUTH_API_URL } from '../../config/server';

const mockFetch = vi.fn();

describe('user-settings api', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        (globalThis as { fetch?: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
        mockFetch.mockReset();
    });

    it('getAudioSettings 请求成功', async () => {
        const responsePayload = { empty: true, settings: null };
        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(responsePayload),
        });

        const result = await getAudioSettings('token-123');

        expect(result).toEqual(responsePayload);
        expect(mockFetch).toHaveBeenCalledWith(`${AUTH_API_URL}/user-settings/audio`, expect.objectContaining({
            method: 'GET',
        }));
    });

    it('updateAudioSettings 请求成功', async () => {
        const settings = {
            muted: false,
            masterVolume: 0.8,
            sfxVolume: 0.6,
            bgmVolume: 0.4,
            singleTrackLoop: true,
            bgmSelections: {
                summonerwars: { normal: 'bgm_key_a', battle: 'bgm_key_b' },
            },
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ settings }),
        });

        const result = await updateAudioSettings('token-123', settings);

        expect(result).toEqual(settings);
        expect(mockFetch).toHaveBeenCalledWith(`${AUTH_API_URL}/user-settings/audio`, expect.objectContaining({
            method: 'PUT',
        }));
    });

    it('getAudioSettings 请求失败抛错', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({ error: 'bad' }),
        });

        await expect(getAudioSettings('token-123')).rejects.toThrow('bad');
    });

    it('getLocalMatchPreferences 请求成功', async () => {
        const responsePayload = {
            empty: false,
            settings: {
                numPlayers: 3,
                minimumActionDelayMs: 2000,
                seatControllers: { '1': { type: 'local-ai' } },
                setupSelections: { expansions: ['titans'] },
            },
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(responsePayload),
        });

        const result = await getLocalMatchPreferences('token-123', 'smashup');

        expect(result).toEqual(responsePayload);
        expect(mockFetch).toHaveBeenCalledWith(
            `${AUTH_API_URL}/user-settings/local-ai/smashup`,
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('updateLocalMatchPreferences 请求成功', async () => {
        const settings = {
            numPlayers: 4,
            minimumActionDelayMs: 3000,
            seatControllers: {
                '1': { type: 'local-ai', policyId: 'opening-v1' },
                '2': { type: 'human' },
            },
            setupSelections: {
                expansions: [],
            },
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ settings }),
        });

        const result = await updateLocalMatchPreferences('token-123', 'smashup', settings);

        expect(result).toEqual(settings);
        expect(mockFetch).toHaveBeenCalledWith(
            `${AUTH_API_URL}/user-settings/local-ai/smashup`,
            expect.objectContaining({ method: 'PUT' }),
        );
    });
});
