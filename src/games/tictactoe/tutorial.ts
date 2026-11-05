import type { TutorialHiddenAutomationContract, TutorialManifest } from '../../engine/types';

const compressedRepeat = (
    equivalentStepIds: string[],
    reason: string,
): TutorialHiddenAutomationContract => ({
    kind: 'compressed-repeat',
    equivalentStepIds,
    reason,
});

export const TicTacToeTutorial: TutorialManifest = {
    id: 'tictactoe-basic',
    steps: [
        {
            id: 'intro',
            content: 'game-tictactoe:tutorial.steps.intro',
            position: 'center',
            requireAction: false,
            showMask: true
        },
        {
            id: 'center-strategy',
            content: 'game-tictactoe:tutorial.steps.centerStrategy',
            highlightTarget: 'cell-4', // 对应数据属性: data-tutorial-id="cell-4"
            position: 'bottom',
            requireAction: true,
            advanceOnEvents: [{ type: 'CELL_OCCUPIED', match: { cellId: 4 } }]
        },
        {
            id: 'opponent-turn',
            content: '', // 隐藏步骤 - AI 自动移动
            aiActions: [{ commandType: 'CLICK_CELL', payload: { cellId: 0 } }], // AI 点击左上角格子
            hiddenAutomation: compressedRepeat(
                ['center-strategy'],
                'Opponent repeats the same formal cell-claim action after the player has placed a mark.',
            ),
            advanceOnEvents: [{ type: 'CELL_OCCUPIED', match: { cellId: 0 } }]
        },
        {
            id: 'block-strategy',
            content: 'game-tictactoe:tutorial.steps.blockStrategy',
            position: 'center',
            requireAction: false
        },
        {
            id: 'finish',
            content: 'game-tictactoe:tutorial.steps.finish',
            position: 'center',
            requireAction: false
        }
    ]
};

export default TicTacToeTutorial;
