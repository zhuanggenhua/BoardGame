import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExternalRoomSettings, ExternalRoomSetup } from '../../../../../src/shared/externalRoom';

const invalidSetup = () => new Error('无效的 SDK 房间配置');
const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is string =>
    typeof value === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(value) && value !== 'constructor' && value !== 'prototype';
const isLabel = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= 80;

/** 房间配置随不可变的游戏版本发布，平台读取 JSON，无需运行游戏脚本。 */
export async function readExternalRoomSetup(directory: string): Promise<ExternalRoomSetup | undefined> {
    const path = join(directory, 'boardgame-room.json');
    const file = await stat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return undefined;
        throw error;
    });
    if (!file) return undefined;
    if (!file.isFile() || file.size > 16 * 1024) throw invalidSetup();
    const setup: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!isRecord(setup)) throw invalidSetup();
    const { playerCounts, fields = [] } = setup;
    if (!Array.isArray(playerCounts) || !playerCounts.length || playerCounts.length > 31
        || new Set(playerCounts).size !== playerCounts.length
        || !playerCounts.every(count => Number.isInteger(count) && count >= 2 && count <= 32)
        || !Array.isArray(fields) || fields.length > 12) throw invalidSetup();
    const normalized = fields.map((field: unknown) => {
        if (!isRecord(field)) throw invalidSetup();
        const { id, label, defaultValue, options } = field;
        if (!isId(id) || !isLabel(label) || !isLabel(defaultValue)
            || !Array.isArray(options) || !options.length || options.length > 16) throw invalidSetup();
        const choices = options.map((option: unknown) => {
            if (!isRecord(option) || !isLabel(option.value) || !isLabel(option.label)) throw invalidSetup();
            return { value: option.value, label: option.label };
        });
        if (new Set(choices.map(choice => choice.value)).size !== choices.length
            || !choices.some(choice => choice.value === defaultValue)) throw invalidSetup();
        return { id, label, defaultValue, options: choices };
    });
    if (new Set(normalized.map(field => field.id)).size !== normalized.length) throw invalidSetup();
    return { playerCounts: [...playerCounts].sort((a, b) => a - b), fields: normalized };
}

export function resolveExternalRoomSettings(setup: ExternalRoomSetup | undefined, input: unknown): ExternalRoomSettings | undefined {
    const submitted = input === undefined ? {} : input;
    const fields = setup?.fields ?? [];
    if (!isRecord(submitted) || Object.keys(submitted).some(id => !fields.some(field => field.id === id))) throw invalidSetup();
    if (!setup) return undefined;
    return Object.fromEntries(fields.map(field => {
        const value = Object.hasOwn(submitted, field.id) ? submitted[field.id] : field.defaultValue;
        if (typeof value !== 'string' || !field.options.some(option => option.value === value)) throw invalidSetup();
        return [field.id, value];
    }));
}
