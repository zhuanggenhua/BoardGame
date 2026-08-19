import React from 'react';
import { useTranslation } from 'react-i18next';
import type { QidahenCore } from './domain';

interface QidahenDebugConfigProps {
    G: { core?: QidahenCore } | undefined;
}

const DEV_TOOL_LINKS = [
    {
        href: '/dev/qidahen-region-mask',
        titleKey: 'debug.tools.regionMask.title',
        descriptionKey: 'debug.tools.regionMask.description',
        testId: 'qidahen-debug-open-region-mask',
    },
    {
        href: '/dev/qidahen-runtime-preview',
        titleKey: 'debug.tools.runtimePreview.title',
        descriptionKey: 'debug.tools.runtimePreview.description',
        testId: 'qidahen-debug-open-runtime-preview',
    },
] as const;

const formatFactionSummary = (core: QidahenCore | undefined) => {
    if (!core?.factions) return [];
    return (Object.values(core.factions) as QidahenCore['factions'][keyof QidahenCore['factions']][])
        .map((faction) => `${faction.name} VP ${faction.vp} / 手牌 ${faction.handCount}`);
};

export const QidahenDebugConfig: React.FC<QidahenDebugConfigProps> = ({ G }) => {
    const { t } = useTranslation('game-qidahen');
    const core = G?.core;
    const factionSummaries = formatFactionSummary(core);

    return (
        <div className="space-y-4" data-testid="qidahen-debug-tools">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-amber-700">
                    {t('debug.tools.sectionTitle', { defaultValue: '七大恨专项工具' })}
                </h4>
                <div className="space-y-2">
                    {DEV_TOOL_LINKS.map((tool) => (
                        <a
                            key={tool.href}
                            href={tool.href}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={tool.testId}
                            className="block rounded-md border border-amber-200 bg-white px-3 py-2 text-left text-xs shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
                        >
                            <span className="block font-bold text-amber-900">
                                {t(tool.titleKey, { defaultValue: tool.href })}
                            </span>
                            <span className="mt-1 block leading-4 text-amber-700">
                                {t(tool.descriptionKey, { defaultValue: tool.href })}
                            </span>
                        </a>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-stone-700">
                    {t('debug.stateSummary.sectionTitle', { defaultValue: '局面速查' })}
                </h4>
                <div className="space-y-1 text-[10px] leading-4 text-stone-600">
                    <div>
                        <span className="font-bold text-stone-800">{t('debug.stateSummary.turn', { defaultValue: '当前回合' })}: </span>
                        {core?.turnLabel ?? '-'}
                    </div>
                    <div>
                        <span className="font-bold text-stone-800">{t('debug.stateSummary.phase', { defaultValue: '阶段' })}: </span>
                        {core?.turnPhase ?? '-'}
                    </div>
                    <div>
                        <span className="font-bold text-stone-800">{t('debug.stateSummary.wheel', { defaultValue: '轮盘' })}: </span>
                        {core?.actionWheelPosition ?? '-'}
                    </div>
                    {factionSummaries.length > 0 ? (
                        <div className="space-y-0.5 pt-1">
                            {factionSummaries.map((summary) => (
                                <div key={summary}>{summary}</div>
                            ))}
                        </div>
                    ) : (
                        <div>{t('debug.stateSummary.empty', { defaultValue: '暂无局面数据。' })}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QidahenDebugConfig;
