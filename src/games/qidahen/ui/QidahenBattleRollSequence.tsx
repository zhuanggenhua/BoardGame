import React from 'react';
import { useTranslation } from 'react-i18next';
import { DiceBoxPhysicsSource } from '../../../lib/dice-physics/DiceBoxPhysicsSource';
import type { DiceBoxDieType, DiceBoxDieSkin } from '../../../lib/dice-box-threejs/engine';
import type { QidahenBattleRoll, QidahenBattleRolls } from '../domain/types';
import { createQidahenD6Skin, QIDAHEN_BATTLE_DICE_STYLES } from './battleDiceAppearance';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

export const QIDAHEN_BATTLE_DAMAGE_HOLD_MS = 1800;
const battleLabelStyle: React.CSSProperties = { background: 'rgba(36,19,9,0.78)', padding: '2px 8px' };
export type QidahenBattleActor = { name: string; markerSrc?: string };

type Props = {
    rolls: QidahenBattleRolls;
    sourceName: string;
    targetName: string;
    attacker: QidahenBattleActor;
    defender: QidahenBattleActor;
    onComplete: () => void;
};

/** 领域已结算的骰值只播一次：双方同阶段同时投掷，全部停稳后显示损伤，再进下一阶段。 */
export function QidahenBattleRollSequence({ rolls, sourceName, targetName, attacker, defender, onComplete }: Props) {
    const { t } = useTranslation('game-qidahen');
    const actors = { attacker, defender };
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
    const sides = (['attacker', 'defender'] as const).filter(side => groups.some(group => group.side === side));

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
        <section data-testid="qidahen-battle-roll-sequence" data-battle-roll-phase={stage.phase} data-battle-roll-state={showDamage ? 'damage' : 'rolling'} className="flex h-full flex-col" style={{ height: 'var(--qidahen-battle-panel-height, 370px)', color: '#fff3dc', fontFamily: 'ui-serif, "STSong", "SimSun", serif', textShadow: '0 1px 2px #241309' }}>
            <div className="flex shrink-0 flex-wrap items-baseline justify-center gap-x-3 text-center font-black leading-7">
                <span data-testid="qidahen-battle-roll-context" data-qidahen-battle-label="context" className="text-[16px]" style={battleLabelStyle}>{sourceName} → {targetName}</span>
                <span data-qidahen-battle-label="phase" className="text-[22px]" style={battleLabelStyle}>{t(`board.battleRoll.phase.${stage.phase}`)}</span>
            </div>
            <div className={`mt-2 grid min-h-0 flex-1 gap-6 ${sides.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {sides.map(side => (
                    <div key={side} data-testid={`qidahen-battle-side-${side}`} className="flex min-h-0 min-w-0 flex-col">
                        <div className="shrink-0 text-center text-[16px] font-bold leading-6"><span data-qidahen-battle-label={side} className="inline-flex items-center gap-1.5" style={battleLabelStyle}>
                            {actors[side].markerSrc ? <OptimizedImage src={actors[side].markerSrc} alt="" className="h-5 w-5 shrink-0 object-contain" placeholder={false} /> : null}
                            {t('board.battleRoll.sideOwner', { faction: actors[side].name, role: t(`board.battleRoll.${side}`) })}
                        </span></div>
                        <div className="flex min-h-0 flex-1 gap-2">
                            {groups.filter(group => group.side === side).map(group => (
                                <div key={group.id} data-testid={`qidahen-battle-dice-${group.id}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                                    <div className="min-h-6 shrink-0 text-center text-[16px] font-bold leading-6" style={{ visibility: showDamage ? 'visible' : 'hidden' }} data-testid={`qidahen-battle-dice-calculation-${group.id}`}>
                                        {group.dice.map((die, dieIndex) => {
                                            if (die.raw === die.value && !(group.dieType === 'd10' && die.raw === 10)) return null;
                                            // 原生十面骰将十点印作0；读数保留该面并同时标出实际点数。
                                            const faceLabel = group.dieType === 'd10' && die.raw === 10 ? '0（10）' : `${die.raw}`;
                                            return <span key={dieIndex} className="mx-1 inline-block">
                                                {die.value === die.raw ? faceLabel : `${faceLabel} ${die.value > die.raw ? '+' : '−'} ${Math.abs(die.value - die.raw)} = ${die.value}`}
                                            </span>;
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className={`mt-1 grid min-h-[52px] shrink-0 gap-6 text-center font-bold ${sides.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`} data-testid={showDamage ? 'qidahen-battle-stage-damage' : undefined} style={{ visibility: showDamage ? 'visible' : 'hidden' }}>
                {sides.map(side => <div key={side} data-testid={`qidahen-battle-result-${side}`} style={{ ...battleLabelStyle, justifySelf: 'center' }}>
                    <div data-qidahen-battle-label={`${side}-total`} className="text-[22px] leading-7">{t('board.battleRoll.total', { total: side === 'attacker' ? stage.attackerTotal : stage.defenderTotal })}</div>
                    <div data-qidahen-battle-label={`${side}-damage`} className="text-[16px] leading-6">{t('board.battleRoll.damageTo', { damage: side === 'attacker' ? stage.attackerDamage : stage.defenderDamage, target: actors[side === 'attacker' ? 'defender' : 'attacker'].name })}</div>
                </div>)}
            </div>
        </section>
    );
}
