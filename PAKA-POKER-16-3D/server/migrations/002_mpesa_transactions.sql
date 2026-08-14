CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  merchant_request_id TEXT,
  checkout_request_id TEXT NOT NULL UNIQUE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  phone_last4 VARCHAR(4),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  result_code INTEGER,
  result_description TEXT,
  receipt_number TEXT UNIQUE,
  transaction_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mpesa_transactions_user_id_idx ON public.mpesa_transactions(user_id);
