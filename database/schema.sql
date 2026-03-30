-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create students table
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  phone text not null,
  hostel text,
  programme text,
  class text
);

-- Create orders table
create table if not exists orders (
  order_id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  student_id uuid references students(id) on delete cascade,
  shirt_color text,
  shirt_size text,
  shirt_texture text,
  cap_option boolean default false,
  nickname_option boolean default false,
  nickname_text text,
  total_price numeric not null,
  service_fee numeric default 0,
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'fulfilled')),
  transaction_id text,
  buyer_id uuid references students(id),
  is_gift boolean default false
);

-- Enable RLS (Row Level Security)
alter table students enable row level security;
alter table orders enable row level security;

-- Public insert policies
drop policy if exists "Allow public inserts on students" on students;
create policy "Allow public inserts on students" on students for insert with check (true);

drop policy if exists "Allow public inserts on orders" on orders;
create policy "Allow public inserts on orders" on orders for insert with check (true);

-- Public read/update policies for basic setup
drop policy if exists "Allow public select on students" on students;
create policy "Allow public select on students" on students for select using (true);

drop policy if exists "Allow public select on orders" on orders;
create policy "Allow public select on orders" on orders for select using (true);

drop policy if exists "Allow public update on orders" on orders;
-- Admin Users table
create table if not exists admin_users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  password text not null,
  full_name text,
  role text default 'Admin',
  created_at timestamptz default now()
);

-- Initial admin users
insert into admin_users (username, password, full_name, role) 
values 
  ('finsec', 'admin123', 'Financial Secretary', 'Finance'),
  ('J Cole', 'admin123', 'Jonas Coleman', 'PRO')
on conflict (username) do nothing;

-- Create deleted_orders table (Audit Log)
create table if not exists deleted_orders (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid,
  created_at timestamptz,
  student_id uuid,
  shirt_color text,
  shirt_size text,
  shirt_texture text,
  cap_option boolean,
  nickname_option boolean,
  nickname_text text,
  total_price numeric,
  service_fee numeric,
  payment_status text,
  transaction_id text,
  buyer_id uuid,
  is_gift boolean,
  deleted_at timestamptz default now(),
  deleted_by text
);

alter table deleted_orders enable row level security;
create policy "Allow admins to read/insert deleted_orders" on deleted_orders for all using (true);
