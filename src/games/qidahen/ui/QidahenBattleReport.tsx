import React from 'react';
import { useTranslation } from 'react-i18next';
import type { QidahenBattleRolls } from '../domain/types';

/** 历史骰果按需阅读，不在战后决策旁重复播放或常显骰盘。 */
export function QidahenBattleReport({ battleRolls }: { battleRolls: QidahenBattleRolls }) {
    const { t } = useTranslation('game-qidahen');
    return <details data-testid="qidahen-battle-report" className="mt-3 text-[14px] leading-5" style={{ color: '#f6d5a8' }}>
        <summary className="w-fit cursor-pointer py-2 underline underline-offset-4">{t('board.battleRoll.report')}</summary>
        <div data-testid="qidahen-post-battle-dice-summary" className="max-h-[42vh] overflow-y-auto py-2">
            {battleRolls.stages.filter(stage => stage.attackerRolls.length + stage.defenderRolls.length > 0).map((stage, index) => <section key={`${stage.phase}-${index}`} className="mb-3">
                <h4 className="font-bold">{t(`board.battleRoll.phase.${stage.phase}`)}</h4>
                {(['attacker', 'defender'] as const).map(side => {
                    const rolls = side === 'attacker' ? stage.attackerRolls : stage.defenderRolls;
                    if (!rolls.length) return null;
                    const total = side === 'attacker' ? stage.attackerTotal : stage.defenderTotal;
                    const damage = side === 'attacker' ? stage.attackerDamage : stage.defenderDamage;
                    return <p key={side}>
                        {t(`board.battleRoll.${side}`)}：{rolls.map(roll => roll.raw === roll.value ? `${roll.raw}` : `${roll.raw}→${roll.value}`).join(' / ')}
                        {' · '}{t('board.battleRoll.total', { total })}{' · '}{t('board.battleRoll.inflictedDamage', { damage })}
                    </p>;
                })}
            </section>)}
        </div>
    </details>;
}
