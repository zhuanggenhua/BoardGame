/**
 * 项目管理 hook
 * 从 UnifiedBuilder.tsx 提取
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useToast } from '../../../../contexts/ToastContext';
import { UGC_API_URL } from '../../../../config/server';
import { type BuilderProjectSummary, type BuilderProjectDetail, type ModalType, normalizeBaseUrl, buildAuthHeaders } from '../builderTypes';
import type { BuilderState } from '../../context';

interface ApplySavedResult {
  data: Record<string, unknown>;
  didUpgrade: boolean;
}

export function useProjectManager({
  applySavedData,
  persistLocalSave,
  buildSaveData,
  activeModal,
  setActiveModal,
  state,
}: {
  applySavedData: (data: Record<string, unknown>) => ApplySavedResult;
  persistLocalSave: (saveData: Record<string, unknown>) => void;
  buildSaveData: () => Record<string, unknown>;
  activeModal: ModalType;
  setActiveModal: (modal: ModalType) => void;
  state: BuilderState;
}) {
  const { token } = useAuth();
  const toast = useToast();

  const [builderProjects, setBuilderProjects] = useState<BuilderProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');

  const fetchBuilderProjects = useCallback(async (silent = false) => {
    if (!token) {
      setBuilderProjects([]);
      return [] as BuilderProjectSummary[];
    }
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    try {
      const res = await fetch(`${baseUrl}/builder/projects`, {
        headers: buildAuthHeaders(token),
      });
      if (!res.ok) {
        throw new Error(`项目列表加载失败: ${res.status}`);
      }
      const payload = await res.json() as { items?: BuilderProjectSummary[] };
      const items = Array.isArray(payload.items) ? payload.items : [];
      setBuilderProjects(items);
      return items;
    } catch {
      if (!silent) {
        toast.warning('草稿列表获取失败，将使用本地缓存');
      }
      return [] as BuilderProjectSummary[];
    }
  }, [token, toast]);

  const loadBuilderProject = useCallback(async (projectId: string, silent = false) => {
    if (!token) return null;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    setIsProjectLoading(true);
    try {
      const res = await fetch(`${baseUrl}/builder/projects/${encodeURIComponent(projectId)}`, {
        headers: buildAuthHeaders(token),
      });
      if (!res.ok) {
        throw new Error(`项目加载失败: ${res.status}`);
      }
      const project = await res.json() as BuilderProjectDetail;
      if (project?.data && typeof project.data === 'object') {
        const result = applySavedData(project.data);
        const nextData = result.data;
        persistLocalSave(nextData);
        if (result.didUpgrade) {
          void updateBuilderProject(project.projectId, {
            name: typeof nextData.name === 'string' ? nextData.name : project.name,
            description: typeof nextData.description === 'string' ? nextData.description : project.description,
            data: nextData,
          }, true);
        }
      }
      setActiveProjectId(project.projectId);
      setProjectNameDraft(project.name ?? '');
      return project;
    } catch {
      if (!silent) {
        toast.warning('草稿加载失败，将使用本地缓存');
      }
      return null;
    } finally {
      setIsProjectLoading(false);
    }
  }, [applySavedData, persistLocalSave, token, toast]);

  const createBuilderProject = useCallback(async (payload: { name: string; description?: string; data?: Record<string, unknown> | null }, silent = false) => {
    if (!token) return null;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const res = await fetch(`${baseUrl}/builder/projects`, {
      method: 'POST',
      headers: buildAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (!silent) {
        toast.error('新建草稿失败');
      }
      return null;
    }
    const project = await res.json() as BuilderProjectDetail;
    setActiveProjectId(project.projectId);
    setProjectNameDraft(project.name ?? '');
    setBuilderProjects(prev => {
      const filtered = prev.filter(item => item.projectId !== project.projectId);
      return [project, ...filtered];
    });
    return project;
  }, [token, toast]);

  const updateBuilderProject = useCallback(async (
    projectId: string,
    payload: { name?: string; description?: string; data?: Record<string, unknown> | null },
    silent = false
  ) => {
    if (!token) return null;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const res = await fetch(`${baseUrl}/builder/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      headers: buildAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (!silent) {
        toast.error('草稿保存失败');
      }
      return null;
    }
    const project = await res.json() as BuilderProjectDetail;
    setBuilderProjects(prev => prev.map(item => item.projectId === project.projectId
      ? { ...item, name: project.name, description: project.description, updatedAt: project.updatedAt }
      : item
    ));
    return project;
  }, [token, toast]);

  const deleteBuilderProject = useCallback(async (projectId: string) => {
    if (!token) return false;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const res = await fetch(`${baseUrl}/builder/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(token),
    });
    if (!res.ok) {
      toast.error('删除草稿失败');
      return false;
    }
    setBuilderProjects(prev => prev.filter(item => item.projectId !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
    return true;
  }, [activeProjectId, token, toast]);

  const refreshBuilderProjects = useCallback(async (silent = false) => {
    setIsProjectLoading(true);
    try {
      return await fetchBuilderProjects(silent);
    } finally {
      setIsProjectLoading(false);
    }
  }, [fetchBuilderProjects]);

  useEffect(() => {
    if (activeModal !== 'project-list') return;
    void refreshBuilderProjects();
  }, [activeModal, refreshBuilderProjects]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (state.name && state.name !== projectNameDraft) {
      setProjectNameDraft(state.name);
    }
  }, [activeProjectId, projectNameDraft, state.name]);

  const handleOpenProjectList = useCallback(() => {
    setActiveModal('project-list');
  }, []);

  const handleLoadProject = useCallback(async (projectId: string) => {
    const loaded = await loadBuilderProject(projectId);
    if (loaded) {
      toast.success('草稿已加载');
      setActiveModal(null);
    }
  }, [loadBuilderProject, toast]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!confirm('确定删除该草稿？此操作不可撤销')) return;
    const ok = await deleteBuilderProject(projectId);
    if (ok) {
      toast.success('草稿已删除');
    }
  }, [deleteBuilderProject, toast]);

  const handleCreateProjectFromCurrent = useCallback(async () => {
    if (!token) {
      toast.warning('请先登录');
      return;
    }
    const saveData = buildSaveData();
    const created = await createBuilderProject({
      name: state.name || '未命名草稿',
      description: state.description,
      data: saveData,
    });
    if (created) {
      toast.success('草稿已创建');
    }
  }, [buildSaveData, createBuilderProject, state.description, state.name, toast, token]);

  return {
    builderProjects,
    activeProjectId,
    isProjectLoading,
    projectNameDraft,
    refreshBuilderProjects,
    handleLoadProject,
    handleDeleteProject,
    handleCreateProjectFromCurrent,
    handleOpenProjectList,
    fetchBuilderProjects,
    loadBuilderProject,
    createBuilderProject,
    updateBuilderProject,
    deleteBuilderProject,
  };
}
