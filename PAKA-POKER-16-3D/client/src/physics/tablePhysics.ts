export const createCardSpreadPositions = (count: number, radius = 4) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [Math.sin(angle) * radius, 0.05, Math.cos(angle) * radius] as const;
  });

export const createPlayerPositions = (count: number, radius = 7) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return [Math.sin(angle) * radius, 0, Math.cos(angle) * radius] as const;
  });
