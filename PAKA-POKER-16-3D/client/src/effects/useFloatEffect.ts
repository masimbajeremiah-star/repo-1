import { useEffect, useRef } from 'react';

export function useFloatEffect({ amplitude = 4, speed = 1.2 } = {}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let id = 0;
    const animate = () => {
      if (!ref.current) return;
      const elapsed = performance.now() / 1000;
      const offset = Math.sin(elapsed * speed) * amplitude;
      ref.current.style.transform = `translateY(${offset}px)`;
      id = requestAnimationFrame(animate);
    };

    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [amplitude, speed]);

  return ref;
}
