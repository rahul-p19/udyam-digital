CREATE TABLE IF NOT EXISTS kyc_consents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL DEFAULT 'company' CHECK (entity_type = 'company'),
    consent_version TEXT NOT NULL,
    data_categories TEXT[] NOT NULL,
    purposes TEXT[] NOT NULL,
    authorized_signatory BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_consents_user_id
    ON kyc_consents (user_id, accepted_at DESC);
