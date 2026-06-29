import { describe, expect, it } from 'vitest';
import zhCNLocale from '../../../../public/locales/zh-CN/game-betrayal.json';
import tutorialCatalog from '../tutorial';

describe('Betrayal 教程配置', () => {
    it('导出多章节 TutorialCollection，并把基础开局教程设为默认入口', () => {
        expect(tutorialCatalog.defaultTutorialId).toBe('basic-setup-and-turn');
        expect(Object.keys(tutorialCatalog.tutorials)).toEqual([
            'basic-setup-and-turn',
            'move-explore-use',
            'crimson-jack-objective',
            'haunt-actions-and-finish',
        ]);
    });

    it('默认教程会覆盖角色确认、正式开局和恶兆前主界面入口', () => {
        const manifest = tutorialCatalog.tutorials['basic-setup-and-turn']?.manifest;
        expect(manifest?.steps.map((step) => step.id)).toEqual([
            'select-explorer',
            'confirm-start',
            'start-scenario',
            'runtime-overview',
            'inventory-and-help',
            'room-board',
            'finish',
        ]);

        const confirmStep = manifest?.steps.find((step) => step.id === 'confirm-start');
        const startStep = manifest?.steps.find((step) => step.id === 'start-scenario');
        expect(confirmStep?.allowedCommands).toEqual(['CONFIRM_EXPLORER']);
        expect(startStep?.allowedCommands).toEqual(['START_SCENARIO']);
        expect(confirmStep?.highlightTarget).toBe('betrayal-character-confirm');
        expect(startStep?.highlightTarget).toBe('betrayal-character-confirm');
    });

    it('移动探索教程只允许真实的使用、移动、探索命令链', () => {
        const manifest = tutorialCatalog.tutorials['move-explore-use']?.manifest;
        const actionSteps = manifest?.steps.filter((step) => step.requireAction) ?? [];
        expect(actionSteps.map((step) => step.id)).toEqual([
            'use-rope',
            'move-to-grand-staircase',
            'explore-upper',
        ]);
        expect(actionSteps.map((step) => step.allowedCommands)).toEqual([
            ['USE_POSSESSION'],
            ['MOVE_TO_ROOM'],
            ['EXPLORE_ROOM'],
        ]);
        expect(actionSteps.map((step) => step.allowedTargets ?? null)).toEqual([
            ['rope'],
            ['grand-staircase'],
            null,
        ]);
    });

    it('haunt 章节会直接指向第一剧本目标与真实收尾入口', () => {
        const objectiveManifest = tutorialCatalog.tutorials['crimson-jack-objective']?.manifest;
        const hauntActionsManifest = tutorialCatalog.tutorials['haunt-actions-and-finish']?.manifest;
        expect(objectiveManifest?.steps.find((step) => step.id === 'hero-goal')?.highlightTarget).toBe('betrayal-actions-zone');
        expect(objectiveManifest?.steps.find((step) => step.id === 'traitor-goal')?.highlightTarget).toBe('betrayal-room-board');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'help-entry')?.highlightTarget).toBe('betrayal-reference-entry');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'exorcise-jack')?.allowedCommands).toEqual(['EXORCISE_JACK']);
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'endgame-review')?.highlightTarget).toBe('betrayal-endgame-screen');
    });

    it('中文教程文案会明确说明这批步骤复用真实角色选择、真实运行时和真实终局', () => {
        expect(zhCNLocale.tutorial.basicSetup.steps.selectExplorer).toContain('真实角色选择页');
        expect(zhCNLocale.tutorial.basicSetup.steps.runtimeOverview).toContain('底部 5 个主动作');
        expect(zhCNLocale.tutorial.moveExploreUse.steps.exploreUpper).toContain('事件、物品或预兆');
        expect(zhCNLocale.tutorial.crimsonJack.steps.heroGoal).toContain('调查杰克');
        expect(zhCNLocale.tutorial.crimsonJack.steps.heroGoal).toContain('驱魔法阵');
        expect(zhCNLocale.tutorial.hauntActions.steps.exorciseJack).toContain('真实的驱魔动作');
        expect(zhCNLocale.tutorial.hauntActions.steps.endgameReview).toContain('真实收尾');
    });
});
