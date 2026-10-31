import React from 'react';
import { useTranslation } from 'react-i18next';
import { DiceBoxPhysicsSource } from '../../../lib/dice-physics/DiceBoxPhysicsSource';
import type { DiceBoxDieType, DiceBoxDieSkin } from '../../../lib/dice-box-threejs/engine';
import type { QidahenBattleRoll, QidahenBattleRolls } from '../domain/types';
import { createQidahenD6Skin, QIDAHEN_BATTLE_DICE_STYLES } from './battleDiceAppearance';

export const QIDAHEN_BATTLE_DAMAGE_HOLD_MS = 1800;

type Props = {
    rolls: QidahenBattleRolls;
    sourceName: string;
    targetName: string;
    onComplete: () => void;
};

/** 领域已结算的骰值只播一次：双方同阶段同时投掷，全部停稳后显示损伤，再进下一阶段。 */
export function QidahenBattleRollSequence({ rolls, sourceName, targetName, onComplete }: Props) {
    const { t } = useTranslation('game-qidahen');
    const [index, setIndex] = React.useState(0);
    const [settled, setSettled] = React.useState<Set<string>>(() => new Set());
    const [showDamage, setShowDamage] = React.useState(false);
    const d6Skin = React.useMemo(() => createQidahenD6Skin(), []);
    const completeRef = React.useRef(onComplete);
    React.useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
    const stages = React.useMemo(() => rolls.stages.filter(stage => stage.attackerRolls.length + stage.defenderRolls.length > 0), [rolls]);
    const stage = stages[index];
    const groups = React.useMemo(() => {
        if (!stage) return [];
        const result: Array<{ id: string; side: 'attacker' | 'defender'; dieType: DiceBoxDieType; dice: QidahenBattleRoll[]; physicsDice: Array<{ id: number; value: number }>; skins?: DiceBoxDieSkin[] }> = [];
        for (const side of ['attacker', 'defender'] as const) {
            const bySides = new Map<number, QidahenBattleRoll[]>();
            for (const die of side === 'attacker' ? stage.attackerRolls : stage.defenderRolls) {
                if (![6, 8, 10, 12].includes(die.dieSides)) throw new Error(`Unsupported Qidahen die: ${die.dieSides}`);
                bySides.set(die.dieSides, [...(bySides.get(die.dieSides) ?? []), die]);
            }
            for (const [sides, dice] of bySides) result.push({
                id: `${index}-${side}-${sides}`, side, dieType: `d${sides}` as DiceBoxDieType, dice,
                physicsDice: dice.map((die, id) => ({ id, value: die.raw })),
                skins: sides === 6 ? dice.map(die => ({ ...d6Skin, readableFaceValue: die.raw })) : undefined,
            });
        }
        return result;
    }, [stage, index, d6Skin]);

    React.useEffect(() => {
        if (!stage) { completeRef.current(); return; }
        if (!groups.every(group => settled.has(group.id))) return;
        setShowDamage(true);
    }, [stage, groups, settled]);

    React.useEffect(() => {
        if (!showDamage) return;
        let timer: number | undefined;
        let secondFrame: number | undefined;
        // 先让停稳读数绘制，再计算阅读时间；繁忙帧不能吞掉结果展示。
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                timer = window.setTimeout(() => {
                    setSettled(new Set()); setShowDamage(false); setIndex(value => value + 1);
                }, QIDAHEN_BATTLE_DAMAGE_HOLD_MS);
            });
        });
        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (secondFrame != null) window.cancelAnimationFrame(secondFrame);
            if (timer != null) window.clearTimeout(timer);
        };
    }, [showDamage]);

    if (!stage) return null;
    return (
        <section data-testid="qidahen-battle-roll-sequence" data-battle-roll-phase={stage.phase} data-battle-roll-state={showDamage ? 'damage' : 'rolling'} className="flex flex-col border border-[#d8b36e]/60 bg-[#321b13] p-2 text-[#ffe9c9]" style={{ height: 'var(--qidahen-battle-panel-height, 370px)' }}>
            <div className="flex shrink-0 items-center justify-between gap-3 text-[15px] font-black leading-5"><span>{sourceName} → {targetName}</span><span>{t(`board.battleRoll.phase.${stage.phase}`)}</span></div>
            <div className={`mt-1 grid min-h-0 flex-1 auto-rows-fr gap-2 ${groups.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {groups.map(group => (
                    <div key={group.id} data-testid={`qidahen-battle-dice-${group.id}`} className="flex min-h-0 min-w-0 flex-col border border-[#d8b36e]/30 bg-[#e9d6b5] text-[#382217]">
                        <div className="shrink-0 px-2 pt-1 text-[13px] font-bold leading-4">{t(`board.battleRoll.${group.side}`)} · {group.dieType}</div>
                        <DiceBoxPhysicsSource
                            dice={group.physicsDice}
                            motion={{ type: 'roll', id: group.id }}
                            dieType={group.dieType}
                            styleProfile={QIDAHEN_BATTLE_DICE_STYLES[group.dieType]}
                            dieSkins={group.skins}
                            rendererMode="debug-visible"
                            testId={`qidahen-battle-dice-physics-${group.id}`}
                            canvasTestId={`qidahen-battle-dice-canvas-${group.id}`}
                            settledIdentity={group.id}
                            className="min-h-0 w-full flex-1" style={{ height: 0 }}
                            onSettledChange={ready => setSettled(current => {
                                if (current.has(group.id) === ready) return current;
                                const next = new Set(current);
                                if (ready) next.add(group.id); else next.delete(group.id);
                                return next;
                            })}
                        />
                        <div className="min-h-6 shrink-0 px-2 pb-1 text-[14px] font-bold leading-5" style={{ visibility: showDamage ? 'visible' : 'hidden' }} data-testid={`qidahen-battle-dice-calculation-${group.id}`}>
                            {group.dice.map((die, dieIndex) => {
                                // 原生十面骰将十点印作0；读数保留该面并同时标出实际点数。
                                const faceLabel = group.dieType === 'd10' && die.raw === 10 ? '0（10）' : `${die.raw}`;
                                return <span key={dieIndex} className="mr-3 inline-block">
                                    {die.value === die.raw ? faceLabel : `${faceLabel} ${die.value > die.raw ? '+' : '−'} ${Math.abs(die.value - die.raw)} = ${die.value}`}
                                </span>;
                            })}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-1 min-h-[40px] shrink-0 text-[14px] leading-5" data-testid={showDamage ? 'qidahen-battle-stage-damage' : undefined} style={{ visibility: showDamage ? 'visible' : 'hidden' }}>
                <div>{t('board.battleRoll.totals', { attacker: stage.attackerTotal, defender: stage.defenderTotal, defaultValue: '骰点合计：攻方 {{attacker}} · 守方 {{defender}}' })}</div>
                {t('board.battleRoll.damage', { attacker: stage.attackerDamage, defender: stage.defenderDamage })}
            </div>
        </section>
    );
}
