import { createRouter, createWebHistory } from "vue-router";

// App.vue draws every page itself, so each route only needs an empty component.
const routeComponent = { render: () => null };
const page = (path, name, meta = {}) => ({ path, name, component: routeComponent, meta });

const routes = [
  page("/login", "login", { guest: true }),
  page("/", "dashboard"),
  // Pages every signed-in user can open
  page("/pos", "pos"),
  page("/inventory", "inventory"),
  page("/sales", "sales"),
  page("/notifications", "notifications"),
  page("/profile", "profile"),
  // Admin-only pages (staff are sent back to the dashboard)
  page("/products", "products", { admin: true }),
  page("/stock-in", "stock-in", { admin: true }),
  page("/adjust-stock", "adjust-stock", { admin: true }),
  page("/catalog", "catalog", { admin: true }),
  page("/reports", "reports", { admin: true }),
  page("/users", "users", { admin: true }),
  page("/users/:id/profile", "user-profile", { admin: true }),
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const token = sessionStorage.getItem("auth_token");
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("auth_user") || "null"); } catch { /* invalid session */ }
  if (!token && !to.meta.guest) return { name: "login" };
  if (token && to.meta.guest) return { name: "dashboard" };
  if (to.meta.admin && user?.role !== "admin") return { name: "dashboard" };
  return true;
});

export default router;
