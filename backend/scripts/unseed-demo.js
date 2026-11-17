// Removes the demo data that seed-demo.js added.
// Run with:  npm run unseed:demo   (safe to run again; it only touches demo rows)
//
// How it finds demo data:
//   - sample sales are numbered TX-DEMO001...TX-DEMO010
//   - demo products use the 12 SKUs listed below (same list as seed-demo.js)
//
// A demo product that appears in a REAL sale is hidden (is_active = 0) instead
// of deleted, because MySQL won't delete a product that a sale still points to,
// and we don't want to break the sales history.
import { db } from "../src/db.js";

const demoSkus = [
  "CLT-001", "BRK-101", "SPK-207", "CHN-428", "OIL-1040", "AIR-033",
  "MIR-550", "LGT-H4", "SHK-300", "TUB-275", "THR-010", "BAT-005",
];

let salesRemoved = 0;
let productsRemoved = 0;
let productsHidden = 0;

await db.transaction(async (tx) => {
  // 1. Sample sales. Their sale_items are removed automatically (ON DELETE CASCADE).
  const demoSales = await tx.prepare("SELECT id FROM sales WHERE transaction_number LIKE 'TX-DEMO%'").all();
  for (const sale of demoSales) {
    await tx.prepare("DELETE FROM sales WHERE id = ?").run(sale.id);
    salesRemoved += 1;
  }

  // 2. Demo products, one at a time.
  for (const sku of demoSkus) {
    const product = await tx.prepare("SELECT id FROM products WHERE sku = ?").get(sku);
    if (!product) continue; // already gone

    const { count } = await tx.prepare("SELECT COUNT(*) AS count FROM sale_items WHERE product_id = ?").get(product.id);
    if (Number(count) > 0) {
      // Sold in a real transaction: keep it for the records, just hide it.
      await tx.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(product.id);
      productsHidden += 1;
      continue;
    }

    await tx.prepare("DELETE FROM stock_movements WHERE product_id = ?").run(product.id);
    await tx.prepare("DELETE FROM products WHERE id = ?").run(product.id);
    productsRemoved += 1;
  }
});

console.log(
  `Demo data removed: ${salesRemoved} sample sales, ${productsRemoved} products deleted, ` +
  `${productsHidden} hidden (they appear in real sales).`,
);
await db.pool.close();
