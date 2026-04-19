/**
 * 命令分类系统测试
 */

import { describe, it, expect } from 'vitest';
import {
    CommandCategory,
    COMMAND_CATEGORIES,
    getCommandCategory,
    isCommandInCategory,
    isCommandInAnyCategory,
    getCommandsByCategory,
} from '../domain/commandCategories';

describe('CommandCategories', () => {
    describe('getCommandCategory', () => {
        it('应该返回正确的命令分类', () => {
            expect(getCommandCategory('ROLL_DICE')).toBe(CommandCategory.PHASE_CONTROL);
            expect(getCommandCategory('TOGGLE_DIE_LOCK')).toBe(CommandCategory.UI_INTERACTION);
            expect(getCommandCategory('PLAY_CARD')).toBe(CommandCategory.TACTICAL);
            expect(getCommandCategory('MODIFY_DIE')).toBe(CommandCategory.STATE_MANAGEMENT);
            expect(getCommandCategory('SELECT_ABILITY')).toBe(CommandCategory.STRATEGIC);
            expect(getCommandCategory('GRANT_TOKENS')).toBe(CommandCategory.STATE_MANAGEMENT);
            expect(getCommandCategory('PLAYER_UNREADY')).toBe(CommandCategory.STRATEGIC);
        });

        it('应该自动识别 SYS_ 前缀的系统命令', () => {
            expect(getCommandCategory('SYS_INTERACTION_RESPOND')).toBe(CommandCategory.SYSTEM);
            expect(getCommandCategory('SYS_INTERACTION_CANCEL')).toBe(CommandCategory.SYSTEM);
            expect(getCommandCategory('SYS_UNDO')).toBe(CommandCategory.SYSTEM);
        });

        it('应该对未分类的命令返回 undefined', () => {
            expect(getCommandCategory('UNKNOWN_COMMAND')).toBeUndefined();
        });
    });

    describe('isCommandInCategory', () => {
        it('应该正确判断命令是否属于指定分类', () => {
            expect(isCommandInCategory('ROLL_DICE', CommandCategory.PHASE_CONTROL)).toBe(true);
            expect(isCommandInCategory('ROLL_DICE', CommandCategory.TACTICAL)).toBe(false);
            expect(isCommandInCategory('TOGGLE_DIE_LOCK', CommandCategory.UI_INTERACTION)).toBe(true);
        });
    });

    describe('isCommandInAnyCategory', () => {
        it('应该正确判断命令是否属于任一指定分类', () => {
            expect(
                isCommandInAnyCategory('PLAY_CARD', [
                    CommandCategory.TACTICAL,
                    CommandCategory.UI_INTERACTION,
                ])
            ).toBe(true);

            expect(
                isCommandInAnyCategory('ROLL_DICE', [
                    CommandCategory.TACTICAL,
                    CommandCategory.UI_INTERACTION,
                ])
            ).toBe(false);
        });
    });

    describe('getCommandsByCategory', () => {
        it('应该返回所有属于指定分类的命令', () => {
            const phaseControlCommands = getCommandsByCategory(CommandCategory.PHASE_CONTROL);
            expect(phaseControlCommands).toContain('ROLL_DICE');
            expect(phaseControlCommands).toContain('CONFIRM_ROLL');
            expect(phaseControlCommands).toContain('ADVANCE_PHASE');

            const uiCommands = getCommandsByCategory(CommandCategory.UI_INTERACTION);
            expect(uiCommands).toContain('TOGGLE_DIE_LOCK');
            expect(uiCommands).toContain('DRAW_CARD');
        });
    });

    describe('分类完整性', () => {
        it('所有关键命令都应该有分类', () => {
            const criticalCommands = [
                'ROLL_DICE',
                'TOGGLE_DIE_LOCK',
                'CONFIRM_ROLL',
                'SELECT_ABILITY',
                'PLAY_CARD',
                'USE_TOKEN',
                'MODIFY_DIE',
                'REMOVE_STATUS',
            ];

            for (const command of criticalCommands) {
                expect(
                    getCommandCategory(command),
                    `命令 ${command} 应该有分类`
                ).toBeDefined();
            }
        });

        it('每个分类都应该至少有一个命令', () => {
            const categories = [
                CommandCategory.PHASE_CONTROL,
                CommandCategory.STRATEGIC,
                CommandCategory.TACTICAL,
                CommandCategory.UI_INTERACTION,
                CommandCategory.STATE_MANAGEMENT,
            ];

            for (const category of categories) {
                const commands = getCommandsByCategory(category);
                expect(
                    commands.length,
                    `分类 ${category} 应该至少有一个命令`
                ).toBeGreaterThan(0);
            }
        });
    });

    describe('ResponseWindow 权限配置', () => {
        it('TACTICAL 分类的命令应该在响应窗口期间允许', () => {
            const tacticalCommands = getCommandsByCategory(CommandCategory.TACTICAL);
            expect(tacticalCommands).toContain('PLAY_CARD');
            expect(tacticalCommands).toContain('USE_TOKEN');
            expect(tacticalCommands).toContain('USE_PASSIVE_ABILITY');
        });

        it('UI_INTERACTION 分类的命令应该在响应窗口期间允许', () => {
            const uiCommands = getCommandsByCategory(CommandCategory.UI_INTERACTION);
            expect(uiCommands).toContain('TOGGLE_DIE_LOCK');
            expect(uiCommands).toContain('DISCARD_CARD');
        });

        it('STATE_MANAGEMENT 分类的命令应该在响应窗口期间允许', () => {
            const stateCommands = getCommandsByCategory(CommandCategory.STATE_MANAGEMENT);
            expect(stateCommands).toContain('MODIFY_DIE');
            expect(stateCommands).toContain('REROLL_DIE');
            expect(stateCommands).toContain('REMOVE_STATUS');
        });

        it('PHASE_CONTROL 分类的命令不应该在响应窗口期间允许', () => {
            const phaseCommands = getCommandsByCategory(CommandCategory.PHASE_CONTROL);
            expect(phaseCommands).toContain('ROLL_DICE');
            expect(phaseCommands).toContain('CONFIRM_ROLL');
            expect(phaseCommands).toContain('ADVANCE_PHASE');
        });

        it('STRATEGIC 分类的命令不应该在响应窗口期间允许', () => {
            const strategicCommands = getCommandsByCategory(CommandCategory.STRATEGIC);
            expect(strategicCommands).toContain('SELECT_ABILITY');
            expect(strategicCommands).toContain('SELECT_CHARACTER');
        });
    });

    describe('分类语义正确性', () => {
        it('TOGGLE_DIE_LOCK 应该是 UI_INTERACTION 而不是 PHASE_CONTROL', () => {
            // 这是之前被遗漏的命令，现在应该正确分类
            expect(getCommandCategory('TOGGLE_DIE_LOCK')).toBe(CommandCategory.UI_INTERACTION);
            expect(getCommandCategory('TOGGLE_DIE_LOCK')).not.toBe(CommandCategory.PHASE_CONTROL);
        });

        it('PLAY_CARD 应该是 TACTICAL 而不是 UI_INTERACTION', () => {
            // 打出卡牌是战术响应，不是纯 UI 操作
            expect(getCommandCategory('PLAY_CARD')).toBe(CommandCategory.TACTICAL);
            expect(getCommandCategory('PLAY_CARD')).not.toBe(CommandCategory.UI_INTERACTION);
        });

        it('ROLL_DICE 应该是 PHASE_CONTROL 而不是 TACTICAL', () => {
            // 投掷骰子是回合流程控制，不是战术响应
            expect(getCommandCategory('ROLL_DICE')).toBe(CommandCategory.PHASE_CONTROL);
            expect(getCommandCategory('ROLL_DICE')).not.toBe(CommandCategory.TACTICAL);
        });
    });
});
