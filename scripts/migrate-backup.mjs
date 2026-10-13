// Migra catálogo, stock y lotes desde el respaldo JSON del sistema anterior (HTML).
// Uso:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-backup.mjs respaldo-ludent-YYYY-MM-DD.json
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const file = process.argv[2];
if (!file || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-backup.mjs <respaldo.json>'); process.exit(1); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const old = JSON.parse(readFileSync(file, 'utf8'));
const must = (r, what) => { if (r.error) { console.error('Error en', what, r.error.message); process.exit(1); } return r.data; };
const wh = must(await sb.from('warehouses').select('id').eq('is_default', true).single(), 'almacén');
const supMap = {};
for (const s of old.suppliers || []) supMap[s.id] = must(await sb.from('suppliers').insert({ name: s.name, ruc: s.ruc, contact: s.contact, phone: s.phone, email: s.email }).select('id').single(), 'proveedor').id;
for (const c of old.customers || []) must(await sb.from('customers').insert({ name: c.name, doc: c.doc, phone: c.phone, email: c.email, address: c.addr, price_list: c.list || 'Minorista', discount: c.disc || 0 }), 'cliente');
for (const p of old.products || []) {
  const row = must(await sb.from('products').insert({ sku: p.sku, barcode: p.barcode || null, name: p.name, category: p.cat, supplier_id: supMap[p.supplierId] || null, cost: p.cost || 0, price: p.price || 0, price_wholesale: p.priceW || null, min_stock: p.min || 0 }).select('id').single(), 'producto ' + p.sku);
  if (p.stock > 0) must(await sb.from('product_stock').insert({ product_id: row.id, warehouse_id: wh.id, qty: p.stock }), 'stock ' + p.sku);
  for (const l of (p.lots || []).filter((l) => l.qty > 0)) must(await sb.from('lots').insert({ product_id: row.id, warehouse_id: wh.id, ref: l.ref, expires_on: l.exp || null, qty: l.qty }), 'lote ' + l.ref);
}
console.log('Migración lista. Las ventas y compras históricas no se migran: quedan en el respaldo JSON.');
