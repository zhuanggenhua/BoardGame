import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { useResultRevealAnimation } from '../../../hooks/ui/useResultRevealAnimation';
import {
    ATTACK_DIE_FACES,
    ATTACK_DIE_SETTLED_TILT,
    ATTACK_DIE_TEXTURE,
    getAttackDieFaceKind,
    getAttackDieSettledFaceId,
    getAttackDieSettledTransform,
} from './attackDieGeometry';
import { MAGE_WARS_FX_TIMING } from './fxTuning';
import './attackDie.css';

/** CSS cube from the official attack-die net, matching DiceThrone Dice2D / Summoner Wars Dice3D. */
export function AttackDie({ result, index = 0 }: { result: number; index?: number }) {
    const reducedMotion = useReducedMotion() === true;
    const tumbleMs = MAGE_WARS_FX_TIMING.diceResultTumbleMs + index * 80;
    const settleMs = MAGE_WARS_FX_TIMING.diceResultSettleMs;
    const { isRevealing: isRolling } = useResultRevealAnimation({
        value: result,
        durationMs: tumbleMs,
        animateOnMount: !reducedMotion,
        isActive: !reducedMotion,
    });
    const settledKind = getAttackDieFaceKind(result);
    const settledFaceId = getAttackDieSettledFaceId(result);
    const translateZ = 'calc(var(--attack-die-size) / 2)';

    return (
        <div
            className="mage-wars-attack-die relative shrink-0 h-[clamp(3rem,4vw,5rem)] w-[clamp(3rem,4vw,5rem)]"
            data-testid="mage-wars-fx-attack-die-face"
            data-visual-role="attack-die-result"
            data-die-kind="d6"
            data-asset-status="source-verified"
            data-model-source="cube-net:attack-die-texture"
            data-rendering-mode="css-native-cube-faces"
            data-roll-duration-ms={tumbleMs}
            data-settle-duration-ms={settleMs}
            aria-label={`攻击骰 ${result}`}
            role="img"
        >
            <div className="mage-wars-attack-die-shadow" aria-hidden="true" />
            <div
                className="mage-wars-attack-die-pose"
                style={{ transform: ATTACK_DIE_SETTLED_TILT }}
                data-settled-tilt="result-3d"
                aria-hidden="true"
            >
                <div
                    className={`mage-wars-attack-die-cube ${isRolling ? 'mage-wars-attack-die-rolling' : ''}`}
                    style={{
                        transform: isRolling
                            ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
                            : getAttackDieSettledTransform(result),
                        transition: isRolling ? 'none' : `transform ${settleMs}ms cubic-bezier(0.2, 0.8, 0.3, 1)`,
                    }}
                    data-testid="mage-wars-fx-attack-die-css-body"
                    data-die-renderer="css-d6"
                    data-roll-animation={isRolling ? 'mage-wars-d6-tumble' : 'settled'}
                    data-roll-duration-ms={tumbleMs}
                    data-settled-face-value={result}
                    data-settled-face-id={settledFaceId}
                    data-settled-face-kind={settledKind}
                    data-settled-tilt="result-3d"
                    aria-hidden="true"
                >
                {ATTACK_DIE_FACES.map((face) => {
                    const cubeTransform = face.cubeRotate
                        ? `${face.cubeRotate} translateZ(${translateZ})`
                        : `translateZ(${translateZ})`;
                    return (
                        <div
                            key={face.id}
                            className="mage-wars-attack-die-face"
                            data-d6-face-id={face.id}
                            data-d6-face-kind={face.kind}
                            data-d6-face-result={face.result}
                            style={{ transform: cubeTransform }}
                        >
                            <div
                                className="mage-wars-attack-die-face-art"
                                style={face.glyphRotateDeg
                                    ? { transform: `rotate(${face.glyphRotateDeg}deg)` }
                                    : undefined}
                            >
                                <OptimizedImage
                                    src={ATTACK_DIE_TEXTURE}
                                    alt=""
                                    locale="zh-CN"
                                    placeholder={false}
                                    className="absolute max-w-none select-none"
                                    style={{
                                        width: `${100 / face.uvSize[0]}%`,
                                        height: `${100 / face.uvSize[1]}%`,
                                        left: `${-100 * face.uvMin[0] / face.uvSize[0]}%`,
                                        top: `${-100 * face.uvMin[1] / face.uvSize[1]}%`,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
                </div>
            </div>
        </div>
    );
}
