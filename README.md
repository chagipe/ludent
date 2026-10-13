# Ludent · Sistema de gestión para distribuidora de productos odontológicos

Next.js 14 (App Router, TypeScript) + Supabase (Postgres, Auth, RLS) + Vercel.

## Módulos
Inventario con lotes y vencimientos · varios almacenes (ajustes y transferencias) · proveedores · clientes con lista de precios y descuento · compras y órdenes de compra · ventas con boleta/factura · cotizaciones · devoluciones y notas de crédito · cuentas por cobrar y por pagar · reposición sugerida · reportes con exportación a Excel · pedido en campo (celular) · usuarios y roles.

## Cómo está protegido
- Los permisos por rol (`admin`, `vendedor`, `almacen`, `pendiente`) los aplica **la base de datos** (políticas RLS en `003_policies.sql`).
- Ventas, compras, anulaciones, devoluciones, pagos y movimientos de stock **solo** se pueden hacer mediante funciones SQL transaccionales (`002_functions.sql`): el stock nunca queda a medias y todo movimiento queda registrado en `stock_movements`.
- El primer usuario que se registra queda como `admin`; los demás entran como `pendiente` hasta que el admin les asigne un rol (Configuración).

## Puesta en marcha
1. **Supabase**: crea un proyecto. En *SQL Editor* ejecuta, en orden, `supabase/migrations/001_schema.sql`, `002_functions.sql`, `003_policies.sql`, `004_stock_entry.sql` y `005_product_images.sql`.
   En *Authentication > Providers > Email* puedes desactivar "Confirm email" mientras pruebas.
2. **Local**: `cp .env.example .env.local`, completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings > API), luego `npm install && npm run dev`.
3. Abre http://localhost:3000, crea tu cuenta (será administrador) y completa **Configuración** (razón social, RUC, series).
4. **GitHub**: `git init && git add . && git commit -m "Ludent" && git branch -M main && git remote add origin <tu-repo> && git push -u origin main`.
5. **Vercel**: importa el repositorio y agrega las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. En Supabase, *Authentication > URL Configuration*, agrega la URL de Vercel.

## Migrar datos del sistema HTML anterior
En el sistema anterior: Configuración > "Descargar respaldo (JSON)". Luego:
```
SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-backup.mjs respaldo-ludent-AAAA-MM-DD.json
```
Migra proveedores, clientes, productos, stock y lotes. Las ventas y compras históricas no se migran (quedan en el JSON). La service role key es secreta: úsala solo en tu computadora, nunca en Vercel.

## Pendiente: facturación electrónica SUNAT
Los comprobantes son una representación interna (`Comprobante` en `src/lib/doc.tsx`). Para que sean válidos ante SUNAT debes contratar un OSE/PSE (por ejemplo Nubefact), guardar su token en variables de entorno de Vercel (sin `NEXT_PUBLIC_`) y crear una ruta `src/app/api/sunat/route.ts` que envíe el comprobante tras `create_sale`.

## Estructura
```
supabase/migrations/   esquema, funciones transaccionales y políticas RLS
src/lib/               cliente Supabase, componentes base (Crud, Modal), documentos (venta/compra/historial/cobranza)
src/app/(app)/         pantallas protegidas por login y rol
scripts/               migración desde el respaldo JSON
```
