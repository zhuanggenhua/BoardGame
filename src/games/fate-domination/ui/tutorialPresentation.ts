import type { TutorialState } from '../../../engine/types';
import type { FateTutorialStep } from './tutorialContract';
import type { LocationId } from '../domain/types';
import { fateTutorialText } from '../tutorialText';

interface VisibleTutorialUi {
    inspection: { name: string; source: string } | null;
    detail: string | null;
    masterAbilityTip?: boolean;
    viewerId?: string | null;
    detailEliminated?: boolean;
    seal: boolean;
    discard: boolean;
    deck?: boolean;
    postBattle?: boolean;
    attackStaged?: boolean;
    ridingSelectionCount?: number;
    publicCards?: boolean;
    movement: boolean;
    movementTarget: boolean;
    deploymentTarget?: boolean;
    deploymentLocation?: LocationId | null;
    identity: boolean;
}
export const FATE_TUTORIAL_TABLE_PROTECTION = ['.fd-play-summary','.fd-phase-control','.fd-self-dock','.fd-self-stats','.fd-self-pile-info','.fd-self-piles','.fd-master-abilities','.fd-event-deck-count','.fd-runtime-map-card-hit','.fd-runtime-deployment-slot:not(:disabled)','.fd-runtime-card','.fd-runtime-pawn','.fd-riding-controls','.fd-runtime-opponent-cards','.fd-runtime-seat'];
// 路线课保护地点、地利与箭头。当前战果由常驻读数承载，未放置棋子的印刷积分轨道是底图。
export const FATE_TUTORIAL_MAP_PROTECTION = ['.fd-runtime-map-landmark:not([data-tutorial-map-landmark="battle-track"])'];

/** 教学中的发动来源由实际命令确定；只调整原牌排视野，不选择或提交卡牌。 */
export function fateTutorialAbilitySource(tutorial: TutorialState):string|undefined {
    const command=tutorial.active?(tutorial.step as FateTutorialStep|undefined)?.fateCommand:undefined;
    return command?.type==='PLAY_SKILL'?String(command.payload.skillId):undefined;
}

/** 正文消费同一摘句；可选检视时让阅读对象独占前景，不另写一套窗口讲解。 */
export function presentFateTutorial(tutorial: TutorialState, ui: VisibleTutorialUi): TutorialState {
    if (!tutorial.active || !tutorial.step) return tutorial;
    const step = tutorial.step as FateTutorialStep;
    const expected = step.fateCommand;
    const deploymentCopy = expected?.type==='DEPLOY_MASTER' && ui.deploymentLocation ? step.fateDeploymentChoiceCopies?.[ui.deploymentLocation] : undefined;
    const hide = () => ({ ...tutorial, step: { ...step, hideOverlay:true, highlightTarget:undefined } });
    if (ui.inspection || ui.detail || ui.masterAbilityTip || ui.seal || ui.discard || ui.deck || ui.postBattle || (ui.publicCards && step.id.startsWith('ui-public-cards')) || ui.movementTarget || (ui.deploymentTarget && expected?.type==='DEPLOY_MASTER'&&!deploymentCopy) || (ui.attackStaged && expected?.type==='CONFIRM_ATTACK')) return hide();
    if (deploymentCopy) return {...tutorial,step:({...step,fateCopy:deploymentCopy,content:fateTutorialText(deploymentCopy),highlightTarget:'fate-deployment-selected',highlightFrame:'none',hideOverlay:false} satisfies FateTutorialStep) as FateTutorialStep};
    if (ui.movement && expected?.type==='MOVE_PLAYER') return {...tutorial,step:{...step,highlightTarget:`fate-location-${String(expected.payload.locationId)}`,highlightFrame:'none'}};
    if(expected?.type==='SYS_INTERACTION_RESPOND' && Array.isArray(expected.payload.optionIds) && (ui.ridingSelectionCount??0)>=expected.payload.optionIds.length)return hide();
    return tutorial;
}
