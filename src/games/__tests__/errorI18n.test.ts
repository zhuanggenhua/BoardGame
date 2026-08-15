import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const LOCALES_ROOT = resolve(__dirname, '../../../public/locales');

function loadJson(lang: string, ns: string): Record<string, unknown> {
    const path = resolve(LOCALES_ROOT, lang, `${ns}.json`);
    return JSON.parse(readFileSync(path, 'utf-8'));
}

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

// 来源文件：src/engine/systems/TutorialSystem.ts → TUTORIAL_ERRORS
const TUTORIAL_ERROR_CODES = [
    'tutorial_manifest_invalid',
    'tutorial_command_blocked',
    'tutorial_step_locked',
] as const;

const TUTORIAL_GAME_IDS = ['dicethrone', 'summonerwars', 'smashup', 'fantasyrealms'] as const;

const DICETHRONE_ERROR_CODES = [
    'game_over',
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
    'attackModifierRequiresSelectedAttack',
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
] as const;

describe('游戏 error code 国际化完整性', () => {
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
