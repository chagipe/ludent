-- Ludent · operaciones transaccionales (stock, ventas, compras, devoluciones)
create function require_role(variadic r app_role[]) returns void language plpgsql stable security definer set search_path=public as $$
begin if my_role() is null or not (my_role()=any(r)) then raise exception 'No tienes permiso para esta operación'; end if; end $$;

create function next_number(s text) returns text language plpgsql security definer set search_path=public as $$
declare n int; begin
  insert into counters(series,last) values(s,1) on conflict(series) do update set last=counters.last+1 returning last into n;
  return s||'-'||lpad(n::text,8,'0'); end $$;

create function create_sale(p_customer uuid, p_warehouse uuid, p_doc_type text, p_pay text, p_due_days int, p_items jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); c customers%rowtype; it jsonb; p products%rowtype; v_sub numeric; v_tot numeric; v_q numeric; v_need numeric; v_take numeric; v_item uuid; l record; v_have numeric; co company%rowtype;
begin
  perform require_role('admin','vendedor');
  if jsonb_array_length(p_items)=0 then raise exception 'Agrega productos'; end if;
  if p_customer is not null then select * into c from customers where id=p_customer; end if;
  select coalesce(sum((x->>'qty')::numeric*(x->>'price')::numeric),0) into v_sub from jsonb_array_elements(p_items) x;
  v_tot:=round(v_sub*1.18,2);
  if p_doc_type='Factura' and (c.id is null or c.doc !~ '^\d{11}$') then raise exception 'La factura requiere un cliente con RUC de 11 dígitos'; end if;
  if p_doc_type='Boleta' and v_tot>=700 and (c.id is null or c.doc !~ '^(\d{8}|\d{11})$') then raise exception 'Boleta desde S/ 700: identifica al cliente con DNI o RUC'; end if;
  if p_pay='Crédito' and c.id is null then raise exception 'El crédito requiere un cliente registrado'; end if;
  select * into co from company;
  insert into sales(id,number,doc_type,customer_id,customer_name,warehouse_id,pay_method,subtotal,igv,total,paid,due_on)
  values(v_id,next_number(case when p_doc_type='Factura' then co.serie_factura else co.serie_boleta end),p_doc_type,p_customer,coalesce(c.name,'Cliente general'),p_warehouse,p_pay,
    round(v_sub,2),round(v_tot-v_sub,2),v_tot,case when p_pay='Crédito' then 0 else v_tot end,case when p_pay='Crédito' then current_date+coalesce(p_due_days,30) end);
  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products where id=(it->>'product_id')::uuid;
    v_q:=(it->>'qty')::numeric;
    if v_q<=0 then raise exception 'Cantidad inválida'; end if;
    select qty into v_have from product_stock where product_id=p.id and warehouse_id=p_warehouse for update;
    if coalesce(v_have,0)<v_q then raise exception 'Stock insuficiente de % (disponible %)',p.name,coalesce(v_have,0); end if;
    update product_stock set qty=qty-v_q where product_id=p.id and warehouse_id=p_warehouse;
    insert into sale_items(sale_id,product_id,name,sku,qty,price,cost) values(v_id,p.id,p.name,p.sku,v_q,(it->>'price')::numeric,p.cost) returning id into v_item;
    v_need:=v_q;
    for l in select * from lots where product_id=p.id and warehouse_id=p_warehouse and qty>0 order by expires_on nulls last, ref for update loop
      exit when v_need<=0;
      v_take:=least(l.qty,v_need);
      update lots set qty=qty-v_take where id=l.id;
      insert into sale_item_lots(sale_item_id,lot_id,qty) values(v_item,l.id,v_take);
      v_need:=v_need-v_take;
    end loop;
    insert into stock_movements(product_id,warehouse_id,qty,kind,doc_id) values(p.id,p_warehouse,-v_q,'venta',v_id);
  end loop;
  return v_id;
end $$;

