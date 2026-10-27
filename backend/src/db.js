import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const filename = process.env.DB_FILE || path.join(directory, "motoparts.sqlite");
const sqlite = new Database(filename);
sqlite.pragma("foreign_keys = ON");

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
    is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, brand TEXT, barcode TEXT UNIQUE, description TEXT,
    cost_price NUMERIC NOT NULL DEFAULT 0, price NUMERIC NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0, reorder_level INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, contact_person TEXT,
    phone TEXT, email TEXT, address TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT, cashier_id INTEGER NOT NULL, transaction_number TEXT NOT NULL UNIQUE,
    total_amount NUMERIC NOT NULL, payment_amount NUMERIC NOT NULL DEFAULT 0,
    change_amount NUMERIC NOT NULL DEFAULT 0, payment_method TEXT NOT NULL DEFAULT 'cash',
    status TEXT NOT NULL DEFAULT 'completed', sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cashier_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL, unit_price NUMERIC NOT NULL, line_total NUMERIC NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, supplier_id INTEGER,
    user_id INTEGER NOT NULL, type TEXT NOT NULL CHECK (type IN ('stock_in','stock_out','sale')),
    quantity INTEGER NOT NULL, quantity_after INTEGER NOT NULL, reference TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id), FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role TEXT,
    title TEXT NOT NULL, message TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
  "CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity)",
  "CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at)",
  "CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at)",
];

for (const statement of schema) sqlite.exec(statement);

function createDb(connection = sqlite) {
  return {
    prepare(sql) {
      const statement = connection.prepare(sql);
      return {
        get: async (...params) => statement.get(...params),
        all: async (...params) => statement.all(...params),
        run: async (...params) => {
          const result = statement.run(...params);
          return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
        },
      };
    },
  };
}

export const db = {
  ...createDb(),
  pool: sqlite,
  async transaction(callback) {
    sqlite.exec("BEGIN");
    try {
      const value = await callback(createDb());
      sqlite.exec("COMMIT");
      return value;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};

async function initialize() {
  await db.prepare("INSERT OR IGNORE INTO users (name,email,password,role) VALUES (?,?,?,?)").run(
    "Alex Dela Cruz", "admin@motoparts.test", await bcrypt.hash("password123", 10), "admin",
  );
  await db.prepare("INSERT OR IGNORE INTO users (name,email,password,role) VALUES (?,?,?,?)").run(
    "Maria Santos", "staff@motoparts.test", await bcrypt.hash("password123", 10), "staff",
  );
  for (const name of ["Engine Parts", "Brake Parts", "Electrical", "Tires", "Accessories"]) {
    await db.prepare("INSERT OR IGNORE INTO categories (name,description) VALUES (?,?)").run(
      name, `${name} motorcycle parts`,
    );
  }
  await db.prepare("INSERT OR IGNORE INTO suppliers (name,contact_person,phone) VALUES (?,?,?)").run(
    "ABC Parts", "Purchasing Desk", "09170000001",
  );
  await db.prepare("INSERT OR IGNORE INTO suppliers (name,contact_person,phone) VALUES (?,?,?)").run(
    "MotoSupplies", "Supplier Desk", "09170000002",
  );
}
await initialize();

export function userView(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return { ...safe, is_active: Boolean(safe.is_active ?? 1) };
}
export function categoryView(value) { return value ? { ...value, is_active: Boolean(value.is_active) } : null; }
export function supplierView(value) { return value ? { ...value, is_active: Boolean(value.is_active) } : null; }
export async function productView(product) {
  return product ? { ...product, is_active: Boolean(product.is_active), category: categoryView(
    await db.prepare("SELECT * FROM categories WHERE id = ?").get(product.category_id),
  ) } : null;
}
export async function saleView(sale) {
  if (!sale) return null;
  const cashier = await db.prepare("SELECT id,name,email,role,created_at,updated_at FROM users WHERE id = ?").get(sale.cashier_id);
  const items = await db.prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id").all(sale.id);
  return {
    ...sale, cashier: userView(cashier),
    items: await Promise.all(items.map(async (item) => ({
      ...item, product: await productView(await db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id)),
    }))),
  };
}
export async function movementView(value) {
  if (!value) return null;
  return {
    ...value,
    product: await productView(await db.prepare("SELECT * FROM products WHERE id = ?").get(value.product_id)),
    supplier: supplierView(value.supplier_id ? await db.prepare("SELECT * FROM suppliers WHERE id = ?").get(value.supplier_id) : null),
    user: userView(await db.prepare("SELECT id,name,email,role,created_at,updated_at FROM users WHERE id = ?").get(value.user_id)),
  };
}
export function notificationView(value) { return { ...value, is_read: Boolean(value.is_read) }; }
