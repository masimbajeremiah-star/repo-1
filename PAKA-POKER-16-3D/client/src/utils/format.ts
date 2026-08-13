export const formatCurrency = (value = 0, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const pickRandom = <T>(items: T[]): T | null => {
  if (!items || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
};
