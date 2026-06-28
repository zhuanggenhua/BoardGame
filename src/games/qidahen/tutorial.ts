import type { TutorialManifest } from '../../engine/types';
import { QIDAHEN_COMMANDS } from './domain/commands';

const QIDAHEN_TUTORIAL: TutorialManifest = {
    id: 'qidahen-basic',
    steps: [
        {
            id: 'welcome',
            content: 'game-qidahen:tutorial.steps.welcome',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'select-region',
            content: 'game-qidahen:tutorial.steps.selectRegion',
            highlightTarget: 'qidahen-map-target-song-jin',
            position: 'bottom',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
            allowedTargets: ['song-jin'],
            advanceOnEvents: [{ type: 'REGION_SELECTED', match: { regionId: 'song-jin' } }],
        },
        {
            id: 'pick-action',
            content: 'game-qidahen:tutorial.steps.pickAction',
            highlightTarget: 'qidahen-action-grant-pardon',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            allowedTargets: ['grant-pardon'],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'grant-pardon' } }],
        },
        {
            id: 'pay-cards',
            content: 'game-qidahen:tutorial.steps.payCards',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
            advanceOnEvents: [{ type: 'SELECTED_ACTION_EXECUTED', match: { actionId: 'grant-pardon' } }],
        },
        {
            id: 'wheel-move',
            content: 'game-qidahen:tutorial.steps.wheelMove',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.steps.finish',
            highlightTarget: 'qidahen-turn-banner',
            position: 'top',
            infoStep: true,
        },
    ],
};

export default QIDAHEN_TUTORIAL;
