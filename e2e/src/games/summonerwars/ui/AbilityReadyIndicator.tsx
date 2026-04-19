/**
 * 技能准备就绪指示器
 * 在可以使用主动技能的单位卡牌边框产生青色波纹扩散效果。
 * 波纹从卡牌边框向外 scale 扩散，叠在绿色可操作边框之上。
 *
 * 仅对主动技能（trigger='activated' 或 requiresButton=true）显示，
 * 被动技能（passive/onMove/afterAttack 等无按钮的）不会触发此指示器。
 * 过滤逻辑见 domain/abilityHelpers.ts → getActivatableAbilities()。
 */

import React from 'react';
import { motion } from 'framer-motion';

export const AbilityReadyIndicator: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* 三层向外扩散的边框波纹（用 scale 保持形状一致） */}
      {[0, 0.6, 1.2].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-lg border-[3px] border-cyan-300"
          initial={{ opacity: 0, scale: 1 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [1, 1.15, 1.3],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay,
            ease: 'easeOut',
          }}
        />
      ))}
      {/* 静态内发光（始终可见，提供持续的青色氛围） */}
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          boxShadow: 'inset 0 0 10px 3px rgba(34,211,238,0.35), 0 0 8px 2px rgba(34,211,238,0.3)',
        }}
      />
    </div>
  );
};
