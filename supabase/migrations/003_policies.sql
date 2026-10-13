-- Ludent · seguridad por filas (RLS). Los permisos los aplica la base de datos.
do $$ declare t text; begin
  foreach t in array array['profiles','company','warehouses','suppliers','customers','products','product_stock','lots','price_history','stock_movements','counters','sales','sale_items','sale_item_lots','purchases','purchase_items','purchase_orders','quotes','credit_notes','payments'] loop
    execute format('alter table %I enable row level security',t);
    if t<>'counters' then execute format('create policy "leer" on %I for select to authenticated using (my_role() in (''admin'',''vendedor'',''almacen''))',t); end if;
  end loop;
end $$;
create policy "perfil propio" on profiles for select to authenticated using (id=auth.uid());
create policy "admin gestiona perfiles" on profiles for update to authenticated using (my_role()='admin') with check (my_role()='admin');
create policy "admin empresa" on company for update to authenticated using (my_role()='admin') with check (my_role()='admin');
create policy "admin almacenes" on warehouses for all to authenticated using (my_role()='admin') with check (my_role()='admin');
create policy "catalogo proveedores" on suppliers for all to authenticated using (my_role() in ('admin','almacen')) with check (my_role() in ('admin','almacen'));
create policy "catalogo productos" on products for all to authenticated using (my_role() in ('admin','almacen')) with check (my_role() in ('admin','almacen'));
create policy "catalogo clientes" on customers for all to authenticated using (my_role() in ('admin','vendedor')) with check (my_role() in ('admin','vendedor'));
create policy "cotizaciones" on quotes for all to authenticated using (my_role() in ('admin','vendedor')) with check (my_role() in ('admin','vendedor'));
create policy "ordenes" on purchase_orders for all to authenticated using (my_role() in ('admin','almacen')) with check (my_role() in ('admin','almacen'));
-- Ventas, compras, stock, pagos y devoluciones solo se modifican mediante las funciones SQL (no hay políticas de escritura directa).
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function handle_new_user() from authenticated;
