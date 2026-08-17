export const PLUS_PRODUCT = Object.freeze({
  id: 'paka-plus-monthly', name: 'PAKA Plus', price: 300, currency: 'KES', interval: 'month',
});

export const MONETIZATION_FLAGS = Object.freeze({
  plus: import.meta.env.VITE_ENABLE_PLUS !== 'false',
  cosmetics: import.meta.env.VITE_ENABLE_COSMETICS !== 'false',
  ads: import.meta.env.VITE_ENABLE_ADS !== 'false',
  creators: import.meta.env.VITE_ENABLE_CREATORS !== 'false',
  clubs: import.meta.env.VITE_ENABLE_CLUBS !== 'false',
});

export const REVENUE_SCENARIOS = [1_000, 10_000, 100_000, 1_000_000].map((subscribers) => ({
  subscribers,
  monthlyGross: subscribers * PLUS_PRODUCT.price,
  yearlyGross: subscribers * PLUS_PRODUCT.price * 12,
}));
