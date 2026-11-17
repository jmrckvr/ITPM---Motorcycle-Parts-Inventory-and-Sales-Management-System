import { createServer } from "node:http";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.DB_NAME = "motoparts_test";

const { app } = await import("../src/server.js");
const { db } = await import("../src/db.js");
let server;
let baseUrl;

function request(pathname, options = {}) {
  const { headers, ...requestOptions } = options;
  return fetch(`${baseUrl}${pathname}`, {
    ...requestOptions,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
  }).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));
}

before(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.pool.close();
});

test("admin and staff workflows are authenticated and role restricted", async () => {
  const login = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@motoparts.test", password: "password123" }),
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "admin");
  const adminHeaders = { Authorization: `Bearer ${login.body.token}` };

  const categories = await request("/categories", { headers: adminHeaders });
  assert.equal(categories.status, 200);
  const categoryId = categories.body.data[0].id;
  assert.ok(categoryId, JSON.stringify(categories.body));
  const sku = `TEST-${Date.now()}`;
  const product = await request("/products", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      category_id: categoryId,
      sku,
      name: "Integration Test Brake Pad",
      brand: "Test",
      price: 250,
      cost_price: 150,
      quantity: 5,
      reorder_level: 2,
    }),
  });
  assert.equal(product.status, 201, JSON.stringify(product.body));
  const productId = product.body.data.id;

  const stockOut = await request("/stock-out", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ product_id: productId, quantity: 1, reason: "Integration test adjustment" }),
  });
  assert.equal(stockOut.status, 201);

  const sale = await request("/sales", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      items: [{ product_id: productId, quantity: 2 }],
      payment_amount: 500,
      payment_method: "cash",
    }),
  });
  assert.equal(sale.status, 200);
  assert.equal(sale.body.data.total_amount, 500);

  const inventory = await request("/inventory?search=Integration%20Test", { headers: adminHeaders });
  assert.equal(inventory.status, 200);
  assert.equal(inventory.body.data[0].quantity, 2);

  const report = await request("/reports/overview", { headers: adminHeaders });
  assert.equal(report.status, 200);
  assert.ok(report.body.summary.transaction_count >= 1);
  assert.ok(report.body.movements.some((movement) => movement.product?.id === productId));

  const notifications = await request("/notifications", { headers: adminHeaders });
  assert.equal(notifications.status, 200);
  assert.ok(notifications.body.data.length >= 1);

  const staffLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "staff@motoparts.test", password: "password123" }),
  });
  assert.equal(staffLogin.status, 200);
  const staffUsers = await request("/users", {
    headers: { Authorization: `Bearer ${staffLogin.body.token}` },
  });
  assert.equal(staffUsers.status, 403);
  const staffStockIn = await request("/stock-movements", {
    method: "POST",
    headers: { Authorization: `Bearer ${staffLogin.body.token}` },
    body: JSON.stringify({ product_id: productId, quantity: 1 }),
  });
  assert.equal(staffStockIn.status, 403);
  const staffReports = await request("/reports/overview", {
    headers: { Authorization: `Bearer ${staffLogin.body.token}` },
  });
  assert.equal(staffReports.status, 403);
  const unsupportedPayment = await request("/sales", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      items: [{ product_id: productId, quantity: 1 }],
      payment_amount: 250,
      payment_method: "card",
    }),
  });
  assert.equal(unsupportedPayment.status, 422);
});

test("users cannot escalate their own access or lock themselves out", async () => {
  const login = (email) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password: "password123" }) });
  const staff = await login("staff@motoparts.test");
  const staffHeaders = { Authorization: `Bearer ${staff.body.token}` };

  // A staff member sends role/is_active through their own profile: both are ignored.
  const promote = await request("/profile", {
    method: "PUT",
    headers: staffHeaders,
    body: JSON.stringify({ name: staff.body.user.name, role: "admin", is_active: false }),
  });
  assert.equal(promote.status, 200);
  assert.equal(promote.body.data.role, "staff");
  assert.equal(Boolean(promote.body.data.is_active), true);

  // Staff cannot post announcements.
  const announce = await request("/notifications", {
    method: "POST",
    headers: staffHeaders,
    body: JSON.stringify({ title: "Hi", message: "Test" }),
  });
  assert.equal(announce.status, 403);

  // An admin cannot deactivate or demote their own account.
  const admin = await login("admin@motoparts.test");
  const adminHeaders = { Authorization: `Bearer ${admin.body.token}` };
  for (const body of [{ is_active: false }, { role: "staff" }]) {
    const selfUpdate = await request(`/users/${admin.body.user.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify(body),
    });
    assert.equal(selfUpdate.status, 422);
  }

  // Dashboard and reports include the new fields.
  const summary = await request("/dashboard/summary", { headers: adminHeaders });
  assert.ok(Array.isArray(summary.body.data.top_products));
  const overview = await request("/reports/overview", { headers: adminHeaders });
  assert.equal(typeof overview.body.summary.gross_profit, "number");
});
