CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_id UUID REFERENCES kyc_consents(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('verified', 'manual_review')),
    checks JSONB NOT NULL,
    extracted_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id
    ON kyc_verifications (user_id, created_at DESC);
