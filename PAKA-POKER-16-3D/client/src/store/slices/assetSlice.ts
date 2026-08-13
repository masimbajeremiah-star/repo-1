export type AssetState = {
  textures: string[];
  models: string[];
  sounds: string[];
};

export const initialAssetState: AssetState = {
  textures: [],
  models: [],
  sounds: [],
};

export const loadAssetList = (assets: AssetState) => ({
  type: 'LOAD_ASSET_LIST',
  payload: assets,
});
