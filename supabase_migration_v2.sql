-- SRC Pulse - Database Migration v2
-- Run this in the Supabase SQL Editor to update your schema for Multi-Cart & Gifting

-- 1. Ensure 'students' table is correct (usually already exists)
-- No changes needed to structure, but ensure RLS is on
alter table students enable row level security;

-- 2. Update 'orders' table
-- Add buyer_id if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='orders' and column_name='buyer_id') then
    alter table orders add column buyer_id uuid references students(id);
  end if;
end $$;

-- Add is_gift if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='orders' and column_name='is_gift') then
    alter table orders add column is_gift boolean default false;
  end if;
end $$;

-- Ensure foreign keys are properly named/recognized for student_id if missing
-- Note: Supabase/PostgREST usually detects these automatically if the 'references' is present.
-- If the original table didn't have the FK, we add it explicitly:
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name='orders_student_id_fkey') then
    alter table orders add constraint orders_student_id_fkey foreign key (student_id) references students(id) on delete cascade;
  end if;
end $$;

-- 3. Update 'deleted_orders' table (Audit Log)
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='deleted_orders' and column_name='buyer_id') then
    alter table deleted_orders add column buyer_id uuid;
  end if;
end $$;

do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='deleted_orders' and column_name='is_gift') then
    alter table deleted_orders add column is_gift boolean;
  end if;
end $$;

-- 4. Ensure Admin Users exist
create table if not exists admin_users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  password text not null,
  full_name text,
  role text default 'Admin',
  created_at timestamptz default now()
);

insert into admin_users (username, password, full_name, role) 
values 
  ('finsec', 'admin123', 'Financial Secretary', 'Finance'),
  ('J Cole', 'admin123', 'Jonas Coleman', 'PRO')
on conflict (username) do nothing;

-- 5. RELOAD SCHEMA CACHE
-- This is critical for PostgREST to see the new relationships
notify pgrst, 'reload schema';
