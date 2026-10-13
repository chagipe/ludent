-- Ludent · imágenes de productos (Supabase Storage)
alter table products add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Las fotos se pueden ver con su enlace; solo admin y almacén pueden subir, cambiar o borrar.
create policy "imagenes: ver" on storage.objects for select using (bucket_id = 'product-images');
create policy "imagenes: subir" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and my_role() in ('admin','almacen'));
create policy "imagenes: cambiar" on storage.objects for update to authenticated using (bucket_id = 'product-images' and my_role() in ('admin','almacen'));
create policy "imagenes: borrar" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and my_role() in ('admin','almacen'));
