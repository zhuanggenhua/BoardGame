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
 *   - 教程级 → 加入 TUTORIAL_ERROR_CODES，并在各游戏 game-<id>.json 补翻译
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
] as const;

// ── 教程级 error code（对应各游戏 game-<id>.json）────────────────────────────
//
// 来源文件：src/engine/systems/TutorialSystem.ts → TUTORIAL_ERRORS
//   tutorial_manifest_invalid, tutorial_command_blocked, tutorial_step_locked

const TUTORIAL_ERROR_CODES = [
    'tutorial_manifest_invalid',
    'tutorial_command_blocked',
    'tutorial_step_locked',
] as const;

// 已启用教程的游戏（game-<id>.json 中需要有教程 error 翻译）
const TUTORIAL_GAME_IDS = ['dicethrone', 'summonerwars', 'smashup'] as const;

// ── 游戏专属 error code（对应各游戏 game-<id>.json）──────────────────────────
//
// 静态扫描同样无法覆盖这些 code，在此集中维护。
// 新增游戏 error code 时，在对应游戏的数组中追加，并在 game-<id>.json 补翻译。

const DICETHRONE_ERROR_CODES = [
    // commandValidation.ts
    'roll_limit_reached',
    'defense_ability_not_selected',
    'unsupported_character',
    'roll_already_confirmed',
    'die_not_found',
    'no_roll_yet',
    'no_pending_attack',
    'ability_not_available',
    'roll_not_confirmed',
    'deck_empty',
    'card_not_in_hand',
    'no_card_to_undo',
    'card_not_in_discard',
    'cannot_advance_phase',
    'no_pending_interaction',
    'invalid_die_value',
    'no_pending_damage',
    'unknown_token',
    'no_token',
    'invalid_amount',
    'no_status',
    'no_knockdown',
    'not_enough_cp',
    'no_pending_bonus_dice',
    'bonus_reroll_limit_reached',
    'not_enough_token',
    'invalid_die_index',
    'attack_already_initiated',
    // flowHooks.ts
    // 'cannot_advance_phase' 已在上方
] as const;

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

    describe('教程 error code → game-<id>.json', () => {
        for (const gameId of TUTORIAL_GAME_IDS) {
            for (const lang of LANGS) {
                const data = loadJson(lang, `game-${gameId}`);
                for (const code of TUTORIAL_ERROR_CODES) {
                    it(`[${lang}][${gameId}] error.${code}`, () => {
                        expect(
                            hasKey(data, `error.${code}`),
                            `缺少翻译：public/locales/${lang}/game-${gameId}.json → error.${code}`,
                        ).toBe(true);
                    });
                }
            }
        }
    });

    describe('dicethrone 专属 error code → game-dicethrone.json', () => {
        for (const lang of LANGS) {
            const data = loadJson(lang, 'game-dicethrone');
            for (const code of DICETHRONE_ERROR_CODES) {
                it(`[${lang}] error.${code}`, () => {
                    expect(
                        hasKey(data, `error.${code}`),
                        `缺少翻译：public/locales/${lang}/game-dicethrone.json → error.${code}`,
                    ).toBe(true);
                });
            }
        }
    });
});
