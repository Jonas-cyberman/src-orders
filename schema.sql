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
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'fulfilled')),
  transaction_id text unique
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

-- Insert initial admin users
insert into admin_users (username, password, full_name, role) 
values 
  ('finsec', 'admin123', 'Financial Secretary', 'Finance'),
  ('J Cole', 'admin123', 'Jonas Coleman', 'PRO')
on conflict (username) do nothing;
