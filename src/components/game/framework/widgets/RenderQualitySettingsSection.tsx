import type { TFunction } from 'i18next';
import type { RenderQualityPreset } from '../../../../engine/renderPipeline';
import { useRenderQualityPreference } from '../../../../engine/renderPipeline';

const QUALITY_OPTIONS: RenderQualityPreset[] = ['low', 'medium', 'high'];

export interface RenderQualitySettingsSectionProps {
  t: TFunction | ((key: string) => string);
}

export function RenderQualitySettingsSection({ t }: RenderQualitySettingsSectionProps) {
  const [preset, setPreset] = useRenderQualityPreference();

  return (
    <div
      className="mt-4 space-y-3 rounded-lg border border-sky-400/20 bg-sky-500/10 p-3"
      data-testid="render-quality-settings"
    >
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-sky-200">
          {t('hud.graphics.title')}
        </div>
        <div className="mt-1 text-[11px] text-white/55">
          {t('hud.graphics.description')}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('hud.graphics.title')}>
        {QUALITY_OPTIONS.map((option) => {
          const active = preset === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              data-testid={`render-quality-option-${option}`}
              onClick={() => setPreset(option)}
              className={`rounded-md border px-2 py-2 text-xs font-bold transition-colors ${
                active
                  ? 'border-sky-300 bg-sky-300/25 text-white'
                  : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <span className="block">{t(`hud.graphics.${option}`)}</span>
              <span className="mt-0.5 block text-[9px] font-medium text-white/50">
                {t(`hud.graphics.${option}Hint`)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
