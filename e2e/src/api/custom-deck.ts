/**
 * 自定义牌组 API 客户端
 *
 * 提供与后端 /auth/custom-decks 端点的通信封装。
 * 遵循 user-settings.ts 的模式：接受 token 参数 + buildAuthHeaders。
 */

import { AUTH_API_URL } from '../config/server';
import type { SerializedCardEntry, SerializedCustomDeck } from '../games/summonerwars/config/deckSerializer';
import type { FactionId } from '../games/summonerwars/domain/types';
import i18n from '../lib/i18n';

// ============================================================================
// 类型定义
// ============================================================================

/** 已保存牌组摘要（列表展示用） */
export interface SavedDeckSummary {
    id: string;
    name: string;
    summonerId: string;
    summonerFaction: string;
    cardCount: number;
    updatedAt: string;
    freeMode: boolean;
}

/** 创建/更新牌组的请求体 */
export interface CustomDeckPayload {
    name: string;
    summonerId: string;
    summonerFaction: string;
    cards: SerializedCardEntry[];
    freeMode?: boolean;
}

// ============================================================================
// 内部辅助
// ============================================================================

const BASE_URL = `${AUTH_API_URL}/custom-decks`;

/** 构建带认证的请求头 */
const buildAuthHeaders = (token: string) => ({
    'Content-Type': 'application/json',
    'Accept-Language': i18n.language,
    'Authorization': `Bearer ${token}`,
});

/** 统一错误处理：解析后端错误消息并抛出 */
async function handleErrorResponse(response: Response): Promise<never> {
    const body = await response.json().catch(() => ({ error: '请求失败' })) as Record<string, unknown>;
    const message = (body.error as string | undefined)
        || (body.message as string | undefined)
        || '请求失败';
    throw new Error(message);
}

// ============================================================================
// API 方法
// ============================================================================

/**
 * 获取当前用户的所有自定义牌组列表
 */
export async function listCustomDecks(token: string): Promise<SavedDeckSummary[]> {
    const response = await fetch(BASE_URL, {
        method: 'GET',
        headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
        await handleErrorResponse(response);
    }

    const data = await response.json() as { decks: RawDeckDocument[] };
    return data.decks.map(mapToSummary);
}

/**
 * 获取单个自定义牌组详情
 */
export async function getCustomDeck(token: string, id: string): Promise<SerializedCustomDeck> {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'GET',
        headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
        await handleErrorResponse(response);
    }

    const doc = await response.json() as RawDeckDocument;
    return {
        id: doc._id,
        name: doc.name,
        summonerId: doc.summonerId,
        summonerFaction: doc.summonerFaction,
        cards: doc.cards,
        ...(doc.freeMode ? { freeMode: true } : {}),
    };
}

/**
 * 创建新的自定义牌组
 */
export async function createCustomDeck(
    token: string,
    data: CustomDeckPayload,
): Promise<{ id: string }> {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        await handleErrorResponse(response);
    }

    const doc = await response.json() as RawDeckDocument;
    return { id: doc._id };
}

/**
 * 更新已有的自定义牌组
 */
export async function updateCustomDeck(
    token: string,
    id: string,
    data: CustomDeckPayload,
): Promise<void> {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'PUT',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        await handleErrorResponse(response);
    }
}

/**
 * 删除自定义牌组
 */
export async function deleteCustomDeck(token: string, id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
        await handleErrorResponse(response);
    }
}

// ============================================================================
// 内部类型与映射
// ============================================================================

/** 后端返回的原始文档结构 */
interface RawDeckDocument {
    _id: string;
    ownerId: string;
    name: string;
    summonerId: string;
    summonerFaction: FactionId;
    cards: SerializedCardEntry[];
    freeMode?: boolean;
    createdAt: string;
    updatedAt: string;
}

/** 将后端文档映射为前端摘要类型 */
function mapToSummary(doc: RawDeckDocument): SavedDeckSummary {
    return {
        id: doc._id,
        name: doc.name,
        summonerId: doc.summonerId,
        summonerFaction: doc.summonerFaction,
        cardCount: doc.cards.reduce((sum, entry) => sum + entry.count, 0),
        updatedAt: doc.updatedAt,
        freeMode: doc.freeMode ?? false,
    };
}
