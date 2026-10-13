import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  db,
  categoryView,
  movementView,
  notificationView,
  productView,
  saleView,
  supplierView,
  userView,
} from "./db.js";
import { issueToken, requireAdmin, requireAuth } from "./auth.js";
import {
  categorySchema,
  loginSchema,
  parse,
  productSchema,
  saleSchema,
  stockAdjustmentSchema,
  stockInSchema,
  notificationSchema,
  userSchema,
  supplierSchema,
} from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 8000);

app.use(
  cors({
    origin: (origin, callback) => {
      const configuredOrigin = process.env.FRONTEND_ORIGIN;
      const isLocalFrontend =
        !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      callback(null, isLocalFrontend || origin === configuredOrigin);
    },
  }),
);
app.use(express.json());

app.get("/", (_request, response) =>
  response.json({ name: "MotoParts API", status: "ok" }),
);
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const { email, password } = parse(loginSchema, request.body);
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || user.is_active === 0 || !bcrypt.compareSync(password, user.password))
      return response.status(422).json({
        message: "The provided credentials are incorrect.",
        errors: { email: ["The provided credentials are incorrect."] },
      });
    return response.json({ token: issueToken(user), user: userView(user) });
  } catch (error) {
    return next(error);
  }
});

const api = express.Router();
api.use(requireAuth);
api.post("/auth/logout", async (_request, response) =>
  response.json({ message: "Logged out successfully." }),
);
api.get("/auth/me", async (request, response) =>
  response.json({ user: request.user }),
);
api.get("/user", async (request, response) => response.json(request.user));
api.get("/notifications", async (request, response) => {
  const notificationRows = await db.prepare(`
    SELECT * FROM notifications
    WHERE (user_id = ? OR user_id IS NULL)
      AND (role = ? OR role IS NULL)
    ORDER BY created_at DESC, id DESC
  `).all(request.user.id, request.user.role);
  const notifications = (await notificationRows).map(notificationView);
  return response.json({ data: notifications });
});
api.patch("/notifications/:id/read", async (request, response) => {
  const result = await db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE id = ?
      AND (user_id = ? OR user_id IS NULL)
      AND (role = ? OR role IS NULL)
  `).run(request.params.id, request.user.id, request.user.role);
  return result.changes
    ? response.json({ message: "Notification marked as read." })
    : response.status(404).json({ message: "Notification not found." });
});
api.delete("/notifications/:id", async (request, response) => {
  const result = await db.prepare(`
    DELETE FROM notifications
    WHERE id = ?
      AND (user_id = ? OR user_id IS NULL)
      AND (role = ? OR role IS NULL)
  `).run(request.params.id, request.user.id, request.user.role);
  return result.changes
    ? response.json({ message: "Notification deleted successfully." })
    : response.status(404).json({ message: "Notification not found." });
});
api.post("/notifications/read-all", async (request, response) => {
  await db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE (user_id = ? OR user_id IS NULL) AND (role = ? OR role IS NULL)
  `).run(request.user.id, request.user.role);
  return response.json({ message: "Notifications marked as read." });
});
api.get("/dashboard/summary", async (_request, response) => {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) AS total_products,
      SUM(CASE WHEN quantity > 0 AND quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock,
      SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock
    FROM products WHERE is_active = 1
  `).get();
  const sales = await db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS todays_sales, COUNT(*) AS transaction_count
    FROM sales WHERE status = 'completed' AND DATE(sold_at) = CURDATE()
  `).get();
  const recent = await Promise.all((await db.prepare("SELECT * FROM sales ORDER BY sold_at DESC, id DESC LIMIT 5").all()).map(saleView));
  return response.json({ data: { ...stats, ...sales, recent } });
});

