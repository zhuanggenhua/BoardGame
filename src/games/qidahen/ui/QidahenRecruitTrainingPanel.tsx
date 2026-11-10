import { useTranslation } from 'react-i18next';
import { getQidahenWheelRecruitTrainChoices } from '../domain/wheelRecruitTrain';
import type { QidahenCore } from '../domain/types';
import { UI_STYLE, UI_SURFACE } from './qidahenTheme';

/** 此处仅承接模式、追加费用和完成；地区与部队候选由地图本体承接。 */
export function QidahenRecruitTrainingPanel({ core, canChoose, onChoose, recommendedChoiceId }: {
    core: QidahenCore;
    canChoose: (choiceId: string) => boolean;
    onChoose: (choiceId: string) => void;
    recommendedChoiceId?: string;
}) {
    const { t } = useTranslation('game-qidahen');
    const progress = core.wheelRecruitTrainProgress;
    if (!progress || progress.phase === 'payment') return null;
    const controls = getQidahenWheelRecruitTrainChoices(core).filter(choice => choice.kind !== 'recruit-target' && choice.kind !== 'training-target');
    const label = (id: string) => t(id === 'action:recruit' ? 'board.wheelRecruitTrain.recruitAction'
        : id === 'action:train' ? 'board.wheelRecruitTrain.trainingAction'
            : id === 'extra-training' ? 'board.wheelRecruitTrain.extraTraining' : 'board.wheelRecruitTrain.finish');
    return <section className="mb-3 w-full rounded border border-[#9a7d4f] p-3 text-[16px] leading-6 shadow-lg"
        data-testid="qidahen-wheel-recruit-train-selection" data-tutorial-id="qidahen-wheel-recruit-train-selection"
        style={{ background: UI_SURFACE.paper, color: UI_STYLE.ink }}>
        <h2 className="font-bold" data-testid="qidahen-wheel-recruit-train-header">{t(progress.phase === 'choose-recruit-target' ? 'board.wheelRecruitTrain.recruitTargetTitle'
            : progress.phase === 'choose-training-target' || progress.phase === 'extra-training-target' ? 'board.wheelRecruitTrain.trainingTargetTitle'
                : progress.source === 'khan-edict' ? 'board.wheelRecruitTrain.khanTitle' : 'board.wheelRecruitTrain.title')}</h2>
        <div className="text-[15px]" data-testid="qidahen-wheel-recruit-train-progress">{t('board.wheelRecruitTrain.progress', { completed: progress.actionsCompleted, extra: progress.extraTrainingsCompleted })}</div>
        {controls.length ? <div className="mt-3 grid grid-cols-2 gap-2">{controls.map(choice => <button key={choice.id} type="button"
            data-testid={`qidahen-wheel-recruit-train-choice-${encodeURIComponent(choice.id)}`}
            data-tutorial-id={`qidahen-wheel-recruit-train-choice-${encodeURIComponent(choice.id)}`}
            data-qidahen-tutorial-recommended={choice.id === recommendedChoiceId ? 'true' : undefined}
            disabled={!canChoose(choice.id)} onClick={() => onChoose(choice.id)}
            className="min-h-11 rounded px-3 py-2 text-left font-bold hover:brightness-105 disabled:opacity-40"
            style={{ border: `2px solid ${UI_STYLE.bronze}`, background: UI_STYLE.paperLight, color: UI_STYLE.ink,
                outline: choice.id === recommendedChoiceId ? '3px solid #fff8dc' : undefined, outlineOffset: 2 }}>{label(choice.id)}</button>)}</div> : null}
    </section>;
}
