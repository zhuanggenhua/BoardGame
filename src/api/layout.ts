import type { BoardLayoutConfig } from '../core/ui/board-layout.types';
import type { AbilitySlotLayoutItem } from '../games/dicethrone/ui/abilitySlotLayout';
import { LAYOUT_API_URL } from '../config/server';

export type LayoutSaveResponse = {
    filePath: string;
    relativePath: string;
    bytes: number;
};

const resolveLayoutPath = (url: string) => {
    try {
        return new URL(url).pathname;
    } catch {
        return url;
    }
};

const parseLayoutErrorMessage = (response: Response, rawText: string) => {
    if (response.status === 404) {
        const path = resolveLayoutPath(response.url || '');
        return `布局保存接口不存在（${path || 'layout'}），请确认 apps/api 已启动并重启。`;
    }
    if (response.status === 403) {
        return '布局保存已禁用，请确认 LAYOUT_SAVE_ALLOW=1。';
    }
    let parsed: Record<string, unknown> = {};
    if (rawText) {
        try {
            parsed = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
            parsed = {};
        }
    }
    return (
        (parsed?.message as string | undefined)
        || (parsed?.error as string | undefined)
        || rawText
        || '布局保存失败'
    );
};

const postLayout = async (path: string, payload: string): Promise<LayoutSaveResponse> => {
    const response = await fetch(`${LAYOUT_API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: payload,
    });
    if (!response.ok) {
        const rawText = await response.text().catch(() => '');
        throw new Error(parseLayoutErrorMessage(response, rawText));
    }
    return response.json();
};

export const saveSummonerWarsLayout = async (config: BoardLayoutConfig): Promise<LayoutSaveResponse> => {
    const payload = JSON.stringify(config);
    // TODO: 调试布局保存后移除日志（确认 400 根因后删除）
    const gridInfo = config?.grid
        ? `rows=${config.grid.rows} cols=${config.grid.cols}`
        : 'none';
    console.log(`[LayoutSave] request url=${LAYOUT_API_URL}/summonerwars payloadBytes=${payload?.length ?? 0} version=${config?.version ?? 'none'} grid=${gridInfo} zones=${config?.zones?.length ?? 0} tracks=${config?.tracks?.length ?? 0} stacks=${config?.stackPoints?.length ?? 0}`);
    if (!payload) {
        throw new Error('layoutConfig.invalid');
    }
    return postLayout('/summonerwars', payload);
};

export const saveDiceThroneAbilityLayout = async (
    layout: AbilitySlotLayoutItem[]
): Promise<LayoutSaveResponse> => {
    const payload = JSON.stringify(layout);
    if (!payload) {
        throw new Error('layoutConfig.invalid');
    }
    return postLayout('/dicethrone/ability-layout', payload);
};
