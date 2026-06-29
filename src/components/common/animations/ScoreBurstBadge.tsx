import React from 'react';
import { motion, useAnimate } from 'framer-motion';

export type ScoreBurstTone = 'gold' | 'emerald' | 'crimson' | 'violet' | 'slate';

export interface ScoreBurstBadgeProps {
  value: string;
  tone?: ScoreBurstTone;
  emphasis?: 'normal' | 'strong';
  className?: string;
  textClassName?: string;
  testId?: string;
  onComplete?: () => void;
}

const TONE_STYLES: Record<ScoreBurstTone, {
  accent: string;
  glow: string;
  text: string;
}> = {
  gold: {
    accent: 'rgba(255, 224, 145, 0.92)',
    glow: 'rgba(255, 206, 112, 0.36)',
    text: '#fff2bf',
  },
  emerald: {
    accent: 'rgba(167, 243, 208, 0.92)',
    glow: 'rgba(52, 211, 153, 0.32)',
    text: '#d1fae5',
  },
  crimson: {
    accent: 'rgba(254, 202, 202, 0.88)',
    glow: 'rgba(248, 113, 113, 0.32)',
    text: '#ffe2df',
  },
  violet: {
    accent: 'rgba(221, 214, 254, 0.9)',
    glow: 'rgba(167, 139, 250, 0.32)',
    text: '#f3e8ff',
  },
  slate: {
    accent: 'rgba(226, 232, 240, 0.86)',
    glow: 'rgba(148, 163, 184, 0.24)',
    text: '#e2e8f0',
  },
};

export const ScoreBurstBadge: React.FC<ScoreBurstBadgeProps> = ({
  value,
  tone = 'gold',
  emphasis = 'normal',
  className,
  textClassName,
  testId,
  onComplete,
}) => {
  const [scope, animate] = useAnimate();
  const style = TONE_STYLES[tone];
  const isStrong = emphasis === 'strong';

  React.useEffect(() => {
    const run = async () => {
      await animate(scope.current, {
        opacity: 1,
        y: -30,
        x: 0,
        scale: isStrong ? 1.26 : 1.16,
      }, {
        duration: 0.11,
        ease: [0.16, 0.84, 0.28, 1.12],
      });

      await animate(scope.current, {
        y: -76,
        x: 0,
        scale: isStrong ? 1.06 : 1,
      }, {
        duration: 0.36,
        ease: [0.12, 0.72, 0.18, 1],
      });

      await animate(scope.current, {
        opacity: 0,
        y: -108,
        x: 0,
        scale: 0.92,
      }, {
        duration: 0.22,
        ease: [0.24, 0.72, 0.32, 1],
      });

      onComplete?.();
    };

    void run();
  }, [animate, isStrong, onComplete, scope]);

  return (
    <div className={className} data-testid={testId}>
      <motion.div
        ref={scope}
        initial={{ opacity: 0, scale: 0.72, x: 0, y: 8 }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: 'center center',
        }}
      >
        <span
          className={textClassName}
          style={{
            color: style.text,
            textShadow: [
              '0 2px 0 rgba(24, 14, 8, 0.86)',
              `0 0 12px ${style.glow}`,
              `0 0 26px ${style.accent}`,
              '0 12px 24px rgba(0, 0, 0, 0.34)',
            ].join(', '),
            filter: `drop-shadow(0 0 16px ${style.glow})`,
          }}
        >
          {value}
        </span>
      </motion.div>
    </div>
  );
};

export default ScoreBurstBadge;
