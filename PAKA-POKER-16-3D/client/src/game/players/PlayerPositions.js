export const playerPositions = (count = 2, radius = 6.45) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [Math.sin(angle) * radius, 0.15, Math.cos(angle) * radius];
  });
