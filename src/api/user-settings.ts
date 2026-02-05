import { AUTH_API_URL } from '../config/server';
import i18n from '../lib/i18n';

export type AudioSettings = {
    muted: boolean;
    masterVolume: number;
    sfxVolume: number;
    bgmVolume: number;
};

export type AudioSettingsResponse = {
    empty: boolean;
    settings: AudioSettings | null;
};

const buildAuthHeaders = (token: string) => ({
    'Content-Type': 'application/json',
    'Accept-Language': i18n.language,
    'Authorization': `Bearer ${token}`,
});

export const getAudioSettings = async (token: string): Promise<AudioSettingsResponse> => {
    const response = await fetch(`${AUTH_API_URL}/user-settings/audio`, {
        method: 'GET',
        headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '获取音频设置失败' }));
        throw new Error(error.error || '获取音频设置失败');
    }

    return response.json();
};

export const updateAudioSettings = async (token: string, settings: AudioSettings): Promise<AudioSettings> => {
    const response = await fetch(`${AUTH_API_URL}/user-settings/audio`, {
        method: 'PUT',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(settings),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '更新音频设置失败' }));
        throw new Error(error.error || '更新音频设置失败');
    }

    const payload = await response.json() as { settings: AudioSettings };
    return payload.settings;
};
