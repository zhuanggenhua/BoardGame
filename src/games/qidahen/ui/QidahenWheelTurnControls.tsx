import { useTranslation } from 'react-i18next';
import type { useQidahenTurnInput } from './useQidahenTurnInput';

type TurnInput = Pick<ReturnType<typeof useQidahenTurnInput>, 'active' | 'step' | 'season' | 'options' | 'handOptions' | 'canAct' | 'choose'>;

/** 普通落点直接操作印刷行动名；季节格未印出各项行动，才展开贴近轮盘的选项。 */
export function QidahenWheelTurnControls({ input, labelPoint, labelCount }: {
    input: TurnInput; labelPoint: { x: number; y: number }; labelCount: number;
}) {
    const { t } = useTranslation('game-qidahen');
    if (!input.active || input.step !== 'menu') return null;
    const actions = input.options.filter(option => option.value.kind !== 'choose-hand' && option.id !== 'finish-slot');
    const finish = input.options.find(option => option.id === 'finish-slot');
    // 与轮盘同一384单位坐标；两个独立印刷行动对应各自竖排文字，复合行动共用整组文字。
    const labelIndex = (id: string) => id === 'reclaim' || id === 'diplomacy' ? 0 : id === 'military-farm' || id === 'hire' ? 1 : null;
    return <>
        {!input.season ? actions.map(option => {
            const index = labelIndex(option.id);
            const width = index == null ? labelCount * 19 + 6 : 23;
            const x = labelPoint.x + (index == null ? 0 : (index - (labelCount - 1) / 2) * 19);
            return <button key={option.id} type="button" aria-label={option.label}
                data-testid={`qidahen-turn-option-${option.id}`} data-tutorial-id={`qidahen-turn-option-${option.id}`}
                disabled={!input.canAct || option.disabled} onClick={() => input.choose(option.id)}
                className="pointer-events-auto absolute z-20 rounded border border-green-900/70 bg-green-300/15 hover:bg-green-300/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 disabled:opacity-40"
                style={{ left: `${(x - width / 2) / 384 * 100}%`, top: `${(labelPoint.y - 25) / 384 * 100}%`, width: `${width / 384 * 100}%`, height: `${50 / 384 * 100}%` }}>
                <span className="sr-only">{option.label}</span>
            </button>;
        }) : null}
        <div className="pointer-events-auto absolute left-1/2 top-full mt-1 flex flex-col gap-1" style={{ transform: 'translateX(-50%)' }}>
            {input.season ? actions.map(option => <button key={option.id} type="button"
                data-testid={`qidahen-turn-option-${option.id}`} data-tutorial-id={`qidahen-turn-option-${option.id}`}
                disabled={!input.canAct || option.disabled} onClick={() => input.choose(option.id)}
                className="min-h-11 whitespace-nowrap rounded border border-[#775733] bg-[#f0dfb8] px-3 text-[#3c2b1b] disabled:opacity-40">{option.label}</button>) : null}
            {finish ? <button type="button" data-testid="qidahen-turn-option-finish-slot" data-tutorial-id="qidahen-turn-option-finish-slot"
                disabled={!input.canAct} onClick={() => input.choose(finish.id)}
                className="min-h-11 whitespace-nowrap rounded border border-[#775733]/60 bg-[#f0dfb8]/70 px-3 text-[14px] text-[#3c2b1b] disabled:opacity-40">
                {input.season ? finish.label : t(actions.length ? 'board.turnChoice.skipRemainingWheel' : input.handOptions.length ? 'board.turnChoice.finishWheel' : 'board.turnChoice.endTurn')}
            </button> : null}
        </div>
    </>;
}

/** 轮盘已收口但手牌尚未使用时，仅提供真实的放弃选择；行动入口仍在手牌。 */
export function QidahenSkipHandAction({ input }: { input: TurnInput }) {
    const { t } = useTranslation('game-qidahen');
    if (!input.active || input.step !== 'finish-hand') return null;
    return <button type="button" data-testid="qidahen-turn-option-skip-hand" data-tutorial-id="qidahen-turn-option-skip-hand"
        disabled={!input.canAct} onClick={() => input.choose('skip-hand')}
        className="pointer-events-auto absolute bottom-[220px] left-1/2 z-[85] min-h-11 whitespace-nowrap rounded border border-[#775733] bg-[#f0dfb8] px-3 font-bold text-[#3c2b1b] disabled:opacity-40" style={{ transform: 'translateX(-50%)' }}>
        {t('board.turnChoice.skipHandAndEndTurn')}
    </button>;
}
