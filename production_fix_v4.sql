-- SRC Pulse - Production Recovery & Schema Hardening (v4)
-- This ensures the dashboard and Paystack can always access and update order records.

-- 1. Orders RLS (Visibility & Status Updates)
DROP POLICY IF EXISTS "Allow public select on orders" ON orders;
CREATE POLICY "Allow public select on orders" ON orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public update on orders" ON orders;
CREATE POLICY "Allow public update on orders" ON orders FOR UPDATE USING (true);

-- 2. Students RLS (Required for Registry Joins)
DROP POLICY IF EXISTS "Allow public select on students" ON students;
CREATE POLICY "Allow public select on students" ON students FOR SELECT USING (true);

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
