-- PAKA POWER 16 3D: no cash wagering or M-PESA deposit processing.
-- Historical wallet and M-PESA tables are retained to avoid deleting existing records.
COMMENT ON TABLE public.mpesa_transactions IS 'Deprecated legacy table. M-PESA deposit API and transaction processing are disabled; retained for historical records only.';
COMMENT ON TABLE public.wallets IS 'Deprecated legacy virtual balance table. Current gameplay does not use balances, stakes, or payouts.';
COMMENT ON TABLE public.game_results IS 'Game statistics audit only. Current game results contain no balance changes, stakes, or payouts.';

UPDATE public.cosmetic_items
SET description = 'Premium formal player styling.'
WHERE slug = 'royal-avatar';

UPDATE public.cosmetic_items
SET name = 'Luxury Penthouse Game Room',
    description = 'A panoramic luxury game-room environment.'
WHERE slug = 'luxury-penthouse';
