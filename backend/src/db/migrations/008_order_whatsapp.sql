ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS whatsapp_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS whatsapp_error TEXT;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;
