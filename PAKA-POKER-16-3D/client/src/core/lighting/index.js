import { AmbientLight, DirectionalLight } from 'three';

export const createDefaultLighting = (scene) => {
  const ambient = new AmbientLight(0xffffff, 0.5);
  const directional = new DirectionalLight(0xffffff, 1);
  directional.position.set(5, 10, 7.5);
  scene.add(ambient, directional);
  return { ambient, directional };
};
