import { WebGLRenderer } from 'three';

export const createWebGLRenderer = ({ canvas, antialias = true, alpha = true } = {}) => {
  const renderer = new WebGLRenderer({ canvas, antialias, alpha });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  return renderer;
};
