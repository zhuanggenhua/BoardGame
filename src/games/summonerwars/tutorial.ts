/**
 * 召唤师战争 - 教学配置
 */

import type { TutorialManifest } from '../../contexts/TutorialContext';

const SUMMONER_WARS_TUTORIAL: TutorialManifest = {
    id: 'summonerwars-basic',
    titleKey: 'tutorial.summonerwars.title',
    steps: [
        // TODO: 添加教学步骤
        {
            id: 'welcome',
            content: 'tutorial.summonerwars.welcome',
            requireAction: false,
        },
        // 示例步骤：
        // {
        //     id: 'summon-unit',
        //     content: 'tutorial.summonerwars.summonUnit',
        //     highlightTarget: 'summon-button',
        //     requireAction: true,
        // },
    ],
};

export default SUMMONER_WARS_TUTORIAL;
