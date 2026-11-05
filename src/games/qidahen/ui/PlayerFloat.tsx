import React from 'react';
import {
    type QidahenCore,
    type QidahenFactionId,
    getQidahenPrestigeBonusByFaction,
    getQidahenEffectiveVpByFaction,
} from '../domain';
import { useTranslation } from 'react-i18next';
import { factionTone } from './boardReadModel';
import { UI_STYLE, UI_SURFACE } from './boardLayout';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

export const PlayerChip: React.FC<{
    faction: QidahenCore['factions'][QidahenFactionId];
    current: boolean;
    effectiveVp: number;
    prestigeBonus: number;
    onInspect: () => void;
}> = ({ faction, current, effectiveVp, prestigeBonus, onInspect }) => {
    const { t } = useTranslation('game-qidahen');
    const tone = factionTone[faction.id];
    const markedCharacters = faction.characters.filter((character) => character.defeatMarkers > 0);
    const characterSummary =
        markedCharacters.length > 0
            ? markedCharacters
                  .map((character) =>
                      t('board.player.characterDefeatMarkers', {
                          name: character.name,
                          number: character.number,
                          count: character.defeatMarkers,
                          defaultValue: '{{name}}({{number}})败×{{count}}',
                      }),
                  )
                  .join(' / ')
            : null;
    return (
        <button
            type="button"
            className="relative flex h-[58px] min-w-0 flex-1 items-center gap-2 overflow-hidden border px-2.5 text-left"
            data-testid={`qidahen-player-${faction.id}`}
            onClick={onInspect}
            style={{
                borderColor: current ? tone.border : UI_STYLE.mapInk,
                background: current ? UI_SURFACE.mapOpenPanelSelected : UI_SURFACE.mapOpenPanel,
                color: UI_STYLE.ink,
                boxShadow: current
                    ? UI_SURFACE.mapOpenPanelShadow
                    : '0 2px 7px rgba(56,35,15,0.08), inset 0 0 0 1px rgba(255,250,232,0.42)',
                borderRadius: 10,
            }}
        >
            <span
                className="pointer-events-none absolute inset-y-0 left-0 w-[5px]"
                style={{ background: current ? tone.border : 'rgba(210,183,117,0.72)' }}
            />
            <span
                className="pointer-events-none absolute inset-x-[16px] top-[3px] h-[1px]"
                style={{ background: 'rgba(232,200,133,0.34)' }}
            />
            <OptimizedImage
                src={tone.chip}
                alt={faction.name}
                className="h-9 w-9 shrink-0 rounded-full border object-cover"
                style={{ borderColor: tone.border, boxShadow: '0 2px 6px rgba(56,35,15,0.18)' }}
                draggable={false}
                placeholder={false}
            />
            <div className="min-w-0 flex-1 text-[15px] font-black leading-none tracking-[0.02em]">
                <div className="min-w-0 whitespace-nowrap">
                    <span>{faction.name}</span>
                    <span className="ml-2 text-[12px]" style={{ color: UI_STYLE.bronze }}>
                        VP{effectiveVp}
                    </span>
                    {prestigeBonus > 0 ? (
                        <span className="ml-2 text-[11px]" style={{ color: UI_STYLE.bronze }}>
                            {t('board.player.prestigeBonus', {
                                bonus: prestigeBonus,
                                defaultValue: '汉城+{{bonus}}',
                            })}
                        </span>
                    ) : null}
                    <span className="ml-2 text-[12px]" style={{ color: UI_STYLE.bronze }}>
                        {faction.handCount}/{faction.handLimit}
                    </span>
                </div>
                {characterSummary ? (
                    <div
                        className="mt-1 truncate text-[11px] leading-none"
                        data-testid={`qidahen-character-markers-${faction.id}`}
                        style={{ color: UI_STYLE.mutedInk }}
                    >
                        {characterSummary}
                    </div>
                ) : null}
            </div>
            {faction.defeatMarkers > 0 ? (
                <span
                    className="grid h-[24px] min-w-[38px] shrink-0 place-items-center border px-1.5 text-[11px] font-black"
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: 'rgba(238, 210, 159, 0.78)',
                        color: UI_STYLE.ink,
                        boxShadow: `0 2px 5px ${UI_STYLE.shadowSoft}`,
                        borderRadius: 2,
                    }}
                >
                    {t('board.player.defeatMarkers', {
                        count: faction.defeatMarkers,
                        defaultValue: '败×{{count}}',
                    })}
                </span>
            ) : null}
            {current ? (
                <span
                    className="grid h-[24px] w-[44px] shrink-0 place-items-center border text-[11px] font-black"
                    style={{
                        background: 'linear-gradient(180deg, rgba(216,123,82,0.78) 0%, rgba(180,76,54,0.72) 100%)',
                        borderColor: UI_STYLE.mapInk,
                        color: UI_STYLE.ink,
                        boxShadow: `0 2px 5px ${UI_STYLE.cinnabarGlow}`,
                        borderRadius: 2,
                    }}
                >
                    {t('board.player.current', { defaultValue: '当前' })}
                </span>
            ) : null}
        </button>
    );
};

export const PlayerFloat: React.FC<{
    core: QidahenCore;
    onInspectFaction: (factionId: QidahenFactionId) => void;
}> = ({ core, onInspectFaction }) => {
    const prestigeBonusByFaction = getQidahenPrestigeBonusByFaction(core);
    return (
        <div
            className="pointer-events-auto absolute left-[740px] top-[16px] z-40 flex w-[720px] gap-2"
            data-testid="qidahen-player-float"
            data-tutorial-id="qidahen-player-float"
            data-ui-anchor="top-right"
            style={{
                left: 'calc(740px + var(--qidahen-mobile-edge-pull, 0px))',
                top: 'calc(16px + var(--qidahen-mobile-top-inset, 0px))',
            }}
        >
            {(['ming', 'mongol', 'jin'] as QidahenFactionId[]).map((id) => (
                <PlayerChip
                    key={id}
                    faction={core.factions[id]}
                    current={core.currentPlayer === core.factions[id].playerId}
                    effectiveVp={getQidahenEffectiveVpByFaction(core, id)}
                    prestigeBonus={prestigeBonusByFaction[id]}
                    onInspect={() => onInspectFaction(id)}
                />
            ))}
        </div>
    );
};
