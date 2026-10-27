import { UGC_API_URL } from '../config/server';
import type { CreatorClaim, ExternalGame, ExternalGameFields, ExternalPlayHistory } from '../shared/externalGames';
import type { GameSubmissionRecord } from './game-submissions';

async function request<T>(path: string, options: { token?: string; method?: string; data?: unknown; keepalive?: boolean } = {}): Promise<T> {
    const multipart = options.data instanceof FormData;
    const response = await fetch(`${UGC_API_URL}${path}`, {
        method: options.method ?? 'GET',
        headers: { ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
            ...(options.data && !multipart ? { 'Content-Type': 'application/json' } : {}) },
        ...(options.data ? { body: multipart ? options.data as FormData : JSON.stringify(options.data) } : {}),
        keepalive: options.keepalive,
    });
    const body = await response.json();
    if (!response.ok) {
        const message = Array.isArray(body.message) ? body.message.join('；') : body.message || body.error;
        throw new Error(typeof message === 'string' ? message : `请求失败（${response.status}）`);
    }
    return body as T;
}
const id = (value: string) => encodeURIComponent(value);
const upload = (file: File) => { const data = new FormData(); data.append('file', file); return data; };
export const listExternalGames = () => request<{ items: ExternalGame[] }>('/external-games');
export const getExternalGame = (gameId: string) => request<ExternalGame>(`/external-games/${id(gameId)}`);
export const getOwnedGame = (token: string, gameId: string) => request<ExternalGame>(`/external-games/mine/${id(gameId)}`, { token });
export const listOwnedGames = (token: string) => request<{ items: ExternalGame[] }>('/external-games/mine', { token });
export const updateOwnedGame = (token: string, gameId: string, data: ExternalGameFields & { published: boolean }) =>
    request<ExternalGame>(`/external-games/${id(gameId)}`, { token, method: 'PUT', data });
export const uploadOwnedCover = (token: string, gameId: string, file: File) =>
    request<{ coverUrl: string }>(`/external-games/${id(gameId)}/cover`, { token, method: 'POST', data: upload(file) });
export const listCreatorClaims = (token: string) => request<{ items: CreatorClaim[] }>('/creator-claims', { token });
export const createCreatorClaim = (token: string, data: { gameId: string; profileUrl: string; explanation: string }) =>
    request<CreatorClaim>('/creator-claims', { token, method: 'POST', data });
export const uploadClaimEvidence = (token: string, claimId: string, file: File) =>
    request<CreatorClaim>(`/creator-claims/${id(claimId)}/evidence`, { token, method: 'POST', data: upload(file) });
export const submitCreatorClaim = (token: string, claimId: string) => request<CreatorClaim>(`/creator-claims/${id(claimId)}/submit`, { token, method: 'POST' });
export const withdrawCreatorClaim = (token: string, claimId: string) => request<CreatorClaim>(`/creator-claims/${id(claimId)}/withdraw`, { token, method: 'POST' });
export const startExternalSession = (token: string, gameId: string) => request<{ sessionId: string }>(`/external-games/${id(gameId)}/sessions`, { token, method: 'POST' });
export const updateExternalSession = (token: string, sessionId: string, data: { sequence: number; active: boolean; elapsedMs: number; offsetMs: number; ended?: boolean }) =>
    request<{ accepted: boolean; duplicate?: boolean }>(`/external-games/sessions/${id(sessionId)}`, { token, method: 'PUT', data, keepalive: true });
export const getExternalHistory = (token: string) => request<ExternalPlayHistory>('/external-games/history', { token });
export interface CreatorReviewQueue { submissions: GameSubmissionRecord[]; claims: CreatorClaim[]; games: ExternalGame[]; }
export const getCreatorReviewQueue = (token: string) => request<CreatorReviewQueue>('/creator-review', { token });
export const reviewSubmission = (token: string, submissionId: string, data: { decision: 'approved' | 'rejected'; comment: string; revision: string }) =>
    request<GameSubmissionRecord>(`/creator-review/submissions/${id(submissionId)}`, { token, method: 'POST', data });
export const reviewClaim = (token: string, claimId: string, data: { decision: 'approved' | 'rejected'; comment: string; evidenceDigest: string; profileControlVerified: boolean; gameRelationshipVerified: boolean }) =>
    request<CreatorClaim>(`/creator-review/claims/${id(claimId)}`, { token, method: 'POST', data });
export const updateEmbedCheck = (token: string, gameId: string, data: { status: 'unknown' | 'allowed' | 'blocked'; reason: string; url: string }) =>
    request<ExternalGame>(`/creator-review/games/${id(gameId)}/embed`, { token, method: 'PUT', data });
export async function getClaimEvidence(token: string, claimId: string, admin = false) {
    const path = admin ? `/creator-review/claims/${id(claimId)}/evidence` : `/creator-claims/${id(claimId)}/evidence`;
    const response = await fetch(`${UGC_API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!response.ok) throw new Error('认证截图读取失败');
    return response.blob();
}
