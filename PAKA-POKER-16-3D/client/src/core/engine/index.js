import { WebGLRenderer, Scene, Clock } from 'three';

export const createEngine = ({
  canvas,
  camera,
  onRender,
  antialias = true,
  alpha = true,
} = {}) => {
  const renderer = new WebGLRenderer({ canvas, antialias, alpha });
  const scene = new Scene();
  const clock = new Clock();

  const resize = () => {
    if (canvas) {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      renderer.setSize(width, height);
      if (camera && typeof camera.updateProjectionMatrix === 'function') {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    }
  };

  const animate = () => {
    const delta = clock.getDelta();
    if (onRender) onRender?.(delta, scene, renderer);
    if (camera) renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  return {
    renderer,
    scene,
    clock,
    resize,
    start: () => {
      animate();
    },
  };
};
