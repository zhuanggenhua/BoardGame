import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getLocalizedAssetPath, getOptimizedImageUrls } from '../../../core/AssetLoader';
import { useResultRevealAnimation } from '../../../hooks/ui/useResultRevealAnimation';
import {
    ATTACK_DIE_FACE_BACKGROUND,
    ATTACK_DIE_FACES,
    ATTACK_DIE_REVEAL_MS,
    ATTACK_DIE_REVEAL_STAGGER_MS,
    ATTACK_DIE_SETTLED_TILT,
    ATTACK_DIE_TEXTURE,
    getAttackDieFaceArtStyle,
    getAttackDieFaceKind,
    getAttackDieResultFace,
    getAttackDieSettledFaceId,
    getAttackDieSettledTransform,
} from './attackDieGeometry';
import { MAGE_WARS_FX_TIMING } from './fxTuning';
import './attackDie.css';

function resolveAttackDieTextureUrl(): string {
    const localized = getLocalizedAssetPath(ATTACK_DIE_TEXTURE, 'zh-CN');
    return getOptimizedImageUrls(localized).webp;
}

/** CSS cube from the official attack-die net, matching Summoner Wars Dice3D face painting. */
export function AttackDie({ result, index = 0 }: { result: number; index?: number }) {
    const reducedMotion = useReducedMotion() === true;
    const tumbleMs = ATTACK_DIE_REVEAL_MS + index * ATTACK_DIE_REVEAL_STAGGER_MS;
    const settleMs = MAGE_WARS_FX_TIMING.diceResultSettleMs;
    const { isRevealing: isRolling } = useResultRevealAnimation({
        value: result,
        durationMs: tumbleMs,
        animateOnMount: !reducedMotion,
        isActive: !reducedMotion,
    });
    const settledKind = getAttackDieFaceKind(result);
    const settledFaceId = getAttackDieSettledFaceId(result);
    const resultFace = getAttackDieResultFace(result);
    const textureUrl = React.useMemo(() => resolveAttackDieTextureUrl(), []);
    const translateZ = 'calc(var(--attack-die-size) / 2)';
    const isHit = result > 0;

    return (
        <div
            className="mage-wars-attack-die relative shrink-0"
            data-testid="mage-wars-fx-attack-die-face"
            data-visual-role="attack-die-result"
            data-die-kind="d6"
            data-asset-status="source-verified"
            data-model-source="cube-net:attack-die-texture"
            data-rendering-mode="css-native-cube-faces"
            data-visual-mode="css-2d-cube"
            data-face-renderer="css-background"
            data-roll-duration-ms={tumbleMs}
            data-settle-duration-ms={settleMs}
            aria-label={`攻击骰 ${result}`}
            role="img"
        >
            <div className="mage-wars-attack-die-shadow" aria-hidden="true" />
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
                data-settled-tilt={ATTACK_DIE_SETTLED_TILT}
                aria-hidden="true"
            >
                {ATTACK_DIE_FACES.map((face) => {
                    const isFront = face.cubeRotate === '';
                    const artFace = isFront ? resultFace : face;
                    const cubeTransform = face.cubeRotate
                        ? `${face.cubeRotate} translateZ(${translateZ})`
                        : `translateZ(${translateZ})`;
                    const artStyle = getAttackDieFaceArtStyle(artFace);
                    return (
                        <div
                            key={face.id}
                            className={`mage-wars-attack-die-face${!isRolling && isHit ? ' mage-wars-attack-die-face-hit' : ''}`}
                            data-d6-face-id={face.id}
                            data-d6-face-kind={isFront ? settledKind : face.kind}
                            data-d6-face-result={isFront ? result : face.result}
                            data-face-renderer="css-background"
                            data-hit-edge={!isRolling && isHit ? 'true' : undefined}
                            style={{
                                transform: cubeTransform,
                                backgroundColor: ATTACK_DIE_FACE_BACKGROUND,
                            }}
                        >
                            <div
                                className="mage-wars-attack-die-face-art"
                                style={{
                                    backgroundImage: textureUrl ? `url(${textureUrl})` : undefined,
                                    backgroundRepeat: 'no-repeat',
                                    ...artStyle,
                                    transform: artFace.glyphRotateDeg
                                        ? `rotate(${artFace.glyphRotateDeg}deg)`
                                        : undefined,
                                }}
                            />
                        </div>
                    );
                })}
                {!isRolling && isHit ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mage-wars-attack-die-hit-glow"
                        data-testid="mage-wars-fx-attack-die-hit-glow"
                        data-hit-glow-mode="face-hugging"
                        style={{ transform: `translateZ(${translateZ})` }}
                        aria-hidden="true"
                    />
                ) : null}
            </div>
            {!isRolling && !isHit ? (
                <div
                    className="pointer-events-none absolute inset-0 rounded-[0.5vw]"
                    data-testid="mage-wars-fx-attack-die-miss-overlay"
                    style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                    aria-hidden="true"
                />
            ) : null}
        </div>
    );
}
