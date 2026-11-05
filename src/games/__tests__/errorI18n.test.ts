import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CARD_PLAY_FAIL_REASONS } from '../dicethrone/domain/rules';

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
            for (const code of CARD_PLAY_FAIL_REASONS) {
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
