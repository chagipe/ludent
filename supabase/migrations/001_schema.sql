-- Ludent · esquema base
create extension if not exists pgcrypto;
create type app_role as enum ('admin','vendedor','almacen','pendiente');

create table profiles(id uuid primary key references auth.users on delete cascade, full_name text, email text, role app_role not null default 'pendiente', created_at timestamptz default now());
create function my_role() returns app_role language sql stable security definer set search_path=public as $$ select role from profiles where id=auth.uid() $$;
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id,email,full_name,role) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email),
    (case when exists(select 1 from profiles where role='admin') then 'pendiente' else 'admin' end)::app_role);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create table company(id int primary key default 1 check(id=1), name text default 'Ludent', ruc text, address text, serie_boleta text default 'B001', serie_factura text default 'F001');
insert into company default values;
create table warehouses(id uuid primary key default gen_random_uuid(), name text unique not null, is_default boolean default false);
insert into warehouses(name,is_default) values('Principal',true);
create table suppliers(id uuid primary key default gen_random_uuid(), name text not null, ruc text, contact text, phone text, email text);
create table customers(id uuid primary key default gen_random_uuid(), name text not null, doc text, phone text, email text, address text, price_list text default 'Minorista', discount numeric default 0);
create table products(id uuid primary key default gen_random_uuid(), sku text unique not null, barcode text, name text not null, category text, supplier_id uuid references suppliers on delete set null,
  cost numeric not null default 0, price numeric not null default 0, price_wholesale numeric, min_stock numeric not null default 0, created_at timestamptz default now());
create table product_stock(product_id uuid references products on delete cascade, warehouse_id uuid references warehouses, qty numeric not null default 0 check(qty>=0), primary key(product_id,warehouse_id));
create table lots(id uuid primary key default gen_random_uuid(), product_id uuid references products on delete cascade, warehouse_id uuid references warehouses, ref text not null, expires_on date, qty numeric not null default 0 check(qty>=0), unique(product_id,warehouse_id,ref));
create table price_history(id bigserial primary key, product_id uuid references products on delete cascade, cost numeric, price numeric, source text, created_by uuid default auth.uid(), created_at timestamptz default now());
create table stock_movements(id bigserial primary key, product_id uuid references products on delete cascade, warehouse_id uuid references warehouses, qty numeric not null, kind text not null, doc_id uuid, note text, created_by uuid default auth.uid(), created_at timestamptz default now());
create table counters(series text primary key, last int not null default 0);

create table sales(id uuid primary key default gen_random_uuid(), number text unique not null, doc_type text not null check(doc_type in('Boleta','Factura')), customer_id uuid references customers, customer_name text, warehouse_id uuid references warehouses,
  pay_method text, subtotal numeric, igv numeric, total numeric, paid numeric not null default 0, credited numeric not null default 0, due_on date, status text not null default 'ok', created_by uuid default auth.uid(), created_at timestamptz default now());
create table sale_items(id uuid primary key default gen_random_uuid(), sale_id uuid references sales on delete cascade, product_id uuid references products, name text, sku text, qty numeric, price numeric, cost numeric, returned numeric not null default 0);
create table sale_item_lots(sale_item_id uuid references sale_items on delete cascade, lot_id uuid references lots, qty numeric, returned numeric not null default 0);
create table purchases(id uuid primary key default gen_random_uuid(), number text unique not null, supplier_id uuid references suppliers, supplier_name text, warehouse_id uuid references warehouses, cond text,
  subtotal numeric, igv numeric, total numeric, paid numeric not null default 0, due_on date, status text not null default 'ok', order_id uuid, created_by uuid default auth.uid(), created_at timestamptz default now());
create table purchase_items(id uuid primary key default gen_random_uuid(), purchase_id uuid references purchases on delete cascade, product_id uuid references products, name text, qty numeric, cost numeric, lot_ref text, expires_on date);
create table purchase_orders(id uuid primary key default gen_random_uuid(), number text unique not null, supplier_id uuid references suppliers, supplier_name text, items jsonb not null, total numeric, status text not null default 'pendiente', created_by uuid default auth.uid(), created_at timestamptz default now());
create table quotes(id uuid primary key default gen_random_uuid(), number text unique not null, customer_id uuid references customers, customer_name text, items jsonb not null, total numeric, status text not null default 'vigente', valid_until date, created_by uuid default auth.uid(), created_at timestamptz default now());
create table credit_notes(id uuid primary key default gen_random_uuid(), number text unique not null, sale_id uuid references sales, sale_number text, customer_name text, reason text, items jsonb, subtotal numeric, igv numeric, total numeric, created_by uuid default auth.uid(), created_at timestamptz default now());
create table payments(id uuid primary key default gen_random_uuid(), kind text not null check(kind in('sale','purchase')), doc_id uuid not null, amount numeric not null, method text, created_by uuid default auth.uid(), created_at timestamptz default now());

-- Historial de precios automático
create function log_price() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or old.cost is distinct from new.cost or old.price is distinct from new.price then
    insert into price_history(product_id,cost,price,source) values(new.id,new.cost,new.price,coalesce(nullif(current_setting('app.src',true),''),case when tg_op='INSERT' then 'Alta' else 'Edición manual' end));
  end if; return new;
end $$;
create trigger products_price after insert or update on products for each row execute function log_price();
create index on stock_movements(product_id); create index on sales(created_at); create index on sale_items(sale_id); create index on lots(expires_on);