api.get("/categories", async (_request, response) =>
  response.json({
    data: (await db.prepare("SELECT * FROM categories ORDER BY created_at DESC, id DESC").all()).map(categoryView),
  }),
);
api.post("/categories", requireAdmin, async (request, response, next) => {
  try {
    const data = parse(categorySchema, request.body);
    const result = await db.prepare(
        "INSERT INTO categories (name, description, is_active) VALUES (?, ?, ?)",
      )
      .run(
        data.name,
        data.description ?? null,
        data.is_active === false ? 0 : 1,
      );
    const categoryId = Number(result.lastInsertRowid);
    return response.status(201).json({
      message: "Category created successfully.",
      data: categoryView(
        await db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId),
      ),
    });
  } catch (error) {
    return next(error);
  }
});
api.get("/categories/:id", async (request, response, next) =>
  sendCategory(request, response, next),
);
api.put("/categories/:id", requireAdmin, async (request, response, next) => {
  try {
    const category = await db.prepare("SELECT * FROM categories WHERE id = ?")
      .get(request.params.id);
    if (!category)
      return response.status(404).json({ message: "Category not found." });
    const data = parse(categorySchema.partial(), request.body);
    const nextCategory = { ...category, ...data };
    await db.prepare(
      "UPDATE categories SET name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(
      nextCategory.name,
      nextCategory.description ?? null,
      nextCategory.is_active === false ? 0 : 1,
      category.id,
    );
    return response.json({
      message: "Category updated successfully.",
      data: categoryView(
        await db.prepare("SELECT * FROM categories WHERE id = ?").get(category.id),
      ),
    });
  } catch (error) {
    return next(error);
  }
});
api.delete("/categories/:id", requireAdmin, async (request, response) => {
  const result = await db.prepare("DELETE FROM categories WHERE id = ?")
    .run(request.params.id);
  if (!result.changes)
    return response.status(404).json({ message: "Category not found." });
  return response.json({ message: "Category deleted successfully." });
});

