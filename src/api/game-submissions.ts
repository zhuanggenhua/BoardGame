import { UGC_API_URL } from '../config/server';

export interface GameSubmissionDraft {
    name: string;
    url: string;
    category: string;
    minPlayers: number;
    maxPlayers: number;
    durationMinutes?: number;
    author: string;
    description: string;
    rules: string;
}
export interface GameSubmissionRecord extends GameSubmissionDraft {
    submissionId: string;
    coverUrl: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    reviewComment: string;
    updatedAt: string;
}
async function request<T>(token: string, path: string, method = 'GET', data?: GameSubmissionDraft | FormData): Promise<T> {
    const multipart = data instanceof FormData;
    const response = await fetch(`${UGC_API_URL}/submissions${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) },
        ...(data ? { body: multipart ? data : JSON.stringify(data) } : {}),
    });
    const body = await response.json();
    if (!response.ok) {
        const message = Array.isArray(body.message) ? body.message.join('；') : body.message || body.error;
        throw new Error(typeof message === 'string' ? message : `投稿请求失败（${response.status}）`);
    }
    return body as T;
}
export const listGameSubmissions = (token: string) => request<{ items: GameSubmissionRecord[] }>(token, '');
export const saveGameSubmission = (token: string, data: GameSubmissionDraft, id?: string) => request<GameSubmissionRecord>(token, id ? `/${encodeURIComponent(id)}` : '', id ? 'PUT' : 'POST', data);
export const submitGameSubmission = (token: string, id: string) => request<GameSubmissionRecord>(token, `/${encodeURIComponent(id)}/submit`, 'POST');
export const uploadSubmissionCover = (token: string, id: string, file: File) => {
    const form = new FormData(); form.append('file', file);
    return request<{ coverUrl: string }>(token, `/${encodeURIComponent(id)}/cover`, 'POST', form);
};
