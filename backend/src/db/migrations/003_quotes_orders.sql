CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY,
    session_id TEXT NOT NULL,
    products JSONB NOT NULL,
    total_monthly_min INTEGER NOT NULL,
    total_monthly_max INTEGER NOT NULL,
    total_setup_fee INTEGER NOT NULL DEFAULT 0,
    contract_months INTEGER NOT NULL DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_session_id ON quotes (session_id);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    quote_id UUID NOT NULL REFERENCES quotes(id),
    session_id TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'confirmed', 'in_progress', 'activated', 'cancelled')),
    estimated_activation_date DATE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON orders (quote_id);
