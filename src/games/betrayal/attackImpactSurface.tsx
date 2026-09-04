import React from "react";
import {
  DamageFlash,
  HitStopContainer,
  ShakeContainer,
  useImpactFeedback,
} from "../../components/common/animations";
import type { BetrayalTraitKey } from "./game";
import {
  BETRAYAL_ATTACK_IMPACT_COMPLETE_MS,
  BETRAYAL_ATTACK_IMPACT_FLASH_RESET_MS,
  BETRAYAL_ATTACK_IMPACT_PULSE_COLOR,
  BETRAYAL_ATTACK_IMPACT_PULSE_DURATION_MS,
  BETRAYAL_ATTACK_IMPACT_SLASH_ACTIVE_MS,
  BETRAYAL_ATTACK_IMPACT_SLASH_COLOR,
  BETRAYAL_ATTACK_IMPACT_SLASH_DURATION_MS,
  type BetrayalAttackImpactState,
} from "./attackImpactPresentation";

const TRAIT_DAMAGE_TONE: Record<
  BetrayalTraitKey,
  { color: string; glow: string }
> = {
  might: { color: "#ff9f8b", glow: "rgba(255, 112, 86, 0.62)" },
  speed: { color: "#ffe27a", glow: "rgba(255, 210, 82, 0.56)" },
  knowledge: { color: "#a9e6f2", glow: "rgba(116, 202, 224, 0.52)" },
  sanity: { color: "#d2a8ff", glow: "rgba(176, 111, 235, 0.56)" },
};

export function BetrayalAttackImpactSurface({
  impact,
  presentationKey,
  surface,
  traitLabel,
  children,
  density = "token",
}: {
  impact: BetrayalAttackImpactState;
  presentationKey: string;
  surface: string;
  traitLabel: (trait: BetrayalTraitKey) => string;
  children: React.ReactNode;
  density?: "token" | "panel";
}) {
  const impactFeedback = useImpactFeedback(undefined, {
    flashResetDelay: BETRAYAL_ATTACK_IMPACT_FLASH_RESET_MS,
  });
  const { trigger, shake, hitStop, flash } = impactFeedback;
  const primaryTrait =
    impact.losses[0]?.trait ??
    (impact.damageKind === "mental" ? "sanity" : "might");
  const primaryTone = TRAIT_DAMAGE_TONE[primaryTrait];
  const damageAmount = Math.max(
    1,
    impact.damageAmount,
    impact.losses.reduce((sum, entry) => sum + entry.amount, 0),
  );
  const testId = `betrayal-attack-impact-${surface}-${impact.playerId}`;
  const lossLabels =
    impact.losses.length > 0
      ? impact.losses
      : [{ trait: primaryTrait, amount: damageAmount }];

  React.useEffect(() => {
    trigger(damageAmount);
  }, [damageAmount, presentationKey, trigger]);

  return (
    <div
      key={presentationKey}
      data-testid={testId}
      data-attack-impact-active="true"
      data-attack-impact-role={impact.role}
      data-attack-impact-kind={impact.damageKind}
      data-attack-impact-traits={impact.losses
        .map((entry) => entry.trait)
        .join(",")}
      data-density={density}
      className="betrayal-attack-impact-surface"
      style={
        {
          "--betrayal-impact-color": primaryTone.color,
          "--betrayal-impact-glow": primaryTone.glow,
        } as React.CSSProperties
      }
    >
      <ShakeContainer
        isShaking={shake.isShaking}
        className="betrayal-attack-impact-shake"
      >
        <HitStopContainer
          isActive={hitStop.isActive}
          {...(hitStop.config ?? {})}
          className="betrayal-attack-impact-target"
        >
          {children}
        </HitStopContainer>
      </ShakeContainer>
      <span
        data-testid={`betrayal-attack-impact-flash-${surface}-${impact.playerId}`}
        data-attack-impact-flash="true"
        className="betrayal-attack-impact-flash"
      >
        <span
          data-testid={`betrayal-attack-impact-slash-${surface}-${impact.playerId}`}
          data-attack-impact-slash="true"
          className="betrayal-attack-impact-slash"
        >
          <DamageFlash
            active={flash.isActive}
            damage={damageAmount}
            intensity={damageAmount >= 3 ? "strong" : "normal"}
            showNumber={false}
            slashColor={BETRAYAL_ATTACK_IMPACT_SLASH_COLOR}
            pulseColor={BETRAYAL_ATTACK_IMPACT_PULSE_COLOR}
            slashDurationMs={BETRAYAL_ATTACK_IMPACT_SLASH_DURATION_MS}
            slashActiveMs={BETRAYAL_ATTACK_IMPACT_SLASH_ACTIVE_MS}
            pulseDurationMs={BETRAYAL_ATTACK_IMPACT_PULSE_DURATION_MS}
            pulseActiveMs={BETRAYAL_ATTACK_IMPACT_PULSE_DURATION_MS}
            completeMs={BETRAYAL_ATTACK_IMPACT_COMPLETE_MS}
          />
        </span>
      </span>
      <span
        data-testid={`betrayal-attack-impact-floating-${surface}-${impact.playerId}`}
        className="betrayal-attack-impact-floating"
      >
        {lossLabels.map((entry, index) => {
          const tone = TRAIT_DAMAGE_TONE[entry.trait];
          return (
            <span
              key={`${entry.trait}-${index}`}
              data-testid={`betrayal-attack-impact-floating-${surface}-${impact.playerId}-${entry.trait}`}
              data-attack-impact-trait={entry.trait}
              style={{
                color: tone.color,
                textShadow: `0 0 10px ${tone.glow}, 0 2px 4px rgba(0,0,0,0.86)`,
              }}
            >
              -{entry.amount} {traitLabel(entry.trait)}
            </span>
          );
        })}
      </span>
    </div>
  );
}
