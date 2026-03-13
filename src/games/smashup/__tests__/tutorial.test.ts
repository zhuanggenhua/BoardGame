/**
 * 大杀四方教学 manifest 结构验证
 *
 * 验证教学配置的完整性和正确性：
 * - 步骤 id 唯一性
 * - content 字段格式
 * - setup 步骤包含 aiActions
 * - randomPolicy 已设置
 * - 顺序双选包含米斯卡塔尼克大学
 * - 手牌只含图书管理员、嚎叫和疯狂卡
 */

import { describe, it, expect } from 'vitest';
import SMASH_UP_TUTORIAL from '../tutorial';
import { SU_COMMANDS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { CHEAT_COMMANDS } from '../../../engine/systems/CheatSystem';

describe('SmashUp Tutorial Manifest 结构验证', () => {
    it('manifest id 已设置', () => {
        expect(SMASH_UP_TUTORIAL.id).toBe('smashup-basic');
    });

    it('randomPolicy 已设置为 fixed 模式', () => {
        expect(SMASH_UP_TUTORIAL.randomPolicy).toEqual({ mode: 'fixed', values: [1] });
    });

    it('所有步骤 id 唯一', () => {
        const ids = SMASH_UP_TUTORIAL.steps.map(s => s.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('所有 content 字段匹配 game-smashup:tutorial.* 模式', () => {
        for (const step of SMASH_UP_TUTORIAL.steps) {
            expect(step.content).toMatch(/^game-smashup:tutorial\./);
        }
    });

    it('setup 步骤包含 aiActions', () => {
        const setup = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'setup');
        expect(setup).toBeDefined();
        expect(setup!.aiActions).toBeDefined();
        expect(setup!.aiActions!.length).toBeGreaterThan(0);
    });

    it('setup 步骤派系选秀包含恐龙和米斯卡塔尼克大学', () => {
        const setup = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'setup')!;
        const factionActions = setup.aiActions!.filter(a => a.commandType === SU_COMMANDS.SELECT_FACTION);
        const factionIds = factionActions.map(a => (a.payload as { factionId: string }).factionId);
        expect(factionIds).toContain(SMASHUP_FACTION_IDS.DINOSAURS);
        expect(factionIds).toContain(SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY);
        // 不应包含克苏鲁仆从（已替换为米斯卡塔尼克大学）
        expect(factionIds).not.toContain(SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU);
    });

    it('setup 步骤手牌包含图书管理员、嚎叫和疯狂卡', () => {
        const setup = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'setup')!;
        const mergeAction = setup.aiActions!.find(a => a.commandType === CHEAT_COMMANDS.MERGE_STATE)!;
        const hand = (mergeAction.payload as any).fields.players['0'].hand as { uid: string; defId: string }[];
        const defIds = hand.map(c => c.defId);
        expect(defIds).toContain('miskatonic_librarian');
        expect(defIds).toContain('dino_howl');
        expect(defIds).toContain('special_madness');
        // 星之眷族已替换为图书管理员
        expect(defIds).not.toContain('cthulhu_star_spawn');
        // 战争猛禽已从教学手牌移除
        expect(defIds).not.toContain('dino_war_raptor');
    });

    it('至少包含 15 个教学步骤', () => {
        expect(SMASH_UP_TUTORIAL.steps.length).toBeGreaterThanOrEqual(15);
    });

    it('finish 步骤存在且为最后一步', () => {
        const last = SMASH_UP_TUTORIAL.steps[SMASH_UP_TUTORIAL.steps.length - 1];
        expect(last.id).toBe('finish');
    });

    it('交互步骤配置了 allowedTargets 目标级门控', () => {
        const playMinion = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'playMinion');
        expect(playMinion?.allowedTargets).toEqual(['tut-1']); // 图书管理员（天赋随从）

        const playAction = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'playAction');
        expect(playAction?.allowedTargets).toEqual(['tut-2']); // 嚎叫

        const useTalent = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'useTalent');
        expect(useTalent?.allowedTargets).toEqual(['tut-1']); // 图书管理员（已在基地上）
    });

    it('allowedTargets 只引用教学手牌中存在的 uid', () => {
        const setup = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'setup')!;
        const mergeAction = setup.aiActions!.find(a => a.commandType === CHEAT_COMMANDS.MERGE_STATE)!;
        const handCards = (mergeAction.payload as any).fields.players['0'].hand ?? [];
        const handUids = new Set(handCards.map((c: any) => c.uid));

        for (const step of SMASH_UP_TUTORIAL.steps) {
            if (!step.allowedTargets) continue;
            if (step.id === 'useTalent') continue; // 目标在基地上，不在手牌
            for (const target of step.allowedTargets) {
                expect(handUids.has(target), `allowedTarget '${target}' 在步骤 '${step.id}' 中引用了不存在的手牌 uid`).toBe(true);
            }
        }
    });
});
