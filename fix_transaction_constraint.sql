-- Fix for Multi-Cart Checkout
-- This removes the unique constraint that prevents multiple items from sharing the same transaction ID.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_transaction_id_key;

-- Also inform PostgREST that the schema has changed
NOTIFY pgrst, 'reload schema';
