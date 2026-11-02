CREATE TABLE IF NOT EXISTS advisor_sessions (
    id UUID PRIMARY KEY,
    profile JSONB NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'complete')),
    current_question TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisor_sessions_updated_at
    ON advisor_sessions (updated_at);
