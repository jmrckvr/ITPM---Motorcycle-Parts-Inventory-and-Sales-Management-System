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

app.post("/api/auth/login", (request, response, next) => {
  try {
    const { email, password } = parse(loginSchema, request.body);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
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
api.post("/auth/logout", (_request, response) =>
  response.json({ message: "Logged out successfully." }),
);
api.get("/auth/me", (request, response) =>
  response.json({ user: request.user }),
);
api.get("/user", (request, response) => response.json(request.user));
api.get("/notifications", (request, response) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE (user_id = ? OR user_id IS NULL)
      AND (role = ? OR role IS NULL)
    ORDER BY created_at DESC, id DESC
  `).all(request.user.id, request.user.role).map(notificationView);
  return response.json({ data: notifications });
});
api.patch("/notifications/:id/read", (request, response) => {
  const result = db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE id = ? AND (user_id = ? OR user_id IS NULL)
  `).run(request.params.id, request.user.id);
  return result.changes
    ? response.json({ message: "Notification marked as read." })
    : response.status(404).json({ message: "Notification not found." });
});
api.post("/notifications/read-all", (request, response) => {
  db.prepare(`
    UPDATE notifications SET is_read = 1
    WHERE (user_id = ? OR user_id IS NULL) AND (role = ? OR role IS NULL)
  `).run(request.user.id, request.user.role);
  return response.json({ message: "Notifications marked as read." });
});
api.get("/dashboard/summary", (_request, response) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_products,
      SUM(CASE WHEN quantity > 0 AND quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock,
      SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock
    FROM products WHERE is_active = 1
  `).get();
  const sales = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS todays_sales, COUNT(*) AS transaction_count
    FROM sales WHERE status = 'completed' AND date(sold_at) = date('now', 'localtime')
  `).get();
  const recent = db.prepare("SELECT * FROM sales ORDER BY sold_at DESC, id DESC LIMIT 5").all().map(saleView);
  return response.json({ data: { ...stats, ...sales, recent } });
});

api.get("/categories", (_request, response) =>
  response.json({
    data: db
      .prepare("SELECT * FROM categories ORDER BY created_at DESC, id DESC")
      .all()
      .map(categoryView),
  }),
);
api.post("/categories", (request, response, next) => {
  try {
    const data = parse(categorySchema, request.body);
    const result = db
      .prepare(
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
        db.prepare("SELECT * FROM categories WHERE id = ?").get(categoryId),
      ),
    });
  } catch (error) {
    return next(error);
  }
});
api.get("/categories/:id", (request, response, next) =>
  sendCategory(request, response, next),
);
api.put("/categories/:id", (request, response, next) => {
  try {
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(request.params.id);
    if (!category)
      return response.status(404).json({ message: "Category not found." });
    const data = parse(categorySchema.partial(), request.body);
    const nextCategory = { ...category, ...data };
    db.prepare(
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
        db.prepare("SELECT * FROM categories WHERE id = ?").get(category.id),
      ),
    });
  } catch (error) {
    return next(error);
  }
});
api.delete("/categories/:id", (request, response) => {
  const result = db
    .prepare("DELETE FROM categories WHERE id = ?")
    .run(request.params.id);
  if (!result.changes)
    return response.status(404).json({ message: "Category not found." });
  return response.json({ message: "Category deleted successfully." });
});

