import { PerspectiveCamera } from 'three';

export const createPerspectiveCamera = ({
  fov = 75,
  aspect = window.innerWidth / window.innerHeight,
  near = 0.1,
  far = 1000,
} = {}) => {
  const camera = new PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 5, 10);
  return camera;
};

export const resizeCamera = (camera, width, height) => {
  if (!camera) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};
