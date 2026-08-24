/**
 * 大杀四方教学 manifest 结构验证
 *
 * 验证教学配置的完整性和正确性：
 * - 步骤 id 唯一性
 * - content 字段格式
 * - setup 步骤包含 aiActions
 * - randomPolicy 已设置
 * - 蛇形选秀包含巫师和机器人
 * - 固定场景覆盖组合手牌、牌库、基地和读局操作
 */

import { describe, it, expect } from 'vitest';
import {
    SMASH_UP_BASIC_TUTORIAL,
    SMASH_UP_COWBOYS_DUEL_TUTORIAL,
    SMASH_UP_TUTORIAL_CATALOG,
} from '../tutorial';
import { SU_COMMANDS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { CHEAT_COMMANDS } from '../../../engine/systems/CheatSystem';

describe('SmashUp Tutorial Manifest 结构验证', () => {
    it('manifest id 已设置', () => {
        expect(SMASH_UP_BASIC_TUTORIAL.id).toBe('smashup-basic');
    });

    it('randomPolicy 已设置为 fixed 模式', () => {
        expect(SMASH_UP_BASIC_TUTORIAL.randomPolicy).toEqual({ mode: 'fixed', values: [1] });
    });

    it('所有步骤 id 唯一', () => {
        const ids = SMASH_UP_BASIC_TUTORIAL.steps.map(s => s.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('所有 content 字段匹配 game-smashup:tutorial.* 模式', () => {
        for (const step of SMASH_UP_BASIC_TUTORIAL.steps) {
            expect(step.content).toMatch(/^game-smashup:tutorial\./);
        }
    });

    it('setup 步骤包含 aiActions', () => {
        const setup = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'setup');
        expect(setup).toBeDefined();
        expect(setup!.aiActions).toBeDefined();
        expect(setup!.aiActions!.length).toBeGreaterThan(0);
    });

    it('setup 步骤蛇形选秀让玩家使用巫师和机器人，不再使用疯狂教学派系', () => {
        const setup = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'setup')!;
        const factionActions = setup.aiActions!.filter(a => a.commandType === SU_COMMANDS.SELECT_FACTION);
        const playerIds = factionActions.map(a => a.playerId);
        const factionIds = factionActions.map(a => (a.payload as { factionId: string }).factionId);
        expect(playerIds).toEqual(['0', '1', '1', '0']);
        expect(factionIds).toEqual([
            SMASHUP_FACTION_IDS.WIZARDS,
            SMASHUP_FACTION_IDS.PIRATES,
            SMASHUP_FACTION_IDS.NINJAS,
            SMASHUP_FACTION_IDS.ROBOTS,
        ]);
        expect(factionIds).not.toContain(SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY);
        expect(factionIds).not.toContain(SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU);
    });

    it('setup 步骤手牌包含巫师 + 机器人的组合教学牌', () => {
        const setup = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'setup')!;
        const mergeAction = setup.aiActions!.find(a => a.commandType === CHEAT_COMMANDS.MERGE_STATE)!;
        const hand = (mergeAction.payload as any).fields.players['0'].hand as { uid: string; defId: string }[];
        const defIds = hand.map(c => c.defId);
        expect(defIds).toEqual([
            'wizard_chronomage',
            'wizard_summon',
            'robot_zapbot',
            'robot_tech_center',
        ]);
        expect(defIds).not.toContain('miskatonic_librarian');
        expect(defIds).not.toContain('dino_howl');
        expect(defIds).not.toContain('special_madness');
        expect(defIds).not.toContain('cthulhu_star_spawn');
        expect(defIds).not.toContain('dino_war_raptor');
    });

    it('setup 步骤固定牌库、基地和牌库查看能力', () => {
        const setup = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'setup')!;
        const mergeAction = setup.aiActions!.find(a => a.commandType === CHEAT_COMMANDS.MERGE_STATE)!;
        const fields = (mergeAction.payload as any).fields;

        expect(fields.deckQueryEnabled).toBe(true);
        expect(fields.players?.['0']?.deck.map((card: { defId: string }) => card.defId)).toEqual([
            'robot_hoverbot',
            'wizard_enchantress',
            'robot_microbot_fixer',
        ]);
        expect(fields.bases.map((base: { defId: string }) => base.defId)).toEqual([
            'base_central_brain',
            'base_great_library',
        ]);
        expect(fields.madnessDeck).toBeUndefined();
        expect(fields.players?.['0']?.madnessDeck).toBeUndefined();
    });

    it('至少包含 15 个教学步骤', () => {
        expect(SMASH_UP_BASIC_TUTORIAL.steps.length).toBeGreaterThanOrEqual(15);
    });

    it('基础教程覆盖对手视角、牌库弃牌堆和组合收益读局步骤', () => {
        const stepIds = SMASH_UP_BASIC_TUTORIAL.steps.map(s => s.id);
        expect(stepIds).toEqual(expect.arrayContaining([
            'opponentView',
            'deckDiscardIntro',
            'comboBoardRead',
            'deckAfterDraw',
        ]));

        expect(SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'opponentView')?.highlightTarget).toBe('su-scoreboard');
        expect(SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'deckDiscardIntro')?.highlightTarget).toBe('su-deck-discard');
        expect(SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'deckAfterDraw')?.highlightTarget).toBe('su-deck-discard');
    });

    it('finish 步骤存在且为最后一步', () => {
        const last = SMASH_UP_BASIC_TUTORIAL.steps[SMASH_UP_BASIC_TUTORIAL.steps.length - 1];
        expect(last.id).toBe('finish');
    });

    it('交互步骤配置了 allowedTargets 目标级门控', () => {
        const playChronomage = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'playChronomage');
        expect(playChronomage?.allowedTargets).toEqual(['tut-chrono']);

        const playSummon = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'playSummon');
        expect(playSummon?.allowedTargets).toEqual(['tut-summon']);

        const extraZapbot = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'extraZapbot');
        expect(extraZapbot?.allowedTargets).toEqual(['tut-zapbot']);

        const playTechCenter = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'playTechCenter');
        expect(playTechCenter?.allowedTargets).toEqual(['tut-tech']);
    });

    it('allowedTargets 只引用教学手牌中存在的 uid', () => {
        const setup = SMASH_UP_BASIC_TUTORIAL.steps.find(s => s.id === 'setup')!;
        const mergeAction = setup.aiActions!.find(a => a.commandType === CHEAT_COMMANDS.MERGE_STATE)!;
        const handCards = (mergeAction.payload as any).fields.players['0'].hand ?? [];
        const handUids = new Set(handCards.map((c: any) => c.uid));

        for (const step of SMASH_UP_BASIC_TUTORIAL.steps) {
            if (!step.allowedTargets) continue;
            for (const target of step.allowedTargets) {
                expect(handUids.has(target), `allowedTarget '${target}' 在步骤 '${step.id}' 中引用了不存在的手牌 uid`).toBe(true);
            }
        }
    });

    it('教程目录包含默认教程与牛仔决斗子教程', () => {
        expect(SMASH_UP_TUTORIAL_CATALOG.defaultTutorialId).toBe('smashup-basic');
        expect(SMASH_UP_TUTORIAL_CATALOG.tutorials['smashup-basic']?.manifest).toBe(SMASH_UP_BASIC_TUTORIAL);
        expect(SMASH_UP_TUTORIAL_CATALOG.tutorials['cowboys-duel']?.manifest).toBe(SMASH_UP_COWBOYS_DUEL_TUTORIAL);
    });

    it('牛仔决斗子教程最后一步仍为 finish，兼容教程退出逻辑', () => {
        const last = SMASH_UP_COWBOYS_DUEL_TUTORIAL.steps[SMASH_UP_COWBOYS_DUEL_TUTORIAL.steps.length - 1];
        expect(last.id).toBe('finish');
    });

    it('牛仔决斗子教程的跳过步骤高亮真实跳过按钮而不是手牌区', () => {
        const pecosBillWindow = SMASH_UP_COWBOYS_DUEL_TUTORIAL.steps.find(s => s.id === 'pecosBillWindow');
        const duelCard = SMASH_UP_COWBOYS_DUEL_TUTORIAL.steps.find(s => s.id === 'duelCard');

        expect(pecosBillWindow?.highlightTarget).toBe('su-hand-prompt-skip-option');
        expect(duelCard?.highlightTarget).toBe('su-hand-prompt-skip-option');
    });
});
