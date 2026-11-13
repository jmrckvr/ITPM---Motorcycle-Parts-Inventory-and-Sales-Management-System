import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const host = process.env.DB_HOST || "127.0.0.1";
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || "root";
const password = process.env.DB_PASSWORD || "";
const database = process.env.DB_NAME || "BS Tarluck";
const quotedDatabase = `\`${database.replaceAll("`", "``")}\``;

const serverConnection = await mysql.createConnection({ host, port, user, password, decimalNumbers: true });
await serverConnection.query(`CREATE DATABASE IF NOT EXISTS ${quotedDatabase}`);
await serverConnection.end();

const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  decimalNumbers: true,
  waitForConnections: true,
  connectionLimit: 10,
});

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, role ENUM('admin','staff') NOT NULL DEFAULT 'staff',
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE, description TEXT,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT, category_id INT NOT NULL, sku VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL, brand VARCHAR(255), barcode VARCHAR(255) UNIQUE, description TEXT,
    image_data LONGTEXT, cost_price DECIMAL(12,2) NOT NULL DEFAULT 0, price DECIMAL(12,2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 0, reorder_level INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE, contact_person VARCHAR(255),
    phone VARCHAR(100), email VARCHAR(255), address TEXT, is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id INT PRIMARY KEY AUTO_INCREMENT, cashier_id INT NOT NULL, transaction_number VARCHAR(255) NOT NULL UNIQUE,
    total_amount DECIMAL(12,2) NOT NULL, payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    change_amount DECIMAL(12,2) NOT NULL DEFAULT 0, payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
    status VARCHAR(50) NOT NULL DEFAULT 'completed', sold_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cashier_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sale_items (
    id INT PRIMARY KEY AUTO_INCREMENT, sale_id INT NOT NULL, product_id INT NOT NULL,
    quantity INT NOT NULL, unit_price DECIMAL(12,2) NOT NULL, line_total DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id INT PRIMARY KEY AUTO_INCREMENT, product_id INT NOT NULL, supplier_id INT,
    user_id INT NOT NULL, type ENUM('stock_in','stock_out','sale') NOT NULL,
    quantity INT NOT NULL, quantity_after INT NOT NULL, reference VARCHAR(255), notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id), FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT, user_id INT, role VARCHAR(50),
    title VARCHAR(255) NOT NULL, message TEXT NOT NULL, type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_read TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  "CREATE INDEX idx_products_name ON products(name)",
  "CREATE INDEX idx_products_quantity ON products(quantity)",
  "CREATE INDEX idx_sales_sold_at ON sales(sold_at)",
  "CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at)",
];

for (const statement of schema) {
  try {
    await pool.query(statement);
  } catch (error) {
    if (!error.message.includes("Duplicate key name")) throw error;
  }
}

function createDb(connection = pool) {
  return {
    prepare(sql) {
      return {
        async get(...params) {
          const [rows] = await connection.query(sql, params);
          return rows[0];
        },
        async all(...params) {
          const [rows] = await connection.query(sql, params);
          return rows;
        },
        async run(...params) {
          const [result] = await connection.query(sql, params);
          return { changes: result.affectedRows, lastInsertRowid: result.insertId };
        },
      };
    },
  };
}

export const db = {
  ...createDb(),
  pool: { close: () => pool.end(), end: () => pool.end() },
  async transaction(callback) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const value = await callback(createDb(connection));
      await connection.commit();
      return value;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

async function initialize() {
  await db.prepare("INSERT IGNORE INTO users (name,email,password,role) VALUES (?,?,?,?)").run(
    "Alex Dela Cruz", "admin@motoparts.test", await bcrypt.hash("password123", 10), "admin",
  );
  await db.prepare("INSERT IGNORE INTO users (name,email,password,role) VALUES (?,?,?,?)").run(
    "Maria Santos", "staff@motoparts.test", await bcrypt.hash("password123", 10), "staff",
  );
  for (const name of ["Engine Parts", "Brake Parts", "Electrical", "Tires", "Accessories"]) {
    await db.prepare("INSERT IGNORE INTO categories (name,description) VALUES (?,?)").run(
      name, `${name} motorcycle parts`,
    );
  }
  await db.prepare("INSERT IGNORE INTO suppliers (name,contact_person,phone) VALUES (?,?,?)").run(
    "ABC Parts", "Purchasing Desk", "09170000001",
  );
  await db.prepare("INSERT IGNORE INTO suppliers (name,contact_person,phone) VALUES (?,?,?)").run(
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
