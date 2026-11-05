import { AUTH_API_URL } from '../config/server';

export interface UserLibrary { gameIds: string[]; }

async function requestLibrary(token: string, update?: { gameId: string; favorite: boolean }): Promise<UserLibrary> {
    const response = await fetch(`${AUTH_API_URL}/user-settings/library`, {
        method: update ? 'PUT' : 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(update ? { body: JSON.stringify(update) } : {}),
    });
    if (!response.ok) throw new Error(`收藏库请求失败（${response.status}）`);
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('gameIds' in result) || !Array.isArray(result.gameIds)
        || !result.gameIds.every(id => typeof id === 'string')) throw new Error('收藏库响应格式不正确');
    return { gameIds: result.gameIds };
}

export const getUserLibrary = (token: string) => requestLibrary(token);
export const setUserFavorite = (token: string, gameId: string, favorite: boolean) => requestLibrary(token, { gameId, favorite });
