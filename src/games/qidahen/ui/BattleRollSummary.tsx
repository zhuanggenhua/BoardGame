import React from 'react';
import type { QidahenBattleRollPhase, QidahenBattleRoll, QidahenPostBattleSelection } from '../domain';

export const normalizeQidahenBattleRollSummary = (summary?: string | null): string | null => {
    if (!summary) {
        return null;
    }
    return summary.replace(/^[^：]+：/, '掷骰结果：').replace(/。$/, '');
};

export const formatQidahenBattleRollPhaseLabel = (phase: QidahenBattleRollPhase): string => {
    switch (phase) {
        case 'artillery':
            return '火炮齐射';
        case 'cavalry':
            return '骑兵冲击';
        case 'infantry':
            return '步兵推进';
        case 'melee':
            return '近身混战';
        default:
            return '战斗';
    }
};

export const formatQidahenBattleRollFace = (roll: QidahenBattleRoll): string =>
    roll.raw === roll.value ? `${roll.raw}` : `${roll.raw}→${roll.value}`;

export const QIDAHEN_BATTLE_ROLL_COPY = {
    attackerLabel: '攻方',
    defenderLabel: '守方',
    totalLabel: '合计',
    noRollsLabel: '未掷骰',
    summaryTitle: '本次掷骰',
    attackerDamageLabel: '攻方伤害',
    defenderDamageLabel: '守方伤害',
} as const;

export const renderQidahenBattleRollDiceGroup = (
    sideLabel: string,
    rolls: QidahenBattleRoll[],
    total: number,
    tone: 'attacker' | 'defender',
) => {
    const borderColor = tone === 'attacker' ? 'rgba(232, 160, 124, 0.55)' : 'rgba(160, 188, 234, 0.55)';
    const background = tone === 'attacker' ? 'rgba(104, 34, 22, 0.32)' : 'rgba(23, 49, 88, 0.28)';
    const chipBackground = tone === 'attacker' ? 'rgba(138, 41, 28, 0.8)' : 'rgba(45, 82, 136, 0.84)';
    const chipText = tone === 'attacker' ? '#fff0e7' : '#edf5ff';

    return (
        <div className="rounded-[3px] border px-2 py-2" style={{ borderColor, background }}>
            <div
                className="flex items-center justify-between gap-3 text-[10px] font-black"
                style={{ color: '#f6d5a8' }}
            >
                <span>{sideLabel}</span>
                <span>{`${QIDAHEN_BATTLE_ROLL_COPY.totalLabel} ${total}`}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {rolls.map((roll, index) => (
                    <div
                        key={`${sideLabel}-${roll.troopKind}-${roll.level}-${roll.raw}-${roll.value}-${index}`}
                        className="grid h-[34px] min-w-[34px] place-items-center border text-[12px] font-black leading-none"
                        style={{
                            borderColor,
                            background: chipBackground,
                            color: chipText,
                            borderRadius: 3,
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                        }}
                        title={`${roll.troopKind} Lv${roll.level} d${roll.dieSides}`}
                    >
                        {formatQidahenBattleRollFace(roll)}
                    </div>
                ))}
                {rolls.length <= 0 ? (
                    <div className="px-1 text-[10px]" style={{ color: '#d8c7ab' }}>
                        {QIDAHEN_BATTLE_ROLL_COPY.noRollsLabel}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export const QidahenBattleRollDiceSummary: React.FC<{
    battleRolls: NonNullable<QidahenPostBattleSelection['battleRolls']>;
}> = ({ battleRolls }) => (
    <div
        className="mt-2 rounded-[3px] border border-[#d8b36e]/40 bg-[rgba(44,20,11,0.24)] px-2.5 py-2"
        data-testid="qidahen-post-battle-dice-summary"
    >
        <div className="text-[10px] font-black tracking-[0.08em]" style={{ color: '#f6d5a8' }}>
            {QIDAHEN_BATTLE_ROLL_COPY.summaryTitle}
        </div>
        <div className="mt-2 flex flex-col gap-2">
            {battleRolls.stages.map((stage, index) => (
                <div
                    key={`${stage.phase}-${index}`}
                    className="rounded-[3px] border border-[#d8b36e]/25 bg-[rgba(0,0,0,0.12)] px-2 py-2"
                >
                    <div
                        className="text-[10px] font-black"
                        style={{ color: '#ffe5b3' }}
                    >{`${formatQidahenBattleRollPhaseLabel(stage.phase)} · ${QIDAHEN_BATTLE_ROLL_COPY.attackerDamageLabel} ${stage.attackerDamage} · ${QIDAHEN_BATTLE_ROLL_COPY.defenderDamageLabel} ${stage.defenderDamage}`}</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {renderQidahenBattleRollDiceGroup(
                            QIDAHEN_BATTLE_ROLL_COPY.attackerLabel,
                            stage.attackerRolls,
                            stage.attackerTotal,
                            'attacker',
                        )}
                        {renderQidahenBattleRollDiceGroup(
                            QIDAHEN_BATTLE_ROLL_COPY.defenderLabel,
                            stage.defenderRolls,
                            stage.defenderTotal,
                            'defender',
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
);
