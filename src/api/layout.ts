import type { BoardLayoutConfig } from '../core/ui/board-layout.types';
import { LAYOUT_API_URL } from '../config/server';

export type LayoutSaveResponse = {
    filePath: string;
    relativePath: string;
    bytes: number;
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
    const response = await fetch(`${LAYOUT_API_URL}/summonerwars`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: payload,
    });
    if (!response.ok) {
        const rawText = await response.text().catch(() => '');
        // TODO: 调试布局保存后移除日志（确认 400 根因后删除）
        console.log(`[LayoutSave] response status=${response.status} ok=${response.ok} bodyBytes=${rawText.length}`);
        if (rawText) {
            console.log(`[LayoutSave] response body=${rawText.slice(0, 800)}`);
        }
        let parsed: Record<string, unknown> = {};
        if (rawText) {
            try {
                parsed = JSON.parse(rawText) as Record<string, unknown>;
            } catch {
                parsed = {};
            }
        }
        const message =
            (parsed?.message as string | undefined)
            || (parsed?.error as string | undefined)
            || rawText
            || '布局保存失败';
        throw new Error(message);
    }
    return response.json();
};
