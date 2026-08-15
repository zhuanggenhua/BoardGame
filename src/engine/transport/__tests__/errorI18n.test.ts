/**
 * 引擎 error code 国际化完整性测试
 *
 * 背景：resolveCommandError 用动态拼接 `error.${code}` 查 i18n，
 * 静态扫描工具（i18n-check）无法覆盖此类动态 key。
 * 本测试作为补充，枚举所有引擎/系统产生的 error code，
 * 断言它们在 zh-CN 和 en 的对应 namespace 中均有翻译。
 *
 * 新增 error code 时：
 *   - 引擎/系统级 → 加入 ENGINE_ERROR_CODES，并在 game.json 补翻译
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { resolveCommandError } from '../errorI18n';

// ── 辅助 ──────────────────────────────────────────────────────────────────────

const LOCALES_ROOT = resolve(__dirname, '../../../../public/locales');

function loadJson(lang: string, ns: string): Record<string, unknown> {
    const path = resolve(LOCALES_ROOT, lang, `${ns}.json`);
    return JSON.parse(readFileSync(path, 'utf-8'));
}

/** 支持点号路径，如 "error.player_mismatch" */
function hasKey(obj: Record<string, unknown>, dotPath: string): boolean {
    const parts = dotPath.split('.');
    let cur: unknown = obj;
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object') return false;
        cur = (cur as Record<string, unknown>)[part];
    }
    return cur !== undefined;
}

const LANGS = ['zh-CN', 'en'] as const;

// ── 引擎/系统级 error code（对应 game.json）────────────────────────────────────
//
// 来源文件：
//   src/engine/systems/FlowSystem.ts          → player_mismatch, not_active_player
//   src/engine/systems/UndoSystem.ts          → player_mismatch
//   src/engine/systems/ResponseWindowSystem.ts→ player_mismatch
//   src/engine/systems/RematchSystem.ts       → player_mismatch
//   src/engine/systems/CharacterSelectionSystem.ts
//     → character_selection_not_initialized, player_mismatch,
//       invalid_phase, invalid_character, character_not_selected
//   game.json 已有：command_failed

const ENGINE_ERROR_CODES = [
    'player_mismatch',
    'not_active_player',
    'invalid_phase',
    'invalid_character',
    'character_not_selected',
    'character_selection_not_initialized',
    'command_failed',
    'not_connected',
] as const;

function createMockI18n(nsData: Record<string, Record<string, string>>) {
    return {
        exists: (key: string, options?: { ns?: string }) => {
            const ns = options?.ns ?? 'game';
            return nsData[ns]?.[key] !== undefined;
        },
        t: (key: string, options?: { ns?: string }) => {
            const ns = options?.ns ?? 'game';
            return nsData[ns]?.[key] ?? key;
        },
    } as any;
}

// ── 测试 ──────────────────────────────────────────────────────────────────────

describe('引擎 error code 国际化完整性', () => {
    describe('通用引擎 error code → game.json', () => {
        for (const lang of LANGS) {
            const data = loadJson(lang, 'game');
            for (const code of ENGINE_ERROR_CODES) {
                it(`[${lang}] error.${code}`, () => {
                    expect(
                        hasKey(data, `error.${code}`),
                        `缺少翻译：public/locales/${lang}/game.json → error.${code}`,
                    ).toBe(true);
                });
            }
        }
    });

    describe('resolveCommandError 泛化错误码展示策略', () => {
        const mockI18n = createMockI18n({
            game: {
                'error.pipeline_error': '命令执行异常，请稍后重试',
                'error.command_failed': '命令执行失败',
                'error.invalid_phase': '当前阶段不允许此操作',
            },
        });

        it('裸 pipeline_error / command_failed 不再翻成泛提示，而是保留错误码本身', () => {
            expect(resolveCommandError(mockI18n, 'pipeline_error')).toBe('pipeline_error');
            expect(resolveCommandError(mockI18n, 'command_failed')).toBe('command_failed');
        });

        it('带细节的 pipeline_error 保持原始详情字符串', () => {
            expect(resolveCommandError(mockI18n, 'pipeline_error: 能力声明缺失')).toBe(
                'pipeline_error: 能力声明缺失',
            );
        });

        it('非泛化错误码仍按 i18n 翻译', () => {
            expect(resolveCommandError(mockI18n, 'invalid_phase')).toBe('当前阶段不允许此操作');
        });
    });
});
