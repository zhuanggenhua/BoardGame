import type { BoardLayoutConfig } from '../core/ui/board-layout.types';
import type {
    AbilitySlotLayoutItem,
    DiceThroneBoardShellTuningMap,
    DiceThronePlayerBoardLayoutVersion,
} from '../games/dicethrone/ui/abilitySlotLayout';
import { LAYOUT_API_URL } from '../config/server';

export type LayoutSaveResponse = {
    filePath: string;
    relativePath: string;
    bytes: number;
};

export type DiceThroneBoardLayoutPayload = {
    slotLayouts: Record<DiceThronePlayerBoardLayoutVersion, AbilitySlotLayoutItem[]>;
    uiTuning: DiceThroneBoardShellTuningMap;
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
    if (!payload) {
        throw new Error('layoutConfig.invalid');
    }
    return postLayout('/summonerwars', payload);
};

export const saveDiceThroneAbilityLayout = async (
    payload: DiceThroneBoardLayoutPayload
): Promise<LayoutSaveResponse> => {
    const body = JSON.stringify(payload);
    if (!body) {
        throw new Error('layoutConfig.invalid');
    }
    return postLayout('/dicethrone/ability-layout', body);
};
