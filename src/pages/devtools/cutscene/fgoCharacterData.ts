import type { MeshMaterial, SceneMetadata, SkinData, SourceShader } from './fgoSceneData';

export type FgoCharacterEntry = {
  id: string;
  name: string;
  sourceName: string;
  category: string;
  asset: string;
  thumbnail: string | null;
  animations: Array<{ name: string; duration: number }>;
  evolutions: number[];
  noblePhantasm: boolean;
};

export type FgoCharacterCatalog = {
  characters: FgoCharacterEntry[];
  failures: Array<{ id: string; error: string }>;
};

export type FgoCharacterModel = {
  skin: SkinData;
  materials: Record<string, MeshMaterial>;
  shaders: SourceShader[];
  textureSamplers: SceneMetadata['textureSamplers'];
  visibility: Record<string, Array<{ mesh: string; scalarOffset: number }>>;
};

export const FGO_CHARACTER_ASSETS = '/assets/dev/fgo-characters/';
