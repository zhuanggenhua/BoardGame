import React from 'react';
import { useTranslation } from 'react-i18next';

/** 独立开发版通过 iframe 挂载，避免与大厅运行时共享游戏状态。 */
export const FateDominationDev: React.FC = () => {
  const { t } = useTranslation('game-fate-domination');
  return (
    <iframe
      title={t('dev.title')}
      src="/fate-domination-dev/index.html"
      style={{
        display: 'block',
        width: '100%',
        height: '100dvh',
        border: 0,
        background: '#111827',
      }}
    />
  );
};

export default FateDominationDev;