api.get("/products", async (_request, response) =>
  response.json({
    data: await Promise.all((await db.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC, id DESC").all()).map(productView)),
  }),
);
api.post("/products", requireAdmin, async (request, response, next) =>
  saveProduct(request, response, next, false),
);
api.get("/products/:id", async (request, response) => {
  const product = await db.prepare("SELECT * FROM products WHERE id = ?")
    .get(request.params.id);
  return product
    ? response.json({ data: await productView(product) })
    : response.status(404).json({ message: "Product not found." });
});
api.put("/products/:id", requireAdmin, async (request, response, next) =>
  saveProduct(request, response, next, true),
);
api.delete("/products/:id", requireAdmin, async (request, response) => {
  const result = await db.prepare("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(request.params.id);
  if (!result.changes)
    return response.status(404).json({ message: "Product not found." });
  return response.json({ message: "Product archived successfully." });
});

api.get("/inventory", async (request, response) =>
  response.json({
    data: await Promise.all((await db.prepare("SELECT * FROM products WHERE is_active = 1 AND (? = '' OR name LIKE ? OR sku LIKE ? OR barcode LIKE ?) ORDER BY quantity, id").all(String(request.query.search || ""), `%${request.query.search || ""}%`, `%${request.query.search || ""}%`, `%${request.query.search || ""}%`)).map(productView)),
  }),
);
api.get("/stock-movements", async (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(request.query.offset) || 0, 0);
  const type = request.query.type ? String(request.query.type) : null;
  const rows = await Promise.all((await db.prepare("SELECT * FROM stock_movements WHERE (? IS NULL OR type = ?) ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?")
    .all(type, type, limit, offset)).map(movementView));
  return response.json({ data: rows, meta: { limit, offset, count: rows.length } });
});
api.get("/suppliers", async (_request, response) =>
  response.json({ data: (await db.prepare("SELECT * FROM suppliers ORDER BY name").all()).map(supplierView) }),
);
api.post("/suppliers", requireAdmin, async (request, response, next) => {
  try {
    const data = parse(supplierSchema, request.body);
    const result = await db.prepare("INSERT INTO suppliers (name, contact_person, phone, email, address, is_active) VALUES (?, ?, ?, ?, ?, ?)")
      .run(data.name, data.contact_person ?? null, data.phone ?? null, data.email ?? null, data.address ?? null, data.is_active === false ? 0 : 1);
    return response.status(201).json({ message: "Supplier created successfully.", data: supplierView(await db.prepare("SELECT * FROM suppliers WHERE id = ?").get(Number(result.lastInsertRowid))) });
  } catch (error) { return next(error); }
});
api.put("/suppliers/:id", requireAdmin, async (request, response, next) => {
  try {
    const current = await db.prepare("SELECT * FROM suppliers WHERE id = ?").get(request.params.id);
    if (!current) return response.status(404).json({ message: "Supplier not found." });
    const data = parse(supplierSchema.partial(), request.body);
    const value = { ...current, ...data };
    await db.prepare("UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, address=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(value.name, value.contact_person ?? null, value.phone ?? null, value.email ?? null, value.address ?? null, value.is_active === false ? 0 : 1, current.id);
    return response.json({ message: "Supplier updated successfully.", data: supplierView(await db.prepare("SELECT * FROM suppliers WHERE id = ?").get(current.id)) });
  } catch (error) { return next(error); }
});
api.delete("/suppliers/:id", requireAdmin, async (request, response) => {
  const result = await db.prepare("UPDATE suppliers SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(request.params.id);
  return result.changes ? response.json({ message: "Supplier archived successfully." }) : response.status(404).json({ message: "Supplier not found." });
});
api.post("/stock-movements", async (request, response, next) => {
  try {
    const data = parse(stockInSchema, request.body);
    const product = await db.prepare("SELECT * FROM products WHERE id = ?")
      .get(data.product_id);
    if (!product)
      return response
        .status(422)
        .json({ message: "The selected product is invalid." });
    if (data.supplier_id && !await db.prepare("SELECT id FROM suppliers WHERE id = ? AND is_active = 1").get(data.supplier_id))
      return response.status(422).json({ message: "The selected supplier is invalid." });
    const movement = await db.transaction(async (tx) => {
      const quantityAfter = product.quantity + data.quantity;
      await tx.prepare(
        "UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(quantityAfter, product.id);
      const result = await tx.prepare(
          "INSERT INTO stock_movements (product_id, supplier_id, user_id, type, quantity, quantity_after, reference, notes) VALUES (?, ?, ?, 'stock_in', ?, ?, ?, ?)",
        )
        .run(
          product.id,
          data.supplier_id ?? null,
          request.user.id,
          data.quantity,
          quantityAfter,
          data.reference || "STOCK-IN",
          data.notes || "Inventory stock-in",
        );
      return tx
        .prepare("SELECT * FROM stock_movements WHERE id = ?")
        .get(Number(result.lastInsertRowid));
    });
    await createNotification({
      role: "admin",
      title: "Stock-in completed",
      message: `${product.name}: ${data.quantity} unit(s) received.`,
      type: "stock",
    });
    return response.status(201).json({
      message: "Stock moved in successfully.",
      data: await movementView(movement),
    });
  } catch (error) {
    return next(error);
  }
});
api.post("/stock-out", async (request, response, next) => {
  try {
    const data = parse(stockAdjustmentSchema, request.body);
    const product = await db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(data.product_id);
    if (!product) return response.status(422).json({ message: "The selected product is invalid." });
    if (product.quantity < data.quantity)
      return response.status(422).json({ message: `Insufficient stock for ${product.name}.` });
    const movement = await db.transaction(async (tx) => {
      const quantityAfter = product.quantity - data.quantity;
      await tx.prepare("UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(quantityAfter, product.id);
      const result = await tx.prepare(
        "INSERT INTO stock_movements (product_id, user_id, type, quantity, quantity_after, reference, notes) VALUES (?, ?, 'stock_out', ?, ?, 'ADJUSTMENT', ?)",
      ).run(product.id, request.user.id, data.quantity, quantityAfter, data.reason);
      return await tx.prepare("SELECT * FROM stock_movements WHERE id = ?").get(Number(result.lastInsertRowid));
    });
    await createNotification({
      role: "admin",
      title: "Stock adjustment recorded",
      message: `${product.name}: ${data.quantity} unit(s) removed. ${data.reason}`,
      type: "stock",
    });
    if (product.quantity - data.quantity <= product.reorder_level)
      await createNotification({
        role: "admin",
        title: product.quantity - data.quantity === 0 ? "Out of stock alert" : "Low stock alert",
        message: `${product.name} now has ${product.quantity - data.quantity} unit(s).`,
        type: "inventory",
      });
    return response.status(201).json({ message: "Stock moved out successfully.", data: await movementView(movement) });
  } catch (error) {
    return next(error);
  }
});

api.get("/sales", async (_request, response) =>
  response.json({
    data: await Promise.all((await db.prepare("SELECT * FROM sales WHERE (? = 'admin' OR cashier_id = ?) ORDER BY sold_at DESC, id DESC").all(_request.user.role, _request.user.id)).map(saleView)),
  }),
);
api.post("/sales", async (request, response, next) => {
  try {
    const { items, payment_amount, payment_method } = parse(saleSchema, request.body);
    const depletedProducts = [];
    const sale = await db.transaction(async (tx) => {
      const saleItems = [];
      let totalAmount = 0;
      const mergedItems = new Map();
      for (const item of items)
        mergedItems.set(item.product_id, (mergedItems.get(item.product_id) || 0) + item.quantity);
      for (const [productId, quantity] of mergedItems) {
        const product = await tx.prepare("SELECT * FROM products WHERE id = ?")
          .get(productId);
        if (!product) {
          const error = new Error("The selected product is invalid.");
          error.status = 422;
          throw error;
        }
        if (product.quantity < quantity) {
          const error = new Error(`Insufficient stock for ${product.name}.`);
          error.status = 422;
          throw error;
        }
        const lineTotal = product.price * quantity;
        totalAmount += lineTotal;
        const quantityAfter = product.quantity - quantity;
        if (quantityAfter <= product.reorder_level)
          depletedProducts.push({
            name: product.name,
            quantity: quantityAfter,
          });
        await tx.prepare(
          "UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(quantityAfter, product.id);
        await tx.prepare(
          "INSERT INTO stock_movements (product_id, user_id, type, quantity, quantity_after, reference, notes) VALUES (?, ?, 'sale', ?, ?, 'SALE', 'Sale transaction')",
        ).run(product.id, request.user.id, quantity, quantityAfter);
        saleItems.push({
          product_id: product.id,
          quantity,
          unit_price: product.price,
          line_total: lineTotal,
        });
      }
      if (payment_amount < totalAmount) {
        const error = new Error("Payment amount is less than the sale total.");
        error.status = 422;
        throw error;
      }
      const transactionNumber = `TX-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const saleResult = await tx.prepare(
          "INSERT INTO sales (cashier_id, transaction_number, total_amount, payment_amount, change_amount, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')",
        )
        .run(request.user.id, transactionNumber, totalAmount, payment_amount, payment_amount - totalAmount, payment_method);
      const insertItem = tx.prepare(
        "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)",
      );
      for (const item of saleItems)
        await insertItem.run(
          Number(saleResult.lastInsertRowid),
          item.product_id,
          item.quantity,
          item.unit_price,
          item.line_total,
        );
      return tx
        .prepare("SELECT * FROM sales WHERE id = ?")
        .get(Number(saleResult.lastInsertRowid));
    });
    for (const product of depletedProducts)
      await createNotification({
        role: "admin",
        title: product.quantity === 0 ? "Out of stock alert" : "Low stock alert",
        message: `${product.name} now has ${product.quantity} unit(s) after a sale.`,
        type: "inventory",
      });
    return response.json({
      message: "Sale processed successfully.",
      data: await saleView(sale),
    });
  } catch (error) {
    return next(error);
  }
});
api.get("/sales/:id", async (request, response) => {
  const sale = await db.prepare("SELECT * FROM sales WHERE id = ?")
    .get(request.params.id);
  if (sale && request.user.role !== "admin" && sale.cashier_id !== request.user.id)
    return response.status(403).json({ message: "Forbidden." });
  return sale
    ? response.json({ data: await saleView(sale) })
    : response.status(404).json({ message: "Sale not found." });
});

api.get("/reports/sales", async (request, response) => {
  const conditions = [];
  const values = [];
  if (request.query.from) {
    conditions.push("date(sold_at) >= date(?)");
    values.push(request.query.from);
  }
  if (request.query.to) {
    conditions.push("date(sold_at) <= date(?)");
    values.push(request.query.to);
  }
  if (request.user.role !== "admin") {
    conditions.push("cashier_id = ?");
    values.push(request.user.id);
  }
  const sales = await db.prepare(
      `SELECT * FROM sales ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY sold_at DESC`,
    )
    .all(...values);
  return response.json({
    data: await Promise.all(sales.map(saleView)),
    summary: {
      total_sales: sales.reduce((sum, sale) => sum + sale.total_amount, 0),
      transaction_count: sales.length,
      total_paid: sales.reduce((sum, sale) => sum + sale.payment_amount, 0),
      total_change: sales.reduce((sum, sale) => sum + sale.change_amount, 0),
    },
  });
});
api.get("/reports/inventory", async (_request, response) =>
  response.json({
    data: await Promise.all((await db.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY quantity, id").all()).map(async (product) => ({
        ...(await productView(product)), stock_on_hand: product.quantity,
        low_stock: product.quantity <= product.reorder_level ? 1 : 0,
      }))),
  }),
);

api.get("/users", requireAdmin, async (_request, response) =>
  response.json({
    data: (await db.prepare("SELECT id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC, id DESC").all()).map(userView),
  }),
);
api.get("/users/:id", requireAdmin, async (request, response) => {
  const user = await db.prepare(
      "SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?",
    )
    .get(request.params.id);
  return user
    ? response.json({ data: userView(user) })
    : response.status(404).json({ message: "User not found." });
});
api.post("/users", requireAdmin, async (request, response, next) =>
  saveUser(request, response, next, false),
);
api.put("/users/:id", requireAdmin, async (request, response, next) =>
  saveUser(request, response, next, true),
);
api.delete("/users/:id", requireAdmin, async (request, response) => {
  if (Number(request.params.id) === request.user.id)
    return response.status(422).json({ message: "You cannot delete your own account." });
  const referenced = await db.prepare(
      "SELECT (SELECT COUNT(*) FROM sales WHERE cashier_id = ?) + (SELECT COUNT(*) FROM stock_movements WHERE user_id = ?) AS count",
    )
    .get(request.params.id, request.params.id);
  if (referenced.count > 0)
    return response.status(409).json({
      message: "This account has transaction history and cannot be deleted. Deactivate it instead.",
    });
  const result = await db.prepare("DELETE FROM users WHERE id = ?")
    .run(request.params.id);
  if (!result.changes)
    return response.status(404).json({ message: "User not found." });
  return response.json({ message: "User deleted successfully." });
});

app.use("/api", api);
app.use((error, _request, response, _next) => {
  if (error.code?.startsWith("SQLITE_CONSTRAINT") || error.code === "ER_DUP_ENTRY")
    return response.status(422).json({
      message: "The submitted data conflicts with an existing record.",
    });
  return response.status(error.status || 500).json({
    message: error.message || "Server error.",
    ...(error.details ? { errors: error.details } : {}),
  });
});

async function sendCategory(request, response) {
  const category = await db.prepare("SELECT * FROM categories WHERE id = ?")
    .get(request.params.id);
  return category
    ? response.json({ data: categoryView(category) })
    : response.status(404).json({ message: "Category not found." });
}

async function saveProduct(request, response, next, isUpdate) {
  try {
    const current = isUpdate
      ? await db.prepare("SELECT * FROM products WHERE id = ?").get(request.params.id)
      : null;
    if (isUpdate && !current)
      return response.status(404).json({ message: "Product not found." });
    const data = parse(
      isUpdate ? productSchema.partial() : productSchema,
      request.body,
    );
    const value = {
      ...current,
      ...data,
      is_active: data.is_active ?? current?.is_active ?? true,
    };
    // Quantity is changed only through stock movements so the audit trail remains complete.
    if (isUpdate) value.quantity = current.quantity;
    if (
      !(await db
        .prepare("SELECT id FROM categories WHERE id = ?")
        .get(value.category_id)
      )
    )
      return response
        .status(422)
        .json({ message: "The selected category is invalid." });
    if (isUpdate)
      await db.prepare(
        "UPDATE products SET category_id = ?, sku = ?, name = ?, brand = ?, barcode = ?, description = ?, cost_price = ?, price = ?, quantity = ?, reorder_level = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(
        value.category_id,
        value.sku,
        value.name,
        value.brand ?? null,
        value.barcode ?? null,
        value.description ?? null,
        value.cost_price ?? 0,
        value.price,
        value.quantity,
        value.reorder_level,
        value.is_active ? 1 : 0,
        current.id,
      );
    else {
      const result = await db.prepare(
          "INSERT INTO products (category_id, sku, name, brand, barcode, description, cost_price, price, quantity, reorder_level, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          value.category_id,
          value.sku,
          value.name,
          value.brand ?? null,
          value.barcode ?? null,
          value.description ?? null,
          value.cost_price ?? 0,
          value.price,
          value.quantity,
          value.reorder_level,
          value.is_active ? 1 : 0,
        );
      request.params.id = Number(result.lastInsertRowid);
      if (value.quantity > 0) {
        await db.prepare(
          "INSERT INTO stock_movements (product_id, user_id, type, quantity, quantity_after, reference, notes) VALUES (?, ?, 'stock_in', ?, ?, 'INITIAL-STOCK', 'Opening inventory balance')",
        ).run(request.params.id, request.user.id, value.quantity, value.quantity);
      }
    }
    const product = await db.prepare("SELECT * FROM products WHERE id = ?")
      .get(isUpdate ? current.id : request.params.id);
    createNotification({
      role: "admin",
      title: isUpdate ? "Product updated" : "Product created",
      message: `${product.name} (${product.sku}) was ${isUpdate ? "updated" : "added"}.`,
      type: "product",
    });
    return response.status(isUpdate ? 200 : 201).json({
      message: `Product ${isUpdate ? "updated" : "created"} successfully.`,
      data: await productView(product),
    });
  } catch (error) {
    return next(error);
  }
}

async function saveUser(request, response, next, isUpdate) {
  try {
    const current = isUpdate
      ? await db.prepare("SELECT * FROM users WHERE id = ?").get(request.params.id)
      : null;
    if (isUpdate && !current)
      return response.status(404).json({ message: "User not found." });
    const data = parse(
      isUpdate ? userSchema.partial() : userSchema,
      request.body,
    );
    const value = { ...current, ...data };
    if (isUpdate) {
      const password = data.password
        ? bcrypt.hashSync(data.password, 10)
        : current.password;
      await db.prepare(
        "UPDATE users SET name = ?, email = ?, password = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(value.name, value.email, password, value.role, value.is_active === false ? 0 : 1, current.id);
    } else {
      const result = await db.prepare(
          "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        )
        .run(
          value.name,
          value.email,
          bcrypt.hashSync(value.password, 10),
          value.role,
        );
      request.params.id = Number(result.lastInsertRowid);
    }
    const user = await db.prepare(
        "SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?",
      )
      .get(isUpdate ? current.id : request.params.id);
    if (!isUpdate)
      createNotification({
        role: "admin",
        title: "Staff account created",
        message: `${user.name} was added as ${user.role}.`,
        type: "user",
      });
    return response.status(isUpdate ? 200 : 201).json({
      message: `User ${isUpdate ? "updated" : "created"} successfully.`,
      data: userView(user),
    });
  } catch (error) {
    return next(error);
  }
}

app.listen(port, () =>
  console.log(`MotoParts API listening on http://127.0.0.1:${port}`),
);

async function createNotification({ userId = null, role = null, title, message, type = "info" }) {
  await db.prepare(
    "INSERT INTO notifications (user_id, role, title, message, type) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, role, title, message, type);
}
