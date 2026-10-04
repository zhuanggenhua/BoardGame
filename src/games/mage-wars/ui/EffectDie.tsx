import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { EFFECT_DIE_FACES } from './effectDieGeometry';
import { MAGE_WARS_FX_TIMING } from './fxTuning';
import './effectDie.css';

type Face = typeof EFFECT_DIE_FACES[number];
const matrix = (u: readonly number[], v: readonly number[], n: readonly number[]) =>
    `matrix3d(${[...u, 0, ...v, 0, ...n, 0, 0, 0, 0, 1].join(',')})`;
const orientation = (face: Face) => matrix(face.u, face.v, face.normal);

function resultOrientation(face: Face) {
    const { u, v, normal: n } = face;
    // Inverse of the source face basis points its original UV toward the camera.
    const inverse = matrix([u[0], v[0], n[0]], [u[1], v[1], n[1]], [u[2], v[2], n[2]]);
    const upright = [5, 6, 7, 9, 10].includes(face.value) ? 180 : 0;
    return `rotateZ(${upright}deg) ${inverse}`;
}

/** TTS native mesh faces and UVs, animated as a CSS solid like DiceThrone Dice2D. */
export function EffectDie({ result, resolvedResult = result }: { result: number; resolvedResult?: number }) {
    const reducedMotion = useReducedMotion() === true;
    const [isRolling, setIsRolling] = useState(!reducedMotion);
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setIsRolling(!reducedMotion));
        return () => window.cancelAnimationFrame(frame);
    }, [result, reducedMotion]);
    const resultFace = EFFECT_DIE_FACES.find((face) => face.value === result)!;
    return (
        <div
            className="mage-wars-effect-die relative shrink-0 h-[clamp(3rem,4vw,5rem)] w-[clamp(3rem,4vw,5rem)]"
            data-testid="mage-wars-fx-effect-die-face"
            data-visual-role="effect-die-result"
            data-die-kind="d12"
            data-asset-status="source-verified"
            data-model-source="tts-native:Die_12:f9cb19"
            data-rendering-mode="css-native-mesh-faces"
            aria-label={`效果骰 ${result}`}
            role="img"
        >
            <div className="mage-wars-effect-die-shadow" aria-hidden="true" />
            <div
                className={`mage-wars-effect-die-body ${isRolling ? 'mage-wars-effect-die-rolling' : ''}`}
                style={{ animationDuration: `${MAGE_WARS_FX_TIMING.diceResultRollMs}ms` }}
                onAnimationEnd={(event) => { if (event.target === event.currentTarget) setIsRolling(false); }}
                data-testid="mage-wars-fx-effect-die-css-body"
                data-die-renderer="css-d12"
                data-roll-animation={isRolling ? 'mage-wars-d12-tumble' : 'settled'}
                data-roll-duration-ms={MAGE_WARS_FX_TIMING.diceResultRollMs}
                data-d12-face-count={EFFECT_DIE_FACES.length}
                aria-hidden="true"
            >
                <div className="mage-wars-effect-die-solid" style={{ transform: resultOrientation(resultFace) }} data-settled-face-value={result} data-settled-tilt="none">
                    {EFFECT_DIE_FACES.map((face) => (
                        <div
                            key={face.value}
                            className="mage-wars-effect-die-face"
                            data-d12-face-value={face.value}
                            style={{
                                width: `${face.width * 100}%`, height: `${face.height * 100}%`,
                                transform: `translate3d(${face.center.map((c) => `calc(var(--effect-die-size) * ${c})`).join(',')}) ${orientation(face)} translate(-50%, -50%)`,
                                clipPath: `polygon(${face.clip.map(([x, y]) => `${x * 100}% ${y * 100}%`).join(',')})`,
                            }}
                        >
                            <OptimizedImage
                                src="mage-wars/dice/effect-die-numbers"
                                alt=""
                                locale="zh-CN"
                                placeholder={false}
                                className="absolute max-w-none select-none"
                                style={{
                                    width: `${100 / face.uvSize[0]}%`, height: `${100 / face.uvSize[1]}%`,
                                    left: `${-100 * face.uvMin[0] / face.uvSize[0]}%`,
                                    top: `${-100 * face.uvMin[1] / face.uvSize[1]}%`,
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {!isRolling && resolvedResult !== result && (
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-bold text-white" data-testid="mage-wars-effect-die-modifier">
                    {result} {resolvedResult > result ? '+' : '−'} {Math.abs(resolvedResult - result)} = {resolvedResult}
                </span>
            )}
        </div>
    );
}
