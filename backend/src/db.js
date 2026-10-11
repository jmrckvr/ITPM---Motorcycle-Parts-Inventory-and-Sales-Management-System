import "dotenv/config";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const databaseFile =
  process.env.DATABASE_FILE ||
  path.join(currentDirectory, "..", "data", "motoparts.sqlite");

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

export const db = new Database(databaseFile);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT UNIQUE,
    description TEXT,
    cost_price REAL NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_id INTEGER NOT NULL REFERENCES users(id),
    transaction_number TEXT NOT NULL UNIQUE,
    total_amount REAL NOT NULL,
    payment_amount REAL NOT NULL DEFAULT 0,
    change_amount REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    status TEXT NOT NULL DEFAULT 'completed',
    sold_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'sale')),
    quantity INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'staff')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const columns = (table) =>
  new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
const addColumn = (table, name, definition) => {
  if (!columns(table).has(name))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
};
const movementTableSql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stock_movements'")
  .get()?.sql || "";
if (!movementTableSql.includes("'stock_out'")) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    ALTER TABLE stock_movements RENAME TO stock_movements_legacy;
    CREATE TABLE stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK (type IN ('stock_in', 'stock_out', 'sale')),
      quantity INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO stock_movements (id, product_id, user_id, type, quantity, quantity_after, reference, notes, created_at)
      SELECT id, product_id, user_id, type, quantity, quantity_after, reference, notes, created_at
      FROM stock_movements_legacy;
    DROP TABLE stock_movements_legacy;
  `);
  db.pragma("foreign_keys = ON");
}
addColumn("users", "is_active", "INTEGER NOT NULL DEFAULT 1");
addColumn("products", "brand", "TEXT");
addColumn("products", "barcode", "TEXT");
addColumn("products", "cost_price", "REAL NOT NULL DEFAULT 0");
addColumn("sales", "payment_amount", "REAL NOT NULL DEFAULT 0");
addColumn("sales", "change_amount", "REAL NOT NULL DEFAULT 0");
addColumn("sales", "payment_method", "TEXT NOT NULL DEFAULT 'cash'");
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);
  CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
`);

const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
if (userCount === 0) {
  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
  );
  insertUser.run(
    "Alex Dela Cruz",
    "admin@motoparts.test",
    bcrypt.hashSync("password123", 10),
    "admin",
  );
  insertUser.run(
    "Maria Santos",
    "staff@motoparts.test",
    bcrypt.hashSync("password123", 10),
    "staff",
  );
}

const insertCategory = db.prepare(
  "INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)",
);
for (const name of ["Engine Parts", "Brake Parts", "Electrical", "Tires", "Accessories"])
  insertCategory.run(name, `${name} motorcycle parts`);

export function userView(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return { ...safeUser, is_active: Boolean(safeUser.is_active ?? 1) };
}

export function categoryView(category) {
  if (!category) return null;
  return { ...category, is_active: Boolean(category.is_active) };
}

export function productView(product) {
  if (!product) return null;
  const category = product.category_id
    ? db
        .prepare("SELECT * FROM categories WHERE id = ?")
        .get(product.category_id)
    : null;
  return {
    ...product,
    is_active: Boolean(product.is_active),
    category: categoryView(category),
  };
}

export function saleView(sale) {
  const cashier = db
    .prepare(
      "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?",
    )
    .get(sale.cashier_id);
  const items = db
    .prepare("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id")
    .all(sale.id)
    .map((item) => ({
      ...item,
      product: productView(
        db.prepare("SELECT * FROM products WHERE id = ?").get(item.product_id),
      ),
    }));
  return { ...sale, cashier: userView(cashier), items };
}

export function movementView(movement) {
  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(movement.product_id);
  const user = db
    .prepare(
      "SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?",
    )
    .get(movement.user_id);
  return { ...movement, product: productView(product), user: userView(user) };
}

export function notificationView(notification) {
  return {
    ...notification,
    is_read: Boolean(notification.is_read),
  };
}
