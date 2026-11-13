/** 仅保留公开构建资源的指纹与位置，不保留 URL、查询参数或原始堆栈。 */
export interface SafeErrorLocation {
    bundle: string;
    line: number;
    column: number;
}

export function projectSafeErrorLocation(source: unknown, stored: unknown): SafeErrorLocation | undefined {
    if (typeof source === 'string') {
        const match = /^https:\/\/easyboardgame\.top\/assets\/[a-zA-Z0-9_.-]+-([a-zA-Z0-9_-]{8,16})\.js:(\d{1,7}):(\d{1,7})$/.exec(source);
        if (match) return { bundle: match[1], line: Number(match[2]), column: Number(match[3]) };
    }
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return undefined;
    const candidate = stored as Record<string, unknown>;
    if (typeof candidate.bundle !== 'string' || !/^[a-zA-Z0-9_-]{8,16}$/.test(candidate.bundle)
        || !Number.isInteger(candidate.line) || !Number.isInteger(candidate.column)
        || Number(candidate.line) < 0 || Number(candidate.line) > 9999999
        || Number(candidate.column) < 0 || Number(candidate.column) > 9999999) return undefined;
    return { bundle: candidate.bundle, line: candidate.line as number, column: candidate.column as number };
}
