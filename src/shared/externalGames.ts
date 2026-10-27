/** 外链目录的公开字段；不承载本站领域引擎或建房配置。 */
export interface ExternalGameFields {
    name: string;
    url: string;
    category: string;
    minPlayers?: number;
    maxPlayers?: number;
    durationMinutes?: number;
    author: string;
    authorProfileUrl?: string;
    description: string;
    rules: string;
}
export type EmbedStatus = 'unknown' | 'allowed' | 'blocked';
export interface ExternalGame extends ExternalGameFields {
    gameId: string;
    coverUrl: string;
    published: boolean;
    embedStatus: EmbedStatus;
    embedReason: string;
    embedCheckedUrl?: string;
    embedCheckedAt?: string;
    ownerUserId: string | null;
    updatedAt: string;
}
export type ClaimStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export interface CreatorClaim {
    claimId: string;
    gameId: string;
    applicantId: string;
    applicantName?: string;
    profileUrl: string;
    explanation: string;
    verificationCode: string;
    verificationExpiresAt: string;
    hasEvidence: boolean;
    evidenceDigest: string;
    status: ClaimStatus;
    reviewComment: string;
    updatedAt: string;
}
export interface ExternalPlayHistory {
    totalSeconds: number;
    items: Array<{ gameId: string; name: string; seconds: number; lastPlayedAt: string }>;
}

/** 不允许凭 URL 注入脚本或用户名密码；浏览器自身不对外站代理请求。 */
export function parseExternalUrl(value: string): URL {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('请填写完整的网址'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('仅支持不含账号密码的 HTTP(S) 网址');
    return url;
}

export function mergeTimeRanges(ranges: Array<{ start: number; end: number }>): number {
    const sorted = ranges.filter(range => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
        .sort((a, b) => a.start - b.start);
    let total = 0; let end = -Infinity;
    for (const range of sorted) {
        total += Math.max(0, range.end - Math.max(end, range.start));
        end = Math.max(end, range.end);
    }
    return total;
}