create function void_sale(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare s sales%rowtype; i record; l record;
begin
  perform require_role('admin');
  select * into s from sales where id=p_id for update;
  if s.status<>'ok' then raise exception 'El documento ya está anulado'; end if;
  if s.credited>0 then raise exception 'La venta tiene notas de crédito: no se puede anular'; end if;
  for i in select * from sale_items where sale_id=p_id loop
    insert into product_stock(product_id,warehouse_id,qty) values(i.product_id,s.warehouse_id,i.qty) on conflict(product_id,warehouse_id) do update set qty=product_stock.qty+i.qty;
    insert into stock_movements(product_id,warehouse_id,qty,kind,doc_id,note) values(i.product_id,s.warehouse_id,i.qty,'anulación venta',p_id,s.number);
    for l in select * from sale_item_lots where sale_item_id=i.id loop update lots set qty=qty+l.qty where id=l.lot_id; end loop;
  end loop;
  update sales set status='anulada' where id=p_id;
end $$;

create function create_purchase(p_supplier uuid, p_warehouse uuid, p_cond text, p_due_days int, p_items jsonb, p_order uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); it jsonb; v_sub numeric; v_tot numeric; v_q numeric; v_cost numeric; v_pid uuid; v_num text;
begin
  perform require_role('admin','almacen');
  if jsonb_array_length(p_items)=0 then raise exception 'Agrega productos'; end if;
  if p_supplier is null then raise exception 'Selecciona un proveedor'; end if;
  select coalesce(sum((x->>'qty')::numeric*(x->>'cost')::numeric),0) into v_sub from jsonb_array_elements(p_items) x;
  v_tot:=round(v_sub*1.18,2); v_num:=next_number('C');
  insert into purchases(id,number,supplier_id,supplier_name,warehouse_id,cond,subtotal,igv,total,paid,due_on,order_id)
  values(v_id,v_num,p_supplier,(select name from suppliers where id=p_supplier),p_warehouse,p_cond,round(v_sub,2),round(v_tot-v_sub,2),v_tot,case when p_cond='Crédito' then 0 else v_tot end,case when p_cond='Crédito' then current_date+coalesce(p_due_days,30) end,p_order);
  perform set_config('app.src',v_num,true);
  for it in select * from jsonb_array_elements(p_items) loop
    v_pid:=(it->>'product_id')::uuid; v_q:=(it->>'qty')::numeric; v_cost:=(it->>'cost')::numeric;
    if v_q<=0 then raise exception 'Cantidad inválida'; end if;
    insert into purchase_items(purchase_id,product_id,name,qty,cost,lot_ref,expires_on) values(v_id,v_pid,(select name from products where id=v_pid),v_q,v_cost,nullif(it->>'lot_ref',''),nullif(it->>'expires_on','')::date);
    insert into product_stock(product_id,warehouse_id,qty) values(v_pid,p_warehouse,v_q) on conflict(product_id,warehouse_id) do update set qty=product_stock.qty+v_q;
    if nullif(it->>'lot_ref','') is not null then
      insert into lots(product_id,warehouse_id,ref,expires_on,qty) values(v_pid,p_warehouse,it->>'lot_ref',nullif(it->>'expires_on','')::date,v_q)
      on conflict(product_id,warehouse_id,ref) do update set qty=lots.qty+v_q;
    end if;
    update products set cost=v_cost where id=v_pid;
    insert into stock_movements(product_id,warehouse_id,qty,kind,doc_id,note) values(v_pid,p_warehouse,v_q,'compra',v_id,v_num);
  end loop;
  perform set_config('app.src','',true);
  if p_order is not null then update purchase_orders set status='recibida' where id=p_order; end if;
  return v_id;
end $$;

create function void_purchase(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare pu purchases%rowtype; i record; v_have numeric;
begin
  perform require_role('admin');
  select * into pu from purchases where id=p_id for update;
  if pu.status<>'ok' then raise exception 'El documento ya está anulado'; end if;
  for i in select * from purchase_items where purchase_id=p_id loop
    select qty into v_have from product_stock where product_id=i.product_id and warehouse_id=pu.warehouse_id for update;
    if coalesce(v_have,0)<i.qty then raise exception 'No se puede anular: el stock de % ya se vendió',i.name; end if;
    update product_stock set qty=qty-i.qty where product_id=i.product_id and warehouse_id=pu.warehouse_id;
    if i.lot_ref is not null then update lots set qty=greatest(0,qty-i.qty) where product_id=i.product_id and warehouse_id=pu.warehouse_id and ref=i.lot_ref; end if;
    insert into stock_movements(product_id,warehouse_id,qty,kind,doc_id,note) values(i.product_id,pu.warehouse_id,-i.qty,'anulación compra',p_id,pu.number);
  end loop;
  update purchases set status='anulada' where id=p_id;
end $$;

create function register_payment(p_kind text, p_doc uuid, p_amount numeric, p_method text) returns void language plpgsql security definer set search_path=public as $$
declare v_tot numeric; v_paid numeric; v_cr numeric:=0;
begin
  if p_kind='sale' then perform require_role('admin','vendedor'); select total,paid,credited into v_tot,v_paid,v_cr from sales where id=p_doc and status='ok' for update;
  else perform require_role('admin'); select total,paid into v_tot,v_paid from purchases where id=p_doc and status='ok' for update; end if;
  if v_tot is null then raise exception 'Documento no encontrado'; end if;
  if p_amount<=0 or p_amount>v_tot-v_cr-v_paid+0.005 then raise exception 'Monto inválido (saldo %)',round(v_tot-v_cr-v_paid,2); end if;
  if p_kind='sale' then update sales set paid=paid+p_amount where id=p_doc; else update purchases set paid=paid+p_amount where id=p_doc; end if;
  insert into payments(kind,doc_id,amount,method) values(p_kind,p_doc,p_amount,p_method);
end $$;

create function create_credit_note(p_sale uuid, p_items jsonb, p_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare s sales%rowtype; it jsonb; si sale_items%rowtype; v_r numeric; v_left numeric; l record; v_take numeric; v_sub numeric:=0; v_id uuid:=gen_random_uuid(); v_lines jsonb:='[]';
begin
  perform require_role('admin','vendedor');
  select * into s from sales where id=p_sale and status='ok' for update;
  if s.id is null then raise exception 'Venta no válida'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into si from sale_items where id=(it->>'sale_item_id')::uuid and sale_id=p_sale for update;
    v_r:=(it->>'qty')::numeric;
    if v_r<=0 or v_r>si.qty-si.returned then raise exception 'Cantidad a devolver inválida para %',si.name; end if;
    update sale_items set returned=returned+v_r where id=si.id;
    insert into product_stock(product_id,warehouse_id,qty) values(si.product_id,s.warehouse_id,v_r) on conflict(product_id,warehouse_id) do update set qty=product_stock.qty+v_r;
    v_left:=v_r;
    for l in select * from sale_item_lots where sale_item_id=si.id and qty-returned>0 loop
      exit when v_left<=0; v_take:=least(l.qty-l.returned,v_left);
      update lots set qty=qty+v_take where id=l.lot_id;
      update sale_item_lots set returned=returned+v_take where sale_item_id=l.sale_item_id and lot_id=l.lot_id;
      v_left:=v_left-v_take;
    end loop;
    insert into stock_movements(product_id,warehouse_id,qty,kind,doc_id,note) values(si.product_id,s.warehouse_id,v_r,'devolución',v_id,s.number);
    v_sub:=v_sub+v_r*si.price; v_lines:=v_lines||jsonb_build_object('name',si.name,'qty',v_r,'price',si.price);
  end loop;
  insert into credit_notes(id,number,sale_id,sale_number,customer_name,reason,items,subtotal,igv,total)
  values(v_id,next_number(case when s.doc_type='Factura' then 'FC01' else 'BC01' end),p_sale,s.number,s.customer_name,p_reason,v_lines,round(v_sub,2),round(v_sub*.18,2),round(v_sub*1.18,2));
  update sales set credited=credited+round(v_sub*1.18,2) where id=p_sale;
  return v_id;
end $$;

create function adjust_stock(p_product uuid, p_warehouse uuid, p_new numeric, p_note text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_old numeric;
begin
  perform require_role('admin','almacen');
  if p_new<0 then raise exception 'Valor inválido'; end if;
  select coalesce((select qty from product_stock where product_id=p_product and warehouse_id=p_warehouse for update),0) into v_old;
  insert into product_stock(product_id,warehouse_id,qty) values(p_product,p_warehouse,p_new) on conflict(product_id,warehouse_id) do update set qty=p_new;
  insert into stock_movements(product_id,warehouse_id,qty,kind,note) values(p_product,p_warehouse,p_new-v_old,'ajuste',p_note);
end $$;

create function transfer_stock(p_product uuid, p_from uuid, p_to uuid, p_qty numeric) returns void language plpgsql security definer set search_path=public as $$
declare v_have numeric; v_left numeric:=p_qty; l record; v_take numeric;
begin
  perform require_role('admin','almacen');
  if p_from=p_to or p_qty<=0 then raise exception 'Transferencia inválida'; end if;
  select qty into v_have from product_stock where product_id=p_product and warehouse_id=p_from for update;
  if coalesce(v_have,0)<p_qty then raise exception 'Stock insuficiente en el almacén de origen'; end if;
  update product_stock set qty=qty-p_qty where product_id=p_product and warehouse_id=p_from;
  insert into product_stock(product_id,warehouse_id,qty) values(p_product,p_to,p_qty) on conflict(product_id,warehouse_id) do update set qty=product_stock.qty+p_qty;
  for l in select * from lots where product_id=p_product and warehouse_id=p_from and qty>0 order by expires_on nulls last, ref for update loop
    exit when v_left<=0; v_take:=least(l.qty,v_left);
    update lots set qty=qty-v_take where id=l.id;
    insert into lots(product_id,warehouse_id,ref,expires_on,qty) values(p_product,p_to,l.ref,l.expires_on,v_take) on conflict(product_id,warehouse_id,ref) do update set qty=lots.qty+v_take;
    v_left:=v_left-v_take;
  end loop;
  insert into stock_movements(product_id,warehouse_id,qty,kind) values(p_product,p_from,-p_qty,'transferencia salida'),(p_product,p_to,p_qty,'transferencia entrada');
end $$;
