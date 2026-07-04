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
            'traitor-path',
        ]);
    });

    it('默认教程会直接落到真实恶兆前运行时，并覆盖首轮必需的规则入口', () => {
        const manifest = tutorialCatalog.tutorials['basic-setup-and-turn']?.manifest;
        expect(manifest?.steps.map((step) => step.id)).toEqual([
            'setup-runtime',
            'objective-and-turn',
            'traits-and-speed',
            'moves-remaining',
            'room-board',
            'inventory-and-help',
            'finish',
        ]);

        const setupStep = manifest?.steps.find((step) => step.id === 'setup-runtime');
        expect(setupStep?.aiActions).toHaveLength(1);
        expect(setupStep?.aiActions?.[0]?.commandType).toBe('SYS_CHEAT_MERGE_STATE');
        expect(manifest?.steps.find((step) => step.id === 'objective-and-turn')?.highlightTarget).toBe('betrayal-action-move');
        expect(manifest?.steps.find((step) => step.id === 'traits-and-speed')?.highlightTarget).toBe('betrayal-current-traits');
        expect(manifest?.steps.find((step) => step.id === 'moves-remaining')?.highlightTarget).toBe('betrayal-moves-remaining');
    });

    it('移动探索教程只允许真实的使用、移动、探索命令链', () => {
        const manifest = tutorialCatalog.tutorials['move-explore-use']?.manifest;
        const actionSteps = manifest?.steps.filter((step) => step.requireAction) ?? [];
        expect(actionSteps.map((step) => step.id)).toEqual([
            'use-book',
            'move-to-hallway',
            'explore-upper',
        ]);
        expect(actionSteps.map((step) => step.allowedCommands)).toEqual([
            ['USE_POSSESSION'],
            ['MOVE_TO_ROOM'],
            ['EXPLORE_ROOM'],
        ]);
        expect(actionSteps.map((step) => step.allowedTargets ?? null)).toEqual([
            ['omen-book'],
            ['hallway'],
            null,
        ]);
        expect(actionSteps[0]?.highlightTarget).toBe('betrayal-action-use');
    });

    it('haunt 章节会直接指向第一剧本目标与真实收尾入口', () => {
        const objectiveManifest = tutorialCatalog.tutorials['crimson-jack-objective']?.manifest;
        const hauntActionsManifest = tutorialCatalog.tutorials['haunt-actions-and-finish']?.manifest;
        const traitorManifest = tutorialCatalog.tutorials['traitor-path']?.manifest;
        expect(objectiveManifest?.steps.find((step) => step.id === 'hero-goal')?.highlightTarget).toBe('betrayal-action-use');
        expect(objectiveManifest?.steps.find((step) => step.id === 'traitor-goal')?.highlightTarget).toBe('betrayal-room-board');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'help-entry')?.highlightTarget).toBe('betrayal-reference-entry');
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'exorcise-jack')?.allowedCommands).toEqual(['EXORCISE_JACK']);
        expect(hauntActionsManifest?.steps.find((step) => step.id === 'endgame-review')?.highlightTarget).toBe('betrayal-endgame-screen');
        expect(traitorManifest?.steps.map((step) => step.id)).toEqual([
            'setup-traitor-turn',
            'traitor-objective',
            'attack-hero',
            'traitor-finish',
        ]);
        expect(traitorManifest?.steps.find((step) => step.id === 'setup-traitor-turn')?.viewAs).toBe('2');
        expect(traitorManifest?.steps.find((step) => step.id === 'attack-hero')?.allowedCommands).toEqual(['HAUNT_ATTACK']);
        expect(traitorManifest?.steps.find((step) => step.id === 'attack-hero')?.advanceOnEvents).toEqual([
            { type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '2', target: 'hero' } },
        ]);
    });

    it('中文教程文案会聚焦真实运行时里的第一批规则理解点', () => {
        expect(zhCNLocale.tutorial.basicSetup.steps.setupRuntime).toContain('真实恶兆前局面');
        expect(zhCNLocale.tutorial.basicSetup.steps.objectiveAndTurn).toContain('底部 5 个主动作');
        expect(zhCNLocale.tutorial.basicSetup.steps.traitsAndSpeed).toContain('速度');
        expect(zhCNLocale.tutorial.basicSetup.steps.movesRemaining).toContain('剩余移动');
        expect(zhCNLocale.tutorial.moveExploreUse.steps.exploreUpper).toContain('事件、物品或预兆');
        expect(zhCNLocale.tutorial.crimsonJack.steps.heroGoal).toContain('调查杰克');
        expect(zhCNLocale.tutorial.crimsonJack.steps.heroGoal).toContain('驱魔法阵');
        expect(zhCNLocale.tutorial.hauntActions.steps.exorciseJack).toContain('真实的驱魔动作');
        expect(zhCNLocale.tutorial.hauntActions.steps.endgameReview).toContain('真实收尾');
        expect(zhCNLocale.tutorial.traitorPath.steps.traitorObjective).toContain('击倒全部英雄');
        expect(zhCNLocale.tutorial.traitorPath.steps.attackHero).toContain('正式对攻');
    });
});
