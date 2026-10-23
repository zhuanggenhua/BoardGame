import {renderHook} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {createReplayAdapter} from '../../../../engine/adapter';
import type {EventStreamEntry} from '../../../../engine/types';
import {FateDominationDomain} from '../../domain';
import {useFateAbilityFeedback} from '../useFateAbilityFeedback';
const toast=vi.hoisted(() => ({warning:vi.fn()}));
vi.mock('../../../../contexts/ToastContext',() => ({useToast:() => toast}));
it('未实现能力短暂警告一次，跳过历史且不泄漏对手的未公开技能', () => {
 const core=createReplayAdapter(FateDominationDomain,'ability-feedback').setup(['0','1','2']).core;
 const skill=core.players['0'].skills[0];
 const event=(id:number,playerId='0'):EventStreamEntry=>({id,event:{type:'FATE_ABILITY_UNIMPLEMENTED',payload:{playerId,skillId:skill.id},timestamp:id}});
 const {rerender}=renderHook(({entries})=>useFateAbilityFeedback(core,'0',entries),{initialProps:{entries:[event(1)]}});
 expect(toast.warning).not.toHaveBeenCalled();
 rerender({entries:[event(1),event(2)]});
 expect(toast.warning).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({key:'feedback.skillUnavailable',params:{skill:skill.name}}),undefined,expect.objectContaining({dedupeKey:'fate-ability-unavailable:2'}));
 rerender({entries:[event(1),event(2)]});expect(toast.warning).toHaveBeenCalledTimes(1);
 rerender({entries:[event(1),event(2),event(3,'1')]});expect(toast.warning).toHaveBeenCalledTimes(1);
});
