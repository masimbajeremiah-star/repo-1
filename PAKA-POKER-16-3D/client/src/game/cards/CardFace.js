export const cardFaces = ['A', 'K', 'Q', 'J', '10', '9'];

export const createCardPosition = (index, count = cardFaces.length, radius = 4) => {
  const angle = (index / count) * Math.PI * 2;
  return [Math.sin(angle) * radius, 0.05, Math.cos(angle) * radius];
};
