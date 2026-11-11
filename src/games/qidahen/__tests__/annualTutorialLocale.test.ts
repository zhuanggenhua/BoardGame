import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 这些键由 resolver 在运行时组合；静态 i18n 扫描无法发现缺失。
const dynamicKeys = [
    'farm-menu-initial', 'farm-menu-after-farm', 'farm-menu-after-reclaim', 'farm-menu-finish', 'farm-menu-hand-action',
    'farm-hand-menu-dynamic', 'farm-target-dynamic', 'reclaim-target-dynamic',
    'hand-raid-rule', 'hand-recruit-rule', 'hand-grant-rule', 'hand-drive-rule', 'hand-recruit-region', 'hand-recruit-choice',
    'dispatch-source-dynamic', 'dispatch-troops-dynamic', 'dispatch-target-dynamic', 'defender-response-dynamic',
    'battle-roll-dynamic', 'battle-roll-no-tactic', 'opponent-retreat-dynamic', 'player-retreat', 'post-battle-dynamic',
    'diplomacy-menu-dynamic', 'diplomacy-hand-menu-dynamic', 'diplomacy-target-dynamic', 'hire-payment-dynamic',
    'hire-target-first-dynamic', 'hire-target-extra-dynamic', 'season-upkeep-troops', 'season-upkeep-desert',
    'season-upkeep-korea', 'season-upkeep-neutral', 'season-upkeep-siege', 'training-practice-action',
    'training-practice-payment', 'training-practice-complete', 'training-practice-finish', 'training-practice-recruit',
    'training-fallback', 'training-move-recovery',
];

describe('年度教程动态文案', () => {
    it.each(['zh-CN', 'en'])('%s 包含每个运行时提示', locale => {
        const resource = JSON.parse(readFileSync(`public/locales/${locale}/game-qidahen.json`, 'utf8'));
        for (const key of dynamicKeys) expect(resource.tutorial.annual.steps[key], `${locale}: ${key}`).toBeTruthy();
    });
});
