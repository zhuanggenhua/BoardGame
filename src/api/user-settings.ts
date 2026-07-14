import { AUTH_API_URL } from '../config/server';
import i18n from '../lib/i18n';
import type { LocalMatchPreferences } from '../engine/ai';

export type BgmSelections = Record<string, Record<string, string>>;
export type SmashUpInteractionMode = 'click' | 'drag';

export type AudioSettings = {
    muted: boolean;
    masterVolume: number;
    sfxVolume: number;
    bgmVolume: number;
    bgmSelections?: BgmSelections;
    singleTrackLoop?: boolean;
};

export type AudioSettingsResponse = {
    empty: boolean;
    settings: AudioSettings | null;
};

export type SmashUpPreference = {
    overlayEnabled: boolean;
    interactionMode: SmashUpInteractionMode;
};

export type SmashUpPreferenceResponse = {
    empty: boolean;
    settings: SmashUpPreference | null;
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

export const getSmashUpPreference = async (token: string): Promise<SmashUpPreferenceResponse> => {
    const response = await fetch(`${AUTH_API_URL}/user-settings/smashup`, {
        method: 'GET',
        headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '获取大杀四方设置失败' }));
        throw new Error(error.error || '获取大杀四方设置失败');
    }

    return response.json();
};

export const updateSmashUpPreference = async (token: string, settings: SmashUpPreference): Promise<SmashUpPreference> => {
    const response = await fetch(`${AUTH_API_URL}/user-settings/smashup`, {
        method: 'PUT',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(settings),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '更新大杀四方设置失败' }));
        throw new Error(error.error || '更新大杀四方设置失败');
    }

    const payload = await response.json() as { settings: SmashUpPreference };
    return payload.settings;
};

// ============================================================================
// UI 提示已读状态
// ============================================================================

export const getSeenHints = async (token: string): Promise<string[]> => {
    const response = await fetch(`${AUTH_API_URL}/user-settings/ui-hints`, {
        headers: buildAuthHeaders(token),
    });
    if (!response.ok) return [];
    const data = await response.json() as { seenHints: string[] };
    return data.seenHints ?? [];
};

export const markHintSeen = async (token: string, hintKey: string): Promise<void> => {
    await fetch(`${AUTH_API_URL}/user-settings/ui-hints/${encodeURIComponent(hintKey)}`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
    });
};

// ============================================================================
// 本地 AI 对局偏好
// ============================================================================

export type LocalMatchPreferencesResponse = {
    empty: boolean;
    settings: LocalMatchPreferences | null;
};

export const getLocalMatchPreferences = async (
    token: string,
    gameId: string,
): Promise<LocalMatchPreferencesResponse> => {
    const response = await fetch(`${AUTH_API_URL}/user-settings/local-ai/${encodeURIComponent(gameId)}`, {
        method: 'GET',
        headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '获取本地 AI 设置失败' }));
        throw new Error(error.error || '获取本地 AI 设置失败');
    }

    return response.json();
};

export const updateLocalMatchPreferences = async (
    token: string,
    gameId: string,
    settings: LocalMatchPreferences,
): Promise<LocalMatchPreferences> => {
    const response = await fetch(`${AUTH_API_URL}/user-settings/local-ai/${encodeURIComponent(gameId)}`, {
        method: 'PUT',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(settings),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '更新本地 AI 设置失败' }));
        throw new Error(error.error || '更新本地 AI 设置失败');
    }

    const payload = await response.json() as { settings: LocalMatchPreferences };
    return payload.settings;
};
