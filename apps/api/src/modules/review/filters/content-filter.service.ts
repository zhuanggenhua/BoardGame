import { Injectable } from '@nestjs/common';

const parseBlacklist = (raw: string | undefined): string[] => {
    if (!raw) return [];
    return raw
        .split(',')
        .map(word => word.trim().toLowerCase())
        .filter(Boolean);
};

@Injectable()
export class ContentFilterService {
    private readonly blacklist: string[];

    constructor() {
        this.blacklist = parseBlacklist(process.env.REVIEW_CONTENT_BLACKLIST);
    }

    validate(content?: string | null): boolean {
        if (!content) return true;
        const lower = content.toLowerCase();
        return !this.blacklist.some(word => lower.includes(word));
    }
}
