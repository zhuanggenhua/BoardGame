import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import { useEventStreamCursor } from '../../../engine/hooks/useEventStreamCursor';
import { useEventStreamRollback } from '../../../engine/hooks/EventStreamRollbackContext';
import type { MatchState } from '../../../engine/types';
import type { FateDominationCore, LocationId } from '../domain/types';
import { FGO_SERVANTS, loadedFgoCharacter, loadedFgoNoble, preloadFgoCharacter, preloadFgoNoble, retainFgoAssets } from '../fgo-runtime/fgoPreload';
import { createFgoBattleRuntime } from '../fgo-runtime/fgoCharacterRuntime';
import { createFgoSceneRuntime } from '../fgo-runtime/fgoSceneRuntime';
import { fateFgoSequenceFor, type FgoSequence } from './fgoSequence';
import './fgo-effects.css';

const reportPreloadFailure = (label: string) => (error: unknown) => {
  if (!(error instanceof DOMException && error.name === 'AbortError')) console.warn(label, error);
};

function BattleMotion({ sequence, onComplete }: { sequence: Extract<FgoSequence, { kind: 'battle' }>; onComplete: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) { onComplete(); return; }
    const actors = sequence.actors.flatMap(actor => {
      const loaded = loadedFgoCharacter(actor.servantId);
      return loaded ? [{ ...actor, loaded }] : [];
    });
    try {
      const runtime = createFgoBattleRuntime(host.current, actors, sequence.laneCount, onComplete);
      if (!runtime) { onComplete(); return; }
      return () => runtime.destroy();
    } catch (error) {
      console.warn('Fate 战斗演出无法播放', error);
      onComplete();
    }
  }, [sequence, onComplete]);
  return <div ref={host} className="fd-fgo-battle" data-testid="fate-fgo-battle" aria-hidden="true" />;
}

function NobleMotion({ onComplete }: { onComplete: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const loaded = loadedFgoNoble();
    if (!host.current || !loaded) { onComplete(); return; }
    let alive = true;
    let finished = false;
    const fade = loaded.effects.timeline.filter(event => event.type === 'fade').sort((a, b) => b.time - a.time)[0];
    const fadeKeys = fade && (Array.isArray(fade.fadeCurve) ? fade.fadeCurve : fade.fadeCurve?.m_Curve);
    const endAt = fade && fadeKeys?.at(-1)?.value === 1
      ? Math.min(loaded.effects.duration, fade.time + fade.duration) : loaded.effects.duration;
    try {
      const runtime = createFgoSceneRuntime(host.current, loaded, {
        autoplay: true, shouldAttach: () => alive,
        onStatus: status => {
          if (alive && !finished && status.time >= endAt) { finished = true; onComplete(); }
        },
      });
      return () => { alive = false; runtime.destroy(); };
    } catch (error) {
      console.warn('Fate 宝具演出无法播放', error instanceof Error ? error.stack : String(error));
      onComplete();
      return () => { alive = false; };
    }
  }, [onComplete]);
  return <div ref={host} className="fd-fgo-noble" data-testid="fate-fgo-noble" aria-hidden="true" />;
}

export function FateFgoEffects({ state, viewerId, battleAnchors }: {
  state: MatchState<FateDominationCore>; viewerId: string | null; battleAnchors?: Partial<Record<LocationId, HTMLDivElement>>;
}) {
  const selectedPlayer = viewerId ? state.core.players[viewerId] : undefined;
  const selected = selectedPlayer?.servantId;
  const selectedRevealed = selectedPlayer?.isRevealed;
  const entries = getEventStreamEntries(state);
  const { consumeNew } = useEventStreamCursor({ entries, consumeOnReconcile: true });
  const rollback = useEventStreamRollback();
  const [queue, setQueue] = useState<FgoSequence[]>([]);
  useEffect(() => retainFgoAssets(), []);
  useEffect(() => {
    if (selected) void preloadFgoCharacter(selected, selectedRevealed ? 'high' : 'low').catch(reportPreloadFailure('角色素材加载失败'));
    const timer = window.setTimeout(() => {
      for (const servantId of Object.keys(FGO_SERVANTS)) {
        if (servantId !== selected) void preloadFgoCharacter(servantId, 'low').catch(reportPreloadFailure('角色素材加载失败'));
      }
      void preloadFgoNoble('low').catch(reportPreloadFailure('宝具素材加载失败'));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [selected, selectedRevealed]);
  useEffect(() => {
    if (selected === 'servant-saber' && selectedRevealed) {
      void preloadFgoNoble('high').catch(reportPreloadFailure('宝具素材加载失败'));
    }
  }, [selected, selectedRevealed]);
  useEffect(() => {
    const result = consumeNew();
    const sequences = result.entries.flatMap(entry => {
      const sequence = fateFgoSequenceFor(entry, state.core);
      return sequence ? [sequence] : [];
    });
    if (sequences.length || result.didReset || result.didOptimisticRollback) {
      setQueue(current => {
        const lastValid = result.didReset ? (entries.at(-1)?.id ?? -1)
          : result.didOptimisticRollback ? rollback.watermark : null;
        const retained = result.didOptimisticRollback && lastValid === null ? []
          : lastValid === null ? current : current.filter(sequence => sequence.id <= lastValid);
        return [...retained, ...sequences];
      });
    }
  }, [entries, consumeNew, state.core, rollback.watermark]);
  const finish = useCallback(() => setQueue(current => current.slice(1)), []);
  const active = queue[0];
  const battleAnchor = active?.kind === 'battle' ? battleAnchors?.[active.locationId] : undefined;
  useEffect(() => {
    if (active?.kind === 'battle' && !battleAnchor) finish();
  }, [active, battleAnchor, finish]);
  if (!active) return null;
  if (active.kind === 'battle') return battleAnchor ? createPortal(
    <BattleMotion key={active.id} sequence={active} onComplete={finish} />, battleAnchor,
  ) : null;
  return <NobleMotion key={active.id} onComplete={finish} />;
}
