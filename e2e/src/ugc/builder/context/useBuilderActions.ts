/**
 * Builder Actions Hook
 *
 * 封装所有 dispatch 操作为语义化函数，供组件直接调用。
 */

import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import type { SchemaDefinition, FieldDefinition } from '../schema/types';
import type {
  BuilderState,
  RenderComponent,
  LayoutComponent,
  LayoutGroup,
  RequirementEntry,
} from './BuilderContext';

export function useBuilderActions() {
  const { dispatch } = useBuilder();

  return useMemo(() => ({
    // Basic setters
    setName: (name: string) =>
      dispatch({ type: 'SET_NAME', payload: name }),
    setDescription: (desc: string) =>
      dispatch({ type: 'SET_DESCRIPTION', payload: desc }),
    setTags: (tags: string[]) =>
      dispatch({ type: 'SET_TAGS', payload: tags }),

    // Schema operations
    addSchema: (schema: SchemaDefinition) =>
      dispatch({ type: 'ADD_SCHEMA', payload: { schema } }),
    deleteSchema: (schemaId: string) =>
      dispatch({ type: 'DELETE_SCHEMA', payload: schemaId }),
    updateSchema: (id: string, updates: Partial<SchemaDefinition>) =>
      dispatch({ type: 'UPDATE_SCHEMA', payload: { id, updates } }),
    setSchemas: (schemas: SchemaDefinition[]) =>
      dispatch({ type: 'SET_SCHEMAS', payload: schemas }),

    // Schema field operations
    addSchemaField: (schemaId: string, key: string, field: FieldDefinition) =>
      dispatch({ type: 'ADD_SCHEMA_FIELD', payload: { schemaId, key, field } }),
    deleteSchemaField: (schemaId: string, fieldKey: string) =>
      dispatch({ type: 'DELETE_SCHEMA_FIELD', payload: { schemaId, fieldKey } }),
    updateSchemaField: (schemaId: string, fieldKey: string, updates: Partial<FieldDefinition>) =>
      dispatch({ type: 'UPDATE_SCHEMA_FIELD', payload: { schemaId, fieldKey, updates } }),
    setSchemaField: (schemaId: string, fieldKey: string, field: FieldDefinition) =>
      dispatch({ type: 'SET_SCHEMA_FIELD', payload: { schemaId, fieldKey, field } }),

    // Instance operations
    setInstances: (schemaId: string, data: Record<string, unknown>[]) =>
      dispatch({ type: 'SET_INSTANCES', payload: { schemaId, data } }),

    // Layout operations
    setLayout: (layout: LayoutComponent[]) =>
      dispatch({ type: 'SET_LAYOUT', payload: layout }),
    setLayoutValidated: (layout: LayoutComponent[]) =>
      dispatch({ type: 'SET_LAYOUT_VALIDATED', payload: layout }),
    setLayoutGroups: (groups: LayoutGroup[]) =>
      dispatch({ type: 'SET_LAYOUT_GROUPS', payload: groups }),

    // Selection
    selectSchema: (id: string | null) =>
      dispatch({ type: 'SELECT_SCHEMA', payload: id }),
    selectComponent: (id: string | null) =>
      dispatch({ type: 'SELECT_COMPONENT', payload: id }),

    // Render components
    setRenderComponents: (components: RenderComponent[]) =>
      dispatch({ type: 'SET_RENDER_COMPONENTS', payload: components }),
    addRenderComponentAndLink: (component: RenderComponent, layoutComponentId: string) =>
      dispatch({ type: 'ADD_RENDER_COMPONENT_AND_LINK', payload: { component, layoutComponentId } }),

    // Rules
    setRulesCode: (code: string) =>
      dispatch({ type: 'SET_RULES_CODE', payload: code }),

    // Requirements
    setRequirementsRawText: (text: string) =>
      dispatch({ type: 'SET_REQUIREMENTS_RAW_TEXT', payload: text }),
    addRequirementEntry: (entry: RequirementEntry) =>
      dispatch({ type: 'ADD_REQUIREMENT_ENTRY', payload: entry }),
    updateRequirementEntry: (id: string, updates: Partial<RequirementEntry>) =>
      dispatch({ type: 'UPDATE_REQUIREMENT_ENTRY', payload: { id, updates } }),
    removeRequirementEntry: (id: string) =>
      dispatch({ type: 'REMOVE_REQUIREMENT_ENTRY', payload: id }),
    upsertRequirementByLocation: (location: string, content: string) =>
      dispatch({ type: 'UPSERT_REQUIREMENT_BY_LOCATION', payload: { location, content } }),

    // Bulk operations
    loadState: (partial: Partial<BuilderState>) =>
      dispatch({ type: 'LOAD_STATE', payload: partial }),
    reset: () =>
      dispatch({ type: 'RESET' }),
  }), [dispatch]);
}
