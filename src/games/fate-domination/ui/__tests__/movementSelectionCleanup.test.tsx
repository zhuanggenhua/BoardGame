import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../../engine/adapter';
import { FateDominationDomain } from '../../domain';
import { useFateMovementInteraction } from '../useFateMovementInteraction';
it('同阶段令咒来源失效时撤掉旧目标与移动模式，不等待换回合', () => {
 const state=createReplayAdapter(FateDominationDomain,'stale-selection').setup(['0','1','2']);
 state.core.phase='action';state.core.players['0'].locationId='miyama';state.core.players['0'].commandSpells=1;
 state.core.battlefield.miyama.eventCards=[];state.core.battlefield.shinto.eventCards=[];state.core.currentEvents={miyama:[],shinto:[]};
 const view=renderHook(({state})=>useFateMovementInteraction(state,'0'),{initialProps:{state}});
 act(()=>view.result.current.begin({kind:'seal'}));
 act(()=>view.result.current.select('shinto'));
 expect(view.result.current.command?.type).toBe('USE_COMMAND_SPELL');
 const next=structuredClone(state);next.core.players['0'].commandSpells=0;
 view.rerender({state:next});
 expect(view.result.current.intent).toBeNull();expect(view.result.current.target).toBeNull();expect(view.result.current.command).toBeNull();
});
