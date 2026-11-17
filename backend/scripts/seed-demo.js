// Fills the database with presentation-ready demo data:
// 12 motorcycle parts with pictures, plus a week of sample sales.
// Run with:  npm run seed:demo   (safe to run again; it never duplicates)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../src/db.js";

const imageDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "demo", "images");
const picture = (file) => `data:image/png;base64,${fs.readFileSync(path.join(imageDir, `${file}.png`)).toString("base64")}`;

// name, sku, brand, category, price, cost, opening stock, reorder level, barcode, image file
const demoProducts = [
  ["Clutch Cable", "CLT-001", "Honda", "Engine Parts", 250, 140, 40, 8, "4800001000011", "clutch-cable"],
  ["Brake Pads (Front)", "BRK-101", "Yamaha", "Brake Parts", 480, 300, 25, 6, "4800001000028", "brake-pads"],
  ["Spark Plug NGK CR7HSA", "SPK-207", "NGK", "Electrical", 180, 95, 60, 15, "4800001000035", "spark-plug"],
  ["Chain Kit 428H", "CHN-428", "DID", "Engine Parts", 1650, 1100, 6, 5, "4800001000042", "chain-kit"],
  ["Engine Oil 10W-40 1L", "OIL-1040", "Motul", "Engine Parts", 420, 310, 3, 10, "4800001000059", "engine-oil"],
  ["Air Filter Element", "AIR-033", "Suzuki", "Engine Parts", 320, 190, 0, 4, "4800001000066", "air-filter"],
  ["Side Mirror Set", "MIR-550", "Generic", "Accessories", 390, 210, 18, 5, "4800001000073", "side-mirror"],
  ["Headlight Bulb H4", "LGT-H4", "Osram", "Electrical", 260, 150, 30, 8, "4800001000080", "headlight-bulb"],
  ["Rear Shock Absorber", "SHK-300", "YSS", "Accessories", 2850, 2100, 4, 3, "4800001000097", "rear-shock"],
  ["Inner Tube 2.75-17", "TUB-275", "IRC", "Tires", 210, 120, 50, 10, "4800001000103", "inner-tube"],
  ["Throttle Cable", "THR-010", "Honda", "Accessories", 230, 130, 12, 5, "4800001000110", "throttle-cable"],
  ["Battery YTX5L-BS", "BAT-005", "Yuasa", "Electrical", 1450, 1050, 7, 4, "4800001000127", "battery"],
];

const admin = await db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
const cashiers = await db.prepare("SELECT id FROM users WHERE is_active = 1 ORDER BY id").all();
let created = 0;
let updated = 0;

for (const [name, sku, brand, categoryName, price, cost, quantity, reorder, barcode, image] of demoProducts) {
  const category = await db.prepare("SELECT id FROM categories WHERE name = ?").get(categoryName);
  const existing = await db.prepare("SELECT id FROM products WHERE sku = ?").get(sku);
  if (existing) {
    // Already there: just add the picture and put it in the right category.
    await db.prepare("UPDATE products SET image_data = ?, category_id = ?, is_active = 1 WHERE id = ?").run(picture(image), category.id, existing.id);
    updated += 1;
    continue;
  }
  const result = await db.prepare(
    "INSERT INTO products (category_id, sku, name, brand, barcode, image_data, cost_price, price, quantity, reorder_level, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
  ).run(category.id, sku, name, brand, barcode, picture(image), cost, price, quantity, reorder);
  if (quantity > 0)
    await db.prepare(
      "INSERT INTO stock_movements (product_id, user_id, type, quantity, quantity_after, reference, notes) VALUES (?, ?, 'stock_in', ?, ?, 'INITIAL-STOCK', 'Opening inventory balance')",
    ).run(Number(result.lastInsertRowid), admin.id, quantity, quantity);
  created += 1;
}

// A week of sales so the dashboard chart and "Top sellers" have something to show.
// Demo sales are numbered TX-DEMO001…, so we can tell whether they were already added.
const { count } = await db.prepare("SELECT COUNT(*) AS count FROM sales WHERE transaction_number LIKE 'TX-DEMO%'").get();
let salesAdded = 0;
if (Number(count) === 0) {
  const basket = [
    [6, ["SPK-207", 2], ["TUB-275", 1]],
    [6, ["CLT-001", 1]],
    [5, ["BRK-101", 1], ["LGT-H4", 2]],
    [4, ["SPK-207", 4]],
    [3, ["MIR-550", 1], ["THR-010", 1]],
    [3, ["TUB-275", 2]],
    [2, ["BAT-005", 1]],
    [2, ["LGT-H4", 1], ["SPK-207", 1]],
    [1, ["BRK-101", 2]],
    [1, ["CLT-001", 2], ["TUB-275", 1]],
  ];
  for (const [index, [daysAgo, ...lines]] of basket.entries()) {
    const cashier = cashiers[index % cashiers.length];
    await db.transaction(async (tx) => {
      let total = 0;
      const items = [];
      for (const [sku, quantity] of lines) {
        const product = await tx.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
        if (!product || product.quantity < quantity) return; // skip if stock ran out
        const lineTotal = Number(product.price) * quantity;
        total += lineTotal;
        items.push({ product, quantity, lineTotal });
      }
      if (!items.length) return;
      const paid = Math.ceil(total / 100) * 100;
      const soldAt = new Date(Date.now() - daysAgo * 86400000 - (index % 5) * 3600000);
      const sale = await tx.prepare(
        "INSERT INTO sales (cashier_id, transaction_number, total_amount, payment_amount, change_amount, payment_method, status, sold_at) VALUES (?, ?, ?, ?, ?, 'cash', 'completed', ?)",
      ).run(cashier.id, `TX-DEMO${String(index + 1).padStart(3, "0")}`, total, paid, paid - total, soldAt);
      for (const { product, quantity, lineTotal } of items) {
        const after = product.quantity - quantity;
        await tx.prepare("UPDATE products SET quantity = ? WHERE id = ?").run(after, product.id);
        await tx.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)")
          .run(Number(sale.lastInsertRowid), product.id, quantity, product.price, lineTotal);
        await tx.prepare(
          "INSERT INTO stock_movements (product_id, user_id, type, quantity, quantity_after, reference, notes, created_at) VALUES (?, ?, 'sale', ?, ?, 'SALE', 'Sale transaction', ?)",
        ).run(product.id, cashier.id, quantity, after, soldAt);
      }
      salesAdded += 1;
    });
  }
}

console.log(`Demo data ready: ${created} products added, ${updated} updated with pictures, ${salesAdded} sample sales added.`);
await db.pool.close();
