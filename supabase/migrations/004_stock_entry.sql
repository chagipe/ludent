-- Ludent · ingreso de stock a un producto existente (queda registrado en el kardex y en los reportes)
create function receive_stock(p_product uuid, p_warehouse uuid, p_qty numeric, p_lot_ref text default null, p_expires_on date default null, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform require_role('admin','almacen');
  if p_qty is null or p_qty<=0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
  insert into product_stock(product_id,warehouse_id,qty) values(p_product,p_warehouse,p_qty)
    on conflict(product_id,warehouse_id) do update set qty=product_stock.qty+p_qty;
  if nullif(p_lot_ref,'') is not null then
    insert into lots(product_id,warehouse_id,ref,expires_on,qty) values(p_product,p_warehouse,p_lot_ref,p_expires_on,p_qty)
      on conflict(product_id,warehouse_id,ref) do update set qty=lots.qty+p_qty, expires_on=coalesce(p_expires_on,lots.expires_on);
  end if;
  insert into stock_movements(product_id,warehouse_id,qty,kind,note) values(p_product,p_warehouse,p_qty,'ingreso',p_note);
end $$;
revoke execute on function receive_stock(uuid,uuid,numeric,text,date,text) from public, anon;
grant execute on function receive_stock(uuid,uuid,numeric,text,date,text) to authenticated;
