import { BadRequestException } from '@nestjs/common';
import type { ExternalGameFields } from '../../../../../src/shared/externalGames';
import { parseExternalUrl } from '../../../../../src/shared/externalGames';

type GameFieldInput = Pick<ExternalGameFields, 'url'> & Partial<ExternalGameFields>;

export function validateExternalDetails(data: Partial<ExternalGameFields>) {
    if ((data.minPlayers == null) !== (data.maxPlayers == null)) throw new BadRequestException('请同时填写最少和最多人数，或同时留空');
    if (data.minPlayers != null && data.maxPlayers != null && data.minPlayers > data.maxPlayers) throw new BadRequestException('最少人数不能大于最多人数');
    if (data.authorProfileUrl) validateExternalUrl(data.authorProfileUrl);
}

export function validateExternalFields(data: GameFieldInput) {
    validateExternalDetails(data);
    validateExternalUrl(data.url);
}

function validateExternalUrl(url: string) {
    try { parseExternalUrl(url); } catch (error) { throw new BadRequestException((error as Error).message); }
}

/** 明确挑选公开可编辑字段，禁止把权限/审核/统计从请求透传进文档。 */
export function editableGameFields(data: GameFieldInput, webZipName?: string): ExternalGameFields {
    validateExternalFields(data);
    const fallbackName = webZipName?.replace(/\.zip$/i, '').trim() || new URL(data.url).hostname;
    return {
        name: data.name?.trim() || Array.from(fallbackName).slice(0, 100).join(''), url: data.url.trim(), category: data.category ?? 'uncategorized',
        minPlayers: data.minPlayers ?? undefined, maxPlayers: data.maxPlayers ?? undefined, durationMinutes: data.durationMinutes ?? undefined,
        author: data.author?.trim() ?? '', authorProfileUrl: data.authorProfileUrl?.trim() ?? '',
        description: data.description?.trim() ?? '', rules: data.rules ?? '',
    };
}

/** 清空可选字段时必须真的移除旧值，避免重新编辑后保留过期人数或时长。 */
export function gameFieldsUpdate(data: GameFieldInput, webZipName?: string) {
    const fields = editableGameFields(data, webZipName);
    const { minPlayers, maxPlayers, durationMinutes, ...required } = fields;
    return {
        $set: { ...required, ...(minPlayers == null ? {} : { minPlayers }), ...(maxPlayers == null ? {} : { maxPlayers }),
            ...(durationMinutes == null ? {} : { durationMinutes }) },
        $unset: { ...(minPlayers == null ? { minPlayers: 1 } : {}), ...(maxPlayers == null ? { maxPlayers: 1 } : {}),
            ...(durationMinutes == null ? { durationMinutes: 1 } : {}) },
    };
}