api.get("/products", (_request, response) =>
  response.json({
    data: db
      .prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC, id DESC")
      .all()
      .map(productView),
  }),
);
api.post("/products", (request, response, next) =>
  saveProduct(request, response, next, false),
);
api.get("/products/:id", (request, response) => {
  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(request.params.id);
  return product
    ? response.json({ data: productView(product) })
    : response.status(404).json({ message: "Product not found." });
});
api.put("/products/:id", (request, response, next) =>
  saveProduct(request, response, next, true),
);
api.delete("/products/:id", (request, response) => {
  const result = db
    .prepare("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(request.params.id);
  if (!result.changes)
    return response.status(404).json({ message: "Product not found." });
  return response.json({ message: "Product archived successfully." });
});

api.get("/inventory", (_request, response) =>
  response.json({
    data: db
      .prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY quantity, id")
      .all()
      .map(productView),
  }),
);
api.get("/stock-movements", (_request, response) =>
  response.json({
    data: db
      .prepare(
        "SELECT * FROM stock_movements ORDER BY created_at DESC, id DESC",
      )
      .all()
      .map(movementView),
  }),
);
api.post("/stock-movements", (request, response, next) => {
  try {
    const data = parse(stockInSchema, request.body);
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(data.product_id);
    if (!product)
      return response
        .status(422)
        .json({ message: "The selected product is invalid." });
    const movement = db.transaction(() => {
      const quantityAfter = product.quantity + data.quantity;
      db.prepare(
        "UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(quantityAfter, product.id);
      const result = db
        .prepare(
          "INSERT INTO stock_movements (product_id, user_id, type, quantity, quantity_after, reference, notes) VALUES (?, ?, 'stock_in', ?, ?, ?, ?)",
        )
        .run(
          product.id,
          request.user.id,
          data.quantity,
          quantityAfter,
          data.reference || "STOCK-IN",
          data.notes || "Inventory stock-in",
        );
      return db
        .prepare("SELECT * FROM stock_movements WHERE id = ?")
        .get(Number(result.lastInsertRowid));
    })();
    createNotification({
      role: "admin",
      title: "Stock-in completed",
      message: `${product.name}: ${data.quantity} unit(s) received.`,
      type: "stock",
    });
    return response.status(201).json({
      message: "Stock moved in successfully.",
      data: movementView(movement),
    });
  } catch (error) {
    return next(error);
  }
});
api.post("/stock-out", (request, response, next) => {
  try {
    const data = parse(stockAdjustmentSchema, request.body);
    const product = db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(data.product_id);
    if (!product) return response.status(422).json({ message: "The selected product is invalid." });
    if (product.quantity < data.quantity)
      return response.status(422).json({ message: `Insufficient stock for ${product.name}.` });
    const movement = db.transaction(() => {
      const quantityAfter = product.quantity - data.quantity;
      db.prepare("UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(quantityAfter, product.id);
      const result = db.prepare(
        "INSERT INTO stock_movements (product_id, user_id, type, quantity, quantity_after, reference, notes) VALUES (?, ?, 'stock_out', ?, ?, 'ADJUSTMENT', ?)",
      ).run(product.id, request.user.id, data.quantity, quantityAfter, data.reason);
      return db.prepare("SELECT * FROM stock_movements WHERE id = ?").get(Number(result.lastInsertRowid));
    })();
    createNotification({
      role: "admin",
      title: "Stock adjustment recorded",
      message: `${product.name}: ${data.quantity} unit(s) removed. ${data.reason}`,
      type: "stock",
    });
    if (product.quantity - data.quantity <= product.reorder_level)
      createNotification({
        role: "admin",
        title: product.quantity - data.quantity === 0 ? "Out of stock alert" : "Low stock alert",
        message: `${product.name} now has ${product.quantity - data.quantity} unit(s).`,
        type: "inventory",
      });
    return response.status(201).json({ message: "Stock moved out successfully.", data: movementView(movement) });
  } catch (error) {
    return next(error);
  }
});

api.get("/sales", (_request, response) =>
  response.json({
    data: db
      .prepare("SELECT * FROM sales ORDER BY sold_at DESC, id DESC")
      .all()
      .map(saleView),
  }),
);
api.post("/sales", (request, response, next) => {
  try {
    const { items, payment_amount, payment_method } = parse(saleSchema, request.body);
    const sale = db.transaction(() => {
      const saleItems = [];
      let totalAmount = 0;
      const mergedItems = new Map();
      for (const item of items)
        mergedItems.set(item.product_id, (mergedItems.get(item.product_id) || 0) + item.quantity);
      for (const [productId, quantity] of mergedItems) {
        const product = db
          .prepare("SELECT * FROM products WHERE id = ?")
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
        db.prepare(
          "UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(quantityAfter, product.id);
        db.prepare(
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
      const saleResult = db
        .prepare(
          "INSERT INTO sales (cashier_id, transaction_number, total_amount, payment_amount, change_amount, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')",
        )
        .run(request.user.id, transactionNumber, totalAmount, payment_amount, payment_amount - totalAmount, payment_method);
      const insertItem = db.prepare(
        "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)",
      );
      for (const item of saleItems)
        insertItem.run(
          Number(saleResult.lastInsertRowid),
          item.product_id,
          item.quantity,
          item.unit_price,
          item.line_total,
        );
      return db
        .prepare("SELECT * FROM sales WHERE id = ?")
        .get(Number(saleResult.lastInsertRowid));
    })();
    return response.json({
      message: "Sale processed successfully.",
      data: saleView(sale),
    });
  } catch (error) {
    return next(error);
  }
});
api.get("/sales/:id", (request, response) => {
  const sale = db
    .prepare("SELECT * FROM sales WHERE id = ?")
    .get(request.params.id);
  return sale
    ? response.json({ data: saleView(sale) })
    : response.status(404).json({ message: "Sale not found." });
});

api.get("/reports/sales", (request, response) => {
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
  const sales = db
    .prepare(
      `SELECT * FROM sales ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY sold_at DESC`,
    )
    .all(...values);
  return response.json({
    data: sales,
    summary: {
      total_sales: sales.reduce((sum, sale) => sum + sale.total_amount, 0),
      transaction_count: sales.length,
    },
  });
});
api.get("/reports/inventory", (_request, response) =>
  response.json({
    data: db
      .prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY quantity, id")
      .all()
      .map((product) => ({
        ...productView(product),
        stock_on_hand: product.quantity,
        low_stock: product.quantity <= product.reorder_level ? 1 : 0,
      })),
  }),
);

api.get("/users", requireAdmin, (_request, response) =>
  response.json({
    data: db
      .prepare(
        "SELECT id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC, id DESC",
      )
      .all()
      .map(userView),
  }),
);
api.post("/users", requireAdmin, (request, response, next) =>
  saveUser(request, response, next, false),
);
api.put("/users/:id", requireAdmin, (request, response, next) =>
  saveUser(request, response, next, true),
);
api.delete("/users/:id", requireAdmin, (request, response) => {
  const result = db
    .prepare("DELETE FROM users WHERE id = ?")
    .run(request.params.id);
  if (!result.changes)
    return response.status(404).json({ message: "User not found." });
  return response.json({ message: "User deleted successfully." });
});

app.use("/api", api);
app.use((error, _request, response, _next) => {
  if (error.code?.startsWith("SQLITE_CONSTRAINT"))
    return response.status(422).json({
      message: "The submitted data conflicts with an existing record.",
    });
  return response.status(error.status || 500).json({
    message: error.message || "Server error.",
    ...(error.details ? { errors: error.details } : {}),
  });
});

function sendCategory(request, response) {
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(request.params.id);
  return category
    ? response.json({ data: categoryView(category) })
    : response.status(404).json({ message: "Category not found." });
}

function saveProduct(request, response, next, isUpdate) {
  try {
    const current = isUpdate
      ? db.prepare("SELECT * FROM products WHERE id = ?").get(request.params.id)
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
    if (
      !db
        .prepare("SELECT id FROM categories WHERE id = ?")
        .get(value.category_id)
    )
      return response
        .status(422)
        .json({ message: "The selected category is invalid." });
    if (isUpdate)
      db.prepare(
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
      const result = db
        .prepare(
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
    }
    const product = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(isUpdate ? current.id : request.params.id);
    createNotification({
      role: "admin",
      title: isUpdate ? "Product updated" : "Product created",
      message: `${product.name} (${product.sku}) was ${isUpdate ? "updated" : "added"}.`,
      type: "product",
    });
    return response.status(isUpdate ? 200 : 201).json({
      message: `Product ${isUpdate ? "updated" : "created"} successfully.`,
      data: productView(product),
    });
  } catch (error) {
    return next(error);
  }
}

function saveUser(request, response, next, isUpdate) {
  try {
    const current = isUpdate
      ? db.prepare("SELECT * FROM users WHERE id = ?").get(request.params.id)
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
      db.prepare(
        "UPDATE users SET name = ?, email = ?, password = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(value.name, value.email, password, value.role, value.is_active === false ? 0 : 1, current.id);
    } else {
      const result = db
        .prepare(
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
    const user = db
      .prepare(
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

function createNotification({ userId = null, role = null, title, message, type = "info" }) {
  db.prepare(
    "INSERT INTO notifications (user_id, role, title, message, type) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, role, title, message, type);
}
