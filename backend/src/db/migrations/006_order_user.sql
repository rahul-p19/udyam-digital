ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id
    ON orders (user_id, submitted_at DESC);
